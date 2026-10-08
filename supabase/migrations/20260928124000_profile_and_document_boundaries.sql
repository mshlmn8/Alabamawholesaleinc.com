-- Profile and document boundaries (AW-196, AW-352, AW-197, AW-207, AW-348,
-- AW-092, AW-019): the one profile migration plan/conflicts.md asks for.
--
--   AW-092  the store's street address, city and ZIP on the profile, copied
--           from the application form
--   AW-019  when the applicant accepted the Trade terms and Privacy policy,
--           which version, and when they confirmed they are 21 or older
--   AW-352  is_admin() is true only for an APPROVED admin, so a suspended or
--           pending admin loses every admin policy at once
--   AW-196  a signed-in account may change only its name, phone and store
--           address; profiles.email follows the sign-in email; the owner is
--           provisioned by their confirmed auth email (provision_owner.sql)
--   AW-197  who approved an account and when, an append-only status history,
--           and license proof that can't be changed once the account is
--           approved
--   AW-207  document rows and files must sit at {user id}/{type}/{file},
--           with at most 10 files per user
--   AW-348  EIN, license and resale numbers, phone, volume and the store
--           address are removed from the user-editable auth metadata (which
--           rides in every access token) once they are on the profile
--
-- Why a trigger and not column privileges (AW-196): admins and customers are
-- both the `authenticated` role, so `grant update (name, phone, ...)` would
-- lock admins out as well. The BEFORE UPDATE trigger profiles_guard decides
-- per caller instead, and raises insufficient_privilege (42501), the error the
-- old policy's WITH CHECK gave, so callers see the same code.
--
-- Deliberate deviation from the cluster plan ("admin_notes" column for
-- AW-113): internal notes go in their own admin-only table,
-- profile_admin_notes (the table AW-113 itself proposes). A column on
-- profiles would be readable by the account holder through
-- profiles_self_read, and RLS can't hide a column. verification_note stays on
-- profiles, as AW-197 asks, so it is visible to the account holder: write in
-- it only what the customer may read.
--
-- Documents after approval (plan/conflicts.md, AW-085/AW-254): this
-- migration locks the proof once the account is approved (no insert, update
-- or delete by the applicant). Letting approved accounts add a renewed
-- license is left to the status-aware documents panel of AW-085/AW-254, as an
-- additive, insert-only versions table whose rows arrive flagged for staff
-- review; existing records stay immutable.
--
-- Release order: after 20260928123000, before the new frontend. The new
-- frontend also works before it: the old database keeps the extra signup
-- metadata in auth metadata (the backfill below moves it to the profile), the
-- new profile columns are simply absent, and the document path is unchanged.
-- The frontend deployed before it keeps working too; its admins must be
-- approved (they are, after provision_owner.sql).
--
-- Note: with email autoconfirm on, the first access token after signup is
-- minted from the signup request and still carries the stripped keys until
-- it is refreshed (about an hour, or at the next sign-in).

-- ---------------------------------------------------------------------------
-- (a) New profile columns (AW-092, AW-019, AW-197). All nullable: accounts
-- from before this migration have no store address, consent record or
-- approval stamp, and the admin screen shows nothing for them.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists store_street text,
  add column if not exists store_city text,
  add column if not exists store_zip text,
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists verification_note text;

