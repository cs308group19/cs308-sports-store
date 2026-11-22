import { beforeEach, describe, expect, it, vi } from "vitest";

/** SCRUM-62 (cart). How the browser talks to /api/cart without a login. */
const apiFetch = vi.fn();
vi.mock("../lib/api", () => ({ apiFetch }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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
async function loadCartApi(localStorage: object) {
  vi.stubGlobal("window", { localStorage });
  vi.resetModules();
  return import("./cartApi");
}

const productResponse = {
  id: 3,
  name: "Court Vision Elite",
  model: "RLY-2026-02",
  serial: "R-89878",
  description: "Basketball shoe",
  category: "Basketball",
  categorySlug: "basketball",
  price: 116,
  oldPrice: 145,
  stock: 8,
  inStock: true,
  rating: 4.7,
  reviews: 89,
  popularity: 94,
  warranty: "12 months",
  warrantyStatus: "Active",
  distributor: "Peak Performance Ltd.",
  image: null,
};

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ items: [] });
});

describe("getCartToken", () => {
  it("creates a random UUID once and keeps it in localStorage", async () => {
    const storage = memoryStorage();
    const { getCartToken } = await loadCartApi(storage);

    const token = getCartToken();
    expect(token).toMatch(UUID);
    expect(storage.setItem).toHaveBeenCalledWith("rally.cartToken", token);
    expect(getCartToken()).toBe(token);
  });

  it("reuses the token saved by an earlier visit", async () => {
    const storage = memoryStorage();
    storage.setItem("rally.cartToken", "3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69");
    const { getCartToken } = await loadCartApi(storage);

    expect(getCartToken()).toBe("3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69");
  });

  it("still works when storage is blocked, keeping one token for the visit", async () => {
    const { getCartToken } = await loadCartApi(blockedStorage);

    const token = getCartToken();
    expect(token).toMatch(UUID);
    expect(getCartToken()).toBe(token);
  });
});

describe("cart requests", () => {
  it("loads the cart as a guest, sending the cart token instead of a login", async () => {
    const { fetchCart, getCartToken } = await loadCartApi(memoryStorage());
    apiFetch.mockResolvedValue({ items: [{ product: productResponse, quantity: 2 }] });

    const lines = await fetchCart();

    expect(apiFetch).toHaveBeenCalledWith("/cart", {
      method: "GET",
      body: undefined,
      auth: false,
      headers: { "X-Cart-Token": getCartToken() },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
    expect(lines[0].product).toMatchObject({ id: 3, name: "Court Vision Elite", price: 116 });
  });

  it("adds a product with quantity 1 by default", async () => {
    const { addCartItem } = await loadCartApi(memoryStorage());
    await addCartItem(3);

    expect(apiFetch).toHaveBeenCalledWith(
      "/cart/items",
      expect.objectContaining({ method: "POST", body: { productId: 3, quantity: 1 } }),
    );
  });

  it("changes the quantity of one line", async () => {
    const { setCartItemQuantity } = await loadCartApi(memoryStorage());
    await setCartItemQuantity(3, 5);

    expect(apiFetch).toHaveBeenCalledWith(
      "/cart/items/3",
      expect.objectContaining({ method: "PATCH", body: { quantity: 5 } }),
    );
  });

  it("removes one line", async () => {
    const { removeCartItem } = await loadCartApi(memoryStorage());
    await removeCartItem(3);

    expect(apiFetch).toHaveBeenCalledWith(
      "/cart/items/3",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("passes the server's error on, for example when the stock runs out", async () => {
    const { addCartItem } = await loadCartApi(memoryStorage());
    apiFetch.mockRejectedValue(new Error("Only 2 left in stock."));

    await expect(addCartItem(3, 5)).rejects.toThrow("Only 2 left in stock.");
  });
});
