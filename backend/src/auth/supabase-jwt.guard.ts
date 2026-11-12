import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { decodeProtectedHeader, errors, jwtVerify } from 'jose';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { IS_PUBLIC_KEY } from './decorators.js';
import { JWKS, type Jwks } from './jwks.js';

/**
 * True when verification failed because the signing keys could not be loaded (timeout, network
 * error, Supabase answering non-200 or garbage), as opposed to the token itself being bad.
 * jose only throws a plain JOSEError from its JWKS download; every token problem has its own subclass.
 */
export function isKeyFetchFailure(error: unknown): boolean {
  if (!(error instanceof errors.JOSEError)) return true;
  return (
    error instanceof errors.JWKSTimeout ||
    error instanceof errors.JWKSInvalid ||
    error.code === errors.JOSEError.code
  );
}

/**
 * Global guard. Verifies the Supabase access token (signature via the project's JWKS, issuer,
 * audience, expiry) and loads the user's profile from the database. The role comes from the
 * profile row, never from the token, so a role change takes effect immediately.
 */
@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseJwtGuard.name);
  private readonly issuer: string;
  private warnedAboutLegacySecret = false;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ConfigService) config: ConfigService<Env, true>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JWKS) private readonly jwks: Jwks,
  ) {
    this.issuer = `${config.get('SUPABASE_URL', { infer: true })}/auth/v1`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let userId: string | undefined;
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: 'authenticated',
      });
      userId = payload.sub;
    } catch (error) {
      // 401 tells the client its session is dead and it signs the user out, so only send it
      // when the token itself is bad, never when we could not load Supabase's signing keys.
      if (isKeyFetchFailure(error)) {
        this.logger.error(
          `Could not load the Supabase signing keys: ${String(error)}`,
        );
        throw new ServiceUnavailableException(
          'Cannot verify the session right now. Please try again in a moment.',
        );
      }
      if (error instanceof errors.JWKSNoMatchingKey) {
        this.warnIfLegacySecretToken(token);
      }
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!userId) throw new UnauthorizedException('Invalid or expired token');

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });
    if (!profile)
      throw new UnauthorizedException('No profile exists for this account');

    request.user = profile;
    return true;
  }

  /** A token signed with the legacy shared secret only verifies when SUPABASE_JWT_SECRET is set. */
  private warnIfLegacySecretToken(token: string) {
    if (this.warnedAboutLegacySecret) return;
    let alg: string | undefined;
    try {
      alg = decodeProtectedHeader(token).alg;
    } catch {
      return;
    }
    if (!alg?.startsWith('HS')) return;
    this.warnedAboutLegacySecret = true;
    this.logger.warn(
      `Rejected a token signed with ${alg}: this Supabase project still uses the legacy JWT secret. ` +
        'Switch the project to JWT signing keys (Project Settings > JWT Keys), or set SUPABASE_JWT_SECRET (see README).',
    );
  }

  private extractBearerToken(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const [scheme, token, ...rest] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0)
      return undefined;
    return token;
  }
}
