-- Orders come only from signed-in, approved accounts (AW-014, AW-024; the
-- owner's answer of October 2026): the site is for store owners with a
-- sales tax number and an ABC tobacco licence, anyone who buys is signed
-- in, and customers place orders, not quotes.
--
-- Until now submit_quote (v3, 20261009130000) took a quote from anyone: a
-- guest, or an account still waiting for approval, sent an unpriced quote
-- request (ALW-Q-), and only a suspended account was refused. From this
-- migration it refuses every caller but a signed-in account whose profile
-- is approved, before it checks, counts or saves anything:
--
--   no signed-in user (anon)                 hint sign_in_required
--   an account on hold                       hint account_suspended (as before)
--   any other account that isn't approved    hint account_not_approved
--   (pending, or no profile row)
--
-- The storefront words each hint (quoteErrorMessage in src/lib/orders.js).
-- Its checkout already asks guests to sign in and tells accounts under
-- review that they can order once approved, so on a live database without
-- this file nothing changes for buyers; this makes the database refuse the
-- same callers.
--
-- How: the rule is one function, public.require_ordering_account(), which
-- raises the refusal or returns. submit_quote is recreated from its latest
-- definition (20261009130000, section (b)) word for word, with one new
-- first statement that calls it. Same signature, defaults, return value,
-- hints and security definer; the 16- and 13-argument wrappers
-- (20261009130000, sections (c) and (d)) call it, so they get the rule too
-- and are left as they are. Grants are unchanged and given again below:
-- guests and signed-in accounts may still call submit_quote, so a guest's
-- call reaches the rule and gets sign_in_required instead of a bare
-- "permission denied". Only the definer functions may call
-- require_ordering_account() itself.
--
-- What becomes unreachable and is kept on purpose: the guest throttle keys,
-- the 'ALW-Q-' prefix and kind 'quote', and PR #12's licence rule for
-- unapproved accounts (license_required). They are the rest of v3's body,
-- unchanged, so relaxing the rule later only means changing
-- require_ordering_account(). Quotes saved before this stay as they are;
-- Admin -> Orders still prices and converts them.
--
-- Release: any time after 20261009130000. Before or after the frontend: the
-- new frontend never sends a guest's or unapproved account's order, and
-- words the new hints; the frontend deployed before it lets guests submit,
-- and they would then see its generic "We couldn't save this quote" text.
--
-- DB test: supabase/tests/27_orders_approved_only.sql. The older tests of
-- submit_quote's other checks (03, 05, 07, 09, 12, 16) set the rule aside
-- while they run and put it back.

-- ---------------------------------------------------------------------------
-- (a) The rule. Security definer, so it reads the caller's profile whatever
-- the profiles policies; stable, no writes. auth.uid() is the caller's, also
-- when called from submit_quote (security definer changes the role, not the
-- request's user).
-- ---------------------------------------------------------------------------
create or replace function public.require_ordering_account()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception using message = 'Sign in to place an order', hint = 'sign_in_required';
  end if;
  select status into v_status from public.profiles where id = v_uid;
  if v_status = 'suspended' then
    raise exception using message = 'This account is on hold', hint = 'account_suspended';
  end if;
  if v_status is distinct from 'approved' then
    raise exception using message = 'This account can place orders once it is approved', hint = 'account_not_approved';
  end if;
end;
$$;

revoke all on function public.require_ordering_account() from public, anon, authenticated;
grant execute on function public.require_ordering_account() to service_role;

-- ---------------------------------------------------------------------------
-- (b) submit_quote, from 20261009130000 section (b), with the rule first.
-- ---------------------------------------------------------------------------
create or replace function public.submit_quote(
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
  p_items jsonb,
  p_license_no text default null,
  p_resale_cert text default null,
  p_purchasers_21 boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- TODO(owner): confirm route states: do the delivery routes cover exactly Alabama, Mississippi and Georgia, as the site says? DELIVERY_ROUTE_STATES in src/data/quoteRules.js must match. (AW-198)
  v_route_states text[] := array['AL', 'MS', 'GA'];

  v_uid uuid := auth.uid();
  v_status text;
  v_approved boolean := false;
  v_restricted boolean := false;
  v_business text := btrim(coalesce(p_business, ''));
  v_contact text := btrim(coalesce(p_contact, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_street text := nullif(btrim(coalesce(p_ship_street, '')), '');
  v_city text := nullif(btrim(coalesce(p_ship_city, '')), '');
  v_state text := nullif(upper(btrim(coalesce(p_ship_state, ''))), '');
  v_zip text := nullif(btrim(coalesce(p_ship_zip, '')), '');
  v_license text := nullif(btrim(coalesce(p_license_no, '')), '');
  v_resale text := nullif(btrim(coalesce(p_resale_cert, '')), '');
  v_adults boolean := coalesce(p_purchasers_21, false);

  v_headers json;
  v_ip text;
  v_key text;
  v_ip_key text;

  v_attempt integer;
  v_ref text;
  v_order_id uuid;
  v_item jsonb;
  v_total_units integer := 0;
  v_subtotal numeric;
  v_priced integer := 0;
  v_unpriced integer := 0;
begin
  -- 20261014111000 (AW-014, AW-024): only a signed-in, approved account that
  -- isn't on hold places an order. First, before anything is checked,
  -- counted or saved.
  perform public.require_ordering_account();

  -- AW-201: ordering is paused on a suspended account.
  if v_uid is not null then
    select status into v_status from public.profiles where id = v_uid;
    if v_status = 'suspended' then
      raise exception using message = 'This account is on hold', hint = 'account_suspended';
    end if;
    v_approved := coalesce(v_status = 'approved', false);
  end if;

  -- The checks 20261008190000 made, now with hints.
  if p_delivery is null or p_delivery not in ('delivery', 'willcall') then
    raise exception using message = 'Invalid delivery method', hint = 'invalid_delivery';
  end if;
  if v_business = '' or v_contact = '' or v_email = '' or v_phone = '' then
    raise exception using message = 'Contact details are required', hint = 'contact_required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using message = 'Add at least one item', hint = 'no_items';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception using message = 'Too many items', hint = 'too_many_items';
  end if;

  -- AW-198 (a): lengths, as the storefront's maxLength attributes; the
  -- license answers (AW-014) are 64 characters at most.
  if length(v_business) > 200 or length(v_contact) > 120 or length(v_email) > 254
     or length(v_phone) > 40 or length(coalesce(v_notes, '')) > 2000
     or length(coalesce(v_street, '')) > 200 or length(coalesce(v_city, '')) > 100
     or length(coalesce(v_zip, '')) > 10
     or length(coalesce(v_license, '')) > 64 or length(coalesce(v_resale, '')) > 64 then
    raise exception using message = 'A field is too long', hint = 'field_too_long';
  end if;

  -- AW-198 (b): something@something.something, without spaces.
  if v_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception using message = 'Enter a valid email', hint = 'invalid_email';
  end if;

  -- AW-079: the ship-to address is needed only for delivery.
  if p_delivery = 'delivery'
     and (v_street is null or v_city is null or v_state is null or v_zip is null) then
    raise exception using message = 'A ship-to address is required', hint = 'address_required';
  end if;

  -- AW-198 (c), (d): ZIP and state are checked when they are given (always,
  -- for delivery). Any state is fine for will-call.
  if v_zip is not null and v_zip !~ '^[0-9]{5}(-[0-9]{4})?$' then
    raise exception using message = 'Enter a valid ZIP code', hint = 'invalid_zip';
  end if;
  if v_state is not null and v_state !~ '^[A-Z]{2}$' then
    raise exception using message = 'Use the 2-letter state code', hint = 'invalid_state';
  end if;

  -- AW-198 (e): delivery only inside the route states.
  if p_delivery = 'delivery' and not (v_state = any (v_route_states)) then
    raise exception using
      message = 'Delivery routes cover ' || array_to_string(v_route_states, ', ') || ' — choose will-call',
      hint = 'delivery_state';
  end if;

  -- AW-198 (f): no preferred date before today in Birmingham.
  if p_preferred_date is not null
     and p_preferred_date < (now() at time zone 'America/Chicago')::date then
    raise exception using message = 'Choose a date from today on', hint = 'past_date';
  end if;

  -- AW-014, unchanged from 20261008190000: tobacco and vape lines from a
  -- guest or an unapproved account need all three answers. Approved buyers
  -- were checked when they applied.
  select exists (
    select 1
    from jsonb_array_elements(p_items) as item
    join public.products pr on pr.id = (item->>'product_id')::integer
    where pr.cat = 'TOBACCO'
       or pr.sub in ('Disposable Vapes', 'Vape Pods')
  ) into v_restricted;
  if v_restricted and not v_approved
     and (v_license is null or v_resale is null or v_adults is not true) then
    raise exception using
      message = 'A tobacco license, resale certificate, and 21+ confirmation are required',
      hint = 'license_required';
  end if;

  -- AW-198 throttle: 5 quotes per key in 15 minutes, and 20 per guest
  -- address in an hour. The key is the account, or for a guest the first
  -- X-Forwarded-For address plus the email. X-Forwarded-For can be spoofed
  -- by the client, so this is best effort against casual flooding, not a
  -- guarantee. Without the header (a call that didn't come through the API,
  -- such as the SQL editor) the guest key uses 'unknown' and there is no
  -- per-address limit. Only digests are stored, and no error names the
  -- address or email. A refused or failed quote rolls its rows back, so only
  -- saved quotes count.
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  v_ip := nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  if v_uid is not null then
    v_key := encode(sha256(convert_to(v_uid::text, 'UTF8')), 'hex');
  else
    v_key := encode(sha256(convert_to('ip:' || coalesce(v_ip, 'unknown') || ':' || lower(v_email), 'UTF8')), 'hex');
    if v_ip is not null then
      v_ip_key := encode(sha256(convert_to('ip:' || v_ip, 'UTF8')), 'hex');
    end if;
  end if;

  delete from public.quote_throttle where created_at < now() - interval '1 day';

  -- Concurrent quotes from one caller wait for each other, so both can't
  -- pass the count. Always the address first, then the key.
  if v_ip_key is not null then
    perform pg_advisory_xact_lock(hashtextextended('quote_throttle:' || v_ip_key, 0));
  end if;
  perform pg_advisory_xact_lock(hashtextextended('quote_throttle:' || v_key, 0));

  if (select count(*) from public.quote_throttle
      where key = v_key and created_at > now() - interval '15 minutes') >= 5
     or (v_ip_key is not null and (select count(*) from public.quote_throttle
      where key = v_ip_key and created_at > now() - interval '1 hour') >= 20) then
    raise exception using message = 'Too many quote requests — please call the trade desk', hint = 'rate_limited';
  end if;
  insert into public.quote_throttle (key) values (v_key);
  if v_ip_key is not null then
    insert into public.quote_throttle (key) values (v_ip_key);
  end if;

  -- AW-049: the reference is made here. 10 hex digits of a random UUID are
  -- 40 random bits; a clash with an existing reference picks another one,
  -- up to five times. The old blanket "already submitted" handler is gone:
  -- nothing the caller sends can clash any more.
  for v_attempt in 1..5 loop
    v_ref := case when v_approved then 'ALW-O-' else 'ALW-Q-' end
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    begin
      insert into public.orders (
        ref_num, business, contact, email, phone, delivery, preferred_date, notes,
        ship_street, ship_city, ship_state, ship_zip,
        license_no, resale_cert_no, purchasers_21
      ) values (
        v_ref, v_business, v_contact, v_email, v_phone, p_delivery, p_preferred_date, v_notes,
        v_street, v_city, v_state, v_zip,
        v_license, v_resale, v_adults
      ) returning id into v_order_id;
      exit;
    exception when unique_violation then
      if v_attempt = 5 then
        raise exception using message = 'Could not assign a reference number', hint = 'ref_unavailable';
      end if;
    end;
  end loop;

  -- The trigger names, prices and checks each line (20261009110000).
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (order_id, product_id, product_name, sku, variant, qty)
    values (
      v_order_id,
      (v_item->>'product_id')::integer,
      '',
      '',
      nullif(btrim(coalesce(v_item->>'variant', '')), ''),
      (v_item->>'qty')::integer
    );
  end loop;

  select coalesce(sum(qty), 0),
         count(*) filter (where unit_price is not null),
         count(*) filter (where unit_price is null),
         sum(unit_price * qty)
    into v_total_units, v_priced, v_unpriced, v_subtotal
  from public.order_items
  where order_id = v_order_id;
  if v_priced = 0 then
    v_subtotal := null;
  end if;

  update public.orders
  set total_units = v_total_units,
      subtotal = v_subtotal
  where id = v_order_id;

  return jsonb_build_object(
    'id', v_order_id,
    'ref_num', v_ref,
    'kind', case when v_approved then 'order' else 'quote' end,
    'total_units', v_total_units,
    'subtotal', v_subtotal,
    'priced_lines', v_priced,
    'unpriced_lines', v_unpriced
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- (c) Grants, as 20261009130000 section (e) gave them, for all three
-- signatures.
-- ---------------------------------------------------------------------------
revoke all on function public.submit_quote(text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean) from public;
grant execute on function public.submit_quote(text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean) to anon, authenticated, service_role;

revoke all on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean) from public;
grant execute on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean) to anon, authenticated, service_role;

revoke all on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb) from public;
grant execute on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (d) Reverse. Not run; copy into the SQL editor to undo this migration
-- (guests and accounts under review could then submit quotes again):
--
-- create or replace function public.require_ordering_account()
-- returns void language plpgsql stable security definer set search_path = public
-- as $f$ begin end; $f$;
--
-- That keeps submit_quote as it is and lets every caller through the rule,
-- which is what 20261009130000 did (a suspended account is still refused by
-- submit_quote's own check). To remove the call itself, run section (b) of
-- 20261009130000_submit_quote_v3.sql again, then
-- drop function public.require_ordering_account();
