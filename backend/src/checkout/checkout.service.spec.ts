import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCheckoutDb } from '../../test/helpers/checkout-db.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CheckoutService } from './checkout.service.js';

/**
 * SCRUM-62 (regression tests for checkout). What an approved payment writes, and that a refused
 * order changes nothing: the shared order contract in SPRINT-3-PLAN.md.
 */

const SHOES = 1n;
const SOCKS = 2n;

const db = createCheckoutDb([
  {
    id: SHOES,
    name: 'AeroStride Pro',
    model: 'RLY-2026-01',
    price: '100.00',
    discountRate: '10.00',
    cost: '60.00',
    stockQuantity: 5,
    popularity: 3,
    isActive: true,
  },
  {
    id: SOCKS,
    name: 'Trail Socks',
    model: 'RLY-2026-09',
    price: '12.00',
    discountRate: '0.00',
    cost: null,
    stockQuantity: 1,
    popularity: 0,
    isActive: true,
  },
]);
const service = new CheckoutService(db.client as unknown as PrismaService);

const CUSTOMER = '11111111-1111-4111-8111-111111111111';
const OTHER_CUSTOMER = '22222222-2222-4222-8222-222222222222';
const DELIVERY = {
  deliveryRecipient: 'Deniz Yılmaz',
  deliveryAddress: '123 Fast Lane, Istanbul',
};
const CARD = { cardBrand: 'Visa', cardLast4: '4242' };

/** 2 shoes at 90.00 after the 10% discount and 1 pair of socks at 12.00. */
const BOTH_LINES = [
  { productId: SHOES, quantity: 2 },
  { productId: SOCKS, quantity: 1 },
];
const BOTH_REVIEWED = {
  items: [
    { productId: '1', quantity: 2, lineTotalCents: 18_000 },
    { productId: '2', quantity: 1, lineTotalCents: 1_200 },
  ],
  // 192.00 subtotal, no delivery fee (75 or more), 15.36 tax.
  totalCents: 20_736,
};

/** One pair of socks: 12.00 + 8.00 delivery (under 75) + 0.96 tax. */
const SOCKS_LINE = [{ productId: SOCKS, quantity: 1 }];
const SOCKS_REVIEWED = {
  items: [{ productId: '2', quantity: 1, lineTotalCents: 1_200 }],
  totalCents: 2_096,
};

beforeEach(() => db.reset());

/** Everything an approved order writes is still empty, and stock and cart are untouched. */
function expectNothingWritten(cartBefore: { productId: bigint; quantity: number }[]) {
  expect(db.state.orders).toEqual([]);
  expect(db.state.orderItems).toEqual([]);
  expect(db.state.deliveries).toEqual([]);
  expect(db.state.payments).toEqual([]);
  expect(db.state.invoices).toEqual([]);
  expect(db.product(SHOES)).toMatchObject({ stockQuantity: 5, popularity: 3 });
  expect(db.product(SOCKS)).toMatchObject({ stockQuantity: 1, popularity: 0 });
  expect(db.state.carts.get(CUSTOMER)?.items).toEqual(cartBefore);
}

