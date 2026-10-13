-- The CSV import that can add products (20261012140000_admin_import_create.sql,
-- AW-114): admin_import_products_v2 updates the products whose SKU a row
-- names, as v1 does, and adds the rows whose SKU is new when they have a
-- name, brand, department and sub-line (inactive unless the row says
-- otherwise, ids from products_id_seq), all or nothing; a SKU listed twice or
-- a bad row refuses the whole file; customers and guests can't call it.
-- Test accounts ...0a23a1 (approved admin), ...0a23b1 (approved customer);
-- products 92301-92302 and the SKUs AW-A23-*. Everything is removed at the
-- end.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000a23a1', 'p23-admin@example.com', '{"name": "P23 Admin"}'),
  ('00000000-0000-4000-8000-0000000a23b1', 'p23-buyer@example.com', '{"name": "P23 Buyer"}');
update public.profiles set status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000a23a1';
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000a23b1';

-- The hint (or, without one, the SQLSTATE) a statement fails with; null when
-- it succeeds. (pg_temp lives for the whole run: the p23_ prefix keeps it
-- apart from other files' helpers.)
create or replace function pg_temp.p23_fails(statement text) returns text language plpgsql as $$
declare h text; c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics h = pg_exception_hint, c = returned_sqlstate;
  return coalesce(nullif(h, ''), c);
end $$;

-- The SQLSTATE only.
create or replace function pg_temp.p23_state(statement text) returns text language plpgsql as $$
declare c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics c = returned_sqlstate;
  return c;
end $$;

-- How many test products there are, by SKU.
create or replace function pg_temp.p23_count() returns integer language sql as $$
  select count(*)::integer from public.products where upper(sku) like 'AW-A23-%';
$$;

-- Made-up test prices (not catalog prices).
insert into public.products (id, name, brand, cat, sub, sku, price, tag, active) values
  (92301, 'P23 one', 'P23', 'CANDIES', 'P23 line', 'AW-A23-ONE', 4.10, null, true),
  (92302, 'P23 two', 'P23', 'CANDIES', 'P23 line', 'AW-A23-TWO', 6.20, 'NEW', false);

-- ---------------------------------------------------------------------------
-- Customers and guests can't call it.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000a23b1');
do $$ begin
  assert pg_temp.p23_state($s$select public.admin_import_products_v2('[{"sku": "AW-A23-ONE", "name": "Buyer"}]'::jsonb)$s$) = '42501',
    'a customer gets 42501';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[{"sku": "AW-A23-NEW", "name": "Buyer", "brand": "B", "cat": "CANDIES", "sub": "P23 line"}]'::jsonb)$s$) = 'admin_only',
    'with hint admin_only, also for a new SKU';
end $$;
select test_reset();

do $$ begin
  assert (select name from public.products where id = 92301) = 'P23 one', 'the customer changed nothing';
  assert pg_temp.p23_count() = 2, 'and added nothing';
  assert not has_function_privilege('anon', 'public.admin_import_products_v2(jsonb)', 'execute'), 'guests can''t call it';
  assert not has_function_privilege('public', 'public.admin_import_products_v2(jsonb)', 'execute'), 'nor can public';
  assert has_function_privilege('authenticated', 'public.admin_import_products_v2(jsonb)', 'execute'), 'signed-in accounts can (it checks is_admin)';
  assert (select prosecdef from pg_proc where oid = 'public.admin_import_products_v2(jsonb)'::regprocedure), 'SECURITY DEFINER';
  assert (select proconfig @> array['search_path=public'] from pg_proc where oid = 'public.admin_import_products_v2(jsonb)'::regprocedure), 'with search_path = public';
end $$;

-- ---------------------------------------------------------------------------
-- An admin updates and adds in one call.
-- ---------------------------------------------------------------------------
-- Where the id sequence stood before (the next id it would hand out).
create temp table p23_seq as
  select case when is_called then last_value + 1 else last_value end as next_id from public.products_id_seq;
grant select on p23_seq to authenticated;

select test_login('00000000-0000-4000-8000-0000000a23a1');
do $$
declare result jsonb;
begin
  result := public.admin_import_products_v2($j$[
    {"sku": " aw-a23-one ", "name": "P23 one renamed", "price": 4.5, "tag": "DEAL"},
    {"sku": "aw-a23-new ", "name": " P23 new ", "brand": "P23", "cat": "CANDIES", "sub": "P23 line", "price": 7.25, "tag": "NEW",
     "sell_unit": "Box of 24", "description": "P23 copy", "stock_status": "low", "featured_rank": 9},
    {"sku": "AW-A23-LIVE", "name": "P23 live", "brand": "P23", "cat": "CANDIES", "sub": "P23 other line", "price": null, "active": true,
     "variants": ["Red", "Blue"]}
  ]$j$::jsonb);
  assert result = '{"updated": 1, "created": 2}'::jsonb, format('one updated, two added: %s', result);
