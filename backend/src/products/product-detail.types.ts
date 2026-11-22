/** Labels match the frontend's Product type (frontend/src/types/models.ts). */
export type WarrantyStatusLabel = 'Active' | 'Expired' | 'Not applicable';

export interface ProductReviewResponse {
  id: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
}

/**
 * One product as a customer sees it: every property the course requires (feature 9).
 * GET /api/products returns a list of these; GET /api/products/:id adds the comments.
 */
export interface ProductSummaryResponse {
  id: number | string;
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
}

/** GET /api/products/:id. */
export interface ProductDetailResponse extends ProductSummaryResponse {
  /** Approved written comments only; ratings without a comment are counted in `rating`. */
  comments: ProductReviewResponse[];
}
