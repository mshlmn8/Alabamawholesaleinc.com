-- Launch boundaries: no public admin bootstrap, server-priced quotes, ship-to,
-- and variant identity on each order line.
--
-- Direct inserts of orders and order_items are revoked. submit_quote is the
-- only customer path, and it prices lines from products + pricing_tiers.

-- ---------------------------------------------------------------------------
-- Signup creates a pending customer. Promoting an owner is a separate SQL step
-- (supabase/seed/provision_owner.sql), not something the first signup earns.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, name, business, phone, license_no, business_type, state, expected_volume, role, status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'business',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'license_no',
    new.raw_user_meta_data->>'business_type',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'expected_volume',
    'customer',
    'pending'
  );
  return new;
end;
$$;

alter table public.orders add column if not exists ship_street text;
alter table public.orders add column if not exists ship_city text;
alter table public.orders add column if not exists ship_state text;
alter table public.orders add column if not exists ship_zip text;

alter table public.order_items add column if not exists variant text;

-- Ignore client-supplied prices. Approved buyers are priced from the catalog
-- and their tier; everyone else gets an unpriced quote line.
create or replace function public.enforce_order_item_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_product public.products;
  v_profile public.profiles;
  v_discount numeric := 0;
  v_variants text[];
  v_variant text;
  v_suffix text;
begin
  select * into v_order from public.orders where id = new.order_id;
  if not found then
    raise exception 'Order header is missing';
  end if;

  select * into v_product from public.products where id = new.product_id and active = true;
  if not found then
    raise exception 'Product is not available';
  end if;

  if new.qty is null or new.qty <= 0 or new.qty > 100000 then
    raise exception 'Invalid quantity';
  end if;

  select coalesce(array_agg(value), array[]::text[]) into v_variants
  from jsonb_array_elements_text(coalesce(v_product.variants, '[]'::jsonb)) as t(value);

  v_variant := nullif(btrim(coalesce(new.variant, '')), '');
  if cardinality(v_variants) > 1 and v_variant is null then
    raise exception 'Choose a variant for %', v_product.name;
  end if;
  if cardinality(v_variants) = 1 and v_variant is null then
    v_variant := v_variants[1];
  end if;
  if v_variant is not null and cardinality(v_variants) > 0 then
    if not exists (
      select 1 from unnest(v_variants) as label where lower(label) = lower(v_variant)
    ) then
      raise exception 'Unknown variant for %', v_product.name;
    end if;
    select label into v_variant from unnest(v_variants) as label
    where lower(label) = lower(v_variant)
    limit 1;
  end if;

  new.variant := v_variant;
  new.product_name := case
    when v_variant is null then v_product.name
    else v_product.name || ' — ' || v_variant
  end;
  v_suffix := btrim(upper(regexp_replace(coalesce(v_variant, ''), '[^a-zA-Z0-9]+', '-', 'g')), '-');
  new.sku := case when v_suffix = '' then v_product.sku else v_product.sku || '-' || v_suffix end;

  new.unit_price := null;
  if v_order.user_id is not null then
    select * into v_profile from public.profiles where id = v_order.user_id;
    if found and v_profile.status = 'approved' then
      select coalesce(discount_pct, 0) / 100.0 into v_discount
      from public.pricing_tiers where tier = v_profile.pricing_tier;
      new.unit_price := round(v_product.price * (1 - coalesce(v_discount, 0)), 2);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_price on public.order_items;
create trigger order_items_price
  before insert or update of product_id, variant, qty, unit_price, sku, product_name
  on public.order_items
  for each row execute function public.enforce_order_item_price();

-- A new order belongs to the signed-in user (or nobody, for a guest quote).
-- Totals stay empty until submit_quote fills them from the priced lines.
create or replace function public.enforce_order_header()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := auth.uid();
    new.status := 'new';
    new.subtotal := null;
    new.total_units := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_header_guard on public.orders;
create trigger orders_header_guard
  before insert on public.orders
  for each row execute function public.enforce_order_header();

create or replace function public.submit_quote(
  p_ref_num text,
  p_business text,
  p_contact text,
  p_email text,
  p_phone text,
  p_delivery text,
  p_preferred_date date,
  p_notes text,
  p_ship_street text,
  p_ship_city text,
  p_ship_state text,
  p_ship_zip text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_qty integer;
  v_total_units integer := 0;
  v_subtotal numeric;
  v_has_price boolean := false;
begin
  if p_delivery not in ('delivery', 'willcall') then
    raise exception 'Invalid delivery method';
  end if;
  if nullif(btrim(coalesce(p_business, '')), '') is null
     or nullif(btrim(coalesce(p_contact, '')), '') is null
     or nullif(btrim(coalesce(p_email, '')), '') is null
     or nullif(btrim(coalesce(p_phone, '')), '') is null then
    raise exception 'Contact details are required';
  end if;
  if nullif(btrim(coalesce(p_ship_street, '')), '') is null
     or nullif(btrim(coalesce(p_ship_city, '')), '') is null
     or nullif(btrim(coalesce(p_ship_state, '')), '') is null
     or nullif(btrim(coalesce(p_ship_zip, '')), '') is null then
    raise exception 'A ship-to address is required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Too many items';
  end if;

  insert into public.orders (
    ref_num, business, contact, email, phone, delivery, preferred_date, notes,
    ship_street, ship_city, ship_state, ship_zip
  ) values (
    p_ref_num,
    btrim(p_business),
    btrim(p_contact),
    btrim(p_email),
    btrim(p_phone),
    p_delivery,
    p_preferred_date,
    nullif(btrim(coalesce(p_notes, '')), ''),
    btrim(p_ship_street),
    btrim(p_ship_city),
    btrim(p_ship_state),
    btrim(p_ship_zip)
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    insert into public.order_items (order_id, product_id, product_name, sku, variant, qty)
    values (
      v_order_id,
      (v_item->>'product_id')::integer,
      '',
      '',
      nullif(btrim(coalesce(v_item->>'variant', '')), ''),
      v_qty
    );
  end loop;

  select coalesce(sum(qty), 0),
         coalesce(bool_or(unit_price is not null), false),
         sum(unit_price * qty)
    into v_total_units, v_has_price, v_subtotal
  from public.order_items
  where order_id = v_order_id;

  update public.orders
  set total_units = v_total_units,
      subtotal = case when v_has_price then v_subtotal else null end
  where id = v_order_id;

  return jsonb_build_object(
    'id', v_order_id,
    'ref_num', p_ref_num,
    'total_units', v_total_units,
    'subtotal', case when v_has_price then v_subtotal else null end
  );
exception
  when unique_violation then
    raise exception 'This quote was already submitted';
end;
$$;

revoke all on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb) from public;
grant execute on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb) to anon, authenticated;

drop policy if exists orders_anyone_insert on public.orders;
drop policy if exists order_items_insert on public.order_items;

revoke insert on table public.orders from anon, authenticated;
revoke insert on table public.order_items from anon, authenticated;
