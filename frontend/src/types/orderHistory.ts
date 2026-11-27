/** SCRUM-27. One order as GET /api/me/orders returns it (backend/src/orders/order-history.types.ts). */
export type OrderHistoryStatus = "processing" | "in_transit" | "delivered" | "cancelled";

export type CommentStatus = "pending" | "approved" | "rejected";

export interface OrderHistoryLine {
  /** The order line's own id, unique even when the same product appears twice. */
  id: number | string;
  productId: number | string;
  name: string;
  /** The product model stored on the order, used to find the catalogue photo. */
  model: string | null;
  imageUrl: string | null;
  quantity: number;
  /** What the customer paid for one unit, after any discount. */
  unitPricePaid: number;
  lineTotal: number;
  delivered: boolean;
  review: {
    rating: number;
    hasComment?: boolean;
    commentStatus: CommentStatus | null;
  } | null;
}

export interface OrderHistoryItem {
  id: number | string;
  orderNumber: string;
  placedAt: string;
  status: OrderHistoryStatus;
  total: number;
  /** Present when checkout saved an invoice for this order. */
  invoiceId: number | string | null;
  items: OrderHistoryLine[];
}
