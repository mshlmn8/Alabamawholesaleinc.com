-- The home page's hero photos become the owner's warehouse reel
-- (20261014110000_home_slides_warehouse_reel.sql, AW-006).
--
-- After the migrations, the table holds the eight reel photos in their
-- order, with their alt text and links, none with the FDA warning, all
-- shown, and guests read them. The migration's block, run again, changes
-- nothing; run over the four rows 20261011131000 added, it swaps them for the
-- eight; and it leaves a table staff have changed in any way as it is.
--
-- pg_temp.p26_apply() runs the migration's block word for word
-- (src/data/warehousePhotos.test.js checks it matches the file). pg_temp
-- lives for the whole run: the p26_ prefix keeps these helpers apart from
-- other files'. The table is left as the migrations left it.
create or replace function pg_temp.p26_apply() returns void language plpgsql as $fn$
begin
  if to_regclass('public.home_slides') is null then
    return;
  end if;
  -- Only the four rows 20261011131000 added, exactly as it added them.
  if (select count(*) from public.home_slides) <> 4
     or (select count(*)
         from public.home_slides s
         join (values
           ('hero_candy.jpg', 'Display box of Turtles Bites chocolates', 'CANDIES', false, 10),
           ('hero_vape.jpg', 'Geek Bar Pulse X disposable vape advertisement', 'NOVELTIES', true, 20),
           ('hero_lighters.jpg', 'BIC lighters in a counter display tray', 'MERCHANDISE', false, 30),
           ('hero_gatorade.jpg', 'Gatorade and G2 bottles', 'DRINKS & BAGS', false, 40)
         ) as v (img, alt, go_cat, nicotine_warning, sort)
           on s.img = v.img and s.alt = v.alt and s.go_cat is not distinct from v.go_cat
          and s.nicotine_warning = v.nicotine_warning and s.sort = v.sort and s.active) <> 4
  then
    return;
  end if;
  delete from public.home_slides;
  insert into public.home_slides (img, alt, go_cat, nicotine_warning, sort)
  values
    ('hero_wh_sign.jpg', 'The Alabama Wholesale Inc sign above the loading doors', null, false, 10),
    ('hero_wh_truck.jpg', 'Two box trucks, one with the Alabama Wholesale logo, at the warehouse', null, false, 20),
    ('hero_wh_graymont.jpg', 'The Graymont Ave N street sign in front of the warehouse', null, false, 30),
    ('hero_wh_aisle.jpg', 'A long warehouse aisle of stocked pallet racks', null, false, 40),
    ('hero_wh_soda.jpg', 'Pallets of Faygo soda by the case', 'DRINKS & BAGS', false, 50),
    ('hero_wh_snack_aisle.jpg', 'Cases of Cheez-It, Pop-Tarts and cereal on pallet racks', 'FOOD STUFF', false, 60),
    ('hero_wh_candy.jpg', 'Shelves of Reese’s, Hershey’s, M&M’s and Kit Kat', 'CANDIES', false, 70),
    ('hero_wh_candy_room.jpg', 'The candy room: shelves of candy boxes and stacked cases on a checkered floor', null, false, 80);
end $fn$;

-- The four rows 20261011131000 adds to an empty table.
create or replace function pg_temp.p26_old() returns void language sql as $fn$
  delete from public.home_slides;
  insert into public.home_slides (img, alt, go_cat, nicotine_warning, sort) values
    ('hero_candy.jpg', 'Display box of Turtles Bites chocolates', 'CANDIES', false, 10),
    ('hero_vape.jpg', 'Geek Bar Pulse X disposable vape advertisement', 'NOVELTIES', true, 20),
    ('hero_lighters.jpg', 'BIC lighters in a counter display tray', 'MERCHANDISE', false, 30),
    ('hero_gatorade.jpg', 'Gatorade and G2 bottles', 'DRINKS & BAGS', false, 40);
$fn$;

-- The table, one row a line, in the home page's order.
create or replace function pg_temp.p26_rows() returns text language sql as $fn$
  select coalesce(string_agg(format('%s|%s|%s|%s|%s|%s', img, alt, coalesce(go_cat, '-'), nicotine_warning, sort, active), E'\n' order by sort, id), '')
  from public.home_slides
$fn$;

