-- RALLY / Team308: PostgreSQL proposal for the progress demo.
-- Run against a fresh development database. The entire schema is installed atomically.
BEGIN;

CREATE TABLE users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name text NOT NULL CHECK (btrim(full_name) <> ''),
    email text NOT NULL CHECK (email = lower(btrim(email)) AND email <> ''),
    password_hash text NOT NULL CHECK (password_hash <> ''),
    role text NOT NULL DEFAULT 'customer'
        CHECK (role IN ('customer', 'product_manager', 'sales_manager', 'support_agent')),
    home_address text,
    tax_id_ciphertext bytea,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (email)
);

CREATE TABLE categories (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL CHECK (btrim(name) <> ''),
    slug text NOT NULL UNIQUE CHECK (btrim(slug) <> ''),
    archived_at timestamptz
);

CREATE TABLE products (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id bigint NOT NULL REFERENCES categories (id),
    name text NOT NULL CHECK (btrim(name) <> ''),
    model text NOT NULL,
    serial_number text NOT NULL UNIQUE,
    description text NOT NULL,
    stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    price numeric(12, 2) NOT NULL CHECK (price >= 0),
    cost numeric(12, 2) CHECK (cost >= 0),
    image_url text,
    warranty_status text NOT NULL,
    distributor_info text NOT NULL,
    archived_at timestamptz
);

CREATE INDEX products_category_idx ON products (category_id);

CREATE TABLE carts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    guest_token_hash bytea UNIQUE CHECK (octet_length(guest_token_hash) = 32),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((user_id IS NULL) <> (guest_token_hash IS NULL))
);

CREATE TABLE cart_items (
    cart_id bigint NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
    product_id bigint NOT NULL REFERENCES products (id),
    quantity integer NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (cart_id, product_id)
);

CREATE TABLE orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id bigint NOT NULL REFERENCES users (id),
    checkout_key uuid NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    shipping_address text NOT NULL CHECK (btrim(shipping_address) <> ''),
    currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    status text NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'in_transit', 'delivered', 'cancelled')),
    placed_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz,
    UNIQUE (customer_id, checkout_key),
    CHECK ((status = 'delivered') = (delivered_at IS NOT NULL)),
    CHECK (delivered_at >= placed_at)
);

CREATE INDEX orders_customer_history_idx ON orders (customer_id, placed_at DESC);

CREATE TABLE order_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL REFERENCES orders (id),
    product_id bigint NOT NULL REFERENCES products (id),
    product_name text NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price_paid numeric(12, 2) NOT NULL CHECK (unit_price_paid >= 0),
    line_total numeric(24, 2) GENERATED ALWAYS AS (quantity * unit_price_paid) STORED,
    UNIQUE (order_id, product_id)
);

CREATE INDEX order_items_product_idx ON order_items (product_id);

-- Store the result of a simulated payment. Card fields stay out of the database.
CREATE TABLE payments (
    order_id bigint PRIMARY KEY REFERENCES orders (id),
    mock_reference text NOT NULL UNIQUE,
    amount numeric(24, 2) NOT NULL CHECK (amount >= 0),
    confirmed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
    order_id bigint PRIMARY KEY REFERENCES payments (order_id),
    invoice_number text NOT NULL UNIQUE,
    issued_at timestamptz NOT NULL DEFAULT now(),
    pdf_object_key text,
    emailed_at timestamptz
);

-- The order line identifies both the purchased product and its customer.
-- The backend checks ownership and delivered status before accepting a review.
CREATE TABLE reviews (
    order_item_id bigint PRIMARY KEY REFERENCES order_items (id),
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment text,
    comment_status text CHECK (comment_status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((comment IS NULL) = (comment_status IS NULL)),
    CHECK (btrim(comment) <> '')
);

-- The demo uses one delivery per order. Each row describes a product to deliver.
CREATE VIEW delivery_list AS
SELECT
    orders.id AS delivery_id,
    orders.customer_id,
    order_items.product_id,
    order_items.quantity,
    order_items.line_total AS total_price,
    orders.shipping_address AS delivery_address,
    orders.status,
    orders.status = 'delivered' AS completed
FROM orders
JOIN order_items ON order_items.order_id = orders.id
WHERE orders.status <> 'cancelled';

COMMIT;
