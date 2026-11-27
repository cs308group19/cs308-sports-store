import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** SCRUM-113. The chat request: token, time limit and what each failure means. */
const getSession = vi.fn();
vi.mock("../lib/supabase", () => ({ supabase: { auth: { getSession } } }));

const { AssistantError, CHAT_TIMEOUT_MS, fetchContact, sendChat } = await import("./assistantApi");

const fetchMock = vi.fn();
const contact = { phone: "+90 212 111 22 33", email: "help@rally.test", hours: "every day" };
const turns = [{ role: "user" as const, content: "hi" }];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error("expected a failure");
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(AssistantError);
      return error as InstanceType<typeof AssistantError>;
    },
  );
/** A fetch that never answers until it is aborted. */
const hang = (_url: string, init: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    const aborted = () => reject(new DOMException("", "AbortError"));
    // Like fetch, an already aborted signal rejects at once.
    if (init.signal!.aborted) aborted();
    else init.signal!.addEventListener("abort", aborted);
  });

beforeEach(() => {
  fetchMock.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: null } });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sendChat", () => {
  it("posts the conversation and returns the reply", async () => {
    fetchMock.mockResolvedValue(json({ reply: "Hey!", products: [] }));

    await expect(sendChat(turns)).resolves.toEqual({ reply: "Hey!", products: [] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/assistant/chat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ messages: turns });
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("sends the signed-in customer's token", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "token-1" } } });
    fetchMock.mockResolvedValue(json({ reply: "Hey!", products: [] }));

    await sendChat(turns);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token-1");
  });

  it("asks as a guest when the session cannot be read", async () => {
    getSession.mockRejectedValue(new Error("storage"));
    fetchMock.mockResolvedValue(json({ reply: "Hey!", products: [] }));
    await expect(sendChat(turns)).resolves.toBeDefined();
  });

  it("keeps only complete products and contact details", async () => {
    const product = { id: 1, name: "Shoe", price: 90, stock: 1, image: null, model: "M", brand: null };
    fetchMock.mockResolvedValue(json({ reply: "ok", products: [{ id: 2 }, product], contact }));

    await expect(sendChat(turns)).resolves.toEqual({ reply: "ok", products: [product], contact });
  });

  it("reports offline with the contact details the backend sent with a 503", async () => {
    fetchMock.mockResolvedValue(json({ statusCode: 503, contact }, 503));
    await expect(failure(sendChat(turns))).resolves.toMatchObject({ kind: "offline", contact });
  });

  it.each([
    [429, "busy"],
    [400, "invalid"],
    [413, "invalid"],
    [500, "offline"],
    [502, "offline"],
  ])("reads %s as %s", async (status, kind) => {
    fetchMock.mockResolvedValue(json({}, status));
    await expect(failure(sendChat(turns))).resolves.toMatchObject({ kind });
  });

  it.each([
    ["a page that is not JSON", () => Promise.resolve(new Response("<html>", { status: 200 }))],
    ["an answer without a reply", () => Promise.resolve(json({ products: [] }))],
    ["a network failure", () => Promise.reject(new TypeError("Failed to fetch"))],
  ])("reports offline for %s", async (_name, answer) => {
    fetchMock.mockImplementation(answer);
    await expect(failure(sendChat(turns))).resolves.toMatchObject({ kind: "offline" });
  });

  it("waits longer than the backend does, then reports offline", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(hang);
    const result = failure(sendChat(turns));

    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(CHAT_TIMEOUT_MS - 30_000);

    await expect(result).resolves.toMatchObject({ kind: "offline" });
  });

  it("stops when the caller aborts", async () => {
    fetchMock.mockImplementation(hang);
    const controller = new AbortController();
    const result = failure(sendChat(turns, { signal: controller.signal }));
    controller.abort();
    await expect(result).resolves.toMatchObject({ kind: "offline" });
  });
});

describe("fetchContact", () => {
  it("reads the contact details", async () => {
    fetchMock.mockResolvedValue(json(contact));
    await expect(fetchContact()).resolves.toEqual(contact);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/assistant/contact");
  });

  it("fails when they cannot be read", async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    await failure(fetchContact());
  });
});
