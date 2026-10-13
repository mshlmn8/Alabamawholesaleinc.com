-- Typed hints on the order-line trigger's refusals (AW-200).
--
-- submit_quote v3 (20261009130000) raises every refusal of its own with a
-- typed hint, which the storefront words for the buyer (quoteErrorMessage in
-- src/lib/orders.js). The lines it inserts are checked by the order-line
-- trigger, enforce_order_item_price(), whose refusals had no hint: "Product
-- is not available" (a product deactivated since it was carted), "Invalid
-- quantity", "Choose a variant for <name>", "Unknown variant for <name>".
-- The buyer could not tell which line to fix.
--
-- This file recreates the function from its latest definition
-- (20261009110000_variant_model.sql, section (d); nothing later redefines
-- it), changing only its raises: each message stays word for word, and each
-- gets a hint and, as its detail, the product id of the line, so the
-- storefront can name the product from the lines it sent:
--   'Order header is missing'          order_missing
--   'Product is not available'         product_unavailable
--   'Invalid quantity'                 invalid_quantity
--   'Choose a variant for <name>'      variant_required
--   'Unknown variant for <name>'       unknown_variant
--   'That variant is not available'    variant_unavailable (had its hint;
--                                      now also the detail)
-- The SQLSTATE stays P0001 (raise_exception), so callers that catch it are
-- unaffected. (The detail is '' for a line without a product id: a RAISE
-- option can't be null.) Cursor's BEFORE INSERT trigger order_items_price
-- (20261008200000) is not touched and keeps calling this function; the
-- admin functions that insert lines (none today) would get the same hints.
--
-- Release order: any time after 20261009110000. The frontend deployed
-- before it shows its generic message for these refusals. The new frontend
-- works before and after: before, it reads the hint from the message text
-- (and the product's name from "Choose a variant for <name>" / "Unknown
-- variant for <name>"); after, it names the product from the detail.

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
  v_list numeric;
  v_own_price numeric;
begin
  select * into v_order from public.orders where id = new.order_id;
  if not found then
    raise exception using message = 'Order header is missing', hint = 'order_missing', detail = coalesce(new.product_id::text, '');
  end if;

  select * into v_product from public.products where id = new.product_id and active = true;
  if not found then
    raise exception using message = 'Product is not available', hint = 'product_unavailable', detail = coalesce(new.product_id::text, '');
  end if;

  if new.qty is null or new.qty <= 0 or new.qty > 100000 then
    raise exception using message = 'Invalid quantity', hint = 'invalid_quantity', detail = coalesce(new.product_id::text, '');
  end if;

  select coalesce(array_agg(value), array[]::text[]) into v_variants
  from jsonb_array_elements_text(coalesce(v_product.variants, '[]'::jsonb)) as t(value);

  v_variant := nullif(btrim(coalesce(new.variant, '')), '');
  -- A product without variants is sold as it is.
  if cardinality(v_variants) = 0 then
    v_variant := null;
  end if;
  if cardinality(v_variants) > 1 and v_variant is null then
    raise exception using message = format('Choose a variant for %s', v_product.name), hint = 'variant_required', detail = coalesce(new.product_id::text, '');
  end if;
  if cardinality(v_variants) = 1 and v_variant is null then
    v_variant := v_variants[1];
  end if;
  if v_variant is not null then
    if not exists (
      select 1 from unnest(v_variants) as label where lower(label) = lower(v_variant)
    ) then
      raise exception using message = format('Unknown variant for %s', v_product.name), hint = 'unknown_variant', detail = coalesce(new.product_id::text, '');
    end if;
    select label into v_variant from unnest(v_variants) as label
    where lower(label) = lower(v_variant)
    limit 1;

    if exists (
      select 1 from jsonb_array_elements_text(coalesce(v_product.unavailable_variants, '[]'::jsonb)) as u(label)
      where lower(u.label) = lower(v_variant)
    ) then
      raise exception using message = 'That variant is not available', hint = 'variant_unavailable', detail = coalesce(new.product_id::text, '');
    end if;
  end if;

  new.variant := v_variant;
  new.product_name := case
    when v_variant is null then v_product.name
    else v_product.name || ' — ' || v_variant
  end;
  v_suffix := btrim(upper(regexp_replace(coalesce(v_variant, ''), '[^a-zA-Z0-9]+', '-', 'g')), '-');
  new.sku := case when v_suffix = '' then v_product.sku else v_product.sku || '-' || v_suffix end;
  new.sell_unit := nullif(btrim(coalesce(v_product.sell_unit, '')), '');

  new.unit_price := null;
  if v_order.user_id is not null then
    select * into v_profile from public.profiles where id = v_order.user_id;
    if found and v_profile.status = 'approved' then
      v_list := v_product.price;
      if v_variant is not null then
        select vp.price into v_own_price
        from public.product_variant_prices vp
        where vp.product_id = v_product.id and lower(vp.variant) = lower(v_variant);
        if found then
          v_list := v_own_price;
        end if;
      end if;
      -- A tier without a pricing_tiers row prices at list (no discount).
      select discount_pct into v_discount_pct
      from public.pricing_tiers where tier = v_profile.pricing_tier;
      new.unit_price := public.tier_unit_price(v_list, v_discount_pct);
    end if;
  end if;

  return new;
end;
$$;

-- A trigger function: nobody calls it directly. The order_items_price
-- trigger (BEFORE INSERT, 20261008200000) keeps using it.
revoke all on function public.enforce_order_item_price() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this migration.
-- No deploy is needed first: the frontend reads the hints from the messages,
-- which don't change.
--
-- create or replace function public.enforce_order_item_price() ... -- the
--   20261009110000 definition (section (d) of 20261009110000_variant_model.sql)
-- revoke all on function public.enforce_order_item_price() from public, anon, authenticated;
