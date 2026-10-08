-- Who approved a trade account, and a record of status changes.
-- Licence files stay on file after approval: applicants cannot delete them,
-- and a replacement keeps the previous storage path in history.
-- Approved and suspended accounts can still upload a renewed file (AW-254).

alter table public.profiles
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists verification_note text;

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  new.email := old.email;
  new.status := old.status;
  new.role := old.role;
  new.pricing_tier := old.pricing_tier;
  new.license_no := old.license_no;
  new.ein := old.ein;
  new.resale_cert_no := old.resale_cert_no;
  new.approved_at := old.approved_at;
  new.approved_by := old.approved_by;
  new.verification_note := old.verification_note;
  return new;
end;
$$;

create or replace function public.stamp_profile_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := now();
    new.approved_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists z_stamp_profile_approval on public.profiles;
create trigger z_stamp_profile_approval
  before update on public.profiles
  for each row execute function public.stamp_profile_approval();

create table if not exists public.profile_status_log (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  old_status text,
  new_status text,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  note text
);

alter table public.profile_status_log enable row level security;

drop policy if exists profile_status_log_admin_read on public.profile_status_log;
create policy profile_status_log_admin_read on public.profile_status_log
  for select using (public.is_admin());

revoke all on public.profile_status_log from anon, authenticated;
grant select on public.profile_status_log to authenticated;

create or replace function public.log_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.profile_status_log (profile_id, old_status, new_status, changed_by, note)
    values (new.id, old.status, new.status, auth.uid(), new.verification_note);
  end if;
  return new;
end;
$$;

drop trigger if exists profile_status_log_write on public.profiles;
create trigger profile_status_log_write
  after update on public.profiles
  for each row execute function public.log_profile_status();

create table if not exists public.profile_document_history (
  id bigint generated always as identity primary key,
  profile_id uuid not null,
  document_type text not null,
  storage_path text not null,
  original_filename text not null,
  uploaded_at timestamptz,
  replaced_at timestamptz not null default now(),
  replaced_by uuid
);

alter table public.profile_document_history enable row level security;

drop policy if exists profile_document_history_admin_read on public.profile_document_history;
create policy profile_document_history_admin_read on public.profile_document_history
  for select using (public.is_admin());

revoke all on public.profile_document_history from anon, authenticated;
grant select on public.profile_document_history to authenticated;

create or replace function public.keep_profile_document_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_document_history (
    profile_id, document_type, storage_path, original_filename, uploaded_at, replaced_by
  ) values (
    old.profile_id, old.document_type, old.storage_path, old.original_filename, old.uploaded_at, auth.uid()
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists profile_documents_keep_history on public.profile_documents;
create trigger profile_documents_keep_history
  before update or delete on public.profile_documents
  for each row execute function public.keep_profile_document_history();

-- Deleting proof is limited to a still-pending application. Replacing a file
-- (update/insert) stays available so an approved or suspended account can
-- send a renewed license. The trigger above keeps the previous path.
drop policy if exists profile_documents_self_delete on public.profile_documents;
create policy profile_documents_self_delete on public.profile_documents
  for delete using (
    auth.uid() = profile_id
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and status = 'pending'
    )
  );

drop policy if exists application_documents_owner_delete on storage.objects;
create policy application_documents_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and status = 'pending'
    )
  );
