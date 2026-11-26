import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createTestJwt } from './helpers/jwt.js';
import { makeProfile } from './helpers/profile.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { JWKS } from '../src/auth/jwks.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SupabaseAdminService } from '../src/supabase/supabase-admin.service.js';

/**
 * SCRUM-27. GET /api/me/orders through the real guards and routing. Each customer sees only their
 * own orders, newest first, and a customer with no orders gets an empty list.
 */
describe('Order history (e2e)', () => {
  let app: INestApplication;
  let sign: Awaited<ReturnType<typeof createTestJwt>>['sign'];
  const OWNER = 'customer-1';
  const OTHER = 'customer-2';
  const EMPTY = 'customer-3';

  const order = (id: bigint, userId: string, createdAt: string) => ({
    id,
    userId,
    orderNumber: `RLY-2026-${String(id).padStart(6, '0')}`,
    status: 'in_transit',
    totalAmount: '236.52',
    createdAt: new Date(createdAt),
    invoice: { id: id + 100n },
    items: [
      {
        id: id * 10n,
        productId: 3n,
        productName: 'AeroStride Pro',
        productModel: 'AS-PRO-25',
        quantity: 2,
        unitPricePaid: '80.00',
        lineTotal: '160.00',
        product: { imageUrl: null },
      },
    ],
  });

  /** Orders of every customer. The fake honours the userId filter and the newest-first order. */
  const orders = [
    order(1n, OWNER, '2026-11-01T10:00:00.000Z'),
    order(2n, OTHER, '2026-11-15T10:00:00.000Z'),
    order(3n, OWNER, '2026-11-20T10:00:00.000Z'),
  ];

  const prisma = {
    profile: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          [OWNER, OTHER, EMPTY].includes(where.id)
            ? makeProfile({ id: where.id, email: `${where.id}@rally.store` })
            : null,
        ),
      ),
    },
    order: {
      findMany: vi.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          orders
            .filter((row) => row.userId === where.userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
        ),
      ),
    },
    onModuleInit: () => undefined,
    onModuleDestroy: () => undefined,
  };

  beforeAll(async () => {
    const jwt = await createTestJwt();
    sign = jwt.sign;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JWKS)
      .useValue(jwt.jwks)
      .overrideProvider(PrismaService)
      .useValue(prisma)
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

  const server = () => request(app.getHttpServer());
  const as = async (sub: string) => `Bearer ${await sign({ sub })}`;

  it('lists only the signed-in customer\'s orders, newest first', async () => {
    const res = await server()
      .get('/api/me/orders')
      .set('Authorization', await as(OWNER));

    expect(res.status).toBe(200);
    expect(res.body.map((o: { orderNumber: string }) => o.orderNumber)).toEqual([
      'RLY-2026-000003',
      'RLY-2026-000001',
    ]);
    expect(res.body[0]).toMatchObject({
      id: 3,
      status: 'in_transit',
      total: 236.52,
      invoiceId: 103,
      items: [
        {
          id: 30,
          productId: 3,
          name: 'AeroStride Pro',
          model: 'AS-PRO-25',
          quantity: 2,
          unitPricePaid: 80,
          lineTotal: 160,
        },
      ],
    });
  });

  it('does not show another customer\'s orders', async () => {
    const res = await server()
      .get('/api/me/orders')
      .set('Authorization', await as(OTHER));

    expect(res.status).toBe(200);
    expect(res.body.map((o: { id: number }) => o.id)).toEqual([2]);
  });

  it('returns an empty list to a customer with no orders', async () => {
    const res = await server()
      .get('/api/me/orders')
      .set('Authorization', await as(EMPTY));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('needs a signed-in customer', async () => {
    const res = await server().get('/api/me/orders');
    expect(res.status).toBe(401);
  });
});
