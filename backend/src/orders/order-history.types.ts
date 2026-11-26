/** The four statuses an order can have (prisma OrderStatus). */
export const ORDER_HISTORY_STATUSES = [
  'processing',
  'in_transit',
  'delivered',
  'cancelled',
] as const;

export type OrderHistoryStatus = (typeof ORDER_HISTORY_STATUSES)[number];

/** One product line of an order, as the customer paid for it. Money is in pounds/dollars, rounded to cents. */
export interface OrderHistoryLine {
  /** The order line's own id (order_items.id), unique even when a product appears twice. */
  id: number | string;
  productId: number | string;
  name: string;
  /** The product model stored on the order, used to find the catalogue photo. */
  model: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPricePaid: number;
  lineTotal: number;
}

/** One entry of GET /api/me/orders. */
export interface OrderHistoryItem {
  id: number | string;
  orderNumber: string;
  placedAt: string;
  status: OrderHistoryStatus;
  total: number;
  /** The invoice saved with this order, so the customer can open it again from history. */
  invoiceId: number | string | null;
  items: OrderHistoryLine[];
}
