import { randomBytes } from 'node:crypto';
import { TEST_ENV } from '../../test/helpers/test-env.js';
import { validateEnv } from './env.js';

describe('validateEnv', () => {
  it('accepts a complete environment and applies defaults', () => {
    const { PORT: _port, CORS_ORIGIN: _origin, ...rest } = TEST_ENV;
    const env = validateEnv(rest);
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it.each([
    'SUPABASE_URL',
    'SUPABASE_SECRET_KEY',
    'DATABASE_URL',
    'FIELD_ENCRYPTION_KEY',
  ])('rejects a missing %s', (name) => {
    expect(() => validateEnv({ ...TEST_ENV, [name]: '' })).toThrow(name);
  });

  it('rejects an encryption key that is not 32 bytes', () => {
    expect(() =>
      validateEnv({
        ...TEST_ENV,
        FIELD_ENCRYPTION_KEY: randomBytes(16).toString('base64'),
      }),
    ).toThrow(/32 random bytes/);
  });

  it('rejects an invalid Supabase URL', () => {
    expect(() =>
      validateEnv({ ...TEST_ENV, SUPABASE_URL: 'not a url' }),
    ).toThrow(/SUPABASE_URL/);
  });

  it('strips trailing slashes from the Supabase URL', () => {
    expect(
      validateEnv({ ...TEST_ENV, SUPABASE_URL: 'https://x.supabase.co//' })
        .SUPABASE_URL,
    ).toBe('https://x.supabase.co');
  });

  it('rejects an invalid port', () => {
    expect(() => validateEnv({ ...TEST_ENV, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('leaves the optional settings off by default', () => {
    const env = validateEnv(TEST_ENV);
    expect(env.TRUST_PROXY).toBe(false);
    expect(env.SUPABASE_JWT_SECRET).toBeUndefined();
  });

  it.each([
    ['1', 1],
    ['false', false],
    ['loopback', 'loopback'],
  ])('reads TRUST_PROXY=%s', (value, expected) => {
    expect(validateEnv({ ...TEST_ENV, TRUST_PROXY: value }).TRUST_PROXY).toBe(
      expected,
    );
  });

  it('refuses TRUST_PROXY=true, which would let clients fake their IP', () => {
    expect(() => validateEnv({ ...TEST_ENV, TRUST_PROXY: 'true' })).toThrow(
      /TRUST_PROXY/,
    );
  });
});
