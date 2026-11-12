import { randomBytes } from 'node:crypto';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Fake configuration so the app boots without a real .env or Supabase project.
    env: {
      PORT: '3000',
      CORS_ORIGIN: 'http://localhost:5173',
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/postgres',
      FIELD_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    },
  },
});
