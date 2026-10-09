-- The home page's hero photos (20261011131000_home_slides.sql, AW-119):
-- today's four photos are in the table; guests and signed-in accounts read
-- only the active rows and write nothing; an approved admin reads every row
-- and adds, changes, reorders and deletes them, with an id from the identity
-- column and no sequence privilege; a photo is a bundled hero file or a
-- product-images Storage address, nothing else. Test accounts ...0016a1
-- (approved admin), ...0016b1 (approved customer), ...0016c1 (pending
-- admin). Everything this file adds or changes is put back at the end.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000016a1', 'hs16-admin@example.com', '{"name": "Hs16 Admin"}'),
  ('00000000-0000-4000-8000-0000000016b1', 'hs16-buyer@example.com', '{"name": "Hs16 Buyer"}'),
  ('00000000-0000-4000-8000-0000000016c1', 'hs16-pending@example.com', '{"name": "Hs16 Pending"}');
update public.profiles set status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000016a1';
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000016b1';
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000016c1';

-- The SQLSTATE a statement fails with; null when it succeeds. (pg_temp lives
-- for the whole run: the hs16_ prefix keeps it apart from other files'
-- helpers.)
create or replace function pg_temp.hs16_state(statement text) returns text language plpgsql as $$
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
create or replace function pg_temp.hs16_rows(statement text) returns integer language plpgsql as $$
declare n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Today's photos, in today's order.
-- ---------------------------------------------------------------------------
do $$ begin
  assert (select array_agg(img order by sort, id) from public.home_slides)
    = array['hero_candy.jpg', 'hero_vape.jpg', 'hero_lighters.jpg', 'hero_gatorade.jpg'],
    'the four hero photos are in the table, in today''s order';
  assert (select array_agg(sort order by sort, id) from public.home_slides) = array[10, 20, 30, 40], 'sorted 10 to 40';
  assert (select array_agg(go_cat order by sort, id) from public.home_slides)
    = array['CANDIES', 'NOVELTIES', 'MERCHANDISE', 'DRINKS & BAGS'], 'each links to its department';
  assert (select array_agg(img order by img) from public.home_slides where nicotine_warning) = array['hero_vape.jpg'],
    'only the vape photo carries the FDA warning';
  assert (select bool_and(active) and bool_and(alt <> '') from public.home_slides), 'all four are shown, each with its alt text';
  assert (select alt from public.home_slides where img = 'hero_lighters.jpg') = 'BIC lighters in a counter display tray', 'with today''s alt text';
end $$;

-- The insert runs only on an empty table: running it again adds nothing.
insert into public.home_slides (img, alt, go_cat, nicotine_warning, sort)
select v.img, v.alt, v.go_cat, v.nicotine_warning, v.sort
from (values ('hero_candy.jpg', 'Display box of Turtles Bites chocolates', 'CANDIES', false, 10)) as v (img, alt, go_cat, nicotine_warning, sort)
where not exists (select 1 from public.home_slides);
do $$ begin
  assert (select count(*) from public.home_slides) = 4, 'a second run adds nothing';
end $$;

-- One photo turned off, for the read checks below.
update public.home_slides set active = false where img = 'hero_gatorade.jpg';

-- ---------------------------------------------------------------------------
-- Guests: the active rows only, and no writes.
-- ---------------------------------------------------------------------------
select test_anon();
do $$ begin
  assert (select count(*) from public.home_slides) = 3, 'a guest reads the three active rows';
  assert not exists (select 1 from public.home_slides where not active), 'and never an inactive one';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt) values ('hero_candy.jpg', 'x')$s$) = '42501',
    'a guest can''t add a photo';
  assert pg_temp.hs16_state($s$update public.home_slides set alt = 'x'$s$) = '42501', 'nor change one';
  assert pg_temp.hs16_state($s$delete from public.home_slides$s$) = '42501', 'nor delete one';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- A customer and a pending admin: the same.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000016b1');
do $$ begin
  assert (select count(*) from public.home_slides) = 3, 'a customer reads the three active rows';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt) values ('hero_candy.jpg', 'x')$s$) = '42501',
    'a customer can''t add a photo';
  assert pg_temp.hs16_rows($s$update public.home_slides set alt = 'x', active = true$s$) = 0, 'nor change one';
  assert pg_temp.hs16_rows($s$delete from public.home_slides$s$) = 0, 'nor delete one';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000016c1');
do $$ begin
  assert (select count(*) from public.home_slides) = 3, 'a pending admin reads only the active rows';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt) values ('hero_candy.jpg', 'x')$s$) = '42501',
    'a pending admin can''t add a photo';
  assert pg_temp.hs16_rows($s$update public.home_slides set sort = 0$s$) = 0, 'nor change one';
  assert pg_temp.hs16_rows($s$delete from public.home_slides$s$) = 0, 'nor delete one';
end $$;
select test_reset();

do $$ begin
  assert (select count(*) from public.home_slides) = 4, 'every row is still there';
  assert not exists (select 1 from public.home_slides where alt = 'x' or sort = 0), 'unchanged';
  assert (select not active from public.home_slides where img = 'hero_gatorade.jpg'), 'and the inactive one is still off';
  assert not has_sequence_privilege('anon', 'public.home_slides_id_seq', 'usage'), 'guests have no use of the id sequence';
  assert not has_sequence_privilege('authenticated', 'public.home_slides_id_seq', 'usage'), 'nor do signed-in accounts';
  assert not has_table_privilege('anon', 'public.home_slides', 'insert'), 'guests have no insert privilege at all';
