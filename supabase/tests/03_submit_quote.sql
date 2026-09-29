-- submit_quote is the only way to create orders. It prices lines on the
-- server: guests and pending accounts get unpriced lines, approved accounts
-- get list price less their tier discount. The seed carries no prices
-- (20260928120000), so the product used here gets an obviously synthetic
-- price first; expected values are computed from it and pricing_tiers.
--
-- Since 20260928123000 the server makes the reference number (AW-049), so
-- there is no duplicate-reference case any more, and orders are found by the
-- reference submit_quote returns. Each caller uses its own email, and the
-- throttle is cleared first, so no call here is throttled (AW-198).
delete from public.quote_throttle;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000003a1', 'pending@example.com', '{"name": "Pending"}'),
  ('00000000-0000-4000-8000-0000000003b1', 'gold@example.com', '{"name": "Gold"}');
update public.profiles set status = 'approved', pricing_tier = 'gold' where id = '00000000-0000-4000-8000-0000000003b1';

-- An active product with at most one variant, so no variant choice is needed.
select set_config('test.product_id', (
  select id::text from public.products
  where active and jsonb_array_length(variants) <= 1
  order by id limit 1
), false);
update public.products set price = 12.34 where id = current_setting('test.product_id')::int;

create or replace function pg_temp.quote(email text) returns jsonb language sql as $$
  select public.submit_quote(
    p_business => 'Store', p_contact => 'Contact', p_email => email, p_phone => '205-555-0100',
    p_delivery => 'delivery', p_preferred_date => null, p_notes => null,
    p_ship_street => '1 Main St', p_ship_city => 'Birmingham', p_ship_state => 'AL', p_ship_zip => '35203',
    p_items => jsonb_build_array(jsonb_build_object('product_id', current_setting('test.product_id')::int, 'qty', 2)));
$$;

select test_anon();
do $$
declare r jsonb;
begin
  r := pg_temp.quote('p3-guest@example.com');
  assert (r->>'total_units')::int = 2, 'guest quote counts units';
  assert r->'subtotal' = 'null'::jsonb, 'guest quote has no subtotal';
  assert (select count(*) from public.orders) = 0, 'a guest cannot read back any order';
  perform set_config('test.guest_ref', r->>'ref_num', false);
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000003a1');
do $$
declare r jsonb;
begin
  r := pg_temp.quote('p3-pending@example.com');
  assert r->'subtotal' = 'null'::jsonb, 'a pending account gets an unpriced quote';
  assert (select count(*) from public.orders) = 1, 'a customer reads back only their own order';
  assert (select unit_price from public.order_items) is null, 'pending lines carry no price';
end $$;
select test_reset();

-- Worked out as the superuser: signed-in accounts can't read products.price.
select set_config('test.gold_unit', (
  select round(p.price * (1 - t.discount_pct / 100.0), 2)::text
  from public.products p, public.pricing_tiers t
  where p.id = current_setting('test.product_id')::int and t.tier = 'gold'
), false);

select test_login('00000000-0000-4000-8000-0000000003b1');
do $$
declare
  r jsonb;
  expected numeric := current_setting('test.gold_unit')::numeric;
begin
  r := pg_temp.quote('p3-gold@example.com');
  assert (select unit_price from public.order_items) = expected, 'approved lines are priced from the catalog and tier';
  assert (r->>'subtotal')::numeric = expected * 2, 'the subtotal is unit price times quantity';
  assert (select user_id from public.orders where ref_num = r->>'ref_num') = '00000000-0000-4000-8000-0000000003b1', 'the order belongs to the signed-in buyer';
end $$;
select test_reset();

do $$ begin
  assert (select user_id from public.orders where ref_num = current_setting('test.guest_ref')) is null, 'guest quotes are stored without a user';
  assert (select count(*) from public.order_items i join public.orders o on o.id = i.order_id where o.ref_num = current_setting('test.guest_ref') and i.unit_price is null) = 1, 'guest lines are unpriced';
end $$;
