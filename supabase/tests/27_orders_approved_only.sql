-- Only signed-in, approved accounts place orders (20261014111000; AW-014,
-- AW-024). A guest, an account under review, one on hold and a signed-in
-- user without a profile are refused with their hints, through all three
-- submit_quote signatures, before anything is saved or counted; an approved
-- account still places an order. The rule itself is public.
-- require_ordering_account(), which no caller may run directly.
-- Test accounts ...0027a1 (pending), b1 (approved), c1 (suspended), d1 (no
-- profile), test product 92701 (CANDIES, synthetic price); every order below
-- is removed at the end. pg_temp helpers are prefixed p27_.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000027a1', 'p27-pending@example.com', '{"name": "P27 Pending"}'),
  ('00000000-0000-4000-8000-0000000027b1', 'p27-approved@example.com', '{"name": "P27 Approved"}'),
  ('00000000-0000-4000-8000-0000000027c1', 'p27-suspended@example.com', '{"name": "P27 Suspended"}'),
  ('00000000-0000-4000-8000-0000000027d1', 'p27-noprofile@example.com', '{"name": "P27 No profile"}');
update public.profiles set status = 'approved', pricing_tier = 'silver' where id = '00000000-0000-4000-8000-0000000027b1';
update public.profiles set status = 'suspended' where id = '00000000-0000-4000-8000-0000000027c1';
delete from public.profiles where id = '00000000-0000-4000-8000-0000000027d1';

insert into public.products (id, name, brand, cat, sub, sku, price, active) values
  (92701, 'P27 candy', 'Test', 'CANDIES', 'Test line', 'AW-P27-CANDY', 3.00, true);

delete from public.quote_throttle;

-- One order through the current (15-argument) signature.
create or replace function pg_temp.p27_order(email text) returns jsonb language sql as $$
  select public.submit_quote(
    p_business => 'P27 Store', p_contact => 'P27 Contact', p_email => email, p_phone => '205-555-0127',
    p_delivery => 'delivery', p_preferred_date => null, p_notes => null,
    p_ship_street => '1 Test Way', p_ship_city => 'Birmingham', p_ship_state => 'AL', p_ship_zip => '35203',
    p_items => '[{"product_id": 92701, "qty": 2}]'::jsonb);
$$;

-- The hint and message a statement fails with, or null when it succeeds.
create or replace function pg_temp.p27_refusal(statement text) returns text language plpgsql as $$
declare
  h text;
  m text;
begin
  execute statement;
  return null;
exception when raise_exception then
  get stacked diagnostics h = pg_exception_hint, m = message_text;
  return coalesce(h, 'no hint') || ': ' || m;
end $$;

-- The three signatures, each with a candy line (no licence needed) and a
-- will-call or delivery address the older ones accept.
create or replace function pg_temp.p27_refusals(email text) returns text[] language sql as $$
  select array[
    pg_temp.p27_refusal(format('select pg_temp.p27_order(%L)', email)),
    pg_temp.p27_refusal(format($s$select public.submit_quote(
      p_ref_num => 'T-P27-16', p_business => 'P27 Store', p_contact => 'P27 Contact', p_email => %L,
      p_phone => '205-555-0127', p_delivery => 'delivery', p_preferred_date => null, p_notes => null,
      p_ship_street => '1 Test Way', p_ship_city => 'Birmingham', p_ship_state => 'AL', p_ship_zip => '35203',
      p_items => '[{"product_id": 92701, "qty": 1}]'::jsonb, p_license_no => null, p_resale_cert => null, p_purchasers_21 => false)$s$, email)),
    pg_temp.p27_refusal(format($s$select public.submit_quote('T-P27-13', 'P27 Store', 'P27 Contact', %L, '205-555-0127', 'willcall', null, null,
      '613 Graymont Ave N', 'Birmingham', 'AL', '35203', '[{"product_id": 92701, "qty": 1}]'::jsonb)$s$, email))
  ];
$$;

-- ---------------------------------------------------------------------------
-- A guest: sign_in_required, from every signature.
-- ---------------------------------------------------------------------------
select test_anon();
do $$
declare r text[] := pg_temp.p27_refusals('p27-guest@example.com');
begin
  assert r = array[
    'sign_in_required: Sign in to place an order',
    'sign_in_required: Sign in to place an order',
    'sign_in_required: Sign in to place an order'
  ], array_to_string(r, ' | ');
end $$;
select test_reset();

-- Before anything else is checked: a guest's invalid call gets the same
-- refusal, not the field's own hint.
select test_anon();
do $$ begin
  assert pg_temp.p27_refusal($s$select public.submit_quote(
    p_business => '', p_contact => '', p_email => 'not-an-email', p_phone => '', p_delivery => 'pickup',
    p_preferred_date => null, p_notes => null, p_ship_street => null, p_ship_city => null, p_ship_state => null,
    p_ship_zip => null, p_items => '[]'::jsonb)$s$) = 'sign_in_required: Sign in to place an order',
    'the sign-in rule comes first';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- An account under review, one without a profile row, and one on hold.
