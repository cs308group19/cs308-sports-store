export interface Env {
  PORT: number;
  CORS_ORIGIN: string;
  SUPABASE_URL: string;
  SUPABASE_SECRET_KEY: string;
  DATABASE_URL: string;
  FIELD_ENCRYPTION_KEY: string;
  /** Only for Supabase projects that still sign tokens with the legacy shared JWT secret. */
  SUPABASE_JWT_SECRET?: string;
  /** Express "trust proxy" setting, so rate limits see the client IP behind a proxy. */
  TRUST_PROXY: boolean | number | string;
  /** Mail server for the invoice email. Defaults to a local Mailpit (localhost:1025). */
  SMTP_HOST: string;
  SMTP_PORT: number;
  /** Leave both empty for a server without a login, such as Mailpit. */
  SMTP_USER?: string;
  SMTP_PASS?: string;
  /** The "From" of every email the store sends. */
  MAIL_FROM: string;
  /** Rally, the shopping assistant. Without both of these its chat answers 503. Server only. */
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  /** How a customer reaches a person: shown by Rally and the chat widget. */
  SUPPORT_PHONE: string;
  SUPPORT_EMAIL: string;
  SUPPORT_HOURS: string;
}

function optional(raw: Record<string, unknown>, name: keyof Env) {
  const value = raw[name];
  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
}

/**
 * Off by default: trusting X-Forwarded-For without a proxy in front would let clients pick their
 * own IP and dodge the rate limits. Behind a proxy set the number of proxy hops (usually 1), or any
 * value Express accepts (e.g. "loopback" or a list of subnets).
 */
function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') {
    throw new Error(
      'TRUST_PROXY=true trusts any X-Forwarded-For header, so clients could fake their IP. Set the number of proxy hops instead (usually 1).',
    );
  }
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

function required(raw: Record<string, unknown>, name: keyof Env): string {
  const value = raw[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name} (see .env.example)`,
    );
  }
  return value.trim();
}

/** Validates process.env once at startup so a bad setup fails fast with a clear message. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const supabaseUrl = required(raw, 'SUPABASE_URL').replace(/\/+$/, '');
  try {
    new URL(supabaseUrl);
  } catch {
    throw new Error(
      'SUPABASE_URL must be a valid URL, e.g. https://<project-ref>.supabase.co',
    );
  }

  const encryptionKey = required(raw, 'FIELD_ENCRYPTION_KEY');
  if (Buffer.from(encryptionKey, 'base64').length !== 32) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY must be 32 random bytes, base64 encoded (generate one with: openssl rand -base64 32)',
    );
  }

  const port =
    raw.PORT === undefined || raw.PORT === '' ? 3000 : Number(raw.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const smtpPortText = optional(raw, 'SMTP_PORT');
  const smtpPort = smtpPortText === undefined ? 1025 : Number(smtpPortText);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535');
  }
  const smtpUser = optional(raw, 'SMTP_USER');
  const smtpPass = optional(raw, 'SMTP_PASS');
  if ((smtpUser === undefined) !== (smtpPass === undefined)) {
    throw new Error('Set both SMTP_USER and SMTP_PASS, or neither of them.');
  }

  return {
    PORT: port,
    CORS_ORIGIN:
      typeof raw.CORS_ORIGIN === 'string' && raw.CORS_ORIGIN.trim() !== ''
        ? raw.CORS_ORIGIN.trim()
        : 'http://localhost:5173',
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SECRET_KEY: required(raw, 'SUPABASE_SECRET_KEY'),
    DATABASE_URL: required(raw, 'DATABASE_URL'),
    FIELD_ENCRYPTION_KEY: encryptionKey,
    SUPABASE_JWT_SECRET: optional(raw, 'SUPABASE_JWT_SECRET'),
    TRUST_PROXY: parseTrustProxy(optional(raw, 'TRUST_PROXY')),
    SMTP_HOST: optional(raw, 'SMTP_HOST') ?? 'localhost',
    SMTP_PORT: smtpPort,
    SMTP_USER: smtpUser,
    SMTP_PASS: smtpPass,
    MAIL_FROM:
      optional(raw, 'MAIL_FROM') ?? 'RALLY Sports <no-reply@rally.store>',
    GEMINI_API_KEY: optional(raw, 'GEMINI_API_KEY'),
    GEMINI_MODEL: optional(raw, 'GEMINI_MODEL'),
    SUPPORT_PHONE: optional(raw, 'SUPPORT_PHONE') ?? '+90 000 000 00 00',
    SUPPORT_EMAIL: optional(raw, 'SUPPORT_EMAIL') ?? 'support@rally.store',
    SUPPORT_HOURS: optional(raw, 'SUPPORT_HOURS') ?? 'weekdays 09:00–18:00',
  };
}
