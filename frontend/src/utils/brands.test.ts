import { describe, expect, it } from "vitest";
import type { Product } from "../types/models";
import { brandOf, brandSummaries } from "./brands";
import { productStub } from "./productStub";

const product = (id: number, name: string): Product => productStub({ id, name, price: 10, image: "" });

describe("brandOf", () => {
  it("reads the brand from the start of the product name", () => {
    expect(brandOf("Nike Men Air Force 1 White Shoes")).toBe("Nike");
    expect(brandOf("Asics Women Gel Cushioning White Pink Shoe")).toBe("ASICS");
    expect(brandOf("New Balance MR310 Women Cushioning Grey Purple Shoe")).toBe("New Balance");
    expect(brandOf("REP Fitness Kettlebell")).toBe("REP Fitness");
  });

  it("gives no brand to unbranded products or look-alike words", () => {
    expect(brandOf("Fingerless Training Gloves")).toBeNull();
    expect(brandOf("Vanside Gym Bag")).toBeNull();
  });
});

describe("brandSummaries", () => {
  it("lists only the brands that have products, the biggest first", () => {
    const summaries = brandSummaries([
      product(1, "Puma Cap"),
      product(2, "Nike Shoes"),
      product(3, "Nike Socks"),
      product(4, "Rubber Hex Dumbbells"),
    ]);
    expect(summaries.map((s) => [s.name, s.products.length])).toEqual([
      ["Nike", 2],
      ["Puma", 1],
    ]);
  });
});
