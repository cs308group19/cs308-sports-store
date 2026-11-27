import { describe, expect, it, vi } from "vitest";
import type { AssistantProduct } from "../../services/assistantApi";

// assistantApi loads the Supabase client, which needs real settings.
vi.mock("../../lib/supabase", () => ({ supabase: { auth: { getSession: vi.fn() } } }));

const {
  addEntry,
  chatFor,
  contactMessage,
  DEFAULT_CONTACT,
  emptyChat,
  failureMessage,
  firstName,
  greeting,
  loadChat,
  MAX_HISTORY,
  MAX_MESSAGE_LENGTH,
  MAX_SAVED,
  offlineMessage,
  parseChat,
  priceLine,
  saveChat,
  serializeChat,
  STORAGE_KEY,
  toCard,
  toHistory,
  trimMessage,
} = await import("./rallyChat");
type ChatState = ReturnType<typeof emptyChat>;

const contact = { phone: "+90 212 111 22 33", email: "help@rally.test", hours: "every day" };
const product: AssistantProduct = {
  id: 4,
  name: "Asics Women Gel Cushioning White Pink Shoe",
  brand: "ASICS",
  price: 95,
  stock: 18,
  image: null,
  model: "AS-GELC-WPK",
};

/** A chat built from "u: …" (user), "a: …" (Rally) and "n: …" (widget notice) lines. */
function chatOf(...lines: string[]): ChatState {
  return lines.reduce(
    (chat, line) =>
      addEntry(chat, {
        role: line.startsWith("u") ? "user" : "assistant",
        text: line.slice(3),
        ...(line.startsWith("n") ? { notice: true } : {}),
      }),
    emptyChat(),
  );
}

describe("greeting", () => {
  it("uses the customer's first name when there is one", () => {
    expect(greeting(firstName("  Jamie Taylor "))).toMatch(/^Hey Jamie! I'm Rally\./);
    expect(greeting(firstName(""))).toMatch(/^Hey! I'm Rally\./);
    expect(greeting()).toMatch(/^Hey! I'm Rally\./);
  });
});

describe("toHistory", () => {
  it("sends the conversation in order, without the widget's own notices", () => {
    const chat = chatOf("u: hi", "a: Hey!", "u: shoes", "n: offline", "u: still there?");
    expect(toHistory(chat.entries)).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hey!" },
      { role: "user", content: "shoes" },
      { role: "user", content: "still there?" },
    ]);
  });

  it("trims every message, cuts it at 2000 characters and drops empty ones", () => {
    const chat = chatOf(`a:    `, `u:   ${"x".repeat(MAX_MESSAGE_LENGTH + 50)}  `);
    expect(toHistory(chat.entries)).toEqual([
      { role: "user", content: "x".repeat(MAX_MESSAGE_LENGTH) },
    ]);
  });

  it(`keeps the newest ${MAX_HISTORY} messages`, () => {
    const chat = chatOf(
      ...Array.from({ length: 31 }, (_, i) => `${i % 2 === 0 ? "u" : "a"}: ${i}`),
    );
    const history = toHistory(chat.entries);
    expect(history).toHaveLength(MAX_HISTORY);
    expect(history[0].content).toBe("11");
    expect(history.at(-1)).toEqual({ role: "user", content: "30" });
  });

  it("always ends with the user's message", () => {
    expect(toHistory(chatOf("u: hi", "a: phone number").entries)).toEqual([
      { role: "user", content: "hi" },
    ]);
    expect(toHistory(chatOf("a: phone number").entries)).toEqual([]);
  });

  it("does not leave spaces behind when it cuts a long message", () => {
    expect(trimMessage(`${"x".repeat(MAX_MESSAGE_LENGTH - 1)}   y`)).toHaveLength(
      MAX_MESSAGE_LENGTH - 1,
    );
  });
});

describe("chatFor", () => {
  const guest = chatOf("u: hi");

  it("keeps a guest's chat when they sign in", () => {
    expect(chatFor(guest, "jamie")).toEqual({ ...guest, owner: "jamie" });
  });

  it("starts over after signing out or switching accounts", () => {
    const jamies = chatFor(guest, "jamie");
    expect(chatFor(jamies, null)).toEqual(emptyChat(null));
    expect(chatFor(jamies, "alex")).toEqual(emptyChat("alex"));
    expect(chatFor(jamies, "jamie")).toBe(jamies);
  });
});

describe("saving the chat in sessionStorage", () => {
  const memory = () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
    return { values, storage: () => storage };
  };

  it("reads back what was saved", () => {
    const chat: ChatState = {
      ...addEntry(chatOf("u: shoes", "n: offline"), {
        role: "assistant",
        text: "This one",
        products: [product],
      }),
      owner: "jamie",
      contact,
    };
    const { storage, values } = memory();

    saveChat(storage, chat);

    expect([...values.keys()]).toEqual([STORAGE_KEY]);
    expect(loadChat(storage)).toEqual(chat);
  });

  it("saves only the newest messages", () => {
    const entries = Array.from({ length: MAX_SAVED + 5 }, (_, i) => ({
      id: i,
      role: "user" as const,
      text: `${i}`,
    }));
    expect(parseChat(serializeChat({ owner: null, entries })).entries[0].text).toBe("5");
  });

  it.each([null, "", "not json", "null", "42", "[]", '{"entries":"x"}'])(
    "starts empty from %s",
    (raw) => {
      expect(parseChat(raw)).toEqual(emptyChat());
    },
  );

  it("drops damaged messages, products and contact details", () => {
    const raw = JSON.stringify({
      owner: 7,
      contact: { phone: 1 },
      entries: [
        null,
        { id: 1, role: "system", text: "x" },
        { id: 2, role: "user" },
        { id: 3, role: "assistant", text: "ok", products: [{ name: "no id" }, product] },
      ],
    });
    expect(parseChat(raw)).toEqual({
      owner: null,
      entries: [{ id: 3, role: "assistant", text: "ok", products: [product] }],
    });
  });

  it("works without storage", () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    expect(loadChat(blocked)).toEqual(emptyChat());
    expect(() => saveChat(blocked, chatOf("u: hi"))).not.toThrow();
  });
});

