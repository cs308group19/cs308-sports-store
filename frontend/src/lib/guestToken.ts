const STORAGE_KEY = "cs308.cartToken";
const TOKEN_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

let inMemoryToken: string | null = null;

function createToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The guest cart id. It is kept in localStorage so the cart survives a page reload. If storage is
 * blocked (private mode, disabled cookies), it lasts until the page is closed.
 */
export function getGuestToken(): string {
  if (inMemoryToken) return inMemoryToken;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && TOKEN_PATTERN.test(saved)) {
      inMemoryToken = saved;
      return saved;
    }
  } catch {
    // Storage is unavailable; fall through and use an in-memory token.
  }
  inMemoryToken = createToken();
  try {
    window.localStorage.setItem(STORAGE_KEY, inMemoryToken);
  } catch {
    // Nothing to do: the in-memory token keeps the cart for this page session.
  }
  return inMemoryToken;
}