end $$;

-- ---------------------------------------------------------------------------
-- An approved admin: every row, and every change.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000016a1');
do $$
declare new_id bigint;
begin
  assert (select count(*) from public.home_slides) = 4, 'an admin reads every row, the inactive one too';

  -- Added without an id: the identity column needs no sequence privilege.
  insert into public.home_slides (img, alt, go_cat, sort)
  values ('https://abcdefgh.supabase.co/storage/v1/object/public/product-images/home/1760000000000-new-display.jpg', 'Hs16 new display', 'CANDIES', 50)
  returning id into new_id;
  assert new_id is not null, 'a new photo takes the next id';
  assert (select active and not nicotine_warning and updated_by = '00000000-0000-4000-8000-0000000016a1'::uuid
          from public.home_slides where id = new_id), 'it starts shown, without the warning, stamped with its admin';
  perform set_config('test.hs16_new', new_id::text, false);

  -- Changed. (The whole file is one transaction, so now() doesn't move:
  -- the trigger shows by overriding the stale updated_at written here.)
  update public.home_slides set alt = 'Hs16 new display, changed', go_cat = null, nicotine_warning = true,
    updated_at = '2000-01-01', updated_by = '00000000-0000-4000-8000-0000000016b1'
  where id = new_id;
  assert (select alt = 'Hs16 new display, changed' and go_cat is null and nicotine_warning from public.home_slides where id = new_id),
    'an admin changes the alt text, the link and the warning';
  assert (select updated_at = now() and updated_by = '00000000-0000-4000-8000-0000000016a1'::uuid from public.home_slides where id = new_id),
    'updated_at and updated_by follow the change, whatever the update says';

  -- Reordered: two rows swap their sort.
  update public.home_slides set sort = case img when 'hero_candy.jpg' then 20 else 10 end where img in ('hero_candy.jpg', 'hero_vape.jpg');
  assert (select array_agg(img order by sort, id) from public.home_slides where active)
    = array['hero_vape.jpg', 'hero_candy.jpg', 'hero_lighters.jpg', 'https://abcdefgh.supabase.co/storage/v1/object/public/product-images/home/1760000000000-new-display.jpg'],
    'an admin reorders the photos';

  -- Turned off and on.
  update public.home_slides set active = true where img = 'hero_gatorade.jpg';
  update public.home_slides set active = false where id = new_id;
  assert (select count(*) from public.home_slides where active) = 4, 'an admin turns photos on and off';
end $$;

-- What a photo may be.
do $$ begin
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt) values ('https://example.com/photo.jpg', 'x')$s$) = '23514',
    'a photo on another site is refused (the CSP would block it)';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt) values ('https://abc.supabase.co/storage/v1/object/public/application-documents/a.jpg', 'x')$s$) = '23514',
    'so is another bucket';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt) values ('http://abc.supabase.co/storage/v1/object/public/product-images/a.jpg', 'x')$s$) = '23514',
    'and an address without https';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt) values ('kite.jpg', 'x')$s$) = '23514',
    'a bundled file that isn''t a hero photo is refused';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt) values ('../hero_candy.jpg', 'x')$s$) = '23514',
    'and so is a path';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt) values ('hero_candy.gif', 'x')$s$) = '23514',
    'and another file type';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt) values ('hero_candy.jpg', '')$s$) = '23514', 'the alt text is required';
  assert pg_temp.hs16_state(format('insert into public.home_slides (img, alt) values (%L, %L)', 'hero_candy.jpg', repeat('a', 201))) = '23514',
    'and at most 200 characters';
  assert pg_temp.hs16_state(format('insert into public.home_slides (img, alt, go_cat) values (%L, %L, %L)', 'hero_candy.jpg', 'x', repeat('A', 61))) = '23514',
    'a department key is at most 60 characters';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt, sort) values ('hero_candy.jpg', 'x', 1000)$s$) = '23514', 'sort ends at 999';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img, alt, sort) values ('hero_candy.jpg', 'x', -1)$s$) = '23514', 'and starts at 0';
  assert pg_temp.hs16_state($s$insert into public.home_slides (img) values ('hero_candy.jpg')$s$) = '23502', 'alt can''t be left out';

  -- Accepted: a bundled hero file (any of the three types) and a Storage address.
  insert into public.home_slides (img, alt, sort) values ('hero_new_display.webp', 'Hs16 bundled', 999);
  insert into public.home_slides (img, alt, sort) values ('https://xyz-123.supabase.co/storage/v1/object/public/product-images/home/1-a.png', 'Hs16 upload', 0);
  assert (select count(*) from public.home_slides where alt in ('Hs16 bundled', 'Hs16 upload')) = 2, 'both are accepted';
end $$;

-- Deleted.
do $$ begin
  delete from public.home_slides where alt in ('Hs16 bundled', 'Hs16 upload') or id = current_setting('test.hs16_new')::bigint;
  assert not exists (select 1 from public.home_slides where alt like 'Hs16%'), 'an admin deletes photos';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- Leave the shared database as later test files expect it.
-- ---------------------------------------------------------------------------
update public.home_slides set sort = case img when 'hero_candy.jpg' then 10 else 20 end where img in ('hero_candy.jpg', 'hero_vape.jpg');
update public.home_slides set active = true where img = 'hero_gatorade.jpg';
do $$ begin
  assert (select array_agg(img order by sort, id) from public.home_slides where active)
    = array['hero_candy.jpg', 'hero_vape.jpg', 'hero_lighters.jpg', 'hero_gatorade.jpg'], 'back as it was';
end $$;
