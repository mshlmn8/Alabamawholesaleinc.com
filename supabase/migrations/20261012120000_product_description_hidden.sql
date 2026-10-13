-- A product shown without a description (AW-023).
--
-- The storefront shows the description bundled with the site
-- (src/data/products.js) whenever products.description is empty: rows saved
-- before 20260927120000_product_copy.sql filled the column have '' there.
-- So staff could correct a wrong description but never remove one: clearing
-- the field in Admin -> Products brought the bundled text back.
--
-- products.description_hidden (default false) says "show no description":
-- the product page then has no description line at all, neither the stored
-- or bundled text nor the generic "Wholesale ... from ..." sentence. Admin ->
-- Products' "Show no description" box sets it; the text stays in
-- description, so unticking the box shows it again.
--
-- Who may do what: everyone reads it, like every products column but price
-- (products uses column privileges since 20261009100000, so a new column is
-- invisible to guests and signed-in accounts until it is granted). Only
-- approved admins change it: products_admin_write (RLS) already limits
-- UPDATE to is_admin().
--
-- Release: with or after 20261010120000, before or after the frontend. No
-- seed change: the seed leaves the column out, so every row keeps the
-- default. The frontend deployed before it doesn't read the column. The new
-- frontend works before and after: the storefront asks for it together with
-- featured_rank (CATALOG_RANKED_COLUMNS in src/lib/catalog.jsx) and, on a
-- database without it (42703), reads the catalog without both, so while
-- 20261010120000 is applied and this file isn't, the homepage rails follow
-- the tags without a rank; Admin -> Products hides the box until its load
-- sees the column.

alter table public.products
  add column if not exists description_hidden boolean not null default false;

grant select (description_hidden) on public.products to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this migration.
-- The frontend works without it, so no deploy is needed first. Products that
-- had the box ticked show their description again.
--
-- revoke select (description_hidden) on public.products from anon, authenticated;
-- alter table public.products drop column if exists description_hidden;
