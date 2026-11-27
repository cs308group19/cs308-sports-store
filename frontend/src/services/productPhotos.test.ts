import { describe, expect, it } from "vitest";
import { cartLineImage, PHOTO_UNAVAILABLE, rememberPhoto } from "./productPhotos";

describe("cartLineImage", () => {
  it("uses the uploaded photo when the line has one", () => {
    expect(cartLineImage({ productId: "1", imageUrl: "https://example.test/a.webp" })).toBe(
      "https://example.test/a.webp",
    );
  });

  it("uses the catalogue photo of the model even before the shop has been loaded", () => {
    expect(cartLineImage({ productId: "42", imageUrl: null, model: "NK-AF1-WHT" })).toContain(
      "NK-AF1-WHT",
    );
  });

  it("uses the photo the shop already showed for that product", () => {
    rememberPhoto(7, "/assets/dunk.webp");
    expect(cartLineImage({ productId: "7", imageUrl: null })).toBe("/assets/dunk.webp");
  });

  it("shows the photo-unavailable picture when there is no photo at all", () => {
    expect(cartLineImage({ productId: "999", imageUrl: null })).toBe(PHOTO_UNAVAILABLE);
  });
});
