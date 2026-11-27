import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  calls,
  fakeStore,
  geminiResponse,
  orderRow,
  productRow,
  says,
} from './helpers/assistant.js';
import { createTestJwt } from './helpers/jwt.js';
import { makeProfile } from './helpers/profile.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { JWKS } from '../src/auth/jwks.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SupabaseAdminService } from '../src/supabase/supabase-admin.service.js';

// Set before AppModule reads the configuration, so a real key in a developer's .env is never used.
vi.hoisted(() => {
  Object.assign(process.env, {
    GEMINI_API_KEY: 'e2e-fake-key',
    GEMINI_MODEL: 'e2e-flash',
    SUPPORT_PHONE: '+90 212 111 22 33',
    SUPPORT_EMAIL: 'help@rally.test',
    SUPPORT_HOURS: 'every day',
  });
});

/**
 * SCRUM-113. POST /api/assistant/chat through the real guards, pipes and routing. Gemini is a
 * mocked fetch: nothing leaves the machine.
 */
describe('Assistant (e2e)', () => {
  let app: INestApplication;
  let sign: Awaited<ReturnType<typeof createTestJwt>>['sign'];
  const fetchMock = vi.fn<typeof fetch>();
  const contact = {
    phone: '+90 212 111 22 33',
    email: 'help@rally.test',
    hours: 'every day',
  };

  const store = fakeStore(
    [productRow(1, 'Asics Gel Shoe')],
    [
      orderRow(1, 'customer-1', 'First customer shoe'),
      orderRow(2, 'customer-2', 'Second customer shoe'),
    ],
  );
  const prisma = {
    ...store,
    profile: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id.startsWith('customer-')
            ? makeProfile({ id: where.id })
            : where.id === 'manager'
              ? makeProfile({ id: where.id, role: 'product_manager' })
              : null,
        ),
      ),
    },
    onModuleInit: () => undefined,
    onModuleDestroy: () => undefined,
  };

  beforeEach(async () => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    store.order.findMany.mockClear();

    const jwt = await createTestJwt();
    sign = jwt.sign;
    // A new app for each test, so one test's requests do not count against another's limit.
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

  afterEach(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  const chat = (body: object, authorization?: string) => {
    const req = request(app.getHttpServer()).post('/api/assistant/chat');
    if (authorization) req.set('Authorization', authorization);
    return req.send(body);
  };
  const ask = (content: string) => ({
    messages: [{ role: 'user', content }],
  });
  const as = async (sub: string) => `Bearer ${await sign({ sub })}`;
  const answers = (...bodies: unknown[]) => {
    for (const body of bodies) {
      fetchMock.mockResolvedValueOnce(geminiResponse(body));
    }
  };
  /** What the tool sent back to the model on the second call. */
  const toolResult = () =>
    JSON.parse(fetchMock.mock.calls[1][1]!.body as string).contents.at(-1)
      .parts[0].functionResponse.response;

  it('answers a guest with a reply and product cards', async () => {
    answers(calls('search_products'), says('Try the Asics Gel Shoe.'));

    const res = await chat(ask('running shoes'));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body).toEqual({
      reply: 'Try the Asics Gel Shoe.',
      products: [
        {
          id: 1,
          name: 'Asics Gel Shoe',
          brand: 'ASICS',
          price: 90,
          stock: 5,
          image: null,
          model: 'MODEL-1',
        },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain('e2e-fake-key');
  });

  it("shows a signed-in customer their own orders and no one else's", async () => {
    answers(calls('my_orders'), says('It is on its way.'));

    const res = await chat(ask('my order?'), await as('customer-2'));

    expect(res.status).toBe(200);
    expect(JSON.stringify(toolResult())).toContain('Second customer shoe');
    expect(JSON.stringify(toolResult())).not.toContain('First customer shoe');
  });

  it.each([
    ['a guest', async () => undefined],
    ['a broken token', async () => 'Bearer not-a-token'],
    [
      'an expired token',
      async () =>
        `Bearer ${await sign({ sub: 'customer-1', expiresIn: '-1h' })}`,
    ],
    ['a token without a profile', async () => as('nobody')],
    ['a staff account', async () => as('manager')],
  ])('treats %s as not signed in as a customer', async (_name, header) => {
    answers(calls('my_orders'), says('Please sign in.'));

    const res = await chat(ask('my order?'), await header());

    expect(res.status).toBe(200);
    expect(toolResult()).toEqual({ signedIn: false });
    expect(store.order.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty conversation', { messages: [] }],
    ['a too long message', ask('a'.repeat(2001))],
    ['21 messages', { messages: Array(21).fill(ask('hi').messages[0]) }],
    [
      'a last message from the assistant',
      { messages: [{ role: 'assistant', content: 'hi' }] },
    ],
    ['a null message', { messages: [null] }],
  ])('rejects %s with 400 without calling Gemini', async (_name, body) => {
    const res = await chat(body);
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts the largest valid conversation', async () => {
    answers(says('Phew.'));
    const res = await chat({
      messages: Array(20).fill(ask('ş€'.repeat(1000)).messages[0]),
    });
    expect(res.status).toBe(200);
  });

  it('refuses a body over the size limit with 413', async () => {
    const res = await chat(ask('a'.repeat(140_000)));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 503 with the contact details when Gemini fails', async () => {
    fetchMock.mockResolvedValue(geminiResponse({}, 500));

    const res = await chat(ask('hi'));

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      message: expect.stringContaining('offline'),
      contact,
    });
  });

  it('answers 429 from the 21st message in a minute, counted per user', async () => {
    fetchMock.mockImplementation(async () => geminiResponse(says('ok')));
    const first = await as('customer-1');
    for (let i = 0; i < 20; i++) {
      expect((await chat(ask('hi'), first)).status).toBe(200);
    }

    expect((await chat(ask('hi'), first)).status).toBe(429);
    // Another customer and a guest on the same address still get through.
    expect((await chat(ask('hi'), await as('customer-2'))).status).toBe(200);
    expect((await chat(ask('hi'))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(22);
  });

  it('gives the contact details without calling Gemini', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/assistant/contact',
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual(contact);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
