-- Profile and document boundaries on top of Cursor's 20261008191000–195000
-- (20261009140000): admin rights only for approved admins (AW-352), what a
-- signed-in account may change on its profile (AW-196), admins can't edit
-- their own role or status or the consent and approval records, the email
-- sync, the metadata backfill for older accounts (AW-348), admin-only
-- internal notes (AW-197), and the license proof layout and upload cap
-- (AW-207) with renewals after approval (AW-254). 10 and 11 cover Cursor's
-- signup copy, approval stamp, status log and document history.
--
-- Users 0008a1..0008f1 and 0008a2, and emails p8-*, are this file's own.
--   a1 pending applicant (signs up with store address and consent)
--   b1 approved customer with a license on file
--   c1 approved admin
--   d1 suspended admin
--   e1 pending, approved by c1 below
--   f1 signup that did not accept the terms
--   a2 an older account whose answers are still in its auth metadata
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000008a1', 'p8-a@example.test',
   '{"name": "P8 Buyer A", "business": "P8 Store A", "phone": "205-555-0801", "license_no": "TL-P8-A",
     "ein": "12-3456781", "resale_cert_no": "RS-P8-A", "business_type": "Smoke Shop", "state": "AL",
     "expected_volume": "$5K — $15K", "store_street": "1 Test Way", "store_city": "Testville",
     "store_zip": "35203", "terms_version": "2026-09", "terms_accepted": true, "age_confirmed": true}', now()),
  ('00000000-0000-4000-8000-0000000008b1', 'p8-b@example.test', '{"name": "P8 Buyer B"}', now()),
  ('00000000-0000-4000-8000-0000000008c1', 'p8-admin@example.test', '{"name": "P8 Admin"}', now()),
  ('00000000-0000-4000-8000-0000000008d1', 'p8-held@example.test', '{"name": "P8 Held Admin"}', now()),
  ('00000000-0000-4000-8000-0000000008e1', 'p8-e@example.test', '{"name": "P8 Buyer E"}', now()),
  ('00000000-0000-4000-8000-0000000008f1', 'p8-f@example.test',
   '{"name": "P8 Buyer F", "terms_version": "2026-09", "terms_accepted": false}', now());

-- The SQL editor (no auth.uid()) may change anything.
update public.profiles set role = 'admin', status = 'approved' where id = '00000000-0000-4000-8000-0000000008c1';
update public.profiles set role = 'admin', status = 'suspended' where id = '00000000-0000-4000-8000-0000000008d1';
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000008b1';

do $$ begin
  assert (select store_street = '1 Test Way' and store_city = 'Testville' and store_zip = '35203'
            and terms_version = '2026-09' and terms_accepted_at is not null and age_confirmed_at is not null
            and ein = '12-3456781' and license_no = 'TL-P8-A' and status = 'pending'
          from public.profiles where id = '00000000-0000-4000-8000-0000000008a1'),
    'signup copies the application, the store address and the consent record';
  assert (select terms_accepted_at is null and age_confirmed_at is null
          from public.profiles where id = '00000000-0000-4000-8000-0000000008f1'),
    'no consent is recorded unless the form sent terms_accepted true';
  assert not has_function_privilege('anon', 'public.backfill_profiles_from_metadata()', 'execute')
     and not has_function_privilege('authenticated', 'public.backfill_profiles_from_metadata()', 'execute'),
    'only the SQL editor and the service role run the backfill';
  assert not has_function_privilege('authenticated', 'public.protect_profile_columns()', 'execute'), 'trigger functions are not callable';
end $$;

-- AW-348: an account from before 20261008194000 still has its answers in the
-- auth metadata (signup copied none of the newer ones). The backfill fills
-- what the profile lacks, keeps what it has, and strips the keys.
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, created_at) values
  ('00000000-0000-4000-8000-0000000008a2', 'p8-g@example.test', '{"name": "P8 Older"}', now(), '2026-09-01T12:00:00Z');
update auth.users set raw_user_meta_data = '{"name": "P8 Older", "business": "P8 Old Store", "ein": "12-0000008",
    "license_no": "TL-P8-G", "store_street": " 8 Old Rd ", "store_city": "Oldtown", "store_zip": "35208",
    "terms_accepted": "true", "terms_version": "2026-09", "age_confirmed": "true", "phone": "205-555-0808"}'::jsonb
  where id = '00000000-0000-4000-8000-0000000008a2';
