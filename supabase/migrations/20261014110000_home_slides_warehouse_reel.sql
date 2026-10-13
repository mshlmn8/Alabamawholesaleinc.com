-- The home page's hero photos become the owner's warehouse reel (AW-006, the
-- owner's answer of October 2026).
--
-- Data only: no schema, function, policy or privilege changes.
--
-- 20261011131000_home_slides.sql created public.home_slides (Admin ->
-- Homepage) and added the four photos the site showed then to the empty
-- table: hero_candy.jpg, hero_vape.jpg, hero_lighters.jpg and
-- hero_gatorade.jpg. The site now ships the owner's 37 photos of the
-- warehouse, and the home page's bundled carousel is eight of them, in this
-- order: the building's sign, a truck, Graymont Ave, an aisle, then soda,
-- snacks, candy and the candy room (HERO_REEL in src/data/warehousePhotos.js;
-- the contact page shows the other 29). Without this file, applying
-- 20261011131000 would put the four old photos back on the home page.
--
-- So while the table still holds exactly the four rows 20261011131000
-- added, unchanged (the same photo, alt text, link, warning, order and shown),
-- they are replaced by the eight. A table staff have changed in any way
-- (a row edited, added, turned off, moved or deleted; also an empty one) is
-- left as it is, and running this file again changes nothing: the table then
-- holds the eight. The old four stay bundled with the site, so staff can
-- still choose them in Admin -> Homepage.
--
-- Each row's alt text, link and order are HERO_REEL's word for word
-- (src/data/warehousePhotos.test.js checks), and none carries the FDA
-- warning: none of the eight shows a nicotine product.
--
-- Release: with or after 20261011131000 (best in the same session, so the
-- home page never shows the four old photos from the table), before or
-- after the frontend. Every frontend that reads the table shows its rows; the
-- new frontend's bundled photos (shown while the table is missing or can't
-- be read) are the same eight. On a database without the table this file
-- does nothing.

do $$
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
end $$;

-- ---------------------------------------------------------------------------
-- Reverse. Not run; copy into the SQL editor to put the four earlier photos
-- back (only while the table still holds the eight this file added).
--
-- do $$
-- begin
--   if (select count(*) from public.home_slides) = 8
--      and not exists (select 1 from public.home_slides where img not like 'hero_wh_%') then
--     delete from public.home_slides;
--     insert into public.home_slides (img, alt, go_cat, nicotine_warning, sort) values
--       ('hero_candy.jpg', 'Display box of Turtles Bites chocolates', 'CANDIES', false, 10),
--       ('hero_vape.jpg', 'Geek Bar Pulse X disposable vape advertisement', 'NOVELTIES', true, 20),
--       ('hero_lighters.jpg', 'BIC lighters in a counter display tray', 'MERCHANDISE', false, 30),
--       ('hero_gatorade.jpg', 'Gatorade and G2 bottles', 'DRINKS & BAGS', false, 40);
--   end if;
-- end $$;
