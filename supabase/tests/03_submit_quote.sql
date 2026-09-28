-- submit_quote is the only way to create orders. It prices lines on the
-- server: guests and pending accounts get unpriced lines, approved accounts
-- get list price less their tier discount. No prices appear in this file;
-- expected values are computed from the seeded products and pricing_tiers.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000003a1', 'pending@example.com', '{"name": "Pending"}'),
  ('00000000-0000-4000-8000-0000000003b1', 'gold@example.com', '{"name": "Gold"}');
update public.profiles set status = 'approved', pricing_tier = 'gold' where id = '00000000-0000-4000-8000-0000000003b1';

-- An active product with at most one variant, so no variant choice is needed.
select set_config('test.product_id', (
  select id::text from public.products
  where active and jsonb_array_length(variants) <= 1 and price is not null
  order by id limit 1
), false);

create or replace function pg_temp.quote(ref text) returns jsonb language sql as $$
  select public.submit_quote(ref, 'Store', 'Contact', 'buyer@example.com', '205-555-0100', 'delivery', null, null,
    '1 Main St', 'Birmingham', 'AL', '35203',
    jsonb_build_array(jsonb_build_object('product_id', current_setting('test.product_id')::int, 'qty', 2)));
$$;

select test_anon();
do $$
declare r jsonb;
begin
  r := pg_temp.quote('T-GUEST-1');
  assert (r->>'total_units')::int = 2, 'guest quote counts units';
  assert r->'subtotal' = 'null'::jsonb, 'guest quote has no subtotal';
  assert (select count(*) from public.orders) = 0, 'a guest cannot read back any order';
  begin
    perform pg_temp.quote('T-GUEST-1');
    raise exception 'a duplicate reference should have failed';
  exception when raise_exception then
    assert sqlerrm = 'This quote was already submitted', sqlerrm;
  end;
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000003a1');
do $$
declare r jsonb;
begin
  r := pg_temp.quote('T-PENDING-1');
  assert r->'subtotal' = 'null'::jsonb, 'a pending account gets an unpriced quote';
  assert (select count(*) from public.orders) = 1, 'a customer reads back only their own order';
  assert (select unit_price from public.order_items) is null, 'pending lines carry no price';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000003b1');
do $$
declare
  r jsonb;
  expected numeric;
begin
  select round(p.price * (1 - t.discount_pct / 100.0), 2) into expected
  from public.products p, public.pricing_tiers t
  where p.id = current_setting('test.product_id')::int and t.tier = 'gold';
  r := pg_temp.quote('T-GOLD-1');
  assert (select unit_price from public.order_items) = expected, 'approved lines are priced from the catalog and tier';
  assert (r->>'subtotal')::numeric = expected * 2, 'the subtotal is unit price times quantity';
  assert (select user_id from public.orders where ref_num = 'T-GOLD-1') = '00000000-0000-4000-8000-0000000003b1', 'the order belongs to the signed-in buyer';
end $$;
select test_reset();

do $$ begin
  assert (select user_id from public.orders where ref_num = 'T-GUEST-1') is null, 'guest quotes are stored without a user';
  assert (select count(*) from public.order_items i join public.orders o on o.id = i.order_id where o.ref_num = 'T-GUEST-1' and i.unit_price is null) = 1, 'guest lines are unpriced';
end $$;
