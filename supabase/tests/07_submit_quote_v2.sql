-- submit_quote v2 (20260928123000; AW-049, AW-198, AW-201, AW-079, AW-014).
-- Server-made references, the typed error hints, will-call without an
-- address, suspended accounts, the throttle, the legacy 13-argument wrapper,
-- the stored license details and the owner's license switch. Test accounts
-- ...0007a1/b1/c1, test products 90701 (TOBACCO, synthetic price) and 90702
-- (CANDIES, no price) and every order below are removed at the end. The
-- throttle is cleared as the superuser before each block.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000007a1', 'p7-pending@example.com', '{"name": "P7 Pending"}'),
  ('00000000-0000-4000-8000-0000000007b1', 'p7-approved@example.com', '{"name": "P7 Approved"}'),
  ('00000000-0000-4000-8000-0000000007c1', 'p7-suspended@example.com', '{"name": "P7 Suspended"}');
update public.profiles set status = 'approved', pricing_tier = 'silver' where id = '00000000-0000-4000-8000-0000000007b1';
update public.profiles set status = 'suspended' where id = '00000000-0000-4000-8000-0000000007c1';

insert into public.products (id, name, brand, cat, sub, sku, price, active) values
  (90701, 'P7 tobacco', 'Test', 'TOBACCO', 'Test line', 'AW-P7-TOBACCO', 10.10, true),
  (90702, 'P7 candy', 'Test', 'CANDIES', 'Test line', 'AW-P7-CANDY', null, true);

-- One quote, with every argument overridable by name.
create or replace function pg_temp.q(
  email text default 'p7-guest@example.com',
  delivery text default 'delivery',
  street text default '1 Test Way',
  city text default 'Birmingham',
  state text default 'AL',
  zip text default '35203',
  pdate date default null,
  business text default 'P7 Store',
  items jsonb default '[{"product_id": 90701, "qty": 2}]',
  license text default null,
  resale text default null,
  attested boolean default false
) returns jsonb language sql as $$
  select public.submit_quote(
    p_business => business, p_contact => 'P7 Contact', p_email => email, p_phone => '205-555-0107',
    p_delivery => delivery, p_preferred_date => pdate, p_notes => null,
    p_ship_street => street, p_ship_city => city, p_ship_state => state, p_ship_zip => zip,
    p_items => items, p_license_no => license, p_resale_cert_no => resale, p_license_attested => attested);
$$;

-- The hint a statement fails with, or null when it succeeds.
create or replace function pg_temp.hint_of(statement text) returns text language plpgsql as $$
declare h text;
begin
  execute statement;
  return null;
exception when raise_exception then
  get stacked diagnostics h = pg_exception_hint;
  return coalesce(h, 'no hint');
end $$;

-- ---------------------------------------------------------------------------
-- AW-049: references are made by the server, differ per quote, and are the
-- ones stored. A guest gets ALW-Q-.
-- ---------------------------------------------------------------------------
delete from public.quote_throttle;
select test_anon();
do $$
declare
  r1 jsonb := pg_temp.q(email => 'p7-ref-1@example.com');
  r2 jsonb := pg_temp.q(email => 'p7-ref-2@example.com');
begin
  assert r1->>'ref_num' ~ '^ALW-[QO]-[0-9A-F]{10}$', r1->>'ref_num';
  assert r2->>'ref_num' ~ '^ALW-Q-[0-9A-F]{10}$', r2->>'ref_num';
  assert r1->>'ref_num' <> r2->>'ref_num', 'two quotes get different references';
  assert r1->>'kind' = 'quote', 'a guest sends a quote';
  assert (r1->>'priced_lines')::int = 0 and (r1->>'unpriced_lines')::int = 1, 'a guest line is unpriced';
  assert r1->'subtotal' = 'null'::jsonb, 'no priced line, no subtotal';
  perform set_config('test.p7_ref1', r1->>'ref_num', false);
  perform set_config('test.p7_id1', r1->>'id', false);
end $$;
select test_reset();
do $$ begin
  assert (select ref_num from public.orders where id = current_setting('test.p7_id1')::uuid) = current_setting('test.p7_ref1'),
    'the returned reference is the stored one';
end $$;

-- An approved buyer gets ALW-O- and an order; the subtotal adds only the
-- priced lines.
delete from public.quote_throttle;
select test_login('00000000-0000-4000-8000-0000000007b1');
do $$
declare
  r jsonb := pg_temp.q(email => 'p7-approved@example.com',
    items => '[{"product_id": 90701, "qty": 3}, {"product_id": 90702, "qty": 1}]');
