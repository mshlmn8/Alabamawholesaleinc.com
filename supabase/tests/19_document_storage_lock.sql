-- Licence proof is locked once stored (20261012100000_document_storage_lock,
-- AW-197, AW-347): no account can UPDATE an application-documents object,
-- whatever its status, so the file staff approved can't be swapped under the
-- same name; an owner still adds new files to their own folder (renewals,
-- AW-254), an upload with upsert on to a new path still works (frontends
-- built before this), admins still read every file, and the bucket takes
-- PDF, JPEG and PNG only. 08 covers the layout, the upload cap and deleting.
--
-- Users ...0019a1 pending, ...0019b1 approved, ...0019c1 suspended (each with
-- a licence on file), ...0019d1 approved admin. Everything this file adds is
-- removed at the end.
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000019a1', 'p19-pending@example.test', '{"name": "P19 Pending"}', now()),
  ('00000000-0000-4000-8000-0000000019b1', 'p19-approved@example.test', '{"name": "P19 Approved"}', now()),
  ('00000000-0000-4000-8000-0000000019c1', 'p19-suspended@example.test', '{"name": "P19 Suspended"}', now()),
  ('00000000-0000-4000-8000-0000000019d1', 'p19-admin@example.test', '{"name": "P19 Admin"}', now());
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000019b1';
update public.profiles set status = 'suspended' where id = '00000000-0000-4000-8000-0000000019c1';
update public.profiles set role = 'admin', status = 'approved' where id = '00000000-0000-4000-8000-0000000019d1';

-- Real Supabase has a unique index on (bucket_id, name), which an upload
-- with upsert on (INSERT ... ON CONFLICT DO UPDATE) needs. The stub doesn't;
-- this file adds one and drops it at the end.
create unique index if not exists p19_objects_bucket_name on storage.objects (bucket_id, name);

-- The licence each account sent before it was approved (or suspended).
insert into storage.objects (bucket_id, name, metadata)
select 'application-documents', id::text || '/tobacco_license/1-license.pdf', '{"p19": "original"}'::jsonb
from public.profiles where id::text like '00000000-0000-4000-8000-0000000019_1' and role = 'customer';
insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
select id, 'tobacco_license', id::text || '/tobacco_license/1-license.pdf', 'license.pdf'
from public.profiles where id::text like '00000000-0000-4000-8000-0000000019_1' and role = 'customer';

-- The SQLSTATE a statement fails with; null when it succeeds. (pg_temp lives
-- for the whole run: the p19_ prefix keeps it apart from other files'
-- helpers.)
create or replace function pg_temp.p19_state(statement text) returns text language plpgsql as $$
declare c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics c = returned_sqlstate;
  return c;
end $$;

-- How many rows an UPDATE changed (0 when no policy lets the caller see it).
create or replace function pg_temp.p19_updated(statement text) returns integer language plpgsql as $$
declare n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end $$;

-- What 20261012100000 changes.
do $$ begin
  assert (select allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
          from storage.buckets where id = 'application-documents'),
    'the bucket takes PDF, JPEG and PNG only (no HEIC or HEIF)';
  assert (select file_size_limit = 10485760 and not public from storage.buckets where id = 'application-documents'),
    'the bucket stays private with its 10 MB limit';
  assert not exists (select 1 from pg_policies
                     where schemaname = 'storage' and tablename = 'objects'
                       and policyname = 'application_documents_owner_update'),
    'the owner UPDATE policy is gone';
  assert not exists (select 1 from pg_policies
                     where schemaname = 'storage' and tablename = 'objects' and cmd in ('UPDATE', 'ALL')
                       and (coalesce(qual, '') || coalesce(with_check, '')) like '%application-documents%'),
    'no other policy lets anyone update an application-documents object';
  assert exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects'
                   and policyname in ('application_documents_owner_insert', 'application_documents_read', 'application_documents_owner_delete')
                 having count(*) = 3),
    'the insert, read and delete policies stay';
end $$;

-- No owner can change their stored licence in place, at any status: not its
-- contents (metadata stands in for them here), not its name, not through an
-- upload with upsert on to the same path.
do $$
declare
  v_uid text;
