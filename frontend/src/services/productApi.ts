import { cataloguePhoto } from "./cataloguePhoto";
import { rememberPhoto } from "./productPhotos";
import { apiFetch } from "../lib/api";
import type { Category, Product, ProductComment } from "../types/models";

/** One product from GET /api/products (backend/src/products/product-detail.types.ts). */
export interface ProductSummaryResponse {
  id: Product["id"];
  name: string;
  model: string;
  serial: string;
  description: string;
  category: string;
  categorySlug: string;
  price: number;
  oldPrice?: number;
  discountRate: number;
  stock: number;
  inStock: boolean;
  warrantyStatus: Product["warrantyStatus"];
  warranty: string;
  distributor: string;
  image: string | null;
  popularity: number;
  rating: number;
  reviews: number;
}

/** Shape of GET /api/products/:id. */
export interface ProductDetailResponse extends ProductSummaryResponse {
  comments: ProductComment[];
}

/** Shape of GET /api/categories (backend/src/products/product-list.types.ts). */
export interface CategorySummary {
  id: Product["id"];
  name: Category;
  slug: string;
  productCount: number;
}

export interface ProductDetail extends Product {
  comments: ProductComment[];
}

export function toProduct(response: ProductSummaryResponse): Product {
  const image = response.image?.trim() || cataloguePhoto(response.model);
  rememberPhoto(response.id, image);
  return {
    id: response.id,
    name: response.name,
    category: response.category,
    categorySlug: response.categorySlug,
    price: response.price,
    oldPrice: response.oldPrice,
    rating: response.rating,
    reviews: response.reviews,
    stock: response.stock,
    popularity: response.popularity,
    image,
    model: response.model,
    serial: response.serial,
    warranty: response.warranty,
    warrantyStatus: response.warrantyStatus,
    distributor: response.distributor,
    description: response.description,
  };
}

export function toProductDetail(response: ProductDetailResponse): ProductDetail {
  return { ...toProduct(response), comments: response.comments };
}

/** SCRUM-29. Orders GET /api/products accepts. Price is the price after the discount. */
export type ProductSort = "popularity" | "price-asc" | "price-desc";

/** The backend rejects longer searches (backend/src/products/product-list.service.ts). */
export const MAX_SEARCH_LENGTH = 100;

export interface ProductListOptions {
  /** Category slug from GET /api/categories. Empty or missing means every category. */
  category?: string;
  /** SCRUM-28. Words to find in the product name or description. */
  search?: string;
  sort?: ProductSort;
}

/** Builds the GET /api/products path, leaving out every option that is not set. */
export function productListPath({ category, search, sort }: ProductListOptions = {}): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const words = search?.trim();
  if (words) params.set("q", words);
  if (sort && sort !== "popularity") params.set("sort", sort);
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

/** SCRUM-13, 28 and 29. Public endpoint: filter, search and sort happen on the server. */
export async function fetchProducts(options: ProductListOptions = {}): Promise<Product[]> {
  const response = await apiFetch<ProductSummaryResponse[]>(productListPath(options), {
    auth: false,
  });
  return response.map(toProduct);
}

/** SCRUM-13. Public endpoint: categories in display order with their product counts. */
export async function fetchCategories(): Promise<CategorySummary[]> {
  return apiFetch<CategorySummary[]>("/categories", { auth: false });
}

/** SCRUM-14. Public endpoint: works for guests too. */
export async function fetchProductDetail(id: Product["id"]): Promise<ProductDetail> {
  const response = await apiFetch<ProductDetailResponse>(`/products/${id}`, { auth: false });
  return toProductDetail(response);
}
