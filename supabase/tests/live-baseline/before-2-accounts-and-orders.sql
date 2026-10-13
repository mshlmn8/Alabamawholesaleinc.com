-- Accounts, licence documents and orders like the live project's (test
-- fixture, not for any real database). scripts/check-migrations.mjs
-- --from-live (part of npm run test:db) runs it after before-1-products.sql
-- and before supabase/release/apply-to-live-database.sql, on a database with
-- the migrations up to 20260927180000, so everything below goes through the
-- functions, triggers and policies the live project has today:
--
--   e0a1 the owner: signed up, confirmed, made an approved admin as
--        supabase/seed/provision_owner.sql does
--   e0b1 an approved Silver buyer whose application answers, store address
--        and consent are still in the sign-in metadata, and who changed the
--        profile's email away from the sign-in email (the old self-update
--        policy allowed it; 20261009140000 puts it back)
--   e0c1 an applicant under review, with a licence PDF and a HEIC resale
--        certificate (allowed until 20261012100000)
--   e0d1 a suspended account
--
-- Orders, all through the live 13-argument submit_quote: a guest's quote,
-- the applicant's quote, and two of the buyer's priced orders, one with a
-- Dutch Masters line (its SKU is corrected later) and one with a Wava kava
-- line (delisted later). The owner moved them through the old statuses.
-- live_orders_before and live_lines_before keep what was saved, for
-- after-release.sql.

insert into auth.users (id, email, email_confirmed_at, created_at, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000e0a1', 'owner@example.test', now() - interval '30 days', now() - interval '30 days',
   '{"name": "Owner", "business": "Alabama Wholesale"}'),
  ('00000000-0000-4000-8000-00000000e0b1', 'buyer@example.test', now() - interval '12 days', now() - interval '12 days',
   '{"name": "Live Buyer", "business": "Live Buyer Mart", "phone": "205-555-0101", "license_no": "TL-LIVE-B",
     "ein": "12-3456789", "resale_cert_no": "RS-LIVE-B", "business_type": "Convenience store", "state": "AL",
     "expected_volume": "Under $1,000 a week", "store_street": "1 Main St", "store_city": "Birmingham",
     "store_zip": "35203", "terms_accepted": true, "terms_version": "2026-09", "age_confirmed": true}'),
  ('00000000-0000-4000-8000-00000000e0c1', 'applicant@example.test', now() - interval '2 days', now() - interval '2 days',
   '{"name": "Live Applicant", "business": "Applicant Market", "phone": "205-555-0102", "license_no": "TL-LIVE-C",
     "ein": "98-7654321", "resale_cert_no": "RS-LIVE-C", "business_type": "Smoke shop", "state": "AL"}'),
  ('00000000-0000-4000-8000-00000000e0d1', 'suspended@example.test', now() - interval '40 days', now() - interval '40 days',
   '{"name": "Live Suspended", "business": "Closed Store"}');

update public.profiles set role = 'admin', status = 'approved' where id = '00000000-0000-4000-8000-00000000e0a1';
update public.profiles set status = 'approved', pricing_tier = 'silver' where id = '00000000-0000-4000-8000-00000000e0b1';
update public.profiles set status = 'suspended' where id = '00000000-0000-4000-8000-00000000e0d1';

-- The buyer edits their own profile's email (the old profiles_self_update policy).
select test_login('00000000-0000-4000-8000-00000000e0b1');
update public.profiles set email = 'orders@buyer-mart.example.test' where id = auth.uid();
select test_reset();

-- The applicant uploads proof from the application form.
select test_login('00000000-0000-4000-8000-00000000e0c1');
insert into storage.objects (bucket_id, name, owner, metadata) values
  ('application-documents', '00000000-0000-4000-8000-00000000e0c1/tobacco_license/license.pdf',
   '00000000-0000-4000-8000-00000000e0c1', '{"mimetype": "application/pdf"}'),
  ('application-documents', '00000000-0000-4000-8000-00000000e0c1/resale_certificate/certificate.heic',
   '00000000-0000-4000-8000-00000000e0c1', '{"mimetype": "image/heic"}');
insert into public.profile_documents (profile_id, document_type, storage_path, original_filename) values
  ('00000000-0000-4000-8000-00000000e0c1', 'tobacco_license',
   '00000000-0000-4000-8000-00000000e0c1/tobacco_license/license.pdf', 'license.pdf'),
  ('00000000-0000-4000-8000-00000000e0c1', 'resale_certificate',
   '00000000-0000-4000-8000-00000000e0c1/resale_certificate/certificate.heic', 'certificate.heic');
select test_reset();

-- Quotes and orders through the live site's call.
select test_anon();
select public.submit_quote('ALW-Q-LIVE00001', 'Walk-in Store', 'Guest Contact', 'guest@example.test', '205-555-0103',
  'delivery', null, 'Call before delivery', '2 Oak St', 'Bessemer', 'AL', '35020',
  '[{"product_id": 45, "qty": 2}]'::jsonb);
select test_reset();

select test_login('00000000-0000-4000-8000-00000000e0c1');
select public.submit_quote('ALW-Q-LIVE00002', 'Applicant Market', 'Live Applicant', 'applicant@example.test', '205-555-0102',
  'willcall', null, null, '613 Graymont Ave N', 'Birmingham', 'AL', '35203',
  '[{"product_id": 45, "qty": 1}, {"product_id": 83, "variant": "Gold", "qty": 4}]'::jsonb);
select test_reset();

select test_login('00000000-0000-4000-8000-00000000e0b1');
select public.submit_quote('ALW-Q-LIVE00003', 'Live Buyer Mart', 'Live Buyer', 'orders@buyer-mart.example.test', '205-555-0101',
  'delivery', null, null, '1 Main St', 'Birmingham', 'AL', '35203',
  '[{"product_id": 45, "qty": 3}, {"product_id": 83, "variant": "Gold", "qty": 2}]'::jsonb);
select public.submit_quote('ALW-Q-LIVE00004', 'Live Buyer Mart', 'Live Buyer', 'orders@buyer-mart.example.test', '205-555-0101',
  'delivery', null, null, '1 Main St', 'Birmingham', 'AL', '35203',
  '[{"product_id": 75, "variant": "Blueberry", "qty": 6}]'::jsonb);
select test_reset();

-- The owner works the orders in the old Admin (the four old statuses).
select test_login('00000000-0000-4000-8000-00000000e0a1');
update public.orders set status = 'contacted' where ref_num = 'ALW-Q-LIVE00001';
update public.orders set status = 'fulfilled' where ref_num = 'ALW-Q-LIVE00003';
update public.orders set status = 'cancelled' where ref_num = 'ALW-Q-LIVE00004';
select test_reset();

-- What was saved, for after-release.sql (temp tables, gone with the session).
create temp table live_orders_before as
  select id, ref_num, user_id, business, email, status, delivery, total_units, subtotal, ship_street, created_at
  from public.orders;
create temp table live_lines_before as
  select o.ref_num, i.product_id, i.product_name, i.sku, i.variant, i.qty, i.unit_price
  from public.order_items i join public.orders o on o.id = i.order_id;
create temp table live_prices_before as
  select id, price from public.products;

do $$
begin
  assert (select count(*) from live_orders_before) = 4, 'fixture: four live orders';
  assert (select count(*) from live_lines_before where unit_price is not null) = 3, 'fixture: the buyer''s three lines are priced';
  assert (select count(*) from public.orders where subtotal is null) = 2, 'fixture: the guest''s and the applicant''s quotes are unpriced';
end $$;
