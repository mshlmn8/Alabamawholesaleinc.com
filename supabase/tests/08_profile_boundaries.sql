-- Profile and document boundaries (20260928124000): what a signed-in account
-- may change on its profile, admin rights only for approved admins, the
-- approval stamp and status history, the signup's store address and consent
-- record, auth metadata without the sensitive keys, the email sync, and
-- license proof that is locked after approval.
--
-- Users 0008a1..0008f1 and emails p8-* are this file's own.
--   a1 pending applicant (signs up with store address and consent)
--   b1 approved customer with a license on file
--   c1 approved admin
--   d1 suspended admin
--   e1 pending, approved by c1 below
--   f1 signup that did not accept the terms
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000008a1', 'p8-a@example.test',
   '{"name": "P8 Buyer A", "business": "P8 Store A", "phone": "205-555-0801", "license_no": "TL-P8-A",
     "ein": "12-3456781", "resale_cert_no": "RS-P8-A", "business_type": "Smoke Shop", "state": "AL",
     "expected_volume": "$5K — $15K", "store_street": " 1 Test Way ", "store_city": "Testville",
     "store_zip": "35203", "terms_version": "2026-09", "terms_accepted": true, "age_confirmed": true}', now()),
  ('00000000-0000-4000-8000-0000000008b1', 'p8-b@example.test', '{"name": "P8 Buyer B"}', now()),
  ('00000000-0000-4000-8000-0000000008c1', 'p8-admin@example.test', '{"name": "P8 Admin"}', now()),
  ('00000000-0000-4000-8000-0000000008d1', 'p8-held@example.test', '{"name": "P8 Held Admin"}', now()),
  ('00000000-0000-4000-8000-0000000008e1', 'p8-e@example.test', '{"name": "P8 Buyer E"}', now()),
  ('00000000-0000-4000-8000-0000000008f1', 'p8-f@example.test',
   '{"name": "P8 Buyer F", "terms_version": "2026-09", "terms_accepted": false}', now());

-- The SQL editor (no auth.uid()) may change anything; approving stamps the
-- time but no approver, and the change is logged.
update public.profiles set role = 'admin', status = 'approved' where id = '00000000-0000-4000-8000-0000000008c1';
update public.profiles set role = 'admin', status = 'suspended' where id = '00000000-0000-4000-8000-0000000008d1';
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000008b1';

do $$ begin
  assert (select store_street = '1 Test Way' and store_city = 'Testville' and store_zip = '35203'
            and terms_version = '2026-09' and terms_accepted_at is not null and age_confirmed_at is not null
            and ein = '12-3456781' and license_no = 'TL-P8-A' and resale_cert_no = 'RS-P8-A'
            and phone = '205-555-0801' and expected_volume = '$5K — $15K' and status = 'pending'
          from public.profiles where id = '00000000-0000-4000-8000-0000000008a1'),
    'signup copies the application, the store address and the consent record';
  assert (select not (raw_user_meta_data ?| array['ein', 'license_no', 'resale_cert_no', 'phone', 'expected_volume',
                                                  'store_street', 'store_city', 'store_zip',
                                                  'terms_version', 'terms_accepted', 'age_confirmed'])
          from auth.users where id = '00000000-0000-4000-8000-0000000008a1'),
    'the EIN, license and the other copied keys leave the auth metadata';
  assert (select raw_user_meta_data->>'name' = 'P8 Buyer A' and raw_user_meta_data->>'business' = 'P8 Store A'
          from auth.users where id = '00000000-0000-4000-8000-0000000008a1'),
    'name and business stay in the auth metadata';
  assert (select terms_version is null and terms_accepted_at is null and age_confirmed_at is null
          from public.profiles where id = '00000000-0000-4000-8000-0000000008f1'),
    'no consent is recorded unless the form sent terms_accepted true';
  assert (select approved_at is not null and approved_by is null
          from public.profiles where id = '00000000-0000-4000-8000-0000000008b1'),
    'an approval from the SQL editor is stamped, with no approver';
  assert (select count(*) = 1 from public.profile_status_log
          where profile_id = '00000000-0000-4000-8000-0000000008b1'
            and old_status = 'pending' and new_status = 'approved' and changed_by is null),
    'the status change is logged';
end $$;

-- A customer changes only their name, phone and store address.
select test_login('00000000-0000-4000-8000-0000000008a1');
do $$
declare
  v_sql text;
begin
  update public.profiles
  set name = 'P8 Buyer A2', phone = '205-555-0802', store_street = '2 Test Way', store_city = 'Testburg', store_zip = '35204'
  where id = '00000000-0000-4000-8000-0000000008a1';
  assert found, 'a customer updates their name, phone and store address';
  update public.profiles set email = 'p8-a@example.test' where id = '00000000-0000-4000-8000-0000000008a1';
  assert found, 'keeping the sign-in email is allowed';

  foreach v_sql in array array[
    $q$update public.profiles set email = 'p8-other@example.test' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set license_no = 'TL-P8-FAKE' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set ein = '98-7654321' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set resale_cert_no = 'RS-P8-FAKE' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set business = 'P8 Other Store' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set state = 'GA' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set business_type = 'Vape Shop' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set expected_volume = '$100K+' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set terms_version = '1999-01' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set terms_accepted_at = null where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set age_confirmed_at = now() - interval '1 year' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set approved_at = now() where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set approved_by = '00000000-0000-4000-8000-0000000008c1' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set verification_note = 'looks fine' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set pricing_tier = 'gold' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000008a1'$q$,
    $q$update public.profiles set created_at = now() - interval '1 day' where id = '00000000-0000-4000-8000-0000000008a1'$q$
  ] loop
    begin
      execute v_sql;
      raise exception 'a customer should not be able to run: %', v_sql;
    exception when insufficient_privilege then null;
    end;
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
  assert (select name = 'P8 Buyer A2' and store_street = '2 Test Way' and license_no = 'TL-P8-A' and ein = '12-3456781'
            and email = 'p8-a@example.test' and status = 'pending' and role = 'customer'
          from public.profiles where id = '00000000-0000-4000-8000-0000000008a1'),
    'only the allowed fields changed';
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
-- most 10 files.
select test_login('00000000-0000-4000-8000-0000000008a1');
do $$
declare
  v_sql text;
