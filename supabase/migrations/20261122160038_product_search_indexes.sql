-- SCRUM-12 / SCRUM-28: indexes for the product search.
--
-- GET /api/products?q= matches every word against the name or the description with
-- ILIKE '%word%'. A plain B-tree index cannot serve a pattern with a leading
-- wildcard; trigram GIN indexes can.
--
-- Supabase keeps add-ons in the extensions schema, outside the public API schema.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- "if not exists" alone does not move an earlier installation out of public.
do $$
begin
  if exists (
    select 1
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
     where e.extname = 'pg_trgm' and n.nspname <> 'extensions'
  ) then
    alter extension pg_trgm set schema extensions;
  end if;
end;
$$;

create index if not exists products_name_trgm_idx
  on public.products using gin (name extensions.gin_trgm_ops);

create index if not exists products_description_trgm_idx
  on public.products using gin (description extensions.gin_trgm_ops);
