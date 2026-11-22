import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createTestJwt } from './helpers/jwt.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { JWKS } from '../src/auth/jwks.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SupabaseAdminService } from '../src/supabase/supabase-admin.service.js';

/** SCRUM-16. The guest cart through the real guards, validation and routing. */
describe('Cart (e2e)', () => {
  let app: INestApplication;
  const TOKEN = '3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69';

  const productRow = {
    id: 1n,
    name: 'AeroStride Pro',
    model: 'AS-PRO-25',
    serialNumber: 'R-89741',
    description: 'Lightweight running shoe',
    stockQuantity: 5,
    price: '159.00',
    discountRate: '20.00',
    warrantyStatus: 'active',
    warrantyTerm: '24 months',
    distributor: 'Northstar Athletics',
    imageUrl: null,
    popularity: 98,
    averageRating: '0.00',
    reviewCount: 0,
    isActive: true,
    category: { name: 'Running', slug: 'running' },
  };

  /** A tiny in-memory stand-in for the carts and cart_items tables. */
  let lines: { productId: bigint; quantity: number }[];
  const tx = {
    $queryRaw: vi.fn(() => Promise.resolve([{ id: 1n }])),
    cartItem: {
      findMany: vi.fn(() =>
        Promise.resolve(lines.map((line) => ({ ...line }))),
      ),
      deleteMany: vi.fn(() => {
        lines = [];
        return Promise.resolve({ count: 0 });
      }),
      createMany: vi.fn(
        ({ data }: { data: { productId: bigint; quantity: number }[] }) => {
          lines = data.map(({ productId, quantity }) => ({
            productId,
            quantity,
          }));
          return Promise.resolve({ count: data.length });
        },
      ),
    },
  };
  const prisma = {
    profile: { findUnique: vi.fn() },
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(({ where }: { where: { id: bigint } }) =>
        Promise.resolve(
          where.id === 1n
            ? { id: 1n, stockQuantity: productRow.stockQuantity }
            : null,
        ),
      ),
    },
    category: { findUnique: vi.fn(), findMany: vi.fn() },
    cart: {
      findUnique: vi.fn(
        ({ select }: { select: { items: { select: object } } }) => {
          if (lines.length === 0) return Promise.resolve(null);
          const withProduct = 'product' in select.items.select;
          return Promise.resolve({
            items: lines.map((line) =>
              withProduct
                ? { quantity: line.quantity, product: productRow }
                : line,
            ),
          });
        },
      ),
    },
    $transaction: vi.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    onModuleInit: () => undefined,
    onModuleDestroy: () => undefined,
  };

  beforeAll(async () => {
    const jwt = await createTestJwt();
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

  beforeEach(() => {
    lines = [];
    productRow.stockQuantity = 5;
  });

  const server = () => request(app.getHttpServer());

  it('returns an empty cart for a new guest without logging in', async () => {
    const res = await server().get('/api/cart').set('X-Cart-Token', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('rejects requests without a valid cart token', async () => {
    const missing = await server().get('/api/cart');
    const invalid = await server()
      .get('/api/cart')
      .set('X-Cart-Token', 'not-a-uuid');

    expect(missing.status).toBe(400);
    expect(invalid.status).toBe(400);
  });

  it('adds a product and returns the cart with product details', async () => {
    const res = await server()
      .post('/api/cart/items')
      .set('X-Cart-Token', TOKEN)
      .send({ productId: 1, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      quantity: 2,
      product: { id: 1, name: 'AeroStride Pro', price: 127.2, stock: 5 },
    });
    expect(res.body.items[0].product).not.toHaveProperty('cost');
  });

  it('refuses to add more than the stock', async () => {
    const res = await server()
      .post('/api/cart/items')
      .set('X-Cart-Token', TOKEN)
      .send({ productId: 1, quantity: 6 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Only 5 left in stock.');
  });

  it('refuses an out-of-stock product', async () => {
    productRow.stockQuantity = 0;

    const res = await server()
      .post('/api/cart/items')
      .set('X-Cart-Token', TOKEN)
      .send({ productId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('This product is out of stock.');
  });

  it('returns 404 for a product that does not exist', async () => {
    const res = await server()
      .post('/api/cart/items')
      .set('X-Cart-Token', TOKEN)
      .send({ productId: 999 });

    expect(res.status).toBe(404);
  });

  it.each([
    { productId: 'abc' },
    { productId: -1 },
    { productId: 1, quantity: 1.5 },
    { productId: 1, extra: true },
  ])('rejects the invalid body %o', async (body) => {
    const res = await server()
      .post('/api/cart/items')
      .set('X-Cart-Token', TOKEN)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('changes the quantity of a cart line', async () => {
    lines = [{ productId: 1n, quantity: 1 }];

    const res = await server()
      .patch('/api/cart/items/1')
      .set('X-Cart-Token', TOKEN)
      .send({ quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.items[0].quantity).toBe(3);
  });

  it('removes a product from the cart', async () => {
    lines = [{ productId: 1n, quantity: 1 }];

    const res = await server()
      .delete('/api/cart/items/1')
      .set('X-Cart-Token', TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('returns 404 when removing a product that is not in the cart', async () => {
    const res = await server()
      .delete('/api/cart/items/1')
      .set('X-Cart-Token', TOKEN);

    expect(res.status).toBe(404);
  });

  it('rejects an invalid product id in the path', async () => {
    const res = await server()
      .delete('/api/cart/items/abc')
      .set('X-Cart-Token', TOKEN);

    expect(res.status).toBe(400);
  });
});
