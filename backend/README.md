# RALLY — Backend

NestJS API for the CS308 online store (Team 19). It verifies Supabase logins, enforces roles, and talks to the Supabase Postgres database through Prisma.

## What exists so far

- **Auth and users only.** `POST /api/auth/register`, `GET /api/auth/me`, `GET /api/health`, plus three placeholder endpoints under `/api/staff/*` that show how roles are enforced.
- Login happens in the browser against Supabase Auth. The browser then sends the access token to this API as `Authorization: Bearer <token>`.

## How authentication works

1. **Register** (`POST /api/auth/register`): the body is validated (name, tax ID, email, address, password rules). The backend creates the Supabase auth user with the secret key, then writes the `profiles` row. If the profile cannot be written, the auth user is deleted again. Every new account is a **customer**. A request that contains a `role` field is rejected.
2. **Log in**: the browser calls Supabase `signInWithPassword` directly. Passwords never touch this API, and Supabase stores them hashed.
3. **Every other request**: `SupabaseJwtGuard` checks the token's signature against the project's public keys (JWKS), plus issuer, audience and expiry. It then loads the user's row from `profiles`. The **role is read from the database on every request**, so a role change applies immediately; the `user_role` claim inside the token is only a hint for the UI.
4. **Roles**: `@Roles(UserRole.sales_manager)` on a route lets only that role in (403 otherwise). Routes without it need any signed-in user. `@Public()` opens a route to guests (used by `/auth/register` and `/health`).
5. **Tax IDs** are encrypted with AES-256-GCM (`FIELD_ENCRYPTION_KEY`) before they are stored, and the database refuses a value that is not in the encrypted format.

## Setup

```bash
cd backend
npm install            # also generates the Prisma client
cp .env.example .env   # then fill it in (see below)
npm run start:dev      # http://localhost:3000/api
```

`.env` values:

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SECRET_KEY` | same page, the **secret** key (`sb_secret_…`). Backend only, never in the frontend |
| `DATABASE_URL` | Dashboard → Connect → **Session pooler** string (works over IPv4), with the database password filled in |
| `FIELD_ENCRYPTION_KEY` | `openssl rand -base64 32`. Share it with the team through a safe channel; if it is lost, stored tax IDs cannot be read |
| `TRUST_PROXY` | Optional. Leave empty locally. When the API runs behind a reverse proxy or load balancer, set the number of proxy hops (usually `1`); otherwise every client shares the proxy's IP and one rate limit. `true` is refused because it would let clients fake their IP |
| `SUPABASE_JWT_SECRET` | Optional, legacy only. See step 4 below |

### One-time Supabase dashboard settings

1. Authentication → Sign In / Providers → turn **"Allow new users to sign up" off**. Registration must go through this API; otherwise anyone could create accounts straight against Supabase and skip the validation.
2. Authentication → Password: minimum length 8, required characters "lowercase, uppercase letters and digits".
3. Authentication → Hooks → **Custom Access Token** → choose `public.custom_access_token_hook`.
4. Project Settings → **JWT Keys**: the project must sign tokens with **JWT signing keys** (asymmetric, published as a JWKS), which new projects do by default. An older project that still uses the **legacy JWT secret** signs with HS256, and every login fails with 401 "Invalid or expired token" (the API logs a warning saying so). Migrate the project to signing keys, or, as a stopgap, put the legacy secret in `SUPABASE_JWT_SECRET`.

### Database

The schema is in `../supabase/migrations/`. `prisma/schema.prisma` mirrors its public tables; SQL owns migrations, grants and RLS. Run `npm run prisma:generate` after pulling schema changes. See [database setup and integration contract](../supabase/README.md), including the existing cross-schema Auth foreign key and the separate real-database test. Do not use Prisma Migrate or `db push` on this schema.

## Demo accounts and roles

```bash
npm run seed:demo                                   # one demo account per role (safe to re-run)
npm run user:set-role -- someone@example.com sales_manager
```

Roles: `customer`, `product_manager`, `sales_manager`, `support_agent`. `set-role` is the only way to create staff; there is no HTTP endpoint for it. `seed:demo` refuses to run when `NODE_ENV=production`.

| Role | Email | Password |
|---|---|---|
| Customer | jamie@rally.store | Rally1234 |
| Product Manager | product@rally.store | Staff1234 |
| Sales Manager | sales@rally.store | Staff1234 |
| Support Agent | support@rally.store | Staff1234 |

## Commands

| Command | What it does |
|---|---|
| `npm run start:dev` | Runs the API with live reload |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests against a fake Supabase (no network, no database) |
| `npm run test:database` | Real PostgreSQL + Prisma + Nest auth boundary; requires an empty local `rally_test_*` database via `RALLY_DATABASE_TEST_URL` |
| `npm run lint` | oxlint |
| `npm run build` | Compiles to `dist/` |

## Folder structure

```
backend/
├── prisma/schema.prisma        Prisma models of profiles and store tables
├── prisma.config.ts
├── src/
│   ├── main.ts, app.module.ts, app.setup.ts
│   ├── config/env.ts           validates the environment at startup
│   ├── auth/                   JWT guard, roles guard, decorators, register/me endpoints
│   ├── users/                  create account, set role (Supabase admin API + Prisma)
│   ├── staff/                  placeholder role-protected endpoints
│   ├── common/crypto/          AES-256-GCM field encryption
│   ├── prisma/, supabase/      shared services
│   └── scripts/                seed:demo and user:set-role
└── test/                       e2e tests and test helpers
```
