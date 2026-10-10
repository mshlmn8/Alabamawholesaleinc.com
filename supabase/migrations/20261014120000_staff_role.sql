-- Staff accounts (AW-030, AW-031; owner answer 2026-10): the owner and any
-- staff account run the website from Admin. A new role, 'staff', can do
-- everything in the admin area except change roles and pricing tiers, which
-- stay with approved admins.
--
--   (a) profiles.role may be 'customer', 'staff' or 'admin'.
--   (b) is_staff_or_admin(): true for an APPROVED admin or staff account,
--       like is_admin() for admins (AW-352): a pending or suspended staff
--       account is no staff member.
--   (c) The profile guard (a_protect_profile_columns, protect_profile_columns
--       of 20261009140000) gets the staff rules. Approved staff may change
--       a customer's account (status, verification note, contact and store
--       details) like an admin, but never:
--         - an account's role (42501, hint role_admin_only)
--         - an account's pricing tier (42501, hint tier_admin_only)
--         - anything on another staff or admin account (42501, hint
--           staff_account), so staff can't suspend the owner
--       On their own account staff are customers: name, phone and the store
--       address only, silently, as before. Admins keep their rules.
--   (d) Every policy that let approved admins in now lets approved staff in
--       too: profiles, profile documents, notes and history, products and
--       their variant prices, orders, order lines, events and notes, the
--       admin's last visit to Orders, the home page's photos, and in Storage
--       the license documents (read) and the product-images bucket (write).
--       pricing_tiers stays admin-only to write (pricing_tiers_admin_write,
--       unchanged); staff read it like an approved buyer.
--   (e) The admin functions (list prices, pricing and converting a quote,
--       bulk price changes, CSV import, order status, marking orders seen)
--       check is_staff_or_admin() instead of is_admin(). Each is its latest
--       definition with only that call changed (scripts/staff-role.test.mjs
--       checks it word for word); grants are unchanged and restated.
--
-- is_admin() is unchanged: true only for an approved admin. It still guards
-- the pricing tiers and the admin's own rules in the profile guard.
--
-- Release order: after 20261014111000. Apply it before or after the
-- frontend: the new frontend only offers the Staff role and shows staff the
-- admin area once an account has it, and a database without this file
-- refuses the role (profiles_role_chk), which Admin -> Accounts reports as
-- needing this update. The frontend deployed before it shows no admin link to
-- a staff account (it checks role = 'admin').

-- ---------------------------------------------------------------------------
-- (a) The role list.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_chk;
alter table public.profiles add constraint profiles_role_chk check (role in ('customer', 'staff', 'admin'));

-- ---------------------------------------------------------------------------
-- (b) An approved admin or staff account. Security definer like is_admin(),
-- so policies on profiles can call it without recursing; anon keeps EXECUTE
-- because policies without a role list evaluate it for guests too (false).
-- ---------------------------------------------------------------------------
create or replace function public.is_staff_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'staff') and status = 'approved' from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_staff_or_admin() from public;
grant execute on function public.is_staff_or_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (c) The profile guard. auth.uid() is null in the SQL editor, for the
-- service role and for the auth server: those may change anything.
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
  v_admin boolean;
begin
  if v_uid is null then
    return new;
  end if;

  v_admin := public.is_admin();
  -- Customers, accounts that aren't approved, and staff on their own
  -- account: only the self-editable columns change; every other column keeps
  -- its old value.
  if not v_admin and not (old.id <> v_uid and public.is_staff_or_admin()) then
    return jsonb_populate_record(new, to_jsonb(old) - v_self_editable);
  end if;

  if old.id = v_uid
     and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'You can''t change your own role or status'
      using errcode = '42501', hint = 'own_role_status';
  end if;
  -- Approved staff on another account.
  if not v_admin then
    if new.role is distinct from old.role then
      raise exception 'Only an admin can change an account''s role'
        using errcode = '42501', hint = 'role_admin_only';
    end if;
    if new.pricing_tier is distinct from old.pricing_tier then
      raise exception 'Only an admin can change an account''s pricing tier'
        using errcode = '42501', hint = 'tier_admin_only';
    end if;
    if old.role in ('admin', 'staff')
       and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
      raise exception 'Only an admin can change a staff or admin account'
        using errcode = '42501', hint = 'staff_account';
    end if;
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

