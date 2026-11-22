import { apiFetch } from "../lib/api";
import type { Category, Product, ProductComment } from "../types/models";

/** Shape of GET /api/products/:id (backend/src/products/product-detail.types.ts). */
export interface ProductDetailResponse {
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
  comments: ProductComment[];
}

export interface ProductDetail extends Product {
  comments: ProductComment[];
}

/** Used when the database has no image for a product yet. */
export const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1789520482092-bf7a66ef8281?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900";

export function toProductDetail(response: ProductDetailResponse): ProductDetail {
  return {
    id: response.id,
    name: response.name,
    category: response.category as Category,
    price: response.price,
    oldPrice: response.oldPrice,
    rating: response.rating,
    reviews: response.reviews,
    stock: response.stock,
    popularity: response.popularity,
    image: response.image ?? PLACEHOLDER_IMAGE,
    model: response.model,
    serial: response.serial,
    warranty: response.warranty,
    warrantyStatus: response.warrantyStatus,
    distributor: response.distributor,
    description: response.description,
    comments: response.comments,
  };
}

/** SCRUM-14. Public endpoint: works for guests too. */
export async function fetchProductDetail(id: number): Promise<ProductDetail> {
  const response = await apiFetch<ProductDetailResponse>(`/products/${id}`, { auth: false });
  return toProductDetail(response);
}
