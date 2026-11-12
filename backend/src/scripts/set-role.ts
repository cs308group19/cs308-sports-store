import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { UsersService } from '../users/users.service.js';
import { parseSetRoleArgs, UsageError } from './cli.js';

/**
 * Gives an existing user a role. This is the only way to create staff: the HTTP API cannot change
 * roles, and public registration always creates a customer.
 *
 *   npm run user:set-role -- <email> <customer|product_manager|sales_manager|support_agent>
 */
async function main() {
  const { email, role } = parseSetRoleArgs(process.argv.slice(2));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const { profile, previousRole } = await app
      .get(UsersService)
      .setRole(email, role);
    console.log(`${profile.email}: ${previousRole} -> ${profile.role}`);
  } finally {
    await app.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = error instanceof UsageError ? 2 : 1;
}
