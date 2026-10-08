-- The price boundary (20260928120000; AW-003, AW-002, AW-077, AW-351).
-- Prices are readable only through my_prices() (approved buyers) and
-- admin_product_prices() (admins); the tier list only by those two; the
-- order trigger and my_prices() round the same way; a profile's tier must be
-- a pricing_tiers row. Every price below is an obviously synthetic test value
-- on test products 90401-90403, which are removed at the end.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000004a1', 'p4-pending@example.com', '{"name": "P4 Pending"}'),
  ('00000000-0000-4000-8000-0000000004b1', 'p4-silver@example.com', '{"name": "P4 Silver"}'),
  ('00000000-0000-4000-8000-0000000004c1', 'p4-suspended@example.com', '{"name": "P4 Suspended"}'),
  ('00000000-0000-4000-8000-0000000004d1', 'p4-admin@example.com', '{"name": "P4 Admin"}');
update public.profiles set status = 'approved', pricing_tier = 'silver' where id = '00000000-0000-4000-8000-0000000004b1';
update public.profiles set status = 'suspended', pricing_tier = 'gold' where id = '00000000-0000-4000-8000-0000000004c1';
update public.profiles set status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000004d1';

-- Test products: priced, unpriced (price on request) and inactive.
insert into public.products (id, name, brand, cat, sub, sku, price, active) values
  (90401, 'P4 priced', 'Test', 'TOBACCO', 'Test line', 'AW-P4-PRICED', 10.10, true),
  (90402, 'P4 on request', 'Test', 'TOBACCO', 'Test line', 'AW-P4-REQUEST', null, true),
  (90403, 'P4 inactive', 'Test', 'TOBACCO', 'Test line', 'AW-P4-INACTIVE', 3.30, false);

-- Rounding: half a cent rounds up, like the storefront's tierUnitPrice().
do $$ begin
  assert public.tier_unit_price(10.10, 5) = 9.60, 'silver 10.10 is 9.595, which rounds to 9.60';
  assert public.tier_unit_price(45.10, 5) = 42.85, 'the AW-077 half-cent case rounds up';
  assert public.tier_unit_price(10.00, null) = 10.00, 'no discount row means list price';
  assert public.tier_unit_price(null, 5) is null, 'no list price means no unit price';
end $$;

-- Guests: no price column, no prices function, no tier list.
select test_anon();
do $$
declare n int;
begin
  begin
    perform price from public.products limit 1;
    raise exception 'anon read products.price';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.products limit 1;
    raise exception 'anon read select * from products';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from (select id, name, sku, active, description, sell_unit from public.products limit 5) t;
  assert n = 5, 'anon reads the other product columns';
  begin
    perform public.my_prices();
    raise exception 'anon called my_prices()';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_product_prices();
    raise exception 'anon called admin_product_prices()';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.pricing_tiers) = 0, 'anon sees no pricing tiers';
end $$;
select test_reset();

-- A signed-in account that is not approved: no price column, no prices, no tiers.
select test_login('00000000-0000-4000-8000-0000000004a1');
do $$
declare n int;
begin
  begin
    perform price from public.products limit 1;
    raise exception 'a customer read products.price';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from (select id, name, sku, active from public.products limit 5) t;
  assert n = 5, 'a customer reads the other product columns';
  assert public.my_prices() is null, 'a pending account gets no prices';
  assert not public.is_approved_buyer(), 'a pending account is not an approved buyer';
  assert (select count(*) from public.pricing_tiers) = 0, 'a pending account sees no pricing tiers';
  begin
    perform public.admin_product_prices();
    raise exception 'a customer read admin_product_prices()';
  exception when insufficient_privilege then null;
  end;
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000004c1');
do $$ begin
  assert public.my_prices() is null, 'a suspended account gets no prices';
  assert (select count(*) from public.pricing_tiers) = 0, 'a suspended account sees no pricing tiers';
end $$;
select test_reset();

-- An approved silver buyer.
select test_login('00000000-0000-4000-8000-0000000004b1');
do $$
declare
  prices jsonb := public.my_prices();
begin
  assert public.is_approved_buyer(), 'the silver buyer is approved';
  assert prices->>'tier' = 'silver', 'my_prices() names the tier';
  assert (prices->>'discount_pct')::numeric = 5, 'my_prices() gives the tier discount';
  assert prices->>'tier_label' is not null, 'my_prices() gives the tier label';
  assert (prices->'products'->'90401'->>'list')::numeric = 10.10, 'the list price';
  assert (prices->'products'->'90401'->>'unit')::numeric = 9.60, 'the silver unit price, rounded to cents';
  assert prices->'products'->'90401'->'variants' = '{}'::jsonb, 'variants is an object';
  assert prices->'products' ? '90402', 'an unpriced active product is listed';
  assert prices->'products'->'90402'->'unit' = 'null'::jsonb, 'an unpriced product has a null unit price';
  assert not (prices->'products' ? '90403'), 'inactive products are left out';
  assert (select count(*) from public.pricing_tiers) >= 3, 'an approved buyer reads the pricing tiers';
  begin
    perform price from public.products limit 1;
    raise exception 'an approved buyer read products.price directly';
  exception when insufficient_privilege then null;
  end;