-- ---------------------------------------------------------------------------
-- (b) is_admin() requires an approved admin (AW-352). Every policy that
-- calls it (profiles, products, orders, order_items, pricing_tiers,
-- product_variant_prices, profile_documents, storage) picks this up. anon
-- keeps EXECUTE: policies without a role list evaluate it for guests too
-- (it returns false for them).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' and status = 'approved' from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (c) What each caller may change on a profile (AW-196, AW-352, AW-197).
--
-- auth.uid() is null in the SQL editor, for the service role and for the
-- auth server itself (signup, email changes): those may change anything.
-- Otherwise:
--   * email: only to the account's own sign-in email (which is what
--     on_auth_user_email_changed copies); nobody chooses it by hand
--   * a signed-in account that is not an approved admin: only name, phone
--     and the store address (and updated_at, set by touch_profiles)
--   * an approved admin: anything on other rows, except the consent and
--     approval records; on their own row, not role or status (no
--     self-demotion or self-suspension that would lock the owner out)
-- A status change to 'approved' stamps approved_at and approved_by (null
-- from the SQL editor).
-- ---------------------------------------------------------------------------
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_self_editable constant text[] := array['name', 'phone', 'store_street', 'store_city', 'store_zip', 'updated_at', 'email'];
begin
  if v_uid is not null then
    if new.email is distinct from old.email
       and new.email is distinct from (select u.email from auth.users u where u.id = old.id) then
      raise exception 'A profile''s email follows its sign-in email'
        using errcode = '42501', hint = 'profile_email';
    end if;

    if not public.is_admin() then
      if (to_jsonb(new) - v_self_editable) is distinct from (to_jsonb(old) - v_self_editable) then
        raise exception 'Only your name, phone and store address can be changed here'
          using errcode = '42501', hint = 'profile_locked';
      end if;
    else
      if old.id = v_uid
         and (new.role is distinct from old.role or new.status is distinct from old.status) then
        raise exception 'You can''t change your own role or status'
          using errcode = '42501', hint = 'own_role_status';
      end if;
      if (new.terms_version, new.terms_accepted_at, new.age_confirmed_at, new.approved_at, new.approved_by)
         is distinct from
         (old.terms_version, old.terms_accepted_at, old.age_confirmed_at, old.approved_at, old.approved_by) then
        raise exception 'Consent and approval records can''t be edited'
          using errcode = '42501', hint = 'profile_record';
      end if;
    end if;
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_at := now();
    new.approved_by := v_uid;
  end if;
  return new;
end;
$$;

revoke all on function public.profiles_guard() from public, anon, authenticated;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- The row check stays: a signed-in account updates only its own row (admins
-- have profiles_admin_update). What may change is profiles_guard's job.
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- (d) Status history (AW-197): one row per status change, written only by
-- the trigger below. Admins read it; nobody can insert, change or delete
-- rows through the API. `note` is the verification_note given in the same
-- update, if it changed. Rows go with their profile (on delete cascade).
-- ---------------------------------------------------------------------------
create table if not exists public.profile_status_log (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  note text
);

create index if not exists profile_status_log_profile_idx
  on public.profile_status_log (profile_id, changed_at desc);

alter table public.profile_status_log enable row level security;

drop policy if exists profile_status_log_admin_read on public.profile_status_log;
create policy profile_status_log_admin_read on public.profile_status_log
  for select to authenticated using (public.is_admin());

revoke all on public.profile_status_log from public, anon, authenticated;
grant select on public.profile_status_log to authenticated;
grant all on public.profile_status_log to service_role;
revoke all on sequence public.profile_status_log_id_seq from public, anon, authenticated;

create or replace function public.log_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_status_log (profile_id, old_status, new_status, changed_by, note)
  values (
    new.id,
    old.status,
    new.status,
    (select p.id from public.profiles p where p.id = auth.uid()),
    case when new.verification_note is distinct from old.verification_note then new.verification_note end
  );
  return null;
end;
$$;

revoke all on function public.log_profile_status() from public, anon, authenticated;

drop trigger if exists profiles_status_log on public.profiles;
create trigger profiles_status_log
  after update of status on public.profiles
  for each row
  when (old.status is distinct from new.status)
  execute function public.log_profile_status();

-- Internal notes about an account, for the Phase 6 account detail page
-- (AW-113). Admins only: the account holder can't read them (see the
-- deviation note at the top).
create table if not exists public.profile_admin_notes (
  id bigserial primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  author uuid default auth.uid() references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint profile_admin_notes_body_chk check (length(btrim(body)) > 0)
);

create index if not exists profile_admin_notes_profile_idx
  on public.profile_admin_notes (profile_id, created_at desc);

alter table public.profile_admin_notes enable row level security;

