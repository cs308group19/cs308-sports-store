import { checkoutTotals, priceOrderItem } from './checkout-totals.js';

describe('checkout totals', () => {
  it.each([
    ['0.00', 8, 0, 8],
    ['74.99', 8, 6, 88.99],
    ['75.00', 0, 6, 81],
  ])(
    'calculates delivery and tax for a $%s paid subtotal',
    (subtotal, fee, tax, total) => {
      expect(checkoutTotals([priceOrderItem(subtotal, '0', 1)])).toMatchObject({
        deliveryFee: fee,
        taxAmount: tax,
        totalAmount: total,
      });
    },
  );

  it('rounds the discounted unit price before multiplying and rounds tax on the paid subtotal', () => {
    expect(checkoutTotals([priceOrderItem('19.99', '50', 3)])).toEqual({
      subtotal: 30,
      discountTotal: 29.97,
      deliveryFee: 8,
      taxAmount: 2.4,
      totalAmount: 40.4,
    });
  });

  it('does not charge delivery on an empty cart', () => {
    expect(checkoutTotals([]).totalAmount).toBe(0);
  });
});
