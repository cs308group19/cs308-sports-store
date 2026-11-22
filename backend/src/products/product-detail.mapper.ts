import type {
  WarrantyStatus,
  ReviewStatus,
} from '../generated/prisma/enums.js';
import {
  applyDiscount,
  type DecimalLike,
  roundToCents,
  toNumber,
} from '../common/money.js';
import type {
  ProductDetailResponse,
  ProductReviewResponse,
  WarrantyStatusLabel,
} from './product-detail.types.js';

/** The product row with the relations the detail page needs (see ProductDetailService). */
export interface ProductDetailRow {
  id: bigint;
  name: string;
  model: string;
  serialNumber: string;
  description: string;
  stockQuantity: number;
  price: DecimalLike;
  discountRate: DecimalLike;
  warrantyStatus: WarrantyStatus;
  warrantyTerm: string;
  distributor: string;
  imageUrl: string | null;
  popularity: number;
  averageRating: DecimalLike;
  reviewCount: number;
  category: { name: string; slug: string };
  reviews: ProductReviewRow[];
}

export interface ProductReviewRow {
  id: bigint;
  rating: number;
  comment: string | null;
  commentStatus: ReviewStatus;
  createdAt: Date;
  user: { fullName: string };
}

const WARRANTY_LABELS: Record<WarrantyStatus, WarrantyStatusLabel> = {
  active: 'Active',
  expired: 'Expired',
  not_applicable: 'Not applicable',
};

/** "Jamie Taylor" -> "Jamie T." so other shoppers never see a full name. */
export function shortAuthorName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Verified buyer';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export function toReviewResponse(row: ProductReviewRow): ProductReviewResponse {
  return {
    id: row.id.toString(),
    rating: row.rating,
    comment: row.comment ?? '',
    author: shortAuthorName(row.user.fullName),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toProductDetail(row: ProductDetailRow): ProductDetailResponse {
  const listPrice = toNumber(row.price);
  const discountRate = toNumber(row.discountRate);
  const price = applyDiscount(listPrice, discountRate);

  return {
    id: Number(row.id),
    name: row.name,
    model: row.model,
    serial: row.serialNumber,
    description: row.description,
    category: row.category.name,
    categorySlug: row.category.slug,
    price,
    ...(discountRate > 0 ? { oldPrice: roundToCents(listPrice) } : {}),
    discountRate,
    stock: row.stockQuantity,
    inStock: row.stockQuantity > 0,
    warrantyStatus: WARRANTY_LABELS[row.warrantyStatus],
    warranty: row.warrantyTerm,
    distributor: row.distributor,
    image: row.imageUrl,
    popularity: row.popularity,
    rating: toNumber(row.averageRating),
    reviews: row.reviewCount,
    // Comments stay hidden until a product manager approves them (feature 5).
    comments: row.reviews
      .filter(
        (review) =>
          review.commentStatus === 'approved' &&
          (review.comment ?? '').trim() !== '',
      )
      .map(toReviewResponse),
  };
}
