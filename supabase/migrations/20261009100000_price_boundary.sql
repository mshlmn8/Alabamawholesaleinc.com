-- Price boundary (AW-003, AW-002, AW-032, AW-077, AW-351).
--
-- List prices live only in the database. Guests and signed-in accounts can no
-- longer read products.price through the API: products moves to column
-- privileges, and every column except price stays readable. Approved buyers
-- get their tier's prices from my_prices(), rounded to cents exactly as the
-- order trigger rounds them, and admins read list prices through
-- admin_product_prices(). pricing_tiers is readable only by admins and
-- approved buyers, and profiles.pricing_tier must name a pricing_tiers row.
--
-- Release order: apply this migration, then `npm run seed`'s file (it has no
-- price column and needs price to be nullable), then deploy the frontend. The
-- frontend deployed before this change reads products with select('*'), which
-- now fails with 42501; it falls back to its bundled catalog until the new
-- frontend is live. The prices already stored are not changed here.
--
-- Gotcha for every later migration: a column added to products is invisible
-- to the storefront until it gets its own
--   grant select (<column>) on public.products to anon, authenticated;

-- ---------------------------------------------------------------------------
-- (a) A null price means "price on request": the seed inserts new rows without
-- one, and an admin can clear a price.
-- ---------------------------------------------------------------------------
alter table public.products alter column price drop not null;

alter table public.products drop constraint if exists products_price_nonnegative;
alter table public.products add constraint products_price_nonnegative check (price >= 0);

-- ---------------------------------------------------------------------------
-- (b) Column privileges: every column but price. Table-level UPDATE, INSERT
-- and DELETE are unchanged; RLS (products_admin_write) still limits them to
-- admins, and an admin's PATCH ... ?id=eq.N needs SELECT on id only.
-- ---------------------------------------------------------------------------
revoke select on public.products from anon, authenticated;
grant select (id, name, brand, cat, sub, sku, flavors, variants, img, tag, active, updated_at, description, sell_unit)
  on public.products to anon, authenticated;

-- ---------------------------------------------------------------------------
-- (c) Helpers.
-- ---------------------------------------------------------------------------

-- A tier's unit price: list price less the tier discount, rounded to cents
-- (half away from zero, Postgres numeric round). Null list price, null unit
-- price. The storefront repeats this in integer cents (src/lib/pricing.js
-- tierUnitPrice) so "each" x quantity always equals the saved line (AW-077).
create or replace function public.tier_unit_price(p_list numeric, p_discount_pct numeric)
returns numeric
language sql
immutable
security definer
set search_path = public
as $$
  select case
    when p_list is null then null
    else round(p_list * (1 - coalesce(p_discount_pct, 0) / 100.0), 2)
  end;
$$;

revoke all on function public.tier_unit_price(numeric, numeric) from public;
grant execute on function public.tier_unit_price(numeric, numeric) to anon, authenticated, service_role;

-- The caller's profile is approved. Security definer, like is_admin(), so the
-- pricing_tiers policy does not recurse through profiles' RLS. anon keeps
-- EXECUTE because that policy calls it for guests too (it returns false).
create or replace function public.is_approved_buyer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select status = 'approved' from public.profiles where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_approved_buyer() from public;
grant execute on function public.is_approved_buyer() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (d) The order-line trigger, recreated from 20260925120000. Only the pricing
-- step changes: it uses tier_unit_price(), so a product without a price gives
-- an unpriced line instead of failing, and the rounding is the one
-- my_prices() shows.
-- ---------------------------------------------------------------------------
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
  v_discount_pct numeric;
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
      -- A tier without a pricing_tiers row prices at list (no discount).
      select discount_pct into v_discount_pct
      from public.pricing_tiers where tier = v_profile.pricing_tier;
      new.unit_price := public.tier_unit_price(v_product.price, v_discount_pct);
    end if;
  end if;

  return new;
end;
$$;

-- A trigger function: nobody calls it directly.
revoke all on function public.enforce_order_item_price() from public, anon, authenticated;

drop trigger if exists order_items_price on public.order_items;
create trigger order_items_price
  before insert or update of product_id, variant, qty, unit_price, sku, product_name
  on public.order_items
  for each row execute function public.enforce_order_item_price();

