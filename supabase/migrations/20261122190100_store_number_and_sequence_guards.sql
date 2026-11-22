-- SCRUM-12: guards carried over from the earlier store-table proposal (closed PR #3).
--
-- 1. NaN amounts. PostgreSQL sorts NaN above every number, so a check such as
--    "price >= 0" lets 'NaN' through. A NaN price or total would break every
--    calculation that reads it (the catalogue API answers 500), so each money
--    column rejects it. Rates and ratings already have an upper bound, which NaN
--    fails.
--
-- 2. Identity sequences. Supabase grants anon and authenticated every privilege on
--    new sequences by default. They cannot insert rows (table privileges are
--    revoked), but they could still burn ids with nextval(). All browser access
--    goes through the backend, so they need no sequence access at all.

alter table public.products
  add constraint products_price_not_nan check (price <> 'NaN'),
  add constraint products_cost_not_nan check (cost <> 'NaN');

alter table public.orders
  add constraint orders_subtotal_not_nan check (subtotal <> 'NaN'),
  add constraint orders_discount_total_not_nan check (discount_total <> 'NaN'),
  add constraint orders_tax_amount_not_nan check (tax_amount <> 'NaN'),
  add constraint orders_total_amount_not_nan check (total_amount <> 'NaN');

alter table public.order_items
  add constraint order_items_unit_list_price_not_nan check (unit_list_price <> 'NaN'),
  add constraint order_items_unit_price_paid_not_nan check (unit_price_paid <> 'NaN'),
  add constraint order_items_unit_cost_not_nan check (unit_cost <> 'NaN'),
  add constraint order_items_line_total_not_nan check (line_total <> 'NaN');

alter table public.payments
  add constraint payments_amount_not_nan check (amount <> 'NaN');

alter table public.invoices
  add constraint invoices_subtotal_not_nan check (subtotal <> 'NaN'),
  add constraint invoices_tax_amount_not_nan check (tax_amount <> 'NaN'),
  add constraint invoices_total_amount_not_nan check (total_amount <> 'NaN');

alter table public.deliveries
  add constraint deliveries_total_price_not_nan check (total_price <> 'NaN');

alter table public.return_items
  add constraint return_items_unit_price_paid_not_nan check (unit_price_paid <> 'NaN'),
  add constraint return_items_refund_amount_not_nan check (refund_amount <> 'NaN');

alter table public.refunds
  add constraint refunds_amount_not_nan check (amount <> 'NaN');

revoke all on all sequences in schema public from anon, authenticated, public;
