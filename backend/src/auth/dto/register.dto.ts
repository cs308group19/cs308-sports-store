import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
} from 'class-validator';

/** Limits the UTF-8 size of a string, which is what bcrypt counts (not characters). */
const MaxUtf8Bytes = (max: number, message: string) =>
  ValidateBy({
    name: 'maxUtf8Bytes',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= max,
      defaultMessage: () => message,
    },
  });

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * Customer registration. There is deliberately no role field: the ValidationPipe runs with
 * forbidNonWhitelisted, so a request that sends one is rejected, and every new account is a customer.
 */
export class RegisterDto {
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  fullName!: string;

  @Transform(trim)
  @IsString()
  @Length(5, 32)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, {
    message: 'taxId may only contain letters, digits, spaces and hyphens',
  })
  taxId!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsString()
  @Length(5, 500)
  homeAddress!: string;

  // bcrypt (used by Supabase Auth) only reads 72 bytes, so the upper limit is in UTF-8 bytes:
  // a letter such as "ğ" takes two. Supabase rejects longer passwords.
  @IsString()
  @MinLength(8)
  @MaxUtf8Bytes(
    72,
    'password must be at most 72 bytes (letters such as ğ or ş count as two)',
  )
  @Matches(/[a-z]/, { message: 'password must contain a lowercase letter' })
  @Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' })
  @Matches(/[0-9]/, { message: 'password must contain a digit' })
  password!: string;
}
