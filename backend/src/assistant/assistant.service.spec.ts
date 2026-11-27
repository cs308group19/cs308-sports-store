import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  calls,
  fakeStore,
  geminiResponse,
  modelTurn,
  orderRow,
  productRow,
  says,
} from '../../test/helpers/assistant.js';
import { fakeConfig } from '../../test/helpers/test-env.js';
import { OrderHistoryService } from '../orders/order-history.service.js';
import { ProductDetailService } from '../products/product-detail.service.js';
import { ProductListService } from '../products/product-list.service.js';
import type { ChatMessageDto } from './assistant.dto.js';
import {
  AssistantService,
  MAX_TOOL_ROUNDS,
  NO_ANSWER_REPLY,
  OFFLINE_MESSAGE,
  replyText,
  toContents,
} from './assistant.service.js';
import { AssistantTools } from './assistant.tools.js';
import { GEMINI_TIMEOUT_MS, GeminiClient } from './gemini.client.js';

const KEY = 'test-key-never-logged';
const contact = {
  phone: '+90 212 111 22 33',
  email: 'help@rally.test',
  hours: 'every day',
};
const user = (content: string): ChatMessageDto => ({ role: 'user', content });
const bot = (content: string): ChatMessageDto => ({
  role: 'assistant',
  content,
});