-- A trigger function: nobody calls it directly.
revoke all on function public.protect_profile_columns() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- (d) The policies. Each keeps its name, command and roles; only
-- is_admin() becomes is_staff_or_admin().
-- ---------------------------------------------------------------------------
alter policy profiles_self_read on public.profiles
  using (auth.uid() = id or public.is_staff_or_admin());
alter policy profiles_admin_update on public.profiles
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

alter policy profile_documents_self_select on public.profile_documents
  using (auth.uid() = profile_id or public.is_staff_or_admin());
alter policy profile_document_history_admin_read on public.profile_document_history
  using (public.is_staff_or_admin());
alter policy profile_status_log_admin_read on public.profile_status_log
  using (public.is_staff_or_admin());
alter policy profile_admin_notes_admin on public.profile_admin_notes
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

alter policy products_admin_read_inactive on public.products
  using (public.is_staff_or_admin());
alter policy products_admin_write on public.products
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());
alter policy product_variant_prices_admin_read on public.product_variant_prices
  using (public.is_staff_or_admin());
alter policy product_variant_prices_admin_insert on public.product_variant_prices
  with check (public.is_staff_or_admin());
alter policy product_variant_prices_admin_update on public.product_variant_prices
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());
alter policy product_variant_prices_admin_delete on public.product_variant_prices
  using (public.is_staff_or_admin());

-- Staff read the tiers (Admin -> Accounts names each account's tier) as any
-- approved account does; only admins change them (pricing_tiers_admin_write
-- is unchanged).
alter policy pricing_tiers_read on public.pricing_tiers
  using (public.is_staff_or_admin() or public.is_approved_buyer());

alter policy orders_self_read on public.orders
  using (auth.uid() = user_id or public.is_staff_or_admin());
alter policy orders_admin_update on public.orders
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());
alter policy order_items_read on public.order_items
  using (
    public.is_staff_or_admin() or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );
alter policy order_events_admin_read on public.order_events
  using (public.is_staff_or_admin());
alter policy order_admin_notes_admin on public.order_admin_notes
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin() and author is not distinct from auth.uid());
alter policy admin_order_views_own on public.admin_order_views
  using (admin_id = auth.uid() and public.is_staff_or_admin());

alter policy home_slides_admin_read on public.home_slides
  using (public.is_staff_or_admin());
alter policy home_slides_admin_insert on public.home_slides
  with check (public.is_staff_or_admin());
alter policy home_slides_admin_update on public.home_slides
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());
alter policy home_slides_admin_delete on public.home_slides
  using (public.is_staff_or_admin());

-- Storage, dropped and created again as 20260927180000 and 20261010120000
-- made them.
drop policy if exists application_documents_read on storage.objects;
create policy application_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'application-documents'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or public.is_staff_or_admin()
    )
  );

drop policy if exists product_images_admin_read on storage.objects;
drop policy if exists product_images_admin_insert on storage.objects;
drop policy if exists product_images_admin_update on storage.objects;
drop policy if exists product_images_admin_delete on storage.objects;

create policy product_images_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and public.is_staff_or_admin());

create policy product_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_staff_or_admin());

create policy product_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_staff_or_admin())
  with check (bucket_id = 'product-images' and public.is_staff_or_admin());

create policy product_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_staff_or_admin());

-- ---------------------------------------------------------------------------
-- (e) The admin functions, each its latest definition with is_staff_or_admin()
-- for is_admin(): admin_product_prices (20261009110000), admin_price_order
-- and admin_convert_quote (20261009150000), admin_bulk_adjust_prices and
-- admin_import_products (20261010121000), admin_set_order_status and
-- admin_mark_orders_seen (20261010122000), admin_import_products_v2
-- (20261012140000). Their messages still say "admins"; the hint
-- (admin_only) is what the site reads.
-- ---------------------------------------------------------------------------

create or replace function public.admin_product_prices()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff_or_admin() then
    raise exception 'Only admins can read list prices' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(p.id::text, jsonb_build_object(
      'list', p.price,
      'variants', coalesce((
        select jsonb_object_agg(vp.variant, jsonb_build_object('list', vp.price))
        from public.product_variant_prices vp
        where vp.product_id = p.id
      ), '{}'::jsonb)
    ))
    from public.products p
  ), '{}'::jsonb);
end;
$$;

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
  if not public.is_staff_or_admin() then
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

