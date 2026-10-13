-- Straight apostrophes in two product names (AW-064).
--
-- Data only: the rows already in the database get the spelling made in
-- src/data/products.js, which reaches new databases through the regenerated
-- seed. No schema, function or privilege changes.
--   #163 "M&M’s" and #166 "Reese’s" were the only names and brands in the
--   catalog written with a curly apostrophe (U+2019); every other
--   possessive name (Hershey's, Welch's, Goody's, Wrigley's, ...) has a
--   straight one. Both rows get "M&M's" and "Reese's" as name and brand.
--
-- Each update changes a row only while it still holds exactly the value the
-- seed wrote, so an admin's edit is never overwritten, and running this file
-- again changes nothing (AW-032).
--
-- Ids, SKUs and variant labels don't change, so stored carts, Quick Reorder
-- codes and order history are unaffected; order_items keep the product name
-- an order was placed with.
--
-- Release order: any time. The storefront search treats ’ and ' alike
-- (src/lib/search.js), so the frontend finds these products by either
-- spelling before and after this migration.

update public.products set name = 'M&M''s' where id = 163 and name = 'M&M’s';
update public.products set brand = 'M&M''s' where id = 163 and brand = 'M&M’s';
update public.products set name = 'Reese''s' where id = 166 and name = 'Reese’s';
update public.products set brand = 'Reese''s' where id = 166 and brand = 'Reese’s';

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration. Each statement puts back the old value only where the row still
-- has the new one. Any frontend works with either spelling.
--
-- update public.products set name = 'M&M’s' where id = 163 and name = 'M&M''s';
-- update public.products set brand = 'M&M’s' where id = 163 and brand = 'M&M''s';
-- update public.products set name = 'Reese’s' where id = 166 and name = 'Reese''s';
-- update public.products set brand = 'Reese’s' where id = 166 and brand = 'Reese''s';
