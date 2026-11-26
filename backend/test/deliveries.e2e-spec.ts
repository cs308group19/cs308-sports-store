import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createDeliveriesDb } from './helpers/deliveries-db.js';
import { createTestJwt } from './helpers/jwt.js';
import { makeProfile } from './helpers/profile.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { JWKS } from '../src/auth/jwks.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SupabaseAdminService } from '../src/supabase/supabase-admin.service.js';

/**
 * SCRUM-34. The product manager's delivery list and status changes through the real guards,
 * validation and routing, with an in-memory stand-in for the orders and deliveries tables.
 * Each test creates its own order and delivery rows the way the shared order contract describes
 * them (one row per order item, status processing).
 */
describe('Deliveries (e2e)', () => {
  let app: INestApplication;
  let jwt: Awaited<ReturnType<typeof createTestJwt>>;
  const db = createDeliveriesDb({ '1': 'AeroStride Pro', '2': 'Trail Socks' });

  const profiles = {
    'customer-1': makeProfile({ id: 'customer-1', role: 'customer' }),
    'product-1': makeProfile({ id: 'product-1', role: 'product_manager' }),
    'sales-1': makeProfile({ id: 'sales-1', role: 'sales_manager' }),
    'support-1': makeProfile({ id: 'support-1', role: 'support_agent' }),
  } as const;
  type Who = keyof typeof profiles;

  const as = async (who: Who) => `Bearer ${await jwt.sign({ sub: who })}`;
  const server = () => request(app.getHttpServer());
  const get = async (who: Who, path = '/api/staff/deliveries') =>
    server()
      .get(path)
      .set('Authorization', await as(who));
  const patch = async (who: Who, id: number | string, body: object) =>
    server()
      .patch(`/api/staff/deliveries/${id}`)
      .set('Authorization', await as(who))
      .send(body);

  const TWO_ITEMS = [
    { productId: 1n, quantity: 2, totalPrice: '254.40' },
    { productId: 2n, quantity: 1, totalPrice: '12.00' },
  ];

  beforeAll(async () => {
    jwt = await createTestJwt();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JWKS)
      .useValue(jwt.jwks)
      .overrideProvider(PrismaService)
      .useValue(db.client)
      .overrideProvider(SupabaseAdminService)
      .useValue({ auth: {} })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    db.reset();
    db.client.profile.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(profiles[where.id as Who] ?? null),
    );
  });

  describe('who can open it', () => {
    it.each(['customer-1', 'sales-1', 'support-1'] as const)(
      'refuses %s with 403 on the list and on the update',
      async (who) => {
        db.addOrder(TWO_ITEMS);

        const list = await get(who);
        const update = await patch(who, 1, { status: 'in_transit' });

        expect(list.status).toBe(403);
        expect(update.status).toBe(403);
        expect(db.deliveries[0].status).toBe('processing');
      },
    );

    it('refuses a guest with 401 on the list and on the update', async () => {
      db.addOrder(TWO_ITEMS);

      await server().get('/api/staff/deliveries').expect(401);
      await server()
        .patch('/api/staff/deliveries/1')
        .send({ status: 'in_transit' })
        .expect(401);
      expect(db.deliveries[0].status).toBe('processing');
    });
  });

  describe('GET /api/staff/deliveries', () => {
    it('lists every delivery with the fields the page needs', async () => {
      db.addOrder(TWO_ITEMS, { orderNumber: 'RLY-000007' });

      const res = await get('product-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual({
        id: 1,
        deliveryNumber: 'DLV-000001',
        orderId: 1,
        orderNumber: 'RLY-000007',
        customerId: 'customer-1',
        productId: 1,
        productName: 'AeroStride Pro',
        quantity: 2,
        totalPrice: 254.4,
        deliveryAddress: '123 Fast Lane, Istanbul',
        status: 'processing',
        isCompleted: false,
        deliveredAt: null,
        createdAt: expect.any(String),
      });
    });

    it('answers 200 with an empty list when there are no deliveries', async () => {
      const res = await get('product-1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('puts open deliveries first, oldest first', async () => {
      db.addOrder(TWO_ITEMS, { statuses: ['delivered', 'in_transit'] });
      db.addOrder([TWO_ITEMS[0]]);

      const res = await get('product-1');

      expect(res.body.map((r: { status: string }) => r.status)).toEqual([
        'processing',
        'in_transit',
        'delivered',
      ]);
    });

    it('filters with ?status=', async () => {
      db.addOrder(TWO_ITEMS, { statuses: ['delivered', 'in_transit'] });
      db.addOrder([TWO_ITEMS[0]]);

      const transit = await get(
        'product-1',
        '/api/staff/deliveries?status=in_transit',
      );
      const processing = await get(
        'product-1',
        '/api/staff/deliveries?status=processing',
      );
      const delivered = await get(
        'product-1',
        '/api/staff/deliveries?status=delivered',
      );
      const all = await get('product-1', '/api/staff/deliveries?status=');

      expect(transit.body.map((r: { id: number }) => r.id)).toEqual([2]);
      expect(processing.body.map((r: { id: number }) => r.id)).toEqual([3]);
      expect(delivered.body.map((r: { id: number }) => r.id)).toEqual([1]);
      expect(all.body).toHaveLength(3);
    });

    it.each(['shipped', 'cancelled', 'DELIVERED'])(
      'refuses ?status=%s with 400',
      async (status) => {
        const res = await get(
          'product-1',
          `/api/staff/deliveries?status=${status}`,
        );

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/status must be/);
      },
    );
  });

  describe('PATCH /api/staff/deliveries/:id', () => {
    it('moves a delivery forward and returns it with the new order status', async () => {
      db.addOrder(TWO_ITEMS);

      const res = await patch('product-1', 1, { status: 'in_transit' });

      expect(res.status).toBe(200);
      expect(res.body.delivery).toMatchObject({
        id: 1,
        status: 'in_transit',
        isCompleted: false,
        deliveredAt: null,
      });
      expect(res.body.order).toEqual({
        id: 1,
        orderNumber: 'RLY-000001',
        status: 'processing',
        deliveredAt: null,
      });
      expect(db.deliveries[0].status).toBe('in_transit');
    });

    it('on delivered sets is_completed and delivered_at', async () => {
      db.addOrder([TWO_ITEMS[0]], { statuses: ['in_transit'] });

      const res = await patch('product-1', 1, { status: 'delivered' });

      expect(res.status).toBe(200);
      expect(res.body.delivery.isCompleted).toBe(true);
      expect(res.body.delivery.deliveredAt).toEqual(expect.any(String));
    });

    it.each([
      ['backwards', 'in_transit', 'processing'],
      ['to the same status', 'in_transit', 'in_transit'],
      ['to cancelled', 'processing', 'cancelled'],
      ['from delivered', 'delivered', 'in_transit'],
    ] as const)('answers 409 when it goes %s', async (_name, from, to) => {
      db.addOrder([TWO_ITEMS[0]], { statuses: [from] });

      const res = await patch('product-1', 1, { status: to });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'Conflict',
        message: expect.any(String),
      });
      expect(db.deliveries[0].status).toBe(from);
    });

    it('answers 404 for an unknown delivery', async () => {
      db.addOrder(TWO_ITEMS);

      const res = await patch('product-1', 999, { status: 'in_transit' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Delivery not found.');
    });

    it.each([
      ['an unknown status', { status: 'shipped' }],
      ['a missing status', {}],
      ['a status that is not text', { status: 2 }],
      ['an extra field', { status: 'in_transit', isCompleted: true }],
    ])('answers 400 for %s', async (_name, body) => {
      db.addOrder(TWO_ITEMS);

      const res = await patch('product-1', 1, body);

      expect(res.status).toBe(400);
      expect(db.deliveries[0].status).toBe('processing');
    });

    it.each(['abc', '0', '-1', '1.5'])(
      'answers 400 for the id %s',
      async (id) => {
        const res = await patch('product-1', id, { status: 'in_transit' });

        expect(res.status).toBe(400);
      },
    );
  });

  describe('a multi-item order', () => {
    it('stays at its least advanced row and is delivered only after the last row', async () => {
      db.addOrder(TWO_ITEMS, { userId: 'customer-1' });
      const orderStatus = () => db.orders[0].status;

      // What the customer's order history will read: the order row of their own order.
      expect(
        (await patch('product-1', 1, { status: 'in_transit' })).status,
      ).toBe(200);
      expect(orderStatus()).toBe('processing');

      expect(
        (await patch('product-1', 2, { status: 'in_transit' })).status,
      ).toBe(200);
      expect(orderStatus()).toBe('in_transit');

      const firstDelivered = await patch('product-1', 1, {
        status: 'delivered',
      });
      expect(firstDelivered.body.order).toMatchObject({
        status: 'in_transit',
        deliveredAt: null,
      });
      expect(db.orders[0].deliveredAt).toBeNull();

      const lastDelivered = await patch('product-1', 2, {
        status: 'delivered',
      });
      expect(lastDelivered.body.order).toMatchObject({
        status: 'delivered',
        deliveredAt: expect.any(String),
      });
      expect(orderStatus()).toBe('delivered');
      expect(db.orders[0].userId).toBe('customer-1');
      expect(db.orders[0].deliveredAt).toBeInstanceOf(Date);
      expect(db.deliveries.every((d) => d.isCompleted)).toBe(true);
    });
  });
});