-- ---------------------------------------------------------------------------
-- (e) The signed-in buyer's prices. Null unless the caller has an approved
-- profile. Otherwise:
--   { "tier": "silver", "tier_label": "…", "discount_pct": 5.00,
--     "products": { "<id>": { "list": <list or null>, "unit": <unit or null>,
--                              "variants": {} } } }
-- for every active product. One jsonb value, not a set of rows, so PostgREST's
-- row limit never cuts it off. "variants" holds per-variant prices once the
-- variant model lands (Phase 2, c2), in the same shape.
-- ---------------------------------------------------------------------------
create or replace function public.my_prices()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_tier public.pricing_tiers;
  v_discount_pct numeric;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.status <> 'approved' then
    return null;
  end if;

  select * into v_tier from public.pricing_tiers where tier = v_profile.pricing_tier;
  v_discount_pct := coalesce(v_tier.discount_pct, 0);

  return jsonb_build_object(
    'tier', v_profile.pricing_tier,
    'tier_label', v_tier.label,
    'discount_pct', v_discount_pct,
    'products', coalesce((
      select jsonb_object_agg(
        p.id::text,
        jsonb_build_object(
          'list', p.price,
          'unit', public.tier_unit_price(p.price, v_discount_pct),
          'variants', '{}'::jsonb
        )
      )
      from public.products p
      where p.active
    ), '{}'::jsonb)
  );
end;
$$;

-- Supabase's default privileges grant EXECUTE on new functions to anon.
revoke all on function public.my_prices() from public, anon;
grant execute on function public.my_prices() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (f) List prices for Admin -> Products, inactive products included:
--   { "<id>": { "list": <list or null>, "variants": {} } }
-- ---------------------------------------------------------------------------
create or replace function public.admin_product_prices()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can read list prices' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(p.id::text, jsonb_build_object('list', p.price, 'variants', '{}'::jsonb))
    from public.products p
  ), '{}'::jsonb);
end;
$$;

revoke all on function public.admin_product_prices() from public, anon;
grant execute on function public.admin_product_prices() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (g) pricing_tiers: private to admins and approved buyers (AW-003), and the
-- only list of tiers (AW-351). profiles.pricing_tier becomes a foreign key,
-- so adding a tier is one pricing_tiers row; Admin -> Accounts builds its
-- tier options from the table.
-- ---------------------------------------------------------------------------
drop policy if exists pricing_tiers_public_read on public.pricing_tiers;
drop policy if exists pricing_tiers_read on public.pricing_tiers;
create policy pricing_tiers_read on public.pricing_tiers
  for select using (public.is_admin() or public.is_approved_buyer());

-- A profile whose tier has no row (only possible if a row was deleted by
-- hand) keeps its tier: the row is added with no discount, which is how the
-- order trigger already priced it.
insert into public.pricing_tiers (tier, discount_pct, label)
select distinct p.pricing_tier, 0, p.pricing_tier
from public.profiles p
where not exists (select 1 from public.pricing_tiers t where t.tier = p.pricing_tier)
on conflict (tier) do nothing;

alter table public.profiles drop constraint if exists profiles_pricing_chk;
alter table public.profiles drop constraint if exists profiles_pricing_tier_fkey;
alter table public.profiles
  add constraint profiles_pricing_tier_fkey
  foreign key (pricing_tier) references public.pricing_tiers(tier) on update cascade;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this migration.
-- Deploy the previous frontend first: the current one expects my_prices().
-- Rows the price-less seed inserted have a null price; give them one first,
-- or the NOT NULL step fails.
--
-- alter table public.profiles drop constraint if exists profiles_pricing_tier_fkey;
-- alter table public.profiles
--   add constraint profiles_pricing_chk check (pricing_tier in ('standard','silver','gold'));
-- drop policy if exists pricing_tiers_read on public.pricing_tiers;
-- create policy pricing_tiers_public_read on public.pricing_tiers for select using (true);
-- drop function if exists public.admin_product_prices();
-- drop function if exists public.my_prices();
-- create or replace function public.enforce_order_item_price() ... -- the
--   20260925120000 definition (unit_price := round(price * (1 - discount), 2))
-- drop function if exists public.is_approved_buyer();
-- drop function if exists public.tier_unit_price(numeric, numeric);
-- grant select on public.products to anon, authenticated;
-- alter table public.products drop constraint if exists products_price_nonnegative;
-- alter table public.products alter column price set not null;