create or replace function public.admin_convert_quote(p_order_id uuid, p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  if not public.is_staff_or_admin() then
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

create or replace function public.admin_bulk_adjust_prices(
  p_ids integer[],
  p_pct numeric default 0,
  p_amount numeric default 0,
  p_variants boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids integer[];
  v_bad text;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_variants integer := 0;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Only admins can change prices' using errcode = '42501', hint = 'admin_only';
  end if;

  v_ids := array(select distinct x from unnest(coalesce(p_ids, '{}'::integer[])) as t(x) where x is not null);
  if cardinality(v_ids) = 0 or cardinality(v_ids) > 1000 then
    raise exception 'Choose from 1 to 1000 products' using errcode = '22023', hint = 'invalid_input';
  end if;
  if p_pct is null or p_amount is null or p_pct <= -100 or p_pct > 1000 or abs(p_amount) > 99999.99 then
    raise exception 'The change must be above -100%% and at most 1000%%, and at most 99,999.99 either way'
      using errcode = '22023', hint = 'invalid_input';
  end if;

  -- Every new price is checked before anything is written.
  select string_agg(p.id::text, ', ' order by p.id) into v_bad
  from public.products p
  where p.id = any(v_ids) and p.price is not null
    and round(p.price * (1 + p_pct / 100) + p_amount, 2) not between 0 and 99999.99;
  if v_bad is null and coalesce(p_variants, true) then
    select string_agg(distinct vp.product_id::text, ', ') into v_bad
    from public.product_variant_prices vp
    where vp.product_id = any(v_ids) and vp.price is not null
      and round(vp.price * (1 + p_pct / 100) + p_amount, 2) not between 0 and 99999.99;
  end if;
  if v_bad is not null then
    raise exception 'A new price would be below 0 or above 99,999.99 (products %); nothing was changed', v_bad
      using errcode = '22003', hint = 'price_out_of_range', detail = v_bad;
  end if;

  update public.products p
  set price = round(p.price * (1 + p_pct / 100) + p_amount, 2)
  where p.id = any(v_ids) and p.price is not null;
  get diagnostics v_updated = row_count;

  select count(*) into v_skipped from public.products p where p.id = any(v_ids) and p.price is null;

  if coalesce(p_variants, true) then
    update public.product_variant_prices vp
    set price = round(vp.price * (1 + p_pct / 100) + p_amount, 2)
    where vp.product_id = any(v_ids) and vp.price is not null;
    get diagnostics v_variants = row_count;
  end if;

  return jsonb_build_object('updated', v_updated, 'skipped', v_skipped, 'variants', v_variants);
end;
$$;

create or replace function public.admin_import_products(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_sku text;
  v_tag text;
  v_found integer;
  v_count integer := 0;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Only admins can import products' using errcode = '42501', hint = 'admin_only';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Send from 1 to 1000 rows' using errcode = '22023', hint = 'invalid_input';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) <> 'object' or nullif(btrim(v_row ->> 'sku'), '') is null then
      raise exception 'Every row needs a SKU' using errcode = '22023', hint = 'invalid_input';
    end if;
    v_sku := upper(btrim(v_row ->> 'sku'));
    -- products.tag has no check of its own: the import keeps it to the four.
    v_tag := nullif(btrim(v_row ->> 'tag'), '');
    if v_row ? 'tag' and v_tag is not null and v_tag not in ('BESTSELLER', 'NEW', 'DEAL', 'PREMIUM') then
      raise exception 'Unknown tag % for SKU %', v_tag, v_row ->> 'sku' using errcode = '22023', hint = 'invalid_input', detail = v_row ->> 'sku';
    end if;

    update public.products p set
      name = case when v_row ? 'name' then v_row ->> 'name' else p.name end,
      brand = case when v_row ? 'brand' then v_row ->> 'brand' else p.brand end,
      sell_unit = case when v_row ? 'sell_unit' then coalesce(v_row ->> 'sell_unit', '') else p.sell_unit end,
      description = case when v_row ? 'description' then coalesce(v_row ->> 'description', '') else p.description end,
      price = case when v_row ? 'price' then (v_row ->> 'price')::numeric else p.price end,
      tag = case when v_row ? 'tag' then v_tag else p.tag end,
      active = case when v_row ? 'active' then (v_row ->> 'active')::boolean else p.active end,
      stock_status = case when v_row ? 'stock_status' then v_row ->> 'stock_status' else p.stock_status end,
      featured_rank = case when v_row ? 'featured_rank' then (v_row ->> 'featured_rank')::integer else p.featured_rank end
    where upper(btrim(p.sku)) = v_sku;
    get diagnostics v_found = row_count;

    if v_found = 0 then
      raise exception 'No product has the SKU %; nothing was imported', v_row ->> 'sku'
        using errcode = 'P0002', hint = 'unknown_sku', detail = v_row ->> 'sku';
    end if;
    v_count := v_count + v_found;
  end loop;

  return v_count;
end;
$$;

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
  if not public.is_staff_or_admin() then
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
  if not public.is_staff_or_admin() then
    raise exception 'Only admins can mark orders seen' using errcode = '42501', hint = 'admin_only';
  end if;
  select seen_at into v_previous from public.admin_order_views where admin_id = v_uid for update;
  insert into public.admin_order_views (admin_id, seen_at) values (v_uid, now())
  on conflict (admin_id) do update set seen_at = excluded.seen_at;
  return v_previous;
end;
$$;

create or replace function public.admin_import_products_v2(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_sku text;
  v_tag text;
  v_found integer;
  v_twice text;
  v_updated integer := 0;
  v_created integer := 0;
  v_name text;
  v_brand text;
  v_cat text;
  v_sub text;
  v_price numeric;
  v_variants jsonb;
begin
  if not public.is_staff_or_admin() then
    raise exception 'Only admins can import products' using errcode = '42501', hint = 'admin_only';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Send from 1 to 1000 rows' using errcode = '22023', hint = 'invalid_input';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) as r(value)
    where jsonb_typeof(r.value) <> 'object' or nullif(btrim(r.value ->> 'sku'), '') is null
  ) then
    raise exception 'Every row needs a SKU' using errcode = '22023', hint = 'invalid_input';
  end if;

  -- A SKU listed twice would change one product twice (or add it twice).
  select upper(btrim(r.value ->> 'sku')) into v_twice
  from jsonb_array_elements(p_rows) as r(value)
  group by 1 having count(*) > 1
  order by 1 limit 1;
  if v_twice is not null then
    raise exception 'The SKU % is listed more than once; nothing was imported', v_twice
      using errcode = '22023', hint = 'duplicate_sku', detail = v_twice;
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_sku := upper(btrim(v_row ->> 'sku'));
    -- products.tag has no check of its own: the import keeps it to the four.
    v_tag := nullif(btrim(v_row ->> 'tag'), '');
    if v_row ? 'tag' and v_tag is not null and v_tag not in ('BESTSELLER', 'NEW', 'DEAL', 'PREMIUM') then
      raise exception 'Unknown tag % for SKU %', v_tag, v_row ->> 'sku' using errcode = '22023', hint = 'invalid_input', detail = v_row ->> 'sku';
    end if;

    -- (a) A product with this SKU: updated as by v1.
    update public.products p set
      name = case when v_row ? 'name' then v_row ->> 'name' else p.name end,
      brand = case when v_row ? 'brand' then v_row ->> 'brand' else p.brand end,
      sell_unit = case when v_row ? 'sell_unit' then coalesce(v_row ->> 'sell_unit', '') else p.sell_unit end,
      description = case when v_row ? 'description' then coalesce(v_row ->> 'description', '') else p.description end,
      price = case when v_row ? 'price' then (v_row ->> 'price')::numeric else p.price end,
      tag = case when v_row ? 'tag' then v_tag else p.tag end,
      active = case when v_row ? 'active' then (v_row ->> 'active')::boolean else p.active end,
      stock_status = case when v_row ? 'stock_status' then v_row ->> 'stock_status' else p.stock_status end,
      featured_rank = case when v_row ? 'featured_rank' then (v_row ->> 'featured_rank')::integer else p.featured_rank end
    where upper(btrim(p.sku)) = v_sku;
    get diagnostics v_found = row_count;
    if v_found > 0 then
      v_updated := v_updated + v_found;
      continue;
    end if;

    -- (c) No such product, and not enough to add one.
    v_name := btrim(coalesce(v_row ->> 'name', ''));
    v_brand := btrim(coalesce(v_row ->> 'brand', ''));
    v_cat := btrim(coalesce(v_row ->> 'cat', ''));
    v_sub := btrim(coalesce(v_row ->> 'sub', ''));
    if v_name = '' or v_brand = '' or v_cat = '' or v_sub = '' then
      raise exception 'No product has the SKU %, and the row lacks the name, brand, department or sub-line a new one needs; nothing was imported', v_row ->> 'sku'
        using errcode = 'P0002', hint = 'unknown_sku', detail = v_row ->> 'sku';
    end if;

    -- (b) A new product, checked like the editor checks one.
    if v_sku !~ '^[A-Z0-9][A-Z0-9-]{1,40}$' then
      raise exception 'The SKU % must be 2 to 41 capital letters, digits and hyphens', v_row ->> 'sku'
        using errcode = '22023', hint = 'invalid_input', detail = v_row ->> 'sku';
    end if;
    if length(v_name) > 200 or length(v_brand) > 200 or length(v_sub) > 60 then
      raise exception 'The name, brand or sub-line of SKU % is too long', v_row ->> 'sku'
        using errcode = '22023', hint = 'invalid_input', detail = v_row ->> 'sku';
    end if;
    if not exists (select 1 from public.products p where p.cat = v_cat) then
      raise exception 'No department % for SKU %', v_cat, v_row ->> 'sku'
        using errcode = '22023', hint = 'invalid_input', detail = v_row ->> 'sku';
    end if;
    v_price := null;
    if v_row ? 'price' and jsonb_typeof(v_row -> 'price') <> 'null' then
      if jsonb_typeof(v_row -> 'price') <> 'number' or (v_row ->> 'price')::numeric not between 0 and 99999.99 then
        raise exception 'The price of SKU % must be from 0 to 99,999.99, or null', v_row ->> 'sku'
          using errcode = '22023', hint = 'invalid_input', detail = v_row ->> 'sku';
      end if;
      v_price := (v_row ->> 'price')::numeric;
    end if;
    v_variants := coalesce(nullif(v_row -> 'variants', 'null'::jsonb), '[]'::jsonb);
    if jsonb_typeof(v_variants) <> 'array'
      or exists (select 1 from jsonb_array_elements(v_variants) as v(value) where jsonb_typeof(v.value) <> 'string') then
      raise exception 'The variants of SKU % must be a list of names', v_row ->> 'sku'
        using errcode = '22023', hint = 'invalid_input', detail = v_row ->> 'sku';
    end if;

    insert into public.products (
      id, sku, name, brand, cat, sub, sell_unit, description, price, tag, active, stock_status, featured_rank, variants, img
    ) values (
      nextval('public.products_id_seq'), v_sku, v_name, v_brand, v_cat, v_sub,
      btrim(coalesce(v_row ->> 'sell_unit', '')), btrim(coalesce(v_row ->> 'description', '')),
      v_price, v_tag, coalesce((v_row ->> 'active')::boolean, false),
      coalesce(v_row ->> 'stock_status', 'in_stock'), (v_row ->> 'featured_rank')::integer, v_variants, null
    );
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('updated', v_updated, 'created', v_created);
end;
$$;

revoke all on function public.admin_product_prices() from public, anon;
grant execute on function public.admin_product_prices() to authenticated, service_role;
revoke all on function public.admin_price_order(uuid, jsonb) from public, anon;
grant execute on function public.admin_price_order(uuid, jsonb) to authenticated, service_role;
revoke all on function public.admin_convert_quote(uuid, uuid) from public, anon;
grant execute on function public.admin_convert_quote(uuid, uuid) to authenticated, service_role;
revoke all on function public.admin_bulk_adjust_prices(integer[], numeric, numeric, boolean) from public, anon;
grant execute on function public.admin_bulk_adjust_prices(integer[], numeric, numeric, boolean) to authenticated, service_role;
revoke all on function public.admin_import_products(jsonb) from public, anon;
grant execute on function public.admin_import_products(jsonb) to authenticated, service_role;
revoke all on function public.admin_set_order_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_order_status(uuid, text, text) to authenticated, service_role;
revoke all on function public.admin_mark_orders_seen() from public, anon;
grant execute on function public.admin_mark_orders_seen() to authenticated, service_role;
revoke all on function public.admin_import_products_v2(jsonb) from public, anon;
grant execute on function public.admin_import_products_v2(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reverse. Not run; copy into the SQL editor to undo this migration. First
-- make every staff account a customer (or an admin), or the role check
-- can't be put back. Then copy the policies and functions back from the
-- migrations named in (d) and (e), and protect_profile_columns from
-- 20261009140000, all of which call is_admin(); then:
--
-- update public.profiles set role = 'customer' where role = 'staff';
-- alter table public.profiles drop constraint if exists profiles_role_chk;
-- alter table public.profiles add constraint profiles_role_chk check (role in ('customer', 'admin'));
-- drop function if exists public.is_staff_or_admin();
