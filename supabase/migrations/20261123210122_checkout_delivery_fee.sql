-- Old invoices derive delivery from the amounts already saved with the order.
alter table public.orders
  add column delivery_fee numeric(12, 2),
  add constraint orders_delivery_fee_valid
    check (delivery_fee >= 0 and delivery_fee <> 'NaN'::numeric);

alter table public.invoices
  add column delivery_fee numeric(12, 2),
  add constraint invoices_delivery_fee_valid
    check (delivery_fee >= 0 and delivery_fee <> 'NaN'::numeric);
