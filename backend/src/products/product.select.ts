/**
 * Columns a customer may see for a product. Shared by the shop list (SCRUM-13) and the detail
 * page (SCRUM-14) so both always send the same fields. `cost` is deliberately left out: it is for
 * managers only.
 */
export const PRODUCT_SUMMARY_SELECT = {
  id: true,
  name: true,
  model: true,
  serialNumber: true,
  description: true,
  stockQuantity: true,
  price: true,
  discountRate: true,
  warrantyStatus: true,
  warrantyTerm: true,
  distributor: true,
  imageUrl: true,
  popularity: true,
  averageRating: true,
  reviewCount: true,
  category: { select: { name: true, slug: true } },
} as const;
