import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/api", () => ({ apiFetch: vi.fn() }));
const { apiFetch } = await import("../lib/api");
const { cataloguePhoto } = await import("./cataloguePhoto");
const { fetchProductDetail, fetchProducts, productListPath, toProduct } = await import(
  "./productApi"
);
type ProductSummaryResponse = import("./productApi").ProductSummaryResponse;

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

  it("sends only the sort when no category or search is chosen", () => {
    expect(productListPath({ sort: "price-desc" })).toBe("/products?sort=price-desc");
  });
});

const SHOE: ProductSummaryResponse = {
  id: 3,
  name: "Court Vision Elite",
  model: "RLY-2026-02",
  serial: "R-89878",
  description: "Basketball shoe",
  category: "Basketball",
  categorySlug: "basketball",
  price: 130.5,
  oldPrice: 145,
  discountRate: 10,
  stock: 8,
  inStock: true,
  warrantyStatus: "Active",
  warranty: "12 months",
  distributor: "Peak Performance Ltd.",
  image: "https://cdn.example.com/shoe.webp",
  popularity: 94,
  rating: 4.7,
  reviews: 89,
};

/** SCRUM-28 and SCRUM-29. Sorting and searching happen on the server; the shop keeps its order. */
describe("fetchProducts", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("asks without signing in and sends the search and the sort", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]);

    await fetchProducts({ category: "basketball", search: " court ", sort: "price-desc" });

    expect(apiFetch).toHaveBeenCalledWith("/products?category=basketball&q=court&sort=price-desc", {
      auth: false,
    });
  });

  it("keeps the order the server sent", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([
      { ...SHOE, id: 1, price: 20 },
      { ...SHOE, id: 2, price: 10 },
      { ...SHOE, id: 3, price: 30 },
    ]);

    const products = await fetchProducts({ sort: "price-desc" });

    expect(products.map((product) => product.id)).toEqual([1, 2, 3]);
  });

  it("returns an empty list when the search finds nothing", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]);

    await expect(fetchProducts({ search: "zzz" })).resolves.toEqual([]);
  });
});

/** SCRUM-30. The product card reads the stock from toProduct to show "Out of stock". */
describe("toProduct", () => {
  it("keeps the price paid, the old price, the stock and the popularity", () => {
    expect(toProduct(SHOE)).toMatchObject({
      id: 3,
      price: 130.5,
      oldPrice: 145,
      stock: 8,
      popularity: 94,
      image: "https://cdn.example.com/shoe.webp",
    });
  });

  it("keeps an out-of-stock product in the list with a stock of zero", () => {
    expect(toProduct({ ...SHOE, stock: 0, inStock: false })).toMatchObject({ id: 3, stock: 0 });
  });

  it.each([null, "", "   "])("uses the catalogue photo when the image is %o", (image) => {
    expect(toProduct({ ...SHOE, image }).image).toBe(cataloguePhoto(SHOE.model));
  });
});

/** SCRUM-14 and SCRUM-61. Product detail refreshes live stock and approved comments without login. */
describe("fetchProductDetail", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("loads a single product without auth and keeps its stock and approved comments", async () => {
    const comment = {
      id: 11,
      author: "Deniz",
      rating: 5,
      comment: "Great grip",
      createdAt: "2026-11-20T10:00:00.000Z",
    };
    vi.mocked(apiFetch).mockResolvedValueOnce({ ...SHOE, stock: 0, inStock: false, comments: [comment] });

    const detail = await fetchProductDetail(3);

    expect(apiFetch).toHaveBeenCalledWith("/products/3", { auth: false });
    expect(detail).toMatchObject({ id: 3, stock: 0, comments: [comment] });
  });
});
