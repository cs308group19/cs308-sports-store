// Real PostgreSQL + Prisma + Nest auth boundary. Supabase's external Auth/JWKS
// services are test doubles. There is no checkout HTTP API yet: checkout() below
// is a transactional SQL example, not production application code.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { Client } from 'pg';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

const connectionString = process.env.RALLY_DATABASE_TEST_URL;
assert.ok(
  connectionString,
  'Set RALLY_DATABASE_TEST_URL to an EMPTY disposable local PostgreSQL database.',
);
const target = new URL(connectionString);
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname),
  'Remote databases are refused.',
);
assert.match(
  target.pathname,
  /^\/rally_test_[a-z0-9_]+$/,
  'Database name must start with rally_test_.',
);
const db = new Client({ connectionString });
const tables = [
  'categories',
  'products',
  'carts',
  'cart_items',
  'orders',
  'order_items',
  'payments',
  'invoices',
  'reviews',
];
const sequences = [
  'categories_id_seq',
  'products_id_seq',
  'carts_id_seq',
  'orders_id_seq',
  'order_items_id_seq',
];
const primaryKeys = {
  categories: 'id',
  products: 'id',
  carts: 'id',
  cart_items: 'cart_id',
  orders: 'id',
  order_items: 'id',
  payments: 'order_id',
  invoices: 'order_id',
  reviews: 'order_item_id',
};
const migrationDir = new URL('../../supabase/migrations/', import.meta.url);
let app, prisma, customer, product, category, order, privateKey;

before(async () => {
  await db.connect();
  const existing = await db.query(
    "SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')",
  );
  assert.equal(
    existing.rowCount,
    0,
    'Refusing to alter a database containing application tables. Create a new empty test database.',
  );
  for (const role of [
    'anon',
    'authenticated',
    'supabase_auth_admin',
    'rally_test_reader',
  ]) {
    const found = await db.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [
      role,
    ]);
    if (!found.rowCount) await db.query(`CREATE ROLE ${role} NOLOGIN`);
  }
  // Minimal Supabase prerequisites. No hosted Supabase account or real credentials.
  await db.query(`CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    GRANT USAGE ON SCHEMA public TO anon, authenticated, supabase_auth_admin, rally_test_reader;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;`);
  for (const file of (await readdir(migrationDir))
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    await db.query(await readFile(new URL(file, migrationDir), 'utf8'));
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
          await db.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
          return { data: { user: { id } }, error: null };
        },
        async deleteUser(id) {
          await db.query('DELETE FROM auth.users WHERE id = $1', [id]);
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

void test('Emre registration and signed JWT /me use the real UUID profile after all migrations', async () => {
  const created = await request(app.getHttpServer())
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
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: 'database-test' })
    .setSubject(customer.id)
    .setIssuer('https://test-project.supabase.co/auth/v1')
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  const me = await request(app.getHttpServer())
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  assert.equal(me.body.id, customer.id);
  assert.equal(me.body.role, 'customer');
  assert.equal(me.body.taxId, 'TEST-ONLY-308');
  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: customer.id },
  });
  assert.match(profile.taxIdEncrypted, /^v1:/);
  assert.ok(!profile.taxIdEncrypted.includes('TEST-ONLY-308'));
  assert.equal(
    (await db.query("SELECT to_regclass('public.users') AS name")).rows[0].name,
    null,
  );
  await db.query('SET ROLE supabase_auth_admin');
  try {
    const hook = await db.query(
      'SELECT public.custom_access_token_hook($1::jsonb) AS event',
      [JSON.stringify({ user_id: customer.id, claims: {} })],
    );
    assert.equal(hook.rows[0].event.claims.user_role, 'customer');
  } finally {
    await db.query('RESET ROLE');
  }
});

void test('Prisma can create products with optional cost/image and SQL rejects invalid stock and cost', async () => {
  category = await prisma.category.create({
    data: { name: 'Running', slug: 'running' },
  });
  product = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: 'Running shoe',
      model: 'TEST',
      serialNumber: 'TEST-308',
      description: 'Comfortable training shoe',
      stockQuantity: 5,
      price: '19.99',
      warrantyStatus: 'Active',
      distributorInfo: 'Test distributor',
    },
  });
  assert.equal(product.cost, null);
  assert.equal(product.imageUrl, null);
  await prisma.product.update({
    where: { id: product.id },
    data: { cost: '7.50', imageUrl: 'https://example.invalid/shoe.png' },
  });
  for (const sql of [
    'cost = -1',
    'stock_quantity = -1',
    'price = -1',
    "cost = 'NaN'",
    "price = 'NaN'",
  ]) {
    await assert.rejects(
      db.query(`UPDATE public.products SET ${sql} WHERE id = $1`, [product.id]),
      { code: '23514' },
    );
  }
});