describe("product cards", () => {
  it("shows the price with the stock, the old price or that it is sold out", () => {
    expect(priceLine(product)).toBe("$95 · 18 in stock");
    expect(priceLine({ ...product, price: 95.2, oldPrice: 119 })).toBe("$95.20 · was $119");
    expect(priceLine({ ...product, oldPrice: 119, stock: 0 })).toBe("$95 · Out of stock");
  });

  it("uses the catalogue photo of the model when nothing is uploaded", () => {
    const card = toCard(product);
    expect(card).toMatchObject({ id: 4, name: product.name, meta: "$95 · 18 in stock" });
    expect(card.image).toContain("AS-GELC-WPK");
  });

  it("prefers the uploaded photo", () => {
    expect(toCard({ ...product, image: "https://example.test/shoe.webp" }).image).toBe(
      "https://example.test/shoe.webp",
    );
  });

  it("gives openProduct enough to open the page, which loads the rest by id", () => {
    const { product: stub, image } = toCard(product);
    expect(stub).toMatchObject({
      id: 4,
      name: product.name,
      price: 95,
      model: "AS-GELC-WPK",
      image,
      category: "",
    });
  });
});

describe("the widget's own messages", () => {
  it("says Rally is offline and gives the phone, hours and email", () => {
    const message = offlineMessage(contact);
    expect(message).toContain("Rally is offline right now");
    expect(message).toContain("+90 212 111 22 33 (every day)");
    expect(message).toContain("help@rally.test");
    expect(failureMessage("offline", contact)).toBe(message);
  });

  it("has built-in contact details for when the backend cannot be reached", () => {
    expect(offlineMessage(DEFAULT_CONTACT)).toContain("support@rally.store");
  });

  it("asks to slow down or shorten the message without calling Rally offline", () => {
    expect(failureMessage("busy", contact)).toMatch(/minute/);
    expect(failureMessage("invalid", contact)).toMatch(/shorter/);
    expect(failureMessage("busy", contact) + failureMessage("invalid", contact)).not.toContain(
      "offline",
    );
  });

  it("gives the contact details for Talk to a person", () => {
    expect(contactMessage(contact)).toContain("Phone: +90 212 111 22 33 (every day)");
    expect(contactMessage(contact)).toContain("Email: help@rally.test");
  });
});
