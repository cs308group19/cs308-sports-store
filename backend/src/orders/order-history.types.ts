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
  productId: number | string;
  name: string;
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
  items: OrderHistoryLine[];
}