update public.profiles set license_no = 'TL-P8-KEPT' where id = '00000000-0000-4000-8000-0000000008a2';
do $$ begin
  assert public.backfill_profiles_from_metadata() = 1, 'one account had keys to strip';
  assert (select ein = '12-0000008' and license_no = 'TL-P8-KEPT' and phone = '205-555-0808'
            and store_street = '8 Old Rd' and store_city = 'Oldtown' and store_zip = '35208'
            and terms_version = '2026-09' and terms_accepted_at = '2026-09-01T12:00:00Z' and age_confirmed_at is not null
          from public.profiles where id = '00000000-0000-4000-8000-0000000008a2'),
    'empty profile columns are filled from the metadata, the profile''s own values win, consent dates from the signup';
  assert (select raw_user_meta_data = '{"name": "P8 Older", "business": "P8 Old Store"}'::jsonb
          from auth.users where id = '00000000-0000-4000-8000-0000000008a2'), 'only name and business stay in the metadata';
  assert public.backfill_profiles_from_metadata() = 0, 'running it again changes nothing';
end $$;

-- A customer changes only their name, phone and store address. Anything else
-- keeps its value (the update still succeeds, Cursor's semantics).
select test_login('00000000-0000-4000-8000-0000000008a1');
do $$
declare
  v_sql text;
begin
  update public.profiles
  set name = 'P8 Buyer A2', phone = '205-555-0802', store_street = '2 Test Way', store_city = 'Testburg', store_zip = '35204'
  where id = '00000000-0000-4000-8000-0000000008a1';
  assert found, 'a customer updates their name, phone and store address';

  foreach v_sql in array array[
    $q$update public.profiles set email = 'p8-other@example.test' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set license_no = 'TL-P8-FAKE', ein = '98-7654321', resale_cert_no = 'RS-P8-FAKE' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set business = 'P8 Other Store', state = 'GA', business_type = 'Vape Shop', expected_volume = '$100K+' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set terms_version = '1999-01', terms_accepted_at = null, age_confirmed_at = now() - interval '1 year' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set approved_at = now(), approved_by = '00000000-0000-4000-8000-0000000008c1', verification_note = 'looks fine' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set pricing_tier = 'gold', status = 'approved', role = 'admin' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set created_at = now() - interval '1 day' where id = '00000000-0000-4000-8000-0000000008a1'$q$
  ] loop
    execute v_sql;
  end loop;

  assert not public.is_admin(), 'a customer is not an admin';
  assert (select count(*) from public.profile_status_log) = 0, 'a customer reads no status history';
  begin
    insert into public.profile_status_log (profile_id, new_status) values ('00000000-0000-4000-8000-0000000008a1', 'approved');
    raise exception 'a customer wrote a status history row';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.profile_status_log;
    raise exception 'a customer deleted status history';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.profile_admin_notes) = 0, 'a customer reads no admin notes';
  begin
    insert into public.profile_admin_notes (profile_id, body) values ('00000000-0000-4000-8000-0000000008a1', 'self note');
    raise exception 'a customer wrote an admin note';
  exception when insufficient_privilege then null;
  end;
end $$;
select test_reset();

do $$ begin
  assert (select name = 'P8 Buyer A2' and phone = '205-555-0802' and store_street = '2 Test Way' and store_city = 'Testburg' and store_zip = '35204'
            and email = 'p8-a@example.test' and license_no = 'TL-P8-A' and ein = '12-3456781' and resale_cert_no = 'RS-P8-A'
            and business = 'P8 Store A' and state = 'AL' and business_type = 'Smoke Shop' and expected_volume = '$5K — $15K'
            and terms_version = '2026-09' and terms_accepted_at is not null and age_confirmed_at > now() - interval '1 day'
            and approved_at is null and approved_by is null and verification_note is null
            and pricing_tier = 'standard' and status = 'pending' and role = 'customer' and created_at > now() - interval '1 hour'
          from public.profiles where id = '00000000-0000-4000-8000-0000000008a1'),
    'only the name, phone and store address changed';
end $$;

