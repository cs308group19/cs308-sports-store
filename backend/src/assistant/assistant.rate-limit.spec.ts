import type { ExecutionContext } from '@nestjs/common';
import {
  AssistantRateLimitGuard,
  CHAT_LIMIT,
  CHAT_WINDOW_MS,
} from './assistant.rate-limit.js';

/** SCRUM-113. 20 chat messages a minute per signed-in user, or per IP address for guests. */
describe('AssistantRateLimitGuard', () => {
  let guard: AssistantRateLimitGuard;

  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
    guard = new AssistantRateLimitGuard();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const from = (ip: string, userId?: string) =>
    guard.canActivate({
      switchToHttp: () => ({
        getRequest: () => ({
          ip,
          user: userId ? { id: userId } : undefined,
        }),
      }),
    } as unknown as ExecutionContext);
  const use = (times: number, ip: string, userId?: string) => {
    for (let i = 0; i < times; i++) expect(from(ip, userId)).toBe(true);
  };

  it(`answers 429 after ${CHAT_LIMIT} requests in a minute`, () => {
    expect(CHAT_LIMIT).toBe(20);
    use(CHAT_LIMIT, '1.1.1.1');
    expect(() => from('1.1.1.1')).toThrow(
      expect.objectContaining({ status: 429 }),
    );
  });

  it('counts each guest address on its own', () => {
    use(CHAT_LIMIT, '1.1.1.1');
    use(CHAT_LIMIT, '2.2.2.2');
  });

  it('counts a signed-in user across addresses, apart from guests', () => {
    use(10, '1.1.1.1', 'jamie');
    use(10, '2.2.2.2', 'jamie');
    expect(() => from('3.3.3.3', 'jamie')).toThrow();
    // Others on the same network are not blocked.
    use(1, '1.1.1.1');
    use(1, '1.1.1.1', 'alex');
  });

  it('lets requests through again as the minute passes', () => {
    use(10, '1.1.1.1');
    vi.advanceTimersByTime(CHAT_WINDOW_MS / 2);
    use(10, '1.1.1.1');
    expect(() => from('1.1.1.1')).toThrow();
    // A refused request does not count against the caller.
    vi.advanceTimersByTime(CHAT_WINDOW_MS / 2);
    use(10, '1.1.1.1');
    expect(() => from('1.1.1.1')).toThrow();
  });

  it('forgets callers who have been quiet for a minute', () => {
    use(1, '1.1.1.1');
    use(1, '2.2.2.2');
    vi.advanceTimersByTime(CHAT_WINDOW_MS);
    use(1, '3.3.3.3');
    expect([...guard['hits'].keys()]).toEqual(['ip:3.3.3.3']);
  });
});
