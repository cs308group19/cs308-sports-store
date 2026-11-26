/** SCRUM-27. One order as GET /api/me/orders returns it (backend/src/orders/order-history.types.ts). */
export type OrderHistoryStatus = "processing" | "in_transit" | "delivered" | "cancelled";

export interface OrderHistoryLine {
  productId: number | string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  /** What the customer paid for one unit, after any discount. */
  unitPricePaid: number;
  lineTotal: number;
}

export interface OrderHistoryItem {
  id: number | string;
  orderNumber: string;
  placedAt: string;
  status: OrderHistoryStatus;
  total: number;
  items: OrderHistoryLine[];
}