begin
  assert r->>'ref_num' ~ '^ALW-O-[0-9A-F]{10}$', r->>'ref_num';
  assert r->>'kind' = 'order', 'an approved buyer places an order';
  assert (r->>'priced_lines')::int = 1 and (r->>'unpriced_lines')::int = 1, 'one priced line, one on request';
  -- 10.10 less 5% is 9.595, which rounds to 9.60.
  assert (r->>'subtotal')::numeric = 28.80, 'the subtotal is the priced line';
  assert (r->>'total_units')::int = 4, 'every line counts toward the units';
  assert (select ref_num from public.orders where id = (r->>'id')::uuid) = r->>'ref_num', 'the buyer reads back the same reference';
end $$;
select test_reset();

-- A pending account still sends a quote.
delete from public.quote_throttle;
select test_login('00000000-0000-4000-8000-0000000007a1');
do $$
declare r jsonb := pg_temp.q(email => 'p7-pending@example.com');
begin
  assert r->>'ref_num' ~ '^ALW-Q-[0-9A-F]{10}$' and r->>'kind' = 'quote', 'a pending account sends a quote';
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- AW-079: will-call needs no address; delivery does.
-- ---------------------------------------------------------------------------
delete from public.quote_throttle;
select test_anon();
do $$
declare r jsonb;
begin
  r := pg_temp.q(email => 'p7-willcall@example.com', delivery => 'willcall', street => null, city => null, state => null, zip => null);
  perform set_config('test.p7_willcall', r->>'id', false);
  -- Blank strings count as no address, and any state is fine for will-call.
  r := pg_temp.q(email => 'p7-willcall-2@example.com', delivery => 'willcall', street => '', city => ' ', state => 'tn', zip => '');
  perform set_config('test.p7_willcall_tn', r->>'id', false);
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-nowhere@example.com', street => null, city => null, state => null, zip => null)$s$)
    = 'address_required', 'delivery needs an address';
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-nowhere@example.com', street => '  ')$s$)
    = 'address_required', 'delivery needs every address field';
end $$;
select test_reset();
do $$ begin
  assert (select ship_street is null and ship_city is null and ship_state is null and ship_zip is null and delivery = 'willcall'
          from public.orders where id = current_setting('test.p7_willcall')::uuid), 'will-call stores no address';
  assert (select ship_street is null and ship_city is null and ship_state = 'TN' and ship_zip is null
          from public.orders where id = current_setting('test.p7_willcall_tn')::uuid), 'blank fields are stored as null, the state upper-cased';
end $$;

-- ---------------------------------------------------------------------------
-- AW-198: lengths and formats, each with its hint. Refused calls save
-- nothing and don't count toward the throttle.
-- ---------------------------------------------------------------------------
delete from public.quote_throttle;
select test_anon();
do $$ begin
  assert pg_temp.hint_of($s$select pg_temp.q(business => repeat('x', 201))$s$) = 'field_too_long', 'a 201-character business name';
  assert pg_temp.hint_of($s$select pg_temp.q(street => repeat('x', 201))$s$) = 'field_too_long', 'a 201-character street';
  assert pg_temp.hint_of($s$select pg_temp.q(license => repeat('x', 65))$s$) = 'field_too_long', 'a 65-character license number';
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'not-an-email')$s$) = 'invalid_email', 'an email without @';
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'a b@example.com')$s$) = 'invalid_email', 'an email with a space';
  assert pg_temp.hint_of($s$select pg_temp.q(zip => '3520')$s$) = 'invalid_zip', 'a four-digit ZIP';
  assert pg_temp.hint_of($s$select pg_temp.q(delivery => 'willcall', zip => 'ABCDE')$s$) = 'invalid_zip', 'a ZIP given for will-call is checked too';
  assert pg_temp.hint_of($s$select pg_temp.q(state => 'Alabama')$s$) = 'invalid_state', 'a state name instead of its code';
  assert pg_temp.hint_of($s$select pg_temp.q(state => 'TN')$s$) = 'delivery_state', 'delivery outside the route states';
  assert pg_temp.hint_of($s$select pg_temp.q(pdate => (now() at time zone 'America/Chicago')::date - 1)$s$) = 'past_date', 'yesterday in Birmingham';
  assert pg_temp.hint_of($s$select pg_temp.q(delivery => 'pickup')$s$) = 'invalid_delivery', 'an unknown delivery method';
  assert pg_temp.hint_of($s$select pg_temp.q(business => '  ')$s$) = 'contact_required', 'a blank business name';
  assert pg_temp.hint_of($s$select pg_temp.q(items => '[]')$s$) = 'no_items', 'no items';
  -- Accepted: today in Birmingham, a ZIP+4, a lower-case route state.
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-ok@example.com', pdate => (now() at time zone 'America/Chicago')::date, zip => '35203-1234', state => 'ms')$s$) is null,
    'today, ZIP+4 and a lower-case state are accepted';
