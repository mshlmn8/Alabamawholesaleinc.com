-- More stage 2 packshots for rows already in the database (November 2026).
--
-- Data only: products that still have no photo get the transparent PNG the
-- catalog now names. A fresh database gets the same filenames from the
-- regenerated seed. No schema, function or privilege changes.
--   #311 Geek Bar Mate 60K pods
--   #369 Al Capone cigars 10-pack
--   #373 Djarum cigars
--   #386 Jungo leaf 2-pack
--   #389 LooseLeaf slugs
--   #394 ALP nicotine pouches 9mg
--   #413 MFU 70K
--   #414 MFU 80K
--   #529 BluntEffects candles
--   #569 Sour Jacks
--   #573 5 Gum
--   #576 Extra gum share size
--   #595 Chips Ahoy cookies
--   #599 Coffee-Mate
--   #608 OKF aloe vera with fruit
--   #609 OKF Farmer's aloe vera
--   #611 Skittles beverage
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
    (311, 'p311-geekbar-mate-pods.png'),
    (369, 'p369-al-capone-10pk.png'),
    (373, 'p373-djarum.png'),
    (386, 'p386-jungo-leaf.png'),
    (389, 'p389-looseleaf-slugs.png'),
    (394, 'p394-alp-9mg.png'),
    (413, 'p413-mfu-70k.png'),
    (414, 'p414-mfu-80k.png'),
    (529, 'p529-blunteffects-candles.png'),
    (569, 'p569-sour-jacks.png'),
    (573, 'p573-5-gum.png'),
    (576, 'p576-extra-share.png'),
    (595, 'p595-chips-ahoy.png'),
    (599, 'p599-coffee-mate.png'),
    (608, 'p608-okf-aloe-fruit.png'),
    (609, 'p609-okf-farmers-aloe.png'),
    (611, 'p611-skittles-drink.png')
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
--     (311, 'p311-geekbar-mate-pods.png'),
--     (369, 'p369-al-capone-10pk.png'),
--     (373, 'p373-djarum.png'),
--     (386, 'p386-jungo-leaf.png'),
--     (389, 'p389-looseleaf-slugs.png'),
--     (394, 'p394-alp-9mg.png'),
--     (413, 'p413-mfu-70k.png'),
--     (414, 'p414-mfu-80k.png'),
--     (529, 'p529-blunteffects-candles.png'),
--     (569, 'p569-sour-jacks.png'),
--     (573, 'p573-5-gum.png'),
--     (576, 'p576-extra-share.png'),
--     (595, 'p595-chips-ahoy.png'),
--     (599, 'p599-coffee-mate.png'),
--     (608, 'p608-okf-aloe-fruit.png'),
--     (609, 'p609-okf-farmers-aloe.png'),
--     (611, 'p611-skittles-drink.png')
--   ) as v(id, new_img)
--  where p.id = v.id
--    and p.img = v.new_img;
