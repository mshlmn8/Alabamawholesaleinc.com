-- Official packshots for rows that still had no photo (November 2026).
--
-- Data only: products that still have no photo get the transparent PNG the
-- catalog now names. A fresh database gets the same filenames from the
-- regenerated seed. No schema, function or privilege changes.
--   #9 Royal Blunts EZ Roll
--   #211 Cheyenne filtered cigars
--
-- A row changes only while img is still null, so a photo an admin has set
-- is kept, and running this file again changes nothing (AW-032).
--
-- Ids, SKUs and variant labels don't change.
--
-- Release order: AFTER the frontend that ships these files.

update public.products p
   set img = v.new_img
  from (values
    (9, 'p9-royal-blunts-ez-roll.png'),
    (211, 'p211-cheyenne.png')
  ) as v(id, new_img)
 where p.id = v.id
   and p.img is null;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run. Clears the photo only where the row still
-- names the file this migration wrote.
--
-- update public.products p
--    set img = null
--   from (values
--     (9, 'p9-royal-blunts-ez-roll.png'),
--     (211, 'p211-cheyenne.png')
--   ) as v(id, new_img)
--  where p.id = v.id
--    and p.img = v.new_img;