drop policy if exists profile_admin_notes_admin on public.profile_admin_notes;
create policy profile_admin_notes_admin on public.profile_admin_notes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.profile_admin_notes from public, anon, authenticated;
grant select, insert, update, delete on public.profile_admin_notes to authenticated;
grant all on public.profile_admin_notes to service_role;
revoke all on sequence public.profile_admin_notes_id_seq from public, anon, authenticated;
grant usage on sequence public.profile_admin_notes_id_seq to authenticated;

-- ---------------------------------------------------------------------------
-- (e) profiles.email follows the sign-in email (AW-196). A change confirmed
-- through Supabase Auth is copied to the profile. If another profile already
-- holds that address (possible only for rows edited before this migration),
-- the copy is skipped with a warning rather than failing the email change.
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and new.email is distinct from old.email then
    begin
      update public.profiles set email = new.email where id = new.id;
    exception when unique_violation then
      raise warning 'profile % keeps its old email: another profile holds the new sign-in address', new.id;
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_profile_email() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- Profiles whose email was edited away from the sign-in email before this
-- migration (the old self-update policy allowed it) get the sign-in email
-- back, row by row. A row whose address another profile still holds is
-- tried again after the others (fixing that one may free it); what is left
-- after that is reported as a warning, by profile id only.
do $$
declare
  r record;
  v_progress boolean := true;
  v_pass integer := 0;
begin
  while v_progress and v_pass < 5 loop
    v_progress := false;
    v_pass := v_pass + 1;
    for r in
      select p.id, u.email
      from public.profiles p
      join auth.users u on u.id = p.id
      where u.email is not null and p.email is distinct from u.email
    loop
      begin
        update public.profiles set email = r.email where id = r.id;
        v_progress := true;
      exception when unique_violation then null;
      end;
    end loop;
  end loop;
  for r in
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email is not null and p.email is distinct from u.email
  loop
    raise warning 'profile % keeps its email: another profile holds its sign-in address', r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- (f) Signup (AW-092, AW-019, AW-348), recreated from 20260927000000. It also
