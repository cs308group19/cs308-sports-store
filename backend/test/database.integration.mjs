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
import { setTimeout as delay } from 'node:timers/promises';
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
const POPULARITY_MIGRATION = '20261126194500_reset_popularity_to_sales.sql';
const GUEST = randomUUID();

let app, prisma, privateKey, customer, category;
const invoiceEmailFailures = new Set();
const invoiceEmails = [];
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
    { MAIL_TRANSPORT },
  ] = await Promise.all([
    import('@nestjs/testing'),
    import('../dist/app.module.js'),
    import('../dist/app.setup.js'),
    import('../dist/auth/jwks.js'),
    import('../dist/prisma/prisma.service.js'),
    import('../dist/supabase/supabase-admin.service.js'),
    import('../dist/invoices/mail.transport.js'),
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
    .overrideProvider(MAIL_TRANSPORT)
    .useValue({
      async sendMail(message) {
        const invoice = await one(
          'SELECT email_status FROM public.invoices WHERE invoice_number = $1',
          [message.attachments[0].filename.replace(/\.pdf$/, '')],
        );
        invoiceEmails.push({ message, statusAtSend: invoice?.email_status });
        if (invoiceEmailFailures.has(message.to))
          throw Object.assign(new Error('Test SMTP failure'), {
            code: 'ECONNREFUSED',
          });
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

void test('two merges of the same guest cart at the same time copy it once', async () => {
  const racerGuest = randomUUID();
  const auth = `Bearer ${await tokenFor(customer.id)}`;
  await sql(
    `DELETE FROM public.cart_items WHERE cart_id =
       (SELECT id FROM public.carts WHERE user_id = $1)`,
    [customer.id],
  );
  await server()
    .post('/api/cart/items')
    .set('X-Cart-Token', racerGuest)
    .send({ productId: String(ids['Road Racer']), quantity: 3 })
    .expect(201);

  // Both requests see the guest cart at once. The guest row lock makes the second merge wait
  // for the first, then it finds the guest cart empty and copies nothing.
  await Promise.all([
    server()
      .post('/api/me/cart/merge')
      .set('Authorization', auth)
      .set('X-Cart-Token', racerGuest)
      .expect(200),
    server()
      .post('/api/me/cart/merge')
      .set('Authorization', auth)
      .set('X-Cart-Token', racerGuest)
      .expect(200),
  ]);

  const owned = await server()
    .get('/api/me/cart')
    .set('Authorization', auth)
    .expect(200);
  assert.deepEqual(
    owned.body.items.map((i) => [i.name, i.quantity]),
    [['Road Racer', 3]],
  );
  const guest = await server().get('/api/cart').set('X-Cart-Token', racerGuest);
  assert.deepEqual(guest.body, { items: [], total: 0 });
});

void test('a merge without a guest cart inserts no cart row', async () => {
  // The frontend merges on every page load of a signed-in customer, usually with no guest cart.
  const auth = `Bearer ${await tokenFor(customer.id)}`;
  const unknownGuest = randomUUID();
  const before = await one('SELECT count(*)::int AS carts FROM public.carts');

  await server()
    .post('/api/me/cart/merge')
    .set('Authorization', auth)
    .set('X-Cart-Token', unknownGuest)
    .expect(200);

  const after = await one('SELECT count(*)::int AS carts FROM public.carts');
  assert.equal(after.carts, before.carts);
  const guest = await one(
    'SELECT count(*)::int AS carts FROM public.carts WHERE guest_token = $1',
    [unknownGuest],
  );
  assert.equal(guest.carts, 0);
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

const checkoutInput = {
  deliveryRecipient: 'Checkout Recipient',
  deliveryAddress: 'New delivery address, Istanbul',
  cardholderName: 'Checkout Cardholder',
  cardNumber: '4242 4242 4242 4242',
  expiry: '12/99',
  cvv: '9731',
};

async function checkoutCustomer() {
  const id = randomUUID();
  await sql('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  const profile = await prisma.profile.create({
    data: {
      id,
      email: `${id}@example.test`,
      fullName: 'Checkout Customer',
      homeAddress: 'Original profile address, Istanbul',
    },
    select: { email: true },
  });
  return {
    id,
    email: profile.email,
    authorization: `Bearer ${await tokenFor(id)}`,
  };
}

async function cartAdd(account, productId, quantity = 1) {
  await server()
    .post('/api/me/cart/items')
    .set('Authorization', account.authorization)
    .send({ productId, quantity })
    .expect(201);
}

async function reviewedCartFor(account) {
  const { body: cart } = await server()
    .get('/api/me/cart')
    .set('Authorization', account.authorization)
    .expect(200);
  const subtotalCents = Math.round(cart.total * 100);
  const deliveryCents = cart.items.length > 0 && subtotalCents < 7500 ? 800 : 0;
  return {
    items: cart.items.map(({ productId, quantity, lineTotal }) => ({
      productId,
      quantity,
      lineTotalCents: Math.round(lineTotal * 100),
    })),
    totalCents:
      subtotalCents + deliveryCents + Math.round((subtotalCents * 8) / 100),
  };
}

const checkout = (account, reviewedCart, overrides = {}) =>
  server()
    .post('/api/me/checkout')
    .set('Authorization', account.authorization)
    .send({ ...checkoutInput, reviewedCart, ...overrides });

const checkoutProduct = (name, options = {}) =>
  insertProduct({
    name,
    description: 'A checkout test product',
    price: '20.00',
    ...options,
  });

async function productStock(productId) {
  return one(
    'SELECT stock_quantity, popularity FROM public.products WHERE id = $1',
    [productId],
  );
}

async function checkoutCounts(account) {
  return one(
    `SELECT
    (SELECT count(*) FROM orders WHERE user_id = $1)::int AS orders,
    (SELECT count(*) FROM order_items JOIN orders ON orders.id = order_id WHERE user_id = $1)::int AS items,
    (SELECT count(*) FROM payments JOIN orders ON orders.id = order_id WHERE user_id = $1)::int AS payments,
    (SELECT count(*) FROM deliveries WHERE customer_id = $1)::int AS deliveries,
    (SELECT count(*) FROM invoices WHERE user_id = $1)::int AS invoices,
    (SELECT count(*) FROM cart_items JOIN carts ON carts.id = cart_id WHERE user_id = $1)::int AS cart_items`,
    [account.id],
  );
}

async function waitForInvoiceEmail(invoiceId) {
  const where = { id: BigInt(invoiceId) };
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const invoice = await prisma.invoice.findUniqueOrThrow({ where });
    if (invoice.emailStatus !== 'pending') return invoice;
    await delay(20);
  }
  assert.fail(`Invoice ${invoiceId} email remained pending.`);
}

void test('checkout commits product and address snapshots, payment, deliveries and invoice before sending email', async () => {
  const account = await checkoutCustomer();
  const product = await checkoutProduct('Checkout discounted product', {
    price: '19.99',
    discount_rate: '50',
  });
  const other = await checkoutProduct('Checkout second product', {
    price: '5.00',
  });
  await cartAdd(account, product, 2);
  await cartAdd(account, other);

  const res = await checkout(account, await reviewedCartFor(account)).expect(
    201,
  );
  const { orderId, orderNumber, invoiceId } = res.body;
  assert.deepEqual(Object.keys(res.body).sort(), [
    'invoiceId',
    'orderId',
    'orderNumber',
  ]);
  assert.match(orderId, /^\d+$/);
  assert.match(invoiceId, /^\d+$/);
  await waitForInvoiceEmail(invoiceId);
  const record = await one(
    `SELECT row_to_json(orders) AS order, row_to_json(invoices) AS invoice,
    (SELECT json_agg(order_items ORDER BY id) FROM order_items WHERE order_id = orders.id) AS lines,
    (SELECT json_agg(deliveries ORDER BY id) FROM deliveries WHERE order_id = orders.id) AS deliveries,
    (SELECT row_to_json(payments) FROM payments WHERE order_id = orders.id) AS payment
    FROM orders JOIN invoices ON invoices.order_id = orders.id WHERE orders.id = $1`,
    [orderId],
  );
  const { order, invoice, lines, deliveries, payment } = record;
  assert.equal(order.order_number, orderNumber);
  assert.equal(order.user_id, account.id);
  assert.equal(order.status, 'processing');
  assert.equal(order.delivery_recipient, checkoutInput.deliveryRecipient);
  assert.equal(order.delivery_address, checkoutInput.deliveryAddress);
  assert.equal(order.subtotal, 25);
  assert.equal(order.discount_total, 19.98);
  assert.equal(order.tax_amount, 2);
  assert.equal(order.delivery_fee, 8);
  assert.equal(order.total_amount, 35);
  assert.equal(String(invoice.id), invoiceId);
  assert.equal(invoice.billed_to_name, checkoutInput.deliveryRecipient);
  assert.equal(invoice.billed_to_address, checkoutInput.deliveryAddress);
  assert.equal(invoice.subtotal, order.subtotal);
  assert.equal(invoice.tax_amount, order.tax_amount);
  assert.equal(invoice.delivery_fee, order.delivery_fee);
  assert.equal(invoice.total_amount, order.total_amount);
  assert.equal(invoice.email_status, 'sent');
  assert.ok(invoice.emailed_at);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].product_name, 'Checkout discounted product');
  assert.equal(lines[0].product_model, 'MODEL-Checkout discounted product');
  assert.equal(lines[0].unit_list_price, 19.99);
  assert.equal(lines[0].discount_rate, 50);
  assert.equal(lines[0].unit_price_paid, 10);
  assert.equal(lines[0].line_total, 20);
  assert.deepEqual(
    deliveries.map((row) => [row.order_item_id, row.quantity, row.total_price]),
    lines.map((row) => [row.id, row.quantity, row.line_total]),
  );
  for (const delivery of deliveries) {
    assert.equal(delivery.status, 'processing');
    assert.equal(delivery.customer_id, account.id);
    assert.equal(delivery.delivery_address, checkoutInput.deliveryAddress);
  }
  assert.equal(payment.status, 'succeeded');
  assert.equal(payment.amount, 35);
  assert.equal(payment.card_brand, 'Visa');
  assert.equal(payment.card_last4, '4242');
  assert.ok(payment.transaction_ref);
  assert.equal(invoiceEmails.at(-1).statusAtSend, 'pending');
  assert.equal(invoiceEmails.at(-1).message.to, account.email);
  assert.equal(
    await prisma.cartItem.count({ where: { cart: { userId: account.id } } }),
    0,
  );
  assert.deepEqual(await productStock(product), {
    stock_quantity: 8,
    popularity: 2,
  });
  assert.deepEqual(await productStock(other), {
    stock_quantity: 9,
    popularity: 1,
  });

  const invoiceView = await server()
    .get(`/api/me/invoices/${invoiceId}`)
    .set('Authorization', account.authorization)
    .expect(200);
  assert.equal(invoiceView.body.deliveryFee, 8);
  assert.equal(invoiceView.body.total, 35);
  for (const payload of [record, res.body, invoiceView.body]) {
    const output = JSON.stringify(payload);
    assert.ok(!output.includes(checkoutInput.cardNumber));
    assert.ok(!output.includes(checkoutInput.cardNumber.replaceAll(' ', '')));
    assert.ok(!output.includes(`"${checkoutInput.cvv}"`));
  }
});

void test('a real order lowers stock on the product page and moves the product up the popularity order', async () => {
  const account = await checkoutCustomer();
  // `idle` is created first, so with equal popularity it comes first (ties are ordered by id).
  // Only the order can move `bought` ahead of it.
  const idle = await checkoutProduct('Popularity idle product');
  const bought = await checkoutProduct('Popularity bought product');
  const listOrder = async () =>
    (await server().get('/api/products').expect(200)).body.map((item) =>
      String(item.id),
    );

  const beforeOrder = await listOrder();
  assert.ok(
    beforeOrder.indexOf(String(idle)) < beforeOrder.indexOf(String(bought)),
    'before any order, the older product comes first',
  );

  await cartAdd(account, bought, 2);
  const { body: placed } = await checkout(
    account,
    await reviewedCartFor(account),
  ).expect(201);
  await waitForInvoiceEmail(placed.invoiceId);

  assert.deepEqual(await productStock(bought), {
    stock_quantity: 8,
    popularity: 2,
  });
  const detail = await server().get(`/api/products/${bought}`).expect(200);
  assert.equal(detail.body.stock, 8);

  // Sales are the only source of popularity, so the product sold moves ahead of the one not sold.
  const afterOrder = await listOrder();
  assert.ok(
    afterOrder.indexOf(String(bought)) < afterOrder.indexOf(String(idle)),
    'after the order, the product that was bought comes first',
  );

  // Re-running the popularity reset migration replaces hand-written seed numbers with real sales.
  await sql('UPDATE public.products SET popularity = 98 WHERE id = $1', [idle]);
  const migration = await readFile(
    new URL(POPULARITY_MIGRATION, migrationDir),
    'utf8',
  );
  await sql(migration);
  await sql(migration);
  assert.equal((await productStock(idle)).popularity, 0);
  assert.equal((await productStock(bought)).popularity, 2);
});

void test('the last item sold makes the product out of stock on the page and in the list', async () => {
  const account = await checkoutCustomer();
  const sold = await checkoutProduct('Sold out product', { stock_quantity: 2 });
  await cartAdd(account, sold, 2);
  const { body: placed } = await checkout(
    account,
    await reviewedCartFor(account),
  ).expect(201);
  await waitForInvoiceEmail(placed.invoiceId);

  assert.equal((await productStock(sold)).stock_quantity, 0);
  const detail = await server().get(`/api/products/${sold}`).expect(200);
  assert.equal(detail.body.stock, 0);
  const list = await server().get('/api/products').expect(200);
  const item = list.body.find((row) => String(row.id) === String(sold));
  assert.ok(item, 'an out-of-stock product stays in the list');
  assert.equal(item.stock, 0);
});

void test('declined checkout changes no records, product stock or cart items', async () => {
  const account = await checkoutCustomer();
  const product = await checkoutProduct('Checkout decline product');
  await cartAdd(account, product, 2);
  const counts = await checkoutCounts(account);
  const stock = await productStock(product);
  const { body: cart } = await server()
    .get('/api/me/cart')
    .set('Authorization', account.authorization)
    .expect(200);
  const mailCount = invoiceEmails.length;

  await checkout(account, await reviewedCartFor(account), {
    cardNumber: '4000 0000 0000 0002',
  }).expect(402);

  assert.deepEqual(await checkoutCounts(account), counts);
  assert.deepEqual(await productStock(product), stock);
  const { body: unchanged } = await server()
    .get('/api/me/cart')
    .set('Authorization', account.authorization)
    .expect(200);
  assert.deepEqual(unchanged, cart);
  assert.equal(invoiceEmails.length, mailCount);
});

void test('two customers racing for the last item create exactly one order', async () => {
  const first = await checkoutCustomer();
  const second = await checkoutCustomer();
  const product = await checkoutProduct('Checkout last product', {
    stock_quantity: 1,
  });
  await cartAdd(first, product);
  await cartAdd(second, product);
  const [firstCart, secondCart] = await Promise.all([
    reviewedCartFor(first),
    reviewedCartFor(second),
  ]);
  const mailCount = invoiceEmails.length;

  const results = await Promise.all([
    checkout(first, firstCart),
    checkout(second, secondCart),
  ]);

  assert.deepEqual(
    results
      .map((response) => response.status)
      .sort((first, second) => first - second),
    [201, 409],
  );
  const winner = results[0].status === 201 ? first : second;
  const loser = winner === first ? second : first;
  assert.deepEqual(await checkoutCounts(winner), {
    orders: 1,
    items: 1,
    payments: 1,
    deliveries: 1,
    invoices: 1,
    cart_items: 0,
  });
  assert.deepEqual(await checkoutCounts(loser), {
    orders: 0,
    items: 0,
    payments: 0,
    deliveries: 0,
    invoices: 0,
    cart_items: 1,
  });
  assert.deepEqual(await productStock(product), {
    stock_quantity: 0,
    popularity: 1,
  });
  const { invoiceId } = results.find(
    (response) => response.status === 201,
  ).body;
  assert.equal((await waitForInvoiceEmail(invoiceId)).emailStatus, 'sent');
  assert.equal(invoiceEmails.length, mailCount + 1);
});

void test('same-cart submissions are serialized and an email failure leaves the order available', async () => {
  const account = await checkoutCustomer();
  const product = await checkoutProduct('Checkout double submit product');
  await cartAdd(account, product, 2);
  const reviewedCart = await reviewedCartFor(account);
  const mailCount = invoiceEmails.length;

  invoiceEmailFailures.add(account.email);
  const results = await Promise.all([
    checkout(account, reviewedCart),
    checkout(account, reviewedCart),
  ]);

  assert.deepEqual(
    results
      .map((response) => response.status)
      .sort((first, second) => first - second),
    [201, 409],
  );
  const { orderId, invoiceId } = results.find(
    (response) => response.status === 201,
  ).body;
  assert.deepEqual(await checkoutCounts(account), {
    orders: 1,
    items: 1,
    payments: 1,
    deliveries: 1,
    invoices: 1,
    cart_items: 0,
  });
  const invoice = await waitForInvoiceEmail(invoiceId);
  assert.equal(String(invoice.orderId), orderId);
  assert.equal(invoice.emailStatus, 'failed');
  assert.ok(invoice.emailError);
  assert.equal(invoice.emailedAt, null);
  await server()
    .get(`/api/me/invoices/${invoiceId}`)
    .set('Authorization', account.authorization)
    .expect(200);
  assert.equal(invoiceEmails.length, mailCount + 1);
});

void test('stock failure on a later cart line rolls back earlier product changes', async () => {
  const account = await checkoutCustomer();
  const first = await checkoutProduct('Checkout rollback first product');
  const second = await checkoutProduct('Checkout rollback second product');
  await cartAdd(account, first);
  await cartAdd(account, second);
  const reviewedCart = await reviewedCartFor(account);
  await sql('UPDATE public.products SET stock_quantity = 0 WHERE id = $1', [
    second,
  ]);
  const before = await checkoutCounts(account);

  const response = await checkout(account, reviewedCart).expect(409);
  assert.match(response.body.message, /requested quantity/);

  assert.deepEqual(await checkoutCounts(account), before);
  assert.deepEqual(await productStock(first), {
    stock_quantity: 10,
    popularity: 0,
  });
  assert.deepEqual(await productStock(second), {
    stock_quantity: 0,
    popularity: 0,
  });
});

void test('checkout requires reconfirmation when cart quantities, line prices or the total change', async () => {
  const account = await checkoutCustomer();
  const first = await checkoutProduct('Checkout reviewed first product');
  const second = await checkoutProduct('Checkout reviewed second product');
  await cartAdd(account, first);
  await cartAdd(account, second);
  const initialCart = await reviewedCartFor(account);
  const before = await checkoutCounts(account);
  const mailCount = invoiceEmails.length;

  await cartAdd(account, first);
  await checkout(account, initialCart).expect(409);

  const quantityUpdated = await reviewedCartFor(account);
  // The updated line prices still add up to the previous subtotal.
  await sql('UPDATE public.products SET price = $2 WHERE id = $1', [
    first,
    '21.00',
  ]);
  await sql('UPDATE public.products SET price = $2 WHERE id = $1', [
    second,
    '18.00',
  ]);
  const refreshed = await reviewedCartFor(account);
  assert.equal(refreshed.totalCents, quantityUpdated.totalCents);
  await checkout(account, quantityUpdated).expect(409);
  await checkout(account, {
    ...refreshed,
    totalCents: refreshed.totalCents - 1,
  }).expect(409);

  assert.deepEqual(await checkoutCounts(account), before);
  assert.deepEqual(await reviewedCartFor(account), refreshed);
  assert.deepEqual(await productStock(first), {
    stock_quantity: 10,
    popularity: 0,
  });
  assert.deepEqual(await productStock(second), {
    stock_quantity: 10,
    popularity: 0,
  });
  assert.equal(invoiceEmails.length, mailCount);

  const { body } = await checkout(account, refreshed).expect(201);
  assert.equal((await waitForInvoiceEmail(body.invoiceId)).emailStatus, 'sent');
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

// SCRUM-34. Delivery list and status changes on the real tables. To control every row, most of
// these tests insert the order, its items and one delivery row per item themselves, as the order
// contract describes them. The last one starts from a real checkout.
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

void test('the deliveries of a real two-item checkout are listed and the order stays open until the last is delivered', async () => {
  const manager = await insertStaff(
    'product_manager',
    'pm-db-5@example.invalid',
  );
  const auth = `Bearer ${await tokenFor(manager)}`;
  const account = await checkoutCustomer();
  const first = await checkoutProduct('Checkout delivery first product');
  const second = await checkoutProduct('Checkout delivery second product', {
    price: '30.00',
  });
  await cartAdd(account, first, 2);
  await cartAdd(account, second);
  const { body: placed } = await checkout(
    account,
    await reviewedCartFor(account),
  ).expect(201);
  await waitForInvoiceEmail(placed.invoiceId);

  const listed = async () => {
    const { body } = await server()
      .get('/api/staff/deliveries')
      .set('Authorization', auth)
      .expect(200);
    return body.filter((row) => row.orderNumber === placed.orderNumber);
  };
  const orderRow = () =>
    one('SELECT status, delivered_at FROM public.orders WHERE id = $1', [
      placed.orderId,
    ]);

  const rows = await listed();
  assert.deepEqual(
    rows.map((row) => [
      row.productName,
      row.quantity,
      row.totalPrice,
      row.status,
      row.isCompleted,
      row.deliveredAt,
    ]),
    [
      ['Checkout delivery first product', 2, 40, 'processing', false, null],
      ['Checkout delivery second product', 1, 30, 'processing', false, null],
    ],
  );
  for (const row of rows) {
    assert.equal(String(row.orderId), placed.orderId);
    assert.equal(row.customerId, account.id);
    assert.equal(row.deliveryAddress, checkoutInput.deliveryAddress);
  }
  assert.deepEqual(await orderRow(), {
    status: 'processing',
    delivered_at: null,
  });

  // The order takes the status of its least advanced delivery.
  const [firstId, secondId] = rows.map((row) => row.id);
  for (const [id, status, orderStatus] of [
    [firstId, 'in_transit', 'processing'],
    [secondId, 'in_transit', 'in_transit'],
    [firstId, 'delivered', 'in_transit'],
    [secondId, 'delivered', 'delivered'],
  ]) {
    const step = `delivery ${id} to ${status}`;
    const { body } = await server()
      .patch(`/api/staff/deliveries/${id}`)
      .set('Authorization', auth)
      .send({ status })
      .expect(200);
    assert.equal(body.delivery.status, status, step);
    assert.equal(body.order.status, orderStatus, step);
    const order = await orderRow();
    assert.equal(order.status, orderStatus, step);
    if (orderStatus === 'delivered') {
      assert.ok(order.delivered_at instanceof Date, step);
      assert.equal(body.order.deliveredAt, order.delivered_at.toISOString());
      assert.equal(body.delivery.deliveredAt, body.order.deliveredAt);
    } else {
      assert.equal(order.delivered_at, null, step);
      assert.equal(body.order.deliveredAt, null, step);
    }
  }

  assert.deepEqual(
    (await listed()).map((row) => [
      row.status,
      row.isCompleted,
      row.deliveredAt !== null,
    ]),
    [
      ['delivered', true, true],
      ['delivered', true, true],
    ],
  );
  const history = await server()
    .get('/api/me/orders')
    .set('Authorization', account.authorization)
    .expect(200);
  assert.equal(history.body[0].orderNumber, placed.orderNumber);
  assert.equal(history.body[0].status, 'delivered');
  assert.equal(String(history.body[0].invoiceId), String(placed.invoiceId));
});

void test('GET /api/me/orders returns only the customer’s own orders, newest first (SCRUM-27)', async () => {
  const firstCustomer = await checkoutCustomer();
  const secondCustomer = await checkoutCustomer();
  const product = await checkoutProduct('Order history product');

  const empty = await server()
    .get('/api/me/orders')
    .set('Authorization', secondCustomer.authorization)
    .expect(200);
  assert.deepEqual(empty.body, []);

  await cartAdd(firstCustomer, product, 1);
  const { body: older } = await checkout(
    firstCustomer,
    await reviewedCartFor(firstCustomer),
  ).expect(201);
  await waitForInvoiceEmail(older.invoiceId);

  await cartAdd(firstCustomer, product, 2);
  const { body: newer } = await checkout(
    firstCustomer,
    await reviewedCartFor(firstCustomer),
  ).expect(201);
  await waitForInvoiceEmail(newer.invoiceId);

  const firstList = await server()
    .get('/api/me/orders')
    .set('Authorization', firstCustomer.authorization)
    .expect(200);
  assert.deepEqual(
    firstList.body.map((row) => row.orderNumber),
    [newer.orderNumber, older.orderNumber],
  );
  assert.equal(firstList.body[0].items[0].quantity, 2);
  assert.equal(firstList.body[0].items[0].model, 'MODEL-Order history product');

  const secondList = await server()
    .get('/api/me/orders')
    .set('Authorization', secondCustomer.authorization)
    .expect(200);
  assert.deepEqual(secondList.body, []);
});

const submitReview = (account, orderItemId, rating, comment) =>
  server()
    .post('/api/me/reviews')
    .set('Authorization', account.authorization)
    .send({ orderItemId, rating, comment });

const moderateReview = (authorization, id, status) =>
  server()
    .patch(`/api/staff/reviews/${id}`)
    .set('Authorization', authorization)
    .send({ status });

const orderHistory = async (account) =>
  (
    await server()
      .get('/api/me/orders')
      .set('Authorization', account.authorization)
      .expect(200)
  ).body;

async function purchaseReviewItems(account, productIds) {
  for (const productId of productIds) await cartAdd(account, productId);
  const { body: order } = await checkout(
    account,
    await reviewedCartFor(account),
  ).expect(201);
  await waitForInvoiceEmail(order.invoiceId);
  return {
    order,
    deliveries: await prisma.delivery.findMany({
      where: { orderId: BigInt(order.orderId) },
    }),
  };
}

async function deliverReviewItem(authorization, deliveryId) {
  for (const status of ['in_transit', 'delivered']) {
    await server()
      .patch(`/api/staff/deliveries/${deliveryId}`)
      .set('Authorization', authorization)
      .send({ status })
      .expect(200);
  }
}

void test('reviews use the purchased line and its delivery; ratings publish before comments', async () => {
  const buyer = await checkoutCustomer();
  const stranger = await checkoutCustomer();
  const manager = await insertStaff(
    'product_manager',
    'review-manager@example.invalid',
  );
  const managerAuth = `Bearer ${await tokenFor(manager)}`;
  const sales = await insertStaff(
    'sales_manager',
    'review-sales@example.invalid',
  );
  const salesAuth = `Bearer ${await tokenFor(sales)}`;
  const product = await checkoutProduct('Review flow product');
  const otherProduct = await checkoutProduct('Not delivered yet product');
  const purchase = await purchaseReviewItems(buyer, [product, otherProduct]);
  const delivery = purchase.deliveries.find(
    (row) => String(row.productId) === product,
  );
  const orderItemId = String(delivery.orderItemId);
  const undeliveredItemId = String(
    purchase.deliveries.find((row) => String(row.productId) === otherProduct)
      .orderItemId,
  );
  const detail = async () =>
    (await server().get(`/api/products/${product}`).expect(200)).body;

  await server()
    .post('/api/me/reviews')
    .send({ orderItemId, rating: 4 })
    .expect(401);
  await submitReview(stranger, orderItemId, 4).expect(404);
  await submitReview(buyer, orderItemId, 4).expect(409);
  await deliverReviewItem(managerAuth, delivery.id);

  // An inconsistent link inserted outside the app must never appear as the buyer's review.
  const mislinked = await prisma.review.create({
    data: {
      orderItemId: BigInt(orderItemId),
      productId: BigInt(product),
      userId: stranger.id,
      rating: 1,
    },
  });
  const [history] = await orderHistory(buyer);
  assert.equal(history.status, 'processing');
  const deliveredLine = history.items.find(
    (line) => String(line.id) === orderItemId,
  );
  assert.equal(deliveredLine.delivered, true);
  assert.equal(deliveredLine.review, null);
  await prisma.review.delete({ where: { id: mislinked.id } });
  assert.equal(
    history.items.find((line) => String(line.id) === undeliveredItemId)
      .delivered,
    false,
  );
  await submitReview(buyer, undeliveredItemId, 4, 'Too early.').expect(409);
  assert.equal(
    await prisma.review.count({
      where: { orderItemId: BigInt(undeliveredItemId) },
    }),
    0,
  );
  const undeliveredProduct = await server()
    .get(`/api/products/${otherProduct}`)
    .expect(200);
  assert.equal(undeliveredProduct.body.reviews, 0);
  await submitReview(buyer, orderItemId, 6).expect(400);
  await submitReview(buyer, '9223372036854775808', 4).expect(400);
  await submitReview(buyer, orderItemId, 4, '   ').expect(400);
  await submitReview(buyer, orderItemId, 4, 'x'.repeat(2001)).expect(400);

  const { body: rating } = await submitReview(buyer, orderItemId, 4).expect(
    201,
  );
  assert.equal(rating.commentStatus, null);
  const initialDetail = await detail();
  assert.equal(initialDetail.rating, 4);
  assert.equal(initialDetail.reviews, 1);
  assert.deepEqual(initialDetail.comments, []);
  await submitReview(buyer, orderItemId, 4).expect(409);
  const historyReview = async () =>
    (await orderHistory(buyer))[0].items.find(
      (line) => String(line.id) === orderItemId,
    ).review;
  assert.deepEqual(await historyReview(), {
    rating: 4,
    hasComment: false,
    commentStatus: null,
  });

  // An imported comment can have no display status while still occupying the one comment slot.
  await sql('UPDATE public.reviews SET comment = $1 WHERE id = $2', [
    'Legacy text',
    rating.id,
  ]);
  assert.deepEqual(await historyReview(), {
    rating: 4,
    hasComment: true,
    commentStatus: null,
  });
  await submitReview(buyer, orderItemId, 4, 'Second text.').expect(409);
  await sql('UPDATE public.reviews SET comment = NULL WHERE id = $1', [
    rating.id,
  ]);

  const { body: comment } = await submitReview(
    buyer,
    orderItemId,
    4,
    '  Runs well.  ',
  ).expect(201);
  assert.equal(comment.id, rating.id);
  assert.equal(comment.commentStatus, 'pending');
  assert.deepEqual((await detail()).comments, []);
  assert.deepEqual(await historyReview(), {
    rating: 4,
    hasComment: true,
    commentStatus: 'pending',
  });

  await server().get('/api/staff/reviews?status=pending').expect(401);
  await server()
    .get('/api/staff/reviews?status=pending')
    .set('Authorization', buyer.authorization)
    .expect(403);
  await server()
    .get('/api/staff/reviews?status=pending')
    .set('Authorization', salesAuth)
    .expect(403);
  await moderateReview(buyer.authorization, comment.id, 'approved').expect(403);
  await moderateReview(salesAuth, comment.id, 'approved').expect(403);
  const { body: pending } = await server()
    .get('/api/staff/reviews?status=pending')
    .set('Authorization', managerAuth)
    .expect(200);
  assert.equal(
    pending.find((entry) => entry.id === comment.id).comment,
    'Runs well.',
  );

  await moderateReview(managerAuth, comment.id, 'approved').expect(200);
  await moderateReview(managerAuth, comment.id, 'rejected').expect(409);
  const audited = await prisma.review.findUnique({
    where: { orderItemId: BigInt(orderItemId) },
  });
  assert.equal(audited.moderatedBy, manager);
  assert.ok(audited.moderatedAt instanceof Date);
  const published = await detail();
  assert.equal(published.rating, 4);
  assert.equal(published.reviews, 1);
  assert.deepEqual(
    published.comments.map((entry) => entry.comment),
    ['Runs well.'],
  );
});

void test('repeated purchases can receive separate ratings and concurrent writes preserve totals', async () => {
  const buyer = await checkoutCustomer();
  const manager = await insertStaff(
    'product_manager',
    'review-concurrency@example.invalid',
  );
  const managerAuth = `Bearer ${await tokenFor(manager)}`;
  const product = await checkoutProduct('Repeated purchase review product');
  const purchases = [
    await purchaseReviewItems(buyer, [product]),
    await purchaseReviewItems(buyer, [product]),
  ];
  const itemIds = [];
  for (const {
    deliveries: [delivery],
  } of purchases) {
    await deliverReviewItem(managerAuth, delivery.id);
    itemIds.push(String(delivery.orderItemId));
  }

  const results = await Promise.all([
    submitReview(buyer, itemIds[0], 2, 'Keep this comment hidden.'),
    submitReview(buyer, itemIds[0], 3),
    submitReview(buyer, itemIds[1], 5),
  ]);
  assert.deepEqual(
    results.map((result) => result.status).sort((left, right) => left - right),
    [201, 201, 409],
  );
  const { body: detail } = await server()
    .get(`/api/products/${product}`)
    .expect(200);
  const stored = await prisma.review.findMany({
    where: { productId: BigInt(product) },
  });
  assert.equal(detail.reviews, 2);
  assert.equal(detail.rating, (stored[0].rating + stored[1].rating) / 2);

  // Ensure there is a pending comment regardless of which concurrent request won.
  let comment = stored.find((row) => row.comment);
  if (!comment) {
    const firstLine = stored.find(
      (row) => String(row.orderItemId) === itemIds[0],
    );
    const { body } = await submitReview(
      buyer,
      itemIds[0],
      firstLine.rating,
      'Keep this comment hidden.',
    ).expect(201);
    comment = { id: body.id };
  }
  const rejected = await moderateReview(
    managerAuth,
    comment.id,
    'rejected',
  ).expect(200);
  assert.equal(rejected.body.status, 'rejected');
  const { body: afterRejection } = await server()
    .get(`/api/products/${product}`)
    .expect(200);
  assert.deepEqual(afterRejection.comments, []);
  assert.equal(afterRejection.rating, detail.rating);
  assert.equal(afterRejection.reviews, 2);
});

void test('a deferred comment appears among recent comments as soon as it is approved', async () => {
  const buyer = await checkoutCustomer();
  const manager = await insertStaff(
    'product_manager',
    'review-publication@example.invalid',
  );
  const managerAuth = `Bearer ${await tokenFor(manager)}`;
  const product = await checkoutProduct('Review publication product');
  const {
    deliveries: [delivery],
  } = await purchaseReviewItems(buyer, [product]);
  await deliverReviewItem(managerAuth, delivery.id);
  const orderItemId = String(delivery.orderItemId);
  const { body: rating } = await submitReview(buyer, orderItemId, 4).expect(
    201,
  );

  await sql(
    "UPDATE public.reviews SET created_at = '2026-10-01T00:00:00Z' WHERE id = $1",
    [rating.id],
  );
  await sql(
    `INSERT INTO public.reviews
       (product_id, user_id, rating, comment, comment_status, moderated_by, moderated_at, created_at)
     SELECT reviews.product_id, reviews.user_id, 5, 'Earlier comment ' || series.n,
       'approved', $2, now() - interval '1 day', now() - interval '2 days'
     FROM public.reviews AS reviews CROSS JOIN generate_series(1, 20) AS series(n)
     WHERE reviews.id = $1`,
    [rating.id, manager],
  );

  const detail = async () =>
    (await server().get(`/api/products/${product}`).expect(200)).body;
  const text = 'This comment was added to an older rating.';
  await submitReview(buyer, orderItemId, 4, text).expect(201);
  const pending = await detail();
  assert.equal(pending.comments.length, 20);
  assert.ok(!pending.comments.some((comment) => comment.comment === text));

  const decisions = await Promise.all([
    moderateReview(managerAuth, rating.id, 'approved'),
    moderateReview(managerAuth, rating.id, 'approved'),
  ]);
  assert.deepEqual(
    decisions.map((response) => response.status).sort((a, b) => a - b),
    [200, 409],
  );
  const published = await detail();
  assert.equal(published.comments.length, 20);
  assert.equal(published.comments[0].comment, text);
  assert.equal(published.comments[0].createdAt, '2026-10-01T00:00:00.000Z');
  assert.ok(
    new Date(published.comments[0].publishedAt) >
      new Date(published.comments[1].publishedAt),
  );
});