void test('guest cart transfers to the actual auth UUID and keeps its lines; invalid owners are rejected', async () => {
  const guest = await prisma.cart.create({
    data: {
      guestTokenHash: randomBytes(32),
      items: { create: { productId: product.id, quantity: 2 } },
    },
  });
  const cart = await prisma.cart.update({
    where: { id: guest.id },
    data: { userId: customer.id, guestTokenHash: null },
    include: { items: true, user: true },
  });
  assert.equal(cart.user.id, customer.id);
  assert.equal(cart.items[0].quantity, 2);
  await assert.rejects(
    db.query('INSERT INTO public.carts (user_id) VALUES ($1)', [randomUUID()]),
    { code: '23503' },
  );
  await assert.rejects(
    db.query('INSERT INTO public.carts (user_id) VALUES ($1)', [customer.id]),
    { code: '23505' },
  );
  await assert.rejects(db.query('INSERT INTO public.carts DEFAULT VALUES'), {
    code: '23514',
  });
  await assert.rejects(
    db.query(
      'INSERT INTO public.carts (user_id, guest_token_hash) VALUES ($1, $2)',
      [customer.id, randomBytes(32)],
    ),
    { code: '23514' },
  );
  await assert.rejects(
    db.query('UPDATE public.cart_items SET quantity = 0 WHERE cart_id = $1', [
      guest.id,
    ]),
    { code: '23514' },
  );
});

void test('Prisma creates an order/payment/invoice for that UUID and reads its generated totals and delivery', async () => {
  order = await prisma.$transaction(async (tx) => {
    const changed = await tx.product.updateMany({
      where: { id: product.id, stockQuantity: { gte: 2 } },
      data: { stockQuantity: { decrement: 2 } },
    });
    assert.equal(changed.count, 1);
    return tx.order.create({
      data: {
        customerId: customer.id,
        checkoutKey: randomUUID(),
        customerName: 'Database Test',
        customerEmail: customer.email,
        shippingAddress: 'Test address 308',
        currency: 'TRY',
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            quantity: 2,
            unitPricePaid: '19.99',
          },
        },
        payment: {
          create: {
            mockReference: randomUUID(),
            amount: '39.98',
            invoice: { create: { invoiceNumber: 'TEST-308' } },
          },
        },
      },
      include: {
        items: true,
        customer: true,
        payment: { include: { invoice: true } },
      },
    });
  });
  assert.equal(order.customer.id, customer.id);
  assert.equal(order.items[0].lineTotal.toFixed(2), '39.98');
  assert.equal(order.payment.invoice.invoiceNumber, 'TEST-308');
  await assert.rejects(
    db.query(
      "UPDATE public.order_items SET unit_price_paid = 'NaN' WHERE order_id = $1",
      [order.id],
    ),
    { code: '23514' },
  );
  await assert.rejects(
    db.query("UPDATE public.payments SET amount = 'NaN' WHERE order_id = $1", [
      order.id,
    ]),
    { code: '23514' },
  );
  const delivery = (
    await db.query(
      'SELECT * FROM public.delivery_list WHERE delivery_id = $1',
      [order.id],
    )
  ).rows[0];
  assert.equal(delivery.customer_id, customer.id);
  assert.equal(delivery.total_price, '39.98');
  assert.equal(delivery.completed, false);
  await assert.rejects(
    db.query('UPDATE public.orders SET customer_id = $1 WHERE id = $2', [
      randomUUID(),
      order.id,
    ]),
    { code: '23503' },
  );
});