select test_anon();
do $$ begin
  assert not public.is_admin(), 'a guest is not an admin';
  begin
    perform count(*) from public.profile_status_log;
    raise exception 'a guest read the status history';
  exception when insufficient_privilege then null;
  end;
end $$;
select test_reset();

-- A pending applicant's license proof: only at {own id}/{type}/{file}, at
-- most 10 uploads in 24 hours.
select test_login('00000000-0000-4000-8000-0000000008a1');
do $$
declare
  v_sql text;
begin
  insert into storage.objects (bucket_id, name)
    values ('application-documents', '00000000-0000-4000-8000-0000000008a1/tobacco_license/1-license.pdf');
  insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
    values ('00000000-0000-4000-8000-0000000008a1', 'tobacco_license',
            '00000000-0000-4000-8000-0000000008a1/tobacco_license/1-license.pdf', 'license.pdf');

  foreach v_sql in array array[
    -- a folder that is not a document type
    $q$insert into storage.objects (bucket_id, name) values ('application-documents', '00000000-0000-4000-8000-0000000008a1/photos/x.pdf')$q$,
    -- another user's folder
    $q$insert into storage.objects (bucket_id, name) values ('application-documents', '00000000-0000-4000-8000-0000000008e1/tobacco_license/x.pdf')$q$,
    -- nested, or straight in the user's folder
    $q$insert into storage.objects (bucket_id, name) values ('application-documents', '00000000-0000-4000-8000-0000000008a1/tobacco_license/more/x.pdf')$q$,
    $q$insert into storage.objects (bucket_id, name) values ('application-documents', '00000000-0000-4000-8000-0000000008a1/x.pdf')$q$,
    -- a row whose path is not {own id}/{its type}/{file}
    $q$insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
       values ('00000000-0000-4000-8000-0000000008a1', 'resale_certificate', '00000000-0000-4000-8000-0000000008a1/tobacco_license/r.pdf', 'r.pdf')$q$,
    $q$insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
       values ('00000000-0000-4000-8000-0000000008a1', 'resale_certificate', '00000000-0000-4000-8000-0000000008e1/resale_certificate/r.pdf', 'r.pdf')$q$,
    $q$insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
       values ('00000000-0000-4000-8000-0000000008a1', 'resale_certificate', '00000000-0000-4000-8000-0000000008a1/resale_certificate/a/r.pdf', 'r.pdf')$q$,
    -- a row for another profile
    $q$insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
       values ('00000000-0000-4000-8000-0000000008e1', 'resale_certificate', '00000000-0000-4000-8000-0000000008e1/resale_certificate/r.pdf', 'r.pdf')$q$,
    -- moving a row into another type's folder
    $q$update public.profile_documents set storage_path = '00000000-0000-4000-8000-0000000008a1/resale_certificate/license.pdf'
       where profile_id = '00000000-0000-4000-8000-0000000008a1' and document_type = 'tobacco_license'$q$
  ] loop
    begin
      execute v_sql;
      raise exception 'this document write should have failed: %', v_sql;
    exception when insufficient_privilege then null;
    end;
  end loop;

  update public.profile_documents
  set storage_path = '00000000-0000-4000-8000-0000000008a1/tobacco_license/2-license.pdf', original_filename = 'license-2.pdf'
  where profile_id = '00000000-0000-4000-8000-0000000008a1' and document_type = 'tobacco_license';
  assert found, 'a pending applicant replaces their license row';

  -- One file so far; nine more make ten, and the eleventh is refused.
  for i in 2..10 loop
    insert into storage.objects (bucket_id, name)
      values ('application-documents', '00000000-0000-4000-8000-0000000008a1/resale_certificate/' || i || '-f.pdf');
  end loop;
  assert public.recent_application_uploads() = 10, 'ten uploads today';
  begin
    insert into storage.objects (bucket_id, name)
      values ('application-documents', '00000000-0000-4000-8000-0000000008a1/resale_certificate/11-f.pdf');
    raise exception 'the eleventh upload in 24 hours was accepted';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where name = '00000000-0000-4000-8000-0000000008a1/resale_certificate/10-f.pdf';
  assert found, 'a pending applicant deletes their own file';
  insert into storage.objects (bucket_id, name)
    values ('application-documents', '00000000-0000-4000-8000-0000000008a1/resale_certificate/11-f.pdf');
