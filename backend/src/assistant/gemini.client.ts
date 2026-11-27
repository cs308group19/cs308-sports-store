import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type {
  GeminiContent,
  GeminiFunctionDeclaration,
} from './gemini.types.js';

export const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta';
/** Longest one call to Gemini may take. */
export const GEMINI_TIMEOUT_MS = 15_000;

/** Gemini could not be used. The message is safe to log: no key, no conversation. */
export class GeminiError extends Error {}

export interface GenerateRequest {
  system: string;
  contents: GeminiContent[];
  tools: GeminiFunctionDeclaration[];
  /** False for the last turn, when the model has to answer in words. */
  allowTools: boolean;
  timeoutMs?: number;
}

/** Calls Gemini's REST API with the built-in fetch. The key stays in a header on the server. */
@Injectable()
export class GeminiClient {
  private readonly apiKey: string | undefined;
  private readonly model: string | undefined;

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.apiKey = config.get('GEMINI_API_KEY', { infer: true }) || undefined;
    this.model =
      config.get('GEMINI_MODEL', { infer: true })?.replace(/^models\//, '') ||
      undefined;
  }

  get configured(): boolean {
    return this.apiKey !== undefined && this.model !== undefined;
  }

  /** The model's next turn, or null when it answered with nothing (for example a safety stop). */
  async generate({
    system,
    contents,
    tools,
    allowTools,
    timeoutMs = GEMINI_TIMEOUT_MS,
  }: GenerateRequest): Promise<GeminiContent | null> {
    if (this.apiKey === undefined || this.model === undefined) {
      throw new GeminiError('GEMINI_API_KEY or GEMINI_MODEL is not set');
    }

    let response: Response;
    let body: unknown;
    try {
      response = await fetch(
        `${GEMINI_API_URL}/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            tools: [{ functionDeclarations: tools }],
            ...(allowTools
              ? {}
              : { toolConfig: { functionCallingConfig: { mode: 'NONE' } } }),
          }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );
      body = await response.json().catch((error: unknown) => {
        // An error page need not be JSON; a successful answer must be.
        if (response.ok) throw error;
        return null;
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : 'unknown error';
      throw new GeminiError(
        name === 'TimeoutError' || name === 'AbortError'
          ? `no answer within ${timeoutMs} ms`
          : `could not reach Gemini (${name})`,
      );
    }

    if (!response.ok) {
      // Only the status codes: Gemini's error text can quote the request.
      const code = (body as { error?: { status?: unknown } } | null)?.error
        ?.status;
      const suffix =
        typeof code === 'string' && /^[A-Z_]+$/.test(code) ? ` ${code}` : '';
      throw new GeminiError(`HTTP ${response.status}${suffix}`);
    }

    const content = (
      body as { candidates?: Array<{ content?: GeminiContent }> } | null
    )?.candidates?.[0]?.content;
    return Array.isArray(content?.parts) && content.parts.length > 0
      ? { ...content, role: 'model' }
      : null;
  }
}