for (const role of ['anon', 'authenticated']) {
  void test(`${role} cannot read or change any store table, delivery view or identity sequence`, async () => {
    await db.query(`SET ROLE ${role}`);
    try {
      for (const table of tables) {
        for (const sql of [
          `SELECT * FROM public.${table}`,
          `INSERT INTO public.${table} DEFAULT VALUES`,
          `DELETE FROM public.${table} WHERE false`,
          `UPDATE public.${table} SET ${primaryKeys[table]} = DEFAULT WHERE false`,
        ]) {
          await assert.rejects(
            db.query(sql),
            { code: '42501' },
            `${role}: ${sql}`,
          );
        }
        const denied = await db.query(
          'SELECT has_table_privilege(current_user, $1, $2) AS allowed',
          [
            `public.${table}`,
            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER',
          ],
        );
        assert.equal(denied.rows[0].allowed, false);
      }
      await assert.rejects(db.query('SELECT * FROM public.delivery_list'), {
        code: '42501',
      });
      for (const seq of sequences)
        await assert.rejects(db.query(`SELECT nextval('public.${seq}')`), {
          code: '42501',
        });
    } finally {
      await db.query('RESET ROLE');
    }
  });
}

void test('RLS remains default-deny even if a reader later gets SELECT; delivery view respects the reader', async () => {
  const security = await db.query(
    "SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1)",
    [tables],
  );
  assert.equal(security.rowCount, tables.length);
  assert.ok(security.rows.every((r) => r.relrowsecurity));
  await db.query('SET ROLE rally_test_reader');
  try {
    await assert.rejects(db.query('SELECT * FROM public.orders'), {
      code: '42501',
    });
  } finally {
    await db.query('RESET ROLE');
  }
  await db.query('BEGIN');
  try {
    await db.query(
      `GRANT SELECT ON ${tables.map((t) => `public.${t}`).join(', ')}, public.delivery_list TO rally_test_reader`,
    );
    await db.query('SET LOCAL ROLE rally_test_reader');
    for (const table of [...tables, 'delivery_list'])
      assert.equal(
        (await db.query(`SELECT * FROM public.${table}`)).rowCount,
        0,
      );
  } finally {
    await db.query('ROLLBACK');
  }
});

void test('catalog/profile edits preserve purchase snapshots, and records with orders cannot be deleted', async () => {
  await prisma.product.update({
    where: { id: product.id },
    data: { price: '88.00', name: 'Changed name', archivedAt: new Date() },
  });
  await prisma.profile.update({
    where: { id: customer.id },
    data: { fullName: 'Changed customer', homeAddress: 'Changed address 308' },
  });
  const saved = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { items: true },
  });
  assert.equal(saved.customerName, 'Database Test');
  assert.equal(saved.shippingAddress, 'Test address 308');
  assert.equal(saved.items[0].productName, 'Running shoe');
  assert.equal(saved.items[0].unitPricePaid.toFixed(2), '19.99');
  await assert.rejects(
    db.query('DELETE FROM public.products WHERE id = $1', [product.id]),
    { code: '23503' },
  );
  await assert.rejects(
    db.query('DELETE FROM auth.users WHERE id = $1', [customer.id]),
    { code: '23503' },
  );
});

void test('delivery timestamps and review constraints survive Prisma round trips', async () => {
  await assert.rejects(
    db.query("UPDATE public.orders SET status = 'delivered' WHERE id = $1", [
      order.id,
    ]),
    { code: '23514' },
  );
  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'delivered', deliveredAt: new Date() },
  });
  assert.equal(
    (
      await db.query(
        'SELECT completed FROM public.delivery_list WHERE delivery_id = $1',
        [order.id],
      )
    ).rows[0].completed,
    true,
  );
  const line = order.items[0].id;
  await assert.rejects(
    db.query(
      'INSERT INTO public.reviews (order_item_id, rating) VALUES ($1, 6)',
      [line],
    ),
    { code: '23514' },
  );
  await assert.rejects(
    db.query(
      "INSERT INTO public.reviews (order_item_id, rating, comment) VALUES ($1, 4, 'Text')",
      [line],
    ),
    { code: '23514' },
  );
  const review = await prisma.review.create({
    data: { orderItemId: line, rating: 4 },
  });
  assert.equal(review.commentStatus, null);
  await prisma.review.update({
    where: { orderItemId: line },
    data: { comment: 'Good', commentStatus: 'pending' },
  });
  await assert.rejects(
    db.query(
      'INSERT INTO public.reviews (order_item_id, rating) VALUES ($1, 3)',
      [line],
    ),
    { code: '23505' },
  );
});

