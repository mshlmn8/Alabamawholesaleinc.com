-- The final price boundary and the one quote workflow, after Cursor's
-- 20261008200000 and lane p2's 20261009… files (20261009110000 moved
-- products.variant_prices into product_variant_prices; 20261009150000 made
-- kind, admin_price_order and admin_convert_quote agree with submit_quote
-- v3). Test accounts ...0012a1 (pending), b1 (approved, silver), c1
-- (approved admin), d1 (another pending account); products 91201 (TOBACCO,
-- synthetic price) and 91202 (CANDIES, two sizes, Big with its own price).
-- Everything is removed at the end.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000012a1', 'p12-pending@example.com', '{"name": "P12 Pending"}'),
  ('00000000-0000-4000-8000-0000000012b1', 'p12-approved@example.com', '{"name": "P12 Approved"}'),
  ('00000000-0000-4000-8000-0000000012c1', 'p12-admin@example.com', '{"name": "P12 Admin"}'),
  ('00000000-0000-4000-8000-0000000012d1', 'p12-other@example.com', '{"name": "P12 Other"}');
update public.profiles set status = 'approved', pricing_tier = 'silver' where id = '00000000-0000-4000-8000-0000000012b1';
update public.profiles set status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000012c1';

insert into public.products (id, name, brand, cat, sub, sku, price, variants, active) values
  (91201, 'P12 tobacco', 'Test', 'TOBACCO', 'Test line', 'AW-P12-TOBACCO', 10.10, '[]', true),
  (91202, 'P12 candy', 'Test', 'CANDIES', 'Test line', 'AW-P12-CANDY', 4.00, '["Small", "Big"]', true);
insert into public.product_variant_prices (product_id, variant, price) values (91202, 'Big', 6.00);

-- One quote, every argument overridable by name. (pg_temp lives for the whole
-- test run, so these names must not clash with another file's helpers.)
create or replace function pg_temp.p12_quote(
  email text,
  items jsonb default '[{"product_id": 91202, "variant": "Small", "qty": 2}]',
  license text default null,
  resale text default null,
  adults boolean default false
) returns jsonb language sql as $$
  select public.submit_quote(
    p_business => 'P12 Store', p_contact => 'P12 Contact', p_email => email, p_phone => '205-555-0112',
    p_delivery => 'willcall', p_preferred_date => null, p_notes => null,
    p_ship_street => null, p_ship_city => null, p_ship_state => null, p_ship_zip => null,
    p_items => items, p_license_no => license, p_resale_cert => resale, p_purchasers_21 => adults);
$$;

-- The hint (or, without one, the SQLSTATE) a statement fails with; null when
-- it succeeds.
create or replace function pg_temp.p12_fails(statement text) returns text language plpgsql as $$
declare h text; c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics h = pg_exception_hint, c = returned_sqlstate;
  return coalesce(nullif(h, ''), c);
end $$;

-- ---------------------------------------------------------------------------
-- Price privacy: no list price, variant price or tier is readable by a
-- guest or an account that isn't approved.
-- ---------------------------------------------------------------------------
do $$ begin
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'variant_prices'
  ), 'Cursor''s products.variant_prices column is gone (moved to product_variant_prices)';
end $$;

select test_anon();
do $$ begin
  assert pg_temp.p12_fails('select price from public.products limit 1') = '42501', 'a guest can''t read products.price';
  assert pg_temp.p12_fails('select count(*) from public.product_variant_prices') = '42501', 'a guest can''t read variant prices';
  assert pg_temp.p12_fails('select public.my_prices()') = '42501', 'a guest can''t call my_prices()';
  assert pg_temp.p12_fails('select public.admin_product_prices()') = '42501', 'a guest can''t call admin_product_prices()';
  assert (select count(*) from public.pricing_tiers) = 0, 'a guest sees no pricing tiers';
  -- The catalog itself stays readable.
  assert (select variants from public.products where id = 91202) = '["Small", "Big"]'::jsonb, 'a guest reads the catalog';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000012a1');
