-- Site settings (20261014121000_site_settings.sql, AW-030): one row, every
-- value null (the site's own) until staff save theirs; everyone reads it;
-- approved admin and staff accounts change it, stamped with who and when;
-- nobody deletes it or adds a second row; each value is checked. Test
-- accounts: ...0029a1 approved admin, ...0029b1 approved staff, ...0029b2
-- pending staff, ...0029c1 approved customer. The row is put back to all
-- nulls at the end.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000029a1', 'p29-admin@example.test', '{"name": "P29 Admin"}'),
  ('00000000-0000-4000-8000-0000000029b1', 'p29-staff@example.test', '{"name": "P29 Staff"}'),
  ('00000000-0000-4000-8000-0000000029b2', 'p29-pending-staff@example.test', '{"name": "P29 Pending Staff"}'),
  ('00000000-0000-4000-8000-0000000029c1', 'p29-buyer@example.test', '{"name": "P29 Buyer"}');
update public.profiles set status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000029a1';
update public.profiles set status = 'approved', role = 'staff' where id = '00000000-0000-4000-8000-0000000029b1';
update public.profiles set role = 'staff' where id = '00000000-0000-4000-8000-0000000029b2';
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000029c1';

-- The SQLSTATE a statement fails with; null when it succeeds. (pg_temp lives
-- for the whole run: the p29_ prefix keeps it apart from other files'
-- helpers.)
create or replace function pg_temp.p29_state(statement text) returns text language plpgsql as $$
declare c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics c = returned_sqlstate;
  return c;
end $$;

-- The constraint a statement breaks; null when it succeeds.
create or replace function pg_temp.p29_constraint(statement text) returns text language plpgsql as $$
declare c text;
begin
  execute statement;
  return null;
exception when check_violation then
  get stacked diagnostics c = constraint_name;
  return c;
end $$;

-- How many rows a statement changed (an update or delete that RLS hides
-- changes none, without an error).
create or replace function pg_temp.p29_rows(statement text) returns integer language plpgsql as $$
declare n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- The one row, all the site's own.
-- ---------------------------------------------------------------------------
do $$
declare r public.site_settings;
begin
  assert (select count(*) from public.site_settings) = 1, 'one row';
  select * into r from public.site_settings;
  assert r.id, 'its id is true';
  assert r.announcements is null and r.phone is null and r.email is null and r.hours is null
     and r.street is null and r.city is null and r.state is null and r.zip is null, 'every value is the site''s own';
  assert pg_temp.p29_state($s$insert into public.site_settings (id) values (false)$s$) = '23514', 'there is no second row';
  assert pg_temp.p29_state($s$insert into public.site_settings (id) values (true)$s$) = '23505', 'nor another first one';
end $$;

-- ---------------------------------------------------------------------------
-- Everyone reads it; nobody but staff writes it; nobody deletes it.
-- ---------------------------------------------------------------------------
select test_anon();
do $$ begin
  assert (select count(*) from public.site_settings) = 1, 'a guest reads the row';
  assert pg_temp.p29_state($s$update public.site_settings set phone = '(205) 555-0129'$s$) = '42501', 'but can''t change it';
  assert pg_temp.p29_state($s$delete from public.site_settings$s$) = '42501', 'nor delete it';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000029c1');
do $$ begin
  assert (select count(*) from public.site_settings) = 1, 'a customer reads the row';
  assert pg_temp.p29_rows($s$update public.site_settings set phone = '(205) 555-0129'$s$) = 0, 'but changes nothing';
  assert pg_temp.p29_state($s$delete from public.site_settings$s$) = '42501', 'nor deletes it';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000029b2');
do $$ begin
  assert pg_temp.p29_rows($s$update public.site_settings set phone = '(205) 555-0129'$s$) = 0, 'pending staff change nothing';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000029b1');
do $$ begin
  assert pg_temp.p29_rows($s$update public.site_settings set
      announcements = array['Closed Monday for the holiday', 'For volume pricing, email us or call (205) 555-0129.'],
      phone = '(205) 555-0129', email = 'p29-desk@example.test',
      hours = '[{"days": "Mon–Fri", "time": "6:30 AM – 6:00 PM CT"}, {"days": "Sat", "time": "8:00 AM – 2:00 PM CT"}, {"days": "Sun", "time": "Closed"}]'::jsonb,
      street = '100 P29 Street', city = 'Birmingham', state = 'AL', zip = '35203-1234'
    where id$s$) = 1, 'approved staff change every setting';
  assert pg_temp.p29_state($s$delete from public.site_settings$s$) = '42501', 'but don''t delete the row';
end $$;
select test_reset();

do $$
declare r public.site_settings;
begin
  select * into r from public.site_settings;
  assert r.phone = '(205) 555-0129' and r.email = 'p29-desk@example.test', 'the phone and email are saved';
  assert array_length(r.announcements, 1) = 2 and jsonb_array_length(r.hours) = 3, 'the messages and hours too';
  assert r.updated_by = '00000000-0000-4000-8000-0000000029b1', 'stamped with who saved it';
  assert r.updated_at > now() - interval '1 minute', 'and when';
end $$;

select test_login('00000000-0000-4000-8000-0000000029a1');
do $$ begin
  assert pg_temp.p29_rows($s$update public.site_settings set announcements = null, hours = null where id$s$) = 1,
    'an admin changes them, back to the site''s own too';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- Each value is checked.
-- ---------------------------------------------------------------------------
do $$ begin
  assert pg_temp.p29_constraint($s$update public.site_settings set phone = '205-555-0129'$s$) = 'site_settings_phone_chk',
    'a phone in another shape is refused';
  assert pg_temp.p29_constraint($s$update public.site_settings set phone = '(205) 555-012'$s$) = 'site_settings_phone_chk',
    'and one too short';
  assert pg_temp.p29_constraint($s$update public.site_settings set email = 'desk@example'$s$) = 'site_settings_email_chk',
    'an email without a domain ending';
  assert pg_temp.p29_constraint($s$update public.site_settings set email = 'desk @example.test'$s$) = 'site_settings_email_chk',
    'with a space';
  assert pg_temp.p29_constraint($s$update public.site_settings set announcements = array[]::text[]$s$) = 'site_settings_announcements_chk',
    'no messages at all (null is the site''s own)';
  assert pg_temp.p29_constraint($s$update public.site_settings set announcements = array['One', '  ']$s$) = 'site_settings_announcements_chk',
    'a blank message';
  assert pg_temp.p29_constraint($s$update public.site_settings set announcements = array['1','2','3','4','5','6','7']$s$) = 'site_settings_announcements_chk',
    'seven messages';
  assert pg_temp.p29_constraint(format('update public.site_settings set announcements = array[%L]', repeat('x', 161))) = 'site_settings_announcements_chk',
    'a message over 160 characters';
  assert pg_temp.p29_constraint($s$update public.site_settings set announcements = array[['a', 'b'], ['c', 'd']]$s$) = 'site_settings_announcements_chk',
    'a two-dimensional list';
  assert pg_temp.p29_constraint($s$update public.site_settings set hours = '{"days": "Mon", "time": "9-5"}'::jsonb$s$) = 'site_settings_hours_chk',
    'hours that are not a list';
  assert pg_temp.p29_constraint($s$update public.site_settings set hours = '[]'::jsonb$s$) = 'site_settings_hours_chk', 'no hours rows';
  assert pg_temp.p29_constraint($s$update public.site_settings set hours = '[{"days": "Mon"}]'::jsonb$s$) = 'site_settings_hours_chk', 'a row without times';
  assert pg_temp.p29_constraint($s$update public.site_settings set hours = '[{"days": "Mon", "time": 9}]'::jsonb$s$) = 'site_settings_hours_chk', 'times that aren''t text';
  assert pg_temp.p29_constraint($s$update public.site_settings set hours = '[{"days": "Mon", "time": "9-5", "note": "x"}]'::jsonb$s$) = 'site_settings_hours_chk', 'another key';
  assert pg_temp.p29_constraint($s$update public.site_settings set hours = '[{"days": "a","time": "b"},{"days": "a","time": "b"},{"days": "a","time": "b"},{"days": "a","time": "b"},{"days": "a","time": "b"}]'::jsonb$s$) = 'site_settings_hours_chk',
    'five rows';
  assert pg_temp.p29_constraint($s$update public.site_settings set street = null$s$) = 'site_settings_address_chk', 'part of an address';
  assert pg_temp.p29_constraint($s$update public.site_settings set state = 'Al'$s$) = 'site_settings_address_chk', 'a state that isn''t two capitals';
  assert pg_temp.p29_constraint($s$update public.site_settings set zip = '3520'$s$) = 'site_settings_address_chk', 'a short ZIP';
  assert pg_temp.p29_constraint($s$update public.site_settings set street = ' '$s$) = 'site_settings_address_chk', 'a blank street';
  assert pg_temp.p29_constraint($s$update public.site_settings set street = null, city = null, state = null, zip = null$s$) is null,
    'no address at all is the site''s own';
end $$;

-- Back to the site's own.
update public.site_settings set announcements = null, phone = null, email = null, hours = null,
  street = null, city = null, state = null, zip = null;
