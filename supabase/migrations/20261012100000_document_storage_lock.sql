-- Licence proof can't be replaced in place (AW-197), and the
-- application-documents bucket takes only what the site offers (AW-347).
-- Storage only; no table, function or frontend change is needed with it.
--
-- (a) No UPDATE on application-documents objects. The
-- application_documents_owner_update policy (20260927180000, narrowed to the
-- {user id}/{document type}/{file} layout by 20261009140000) let an account
-- overwrite an object in its own folder at any status, so the file staff
-- checked when they approved an account could be swapped afterwards under
-- the same name, and profile_document_history would still point at it.
-- Nothing needs that policy: every upload writes a new object,
-- {user id}/{document type}/{upload time}-{filename} (src/lib/documents.js),
-- and the site uploads with upsert off. A renewal is a new object
-- (application_documents_owner_insert, any status, AW-254) plus the
-- profile_documents row upsert, whose trigger keeps the previous path in
-- profile_document_history. Without an UPDATE policy no pending, approved
-- or suspended account can change an existing object, and admins never
-- could (they only read this bucket); the SQL editor and the service role
-- still can. An upload with upsert on to a new path still works (Postgres
-- checks UPDATE policies only when the row already exists), so a frontend
-- built before this keeps uploading. Deleting is unchanged: only a pending
-- applicant, in their own folder (20261008193000).
--
-- (b) allowed_mime_types without image/heic and image/heif. The site stopped
-- offering HEIC (staff browsers can't show it, AW-347), but the bucket still
-- took it from an upload made outside the site. The list gates new uploads
-- only: HEIC files already stored keep their type and still open (download).
-- Storage still checks only the type an upload declares; reading a file's
-- bytes on the server needs an Edge Function (owner question AW-347,
-- docs/OWNER-TODO.md).
--
-- Apply any time, before or after the frontend.

-- (a)
drop policy if exists application_documents_owner_update on storage.objects;

-- (b) The 10 MB limit and the private flag stay as they are.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'application-documents';

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration. The new frontend keeps working after it (it never updates an
-- object). The policy is 20261009140000's.
--
-- create policy application_documents_owner_update on storage.objects
--   for update to authenticated
--   using (
--     bucket_id = 'application-documents'
--     and (storage.foldername(name))[1] = (select auth.uid()::text)
--   )
--   with check (
--     bucket_id = 'application-documents'
--     and (storage.foldername(name))[1] = (select auth.uid()::text)
--     and (storage.foldername(name))[2] in ('tobacco_license', 'resale_certificate')
--     and array_length(storage.foldername(name), 1) = 2
--   );
-- update storage.buckets
-- set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
-- where id = 'application-documents';
