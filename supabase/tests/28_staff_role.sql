-- Staff accounts (20261014120000_staff_role.sql; AW-030, AW-031, owner
-- answer 2026-10): an approved staff account does everything in the admin
-- area an approved admin does (accounts, documents, products and their
-- prices, photos, orders, the home page) except change an account's role or
-- pricing tier, the pricing tiers themselves, or another staff or admin
-- account. A pending or suspended staff account is a customer. Test
-- accounts: ...0028a1 approved admin, ...0028b1 approved staff, ...0028b2 a
-- second approved staff, ...0028b3 pending staff, ...0028b4 suspended staff,
-- ...0028c1 approved customer, ...0028c2 pending customer. Products 92801
-- and 92802, two orders, a home photo and Storage objects are made here and
-- removed at the end; the tiers are put back.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000028a1', 'p28-admin@example.test', '{"name": "P28 Admin"}'),
  ('00000000-0000-4000-8000-0000000028b1', 'p28-staff@example.test', '{"name": "P28 Staff"}'),
  ('00000000-0000-4000-8000-0000000028b2', 'p28-staff2@example.test', '{"name": "P28 Staff Two"}'),
  ('00000000-0000-4000-8000-0000000028b3', 'p28-pending-staff@example.test', '{"name": "P28 Pending Staff"}'),
  ('00000000-0000-4000-8000-0000000028b4', 'p28-suspended-staff@example.test', '{"name": "P28 Suspended Staff"}'),
  ('00000000-0000-4000-8000-0000000028c1', 'p28-buyer@example.test', '{"name": "P28 Buyer"}'),
  ('00000000-0000-4000-8000-0000000028c2', 'p28-pending@example.test', '{"name": "P28 Pending"}');
update public.profiles set status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000028a1';
update public.profiles set status = 'approved', role = 'staff'
  where id in ('00000000-0000-4000-8000-0000000028b1', '00000000-0000-4000-8000-0000000028b2');
update public.profiles set role = 'staff' where id = '00000000-0000-4000-8000-0000000028b3';
update public.profiles set status = 'suspended', role = 'staff' where id = '00000000-0000-4000-8000-0000000028b4';
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000028c1';

