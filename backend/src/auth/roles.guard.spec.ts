import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { makeProfile } from '../../test/helpers/profile.js';
import { Roles } from './decorators.js';
import { RolesGuard } from './roles.guard.js';
import { UserRole } from './roles.js';

class Dummy {
  @Roles(UserRole.product_manager)
  productOnly() {}

  @Roles(UserRole.sales_manager, UserRole.support_agent)
  salesOrSupport() {}

  anyone() {}
}

const handlerOf = (name: keyof Dummy) =>
  Reflect.get(Dummy.prototype, name) as () => void;

const contextFor = (user: unknown, handler: () => void): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => Dummy,
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows routes without @Roles for any signed-in user', () => {
    expect(
      guard.canActivate(contextFor(makeProfile(), handlerOf('anyone'))),
    ).toBe(true);
  });

  it('allows a user whose role is listed', () => {
    const user = makeProfile({ role: 'product_manager' });
    expect(guard.canActivate(contextFor(user, handlerOf('productOnly')))).toBe(
      true,
    );
  });

  it('allows any one of several listed roles', () => {
    const user = makeProfile({ role: 'support_agent' });
    expect(
      guard.canActivate(contextFor(user, handlerOf('salesOrSupport'))),
    ).toBe(true);
  });

  it.each(['customer', 'sales_manager', 'support_agent'] as const)(
    'keeps the product manager area closed to %s',
    (role) => {
      expect(() =>
        guard.canActivate(
          contextFor(makeProfile({ role }), handlerOf('productOnly')),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it('rejects a role-restricted route when nobody is signed in', () => {
    expect(() =>
      guard.canActivate(contextFor(undefined, handlerOf('productOnly'))),
    ).toThrow(ForbiddenException);
  });
});
