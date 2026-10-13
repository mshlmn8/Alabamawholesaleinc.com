-- Admin -> Orders' database side (20261010122000_order_operations.sql,
-- AW-110, AW-111): a status change through admin_set_order_status() is
-- logged with its note, a plain update without one, and a cancellation
-- needs a reason; an assignment is logged; staff notes and the history are
-- for admins only; admin_mark_orders_seen() returns the previous visit, and
-- each admin reads only their own.
-- Test accounts ...0ad3a1 (approved admin), ...0ad3a2 (a second approved
-- admin), ...0ad3b1 (approved customer). Orders are made here (their lines
-- don't matter) and removed at the end, with everything that hangs off them.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000ad3a1', 'adm15-admin@example.com', '{"name": "Adm15 Admin"}'),
  ('00000000-0000-4000-8000-0000000ad3a2', 'adm15-second@example.com', '{"name": "Adm15 Second"}'),
  ('00000000-0000-4000-8000-0000000ad3b1', 'adm15-buyer@example.com', '{"name": "Adm15 Buyer"}');
update public.profiles set status = 'approved', role = 'admin'
  where id in ('00000000-0000-4000-8000-0000000ad3a1', '00000000-0000-4000-8000-0000000ad3a2');
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000ad3b1';

-- The hint (or, without one, the SQLSTATE) a statement fails with; null when
-- it succeeds. (pg_temp lives for the whole run: the adm15_ prefix keeps it
-- apart from other files' helpers.)
create or replace function pg_temp.adm15_fails(statement text) returns text language plpgsql as $$
declare h text; c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics h = pg_exception_hint, c = returned_sqlstate;
  return coalesce(nullif(h, ''), c);
end $$;

-- The SQLSTATE only.
create or replace function pg_temp.adm15_state(statement text) returns text language plpgsql as $$
declare c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics c = returned_sqlstate;
  return c;
end $$;

-- Two orders: one of the customer's, one guest quote. (The insert guard
-- makes them 'new' and ownerless; the owner is set afterwards.)
insert into public.orders (id, ref_num, business, contact, email, phone, delivery) values
  ('00000000-0000-4000-8000-0000000ad3c1', 'ALW-O-ADM15A0001', 'Adm15 Market', 'Adm15 Buyer', 'adm15-buyer@example.com', '205-555-0150', 'delivery'),
  ('00000000-0000-4000-8000-0000000ad3c2', 'ALW-Q-ADM15A0002', 'Adm15 Guest', 'Adm15 Guest', 'adm15-guest@example.com', '205-555-0151', 'willcall');
update public.orders set user_id = '00000000-0000-4000-8000-0000000ad3b1' where id = '00000000-0000-4000-8000-0000000ad3c1';

do $$ begin
  assert (select count(*) from public.order_events where order_id in ('00000000-0000-4000-8000-0000000ad3c1', '00000000-0000-4000-8000-0000000ad3c2')) = 0,
    'changing the owner logs nothing';
end $$;

-- ---------------------------------------------------------------------------
-- A status change through the function is logged with its note and actor.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000ad3a1');
do $$
declare result jsonb;
begin
  result := public.admin_set_order_status('00000000-0000-4000-8000-0000000ad3c1', 'contacted', '  Called the store  ');
  assert result ->> 'status' = 'contacted', format('returns the new status: %s', result);
  assert result ->> 'id' = '00000000-0000-4000-8000-0000000ad3c1', 'returns the id';
  assert result ? 'updated_at', 'returns updated_at';
end $$;
select test_reset();

do $$
declare e public.order_events;
begin
  select * into e from public.order_events where order_id = '00000000-0000-4000-8000-0000000ad3c1' order by id desc limit 1;
  assert e.kind = 'status' and e.from_value = 'new' and e.to_value = 'contacted', format('the change is logged: %s', row_to_json(e));
  assert e.note = 'Called the store', 'with its note, trimmed';
  assert e.actor = '00000000-0000-4000-8000-0000000ad3a1', 'and who made it';
  assert (select status from public.orders where id = '00000000-0000-4000-8000-0000000ad3c1') = 'contacted', 'the order changed';
end $$;

-- A plain update (the frontend deployed before this migration) is logged
-- without a note.
select test_login('00000000-0000-4000-8000-0000000ad3a1');
update public.orders set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000ad3c1';
-- Setting the same status again is not a change.
update public.orders set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000ad3c1';
select test_reset();

do $$
declare e public.order_events;
begin
  assert (select count(*) from public.order_events where order_id = '00000000-0000-4000-8000-0000000ad3c1') = 2, 'one event per real change';
  select * into e from public.order_events where order_id = '00000000-0000-4000-8000-0000000ad3c1' order by id desc limit 1;
  assert e.from_value = 'contacted' and e.to_value = 'confirmed', format('the plain update is logged: %s', row_to_json(e));
  assert e.note is null, 'without a note';
  assert e.actor = '00000000-0000-4000-8000-0000000ad3a1', 'by the admin who sent it';
end $$;

