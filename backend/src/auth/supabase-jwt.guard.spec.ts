import {
  type ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { errors, SignJWT } from 'jose';
import { createTestJwt } from '../../test/helpers/jwt.js';
import { makeProfile } from '../../test/helpers/profile.js';
import {
  fakeConfig,
  TEST_SUPABASE_URL,
} from '../../test/helpers/test-env.js';
import { Public } from './decorators.js';
import { SupabaseJwtGuard } from './supabase-jwt.guard.js';

class Dummy {
  @Public()
  open() {}
  closed() {}
}

const handlerOf = (name: keyof Dummy) =>
  Reflect.get(Dummy.prototype, name) as () => void;

const contextFor = (request: object, handler: () => void): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => Dummy,
  }) as unknown as ExecutionContext;

describe('SupabaseJwtGuard', () => {
  let jwt: Awaited<ReturnType<typeof createTestJwt>>;
  const findUnique = vi.fn();
  let guard: SupabaseJwtGuard;

  beforeAll(async () => {
    jwt = await createTestJwt();
  });

  beforeEach(() => {
    findUnique.mockReset();
    guard = new SupabaseJwtGuard(
      new Reflector(),
      fakeConfig(),
      { profile: { findUnique } } as never,
      jwt.jwks,
    );
  });

  const request = (authorization?: string) =>
    ({ headers: { authorization } }) as { headers: object; user?: unknown };

  it('lets @Public routes through without a token', async () => {
    await expect(
      guard.canActivate(contextFor(request(), handlerOf('open'))),
    ).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a request without a token', async () => {
    await expect(
      guard.canActivate(contextFor(request(), handlerOf('closed'))),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an authorization header that is not a bearer token', async () => {
    const token = await jwt.sign();
    await expect(
      guard.canActivate(
        contextFor(request(`Basic ${token}`), handlerOf('closed')),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid token and attaches the profile from the database', async () => {
    const profile = makeProfile({ role: 'sales_manager' });
    findUnique.mockResolvedValue(profile);
    const req = request(`Bearer ${await jwt.sign({ sub: profile.id })}`);

    await expect(
      guard.canActivate(contextFor(req, handlerOf('closed'))),
    ).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: profile.id } });
    expect(req.user).toBe(profile);
  });

  it('rejects an expired token', async () => {
    const req = request(`Bearer ${await jwt.sign({ expiresIn: '-1m' })}`);
    await expect(
      guard.canActivate(contextFor(req, handlerOf('closed'))),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token signed with a different key', async () => {
    const forged = await jwt.sign({}, await jwt.generateOtherKey());
    await expect(
      guard.canActivate(
        contextFor(request(`Bearer ${forged}`), handlerOf('closed')),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token from another issuer', async () => {
    const token = await jwt.sign({
      issuer: 'https://evil.example.com/auth/v1',
    });
    await expect(
      guard.canActivate(
        contextFor(request(`Bearer ${token}`), handlerOf('closed')),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token with the wrong audience (for example the anon role)', async () => {
    const token = await jwt.sign({ audience: 'anon' });
    await expect(
      guard.canActivate(
        contextFor(request(`Bearer ${token}`), handlerOf('closed')),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it.each([
    ['times out', new errors.JWKSTimeout()],
    ['answers non-200', new errors.JOSEError('Expected 200 OK')],
    ['cannot be reached', new TypeError('fetch failed')],
  ])(
    'answers 503, not 401, when the signing key download %s',
    async (_label, failure) => {
      const unreachable = new SupabaseJwtGuard(
        new Reflector(),
        fakeConfig(),
        { profile: { findUnique } } as never,
        () => Promise.reject(failure),
      );
      const req = request(`Bearer ${await jwt.sign()}`);
      await expect(
        unreachable.canActivate(contextFor(req, handlerOf('closed'))),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(findUnique).not.toHaveBeenCalled();
    },
  );

  it('rejects a legacy HS256 token when no JWT secret is configured', async () => {
    const legacy = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer(`${TEST_SUPABASE_URL}/auth/v1`)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('legacy-secret'));
    await expect(
      guard.canActivate(
        contextFor(request(`Bearer ${legacy}`), handlerOf('closed')),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a valid token whose user has no profile', async () => {
    findUnique.mockResolvedValue(null);
    const req = request(`Bearer ${await jwt.sign()}`);
    await expect(
      guard.canActivate(contextFor(req, handlerOf('closed'))),
    ).rejects.toThrow(/No profile/);
  });
});
