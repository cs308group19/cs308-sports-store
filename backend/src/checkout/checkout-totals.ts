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

export function checkoutTotals(
  lines: readonly { lineCents: number; listCents: number }[],
) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineCents, 0);
  const listCents = lines.reduce((sum, line) => sum + line.listCents, 0);
  const deliveryCents = lines.length > 0 && subtotalCents < 7500 ? 800 : 0;
  const taxCents = Math.round((subtotalCents * 8) / 100);
  return {
    subtotal: subtotalCents / 100,
    discountTotal: (listCents - subtotalCents) / 100,
    deliveryFee: deliveryCents / 100,
    taxAmount: taxCents / 100,
    totalAmount: (subtotalCents + deliveryCents + taxCents) / 100,
  };
}
