import { applyDiscount, toNumber, type DecimalLike } from '../common/money.js';

export function priceOrderItem(
  price: DecimalLike,
  discount: DecimalLike,
  quantity: number,
) {
  const unitListPrice = toNumber(price);
  const discountRate = toNumber(discount);
  const unitPricePaid = applyDiscount(unitListPrice, discountRate);
  return {
    unitListPrice,
    discountRate,
    unitPricePaid,
    lineCents: Math.round(unitPricePaid * 100) * quantity,
    listCents: Math.round(unitListPrice * 100) * quantity,
  };
}

/** Delivery costs this much for a subtotal under the free delivery limit. */
export const DELIVERY_FEE_CENTS = 800;
export const FREE_DELIVERY_FROM_CENTS = 7500;
export const TAX_PERCENT = 8;

export function checkoutTotals(
  lines: readonly { lineCents: number; listCents: number }[],
) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineCents, 0);
  const listCents = lines.reduce((sum, line) => sum + line.listCents, 0);
  const deliveryCents =
    lines.length > 0 && subtotalCents < FREE_DELIVERY_FROM_CENTS
      ? DELIVERY_FEE_CENTS
      : 0;
  const taxCents = Math.round((subtotalCents * TAX_PERCENT) / 100);
  return {
    subtotal: subtotalCents / 100,
    discountTotal: (listCents - subtotalCents) / 100,
    deliveryFee: deliveryCents / 100,
    taxAmount: taxCents / 100,
    totalAmount: (subtotalCents + deliveryCents + taxCents) / 100,
  };
}
