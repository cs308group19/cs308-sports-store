-- SCRUM-12: progress-demo store tables, after SCRUM-19's profiles migrations.
-- Supabase Auth owns passwords; public.profiles is the only application identity.
-- Access is through the NestJS backend (database owner), never the browser Data API.
-- This replaces the unmerged database/schema.sql draft. If that draft has already
-- been run manually, STOP and reconcile its data before applying this migration.
BEGIN;

CREATE TABLE public.categories (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL CHECK (btrim(name) <> ''),
    slug text NOT NULL UNIQUE CHECK (btrim(slug) <> ''),
    archived_at timestamptz
);

CREATE TABLE public.products (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id bigint NOT NULL REFERENCES public.categories (id),
    name text NOT NULL CHECK (btrim(name) <> ''),
    model text NOT NULL,
    serial_number text NOT NULL UNIQUE,
    description text NOT NULL,
    stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    price numeric(12, 2) NOT NULL CHECK (price >= 0 AND price <> 'NaN'::numeric),
    cost numeric(12, 2) CHECK (cost >= 0 AND cost <> 'NaN'::numeric),
    image_url text,
    warranty_status text NOT NULL,
    distributor_info text NOT NULL,
    archived_at timestamptz
);

CREATE INDEX products_category_idx ON public.products (category_id);

CREATE TABLE public.carts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid UNIQUE REFERENCES public.profiles (id) ON DELETE CASCADE,
    guest_token_hash bytea UNIQUE CHECK (octet_length(guest_token_hash) = 32),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((user_id IS NULL) <> (guest_token_hash IS NULL))
);

CREATE TABLE public.cart_items (
    cart_id bigint NOT NULL REFERENCES public.carts (id) ON DELETE CASCADE,
    product_id bigint NOT NULL REFERENCES public.products (id),
    quantity integer NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (cart_id, product_id)
);

CREATE INDEX cart_items_product_idx ON public.cart_items (product_id);

CREATE TABLE public.orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id uuid NOT NULL REFERENCES public.profiles (id),
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

CREATE INDEX orders_customer_history_idx ON public.orders (customer_id, placed_at DESC);

CREATE TABLE public.order_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL REFERENCES public.orders (id),
    product_id bigint NOT NULL REFERENCES public.products (id),
    product_name text NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price_paid numeric(12, 2) NOT NULL CHECK (unit_price_paid >= 0 AND unit_price_paid <> 'NaN'::numeric),
    line_total numeric(24, 2) GENERATED ALWAYS AS (quantity * unit_price_paid) STORED NOT NULL,
    UNIQUE (order_id, product_id)
);

CREATE INDEX order_items_product_idx ON public.order_items (product_id);

-- Store the result of a simulated payment. Card fields stay out of the database.
CREATE TABLE public.payments (
    order_id bigint PRIMARY KEY REFERENCES public.orders (id),
    mock_reference text NOT NULL UNIQUE,
    amount numeric(24, 2) NOT NULL CHECK (amount >= 0 AND amount <> 'NaN'::numeric),
    confirmed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.invoices (
    order_id bigint PRIMARY KEY REFERENCES public.payments (order_id),
    invoice_number text NOT NULL UNIQUE,
    issued_at timestamptz NOT NULL DEFAULT now(),
    pdf_object_key text,
    emailed_at timestamptz
);

-- The order line identifies both the purchased product and its customer.
-- The backend checks ownership and delivered status before accepting a review.
CREATE TABLE public.reviews (
    order_item_id bigint PRIMARY KEY REFERENCES public.order_items (id),
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment text,
    comment_status text CHECK (comment_status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((comment IS NULL) = (comment_status IS NULL)),
    CHECK (btrim(comment) <> '')
);

-- The demo uses one delivery per order. Each row describes a product to deliver.
CREATE VIEW public.delivery_list WITH (security_invoker = true) AS
SELECT
    orders.id AS delivery_id,
    orders.customer_id,
    order_items.product_id,
    order_items.quantity,
    order_items.line_total AS total_price,
    orders.shipping_address AS delivery_address,
    orders.status,
    orders.status = 'delivered' AS completed
FROM public.orders
JOIN public.order_items ON order_items.order_id = orders.id
WHERE orders.status <> 'cancelled';

-- Match profiles' backend-only access model. No browser policies are added.
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Views and sequences need explicit protection too; RLS applies only to tables.
REVOKE ALL ON TABLE public.categories, public.products, public.carts,
    public.cart_items, public.orders, public.order_items, public.payments,
    public.invoices, public.reviews, public.delivery_list
    FROM anon, authenticated, PUBLIC;
REVOKE ALL ON SEQUENCE public.categories_id_seq, public.products_id_seq,
    public.carts_id_seq, public.orders_id_seq, public.order_items_id_seq
    FROM anon, authenticated, PUBLIC;

COMMIT;
