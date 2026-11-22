import { apiFetch } from "../lib/api";
import type { CartLine } from "../types/models";
import { type ProductSummaryResponse, toProduct } from "./productApi";

/** Shape of GET /api/cart (backend/src/cart/cart.view.ts). */
interface CartResponse {
  items: { product: ProductSummaryResponse; quantity: number }[];
}

const TOKEN_KEY = "rally.cartToken";
let memoryToken: string | undefined;

/**
 * SCRUM-16. A random id for this browser's guest cart. It is kept in localStorage so the cart
 * survives a reload; if storage is blocked (private mode) it lasts until the tab is closed.
 */
export function getCartToken(): string {
  try {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored) return stored;
  } catch {
    // Storage is unavailable; fall back to a token that lives in memory.
  }
  memoryToken ??= crypto.randomUUID();
  try {
    window.localStorage.setItem(TOKEN_KEY, memoryToken);
  } catch {
    // Same as above: the in-memory token still works for this visit.
  }
  return memoryToken;
}

function cartRequest(path: string, method = "GET", body?: unknown): Promise<CartLine[]> {
  return apiFetch<CartResponse>(`/cart${path}`, {
    method,
    body,
    auth: false,
    headers: { "X-Cart-Token": getCartToken() },
  }).then((response) =>
    response.items.map((item) => ({ product: toProduct(item.product), quantity: item.quantity })),
  );
}

export function fetchCart(): Promise<CartLine[]> {
  return cartRequest("");
}

/** Adding a product that is already in the cart raises its quantity. */
export function addCartItem(productId: number, quantity = 1): Promise<CartLine[]> {
  return cartRequest("/items", "POST", { productId, quantity });
}

export function setCartItemQuantity(productId: number, quantity: number): Promise<CartLine[]> {
  return cartRequest(`/items/${productId}`, "PATCH", { quantity });
}

export function removeCartItem(productId: number): Promise<CartLine[]> {
  return cartRequest(`/items/${productId}`, "DELETE");
}
