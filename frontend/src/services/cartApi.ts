import { ApiError, apiFetch } from "../lib/api";
import { getGuestToken } from "../lib/guestToken";
import type { CartView, Product } from "../types/models";

const TOKEN_HEADER = "x-cart-token";

/** Signed-in customers use /me/cart. Visitors use /cart and send their guest token. */
function route(signedIn: boolean, path: string): string {
  return signedIn ? `/me/cart${path}` : `/cart${path}`;
}

function guestOptions() {
  return { auth: false, headers: { [TOKEN_HEADER]: getGuestToken() } };
}

function request(
  signedIn: boolean,
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<CartView> {
  return signedIn
    ? apiFetch<CartView>(route(true, path), options)
    : apiFetch<CartView>(route(false, path), { ...options, ...guestOptions() });
}

export function fetchCart(signedIn: boolean): Promise<CartView> {
  return request(signedIn, "");
}

export function addCartItem(productId: Product["id"], signedIn: boolean): Promise<CartView> {
  return request(signedIn, "/items", { method: "POST", body: { productId: String(productId) } });
}

export function setCartQuantity(
  productId: string,
  quantity: number,
  signedIn: boolean,
): Promise<CartView> {
  return request(signedIn, `/items/${productId}`, { method: "PATCH", body: { quantity } });
}

export function removeCartItem(productId: string, signedIn: boolean): Promise<CartView> {
  return request(signedIn, `/items/${productId}`, { method: "DELETE" });
}

/** Moves the guest cart into the signed-in customer's cart. Call right after login. */
export function mergeGuestCart(): Promise<CartView> {
  return apiFetch<CartView>("/me/cart/merge", {
    method: "POST",
    headers: { [TOKEN_HEADER]: getGuestToken() },
  });
}

export function cartErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong with your cart. Please try again.";
}
