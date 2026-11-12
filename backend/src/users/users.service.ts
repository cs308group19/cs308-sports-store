import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service.js';
import type { Profile } from '../generated/prisma/client.js';
import type { UserRole } from '../auth/roles.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupabaseAdminService } from '../supabase/supabase-admin.service.js';

export interface CreateAccountInput {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  taxId?: string;
  homeAddress?: string;
}

const EMAIL_TAKEN_CODES = new Set(['email_exists', 'user_already_exists']);

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SupabaseAdminService)
    private readonly supabase: SupabaseAdminService,
    @Inject(FieldEncryptionService)
    private readonly encryption: FieldEncryptionService,
  ) {}

  /**
   * Creates the Supabase auth user and its profile. If the profile cannot be written the auth user
   * is removed again, so a failed registration never leaves a half-created account behind.
   */
  async createAccount(input: CreateAccountInput): Promise<Profile> {
    const email = input.email.trim().toLowerCase();

    const { data, error } = await this.supabase.auth.createUser({
      email,
      password: input.password,
      email_confirm: true,
    });
    if (error || !data.user) {
      if (error?.code && EMAIL_TAKEN_CODES.has(error.code)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      if (error?.code === 'weak_password') {
        throw new BadRequestException(
          'Password does not meet the password policy',
        );
      }
      this.logger.error(
        `Supabase createUser failed: ${error?.code ?? 'unknown'} ${error?.message ?? ''}`,
      );
      throw new InternalServerErrorException('Could not create the account');
    }

    const userId = data.user.id;
    try {
      return await this.prisma.profile.create({
        data: {
          id: userId,
          email,
          fullName: input.fullName,
          taxIdEncrypted: input.taxId
            ? this.encryption.encrypt(input.taxId)
            : null,
          homeAddress: input.homeAddress ?? null,
          role: input.role,
        },
      });
    } catch (profileError) {
      const { error: deleteError } =
        await this.supabase.auth.deleteUser(userId);
      if (deleteError) {
        this.logger.error(
          `Could not roll back auth user ${userId}: ${deleteError.message}`,
        );
      }
      if (this.isUniqueViolation(profileError)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw profileError;
    }
  }

  /** Used by the demo seed: creates the account, or resets password, details and role if it exists. */
  async upsertAccount(
    input: CreateAccountInput,
  ): Promise<{ profile: Profile; created: boolean }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.profile.findUnique({ where: { email } });
    if (!existing) {
      return { profile: await this.createAccount(input), created: true };
    }

    const { error } = await this.supabase.auth.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
    });
    if (error) {
      throw new InternalServerErrorException(
        `Could not update the auth user for ${email}: ${error.message}`,
      );
    }
    const profile = await this.prisma.profile.update({
      where: { id: existing.id },
      data: {
        fullName: input.fullName,
        taxIdEncrypted: input.taxId
          ? this.encryption.encrypt(input.taxId)
          : null,
        homeAddress: input.homeAddress ?? null,
        role: input.role,
      },
    });
    return { profile, created: false };
  }

  /** The only way to give someone a non-customer role. Called from the user:set-role script. */
  async setRole(
    email: string,
    role: UserRole,
  ): Promise<{ profile: Profile; previousRole: UserRole }> {
    const normalized = email.trim().toLowerCase();
    const existing = await this.prisma.profile.findUnique({
      where: { email: normalized },
    });
    if (!existing) {
      throw new NotFoundException(`No user with email ${normalized}`);
    }
    const profile = await this.prisma.profile.update({
      where: { id: existing.id },
      data: { role },
    });
    return { profile, previousRole: existing.role };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
