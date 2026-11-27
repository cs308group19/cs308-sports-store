import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';

export const CHAT_LIMIT = 20;
export const CHAT_WINDOW_MS = 60_000;

/**
 * At most CHAT_LIMIT chat messages a minute for each signed-in user, or for each IP address for
 * guests. Runs after the sign-in guard (so it knows the user) and counts in memory only.
 */
@Injectable()
export class AssistantRateLimitGuard implements CanActivate {
  /** When each caller's accepted requests of the last minute arrived. */
  private readonly hits = new Map<string, number[]>();
  private lastSweep = 0;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const key = request.user ? `user:${request.user.id}` : `ip:${request.ip}`;
    const now = Date.now();
    this.sweep(now);

    const recent = (this.hits.get(key) ?? []).filter(
      (time) => now - time < CHAT_WINDOW_MS,
    );
    if (recent.length >= CHAT_LIMIT) {
      this.hits.set(key, recent);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many messages. Please wait a minute and try again.',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Forgets callers who have been quiet for a minute, so the map cannot keep growing. */
  private sweep(now: number) {
    if (now - this.lastSweep < CHAT_WINDOW_MS) return;
    this.lastSweep = now;
    for (const [key, times] of this.hits) {
      if (now - (times.at(-1) ?? 0) >= CHAT_WINDOW_MS) this.hits.delete(key);
    }
  }
}