end $$;
select test_reset();

do $$ begin
  assert (select name = 'P23 one renamed' and price = 4.50 and tag = 'DEAL' and active and brand = 'P23' and sub = 'P23 line'
          from public.products where id = 92301), 'the existing SKU was updated in the keys given, whatever its case and spaces';
  assert (select name = 'P23 new' and brand = 'P23' and cat = 'CANDIES' and sub = 'P23 line' and price = 7.25 and tag = 'NEW'
            and sell_unit = 'Box of 24' and description = 'P23 copy' and stock_status = 'low' and featured_rank = 9
            and not active and img is null and variants = '[]'::jsonb
          from public.products where sku = 'AW-A23-NEW'), 'the new product has the row''s values, is inactive and has no photo';
  assert (select active and price is null and variants = '["Red", "Blue"]'::jsonb and stock_status = 'in_stock' and sell_unit = '' and description = ''
          from public.products where sku = 'AW-A23-LIVE'), 'a row that says active is active; a null price is price on request';
  assert (select count(*) from public.products where sku in ('AW-A23-NEW', 'AW-A23-LIVE')) = 2, 'SKUs stored in capitals, trimmed';
  assert (select array_agg(id order by id) from public.products where sku in ('AW-A23-NEW', 'AW-A23-LIVE'))
         = (select array[next_id::integer, next_id::integer + 1] from p23_seq), 'their ids are the next two from products_id_seq';
end $$;

-- A row for a SKU that is now there updates it like any other (cat and sub
-- are not moved); a new SKU without what a product needs refuses the file.
select test_login('00000000-0000-4000-8000-0000000a23a1');
do $$
declare result jsonb;
begin
  result := public.admin_import_products_v2('[{"sku": "AW-A23-NEW", "name": "P23 new again", "brand": "P23", "cat": "TOBACCO", "sub": "Elsewhere"}]'::jsonb);
  assert result = '{"updated": 1, "created": 0}'::jsonb, format('an update, not a second product: %s', result);
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[{"sku": "AW-A23-ONE", "name": "Changed"}, {"sku": "AW-A23-NOPE", "name": "No brand", "cat": "CANDIES", "sub": "P23 line"}]'::jsonb)$s$) = 'unknown_sku',
    'a new SKU without a brand is an unknown SKU';
  assert pg_temp.p23_state($s$select public.admin_import_products_v2('[{"sku": "AW-A23-NOPE", "name": "x"}]'::jsonb)$s$) = 'P0002', 'with P0002, as in v1';
end $$;
select test_reset();

do $$ begin
  assert (select name = 'P23 new again' and cat = 'CANDIES' and sub = 'P23 line' from public.products where sku = 'AW-A23-NEW'),
    'the row updated the product and left its department and sub-line alone';
  assert (select name from public.products where id = 92301) = 'P23 one renamed', 'the refused file changed nothing';
  assert pg_temp.p23_count() = 4, 'and added nothing';
end $$;