describe('CheckoutService.placeOrder, approved payment', () => {
  it('returns the order number and the ids of the order and the invoice', async () => {
    db.fillCart(CUSTOMER, BOTH_LINES);

    const result = await service.placeOrder(CUSTOMER, DELIVERY, CARD, BOTH_REVIEWED);

    expect(result).toEqual({
      orderId: '1',
      orderNumber: expect.stringMatching(/^RLY-[0-9A-F]{16}$/),
      invoiceId: '1',
    });
  });

  it('decreases the stock and increases the popularity by the quantity sold', async () => {
    db.fillCart(CUSTOMER, BOTH_LINES);

    await service.placeOrder(CUSTOMER, DELIVERY, CARD, BOTH_REVIEWED);

    expect(db.product(SHOES)).toMatchObject({ stockQuantity: 3, popularity: 5 });
    expect(db.product(SOCKS)).toMatchObject({ stockQuantity: 0, popularity: 1 });
  });

  it('saves the order as processing with the delivery details and the server totals', async () => {
    db.fillCart(CUSTOMER, BOTH_LINES);

    await service.placeOrder(CUSTOMER, DELIVERY, CARD, BOTH_REVIEWED);

    expect(db.state.orders).toEqual([
      expect.objectContaining({
        userId: CUSTOMER,
        status: 'processing',
        ...DELIVERY,
        subtotal: 192,
        discountTotal: 20,
        deliveryFee: 0,
        taxAmount: 15.36,
        totalAmount: 207.36,
      }),
    ]);
  });

  it('copies the name, model and prices of each product as they were at order time', async () => {
    db.fillCart(CUSTOMER, BOTH_LINES);

    await service.placeOrder(CUSTOMER, DELIVERY, CARD, BOTH_REVIEWED);

    expect(db.state.orderItems).toEqual([
      {
        orderId: 1n,
        productId: SHOES,
        quantity: 2,
        productName: 'AeroStride Pro',
        productModel: 'RLY-2026-01',
        unitCost: '60.00',
        unitListPrice: 100,
        discountRate: 10,
        unitPricePaid: 90,
        lineTotal: 180,
      },
      expect.objectContaining({
        productId: SOCKS,
        productName: 'Trail Socks',
        unitCost: 0,
        unitPricePaid: 12,
        lineTotal: 12,
      }),
    ]);
  });

  it('adds one processing delivery row per order item, to the order address', async () => {
    db.fillCart(CUSTOMER, BOTH_LINES);

    await service.placeOrder(CUSTOMER, DELIVERY, CARD, BOTH_REVIEWED);

    expect(db.state.deliveries).toEqual([
      expect.objectContaining({
        orderItemId: 1n,
        customerId: CUSTOMER,
        productId: SHOES,
        quantity: 2,
        totalPrice: 180,
        deliveryAddress: DELIVERY.deliveryAddress,
        status: 'processing',
      }),
      expect.objectContaining({
        orderItemId: 2n,
        productId: SOCKS,
        quantity: 1,
        totalPrice: 12,
        status: 'processing',
      }),
    ]);
  });

  it('records a succeeded payment with only the card brand and last four digits', async () => {
    db.fillCart(CUSTOMER, BOTH_LINES);

    await service.placeOrder(CUSTOMER, DELIVERY, CARD, BOTH_REVIEWED);

    const [payment] = db.state.payments;
    expect(payment).toMatchObject({
      status: 'succeeded',
      amount: 207.36,
      cardBrand: 'Visa',
      cardLast4: '4242',
      transactionRef: expect.stringMatching(/^TXN-/),
    });
    expect(Object.keys(payment)).not.toContain('cardNumber');
    expect(Object.keys(payment)).not.toContain('cvv');
  });

  it('creates an invoice billed to the delivery details, with its email still pending', async () => {
    db.fillCart(CUSTOMER, SOCKS_LINE);

    await service.placeOrder(CUSTOMER, DELIVERY, CARD, SOCKS_REVIEWED);

    expect(db.state.invoices).toEqual([
      expect.objectContaining({
        invoiceNumber: expect.stringMatching(/^INV-/),
        userId: CUSTOMER,
        billedToName: DELIVERY.deliveryRecipient,
        billedToAddress: DELIVERY.deliveryAddress,
        subtotal: 12,
        deliveryFee: 8,
        taxAmount: 0.96,
        totalAmount: 20.96,
        emailStatus: 'pending',
      }),
    ]);
  });

  it('empties the customer cart', async () => {
    db.fillCart(CUSTOMER, BOTH_LINES);

    await service.placeOrder(CUSTOMER, DELIVERY, CARD, BOTH_REVIEWED);

    expect(db.state.carts.get(CUSTOMER)?.items).toEqual([]);
  });

  it('uses the same reference for the order, payment, invoice and delivery numbers', async () => {
    db.fillCart(CUSTOMER, BOTH_LINES);

    const { orderNumber } = await service.placeOrder(
      CUSTOMER,
      DELIVERY,
      CARD,
      BOTH_REVIEWED,
    );

    const reference = orderNumber.slice('RLY-'.length);
    expect(db.state.payments[0].transactionRef).toBe(`TXN-${reference}`);
    expect(db.state.invoices[0].invoiceNumber).toBe(`INV-${reference}`);
    expect(db.state.deliveries.map((row) => row.deliveryNumber)).toEqual([
      `DLV-${reference}-1`,
      `DLV-${reference}-2`,
    ]);
  });
});

