import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads .env on its own.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file (CI, or `prisma generate` before setup): fall back to the real environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Same connection string the app uses; needed by `prisma db pull` only.
    url: process.env.DATABASE_URL ?? '',
  },
});
