import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { JWKS } from '../src/auth/jwks.js';
import { CheckoutService } from '../src/checkout/checkout.service.js';
import { InvoicesService } from '../src/invoices/invoices.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SupabaseAdminService } from '../src/supabase/supabase-admin.service.js';
import { createTestJwt } from './helpers/jwt.js';
import { makeProfile } from './helpers/profile.js';

const endpoint = '/api/me/checkout';
const input = {
  deliveryRecipient: 'Deniz Yılmaz',
  deliveryAddress: 'New test address, Istanbul',
  cardholderName: 'Deniz Yılmaz',
  cardNumber: '4242 4242 4242 4242',
  expiry: '12/99',
  cvv: '9731',
  reviewedCart: {
    items: [{ productId: '10', quantity: 1, lineTotalCents: 2000 }],
    totalCents: 2960,
  },
};
const result = { orderId: '987', orderNumber: 'RLY-TEST', invoiceId: '112' };

describe('checkout (e2e)', () => {
  let app: INestApplication;
  let customerToken: string;
  let staffToken: string;

  const placeOrder = vi.fn().mockResolvedValue(result);
  const sendInvoiceEmail = vi.fn().mockResolvedValue(undefined);
  const logger = {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    fatal: vi.fn(),
  };

  beforeAll(async () => {
    const { jwks, sign } = await createTestJwt();
    customerToken = `Bearer ${await sign({ sub: 'customer' })}`;
    staffToken = `Bearer ${await sign({ sub: 'manager' })}`;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JWKS)
      .useValue(jwks)
      .overrideProvider(PrismaService)
      .useValue({
        profile: {
          findUnique: ({ where }: { where: { id: string } }) =>
            Promise.resolve(
              makeProfile({
                id: where.id,
                role: where.id === 'manager' ? 'product_manager' : 'customer',
              }),
            ),
        },
      })
      .overrideProvider(SupabaseAdminService)
      .useValue({ auth: {} })
      .overrideProvider(CheckoutService)
      .useValue({ placeOrder })
      .overrideProvider(InvoicesService)
      .useValue({ sendInvoiceEmail })
      .compile();
    app = module.createNestApplication();
    app.useLogger(logger);
    configureApp(app);
    await app.init();
  });

  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => app.close());

  const post = (token?: string) => {
    const req = request(app.getHttpServer()).post(endpoint);
    return token ? req.set('Authorization', token) : req;
  };

  it('requires authentication and the customer role', async () => {
    await post().send(input).expect(401);
    await post(staffToken).send(input).expect(403);
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('returns the IDs and passes only masked card details to the order transaction', async () => {
    const res = await post(customerToken).send(input).expect(201);
    expect(res.body).toEqual(result);
    expect(placeOrder).toHaveBeenCalledExactlyOnceWith(
      'customer',
      {
        deliveryRecipient: input.deliveryRecipient,
        deliveryAddress: input.deliveryAddress,
      },
      { cardBrand: 'Visa', cardLast4: '4242' },
      input.reviewedCart,
    );
    expect(sendInvoiceEmail).toHaveBeenCalledExactlyOnceWith(result.invoiceId);
    expect(sendInvoiceEmail.mock.invocationCallOrder[0]).toBeGreaterThan(
      placeOrder.mock.invocationCallOrder[0],
    );
    expectNoCardDetails(res.text);
  });

  it('returns the order while invoice email is still pending', async () => {
    let finishEmail!: () => void;
    const pendingEmail = new Promise<void>((resolve) => {
      finishEmail = resolve;
    });
    sendInvoiceEmail.mockReturnValueOnce(pendingEmail);

    try {
      await post(customerToken)
        .send(input)
        .timeout({ deadline: 2_000 })
        .expect(201, result);
      expect(sendInvoiceEmail).toHaveBeenCalledExactlyOnceWith(result.invoiceId);
    } finally {
      finishEmail();
    }
  });

  it('declines the demo decline card and other valid numbers before calling the order service', async () => {
    for (const cardNumber of ['4000000000000002', '4012888888881881']) {
      const res = await post(customerToken)
        .send({ ...input, cardNumber })
        .expect(402);
      expect(res.body).toEqual({
        statusCode: 402,
        message: 'Payment was declined.',
        error: 'Payment Required',
      });
      expect(res.text).not.toContain(cardNumber);
      expectNoCardDetails(res.text);
    }
    expect(placeOrder).not.toHaveBeenCalled();
    expect(sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it('returns a fixed validation error for invalid fields, unknown keys and malformed JSON', async () => {
    const invalid = await post(customerToken)
      .send({ ...input, expiry: '13/99' })
      .expect(400);
    const extra = await post(customerToken)
      .send({ ...input, [input.cardNumber]: input.cvv })
      .expect(400);
    const malformed = await post(customerToken)
      .set('Content-Type', 'application/json')
      .send(`${input.cardNumber} ${input.cvv}`)
      .expect(400);
    for (const res of [invalid, extra, malformed]) {
      expect(res.body).toEqual({
        statusCode: 400,
        message: 'Check your delivery and card details.',
        error: 'Bad Request',
      });
      expectNoCardDetails(res.text);
    }
    expect(placeOrder).not.toHaveBeenCalled();
    expect(sendInvoiceEmail).not.toHaveBeenCalled();
  });

  it('requires a reviewed cart with non-empty lines and integer amounts in cents', async () => {
    for (const reviewedCart of [
      undefined,
      { items: [], totalCents: 0 },
      { ...input.reviewedCart, totalCents: 29.6 },
      {
        ...input.reviewedCart,
        items: [{ productId: '10', quantity: 1, lineTotalCents: -1 }],
      },
    ]) {
      await post(customerToken).send({ ...input, reviewedCart }).expect(400);
    }
    expect(placeOrder).not.toHaveBeenCalled();
    expect(sendInvoiceEmail).not.toHaveBeenCalled();
  });

  function expectNoCardDetails(response: string) {
    const calls = Object.values(logger).flatMap((sink) => sink.mock.calls);
    const output = `${response}\n${JSON.stringify(calls)}`;
    expect(output).not.toContain(input.cardNumber);
    expect(output).not.toContain(input.cardNumber.replaceAll(' ', ''));
    expect(output).not.toContain(input.cvv);
  }
});