-- The hint (or, without one, the SQLSTATE) a statement fails with; null when
-- it succeeds. (pg_temp lives for the whole run: the p28_ prefix keeps it
-- apart from other files' helpers.)
create or replace function pg_temp.p28_fails(statement text) returns text language plpgsql as $$
declare h text; c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics h = pg_exception_hint, c = returned_sqlstate;
  return coalesce(nullif(h, ''), c);
end $$;

-- The SQLSTATE only.
create or replace function pg_temp.p28_state(statement text) returns text language plpgsql as $$
declare c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics c = returned_sqlstate;
  return c;
end $$;

-- How many rows a statement changed (an update or delete that RLS hides
-- changes none, without an error).
create or replace function pg_temp.p28_rows(statement text) returns integer language plpgsql as $$
declare n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end $$;

-- Products, orders, a licence document and the tiers as they were.
insert into public.products (id, name, brand, cat, sub, sku, price, tag, active) values
  (92801, 'P28 active', 'P28', 'CANDIES', 'P28 line', 'AW-P28-ONE', 10.00, null, true),
  (92802, 'P28 hidden', 'P28', 'CANDIES', 'P28 line', 'AW-P28-TWO', 20.00, null, false);
insert into public.orders (id, ref_num, business, contact, email, phone, delivery) values
  ('00000000-0000-4000-8000-0000000028d1', 'ALW-O-P28A0001', 'P28 Market', 'P28 Buyer', 'p28-buyer@example.test', '205-555-0128', 'delivery'),
  ('00000000-0000-4000-8000-0000000028d2', 'ALW-O-P28A0002', 'P28 Other', 'P28 Other', 'p28-other@example.test', '205-555-0129', 'willcall');
update public.orders set user_id = '00000000-0000-4000-8000-0000000028c1' where id = '00000000-0000-4000-8000-0000000028d1';
insert into storage.objects (bucket_id, name) values
  ('application-documents', '00000000-0000-4000-8000-0000000028c2/tobacco_license/1-license.pdf');
insert into public.profile_documents (profile_id, document_type, storage_path, original_filename) values
  ('00000000-0000-4000-8000-0000000028c2', 'tobacco_license', '00000000-0000-4000-8000-0000000028c2/tobacco_license/1-license.pdf', 'license.pdf');
create temp table p28_tiers as select tier, discount_pct from public.pricing_tiers;
grant select on p28_tiers to authenticated;

-- ---------------------------------------------------------------------------
-- The role list and the two checks.
-- ---------------------------------------------------------------------------
do $$ begin
  assert pg_temp.p28_state($s$update public.profiles set role = 'owner' where id = '00000000-0000-4000-8000-0000000028c2'$s$) = '23514',
    'a role other than customer, staff or admin is refused';
  assert (select role from public.profiles where id = '00000000-0000-4000-8000-0000000028b1') = 'staff', 'staff is a role';
  assert has_function_privilege('anon', 'public.is_staff_or_admin()', 'execute'), 'guests may call it (policies do)';
end $$;

select test_anon();
do $$ begin
  assert not public.is_staff_or_admin(), 'a guest is not staff';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000028a1');
do $$ begin
  assert public.is_staff_or_admin() and public.is_admin(), 'an approved admin is staff and an admin';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000028b1');
do $$ begin
  assert public.is_staff_or_admin(), 'approved staff are staff';
  assert not public.is_admin(), 'but not an admin';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000028b3');
do $$ begin
  assert not public.is_staff_or_admin(), 'pending staff are not staff';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000028b4');
do $$ begin
  assert not public.is_staff_or_admin(), 'suspended staff are not staff';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000028c1');
do $$ begin
  assert not public.is_staff_or_admin(), 'a customer is not staff';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- Accounts: staff read every account, its documents and history, and change
-- a customer's status, note and details, but never a role or a tier.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000028b1');
do $$ begin
  assert (select count(*) from public.profiles where email like 'p28-%') = 7, 'staff read every account';
  assert exists (select 1 from public.profile_documents where profile_id = '00000000-0000-4000-8000-0000000028c2'),
    'and an applicant''s document records';
  assert exists (select 1 from storage.objects where bucket_id = 'application-documents'
                 and name like '00000000-0000-4000-8000-0000000028c2/%'), 'and the license file itself';

  assert pg_temp.p28_rows($s$update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000028c2'$s$) = 1,
    'staff approve an application';
  assert (select approved_by from public.profiles where id = '00000000-0000-4000-8000-0000000028c2') = '00000000-0000-4000-8000-0000000028b1',
    'stamped with who approved it';
  assert pg_temp.p28_rows($s$update public.profiles set verification_note = 'P28 licence checked', business = 'P28 Corner Store'
                             where id = '00000000-0000-4000-8000-0000000028c2'$s$) = 1, 'and change its note and details';
  assert pg_temp.p28_rows($s$update public.profiles set status = 'suspended' where id = '00000000-0000-4000-8000-0000000028c2'$s$) = 1,
    'and suspend it';
  assert (select count(*) from public.profile_status_log where profile_id = '00000000-0000-4000-8000-0000000028c2') >= 2,
    'staff read the status history';
  assert pg_temp.p28_rows($s$insert into public.profile_admin_notes (profile_id, body) values ('00000000-0000-4000-8000-0000000028c2', 'P28 staff note')$s$) = 1,
    'and write internal notes';

  assert pg_temp.p28_fails($s$update public.profiles set role = 'staff' where id = '00000000-0000-4000-8000-0000000028c1'$s$) = 'role_admin_only',
    'staff can''t make a customer staff';
  assert pg_temp.p28_fails($s$update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000028c1'$s$) = 'role_admin_only',
    'or an admin';
  assert pg_temp.p28_fails($s$update public.profiles set pricing_tier = 'gold' where id = '00000000-0000-4000-8000-0000000028c1'$s$) = 'tier_admin_only',
    'nor change a pricing tier';
  assert pg_temp.p28_state($s$update public.profiles set pricing_tier = 'gold' where id = '00000000-0000-4000-8000-0000000028c1'$s$) = '42501',
    'with 42501';
  assert pg_temp.p28_fails($s$update public.profiles set status = 'suspended' where id = '00000000-0000-4000-8000-0000000028a1'$s$) = 'staff_account',
    'staff can''t suspend an admin';
  assert pg_temp.p28_fails($s$update public.profiles set name = 'Renamed' where id = '00000000-0000-4000-8000-0000000028b2'$s$) = 'staff_account',
    'nor change another staff account';
  assert pg_temp.p28_fails($s$update public.profiles set role = 'customer' where id = '00000000-0000-4000-8000-0000000028b2'$s$) = 'role_admin_only',
    'nor take its role away';
  assert pg_temp.p28_rows($s$update public.profiles set name = name where id = '00000000-0000-4000-8000-0000000028a1'$s$) = 1,
    'an update that changes nothing is not refused';

  -- Their own account: name, phone and store address only, silently.
  assert pg_temp.p28_rows($s$update public.profiles set name = 'P28 Staff Renamed', role = 'admin', status = 'pending', pricing_tier = 'gold'
                             where id = '00000000-0000-4000-8000-0000000028b1'$s$) = 1, 'staff update their own account';
end $$;
select test_reset();

do $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = '00000000-0000-4000-8000-0000000028b1';
  assert p.name = 'P28 Staff Renamed', 'their own name changed';
  assert p.role = 'staff' and p.status = 'approved' and p.pricing_tier is distinct from 'gold',
    format('their own role, status and tier did not: %s %s %s', p.role, p.status, p.pricing_tier);
  assert (select role from public.profiles where id = '00000000-0000-4000-8000-0000000028c1') = 'customer', 'the customer is still a customer';
  assert (select status from public.profiles where id = '00000000-0000-4000-8000-0000000028a1') = 'approved', 'the admin is still approved';
  assert (select name from public.profiles where id = '00000000-0000-4000-8000-0000000028b2') = 'P28 Staff Two', 'the other staff account is unchanged';
end $$;

-- An admin makes a customer staff, takes it back, and changes a tier.
select test_login('00000000-0000-4000-8000-0000000028a1');
do $$ begin
  assert pg_temp.p28_rows($s$update public.profiles set role = 'staff' where id = '00000000-0000-4000-8000-0000000028c1'$s$) = 1,
    'an admin makes a customer staff';
  assert pg_temp.p28_rows($s$update public.profiles set role = 'customer' where id = '00000000-0000-4000-8000-0000000028c1'$s$) = 1,
    'and a customer again';
  assert pg_temp.p28_rows($s$update public.profiles set name = 'P28 Staff Two' where id = '00000000-0000-4000-8000-0000000028b2'$s$) = 1,
    'an admin changes a staff account';
  assert pg_temp.p28_rows($s$update public.profiles set pricing_tier = pricing_tier where id = '00000000-0000-4000-8000-0000000028c1'$s$) = 1,
    'and a tier';
  assert pg_temp.p28_fails($s$update public.profiles set role = 'staff' where id = '00000000-0000-4000-8000-0000000028a1'$s$) = 'own_role_status',
    'but not their own role';
end $$;
select test_reset();

do $$ begin
  assert (select count(*) from public.profile_status_log
          where profile_id = '00000000-0000-4000-8000-0000000028c1' and new_role = 'staff' and changed_by = '00000000-0000-4000-8000-0000000028a1') = 1,
    'making someone staff is logged with who did it';
end $$;

-- A pending or suspended staff account is a customer.
select test_login('00000000-0000-4000-8000-0000000028b3');
do $$ begin
  assert (select count(*) from public.profiles where email like 'p28-%') = 1, 'pending staff read only their own account';
  assert pg_temp.p28_rows($s$update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000028c2'$s$) = 0,
    'and change no other';
  assert pg_temp.p28_rows($s$update public.products set name = 'x' where id = 92801$s$) = 0, 'nor a product';
  assert pg_temp.p28_state('select public.admin_product_prices()') = '42501', 'nor read list prices';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000028b4');
do $$ begin
  assert (select count(*) from public.profiles where email like 'p28-%') = 1, 'suspended staff read only their own account';
  assert pg_temp.p28_fails($s$select public.admin_set_order_status('00000000-0000-4000-8000-0000000028d1', 'contacted', null)$s$) = 'admin_only',
    'and can''t change an order';
  assert not exists (select 1 from storage.objects where bucket_id = 'application-documents'
                     and name like '00000000-0000-4000-8000-0000000028c2/%'), 'nor read a license file';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- Pricing tiers: staff read them; only an admin changes them.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000028b1');
do $$ begin
  assert (select count(*) from public.pricing_tiers) > 0, 'staff read the tiers';
  assert pg_temp.p28_rows($s$update public.pricing_tiers set discount_pct = discount_pct + 1$s$) = 0, 'but change none';
  assert pg_temp.p28_state($s$insert into public.pricing_tiers (tier, discount_pct, label) values ('p28', 1, 'P28')$s$) = '42501',
    'nor add one';
  assert pg_temp.p28_rows($s$delete from public.pricing_tiers where tier = 'gold'$s$) = 0, 'nor delete one';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000028a1');
do $$ begin
  assert pg_temp.p28_rows($s$update public.pricing_tiers set discount_pct = discount_pct where tier in (select tier from p28_tiers)$s$) > 0,
    'an admin changes them';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- Products: staff edit every column, inactive ones too, the variant prices,
-- photos in the product-images bucket, and run the bulk price and import
-- functions. A customer can't.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000028b1');
do $$
declare result jsonb;
begin
  assert exists (select 1 from public.products where id = 92802), 'staff read an inactive product';
  assert pg_temp.p28_rows($s$update public.products set sell_unit = 'box of 24', img = 'https://abc.supabase.co/storage/v1/object/public/product-images/products/92801/1-p28.jpg'
                             where id in (92801, 92802)$s$) = 2, 'and set sell units and photos';
  assert pg_temp.p28_rows($s$insert into public.products (name, brand, cat, sub, sku, price) values ('P28 new', 'P28', 'CANDIES', 'P28 line', 'AW-P28-NEW', 5)$s$) = 1,
    'add a product';
  assert pg_temp.p28_rows($s$insert into public.product_variant_prices (product_id, variant, price) values (92801, 'Large', 12.00)$s$) = 1,
    'add a variant price';
  assert pg_temp.p28_rows($s$update public.product_variant_prices set price = 13.00 where product_id = 92801$s$) = 1, 'change it';
  result := public.admin_product_prices();
  assert (result -> '92801' ->> 'list')::numeric = 10.00, format('read the list prices: %s', result -> '92801');
  assert (result -> '92801' -> 'variants' -> 'Large' ->> 'list')::numeric = 13.00, 'and the variant''s';
  result := public.admin_bulk_adjust_prices(array[92801], 10, 0, true);
  assert (result ->> 'updated')::int = 1, format('adjust prices in bulk: %s', result);
  result := public.admin_import_products_v2('[{"sku": "AW-P28-TWO", "sell_unit": "case of 12"}]'::jsonb);
  assert (select sell_unit from public.products where id = 92802) = 'case of 12', format('and import a file: %s', result);
  assert pg_temp.p28_rows($s$delete from public.product_variant_prices where product_id = 92801$s$) = 1, 'and remove a variant price';
  assert pg_temp.p28_rows($s$delete from public.products where sku = 'AW-P28-NEW'$s$) = 1, 'and delete a product without orders';

  assert pg_temp.p28_rows($s$insert into storage.objects (bucket_id, name) values ('product-images', 'products/92801/1-p28.jpg')$s$) = 1,
    'staff upload a product photo';
  assert pg_temp.p28_rows($s$update storage.objects set metadata = '{"p28": true}'::jsonb where bucket_id = 'product-images' and name = 'products/92801/1-p28.jpg'$s$) = 1,
    'replace it';
  assert pg_temp.p28_rows($s$delete from storage.objects where bucket_id = 'product-images' and name = 'products/92801/1-p28.jpg'$s$) = 1,
    'and remove it';
end $$;
select test_reset();

do $$ begin
  assert (select price from public.products where id = 92801) = 11.00, 'the bulk change moved the price 10%';
  assert (select sell_unit from public.products where id = 92801) = 'box of 24', 'the sell unit is saved';
end $$;

select test_login('00000000-0000-4000-8000-0000000028c1');
do $$ begin
  assert pg_temp.p28_rows($s$update public.products set sell_unit = 'x' where id = 92801$s$) = 0, 'a customer changes no product';
  assert pg_temp.p28_state('select public.admin_product_prices()') = '42501', 'nor reads list prices';
  assert pg_temp.p28_fails('select public.admin_bulk_adjust_prices(array[92801], 10, 0, true)') = 'admin_only', 'nor adjusts them';
  assert pg_temp.p28_state($s$insert into storage.objects (bucket_id, name) values ('product-images', 'products/92801/2-p28.jpg')$s$) = '42501',
    'nor uploads a photo';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- Orders: staff read and work every order, its lines, history and notes.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000028b1');
do $$
declare result jsonb;
begin
  assert (select count(*) from public.orders where ref_num like 'ALW-O-P28%') = 2, 'staff read every order';
  result := public.admin_set_order_status('00000000-0000-4000-8000-0000000028d1', 'contacted', 'P28 called');
  assert result ->> 'status' = 'contacted', format('change an order''s status: %s', result);
  assert exists (select 1 from public.order_events where order_id = '00000000-0000-4000-8000-0000000028d1'), 'read its history';
  assert pg_temp.p28_rows($s$insert into public.order_admin_notes (order_id, body) values ('00000000-0000-4000-8000-0000000028d1', 'P28 note')$s$) = 1,
    'write a staff note';
  assert pg_temp.p28_rows($s$update public.orders set assigned_to = '00000000-0000-4000-8000-0000000028b1' where id = '00000000-0000-4000-8000-0000000028d2'$s$) = 1,
    'take an order';
  perform public.admin_mark_orders_seen();
  assert exists (select 1 from public.admin_order_views where admin_id = '00000000-0000-4000-8000-0000000028b1'), 'and mark the orders seen';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000028c1');
do $$ begin
  assert (select count(*) from public.orders where ref_num like 'ALW-O-P28%') = 1, 'a customer reads only their own order';
  assert pg_temp.p28_fails('select public.admin_mark_orders_seen()') = 'admin_only', 'and marks nothing seen';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- The home page's photos.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000028b1');
do $$ begin
  assert pg_temp.p28_rows($s$insert into public.home_slides (img, alt, sort, active) values ('hero_candy.jpg', 'P28 photo', 999, false)$s$) = 1,
    'staff add a home photo';
  assert pg_temp.p28_rows($s$update public.home_slides set alt = 'P28 photo, edited' where alt = 'P28 photo'$s$) = 1, 'change it';
  assert pg_temp.p28_rows($s$delete from public.home_slides where alt = 'P28 photo, edited'$s$) = 1, 'and delete it';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- Put things back.
-- ---------------------------------------------------------------------------
update public.pricing_tiers t set discount_pct = s.discount_pct from p28_tiers s where s.tier = t.tier;
delete from public.order_admin_notes where order_id in ('00000000-0000-4000-8000-0000000028d1', '00000000-0000-4000-8000-0000000028d2');
delete from public.order_events where order_id in ('00000000-0000-4000-8000-0000000028d1', '00000000-0000-4000-8000-0000000028d2');
delete from public.orders where id in ('00000000-0000-4000-8000-0000000028d1', '00000000-0000-4000-8000-0000000028d2');
delete from public.admin_order_views where admin_id::text like '00000000-0000-4000-8000-0000000028%';
delete from public.product_variant_prices where product_id in (92801, 92802);
delete from public.products where id in (92801, 92802);
delete from public.profile_documents where profile_id = '00000000-0000-4000-8000-0000000028c2';
delete from storage.objects where name like '00000000-0000-4000-8000-0000000028%' or name like 'products/92801/%';
drop table p28_tiers;
