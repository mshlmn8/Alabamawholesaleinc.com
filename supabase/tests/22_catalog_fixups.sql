-- Catalog fix-ups (20261012130000_catalog_fixups.sql): SKUs (AW-135).
--
-- After the migrations and the seed, the rows have the values
-- src/data/products.js gives them. The migration's updates, run again, change
-- nothing; run over the values the live database still has, they bring the
-- rows to the same values, once; and they leave an admin's own value, or a
-- code another product already has, alone.
--
-- pg_temp.p22_apply() runs the migration's update statements word for word
-- (scripts/catalog-fixups.test.mjs checks they match the file) and returns
-- how many rows they changed. Product 92201 is this file's; everything it
-- changes is put back at the end. (pg_temp lives for the whole run: the p22_
-- prefix keeps these helpers apart from other files'.)
create or replace function pg_temp.p22_apply() returns integer language plpgsql as $fn$
declare
  n integer;
  total integer := 0;
begin
  -- (a) SKUs (AW-135).
  update public.products set sku = 'AW-DUTCH-MASTERS' where id = 83 and sku = 'AW-DUTCH-MASTER'
    and not exists (select 1 from public.products o where upper(btrim(o.sku)) = 'AW-DUTCH-MASTERS');
  get diagnostics n = row_count; total := total + n;
  update public.products set sku = 'AW-T-SHIRT-BAGS' where id = 90 and sku = 'AW-BAGS'
    and not exists (select 1 from public.products o where upper(btrim(o.sku)) = 'AW-T-SHIRT-BAGS');
  get diagnostics n = row_count; total := total + n;
  update public.products set sku = 'AW-PLASTIC-CUTLERY' where id = 121 and sku = 'AW-PLASTIC'
    and not exists (select 1 from public.products o where upper(btrim(o.sku)) = 'AW-PLASTIC-CUTLERY');
  get diagnostics n = row_count; total := total + n;
  update public.products set sku = 'AW-REDBULL-12OZ' where id = 143 and sku = 'AW-RED-BULL-12OZ'
    and not exists (select 1 from public.products o where upper(btrim(o.sku)) = 'AW-REDBULL-12OZ');
  get diagnostics n = row_count; total := total + n;
  return total;
end $fn$;

-- The values the seed wrote before this migration, as the live database
-- still has them.
create or replace function pg_temp.p22_old() returns void language sql as $fn$
  update public.products set sku = 'AW-DUTCH-MASTER' where id = 83;
  update public.products set sku = 'AW-BAGS' where id = 90;
  update public.products set sku = 'AW-PLASTIC' where id = 121;
  update public.products set sku = 'AW-RED-BULL-12OZ' where id = 143;
$fn$;

-- The columns the migration changes, on the rows it changes.
create or replace function pg_temp.p22_rows() returns text language sql as $fn$
  select string_agg(format('%s|%s|%s|%s|%s', id, sku, name, description, sell_unit), E'\n' order by id)
  from public.products where id in (83, 90, 121, 143)
$fn$;

do $$
declare
  seeded text := pg_temp.p22_rows();
begin
  -- The seed's values (products.js).
  assert (select sku from public.products where id = 83) = 'AW-DUTCH-MASTERS', '#83 is AW-DUTCH-MASTERS';
  assert (select sku from public.products where id = 90) = 'AW-T-SHIRT-BAGS', '#90 is AW-T-SHIRT-BAGS';
  assert (select sku from public.products where id = 121) = 'AW-PLASTIC-CUTLERY', '#121 is AW-PLASTIC-CUTLERY';
  assert (select sku from public.products where id = 143) = 'AW-REDBULL-12OZ', '#143 is AW-REDBULL-12OZ';
  assert (select count(*) from public.products where sku like 'AW-REDBULL-%' and id between 143 and 146) = 4,
    'the four Red Bull codes are written one way';
  assert not exists (select 1 from public.products where sku in ('AW-DUTCH-MASTER', 'AW-BAGS', 'AW-PLASTIC', 'AW-RED-BULL-12OZ')),
    'no product has an old code';

  -- Run again over the seed: nothing changes.
  assert pg_temp.p22_apply() = 0, 'a re-run changes no row';
  assert pg_temp.p22_rows() = seeded, 'and no value';

  -- Over the live database's values: the same result, once.
  perform pg_temp.p22_old();
  assert pg_temp.p22_rows() <> seeded, 'the old values are back';
  assert pg_temp.p22_apply() = 4, 'four codes change';
  assert pg_temp.p22_rows() = seeded, 'to the seed''s values';
  assert pg_temp.p22_apply() = 0, 'and a second run changes nothing';

  -- An admin's own value is kept.
  update public.products set sku = 'AW-DM-STAFF' where id = 83;
  assert pg_temp.p22_apply() = 0, 'a code staff changed is not matched';
  assert (select sku from public.products where id = 83) = 'AW-DM-STAFF', 'and stays';
  update public.products set sku = 'AW-DUTCH-MASTERS' where id = 83;

  -- A code another product already has is never written twice.
  perform pg_temp.p22_old();
  insert into public.products (id, name, brand, cat, sub, sku, active)
  values (92201, 'P22 staff cutlery', 'P22', 'GROCERY', 'Paper & Plastic', ' aw-plastic-cutlery ', true);
  assert pg_temp.p22_apply() = 3, 'the other three codes change';
  assert (select sku from public.products where id = 121) = 'AW-PLASTIC', '#121 keeps its old code while another product has the new one';
  delete from public.products where id = 92201;
  assert pg_temp.p22_apply() = 1, 'and takes it once that product is gone';
  assert pg_temp.p22_rows() = seeded, 'back to the seed''s values';
end $$;

-- Leave the shared database as later test files expect it.
delete from public.products where id = 92201;
