-- Per-variant prices stay empty until the owner supplies them. Missing keys
-- keep using the parent list price, so current quotes do not change.
-- TODO(owner): Supply each size and pack-count price (AW-030) and confirm the
-- quote workflow statuses below (AW-024).

alter table public.products
  add column if not exists variant_prices jsonb not null default '{}'::jsonb;

alter table public.orders drop constraint if exists orders_status_chk;
alter table public.orders
  add constraint orders_status_chk check (
    status in (
      'new', 'contacted', 'quoted', 'confirmed', 'picking', 'ready',
      'out_for_delivery', 'fulfilled', 'cancelled'
    )
  );

alter table public.orders
  add column if not exists kind text not null default 'order';
alter table public.orders drop constraint if exists orders_kind_chk;
alter table public.orders
  add constraint orders_kind_chk check (kind in ('quote', 'order'));
update public.orders set kind = 'quote' where user_id is null and kind = 'order';

alter table public.orders
  add column if not exists quoted_at timestamptz,
  add column if not exists quoted_by uuid references public.profiles(id);

alter table public.order_items
  add column if not exists original_qty integer;

-- Catalog price on insert only, so a trade rep can later set a quoted price.
drop trigger if exists order_items_price on public.order_items;
create trigger order_items_price
  before insert on public.order_items
  for each row execute function public.enforce_order_item_price();

create or replace function public.enforce_order_item_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_order public.orders%rowtype;
  v_profile public.profiles%rowtype;
  v_variants text[];
  v_variant text;
  v_suffix text;
  v_discount numeric := 0;
  v_list numeric;
begin
  if new.product_id is null then
    raise exception 'Choose a product';
  end if;
  select * into v_product from public.products where id = new.product_id and active = true;
  if not found then
    raise exception 'Product is not available';
  end if;
  if new.qty is null or new.qty <= 0 or new.qty > 100000 then
    raise exception 'Invalid quantity';
  end if;
  select * into v_order from public.orders where id = new.order_id;
  if not found then
    raise exception 'Order not found';
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

  v_list := v_product.price;
  if v_variant is not null and v_product.variant_prices ? v_variant then
    v_list := (v_product.variant_prices ->> v_variant)::numeric;
  end if;

  new.unit_price := null;
  if v_order.user_id is not null then
    select * into v_profile from public.profiles where id = v_order.user_id;
    if found and v_profile.status = 'approved' then
      select coalesce(discount_pct, 0) / 100.0 into v_discount
      from public.pricing_tiers where tier = v_profile.pricing_tier;
      new.unit_price := round(v_list * (1 - coalesce(v_discount, 0)), 2);
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.stamp_order_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.kind := case when new.user_id is null then 'quote' else 'order' end;
  end if;
  return new;
end;
$$;

drop trigger if exists z_stamp_order_kind on public.orders;
create trigger z_stamp_order_kind
  before insert on public.orders
  for each row execute function public.stamp_order_kind();

create or replace function public.admin_price_order(p_order_id uuid, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line jsonb;
  v_qty integer;
  v_price numeric;
  v_units integer;
  v_subtotal numeric;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Add the priced lines';
  end if;
  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_qty := greatest(0, coalesce((v_line->>'qty')::integer, 0));
    if v_qty = 0 then
      delete from public.order_items
      where id = (v_line->>'item_id')::bigint and order_id = p_order_id;
    else
      v_price := (v_line->>'unit_price')::numeric;
      update public.order_items
      set original_qty = coalesce(original_qty, qty),
          qty = v_qty,
          unit_price = v_price
      where id = (v_line->>'item_id')::bigint and order_id = p_order_id;
    end if;
  end loop;
  select coalesce(sum(qty), 0), coalesce(sum(unit_price * qty), 0)
    into v_units, v_subtotal
  from public.order_items
  where order_id = p_order_id;
  update public.orders
  set total_units = v_units,
      subtotal = v_subtotal,
      status = 'quoted',
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
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  update public.orders
  set kind = 'order',
      status = 'confirmed',
      user_id = coalesce(p_user_id, user_id)
  where id = p_order_id;
end;
$$;

revoke all on function public.admin_price_order(uuid, jsonb) from public;
revoke all on function public.admin_convert_quote(uuid, uuid) from public;
grant execute on function public.admin_price_order(uuid, jsonb) to authenticated;
grant execute on function public.admin_convert_quote(uuid, uuid) to authenticated;