-- ---------------------------------------------------------------------------
select test_login('00000000-0000-4000-8000-0000000027a1');
do $$
declare r text[] := pg_temp.p27_refusals('p27-pending@example.com');
begin
  assert r = array[
    'account_not_approved: This account can place orders once it is approved',
    'account_not_approved: This account can place orders once it is approved',
    'account_not_approved: This account can place orders once it is approved'
  ], array_to_string(r, ' | ');
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000027d1');
do $$ begin
  assert pg_temp.p27_refusal($s$select pg_temp.p27_order('p27-noprofile@example.com')$s$)
    = 'account_not_approved: This account can place orders once it is approved', 'a signed-in user without a profile';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000027c1');
do $$
declare r text[] := pg_temp.p27_refusals('p27-suspended@example.com');
begin
  assert r = array[
    'account_suspended: This account is on hold',
    'account_suspended: This account is on hold',
    'account_suspended: This account is on hold'
  ], array_to_string(r, ' | ');
end $$;
select test_reset();

-- Nothing was saved, and nothing counted toward the throttle.
do $$ begin
  assert not exists (select 1 from public.orders where email like 'p27-%@example.com'), 'no refused call saved an order';
  assert not exists (select 1 from public.quote_throttle), 'no refused call was counted';
end $$;

-- Once approved, the same account orders: an order, priced, with ALW-O-.
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000027a1';
select test_login('00000000-0000-4000-8000-0000000027a1');
do $$
declare r jsonb := pg_temp.p27_order('p27-pending@example.com');
begin
  assert r->>'kind' = 'order', 'an approved account places an order';
  assert r->>'ref_num' ~ '^ALW-O-[0-9A-F]{10}$', r->>'ref_num';
  assert (r->>'priced_lines')::int = 1 and (r->>'total_units')::int = 2, r::text;
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- An approved account, through every signature.
-- ---------------------------------------------------------------------------
delete from public.quote_throttle;
select test_login('00000000-0000-4000-8000-0000000027b1');
do $$
declare r text[] := pg_temp.p27_refusals('p27-approved@example.com');
begin
  assert r = array[null, null, null]::text[], array_to_string(r, ' | ');
end $$;
select test_reset();
do $$ begin
  assert (select count(*) from public.orders where email = 'p27-approved@example.com' and kind = 'order'
            and user_id = '00000000-0000-4000-8000-0000000027b1') = 3, 'three orders, each the account’s';
end $$;

-- ---------------------------------------------------------------------------
-- The rule's function: security definer, run by submit_quote, never called
-- directly by guests or accounts. submit_quote keeps its signatures and
-- grants, so a guest's call reaches the rule and gets its hint.
-- ---------------------------------------------------------------------------
do $$ begin
  assert (select prosecdef from pg_proc where oid = 'public.require_ordering_account()'::regprocedure), 'the rule is security definer';
  assert not has_function_privilege('anon', 'public.require_ordering_account()', 'execute'), 'guests can’t run the rule';
  assert not has_function_privilege('authenticated', 'public.require_ordering_account()', 'execute'), 'accounts can’t run the rule';
  assert (select count(*) from pg_proc where proname = 'submit_quote' and pronamespace = 'public'::regnamespace) = 3,
    'the function and its two wrappers, as before';
  assert (select pg_get_function_identity_arguments(oid) from pg_proc
          where proname = 'submit_quote' and pronamespace = 'public'::regnamespace and prosecdef)
    = 'p_business text, p_contact text, p_email text, p_phone text, p_delivery text, p_preferred_date date, p_notes text, p_ship_street text, p_ship_city text, p_ship_state text, p_ship_zip text, p_items jsonb, p_license_no text, p_resale_cert text, p_purchasers_21 boolean',
    'the same 15 arguments';
  assert has_function_privilege('anon', 'public.submit_quote(text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean)', 'execute'),
    'guests still reach submit_quote, and get sign_in_required';
  assert has_function_privilege('authenticated', 'public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb)', 'execute'),
    'the 13-argument wrapper is still callable';
end $$;

select test_anon();
do $$ begin
  begin
    perform public.require_ordering_account();
    raise exception 'anon ran require_ordering_account()';
  exception when insufficient_privilege then null;
  end;
end $$;
select test_reset();

-- Leave the shared database as later test files expect it.
delete from public.orders where email like 'p27-%@example.com';
delete from public.products where id = 92701;
delete from public.quote_throttle;
