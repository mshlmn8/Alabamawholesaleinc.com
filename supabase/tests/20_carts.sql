-- Saved carts (20261012110000_carts.sql, AW-334): each signed-in account
-- reads, adds, changes and deletes its own cart row only; another account's
-- row is invisible and can't be written; guests have no access; an admin
-- sees no one's cart; a row holds [line key, quantity] pairs only (at most
-- 500, quantities 1 to 100,000, never a price); the row goes with the
-- account.
--
-- Users ...0020a1 approved buyer, ...0020b1 pending buyer, ...0020c1
-- approved admin, ...0020d1 an account that is deleted. Everything this file
-- adds is removed at the end.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000020a1', 'p20-buyer@example.test', '{"name": "P20 Buyer"}'),
  ('00000000-0000-4000-8000-0000000020b1', 'p20-pending@example.test', '{"name": "P20 Pending"}'),
  ('00000000-0000-4000-8000-0000000020c1', 'p20-admin@example.test', '{"name": "P20 Admin"}'),
  ('00000000-0000-4000-8000-0000000020d1', 'p20-gone@example.test', '{"name": "P20 Gone"}');
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000020a1';
update public.profiles set status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000020c1';

-- The SQLSTATE a statement fails with; null when it succeeds. (pg_temp lives
-- for the whole run: the p20_ prefix keeps it apart from other files'
-- helpers.)
create or replace function pg_temp.p20_state(statement text) returns text language plpgsql as $$
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
create or replace function pg_temp.p20_rows(statement text) returns integer language plpgsql as $$
declare n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end $$;

do $$ begin
  assert to_regclass('public.carts') is not null, 'the carts table exists';
  assert (select relrowsecurity from pg_class where oid = 'public.carts'::regclass), 'with row-level security on';
  assert not has_table_privilege('anon', 'public.carts', 'select'), 'guests have no select privilege';
  assert not has_table_privilege('anon', 'public.carts', 'insert'), 'nor insert';
  assert not has_table_privilege('authenticated', 'public.carts', 'truncate'), 'signed-in accounts can''t truncate';
  assert has_table_privilege('authenticated', 'public.carts', 'select, insert, update, delete'), 'but can read and write (their own rows, by policy)';
  assert not has_function_privilege('anon', 'public.cart_lines_valid(jsonb)', 'execute'), 'guests can''t run the check function';
end $$;

-- ---------------------------------------------------------------------------
-- The buyer: their own row, every change.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000020a1');
do $$ begin
  insert into public.carts (user_id, lines) values ('00000000-0000-4000-8000-0000000020a1', '[["174", 1], ["14", 2], ["1::white-grape", 3]]');
  assert (select count(*) from public.carts) = 1, 'the buyer reads their own row';
  assert (select lines from public.carts) = '[["174", 1], ["14", 2], ["1::white-grape", 3]]'::jsonb, 'with the lines in the order they were added';
  assert pg_temp.p20_rows($s$update public.carts set lines = '[["14", 5]]', updated_at = '2026-10-12T10:00:00Z'$s$) = 1, 'and changes it';
  -- What the site sends: an upsert on user_id.
  insert into public.carts (user_id, lines, updated_at)
  values ('00000000-0000-4000-8000-0000000020a1', '[["45", 1], ["14", 5]]', '2026-10-12T10:00:05Z')
  on conflict (user_id) do update set lines = excluded.lines, updated_at = excluded.updated_at;
  assert (select lines from public.carts) = '[["45", 1], ["14", 5]]'::jsonb, 'an upsert replaces the lines';
  assert (select updated_at from public.carts) = '2026-10-12T10:00:05Z'::timestamptz, 'and the time';
  assert pg_temp.p20_rows($s$delete from public.carts$s$) = 1, 'and deletes it';
  assert not exists (select 1 from public.carts), 'gone';
  insert into public.carts (user_id, lines) values ('00000000-0000-4000-8000-0000000020a1', '[["14", 1]]');
  assert (select updated_at from public.carts) is not null, 'updated_at defaults to now';
end $$;
select test_reset();

-- The pending account saves a cart too.
select test_login('00000000-0000-4000-8000-0000000020b1');
do $$ begin
  insert into public.carts (user_id, lines) values ('00000000-0000-4000-8000-0000000020b1', '[["45", 2]]');
  assert (select count(*) from public.carts) = 1, 'the pending account sees only its own row';
  assert (select lines from public.carts) = '[["45", 2]]'::jsonb, 'its own lines';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- Another account's row: invisible and unwritable.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000020a1');
