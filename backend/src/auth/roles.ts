import { UserRole } from '../generated/prisma/enums.js';

export { UserRole };

export const ALL_ROLES: readonly UserRole[] = Object.values(UserRole);

export function isUserRole(value: string): value is UserRole {
  return (ALL_ROLES as readonly string[]).includes(value);
}
