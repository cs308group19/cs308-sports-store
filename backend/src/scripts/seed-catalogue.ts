import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { seedCatalogue } from './catalogue-seed.js';

/**
 * Adds the demo categories and products (SCRUM-13). Safe to run repeatedly: rows that already
 * exist are left untouched.
 *
 *   npm run seed:catalogue
 */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to add demo products when NODE_ENV=production.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const result = await seedCatalogue(app.get(PrismaService));
    console.log(
      `categories created: ${result.categoriesCreated}, products created: ${result.productsCreated}, already there: ${result.skipped}`,
    );
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
