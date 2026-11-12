import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './auth.types.js';
import { ROLES_KEY } from './decorators.js';
import type { UserRole } from './roles.js';

/** Global guard that runs after SupabaseJwtGuard and enforces @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowed || allowed.length === 0) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !allowed.includes(user.role)) {
      throw new ForbiddenException(
        'Your role is not allowed to use this resource',
      );
    }
    return true;
  }
}
