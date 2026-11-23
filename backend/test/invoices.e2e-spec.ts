import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { makeInvoiceRecord } from './helpers/invoice-fixture.js';
import { createTestJwt } from './helpers/jwt.js';
import { makeProfile } from './helpers/profile.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { JWKS } from '../src/auth/jwks.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SupabaseAdminService } from '../src/supabase/supabase-admin.service.js';

/**
 * SCRUM-25 and SCRUM-26. The invoice and its PDF through the real guards and routing. The tests
 * create the order, lines, payment and invoice themselves, the way checkout will save them.
 */
describe('Invoices (e2e)', () => {
  let app: INestApplication;
  let sign: Awaited<ReturnType<typeof createTestJwt>>['sign'];
  const OWNER = 'customer-1';
  const OTHER = 'customer-2';

  /** The invoice table: each invoice with the customer who owns it. */
  const invoices = [{ userId: OWNER, record: makeInvoiceRecord() }];

  const prisma = {
    profile: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          [OWNER, OTHER].includes(where.id)
            ? makeProfile({ id: where.id, email: `${where.id}@rally.store` })
            : null,
        ),
      ),
    },
    invoice: {
      findFirst: vi.fn(
        ({ where }: { where: { id: bigint; userId?: string } }) =>
          Promise.resolve(
            invoices.find(
              (row) =>
                row.record.id === where.id &&
                (where.userId === undefined || row.userId === where.userId),
            )?.record ?? null,
          ),
      ),
      update: vi.fn(),
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

  describe('GET /api/me/invoices/:id (SCRUM-25)', () => {
    it('returns the invoice to the customer who owns it', async () => {
      const res = await server()
        .get('/api/me/invoices/7')
        .set('Authorization', await as(OWNER));

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: '7',
        invoiceNumber: 'INV-2026-000007',
        orderNumber: 'RLY-2026-000042',
        paid: true,
        subtotal: 259,
        discountTotal: 40,
        deliveryFee: 0,
        tax: 17.52,
        total: 236.52,
        currency: 'USD',
        billedTo: { name: 'Jamie Taylor', email: 'jamie@rally.store' },
        deliverTo: { address: '45 Harbour Road' },
        payment: { cardBrand: 'Visa', cardLast4: '4242' },
      });
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0]).toEqual({
        name: 'AeroStride Pro',
        model: 'AS-PRO-25',
        quantity: 2,
        unitListPrice: 100,
        discountRate: 20,
        unitPricePaid: 80,
        lineTotal: 160,
      });
    });

    it('asks the database for the invoice and its owner in one query', async () => {
      prisma.invoice.findFirst.mockClear();
      await server()
        .get('/api/me/invoices/7')
        .set('Authorization', await as(OWNER));

      expect(prisma.invoice.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.invoice.findFirst.mock.calls[0][0].where).toEqual({
        id: 7n,
        userId: OWNER,
      });
    });

    it('answers 404, not 403, when the invoice belongs to another customer', async () => {
      const other = await server()
        .get('/api/me/invoices/7')
        .set('Authorization', await as(OTHER));
      const missing = await server()
        .get('/api/me/invoices/999')
        .set('Authorization', await as(OTHER));

      expect(other.status).toBe(404);
      // The same answer as for an invoice that does not exist: nothing reveals that it exists.
      expect(other.body).toEqual(missing.body);
      expect(other.body).toEqual({
        statusCode: 404,
        message: 'Invoice not found.',
        error: 'Not Found',
      });
    });

    it('answers 404 for an invoice that does not exist', async () => {
      const res = await server()
        .get('/api/me/invoices/999')
        .set('Authorization', await as(OWNER));

      expect(res.status).toBe(404);
    });

    it('answers 400 for an id that is not a number', async () => {
      const res = await server()
        .get('/api/me/invoices/abc')
        .set('Authorization', await as(OWNER));

      expect(res.status).toBe(400);
    });

    it('answers 401 to a guest', async () => {
      const res = await server().get('/api/me/invoices/7');

      expect(res.status).toBe(401);
    });
  });
});
