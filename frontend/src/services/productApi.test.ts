import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/api", () => ({ apiFetch: vi.fn() }));
const { productListPath } = await import("./productApi");

/** SCRUM-28 and SCRUM-29. The shop sends its filters to GET /api/products. */
describe("productListPath", () => {
  it("asks for every product, most popular first, when nothing is chosen", () => {
    expect(productListPath()).toBe("/products");
    expect(productListPath({ category: "", search: "   ", sort: "popularity" })).toBe("/products");
  });

  it("sends the category, the trimmed search and the sort", () => {
    expect(productListPath({ category: "running", search: "  trail shoe ", sort: "price-asc" })).toBe(
      "/products?category=running&q=trail+shoe&sort=price-asc",
    );
  });

  it("encodes characters that mean something in a URL", () => {
    expect(productListPath({ search: "50% & more" })).toBe("/products?q=50%25+%26+more");
  });
});
