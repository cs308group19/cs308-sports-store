# RALLY — Backend

NestJS API for the CS308 online store (Team 19). It verifies Supabase logins, enforces roles, and talks to the Supabase Postgres database through Prisma.

## What exists so far

- **Auth and users only.** `POST /api/auth/register`, `GET /api/auth/me`, `GET /api/health`, plus three placeholder endpoints under `/api/staff/*` that show how roles are enforced.
- **Invoices (SCRUM-25, SCRUM-26).** `GET /api/me/invoices/:id` returns the signed-in customer's invoice, built from the records saved at order time. `GET /api/me/invoices/:id/pdf` returns the same invoice as a PDF download. Another customer's invoice, or one that does not exist, answers `404`. After checkout commits, `InvoicesService.sendInvoiceEmail(invoiceId)` emails the PDF and records `email_status` (`sent` or `failed`) on the invoice; it never throws.
- **Checkout (SCRUM-22, SCRUM-23, SCRUM-24).** `POST /api/me/checkout` accepts `deliveryRecipient`, `deliveryAddress`, `cardholderName`, `cardNumber`, `expiry` (`MM/YY`) and `cvv` as strings, plus `reviewedCart: { items: [{ productId, quantity, lineTotalCents }], totalCents }` from the checkout summary. The server uses its own prices and checks that the reviewed cart still matches. A signed-in customer receives `201 { orderId, orderNumber, invoiceId }` on approval, `402` on a decline or `409` for an empty or changed cart or insufficient stock. The simulated bank only approves `4242 4242 4242 4242`. Use fictional card details.
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
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Optional. Where the invoice email goes. The default is a local [Mailpit](https://mailpit.axllent.org) (`localhost:1025`, no login, read the mail at http://localhost:8025). For [Ethereal](https://ethereal.email) put its test account here. Set `SMTP_USER` and `SMTP_PASS` together or not at all. Never commit a real password |

### One-time Supabase dashboard settings

1. Authentication → Sign In / Providers → turn **"Allow new users to sign up" off**. Registration must go through this API; otherwise anyone could create accounts straight against Supabase and skip the validation.
2. Authentication → Password: minimum length 8, required characters "lowercase, uppercase letters and digits".
3. Authentication → Hooks → **Custom Access Token** → choose `public.custom_access_token_hook`.
4. Project Settings → **JWT Keys**: the project must sign tokens with **JWT signing keys** (asymmetric, published as a JWKS), which new projects do by default. An older project that still uses the **legacy JWT secret** signs with HS256, and every login fails with 401 "Invalid or expired token" (the API logs a warning saying so). Migrate the project to signing keys, or, as a stopgap, put the legacy secret in `SUPABASE_JWT_SECRET`.

### Database

The schema is in `../supabase/migrations/`; SQL owns the tables, checks, grants and RLS. `prisma/schema.prisma` mirrors the public tables: update it by hand after a schema change, then run `npm run prisma:generate`. Never use Prisma Migrate or `db push` on this schema. See the [database guide](../supabase/README.md), including how to run the tests against a real PostgreSQL.

## Deliveries (product managers)

| Endpoint | What it does |
|---|---|
| `GET /api/staff/deliveries?status=` | Every delivery row with its order number and product name. `status` is optional: `processing`, `in_transit` or `delivered` (anything else is 400). Open deliveries come first: processing, then in transit, then delivered, oldest first in each. |
| `PATCH /api/staff/deliveries/:id` `{ "status": "in_transit" }` | Moves one delivery forward. Returns `{ delivery, order }` with the new order status. |

Only product managers can use them (customers, sales managers and support agents get 403, guests 401).

- A status only moves forward: `processing` → `in_transit` → `delivered`, skipping a step is allowed. Going back, repeating the current status, `cancelled`, or touching a cancelled order is **409**; an unknown id is **404**; an invalid status or id is **400**.
- `delivered` sets `is_completed` and `delivered_at`.
- In the same transaction the order gets the status of its least advanced delivery row. When its last row is delivered the order becomes `delivered` and `orders.delivered_at` is set.
- The order row is locked (`SELECT ... FOR UPDATE`) at the start of the update, so two managers working on the same order take turns: one delivery cannot move twice, and an order whose two items are delivered at the same moment still ends up `delivered`. The delivery update is also conditional on the status that was read.
- Checkout creates the rows: one delivery per order item, status `processing`.

## Demo accounts and roles

```bash
npm run seed:demo                                   # one demo account per role (safe to re-run)
npm run seed:catalogue                              # demo categories and products (adds missing rows only)
npm run user:set-role -- someone@example.com sales_manager
```

Roles: `customer`, `product_manager`, `sales_manager`, `support_agent`. `set-role` is the only way to create staff; there is no HTTP endpoint for it. `seed:demo` and `seed:catalogue` refuse to run when `NODE_ENV=production`. `seed:catalogue` never changes a product that already exists, so re-running it keeps stock and manager edits.

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
| `npm run test:database` | The backend against a real local PostgreSQL with every migration applied; needs an empty `rally_test_*` database in `RALLY_DATABASE_TEST_URL` (see [database guide](../supabase/README.md)) |
| `npm run lint` | oxlint |
| `npm run build` | Compiles to `dist/` |

## Folder structure

```
backend/
├── prisma/schema.prisma        Prisma model of public.profiles
├── prisma.config.ts
├── src/
│   ├── main.ts, app.module.ts, app.setup.ts
│   ├── config/env.ts           validates the environment at startup
│   ├── auth/                   JWT guard, roles guard, decorators, register/me endpoints
│   ├── users/                  create account, set role (Supabase admin API + Prisma)
│   ├── staff/                  placeholder role-protected endpoints
│   ├── invoices/               invoice endpoints, PDF (pdfkit) and email (nodemailer)
│   ├── deliveries/             product manager delivery list and status updates (SCRUM-34)
│   ├── common/crypto/          AES-256-GCM field encryption
│   ├── prisma/, supabase/      shared services
│   └── scripts/                seed:demo, seed:catalogue and user:set-role
└── test/                       e2e tests and test helpers
```
