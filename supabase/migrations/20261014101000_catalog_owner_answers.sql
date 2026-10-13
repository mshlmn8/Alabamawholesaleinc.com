-- The owner's catalog answers of 2026-09-28 (Cursor's draft PR #11, AW-140,
-- AW-070), on the rows already in the database.
--
-- Data only: the rows get the values src/data/products.js now has, which
-- reach new databases through the regenerated seed. No schema, function or
-- privilege changes. Ids, SKUs and the other rows are unchanged.
--   (a) #219 Happy valentines jar is a novelty gift, not a pill: it moves from
--       Novelties -> Wellness Pills to a new Novelties -> Gifts line. Its
--       name and variants (4 inch, 6 inch, Colored) are unchanged; its
--       description no longer says "wellness pill line".
--   (b) #295 Snack wraps is a chips brand: "Snack wraps, a chips brand. Two
--       sizes: 40ct and 12ct. Flavors vary by availability." No photo.
--   (c) Uncle Al's stays two rows: #350 "Uncle Al's cookies" and #351 "Uncle
--       Al's creme", flavors varying by availability. #351 loses its only
--       variant, "Lemon ice", and both lose the Lemon Ice box photo
--       (uncle_al_s_cookies.jpg, no longer shipped). #351 keeps its SKU
--       (AW-UNCLE-AL-S-COOKIES, a Quick Reorder code). #351 is renamed
--       before #350 takes the name it had.
--
-- Each update changes a row only while it still holds exactly the value the
-- seed (or 20261012130000_catalog_fixups.sql, for #350's name) wrote, so an
-- admin's edit is never overwritten, and running this file again changes
-- nothing (AW-032).
--
-- Old keys keep working: a cart line saved as 351::lemon-ice is the product
-- itself (VARIANT_ALIASES in src/data/catalogAliases.js), and order_items keep
-- their snapshots (product_name, sku, variant), so order history still shows
-- "Uncle Al's cookies — Lemon ice" where an order said so. A variant price
-- kept for (351, 'Lemon ice') in product_variant_prices is left alone; with
-- no such variant, my_prices() and the order-line trigger no longer use it.
-- Until this file is applied, the storefront shows the database's names and
-- line (as for every catalog fix), but never the retired photo
-- (RETIRED_IMAGE_FILES in src/data/catalogAliases.js).
--
-- Release order: any time, after 20261012130000_catalog_fixups.sql (which
-- gives #350 the name this file moves on from), before or after the frontend,
-- also on its own.

-- ---------------------------------------------------------------------------
-- (a) #219 to Gifts.
-- ---------------------------------------------------------------------------
update public.products set sub = 'Gifts' where id = 219 and sub = 'Wellness Pills';
update public.products set description = 'Happy valentines jar, a novelty gift sold from a counter jar. Three varieties: 4 inch, 6 inch and Colored.' where id = 219 and description = 'Happy valentines jar from the wellness pill line in our Novelties department. Three varieties: 4 inch, 6 inch and Colored.';

-- ---------------------------------------------------------------------------
-- (b) #295 Snack wraps.
-- ---------------------------------------------------------------------------
update public.products set description = 'Snack wraps, a chips brand. Two sizes: 40ct and 12ct. Flavors vary by availability.' where id = 295 and description = 'Snack wraps from the chips and crackers line in our Food Stuff department. Two sizes: 40ct and 12ct.';

-- ---------------------------------------------------------------------------
-- (c) Uncle Al's: #351 first, then #350.
-- ---------------------------------------------------------------------------
update public.products set name = 'Uncle Al''s creme' where id = 351 and name = 'Uncle Al''s cookies';
update public.products set variants = '[]'::jsonb where id = 351 and variants = '["Lemon ice"]'::jsonb;
update public.products set unavailable_variants = '[]'::jsonb where id = 351 and unavailable_variants = '["Lemon ice"]'::jsonb;
update public.products set description = 'Uncle Al''s creme, from the cookie line in our Food Stuff department. Flavors vary by availability.' where id = 351 and description = 'Uncle Al''s cookies in single-serve packs. Stocked in one variety: Lemon ice.';
update public.products set img = null where id in (350, 351) and img = 'uncle_al_s_cookies.jpg';
update public.products set name = 'Uncle Al''s cookies' where id = 350 and name = 'Uncle Al''s';
update public.products set description = 'Uncle Al''s cookies, from the cookie line in our Food Stuff department. Flavors vary by availability.' where id = 350 and description = 'Uncle Al''s cookies, from the cookie line in our Food Stuff department.';

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration. Each statement puts back the old value only where the row still
-- has the new one. The photo file is no longer shipped, so a row naming it
-- shows the "Photo coming soon" placeholder either way.
--
-- update public.products set description = 'Uncle Al''s cookies, from the cookie line in our Food Stuff department.' where id = 350 and description = 'Uncle Al''s cookies, from the cookie line in our Food Stuff department. Flavors vary by availability.';
-- update public.products set name = 'Uncle Al''s' where id = 350 and name = 'Uncle Al''s cookies';
-- update public.products set img = 'uncle_al_s_cookies.jpg' where id in (350, 351) and img is null;
-- update public.products set description = 'Uncle Al''s cookies in single-serve packs. Stocked in one variety: Lemon ice.' where id = 351 and description = 'Uncle Al''s creme, from the cookie line in our Food Stuff department. Flavors vary by availability.';
-- update public.products set variants = '["Lemon ice"]'::jsonb where id = 351 and variants = '[]'::jsonb;
-- update public.products set name = 'Uncle Al''s cookies' where id = 351 and name = 'Uncle Al''s creme';
-- update public.products set description = 'Snack wraps from the chips and crackers line in our Food Stuff department. Two sizes: 40ct and 12ct.' where id = 295 and description = 'Snack wraps, a chips brand. Two sizes: 40ct and 12ct. Flavors vary by availability.';
-- update public.products set description = 'Happy valentines jar from the wellness pill line in our Novelties department. Three varieties: 4 inch, 6 inch and Colored.' where id = 219 and description = 'Happy valentines jar, a novelty gift sold from a counter jar. Three varieties: 4 inch, 6 inch and Colored.';
-- update public.products set sub = 'Wellness Pills' where id = 219 and sub = 'Gifts';
