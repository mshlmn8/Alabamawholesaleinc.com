-- One quote workflow (AW-024): Cursor's staff pricing and conversion (PR #13)
-- together with lane p2's submit_quote v3.
--
-- 20261008200000_variant_prices_and_quote_workflow.sql (Cursor's, unchanged)
-- added the workflow: orders.kind ('quote' | 'order'); the statuses quoted,
-- confirmed, picking, ready and out_for_delivery; orders.quoted_at and
-- quoted_by; order_items.original_qty; the order-line trigger on INSERT only
-- (so a price staff set is kept); and admin_price_order() and
-- admin_convert_quote() for Admin -> Orders. 20261009130000_submit_quote_v3.sql
-- (lane p2) is the only way a quote or order is saved: it makes the
-- reference ('ALW-Q-' for a quote, 'ALW-O-' for an approved buyer's order),
-- checks and throttles, applies the tobacco license rule, and returns kind.
-- This file makes them one workflow, without new columns:
--
--   (a) kind means what submit_quote v3 says: 'order' when an approved
--       account placed it (the order trigger priced its lines), 'quote' for
--       a guest or an account that isn't approved (unpriced lines, an
--       ALW-Q- reference). Cursor's stamp_order_kind() said 'order' for
--       every signed-in account, so a pending account's request was an
--       "order" staff couldn't price as a quote or convert. Rows saved
--       before this file are realigned: an 'order' that no one priced and
--       no line of which has a price is a quote.
--   (b) quoted_by no longer stops an admin's profile from being deleted.
--   (c) admin_price_order(p_order_id, p_lines) is admin only and checks its
--       input: the order exists and isn't fulfilled or cancelled; each line
--       { item_id, qty, unit_price } belongs to it; qty is a whole number
--       from 0 (removes the line) to 100000; unit_price is null (no price)
--       or an amount from 0, rounded to cents; at least one line is left.
--       It recomputes total_units and subtotal (null when no line is
--       priced) and records quoted_at / quoted_by. A quote that is new or
--       contacted becomes 'quoted' ("Quote ready" on the customer's account
--       page); an order keeps its status, so a confirmed order corrected by
--       staff isn't sent back to "Quote ready". original_qty keeps the
--       quantity the customer asked for.
--   (d) admin_convert_quote(p_order_id, p_user_id default null) is admin
--       only and turns a quote into a confirmed order: it must be a quote,
--       not fulfilled or cancelled, with every line priced. p_user_id links
--       a guest quote to an existing account; a quote that already belongs
--       to another account is refused.
--   (e) Neither can be called by guests: Supabase's default privileges give
--       anon EXECUTE on new functions, and 20261008200000 revoked it only
--       from public.
--
-- Errors carry a typed hint, which Admin -> Orders maps to its own text
-- (orderActionError in src/pages/admin/AdminPage.jsx): admin_only,
-- order_not_found, order_closed, no_items, invalid_line, unknown_line,
-- not_a_quote, unpriced_lines, unknown_account, account_mismatch.
--
-- Release order: after 20261009140000, before the new frontend. The new
-- frontend also works before it (and before 20261008200000): without the
-- kind column it treats a guest's or an unpriced request as a quote, offers
-- only the old four statuses, and its "Save prices" and "Convert to order"
-- say the database update is needed; "Email the quote" works either way.
-- TODO(owner): Confirm how quotes should work: should staff price and answer guest quotes and convert them to orders, and should orders go through 'quoted' and 'confirmed' stages before picking? (AW-024)

-- ---------------------------------------------------------------------------
-- (a) kind follows the account's approval at submit time.
-- ---------------------------------------------------------------------------
create or replace function public.stamp_order_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- orders_header_guard has already set user_id to the caller (or null).
  if tg_op = 'INSERT' then
    new.kind := case
      when new.user_id is not null and exists (
        select 1 from public.profiles where id = new.user_id and status = 'approved'
      ) then 'order'
      else 'quote'
    end;
  end if;
  return new;
end;
$$;

-- A trigger function: nobody calls it directly.
revoke all on function public.stamp_order_kind() from public, anon, authenticated;

update public.orders as o
set kind = 'quote'
where o.kind = 'order'
  and o.quoted_at is null
  and not exists (
    select 1 from public.order_items i where i.order_id = o.id and i.unit_price is not null
  );

-- ---------------------------------------------------------------------------
-- (b) An admin's profile can be deleted; their quotes keep their prices.
-- ---------------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_quoted_by_fkey;
alter table public.orders
  add constraint orders_quoted_by_fkey
  foreign key (quoted_by) references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- (c) Staff set quantities and prices.
-- ---------------------------------------------------------------------------
create or replace function public.admin_price_order(p_order_id uuid, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_line jsonb;
  v_item_id bigint;
  v_qty integer;
  v_price numeric;
  v_units integer;
  v_priced integer;
  v_subtotal numeric;
begin
  if not public.is_admin() then
    raise exception using message = 'Admin only', errcode = '42501', hint = 'admin_only';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using message = 'Order not found', hint = 'order_not_found';
  end if;
  if v_order.status in ('fulfilled', 'cancelled') then
    raise exception using message = 'This order is closed', hint = 'order_closed';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception using message = 'Add the priced lines', hint = 'no_items';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    begin
      v_item_id := (v_line ->> 'item_id')::bigint;
      v_qty := (v_line ->> 'qty')::integer;
      v_price := (v_line ->> 'unit_price')::numeric;
    exception when others then
      raise exception using message = 'A line has an invalid quantity or price', hint = 'invalid_line';
    end;
    if v_item_id is null or v_qty is null or v_qty < 0 or v_qty > 100000
       or (v_price is not null and (v_price < 0 or v_price >= 100000000)) then
      raise exception using message = 'A line has an invalid quantity or price', hint = 'invalid_line';
    end if;
    if not exists (select 1 from public.order_items where id = v_item_id and order_id = p_order_id) then
      raise exception using message = 'That line is not on this order', hint = 'unknown_line';
    end if;

    if v_qty = 0 then
      delete from public.order_items where id = v_item_id and order_id = p_order_id;
    else
      update public.order_items
      set original_qty = coalesce(original_qty, qty),
          qty = v_qty,
          unit_price = round(v_price, 2)
      where id = v_item_id and order_id = p_order_id;
    end if;
  end loop;

  select coalesce(sum(qty), 0),
         count(*) filter (where unit_price is not null),
         sum(unit_price * qty)
    into v_units, v_priced, v_subtotal
  from public.order_items
  where order_id = p_order_id;
  if v_units = 0 then
    raise exception using message = 'An order needs at least one line', hint = 'no_items';
  end if;
  if v_priced = 0 then
    v_subtotal := null;
  end if;

  update public.orders
  set total_units = v_units,
      subtotal = v_subtotal,
      status = case
        when v_order.kind = 'quote' and v_order.status in ('new', 'contacted') then 'quoted'
        else v_order.status
      end,
      quoted_at = now(),
      quoted_by = auth.uid()
  where id = p_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- (d) A priced quote becomes a confirmed order.
-- ---------------------------------------------------------------------------
create or replace function public.admin_convert_quote(p_order_id uuid, p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception using message = 'Admin only', errcode = '42501', hint = 'admin_only';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using message = 'Order not found', hint = 'order_not_found';
  end if;
  if v_order.kind <> 'quote' then
    raise exception using message = 'This is already an order', hint = 'not_a_quote';
  end if;
  if v_order.status in ('fulfilled', 'cancelled') then
    raise exception using message = 'This order is closed', hint = 'order_closed';
  end if;
  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception using message = 'An order needs at least one line', hint = 'no_items';
  end if;
  if exists (select 1 from public.order_items where order_id = p_order_id and unit_price is null) then
    raise exception using message = 'Price every line before converting', hint = 'unpriced_lines';
  end if;
  if p_user_id is not null then
    if not exists (select 1 from public.profiles where id = p_user_id) then
      raise exception using message = 'No account with that id', hint = 'unknown_account';
    end if;
    if v_order.user_id is not null and v_order.user_id <> p_user_id then
      raise exception using message = 'This quote belongs to another account', hint = 'account_mismatch';
    end if;
  end if;

  update public.orders
  set kind = 'order',
      status = 'confirmed',
      user_id = coalesce(p_user_id, user_id)
  where id = p_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- (e) Admins only (is_admin() inside); no EXECUTE for guests.
-- ---------------------------------------------------------------------------
revoke all on function public.admin_price_order(uuid, jsonb) from public, anon;
revoke all on function public.admin_convert_quote(uuid, uuid) from public, anon;
grant execute on function public.admin_price_order(uuid, jsonb) to authenticated, service_role;
grant execute on function public.admin_convert_quote(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration. The frontend keeps working after it. Rows realigned in (a)
-- stay quotes.
--
-- create or replace function public.stamp_order_kind() ... -- the
--   20261008200000 definition (user_id is null -> 'quote', else 'order')
-- alter table public.orders drop constraint if exists orders_quoted_by_fkey;
-- alter table public.orders add constraint orders_quoted_by_fkey
--   foreign key (quoted_by) references public.profiles(id);
-- create or replace function public.admin_price_order(uuid, jsonb) ... -- the
--   20261008200000 definition
-- create or replace function public.admin_convert_quote(uuid, uuid) ... -- the
--   20261008200000 definition
