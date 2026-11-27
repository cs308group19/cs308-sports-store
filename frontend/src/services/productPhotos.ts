import type { Product } from "../types/models";
import { cataloguePhoto } from "./cataloguePhoto";

export const PHOTO_UNAVAILABLE = "/images/photo-unavailable.svg";

/**
 * The photo of every product the app has loaded. Used as a fallback for cart lines that carry no
 * uploaded photo or model code.
 */
const photos = new Map<string, string>();

export function rememberPhoto(id: Product["id"], image: string): void {
  photos.set(String(id), image);
}

export function cartLineImage(line: {
  productId: string;
  imageUrl: string | null;
  model?: string | null;
}): string {
  const uploaded = line.imageUrl?.trim();
  if (uploaded) return uploaded;
  if (line.model) {
    const local = cataloguePhoto(line.model);
    if (local !== PHOTO_UNAVAILABLE) return local;
  }
  return photos.get(String(line.productId)) || PHOTO_UNAVAILABLE;
}
