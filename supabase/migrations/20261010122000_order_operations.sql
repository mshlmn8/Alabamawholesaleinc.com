-- Order operations for Admin -> Orders (AW-110, AW-111).
--
-- Staff search and filter the orders, print pick lists and packing slips,
-- export CSV, keep internal notes, assign an order to someone, see who
-- changed what, and see orders that came in since their last visit. Search,
-- print and export need nothing new from the database; this file adds the
-- rest:
--
--   (a) order_events: the history of an order's status and assignment, one
--       row per change, written only by the trigger in (d). Admins read it;
--       nobody inserts, changes or deletes rows through the API.
--   (b) order_admin_notes: internal notes about an order (1 to 2000
--       characters), admins only. They are a table of their own because the
--       customer reads every orders column through orders_self_read, and
--       row-level security can't hide a column.
--   (c) orders.assigned_to: the approved admin looking after an order (a
--       profile id, null when nobody is). It is the THIRD foreign key from
--       orders to profiles (after user_id and quoted_by), so every embed
--       from orders must keep naming profiles!orders_user_id_fkey(...). The
--       customer can read the column through orders_self_read: it is only a
--       staff id, and no internal text ever goes on orders. Plus an index on
--       orders.preferred_date for the "Deliver on" filter.
--   (d) log_order_change(): an AFTER UPDATE OF status, assigned_to trigger
--       that records each real change in order_events, with the acting
--       profile and, for a status, the note admin_set_order_status() passed
--       in (the transaction-local setting aw.order_note). A plain PATCH of
--       orders.status (the frontend deployed before this file, or
--       admin_price_order() moving a quote to 'quoted') is logged without a
--       note.
--   (e) admin_set_order_status(p_order_id, p_status, p_note default null)
--       returns { id, status, updated_at }. Admin only (42501, hint
--       admin_only); the status must be one of orders_status_chk's nine
--       (22023, hint invalid_status); 'cancelled' needs a reason (22023,
--       hint reason_required); a note is at most 2000 characters (22023,
--       hint note_too_long); an unknown order is P0002, hint
--       order_not_found.
--   (f) admin_order_views: when each admin last opened Admin -> Orders
--       (their own row only). admin_mark_orders_seen() records now() and
--       returns the PREVIOUS time (null the first time): Orders marks the
--       orders that came in after it as new, and the header counts the
--       orders after the stored time.
--   (g) Realtime: public.orders joins the supabase_realtime publication, so
--       Admin -> Orders hears new and changed orders at once. Realtime
--       honours row-level security: an admin passes orders_self_read
--       through is_admin(), a customer hears only their own orders. Skipped
--       where the publication doesn't exist (a plain Postgres, the tests).
--
-- Supabase's default privileges give anon and authenticated every privilege
-- on a new table, sequence or function: each one below is revoked and
-- granted explicitly, as for profile_admin_notes (20261009140000).
--
-- Release order: after 20261010121000 (or on its own after 20261009150000).
-- No seed change. The frontend deployed before it doesn't use any of this,
-- and its status PATCHes are logged without a note. The new frontend works
-- before and after: without this file, status changes fall back to the
-- plain update, "Staff notes and history" says it needs the update, the
-- "Assigned to" select is hidden, the new-order marker counts from the
-- first time Orders was opened in that tab (no header badge), and orders
-- refresh every minute instead of at once.

-- ---------------------------------------------------------------------------
-- (a) The history of an order's status and assignment.
-- ---------------------------------------------------------------------------
create table if not exists public.order_events (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  at timestamptz not null default now(),
  actor uuid default auth.uid() references public.profiles(id) on delete set null,
  kind text not null,
  from_value text,
  to_value text,
  note text,
  constraint order_events_kind_chk check (kind in ('status', 'assignment'))
);

create index if not exists order_events_order_idx on public.order_events (order_id, at desc);

alter table public.order_events enable row level security;

drop policy if exists order_events_admin_read on public.order_events;
create policy order_events_admin_read on public.order_events
  for select to authenticated
  using (public.is_admin());

-- No insert, update or delete for anyone through the API: the rows come
-- from log_order_change() (SECURITY DEFINER).
revoke all on public.order_events from public, anon, authenticated;
grant select on public.order_events to authenticated;
grant all on public.order_events to service_role;
revoke all on sequence public.order_events_id_seq from public, anon, authenticated;
grant usage, select on sequence public.order_events_id_seq to service_role;

-- ---------------------------------------------------------------------------
-- (b) Internal notes about an order: admins only. An admin writes notes in
-- their own name (author defaults to them and can't be someone else).
-- ---------------------------------------------------------------------------
create table if not exists public.order_admin_notes (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  author uuid default auth.uid() references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint order_admin_notes_body_chk check (length(btrim(body)) between 1 and 2000)
);

create index if not exists order_admin_notes_order_idx on public.order_admin_notes (order_id, created_at desc);

alter table public.order_admin_notes enable row level security;

drop policy if exists order_admin_notes_admin on public.order_admin_notes;
create policy order_admin_notes_admin on public.order_admin_notes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin() and author is not distinct from auth.uid());

