-- SCRUM-29: Popularity comes only from sales, not hand-written seed numbers.
-- Recompute every product's popularity from non-cancelled order items so
-- already-seeded databases drop the old 64..98 seed values while preserving
-- real sales counts. Idempotent and safe on empty databases.
update public.products as p
set popularity = s.sold
from (
  select
    p2.id,
    coalesce(sum(active_items.quantity), 0)::integer as sold
  from public.products as p2
  left join (
    select oi.product_id, oi.quantity
    from public.order_items as oi
    join public.orders as o on o.id = oi.order_id
    where o.status <> 'cancelled'
  ) as active_items on active_items.product_id = p2.id
  group by p2.id
) as s
where p.id = s.id
  and p.popularity is distinct from s.sold;
