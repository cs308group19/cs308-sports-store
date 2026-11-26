import {
  type OrderHistoryRecord,
  toOrderHistoryItem,
} from './order-history.mapper.js';

/** SCRUM-27. What the order history page shows for one saved order. */
describe('toOrderHistoryItem', () => {
  const record = (
    overrides: Partial<OrderHistoryRecord> = {},
  ): OrderHistoryRecord => ({
    id: 12n,
    orderNumber: 'ORD-2026-000012',
    status: 'in_transit',
    totalAmount: '291.50',
    createdAt: new Date('2026-11-20T09:30:00.000Z'),
    invoice: null,
    items: [
      {
        id: 21n,
        productId: 3n,
        productName: 'Court Vision Elite',
        productModel: 'CV-ELT-25',
        quantity: 2,
        unitPricePaid: '145.75',
        lineTotal: '291.50',
        product: { imageUrl: null },
        deliveries: [],
        review: null,
      },
    ],
    ...overrides,
  });

  it('sends the order with its number, date, status and total', () => {
    expect(toOrderHistoryItem(record())).toEqual({
      id: 12,
      orderNumber: 'ORD-2026-000012',
      placedAt: '2026-11-20T09:30:00.000Z',
      status: 'in_transit',
      total: 291.5,
      invoiceId: null,
      items: [
        {
          id: 21,
          productId: 3,
          name: 'Court Vision Elite',
          model: 'CV-ELT-25',
          imageUrl: null,
          quantity: 2,
          unitPricePaid: 145.75,
          lineTotal: 291.5,
          delivered: false,
          review: null,
        },
      ],
    });
  });

  it.each(['processing', 'in_transit', 'delivered', 'cancelled'])(
    'keeps the %s status',
    (status) => {
      expect(toOrderHistoryItem(record({ status })).status).toBe(status);
    },
  );

  it('uses the name stored on the order, not the current product name', () => {
    const item = toOrderHistoryItem(
      record({
        items: [
          {
            id: 22n,
            productId: 3n,
            productName: 'Old name',
            productModel: null,
            quantity: 1,
            unitPricePaid: '10',
            lineTotal: '10',
            product: { imageUrl: '/photo.webp' },
            deliveries: [],
            review: null,
          },
        ],
      }),
    );
    expect(item.items[0]).toMatchObject({
      name: 'Old name',
      model: null,
      imageUrl: '/photo.webp',
    });
  });

  it('gives each line its own id, so the same product twice keeps both lines apart', () => {
    const line = record().items[0];
    const item = toOrderHistoryItem(
      record({
        items: [line, { ...line, id: 23n, quantity: 1, lineTotal: '145.75' }],
      }),
    );
    expect(item.items.map((l) => [l.id, l.productId])).toEqual([
      [21, 3],
      [23, 3],
    ]);
  });

  it('keeps the invoice id so the customer can open that invoice again', () => {
    expect(toOrderHistoryItem(record({ invoice: { id: 44n } })).invoiceId).toBe(
      44,
    );
  });

  it('sends large BIGINT ids as strings so no digits are lost', () => {
    const id = 9007199254740993n;
    expect(toOrderHistoryItem(record({ id })).id).toBe('9007199254740993');
  });

  it('rejects a status the order history does not know', () => {
    expect(() => toOrderHistoryItem(record({ status: 'lost' }))).toThrow(
      'Unknown order status: lost',
    );
  });
});
