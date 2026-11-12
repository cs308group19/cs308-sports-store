import { Inject, Injectable, Logger } from '@nestjs/common';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service.js';
import { UsersService } from '../users/users.service.js';
import type { AuthUser } from './auth.types.js';
import type { RegisterDto } from './dto/register.dto.js';
import { UserRole } from './roles.js';

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  taxId: string | null;
  homeAddress: string | null;
  role: UserRole;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(FieldEncryptionService)
    private readonly encryption: FieldEncryptionService,
  ) {}

  /** Public registration always creates a customer; other roles are assigned with the CLI. */
  async register(
    dto: RegisterDto,
  ): Promise<{ id: string; email: string; role: UserRole }> {
    const profile = await this.users.createAccount({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      taxId: dto.taxId,
      homeAddress: dto.homeAddress,
      role: UserRole.customer,
    });
    return { id: profile.id, email: profile.email, role: profile.role };
  }

  toMe(user: AuthUser): MeResponse {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      taxId: this.decryptTaxId(user),
      homeAddress: user.homeAddress,
      role: user.role,
    };
  }

  private decryptTaxId(user: AuthUser): string | null {
    if (!user.taxIdEncrypted) return null;
    try {
      return this.encryption.decrypt(user.taxIdEncrypted);
    } catch {
      // A wrong key must not lock everybody out of the app; it is logged loudly instead.
      this.logger.error(
        `Could not decrypt the tax ID of user ${user.id}. Is FIELD_ENCRYPTION_KEY correct?`,
      );
      return null;
    }
  }
}
