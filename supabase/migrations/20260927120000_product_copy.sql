-- Product copy: the description shown on the product page and the sell unit
-- ("5-pack", "25-count box") that says what quantity 1 means. Both are seeded
-- from src/data/products.js by supabase/seed/products.sql and read by the
-- storefront through useCatalog(). Additive only; existing rows default to ''.

alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists sell_unit text not null default '';
