-- Catalog corrections (20260928122000; AW-135, AW-138, AW-126), checked on
-- the seeded catalog. The data migration itself was replayed against the
-- previous seed (every row matches the new seed); here the seed's values
-- must follow the rules scripts/validate-catalog.mjs enforces for
-- src/data/products.js. Rows 90000 and up belong to other test files.

do $$
declare
  bad text;
begin
  -- SKUs: AW- plus capitals and digits between single hyphens, no trailing
  -- or doubled hyphen (AW-135), and unique.
  select string_agg(id || ' ' || sku, ', ') into bad from public.products
  where id < 90000 and (sku like '%-' or sku like '%--%' or sku !~ '^AW-[A-Z0-9]+(-[A-Z0-9]+)*$');
  assert bad is null, 'SKUs with a stray hyphen or another format: ' || bad;
  select string_agg(sku, ', ') into bad from (
    select sku from public.products where id < 90000 group by sku having count(*) > 1
  ) dup;
  assert bad is null, 'duplicate SKUs: ' || bad;
  -- #329 is no bare prefix of the other RAW codes any more.
  assert (select sku from public.products where id = 329) = 'AW-RAW-TIPS', 'RAW tips has its own code';
  assert not exists (
    select 1 from public.products a join public.products b on b.id <> a.id and b.sku like a.sku || '-%'
    where a.sku = 'AW-RAW' and a.id < 90000
  ), 'no product keeps the bare AW-RAW code';

  -- Variant labels: none written the ways AW-138 fixed ("IPhone", "Type C To
  -- Type C", "Almond reg", "Cookies king", "2gal", "8lbs", "20oz").
  select string_agg(p.id || ': ' || l.label, ', ') into bad
  from public.products p, jsonb_array_elements_text(p.variants) as l(label)
  where p.id < 90000 and l.label ~ '^I[A-Z]|\yTo\y|\y(reg|king)$|[0-9](gal|lbs|oz)\y';
  assert bad is null, 'abbreviated or misspelled variant labels: ' || bad;

  -- No profanity in any label, description or name (AW-126). Tested on a
  -- fragment, so the word itself is not spelled out here.
  assert not exists (
    select 1 from public.products p, jsonb_array_elements_text(p.variants) as l(label)
    where position('uckin' in lower(l.label)) > 0
  ), 'no variant label carries the profanity';
  assert not exists (
    select 1 from public.products
    where position('uckin' in lower(description)) > 0 or position('uckin' in lower(name)) > 0
  ), 'no description or name carries the profanity';
  assert (select variants from public.products where id = 60) = '["Blue razz ice", "F*** fab"]'::jsonb, '#60 has the starred-out label';

  -- One-item non-choices have no variants now (AW-138 (6)); the information
  -- moved to the sell unit or the name.
  assert (select count(*) from public.products where id in (122, 123, 124) and variants = '[]'::jsonb) = 3,
    'bath tissue and paper towels have no "Case" variant';
  assert (select count(*) from public.products where id in (267, 329, 330, 354) and variants = '[]'::jsonb) = 4,
    'ZYN European mix, RAW tips, High Hemp and Folgers have no one-item variant';
  assert (select sell_unit from public.products where id = 123) = 'case', 'paper towels are sold by the case';
  assert (select name from public.products where id = 354) = 'Folgers coffee (small)', 'the Folgers size is in its name';

  -- #62's merged chip is two flavors; sizes run small to big.
  assert (select variants ? 'Watermelon ice' and variants ? 'Kiwi dragon berry' and jsonb_array_length(variants) = 9
    from public.products where id = 62), '#62 lists Watermelon ice and Kiwi dragon berry separately';
  assert (select variants from public.products where id = 125) = '["Small", "Medium", "Big"]'::jsonb, 'diaper sizes run small to big';

  -- The restricted lines keep their rows and wording (owner decision 2, AW-001).
  assert (select count(*) from public.products where sub in ('Kratom & Kava', 'Mushroom Products', 'Detox', 'Wellness Pills', 'Honey & Energy') and active) = 37,
    'the restricted lines are neither removed nor deactivated';
  assert (select variants from public.products where id = 258) = '["Any flavor"]'::jsonb, 'restricted rows keep their labels';
end $$;

-- The order trigger writes the corrected codes: a variant SKU is the new
-- product code plus the new label, with no doubled hyphen.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000006a1', 'p6-buyer@example.com', '{"name": "P6 Buyer"}');
update public.profiles set status = 'approved', pricing_tier = 'silver' where id = '00000000-0000-4000-8000-0000000006a1';
insert into public.orders (id, user_id, ref_num, business, contact, email, phone, delivery)
values ('00000000-0000-4000-8000-0000000006f1', '00000000-0000-4000-8000-0000000006a1', 'T-P6-SKUS', 'P6 Market', 'P6 Buyer', 'p6-buyer@example.com', '555-0106', 'willcall');
insert into public.order_items (order_id, product_id, product_name, sku, variant, qty) values
  ('00000000-0000-4000-8000-0000000006f1', 130, 'x', 'x', 'yellow', 1),
  ('00000000-0000-4000-8000-0000000006f1', 60, 'x', 'x', 'F*** fab', 1),
  ('00000000-0000-4000-8000-0000000006f1', 329, 'x', 'x', null, 1);

do $$ begin
  assert (select sku from public.order_items where order_id = '00000000-0000-4000-8000-0000000006f1' and product_id = 130) = 'AW-BRILLO-BASICS-YELLOW',
    'the Brillo variant code has one hyphen';
  assert (select sku from public.order_items where order_id = '00000000-0000-4000-8000-0000000006f1' and product_id = 60) = 'AW-GEEKBAR-15K-F-FAB',
    'the #60 variant code is the starred-out label';
  assert (select sku || '|' || coalesce(variant, '-') from public.order_items where order_id = '00000000-0000-4000-8000-0000000006f1' and product_id = 329) = 'AW-RAW-TIPS|-',
    'RAW tips is ordered without a variant';
end $$;

delete from public.order_items where order_id = '00000000-0000-4000-8000-0000000006f1';
delete from public.orders where id = '00000000-0000-4000-8000-0000000006f1';
