-- Store domain schema for CS308 Sports Store (RALLY)
--
-- Covers catalogue, inventory & variants, discounts, carts & wishlist,
-- orders, simulated payments, invoices, deliveries, reviews, returns & refunds,
-- customer notifications, and live support conversations.
--
-- Access pattern: all browser access goes through the NestJS backend (Prisma),
-- which connects as the database owner. Every table in public has RLS enabled
-- and privileges revoked from anon, authenticated, and public.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.warranty_status as enum (
  'active',
  'expired',
  'not_applicable'
);

create type public.order_status as enum (
  'processing',
  'in_transit',
  'delivered',
  'cancelled'
);

create type public.payment_status as enum (
  'pending',
  'succeeded',
  'failed',
  'refunded'
);

create type public.review_status as enum (
  'not_applicable',
  'pending',
  'approved',
  'rejected'
);

create type public.return_status as enum (
  'requested',
  'received',
  'approved',
  'rejected',
  'refunded'
);

create type public.conversation_status as enum (
  'waiting',
  'active',
  'resolved',
  'closed'
);

-- ---------------------------------------------------------------------------
-- Accounts & Addresses
-- ---------------------------------------------------------------------------

create table public.addresses (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  recipient_name text not null,
  street_address text not null,
  city text not null,
  postal_code text,
  country text not null default 'Turkey',
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addresses_recipient_name_length check (char_length(btrim(recipient_name)) between 1 and 120),
  constraint addresses_street_length check (char_length(btrim(street_address)) between 3 and 500),
  constraint addresses_city_length check (char_length(btrim(city)) between 1 and 120)
);

create index addresses_user_id_idx on public.addresses (user_id);

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue & Discounts
-- ---------------------------------------------------------------------------

create table public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint categories_slug_lowercase check (slug = lower(slug))
);

create trigger categories_set_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

create table public.products (
  id bigint generated always as identity primary key,
  sku text not null unique,
  name text not null,
  model text not null,
  serial_number text not null unique,
  description text not null,
  category_id bigint not null references public.categories (id) on delete restrict,
  stock_quantity integer not null default 0,
  price numeric(12, 2) not null,
  discount_rate numeric(5, 2) not null default 0.00,
  cost numeric(12, 2),
  warranty_status public.warranty_status not null default 'active',
  warranty_term text not null default '24 months',
  distributor text not null,
  image_url text,
  popularity integer not null default 0,
  average_rating numeric(3, 2) not null default 0.00,
  review_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_stock_quantity_non_negative check (stock_quantity >= 0),
  constraint products_price_non_negative check (price >= 0),
  constraint products_discount_rate_range check (discount_rate >= 0 and discount_rate <= 100),
  constraint products_cost_non_negative check (cost is null or cost >= 0),
  constraint products_popularity_non_negative check (popularity >= 0),
  constraint products_average_rating_range check (average_rating >= 0 and average_rating <= 5),
  constraint products_review_count_non_negative check (review_count >= 0)
);

create index products_category_id_idx on public.products (category_id);
create index products_active_popularity_idx on public.products (is_active, popularity desc);

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

create table public.product_variants (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  sku text not null unique,
  size text,
  color text,
  stock_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_stock_non_negative check (stock_quantity >= 0),
  constraint product_variants_unique_attrs unique nulls not distinct (product_id, size, color)
);

create index product_variants_product_id_idx on public.product_variants (product_id);

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row
  execute function public.set_updated_at();

create table public.discounts (
  id bigint generated always as identity primary key,
  name text,
  discount_rate numeric(5, 2) not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discounts_rate_range check (discount_rate > 0 and discount_rate <= 100),
  constraint discounts_window_valid check (ends_at is null or ends_at > starts_at)
);

create index discounts_created_by_idx on public.discounts (created_by);

create trigger discounts_set_updated_at
  before update on public.discounts
  for each row
  execute function public.set_updated_at();