revoke all on public.order_admin_notes from public, anon, authenticated;
grant select, insert, delete on public.order_admin_notes to authenticated;
grant all on public.order_admin_notes to service_role;
revoke all on sequence public.order_admin_notes_id_seq from public, anon, authenticated;
grant usage on sequence public.order_admin_notes_id_seq to authenticated;
grant usage, select on sequence public.order_admin_notes_id_seq to service_role;

-- ---------------------------------------------------------------------------
-- (c) Who looks after an order, and an index for "Deliver on".
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

create index if not exists orders_assigned_to_idx on public.orders (assigned_to);
create index if not exists orders_preferred_date_idx on public.orders (preferred_date);

-- ---------------------------------------------------------------------------
-- (d) Every status or assignment change is logged.
-- ---------------------------------------------------------------------------
create or replace function public.log_order_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(btrim(coalesce(current_setting('aw.order_note', true), '')), '');
  -- The acting profile; null for the SQL editor or the service role (and
  -- for a session without a profile, so the foreign key never fails).
  v_actor uuid := (select p.id from public.profiles p where p.id = auth.uid());
begin
  if new.status is distinct from old.status then
    insert into public.order_events (order_id, actor, kind, from_value, to_value, note)
    values (new.id, v_actor, 'status', old.status, new.status, v_note);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.order_events (order_id, actor, kind, from_value, to_value)
    values (new.id, v_actor, 'assignment', old.assigned_to::text, new.assigned_to::text);
  end if;
  return null;
end;
$$;

-- A trigger function: nobody calls it directly.
revoke all on function public.log_order_change() from public, anon, authenticated;

drop trigger if exists orders_log_change on public.orders;
create trigger orders_log_change
  after update of status, assigned_to on public.orders
  for each row execute function public.log_order_change();

-- ---------------------------------------------------------------------------
-- (e) A status change with a note (a reason, for a cancellation).
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_order_status(p_order_id uuid, p_status text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_row public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change orders' using errcode = '42501', hint = 'admin_only';
  end if;
  -- orders_status_chk's list (20261008200000).
  if v_status not in ('new', 'contacted', 'quoted', 'confirmed', 'picking', 'ready', 'out_for_delivery', 'fulfilled', 'cancelled') then
    raise exception 'Unknown order status %', p_status using errcode = '22023', hint = 'invalid_status';
  end if;
  if v_status = 'cancelled' and v_note is null then
    raise exception 'Give a reason for cancelling the order' using errcode = '22023', hint = 'reason_required';
  end if;
  if length(v_note) > 2000 then
    raise exception 'A note is at most 2000 characters' using errcode = '22023', hint = 'note_too_long';
  end if;

  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002', hint = 'order_not_found';
  end if;

  -- log_order_change() reads the note from this transaction-local setting.
  perform set_config('aw.order_note', coalesce(v_note, ''), true);
  update public.orders set status = v_status where id = p_order_id returning * into v_row;
  perform set_config('aw.order_note', '', true);

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'updated_at', v_row.updated_at);
end;
$$;

revoke all on function public.admin_set_order_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (f) When each admin last opened Admin -> Orders.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_order_views (
  admin_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  seen_at timestamptz not null
);

alter table public.admin_order_views enable row level security;

drop policy if exists admin_order_views_own on public.admin_order_views;
create policy admin_order_views_own on public.admin_order_views
  for select to authenticated
  using (admin_id = auth.uid() and public.is_admin());

-- Written only by admin_mark_orders_seen().
revoke all on public.admin_order_views from public, anon, authenticated;
grant select on public.admin_order_views to authenticated;
grant all on public.admin_order_views to service_role;

create or replace function public.admin_mark_orders_seen()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_previous timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only admins can mark orders seen' using errcode = '42501', hint = 'admin_only';
  end if;
  select seen_at into v_previous from public.admin_order_views where admin_id = v_uid for update;
  insert into public.admin_order_views (admin_id, seen_at) values (v_uid, now())
  on conflict (admin_id) do update set seen_at = excluded.seen_at;
  return v_previous;
end;
$$;

revoke all on function public.admin_mark_orders_seen() from public, anon;
grant execute on function public.admin_mark_orders_seen() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (g) Realtime for orders, where Supabase's publication exists.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this migration.
-- The frontend works without it, so no deploy is needed first (notes and
-- history then say they need the update, and status changes use the plain
-- update). Dropping the tables deletes the notes and the history.
--
-- do $$ begin
--   if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
--     alter publication supabase_realtime drop table public.orders;
--   end if;
-- end $$;
-- drop function if exists public.admin_mark_orders_seen();
-- drop table if exists public.admin_order_views;
-- drop function if exists public.admin_set_order_status(uuid, text, text);
-- drop trigger if exists orders_log_change on public.orders;
-- drop function if exists public.log_order_change();
-- drop index if exists public.orders_preferred_date_idx;
-- drop index if exists public.orders_assigned_to_idx;
-- alter table public.orders drop column if exists assigned_to;
-- drop table if exists public.order_admin_notes;
-- drop table if exists public.order_events;
