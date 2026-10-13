-- "Show no description" (20261012120000_product_description_hidden.sql,
-- AW-023): products.description_hidden defaults to false, guests and
-- signed-in accounts read it (price still isn't readable), a customer can't
-- change it, an approved admin can, and the description text is kept.
--
-- Users ...0021a1 approved admin, ...0021b1 approved customer; product
-- 92101. Everything this file adds is removed at the end.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000021a1', 'p21-admin@example.test', '{"name": "P21 Admin"}'),
  ('00000000-0000-4000-8000-0000000021b1', 'p21-buyer@example.test', '{"name": "P21 Buyer"}');
update public.profiles set status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000021a1';
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000021b1';

insert into public.products (id, name, brand, cat, sub, sku, description, active)
values (92101, 'P21 product', 'P21', 'CANDIES', 'P21 line', 'AW-P21-ONE', 'P21 wrong text', true);

-- The SQLSTATE a statement fails with; null when it succeeds. (pg_temp lives
-- for the whole run: the p21_ prefix keeps it apart from other files'
-- helpers.)
create or replace function pg_temp.p21_state(statement text) returns text language plpgsql as $$
declare c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics c = returned_sqlstate;
  return c;
end $$;

-- How many rows a statement changed (an update RLS hides changes none,
-- without an error), or its SQLSTATE when it fails.
create or replace function pg_temp.p21_rows(statement text) returns text language plpgsql as $$
declare n integer; c text;
begin
  execute statement;
  get diagnostics n = row_count;
  return n::text;
exception when others then
  get stacked diagnostics c = returned_sqlstate;
  return c;
end $$;

do $$ begin
  assert (select description_hidden = false from public.products where id = 92101), 'a product shows its description by default';
  assert not exists (select 1 from public.products where description_hidden), 'and no seeded product hides it';
  assert (select attnotnull from pg_attribute where attrelid = 'public.products'::regclass and attname = 'description_hidden'),
    'description_hidden is not null';
  assert has_column_privilege('anon', 'public.products', 'description_hidden', 'select'), 'guests may read it';
  assert has_column_privilege('authenticated', 'public.products', 'description_hidden', 'select'), 'and signed-in accounts';
  assert not has_column_privilege('anon', 'public.products', 'price', 'select'), 'price still isn''t readable';
end $$;

-- A guest reads it, as the storefront's catalog query does.
select test_anon();
do $$ begin
  assert (select description_hidden = false from public.products where id = 92101), 'a guest reads description_hidden';
  assert pg_temp.p21_state($s$select id, description, description_hidden, featured_rank from public.products where id = 92101$s$) is null,
    'together with the storefront''s other columns';
  assert pg_temp.p21_rows($s$update public.products set description_hidden = true where id = 92101$s$) in ('0', '42501'),
    'a guest can''t change it';
end $$;
select test_reset();

-- A customer reads it and can't change it.
select test_login('00000000-0000-4000-8000-0000000021b1');
do $$ begin
  assert (select description_hidden = false from public.products where id = 92101), 'a customer reads description_hidden';
  assert pg_temp.p21_rows($s$update public.products set description_hidden = true where id = 92101$s$) in ('0', '42501'),
    'a customer''s update changes no row';
end $$;
select test_reset();

do $$ begin
  assert (select description_hidden = false from public.products where id = 92101), 'still shown after the customer''s try';
end $$;

-- An approved admin hides it and shows it again; the text stays.
select test_login('00000000-0000-4000-8000-0000000021a1');
do $$ begin
  assert public.is_admin(), 'p21 admin is an admin';
  assert pg_temp.p21_rows($s$update public.products set description_hidden = true where id = 92101$s$) = '1', 'an admin hides the description';
  assert (select description_hidden and description = 'P21 wrong text' from public.products where id = 92101), 'the text is kept';
  assert pg_temp.p21_state($s$update public.products set description_hidden = null where id = 92101$s$) = '23502', 'it is never null';
end $$;
select test_reset();

select test_anon();
do $$ begin
  assert (select description_hidden from public.products where id = 92101), 'a guest reads it hidden';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000021a1');
do $$ begin
  assert pg_temp.p21_rows($s$update public.products set description_hidden = false where id = 92101$s$) = '1', 'and shows it again';
end $$;
select test_reset();

-- Leave the shared database as later test files expect it.
delete from public.products where id = 92101;
delete from auth.users where id::text like '00000000-0000-4000-8000-0000000021%';
delete from public.profiles where id::text like '00000000-0000-4000-8000-0000000021%';