do $$ begin
  assert (select count(*) from public.carts) = 1, 'the buyer still sees one row';
  assert not exists (select 1 from public.carts where user_id = '00000000-0000-4000-8000-0000000020b1'), 'never the pending account''s';
  assert pg_temp.p20_rows($s$update public.carts set lines = '[["14", 9]]' where user_id = '00000000-0000-4000-8000-0000000020b1'$s$) = 0,
    'can''t change it';
  assert pg_temp.p20_rows($s$delete from public.carts where user_id = '00000000-0000-4000-8000-0000000020b1'$s$) = 0, 'nor delete it';
  assert pg_temp.p20_state($s$insert into public.carts (user_id, lines) values ('00000000-0000-4000-8000-0000000020b1', '[["14", 9]]')
    on conflict (user_id) do update set lines = excluded.lines$s$) = '42501', 'nor write over it with an upsert';
  assert pg_temp.p20_state($s$insert into public.carts (user_id, lines) values ('00000000-0000-4000-8000-0000000020c1', '[["14", 9]]')$s$) = '42501',
    'nor add a row for anyone else';
  assert pg_temp.p20_state($s$update public.carts set user_id = '00000000-0000-4000-8000-0000000020c1'$s$) = '42501',
    'nor hand their own row to someone else';
end $$;
select test_reset();

do $$ begin
  assert (select lines from public.carts where user_id = '00000000-0000-4000-8000-0000000020b1') = '[["45", 2]]'::jsonb, 'the pending account''s row is unchanged';
  assert (select count(*) from public.carts where user_id::text like '00000000-0000-4000-8000-0000000020%') = 2, 'two rows, one each';
end $$;

-- An approved admin sees no one's cart and changes none.
select test_login('00000000-0000-4000-8000-0000000020c1');
do $$ begin
  assert public.is_admin(), 'p20 admin is an admin';
  assert not exists (select 1 from public.carts), 'an admin reads no one''s cart';
  assert pg_temp.p20_rows($s$update public.carts set lines = '[]'$s$) = 0, 'nor changes one';
  assert pg_temp.p20_rows($s$delete from public.carts$s$) = 0, 'nor deletes one';
end $$;
select test_reset();

-- Guests: no access at all.
select test_anon();
do $$ begin
  assert pg_temp.p20_state($s$select count(*) from public.carts$s$) = '42501', 'a guest can''t read carts';
  assert pg_temp.p20_state($s$insert into public.carts (user_id, lines) values ('00000000-0000-4000-8000-0000000020a1', '[]')$s$) = '42501',
    'nor add one';
  assert pg_temp.p20_state($s$update public.carts set lines = '[]'$s$) = '42501', 'nor change one';
  assert pg_temp.p20_state($s$delete from public.carts$s$) = '42501', 'nor delete one';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- Line keys and quantities, nothing else.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000020a1');
do $$
declare
  bad text;
begin
  foreach bad in array array[
    '{}',                              -- not a list
    '"14"',
    '{"14": 2}',                       -- the v2 object
    '[["14", 2, 9.99]]',               -- a price beside the quantity
    '[{"key": "14", "qty": 2}]',
    '[["14"]]',
    '[[14, 2]]',                       -- the key as a number
    '[["14", "2"]]',                   -- the quantity as text
    '[["14", 0]]',
    '[["14", -1]]',
    '[["14", 2.5]]',
    '[["14", 100001]]',
    '[["abc", 1]]',
    '[["014", 1]]',
    '[["1::White Grape", 1]]',         -- not a slug
    '[["1::", 1]]',
    '[["14", null]]',
    '[null]'
  ] loop
    assert pg_temp.p20_state(format('update public.carts set lines = %L::jsonb', bad)) = '23514', format('refused: %s', bad);
  end loop;
  assert pg_temp.p20_state($s$update public.carts set lines = null$s$) = '23502', 'lines can''t be null';
  assert pg_temp.p20_state(format('update public.carts set lines = %L::jsonb',
    (select jsonb_agg(jsonb_build_array(i::text, 1)) from generate_series(1, 501) as i))) = '23514', 'at most 500 lines';

  -- Accepted: 500 lines, a slug, the most per line, and no lines at all.
  update public.carts set lines = (select jsonb_agg(jsonb_build_array(i::text, 1)) from generate_series(1, 500) as i);
  assert (select jsonb_array_length(lines) from public.carts) = 500, '500 lines fit';
  update public.carts set lines = '[["1::white-grape", 100000], ["356::5-gal", 1], ["14", 1]]';
  assert (select lines -> 0 ->> 0 from public.carts) = '1::white-grape', 'a variant line fits, at the most per line';
  update public.carts set lines = '[]';
  assert (select lines from public.carts) = '[]'::jsonb, 'an emptied cart is no lines';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- The row goes with the account.
-- ---------------------------------------------------------------------------
insert into public.carts (user_id, lines) values ('00000000-0000-4000-8000-0000000020d1', '[["14", 1]]');
delete from auth.users where id = '00000000-0000-4000-8000-0000000020d1';
do $$ begin
  assert not exists (select 1 from public.carts where user_id = '00000000-0000-4000-8000-0000000020d1'), 'deleting the account deletes its cart';
end $$;

-- Leave the shared database as later test files expect it.
delete from public.carts where user_id::text like '00000000-0000-4000-8000-0000000020%';
delete from auth.users where id::text like '00000000-0000-4000-8000-0000000020%';
delete from public.profiles where id::text like '00000000-0000-4000-8000-0000000020%';
