import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';
import type { UserRole } from './roles.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/** Skips authentication for a route (health check, registration, future guest chat). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Open to guests, but a valid session is still recognised: the user is attached when the token is
 * good, and a missing or bad token leaves the request a guest's. Use CurrentUser() as optional.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

/** Restricts a route to the listed roles. Routes without it only require a signed-in user. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the signed-in user's profile. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user as AuthUser;
  },
);
