import { jwtVerify, SignJWT } from 'jose';
import { TEST_SUPABASE_URL } from '../../test/helpers/test-env.js';
import { createSupabaseJwks } from './jwks.js';

const legacyToken = (secret: string) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret));

describe('createSupabaseJwks', () => {
  it('verifies a legacy HS256 token with the configured JWT secret', async () => {
    const jwks = createSupabaseJwks(TEST_SUPABASE_URL, 'legacy-secret');
    const { payload } = await jwtVerify(
      await legacyToken('legacy-secret'),
      jwks,
    );
    expect(payload.sub).toBe('user-1');
  });

  it('rejects an HS256 token signed with a different secret', async () => {
    const jwks = createSupabaseJwks(TEST_SUPABASE_URL, 'legacy-secret');
    await expect(
      jwtVerify(await legacyToken('guessed-secret'), jwks),
    ).rejects.toThrow();
  });
});
