-- Optional. Apply after schema.sql on a database that supports pg_trgm.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_name_trgm_idx
    ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_description_trgm_idx
    ON products USING gin (description gin_trgm_ops);

COMMIT;
