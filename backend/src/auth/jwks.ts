import { createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

/** Injection token for the key resolver that verifies Supabase access tokens. */
export const JWKS = Symbol('JWKS');

export type Jwks = JWTVerifyGetKey;

/**
 * Supabase signs access tokens with the project's asymmetric signing keys, published as a JWKS.
 * Projects that still use the legacy shared JWT secret sign with HS256 instead; those tokens are
 * accepted only when that secret is configured. An HS token never reaches the JWKS (it has no
 * HMAC keys), so without the secret it is rejected.
 */
export function createSupabaseJwks(
  supabaseUrl: string,
  legacyJwtSecret?: string,
): Jwks {
  const remote = createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
  );
  if (!legacyJwtSecret) return remote;

  const secret = new TextEncoder().encode(legacyJwtSecret);
  return (header, token) =>
    header.alg === 'HS256' ? secret : remote(header, token);
}
