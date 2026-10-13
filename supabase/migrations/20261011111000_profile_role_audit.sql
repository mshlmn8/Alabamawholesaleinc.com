-- Role changes in the account history (AW-203).
--
-- Admin -> Accounts now asks before a role change, with a reason that goes in
-- the account's internal notes (src/pages/admin/AccountChanges.jsx). The
-- database's own record of who changed an account, profile_status_log
-- (20261008193000), logged only status changes: making a customer an admin,
-- which opens every order, application, EIN and licence document to them,
-- left no trace there.
--
-- This file:
--   (a) adds profile_status_log.old_role and new_role (text, null for a
--       status-only change);
--   (b) recreates public.log_profile_status() from its latest definition
--       (20261008193000; 20261009140000 only revoked it, and nothing later
--       redefines it), so it writes a row when the status OR the role
--       changes: old_status and new_status always (equal for a role-only
--       change), old_role and new_role only when the role changed,
--       changed_by auth.uid() and the verification note as before. Still
--       SECURITY DEFINER with search_path = public, and still revoked from
--       guests and signed-in accounts. The profile_status_log_write trigger
--       (AFTER UPDATE, 20261008193000) is unchanged.
--
-- Not changed: an admin still can't change their own role or status (the
-- a_protect_profile_columns guard, 20261009140000, hint own_role_status, runs
-- BEFORE UPDATE, so a refused change logs nothing); admins read the log
-- (profile_status_log_admin_read, is_admin()), nobody else does, and nobody
-- writes it except this trigger.
--
-- Release order: any time after 20261009140000. No seed change. The
-- frontend deployed before it doesn't read the new columns. The new frontend
-- works before and after: the account page asks for the role columns and,
-- on 42703 (or PGRST204), reads the history without them; role changes made
-- before this migration aren't in the history (their reasons are in the
-- internal notes).

-- (a) The role columns.
alter table public.profile_status_log
  add column if not exists old_role text,
  add column if not exists new_role text;

-- (b) The log trigger function, now for role changes too.
create or replace function public.log_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role_changed boolean := old.role is distinct from new.role;
begin
  if old.status is distinct from new.status or v_role_changed then
    insert into public.profile_status_log (profile_id, old_status, new_status, old_role, new_role, changed_by, note)
    values (
      new.id, old.status, new.status,
      case when v_role_changed then old.role end,
      case when v_role_changed then new.role end,
      auth.uid(), new.verification_note
    );
  end if;
  return new;
end;
$$;

-- A trigger function: nobody calls it directly. (Supabase's default
-- privileges grant EXECUTE on new functions to anon and authenticated.)
revoke all on function public.log_profile_status() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this migration.
-- Deploy a frontend that doesn't read the role columns first, or keep this
-- one: it reads the history without them on 42703.
--
-- create or replace function public.log_profile_status()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- begin
--   if old.status is distinct from new.status then
--     insert into public.profile_status_log (profile_id, old_status, new_status, changed_by, note)
--     values (new.id, old.status, new.status, auth.uid(), new.verification_note);
--   end if;
--   return new;
-- end;
-- $$;
-- revoke all on function public.log_profile_status() from public, anon, authenticated;
-- -- Dropping the columns loses which rows were role changes (theirs have the
-- -- same old and new status); keep them if the history matters.
-- alter table public.profile_status_log drop column if exists old_role, drop column if exists new_role;