create or replace function pg_temp.p26_reel() returns text language sql as $fn$
  select string_agg(format('%s|%s|%s|%s|%s|%s', v.img, v.alt, coalesce(v.go_cat, '-'), false, v.sort, true), E'\n' order by v.sort)
  from (values
    ('hero_wh_sign.jpg', 'The Alabama Wholesale Inc sign above the loading doors', null, 10),
    ('hero_wh_truck.jpg', 'Two box trucks, one with the Alabama Wholesale logo, at the warehouse', null, 20),
    ('hero_wh_graymont.jpg', 'The Graymont Ave N street sign in front of the warehouse', null, 30),
    ('hero_wh_aisle.jpg', 'A long warehouse aisle of stocked pallet racks', null, 40),
    ('hero_wh_soda.jpg', 'Pallets of Faygo soda by the case', 'DRINKS & BAGS', 50),
    ('hero_wh_snack_aisle.jpg', 'Cases of Cheez-It, Pop-Tarts and cereal on pallet racks', 'FOOD STUFF', 60),
    ('hero_wh_candy.jpg', 'Shelves of Reese’s, Hershey’s, M&M’s and Kit Kat', 'CANDIES', 70),
    ('hero_wh_candy_room.jpg', 'The candy room: shelves of candy boxes and stacked cases on a checkered floor', null, 80)
  ) as v (img, alt, go_cat, sort)
$fn$;

-- ---------------------------------------------------------------------------
-- As the migrations leave it.
-- ---------------------------------------------------------------------------
do $$ begin
  assert pg_temp.p26_rows() = pg_temp.p26_reel(), 'the table holds the eight reel photos, in order, shown, without the warning';
  assert (select count(*) from public.home_slides where img like 'hero_wh_%') = 8, 'all eight are warehouse photos';
  assert not exists (select 1 from public.home_slides where img in ('hero_candy.jpg', 'hero_vape.jpg', 'hero_lighters.jpg', 'hero_gatorade.jpg')),
    'the four earlier photos are gone from the table';
end $$;

select test_anon();
do $$ begin
  assert (select count(*) from public.home_slides) = 8, 'a guest reads the eight';
end $$;
select test_reset();

-- Run again: nothing changes, not even the ids.
create temp table p26_ids as select id from public.home_slides;
select pg_temp.p26_apply();
do $$ begin
  assert pg_temp.p26_rows() = pg_temp.p26_reel(), 'a second run changes nothing';
  assert (select count(*) from public.home_slides s join pg_temp.p26_ids i using (id)) = 8, 'and keeps the same rows';
end $$;
drop table pg_temp.p26_ids;

-- ---------------------------------------------------------------------------
-- Over the four rows 20261011131000 added: swapped for the eight.
-- ---------------------------------------------------------------------------
select pg_temp.p26_old();
select pg_temp.p26_apply();
do $$ begin
  assert pg_temp.p26_rows() = pg_temp.p26_reel(), 'the four seeded rows become the reel';
end $$;

-- ---------------------------------------------------------------------------
-- A table staff have changed is left as it is.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.p26_kept(change text, what text) returns void language plpgsql as $fn$
declare before text;
begin
  perform pg_temp.p26_old();
  execute change;
  before := pg_temp.p26_rows();
  perform pg_temp.p26_apply();
  assert pg_temp.p26_rows() = before, what;
end $fn$;

select pg_temp.p26_kept($s$update public.home_slides set alt = 'BIC lighters on the counter' where img = 'hero_lighters.jpg'$s$, 'an edited alt text keeps the table');
select pg_temp.p26_kept($s$update public.home_slides set go_cat = null where img = 'hero_candy.jpg'$s$, 'so does a removed link');
select pg_temp.p26_kept($s$update public.home_slides set nicotine_warning = false where img = 'hero_vape.jpg'$s$, 'and a changed warning');
select pg_temp.p26_kept($s$update public.home_slides set active = false where img = 'hero_gatorade.jpg'$s$, 'a photo turned off keeps it');
select pg_temp.p26_kept($s$update public.home_slides set sort = case img when 'hero_candy.jpg' then 20 else 10 end where img in ('hero_candy.jpg', 'hero_vape.jpg')$s$,
  'so does a new order');
select pg_temp.p26_kept($s$update public.home_slides set img = 'hero_wh_sign.jpg' where img = 'hero_candy.jpg'$s$, 'and a changed photo');
select pg_temp.p26_kept($s$insert into public.home_slides (img, alt, sort) values ('https://abcdefgh.supabase.co/storage/v1/object/public/product-images/home/1760000000000-p26.jpg', 'P26 upload', 50)$s$,
  'an added photo keeps it');
select pg_temp.p26_kept($s$delete from public.home_slides where img = 'hero_gatorade.jpg'$s$, 'so does a deleted one');
select pg_temp.p26_kept($s$delete from public.home_slides$s$, 'and an emptied table stays empty');
do $$ begin
  assert pg_temp.p26_rows() = '', 'still empty';
end $$;

-- ---------------------------------------------------------------------------
-- Leave the table as the migrations left it.
-- ---------------------------------------------------------------------------
select pg_temp.p26_old();
select pg_temp.p26_apply();
do $$ begin
  assert pg_temp.p26_rows() = pg_temp.p26_reel(), 'back to the reel';
end $$;