-- Refusals: a cancellation needs a reason, the status must be a real one,
-- the order must exist, a note is at most 2000 characters.
select test_login('00000000-0000-4000-8000-0000000ad3a1');
do $$ begin
  assert pg_temp.adm15_fails($s$select public.admin_set_order_status('00000000-0000-4000-8000-0000000ad3c1', 'cancelled')$s$) = 'reason_required',
    'cancelling without a reason is refused';
  assert pg_temp.adm15_fails($s$select public.admin_set_order_status('00000000-0000-4000-8000-0000000ad3c1', 'cancelled', '   ')$s$) = 'reason_required',
    'a blank reason is no reason';
  assert pg_temp.adm15_state($s$select public.admin_set_order_status('00000000-0000-4000-8000-0000000ad3c1', 'cancelled')$s$) = '22023', 'with 22023';
  assert pg_temp.adm15_fails($s$select public.admin_set_order_status('00000000-0000-4000-8000-0000000ad3c1', 'shipped')$s$) = 'invalid_status',
    'an unknown status is refused';
  assert pg_temp.adm15_fails($s$select public.admin_set_order_status('00000000-0000-4000-8000-0000000ad3ff', 'picking')$s$) = 'order_not_found',
    'an unknown order is refused';
  assert pg_temp.adm15_fails(format('select public.admin_set_order_status(%L, %L, %L)', '00000000-0000-4000-8000-0000000ad3c1', 'picking', repeat('x', 2001))) = 'note_too_long',
    'a note over 2000 characters is refused';
end $$;
select test_reset();

do $$ begin
  assert (select status from public.orders where id = '00000000-0000-4000-8000-0000000ad3c1') = 'confirmed', 'nothing changed';
  assert (select count(*) from public.order_events where order_id = '00000000-0000-4000-8000-0000000ad3c1') = 2, 'and nothing was logged';
end $$;

-- With a reason, the cancellation goes through and keeps the reason; the
-- reason doesn't stick to a later plain update in the same transaction.
select test_login('00000000-0000-4000-8000-0000000ad3a1');
select public.admin_set_order_status('00000000-0000-4000-8000-0000000ad3c2', 'Cancelled', 'Duplicate of an earlier quote');
update public.orders set status = 'new' where id = '00000000-0000-4000-8000-0000000ad3c2';
select test_reset();

do $$ begin
  assert (select note from public.order_events where order_id = '00000000-0000-4000-8000-0000000ad3c2' and to_value = 'cancelled') = 'Duplicate of an earlier quote',
    'the reason is kept';
  assert (select note is null from public.order_events where order_id = '00000000-0000-4000-8000-0000000ad3c2' and to_value = 'new'), 'the next plain update has no note';
end $$;

-- ---------------------------------------------------------------------------
-- An assignment is logged.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000ad3a1');
update public.orders set assigned_to = '00000000-0000-4000-8000-0000000ad3a2' where id = '00000000-0000-4000-8000-0000000ad3c1';
update public.orders set assigned_to = null where id = '00000000-0000-4000-8000-0000000ad3c2';
select test_reset();

do $$
declare e public.order_events;
begin
  select * into e from public.order_events where order_id = '00000000-0000-4000-8000-0000000ad3c1' and kind = 'assignment';
  assert e.from_value is null and e.to_value = '00000000-0000-4000-8000-0000000ad3a2', format('the assignment is logged: %s', row_to_json(e));
  assert e.actor = '00000000-0000-4000-8000-0000000ad3a1', 'by the admin who made it';
  assert (select count(*) from public.order_events where order_id = '00000000-0000-4000-8000-0000000ad3c2' and kind = 'assignment') = 0,
    'unassigning an unassigned order is not a change';
end $$;

-- ---------------------------------------------------------------------------
-- Staff notes: admins add and read them, in their own name.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000ad3a1');
insert into public.order_admin_notes (order_id, body) values ('00000000-0000-4000-8000-0000000ad3c1', 'Gate code 1234, ask for Sam');
do $$ begin
  assert (select count(*) from public.order_admin_notes where order_id = '00000000-0000-4000-8000-0000000ad3c1') = 1, 'the admin reads the note';
  assert (select author from public.order_admin_notes where order_id = '00000000-0000-4000-8000-0000000ad3c1') = '00000000-0000-4000-8000-0000000ad3a1',
    'written in their name';
  assert (select count(*) from public.order_events where order_id = '00000000-0000-4000-8000-0000000ad3c1') = 3, 'the admin reads the history';
  assert pg_temp.adm15_state($s$insert into public.order_admin_notes (order_id, body) values ('00000000-0000-4000-8000-0000000ad3c1', '   ')$s$) = '23514',
    'a blank note is refused';
  assert pg_temp.adm15_state(format('insert into public.order_admin_notes (order_id, body) values (%L, %L)', '00000000-0000-4000-8000-0000000ad3c1', repeat('x', 2001))) = '23514',
    'a note over 2000 characters is refused';
  assert pg_temp.adm15_state($s$insert into public.order_admin_notes (order_id, author, body) values ('00000000-0000-4000-8000-0000000ad3c1', '00000000-0000-4000-8000-0000000ad3a2', 'In your name')$s$) = '42501',
    'a note can''t be written in another admin''s name';
  assert pg_temp.adm15_state($s$update public.order_admin_notes set body = 'Changed'$s$) = '42501', 'notes aren''t edited';
  assert pg_temp.adm15_state($s$insert into public.order_events (order_id, kind) values ('00000000-0000-4000-8000-0000000ad3c1', 'status')$s$) = '42501',
    'nobody writes the history by hand';
  assert pg_temp.adm15_state($s$delete from public.order_events$s$) = '42501', 'or deletes it';
