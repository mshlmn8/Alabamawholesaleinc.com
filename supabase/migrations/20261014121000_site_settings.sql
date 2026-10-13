-- Site settings (AW-030; owner answer 2026-10): the owner and staff change
-- the site's public contact facts in Admin -> Site settings, without a
-- deploy:
--   - the announcement bar's messages (after the licensed-retailers notice,
--     which stays as it is)
--   - the public phone and email
--   - the opening hours, as rows of days and times
--   - the warehouse's street address
--
-- One row (id = true). A null value means "the site's own": the storefront
-- then shows the value built into the site (src/data/content.js), so the
-- table can be empty of opinions and the site looks exactly as before.
-- Everyone reads it (the storefront does, signed in or not); approved admin
-- and staff accounts (is_staff_or_admin(), 20261014120000) change it; nobody
-- deletes it. updated_at and updated_by are stamped here.
--
-- The checks match the form (src/data/siteFacts.js, SETTINGS_LIMITS):
--   announcements  1 to 6 messages of 1 to 160 characters
--   phone          '(205) 458-4788' (the form writes that shape)
--   email          something@something.tld, at most 254 characters
--   hours          1 to 4 rows {"days": …, "time": …}, each 1 to 40 characters
--   address        street (1-100), city (1-60), state (two capitals) and ZIP
--                  (12345 or 12345-6789), all four or none
--
-- Release order: after 20261014120000_staff_role.sql (it uses
-- is_staff_or_admin()). The frontend works before it: the storefront shows
-- content.js's values when the table is missing (PGRST205/42P01), and
-- Admin -> Site settings says it needs this update. The frontend deployed
-- before it doesn't read the table.

-- ---------------------------------------------------------------------------
-- The checks' helpers. Immutable: they look only at their arguments.
-- ---------------------------------------------------------------------------
create or replace function public.site_settings_lines_ok(p_lines text[], p_max_lines integer, p_max_length integer)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_lines is null or array_ndims(p_lines) is distinct from 1 then false
    else array_length(p_lines, 1) between 1 and p_max_lines
      and not exists (
        select 1 from unnest(p_lines) as l(line)
        where line is null or char_length(btrim(line)) = 0 or char_length(line) > p_max_length
      )
  end;
$$;

create or replace function public.site_settings_hours_ok(p_hours jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_hours is null or jsonb_typeof(p_hours) is distinct from 'array' then false
    else jsonb_array_length(p_hours) between 1 and 4
      and not exists (
        select 1 from jsonb_array_elements(p_hours) as e(item)
        where jsonb_typeof(e.item) is distinct from 'object'
           or jsonb_typeof(e.item -> 'days') is distinct from 'string'
           or jsonb_typeof(e.item -> 'time') is distinct from 'string'
           or char_length(btrim(e.item ->> 'days')) not between 1 and 40
           or char_length(btrim(e.item ->> 'time')) not between 1 and 40
           or (select count(*) from jsonb_object_keys(e.item)) <> 2
      )
  end;
$$;

-- A check runs its functions as the account that writes the row, so the
-- accounts that may write it can call them (they only look at their
-- arguments).
revoke all on function public.site_settings_lines_ok(text[], integer, integer) from public, anon;
revoke all on function public.site_settings_hours_ok(jsonb) from public, anon;
grant execute on function public.site_settings_lines_ok(text[], integer, integer) to authenticated, service_role;
grant execute on function public.site_settings_hours_ok(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The table.
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  id boolean primary key default true,
  announcements text[],
  phone text,
  email text,
  hours jsonb,
  street text,
  city text,
  state text,
  zip text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint site_settings_one_row check (id),
  constraint site_settings_announcements_chk check (announcements is null or public.site_settings_lines_ok(announcements, 6, 160)),
  constraint site_settings_phone_chk check (phone is null or phone ~ '^\(\d{3}\) \d{3}-\d{4}$'),
  constraint site_settings_email_chk check (
    email is null or (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[A-Za-z]{2,}$')
  ),
  constraint site_settings_hours_chk check (hours is null or public.site_settings_hours_ok(hours)),
  constraint site_settings_address_chk check (
    (street is null and city is null and state is null and zip is null)
    or (
      street is not null and city is not null and state is not null and zip is not null
      and char_length(btrim(street)) between 1 and 100
      and char_length(btrim(city)) between 1 and 60
      and state ~ '^[A-Z]{2}$'
      and zip ~ '^\d{5}(-\d{4})?$'
    )
  )
);

-- Who changed it last, and when.
create or replace function public.stamp_site_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.stamp_site_settings() from public, anon, authenticated;

drop trigger if exists stamp_site_settings on public.site_settings;
create trigger stamp_site_settings
  before insert or update on public.site_settings
  for each row execute function public.stamp_site_settings();

-- ---------------------------------------------------------------------------
-- Who may do what.
-- ---------------------------------------------------------------------------
alter table public.site_settings enable row level security;

drop policy if exists site_settings_public_read on public.site_settings;
drop policy if exists site_settings_staff_insert on public.site_settings;
drop policy if exists site_settings_staff_update on public.site_settings;

create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated
  using (true);

create policy site_settings_staff_insert on public.site_settings
  for insert to authenticated
  with check (public.is_staff_or_admin());

create policy site_settings_staff_update on public.site_settings
  for update to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

revoke all on public.site_settings from public, anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
grant all on public.site_settings to service_role;

-- The one row, with every value the site's own.
insert into public.site_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Reverse. Not run; copy into the SQL editor to undo this migration. The
-- site then shows the values built into it.
--
-- drop table if exists public.site_settings;
-- drop function if exists public.stamp_site_settings();
-- drop function if exists public.site_settings_hours_ok(jsonb);
-- drop function if exists public.site_settings_lines_ok(text[], integer, integer);
