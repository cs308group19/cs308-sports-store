import { OrderHistoryService } from './order-history.service.js';

/** SCRUM-27. A customer sees only their own orders, newest first. */
describe('OrderHistoryService', () => {
  const setup = (rows: unknown[] = []) => {
    const prisma = {
      order: { findMany: vi.fn().mockResolvedValue(rows) },
    };
    const service = new OrderHistoryService(prisma as never);
    return { service, prisma };
  };

  it('asks only for the orders of the signed-in customer, newest first', async () => {
    const { service, prisma } = setup();
    await service.listForUser('user-1');

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('selects only what the page shows, including each line id and model', async () => {
    const { service, prisma } = setup();
    await service.listForUser('user-1');

    const query = prisma.order.findMany.mock.calls[0][0];
    expect(query).not.toHaveProperty('include');
    expect(Object.keys(query.select).sort()).toEqual(
      ['createdAt', 'id', 'items', 'orderNumber', 'status', 'totalAmount'].sort(),
    );
    expect(query.select.items.select).toMatchObject({
      id: true,
      productModel: true,
      product: { select: { imageUrl: true } },
    });
  });

  it('returns an empty list when the customer has no orders', async () => {
    const { service } = setup([]);
    await expect(service.listForUser('user-1')).resolves.toEqual([]);
  });

  it('maps each saved order into the history entry', async () => {
    const { service } = setup([
      {
        id: 2n,
        orderNumber: 'ORD-2',
        status: 'delivered',
        totalAmount: '50.00',
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
        items: [
          {
            id: 40n,
            productId: 7n,
            productName: 'Socks',
            productModel: 'SK-01',
            quantity: 1,
            unitPricePaid: '50.00',
            lineTotal: '50.00',
            product: { imageUrl: null },
          },
        ],
      },
    ]);

    await expect(service.listForUser('user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 2,
        status: 'delivered',
        total: 50,
        items: [expect.objectContaining({ id: 40, model: 'SK-01' })],
      }),
    ]);
  });
});