end $$;
select test_reset();
do $$ begin
  assert (select count(*) from public.quote_throttle) = 1, 'only the saved quote counted';
end $$;

-- ---------------------------------------------------------------------------
-- AW-201: a suspended account can't submit.
-- ---------------------------------------------------------------------------
delete from public.quote_throttle;
select test_login('00000000-0000-4000-8000-0000000007c1');
do $$
declare
  msg text;
  h text;
begin
  begin
    perform pg_temp.q(email => 'p7-suspended@example.com');
  exception when raise_exception then
    get stacked diagnostics msg = message_text, h = pg_exception_hint;
  end;
  assert h = 'account_suspended', coalesce(h, 'a suspended account submitted a quote');
  assert msg = 'This account is on hold', msg;
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- AW-198 throttle: the sixth quote from one guest address and email inside
-- 15 minutes is refused; another email from the same (unknown) address is
-- not.
-- ---------------------------------------------------------------------------
delete from public.quote_throttle;
select test_anon();
do $$ begin
  for i in 1..5 loop
    perform pg_temp.q(email => 'p7-busy@example.com');
  end loop;
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'P7-Busy@example.com')$s$) = 'rate_limited', 'the sixth quote in 15 minutes (email case ignored)';
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-other@example.com')$s$) is null, 'another email is a separate key';
end $$;
select test_reset();

-- A signed-in account is one key, whatever email it sends.
delete from public.quote_throttle;
select test_login('00000000-0000-4000-8000-0000000007a1');
do $$ begin
  for i in 1..5 loop
    perform pg_temp.q(email => 'p7-pending-' || i || '@example.com');
  end loop;
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-pending-6@example.com')$s$) = 'rate_limited', 'the account’s sixth quote in 15 minutes';
end $$;
select test_reset();

-- A guest address with 20 quotes in the hour is refused, whatever the email.
-- The first X-Forwarded-For entry is the address.
delete from public.quote_throttle;
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.7, 10.0.0.1"}', false);
select test_anon();
do $$ begin
  for i in 1..20 loop
    perform pg_temp.q(email => 'p7-ip-' || i || '@example.com');
  end loop;
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-ip-21@example.com')$s$) = 'rate_limited', 'the address’s 21st quote in the hour';
end $$;
select test_reset();
select set_config('request.headers', '{"x-forwarded-for": "198.51.100.9"}', false);
select test_anon();
do $$ begin
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-ip-21@example.com')$s$) is null, 'another address is not limited';
end $$;
select test_reset();
select set_config('request.headers', '', false);

-- Only digests are stored, and rows older than a day go on the next call.
do $$ begin
  assert (select bool_and(key ~ '^[0-9a-f]{64}$') from public.quote_throttle), 'keys are SHA-256 hex digests';
  assert not exists (select 1 from public.quote_throttle where key like '%203.0.113.7%' or key like '%@%'), 'no address or email in the clear';
  assert exists (select 1 from public.quote_throttle
                 where key = encode(sha256(convert_to('ip:203.0.113.7', 'UTF8')), 'hex')), 'the per-address key';
end $$;
delete from public.quote_throttle;
insert into public.quote_throttle (key, created_at) values ('p7-stale', now() - interval '2 days');
select test_anon();
select pg_temp.q(email => 'p7-cleanup@example.com');
select test_reset();
do $$ begin
  assert not exists (select 1 from public.quote_throttle where key = 'p7-stale'), 'rows older than a day are deleted';
end $$;

-- Guests and signed-in accounts can't read or write the throttle.
select test_anon();
do $$ begin
  begin
    perform count(*) from public.quote_throttle;
    raise exception 'anon read quote_throttle';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.quote_throttle (key) values ('p7-anon');
    raise exception 'anon wrote quote_throttle';
  exception when insufficient_privilege then null;
  end;
end $$;
select test_reset();
select test_login('00000000-0000-4000-8000-0000000007b1');
do $$ begin
  begin
    perform count(*) from public.quote_throttle;
    raise exception 'a signed-in account read quote_throttle';
  exception when insufficient_privilege then null;
  end;
end $$;
select test_reset();

