-- Profile and document boundaries (AW-352, AW-196, AW-197, AW-207, AW-348),
-- on top of Cursor's 20261008191000–195000, which already add the store
-- address (AW-092), the consent record (AW-019), the self-update guard
-- (AW-196), approved_at / approved_by / verification_note, the status log and
-- the document history (AW-197, AW-254), and a signup trigger that strips the
-- sensitive metadata keys (AW-348). None of that is redone here. This adds:
--
--   AW-352  is_admin() is true only for an APPROVED admin, so a suspended or
--           pending admin loses every admin policy at once; an admin can't
--           change their own role or status
--   AW-196  the self-update guard (Cursor's a_protect_profile_columns, still
--           the only one) keeps every column but name, phone and the store
--           address as it was in a customer's own update (it also covered
--           business, state, type, volume and the consent record only by
--           omission before); admins can't edit the consent and approval
--           records; profiles.email follows the sign-in email (auth.users
--           trigger), and rows edited away from it before are realigned
--   AW-348  accounts that signed up before 20261008194000 get their
--           application answers, store address and consent copied from the
--           auth metadata to the profile (only where the profile has none),
--           and the same keys are then removed from the metadata
--   AW-197  internal notes about an account in an admin-only table
--           (profile_admin_notes); an index for an account's status history
--   AW-207  document rows and files must sit at {user id}/{type}/{file}, and
--           an account uploads at most 10 files in 24 hours
--
-- Deliberate deviations:
--   * Customers' forbidden changes are silently kept as they were (Cursor's
--     semantics, so a customer's update still succeeds); an approved admin's
--     forbidden changes (own role or status, consent and approval records, an
--     email other than the sign-in one) raise insufficient_privilege (42501)
--     with a hint, which Admin -> Accounts shows.
--   * The upload cap counts a rolling 24 hours, not a lifetime total: since
--     20261008193000 a renewed license is a new object and the replaced one
--     stays for the document history, so a lifetime cap would eventually
--     block renewals (AW-254). Growth is bounded at 10 files a day per
--     account; staff can remove stale objects in the Storage dashboard.
--   * Proof is NOT locked after approval (the cluster plan's AW-197 step 2):
--     Cursor's 20261008193000, merged by the owner, lets approved and
--     suspended accounts upload a renewal and keeps the old path in
--     profile_document_history; only a pending applicant can delete.
--   * Internal notes go in their own table rather than a profiles column,
--     because the account holder can read every profiles column through
--     profiles_self_read and RLS can't hide a column. verification_note
--     (Cursor's) stays on profiles, readable by the account holder.
--
-- Release order: after 20261009130000, before the new frontend. The new
-- frontend also works before it (the admin's own-row lock and the refusal
-- messages are in the page too, and the old document policies accept the
-- same paths). Note: with email autoconfirm on, the first access token after
-- signup is minted from the signup request and still carries the stripped
-- keys until it is refreshed (about an hour, or at the next sign-in).

-- ---------------------------------------------------------------------------
-- (a) is_admin() requires an approved admin (AW-352). Every policy that
-- calls it (profiles, products, orders, order_items, pricing_tiers,
-- product_variant_prices, profile_documents, profile_status_log,
-- profile_document_history, storage) picks this up. anon keeps EXECUTE:
-- policies without a role list evaluate it for guests too (false for them).
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
-- (b) What each caller may change on a profile (AW-196, AW-352), in Cursor's
-- trigger function (a_protect_profile_columns, 20261008192000/193000), so
-- there is still one guard. auth.uid() is null in the SQL editor, for the
-- service role and for the auth server itself (signup, email changes):
-- those may change anything.
--   * a signed-in account that is not an approved admin: every column but
--     name, phone and the store address (street, city, ZIP) keeps its old
--     value, so new columns are locked by default; updated_at is set by
--     touch_profiles afterwards
--   * an approved admin: anything on other rows except the consent record
--     and approval stamp, which only the signup and approval triggers write,
--     and an email other than the account's sign-in email; on their own row
--     not role or status (no self-demotion or self-suspension that would lock
--     the owner out). Those raise 42501.
-- z_stamp_profile_approval (20261008193000) still stamps approved_at and
-- approved_by after this trigger when the status becomes 'approved'.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_self_editable constant text[] := array['name', 'phone', 'store_street', 'store_city', 'store_zip', 'updated_at'];
begin
  if v_uid is null then
    return new;
  end if;

  if not public.is_admin() then
    return jsonb_populate_record(new, to_jsonb(old) - v_self_editable);
  end if;

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
  if new.email is distinct from old.email
     and new.email is distinct from (select u.email from auth.users u where u.id = old.id) then
    raise exception 'A profile''s email follows its sign-in email'
      using errcode = '42501', hint = 'profile_email';
  end if;
  return new;
end;
$$;

-- Trigger functions: nobody calls them directly. (Supabase's default
-- privileges grant EXECUTE on new functions to anon and authenticated.)
revoke all on function public.protect_profile_columns() from public, anon, authenticated;
revoke all on function public.stamp_profile_approval() from public, anon, authenticated;
revoke all on function public.log_profile_status() from public, anon, authenticated;
revoke all on function public.keep_profile_document_history() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- (c) Status history (AW-197): Cursor's profile_status_log, with an index
-- for one account's history. Internal notes about an account, for the
-- account detail page (AW-113): admins only; the account holder can't read
-- them (see the deviation note at the top).
-- ---------------------------------------------------------------------------
create index if not exists profile_status_log_profile_idx
  on public.profile_status_log (profile_id, changed_at desc);

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
-- (d) profiles.email follows the sign-in email (AW-196). A change confirmed
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

-- Profiles whose email was edited away from the sign-in email before the
-- guard (the old self-update policy allowed it) get the sign-in email back,
-- row by row. A row whose address another profile still holds is tried again
-- after the others (fixing that one may free it); what is left after that is
-- reported as a warning, by profile id only.
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
-- (e) Accounts from before 20261008194000/195000 (AW-348, AW-092, AW-019).
-- New signups already go through Cursor's handle_new_user, which copies the
-- answers and strips the keys. Older accounts still carry them in their
-- auth metadata: a signup made through a frontend that sent the store
-- address and consent while the live database lacked those columns left
-- them only there. Fill the profile columns that are still empty (profile
-- values win; consent dates from the signup), then strip the keys
-- handle_new_user strips. A function, so running it again is safe and the
-- tests can check it; only the SQL editor and the service role may call it.
-- ---------------------------------------------------------------------------
create or replace function public.backfill_profiles_from_metadata()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys constant text[] := array['ein', 'license_no', 'resale_cert_no', 'phone', 'expected_volume',
                                  'store_street', 'store_city', 'store_zip',
                                  'terms_version', 'terms_accepted', 'age_confirmed'];
  v_count integer;
begin
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
    and u.raw_user_meta_data ?| v_keys;

  update auth.users
  set raw_user_meta_data = raw_user_meta_data - v_keys
  where raw_user_meta_data ?| v_keys;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.backfill_profiles_from_metadata() from public, anon, authenticated;
grant execute on function public.backfill_profiles_from_metadata() to service_role;

select public.backfill_profiles_from_metadata();

-- ---------------------------------------------------------------------------
-- (f) License proof layout and upload cap (AW-207). Rows and files sit at
-- {own id}/{document type}/{one file name}, for every account status
-- (renewals after approval stay allowed, AW-254). Deleting stays as
-- 20261008193000 has it: rows and files only while the account is pending.
-- Reading is unchanged: the owner, or an admin.
-- ---------------------------------------------------------------------------

-- How many files the caller added to their own folder in the last 24 hours.
-- Security definer, so the storage policy doesn't recurse through the
-- bucket's RLS; it counts only the caller's own folder.
create or replace function public.recent_application_uploads()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from storage.objects o
  where o.bucket_id = 'application-documents'
    and (storage.foldername(o.name))[1] = auth.uid()::text
    and o.created_at > now() - interval '24 hours';
$$;

revoke all on function public.recent_application_uploads() from public, anon;
grant execute on function public.recent_application_uploads() to authenticated, service_role;

drop policy if exists profile_documents_self_insert on public.profile_documents;
drop policy if exists profile_documents_self_update on public.profile_documents;

create policy profile_documents_self_insert on public.profile_documents
  for insert to authenticated
  with check (
    auth.uid() = profile_id
    and storage_path ~ ('^' || auth.uid()::text || '/' || document_type || '/[^/]+$')
  );

create policy profile_documents_self_update on public.profile_documents
  for update to authenticated
  using (auth.uid() = profile_id)
  with check (
    auth.uid() = profile_id
    and storage_path ~ ('^' || auth.uid()::text || '/' || document_type || '/[^/]+$')
  );

drop policy if exists application_documents_owner_insert on storage.objects;
drop policy if exists application_documents_owner_update on storage.objects;

create policy application_documents_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'application-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (storage.foldername(name))[2] in ('tobacco_license', 'resale_certificate')
    and array_length(storage.foldername(name), 1) = 2
    and public.recent_application_uploads() < 10
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
    and (storage.foldername(name))[2] in ('tobacco_license', 'resale_certificate')
    and array_length(storage.foldername(name), 1) = 2
  );

-- ---------------------------------------------------------------------------
-- (g) Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration. The new frontend keeps working after it. Metadata stripped from
-- auth.users is not restored: the values are on the profiles.
--
-- drop policy if exists application_documents_owner_insert on storage.objects;
-- drop policy if exists application_documents_owner_update on storage.objects;
-- create policy application_documents_owner_insert on storage.objects for insert to authenticated
--   with check (bucket_id = 'application-documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
-- create policy application_documents_owner_update on storage.objects for update to authenticated
--   using (bucket_id = 'application-documents' and (storage.foldername(name))[1] = (select auth.uid()::text))
--   with check (bucket_id = 'application-documents' and (storage.foldername(name))[1] = (select auth.uid()::text));
-- drop policy if exists profile_documents_self_insert on public.profile_documents;
-- drop policy if exists profile_documents_self_update on public.profile_documents;
-- create policy profile_documents_self_insert on public.profile_documents for insert with check (auth.uid() = profile_id);
-- create policy profile_documents_self_update on public.profile_documents for update
--   using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
-- drop function if exists public.recent_application_uploads();
-- drop function if exists public.backfill_profiles_from_metadata();
-- drop trigger if exists on_auth_user_email_changed on auth.users;
-- drop function if exists public.sync_profile_email();
-- drop table if exists public.profile_admin_notes;
-- drop index if exists public.profile_status_log_profile_idx;
-- create or replace function public.protect_profile_columns() ... -- the
--   20261008193000 definition
-- create or replace function public.is_admin() returns boolean language sql security definer stable
--   set search_path = public as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false); $$;