// Demonstrates the transaction contract for the future checkout service.
async function checkout(productId, key = randomUUID(), failPayment = false) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    const claimed = await client.query(
      `INSERT INTO public.orders
      (customer_id, checkout_key, customer_name, customer_email, shipping_address, currency)
      VALUES ($1, $2, 'Test', 'test@example.invalid', 'Test address', 'TRY')
      ON CONFLICT (customer_id, checkout_key) DO NOTHING RETURNING id`,
      [customer.id, key],
    );
    if (!claimed.rowCount) {
      const existing = await client.query(
        'SELECT id FROM public.orders WHERE customer_id = $1 AND checkout_key = $2',
        [customer.id, key],
      );
      await client.query('COMMIT');
      return existing.rows[0].id;
    }
    const id = claimed.rows[0].id;
    const stock = await client.query(
      `UPDATE public.products SET stock_quantity = stock_quantity - 1
      WHERE id = $1 AND stock_quantity >= 1 AND archived_at IS NULL RETURNING name, price`,
      [productId],
    );
    if (!stock.rowCount) throw new Error('Out of stock');
    const p = stock.rows[0];
    await client.query(
      `INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price_paid)
      VALUES ($1, $2, $3, 1, $4)`,
      [id, productId, p.name, p.price],
    );
    if (failPayment) throw new Error('Payment failed');
    await client.query(
      'INSERT INTO public.payments (order_id, mock_reference, amount) VALUES ($1, $2, $3)',
      [id, randomUUID(), p.price],
    );
    await client.query(
      'INSERT INTO public.invoices (order_id, invoice_number) VALUES ($1, $2)',
      [id, randomUUID()],
    );
    await client.query('COMMIT');
    return id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void test('failed payment rolls back the example checkout, including stock, lines, payment and invoice', async () => {
  await prisma.product.update({
    where: { id: product.id },
    data: { archivedAt: null, stockQuantity: 1 },
  });
  const key = randomUUID();
  await assert.rejects(checkout(product.id, key, true), /Payment failed/);
  assert.equal(
    (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
      .stockQuantity,
    1,
  );
  assert.equal(await prisma.order.count({ where: { checkoutKey: key } }), 0);
});

void test('two concurrent example checkouts cannot both buy the last item', async () => {
  const results = await Promise.allSettled([
    checkout(product.id),
    checkout(product.id),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    results.filter(
      (r) => r.status === 'rejected' && /Out of stock/.test(r.reason.message),
    ).length,
    1,
  );
  assert.equal(
    (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
      .stockQuantity,
    0,
  );
});

void test('concurrent retries of one checkout key create one order and deduct stock once', async () => {
  await prisma.product.update({
    where: { id: product.id },
    data: { stockQuantity: 1 },
  });
  const key = randomUUID();
  const ids = await Promise.all([
    checkout(product.id, key),
    checkout(product.id, key),
  ]);
  assert.equal(ids[0], ids[1]);
  assert.equal(await prisma.order.count({ where: { checkoutKey: key } }), 1);
  assert.equal(
    (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
      .stockQuantity,
    0,
  );
});

void test('search matches names/descriptions, retains zero-stock products and handles pg_trgm previously in public', async () => {
  const query =
    "SELECT id FROM public.products WHERE archived_at IS NULL AND (name ILIKE '%changed%' OR description ILIKE '%training%') ORDER BY id";
  const before = (await db.query(query)).rows;
  assert.ok(before.some((p) => p.id === String(product.id)));
  await db.query('ALTER EXTENSION pg_trgm SET SCHEMA public');
  const search = await readFile(
    new URL('20261112192300_product_search_indexes.sql', migrationDir),
    'utf8',
  );
  await db.query(search);
  await db.query(search);
  assert.deepEqual((await db.query(query)).rows, before);
  const location = await db.query(
    "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm'",
  );
  assert.equal(location.rows[0].nspname, 'extensions');
  await db.query('BEGIN');
  try {
    await db.query('SET LOCAL enable_seqscan = off');
    await db.query('SET LOCAL enable_indexscan = off');
    const plan = JSON.stringify(
      (await db.query(`EXPLAIN (FORMAT JSON) ${query}`)).rows,
    );
    assert.match(plan, /products_name_trgm_idx/);
    assert.match(plan, /products_description_trgm_idx/);
  } finally {
    await db.query('ROLLBACK');
  }
});
