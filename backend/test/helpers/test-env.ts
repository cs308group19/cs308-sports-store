import { randomBytes } from 'node:crypto';

export const TEST_SUPABASE_URL = 'https://test-project.supabase.co';
export const TEST_ENCRYPTION_KEY = randomBytes(32).toString('base64');

export const TEST_ENV: Record<string, string> = {
  PORT: '3000',
  CORS_ORIGIN: 'http://localhost:5173',
  SUPABASE_URL: TEST_SUPABASE_URL,
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/postgres',
  FIELD_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
};

/** Minimal stand-in for ConfigService<Env, true>. */
export const fakeConfig = (overrides: Record<string, string> = {}) => {
  const values = { ...TEST_ENV, ...overrides };
  return { get: (key: string) => values[key] } as never;
};
