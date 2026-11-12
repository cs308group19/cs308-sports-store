import { ALL_ROLES, isUserRole, type UserRole } from '../auth/roles.js';

export class UsageError extends Error {}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parses `<email> <role>` for the user:set-role script. */
export function parseSetRoleArgs(args: string[]): {
  email: string;
  role: UserRole;
} {
  const usage = `Usage: npm run user:set-role -- <email> <${ALL_ROLES.join('|')}>`;
  if (args.length !== 2) {
    throw new UsageError(usage);
  }
  const email = args[0].trim().toLowerCase();
  const role = args[1].trim();
  if (!EMAIL_PATTERN.test(email)) {
    throw new UsageError(
      `"${args[0]}" is not a valid email address.\n${usage}`,
    );
  }
  if (!isUserRole(role)) {
    throw new UsageError(`"${args[1]}" is not a valid role.\n${usage}`);
  }
  return { email, role };
}
