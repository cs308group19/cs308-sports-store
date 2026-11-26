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
 * SCRUM-16 and SCRUM-17. Guest and customer carts through the real guards, validation and
 * routing, with a small in-memory stand-in for the carts and cart_items tables.
 */
describe('Cart (e2e)', () => {
  let app: INestApplication;
  let sign: Awaited<ReturnType<typeof createTestJwt>>['sign'];
  const TOKEN = '3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69';
  const CUSTOMER = 'customer-1';

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

  type Line = { productId: bigint; quantity: number };
  /** Cart ids by owner ("guest:<token>" or "user:<id>") and cart lines by cart id. */
  let cartIds: Map<string, bigint>;
  let lines: Map<bigint, Line[]>;

  const cartIdFor = (owner: string) => {
    let id = cartIds.get(owner);
    if (id === undefined) {
      id = BigInt(cartIds.size + 1);
      cartIds.set(owner, id);
      lines.set(id, []);
    }
    return id;
  };
  const linesOf = (owner: string) => lines.get(cartIds.get(owner) ?? -1n) ?? [];

  const tx = {
    // Two statements, each with the token or id as its only value: the INSERT ... ON CONFLICT that
    // creates or locks a cart, and the SELECT ... FOR UPDATE that locks a cart only if it exists.
    $queryRaw: vi.fn((sql: TemplateStringsArray, value: string) => {
      const text = sql.join('?');
      const kind = text.includes('guest_token') ? 'guest' : 'user';
      const owner = `${kind}:${value}`;
      if (text.trimStart().startsWith('SELECT')) {
        const id = cartIds.get(owner);
        return Promise.resolve(id === undefined ? [] : [{ id }]);
      }
      return Promise.resolve([{ id: cartIdFor(owner) }]);
    }),
    cart: {
      findUnique: (args: unknown) => prisma.cart.findUnique(args as never),
    },
    product: {
      findMany: vi.fn(({ where }: { where: { id: { in: bigint[] } } }) =>
        Promise.resolve(
          where.id.in.includes(1n)
            ? [{ id: 1n, stockQuantity: productRow.stockQuantity }]
            : [],
        ),
      ),
    },
    cartItem: {
      findMany: vi.fn(({ where }: { where: { cartId: bigint } }) =>
        Promise.resolve((lines.get(where.cartId) ?? []).map((l) => ({ ...l }))),
      ),
      deleteMany: vi.fn(({ where }: { where: { cartId: bigint } }) => {
        lines.set(where.cartId, []);
        return Promise.resolve({ count: 0 });
      }),
      createMany: vi.fn(({ data }: { data: (Line & { cartId: bigint })[] }) => {
        for (const { cartId, productId, quantity } of data) {
          lines.get(cartId)?.push({ productId, quantity });
        }
        return Promise.resolve({ count: data.length });
      }),
    },
  };
  const prisma = {
    profile: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === CUSTOMER ? makeProfile({ id: CUSTOMER }) : null,
        ),
      ),
    },
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
        ({
          where,
          select,
        }: {
          where: { guestToken?: string; userId?: string };
          select: { items: { select: object } };
        }) => {
          const owner =
            where.guestToken !== undefined
              ? `guest:${where.guestToken}`
              : `user:${where.userId}`;
          if (!cartIds.has(owner)) return Promise.resolve(null);
          const withProduct = 'product' in select.items.select;
          return Promise.resolve({
            items: linesOf(owner).map((line) =>
              withProduct
                ? { quantity: line.quantity, product: productRow }
                : { ...line },
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

  beforeEach(() => {
    cartIds = new Map();
    lines = new Map();
    productRow.stockQuantity = 5;
  });

  const server = () => request(app.getHttpServer());
  /** Puts lines straight into a cart, as if they had been added earlier. */
  const seed = (owner: string, cart: Line[]) => {
    lines.set(cartIdFor(owner), cart);
  };

  describe('guest cart (SCRUM-16)', () => {
    it('returns an empty cart for a new guest without logging in', async () => {
      const res = await server().get('/api/cart').set('X-Cart-Token', TOKEN);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('rejects requests without a valid cart token', async () => {
      const missing = await server().get('/api/cart');
      const invalid = await server()
        .get('/api/cart')
        .set('X-Cart-Token', 'not-a-uuid');

      expect(missing.status).toBe(400);
      expect(invalid.status).toBe(400);
    });

    it('adds a product and returns the cart with its discounted price and totals', async () => {
      const res = await server()
        .post('/api/cart/items')
        .set('X-Cart-Token', TOKEN)
        .send({ productId: '1', quantity: 2 });

      expect(res.status).toBe(201);
      expect(res.body.items).toHaveLength(1);
      // 159.00 with 20% off is 127.20; two cost 254.40.
      expect(res.body).toEqual({
        items: [
          {
            productId: '1',
            name: 'AeroStride Pro',
            price: 127.2,
            imageUrl: null,
            stock: 5,
            quantity: 2,
            lineTotal: 254.4,
          },
        ],
        total: 254.4,
      });
    });

    it('refuses to add more than the stock', async () => {
      const res = await server()
        .post('/api/cart/items')
        .set('X-Cart-Token', TOKEN)
        .send({ productId: '1', quantity: 6 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Only 5 left in stock.');
    });

    it('refuses an out-of-stock product', async () => {
      productRow.stockQuantity = 0;

      const res = await server()
        .post('/api/cart/items')
        .set('X-Cart-Token', TOKEN)
        .send({ productId: '1' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('This product is out of stock.');
    });

    it('returns 404 for a product that does not exist', async () => {
      const res = await server()
        .post('/api/cart/items')
        .set('X-Cart-Token', TOKEN)
        .send({ productId: '999' });

      expect(res.status).toBe(404);
    });

    it.each([
      { productId: 'abc' },
      { productId: 1 },
      { productId: '-1' },
      { productId: '1', quantity: 1.5 },
      { productId: '1', quantity: 100 },
      { productId: '1', extra: true },
    ])('rejects the invalid body %o', async (body) => {
      const res = await server()
        .post('/api/cart/items')
        .set('X-Cart-Token', TOKEN)
        .send(body);

      expect(res.status).toBe(400);
    });

    it('changes the quantity of a cart line', async () => {
      seed(`guest:${TOKEN}`, [{ productId: 1n, quantity: 1 }]);

      const res = await server()
        .patch('/api/cart/items/1')
        .set('X-Cart-Token', TOKEN)
        .send({ quantity: 3 });

      expect(res.status).toBe(200);
      expect(res.body.items[0].quantity).toBe(3);
    });

    it('removes a product from the cart', async () => {
      seed(`guest:${TOKEN}`, [{ productId: 1n, quantity: 1 }]);

      const res = await server()
        .delete('/api/cart/items/1')
        .set('X-Cart-Token', TOKEN);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], total: 0 });
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

  describe('customer cart (SCRUM-17)', () => {
    const asCustomer = async () => `Bearer ${await sign({ sub: CUSTOMER })}`;

    it('requires a login', async () => {
      await server().get('/api/me/cart').expect(401);
      await server().post('/api/me/cart/merge').expect(401);
    });

    it('keeps the customer cart apart from the guest cart', async () => {
      seed(`guest:${TOKEN}`, [{ productId: 1n, quantity: 2 }]);

      const res = await server()
        .get('/api/me/cart')
        .set('Authorization', await asCustomer());

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], total: 0 });
    });

    it('adds to and changes the customer cart', async () => {
      const auth = await asCustomer();
      await server()
        .post('/api/me/cart/items')
        .set('Authorization', auth)
        .send({ productId: '1' })
        .expect(201);
      const res = await server()
        .patch('/api/me/cart/items/1')
        .set('Authorization', auth)
        .send({ quantity: 4 })
        .expect(200);

      expect(res.body.items[0].quantity).toBe(4);
      expect(linesOf(`user:${CUSTOMER}`)).toEqual([
        { productId: 1n, quantity: 4 },
      ]);
      expect(linesOf(`guest:${TOKEN}`)).toEqual([]);
    });

    it('moves the guest cart into the customer cart after login, capped at the stock', async () => {
      seed(`user:${CUSTOMER}`, [{ productId: 1n, quantity: 3 }]);
      seed(`guest:${TOKEN}`, [{ productId: 1n, quantity: 4 }]);

      const res = await server()
        .post('/api/me/cart/merge')
        .set('Authorization', await asCustomer())
        .set('X-Cart-Token', TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(5);
      expect(linesOf(`guest:${TOKEN}`)).toEqual([]);
    });

    it('needs the guest cart token to merge', async () => {
      await server()
        .post('/api/me/cart/merge')
        .set('Authorization', await asCustomer())
        .expect(400);
    });
  });
});