begin
  assert public.is_pending_applicant(), 'a1 is a pending applicant';
  insert into storage.objects (bucket_id, name)
    values ('application-documents', '00000000-0000-4000-8000-0000000008a1/tobacco_license/license.pdf');
  insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
    values ('00000000-0000-4000-8000-0000000008a1', 'tobacco_license',
            '00000000-0000-4000-8000-0000000008a1/tobacco_license/license.pdf', 'license.pdf');

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
  set storage_path = '00000000-0000-4000-8000-0000000008a1/tobacco_license/license-2.pdf', original_filename = 'license-2.pdf'
  where profile_id = '00000000-0000-4000-8000-0000000008a1' and document_type = 'tobacco_license';
  assert found, 'a pending applicant replaces their license row';

  -- One file so far; nine more make ten, and the eleventh is refused.
  for i in 2..10 loop
    insert into storage.objects (bucket_id, name)
      values ('application-documents', '00000000-0000-4000-8000-0000000008a1/resale_certificate/f' || i || '.pdf');
  end loop;
  assert public.application_document_count('00000000-0000-4000-8000-0000000008a1') = 10, 'ten files';
  begin
    insert into storage.objects (bucket_id, name)
      values ('application-documents', '00000000-0000-4000-8000-0000000008a1/resale_certificate/f11.pdf');
    raise exception 'the eleventh file was accepted';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where name = '00000000-0000-4000-8000-0000000008a1/resale_certificate/f10.pdf';
  assert found, 'a pending applicant deletes their own file';
  insert into storage.objects (bucket_id, name)
    values ('application-documents', '00000000-0000-4000-8000-0000000008a1/resale_certificate/f11.pdf');
  assert public.application_document_count('00000000-0000-4000-8000-0000000008b1') = 0,
    'the file count tells nobody about another account';
end $$;
select test_reset();

-- An approved account's proof is locked: it can read it, not add, replace or
-- delete it.
insert into storage.objects (bucket_id, name)
  values ('application-documents', '00000000-0000-4000-8000-0000000008b1/tobacco_license/l.pdf');
insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
  values ('00000000-0000-4000-8000-0000000008b1', 'tobacco_license', '00000000-0000-4000-8000-0000000008b1/tobacco_license/l.pdf', 'l.pdf');

select test_login('00000000-0000-4000-8000-0000000008b1');
do $$ begin
  assert not public.is_pending_applicant(), 'b1 is approved';
  assert (select count(*) from public.profile_documents) = 1, 'an approved account reads its document row';
  assert (select count(*) from storage.objects where bucket_id = 'application-documents') = 1, 'and its file';
  begin
    insert into storage.objects (bucket_id, name)
      values ('application-documents', '00000000-0000-4000-8000-0000000008b1/resale_certificate/r.pdf');
    raise exception 'an approved account uploaded a file';
  exception when insufficient_privilege then null;
  end;
  update storage.objects set name = '00000000-0000-4000-8000-0000000008b1/tobacco_license/l2.pdf'
  where name = '00000000-0000-4000-8000-0000000008b1/tobacco_license/l.pdf';
  assert not found, 'an approved account cannot replace its file';
  delete from storage.objects where name = '00000000-0000-4000-8000-0000000008b1/tobacco_license/l.pdf';
  assert not found, 'an approved account cannot delete its file';
  begin
    insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
      values ('00000000-0000-4000-8000-0000000008b1', 'resale_certificate', '00000000-0000-4000-8000-0000000008b1/resale_certificate/r.pdf', 'r.pdf');
    raise exception 'an approved account added a document row';
  exception when insufficient_privilege then null;
  end;
  update public.profile_documents set original_filename = 'other.pdf' where profile_id = '00000000-0000-4000-8000-0000000008b1';
  assert not found, 'an approved account cannot change its document row';
  delete from public.profile_documents where profile_id = '00000000-0000-4000-8000-0000000008b1';
  assert not found, 'an approved account cannot delete its document row';
end $$;
select test_reset();

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
  begin
    update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000008d1';
    raise exception 'a suspended admin reinstated themself';
  exception when insufficient_privilege then null;
  end;
end $$;
select test_reset();

-- An approved admin: approving stamps who and when and is logged; their own
-- role and status and the consent and approval records stay put.
select test_login('00000000-0000-4000-8000-0000000008c1');
do $$
declare
  v_sql text;
begin
  assert public.is_admin(), 'an approved admin is an admin';
  assert (select count(*) from public.profile_documents where profile_id = '00000000-0000-4000-8000-0000000008b1') = 1,
    'an admin reads an approved account''s documents';
  assert public.application_document_count('00000000-0000-4000-8000-0000000008a1') = 10, 'an admin can count any account''s files';
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
  update public.profiles set pricing_tier = 'silver', business = 'P8 Store E' where id = '00000000-0000-4000-8000-0000000008e1';
  assert found, 'an admin edits another account';
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
delete from storage.objects where name like '00000000-0000-4000-8000-0000000008%';