-- ---------------------------------------------------------------------------
-- The legacy 13-argument call (the frontend deployed before this migration)
-- still works and ignores its p_ref_num, also when it repeats one.
-- ---------------------------------------------------------------------------
delete from public.quote_throttle;
select test_anon();
do $$
declare r jsonb;
begin
  for i in 1..2 loop
    r := public.submit_quote(
      p_ref_num => 'T-P7-LEGACY', p_business => 'P7 Store', p_contact => 'P7 Contact', p_email => 'p7-legacy@example.com',
      p_phone => '205-555-0107', p_delivery => 'willcall', p_preferred_date => null, p_notes => null,
      p_ship_street => '613 Graymont Ave N', p_ship_city => 'Birmingham', p_ship_state => 'AL', p_ship_zip => '35203',
      p_items => '[{"product_id": 90701, "qty": 1}]');
    assert r->>'ref_num' ~ '^ALW-Q-[0-9A-F]{10}$', r->>'ref_num';
  end loop;
end $$;
select test_reset();
do $$ begin
  assert not exists (select 1 from public.orders where ref_num = 'T-P7-LEGACY'), 'the client reference is ignored';
  assert (select count(*) from public.orders where email = 'p7-legacy@example.com') = 2, 'a repeated client reference is no conflict';
  assert has_function_privilege('anon', 'public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb)', 'execute'),
    'guests can call the legacy signature';
  assert has_function_privilege('anon', 'public.submit_quote(text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean)', 'execute'),
    'guests can call the new signature';
  assert has_function_privilege('authenticated', 'public.submit_quote(text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean)', 'execute'),
    'signed-in accounts can call the new signature';
end $$;

-- ---------------------------------------------------------------------------
-- AW-014: the license details are stored, trimmed; the attestation as a time.
-- ---------------------------------------------------------------------------
delete from public.quote_throttle;
select test_anon();
do $$
declare r jsonb;
begin
  r := pg_temp.q(email => 'p7-license@example.com', license => '  TL-0001  ', resale => 'RS-0002 ', attested => true);
  perform set_config('test.p7_license', r->>'id', false);
  r := pg_temp.q(email => 'p7-nolicense@example.com', license => '', resale => null);
  perform set_config('test.p7_nolicense', r->>'id', false);
end $$;
select test_reset();
do $$ begin
  assert (select license_no = 'TL-0001' and resale_cert_no = 'RS-0002' and license_attested_at is not null
          from public.orders where id = current_setting('test.p7_license')::uuid), 'license details are stored';
  assert (select license_no is null and resale_cert_no is null and license_attested_at is null
          from public.orders where id = current_setting('test.p7_nolicense')::uuid), 'no details, nulls';
end $$;

-- The owner's switch (v_require_license): with it on, a caller who isn't an
-- approved buyer needs all three details for a tobacco or novelty line. The
-- function is recreated with the switch on, then put back.
select set_config('test.p7_def', pg_get_functiondef(
  'public.submit_quote(text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean)'::regprocedure), false);
do $$ begin
  assert position('v_require_license boolean := false;' in current_setting('test.p7_def')) > 0, 'the switch ships off';
  execute replace(current_setting('test.p7_def'), 'v_require_license boolean := false;', 'v_require_license boolean := true;');
end $$;
delete from public.quote_throttle;
select test_anon();
do $$ begin
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-req-1@example.com')$s$) = 'license_required', 'a tobacco line needs the details';
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-req-1@example.com', license => 'TL-1', resale => 'RS-1')$s$) = 'license_required', 'and the attestation';
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-req-1@example.com', license => 'TL-1', resale => 'RS-1', attested => true)$s$) is null, 'all three pass';
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-req-2@example.com', items => '[{"product_id": 90702, "qty": 1}]')$s$) is null, 'a cart without restricted lines needs none';
end $$;
select test_reset();
select test_login('00000000-0000-4000-8000-0000000007b1');
do $$ begin
  assert pg_temp.hint_of($s$select pg_temp.q(email => 'p7-approved@example.com')$s$) is null, 'an approved buyer needs none';
end $$;
select test_reset();
do $$ begin
  execute current_setting('test.p7_def');
  assert position('v_require_license boolean := false;' in pg_get_functiondef(
    'public.submit_quote(text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean)'::regprocedure)) > 0,
    'the switch is off again';
  assert has_function_privilege('anon', 'public.submit_quote(text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean)', 'execute'),
    'recreating kept the grant';
end $$;

-- Leave the shared database as later test files expect it.
delete from public.orders where email like 'p7-%@example.com' or email like 'P7-%@example.com';
delete from public.products where id in (90701, 90702);
delete from public.quote_throttle;