begin
  foreach v_uid in array array['00000000-0000-4000-8000-0000000019a1',
                               '00000000-0000-4000-8000-0000000019b1',
                               '00000000-0000-4000-8000-0000000019c1'] loop
    perform test_login(v_uid::uuid);
    assert (select count(*) from storage.objects where name = v_uid || '/tobacco_license/1-license.pdf') = 1,
      'the owner still reads their licence';
    assert pg_temp.p19_updated(format(
      $q$update storage.objects set metadata = '{"p19": "swapped"}' where bucket_id = 'application-documents' and name = %L$q$,
      v_uid || '/tobacco_license/1-license.pdf')) = 0,
      format('%s replaced their stored licence', v_uid);
    assert pg_temp.p19_updated(format(
      $q$update storage.objects set name = %L where bucket_id = 'application-documents' and name = %L$q$,
      v_uid || '/tobacco_license/2-other.pdf', v_uid || '/tobacco_license/1-license.pdf')) = 0,
      format('%s renamed their stored licence', v_uid);
    assert pg_temp.p19_state(format(
      $q$insert into storage.objects (bucket_id, name, metadata) values ('application-documents', %L, '{"p19": "swapped"}')
         on conflict (bucket_id, name) do update set metadata = excluded.metadata$q$,
      v_uid || '/tobacco_license/1-license.pdf')) = '42501',
      format('%s overwrote their stored licence with an upsert', v_uid);
    perform test_reset();
  end loop;
end $$;

do $$ begin
  assert (select count(*) = 3 and bool_and(metadata->>'p19' = 'original')
          from storage.objects where name like '00000000-0000-4000-8000-0000000019_1/tobacco_license/1-license.pdf'),
    'every stored licence is unchanged';
end $$;

-- Every owner still adds a new file to their own folder (a renewal after
-- approval, AW-254) and points their row at it; the row's trigger keeps the
-- previous path. An upload with upsert on to a new path, as frontends built
-- before 20261012100000 send it, still works.
do $$
declare
  v_uid text;
begin
  foreach v_uid in array array['00000000-0000-4000-8000-0000000019a1',
                               '00000000-0000-4000-8000-0000000019b1',
                               '00000000-0000-4000-8000-0000000019c1'] loop
    perform test_login(v_uid::uuid);
    insert into storage.objects (bucket_id, name) values ('application-documents', v_uid || '/tobacco_license/2-renewal.pdf');
    insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
    values (v_uid::uuid, 'tobacco_license', v_uid || '/tobacco_license/2-renewal.pdf', 'renewal.pdf')
    on conflict (profile_id, document_type) do update
      set storage_path = excluded.storage_path, original_filename = excluded.original_filename;
    assert pg_temp.p19_state(format(
      $q$insert into storage.objects (bucket_id, name) values ('application-documents', %L)
         on conflict (bucket_id, name) do update set metadata = excluded.metadata$q$,
      v_uid || '/resale_certificate/3-resale.pdf')) is null,
      format('%s could not upload a new file with upsert on', v_uid);
    assert pg_temp.p19_state(format(
      $q$insert into storage.objects (bucket_id, name) values ('application-documents', %L)$q$,
      '00000000-0000-4000-8000-0000000019d1/tobacco_license/4-not-mine.pdf')) = '42501',
      format('%s uploaded into another account''s folder', v_uid);
    perform test_reset();
  end loop;
end $$;

do $$ begin
  assert (select count(*) from public.profile_documents
          where profile_id::text like '00000000-0000-4000-8000-0000000019_1'
            and storage_path like '%/tobacco_license/2-renewal.pdf') = 3,
    'every account filed its renewal';
  assert (select count(*) from public.profile_document_history
          where profile_id::text like '00000000-0000-4000-8000-0000000019_1'
            and storage_path like '%/tobacco_license/1-license.pdf') = 3,
    'the approved-time licence stays in the history';
  assert (select count(*) from storage.objects where name like '00000000-0000-4000-8000-0000000019_1/%') = 9,
    'and every file stays in the bucket';
end $$;

-- An approved admin still reads every account's files and rows, and can't
-- change a file either.
select test_login('00000000-0000-4000-8000-0000000019d1');
do $$ begin
  assert public.is_admin(), 'p19 admin is an admin';
  assert (select count(*) from storage.objects
          where bucket_id = 'application-documents' and name like '00000000-0000-4000-8000-0000000019_1/%') = 9,
    'an admin reads every application document';
  assert (select count(*) from public.profile_documents where profile_id::text like '00000000-0000-4000-8000-0000000019_1') = 3,
    'and every document row';
  assert pg_temp.p19_updated(
    $q$update storage.objects set metadata = '{"p19": "admin"}' where bucket_id = 'application-documents'
       and name like '00000000-0000-4000-8000-0000000019_1/%'$q$) = 0,
    'an admin cannot change an application document';
end $$;
select test_reset();

-- Leave the shared database as later test files expect it.
delete from public.profile_documents where profile_id::text like '00000000-0000-4000-8000-0000000019%';
delete from public.profile_document_history where profile_id::text like '00000000-0000-4000-8000-0000000019%';
delete from storage.objects where name like '00000000-0000-4000-8000-0000000019%';
drop index if exists storage.p19_objects_bucket_name;
