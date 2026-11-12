import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { makeProfile } from '../../test/helpers/profile.js';
import { fakeConfig } from '../../test/helpers/test-env.js';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service.js';
import { UserRole } from '../auth/roles.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  const createUser = vi.fn();
  const deleteUser = vi.fn();
  const updateUserById = vi.fn();
  const profile = { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const encryption = new FieldEncryptionService(fakeConfig());
  let service: UsersService;

  const input = {
    email: 'Alex@Example.com',
    password: 'Rally1234',
    fullName: 'Alex Morgan',
    taxId: 'TR-308-58-991',
    homeAddress: '12 Main Street, Istanbul',
    role: UserRole.customer,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    deleteUser.mockResolvedValue({ error: null });
    service = new UsersService(
      { profile } as never,
      { auth: { createUser, deleteUser, updateUserById } } as never,
      encryption,
    );
  });

  describe('createAccount', () => {
    it('creates the auth user, then a profile with an encrypted tax ID', async () => {
      createUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      });
      profile.create.mockImplementation(async ({ data }) => makeProfile(data));

      const created = await service.createAccount(input);

      expect(createUser).toHaveBeenCalledWith({
        email: 'alex@example.com',
        password: 'Rally1234',
        email_confirm: true,
      });
      const data = profile.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        id: 'u1',
        email: 'alex@example.com',
        role: 'customer',
      });
      expect(data.taxIdEncrypted).toMatch(/^v1:/);
      expect(data.taxIdEncrypted).not.toContain('TR-308-58-991');
      expect(created.id).toBe('u1');
    });

    it('stores no tax ID or address for staff accounts that have none', async () => {
      createUser.mockResolvedValue({
        data: { user: { id: 'u2' } },
        error: null,
      });
      profile.create.mockImplementation(async ({ data }) => makeProfile(data));

      await service.createAccount({
        email: 'p@rally.store',
        password: 'Staff1234',
        fullName: 'P',
        role: UserRole.product_manager,
      });

      expect(profile.create.mock.calls[0][0].data).toMatchObject({
        taxIdEncrypted: null,
        homeAddress: null,
        role: 'product_manager',
      });
    });

    it('answers 409 when the email is already registered', async () => {
      createUser.mockResolvedValue({
        data: { user: null },
        error: { code: 'email_exists', message: 'x' },
      });
      await expect(service.createAccount(input)).rejects.toThrow(
        ConflictException,
      );
      expect(profile.create).not.toHaveBeenCalled();
    });

    it('answers 400 when Supabase rejects the password', async () => {
      createUser.mockResolvedValue({
        data: { user: null },
        error: { code: 'weak_password', message: 'x' },
      });
      await expect(service.createAccount(input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deletes the auth user again when the profile cannot be written', async () => {
      createUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      });
      profile.create.mockRejectedValue(new Error('db down'));

      await expect(service.createAccount(input)).rejects.toThrow('db down');
      expect(deleteUser).toHaveBeenCalledWith('u1');
    });

    it('answers 409 and rolls back when two registrations race for the same email', async () => {
      createUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      });
      profile.create.mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' }),
      );

      await expect(service.createAccount(input)).rejects.toThrow(
        ConflictException,
      );
      expect(deleteUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('upsertAccount', () => {
    it('creates the account when it does not exist', async () => {
      profile.findUnique.mockResolvedValue(null);
      createUser.mockResolvedValue({
        data: { user: { id: 'u1' } },
        error: null,
      });
      profile.create.mockImplementation(async ({ data }) => makeProfile(data));

      const result = await service.upsertAccount(input);
      expect(result.created).toBe(true);
    });

    it('resets password, details and role when the account exists', async () => {
      profile.findUnique.mockResolvedValue(makeProfile({ id: 'u1' }));
      updateUserById.mockResolvedValue({ error: null });
      profile.update.mockImplementation(async ({ data }) => makeProfile(data));

      const result = await service.upsertAccount({
        ...input,
        role: UserRole.sales_manager,
      });

      expect(result.created).toBe(false);
      expect(updateUserById).toHaveBeenCalledWith('u1', {
        password: 'Rally1234',
        email_confirm: true,
      });
      expect(profile.update.mock.calls[0][0].data.role).toBe('sales_manager');
      expect(createUser).not.toHaveBeenCalled();
    });
  });

  describe('setRole', () => {
    it('updates the role and reports the previous one', async () => {
      profile.findUnique.mockResolvedValue(
        makeProfile({ id: 'u1', role: 'customer' }),
      );
      profile.update.mockImplementation(async ({ data }) =>
        makeProfile({ id: 'u1', ...data }),
      );

      const result = await service.setRole(
        ' Jamie@Rally.store ',
        UserRole.support_agent,
      );

      expect(profile.findUnique).toHaveBeenCalledWith({
        where: { email: 'jamie@rally.store' },
      });
      expect(result.previousRole).toBe('customer');
      expect(result.profile.role).toBe('support_agent');
    });

    it('fails for an unknown email', async () => {
      profile.findUnique.mockResolvedValue(null);
      await expect(
        service.setRole('nobody@rally.store', UserRole.customer),
      ).rejects.toThrow(NotFoundException);
      expect(profile.update).not.toHaveBeenCalled();
    });
  });
});
