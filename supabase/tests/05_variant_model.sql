-- The variant model (20260928121000; AW-030, AW-332, AW-233, AW-128, AW-031).
-- Variant axis and availability are public; a variant's own price is private
-- (admins write it, approved buyers see their tier's unit price through
-- my_prices()), and the order trigger prices, checks and labels lines with
-- them. Every price below is an obviously synthetic test value on test
-- products 90501-90503, which are removed at the end.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000005a1', 'p5-pending@example.com', '{"name": "P5 Pending"}'),
  ('00000000-0000-4000-8000-0000000005b1', 'p5-silver@example.com', '{"name": "P5 Silver"}'),
  ('00000000-0000-4000-8000-0000000005d1', 'p5-admin@example.com', '{"name": "P5 Admin"}');
update public.profiles set status = 'approved', pricing_tier = 'silver' where id = '00000000-0000-4000-8000-0000000005b1';
update public.profiles set status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000005d1';

-- Test products: sizes with one marked not available, no variants (with a
-- sell unit), and one variant.
insert into public.products (id, name, brand, cat, sub, sku, variants, variant_axis, unavailable_variants, price, active, sell_unit) values
  (90501, 'P5 sizes', 'Test', 'MOTOR OIL', 'Test line', 'AW-P5-SIZES', '["Small", "Medium", "Big", "Gone"]', 'Size', '["gone"]', 10.10, true, ''),
  (90502, 'P5 plain', 'Test', 'MOTOR OIL', 'Test line', 'AW-P5-PLAIN', '[]', null, '[]', 5.10, true, 'box of 12'),
  (90503, 'P5 one', 'Test', 'MOTOR OIL', 'Test line', 'AW-P5-ONE', '["Only"]', null, '["Only"]', 3.10, true, '');

-- The schema: no flavors count (AW-332), a known axis, an array of labels.
do $$ begin
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'flavors'
  ), 'products has no flavors column';
  assert exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'order_items' and column_name = 'sell_unit'
  ), 'order_items has a sell_unit column';
  begin
    update public.products set variant_axis = 'Scent' where id = 90501;
    raise exception 'an unknown variant axis was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.products set unavailable_variants = '{"Big": true}' where id = 90501;
    raise exception 'unavailable_variants accepted an object';
  exception when check_violation then null;
  end;
  -- The seed carries the axis and the stated sell units.
  assert (select variant_axis from public.products where id = 356) = 'Size', 'gas cans vary by size';
  assert (select variant_axis from public.products where id = 366) is null, 'a one-variant product needs no axis';
  assert (select sell_unit from public.products where id = 242) = 'box of 200', 'a stated sell unit is seeded';
  assert (select sell_unit from public.products where id = 16) = '', 'an unstated sell unit stays empty';
  assert (select unavailable_variants from public.products where id = 356) = '[]'::jsonb, 'every seeded variant is available';
end $$;

-- Guests read the axis and availability, and nothing of the variant prices.
select test_anon();
do $$
declare n int;
begin
  select count(*) into n from (
    select id, variants, variant_axis, unavailable_variants from public.products where id in (90501, 90502)
  ) t;
  assert n = 2, 'anon reads variant_axis and unavailable_variants';
  assert (select variant_axis from public.products where id = 90501) = 'Size', 'anon reads the axis';
  assert (select unavailable_variants from public.products where id = 90501) = '["gone"]'::jsonb, 'anon reads availability';
  begin
    perform * from public.product_variant_prices;
    raise exception 'anon read product_variant_prices';
  exception when insufficient_privilege then null;
  end;
end $$;
select test_reset();

-- A customer can't write an override, and sees none.
select test_login('00000000-0000-4000-8000-0000000005a1');
do $$ begin
  begin
    insert into public.product_variant_prices (product_id, variant, price) values (90501, 'Big', 0.01);
    raise exception 'a customer inserted a variant price';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate public.product_variant_prices;
    raise exception 'a customer truncated product_variant_prices';
  exception when insufficient_privilege then null;
  end;
end $$;
select test_reset();

-- An admin sets a variant's own price, and "price on request" for another.
select test_login('00000000-0000-4000-8000-0000000005d1');
do $$ begin
  insert into public.product_variant_prices (product_id, variant, price) values
    (90501, 'Big', 20.30),
    (90501, 'Small', null);
  assert (select count(*) from public.product_variant_prices where product_id = 90501) = 2, 'an admin reads the variant prices';
  begin
    insert into public.product_variant_prices (product_id, variant, price) values (90501, 'big', 1.10);
    raise exception 'a second price for the same label in another case was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.product_variant_prices (product_id, variant, price) values (90501, 'Medium', -1);
    raise exception 'a negative variant price was accepted';
  exception when check_violation then null;
  end;
  assert (public.admin_product_prices()->'90501'->'variants'->'Big'->>'list')::numeric = 20.30, 'admin_product_prices() lists a variant price';
  assert public.admin_product_prices()->'90501'->'variants'->'Small'->'list' = 'null'::jsonb, 'and a variant on request';
  assert public.admin_product_prices()->'90502'->'variants' = '{}'::jsonb, 'a product without overrides has none';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000005a1');
do $$ begin
  assert (select count(*) from public.product_variant_prices) = 0, 'a customer sees no variant prices';
end $$;
select test_reset();

