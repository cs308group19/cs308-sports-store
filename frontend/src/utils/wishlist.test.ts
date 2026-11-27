import { describe, expect, it } from "vitest";
import type { Product } from "../types/models";
import { isInWishlist, toggleWishlistItem } from "./wishlist";

const sample = (id: number, name: string): Product => ({
  id,
  name,
  category: "Running",
  price: 120,
  stock: 5,
  rating: 4.5,
  reviews: 10,
  image: "/img.webp",
  description: "Test product",
  model: `M-${id}`,
  serial: `S-${id}`,
  warranty: "2 years",
  warrantyStatus: "Active",
  distributor: "RALLY",
  popularity: 1,
});

describe("wishlist helpers", () => {
  it("adds a product when it is not in the wishlist", () => {
    const shoe = sample(1, "Air Max");
    const first = toggleWishlistItem([], shoe);
    expect(first.saved).toBe(true);
    expect(first.items).toEqual([shoe]);
    expect(isInWishlist(first.items, shoe.id)).toBe(true);
  });

  it("removes a product when toggled a second time and leaves other items intact", () => {
    const shoe = sample(1, "Air Max");
    const ball = sample(2, "TF-150");
    const initial = [shoe, ball];

    const removed = toggleWishlistItem(initial, shoe);
    expect(removed.saved).toBe(false);
    expect(removed.items).toEqual([ball]);
    expect(isInWishlist(removed.items, shoe.id)).toBe(false);
    expect(isInWishlist(removed.items, ball.id)).toBe(true);
  });

  it("re-adds a previously removed product cleanly", () => {
    const shoe = sample(1, "Air Max");
    const added = toggleWishlistItem([], shoe);
    const removed = toggleWishlistItem(added.items, shoe);
    const reAdded = toggleWishlistItem(removed.items, shoe);
    expect(reAdded.saved).toBe(true);
    expect(reAdded.items).toEqual([shoe]);
  });
});
