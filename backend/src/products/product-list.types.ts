/** GET /api/categories. One entry per category, in the order the store shows them. */
export interface CategoryResponse {
  id: number;
  name: string;
  slug: string;
  /** Products a customer can see in this category (removed products are not counted). */
  productCount: number;
}
