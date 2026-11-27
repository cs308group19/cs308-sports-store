import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { JWKS } from '../src/auth/jwks.js';
import type { ReviewStatus } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SupabaseAdminService } from '../src/supabase/supabase-admin.service.js';
import { createTestJwt } from './helpers/jwt.js';
import { makeProfile } from './helpers/profile.js';

const BUYER = 'buyer';
const MANAGER = 'manager';
const SALES = 'sales';
const ITEM = 5n;
const REVIEW = 17n;
const PRODUCT = 6n;

type ReviewRow = {
  id: bigint;
  userId: string;
  rating: number;
  comment: string | null;
  commentStatus: ReviewStatus;
};

describe('Reviews (e2e)', () => {
  let app: INestApplication;
  let sign: Awaited<ReturnType<typeof createTestJwt>>['sign'];
  let row: ReviewRow | null;
  const profiles = new Map([
    [BUYER, makeProfile({ id: BUYER, role: 'customer' })],
    [MANAGER, makeProfile({ id: MANAGER, role: 'product_manager' })],
    [SALES, makeProfile({ id: SALES, role: 'sales_manager' })],
  ]);

  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: PRODUCT }]),
    orderItem: {
      findFirst: vi.fn(
        ({ where }: { where: { id: bigint; order: { userId: string } } }) =>
          Promise.resolve(
            where.id === ITEM && where.order.userId === BUYER
              ? { orderId: 4n, productId: PRODUCT, deliveries: [{ id: 11n }] }
              : null,
          ),
      ),
    },
    review: {
      findUnique: vi.fn(
        ({ where }: { where: { id?: bigint; orderItemId?: bigint } }) =>
          Promise.resolve(
            where.id === REVIEW || where.orderItemId === ITEM ? row : null,
          ),
      ),
      create: vi.fn(
        ({
          data,
        }: {
          data: Omit<ReviewRow, 'id' | 'comment'> & { comment?: string };
        }) => {
          row = { ...data, id: REVIEW, comment: data.comment ?? null };
          return Promise.resolve(row);
        },
      ),
      update: vi.fn(
        ({ data }: { data: Pick<ReviewRow, 'comment' | 'commentStatus'> }) => {
          if (!row) throw new Error('Missing test review');
          row = { ...row, ...data };
          return Promise.resolve(row);
        },
      ),
      aggregate: vi
        .fn()
        .mockResolvedValue({ _avg: { rating: 4 }, _count: { _all: 1 } }),
      findMany: vi.fn(() =>
        Promise.resolve(
          row?.commentStatus === 'pending' && row.comment
            ? [
                {
                  ...row,
                  product: { name: 'Shirt' },
                  user: { fullName: 'Jamie Taylor' },
                },
              ]
            : [],
        ),
      ),
      updateMany: vi.fn(
        ({
          where,
          data,
        }: {
          where: { id: bigint; commentStatus: ReviewStatus };
          data: { commentStatus: ReviewStatus };
        }) => {
          if (
            !row ||
            row.id !== where.id ||
            row.commentStatus !== where.commentStatus ||
            row.comment === null
          ) {
            return Promise.resolve({ count: 0 });
          }
          row.commentStatus = data.commentStatus;
          return Promise.resolve({ count: 1 });
        },
      ),
    },
    product: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    profile: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(profiles.get(where.id) ?? null),
      ),
    },
    $transaction: vi.fn((work: (transaction: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
    review: tx.review,
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

  beforeEach(() => {
    row = null;
    vi.clearAllMocks();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  const server = () => request(app.getHttpServer());
  const authorization = async (sub: string) => `Bearer ${await sign({ sub })}`;
  const submit = async (body: object, sub = BUYER) =>
    server()
      .post('/api/me/reviews')
      .set('Authorization', await authorization(sub))
      .send(body);
  const moderate = async (id: string, status: string, sub = MANAGER) =>
    server()
      .patch(`/api/staff/reviews/${id}`)
      .set('Authorization', await authorization(sub))
      .send({ status });
  const list = async (query = '', sub = MANAGER) =>
    server()
      .get(`/api/staff/reviews${query}`)
      .set('Authorization', await authorization(sub));

  const rating = { orderItemId: ITEM.toString(), rating: 4 };

  it('requires authentication on the customer and manager routes', async () => {
    expect((await server().post('/api/me/reviews').send(rating)).status).toBe(
      401,
    );
    expect((await server().get('/api/staff/reviews')).status).toBe(401);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([MANAGER, SALES])(
    'rejects %s submitting a customer review',
    async (sub) => {
      expect((await submit(rating, sub)).status).toBe(403);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each([BUYER, SALES])(
    'rejects %s accessing either staff review operation',
    async (sub) => {
      expect((await list('?status=pending', sub)).status).toBe(403);
      expect((await moderate(String(REVIEW), 'approved', sub)).status).toBe(
        403,
      );
      expect(prisma.review.findMany).not.toHaveBeenCalled();
      expect(prisma.review.updateMany).not.toHaveBeenCalled();
    },
  );

  const invalidSubmissions: Array<[string, object]> = [
    ['rating below one', { ...rating, rating: 0 }],
    ['rating above five', { ...rating, rating: 6 }],
    ['fractional rating', { ...rating, rating: 2.5 }],
    [
      'unsafe number ID',
      { ...rating, orderItemId: Number.MAX_SAFE_INTEGER + 1 },
    ],
    [
      'ID larger than PostgreSQL BIGINT',
      { ...rating, orderItemId: '9223372036854775808' },
    ],
    ['blank comment', { ...rating, comment: '  ' }],
    [
      'comment longer than 2000 characters',
      { ...rating, comment: 'x'.repeat(2001) },
    ],
    ['null comment', { ...rating, comment: null }],
  ];

  it.each(invalidSubmissions)(
    'rejects a submission with %s before writing',
    async (_name, body) => {
      expect((await submit(body)).status).toBe(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['?status=approved', '?status='])(
    'rejects the queue filter %s',
    async (query) => {
      expect((await list(query)).status).toBe(400);
      expect(prisma.review.findMany).not.toHaveBeenCalled();
    },
  );

  it('trims a deferred comment and refuses both rating changes and second comments', async () => {
    const first = await submit(rating);
    expect(first.status).toBe(201);
    expect(first.body).toEqual({
      id: Number(REVIEW),
      rating: 4,
      commentStatus: null,
    });
    expect(
      (await submit({ ...rating, rating: 5, comment: 'Fits well' })).status,
    ).toBe(409);
    const added = await submit({ ...rating, comment: '  Fits well  ' });
    expect(added.status).toBe(201);
    expect(added.body).toEqual({
      id: Number(REVIEW),
      rating: 4,
      commentStatus: 'pending',
    });
    expect(
      (await submit({ ...rating, comment: 'A second comment' })).status,
    ).toBe(409);
    expect((await list('?status=pending')).body).toEqual([
      {
        id: Number(REVIEW),
        rating: 4,
        comment: 'Fits well',
        author: 'Jamie Taylor',
        productName: 'Shirt',
      },
    ]);
    expect(row?.comment).toBe('Fits well');
  });

  it('rejects a malformed review ID or moderation status before attempting an update', async () => {
    expect((await moderate('invalid', 'approved')).status).toBe(400);
    expect((await moderate(String(REVIEW), 'pending')).status).toBe(400);
    expect(prisma.review.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown review or a rating with no comment', async () => {
    expect((await submit(rating)).status).toBe(201);
    expect((await moderate(String(REVIEW + 1n), 'approved')).status).toBe(404);
    expect((await moderate(String(REVIEW), 'approved')).status).toBe(404);
  });

  it('records one concurrent moderation decision and rejects subsequent decisions', async () => {
    expect((await submit({ ...rating, comment: 'Fits well' })).status).toBe(
      201,
    );
    const decisions = await Promise.all([
      moderate(String(REVIEW), 'approved'),
      moderate(String(REVIEW), 'rejected'),
    ]);
    expect(decisions.map(({ status }) => status).sort((a, b) => a - b)).toEqual(
      [200, 409],
    );
    const winner = decisions.find(({ status }) => status === 200);
    expect(winner?.body).toEqual({
      id: Number(REVIEW),
      status: row?.commentStatus,
    });
    expect((await moderate(String(REVIEW), 'rejected')).status).toBe(409);
    expect((await list()).body).toEqual([]);
  });
});
