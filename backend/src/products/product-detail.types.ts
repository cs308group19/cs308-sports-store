/** Labels match the frontend's Product type (frontend/src/types/models.ts). */
export type WarrantyStatusLabel = 'Active' | 'Expired' | 'Not applicable';

export interface ProductReviewResponse {
  id: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
}

/** GET /api/products/:id. Every property the course requires for a product (feature 9). */
export interface ProductDetailResponse {
  id: number;
  name: string;
  model: string;
  serial: string;
  description: string;
  category: string;
  categorySlug: string;
  /** Price the customer pays today (discount applied). */
  price: number;
  /** List price, only when a discount is active. */
  oldPrice?: number;
  discountRate: number;
  stock: number;
  inStock: boolean;
  warrantyStatus: WarrantyStatusLabel;
  warranty: string;
  distributor: string;
  image: string | null;
  popularity: number;
  rating: number;
  reviews: number;
  /** Approved written comments only; ratings without a comment are counted in `rating`. */
  comments: ProductReviewResponse[];
}
