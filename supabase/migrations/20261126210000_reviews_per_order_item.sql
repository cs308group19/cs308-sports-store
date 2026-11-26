-- A customer can review each delivered purchase of the same product.
-- Keep historical rows without an order item. PostgreSQL allows multiple NULLs
-- in a unique constraint.
begin;

alter table public.reviews
  add constraint reviews_unique_order_item unique (order_item_id),
  drop constraint reviews_unique_user_product;

drop index public.reviews_order_item_id_idx;

commit;
