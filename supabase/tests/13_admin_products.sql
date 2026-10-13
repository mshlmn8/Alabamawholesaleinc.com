-- Admin -> Products' database side (20261010120000_admin_product_editor.sql,
-- AW-023, AW-116, AW-119): new products take the next id, SKUs are unique
-- whatever their case, names, brands and prices are checked, a product on
-- order lines can't be deleted, the stock status and homepage rank are
-- readable by guests (price still isn't), and only admins write the
-- product-images bucket. Test accounts ...0ad1a1 (approved admin), ...0ad1b1
-- (approved customer); products 98101 and up, plus the one inserted without
-- an id. Everything is removed at the end.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000ad1a1', 'adm13-admin@example.com', '{"name": "Adm13 Admin"}'),
  ('00000000-0000-4000-8000-0000000ad1b1', 'adm13-buyer@example.com', '{"name": "Adm13 Buyer"}');
update public.profiles set status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000ad1a1';
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000ad1b1';

-- The hint (or, without one, the SQLSTATE) a statement fails with; null when
-- it succeeds. (pg_temp lives for the whole run: the adm13_ prefix keeps it
-- apart from other files' helpers.)
create or replace function pg_temp.adm13_fails(statement text) returns text language plpgsql as $$
declare h text; c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics h = pg_exception_hint, c = returned_sqlstate;
  return coalesce(nullif(h, ''), c);
end $$;

-- The SQLSTATE only.
create or replace function pg_temp.adm13_state(statement text) returns text language plpgsql as $$
declare c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics c = returned_sqlstate;
  return c;
end $$;

-- ---------------------------------------------------------------------------
-- (a) A new product without an id takes the next one, after the seeded ids.
-- Runs first, before this file adds rows with explicit ids.
-- ---------------------------------------------------------------------------
select set_config('test.adm13_next', (select (max(id) + 1)::text from public.products), false);

select test_login('00000000-0000-4000-8000-0000000ad1a1');
do $$
declare new_id integer;
begin
  insert into public.products (name, brand, cat, sub, sku)
  values ('Adm13 new', 'Adm13', 'CANDIES', 'Adm13 line', 'AW-ADM13-NEW')
  returning id into new_id;
  assert new_id = current_setting('test.adm13_next')::integer,
    format('a new product takes max(id) + 1 (%s), got %s', current_setting('test.adm13_next'), new_id);
  assert (select stock_status = 'in_stock' and featured_rank is null and active from public.products where id = new_id),
    'it starts in stock, unranked and active';
  perform set_config('test.adm13_auto', new_id::text, false);
end $$;
select test_reset();

-- Guests and customers can't add products.
select test_anon();
do $$ begin
  assert pg_temp.adm13_state($s$insert into public.products (name, brand, cat, sub, sku) values ('x', 'x', 'CANDIES', 'x', 'AW-ADM13-ANON')$s$) = '42501',
    'a guest can''t insert a product';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000ad1b1');
do $$ begin
  assert pg_temp.adm13_state($s$insert into public.products (name, brand, cat, sub, sku) values ('x', 'x', 'CANDIES', 'x', 'AW-ADM13-BUYER')$s$) = '42501',
    'a customer can''t insert a product';
  assert pg_temp.adm13_state($s$insert into public.products (id, name, brand, cat, sub, sku) values (98199, 'x', 'x', 'CANDIES', 'x', 'AW-ADM13-BUYER')$s$) = '42501',
    'nor with an id of their own';
end $$;
select test_reset();

do $$ begin
  assert (select price is null from public.products where id = current_setting('test.adm13_auto')::integer), 'with no price: price on request';
  assert not exists (select 1 from public.products where sku in ('AW-ADM13-ANON', 'AW-ADM13-BUYER')), 'no row was added';
  assert not has_sequence_privilege('anon', 'public.products_id_seq', 'usage'), 'guests have no use of the id sequence';
end $$;

-- The seed's footer moves the sequence past explicit ids, never back.
insert into public.products (id, name, brand, cat, sub, sku) values (98101, 'Adm13 one', 'Adm13', 'CANDIES', 'Adm13 line', 'AW-ADM13-ONE');
do $$
begin
  if to_regclass('public.products_id_seq') is not null then
    perform setval('public.products_id_seq',
      greatest(coalesce((select max(id) from public.products), 0) + 1,
        (select case when is_called then last_value + 1 else last_value end from public.products_id_seq)), false);
  end if;
end $$;
do $$ begin
  assert nextval('public.products_id_seq') = 98102, 'past the explicit id';
end $$;
do $$
begin
  perform setval('public.products_id_seq',
    greatest(coalesce((select max(id) from public.products), 0) + 1,
      (select case when is_called then last_value + 1 else last_value end from public.products_id_seq)), false);
  assert nextval('public.products_id_seq') = 98103, 'and never back to a used value';
end $$;

-- ---------------------------------------------------------------------------
-- (b, c) SKUs, names, brands and prices.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000ad1a1');
do $$ begin
  assert pg_temp.adm13_state($s$insert into public.products (id, name, brand, cat, sub, sku) values (98102, 'Adm13 two', 'Adm13', 'CANDIES', 'Adm13 line', ' aw-adm13-one ')$s$) = '23505',
    'a SKU used by another product, in another case or with spaces, is refused';
  assert pg_temp.adm13_state($s$update public.products set sku = 'Aw-Adm13-New' where id = 98101$s$) = '23505',
    'also on an update';

  insert into public.products (id, name, brand, cat, sub, sku) values (98102, 'Adm13 two', 'Adm13', 'CANDIES', 'Adm13 line', 'AW-ADM13-TWO');
  assert pg_temp.adm13_state($s$update public.products set name = '  ' where id = 98102$s$) = '23514', 'a blank name is refused';
  assert pg_temp.adm13_state($s$update public.products set brand = '' where id = 98102$s$) = '23514', 'a blank brand is refused';
  assert pg_temp.adm13_state($s$insert into public.products (id, name, brand, cat, sub, sku) values (98103, '', 'Adm13', 'CANDIES', 'Adm13 line', 'AW-ADM13-THREE')$s$) = '23514',
    'also on an insert';
  assert pg_temp.adm13_state($s$update public.products set price = -1 where id = 98102$s$) = '23514', 'a negative price is refused';
  assert pg_temp.adm13_state($s$update public.products set price = 100000 where id = 98102$s$) = '23514', 'a price of 100,000 is refused';
  update public.products set price = 99999.99 where id = 98102;
  update public.products set price = null where id = 98102;
  assert public.admin_product_prices() #> '{98102,list}' = 'null'::jsonb, 'up to 99,999.99, or price on request';

  assert pg_temp.adm13_state($s$update public.products set stock_status = 'gone' where id = 98102$s$) = '23514', 'stock status is one of four';
  assert pg_temp.adm13_state($s$update public.products set featured_rank = 0 where id = 98102$s$) = '23514', 'rank starts at 1';
  assert pg_temp.adm13_state($s$update public.products set featured_rank = 1000 where id = 98102$s$) = '23514', 'and ends at 999';
  update public.products set stock_status = 'low', featured_rank = 3 where id = 98102;
end $$;
select test_reset();

-- NOT VALID: a row from before the checks stays until someone edits it.
do $$ begin
  assert (select convalidated from pg_constraint where conname = 'products_name_brand_present') = false, 'the name check is NOT VALID';
  assert (select convalidated from pg_constraint where conname = 'products_price_max') = false, 'the price check is NOT VALID';
end $$;

-- ---------------------------------------------------------------------------
-- (d) Guests read the stock status and the rank, still not the price.
-- ---------------------------------------------------------------------------
select test_anon();
do $$ begin
  assert (select stock_status = 'low' and featured_rank = 3 from public.products where id = 98102), 'a guest reads stock_status and featured_rank';
  assert pg_temp.adm13_state('select price from public.products where id = 98102') = '42501', 'but not the price';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- (e) A product on order lines can't be deleted; one without can.
-- ---------------------------------------------------------------------------
insert into public.orders (id, ref_num, business, contact, email, phone, delivery)
values ('00000000-0000-4000-8000-0000000ad1f1', 'T-ADM13', 'Adm13 Market', 'Adm13 Buyer', 'adm13-buyer@example.com', '555-0113', 'willcall');
insert into public.order_items (order_id, product_id, product_name, sku, qty) values
  ('00000000-0000-4000-8000-0000000ad1f1', 98101, 'Adm13 one', 'AW-ADM13-ONE', 1);

select test_login('00000000-0000-4000-8000-0000000ad1a1');
do $$ begin
  assert pg_temp.adm13_fails('delete from public.products where id = 98101') = 'product_has_orders', 'a product on an order line is kept';
  assert pg_temp.adm13_state('delete from public.products where id = 98101') = '23503', 'with errcode 23503';
  update public.products set active = false where id = 98101;
  assert (select not active from public.products where id = 98101), 'it can be deactivated';
  delete from public.products where id = 98102;
  assert not exists (select 1 from public.products where id = 98102), 'a product without order lines is deleted';
end $$;
select test_reset();

do $$ begin
  assert (select product_id from public.order_items where order_id = '00000000-0000-4000-8000-0000000ad1f1') = 98101, 'the order line keeps its product';
  assert not has_function_privilege('authenticated', 'public.refuse_product_delete_with_orders()', 'execute'), 'nobody calls the trigger function';
  assert not has_function_privilege('anon', 'public.refuse_product_delete_with_orders()', 'execute'), 'not even guests';
end $$;

-- ---------------------------------------------------------------------------
-- (f) The product-images bucket: public, images up to 5 MB, admins write.
-- ---------------------------------------------------------------------------
do $$ begin
  assert (select public and file_size_limit = 5242880 and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
          from storage.buckets where id = 'product-images'), 'a public image bucket';
end $$;

select test_login('00000000-0000-4000-8000-0000000ad1a1');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('product-images', 'products/98101/1-adm13.jpg');
  update storage.objects set name = 'products/98101/2-adm13.jpg' where bucket_id = 'product-images' and name = 'products/98101/1-adm13.jpg';
  assert exists (select 1 from storage.objects where bucket_id = 'product-images' and name = 'products/98101/2-adm13.jpg'), 'an admin adds and renames a photo';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000ad1b1');
do $$ begin
  assert pg_temp.adm13_state($s$insert into storage.objects (bucket_id, name) values ('product-images', 'products/98101/3-buyer.jpg')$s$) = '42501',
    'a customer can''t add a photo';
  update storage.objects set name = 'products/98101/4-buyer.jpg' where bucket_id = 'product-images' and name = 'products/98101/2-adm13.jpg';
  delete from storage.objects where bucket_id = 'product-images';
end $$;
select test_reset();

do $$ begin
  assert exists (select 1 from storage.objects where bucket_id = 'product-images' and name = 'products/98101/2-adm13.jpg'),
    'nor rename or remove one';
end $$;

select test_anon();
do $$ begin
  assert pg_temp.adm13_state($s$insert into storage.objects (bucket_id, name) values ('product-images', 'products/98101/5-anon.jpg')$s$) = '42501',
    'a guest can''t add a photo';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000ad1a1');
do $$ begin
  delete from storage.objects where bucket_id = 'product-images' and name = 'products/98101/2-adm13.jpg';
  assert not exists (select 1 from storage.objects where bucket_id = 'product-images'), 'an admin removes a photo';
end $$;
select test_reset();

-- Leave the shared database as later test files expect it.
delete from public.order_items where order_id = '00000000-0000-4000-8000-0000000ad1f1';
delete from public.orders where id = '00000000-0000-4000-8000-0000000ad1f1';
delete from public.products where id in (98101, 98102, 98103) or id = current_setting('test.adm13_auto')::integer;
