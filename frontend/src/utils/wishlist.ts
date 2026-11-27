import type { Product } from "../types/models";

/** Returns true when the product is currently saved in the wishlist. */
export function isInWishlist(wishlist: readonly Product[], productId: Product["id"]): boolean {
  const target = String(productId);
  return wishlist.some((item) => String(item.id) === target);
}

/**
 * Toggles a product in the wishlist: adds it when absent, removes it when already present.
 * Returns the updated list along with whether the product is now saved.
 */
export function toggleWishlistItem(
  wishlist: readonly Product[],
  product: Product,
): { items: Product[]; saved: boolean } {
  const target = String(product.id);
  if (wishlist.some((item) => String(item.id) === target)) {
    return {
      items: wishlist.filter((item) => String(item.id) !== target),
      saved: false,
    };
  }
  return {
    items: [...wishlist, product],
    saved: true,
  };
}
