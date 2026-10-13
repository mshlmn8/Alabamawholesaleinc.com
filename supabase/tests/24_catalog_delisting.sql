-- Kratom & Kava and every mushroom product are delisted (AW-001, the owner's
-- answer of 2026-10; 20261014100000_delist_kratom_mushroom.sql).
--
-- After the migrations and the seed the 22 rows are there and inactive (the
-- seed writes products.js's `active: false`): guests and buyers can't read
-- them, my_prices() leaves them out, and an order line naming one is refused.
-- The migration's update, run again, changes nothing; run over the live
-- database's values (every row active) it deactivates exactly those 22, once,
-- and touches no other row: not the Detox, Wellness Pills or Honey & Energy
-- rows, and not a product staff added to a delisted line (the storefront
-- leaves that one out by its line, src/data/delisted.js).
--
-- pg_temp.p24_apply() runs the migration's update word for word
-- (scripts/catalog-owner-answers.test.mjs checks it matches the file) and
-- returns how many rows it changed. Product 92401 and order ...0024f1 are this
-- file's and are removed at the end (account ...0024a1 stays, as other
-- files' accounts do). (pg_temp lives for
-- the whole run: the p24_ prefix keeps these helpers apart from other files'.)
create or replace function pg_temp.p24_apply() returns integer language plpgsql as $fn$
declare
  n integer;
begin
  update public.products set active = false
  where id in (69, 70, 71, 72, 73, 74, 75, 76, 258, 281, 285, 288, 289, 293, 296, 298, 299, 300, 306, 307, 312, 313)
    and active;
  get diagnostics n = row_count;
  return n;
end $fn$;

-- The (id, active) of every product, to compare whole-table states.
create or replace function pg_temp.p24_rows() returns text language sql as $fn$
  select string_agg(format('%s|%s', id, active), ',' order by id) from public.products
$fn$;

-- What a statement fails with: its hint (null when it succeeds).
create or replace function pg_temp.p24_hint(statement text) returns text language plpgsql as $fn$
declare h text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics h = pg_exception_hint;
  return coalesce(h, '');
end $fn$;

do $$
declare
  delisted int[] := array[69, 70, 71, 72, 73, 74, 75, 76, 258, 281, 285, 288, 289, 293, 296, 298, 299, 300, 306, 307, 312, 313];
  seeded text := pg_temp.p24_rows();
begin
  -- The seed: kept, inactive.
  assert (select count(*) from public.products where id = any(delisted)) = 22, 'the 22 rows are kept';
  assert (select count(*) from public.products where id = any(delisted) and not active) = 22, 'and inactive';
  assert not exists (select 1 from public.products where sub in ('Kratom & Kava', 'Mushroom Products') and active),
    'no product of the delisted lines is active';
  assert (select count(*) from public.products where sub in ('Kratom & Kava', 'Mushroom Products')) = 22,
    'and those lines are exactly the 22';
  assert not exists (
    select 1 from public.products
    where active and (lower(name) ~ '(mushroom|shroom|kratom|kava)' or lower(description) ~ '(mushroom|shroom|kratom|kava)')
  ), 'no active product is named or described as kratom, kava or mushroom';
  assert (select count(*) from public.products where sub in ('Detox', 'Wellness Pills', 'Honey & Energy') and active) = 14,
    'Detox, Wellness Pills and Honey & Energy stay published';

  -- Run again over the seed: nothing changes.
  assert pg_temp.p24_apply() = 0, 'a re-run changes no row';
  assert pg_temp.p24_rows() = seeded, 'and no value';

  -- Over the live database's values (all 22 active): exactly those 22, once.
  update public.products set active = true where id = any(delisted);
  assert pg_temp.p24_apply() = 22, 'the 22 are deactivated';
  assert pg_temp.p24_rows() = seeded, 'to the seed''s values, and no other row changes';
  assert pg_temp.p24_apply() = 0, 'and a second run changes nothing';

  -- A product staff added to a delisted line is not the migration's: it
  -- stays as staff left it (the storefront leaves it out by its line).
  insert into public.products (id, name, brand, cat, sub, sku, active)
  values (92401, 'P24 staff gummies', 'P24', 'NOVELTIES', 'Mushroom Products', 'AW-P24-GUMMIES', true);
  update public.products set active = true where id = 75;
  assert pg_temp.p24_apply() = 1, 'only a listed id changes';
  assert (select active from public.products where id = 92401), 'a row the migration doesn''t name is left alone';
  delete from public.products where id = 92401;
  assert pg_temp.p24_rows() = seeded, 'back to the seed''s values';
end $$;

-- Guests can't read them; the active catalog has no Kratom & Kava or
-- Mushroom Products line.
select test_anon();
do $$ begin
  assert not exists (select 1 from public.products where id in (69, 75, 76, 293, 307, 313)), 'guests can''t read a delisted product';
  assert not exists (select 1 from public.products where sub in ('Kratom & Kava', 'Mushroom Products')), 'or a delisted line';
  assert exists (select 1 from public.products where sub = 'Detox'), 'Detox is still there';
end $$;
select test_reset();

-- An approved buyer's prices leave them out, and an order line naming one is
-- refused.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000024a1', 'p24-buyer@example.com', '{"name": "P24 Buyer"}');
update public.profiles set status = 'approved', pricing_tier = 'silver' where id = '00000000-0000-4000-8000-0000000024a1';
insert into public.orders (id, user_id, ref_num, business, contact, email, phone, delivery)
values ('00000000-0000-4000-8000-0000000024f1', '00000000-0000-4000-8000-0000000024a1', 'T-P24-DELIST', 'P24 Market', 'P24 Buyer', 'p24-buyer@example.com', '555-0124', 'willcall');

select test_login('00000000-0000-4000-8000-0000000024a1');
do $$
declare
  prices jsonb := public.my_prices() -> 'products';
begin
  assert prices is not null and prices ? '1', 'an approved buyer gets prices';
  assert not (prices ?| array['69', '75', '76', '258', '293', '313']), 'but none for a delisted product';
  assert not exists (select 1 from public.products where id = 75), 'and can''t read one';
end $$;
select test_reset();

do $$ begin
  assert pg_temp.p24_hint($s$insert into public.order_items (order_id, product_id, product_name, sku, variant, qty)
    values ('00000000-0000-4000-8000-0000000024f1', 75, 'x', 'x', 'Mango', 1)$s$) = 'product_unavailable',
    'an order line for #75 Wava kava is refused';
  assert pg_temp.p24_hint($s$insert into public.order_items (order_id, product_id, product_name, sku, variant, qty)
    values ('00000000-0000-4000-8000-0000000024f1', 307, 'x', 'x', null, 1)$s$) = 'product_unavailable',
    'and one for #307 Stoned honey mushroom bags';
  assert pg_temp.p24_hint($s$insert into public.order_items (order_id, product_id, product_name, sku, variant, qty)
    values ('00000000-0000-4000-8000-0000000024f1', 217, 'x', 'x', 'Grape', 1)$s$) is null,
    'while a Detox product is still sold';
end $$;

-- Leave the shared database as later test files expect it.
delete from public.orders where email like 'p24-%@example.com';
delete from public.products where id = 92401;