create table public.product_discounts (
  id bigint generated always as identity primary key,
  discount_id bigint not null references public.discounts (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint product_discounts_unique_pair unique (discount_id, product_id)
);

create index product_discounts_discount_id_idx on public.product_discounts (discount_id);
create index product_discounts_product_id_idx on public.product_discounts (product_id);

-- ---------------------------------------------------------------------------
-- Shopping Cart & Wishlist
-- ---------------------------------------------------------------------------

create table public.carts (
  id bigint generated always as identity primary key,
  user_id uuid unique references public.profiles (id) on delete cascade,
  guest_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carts_owner_present check (user_id is not null or guest_token is not null)
);

create trigger carts_set_updated_at
  before update on public.carts
  for each row
  execute function public.set_updated_at();

create table public.cart_items (
  id bigint generated always as identity primary key,
  cart_id bigint not null references public.carts (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  variant_id bigint references public.product_variants (id) on delete set null,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_quantity_positive check (quantity > 0),
  constraint cart_items_unique_line unique nulls not distinct (cart_id, product_id, variant_id)
);

create index cart_items_cart_id_idx on public.cart_items (cart_id);
create index cart_items_product_id_idx on public.cart_items (product_id);
create index cart_items_variant_id_idx on public.cart_items (variant_id);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row
  execute function public.set_updated_at();

create table public.wishlist_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint wishlist_items_unique_pair unique (user_id, product_id)
);

create index wishlist_items_product_id_idx on public.wishlist_items (product_id);

-- ---------------------------------------------------------------------------
-- Orders, Payments, Invoices & Deliveries
-- ---------------------------------------------------------------------------

create table public.orders (
  id bigint generated always as identity primary key,
  order_number text not null unique,
  user_id uuid not null references public.profiles (id) on delete restrict,
  status public.order_status not null default 'processing',
  subtotal numeric(12, 2) not null,
  discount_total numeric(12, 2) not null default 0.00,
  tax_amount numeric(12, 2) not null default 0.00,
  total_amount numeric(12, 2) not null,
  delivery_recipient text not null,
  delivery_address text not null,
  delivery_city text,
  delivery_postal_code text,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_subtotal_non_negative check (subtotal >= 0),
  constraint orders_discount_total_non_negative check (discount_total >= 0),
  constraint orders_tax_amount_non_negative check (tax_amount >= 0),
  constraint orders_total_amount_non_negative check (total_amount >= 0)
);

create index orders_user_id_idx on public.orders (user_id);
create index orders_status_created_at_idx on public.orders (status, created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete restrict,
  variant_id bigint references public.product_variants (id) on delete set null,
  product_name text not null,
  product_model text,
  quantity integer not null,
  unit_list_price numeric(12, 2) not null,
  discount_rate numeric(5, 2) not null default 0.00,
  unit_price_paid numeric(12, 2) not null,
  unit_cost numeric(12, 2) not null default 0.00,
  line_total numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_unit_list_price_non_negative check (unit_list_price >= 0),
  constraint order_items_discount_rate_range check (discount_rate >= 0 and discount_rate <= 100),
  constraint order_items_unit_price_paid_non_negative check (unit_price_paid >= 0),
  constraint order_items_unit_cost_non_negative check (unit_cost >= 0),
  constraint order_items_line_total_non_negative check (line_total >= 0)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);
create index order_items_variant_id_idx on public.order_items (variant_id);

create table public.payments (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  status public.payment_status not null default 'pending',
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  card_brand text,
  card_last4 text,
  transaction_ref text unique,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payments_amount_non_negative check (amount >= 0),
  constraint payments_card_last4_length check (card_last4 is null or char_length(card_last4) = 4)
);

create index payments_order_id_idx on public.payments (order_id);

create table public.invoices (
  id bigint generated always as identity primary key,
  invoice_number text not null unique,
  order_id bigint not null unique references public.orders (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  billed_to_name text not null,
  billed_to_address text not null,
  subtotal numeric(12, 2) not null,
  tax_amount numeric(12, 2) not null default 0.00,
  total_amount numeric(12, 2) not null,
  pdf_storage_path text,
  email_status text not null default 'pending',
  email_error text,
  emailed_at timestamptz,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint invoices_subtotal_non_negative check (subtotal >= 0),
  constraint invoices_tax_amount_non_negative check (tax_amount >= 0),
  constraint invoices_total_amount_non_negative check (total_amount >= 0),
  constraint invoices_email_status_valid check (email_status in ('pending', 'sent', 'failed'))
);

create index invoices_user_id_idx on public.invoices (user_id);
create index invoices_issued_at_idx on public.invoices (issued_at desc);

create table public.deliveries (
  id bigint generated always as identity primary key,
  delivery_number text not null unique,
  order_id bigint not null references public.orders (id) on delete cascade,
  order_item_id bigint references public.order_items (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  product_id bigint not null references public.products (id) on delete restrict,
  quantity integer not null,
  total_price numeric(12, 2) not null,
  delivery_address text not null,
  status public.order_status not null default 'processing',
  is_completed boolean not null default false,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deliveries_quantity_positive check (quantity > 0),
  constraint deliveries_total_price_non_negative check (total_price >= 0)
);

create index deliveries_order_id_idx on public.deliveries (order_id);
create index deliveries_order_item_id_idx on public.deliveries (order_item_id);
create index deliveries_customer_id_idx on public.deliveries (customer_id);
create index deliveries_product_id_idx on public.deliveries (product_id);

create trigger deliveries_set_updated_at
  before update on public.deliveries
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reviews, Returns & Refunds
-- ---------------------------------------------------------------------------

create table public.reviews (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id bigint references public.orders (id) on delete set null,
  order_item_id bigint references public.order_items (id) on delete set null,
  rating smallint not null,
  comment text,
  comment_status public.review_status not null default 'pending',
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_unique_user_product unique (user_id, product_id)
);

create index reviews_product_id_idx on public.reviews (product_id);
create index reviews_order_id_idx on public.reviews (order_id);
create index reviews_order_item_id_idx on public.reviews (order_item_id);
create index reviews_moderated_by_idx on public.reviews (moderated_by);
create index reviews_comment_status_idx on public.reviews (comment_status);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row
  execute function public.set_updated_at();

create table public.return_requests (
  id bigint generated always as identity primary key,
  return_number text not null unique,
  order_id bigint not null references public.orders (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  status public.return_status not null default 'requested',
  reason text not null,
  requested_at timestamptz not null default now(),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint return_requests_reason_length check (char_length(btrim(reason)) between 1 and 1000)
);

create index return_requests_order_id_idx on public.return_requests (order_id);
create index return_requests_user_id_idx on public.return_requests (user_id);
create index return_requests_resolved_by_idx on public.return_requests (resolved_by);

create trigger return_requests_set_updated_at
  before update on public.return_requests
  for each row
  execute function public.set_updated_at();

create table public.return_items (
  id bigint generated always as identity primary key,
  return_request_id bigint not null references public.return_requests (id) on delete cascade,
  order_item_id bigint not null references public.order_items (id) on delete restrict,
  product_id bigint not null references public.products (id) on delete restrict,
  quantity integer not null,
  unit_price_paid numeric(12, 2) not null,
  refund_amount numeric(12, 2) not null,
  stock_restored boolean not null default false,
  stock_restored_at timestamptz,
  created_at timestamptz not null default now(),
  constraint return_items_quantity_positive check (quantity > 0),
  constraint return_items_unit_price_paid_non_negative check (unit_price_paid >= 0),
  constraint return_items_refund_amount_non_negative check (refund_amount >= 0),
  constraint return_items_unique_item unique (return_request_id, order_item_id)
);

create index return_items_return_request_id_idx on public.return_items (return_request_id);
create index return_items_order_item_id_idx on public.return_items (order_item_id);
create index return_items_product_id_idx on public.return_items (product_id);

create table public.refunds (
  id bigint generated always as identity primary key,
  return_request_id bigint not null unique references public.return_requests (id) on delete restrict,
  order_id bigint not null references public.orders (id) on delete restrict,
  payment_id bigint references public.payments (id) on delete set null,
  approved_by uuid not null references public.profiles (id) on delete restrict,
  amount numeric(12, 2) not null,
  status public.payment_status not null default 'succeeded',
  notified_at timestamptz,
  refunded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint refunds_amount_non_negative check (amount >= 0)
);

create index refunds_order_id_idx on public.refunds (order_id);
create index refunds_payment_id_idx on public.refunds (payment_id);
create index refunds_approved_by_idx on public.refunds (approved_by);

-- ---------------------------------------------------------------------------
-- Notifications & Live Support
-- ---------------------------------------------------------------------------

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  product_id bigint references public.products (id) on delete set null,
  order_id bigint references public.orders (id) on delete set null,
  is_read boolean not null default false,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_valid check (type in ('discount', 'refund', 'order', 'delivery'))
);

create index notifications_user_id_idx on public.notifications (user_id, is_read, created_at desc);
create index notifications_product_id_idx on public.notifications (product_id);
create index notifications_order_id_idx on public.notifications (order_id);

create table public.support_conversations (
  id bigint generated always as identity primary key,
  customer_id uuid references public.profiles (id) on delete set null,
  guest_token text,
  guest_name text,
  guest_email text,
  assigned_agent_id uuid references public.profiles (id) on delete set null,
  subject text,
  status public.conversation_status not null default 'waiting',
  claimed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_conversations_owner_present check (customer_id is not null or guest_token is not null)
);

create index support_conversations_customer_id_idx on public.support_conversations (customer_id);
create index support_conversations_assigned_agent_id_idx on public.support_conversations (assigned_agent_id);
create index support_conversations_status_idx on public.support_conversations (status, created_at);
create index support_conversations_guest_token_idx on public.support_conversations (guest_token)
  where guest_token is not null;

create trigger support_conversations_set_updated_at
  before update on public.support_conversations
  for each row
  execute function public.set_updated_at();

create table public.support_messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.support_conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  sender_type text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_sender_type_valid check (sender_type in ('customer', 'guest', 'agent'))
);

create index support_messages_conversation_id_idx on public.support_messages (conversation_id, created_at);
create index support_messages_sender_id_idx on public.support_messages (sender_id);

create table public.support_attachments (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.support_messages (id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  media_category text not null,
  size_bytes bigint not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint support_attachments_media_category_valid check (media_category in ('pdf', 'image', 'video')),
  constraint support_attachments_size_valid check (size_bytes > 0 and size_bytes <= 26214400)
);

create index support_attachments_message_id_idx on public.support_attachments (message_id);

-- ---------------------------------------------------------------------------
-- Row Level Security & Least-Privilege Grants
-- ---------------------------------------------------------------------------

alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.discounts enable row level security;
alter table public.product_discounts enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.deliveries enable row level security;
alter table public.reviews enable row level security;
alter table public.return_requests enable row level security;
alter table public.return_items enable row level security;
alter table public.refunds enable row level security;
alter table public.notifications enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_attachments enable row level security;

revoke all on table
  public.addresses,
  public.categories,
  public.products,
  public.product_variants,
  public.discounts,
  public.product_discounts,
  public.carts,
  public.cart_items,
  public.wishlist_items,
  public.orders,
  public.order_items,
  public.payments,
  public.invoices,
  public.deliveries,
  public.reviews,
  public.return_requests,
  public.return_items,
  public.refunds,
  public.notifications,
  public.support_conversations,
  public.support_messages,
  public.support_attachments
from anon, authenticated, public;