end $$;
select test_reset();

-- A second admin reads the same notes.
select test_login('00000000-0000-4000-8000-0000000ad3a2');
do $$ begin
  assert (select count(*) from public.order_admin_notes where order_id = '00000000-0000-4000-8000-0000000ad3c1') = 1, 'every admin reads the notes';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- Customers: no status function, no history, no notes. They still read their
-- own order, assigned_to included (only a staff id).
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000ad3b1');
do $$ begin
  assert pg_temp.adm15_state($s$select public.admin_set_order_status('00000000-0000-4000-8000-0000000ad3c1', 'picking')$s$) = '42501',
    'a customer can''t call admin_set_order_status';
  assert pg_temp.adm15_fails($s$select public.admin_set_order_status('00000000-0000-4000-8000-0000000ad3c1', 'picking')$s$) = 'admin_only', 'hint admin_only';
  assert (select count(*) from public.order_events) = 0, 'a customer reads no history, not even their order''s';
  assert (select count(*) from public.order_admin_notes) = 0, 'and no notes';
  assert pg_temp.adm15_state($s$insert into public.order_admin_notes (order_id, body) values ('00000000-0000-4000-8000-0000000ad3c1', 'Hello')$s$) = '42501',
    'a customer can''t add a note';
  assert (select assigned_to from public.orders where id = '00000000-0000-4000-8000-0000000ad3c1') = '00000000-0000-4000-8000-0000000ad3a2',
    'the customer reads their order''s assignee id';
  assert pg_temp.adm15_state('select public.admin_mark_orders_seen()') = '42501', 'a customer can''t mark orders seen';
  assert (select count(*) from public.admin_order_views) = 0, 'or read anyone''s visits';
end $$;
select test_reset();

do $$ begin
  assert (select status from public.orders where id = '00000000-0000-4000-8000-0000000ad3c1') = 'confirmed', 'the customer changed nothing';
  assert not has_function_privilege('anon', 'public.admin_set_order_status(uuid, text, text)', 'execute'), 'guests can''t call admin_set_order_status';
  assert not has_function_privilege('anon', 'public.admin_mark_orders_seen()', 'execute'), 'or admin_mark_orders_seen';
  assert not has_function_privilege('authenticated', 'public.log_order_change()', 'execute'), 'nobody calls the trigger function';
  assert not has_table_privilege('anon', 'public.order_admin_notes', 'select'), 'guests have no privilege on the notes';
  assert not has_table_privilege('anon', 'public.order_events', 'select'), 'or the history';
  assert not has_table_privilege('authenticated', 'public.order_events', 'insert'), 'signed-in accounts can''t insert history';
  assert not has_table_privilege('authenticated', 'public.order_admin_notes', 'update'), 'or update notes';
  assert not has_table_privilege('authenticated', 'public.admin_order_views', 'insert'), 'or write a visit';
end $$;

-- ---------------------------------------------------------------------------
-- The last visit: null the first time, then the earlier time. Each admin
-- reads only their own row.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000ad3a1');
do $$
declare first timestamptz; stored timestamptz; second timestamptz;
begin
  first := public.admin_mark_orders_seen();
  assert first is null, 'the first visit has no previous one';
  select seen_at into stored from public.admin_order_views where admin_id = '00000000-0000-4000-8000-0000000ad3a1';
  assert stored is not null, 'the visit is stored, and the admin reads it';
  second := public.admin_mark_orders_seen();
  assert second = stored, format('the next visit returns the earlier one: %s, %s', second, stored);
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000ad3a2');
do $$ begin
  assert (select count(*) from public.admin_order_views) = 0, 'another admin can''t read that visit';
  assert public.admin_mark_orders_seen() is null, 'and has a first visit of their own';
  assert (select count(*) from public.admin_order_views) = 1, 'then reads only their own row';
end $$;
select test_reset();

-- Leave the shared database as later test files expect it.
delete from public.orders where id in ('00000000-0000-4000-8000-0000000ad3c1', '00000000-0000-4000-8000-0000000ad3c2');
delete from public.admin_order_views where admin_id in ('00000000-0000-4000-8000-0000000ad3a1', '00000000-0000-4000-8000-0000000ad3a2');
do $$ begin
  assert (select count(*) from public.order_events where order_id in ('00000000-0000-4000-8000-0000000ad3c1', '00000000-0000-4000-8000-0000000ad3c2')) = 0,
    'the history went with its orders';
  assert (select count(*) from public.order_admin_notes where order_id = '00000000-0000-4000-8000-0000000ad3c1') = 0, 'and so did the notes';
end $$;
