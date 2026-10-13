-- 20261008193000_profile_approval_audit.sql (AW-197, AW-254; Cursor's PR #12):
-- who approved an account and when, a status log, licence-document history,
-- and proof that only a pending applicant can delete.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000011a1', 'audit-applicant@example.com', '{"name": "Applicant"}'),
  ('00000000-0000-4000-8000-0000000011b1', 'audit-admin@example.com', '{"name": "Audit Admin"}'),
  ('00000000-0000-4000-8000-0000000011c1', 'audit-pending@example.com', '{"name": "Still Pending"}');
update public.profiles set role = 'admin', status = 'approved' where id = '00000000-0000-4000-8000-0000000011b1';

-- Proof uploaded while pending.
select test_login('00000000-0000-4000-8000-0000000011a1');
insert into storage.objects (bucket_id, name) values ('application-documents', '00000000-0000-4000-8000-0000000011a1/tobacco_license/1-a.pdf');
insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
  values ('00000000-0000-4000-8000-0000000011a1', 'tobacco_license', '00000000-0000-4000-8000-0000000011a1/tobacco_license/1-a.pdf', 'a.pdf');
select test_reset();

select test_login('00000000-0000-4000-8000-0000000011b1');
do $$ begin
  update public.profiles set status = 'approved', verification_note = 'Licence checked'
   where id = '00000000-0000-4000-8000-0000000011a1';
  assert (select approved_at is not null and approved_by = '00000000-0000-4000-8000-0000000011b1' and verification_note = 'Licence checked'
          from public.profiles where id = '00000000-0000-4000-8000-0000000011a1'), 'approval records who and when';
  assert exists (select 1 from public.profile_status_log
                 where profile_id = '00000000-0000-4000-8000-0000000011a1' and old_status = 'pending' and new_status = 'approved'
                   and changed_by = '00000000-0000-4000-8000-0000000011b1' and note = 'Licence checked'), 'the status change is logged';
end $$;
select test_reset();

-- An approved account renews its licence: the old path goes to history, and
-- proof can no longer be deleted.
select test_login('00000000-0000-4000-8000-0000000011a1');
do $$ begin
  assert (select count(*) from public.profile_status_log) = 0, 'customers cannot read the status log';
  update public.profile_documents
     set storage_path = '00000000-0000-4000-8000-0000000011a1/tobacco_license/2-b.pdf', original_filename = 'b.pdf'
   where profile_id = '00000000-0000-4000-8000-0000000011a1' and document_type = 'tobacco_license';
  assert found, 'an approved account can replace its licence';
  assert (select count(*) from public.profile_document_history) = 0, 'customers cannot read document history';
  delete from public.profile_documents where profile_id = '00000000-0000-4000-8000-0000000011a1';
  assert not found, 'an approved account cannot delete its proof';
  delete from storage.objects where name = '00000000-0000-4000-8000-0000000011a1/tobacco_license/1-a.pdf';
  assert not found, 'an approved account cannot delete the stored file';
end $$;
select test_reset();

-- A pending applicant can still take proof back.
select test_login('00000000-0000-4000-8000-0000000011c1');
insert into storage.objects (bucket_id, name) values ('application-documents', '00000000-0000-4000-8000-0000000011c1/resale_certificate/1-c.pdf');
insert into public.profile_documents (profile_id, document_type, storage_path, original_filename)
  values ('00000000-0000-4000-8000-0000000011c1', 'resale_certificate', '00000000-0000-4000-8000-0000000011c1/resale_certificate/1-c.pdf', 'c.pdf');
do $$ begin
  delete from public.profile_documents where profile_id = '00000000-0000-4000-8000-0000000011c1';
  assert found, 'a pending applicant can delete their proof';
  delete from storage.objects where name = '00000000-0000-4000-8000-0000000011c1/resale_certificate/1-c.pdf';
  assert found, 'a pending applicant can delete the stored file';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000011b1');
do $$ begin
  assert exists (select 1 from public.profile_document_history
                 where profile_id = '00000000-0000-4000-8000-0000000011a1'
                   and storage_path = '00000000-0000-4000-8000-0000000011a1/tobacco_license/1-a.pdf'
                   and replaced_by = '00000000-0000-4000-8000-0000000011a1'), 'the replaced file stays in the history';
  assert exists (select 1 from public.profile_document_history
                 where profile_id = '00000000-0000-4000-8000-0000000011c1' and original_filename = 'c.pdf'), 'a deleted file stays in the history';
  assert (select count(*) from public.profile_status_log where profile_id = '00000000-0000-4000-8000-0000000011a1') = 1, 'admins read the status log';
end $$;
select test_reset();
