// SCRUM-12. The backend against a real PostgreSQL with every migration applied:
// Prisma, the raw SQL in the cart store, the constraints and the access rules.
// Supabase's hosted Auth and JWKS are test doubles; nothing leaves the machine.
//
// Run with `npm run test:database` (see ../../supabase/README.md). The target must be
// an EMPTY local database whose name starts with rally_test_.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';
import { validateDatabaseTestTarget } from './database-target.mjs';

const connectionString = validateDatabaseTestTarget(
  process.env.RALLY_DATABASE_TEST_URL,
);
const db = new Client({ connectionString });
const migrationDir = new URL('../../supabase/migrations/', import.meta.url);
const SEARCH_MIGRATION = '20261122160038_product_search_indexes.sql';
const GUEST = randomUUID();

let app, prisma, privateKey, customer, category;
/** Product ids by name, filled by the catalogue test. */
const ids = {};

const server = () => request(app.getHttpServer());
const sql = (text, values) => db.query(text, values);
const one = async (text, values) => (await sql(text, values)).rows[0];

async function tokenFor(userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: 'database-test' })
    .setSubject(userId)
    .setIssuer('https://test-project.supabase.co/auth/v1')
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

async function insertProduct(fields) {
  const row = {
    stock_quantity: 10,
    discount_rate: '0',
    popularity: 0,
    ...fields,
  };
  const { id } = await one(
    `INSERT INTO public.products
       (sku, name, model, serial_number, description, category_id,
        stock_quantity, price, discount_rate, popularity, distributor)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Test distributor')
     RETURNING id`,
    [
      `SKU-${row.name}`,
      row.name,
      `MODEL-${row.name}`,
      `SN-${row.name}`,
      row.description,
      category,
      row.stock_quantity,
      row.price,
      row.discount_rate,
      row.popularity,
    ],
  );
  ids[row.name] = id;
  return id;
}

before(async () => {
  await db.connect();
  const existing = await sql(
    "SELECT 1 FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')",
  );
  assert.equal(
    existing.rowCount,
    0,
    'Refusing to alter a database containing tables. Create a new empty test database.',
  );
  for (const role of [
    'anon',
    'authenticated',
    'supabase_auth_admin',
    'rally_test_reader',
  ]) {
    const found = await sql('SELECT 1 FROM pg_roles WHERE rolname = $1', [
      role,
    ]);
    if (!found.rowCount) await sql(`CREATE ROLE ${role} NOLOGIN`);
  }
  // The parts of a Supabase project the migrations rely on, including its default
  // grants to the browser roles, which the migrations must take away again.
  await sql(`CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    GRANT USAGE ON SCHEMA public TO anon, authenticated, supabase_auth_admin, rally_test_reader;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;`);
  for (const file of (await readdir(migrationDir))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await sql(await readFile(new URL(file, migrationDir), 'utf8'));
  }

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: connectionString,
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
    FIELD_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    CORS_ORIGIN: 'http://localhost:5173',
  });
  const [
    { Test },
    { AppModule },
    { configureApp },
    { JWKS },
    { PrismaService },
    { SupabaseAdminService },
  ] = await Promise.all([
    import('@nestjs/testing'),
    import('../dist/app.module.js'),
    import('../dist/app.setup.js'),
    import('../dist/auth/jwks.js'),
    import('../dist/prisma/prisma.service.js'),
    import('../dist/supabase/supabase-admin.service.js'),
  ]);
  const keys = await generateKeyPair('ES256');
  privateKey = keys.privateKey;
  const jwk = {
    ...(await exportJWK(keys.publicKey)),
    kid: 'database-test',
    alg: 'ES256',
  };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JWKS)
    .useValue(createLocalJWKSet({ keys: [jwk] }))
    .overrideProvider(SupabaseAdminService)
    .useValue({
      auth: {
        async createUser() {
          const id = randomUUID();
          await sql('INSERT INTO auth.users (id) VALUES ($1)', [id]);
          return { data: { user: { id } }, error: null };
        },
        async deleteUser(id) {
          await sql('DELETE FROM auth.users WHERE id = $1', [id]);
          return { error: null };
        },
      },
    })
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  prisma = app.get(PrismaService);
});

after(async () => {
  if (app) await app.close();
  await db.end();
});

