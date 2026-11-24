import { apiFetch } from "../lib/api";
import type { CartView } from "../types/models";

export interface CheckoutInput {
  deliveryRecipient: string;
  deliveryAddress: string;
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

export interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  invoiceId: string;
}

export function placeOrder(
  input: CheckoutInput,
  items: CartView["items"],
  total: number,
): Promise<CheckoutResponse> {
  const body = {
    ...input,
    reviewedCart: {
      items: items.map(({ productId, quantity, lineTotal }) => ({
        productId,
        quantity,
        lineTotalCents: Math.round(lineTotal * 100),
      })),
      totalCents: Math.round(total * 100),
    },
  };
  return apiFetch<CheckoutResponse>("/me/checkout", { method: "POST", body });
}
