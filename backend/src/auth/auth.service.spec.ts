import { Logger } from '@nestjs/common';
import { makeProfile } from '../../test/helpers/profile.js';
import { fakeConfig } from '../../test/helpers/test-env.js';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const encryption = new FieldEncryptionService(fakeConfig());
  const createAccount = vi.fn();
  const service = new AuthService({ createAccount } as never, encryption);

  beforeEach(() => createAccount.mockReset());

  it('always registers a customer', async () => {
    createAccount.mockResolvedValue(
      makeProfile({ id: 'u1', email: 'alex@example.com' }),
    );

    const result = await service.register({
      fullName: 'Alex',
      taxId: 'TR-308-58-991',
      email: 'alex@example.com',
      homeAddress: '12 Main Street',
      password: 'Rally1234',
    });

    expect(createAccount.mock.calls[0][0].role).toBe('customer');
    expect(result).toEqual({
      id: 'u1',
      email: 'alex@example.com',
      role: 'customer',
    });
  });

  it('never puts the password or the tax ID in the registration response', async () => {
    createAccount.mockResolvedValue(makeProfile());
    const result = await service.register({
      fullName: 'Alex',
      taxId: 'TR-308-58-991',
      email: 'alex@example.com',
      homeAddress: '12 Main Street',
      password: 'Rally1234',
    });
    expect(JSON.stringify(result)).not.toMatch(/Rally1234|TR-308/);
  });

  it('returns the decrypted tax ID for the signed-in user', () => {
    const user = makeProfile({
      taxIdEncrypted: encryption.encrypt('TR-308-58-991'),
    });
    expect(service.toMe(user)).toMatchObject({
      id: 'user-1',
      email: 'jamie@rally.store',
      fullName: 'Jamie Taylor',
      taxId: 'TR-308-58-991',
      role: 'customer',
    });
  });

  it('returns a null tax ID for staff without one', () => {
    expect(
      service.toMe(makeProfile({ role: 'sales_manager' })).taxId,
    ).toBeNull();
  });

  it('does not fail the request when the tax ID cannot be decrypted', () => {
    const logged = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    expect(
      service.toMe(makeProfile({ taxIdEncrypted: 'v1:broken:broken:broken' }))
        .taxId,
    ).toBeNull();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
