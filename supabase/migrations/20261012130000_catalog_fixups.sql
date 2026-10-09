-- Catalog fix-ups (AW-135).
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
-- code an order was placed with; the order trigger builds a new line's code
-- from the product's code at the time.
--
-- Release order: any time, also on its own. Best with or after the new
-- frontend, whose Quick Reorder reads the old codes and the new ones; the
-- frontend deployed before it knows only the codes the database has.

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
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration. Each statement puts back the old value only where the row still
-- has the new one. Any frontend works with either value: the new one reads
-- both codes (catalogAliases.js).
--
-- update public.products set sku = 'AW-DUTCH-MASTER' where id = 83 and sku = 'AW-DUTCH-MASTERS';
-- update public.products set sku = 'AW-BAGS' where id = 90 and sku = 'AW-T-SHIRT-BAGS';
-- update public.products set sku = 'AW-PLASTIC' where id = 121 and sku = 'AW-PLASTIC-CUTLERY';
-- update public.products set sku = 'AW-RED-BULL-12OZ' where id = 143 and sku = 'AW-REDBULL-12OZ';
