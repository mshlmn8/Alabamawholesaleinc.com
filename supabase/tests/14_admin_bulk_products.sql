-- Admin -> Products' bulk changes and Admin -> Pricing's database side
-- (20261010121000_admin_bulk_products.sql, AW-114): adjusting many prices at
-- once rounds like tier_unit_price(), skips "price on request", moves the
-- variants' own prices too, and refuses a result out of range without
-- changing anything; the CSV import updates matched SKUs only, all or
-- nothing; customers can call neither; a tier discount stays below 100.
-- Test accounts ...0ad2a1 (approved admin), ...0ad2b1 (approved customer);
-- products 98201 and up. Everything is removed at the end.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000ad2a1', 'adm14-admin@example.com', '{"name": "Adm14 Admin"}'),
  ('00000000-0000-4000-8000-0000000ad2b1', 'adm14-buyer@example.com', '{"name": "Adm14 Buyer"}');
update public.profiles set status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000ad2a1';
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000ad2b1';

-- The hint (or, without one, the SQLSTATE) a statement fails with; null when
-- it succeeds. (pg_temp lives for the whole run: the adm14_ prefix keeps it
-- apart from other files' helpers.)
create or replace function pg_temp.adm14_fails(statement text) returns text language plpgsql as $$
declare h text; c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics h = pg_exception_hint, c = returned_sqlstate;
  return coalesce(nullif(h, ''), c);
end $$;

-- The SQLSTATE only.
create or replace function pg_temp.adm14_state(statement text) returns text language plpgsql as $$
declare c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics c = returned_sqlstate;
  return c;
end $$;

-- Made-up test prices (not catalog prices).
insert into public.products (id, name, brand, cat, sub, sku, price, tag) values
  (98201, 'Adm14 one', 'Adm14', 'CANDIES', 'Adm14 line', 'AW-ADM14-ONE', 45.10, null),
  (98202, 'Adm14 two', 'Adm14', 'CANDIES', 'Adm14 line', 'AW-ADM14-TWO', 10.10, 'NEW'),
  (98203, 'Adm14 three', 'Adm14', 'CANDIES', 'Adm14 line', 'AW-ADM14-THREE', null, null),
  (98204, 'Adm14 four', 'Adm14', 'CANDIES', 'Adm14 line', 'AW-ADM14-FOUR', 0.10, null);
update public.products set variants = '["Red", "Blue", "Green"]'::jsonb where id = 98201;
insert into public.product_variant_prices (product_id, variant, price) values
  (98201, 'Red', 20.00), (98201, 'Blue', 0.30), (98201, 'Green', null);

-- ---------------------------------------------------------------------------
-- (a) Adjusting prices: +5% rounds like tier_unit_price(), price on request
-- is skipped, the variants move too.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000ad2a1');
do $$
declare result jsonb;
begin
  result := public.admin_bulk_adjust_prices(array[98201, 98202, 98203, 98204, 98201], 5);
  assert result = '{"updated": 3, "skipped": 1, "variants": 2}'::jsonb, format('three priced, one on request, two variant prices: %s', result);
end $$;
select test_reset();

do $$ begin
  assert (select price from public.products where id = 98201) = public.tier_unit_price(45.10, -5), '45.10 + 5% rounds like tier_unit_price';
  assert (select price from public.products where id = 98201) = 47.36, '47.355 rounds half up to 47.36';
  assert (select price from public.products where id = 98202) = 10.61, '10.605 rounds half up to 10.61';
  assert (select price from public.products where id = 98204) = 0.11, '0.105 rounds half up to 0.11';
  assert (select price is null from public.products where id = 98203), 'price on request stays on request';
  assert (select price from public.product_variant_prices where product_id = 98201 and variant = 'Red') = 21.00, 'a variant''s own price moves';
  assert (select price from public.product_variant_prices where product_id = 98201 and variant = 'Blue') = 0.32, '0.315 rounds half up to 0.32';
  assert (select price is null from public.product_variant_prices where product_id = 98201 and variant = 'Green'), 'a variant on request stays so';
end $$;

-- An amount, without the variants; then a cut.
select test_login('00000000-0000-4000-8000-0000000ad2a1');
do $$
declare result jsonb;
begin
  result := public.admin_bulk_adjust_prices(array[98202], 0, 1.25, false);
  assert result = '{"updated": 1, "skipped": 0, "variants": 0}'::jsonb, format('one product, no variants: %s', result);
  result := public.admin_bulk_adjust_prices(array[98201], -10, 0, false);
  assert result ->> 'updated' = '1', 'a cut';
end $$;
select test_reset();

do $$ begin
  assert (select price from public.products where id = 98202) = 11.86, '10.61 + 1.25';
  assert (select price from public.products where id = 98201) = 42.62, '47.36 - 10% = 42.624, rounded to 42.62';
  assert (select price from public.product_variant_prices where product_id = 98201 and variant = 'Red') = 21.00, 'variants left alone';
end $$;

-- A result below 0 (or above 99,999.99) changes nothing, not even the rows
-- that would have been fine.
select test_login('00000000-0000-4000-8000-0000000ad2a1');
do $$ begin
  assert pg_temp.adm14_fails('select public.admin_bulk_adjust_prices(array[98202, 98204], 0, -1.00)') = 'price_out_of_range',
    'a price below 0 is refused';
  assert pg_temp.adm14_state('select public.admin_bulk_adjust_prices(array[98202, 98204], 0, -1.00)') = '22003', 'with 22003';
  assert pg_temp.adm14_fails('select public.admin_bulk_adjust_prices(array[98201], 0, -21.00)') = 'price_out_of_range',
    'a variant price below 0 is refused too';
  assert pg_temp.adm14_fails('select public.admin_bulk_adjust_prices(array[98202], 1000, 99900)') = 'price_out_of_range',
    'and a price above 99,999.99';
  assert pg_temp.adm14_fails('select public.admin_bulk_adjust_prices(array[98202], -100)') = 'invalid_input', '-100% is refused';
  assert pg_temp.adm14_fails('select public.admin_bulk_adjust_prices(array[98202], 1000.01)') = 'invalid_input', 'over 1000% is refused';
  assert pg_temp.adm14_fails('select public.admin_bulk_adjust_prices(array[98202], 0, 100000)') = 'invalid_input', 'an amount over 99,999.99 is refused';
  assert pg_temp.adm14_fails('select public.admin_bulk_adjust_prices(array[]::integer[], 5)') = 'invalid_input', 'no products is refused';
  assert pg_temp.adm14_fails('select public.admin_bulk_adjust_prices(array(select generate_series(1, 1001)), 5)') = 'invalid_input',
    'more than 1000 products is refused';
end $$;
select test_reset();

do $$ begin
  assert (select price from public.products where id = 98202) = 11.86, 'the product that would have been fine kept its price';
  assert (select price from public.products where id = 98204) = 0.11, 'and so did the one out of range';
  assert (select price from public.product_variant_prices where product_id = 98201 and variant = 'Red') = 21.00, 'variants unchanged';
end $$;

-- Customers and guests can't adjust prices.
select test_login('00000000-0000-4000-8000-0000000ad2b1');
do $$ begin
  assert pg_temp.adm14_state('select public.admin_bulk_adjust_prices(array[98202], 5)') = '42501', 'a customer gets 42501';
  assert pg_temp.adm14_fails('select public.admin_bulk_adjust_prices(array[98202], 5)') = 'admin_only', 'hint admin_only';
end $$;
select test_reset();

do $$ begin
  assert (select price from public.products where id = 98202) = 11.86, 'the customer changed nothing';
  assert not has_function_privilege('anon', 'public.admin_bulk_adjust_prices(integer[], numeric, numeric, boolean)', 'execute'), 'guests can''t call it';
  assert has_function_privilege('authenticated', 'public.admin_bulk_adjust_prices(integer[], numeric, numeric, boolean)', 'execute'), 'signed-in accounts can (it checks is_admin)';
end $$;

-- ---------------------------------------------------------------------------
-- (b) The CSV import: matched SKUs, the keys given, all or nothing.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000ad2a1');
do $$
declare n integer;
begin
  n := public.admin_import_products($j$[
    {"sku": " aw-adm14-one ", "name": "Adm14 one renamed", "price": 12.5, "tag": "DEAL", "sell_unit": "Box of 12"},
    {"sku": "AW-ADM14-TWO", "active": false, "price": null, "stock_status": "low", "featured_rank": 7},
    {"sku": "AW-ADM14-THREE", "tag": null, "description": "Adm14 copy"}
  ]$j$::jsonb);
  assert n = 3, format('three products updated, got %s', n);
end $$;
select test_reset();

do $$ begin
  assert (select name = 'Adm14 one renamed' and brand = 'Adm14' and price = 12.50 and tag = 'DEAL' and sell_unit = 'Box of 12' and active
          from public.products where id = 98201), 'the SKU matched whatever its case and spaces; absent keys kept';
  assert (select not active and price is null and tag = 'NEW' and stock_status = 'low' and featured_rank = 7 and name = 'Adm14 two'
          from public.products where id = 98202), 'a null price is price on request; the tag was not in the row, so it stays';
  assert (select tag is null and description = 'Adm14 copy' from public.products where id = 98203), 'a null tag clears it';
end $$;

-- An unknown SKU refuses the whole file; so does a bad value.
select test_login('00000000-0000-4000-8000-0000000ad2a1');
do $$ begin
  assert pg_temp.adm14_fails($s$select public.admin_import_products('[{"sku": "AW-ADM14-ONE", "name": "Changed"}, {"sku": "AW-ADM14-NOPE", "name": "x"}]'::jsonb)$s$) = 'unknown_sku',
    'an unknown SKU is refused';
  assert pg_temp.adm14_fails($s$select public.admin_import_products('[{"sku": "AW-ADM14-ONE", "name": "Changed"}, {"sku": "AW-ADM14-TWO", "price": -1}]'::jsonb)$s$) = '23514',
    'a negative price is refused by the table';
  assert pg_temp.adm14_fails($s$select public.admin_import_products('[{"sku": "AW-ADM14-ONE", "tag": "HOT"}]'::jsonb)$s$) = 'invalid_input', 'an unknown tag is refused';
  assert pg_temp.adm14_fails($s$select public.admin_import_products('[{"name": "no sku"}]'::jsonb)$s$) = 'invalid_input', 'a row without a SKU is refused';
  assert pg_temp.adm14_fails($s$select public.admin_import_products('[]'::jsonb)$s$) = 'invalid_input', 'an empty import is refused';
  assert pg_temp.adm14_fails($s$select public.admin_import_products('{"sku": "AW-ADM14-ONE"}'::jsonb)$s$) = 'invalid_input', 'not an array is refused';
  assert pg_temp.adm14_fails(format('select public.admin_import_products(%L::jsonb)',
    (select jsonb_agg(jsonb_build_object('sku', 'AW-ADM14-ONE')) from generate_series(1, 1001)))) = 'invalid_input', 'more than 1000 rows is refused';
end $$;
select test_reset();

do $$ begin
  assert (select name from public.products where id = 98201) = 'Adm14 one renamed', 'nothing from the refused files was written';
  assert not exists (select 1 from public.products where upper(sku) = 'AW-ADM14-NOPE'), 'and no product was created';
end $$;

select test_login('00000000-0000-4000-8000-0000000ad2b1');
do $$ begin
  assert pg_temp.adm14_state($s$select public.admin_import_products('[{"sku": "AW-ADM14-ONE", "name": "Buyer"}]'::jsonb)$s$) = '42501',
    'a customer gets 42501';
end $$;
select test_reset();

do $$ begin
  assert (select name from public.products where id = 98201) = 'Adm14 one renamed', 'the customer changed nothing';
  assert not has_function_privilege('anon', 'public.admin_import_products(jsonb)', 'execute'), 'guests can''t call it';
end $$;

-- ---------------------------------------------------------------------------
-- (c) A tier discount from 0 up to (not including) 100.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000ad2a1');
do $$ begin
  assert pg_temp.adm14_state($s$update public.pricing_tiers set discount_pct = 120 where tier = 'silver'$s$) = '23514', 'a discount of 120 is refused';
  assert pg_temp.adm14_state($s$update public.pricing_tiers set discount_pct = 100 where tier = 'silver'$s$) = '23514', 'and of 100';
  assert pg_temp.adm14_state($s$update public.pricing_tiers set discount_pct = -1 where tier = 'silver'$s$) = '23514', 'and below 0';
end $$;
select test_reset();

do $$ begin
  assert (select discount_pct from public.pricing_tiers where tier = 'silver') = 5.00, 'silver keeps 5%';
  assert (select convalidated from pg_constraint where conname = 'pricing_tiers_discount_range') = false, 'the check is NOT VALID';
end $$;

-- Leave the shared database as later test files expect it.
delete from public.products where id between 98201 and 98204;
