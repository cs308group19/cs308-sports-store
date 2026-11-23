import { beforeEach, describe, expect, it, vi } from "vitest";

/** SCRUM-26. Downloading a file (the invoice PDF) with the signed-in user's token. */
const getSession = vi.fn();
vi.mock("./supabase", () => ({ supabase: { auth: { getSession } } }));

const { ApiError, apiFetchFile, filenameFromDisposition } = await import("./api");

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: "token-123" } } });
  vi.stubGlobal("fetch", fetchMock);
});

describe("filenameFromDisposition", () => {
  it("reads a quoted file name", () => {
    expect(filenameFromDisposition('attachment; filename="INV-2026-000007.pdf"')).toBe(
      "INV-2026-000007.pdf",
    );
  });

  it("reads an unquoted file name", () => {
    expect(filenameFromDisposition("attachment; filename=invoice.pdf; size=10")).toBe("invoice.pdf");
  });

  it("returns null when there is no header or no file name", () => {
    expect(filenameFromDisposition(null)).toBeNull();
    expect(filenameFromDisposition("attachment")).toBeNull();
  });
});

describe("apiFetchFile", () => {
  it("sends the access token and returns the file with the server's file name", async () => {
    const pdf = new Blob(["%PDF-1.3"], { type: "application/pdf" });
    fetchMock.mockResolvedValue(
      new Response(pdf, {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="INV-2026-000007.pdf"' },
      }),
    );

    const file = await apiFetchFile("/me/invoices/7/pdf");

    expect(fetchMock).toHaveBeenCalledWith("/api/me/invoices/7/pdf", {
      headers: { Authorization: "Bearer token-123" },
    });
    expect(file.filename).toBe("INV-2026-000007.pdf");
    expect(await file.blob.text()).toBe("%PDF-1.3");
  });

  it("returns a null file name when the header is not readable", async () => {
    fetchMock.mockResolvedValue(new Response("%PDF-1.3", { status: 200 }));
    await expect(apiFetchFile("/me/invoices/7/pdf")).resolves.toMatchObject({ filename: null });
  });

  it("sends no Authorization header without a session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    fetchMock.mockResolvedValue(new Response("x", { status: 200 }));
    await apiFetchFile("/me/invoices/7/pdf");
    expect(fetchMock).toHaveBeenCalledWith("/api/me/invoices/7/pdf", { headers: {} });
  });

  it("turns a 404 into an ApiError with the server's message", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ statusCode: 404, message: "Invoice not found." }, { status: 404 }),
    );
    const error = await apiFetchFile("/me/invoices/9/pdf").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: "Invoice not found." });
  });

  it("explains a network failure in plain words", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiFetchFile("/me/invoices/7/pdf")).rejects.toMatchObject({
      status: 0,
      message: expect.stringMatching(/cannot reach the server/i),
    });
  });
});