-- The approved silver buyer: my_prices() gives each override its tier price.
select test_login('00000000-0000-4000-8000-0000000005b1');
do $$
declare
  v jsonb := public.my_prices()->'products'->'90501';
begin
  assert (v->>'unit')::numeric = 9.60, 'the product price: 10.10 less 5%';
  assert (v->'variants'->'Big'->>'list')::numeric = 20.30, 'the variant list price';
  -- 20.30 less 5% is 19.285, which rounds to 19.29.
  assert (v->'variants'->'Big'->>'unit')::numeric = 19.29, 'the variant unit price, rounded to cents';
  assert v->'variants'->'Small'->'unit' = 'null'::jsonb, 'a variant on request has no unit price';
  assert not (v->'variants' ? 'Medium'), 'a variant without an override is not listed';
  assert public.my_prices()->'products'->'90502'->'variants' = '{}'::jsonb, 'no overrides, no variants';
end $$;

-- submit_quote prices each line from the override, else the product.
do $$
declare
  r jsonb;
  o uuid;
begin
  r := public.submit_quote('T-P5-SILVER-1', 'Store', 'Contact', 'p5-silver@example.com', '205-555-0105', 'delivery', null, null,
    '1 Main St', 'Birmingham', 'AL', '35203',
    '[{"product_id": 90501, "variant": "Big", "qty": 3},
      {"product_id": 90501, "variant": "medium", "qty": 1},
      {"product_id": 90501, "variant": "Small", "qty": 2},
      {"product_id": 90502, "variant": "Stray", "qty": 4}]'::jsonb);
  o := (r->>'id')::uuid;
  assert (select unit_price from public.order_items where order_id = o and variant = 'Big') = 19.29,
    'the overridden variant is priced from its own list price';
  assert (select unit_price from public.order_items where order_id = o and variant = 'Medium') = 9.60,
    'a variant without an override is priced from the product (and its label canonicalized)';
  assert (select unit_price from public.order_items where order_id = o and variant = 'Small') is null,
    'a variant on request gives an unpriced line';
  -- 5.10 less 5% is 4.845, which rounds to 4.85.
  assert (select unit_price from public.order_items where order_id = o and product_id = 90502) = 4.85,
    'a product without variants is priced from the product';
  -- 3 x 19.29 + 9.60 + 4 x 4.85; the unpriced line adds nothing.
  assert (r->>'subtotal')::numeric = 86.87, 'the subtotal adds the priced lines';
  -- A product without variants drops the label it was sent with.
  assert (select variant from public.order_items where order_id = o and product_id = 90502) is null, 'no variant is stored';
  assert (select product_name from public.order_items where order_id = o and product_id = 90502) = 'P5 plain', 'the name has no variant';
  assert (select sku from public.order_items where order_id = o and product_id = 90502) = 'AW-P5-PLAIN', 'the SKU has no variant';
  -- The sell unit is kept with the line (AW-031).
  assert (select sell_unit from public.order_items where order_id = o and product_id = 90502) = 'box of 12', 'the sell unit is snapshotted';
  assert (select sell_unit from public.order_items where order_id = o and variant = 'Big') is null, 'no sell unit is null, not empty';
end $$;

-- A variant marked not available is refused with a typed hint, and so is a
-- one-variant product whose only variant is.
do $$
declare hint text;
begin
  begin
    perform public.submit_quote('T-P5-SILVER-2', 'Store', 'Contact', 'p5-silver@example.com', '205-555-0105', 'delivery', null, null,
      '1 Main St', 'Birmingham', 'AL', '35203', '[{"product_id": 90501, "variant": "Gone", "qty": 1}]'::jsonb);
    raise exception 'an unavailable variant was accepted';
  exception when raise_exception then
    get stacked diagnostics hint = pg_exception_hint;
    assert sqlerrm = 'That variant is not available', sqlerrm;
    assert hint = 'variant_unavailable', coalesce(hint, 'no hint');
  end;
  begin
    perform public.submit_quote('T-P5-SILVER-3', 'Store', 'Contact', 'p5-silver@example.com', '205-555-0105', 'delivery', null, null,
      '1 Main St', 'Birmingham', 'AL', '35203', '[{"product_id": 90503, "qty": 1}]'::jsonb);
    raise exception 'an unavailable only variant was accepted';
  exception when raise_exception then
    get stacked diagnostics hint = pg_exception_hint;
    assert hint = 'variant_unavailable', coalesce(hint, 'no hint');
  end;
  assert not exists (select 1 from public.orders where ref_num in ('T-P5-SILVER-2', 'T-P5-SILVER-3')), 'a refused quote saves nothing';
end $$;
select test_reset();

-- A saved line whose variant was marked not available later stays editable.
update public.products set unavailable_variants = '["Big"]' where id = 90501;
do $$ begin
  update public.order_items set qty = 4
  where variant = 'Big' and order_id = (select id from public.orders where ref_num = 'T-P5-SILVER-1');
  assert (select qty from public.order_items where variant = 'Big' and order_id = (select id from public.orders where ref_num = 'T-P5-SILVER-1')) = 4,
    'an admin can still change the quantity of a saved line';
end $$;

-- Leave the shared database as later test files expect it.
delete from public.orders where user_id in (
  '00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-0000000005d1');
delete from public.products where id in (90501, 90502, 90503);
do $$ begin
  assert not exists (select 1 from public.product_variant_prices where product_id in (90501, 90502, 90503)),
    'variant prices go with their product';
end $$;
