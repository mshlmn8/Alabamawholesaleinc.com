-- Catalog fix-ups (AW-135, AW-071, NEW-023, AW-075).
--
-- Data only: the rows already in the database get the corrections made in
-- src/data/products.js, which reach new databases through the regenerated
-- seed. No schema, function or privilege changes.
--   (a) SKUs (AW-135): #83 'AW-DUTCH-MASTER' becomes 'AW-DUTCH-MASTERS' (the
--       brand is Dutch Masters), #143 'AW-RED-BULL-12OZ' becomes
--       'AW-REDBULL-12OZ' (written like #144-#146's AW-REDBULL-* codes), and
--       the bare #90 'AW-BAGS' and #121 'AW-PLASTIC' name their product:
--       'AW-T-SHIRT-BAGS' (Plastic T-shirt bags) and 'AW-PLASTIC-CUTLERY'
--       (Plastic cutlery).
--   (b) Names: #65 "RAZ Vue full kit" (AW-071; its description says it the
--       same way), and #350 is "Uncle Al's" again (NEW-023):
--       20261011130000_catalog_names.sql had named it "Uncle Al's cookies",
--       which is #351's name, so the Cookies line listed two identical
--       products. Whether #350 and #351 are one product is the owner's
--       question (docs/OWNER-TODO.md, AW-140). 20261011130000 itself is left
--       as it is.
--   (c) Descriptions (AW-075): five spell the product the way the row's
--       brand and name do: #13 "Havana Leaf", #183 "Extra Gum", #193 "Pure
--       Eyes", #213 "Lil Leaf", #260 "Backwoods True Wraps". Nothing else in
--       them changes. A row whose description is still '' (the live
--       database's rows from before 20260927120000_product_copy.sql) is not
--       matched: the storefront shows the bundled copy for it.
--
-- Each update changes a row only while it still holds exactly the value the
-- seed wrote, so an admin's edit is never overwritten, and running this file
-- again changes nothing (AW-032). A code also changes only while no other
-- product has the new one (any case, as products_sku_upper_key compares
-- them), so a product staff created with that code is never clashed with.
--
-- Old codes keep working: src/data/catalogAliases.js maps each old SKU to the
-- new one, in both directions, for Quick Reorder codes (and the variant codes
-- built from them) and Reorder from order history. order_items keep their
-- snapshots (sku, product_name, variant), so order history still shows the
-- code and name an order was placed with; the order trigger builds a new
-- line's code from the product's code at the time.
--
-- Release order: any time, also on its own. Best with or after the new
-- frontend, whose Quick Reorder reads the old codes and the new ones; the
-- frontend deployed before it knows only the codes the database has. Every
-- frontend reads names and descriptions from the database.

-- ---------------------------------------------------------------------------
-- (a) SKUs (AW-135).
-- ---------------------------------------------------------------------------
update public.products set sku = 'AW-DUTCH-MASTERS' where id = 83 and sku = 'AW-DUTCH-MASTER'
  and not exists (select 1 from public.products o where upper(btrim(o.sku)) = 'AW-DUTCH-MASTERS');
update public.products set sku = 'AW-T-SHIRT-BAGS' where id = 90 and sku = 'AW-BAGS'
  and not exists (select 1 from public.products o where upper(btrim(o.sku)) = 'AW-T-SHIRT-BAGS');
update public.products set sku = 'AW-PLASTIC-CUTLERY' where id = 121 and sku = 'AW-PLASTIC'
  and not exists (select 1 from public.products o where upper(btrim(o.sku)) = 'AW-PLASTIC-CUTLERY');
update public.products set sku = 'AW-REDBULL-12OZ' where id = 143 and sku = 'AW-RED-BULL-12OZ'
  and not exists (select 1 from public.products o where upper(btrim(o.sku)) = 'AW-REDBULL-12OZ');

-- ---------------------------------------------------------------------------
-- (b) Names (AW-071, NEW-023).
-- ---------------------------------------------------------------------------
update public.products set name = 'RAZ Vue full kit' where id = 65 and name = 'RAZ Vue Full kit';
update public.products set description = 'RAZ Vue full kit from the disposable vape line in our Novelties department.' where id = 65 and description = 'RAZ Vue Full kit from the disposable vape line in our Novelties department.';
update public.products set name = 'Uncle Al''s' where id = 350 and name = 'Uncle Al''s cookies';

-- ---------------------------------------------------------------------------
-- (c) The brand's spelling in five descriptions (AW-075).
-- ---------------------------------------------------------------------------
update public.products set description = 'Havana Leaf wraps from the wraps and leaf line in our Tobacco department. Eight flavors: Milk cookies, Sweet aromatic, Strawberry, 8 Miles, Russian cream, Purple, Yellow and Honey bourbon.' where id = 13 and description = 'Havana leaf wraps from the wraps and leaf line in our Tobacco department. Eight flavors: Milk cookies, Sweet aromatic, Strawberry, 8 Miles, Russian cream, Purple, Yellow and Honey bourbon.';
update public.products set description = 'Extra Gum from the gum and mints line in our Candies department. Five flavors: Watermelon, Spearmint, Peppermint, Polar ice and Winterfresh.' where id = 183 and description = 'Extra gum from the gum and mints line in our Candies department. Five flavors: Watermelon, Spearmint, Peppermint, Polar ice and Winterfresh.';
update public.products set description = 'Pure Eyes from the OTC and health line in our Merchandise department.' where id = 193 and description = 'Pure eyes from the OTC and health line in our Merchandise department.';
update public.products set description = 'Lil Leaf wraps from the wraps and leaf line in our Tobacco department. Stocked in one variety: Original.' where id = 213 and description = 'Lil leaf wraps from the wraps and leaf line in our Tobacco department. Stocked in one variety: Original.';
update public.products set description = 'Backwoods True Wraps from the wraps and leaf line in our Tobacco department. Three flavors: Original, Vanilla and Aromatic.' where id = 260 and description = 'Backwoods true wraps from the wraps and leaf line in our Tobacco department. Three flavors: Original, Vanilla and Aromatic.';

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration. Each statement puts back the old value only where the row still
-- has the new one. Any frontend works with either value: the new one reads
-- both codes (catalogAliases.js). Putting #350's name back brings the two
-- identical "Uncle Al's cookies" products back (NEW-023).
--
-- update public.products set sku = 'AW-DUTCH-MASTER' where id = 83 and sku = 'AW-DUTCH-MASTERS';
-- update public.products set sku = 'AW-BAGS' where id = 90 and sku = 'AW-T-SHIRT-BAGS';
-- update public.products set sku = 'AW-PLASTIC' where id = 121 and sku = 'AW-PLASTIC-CUTLERY';
-- update public.products set sku = 'AW-RED-BULL-12OZ' where id = 143 and sku = 'AW-REDBULL-12OZ';
-- update public.products set name = 'RAZ Vue Full kit' where id = 65 and name = 'RAZ Vue full kit';
-- update public.products set description = 'RAZ Vue Full kit from the disposable vape line in our Novelties department.' where id = 65 and description = 'RAZ Vue full kit from the disposable vape line in our Novelties department.';
-- update public.products set name = 'Uncle Al''s cookies' where id = 350 and name = 'Uncle Al''s';
-- update public.products set description = 'Havana leaf wraps from the wraps and leaf line in our Tobacco department. Eight flavors: Milk cookies, Sweet aromatic, Strawberry, 8 Miles, Russian cream, Purple, Yellow and Honey bourbon.' where id = 13 and description = 'Havana Leaf wraps from the wraps and leaf line in our Tobacco department. Eight flavors: Milk cookies, Sweet aromatic, Strawberry, 8 Miles, Russian cream, Purple, Yellow and Honey bourbon.';
-- update public.products set description = 'Extra gum from the gum and mints line in our Candies department. Five flavors: Watermelon, Spearmint, Peppermint, Polar ice and Winterfresh.' where id = 183 and description = 'Extra Gum from the gum and mints line in our Candies department. Five flavors: Watermelon, Spearmint, Peppermint, Polar ice and Winterfresh.';
-- update public.products set description = 'Pure eyes from the OTC and health line in our Merchandise department.' where id = 193 and description = 'Pure Eyes from the OTC and health line in our Merchandise department.';
-- update public.products set description = 'Lil leaf wraps from the wraps and leaf line in our Tobacco department. Stocked in one variety: Original.' where id = 213 and description = 'Lil Leaf wraps from the wraps and leaf line in our Tobacco department. Stocked in one variety: Original.';
-- update public.products set description = 'Backwoods true wraps from the wraps and leaf line in our Tobacco department. Three flavors: Original, Vanilla and Aromatic.' where id = 260 and description = 'Backwoods True Wraps from the wraps and leaf line in our Tobacco department. Three flavors: Original, Vanilla and Aromatic.';
