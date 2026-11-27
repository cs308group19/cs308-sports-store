import type { Product } from "../types/models";

export const PHOTO_UNAVAILABLE = "/images/photo-unavailable.svg";

/**
 * The photo of every product the app has loaded. Cart lines carry no photo for the seeded
 * products (nothing is uploaded), so the cart and checkout look it up here by product id.
 */
const photos = new Map<string, string>();

export function rememberPhoto(id: Product["id"], image: string): void {
  photos.set(String(id), image);
}

export function cartLineImage(line: { productId: string; imageUrl: string | null }): string {
  return line.imageUrl?.trim() || photos.get(String(line.productId)) || PHOTO_UNAVAILABLE;
}
