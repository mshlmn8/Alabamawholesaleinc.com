-- Admin product editor (AW-023, AW-116, AW-119).
--
-- Admin -> Products gets a full editor (src/pages/admin/ProductEditor.jsx):
-- new products, every column of a product, photos, a stock status and a
-- homepage rank, and delete. This file gives the database what the editor
-- needs, and checks what it may save:
--
--   (a) products.id gets a default from a sequence, so a new product is
--       inserted without an id. The seed inserts explicit ids after the
--       migrations, so its last statement moves the sequence past them
--       (scripts/build-seed.mjs).
--   (b) A SKU is used once, whatever its case or surrounding spaces: a unique
--       index on upper(btrim(sku)), created only when the table has no such
--       duplicates (otherwise a notice says so and the editor's own check is
--       the only one).
--   (c) A product has a name and a brand, and a list price of at most
--       99,999.99 (AW-116; price >= 0 is products_price_nonnegative, from
--       20261009100000). Added NOT VALID: rows already in the table are not
--       checked, every insert and update is.
--   (d) products.stock_status ('in_stock', 'low', 'out', 'discontinued';
--       staff only for now, AW-023) and products.featured_rank (1-999, the
--       order of the homepage rails, AW-119), readable like every other
--       column but price.
--   (e) A product that order lines refer to can't be deleted (errcode 23503,
--       hint product_has_orders): order_items.product_id is ON DELETE SET
--       NULL, so the order history would silently lose its link. Deactivate
--       it instead.
--   (f) A public storage bucket, product-images (JPEG, PNG or WebP, at most
--       5 MB), that only approved admins write to (and list). The editor uploads to
--       products/<id>/<time>-<name>.<ext> and saves the public URL in
--       products.img.
--
-- Supabase's default privileges give anon and authenticated every privilege
-- on a new sequence or function: each one below is revoked and granted
-- explicitly.
--
-- Release order: after 20261009150000 (and the other 2026101012xxxx files
-- before this one), then the regenerated seed (its last statement moves the
-- id sequence past the seeded ids), then the frontend. The new frontend also
-- works before this file: a new product is inserted with the next free id
-- when the database has no id default (23502), stock status and homepage
-- rank say they need this update, a photo upload says so too (a file name or
-- URL still works), the editor counts a product's order lines before it
-- offers Delete, and the homepage rails follow the tags without a rank.
-- The frontend deployed before it doesn't read the new columns.
-- TODO(owner): How should a low or out-of-stock product show to buyers (a badge, a note, refusing the line), or should stock status stay staff only? (AW-023)

-- ---------------------------------------------------------------------------
-- (a) products.id default.
-- ---------------------------------------------------------------------------
create sequence if not exists public.products_id_seq as integer owned by public.products.id;

-- Past every id in the table, and never back: running this file again keeps
-- a sequence that is already ahead.
select setval(
  'public.products_id_seq',
  greatest(
    coalesce((select max(id) from public.products), 0) + 1,
    (select case when is_called then last_value + 1 else last_value end from public.products_id_seq)
  ),
  false
);

alter table public.products alter column id set default nextval('public.products_id_seq');

-- An admin's insert takes the next value (RLS products_admin_write still
-- limits inserts to admins); guests get nothing.
revoke all on sequence public.products_id_seq from public, anon, authenticated;
grant usage on sequence public.products_id_seq to authenticated;
grant all on sequence public.products_id_seq to service_role;

-- ---------------------------------------------------------------------------
-- (b) One product per SKU, case-insensitively.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.products group by upper(btrim(sku)) having count(*) > 1
  ) then
    raise notice 'products_sku_upper_key was not created: some SKUs are used by more than one product. Find them with: select upper(btrim(sku)), array_agg(id) from public.products group by 1 having count(*) > 1; then fix them and run this block again.';
  else
    create unique index if not exists products_sku_upper_key on public.products (upper(btrim(sku)));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- (c) A name, a brand, and a list price below 100,000 (AW-116). NOT VALID:
-- the live rows are not known here; new writes are checked.
-- ---------------------------------------------------------------------------
alter table public.products drop constraint if exists products_name_brand_present;
alter table public.products add constraint products_name_brand_present
  check (btrim(name) <> '' and btrim(brand) <> '') not valid;

alter table public.products drop constraint if exists products_price_max;
alter table public.products add constraint products_price_max
  check (price <= 99999.99) not valid;

-- ---------------------------------------------------------------------------
-- (d) Stock status (AW-023) and homepage rank (AW-119).
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists stock_status text not null default 'in_stock',
  add column if not exists featured_rank integer;

alter table public.products drop constraint if exists products_stock_status_chk;
alter table public.products add constraint products_stock_status_chk
  check (stock_status in ('in_stock', 'low', 'out', 'discontinued'));

alter table public.products drop constraint if exists products_featured_rank_chk;
alter table public.products add constraint products_featured_rank_chk
  check (featured_rank between 1 and 999);

-- products uses column privileges since 20261009100000: a new column is
-- invisible until it is granted. price stays out.
grant select (stock_status, featured_rank) on public.products to anon, authenticated;

-- ---------------------------------------------------------------------------
-- (e) Order history keeps its products.
-- ---------------------------------------------------------------------------
create or replace function public.refuse_product_delete_with_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.order_items where product_id = old.id) then
    raise exception 'Product % is on order lines and can''t be deleted; deactivate it instead.', old.id
      using errcode = '23503', hint = 'product_has_orders';
  end if;
  return old;
end;
$$;

-- A trigger function: nobody calls it directly.
revoke all on function public.refuse_product_delete_with_orders() from public, anon, authenticated;

drop trigger if exists products_keep_order_history on public.products;
create trigger products_keep_order_history
  before delete on public.products
  for each row execute function public.refuse_product_delete_with_orders();

-- ---------------------------------------------------------------------------
-- (f) Product photos. A public bucket: anyone reads an object by its public
-- URL without a policy. Only approved admins add, replace or remove them;
-- the admin select policy is what lets an update or delete find its row
-- (Storage's move, upsert and remove read the object first), and lets staff
-- list the bucket.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists product_images_admin_read on storage.objects;
drop policy if exists product_images_admin_insert on storage.objects;
drop policy if exists product_images_admin_update on storage.objects;
drop policy if exists product_images_admin_delete on storage.objects;

create policy product_images_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

create policy product_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy product_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy product_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this migration.
-- The frontend works without it, so no deploy is needed first. Photos already
-- uploaded stay in the bucket (and in products.img) until you delete them in
-- the dashboard; a product saved with a URL keeps showing it while the bucket
-- exists.
--
-- drop policy if exists product_images_admin_read on storage.objects;
-- drop policy if exists product_images_admin_insert on storage.objects;
-- drop policy if exists product_images_admin_update on storage.objects;
-- drop policy if exists product_images_admin_delete on storage.objects;
-- drop trigger if exists products_keep_order_history on public.products;
-- drop function if exists public.refuse_product_delete_with_orders();
-- revoke select (stock_status, featured_rank) on public.products from anon, authenticated;
-- alter table public.products drop constraint if exists products_featured_rank_chk;
-- alter table public.products drop constraint if exists products_stock_status_chk;
-- alter table public.products drop column if exists featured_rank;
-- alter table public.products drop column if exists stock_status;
-- alter table public.products drop constraint if exists products_price_max;
-- alter table public.products drop constraint if exists products_name_brand_present;
-- drop index if exists public.products_sku_upper_key;
-- alter table public.products alter column id drop default;
-- drop sequence if exists public.products_id_seq;