/** SCRUM-113. The conversation with Gemini, with fetch mocked: nothing leaves the machine. */
describe('AssistantService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let warnings: string[];

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    warnings = [];
    vi.spyOn(Logger.prototype, 'warn').mockImplementation((message) => {
      warnings.push(String(message));
    });
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const setup = (env: Record<string, string> = {}) => {
    const config = fakeConfig({
      GEMINI_API_KEY: KEY,
      GEMINI_MODEL: 'test-flash',
      SUPPORT_PHONE: contact.phone,
      SUPPORT_EMAIL: contact.email,
      SUPPORT_HOURS: contact.hours,
      ...env,
    });
    const prisma = fakeStore(
      [productRow(1, 'Asics Gel Shoe'), productRow(2, 'Puma Road Shoe')],
      [orderRow(1, 'jamie', 'Asics Gel Shoe')],
    );
    const tools = new AssistantTools(
      new ProductListService(prisma as never),
      new ProductDetailService(prisma as never),
      new OrderHistoryService(prisma as never),
      config,
    );
    const service = new AssistantService(new GeminiClient(config), tools);
    return { service, tools, prisma };
  };

  const answers = (...bodies: unknown[]) => {
    for (const body of bodies) {
      fetchMock.mockResolvedValueOnce(geminiResponse(body));
    }
  };
  /** The JSON sent to Gemini in call number `index`. */
  const sent = (index: number) =>
    JSON.parse(fetchMock.mock.calls[index][1]!.body as string);
  const guest = { customerId: null };

  it('sends the conversation and returns a plain reply', async () => {
    const { service } = setup();
    answers(says('How far do you usually run?'));

    const reply = await service.chat([user('I need shoes')], guest);

    expect(reply).toEqual({
      reply: 'How far do you usually run?',
      products: [],
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/test-flash:generateContent',
    );
    // The key goes in a header, never in the address or the body.
    expect(init!.headers).toMatchObject({ 'x-goog-api-key': KEY });
    expect(`${url as string}${init!.body as string}`).not.toContain(KEY);
    expect(sent(0).contents).toEqual([
      { role: 'user', parts: [{ text: 'I need shoes' }] },
    ]);
    expect(sent(0).systemInstruction.parts[0].text).toContain('You are Rally');
    expect(sent(0).systemInstruction.parts[0].text).toContain('not signed in');
    expect(sent(0).tools[0].functionDeclarations).toHaveLength(4);
    expect(sent(0)).not.toHaveProperty('toolConfig');
  });

  it('runs a tool, sends its result back and returns the final reply with cards', async () => {
    const { service } = setup();
    const toolTurn = modelTurn({
      functionCall: { name: 'search_products', args: {}, id: 'call-1' },
      thoughtSignature: 'signature',
    });
    answers(toolTurn, says('The Asics Gel Shoe is $90 with 5 in stock.'));

    const reply = await service.chat([user('running shoes')], guest);

    expect(reply.reply).toBe('The Asics Gel Shoe is $90 with 5 in stock.');
    // Only the product the reply names, not everything the search returned.
    expect(reply.products).toEqual([
      {
        id: 1,
        name: 'Asics Gel Shoe',
        brand: 'ASICS',
        price: 90,
        stock: 5,
        image: null,
        model: 'MODEL-1',
      },
    ]);
    const [, modelContent, results] = sent(1).contents;
    // The model's turn goes back untouched, thought signature included.
    expect(modelContent).toEqual(toolTurn.candidates[0].content);
    expect(results.role).toBe('user');
    expect(results.parts[0].functionResponse).toMatchObject({
      name: 'search_products',
      id: 'call-1',
      response: { products: [{ id: 1 }, { id: 2 }] },
    });
  });

  it('answers several tool calls of one turn together', async () => {
    const { service } = setup();
    answers(
      modelTurn(
        { functionCall: { name: 'get_product', args: { id: '1' } } },
        { functionCall: { name: 'get_product', args: { id: '2' } } },
      ),
      says('Asics Gel Shoe or Puma Road Shoe?'),
    );

    const reply = await service.chat([user('compare')], guest);

    expect(sent(1).contents.at(-1).parts).toHaveLength(2);
    expect(reply.products.map((product) => product.id)).toEqual([1, 2]);
  });

  it(`stops using tools after ${MAX_TOOL_ROUNDS} rounds`, async () => {
    const { service, tools } = setup();
    const run = vi.spyOn(tools, 'run');
    fetchMock.mockImplementation(async () =>
      geminiResponse(calls('store_info')),
    );

    const reply = await service.chat([user('loop')], guest);

    expect(run).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
    expect(sent(MAX_TOOL_ROUNDS).toolConfig).toEqual({
      functionCallingConfig: { mode: 'NONE' },
    });
    expect(reply).toEqual({ reply: NO_ANSWER_REPLY, products: [] });
  });

  it('limits how many tools one round can run', async () => {
    const { service, tools } = setup();
    const run = vi.spyOn(tools, 'run');
    answers(
      modelTurn(
        ...Array.from({ length: 9 }, () => ({
          functionCall: { name: 'store_info', args: {} },
        })),
      ),
      says('Done.'),
    );

    await service.chat([user('hi')], guest);

    expect(run).toHaveBeenCalledTimes(6);
    expect(sent(1).contents.at(-1).parts).toHaveLength(9);
  });

  it("reads the signed-in customer's orders for my_orders", async () => {
    const { service, prisma } = setup();
    answers(calls('my_orders'), says('Your order is in transit.'));

    await service.chat([user("where's my order?")], { customerId: 'jamie' });

    expect(prisma.order.findMany.mock.calls[0][0].where).toEqual({
      userId: 'jamie',
    });
    expect(sent(0).systemInstruction.parts[0].text).toContain(
      'signed in as a customer',
    );
  });

  it('tells the model a guest is not signed in', async () => {
    const { service, prisma } = setup();
    answers(calls('my_orders'), says('Please sign in.'));

    await service.chat([user("where's my order?")], guest);

    expect(sent(1).contents.at(-1).parts[0].functionResponse.response).toEqual({
      signedIn: false,
    });
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });

  it('carries on when a tool fails', async () => {
    const { service, prisma } = setup();
    prisma.product.findMany.mockRejectedValue(new Error('database down'));
    answers(calls('search_products'), says('I cannot look that up right now.'));

    const reply = await service.chat([user('shoes')], guest);

    expect(reply.reply).toBe('I cannot look that up right now.');
    expect(
      sent(1).contents.at(-1).parts[0].functionResponse.response.error,
    ).toContain('failed');
  });

  it.each([
    [`Call ${contact.phone} (${contact.hours}).`],
    ['Call +902121112233 today.'],
    ['Write to HELP@rally.test.'],
  ])('adds the contact when the reply gives it: %s', async (text) => {
    const { service } = setup();
    answers(says(text));
    const reply = await service.chat([user('I want a human')], guest);
    expect(reply.contact).toEqual(contact);
  });

  it('answers politely when the model sends nothing', async () => {
    const { service } = setup();
    answers({ promptFeedback: { blockReason: 'SAFETY' } });
    await expect(service.chat([user('...')], guest)).resolves.toEqual({
      reply: NO_ANSWER_REPLY,
      products: [],
    });
  });

  describe('when Gemini cannot be used', () => {
    const offline = async (service: AssistantService) => {
      const error = await service
        .chat([user('hi')], guest)
        .then(() => null)
        .catch((thrown: unknown) => thrown);
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const body = (error as ServiceUnavailableException).getResponse();
      expect(body).toMatchObject({
        statusCode: 503,
        message: OFFLINE_MESSAGE,
        contact,
      });
      expect(JSON.stringify(body) + warnings.join()).not.toContain(KEY);
    };

    it.each(['GEMINI_API_KEY', 'GEMINI_MODEL'])(
      'answers 503 without calling anything when %s is missing',
      async (name) => {
        const { service } = setup({ [name]: '' });
        await offline(service);
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it('answers 503 on a provider error, logging only the status', async () => {
      const { service } = setup();
      fetchMock.mockResolvedValue(
        geminiResponse(
          {
            error: {
              status: 'RESOURCE_EXHAUSTED',
              message: `quota for ${KEY}`,
            },
          },
          429,
        ),
      );
      await offline(service);
      expect(warnings).toEqual([
        'Gemini request failed: HTTP 429 RESOURCE_EXHAUSTED',
      ]);
    });

    it('answers 503 on an error page that is not JSON', async () => {
      const { service } = setup();
      fetchMock.mockResolvedValue(new Response('<html>', { status: 502 }));
      await offline(service);
      expect(warnings).toEqual(['Gemini request failed: HTTP 502']);
    });

    it('answers 503 on a successful answer that cannot be read', async () => {
      const { service } = setup();
      fetchMock.mockResolvedValue(new Response('<html>', { status: 200 }));
      await offline(service);
    });

    it('answers 503 when the network fails', async () => {
      const { service } = setup();
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      await offline(service);
    });

    it('gives each call 15 seconds and answers 503 on a timeout', async () => {
      const { service } = setup();
      const timeout = vi.spyOn(AbortSignal, 'timeout');
      fetchMock.mockRejectedValue(
        new DOMException('timed out', 'TimeoutError'),
      );

      await offline(service);

      expect(GEMINI_TIMEOUT_MS).toBe(15_000);
      expect(timeout).toHaveBeenCalledWith(15_000);
      expect(fetchMock.mock.calls[0][1]!.signal).toBeInstanceOf(AbortSignal);
    });

    it('gives up once the time for the whole reply is used', async () => {
      const { service } = setup();
      let now = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => now);
      fetchMock.mockImplementation(async () => {
        now += 16_000;
        return geminiResponse(calls('store_info'));
      });

      await offline(service);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});

describe('toContents', () => {
  it('starts with the user and merges turns of the same speaker', () => {
    expect(
      toContents([
        bot('Here is our phone number.'),
        user('hi'),
        user('anyone there?'),
        bot('Yes!'),
        bot('Call us.'),
        user('ok'),
      ]),
    ).toEqual([
      { role: 'user', parts: [{ text: 'hi' }, { text: 'anyone there?' }] },
      { role: 'model', parts: [{ text: 'Yes!' }, { text: 'Call us.' }] },
      { role: 'user', parts: [{ text: 'ok' }] },
    ]);
  });
});

describe('replyText', () => {
  it('drops the reasoning and Markdown and stays within the message limit', () => {
    expect(
      replyText({
        role: 'model',
        parts: [
          { text: 'thinking...', thought: true },
          { text: '## Picks\n**Asics** for you\n* soft\n- light' },
        ],
      }),
    ).toBe('Picks\nAsics for you\n• soft\n• light');
    expect(
      replyText({ role: 'model', parts: [{ text: 'a'.repeat(3000) }] }),
    ).toHaveLength(2000);
  });
});
