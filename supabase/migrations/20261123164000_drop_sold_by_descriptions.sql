-- Drop the sell-unit sentences from three grocery descriptions.
--
-- The storefront no longer prints "Sold by the …", "per <unit>" or a pack
-- badge. These three rows still said the same thing in their description:
-- #122 "stocked by the case", #123 and #124 "sold by the case". New databases
-- get the shorter text from the regenerated seed. This updates a row only
-- while it still has the old sentence, so an admin's edit is left alone and
-- running the file again changes nothing.
--
-- Reverse (not run). Each statement puts the old sentence back only where
-- the row still has the new one.
--
-- update public.products set description = 'Bath tissue in 4-roll packs, stocked by the case.' where id = 122 and description = 'Bath tissue in 4-roll packs.';
-- update public.products set description = 'Paper towel rolls, sold by the case.' where id = 123 and description = 'Paper towel rolls.';
-- update public.products set description = 'Bath tissue in single rolls, sold by the case.' where id = 124 and description = 'Bath tissue in single rolls.';

update public.products set description = 'Bath tissue in 4-roll packs.' where id = 122 and description = 'Bath tissue in 4-roll packs, stocked by the case.';
update public.products set description = 'Paper towel rolls.' where id = 123 and description = 'Paper towel rolls, sold by the case.';
update public.products set description = 'Bath tissue in single rolls.' where id = 124 and description = 'Bath tissue in single rolls, sold by the case.';
