-- One naming style for product names (AW-071).
--
-- Data only: the rows already in the database get the names and
-- descriptions written in src/data/products.js, which reach new databases
-- through the regenerated seed. No schema, function or privilege changes.
--   Each change comes from the row's own data, nothing new is claimed:
--   - "Value" for "Cheap" (#100, #221, #246, #250), as the descriptions of
--     #100, #246 and #250 already said; #221's description follows its name.
--   - No retail price in a name: #12 "LooseLeaf wraps 2-pack" (its
--     description keeps the $2.99 and $1.99 price points).
--   - Sizes: a size word in brackets, like "Tums (small)" (#132, #133, #190,
--     #290, #291, #335, #336), a measured size written plainly like
--     "Minute Maid 20 oz" (#58), and "6-pack" (#93).
--   - The brand's own casing: #286 "AA Cellular", and in the descriptions
--     #9 "EZ Roll", #274 "RAW Guarana" and #310/#311 "Geek Bar Mate".
--   - A product noun taken from the description where the name was only the
--     brand: #25 "Claritin allergy relief", #350 "Uncle Al's cookies",
--     #355 "Gold Band lubricants".
--   The lines under legal review (Kratom & Kava, Mushroom Products, Detox,
--   Wellness Pills, the Honey & Energy enhancement items) keep their names
--   and descriptions (owner decision 2; docs/OWNER-TODO.md, AW-071).
--
-- Each update changes a row only while it still holds exactly the value the
-- seed wrote, so an admin's edit is never overwritten, and running this file
-- again changes nothing (AW-032).
--
-- Ids, SKUs (the AW-CHEAP-* codes stay: they are Quick Reorder codes) and
-- variant labels (#252's "Cheap" is a cart key) don't change, so stored
-- carts, Quick Reorder codes and order history are unaffected; order_items
-- keep the product name an order was placed with.
--
-- Release order: any time, before or after the frontend. Every frontend reads
-- the names from the database; a cart line shows the current name.

update public.products set description = 'EZ Roll from the cigar and cigarillo line in our Tobacco department. Eight varieties: Flavorless, OGK, Sour apple, Wet mango, Purple haze, Strawberry, Blueberry and Jamaican rum.' where id = 9 and description = 'Ez roll from the cigar and cigarillo line in our Tobacco department. Eight varieties: Flavorless, OGK, Sour apple, Wet mango, Purple haze, Strawberry, Blueberry and Jamaican rum.';
update public.products set name = 'LooseLeaf wraps 2-pack' where id = 12 and name = 'LooseLeaf wraps 2-pack ($2.99 or $1.99)';
update public.products set name = 'Claritin allergy relief' where id = 25 and name = 'Claritin';
update public.products set name = 'Faygo bottles 20 oz' where id = 58 and name = 'Faygo bottles (20 oz)';
update public.products set name = '6-pack beer carriers' where id = 93 and name = '6pk beer carriers';
update public.products set name = 'Value antifreeze' where id = 100 and name = 'Cheap antifreeze';
update public.products set name = 'Charcoal bags (small)' where id = 132 and name = 'Charcoal bags small';
update public.products set name = 'Charcoal bags (big)' where id = 133 and name = 'Charcoal bags big';
update public.products set name = 'Mamba (small)' where id = 190 and name = 'Mamba small';
update public.products set name = 'Value scales' where id = 221 and name = 'Cheap scales';
update public.products set description = 'Value scales from the smoke accessory line in our Novelties department. Three sizes: Big, Medium and Small.' where id = 221 and description = 'Cheap scales from the smoke accessory line in our Novelties department. Three sizes: Big, Medium and Small.';
update public.products set name = 'Value incense' where id = 246 and name = 'Cheap incense';
update public.products set name = 'Value lighters' where id = 250 and name = 'Cheap lighters';
update public.products set description = 'RAW Guarana wraps from the wraps and leaf line in our Tobacco department.' where id = 274 and description = 'Raw guarana wraps from the wraps and leaf line in our Tobacco department.';
update public.products set name = 'AA Cellular Bluetooth headphones' where id = 286 and name = 'AA cellular Bluetooth headphones';
update public.products set name = 'Powerade (big)' where id = 290 and name = 'Powerade big';
update public.products set name = 'Powerade (small)' where id = 291 and name = 'Powerade small';
update public.products set description = 'Geek Bar Mate from the disposable vape line in our Novelties department.' where id = 310 and description = 'Geek Bar mate from the disposable vape line in our Novelties department.';
update public.products set description = 'Geek Bar Mate pods from the vape pod line in our Novelties department.' where id = 311 and description = 'Geek Bar mate pods from the vape pod line in our Novelties department.';
update public.products set name = 'Gatorade (small)' where id = 335 and name = 'Gatorade small';
update public.products set name = 'Gatorade (big)' where id = 336 and name = 'Gatorade big';
update public.products set name = 'Uncle Al''s cookies' where id = 350 and name = 'Uncle Al''s';
update public.products set name = 'Gold Band lubricants' where id = 355 and name = 'Gold Band';

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration. Each statement puts back the old value only where the row still
-- has the new one. Any frontend works with either name.
--
-- update public.products set description = 'Ez roll from the cigar and cigarillo line in our Tobacco department. Eight varieties: Flavorless, OGK, Sour apple, Wet mango, Purple haze, Strawberry, Blueberry and Jamaican rum.' where id = 9 and description = 'EZ Roll from the cigar and cigarillo line in our Tobacco department. Eight varieties: Flavorless, OGK, Sour apple, Wet mango, Purple haze, Strawberry, Blueberry and Jamaican rum.';
-- update public.products set name = 'LooseLeaf wraps 2-pack ($2.99 or $1.99)' where id = 12 and name = 'LooseLeaf wraps 2-pack';
-- update public.products set name = 'Claritin' where id = 25 and name = 'Claritin allergy relief';
-- update public.products set name = 'Faygo bottles (20 oz)' where id = 58 and name = 'Faygo bottles 20 oz';
-- update public.products set name = '6pk beer carriers' where id = 93 and name = '6-pack beer carriers';
-- update public.products set name = 'Cheap antifreeze' where id = 100 and name = 'Value antifreeze';
-- update public.products set name = 'Charcoal bags small' where id = 132 and name = 'Charcoal bags (small)';
-- update public.products set name = 'Charcoal bags big' where id = 133 and name = 'Charcoal bags (big)';
-- update public.products set name = 'Mamba small' where id = 190 and name = 'Mamba (small)';
-- update public.products set name = 'Cheap scales' where id = 221 and name = 'Value scales';
-- update public.products set description = 'Cheap scales from the smoke accessory line in our Novelties department. Three sizes: Big, Medium and Small.' where id = 221 and description = 'Value scales from the smoke accessory line in our Novelties department. Three sizes: Big, Medium and Small.';
-- update public.products set name = 'Cheap incense' where id = 246 and name = 'Value incense';
-- update public.products set name = 'Cheap lighters' where id = 250 and name = 'Value lighters';
-- update public.products set description = 'Raw guarana wraps from the wraps and leaf line in our Tobacco department.' where id = 274 and description = 'RAW Guarana wraps from the wraps and leaf line in our Tobacco department.';
-- update public.products set name = 'AA cellular Bluetooth headphones' where id = 286 and name = 'AA Cellular Bluetooth headphones';
-- update public.products set name = 'Powerade big' where id = 290 and name = 'Powerade (big)';
-- update public.products set name = 'Powerade small' where id = 291 and name = 'Powerade (small)';
-- update public.products set description = 'Geek Bar mate from the disposable vape line in our Novelties department.' where id = 310 and description = 'Geek Bar Mate from the disposable vape line in our Novelties department.';
-- update public.products set description = 'Geek Bar mate pods from the vape pod line in our Novelties department.' where id = 311 and description = 'Geek Bar Mate pods from the vape pod line in our Novelties department.';
-- update public.products set name = 'Gatorade small' where id = 335 and name = 'Gatorade (small)';
-- update public.products set name = 'Gatorade big' where id = 336 and name = 'Gatorade (big)';
-- update public.products set name = 'Uncle Al''s' where id = 350 and name = 'Uncle Al''s cookies';
-- update public.products set name = 'Gold Band' where id = 355 and name = 'Gold Band lubricants';