end $$;
select test_reset();

-- Uploads older than 24 hours don't count, so a license renewed next year is
-- accepted however many files the account has (AW-254).
update storage.objects set created_at = now() - interval '2 days'
where name like '00000000-0000-4000-8000-0000000008a1/%';
select test_login('00000000-0000-4000-8000-0000000008a1');
do $$ begin
  assert public.recent_application_uploads() = 0, 'uploads from two days ago don''t count';
  insert into storage.objects (bucket_id, name)
    values ('application-documents', '00000000-0000-4000-8000-0000000008a1/tobacco_license/12-renewal.pdf');
end $$;
select test_reset();

-- An approved account can upload and file a renewal at the same layout, but
-- not delete proof (20261008193000).
insert into storage.objects (bucket_id, name)
  values ('application-documents', '00000000-0000-4000-8000-0000000008b1/tobacco_license/1-l.pdf');
insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
  values ('00000000-0000-4000-8000-0000000008b1', 'tobacco_license', '00000000-0000-4000-8000-0000000008b1/tobacco_license/1-l.pdf', 'l.pdf');

select test_login('00000000-0000-4000-8000-0000000008b1');
do $$ begin
  assert (select count(*) from public.profile_documents) = 1, 'an approved account reads its document row';
  insert into storage.objects (bucket_id, name)
    values ('application-documents', '00000000-0000-4000-8000-0000000008b1/tobacco_license/2-renewed.pdf');
  update public.profile_documents
  set storage_path = '00000000-0000-4000-8000-0000000008b1/tobacco_license/2-renewed.pdf', original_filename = 'renewed.pdf'
  where profile_id = '00000000-0000-4000-8000-0000000008b1' and document_type = 'tobacco_license';
  assert found, 'an approved account files a renewed license';
  insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
    values ('00000000-0000-4000-8000-0000000008b1', 'resale_certificate', '00000000-0000-4000-8000-0000000008b1/resale_certificate/3-r.pdf', 'r.pdf');
  begin
    insert into storage.objects (bucket_id, name)
      values ('application-documents', '00000000-0000-4000-8000-0000000008b1/other/r.pdf');
    raise exception 'an approved account uploaded outside the layout';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where name = '00000000-0000-4000-8000-0000000008b1/tobacco_license/1-l.pdf';
  assert not found, 'an approved account cannot delete its file';
  delete from public.profile_documents where profile_id = '00000000-0000-4000-8000-0000000008b1';
  assert not found, 'an approved account cannot delete its document rows';
end $$;
select test_reset();

do $$ begin
  assert exists (select 1 from public.profile_document_history
                 where profile_id = '00000000-0000-4000-8000-0000000008b1'
                   and storage_path = '00000000-0000-4000-8000-0000000008b1/tobacco_license/1-l.pdf'),
    'the replaced license stays in the history';
  assert exists (select 1 from storage.objects where name = '00000000-0000-4000-8000-0000000008b1/tobacco_license/1-l.pdf'),
    'and its file stays in the bucket';
end $$;

-- A suspended admin has no admin rights (AW-352).
select test_login('00000000-0000-4000-8000-0000000008d1');
do $$ begin
  assert not public.is_admin(), 'a suspended admin is not an admin';
  assert (select count(*) from public.profiles) = 1, 'a suspended admin reads only their own profile';
  assert (select count(*) from public.profile_documents) = 0, 'a suspended admin reads nobody''s documents';
  assert (select count(*) from storage.objects where bucket_id = 'application-documents') = 0, 'or files';
  assert (select count(*) from public.profile_status_log) = 0, 'or status history';
  update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000008e1';
  assert not found, 'a suspended admin cannot approve an account';
  update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000008d1';
  assert (select status from public.profiles where id = '00000000-0000-4000-8000-0000000008d1') = 'suspended',
    'a suspended admin cannot reinstate themself';
end $$;
select test_reset();

-- An approved admin: approving stamps who and when and is logged; their own
-- role and status, the consent and approval records and a made-up email are
-- refused with insufficient_privilege.
select test_login('00000000-0000-4000-8000-0000000008c1');
do $$
declare
  v_sql text;
