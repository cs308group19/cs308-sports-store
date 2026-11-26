import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDeliveriesDb } from '../../test/helpers/deliveries-db.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DeliveriesService } from './deliveries.service.js';

const db = createDeliveriesDb({ '1': 'AeroStride Pro', '2': 'Trail Socks' });
const service = new DeliveriesService(db.client as unknown as PrismaService);

const TWO_ITEMS = [
  { productId: 1n, quantity: 2, totalPrice: '254.40' },
  { productId: 2n, quantity: 1, totalPrice: '12.00' },
];

beforeEach(() => db.reset());

describe('DeliveriesService.list', () => {
  it('shows each row with its order number, product name and numbers', async () => {
    db.addOrder([TWO_ITEMS[0]], { orderNumber: 'RLY-000042' });

    const [row] = await service.list();

    expect(row).toEqual({
      id: 1,
      deliveryNumber: 'DLV-000001',
      orderId: 1,
      orderNumber: 'RLY-000042',
      customerId: 'customer-1',
      productId: 1,
      productName: 'AeroStride Pro',
      quantity: 2,
      totalPrice: 254.4,
      deliveryAddress: '123 Fast Lane, Istanbul',
      status: 'processing',
      isCompleted: false,
      deliveredAt: null,
      createdAt: expect.stringMatching(/^2026-11-20T/),
    });
  });

  it('puts processing first, then in transit, then delivered, oldest first in each', async () => {
    db.addOrder(TWO_ITEMS, { statuses: ['delivered', 'in_transit'] });
    db.addOrder(TWO_ITEMS, { statuses: ['processing', 'delivered'] });
    db.addOrder([TWO_ITEMS[0]], { statuses: ['processing'] });

    const rows = await service.list();

    expect(rows.map((r) => [r.status, r.id])).toEqual([
      ['processing', 3],
      ['processing', 5],
      ['in_transit', 2],
      ['delivered', 1],
      ['delivered', 4],
    ]);
  });

  it('filters by status', async () => {
    db.addOrder(TWO_ITEMS, { statuses: ['delivered', 'in_transit'] });

    const rows = await service.list('in_transit');

    expect(rows.map((r) => r.id)).toEqual([2]);
  });
});

describe('DeliveriesService.updateStatus on one delivery', () => {
  it('moves processing to in transit without completing it', async () => {
    db.addOrder([TWO_ITEMS[0]]);

    const { delivery } = await service.updateStatus(1n, 'in_transit');

    expect(delivery).toMatchObject({
      status: 'in_transit',
      isCompleted: false,
      deliveredAt: null,
    });
  });

  it('on delivered sets is_completed and delivered_at', async () => {
    db.addOrder([TWO_ITEMS[0]], { statuses: ['in_transit'] });

    const { delivery } = await service.updateStatus(1n, 'delivered');

    expect(delivery.status).toBe('delivered');
    expect(delivery.isCompleted).toBe(true);
    expect(delivery.deliveredAt).toEqual(expect.any(String));
    expect(db.deliveries[0].deliveredAt).toBeInstanceOf(Date);
  });

  it('allows skipping in transit', async () => {
    db.addOrder([TWO_ITEMS[0]]);

    const { delivery, order } = await service.updateStatus(1n, 'delivered');

    expect(delivery.status).toBe('delivered');
    expect(order.status).toBe('delivered');
  });

  it.each([
    ['going back', 'delivered', 'in_transit'],
    ['going back from in transit', 'in_transit', 'processing'],
    ['the same status', 'in_transit', 'in_transit'],
    ['cancelling', 'processing', 'cancelled'],
  ] as const)(
    'refuses %s with a 409 and changes nothing',
    async (_name, from, to) => {
      db.addOrder([TWO_ITEMS[0]], { statuses: [from] });
      const before = structuredClone([db.deliveries, db.orders]);

      await expect(service.updateStatus(1n, to)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect([db.deliveries, db.orders]).toEqual(before);
    },
  );

  it('answers an unknown delivery with a 404', async () => {
    await expect(service.updateStatus(99n, 'delivered')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('answers 409 when someone else changed the row after it was read', async () => {
    db.addOrder([TWO_ITEMS[0]]);
    // The other manager marks it in transit just before our conditional update runs.
    db.hooks.beforeUpdateMany = () => {
      db.deliveries[0].status = 'in_transit';
      db.hooks.beforeUpdateMany = undefined;
    };

    await expect(service.updateStatus(1n, 'in_transit')).rejects.toThrow(
      /changed by someone else/,
    );
  });

  it('does not move the deliveries of a cancelled order', async () => {
    const { order } = db.addOrder([TWO_ITEMS[0]]);
    order.status = 'cancelled';

    await expect(service.updateStatus(1n, 'in_transit')).rejects.toThrow(
      /cancelled/,
    );
  });
});

describe('DeliveriesService.updateStatus and the order status', () => {
  it('locks the order row before it reads or writes anything else', async () => {
    const { order } = db.addOrder(TWO_ITEMS);

    await service.updateStatus(1n, 'in_transit');

    expect(db.locks).toEqual([order.id]);
  });

  it('keeps the order at the least advanced row until the last row is delivered', async () => {
    db.addOrder(TWO_ITEMS);

    const first = await service.updateStatus(1n, 'in_transit');
    expect(first.order.status).toBe('processing');

    const second = await service.updateStatus(2n, 'in_transit');
    expect(second.order.status).toBe('in_transit');

    const third = await service.updateStatus(1n, 'delivered');
    expect(third.order.status).toBe('in_transit');
    expect(third.order.deliveredAt).toBeNull();
    expect(db.orders[0].deliveredAt).toBeNull();
  });

  it('delivers the order and sets its delivered_at when the last row is delivered', async () => {
    db.addOrder(TWO_ITEMS, { statuses: ['delivered', 'in_transit'] });

    const { order, delivery } = await service.updateStatus(2n, 'delivered');

    expect(order).toMatchObject({
      orderNumber: 'RLY-000001',
      status: 'delivered',
    });
    expect(order.deliveredAt).toBe(delivery.deliveredAt);
    expect(db.orders[0].status).toBe('delivered');
    expect(db.orders[0].deliveredAt).toBeInstanceOf(Date);
  });

  it('updates the order updated_at on every change', async () => {
    db.addOrder(TWO_ITEMS);
    const before = db.orders[0].updatedAt;

    await service.updateStatus(1n, 'in_transit');

    expect(db.orders[0].updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it('leaves other orders alone', async () => {
    db.addOrder([TWO_ITEMS[0]]);
    db.addOrder([TWO_ITEMS[1]]);

    await service.updateStatus(1n, 'delivered');

    expect(db.orders.map((o) => o.status)).toEqual(['delivered', 'processing']);
    expect(db.orders[1].deliveredAt).toBeNull();
  });

  it('does not touch the order when the delivery change is refused', async () => {
    db.addOrder(TWO_ITEMS, { statuses: ['delivered', 'processing'] });
    db.orders[0].status = 'processing';

    await expect(service.updateStatus(1n, 'in_transit')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(db.orders[0].status).toBe('processing');
    expect(db.orders[0].deliveredAt).toBeNull();
  });
});