-- copies the store address, and records consent: terms_version and
-- terms_accepted_at = now() when the form sent terms_accepted true, and
-- age_confirmed_at = now() when it sent age_confirmed true. Then it removes
-- from auth metadata every key the profile now holds except name and
-- business (shown by Supabase's dashboard and email templates). The consent
-- keys are removed too: the dated record is on the profile, and a copy the
-- user can rewrite with auth.updateUser() could be mistaken for it.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_terms boolean := (v_meta->>'terms_accepted') = 'true';
begin
  insert into public.profiles (
    id, email, name, business, phone, license_no, ein, resale_cert_no, business_type, state, expected_volume,
    store_street, store_city, store_zip, terms_version, terms_accepted_at, age_confirmed_at,
    role, status
  )
  values (
    new.id,
    new.email,
    coalesce(v_meta->>'name', split_part(new.email, '@', 1)),
    v_meta->>'business',
    v_meta->>'phone',
    v_meta->>'license_no',
    v_meta->>'ein',
    v_meta->>'resale_cert_no',
    v_meta->>'business_type',
    v_meta->>'state',
    v_meta->>'expected_volume',
    nullif(btrim(v_meta->>'store_street'), ''),
    nullif(btrim(v_meta->>'store_city'), ''),
    nullif(btrim(v_meta->>'store_zip'), ''),
    case when v_terms then left(nullif(btrim(v_meta->>'terms_version'), ''), 64) end,
    case when v_terms then now() end,
    case when (v_meta->>'age_confirmed') = 'true' then now() end,
    'customer',
    'pending'
  );

  update auth.users
  set raw_user_meta_data = raw_user_meta_data
    - array['ein', 'license_no', 'resale_cert_no', 'phone', 'expected_volume',
            'store_street', 'store_city', 'store_zip',
            'terms_version', 'terms_accepted', 'age_confirmed']
  where id = new.id;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Existing accounts: fill the profile columns that are still empty from the
-- metadata (profile values win; a signup made through the new frontend
-- before this migration also left its store address and consent there, and
-- its consent dates from the signup), then strip the same keys everywhere.
update public.profiles p
set phone = coalesce(p.phone, u.raw_user_meta_data->>'phone'),
    license_no = coalesce(p.license_no, u.raw_user_meta_data->>'license_no'),
    ein = coalesce(p.ein, u.raw_user_meta_data->>'ein'),
    resale_cert_no = coalesce(p.resale_cert_no, u.raw_user_meta_data->>'resale_cert_no'),
    expected_volume = coalesce(p.expected_volume, u.raw_user_meta_data->>'expected_volume'),
    store_street = coalesce(p.store_street, nullif(btrim(u.raw_user_meta_data->>'store_street'), '')),
    store_city = coalesce(p.store_city, nullif(btrim(u.raw_user_meta_data->>'store_city'), '')),
    store_zip = coalesce(p.store_zip, nullif(btrim(u.raw_user_meta_data->>'store_zip'), '')),
    terms_version = coalesce(p.terms_version, case when (u.raw_user_meta_data->>'terms_accepted') = 'true'
      then left(nullif(btrim(u.raw_user_meta_data->>'terms_version'), ''), 64) end),
    terms_accepted_at = coalesce(p.terms_accepted_at, case when (u.raw_user_meta_data->>'terms_accepted') = 'true'
      then coalesce(u.created_at, now()) end),
    age_confirmed_at = coalesce(p.age_confirmed_at, case when (u.raw_user_meta_data->>'age_confirmed') = 'true'
      then coalesce(u.created_at, now()) end)
from auth.users u
where u.id = p.id
  and u.raw_user_meta_data ?| array['ein', 'license_no', 'resale_cert_no', 'phone', 'expected_volume',
                                    'store_street', 'store_city', 'store_zip',
                                    'terms_version', 'terms_accepted', 'age_confirmed'];

update auth.users
set raw_user_meta_data = raw_user_meta_data
  - array['ein', 'license_no', 'resale_cert_no', 'phone', 'expected_volume',
          'store_street', 'store_city', 'store_zip',
          'terms_version', 'terms_accepted', 'age_confirmed']
where raw_user_meta_data ?| array['ein', 'license_no', 'resale_cert_no', 'phone', 'expected_volume',
                                  'store_street', 'store_city', 'store_zip',
                                  'terms_version', 'terms_accepted', 'age_confirmed'];

-- ---------------------------------------------------------------------------
-- (g) License proof (AW-197, AW-207). Helpers are security definer so the
-- policies don't recurse through profiles' or storage's RLS.
-- ---------------------------------------------------------------------------

-- The caller's account is still pending (an application under review).
create or replace function public.is_pending_applicant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select status = 'pending' from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_pending_applicant() from public;
grant execute on function public.is_pending_applicant() to anon, authenticated, service_role;

-- How many files a user has in the application-documents bucket (any
-- folder). Counts only the caller's own folder unless the caller is an
-- admin, so it tells nobody about other accounts.
create or replace function public.application_document_count(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from storage.objects o
  where o.bucket_id = 'application-documents'
    and (storage.foldername(o.name))[1] = p_uid::text
    and (p_uid = auth.uid() or public.is_admin());
$$;

revoke all on function public.application_document_count(uuid) from public, anon;
grant execute on function public.application_document_count(uuid) to authenticated, service_role;

-- Rows: the applicant's own, at {their id}/{this row's type}/{one file name},
-- and only while the account is pending. Admins read every row (unchanged).
drop policy if exists profile_documents_self_insert on public.profile_documents;
drop policy if exists profile_documents_self_update on public.profile_documents;
drop policy if exists profile_documents_self_delete on public.profile_documents;

create policy profile_documents_self_insert on public.profile_documents
  for insert to authenticated
  with check (
    auth.uid() = profile_id
    and storage_path ~ ('^' || auth.uid()::text || '/' || document_type || '/[^/]+$')
    and public.is_pending_applicant()
  );

create policy profile_documents_self_update on public.profile_documents
  for update to authenticated
  using (auth.uid() = profile_id and public.is_pending_applicant())
  with check (
    auth.uid() = profile_id
    and storage_path ~ ('^' || auth.uid()::text || '/' || document_type || '/[^/]+$')
    and public.is_pending_applicant()
  );

create policy profile_documents_self_delete on public.profile_documents
  for delete to authenticated
  using (auth.uid() = profile_id and public.is_pending_applicant());

-- Files: uploads and replacements only at {own id}/{tobacco_license or
-- resale_certificate}/{file}, only while pending, and at most 10 files per
-- user. A pending applicant may delete any file in their own folder (so a
-- stray upload can be cleaned up); after approval nothing is deleted.
-- Reading is unchanged: the owner, or an admin (application_documents_read).
drop policy if exists application_documents_owner_insert on storage.objects;
drop policy if exists application_documents_owner_update on storage.objects;
drop policy if exists application_documents_owner_delete on storage.objects;

create policy application_documents_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (storage.foldername(name))[2] in ('tobacco_license', 'resale_certificate')
    and array_length(storage.foldername(name), 1) = 2
    and public.is_pending_applicant()
    and public.application_document_count((select auth.uid())) < 10
  );

