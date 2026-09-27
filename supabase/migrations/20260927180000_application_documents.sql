-- Optional proof for a trade application: one state retail tobacco license
-- and one resale certificate per profile. The license and resale numbers on
-- profiles stay required in the form; these files are not.
--
-- Object keys live under the user's own folder:
--   {profile id}/{document type}/{filename}
-- The storage policies only allow that first folder to match auth.uid().

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-documents',
  'application-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.profile_documents (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  storage_path text not null unique,
  original_filename text not null,
  uploaded_at timestamptz not null default now(),
  primary key (profile_id, document_type),
  constraint profile_documents_type_chk check (document_type in ('tobacco_license', 'resale_certificate'))
);

alter table public.profile_documents enable row level security;

grant select, insert, update, delete on public.profile_documents to authenticated;

drop policy if exists profile_documents_self_select on public.profile_documents;
drop policy if exists profile_documents_self_insert on public.profile_documents;
drop policy if exists profile_documents_self_update on public.profile_documents;
drop policy if exists profile_documents_self_delete on public.profile_documents;
drop policy if exists application_documents_owner_insert on storage.objects;
drop policy if exists application_documents_owner_update on storage.objects;
drop policy if exists application_documents_read on storage.objects;
drop policy if exists application_documents_owner_delete on storage.objects;

create policy profile_documents_self_select on public.profile_documents
  for select using (auth.uid() = profile_id or public.is_admin());

create policy profile_documents_self_insert on public.profile_documents
  for insert with check (auth.uid() = profile_id);

create policy profile_documents_self_update on public.profile_documents
  for update using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy profile_documents_self_delete on public.profile_documents
  for delete using (auth.uid() = profile_id);

-- Private bucket. Owners read and replace only their folder; admins can read
-- every object so the accounts tab can mint a signed View link.
create policy application_documents_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy application_documents_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy application_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'application-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or public.is_admin()
    )
  );

create policy application_documents_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
