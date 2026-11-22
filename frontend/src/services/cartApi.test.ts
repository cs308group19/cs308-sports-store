import { beforeEach, describe, expect, it, vi } from "vitest";

/** SCRUM-62 (cart). Which cart endpoint the browser calls, for a guest and for a customer. */
const GUEST_TOKEN = "3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69";
const apiFetch = vi.fn();

vi.mock("../lib/api", () => ({
  apiFetch,
  ApiError: class ApiError extends Error {
    constructor(
      readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("../lib/guestToken", () => ({ getGuestToken: () => GUEST_TOKEN }));

const { addCartItem, cartErrorMessage, fetchCart, mergeGuestCart, removeCartItem, setCartQuantity } =
  await import("./cartApi");
const { ApiError } = await import("../lib/api");

const guest = { auth: false, headers: { "x-cart-token": GUEST_TOKEN } };
const emptyCart = { items: [], total: 0 };

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue(emptyCart);
});

describe("guest cart", () => {
  it("loads /cart without a login, sending the guest token", async () => {
    await expect(fetchCart(false)).resolves.toEqual(emptyCart);
    expect(apiFetch).toHaveBeenCalledWith("/cart", guest);
  });

  it("adds a product, sending its id as text", async () => {
    await addCartItem(3, false);
    expect(apiFetch).toHaveBeenCalledWith("/cart/items", {
      method: "POST",
      body: { productId: "3" },
      ...guest,
    });
  });

  it("changes the quantity of one line", async () => {
    await setCartQuantity("3", 5, false);
    expect(apiFetch).toHaveBeenCalledWith("/cart/items/3", {
      method: "PATCH",
      body: { quantity: 5 },
      ...guest,
    });
  });

  it("removes one line", async () => {
    await removeCartItem("3", false);
    expect(apiFetch).toHaveBeenCalledWith("/cart/items/3", { method: "DELETE", ...guest });
  });
});

describe("customer cart (SCRUM-17)", () => {
  it("uses /me/cart with the login instead of the guest token", async () => {
    await fetchCart(true);
    await addCartItem(3, true);
    await setCartQuantity("3", 2, true);
    await removeCartItem("3", true);

    expect(apiFetch.mock.calls).toEqual([
      ["/me/cart", {}],
      ["/me/cart/items", { method: "POST", body: { productId: "3" } }],
      ["/me/cart/items/3", { method: "PATCH", body: { quantity: 2 } }],
      ["/me/cart/items/3", { method: "DELETE" }],
    ]);
  });

  it("moves the guest cart into the customer cart after login", async () => {
    await mergeGuestCart();
    expect(apiFetch).toHaveBeenCalledWith("/me/cart/merge", {
      method: "POST",
      headers: { "x-cart-token": GUEST_TOKEN },
    });
  });
});

describe("cartErrorMessage", () => {
  it("shows the server's message, for example when the stock runs out", () => {
    expect(cartErrorMessage(new ApiError(400, "Only 2 left in stock."))).toBe(
      "Only 2 left in stock.",
    );
  });

  it("shows a general message for anything else", () => {
    expect(cartErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "Something went wrong with your cart. Please try again.",
    );
  });
});
