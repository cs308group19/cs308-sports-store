import type { CartLine } from "../types/models";

/** Orders of at least this much ship for free. */
export const FREE_DELIVERY_FROM = 75;
export const DELIVERY_FEE = 8;
export const TAX_RATE = 0.08;

export interface CartTotals {
  subtotal: number;
  delivery: number;
  tax: number;
  total: number;
}

const toCents = (amount: number) => Math.round(amount * 100);

/**
 * The amounts the cart page and the checkout page both show, so the customer sees the same total
 * on both. Worked out in whole cents, so 0.1 + 0.2 style float errors never reach the screen.
 * An empty cart costs nothing, not even delivery.
 */
export function cartTotals(lines: CartLine[]): CartTotals {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + toCents(line.product.price) * line.quantity,
    0,
  );
  const deliveryCents =
    subtotalCents === 0 || subtotalCents >= toCents(FREE_DELIVERY_FROM)
      ? 0
      : toCents(DELIVERY_FEE);
  const taxCents = Math.round(subtotalCents * TAX_RATE);
  return {
    subtotal: subtotalCents / 100,
    delivery: deliveryCents / 100,
    tax: taxCents / 100,
    total: (subtotalCents + deliveryCents + taxCents) / 100,
  };
}
