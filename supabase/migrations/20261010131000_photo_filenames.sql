-- Photo file names on the p<id>-<slug> convention (AW-290).
--
-- Data only: six photo files in src/assets/products were renamed (a typo,
-- a misleading or a brandless name), and src/data/products.js and the
-- regenerated seed name the new files. This gives the rows already in the
-- database the same img. No schema, function or privilege changes.
--   #21  men_s_deodorant.jpg    -> p21-speed-stick-mens-deodorant.jpg
--   #110 brillo_dishwasher.png  -> p110-brillo-basics-dish-liquid.png
--   #128 fabulouso.avif         -> p128-fabuloso.avif
--   #225 women_s_deodorant.webp -> p225-lady-speed-stick-deodorant.webp
--   #280 coastal_moto_oil.jpg   -> p280-coastal-motor-oil.jpg
--   #292 electrolyte.webp       -> p292-electrolit.webp
-- The shared gain.jpg (#112, #333) and p_gatorade.jpg (#335, #336) keep their
-- names until there is a photo of each product (AW-136).
--
-- A row changes only while it still names exactly the old file the seed
-- wrote, so a photo an admin has set since is kept, and running this file
-- again changes nothing (AW-032).
--
-- Ids, SKUs and variant labels don't change, so stored carts, Quick Reorder
-- codes and order history are unaffected.
--
-- Release order: AFTER the frontend that ships the renamed files. That
-- frontend reads both names (IMAGE_FILE_ALIASES in
-- src/data/catalogAliases.js); the frontend deployed before it ships only the
-- old files and would show "Photo coming soon" for these six products.

update public.products p
   set img = v.new_img
  from (values
    (21, 'men_s_deodorant.jpg', 'p21-speed-stick-mens-deodorant.jpg'),
    (110, 'brillo_dishwasher.png', 'p110-brillo-basics-dish-liquid.png'),
    (128, 'fabulouso.avif', 'p128-fabuloso.avif'),
    (225, 'women_s_deodorant.webp', 'p225-lady-speed-stick-deodorant.webp'),
    (280, 'coastal_moto_oil.jpg', 'p280-coastal-motor-oil.jpg'),
    (292, 'electrolyte.webp', 'p292-electrolit.webp')
  ) as v(id, old_img, new_img)
 where p.id = v.id
   and p.img = v.old_img;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration, e.g. before rolling the frontend back to one from before AW-290,
-- which ships only the old files. It puts back the old name only where the
-- row still has the new one. The frontend with the renamed files works with
-- either name.
--
-- update public.products p
--    set img = v.old_img
--   from (values
--     (21, 'men_s_deodorant.jpg', 'p21-speed-stick-mens-deodorant.jpg'),
--     (110, 'brillo_dishwasher.png', 'p110-brillo-basics-dish-liquid.png'),
--     (128, 'fabulouso.avif', 'p128-fabuloso.avif'),
--     (225, 'women_s_deodorant.webp', 'p225-lady-speed-stick-deodorant.webp'),
--     (280, 'coastal_moto_oil.jpg', 'p280-coastal-motor-oil.jpg'),
--     (292, 'electrolyte.webp', 'p292-electrolit.webp')
--   ) as v(id, old_img, new_img)
--  where p.id = v.id
--    and p.img = v.new_img;