do $$ begin
  assert pg_temp.p12_fails('select price from public.products limit 1') = '42501', 'a pending account can''t read products.price';
  assert (select count(*) from public.product_variant_prices) = 0, 'a pending account sees no variant prices';
  assert public.my_prices() is null, 'a pending account gets no prices';
  assert pg_temp.p12_fails('select public.admin_product_prices()') = '42501', 'only admins read list prices';
  assert (select count(*) from public.pricing_tiers) = 0, 'a pending account sees no pricing tiers';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000012b1');
do $$
declare p jsonb := public.my_prices();
begin
  assert (select count(*) from public.product_variant_prices) = 0, 'an approved buyer doesn''t read the price table either';
  -- 4.00 less 5% is 3.80; Big's own 6.00 less 5% is 5.70.
  assert (p #>> '{products,91202,unit}')::numeric = 3.80, p #>> '{products,91202}';
  assert (p #>> '{products,91202,variants,Big,unit}')::numeric = 5.70, p #>> '{products,91202,variants}';
  assert p #> '{products,91202,variants,Small}' is null, 'Small costs the product''s price';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- submit_quote v3 and kind: a guest's (with the tobacco license path) and a
-- pending account's requests are quotes, an approved buyer's is an order.
-- ---------------------------------------------------------------------------
delete from public.quote_throttle;
select test_anon();
do $$
declare r jsonb;
begin
  assert pg_temp.p12_fails($s$select pg_temp.p12_quote('p12-guest-1@example.com', '[{"product_id": 91201, "qty": 2}]')$s$) = 'license_required',
    'a guest tobacco quote needs the license answers';
  r := pg_temp.p12_quote('p12-guest-1@example.com',
    '[{"product_id": 91201, "qty": 2}, {"product_id": 91202, "variant": "Big", "qty": 1}]', 'TL-12', 'RS-12', true);
  assert r->>'kind' = 'quote' and r->>'ref_num' ~ '^ALW-Q-', r::text;
  perform set_config('test.p12_guest', r->>'id', false);
end $$;
select test_reset();

delete from public.quote_throttle;
select test_login('00000000-0000-4000-8000-0000000012a1');
do $$
declare r jsonb := pg_temp.p12_quote('p12-pending@example.com');
begin
  assert r->>'kind' = 'quote' and r->>'ref_num' ~ '^ALW-Q-', r::text;
  perform set_config('test.p12_pending', r->>'id', false);
end $$;
select test_reset();

delete from public.quote_throttle;
select test_login('00000000-0000-4000-8000-0000000012b1');
do $$
declare r jsonb := pg_temp.p12_quote('p12-approved@example.com', '[{"product_id": 91202, "variant": "Big", "qty": 2}]');
begin
  assert r->>'kind' = 'order' and r->>'ref_num' ~ '^ALW-O-', r::text;
  assert (r->>'subtotal')::numeric = 11.40, 'the order is priced from the variant''s own price';
  perform set_config('test.p12_order', r->>'id', false);
end $$;
select test_reset();

do $$ begin
  -- The stored kind is the one submit_quote returned.
  assert (select kind from public.orders where id = current_setting('test.p12_guest')::uuid) = 'quote', 'guest: quote';
  assert (select kind from public.orders where id = current_setting('test.p12_pending')::uuid) = 'quote', 'pending account: quote';
  assert (select kind from public.orders where id = current_setting('test.p12_order')::uuid) = 'order', 'approved account: order';
  assert (select status from public.orders where id = current_setting('test.p12_guest')::uuid) = 'new', 'a new quote is new';
  assert (select license_no = 'TL-12' and resale_cert_no = 'RS-12' and purchasers_21
          from public.orders where id = current_setting('test.p12_guest')::uuid), 'the guest''s license answers are stored';
  assert not exists (select 1 from public.order_items where order_id = current_setting('test.p12_guest')::uuid and unit_price is not null),
    'a guest''s lines are unpriced';
end $$;

-- ---------------------------------------------------------------------------
-- admin_price_order / admin_convert_quote: admins only.
-- ---------------------------------------------------------------------------
select test_anon();
do $$ begin
  assert pg_temp.p12_fails(format($s$select public.admin_price_order(%L, '[]')$s$, current_setting('test.p12_guest'))) = '42501',
    'a guest can''t call admin_price_order';
  assert pg_temp.p12_fails(format($s$select public.admin_convert_quote(%L)$s$, current_setting('test.p12_guest'))) = '42501',
    'a guest can''t call admin_convert_quote';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000012b1');
do $$ begin
  assert pg_temp.p12_fails(format($s$select public.admin_price_order(%L, '[]')$s$, current_setting('test.p12_guest'))) = 'admin_only',
    'an approved buyer isn''t an admin';
  assert pg_temp.p12_fails(format($s$select public.admin_convert_quote(%L)$s$, current_setting('test.p12_guest'))) = 'admin_only',
    'an approved buyer can''t convert';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- Staff price the guest's quote, then convert it.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000012c1');
do $$
declare
  o uuid := current_setting('test.p12_guest')::uuid;
  tob bigint := (select id from public.order_items where order_id = o and product_id = 91201);
  big bigint := (select id from public.order_items where order_id = o and product_id = 91202);
begin
  -- Bad input is refused, and changes nothing.
  assert pg_temp.p12_fails(format($s$select public.admin_price_order(%L, '[{"item_id": %s, "qty": 1, "unit_price": -1}]')$s$, o, tob)) = 'invalid_line', 'a negative price';
  assert pg_temp.p12_fails(format($s$select public.admin_price_order(%L, '[{"item_id": %s, "qty": "two", "unit_price": 1}]')$s$, o, tob)) = 'invalid_line', 'a quantity that isn''t a number';
  assert pg_temp.p12_fails(format($s$select public.admin_price_order(%L, '[{"item_id": %s, "qty": 100001, "unit_price": 1}]')$s$, o, tob)) = 'invalid_line', 'too many';
  assert pg_temp.p12_fails(format($s$select public.admin_price_order(%L, '[{"item_id": 999999999, "qty": 1, "unit_price": 1}]')$s$, o)) = 'unknown_line', 'a line from another order';
  assert pg_temp.p12_fails(format($s$select public.admin_price_order(%L, '[{"item_id": %s, "qty": 0}, {"item_id": %s, "qty": 0}]')$s$, o, tob, big)) = 'no_items', 'every line removed';
  assert pg_temp.p12_fails(format($s$select public.admin_price_order(%L, 'null')$s$, o)) = 'no_items', 'no lines';
  assert pg_temp.p12_fails($s$select public.admin_price_order('00000000-0000-4000-8000-000000000000', '[]')$s$) = 'order_not_found', 'no such order';
  assert (select count(*) from public.order_items where order_id = o) = 2, 'a refused call removed nothing';
  assert (select status from public.orders where id = o) = 'new', 'a refused call changed nothing';

  -- Not priced yet: no conversion.
  assert pg_temp.p12_fails(format($s$select public.admin_convert_quote(%L)$s$, o)) = 'unpriced_lines', 'a quote with unpriced lines';

  -- First pass: 3 tobacco at 9.99, the candy unpriced.
  perform public.admin_price_order(o, jsonb_build_array(
    jsonb_build_object('item_id', tob, 'qty', 3, 'unit_price', 9.99),
    jsonb_build_object('item_id', big, 'qty', 1, 'unit_price', null)));
  assert (select status = 'quoted' and kind = 'quote' and quoted_at is not null and quoted_by = '00000000-0000-4000-8000-0000000012c1'
          from public.orders where id = o), 'a priced quote is "quoted", with who and when';
  assert (select qty = 3 and original_qty = 2 and unit_price = 9.99 from public.order_items where id = tob),
    'the quantity and price are saved (the order trigger runs on INSERT only), and the customer''s quantity is kept';
  assert (select total_units = 4 and subtotal = 29.97 from public.orders where id = o), 'totals are recomputed from the priced lines';

  -- Second pass: the candy priced at 5.555 (rounded to cents); original_qty stays.
  perform public.admin_price_order(o, jsonb_build_array(
    jsonb_build_object('item_id', tob, 'qty', 4, 'unit_price', '9.99'),
    jsonb_build_object('item_id', big, 'qty', 1, 'unit_price', 5.555)));
  assert (select qty = 4 and original_qty = 2 from public.order_items where id = tob), 'original_qty is the first quantity';
  assert (select unit_price from public.order_items where id = big) = 5.56, 'prices are rounded to cents';
  assert (select subtotal from public.orders where id = o) = 45.52, 'subtotal 4 x 9.99 + 5.56';

  -- Converted to an order for an existing account.
  assert pg_temp.p12_fails(format($s$select public.admin_convert_quote(%L, '00000000-0000-4000-8000-0000000000ff')$s$, o)) = 'unknown_account', 'no such account';
  perform public.admin_convert_quote(o, '00000000-0000-4000-8000-0000000012d1');
  assert (select kind = 'order' and status = 'confirmed' and user_id = '00000000-0000-4000-8000-0000000012d1'
          from public.orders where id = o), 'the quote is a confirmed order on that account';
  assert pg_temp.p12_fails(format($s$select public.admin_convert_quote(%L)$s$, o)) = 'not_a_quote', 'an order isn''t converted twice';
  -- An order corrected by staff keeps its status.
  perform public.admin_price_order(o, jsonb_build_array(jsonb_build_object('item_id', tob, 'qty', 5, 'unit_price', 9.99)));
  assert (select status from public.orders where id = o) = 'confirmed', 'a confirmed order stays confirmed';
end $$;
select test_reset();

-- The linked account now reads its order with the quoted prices.
select test_login('00000000-0000-4000-8000-0000000012d1');
do $$ begin
  assert (select subtotal from public.orders where id = current_setting('test.p12_guest')::uuid) = 55.51, 'the account reads its order';
  assert (select count(*) from public.order_items where order_id = current_setting('test.p12_guest')::uuid and unit_price is not null) = 2,
    'and its priced lines';
end $$;
select test_reset();

-- A pending account's quote can't be moved to another account; a cancelled
-- one can't be priced; an approved buyer's order keeps its status when staff
-- change it; statuses outside the workflow are refused.
select test_login('00000000-0000-4000-8000-0000000012c1');
do $$
declare
  p uuid := current_setting('test.p12_pending')::uuid;
  line bigint := (select id from public.order_items where order_id = current_setting('test.p12_pending')::uuid);
  ord uuid := current_setting('test.p12_order')::uuid;
  ord_line bigint := (select id from public.order_items where order_id = current_setting('test.p12_order')::uuid);
begin
  perform public.admin_price_order(p, jsonb_build_array(jsonb_build_object('item_id', line, 'qty', 2, 'unit_price', 3.50)));
  assert pg_temp.p12_fails(format($s$select public.admin_convert_quote(%L, '00000000-0000-4000-8000-0000000012d1')$s$, p)) = 'account_mismatch',
    'a quote that belongs to an account stays with it';
  perform public.admin_convert_quote(p);
  assert (select kind = 'order' and status = 'confirmed' and user_id = '00000000-0000-4000-8000-0000000012a1' from public.orders where id = p),
    'converted on its own account';

  perform public.admin_price_order(ord, jsonb_build_array(jsonb_build_object('item_id', ord_line, 'qty', 1, 'unit_price', 5.70)));
  assert (select status = 'new' and kind = 'order' and total_units = 1 and subtotal = 5.70 from public.orders where id = ord),
    'staff can correct an order; it stays new';

  update public.orders set status = 'out_for_delivery' where id = ord;
  assert (select status from public.orders where id = ord) = 'out_for_delivery', 'the workflow statuses are allowed';
  assert pg_temp.p12_fails(format($s$update public.orders set status = 'shipped' where id = %L$s$, ord)) = '23514', 'other statuses are refused';
  update public.orders set status = 'cancelled' where id = ord;
  assert pg_temp.p12_fails(format($s$select public.admin_price_order(%L, '[{"item_id": %s, "qty": 1, "unit_price": 1}]')$s$, ord, ord_line)) = 'order_closed',
    'a cancelled order can''t be priced';
end $$;
select test_reset();

-- Leave the shared database as later test files expect it.
delete from public.orders where email like 'p12-%@example.com';
delete from public.products where id in (91201, 91202);
delete from public.quote_throttle;
