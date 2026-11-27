import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MAX_MESSAGE_LENGTH, type ChatMessageDto } from './assistant.dto.js';
import { mentionedProducts } from './assistant.mentions.js';
import { systemPrompt } from './assistant.prompt.js';
import {
  AssistantTools,
  TOOL_DECLARATIONS,
  type ToolContext,
} from './assistant.tools.js';
import type {
  AssistantContact,
  AssistantProduct,
  AssistantReply,
} from './assistant.types.js';
import {
  GEMINI_TIMEOUT_MS,
  GeminiClient,
  GeminiError,
} from './gemini.client.js';
import type { GeminiContent, GeminiPart } from './gemini.types.js';

/** How many times the model may use tools before it has to answer. */
export const MAX_TOOL_ROUNDS = 4;
/** Tool calls answered in one round; more than this is not a real question. */
export const MAX_CALLS_PER_ROUND = 6;
/** All calls to Gemini for one message together. The widget waits a little longer than this. */
export const REPLY_BUDGET_MS = 30_000;

export const OFFLINE_MESSAGE =
  'Rally is offline right now. Our team can help by phone or email.';
export const NO_ANSWER_REPLY =
  'Sorry, I could not work that one out. Try asking it another way, or tap "Talk to a person".';

/**
 * Gemini expects the conversation to start with the user and the speakers to take turns. The
 * widget's own messages ("Talk to a person") can break both, so tidy that up here.
 */
export function toContents(messages: ChatMessageDto[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const { role, content } of messages) {
    const speaker = role === 'user' ? 'user' : 'model';
    const last = contents.at(-1);
    if (!last && speaker === 'model') continue;
    if (last?.role === speaker) last.parts.push({ text: content });
    else contents.push({ role: speaker, parts: [{ text: content }] });
  }
  return contents;
}

/** The words the shopper sees: without the model's reasoning or any Markdown it slipped in. */
export function replyText(content: GeminiContent | null): string {
  return (content?.parts ?? [])
    .filter((part) => typeof part.text === 'string' && !part.thought)
    .map((part) => part.text)
    .join('')
    .replace(/\*\*|__|`/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

function mentionsContact(reply: string, contact: AssistantContact): boolean {
  const squash = (value: string) =>
    value.toLowerCase().replace(/[\s().-]/g, '');
  return (
    squash(reply).includes(squash(contact.email)) ||
    squash(reply).includes(squash(contact.phone))
  );
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    @Inject(GeminiClient) private readonly gemini: GeminiClient,
    @Inject(AssistantTools) private readonly tools: AssistantTools,
  ) {}

  contact(): AssistantContact {
    return this.tools.contact();
  }

  /** One reply to the conversation. Nothing is stored. */
  async chat(
    messages: ChatMessageDto[],
    context: ToolContext,
  ): Promise<AssistantReply> {
    if (!this.gemini.configured) throw this.offline();

    const system = systemPrompt({ signedIn: context.customerId !== null });
    const contents = toContents(messages);
    const found = new Map<string, AssistantProduct>();
    const deadline = Date.now() + REPLY_BUDGET_MS;

    for (let round = 0; ; round++) {
      const allowTools = round < MAX_TOOL_ROUNDS;
      const content = await this.ask({
        system,
        contents,
        allowTools,
        timeLeft: deadline - Date.now(),
      });
      const calls = (content?.parts ?? []).filter((part) => part.functionCall);

      if (!content || calls.length === 0 || !allowTools) {
        return this.answer(replyText(content), [...found.values()]);
      }

      const results: GeminiPart[] = [];
      for (const [index, { functionCall }] of calls.entries()) {
        const { name, args, id } = functionCall!;
        let response: Record<string, unknown>;
        if (index >= MAX_CALLS_PER_ROUND) {
          response = { error: 'Too many tool calls at once.' };
        } else {
          const result = await this.runTool(name, args ?? {}, context);
          response = result.response;
          for (const product of result.products) {
            found.set(String(product.id), product);
          }
        }
        results.push({
          functionResponse: {
            name,
            ...(id !== undefined ? { id } : {}),
            response,
          },
        });
      }
      // The model's turn goes back exactly as it came, thought signatures included.
      contents.push(content, { role: 'user', parts: results });
    }
  }

  private async ask({
    timeLeft,
    ...request
  }: {
    system: string;
    contents: GeminiContent[];
    allowTools: boolean;
    timeLeft: number;
  }): Promise<GeminiContent | null> {
    try {
      if (timeLeft <= 0) throw new GeminiError('the reply took too long');
      return await this.gemini.generate({
        ...request,
        tools: TOOL_DECLARATIONS,
        timeoutMs: Math.min(GEMINI_TIMEOUT_MS, timeLeft),
      });
    } catch (error) {
      if (!(error instanceof GeminiError)) throw error;
      this.logger.warn(`Gemini request failed: ${error.message}`);
      throw this.offline();
    }
  }

  private async runTool(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext,
  ) {
    try {
      return await this.tools.run(name, args, context);
    } catch (error) {
      this.logger.error(
        `Tool ${name} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      return {
        response: { error: 'That lookup failed. Do not guess the answer.' },
        products: [],
      };
    }
  }

  private answer(text: string, found: AssistantProduct[]): AssistantReply {
    const reply = text || NO_ANSWER_REPLY;
    const contact = this.contact();
    return {
      reply,
      products: mentionedProducts(reply, found),
      ...(mentionsContact(reply, contact) ? { contact } : {}),
    };
  }

  private offline() {
    return new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: OFFLINE_MESSAGE,
      error: 'Service Unavailable',
      contact: this.contact(),
    });
  }
}
