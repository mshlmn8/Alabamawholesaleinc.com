-- Stage 2 packshots for products already in the database (November 2026).
--
-- Data only: four rows that the seed left with no photo get the transparent
-- PNG the catalog now names. New databases get the same filenames from the
-- regenerated seed. No schema, function or privilege changes.
--   #139  Vinut                         -> p139-vinut.png
--   #141  Tropical Fantasy Aloe Vera    -> p141-tropical-fantasy-aloe.png
--   #274  RAW Guarana wraps             -> p274-raw-guarana.png
--   #331  Panasonic batteries           -> p331-panasonic.png
-- Stage 1 rows (ids 369 and up) are new, so the seed inserts them with
-- their photos. This file does not touch them.
--
-- A row changes only while img is still null, so a photo an admin has set
-- is kept, and running this file again changes nothing (AW-032).
--
-- Ids, SKUs and variant labels don't change, so stored carts, Quick Reorder
-- codes and order history are unaffected.
--
-- Release order: AFTER the frontend that ships these files. A frontend from
-- before this change has no such files and would show "Photo coming soon"
-- once the database names them. The new frontend shows the photos from its
-- bundled catalog even before this file is applied.

update public.products p
   set img = v.new_img
  from (values
    (139, 'p139-vinut.png'),
    (141, 'p141-tropical-fantasy-aloe.png'),
    (274, 'p274-raw-guarana.png'),
    (331, 'p331-panasonic.png')
  ) as v(id, new_img)
 where p.id = v.id
   and p.img is null;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration, e.g. before rolling the frontend back to one that does not
-- ship these files. It clears the photo only where the row still names the
-- file this migration wrote.
--
-- update public.products p
--    set img = null
--   from (values
--     (139, 'p139-vinut.png'),
--     (141, 'p141-tropical-fantasy-aloe.png'),
--     (274, 'p274-raw-guarana.png'),
--     (331, 'p331-panasonic.png')
--   ) as v(id, new_img)
--  where p.id = v.id
--    and p.img = v.new_img;
