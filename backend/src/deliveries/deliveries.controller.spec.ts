import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDeliveriesDb } from '../../test/helpers/deliveries-db.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  DeliveriesController,
  parseStatusFilter,
} from './deliveries.controller.js';
import { DeliveriesService } from './deliveries.service.js';
import { OrderStatus } from './delivery.rules.js';

/**
 * SCRUM-61 (regression tests for delivery and order status rules). Order statuses only move
 * forward, and a multi-item order always takes the status of its least advanced delivery row.
 */
describe('DeliveriesController (SCRUM-61 regression)', () => {
  const db = createDeliveriesDb({
    '1': 'AeroStride Pro',
    '2': 'Trail Socks',
    '3': 'Carbon Racket',
  });
  const service = new DeliveriesService(db.client as unknown as PrismaService);
  const controller = new DeliveriesController(service);

  const THREE_ITEMS = [
    { productId: 1n, quantity: 1, totalPrice: '120.00' },
    { productId: 2n, quantity: 2, totalPrice: '24.00' },
    { productId: 3n, quantity: 1, totalPrice: '190.00' },
  ];

  beforeEach(() => db.reset());

  describe('parseStatusFilter and list', () => {
    it.each([undefined, ''])('treats %o as no filter', (raw) => {
      expect(parseStatusFilter(raw)).toBeUndefined();
    });

    it.each(['processing', 'in_transit', 'delivered'] as const)(
      'accepts %s as a delivery filter',
      (step) => {
        expect(parseStatusFilter(step)).toBe(step);
      },
    );

    it.each(['cancelled', 'shipped', ['processing'], 123])(
      'rejects invalid status filter %o with 400',
      (raw) => {
        expect(() => parseStatusFilter(raw)).toThrow(BadRequestException);
      },
    );

    it('lists only deliveries matching the requested status', async () => {
      db.addOrder(THREE_ITEMS, {
        statuses: ['processing', 'in_transit', 'delivered'],
      });

      const inTransit = await controller.list('in_transit');

      expect(inTransit.map((row) => [row.id, row.status])).toEqual([
        [2, 'in_transit'],
      ]);
    });
  });

  describe('updateStatus forward-only and multi-item order rules', () => {
    it.each(['0', '-1', 'abc', '1.5'])(
      'rejects invalid delivery id %s with 400',
      (badId) => {
        expect(() =>
          controller.updateStatus(badId, { status: OrderStatus.in_transit }),
        ).toThrow(BadRequestException);
      },
    );

    it.each([
      ['in_transit -> processing', OrderStatus.in_transit, OrderStatus.processing],
      ['delivered -> in_transit', OrderStatus.delivered, OrderStatus.in_transit],
      ['delivered -> processing', OrderStatus.delivered, OrderStatus.processing],
      ['processing -> processing', OrderStatus.processing, OrderStatus.processing],
      ['in_transit -> in_transit', OrderStatus.in_transit, OrderStatus.in_transit],
      ['delivered -> delivered', OrderStatus.delivered, OrderStatus.delivered],
      ['processing -> cancelled', OrderStatus.processing, OrderStatus.cancelled],
    ])(
      'refuses %s with 409 and changes neither delivery nor order',
      async (_label, from, to) => {
        db.addOrder([THREE_ITEMS[0]], { statuses: [from] });
        const snapshot = structuredClone({
          orders: db.orders,
          deliveries: db.deliveries,
        });

        await expect(
          controller.updateStatus('1', { status: to }),
        ).rejects.toThrow(ConflictException);

        expect({ orders: db.orders, deliveries: db.deliveries }).toEqual(
          snapshot,
        );
      },
    );

    it('tracks a three-item order by its least advanced delivery and delivers only on the last item', async () => {
      db.addOrder(THREE_ITEMS);

      // Item 1 jumps straight to delivered, item 2 moves to in_transit; item 3 is still processing.
      const step1 = await controller.updateStatus('1', {
        status: OrderStatus.delivered,
      });
      expect(step1.order).toMatchObject({
        status: 'processing',
        deliveredAt: null,
      });

      const step2 = await controller.updateStatus('2', {
        status: OrderStatus.in_transit,
      });
      expect(step2.order).toMatchObject({
        status: 'processing',
        deliveredAt: null,
      });

      // Moving the lagging item 3 to in_transit advances the order to in_transit.
      const step3 = await controller.updateStatus('3', {
        status: OrderStatus.in_transit,
      });
      expect(step3.order).toMatchObject({
        status: 'in_transit',
        deliveredAt: null,
      });

      // Delivering item 2 still leaves item 3 in transit.
      const step4 = await controller.updateStatus('2', {
        status: OrderStatus.delivered,
      });
      expect(step4.order).toMatchObject({
        status: 'in_transit',
        deliveredAt: null,
      });

      // Delivering item 3 completes the order and records deliveredAt.
      const step5 = await controller.updateStatus('3', {
        status: OrderStatus.delivered,
      });
      expect(step5.order.status).toBe('delivered');
      expect(step5.order.deliveredAt).toEqual(expect.any(String));
      expect(db.orders[0].deliveredAt).toBeInstanceOf(Date);
    });
  });
});
