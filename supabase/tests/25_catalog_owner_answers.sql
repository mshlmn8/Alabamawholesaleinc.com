-- The owner's catalog answers of 2026-09-28 (20261014101000_catalog_owner_answers.sql,
-- Cursor's draft PR #11): #219 Happy valentines jar moves to a Gifts line,
-- #295 Snack wraps is a chips brand, and Uncle Al's is #350 cookies and #351
-- creme, with no Lemon ice variant and no photo.
--
-- After the migrations and the seed, the rows have the values
-- src/data/products.js gives them. The migration's updates, run again, change
-- nothing; run over the values the live database still has, they bring the
-- rows to the same values, once; and they leave an admin's own value alone.
--
-- pg_temp.p25_apply() runs the migration's update statements word for word
-- (scripts/catalog-owner-answers.test.mjs checks they match the file) and
-- returns how many rows they changed. (pg_temp lives for the whole run: the
-- p25_ prefix keeps these helpers apart from other files'.)
create or replace function pg_temp.p25_apply() returns integer language plpgsql as $fn$
declare
  n integer;
  total integer := 0;
begin
  -- (a) #219 to Gifts.
  update public.products set sub = 'Gifts' where id = 219 and sub = 'Wellness Pills';
  get diagnostics n = row_count; total := total + n;
  update public.products set description = 'Happy valentines jar, a novelty gift sold from a counter jar. Three varieties: 4 inch, 6 inch and Colored.' where id = 219 and description = 'Happy valentines jar from the wellness pill line in our Novelties department. Three varieties: 4 inch, 6 inch and Colored.';
  get diagnostics n = row_count; total := total + n;
  -- (b) #295 Snack wraps.
  update public.products set description = 'Snack wraps, a chips brand. Two sizes: 40ct and 12ct. Flavors vary by availability.' where id = 295 and description = 'Snack wraps from the chips and crackers line in our Food Stuff department. Two sizes: 40ct and 12ct.';
  get diagnostics n = row_count; total := total + n;
  -- (c) Uncle Al's: #351 first, then #350.
  update public.products set name = 'Uncle Al''s creme' where id = 351 and name = 'Uncle Al''s cookies';
  get diagnostics n = row_count; total := total + n;
  update public.products set variants = '[]'::jsonb where id = 351 and variants = '["Lemon ice"]'::jsonb;
  get diagnostics n = row_count; total := total + n;
  update public.products set unavailable_variants = '[]'::jsonb where id = 351 and unavailable_variants = '["Lemon ice"]'::jsonb;
  get diagnostics n = row_count; total := total + n;
  update public.products set description = 'Uncle Al''s creme, from the cookie line in our Food Stuff department. Flavors vary by availability.' where id = 351 and description = 'Uncle Al''s cookies in single-serve packs. Stocked in one variety: Lemon ice.';
  get diagnostics n = row_count; total := total + n;
  update public.products set img = null where id in (350, 351) and img = 'uncle_al_s_cookies.jpg';
  get diagnostics n = row_count; total := total + n;
  update public.products set name = 'Uncle Al''s cookies' where id = 350 and name = 'Uncle Al''s';
  get diagnostics n = row_count; total := total + n;
  update public.products set description = 'Uncle Al''s cookies, from the cookie line in our Food Stuff department. Flavors vary by availability.' where id = 350 and description = 'Uncle Al''s cookies, from the cookie line in our Food Stuff department.';
  get diagnostics n = row_count; total := total + n;
  return total;
end $fn$;

-- The values the rows had before this migration, as the live database has
-- them (#350's name after 20261012130000_catalog_fixups.sql).
create or replace function pg_temp.p25_old() returns void language sql as $fn$
  update public.products set sub = 'Wellness Pills', description = 'Happy valentines jar from the wellness pill line in our Novelties department. Three varieties: 4 inch, 6 inch and Colored.' where id = 219;
  update public.products set description = 'Snack wraps from the chips and crackers line in our Food Stuff department. Two sizes: 40ct and 12ct.' where id = 295;
  update public.products set name = 'Uncle Al''s', img = 'uncle_al_s_cookies.jpg', description = 'Uncle Al''s cookies, from the cookie line in our Food Stuff department.' where id = 350;
  update public.products set name = 'Uncle Al''s cookies', img = 'uncle_al_s_cookies.jpg', variants = '["Lemon ice"]'::jsonb,
    description = 'Uncle Al''s cookies in single-serve packs. Stocked in one variety: Lemon ice.' where id = 351;
$fn$;

-- The columns the migration changes, on the rows it changes.
create or replace function pg_temp.p25_rows() returns text language sql as $fn$
  select string_agg(format('%s|%s|%s|%s|%s|%s|%s|%s', id, name, sub, sku, description, img, variants, unavailable_variants), E'\n' order by id)
  from public.products where id in (219, 295, 350, 351)
$fn$;

do $$
declare
  seeded text := pg_temp.p25_rows();
  dupes text;
begin
  -- The seed's values (products.js).
  assert (select sub from public.products where id = 219) = 'Gifts', '#219 is in Gifts';
  assert (select name = 'Happy valentines jar' and variants = '["4 inch", "6 inch", "Colored"]'::jsonb and cat = 'NOVELTIES'
    from public.products where id = 219), 'with its name, variants and department unchanged';
  assert (select description from public.products where id = 219) not like '%wellness%', 'its description no longer says wellness pills';
  assert (select count(*) from public.products where sub = 'Gifts') = 1, 'the Gifts line holds #219';
  assert (select description from public.products where id = 295) = 'Snack wraps, a chips brand. Two sizes: 40ct and 12ct. Flavors vary by availability.',
    '#295 is a chips brand';
  assert (select img from public.products where id = 295) is null, 'with no photo';
  assert (select name from public.products where id = 350) = 'Uncle Al''s cookies', '#350 is Uncle Al''s cookies';
  assert (select name from public.products where id = 351) = 'Uncle Al''s creme', '#351 is Uncle Al''s creme';
  assert (select variants from public.products where id = 351) = '[]'::jsonb, '#351 has no Lemon ice variant';
  assert (select count(*) from public.products where id in (350, 351) and img is null) = 2, 'neither has the Lemon Ice photo';
  assert not exists (select 1 from public.products where img = 'uncle_al_s_cookies.jpg'), 'no row names it';
  assert not exists (select 1 from public.products where lower(name || ' ' || description || ' ' || variants::text) like '%lemon ice%'),
    'nothing says Lemon ice';
  assert (select sku from public.products where id = 351) = 'AW-UNCLE-AL-S-COOKIES', '#351 keeps its Quick Reorder code';
  select string_agg(name, ', ') into dupes from (
    select lower(btrim(name)) as name from public.products where id < 90000 and active group by 1 having count(*) > 1
  ) d;
  assert dupes is null, 'products sharing a name: ' || dupes;

  -- Run again over the seed: nothing changes.
  assert pg_temp.p25_apply() = 0, 'a re-run changes no row';
  assert pg_temp.p25_rows() = seeded, 'and no value';

  -- Over the live database's values: the same result, once.
  perform pg_temp.p25_old();
  assert pg_temp.p25_rows() <> seeded, 'the old values are back';
  assert pg_temp.p25_apply() = 10, 'two for #219, one for #295, three for #351, the photo of both, and two for #350';
  assert pg_temp.p25_rows() = seeded, 'to the seed''s values';
  assert pg_temp.p25_apply() = 0, 'and a second run changes nothing';

  -- A Lemon ice staff marked "can't be ordered" goes with the variant.
  perform pg_temp.p25_old();
  update public.products set unavailable_variants = '["Lemon ice"]'::jsonb where id = 351;
  assert pg_temp.p25_apply() = 11, 'the list of variants that can''t be ordered empties too';
  assert pg_temp.p25_rows() = seeded, 'back to the seed''s values';

  -- An admin's own value is kept.
  perform pg_temp.p25_old();
  update public.products set sub = 'Seasonal', description = 'Staff copy for the jar.' where id = 219;
  update public.products set name = 'Uncle Al''s (staff)' where id = 350;
  update public.products set img = 'p351-staff-photo.jpg' where id = 351;
  assert pg_temp.p25_apply() = 6, 'the other six change';
  assert (select sub || '|' || description from public.products where id = 219) = 'Seasonal|Staff copy for the jar.', 'a line and copy staff set stay';
  assert (select name from public.products where id = 350) = 'Uncle Al''s (staff)', 'so does a name staff changed';
  assert (select img from public.products where id = 351) = 'p351-staff-photo.jpg', 'and a photo staff set';
  assert (select name from public.products where id = 351) = 'Uncle Al''s creme', 'while #351 is renamed';
  update public.products set sub = 'Gifts', description = 'Happy valentines jar, a novelty gift sold from a counter jar. Three varieties: 4 inch, 6 inch and Colored.' where id = 219;
  update public.products set name = 'Uncle Al''s cookies' where id = 350;
  update public.products set img = null where id = 351;
  assert pg_temp.p25_rows() = seeded, 'put back';
end $$;

-- An order line for #351 is the product itself, whatever variant an old cart
-- sends: no variant, so no "Lemon ice" in the line's name or code.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000025a1', 'p25-buyer@example.com', '{"name": "P25 Buyer"}');
update public.profiles set status = 'approved', pricing_tier = 'silver' where id = '00000000-0000-4000-8000-0000000025a1';
insert into public.orders (id, user_id, ref_num, business, contact, email, phone, delivery)
values ('00000000-0000-4000-8000-0000000025f1', '00000000-0000-4000-8000-0000000025a1', 'T-P25-CREME', 'P25 Market', 'P25 Buyer', 'p25-buyer@example.com', '555-0125', 'willcall');
insert into public.order_items (order_id, product_id, product_name, sku, variant, qty) values
  ('00000000-0000-4000-8000-0000000025f1', 351, 'x', 'x', null, 2),
  ('00000000-0000-4000-8000-0000000025f1', 219, 'x', 'x', 'Colored', 1);

do $$ begin
  assert (select product_name || '|' || sku || '|' || coalesce(variant, '-') from public.order_items
    where order_id = '00000000-0000-4000-8000-0000000025f1' and product_id = 351) = 'Uncle Al''s creme|AW-UNCLE-AL-S-COOKIES|-',
    'the line is Uncle Al''s creme, with the product''s code';
  assert (select product_name from public.order_items where order_id = '00000000-0000-4000-8000-0000000025f1' and product_id = 219)
    = 'Happy valentines jar — Colored', 'the jar is still sold, with its variants';
end $$;

-- Leave the shared database as later test files expect it.
delete from public.orders where email like 'p25-%@example.com';
