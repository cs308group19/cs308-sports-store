# RALLY database — SCRUM-12

The SQL files in `migrations/` are the source of truth for the database. The store
builds on the existing `public.profiles` UUIDs and Supabase Auth; there is no second
user or password table. The NestJS backend connects through Prisma as the database
owner, and the browser never talks to the database directly.

```mermaid
erDiagram
    AUTH_USERS ||--o| PROFILES : identifies
    PROFILES |o--o| CARTS : owns
    PROFILES ||--o{ ORDERS : places
    PROFILES ||--o{ REVIEWS : writes
    CATEGORIES ||--o{ PRODUCTS : groups
    CARTS ||--o{ CART_ITEMS : contains
    PRODUCTS ||--o{ CART_ITEMS : selected
    ORDERS ||--o{ ORDER_ITEMS : contains
    PRODUCTS ||--o{ ORDER_ITEMS : purchased
    ORDERS ||--o{ PAYMENTS : "paid by"
    ORDERS ||--o| INVOICES : produces
    ORDERS ||--o| DELIVERIES : ships
```

A guest cart has no profile; it is found by the random `guest_token` the browser
keeps. At login the backend moves it into the customer's cart (`/api/me/cart/merge`).

## Migrations, in order

| File | What it adds |
|---|---|
| `20261112150612_auth_profiles.sql` | `profiles`, roles, the access token hook |
| `20261112150641_auth_hook_search_path.sql` | Pins the hook's `search_path` |
| `20261117221000_store_domain_schema.sql` | Every store table: catalogue, carts, wishlist, orders, payments, invoices, deliveries, reviews, returns, refunds, notifications, support chat |
| `20261122160038_product_search_indexes.sql` | `pg_trgm` in the `extensions` schema and trigram indexes on product name and description, used by the shop search (`ILIKE '%word%'`) |
| `20261122160059_store_number_and_sequence_guards.sql` | Rejects `NaN` in every money column and takes sequence access away from `anon` and `authenticated` |
| `20261123210122_checkout_delivery_fee.sql` | Adds `delivery_fee` to `orders` and `invoices` with non-negative and non-`NaN` checks |
| `20261126194500_reset_popularity_to_sales.sql` | Recomputes `products.popularity` from non-cancelled `order_items` sales so previously seeded products drop the old hand-written values |
| `20261126200000_real_brand_catalogue.sql` | Renames the 12 existing demo products to real brand products (name, model, description, price and discount only) |

Apply pending files in this order with the team's Supabase migration workflow
(`supabase db push`), or run them one by one in the dashboard's SQL editor. Do not
rerun a file that is already applied. The files expect Supabase's `auth.users`,
`anon`, `authenticated` and `supabase_auth_admin` to exist.

The last two files carry over the useful parts of the earlier store-table proposal
(closed PR #3), whose own store migration overlapped with the schema above.

All five files are applied to the team's hosted project (checked on 22 November
2026 in its migration history), and their versions match the file names. The
hosted project already gave the browser roles no sequence access, so there the
`revoke` in the last file changes nothing; it matters for a fresh database.

When a migration is applied outside the CLI (dashboard, MCP), the history records
the time it ran, not the file's timestamp. Rename the file to the recorded version
so that `supabase db push` does not try to run it a second time.

## Identity and access

- `auth.users.id` → `profiles.id` → `carts.user_id`, `orders.user_id` and the other
  owner columns are UUIDs. Roles and the encrypted tax ID stay in `profiles`.
- Every table in `public` has row level security on and no policy for the browser
  roles. All table privileges and, since the guard migration, all sequence
  privileges are revoked from `anon`, `authenticated` and `PUBLIC`.
- The frontend must call the NestJS API, never `supabase.from(...)`. The database
  owner bypasses RLS, so the backend checks ownership and staff roles on every
  request.
- An order keeps snapshots of the product name and prices it was bought at. A
  product that appears in an order cannot be deleted, and neither can its customer
  (also not through a cascade from `auth.users`): mark products inactive instead.
- No card numbers or passwords are stored in store tables.

## Prisma

`backend/prisma/schema.prisma` mirrors the public tables. Run
`npm run prisma:generate` in `backend` after pulling a schema change. Never run
`prisma db push` or Prisma Migrate: they know nothing about the RLS, grants, checks
and extension placement in these files. Update the Prisma models by hand to match a
new migration.

## Testing against a real PostgreSQL

`npm test` and `npm run test:e2e` use test doubles and never touch a database.
`npm run test:database` runs the backend against a real PostgreSQL with every
migration applied. It covers:

- registration and `/me` through the real `profiles` row and the token hook;
- the shop search (including `%` matching only itself) and the sort by the price
  after discount;
- the guest cart and its row lock under two simultaneous adds, and the merge into
  the customer cart at login;
- the checks on products, carts and orders, including `NaN` amounts;
- that an order protects its product and customer from deletion;
- that `anon` and `authenticated` can neither use any table nor any sequence, and
  that RLS stays default-deny even for a role granted `SELECT`;
- that `pg_trgm` ends up in `extensions` and the trigram indexes serve `ILIKE`.

Supabase's hosted Auth API and JWKS are test doubles; `auth.users` is a minimal
local stand-in.

The test needs an **empty, local, disposable** database whose name starts with
`rally_test_` and a superuser connection (it creates roles and schemas). Supabase's
own Postgres image is the closest match to the hosted database:

```sh
docker run -d --name rally-test-db -e POSTGRES_PASSWORD=rally_test_only \
  -p 127.0.0.1:55432:5432 public.ecr.aws/supabase/postgres:17.11.0.004
docker exec rally-test-db psql -U supabase_admin -h 127.0.0.1 -d postgres \
  -c "create database rally_test_main"

cd backend
RALLY_DATABASE_TEST_URL=postgresql://supabase_admin:rally_test_only@127.0.0.1:55432/rally_test_main \
  npm run test:database

docker rm -f rally-test-db
```

Before it connects, the test refuses remote hosts, URL query parameters (which could
redirect the connection), other database names and databases that already contain
tables. It never resets or deletes a database, so use a new empty one for each run
(drop and create `rally_test_main` again). The connection-target checks also run on
their own, without any database: `node --test test/database-target.test.mjs`.

Verified on 22 November 2026 with PostgreSQL 17.11 (Supabase image) and Node.js 24:
4 connection-target checks and 10 database tests passed. Without the guard
migration, the `NaN` and sequence tests fail as expected.
