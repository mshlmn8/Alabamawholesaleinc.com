-- Typed hints on the order-line trigger's refusals (20261011110000_order_item_hints.sql,
-- AW-200), through submit_quote v3: each keeps its message word for word
-- and adds a hint and, as the detail, the line's product id. A refused
-- quote saves nothing.
-- Lane c-support test file. Test products 95161 (deactivated) and 95162
-- (three sizes, one not available) are made here and removed at the end,
-- with every order below. Helpers carry the sup16_ prefix (pg_temp lives
-- for the whole run).

insert into public.products (id, name, brand, cat, sub, sku, price, active, variants, unavailable_variants) values
  (95161, 'Sup16 discontinued candy', 'Test', 'CANDIES', 'Test line', 'AW-SUP16-GONE', null, false, '[]', '[]'),
  (95162, 'Sup16 gum', 'Test', 'CANDIES', 'Test line', 'AW-SUP16-GUM', null, true, '["Small", "Big", "Party"]', '["Party"]');

-- A guest quote of `items`, with every other argument valid.
create or replace function pg_temp.sup16_quote(items jsonb, email text default 'sup16-guest@example.com') returns jsonb language sql as $$
  select public.submit_quote(
    p_business => 'Sup16 Store', p_contact => 'Sup16 Contact', p_email => email, p_phone => '205-555-0116',
    p_delivery => 'willcall', p_preferred_date => null, p_notes => null,
    p_ship_street => null, p_ship_city => null, p_ship_state => null, p_ship_zip => null,
    p_items => items);
$$;

-- What a statement fails with: its message, hint, detail and SQLSTATE
-- (null when it succeeds).
create or replace function pg_temp.sup16_refusal(statement text) returns jsonb language plpgsql as $$
declare m text; h text; d text; c text;
begin
  execute statement;
  return null;
exception when others then
  get stacked diagnostics m = message_text, h = pg_exception_hint, d = pg_exception_detail, c = returned_sqlstate;
  return jsonb_build_object('message', m, 'hint', h, 'detail', d, 'state', c);
end $$;

delete from public.quote_throttle;
select test_anon();
do $$
declare
  r jsonb;
  saved int := (select count(*) from public.orders where email like 'sup16-%@example.com');
begin
  -- A product deactivated since it was carted.
  r := pg_temp.sup16_refusal($s$select pg_temp.sup16_quote('[{"product_id": 95161, "qty": 1}]')$s$);
  assert r ->> 'hint' = 'product_unavailable', format('a deactivated product: %s', r);
  assert r ->> 'detail' = '95161', format('names the product id: %s', r);
  assert r ->> 'message' = 'Product is not available', format('the message is unchanged: %s', r);
  assert r ->> 'state' = 'P0001', format('still raise_exception: %s', r);

  -- A product with several variants and none chosen.
  r := pg_temp.sup16_refusal($s$select pg_temp.sup16_quote('[{"product_id": 95162, "qty": 1}]')$s$);
  assert r ->> 'hint' = 'variant_required', format('no variant: %s', r);
  assert r ->> 'detail' = '95162', format('names the product id: %s', r);
  assert r ->> 'message' = 'Choose a variant for Sup16 gum', format('the message still names the product: %s', r);

  -- submit_quote v3 doesn't check quantities itself: the trigger does.
  r := pg_temp.sup16_refusal($s$select pg_temp.sup16_quote('[{"product_id": 95162, "variant": "Small", "qty": 0}]')$s$);
  assert r ->> 'hint' = 'invalid_quantity', format('quantity 0: %s', r);
  assert r ->> 'detail' = '95162' and r ->> 'message' = 'Invalid quantity', format('quantity 0: %s', r);
  r := pg_temp.sup16_refusal($s$select pg_temp.sup16_quote('[{"product_id": 95162, "variant": "Small", "qty": 100001}]')$s$);
  assert r ->> 'hint' = 'invalid_quantity', format('quantity 100001: %s', r);

  -- A variant the product doesn't list, and one it marks not available.
  r := pg_temp.sup16_refusal($s$select pg_temp.sup16_quote('[{"product_id": 95162, "variant": "Huge", "qty": 1}]')$s$);
  assert r ->> 'hint' = 'unknown_variant' and r ->> 'detail' = '95162', format('an unknown variant: %s', r);
  assert r ->> 'message' = 'Unknown variant for Sup16 gum', format('the message is unchanged: %s', r);
  r := pg_temp.sup16_refusal($s$select pg_temp.sup16_quote('[{"product_id": 95162, "variant": "Party", "qty": 1}]')$s$);
  assert r ->> 'hint' = 'variant_unavailable' and r ->> 'detail' = '95162', format('a variant not available: %s', r);
  assert r ->> 'message' = 'That variant is not available', format('the message is unchanged: %s', r);

  -- The second line is the one refused: its product is named, not the first's.
  r := pg_temp.sup16_refusal($s$select pg_temp.sup16_quote('[{"product_id": 95162, "variant": "Big", "qty": 2}, {"product_id": 95161, "qty": 1}]')$s$);
  assert r ->> 'hint' = 'product_unavailable' and r ->> 'detail' = '95161', format('the refused line: %s', r);

  -- A line without a product id is refused the same way, not with "RAISE
  -- option cannot be null".
  r := pg_temp.sup16_refusal($s$select pg_temp.sup16_quote('[{"qty": 1}]')$s$);
  assert r ->> 'hint' = 'product_unavailable' and r ->> 'detail' = '', format('no product id: %s', r);

  assert (select count(*) from public.orders where email like 'sup16-%@example.com') = saved, 'a refused quote saves nothing';

  -- A valid line still goes through.
  r := pg_temp.sup16_quote('[{"product_id": 95162, "variant": "big", "qty": 3}]');
  assert r ->> 'ref_num' ~ '^ALW-Q-[0-9A-F]{10}$', format('a valid quote is saved: %s', r);
  perform set_config('test.sup16_order', r ->> 'id', false);
end $$;
select test_reset();

do $$ begin
  assert (select variant from public.order_items where order_id = current_setting('test.sup16_order')::uuid) = 'Big',
    'the line keeps the canonical variant label';
  -- Still a trigger function nobody calls through the API.
  assert not has_function_privilege('anon', 'public.enforce_order_item_price()', 'execute'), 'anon cannot execute the trigger function';
  assert not has_function_privilege('authenticated', 'public.enforce_order_item_price()', 'execute'), 'authenticated cannot execute it';
  assert (select prosecdef from pg_proc where oid = 'public.enforce_order_item_price()'::regprocedure), 'still security definer';
  assert (select proconfig @> array['search_path=public'] from pg_proc where oid = 'public.enforce_order_item_price()'::regprocedure),
    'with search_path = public';
  assert exists (select 1 from pg_trigger where tgname = 'order_items_price' and tgrelid = 'public.order_items'::regclass),
    'Cursor''s order_items_price trigger is still there';
end $$;

-- Leave the shared database as later test files expect it.
delete from public.orders where email like 'sup16-%@example.com';
delete from public.products where id in (95161, 95162);
delete from public.quote_throttle;
