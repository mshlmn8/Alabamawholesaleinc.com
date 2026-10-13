-- Role changes in the account history (20261011111000_profile_role_audit.sql,
-- AW-203): log_profile_status() writes a profile_status_log row when the
-- role changes, with old_role and new_role, and leaves them null for a
-- status-only change. An admin still can't change their own role (hint
-- own_role_status), and only admins read the log.
-- Lane c-support test file. Accounts ...0000c5170a01 (admin A),
-- ...0000c5170b01 (customer B) and ...0000c5170c01 (pending applicant C) are
-- made here and removed at the end. Helpers carry the sup17_ prefix
-- (pg_temp lives for the whole run).

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000c5170a01', 'sup17-admin@example.com', '{"name": "Sup17 Admin"}'),
  ('00000000-0000-4000-8000-0000c5170b01', 'sup17-buyer@example.com', '{"name": "Sup17 Buyer"}'),
  ('00000000-0000-4000-8000-0000c5170c01', 'sup17-applicant@example.com', '{"name": "Sup17 Applicant"}');
update public.profiles set role = 'admin', status = 'approved' where id = '00000000-0000-4000-8000-0000c5170a01';
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000c5170b01';

-- What a statement fails with: its message, hint and SQLSTATE (null when it
-- succeeds).
create or replace function pg_temp.sup17_refusal(statement text) returns jsonb language plpgsql as $$
declare m text; h text; c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics m = message_text, h = pg_exception_hint, c = returned_sqlstate;
  return jsonb_build_object('message', m, 'hint', h, 'state', c);
end $$;

-- The log rows A wrote about an account, oldest first.
create or replace function pg_temp.sup17_log(who uuid) returns setof public.profile_status_log language sql as $$
  select * from public.profile_status_log
   where profile_id = who and changed_by = '00000000-0000-4000-8000-0000c5170a01'
   order by id;
$$;

select test_login('00000000-0000-4000-8000-0000c5170a01');
do $$
declare
  r public.profile_status_log;
  refusal jsonb;
begin
  -- A makes customer B an admin: one row, customer -> admin, by A.
  update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000c5170b01';
  assert (select count(*) from pg_temp.sup17_log('00000000-0000-4000-8000-0000c5170b01')) = 1, 'a promotion writes one row';
  select * into r from pg_temp.sup17_log('00000000-0000-4000-8000-0000c5170b01');
  assert r.old_role = 'customer' and r.new_role = 'admin', format('the row names both roles: %s', to_jsonb(r));
  assert r.old_status = 'approved' and r.new_status = 'approved', format('and the unchanged status: %s', to_jsonb(r));
  assert r.changed_at is not null, 'and when';

  -- A status-only change: the role columns stay null.
  update public.profiles set status = 'suspended' where id = '00000000-0000-4000-8000-0000c5170b01';
  select * into r from pg_temp.sup17_log('00000000-0000-4000-8000-0000c5170b01') order by id desc limit 1;
  assert r.old_status = 'approved' and r.new_status = 'suspended', format('a status change: %s', to_jsonb(r));
  assert r.old_role is null and r.new_role is null, format('without role columns: %s', to_jsonb(r));

  -- Status and role at once (admin access removed, approved again): one row.
  update public.profiles set role = 'customer', status = 'approved' where id = '00000000-0000-4000-8000-0000c5170b01';
  assert (select count(*) from pg_temp.sup17_log('00000000-0000-4000-8000-0000c5170b01')) = 3, 'one row per change';
  select * into r from pg_temp.sup17_log('00000000-0000-4000-8000-0000c5170b01') order by id desc limit 1;
  assert r.old_role = 'admin' and r.new_role = 'customer' and r.old_status = 'suspended' and r.new_status = 'approved',
    format('both changes in one row: %s', to_jsonb(r));

  -- A pending applicant made an admin (the admin screens approve it too).
  update public.profiles set role = 'admin', status = 'approved' where id = '00000000-0000-4000-8000-0000c5170c01';
  select * into r from pg_temp.sup17_log('00000000-0000-4000-8000-0000c5170c01');
  assert r.old_status = 'pending' and r.new_status = 'approved' and r.old_role = 'customer' and r.new_role = 'admin',
    format('pending to approved admin: %s', to_jsonb(r));

  -- Another column alone writes nothing.
  update public.profiles set pricing_tier = 'standard', verification_note = 'Sup17 checked' where id = '00000000-0000-4000-8000-0000c5170b01';
  assert (select count(*) from pg_temp.sup17_log('00000000-0000-4000-8000-0000c5170b01')) = 3, 'a tier or note change is not logged';

  -- A can't change their own role (20261009140000's guard, kept), and the
  -- refused change logs nothing.
  refusal := pg_temp.sup17_refusal($s$update public.profiles set role = 'customer' where id = '00000000-0000-4000-8000-0000c5170a01'$s$);
  assert refusal ->> 'hint' = 'own_role_status' and refusal ->> 'state' = '42501', format('own role refused: %s', refusal);
  refusal := pg_temp.sup17_refusal($s$update public.profiles set status = 'suspended' where id = '00000000-0000-4000-8000-0000c5170a01'$s$);
  assert refusal ->> 'hint' = 'own_role_status', format('own status refused: %s', refusal);
  assert (select role from public.profiles where id = '00000000-0000-4000-8000-0000c5170a01') = 'admin', 'A is still an admin';
  assert (select count(*) from pg_temp.sup17_log('00000000-0000-4000-8000-0000c5170a01')) = 0, 'a refused change logs nothing';

  -- Admins read the log.
  assert (select count(*) from public.profile_status_log where profile_id = '00000000-0000-4000-8000-0000c5170b01') >= 3, 'admins read the log';
