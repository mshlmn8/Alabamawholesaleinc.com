-- The live data once supabase/release/apply-to-live-database.sql has run
-- (test assertions). scripts/check-migrations.mjs --from-live runs this right
-- after the release file, on the database before-1-products.sql and
-- before-2-accounts-and-orders.sql built, and before provision_owner.sql and
-- supabase/tests/*.sql. Accounts e0a1 (owner), e0b1 (approved Silver buyer),
-- e0c1 (applicant), e0d1 (suspended); pg_temp helpers are prefixed lb_.

-- The hint a statement fails with ('ok' when it succeeds).
create or replace function pg_temp.lb_hint(statement text) returns text language plpgsql as $$
declare
  h text;
begin
  execute statement;
  return 'ok';
exception when others then
  get stacked diagnostics h = pg_exception_hint;
  return coalesce(nullif(h, ''), sqlstate);
end $$;

-- Orders and their lines: every one kept as it was saved, with the kind the
-- quote workflow gives it (an approved account's priced request is an order).
do $$
begin
  assert not exists (
    select id, ref_num, user_id, business, email, status, delivery, total_units, subtotal, ship_street, created_at from live_orders_before
    except
    select id, ref_num, user_id, business, email, status, delivery, total_units, subtotal, ship_street, created_at from public.orders
  ), 'every live order is kept as it was';
  assert not exists (
    select * from live_lines_before
    except
    select o.ref_num, i.product_id, i.product_name, i.sku, i.variant, i.qty, i.unit_price
    from public.order_items i join public.orders o on o.id = i.order_id
  ), 'every order line keeps its name, SKU, variant, quantity and price';
  assert (select string_agg(ref_num || ' ' || kind, ', ' order by ref_num) from public.orders) =
    'ALW-Q-LIVE00001 quote, ALW-Q-LIVE00002 quote, ALW-Q-LIVE00003 order, ALW-Q-LIVE00004 order',
    'the guest''s and the applicant''s requests are quotes, the buyer''s are orders';
  -- The SKU of #83 and the line of #75 changed, the saved lines didn't.
  assert (select sku from public.products where id = 83) = 'AW-DUTCH-MASTERS', 'catalog corrections ran';
  assert (select sku from live_lines_before where ref_num = 'ALW-Q-LIVE00003' and product_id = 83) = 'AW-DUTCH-MASTER-GOLD',
    'the saved line keeps the SKU it was ordered under';
  assert not (select active from public.products where id = 75), 'Wava kava is delisted (AW-001)';
  assert (select count(*) from public.products where not active) = 22, 'exactly the 22 delisted rows are inactive';
  assert exists (select 1 from public.order_items where product_id = 75), 'the order line of a delisted product keeps its product';
end $$;

-- List prices stay as they were; the price column is now private.
do $$
begin
  assert not exists (
    select id, price from live_prices_before except select id, price from public.products
  ), 'no list price changed';
  assert (select count(*) from public.products) = 368, 'the seed added no product';
  assert not exists (select 1 from information_schema.columns where table_name = 'products' and column_name in ('flavors', 'variant_prices')),
    'flavors and variant_prices are gone';
end $$;
select test_anon();
do $$
begin
  assert pg_temp.lb_hint('select price from public.products limit 1') = '42501', 'a guest can''t read list prices';
  assert (select count(*) from public.products) = 346, 'a guest sees the 346 listed products';
end $$;
select test_reset();

-- The owner is still an approved admin and reads the list prices. (The
-- temp tables are the superuser's, so #45's price goes in a setting.)
select set_config('lb.price45', (select price::text from live_prices_before where id = 45), false);
select test_login('00000000-0000-4000-8000-00000000e0a1');
do $$
begin
  assert public.is_admin() and public.is_staff_or_admin(), 'the owner keeps admin rights';
  assert (public.admin_product_prices() #>> '{45,list}')::numeric = current_setting('lb.price45')::numeric,
    'admin_product_prices() returns the stored list price';
  assert (select count(*) from public.profiles) = 4, 'the owner reads every account';
  assert (select count(*) from public.profile_documents) = 2, 'and the applicant''s documents';
end $$;
select test_reset();

-- The approved buyer: application answers moved from the sign-in metadata to
-- the profile, the profile's email back on the sign-in email, Silver prices.
do $$
declare
  v_buyer constant uuid := '00000000-0000-4000-8000-00000000e0b1';
  p public.profiles;
begin
  select * into p from public.profiles where id = v_buyer;
  assert p.status = 'approved' and p.pricing_tier = 'silver' and p.role = 'customer', 'the buyer is still an approved Silver customer';
  assert p.email = 'buyer@example.test', 'the profile email follows the sign-in email again';
  assert p.ein = '12-3456789' and p.license_no = 'TL-LIVE-B' and p.resale_cert_no = 'RS-LIVE-B'
    and p.store_street = '1 Main St' and p.store_city = 'Birmingham' and p.store_zip = '35203',
    'the application answers are on the profile';
  assert p.terms_version = '2026-09' and p.terms_accepted_at is not null and p.age_confirmed_at is not null,
    'the consent the buyer gave at sign-up is on the profile';
  -- backfill_profiles_from_metadata() (20261009140000) strips the answers it
  -- copies; the business type and state are on the profile already and stay.
  assert (select raw_user_meta_data from auth.users where id = v_buyer)
    = '{"name": "Live Buyer", "business": "Live Buyer Mart", "business_type": "Convenience store", "state": "AL"}'::jsonb,
    'the EIN, licence, resale certificate, phone, volume, address and consent are stripped from the sign-in metadata';
end $$;
select test_login('00000000-0000-4000-8000-00000000e0b1');
do $$
declare
  v_list numeric := current_setting('lb.price45')::numeric;
begin
  assert (public.my_prices() #>> '{products,45,unit}')::numeric = round(v_list * 0.95, 2),
    'my_prices() gives the buyer list price less Silver''s 5%';
end $$;
select test_reset();

-- The applicant's proof is still on file, and the applicant still can't see prices.
do $$
begin
  assert (select count(*) from public.profile_documents where profile_id = '00000000-0000-4000-8000-00000000e0c1') = 2,
    'the applicant''s two documents are kept';
  assert (select count(*) from storage.objects where bucket_id = 'application-documents') = 2, 'and their files';
  assert (select status from public.profiles where id = '00000000-0000-4000-8000-00000000e0c1') = 'pending', 'the applicant is still under review';
  assert (select ein from public.profiles where id = '00000000-0000-4000-8000-00000000e0c1') = '98-7654321', 'with the answers on the profile';
end $$;
select test_login('00000000-0000-4000-8000-00000000e0c1');
do $$ begin assert public.my_prices() is null, 'an applicant gets no prices'; end $$;
select test_reset();

-- New since the release: the home page's reel, site settings, staff, and
-- orders only from approved accounts.
do $$
begin
  assert (select count(*) from public.home_slides where active) = 8, 'the home page shows the 8-photo warehouse reel';
  assert (select count(*) from public.site_settings) = 1, 'site_settings has its one row';
  assert (select phone is null and email is null from public.site_settings), 'with the site''s own values';
  assert (select count(*) from storage.buckets where id = 'product-images' and public) = 1, 'the product-images bucket exists';
  assert (select public from storage.buckets where id = 'application-documents') = false, 'the documents bucket is still private';
end $$;

delete from public.quote_throttle;
create or replace function pg_temp.lb_order() returns text language sql as $$
  select pg_temp.lb_hint($s$select public.submit_quote(
    p_business => 'Live Buyer Mart', p_contact => 'Live Buyer', p_email => 'buyer@example.test', p_phone => '205-555-0101',
    p_delivery => 'willcall', p_preferred_date => null, p_notes => null,
    p_ship_street => null, p_ship_city => null, p_ship_state => null, p_ship_zip => null,
    p_items => '[{"product_id": 45, "qty": 1}]'::jsonb)$s$);
$$;
select test_anon();
do $$ begin assert pg_temp.lb_order() = 'sign_in_required', 'a guest can''t order'; end $$;
select test_login('00000000-0000-4000-8000-00000000e0c1');
do $$ begin assert pg_temp.lb_order() = 'account_not_approved', 'the applicant can''t order yet'; end $$;
select test_login('00000000-0000-4000-8000-00000000e0d1');
do $$ begin assert pg_temp.lb_order() = 'account_suspended', 'a suspended account can''t order'; end $$;
select test_login('00000000-0000-4000-8000-00000000e0b1');
do $$ begin assert pg_temp.lb_order() = 'ok', 'the approved buyer places an order'; end $$;
select test_reset();
do $$
begin
  assert (select count(*) from public.orders where ref_num like 'ALW-O-%' and kind = 'order' and subtotal is not null
            and user_id = '00000000-0000-4000-8000-00000000e0b1') = 1,
    'the new order is the buyer''s, priced, with a server-made ALW-O- reference';
end $$;
-- Leave the database as the release left it for supabase/tests/*.sql.
delete from public.orders where ref_num like 'ALW-O-%';
delete from public.quote_throttle;
