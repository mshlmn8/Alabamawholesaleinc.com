-- Variant model (AW-030, AW-332, AW-233, AW-128, AW-031).
--
-- Variants keep their shape: products.variants is still a jsonb array of
-- label strings, so the order trigger, submit_quote and the frontend deployed
-- before this migration keep working with them. Around them come:
--   products.variant_axis          what the variants differ by (Flavor, Size,
--                                  Color, …), so the storefront asks "Choose a
--                                  flavor" and counts "8 flavors" (AW-128)
--   products.unavailable_variants  labels that can't be ordered right now
--                                  (AW-030); readable by everyone
--   product_variant_prices         a variant's own list price (AW-030),
--                                  private like products.price; it takes
--                                  over the values of Cursor's public
--                                  products.variant_prices column
--                                  (20261008200000), which is dropped
--   order_items.sell_unit          what quantity 1 meant when the line was
--                                  saved (AW-031)
-- and the flavors count goes (AW-332): it only ever repeated the length of
-- variants, and the storefront counts the variants itself now.
--
-- Release order: after 20261009100000_price_boundary.sql, before the
-- regenerated seed (it has variant_axis and no flavors) and before the
-- frontend. The frontend deployed before 20261009100000 already falls back to
-- its bundled catalog once that migration is in; this one changes nothing for
-- it. The new frontend also works without this migration: its catalog query
-- falls back to the columns every database has (42703), takes the variant
-- axis and sell unit from its bundled copy, treats every variant as
-- available, and prices variants at their product's price.

-- ---------------------------------------------------------------------------
-- (a) products: the variant axis and the variants that can't be ordered now.
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists variant_axis text,
  add column if not exists unavailable_variants jsonb not null default '[]'::jsonb;

-- The labels the storefront knows (VARIANT_AXES in src/lib/lines.js). Null
-- means "variant" (a product with one variant or none needs no axis).
alter table public.products drop constraint if exists products_variant_axis_chk;
alter table public.products add constraint products_variant_axis_chk
  check (variant_axis in ('Flavor', 'Size', 'Color', 'Style', 'Format', 'Strength', 'Type', 'Variety'));

alter table public.products drop constraint if exists products_unavailable_variants_array;
alter table public.products add constraint products_unavailable_variants_array
  check (jsonb_typeof(unavailable_variants) = 'array');

-- products uses column privileges since 20261009100000: a new column is
-- invisible to the storefront until it is granted.
grant select (variant_axis, unavailable_variants) on public.products to anon, authenticated;

-- ---------------------------------------------------------------------------
-- (b) A variant's own list price (AW-030). A row wins over products.price for
-- that variant, in my_prices() and in the order trigger; a row with a null
-- price means "price on request" for that variant. Labels match the
-- product's variants case-insensitively. Like products.price, only admins
-- read or write it directly; approved buyers get their tier's unit prices
-- from my_prices().
--
-- TODO(owner): What is the price, and is it in stock, for each size or pack-count variant of the multi-variant products (for example gas cans 1 gal / 2 gal / 5 gal)? Load prices here and unavailable variants into products.unavailable_variants through a private SQL file (BACKEND.md, "Variants, availability and sell units") until Admin can edit them. (AW-030)
-- ---------------------------------------------------------------------------
create table if not exists public.product_variant_prices (
  product_id integer not null references public.products(id) on delete cascade,
  variant text not null,
  price numeric(10,2) check (price >= 0),
  primary key (product_id, variant)
);

-- One row per variant, whatever the case of its label.
create unique index if not exists product_variant_prices_label_key
  on public.product_variant_prices (product_id, lower(variant));

