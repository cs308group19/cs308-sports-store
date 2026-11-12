import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '../auth/dto/register.dto.js';
import { ALL_ROLES } from '../auth/roles.js';
import { DEMO_ACCOUNTS } from './demo-accounts.js';

describe('DEMO_ACCOUNTS', () => {
  it('has exactly one account for every role', () => {
    expect(DEMO_ACCOUNTS.map((account) => account.role).sort()).toEqual(
      [...ALL_ROLES].sort(),
    );
  });

  it('uses unique emails', () => {
    const emails = DEMO_ACCOUNTS.map((account) => account.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it.each(DEMO_ACCOUNTS.map((account) => [account.role, account] as const))(
    'gives the %s account a password that satisfies the password policy',
    async (_role, account) => {
      const dto = plainToInstance(RegisterDto, {
        fullName: account.fullName,
        taxId: 'TR-308-58-991',
        email: account.email,
        homeAddress: '12 Main Street',
        password: account.password,
      });
      expect(await validate(dto)).toEqual([]);
    },
  );

  it('gives the customer a tax ID and an address, as the project requires', () => {
    const customer = DEMO_ACCOUNTS.find(
      (account) => account.role === 'customer',
    );
    expect(customer?.taxId).toBeTruthy();
    expect(customer?.homeAddress).toBeTruthy();
  });
});
