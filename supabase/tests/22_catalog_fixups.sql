-- Catalog fix-ups (20261012130000_catalog_fixups.sql): SKUs (AW-135), names
-- (AW-071, NEW-023), the brand's spelling in five descriptions (AW-075) and
-- two sell units (AW-136).
--
-- After the migrations and the seed, the rows have the values
-- src/data/products.js gives them. The migration's updates, run again, change
-- nothing; run over the values the live database still has, they bring the
-- rows to the same values, once; and they leave an admin's own value, a blank
-- description, or a code another product already has, alone.
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
  -- (b) Names (AW-071, NEW-023).
  update public.products set name = 'RAZ Vue full kit' where id = 65 and name = 'RAZ Vue Full kit';
  get diagnostics n = row_count; total := total + n;
  update public.products set description = 'RAZ Vue full kit from the disposable vape line in our Novelties department.' where id = 65 and description = 'RAZ Vue Full kit from the disposable vape line in our Novelties department.';
  get diagnostics n = row_count; total := total + n;
  update public.products set name = 'Uncle Al''s' where id = 350 and name = 'Uncle Al''s cookies';
  get diagnostics n = row_count; total := total + n;
  -- (c) The brand's spelling in five descriptions (AW-075).
  update public.products set description = 'Havana Leaf wraps from the wraps and leaf line in our Tobacco department. Eight flavors: Milk cookies, Sweet aromatic, Strawberry, 8 Miles, Russian cream, Purple, Yellow and Honey bourbon.' where id = 13 and description = 'Havana leaf wraps from the wraps and leaf line in our Tobacco department. Eight flavors: Milk cookies, Sweet aromatic, Strawberry, 8 Miles, Russian cream, Purple, Yellow and Honey bourbon.';
  get diagnostics n = row_count; total := total + n;
  update public.products set description = 'Extra Gum from the gum and mints line in our Candies department. Five flavors: Watermelon, Spearmint, Peppermint, Polar ice and Winterfresh.' where id = 183 and description = 'Extra gum from the gum and mints line in our Candies department. Five flavors: Watermelon, Spearmint, Peppermint, Polar ice and Winterfresh.';
  get diagnostics n = row_count; total := total + n;
  update public.products set description = 'Pure Eyes from the OTC and health line in our Merchandise department.' where id = 193 and description = 'Pure eyes from the OTC and health line in our Merchandise department.';
  get diagnostics n = row_count; total := total + n;
  update public.products set description = 'Lil Leaf wraps from the wraps and leaf line in our Tobacco department. Stocked in one variety: Original.' where id = 213 and description = 'Lil leaf wraps from the wraps and leaf line in our Tobacco department. Stocked in one variety: Original.';
  get diagnostics n = row_count; total := total + n;
  update public.products set description = 'Backwoods True Wraps from the wraps and leaf line in our Tobacco department. Three flavors: Original, Vanilla and Aromatic.' where id = 260 and description = 'Backwoods true wraps from the wraps and leaf line in our Tobacco department. Three flavors: Original, Vanilla and Aromatic.';
  get diagnostics n = row_count; total := total + n;
  -- (d) Sell units (AW-136).
  update public.products set sell_unit = 'single' where id in (16, 340) and sell_unit = '';
  get diagnostics n = row_count; total := total + n;
  return total;
end $fn$;