-- Cursor's 20261008200000 kept the same prices in products.variant_prices, a
-- jsonb object { "<label>": <price> } on the products table (empty unless
-- someone filled it). One place is kept, and it is this private table: a
-- column on products would be one grant away from every visitor, has no
-- per-variant constraints, and my_prices() and the order trigger already
-- read the table. Its values move here (a key matched to the product's
-- label case-insensitively; a key naming no variant, or a value that isn't
-- a price, is dropped; a row already here wins), and the column goes.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'variant_prices'
  ) then
    insert into public.product_variant_prices (product_id, variant, price)
    select p.id, label.value, round((e.value #>> '{}')::numeric, 2)
    from public.products p
    cross join lateral jsonb_each(
      case when jsonb_typeof(p.variant_prices) = 'object' then p.variant_prices else '{}'::jsonb end
    ) as e(key, value)
    cross join lateral (
      select v.value
      from jsonb_array_elements_text(case when jsonb_typeof(p.variants) = 'array' then p.variants else '[]'::jsonb end) as v(value)
      where lower(v.value) = lower(e.key)
      limit 1
    ) as label
    where jsonb_typeof(e.value) in ('number', 'string')
      and (e.value #>> '{}') ~ '^[0-9]{1,8}([.][0-9]+)?$'
    on conflict do nothing;

    alter table public.products drop column variant_prices;
  end if;
end $$;

alter table public.product_variant_prices enable row level security;

drop policy if exists product_variant_prices_admin_read on public.product_variant_prices;
drop policy if exists product_variant_prices_admin_insert on public.product_variant_prices;
drop policy if exists product_variant_prices_admin_update on public.product_variant_prices;
drop policy if exists product_variant_prices_admin_delete on public.product_variant_prices;
create policy product_variant_prices_admin_read on public.product_variant_prices
  for select using (public.is_admin());
create policy product_variant_prices_admin_insert on public.product_variant_prices
  for insert with check (public.is_admin());
create policy product_variant_prices_admin_update on public.product_variant_prices
  for update using (public.is_admin()) with check (public.is_admin());
create policy product_variant_prices_admin_delete on public.product_variant_prices
  for delete using (public.is_admin());

-- Supabase's default privileges give anon and authenticated every privilege
-- on a new table, TRUNCATE included, and RLS doesn't cover TRUNCATE. Guests
-- get nothing; signed-in accounts get the four the policies govern.
revoke all on public.product_variant_prices from public, anon, authenticated;
grant select, insert, update, delete on public.product_variant_prices to authenticated;
grant all on public.product_variant_prices to service_role;

-- ---------------------------------------------------------------------------
-- (c) What quantity 1 meant when a line was saved (AW-031): the product's
-- sell unit at that moment, or null when it had none.
-- ---------------------------------------------------------------------------
alter table public.order_items add column if not exists sell_unit text;

-- ---------------------------------------------------------------------------
-- (d) The order-line trigger, recreated from 20261009100000. It runs on
-- INSERT only (Cursor's 20261008200000), so a saved line keeps what staff
-- set with admin_price_order. Changes:
--   - a product without variants drops a variant label sent with it (it used
--     to be kept and added to the line's name and SKU);
--   - a variant listed in unavailable_variants is refused, with the hint
--     variant_unavailable (saved lines stay editable);
--   - the line keeps the product's sell unit;
--   - an approved buyer's unit price starts from the variant's own list
--     price when product_variant_prices has one, else the product's.
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
  v_list numeric;
  v_own_price numeric;
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
  -- A product without variants is sold as it is.
  if cardinality(v_variants) = 0 then
    v_variant := null;
  end if;
  if cardinality(v_variants) > 1 and v_variant is null then
    raise exception 'Choose a variant for %', v_product.name;
  end if;
  if cardinality(v_variants) = 1 and v_variant is null then
    v_variant := v_variants[1];
  end if;
  if v_variant is not null then
    if not exists (
      select 1 from unnest(v_variants) as label where lower(label) = lower(v_variant)
    ) then
      raise exception 'Unknown variant for %', v_product.name;
    end if;
    select label into v_variant from unnest(v_variants) as label
    where lower(label) = lower(v_variant)
    limit 1;

    if exists (
      select 1 from jsonb_array_elements_text(coalesce(v_product.unavailable_variants, '[]'::jsonb)) as u(label)
      where lower(u.label) = lower(v_variant)
    ) then
      raise exception using message = 'That variant is not available', hint = 'variant_unavailable';
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
-- (e) The signed-in buyer's prices, recreated from 20261009100000. "variants"
-- now holds each variant's own price, keyed by the product's label:
--   { "tier": …, "tier_label": …, "discount_pct": …,
--     "products": { "<id>": { "list": …, "unit": …,
--                              "variants": { "<label>": { "list": …, "unit": … } } } } }
-- Only variants with a product_variant_prices row are listed; the others
-- cost the product's price. The unit prices are the ones the order trigger
-- saves.
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
          'variants', coalesce((
            select jsonb_object_agg(
              t.label,
              jsonb_build_object('list', vp.price, 'unit', public.tier_unit_price(vp.price, v_discount_pct))
            )
            from jsonb_array_elements_text(
              case when jsonb_typeof(p.variants) = 'array' then p.variants else '[]'::jsonb end
            ) as t(label)
            join public.product_variant_prices vp
              on vp.product_id = p.id and lower(vp.variant) = lower(t.label)
          ), '{}'::jsonb)
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
-- (e, continued) List prices for Admin -> Products, recreated from
-- 20261009100000, with
-- every product_variant_prices row under its product, as stored:
--   { "<id>": { "list": …, "variants": { "<label>": { "list": … } } } }
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

revoke all on function public.admin_product_prices() from public, anon;
grant execute on function public.admin_product_prices() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (f) The flavors count (AW-332). Its column privilege goes with it.
-- ---------------------------------------------------------------------------
alter table public.products drop column if exists flavors;

-- ---------------------------------------------------------------------------
-- (g) Data for the rows already in the database, from src/data/products.js.
-- Each update fills only what nobody has set yet (or, for a description, only
-- the text the seed wrote), so it never overwrites an admin's edit and running
-- it again changes nothing (AW-032). New rows get the same values from the
-- seed.
-- ---------------------------------------------------------------------------

-- The axis of every product with two or more variants (AW-128).
update public.products as p
set variant_axis = v.axis
from (values
  (1, 'Variety'), (2, 'Variety'), (3, 'Variety'), (4, 'Variety'), (5, 'Variety'), (6, 'Variety'),
  (7, 'Variety'), (8, 'Flavor'), (9, 'Variety'), (10, 'Flavor'), (11, 'Variety'), (12, 'Flavor'),
  (13, 'Flavor'), (15, 'Variety'), (16, 'Variety'), (17, 'Variety'), (18, 'Flavor'), (19, 'Flavor'),
  (20, 'Size'), (21, 'Size'), (22, 'Variety'), (23, 'Variety'), (24, 'Variety'), (27, 'Size'),
  (28, 'Color'), (29, 'Variety'), (31, 'Variety'), (32, 'Variety'), (33, 'Size'), (34, 'Size'),
  (35, 'Size'), (36, 'Flavor'), (37, 'Flavor'), (38, 'Flavor'), (39, 'Variety'), (40, 'Flavor'),
  (41, 'Flavor'), (42, 'Flavor'), (43, 'Flavor'), (44, 'Flavor'), (46, 'Size'), (47, 'Flavor'),
  (48, 'Flavor'), (49, 'Flavor'), (50, 'Variety'), (51, 'Variety'), (52, 'Variety'), (53, 'Variety'),
  (54, 'Size'), (55, 'Type'), (56, 'Type'), (57, 'Type'), (58, 'Flavor'), (59, 'Flavor'),
  (60, 'Flavor'), (61, 'Flavor'), (62, 'Flavor'), (63, 'Flavor'), (69, 'Flavor'), (74, 'Flavor'),
  (75, 'Flavor'), (76, 'Flavor'), (77, 'Variety'), (78, 'Variety'), (79, 'Flavor'), (80, 'Flavor'),
  (81, 'Variety'), (82, 'Color'), (83, 'Variety'), (84, 'Flavor'), (85, 'Flavor'), (86, 'Variety'),
  (87, 'Flavor'), (88, 'Flavor'), (89, 'Flavor'), (90, 'Size'), (91, 'Size'), (92, 'Type'),
  (96, 'Type'), (101, 'Type'), (102, 'Type'), (104, 'Variety'), (105, 'Size'), (106, 'Variety'),
  (107, 'Variety'), (108, 'Color'), (109, 'Color'), (110, 'Color'), (111, 'Size'), (112, 'Size'),
  (113, 'Size'), (117, 'Color'), (118, 'Size'), (120, 'Size'), (121, 'Type'), (125, 'Size'),
  (126, 'Variety'), (128, 'Size'), (130, 'Color'), (131, 'Size'), (132, 'Color'), (133, 'Color'),
  (134, 'Color'), (136, 'Size'), (137, 'Size'), (138, 'Size'), (139, 'Flavor'), (140, 'Flavor'),
  (141, 'Flavor'), (142, 'Flavor'), (143, 'Variety'), (144, 'Variety'), (147, 'Variety'), (148, 'Variety'),
  (149, 'Variety'), (150, 'Type'), (151, 'Size'), (152, 'Size'), (153, 'Size'), (154, 'Size'),
  (155, 'Size'), (156, 'Size'), (157, 'Color'), (158, 'Color'), (159, 'Format'), (160, 'Size'),
  (161, 'Size'), (162, 'Variety'), (163, 'Variety'), (164, 'Variety'), (165, 'Size'), (166, 'Variety'),
  (167, 'Size'), (168, 'Size'), (169, 'Variety'), (170, 'Size'), (171, 'Variety'), (172, 'Size'),
  (173, 'Flavor'), (178, 'Size'), (179, 'Flavor'), (180, 'Flavor'), (181, 'Flavor'), (182, 'Flavor'),
  (183, 'Flavor'), (184, 'Flavor'), (186, 'Variety'), (188, 'Flavor'), (189, 'Flavor'), (190, 'Variety'),
  (194, 'Flavor'), (195, 'Flavor'), (196, 'Variety'), (197, 'Variety'), (198, 'Variety'), (200, 'Flavor'),
  (201, 'Variety'), (204, 'Flavor'), (207, 'Flavor'), (208, 'Flavor'), (209, 'Variety'), (212, 'Size'),
  (214, 'Flavor'), (215, 'Flavor'), (216, 'Size'), (217, 'Flavor'), (218, 'Flavor'), (219, 'Variety'),
  (220, 'Size'), (221, 'Size'), (226, 'Variety'), (227, 'Variety'), (228, 'Size'), (229, 'Variety'),
  (230, 'Variety'), (231, 'Variety'), (232, 'Flavor'), (233, 'Flavor'), (234, 'Size'), (235, 'Flavor'),
  (236, 'Variety'), (237, 'Variety'), (238, 'Variety'), (239, 'Variety'), (240, 'Variety'), (241, 'Variety'),
  (242, 'Variety'), (243, 'Variety'), (244, 'Variety'), (245, 'Size'), (246, 'Size'), (249, 'Variety'),
  (251, 'Variety'), (252, 'Variety'), (255, 'Size'), (256, 'Variety'), (257, 'Format'), (259, 'Size'),
  (260, 'Flavor'), (261, 'Variety'), (263, 'Variety'), (265, 'Variety'), (269, 'Color'), (270, 'Color'),
  (272, 'Flavor'), (278, 'Flavor'), (279, 'Flavor'), (280, 'Type'), (282, 'Size'), (285, 'Color'),
  (287, 'Size'), (288, 'Flavor'), (290, 'Flavor'), (291, 'Flavor'), (295, 'Size'), (314, 'Size'),
  (318, 'Variety'), (323, 'Flavor'), (324, 'Color'), (326, 'Flavor'), (327, 'Flavor'), (328, 'Variety'),
  (332, 'Format'), (337, 'Variety'), (338, 'Variety'), (342, 'Size'), (343, 'Variety'), (353, 'Size'),
  (356, 'Size'), (359, 'Size'), (361, 'Size'), (362, 'Size'), (363, 'Color'), (364, 'Color')
) as v(id, axis)
where p.id = v.id and p.variant_axis is null;

-- Sell units the product's own name or description states (AW-031); the rest
-- stay empty until the owner supplies them.
update public.products as p
set sell_unit = v.unit
from (values
  (11, '5-pack'), (12, '2-pack'), (17, '25-count box'), (28, '2-pack'),
  (37, '36-count box'), (69, '3 g disposable'), (70, '2-pack'), (71, 'jar'),
  (73, '4 g disposable'), (74, '2-pack'), (77, '5-pack'), (78, '5-pack'),
  (79, '3-pack'), (81, 'twin pack'), (98, '2.5 gal jug'), (122, '4-pack'),
  (174, 'tub'), (175, '160-count jar'), (176, 'jar'), (177, 'tub'),
  (178, 'tub'), (179, '145-count tub'), (186, '48-count display'), (187, 'box'),
  (242, 'box of 200'), (243, 'box of 200'), (258, 'jar'), (262, 'jar'),
  (275, '5 lb bag'), (276, 'jar'), (281, '2-pack'), (285, '2-pack'),
  (288, '2-pack'), (294, 'can of 20'), (298, 'jar'), (300, '2-pack'),
  (313, '25-count box'), (315, '50 g tin'), (316, '250 g tin'), (317, '1 kg tin'),
  (358, 'box of 15'), (367, '5-pack')
) as v(id, unit)
where p.id = v.id and p.sell_unit = '';

-- Descriptions that counted formats, sizes or mixed lists as "flavors" (AW-128).
update public.products as p
set description = v.new_text
from (values
  (32,
   'BluntPower air freshener sprays. Eight flavors: Cantaloupe, Pineapple, Polo blue, Celebration, Cool water, Baby powder, Blueberry and Issey miyake.',
   'BluntPower air freshener sprays. Eight scents: Cantaloupe, Pineapple, Polo blue, Celebration, Cool water, Baby powder, Blueberry and Issey miyake.'),
  (39,
   'Ferrara theater-box candy. Two flavors: Lemonheads and Boston Baked Beans.',
   'Ferrara theater-box candy. Two varieties: Lemonheads and Boston Baked Beans.'),
  (50,
   'Cloverhill bakery pastries. Two flavors: Big Texas and Honey bun.',
   'Cloverhill bakery pastries. Two varieties: Big Texas and Honey bun.'),
  (51,
   'Single-serve cereal cups. Four flavors: Frosted Flakes, Apple jack, Froot Loops and Corn Pops.',
   'Single-serve cereal cups. Four varieties: Frosted Flakes, Apple jack, Froot Loops and Corn Pops.'),
  (52,
   'Gurley''s candy peg bags. Four flavors: Butter flies, Circus peanuts, Watermelon rings and Gummy worms.',
   'Gurley''s candy peg bags. Four varieties: Butter flies, Circus peanuts, Watermelon rings and Gummy worms.'),
  (159,
   'Little Trees hanging air fresheners. Three flavors: Assorted display, Black ice single and Black ice pack.',
   'Little Trees hanging air fresheners. Three formats: Assorted display, Black ice single and Black ice pack.'),
  (163,
   'M&M''s chocolate candies. Four flavors: Yellow reg, Yellow share size, Chocolate reg and Chocolate king size.',
   'M&M''s chocolate candies. Four varieties: Yellow reg, Yellow share size, Chocolate reg and Chocolate king size.'),
  (166,
   'Reese''s peanut butter candy. Eight flavors: Cups regular, Cups king size, White cups reg, White cups king size, Pieces reg, Pieces king size, Fast break reg and Fast break king size.',
   'Reese''s peanut butter candy. Eight varieties: Cups regular, Cups king size, White cups reg, White cups king size, Pieces reg, Pieces king size, Fast break reg and Fast break king size.'),
  (169,
   'Skittles chewy candy. Eight flavors: Red reg, Red king size, Wildberry reg, Wildberry king size, Sour reg, Sour king size, Blue reg and Blue king size.',
   'Skittles chewy candy. Eight varieties: Red reg, Red king size, Wildberry reg, Wildberry king size, Sour reg, Sour king size, Blue reg and Blue king size.'),
  (171,
   'Hershey''s chocolate bars. Eight flavors: Milk reg, Milk king size, Cookies reg, Cookies king, Almond reg, Almond king, Mr. Goodbar reg and Mr. Goodbar king.',
   'Hershey''s chocolate bars. Eight varieties: Milk reg, Milk king size, Cookies reg, Cookies king, Almond reg, Almond king, Mr. Goodbar reg and Mr. Goodbar king.'),
  (197,
   'Haribo gummy candy peg bags. Seven flavors: Gold bears, Gold bears tropical, Gold bears sour, Sour streamers, Smurfs, Sour Smurfs and Twin snakes.',
   'Haribo gummy candy peg bags. Seven varieties: Gold bears, Gold bears tropical, Gold bears sour, Sour streamers, Smurfs, Sour Smurfs and Twin snakes.'),
  (198,
   'Trolli gummy candy peg bags. Three flavors: Sour brite crawlers, Peach and Octopus.',
   'Trolli gummy candy peg bags. Three varieties: Sour brite crawlers, Peach and Octopus.'),
  (201,
   'Life Savers Gummies peg bags. Seven flavors: 5-flavors, Collision, Wildberry, Sours, Fruit rings, XO rings and Exotics.',
   'Life Savers Gummies peg bags. Seven varieties: 5-flavors, Collision, Wildberry, Sours, Fruit rings, XO rings and Exotics.'),
  (255,
   'RAW Classic rolling papers. Two flavors: Classic 1 1/4 and Classic king size slim.',
   'RAW Classic rolling papers. Two sizes: Classic 1 1/4 and Classic king size slim.'),
  (256,
   'RAW pre-rolled cones in Classic, Organic and Black. Six flavors: Classic 6X, Classic 3X, Organic 6X, Organic 3X, Black 6X and Black 3X.',
   'RAW pre-rolled cones in Classic, Organic and Black. Six varieties: Classic 6X, Classic 3X, Organic 6X, Organic 3X, Black 6X and Black 3X.'),
  (257,
   'TOP fine gummed rolling papers. Two flavors: Jar and Box.',
   'TOP fine gummed rolling papers. Two formats: Jar and Box.'),
  (282,
   'JOB rolling papers. Four flavors: 1.5, 1.25, 1.0 and 1.5 slim.',
   'JOB rolling papers. Four sizes: 1.5, 1.25, 1.0 and 1.5 slim.'),
  (328,
   'Takis rolled tortilla chips. Four flavors: Fuego small, Fuego big, Blue heat small and Blue heat big.',
   'Takis rolled tortilla chips. Four varieties: Fuego small, Fuego big, Blue heat small and Blue heat big.'),
  (337,
   'Bob Marley rolling papers. Eight flavors: Yellow small, Yellow big, Yellow big with tips, Organic small, Organic big, Organic big with tips, Silver small and Silver big.',
   'Bob Marley rolling papers. Eight varieties: Yellow small, Yellow big, Yellow big with tips, Organic small, Organic big, Organic big with tips, Silver small and Silver big.'),
  (343,
   'Novelty gummy candy shaped like burgers, pizza, hot dogs and cupcakes. Six flavors: Burger, Pizza, Hotdog, Cupcake, SpongeBob and Sour burger.',
   'Novelty gummy candy shaped like burgers, pizza, hot dogs and cupcakes. Six varieties: Burger, Pizza, Hotdog, Cupcake, SpongeBob and Sour burger.')
) as v(id, old_text, new_text)
where p.id = v.id and p.description = v.old_text;

-- ---------------------------------------------------------------------------
-- (h) Reverse (AW-213). Not run; copy into the SQL editor to undo this migration.
-- Deploy the previous frontend first (the current one also works without
-- this migration). Functions go back before the table they read is dropped.
-- The description updates above are not undone: their old texts are the
-- old_text column of that update.
--
-- alter table public.products add column if not exists flavors integer not null default 0;
-- update public.products set flavors = jsonb_array_length(variants);
-- grant select (flavors) on public.products to anon, authenticated;
-- create or replace function public.admin_product_prices() ... -- the
--   20261009100000 definition ('variants', '{}'::jsonb)
-- create or replace function public.my_prices() ... -- the 20261009100000
--   definition ('variants', '{}'::jsonb)
-- create or replace function public.enforce_order_item_price() ... -- the
--   20261009100000 definition
-- alter table public.order_items drop column if exists sell_unit;
-- alter table public.products add column if not exists variant_prices jsonb not null default '{}'::jsonb;
-- update public.products p set variant_prices = coalesce((
--   select jsonb_object_agg(vp.variant, vp.price) from public.product_variant_prices vp
--   where vp.product_id = p.id and vp.price is not null), '{}'::jsonb);
--   -- (20261008200000's column; like price, keep it out of the anon grant)
-- drop table if exists public.product_variant_prices;
-- alter table public.products drop constraint if exists products_unavailable_variants_array;
-- alter table public.products drop constraint if exists products_variant_axis_chk;
-- alter table public.products drop column if exists unavailable_variants;
-- alter table public.products drop column if exists variant_axis;
