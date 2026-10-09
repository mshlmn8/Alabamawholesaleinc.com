-- Saved carts (AW-334): a signed-in buyer's cart follows the account to
-- another phone or computer.
--
-- The cart lives in the browser (src/lib/cartStorage.js, one per account on
-- each device), so a buyer who filled it on a phone found the computer's
-- empty. This file adds one row per account holding the cart's lines;
-- src/lib/cartSync.js reads it once a session is confirmed and writes it
-- back about 1.5 seconds after the last change:
--   - on a page load with a session, whichever of this row and the device's
--     copy changed last is kept (updated_at against the device's savedAt);
--     the two are never added together;
--   - when a buyer signs in with lines added as a guest, those lines are
--     added to the newer of the two once, then saved here.
--
-- public.carts, one row per account:
--   user_id     the account (auth.users); the row goes with the account
--   lines       the lines in the order they were added:
--               [["<line key>", <quantity>], …], at most 500. A line key is
--               a product id, or a product id and a variant slug
--               ('14', '1::white-grape', src/lib/lines.js); a quantity is a
--               whole number from 1 to 100,000 (the order line's limit).
--               Nothing else fits, so no price, name or note is ever stored
--               here: prices come from my_prices() when the cart is shown.
--   updated_at  when the cart last changed, as the device that changed it
--               says (its savedAt)
--
-- Who may do what (row-level security): each signed-in account reads,
-- adds, changes and deletes its own row only; guests have no access at all;
-- admins see no one's cart (the service role and the SQL editor still do).
--
-- Storing what is in a cart is a new use of buyers' data: the privacy
-- policy doesn't name it yet (owner question AW-334, docs/OWNER-TODO.md).
--
-- Release: any time, before or after the frontend, also on its own. The site
-- feature-detects the table: while it is missing (PostgREST answers 404 /
-- PGRST205, or 42P01) one request finds that out, carts stay on each device
-- as before, and the drawer and checkout keep saying so. The frontend
-- deployed before it doesn't read the table.

-- ---------------------------------------------------------------------------
-- What a stored cart may hold: a list of [line key, quantity] pairs and
-- nothing else. (A function, as a CHECK can't hold a subquery. Each step is
-- its own WHEN, so a value of the wrong type never reaches a function that
-- would raise on it.)
-- ---------------------------------------------------------------------------
create or replace function public.cart_lines_valid(p_lines jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_lines is null or jsonb_typeof(p_lines) <> 'array' then false
    when jsonb_array_length(p_lines) > 500 then false
    else not exists (
      select 1
      from jsonb_array_elements(p_lines) as e (line)
      where case
        when jsonb_typeof(e.line) <> 'array' then true
        when jsonb_array_length(e.line) <> 2 then true
        when jsonb_typeof(e.line -> 0) <> 'string' then true
        when char_length(e.line ->> 0) > 140 then true
        when (e.line ->> 0) !~ '^[1-9][0-9]{0,15}(::[a-z0-9]+(-[a-z0-9]+)*)?$' then true
        when jsonb_typeof(e.line -> 1) <> 'number' then true
        when (e.line ->> 1) !~ '^[0-9]{1,6}$' then true
        else (e.line ->> 1)::integer not between 1 and 100000
      end
    )
  end
$$;

-- The CHECK below runs it as the account that writes the row.
revoke all on function public.cart_lines_valid(jsonb) from public, anon;
grant execute on function public.cart_lines_valid(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The table.
-- ---------------------------------------------------------------------------
create table if not exists public.carts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  lines jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint carts_lines_chk check (public.cart_lines_valid(lines))
);

-- ---------------------------------------------------------------------------
-- Row-level security and privileges.
-- ---------------------------------------------------------------------------
alter table public.carts enable row level security;

drop policy if exists carts_select_own on public.carts;
create policy carts_select_own on public.carts
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists carts_insert_own on public.carts;
create policy carts_insert_own on public.carts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists carts_update_own on public.carts;
create policy carts_update_own on public.carts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists carts_delete_own on public.carts;
create policy carts_delete_own on public.carts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase's default privileges give anon and authenticated everything on a
-- new table: revoke them, then grant what the policies need.
revoke all on public.carts from public, anon, authenticated;
grant select, insert, update, delete on public.carts to authenticated;
grant all on public.carts to service_role;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this migration.
-- The frontend works without it: carts stay on each device, and the drawer
-- and checkout say so. Every saved cart is deleted with the table.
--
-- drop table if exists public.carts;
-- drop function if exists public.cart_lines_valid(jsonb);