end $$;
select test_reset();

-- B, a customer again, can't read the log, not even about themselves, and
-- can't write it.
select test_login('00000000-0000-4000-8000-0000c5170b01');
do $$
declare refusal jsonb;
begin
  assert (select count(*) from public.profile_status_log) = 0, 'a customer reads no log rows';
  refusal := pg_temp.sup17_refusal($s$insert into public.profile_status_log (profile_id, old_role, new_role) values ('00000000-0000-4000-8000-0000c5170b01', 'customer', 'admin')$s$);
  assert refusal ->> 'state' = '42501', format('a customer cannot write the log: %s', refusal);
  -- A customer's own update of their role is ignored (the guard keeps it), so nothing is logged.
  update public.profiles set role = 'admin', name = 'Sup17 Buyer Renamed' where id = '00000000-0000-4000-8000-0000c5170b01';
end $$;
select test_reset();

do $$ begin
  assert (select role = 'customer' and name = 'Sup17 Buyer Renamed' from public.profiles where id = '00000000-0000-4000-8000-0000c5170b01'),
    'the customer kept their role and changed their name';
  assert (select count(*) from public.profile_status_log where profile_id = '00000000-0000-4000-8000-0000c5170b01'
            and changed_by = '00000000-0000-4000-8000-0000c5170b01') = 0, 'and nothing was logged for it';
  -- Still a trigger function nobody calls through the API.
  assert not has_function_privilege('anon', 'public.log_profile_status()', 'execute'), 'anon cannot execute log_profile_status';
  assert not has_function_privilege('authenticated', 'public.log_profile_status()', 'execute'), 'authenticated cannot execute it';
  assert (select prosecdef from pg_proc where oid = 'public.log_profile_status()'::regprocedure), 'still security definer';
  assert (select proconfig @> array['search_path=public'] from pg_proc where oid = 'public.log_profile_status()'::regprocedure),
    'with search_path = public';
  assert exists (select 1 from pg_trigger where tgname = 'profile_status_log_write' and tgrelid = 'public.profiles'::regclass),
    'the profile_status_log_write trigger is still there';
end $$;

-- Leave the shared database as later test files expect it.
delete from auth.users where id in (
  '00000000-0000-4000-8000-0000c5170a01', '00000000-0000-4000-8000-0000c5170b01', '00000000-0000-4000-8000-0000c5170c01');
delete from public.profiles where id in (
  '00000000-0000-4000-8000-0000c5170a01', '00000000-0000-4000-8000-0000c5170b01', '00000000-0000-4000-8000-0000c5170c01');