describe('CheckoutService.placeOrder, refused orders change nothing', () => {
  it('refuses a quantity above the stock with 409 and rolls back the products already taken', async () => {
    // The shoes are taken first (lower id), then the socks fail: the shoes must be put back.
    const cart = [
      { productId: SHOES, quantity: 2 },
      { productId: SOCKS, quantity: 2 },
    ];
    db.fillCart(CUSTOMER, cart);

    await expect(
      service.placeOrder(CUSTOMER, DELIVERY, CARD, {
        items: [
          { productId: '1', quantity: 2, lineTotalCents: 18_000 },
          { productId: '2', quantity: 2, lineTotalCents: 2_400 },
        ],
        totalCents: 22_032,
      }),
    ).rejects.toThrow(ConflictException);

    expectNothingWritten(cart);
  });

  it('sells the last item once: a second customer gets 409 and the stock stays at zero', async () => {
    db.fillCart(CUSTOMER, SOCKS_LINE);
    db.fillCart(OTHER_CUSTOMER, SOCKS_LINE);

    await service.placeOrder(CUSTOMER, DELIVERY, CARD, SOCKS_REVIEWED);
    await expect(
      service.placeOrder(OTHER_CUSTOMER, DELIVERY, CARD, SOCKS_REVIEWED),
    ).rejects.toThrow('no longer available');

    expect(db.product(SOCKS).stockQuantity).toBe(0);
    expect(db.state.orders).toHaveLength(1);
    expect(db.state.carts.get(OTHER_CUSTOMER)?.items).toEqual(SOCKS_LINE);
  });

  it('refuses with 409 when the cart quantity differs from the one the customer reviewed', async () => {
    db.fillCart(CUSTOMER, BOTH_LINES);

    await expect(
      service.placeOrder(CUSTOMER, DELIVERY, CARD, {
        ...BOTH_REVIEWED,
        items: [
          { productId: '1', quantity: 1, lineTotalCents: 9_000 },
          BOTH_REVIEWED.items[1],
        ],
      }),
    ).rejects.toThrow('Your cart or prices have changed.');

    expectNothingWritten(BOTH_LINES);
  });

  it('refuses with 409 when a price changed after the customer reviewed the cart', async () => {
    db.fillCart(CUSTOMER, BOTH_LINES);

    await expect(
      service.placeOrder(CUSTOMER, DELIVERY, CARD, {
        items: [
          // The customer saw the shoes without the discount.
          { productId: '1', quantity: 2, lineTotalCents: 20_000 },
          BOTH_REVIEWED.items[1],
        ],
        totalCents: 22_896,
      }),
    ).rejects.toThrow('Your cart or prices have changed.');

    expectNothingWritten(BOTH_LINES);
  });

  it('does not trust a total sent by the client', async () => {
    db.fillCart(CUSTOMER, BOTH_LINES);

    await expect(
      service.placeOrder(CUSTOMER, DELIVERY, CARD, {
        ...BOTH_REVIEWED,
        totalCents: 100,
      }),
    ).rejects.toThrow(ConflictException);

    expectNothingWritten(BOTH_LINES);
  });

  it('refuses a reviewed cart that lists a product which is not in the cart', async () => {
    db.fillCart(CUSTOMER, SOCKS_LINE);

    await expect(
      service.placeOrder(CUSTOMER, DELIVERY, CARD, BOTH_REVIEWED),
    ).rejects.toThrow('Your cart or prices have changed.');

    expectNothingWritten(SOCKS_LINE);
  });

  it('refuses a reviewed cart that lists the same product twice', async () => {
    db.fillCart(CUSTOMER, SOCKS_LINE);

    await expect(
      service.placeOrder(CUSTOMER, DELIVERY, CARD, {
        items: [SOCKS_REVIEWED.items[0], SOCKS_REVIEWED.items[0]],
        totalCents: SOCKS_REVIEWED.totalCents,
      }),
    ).rejects.toThrow(ConflictException);

    expectNothingWritten(SOCKS_LINE);
  });

  it.each([
    ['has no cart', undefined],
    ['has an empty cart', []],
  ])('refuses with 409 when the customer %s', async (_case, items) => {
    if (items) db.fillCart(CUSTOMER, items);

    await expect(
      service.placeOrder(CUSTOMER, DELIVERY, CARD, SOCKS_REVIEWED),
    ).rejects.toThrow('Your cart is empty.');

    expect(db.state.orders).toEqual([]);
    expect(db.product(SOCKS).stockQuantity).toBe(1);
  });
});
