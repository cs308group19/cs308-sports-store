import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { TEST_SUPABASE_URL } from './test-env.js';

export interface SignOptions {
  sub?: string;
  issuer?: string;
  audience?: string;
  expiresIn?: string;
}

/** Local ES256 key pair that stands in for the Supabase project's signing key. */
export async function createTestJwt() {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: 'test-key',
    alg: 'ES256',
    use: 'sig',
  };
  const jwks = createLocalJWKSet({ keys: [jwk] });

  const sign = (options: SignOptions = {}, key = privateKey) =>
    new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject(options.sub ?? 'user-1')
      .setIssuer(options.issuer ?? `${TEST_SUPABASE_URL}/auth/v1`)
      .setAudience(options.audience ?? 'authenticated')
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? '1h')
      .sign(key);

  return {
    jwks,
    sign,
    generateOtherKey: async () => (await generateKeyPair('ES256')).privateKey,
  };
}
