-- A customer can review each delivered purchase of the same product.
-- Keep historical rows without an order item. PostgreSQL allows multiple NULLs
-- in a unique constraint.
-- Run the checks and schema changes together, including in migration runners
-- that execute each SQL statement separately.
do $$
begin
  lock table public.reviews in access exclusive mode;

  if exists (
    select 1
    from public.reviews
    where order_item_id is not null
    group by order_item_id
    having count(*) > 1
  ) then
    raise exception 'Multiple reviews reference the same order item.'
      using hint = 'Reconcile the existing review links before applying this migration.';
  end if;

  if exists (
    select 1
    from public.reviews as review
    join public.order_items as item on item.id = review.order_item_id
    join public.orders as purchase on purchase.id = item.order_id
    where review.user_id <> purchase.user_id
       or review.product_id <> item.product_id
       or (review.order_id is not null and review.order_id <> item.order_id)
  ) then
    raise exception 'A review references a purchase that does not match its customer, product, or order.'
      using hint = 'Reconcile the existing review links before applying this migration.';
  end if;

  alter table public.reviews
    add constraint reviews_unique_order_item unique (order_item_id),
    drop constraint reviews_unique_user_product;

  drop index public.reviews_order_item_id_idx;
  create index reviews_user_id_idx on public.reviews (user_id);
end;
$$;
