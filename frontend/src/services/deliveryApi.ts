import { ApiError, apiFetch } from "../lib/api";

export type DeliveryStatus = "processing" | "in_transit" | "delivered" | "cancelled";

/** One row of GET /api/staff/deliveries (backend/src/deliveries/deliveries.types.ts). */
export interface Delivery {
  id: number | string;
  deliveryNumber: string;
  orderId: number | string;
  orderNumber: string;
  customerId: string;
  productId: number | string;
  productName: string;
  quantity: number;
  totalPrice: number;
  deliveryAddress: string;
  status: DeliveryStatus;
  isCompleted: boolean;
  deliveredAt: string | null;
  createdAt: string;
}

/** What PATCH /api/staff/deliveries/:id returns: the updated row and the status of its order. */
export interface DeliveryUpdate {
  delivery: Delivery;
  order: {
    id: number | string;
    orderNumber: string;
    status: DeliveryStatus;
    deliveredAt: string | null;
  };
}

/** SCRUM-34. Product managers only; the backend answers 403 to every other role. */
export function fetchDeliveries(): Promise<Delivery[]> {
  return apiFetch<Delivery[]>("/staff/deliveries");
}

export function updateDeliveryStatus(
  id: Delivery["id"],
  status: Exclude<DeliveryStatus, "cancelled">,
): Promise<DeliveryUpdate> {
  return apiFetch<DeliveryUpdate>(`/staff/deliveries/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    body: { status },
  });
}

/** The server's own message (for example "A delivery cannot go back ..."), or a generic one. */
export function deliveryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong with the deliveries. Please try again.";
}