create policy application_documents_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and public.is_pending_applicant()
  )
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (storage.foldername(name))[2] in ('tobacco_license', 'resale_certificate')
    and array_length(storage.foldername(name), 1) = 2
    and public.is_pending_applicant()
  );

create policy application_documents_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and public.is_pending_applicant()
  );

-- ---------------------------------------------------------------------------
-- (h) Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration. The new frontend keeps working after it (it treats the new
-- columns as absent). Metadata stripped from auth.users is not restored: the
-- values are on the profiles.
--
-- drop policy if exists application_documents_owner_insert on storage.objects;
-- drop policy if exists application_documents_owner_update on storage.objects;
-- drop policy if exists application_documents_owner_delete on storage.objects;
-- create policy application_documents_owner_insert on storage.objects for insert to authenticated
--   with check (bucket_id = 'application-documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
-- create policy application_documents_owner_update on storage.objects for update to authenticated
--   using (bucket_id = 'application-documents' and (storage.foldername(name))[1] = (select auth.uid()::text))
--   with check (bucket_id = 'application-documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
-- create policy application_documents_owner_delete on storage.objects for delete to authenticated
--   using (bucket_id = 'application-documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
-- drop policy if exists profile_documents_self_insert on public.profile_documents;
-- drop policy if exists profile_documents_self_update on public.profile_documents;
-- drop policy if exists profile_documents_self_delete on public.profile_documents;
-- create policy profile_documents_self_insert on public.profile_documents for insert with check (auth.uid() = profile_id);
-- create policy profile_documents_self_update on public.profile_documents for update
--   using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
-- create policy profile_documents_self_delete on public.profile_documents for delete using (auth.uid() = profile_id);
-- drop function if exists public.application_document_count(uuid);
-- drop function if exists public.is_pending_applicant();
-- create or replace function public.handle_new_user() ... -- the 20260927000000 definition
-- drop trigger if exists on_auth_user_email_changed on auth.users;
-- drop function if exists public.sync_profile_email();
-- drop table if exists public.profile_admin_notes;
-- drop trigger if exists profiles_status_log on public.profiles;
-- drop function if exists public.log_profile_status();
-- drop table if exists public.profile_status_log;
-- drop policy if exists profiles_self_update on public.profiles;
-- create policy profiles_self_update on public.profiles for update using (auth.uid() = id)
--   with check (auth.uid() = id
--     and role = (select role from public.profiles where id = auth.uid())
--     and status = (select status from public.profiles where id = auth.uid())
--     and pricing_tier = (select pricing_tier from public.profiles where id = auth.uid()));
-- drop trigger if exists profiles_guard on public.profiles;
-- drop function if exists public.profiles_guard();
-- create or replace function public.is_admin() returns boolean language sql security definer stable
--   set search_path = public as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false); $$;
-- alter table public.profiles
--   drop column if exists verification_note,
--   drop column if exists approved_by,
--   drop column if exists approved_at,
--   drop column if exists age_confirmed_at,
--   drop column if exists terms_accepted_at,
--   drop column if exists terms_version,
--   drop column if exists store_zip,
--   drop column if exists store_city,
--   drop column if exists store_street;