-- The values the rows had before this migration, as the live database still
-- has them (#350's after 20261011130000_catalog_names.sql).
create or replace function pg_temp.p22_old() returns void language sql as $fn$
  update public.products set sku = 'AW-DUTCH-MASTER' where id = 83;
  update public.products set sku = 'AW-BAGS' where id = 90;
  update public.products set sku = 'AW-PLASTIC' where id = 121;
  update public.products set sku = 'AW-RED-BULL-12OZ' where id = 143;
  update public.products set name = 'RAZ Vue Full kit', description = 'RAZ Vue Full kit from the disposable vape line in our Novelties department.' where id = 65;
  update public.products set name = 'Uncle Al''s cookies' where id = 350;
  update public.products set description = replace(description, 'Havana Leaf wraps', 'Havana leaf wraps') where id = 13;
  update public.products set description = replace(description, 'Extra Gum from', 'Extra gum from') where id = 183;
  update public.products set description = replace(description, 'Pure Eyes from', 'Pure eyes from') where id = 193;
  update public.products set description = replace(description, 'Lil Leaf wraps', 'Lil leaf wraps') where id = 213;
  update public.products set description = replace(description, 'Backwoods True Wraps', 'Backwoods true wraps') where id = 260;
  update public.products set sell_unit = '' where id in (16, 340);
$fn$;

-- The columns the migration changes, on the rows it changes.
create or replace function pg_temp.p22_rows() returns text language sql as $fn$
  select string_agg(format('%s|%s|%s|%s|%s', id, sku, name, description, sell_unit), E'\n' order by id)
  from public.products where id in (13, 16, 65, 83, 90, 121, 143, 183, 193, 213, 260, 340, 350)
$fn$;

do $$
declare
  seeded text := pg_temp.p22_rows();
  dupes text;
begin
  -- (a) The seed's codes (products.js).
  assert (select sku from public.products where id = 83) = 'AW-DUTCH-MASTERS', '#83 is AW-DUTCH-MASTERS';
  assert (select sku from public.products where id = 90) = 'AW-T-SHIRT-BAGS', '#90 is AW-T-SHIRT-BAGS';
  assert (select sku from public.products where id = 121) = 'AW-PLASTIC-CUTLERY', '#121 is AW-PLASTIC-CUTLERY';
  assert (select sku from public.products where id = 143) = 'AW-REDBULL-12OZ', '#143 is AW-REDBULL-12OZ';
  assert (select count(*) from public.products where sku like 'AW-REDBULL-%' and id between 143 and 146) = 4,
    'the four Red Bull codes are written one way';
  assert not exists (select 1 from public.products where sku in ('AW-DUTCH-MASTER', 'AW-BAGS', 'AW-PLASTIC', 'AW-RED-BULL-12OZ')),
    'no product has an old code';

  -- (b) Names: no two products are called the same (NEW-023).
  assert (select name from public.products where id = 65) = 'RAZ Vue full kit', '#65 is RAZ Vue full kit';
  assert (select description from public.products where id = 65) like 'RAZ Vue full kit from %', 'and its description says so';
  assert (select name from public.products where id = 350) = 'Uncle Al''s', '#350 is Uncle Al''s again';
  assert (select name from public.products where id = 351) = 'Uncle Al''s cookies', '#351 keeps its name';
  select string_agg(name, ', ') into dupes from (
    select lower(btrim(name)) as name from public.products where id < 90000 and active group by 1 having count(*) > 1
  ) d;
  assert dupes is null, 'products sharing a name: ' || dupes;

  -- (c) The brand's spelling, as in each row's brand and name (AW-075).
  assert (select description like 'Havana Leaf wraps from %' and brand = 'Havana Leaf' from public.products where id = 13), '#13 Havana Leaf';
  assert (select description like 'Extra Gum from %' and name = 'Extra Gum' from public.products where id = 183), '#183 Extra Gum';
  assert (select description like 'Pure Eyes from %' and brand = 'Pure Eyes' from public.products where id = 193), '#193 Pure Eyes';
  assert (select description like 'Lil Leaf wraps from %' and brand = 'Lil Leaf' from public.products where id = 213), '#213 Lil Leaf';
  assert (select description like 'Backwoods True Wraps from %' and name = 'Backwoods True Wraps' from public.products where id = 260), '#260 Backwoods True Wraps';

  -- (d) Sold as singles, as the descriptions say (AW-136); the 5-packs whose
  -- photo they share keep theirs.
  assert (select count(*) from public.products where id in (16, 340) and sell_unit = 'single' and description like '%sold as singles%') = 2,
    '#16 and #340 are sold by the single';
  assert (select count(*) from public.products where id in (11, 77) and sell_unit = '5-pack') = 2, '#11 and #77 are 5-packs';

  -- Run again over the seed: nothing changes.
  assert pg_temp.p22_apply() = 0, 'a re-run changes no row';
  assert pg_temp.p22_rows() = seeded, 'and no value';

  -- Over the live database's values: the same result, once.
  perform pg_temp.p22_old();
  assert pg_temp.p22_rows() <> seeded, 'the old values are back';
  assert pg_temp.p22_apply() = 14, 'four codes, two names, six descriptions and two sell units change';
  assert pg_temp.p22_rows() = seeded, 'to the seed''s values';
  assert pg_temp.p22_apply() = 0, 'and a second run changes nothing';

  -- An admin's own value is kept, and so is a blank description (the
  -- storefront shows the bundled copy for it).
  perform pg_temp.p22_old();
  update public.products set sku = 'AW-DM-STAFF' where id = 83;
  update public.products set name = 'Uncle Al''s cookies (staff)' where id = 350;
  update public.products set description = '' where id = 193;
  update public.products set sell_unit = 'pack of 1' where id = 340;
  assert pg_temp.p22_apply() = 10, 'the other ten change';
  assert (select sku from public.products where id = 83) = 'AW-DM-STAFF', 'a code staff changed stays';
  assert (select name from public.products where id = 350) = 'Uncle Al''s cookies (staff)', 'so does a name staff changed';
  assert (select description from public.products where id = 193) = '', 'and a blank description';
  assert (select sell_unit from public.products where id = 340) = 'pack of 1', 'and a sell unit staff set';
  assert (select sell_unit from public.products where id = 16) = 'single', 'while a blank one is filled';
  update public.products set sku = 'AW-DUTCH-MASTERS' where id = 83;
  update public.products set sell_unit = 'single' where id = 340;
  update public.products set name = 'Uncle Al''s' where id = 350;
  update public.products set description = 'Pure Eyes from the OTC and health line in our Merchandise department.' where id = 193;
  assert pg_temp.p22_rows() = seeded, 'put back';

  -- A code another product already has is never written twice.
  perform pg_temp.p22_old();
  insert into public.products (id, name, brand, cat, sub, sku, active)
  values (92201, 'P22 staff cutlery', 'P22', 'GROCERY', 'Paper & Plastic', ' aw-plastic-cutlery ', true);
  assert pg_temp.p22_apply() = 13, 'everything else changes';
  assert (select sku from public.products where id = 121) = 'AW-PLASTIC', '#121 keeps its old code while another product has the new one';
  delete from public.products where id = 92201;
  assert pg_temp.p22_apply() = 1, 'and takes it once that product is gone';
  assert pg_temp.p22_rows() = seeded, 'back to the seed''s values';
end $$;

-- Leave the shared database as later test files expect it.
delete from public.products where id = 92201;
