-- Admin bulk product changes and tier discounts (AW-114).
--
-- Admin -> Products changes many products at once: Set price, Set tag,
-- Activate and Deactivate are one ordinary update of the chosen rows (RLS
-- products_admin_write already limits them to admins). Two changes need the
-- database's help, so that they happen all at once or not at all:
--
--   (a) admin_bulk_adjust_prices(p_ids, p_pct, p_amount, p_variants): raise
--       or lower the list price of up to 1000 products by a percentage
--       and/or an amount, and (by default) their variants' own prices,
--       rounded to the cent like tier_unit_price() (Postgres round(numeric,
--       2), half away from zero; src/pages/admin/productBulk.js previews the
--       same numbers in integer cents). Products and variants without a price
--       ("price on request") are skipped. If any new price would fall below
--       0 or rise above 99,999.99, nothing changes (hint price_out_of_range).
--       Returns { updated, skipped, variants }.
--   (b) admin_import_products(p_rows): the CSV import. Each element is
--       { sku, ... } and updates the product with that SKU (upper(btrim(sku)),
--       whatever its case or surrounding spaces) in the keys it has, out of
--       name, brand, sell_unit, description, price, tag, active, stock_status
--       and featured_rank; a key that is absent leaves its column alone, and
--       a null price is "price on request". At most 1000 rows. An unknown SKU
--       refuses the whole import (hint unknown_sku, the SKU in the detail):
--       the import never creates a product. The table's own checks
--       (20261009100000, 20261010120000) refuse bad values. Returns the
--       number of products updated.
--   (c) pricing_tiers.discount_pct stays from 0 up to (not including) 100
--       (Admin -> Pricing edits it). NOT VALID: the rows already there are not
--       checked, every change is.
--
-- Both functions are SECURITY DEFINER (they write price, which admins can't
-- read through the API) and check is_admin() first (42501, hint admin_only).
-- Their other refusals are 22023 with hint invalid_input. Supabase's default
-- privileges give every new function to anon: each is revoked and granted to
-- signed-in accounts and the service role only.
--
-- Release order: after 20261010120000 (stock_status and featured_rank).
-- The frontend deployed before it doesn't call these functions. The new
-- frontend works before it too: Set price, Set tag, Activate, Deactivate,
-- Export and Admin -> Pricing work on the live database, and Adjust and
-- Import say they need this update.

-- ---------------------------------------------------------------------------
-- (a) Adjust the list prices of many products at once.
-- ---------------------------------------------------------------------------
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
  if not public.is_admin() then
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

revoke all on function public.admin_bulk_adjust_prices(integer[], numeric, numeric, boolean) from public, anon;
grant execute on function public.admin_bulk_adjust_prices(integer[], numeric, numeric, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (b) The CSV import: update matched SKUs, all or nothing.
-- ---------------------------------------------------------------------------
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
  if not public.is_admin() then
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

revoke all on function public.admin_import_products(jsonb) from public, anon;
grant execute on function public.admin_import_products(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (c) A tier discount is from 0 up to (not including) 100 percent.
-- ---------------------------------------------------------------------------
alter table public.pricing_tiers drop constraint if exists pricing_tiers_discount_range;
alter table public.pricing_tiers add constraint pricing_tiers_discount_range
  check (discount_pct >= 0 and discount_pct < 100) not valid;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this migration.
-- The frontend works without it, so no deploy is needed first (Adjust and
-- Import then say they need the update). Prices and products already changed
-- stay as they are.
--
-- alter table public.pricing_tiers drop constraint if exists pricing_tiers_discount_range;
-- drop function if exists public.admin_import_products(jsonb);
-- drop function if exists public.admin_bulk_adjust_prices(integer[], numeric, numeric, boolean);
