import { describe, expect, it, vi } from "vitest";

/** SCRUM-62 (cart). The random id of this browser's guest cart. */
const TOKEN = /^[A-Za-z0-9-]{16,64}$/;

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void data.set(key, value)),
  };
}

const blockedStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("SecurityError");
  },
};

/** A fresh copy of the module, so the in-memory token of one test never leaks into the next. */
async function loadGuestToken(localStorage: object) {
  vi.stubGlobal("window", { localStorage });
  vi.resetModules();
  return import("./guestToken");
}

describe("getGuestToken", () => {
  it("creates a random token once and keeps it in localStorage", async () => {
    const storage = memoryStorage();
    const { getGuestToken } = await loadGuestToken(storage);

    const token = getGuestToken();
    expect(token).toMatch(TOKEN);
    expect(storage.setItem).toHaveBeenCalledWith("cs308.cartToken", token);
    expect(getGuestToken()).toBe(token);
  });

  it("reuses the token saved by an earlier visit", async () => {
    const storage = memoryStorage();
    storage.setItem("cs308.cartToken", "3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69");
    const { getGuestToken } = await loadGuestToken(storage);

    expect(getGuestToken()).toBe("3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69");
  });

  it("replaces a saved value the backend would reject", async () => {
    const storage = memoryStorage();
    storage.setItem("cs308.cartToken", "not valid!");
    const { getGuestToken } = await loadGuestToken(storage);

    const token = getGuestToken();
    expect(token).not.toBe("not valid!");
    expect(token).toMatch(TOKEN);
  });

  it("still works when storage is blocked, keeping one token for the visit", async () => {
    const { getGuestToken } = await loadGuestToken(blockedStorage);

    const token = getGuestToken();
    expect(token).toMatch(TOKEN);
    expect(getGuestToken()).toBe(token);
  });
});
