import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto.js';

const valid = {
  fullName: 'Alex Morgan',
  taxId: 'TR-308-58-991',
  email: 'alex@example.com',
  homeAddress: '12 Main Street, Istanbul',
  password: 'Rally1234',
};

async function errorsFor(body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(RegisterDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property);
}

describe('RegisterDto', () => {
  it('accepts a valid registration', async () => {
    expect(await errorsFor(valid)).toEqual([]);
  });

  it.each(['fullName', 'taxId', 'email', 'homeAddress', 'password'])(
    'requires %s',
    async (field) => {
      const { [field]: _removed, ...rest } = valid as Record<string, unknown>;
      expect(await errorsFor(rest)).toContain(field);
    },
  );

  it('rejects a role in the body, so nobody can self-assign one', async () => {
    expect(await errorsFor({ ...valid, role: 'product_manager' })).toContain(
      'role',
    );
  });

  it('normalizes the email to trimmed lower case', () => {
    const dto = plainToInstance(RegisterDto, {
      ...valid,
      email: '  Alex@Example.COM ',
    });
    expect(dto.email).toBe('alex@example.com');
  });

  it('trims the text fields', () => {
    const dto = plainToInstance(RegisterDto, {
      ...valid,
      fullName: '  Alex  ',
      taxId: ' TR-308 ',
    });
    expect(dto.fullName).toBe('Alex');
    expect(dto.taxId).toBe('TR-308');
  });

  it.each([
    ['too short', 'Ab1'],
    ['no uppercase letter', 'rally1234'],
    ['no lowercase letter', 'RALLY1234'],
    ['no digit', 'RallyRally'],
    ['longer than 72 characters', `Aa1${'x'.repeat(70)}`],
    // 40 characters, but 77 UTF-8 bytes: bcrypt would cut it and Supabase rejects it.
    ['longer than 72 bytes', `Aa1${'ğ'.repeat(37)}`],
  ])('rejects a password that is %s', async (_label, password) => {
    expect(await errorsFor({ ...valid, password })).toContain('password');
  });

  it('accepts a password of exactly 72 bytes', async () => {
    expect(
      await errorsFor({ ...valid, password: `Aa1${'ğ'.repeat(34)}x` }),
    ).toEqual([]);
  });

  it('rejects an invalid email', async () => {
    expect(await errorsFor({ ...valid, email: 'not-an-email' })).toContain(
      'email',
    );
  });

  it('rejects a tax ID with unexpected characters', async () => {
    expect(await errorsFor({ ...valid, taxId: "1234'; DROP TABLE" })).toContain(
      'taxId',
    );
  });
});
