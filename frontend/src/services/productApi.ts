import { cataloguePhoto } from "./cataloguePhoto";
import { apiFetch } from "../lib/api";
import type { Category, Product, ProductComment } from "../types/models";

/** One product from GET /api/products (backend/src/products/product-detail.types.ts). */
export interface ProductSummaryResponse {
  id: number;
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
  id: number;
  name: Category;
  slug: string;
  productCount: number;
}

export interface ProductDetail extends Product {
  comments: ProductComment[];
}

export function toProduct(response: ProductSummaryResponse): Product {
  return {
    id: response.id,
    name: response.name,
    category: response.category,
    price: response.price,
    oldPrice: response.oldPrice,
    rating: response.rating,
    reviews: response.reviews,
    stock: response.stock,
    popularity: response.popularity,
    image: response.image?.trim() || cataloguePhoto(response.model),
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

/** SCRUM-13. Public endpoint. Pass a category slug to list one category only. */
export async function fetchProducts(categorySlug?: string): Promise<Product[]> {
  const query = categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : "";
  const response = await apiFetch<ProductSummaryResponse[]>(`/products${query}`, { auth: false });
  return response.map(toProduct);
}

/** SCRUM-13. Public endpoint: categories in display order with their product counts. */
export async function fetchCategories(): Promise<CategorySummary[]> {
  return apiFetch<CategorySummary[]>("/categories", { auth: false });
}

/** SCRUM-14. Public endpoint: works for guests too. */
export async function fetchProductDetail(id: number): Promise<ProductDetail> {
  const response = await apiFetch<ProductDetailResponse>(`/products/${id}`, { auth: false });
  return toProductDetail(response);
}
