-- SCRUM-12: case-insensitive substring search; applied after store_tables.
-- Supabase keeps add-ons in extensions, outside the public API schema.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- IF NOT EXISTS alone does not relocate an earlier installation in public.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'pg_trgm' AND n.nspname <> 'extensions'
    ) THEN
        ALTER EXTENSION pg_trgm SET SCHEMA extensions;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS products_name_trgm_idx
    ON public.products USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_description_trgm_idx
    ON public.products USING gin (description extensions.gin_trgm_ops);

COMMIT;