void test('registration and a signed JWT reach /me through the real UUID profile', async () => {
  const created = await server()
    .post('/api/auth/register')
    .send({
      fullName: 'Database Test',
      taxId: 'TEST-ONLY-308',
      email: 'db-test@example.invalid',
      homeAddress: 'Test address 308',
      password: 'TestPassword308',
    })
    .expect(201);
  customer = created.body;
  assert.match(customer.id, /^[0-9a-f-]{36}$/);

  const me = await server()
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${await tokenFor(customer.id)}`)
    .expect(200);
  assert.equal(me.body.id, customer.id);
  assert.equal(me.body.role, 'customer');
  assert.equal(me.body.taxId, 'TEST-ONLY-308');

  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: customer.id },
  });
  assert.match(profile.taxIdEncrypted, /^v1:/);
  assert.ok(!profile.taxIdEncrypted.includes('TEST-ONLY-308'));

  await sql('SET ROLE supabase_auth_admin');
  try {
    const hook = await one(
      'SELECT public.custom_access_token_hook($1::jsonb) AS event',
      [JSON.stringify({ user_id: customer.id, claims: {} })],
    );
    assert.equal(hook.event.claims.user_role, 'customer');
  } finally {
    await sql('RESET ROLE');
  }
});

void test('the catalogue searches names and descriptions and sorts by the price paid', async () => {
  ({ id: category } = await one(
    "INSERT INTO public.categories (name, slug) VALUES ('Running', 'running') RETURNING id",
  ));
  await insertProduct({
    name: 'Trail Runner',
    description: 'Grippy shoe for muddy paths',
    price: '120.00',
    discount_rate: '50',
    popularity: 90,
  });
  await insertProduct({
    name: 'Road Racer',
    description: 'Light running SHOE',
    price: '80.00',
    popularity: 70,
  });
  await insertProduct({
    name: '100% Wool Socks',
    description: 'Warm socks',
    price: '15.00',
    popularity: 50,
  });
  await insertProduct({
    name: 'Sold Out Cap',
    description: 'Cap',
    price: '20.00',
    stock_quantity: 0,
    popularity: 10,
  });

  const names = (res) => res.body.map((p) => p.name);
  const shoes = await server().get('/api/products?q=SHOE').expect(200);
  assert.deepEqual(names(shoes), ['Trail Runner', 'Road Racer']);
  const words = await server().get('/api/products?q=muddy%20trail').expect(200);
  assert.deepEqual(names(words), ['Trail Runner']);
  // % must match only itself; unescaped it matched every product.
  const percent = await server().get('/api/products?q=%25').expect(200);
  assert.deepEqual(names(percent), ['100% Wool Socks']);

  // 120.00 with 50% off is 60.00, below the 80.00 road shoe.
  const cheap = await server()
    .get('/api/products?category=running&sort=price-asc')
    .expect(200);
  assert.deepEqual(names(cheap), [
    '100% Wool Socks',
    'Sold Out Cap',
    'Trail Runner',
    'Road Racer',
  ]);
  assert.equal(cheap.body[2].price, 60);
  const outOfStock = cheap.body.find((p) => p.name === 'Sold Out Cap');
  assert.equal(outOfStock.inStock, false);
});

void test('the guest cart is stored and locked in PostgreSQL', async () => {
  const cart = (path = '') => `/api/cart${path}`;
  const add = (body) =>
    server().post(cart('/items')).set('X-Cart-Token', GUEST).send(body);

  await add({ productId: String(ids['Road Racer']), quantity: 2 }).expect(201);
  // Two adds at once: the row lock makes the second wait and see the first.
  await Promise.all([
    add({ productId: String(ids['Trail Runner']) }).expect(201),
    add({ productId: String(ids['Trail Runner']) }).expect(201),
  ]);
  const view = await server()
    .get(cart())
    .set('X-Cart-Token', GUEST)
    .expect(200);
  assert.deepEqual(
    view.body.items.map((i) => [i.name, i.quantity, i.price, i.lineTotal]),
    [
      ['Road Racer', 2, 80, 160],
      ['Trail Runner', 2, 60, 120],
    ],
  );
  assert.equal(view.body.total, 280);

  const tooMany = await add({
    productId: String(ids['Road Racer']),
    quantity: 9,
  });
  assert.equal(tooMany.status, 400);
  assert.equal(tooMany.body.message, 'Only 10 left in stock.');
  const soldOut = await add({ productId: String(ids['Sold Out Cap']) });
  assert.equal(soldOut.body.message, 'This product is out of stock.');

  await server()
    .patch(cart(`/items/${ids['Road Racer']}`))
    .set('X-Cart-Token', GUEST)
    .send({ quantity: 3 })
    .expect(200);
  const rows = await sql(
    `SELECT p.name, i.quantity FROM public.cart_items i
       JOIN public.carts c ON c.id = i.cart_id
       JOIN public.products p ON p.id = i.product_id
      WHERE c.guest_token = $1 ORDER BY i.id`,
    [GUEST],
  );
  assert.deepEqual(rows.rows, [
    { name: 'Road Racer', quantity: 3 },
    { name: 'Trail Runner', quantity: 2 },
  ]);
});

void test('logging in moves the guest cart into the customer cart', async () => {
  const auth = `Bearer ${await tokenFor(customer.id)}`;
  await server()
    .post('/api/me/cart/items')
    .set('Authorization', auth)
    .send({ productId: String(ids['Road Racer']), quantity: 8 })
    .expect(201);

  const merged = await server()
    .post('/api/me/cart/merge')
    .set('Authorization', auth)
    .set('X-Cart-Token', GUEST)
    .expect(200);
  // 8 + 3 Road Racers are capped at the stock of 10.
  assert.deepEqual(
    merged.body.items.map((i) => [i.name, i.quantity]),
    [
      ['Road Racer', 10],
      ['Trail Runner', 2],
    ],
  );
  const guest = await server().get('/api/cart').set('X-Cart-Token', GUEST);
  assert.deepEqual(guest.body, { items: [], total: 0 });
  const owner = await one(
    'SELECT user_id FROM public.carts WHERE user_id = $1',
    [customer.id],
  );
  assert.equal(owner.user_id, customer.id);
});

void test('constraints reject impossible products and cart rows', async () => {
  const product = ids['Road Racer'];
  for (const change of [
    'stock_quantity = -1',
    'price = -1',
    "price = 'NaN'",
    'cost = -1',
    "cost = 'NaN'",
    'discount_rate = 101',
    "discount_rate = 'NaN'",
  ]) {
    await assert.rejects(
      sql(`UPDATE public.products SET ${change} WHERE id = $1`, [product]),
      { code: '23514' },
      change,
    );
  }
  await assert.rejects(sql('INSERT INTO public.carts DEFAULT VALUES'), {
    code: '23514',
  });
  await assert.rejects(
    sql('INSERT INTO public.carts (user_id) VALUES ($1)', [randomUUID()]),
    { code: '23503' },
  );
  await assert.rejects(
    sql('INSERT INTO public.carts (user_id) VALUES ($1)', [customer.id]),
    { code: '23505' },
  );
  await assert.rejects(sql('UPDATE public.cart_items SET quantity = 0'), {
    code: '23514',
  });
});

void test('an order keeps its product and customer from being deleted', async () => {
  const { id: order } = await one(
    `INSERT INTO public.orders
       (order_number, user_id, subtotal, total_amount, delivery_recipient, delivery_address)
     VALUES ('TEST-308', $1, 80, 80, 'Database Test', 'Test address 308')
     RETURNING id`,
    [customer.id],
  );
  await sql(
    `INSERT INTO public.order_items
       (order_id, product_id, product_name, quantity, unit_list_price, unit_price_paid, line_total)
     VALUES ($1, $2, 'Road Racer', 1, 80, 80, 80)`,
    [order, ids['Road Racer']],
  );
  await assert.rejects(
    sql("UPDATE public.orders SET total_amount = 'NaN' WHERE id = $1", [order]),
    { code: '23514' },
  );
  await assert.rejects(
    sql('DELETE FROM public.products WHERE id = $1', [ids['Road Racer']]),
    { code: '23503' },
  );
  await assert.rejects(
    sql('DELETE FROM auth.users WHERE id = $1', [customer.id]),
    { code: '23503' },
  );
});

for (const role of ['anon', 'authenticated']) {
  void test(`${role} cannot read or change any table or use any sequence`, async () => {
    const tables = (
      await sql(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1",
      )
    ).rows.map((r) => r.tablename);
    const sequences = (
      await sql(
        "SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' ORDER BY 1",
      )
    ).rows.map((r) => r.sequencename);
    assert.ok(tables.length >= 23, 'every store table is checked');
    assert.ok(sequences.length > 0, 'identity sequences are checked');

    await sql(`SET ROLE ${role}`);
    try {
      for (const table of tables) {
        for (const statement of [
          `SELECT * FROM public.${table}`,
          `INSERT INTO public.${table} DEFAULT VALUES`,
          `DELETE FROM public.${table} WHERE false`,
        ]) {
          await assert.rejects(
            sql(statement),
            { code: '42501' },
            `${role}: ${statement}`,
          );
        }
      }
      for (const sequence of sequences) {
        await assert.rejects(
          sql(`SELECT nextval('public.${sequence}')`),
          { code: '42501' },
          `${role}: nextval(${sequence})`,
        );
      }
    } finally {
      await sql('RESET ROLE');
    }
  });
}

void test('row level security stays default-deny even for a role that is granted SELECT', async () => {
  const tables = (
    await sql(
      "SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'",
    )
  ).rows;
  assert.ok(
    tables.every((t) => t.relrowsecurity),
    'RLS is on everywhere',
  );

  await sql('BEGIN');
  try {
    for (const { relname } of tables) {
      await sql(`GRANT SELECT ON public.${relname} TO rally_test_reader`);
    }
    await sql('SET LOCAL ROLE rally_test_reader');
    for (const { relname } of tables) {
      assert.equal(
        (await sql(`SELECT * FROM public.${relname}`)).rowCount,
        0,
        relname,
      );
    }
  } finally {
    await sql('ROLLBACK');
  }
});

void test('search indexes live with pg_trgm in extensions and serve ILIKE', async () => {
  const query =
    "SELECT id FROM public.products WHERE is_active AND (name ILIKE '%racer%' OR description ILIKE '%socks%') ORDER BY id";
  const expected = (await sql(query)).rows;
  assert.equal(expected.length, 2);

  // The migration moves an earlier pg_trgm out of public and can run twice.
  await sql('ALTER EXTENSION pg_trgm SET SCHEMA public');
  const migration = await readFile(
    new URL(SEARCH_MIGRATION, migrationDir),
    'utf8',
  );
  await sql(migration);
  await sql(migration);
  assert.deepEqual((await sql(query)).rows, expected);
  const location = await one(
    "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm'",
  );
  assert.equal(location.nspname, 'extensions');

  // Only the ILIKE part: with is_active in the query the planner may pick the
  // (is_active, popularity) index instead, which says nothing about the trigram ones.
  const ilike =
    "SELECT id FROM public.products WHERE name ILIKE '%racer%' OR description ILIKE '%socks%'";
  await sql('BEGIN');
  try {
    await sql('SET LOCAL enable_seqscan = off');
    await sql('SET LOCAL enable_indexscan = off');
    const plan = JSON.stringify(
      (await sql(`EXPLAIN (FORMAT JSON) ${ilike}`)).rows,
    );
    assert.match(plan, /products_name_trgm_idx/);
    assert.match(plan, /products_description_trgm_idx/);
  } finally {
    await sql('ROLLBACK');
  }
});

// SCRUM-34. Delivery list and status changes on the real tables. Checkout is not merged yet, so
// the order, its items and one delivery row per item are inserted here as the order contract
// describes them.
async function insertStaff(role, email) {
  const id = randomUUID();
  await sql('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  await sql(
    `INSERT INTO public.profiles (id, email, full_name, role)
     VALUES ($1, $2, $3, $4)`,
    [id, email, `Test ${role}`, role],
  );
  return id;
}

async function insertOrderWithDeliveries(number, productNames) {
  const { id: orderId } = await one(
    `INSERT INTO public.orders
       (order_number, user_id, subtotal, total_amount, delivery_recipient, delivery_address)
     VALUES ($1, $2, 140, 140, 'Database Test', 'Test address 308')
     RETURNING id`,
    [number, customer.id],
  );
  const deliveries = [];
  for (const [index, name] of productNames.entries()) {
    const { id: itemId } = await one(
      `INSERT INTO public.order_items
         (order_id, product_id, product_name, quantity, unit_list_price, unit_price_paid, line_total)
       VALUES ($1, $2, $3, 1, 70, 70, 70) RETURNING id`,
      [orderId, ids[name], name],
    );
    const { id } = await one(
      `INSERT INTO public.deliveries
         (delivery_number, order_id, order_item_id, customer_id, product_id, quantity,
          total_price, delivery_address)
       VALUES ($1, $2, $3, $4, $5, 1, 70, 'Test address 308') RETURNING id`,
      [`${number}-D${index + 1}`, orderId, itemId, customer.id, ids[name]],
    );
    deliveries.push(id);
  }
  return { orderId, deliveries };
}

void test('a product manager lists deliveries and moves them forward; the order follows its rows', async () => {
  const manager = await insertStaff('product_manager', 'pm-db@example.invalid');
  const auth = `Bearer ${await tokenFor(manager)}`;
  const { orderId, deliveries } = await insertOrderWithDeliveries('DB-DLV-1', [
    'Road Racer',
    'Trail Runner',
  ]);
  const patch = (id, status) =>
    server()
      .patch(`/api/staff/deliveries/${id}`)
      .set('Authorization', auth)
      .send({ status });
  const orderRow = () =>
    one(
      'SELECT status, delivered_at, updated_at FROM public.orders WHERE id = $1',
      [orderId],
    );

  // Customers are refused; the manager sees both rows with order number and product name.
  await server()
    .get('/api/staff/deliveries')
    .set('Authorization', `Bearer ${await tokenFor(customer.id)}`)
    .expect(403);
  const list = await server()
    .get('/api/staff/deliveries?status=processing')
    .set('Authorization', auth)
    .expect(200);
  const mine = list.body.filter((row) => row.orderNumber === 'DB-DLV-1');
  assert.deepEqual(
    mine.map((row) => [row.productName, row.status, row.totalPrice]),
    [
      ['Road Racer', 'processing', 70],
      ['Trail Runner', 'processing', 70],
    ],
  );

  const before = await orderRow();
  await patch(deliveries[0], 'in_transit').expect(200);
  assert.equal((await orderRow()).status, 'processing');
  assert.ok((await orderRow()).updated_at > before.updated_at);

  await patch(deliveries[0], 'processing').expect(409);
  await patch(deliveries[0], 'in_transit').expect(409);
  await patch(deliveries[0], 'cancelled').expect(409);
  await patch(deliveries[1], 'shipped').expect(400);
  await patch(999999, 'delivered').expect(404);

  await patch(deliveries[1], 'in_transit').expect(200);
  assert.equal((await orderRow()).status, 'in_transit');

  const first = await patch(deliveries[0], 'delivered').expect(200);
  assert.equal(first.body.delivery.isCompleted, true);
  const row = await one('SELECT * FROM public.deliveries WHERE id = $1', [
    deliveries[0],
  ]);
  assert.equal(row.is_completed, true);
  assert.ok(row.delivered_at instanceof Date);
  const half = await orderRow();
  assert.equal(half.status, 'in_transit');
  assert.equal(half.delivered_at, null);

  const last = await patch(deliveries[1], 'delivered').expect(200);
  assert.equal(last.body.order.status, 'delivered');
  const done = await orderRow();
  assert.equal(done.status, 'delivered');
  assert.ok(done.delivered_at instanceof Date);
});

void test('two managers changing the same delivery at once: exactly one succeeds, the other gets 409', async () => {
  const manager = await insertStaff(
    'product_manager',
    'pm-db-2@example.invalid',
  );
  const other = await insertStaff('product_manager', 'pm-db-3@example.invalid');
  const { orderId, deliveries } = await insertOrderWithDeliveries('DB-DLV-2', [
    'Road Racer',
  ]);
  const patch = async (who, status) =>
    server()
      .patch(`/api/staff/deliveries/${deliveries[0]}`)
      .set('Authorization', `Bearer ${await tokenFor(who)}`)
      .send({ status });

  for (const status of ['in_transit', 'delivered']) {
    const results = await Promise.all([
      patch(manager, status),
      patch(other, status),
      patch(manager, status),
    ]);
    const codes = results.map((res) => res.status).sort((a, b) => a - b);
    assert.deepEqual(codes, [200, 409, 409], `simultaneous ${status}`);
  }
  const row = await one(
    'SELECT status, is_completed FROM public.deliveries WHERE id = $1',
    [deliveries[0]],
  );
  assert.deepEqual(row, { status: 'delivered', is_completed: true });
  assert.equal(
    (await one('SELECT status FROM public.orders WHERE id = $1', [orderId]))
      .status,
    'delivered',
  );
});

void test('delivering the two items of one order at the same time still delivers the order', async () => {
  const manager = await insertStaff(
    'product_manager',
    'pm-db-4@example.invalid',
  );
  const auth = `Bearer ${await tokenFor(manager)}`;
  // Many rounds, because the bug this guards against (both requests read the other item as not
  // yet delivered) only shows when the two transactions overlap.
  for (let round = 0; round < 8; round += 1) {
    const { orderId, deliveries } = await insertOrderWithDeliveries(
      `DB-DLV-3-${round}`,
      ['Road Racer', 'Trail Runner'],
    );
    const responses = await Promise.all(
      deliveries.map((id) =>
        server()
          .patch(`/api/staff/deliveries/${id}`)
          .set('Authorization', auth)
          .send({ status: 'delivered' }),
      ),
    );
    assert.deepEqual(
      responses.map((res) => res.status),
      [200, 200],
    );
    const order = await one(
      'SELECT status, delivered_at FROM public.orders WHERE id = $1',
      [orderId],
    );
    assert.equal(order.status, 'delivered', `round ${round}`);
    assert.ok(order.delivered_at instanceof Date);
  }
});
