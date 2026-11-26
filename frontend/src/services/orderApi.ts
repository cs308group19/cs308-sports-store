import { ApiError, apiFetch } from "../lib/api";
import type { OrderStatus } from "../types/models";
import type { OrderHistoryItem, OrderHistoryStatus } from "../types/orderHistory";

/** SCRUM-27. The order history page loads the signed-in customer's own orders, newest first. */
export function fetchOrderHistory(): Promise<OrderHistoryItem[]> {
  return apiFetch<OrderHistoryItem[]>("/me/orders");
}

/**
 * The step the progress tracker shows for an order. A cancelled order has no step: the page says
 * so in words instead.
 */
export function trackerStep(status: OrderHistoryStatus): OrderStatus | null {
  switch (status) {
    case "processing":
      return "Processing";
    case "in_transit":
      return "In transit";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return null;
  }
}

export const ORDER_STATUS_LABEL: Record<OrderHistoryStatus, string> = {
  processing: "Processing",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function orderErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong while loading your orders. Please try again.";
}
