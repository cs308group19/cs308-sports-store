import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { UsersService } from '../users/users.service.js';
import { DEMO_ACCOUNTS } from './demo-accounts.js';

/**
 * Creates (or resets) one demo account per role. Safe to run repeatedly.
 *
 *   npm run seed:demo
 */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to create demo accounts with known passwords when NODE_ENV=production.',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const users = app.get(UsersService);
    for (const account of DEMO_ACCOUNTS) {
      const { created } = await users.upsertAccount(account);
      console.log(
        `${created ? 'created' : 'updated'}  ${account.role.padEnd(16)} ${account.email}`,
      );
    }
  } finally {
    await app.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