-- ---------------------------------------------------------------------------
-- One bad row, and nothing is saved.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000a23a1');
do $$ begin
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2($j$[
    {"sku": "AW-A23-ONE", "name": "Should not stick"},
    {"sku": "AW-A23-ADD", "name": "P23 add", "brand": "P23", "cat": "CANDIES", "sub": "P23 line"},
    {"sku": "AW-A23-BAD", "name": "P23 bad", "brand": "P23", "cat": "CANDIES", "sub": "P23 line", "tag": "HOT"}
  ]$j$::jsonb)$s$) = 'invalid_input', 'an unknown tag on a new row refuses the file';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2($j$[
    {"sku": "AW-A23-ADD", "name": "P23 add", "brand": "P23", "cat": "CANDIES", "sub": "P23 line"},
    {"sku": "AW-A23-ONE", "price": -1}
  ]$j$::jsonb)$s$) = '23514', 'a negative price on an update is refused by the table, after an add';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[{"sku": "AW-A23-ADD", "name": "P23 add", "brand": "P23", "cat": "CANDIES", "sub": "P23 line", "price": -1}]'::jsonb)$s$) = 'invalid_input',
    'a negative price on a new row';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[{"sku": "AW-A23-ADD", "name": "P23 add", "brand": "P23", "cat": "CANDIES", "sub": "P23 line", "price": "7"}]'::jsonb)$s$) = 'invalid_input',
    'a price that isn''t a number';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[{"sku": "AW-A23-ADD", "name": "P23 add", "brand": "P23", "cat": "NO SUCH DEPT", "sub": "P23 line"}]'::jsonb)$s$) = 'invalid_input',
    'a department no product has';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[{"sku": "AW A23 ADD!", "name": "P23 add", "brand": "P23", "cat": "CANDIES", "sub": "P23 line"}]'::jsonb)$s$) = 'invalid_input',
    'a SKU the editor would refuse';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[{"sku": "AW-A23-ADD", "name": "P23 add", "brand": "P23", "cat": "CANDIES", "sub": "P23 line", "variants": "Red"}]'::jsonb)$s$) = 'invalid_input',
    'variants that aren''t a list';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[{"sku": "AW-A23-ADD", "name": "P23 add", "brand": "P23", "cat": "CANDIES", "sub": "P23 line", "stock_status": "plenty"}]'::jsonb)$s$) = '23514',
    'a stock status the table refuses';
end $$;
select test_reset();

do $$ begin
  assert (select name from public.products where id = 92301) = 'P23 one renamed', 'no update from a refused file stuck';
  assert (select price from public.products where id = 92301) = 4.50, 'nor a price';
  assert not exists (select 1 from public.products where upper(sku) in ('AW-A23-ADD', 'AW-A23-BAD')), 'and no product was added';
end $$;

-- ---------------------------------------------------------------------------
-- A SKU listed twice, and the file's shape.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000a23a1');
do $$ begin
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[{"sku": "AW-A23-TWO", "tag": "DEAL"}, {"sku": " aw-a23-two", "tag": null}]'::jsonb)$s$) = 'duplicate_sku',
    'an existing SKU listed twice, in any case';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2($j$[
    {"sku": "AW-A23-TWICE", "name": "P23 twice", "brand": "P23", "cat": "CANDIES", "sub": "P23 line"},
    {"sku": "AW-A23-TWICE", "name": "P23 twice", "brand": "P23", "cat": "CANDIES", "sub": "P23 line"}
  ]$j$::jsonb)$s$) = 'duplicate_sku', 'a new SKU listed twice';
  assert pg_temp.p23_state($s$select public.admin_import_products_v2('[{"sku": "AW-A23-TWO"}, {"sku": "AW-A23-TWO"}]'::jsonb)$s$) = '22023', 'with 22023';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[{"sku": "AW-A23-ONE", "tag": "HOT"}]'::jsonb)$s$) = 'invalid_input', 'an unknown tag on an update';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[{"name": "no sku"}]'::jsonb)$s$) = 'invalid_input', 'a row without a SKU';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('["AW-A23-ONE"]'::jsonb)$s$) = 'invalid_input', 'a row that isn''t an object';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('[]'::jsonb)$s$) = 'invalid_input', 'an empty import';
  assert pg_temp.p23_fails($s$select public.admin_import_products_v2('{"sku": "AW-A23-ONE"}'::jsonb)$s$) = 'invalid_input', 'not an array';
  assert pg_temp.p23_fails(format('select public.admin_import_products_v2(%L::jsonb)',
    (select jsonb_agg(jsonb_build_object('sku', 'AW-A23-N' || n)) from generate_series(1, 1001) as n))) = 'invalid_input', 'more than 1000 rows';
end $$;
select test_reset();

do $$ begin
  assert (select tag from public.products where id = 92302) = 'NEW', 'the refused files changed nothing';
  assert not exists (select 1 from public.products where upper(sku) = 'AW-A23-TWICE'), 'and added nothing';
  assert pg_temp.p23_count() = 4, 'still the two test products and the two added';
end $$;

-- v1 is unchanged: it still never adds a product.
select test_login('00000000-0000-4000-8000-0000000a23a1');
do $$ begin
  assert pg_temp.p23_fails($s$select public.admin_import_products('[{"sku": "AW-A23-V1", "name": "P23 v1", "brand": "P23", "cat": "CANDIES", "sub": "P23 line"}]'::jsonb)$s$) = 'unknown_sku',
    'v1 refuses a new SKU as before';
end $$;
select test_reset();

-- Leave the shared database as later test files expect it.
delete from public.products where upper(sku) like 'AW-A23-%';
drop table p23_seq;
