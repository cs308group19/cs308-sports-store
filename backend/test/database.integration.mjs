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
let failInvoiceEmail = false;
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
        if (failInvoiceEmail)
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
    totalCents: subtotalCents + deliveryCents + Math.round((subtotalCents * 8) / 100),
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

  const res = await checkout(account, await reviewedCartFor(account)).expect(201);
  const { orderId, orderNumber, invoiceId } = res.body;
  assert.deepEqual(Object.keys(res.body).sort(), [
    'invoiceId',
    'orderId',
    'orderNumber',
  ]);
  assert.match(orderId, /^\d+$/);
  assert.match(invoiceId, /^\d+$/);
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
  assert.equal(invoiceEmails.length, mailCount + 1);
});

void test('same-cart submissions are serialized and an email failure leaves the order available', async () => {
  const account = await checkoutCustomer();
  const product = await checkoutProduct('Checkout double submit product');
  await cartAdd(account, product, 2);
  const reviewedCart = await reviewedCartFor(account);
  const mailCount = invoiceEmails.length;

  failInvoiceEmail = true;
  let results;
  try {
    results = await Promise.all([
      checkout(account, reviewedCart),
      checkout(account, reviewedCart),
    ]);
  } finally {
    failInvoiceEmail = false;
  }

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
  const invoice = await prisma.invoice.findUnique({
    where: { id: BigInt(invoiceId) },
  });
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
  await sql('UPDATE public.products SET price = $2 WHERE id = $1', [first, '21.00']);
  await sql('UPDATE public.products SET price = $2 WHERE id = $1', [second, '18.00']);
  const refreshed = await reviewedCartFor(account);
  assert.equal(refreshed.totalCents, quantityUpdated.totalCents);
  await checkout(account, quantityUpdated).expect(409);
  await checkout(account, {
    ...refreshed,
    totalCents: refreshed.totalCents - 1,
  }).expect(409);

  assert.deepEqual(await checkoutCounts(account), before);
  assert.deepEqual(await reviewedCartFor(account), refreshed);
  assert.deepEqual(await productStock(first), { stock_quantity: 10, popularity: 0 });
  assert.deepEqual(await productStock(second), { stock_quantity: 10, popularity: 0 });
  assert.equal(invoiceEmails.length, mailCount);

  await checkout(account, refreshed).expect(201);
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