begin
  assert public.is_admin(), 'an approved admin is an admin';
  assert (select count(*) from public.profile_documents where profile_id = '00000000-0000-4000-8000-0000000008b1') = 2,
    'an admin reads an approved account''s documents';
  update public.profiles set status = 'approved', verification_note = 'P8: license checked'
  where id = '00000000-0000-4000-8000-0000000008e1';
  assert found, 'an admin approves an account';
  assert (select approved_by = '00000000-0000-4000-8000-0000000008c1' and approved_at is not null
          from public.profiles where id = '00000000-0000-4000-8000-0000000008e1'),
    'approving stamps the approver and the time';
  assert (select count(*) = 1 from public.profile_status_log
          where profile_id = '00000000-0000-4000-8000-0000000008e1' and old_status = 'pending' and new_status = 'approved'
            and changed_by = '00000000-0000-4000-8000-0000000008c1' and note = 'P8: license checked'),
    'the approval is in the status history, with the note';
  update public.profiles set pricing_tier = 'silver', business = 'P8 Store E', email = 'p8-e@example.test'
  where id = '00000000-0000-4000-8000-0000000008e1';
  assert found, 'an admin edits another account (its own sign-in email is fine)';
  update public.profiles set name = 'P8 Admin Renamed' where id = '00000000-0000-4000-8000-0000000008c1';
  assert found, 'an admin edits their own name';
  insert into public.profile_admin_notes (profile_id, body) values ('00000000-0000-4000-8000-0000000008e1', 'P8 internal note');
  assert (select author = '00000000-0000-4000-8000-0000000008c1' from public.profile_admin_notes
          where profile_id = '00000000-0000-4000-8000-0000000008e1'), 'an admin writes an internal note';

  foreach v_sql in array array[
    $q$update public.profiles set status = 'suspended' where id = '00000000-0000-4000-8000-0000000008c1'$q$,
    $q$update public.profiles set role = 'customer' where id = '00000000-0000-4000-8000-0000000008c1'$q$,
    $q$update public.profiles set approved_at = now() - interval '1 day' where id = '00000000-0000-4000-8000-0000000008e1'$q$,
    $q$update public.profiles set approved_by = null where id = '00000000-0000-4000-8000-0000000008e1'$q$,
    $q$update public.profiles set terms_accepted_at = now() where id = '00000000-0000-4000-8000-0000000008f1'$q$,
    $q$update public.profiles set age_confirmed_at = null where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set email = 'p8-elsewhere@example.test' where id = '00000000-0000-4000-8000-0000000008e1'$q$,
    $q$delete from public.profile_status_log$q$
  ] loop
    begin
      execute v_sql;
      raise exception 'an admin should not be able to run: %', v_sql;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
select test_reset();

-- The newly approved account can't read the notes about it.
select test_login('00000000-0000-4000-8000-0000000008e1');
do $$ begin
  assert (select count(*) from public.profile_admin_notes) = 0, 'the account holder reads no internal notes';
  assert (select verification_note = 'P8: license checked' from public.profiles), 'the verification note is on their own profile';
end $$;
select test_reset();

-- A sign-in email change reaches the profile (AW-196).
update auth.users set email = 'p8-a-new@example.test' where id = '00000000-0000-4000-8000-0000000008a1';
do $$ begin
  assert (select email from public.profiles where id = '00000000-0000-4000-8000-0000000008a1') = 'p8-a-new@example.test',
    'the profile follows the sign-in email';
end $$;
-- An address another profile holds is not copied, and the email change
-- itself still succeeds.
update auth.users set email = 'p8-b@example.test' where id = '00000000-0000-4000-8000-0000000008f1';
do $$ begin
  assert (select email from public.profiles where id = '00000000-0000-4000-8000-0000000008f1') = 'p8-f@example.test',
    'a clashing address is not copied';
end $$;
update auth.users set email = 'p8-f@example.test' where id = '00000000-0000-4000-8000-0000000008f1';

-- Leave the shared database as later test files expect it.
delete from public.profile_admin_notes where profile_id::text like '00000000-0000-4000-8000-0000000008%';
delete from public.profile_documents where profile_id::text like '00000000-0000-4000-8000-0000000008%';
delete from public.profile_document_history where profile_id::text like '00000000-0000-4000-8000-0000000008%';
delete from storage.objects where name like '00000000-0000-4000-8000-0000000008%';
