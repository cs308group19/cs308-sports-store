import { parseSetRoleArgs, UsageError } from './cli.js';

describe('parseSetRoleArgs', () => {
  it('parses an email and a role, normalizing the email', () => {
    expect(parseSetRoleArgs([' Sales@Rally.store ', 'sales_manager'])).toEqual({
      email: 'sales@rally.store',
      role: 'sales_manager',
    });
  });

  it.each(['customer', 'product_manager', 'sales_manager', 'support_agent'])(
    'accepts the role %s',
    (role) => {
      expect(parseSetRoleArgs(['a@b.co', role]).role).toBe(role);
    },
  );

  it('rejects a missing argument and lists the valid roles', () => {
    expect(() => parseSetRoleArgs(['a@b.co'])).toThrow(UsageError);
    expect(() => parseSetRoleArgs([])).toThrow(
      /customer\|product_manager\|sales_manager\|support_agent/,
    );
  });

  it('rejects extra arguments', () => {
    expect(() => parseSetRoleArgs(['a@b.co', 'customer', 'extra'])).toThrow(
      UsageError,
    );
  });

  it('rejects an unknown role', () => {
    expect(() => parseSetRoleArgs(['a@b.co', 'admin'])).toThrow(
      /not a valid role/,
    );
  });

  it('rejects something that is not an email', () => {
    expect(() => parseSetRoleArgs(['not-an-email', 'customer'])).toThrow(
      /valid email/,
    );
  });
});