end $$;

-- The saved order agrees with my_prices() to the cent: 7 x 9.60, and the
-- unpriced line stays unpriced.
do $$
declare
  r jsonb;
  unit numeric := (public.my_prices()->'products'->'90401'->>'unit')::numeric;
begin
  r := public.submit_quote('T-P4-SILVER-1', 'Store', 'Contact', 'p4-silver@example.com', '205-555-0104', 'delivery', null, null,
    '1 Main St', 'Birmingham', 'AL', '35203',
    '[{"product_id": 90401, "qty": 7}, {"product_id": 90402, "qty": 2}]'::jsonb);
  assert (select unit_price from public.order_items where product_id = 90401 and order_id = (r->>'id')::uuid) = unit,
    'the saved unit price is the one my_prices() showed';
  assert (select unit_price * qty from public.order_items where product_id = 90401 and order_id = (r->>'id')::uuid) = 67.20,
    'the line total is unit x qty';
  assert (r->>'subtotal')::numeric = unit * 7, 'the subtotal equals the priced line to the cent';
  assert (select unit_price from public.order_items where product_id = 90402 and order_id = (r->>'id')::uuid) is null,
    'a product without a price gives an unpriced line';
  assert (r->>'total_units')::int = 9, 'every line counts toward the units';
end $$;
select test_reset();

-- Admins: list prices for every product, inactive ones included, and the
-- price edit still works through the table's UPDATE privilege.
select test_login('00000000-0000-4000-8000-0000000004d1');
do $$
declare
  prices jsonb := public.admin_product_prices();
begin
  assert (prices->'90401'->>'list')::numeric = 10.10, 'admins read list prices';
  assert (prices->'90403'->>'list')::numeric = 3.30, 'admins read inactive products’ prices';
  assert prices->'90402'->'list' = 'null'::jsonb, 'an unpriced product has a null list price';
  assert prices->'90401'->'variants' = '{}'::jsonb, 'variants is an object';
  update public.products set price = 11.10 where id = 90401;
  assert found, 'an admin updates a price by id';
  update public.products set price = null where id = 90401;
  assert found, 'an admin clears a price (price on request)';
  update public.products set price = 11.10 where id = 90401;
  begin
    update public.products set price = -1 where id = 90401;
    raise exception 'a negative price was accepted';
  exception when check_violation then null;
  end;
  assert (select count(*) from public.pricing_tiers) >= 3, 'admins read the pricing tiers';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000004b1');
do $$ begin
  assert (public.my_prices()->'products'->'90401'->>'unit')::numeric = 10.55, 'an admin price edit reaches my_prices() (11.10 less 5%)';
end $$;
select test_reset();

-- A profile's tier must be a pricing_tiers row; a new tier is one row, and
-- renaming a tier carries its accounts along.
do $$ begin
  begin
    update public.profiles set pricing_tier = 'p4-no-such-tier' where id = '00000000-0000-4000-8000-0000000004b1';
    raise exception 'an unknown tier was accepted';
  exception when foreign_key_violation then null;
  end;
  insert into public.pricing_tiers (tier, discount_pct, label) values ('p4-test', 12.5, 'P4 test tier');
  update public.profiles set pricing_tier = 'p4-test' where id = '00000000-0000-4000-8000-0000000004b1';
  update public.pricing_tiers set tier = 'p4-renamed' where tier = 'p4-test';
  assert (select pricing_tier from public.profiles where id = '00000000-0000-4000-8000-0000000004b1') = 'p4-renamed',
    'renaming a tier updates its accounts';
end $$;

select test_login('00000000-0000-4000-8000-0000000004b1');
do $$ begin
  -- 11.10 less 12.5% is 9.7125, which rounds to 9.71.
  assert (public.my_prices()->'products'->'90401'->>'unit')::numeric = 9.71, 'a new tier prices through my_prices()';
end $$;
select test_reset();

-- Leave the shared database as later test files expect it.
update public.profiles set pricing_tier = 'silver' where id = '00000000-0000-4000-8000-0000000004b1';
delete from public.pricing_tiers where tier = 'p4-renamed';
delete from public.orders where user_id in (
  '00000000-0000-4000-8000-0000000004a1', '00000000-0000-4000-8000-0000000004b1',
  '00000000-0000-4000-8000-0000000004c1', '00000000-0000-4000-8000-0000000004d1');
delete from public.products where id in (90401, 90402, 90403);
