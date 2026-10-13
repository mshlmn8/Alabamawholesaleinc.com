-- The CSV import can add products (AW-114).
--
-- Admin -> Products' Import CSV updated the products whose SKU the file
-- names and refused the whole file over a SKU no product has
-- (admin_import_products, 20261010121000): a new line from a supplier still
-- meant New product, once per row. admin_import_products_v2(p_rows) does
-- what v1 does and adds the products the file describes:
--
--   (a) A row whose SKU a product has (upper(btrim(sku)), any case or
--       surrounding spaces) updates that product in the keys it has, out of
--       name, brand, sell_unit, description, price, tag, active,
--       stock_status and featured_rank, exactly as v1 does: an absent key
--       leaves its column alone, a null price is "price on request", the tag
--       is one of BESTSELLER, NEW, DEAL, PREMIUM or empty, and the table's own
--       checks refuse bad values. cat and sub are not changed this way (a
--       product moves to another department in its editor).
--   (b) A row whose SKU no product has is inserted when it has a name, a
--       brand, a department (cat, one that some product already has) and a
--       sub-line (sub), with a SKU of 2 to 41 capital letters, digits and
--       hyphens; the other keys as in (a), a price of 0 to 99,999.99 or
--       null, and variants (when given) a list of names. It gets the next id
--       from products_id_seq and no photo. It is inactive unless the row
--       says "active": true, so nothing reaches the storefront by accident.
--   (c) A row that is neither (an unknown SKU without the name, brand, cat
--       and sub a new product needs) refuses the whole file, as in v1 (hint
--       unknown_sku, the SKU in the detail). So does a SKU listed twice
--       (hint duplicate_sku): it would change the same product twice.
--
-- At most 1000 rows, all or nothing: one refused row and nothing is saved.
-- Returns { updated, created }. SECURITY DEFINER (it writes price, which
-- admins can't read through the API), is_admin() first (42501, hint
-- admin_only); its other refusals are 22023 with hint invalid_input.
-- Supabase's default privileges give every new function to anon: it is
-- revoked and granted to signed-in accounts and the service role only. v1
-- stays as it is, for the frontend deployed before this file.
--
-- Release order: after 20261010121000 (and 20261010120000, whose id
-- sequence, SKU index and stock_status/featured_rank columns this uses),
-- before or after the frontend. The frontend deployed before it calls only
-- v1. The new frontend calls v2 and, on a database without it
-- (PGRST202/42883), imports the updates through v1 and lists the new rows as
-- not imported, saying creating products from a file needs this update.

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
  if not public.is_admin() then
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

revoke all on function public.admin_import_products_v2(jsonb) from public, anon;
grant execute on function public.admin_import_products_v2(jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reverse (AW-213). Not run; copy into the SQL editor to undo this migration.
-- The frontend works without it, so no deploy is needed first: Import CSV
-- then updates through admin_import_products and lists new rows as not
-- imported. Products already added from a file stay.
--
-- drop function if exists public.admin_import_products_v2(jsonb);
