-- submit_quote v2 (AW-049, AW-198, AW-201, AW-079, AW-014): one rewrite of
-- the quote function, as plan/conflicts.md asks, recreated from the
-- 20260925120000 definition. Lines are still priced, and variants still
-- checked, by the order_items trigger (20260928121000).
--
--   AW-049  the reference number is made here, from 40 random bits
--           ('ALW-Q-' for a quote, 'ALW-O-' for an approved buyer's order),
--           and returned; a caller can no longer choose or pre-claim one
--   AW-198  length, email, ZIP, state, route-state and date checks, and a
--           throttle per account (or per guest address and email) and per
--           guest address
--   AW-201  a suspended account can't submit
--   AW-079  a ship-to address is required only for delivery; will-call
--           stores the fields it was given, or null
--   AW-014  the store's tobacco/retail license, resale certificate and
--           attestation are stored with the quote; requiring them for
--           guests' tobacco and novelty lines waits on the owner
--
-- Errors carry a typed hint (raise ... using hint = '...'), which the
-- storefront maps to its own text (quoteErrorMessage in src/lib/orders.js):
--   account_suspended, invalid_delivery, contact_required, no_items,
--   too_many_items, field_too_long, invalid_email, address_required,
--   invalid_zip, invalid_state, delivery_state, past_date, license_required,
--   rate_limited, ref_unavailable
--
-- Deliberate deviation from conflicts.md ("drops the 13-argument function"):
-- the 13-argument submit_quote(p_ref_num, …) stays, as a thin wrapper that
-- ignores p_ref_num and calls the new function. The frontend deployed before
-- this migration still sends p_ref_num; without the wrapper every quote from
-- it would fail between this migration and the new frontend's deploy. The
-- wrapper can't choose a reference either. PostgREST picks the overload by
-- the argument names in the request (only the wrapper has p_ref_num, and it
-- has no license arguments), so the two never both match. Dropping the
-- wrapper is a later step in BACKEND.md's release checklist.
--
-- Release order: after 20260928122000, before the new frontend. The new
-- frontend also works before this migration: when the new signature is
-- missing (PGRST202) it calls the old one with a long random reference, and
-- sends the warehouse address for will-call.

-- ---------------------------------------------------------------------------
-- (a) The license details a quote was sent with (AW-014). Admins read them
-- with the order; the buyer's own read-back (orders_self_read) includes them.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists license_no text,
  add column if not exists resale_cert_no text,
  add column if not exists license_attested_at timestamptz;

-- ---------------------------------------------------------------------------
-- (b) Recent quotes per caller, for the throttle (AW-198). A key is the
-- SHA-256 hex digest of the account id, or of the guest's address and email,
-- or of the guest's address alone, so the table holds no personal data in
-- the clear. Rows older than a day are deleted by submit_quote itself. Only
-- submit_quote (security definer) reads or writes it: RLS is on with no
-- policies, and guests and signed-in accounts have no privileges on it.
-- ---------------------------------------------------------------------------
create table if not exists public.quote_throttle (
  key text not null,
  created_at timestamptz not null default now()
);

create index if not exists quote_throttle_key_created_at_idx
  on public.quote_throttle (key, created_at);

alter table public.quote_throttle enable row level security;

-- Supabase's default privileges give anon and authenticated every privilege
-- on a new table, TRUNCATE included, which RLS doesn't cover.
revoke all on public.quote_throttle from public, anon, authenticated;
grant all on public.quote_throttle to service_role;

-- ---------------------------------------------------------------------------
-- (c) The new submit_quote. No p_ref_num; three license arguments with
-- defaults at the end. Returns
--   { id, ref_num, kind: 'order' | 'quote', total_units, subtotal,
--     priced_lines, unpriced_lines }
-- where subtotal is the sum of the priced lines, or null when none is priced.
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
  p_resale_cert_no text default null,
  p_license_attested boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- TODO(owner): confirm route states: do the delivery routes cover exactly Alabama, Mississippi and Georgia, as the site says? DELIVERY_ROUTE_STATES in src/data/quoteRules.js must match. (AW-198)
  v_route_states text[] := array['AL', 'MS', 'GA'];
  -- TODO(owner): Should a guest (or an account that isn't approved yet) have to give the store's tobacco/retail license number, resale certificate number and the attestation to quote tobacco or novelty items, or should those carts require signing in as an approved buyer? Until you decide, the details are optional and only stored; true requires all three. LICENSE_FIELDS_FOR_GUESTS in src/data/quoteRules.js is the storefront's side of this switch. (AW-014)
  v_require_license boolean := false;
  -- TODO(owner): Which departments count as age-restricted for the license rule? AGE_RESTRICTED_DEPARTMENTS in src/data/quoteRules.js must match. (AW-014)
  v_restricted_departments text[] := array['TOBACCO', 'NOVELTIES'];

  v_uid uuid := auth.uid();
  v_status text;
  v_approved boolean := false;
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
  v_resale text := nullif(btrim(coalesce(p_resale_cert_no, '')), '');
  v_attested boolean := coalesce(p_license_attested, false);

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
  -- AW-201: ordering is paused on a suspended account.
  if v_uid is not null then
    select status into v_status from public.profiles where id = v_uid;
    if v_status = 'suspended' then
      raise exception using message = 'This account is on hold', hint = 'account_suspended';
    end if;
    v_approved := coalesce(v_status = 'approved', false);
  end if;

  -- The checks the 20260925120000 version made, now with hints.
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
  -- license details (AW-014) are 64 characters at most.
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

  -- AW-014: once the owner requires it, a caller who isn't an approved buyer
  -- needs all three license details for a cart with a restricted line.
  if v_require_license and not v_approved
     and (v_license is null or v_resale is null or not v_attested)
     and exists (
       select 1
       from jsonb_array_elements(p_items) as i(item)
       join public.products p on p.id = (i.item->>'product_id')::integer
       where p.cat = any (v_restricted_departments)
     ) then
    raise exception using
      message = 'A tobacco/retail license number, a resale certificate number and the attestation are required',
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
        license_no, resale_cert_no, license_attested_at
      ) values (
        v_ref, v_business, v_contact, v_email, v_phone, p_delivery, p_preferred_date, v_notes,
        v_street, v_city, v_state, v_zip,
        v_license, v_resale, case when v_attested then now() end
      ) returning id into v_order_id;
      exit;
    exception when unique_violation then
      if v_attempt = 5 then
        raise exception using message = 'Could not assign a reference number', hint = 'ref_unavailable';
      end if;
    end;
  end loop;

  -- The trigger names, prices and checks each line (20260928121000).
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
-- (d) The 13-argument signature the frontend deployed before this migration
-- calls. It keeps its name and arguments, IGNORES p_ref_num and runs the new
-- function, so old clients keep working through the deploy gap and still
-- can't choose a reference. Security invoker: the new function does the
-- privileged work. Drop it once no visitor runs the old frontend (BACKEND.md,
-- release checklist).
-- ---------------------------------------------------------------------------
create or replace function public.submit_quote(
  p_ref_num text,
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
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
begin
  return public.submit_quote(
    p_business => p_business,
    p_contact => p_contact,
    p_email => p_email,
    p_phone => p_phone,
    p_delivery => p_delivery,
    p_preferred_date => p_preferred_date,
    p_notes => p_notes,
    p_ship_street => p_ship_street,
    p_ship_city => p_ship_city,
    p_ship_state => p_ship_state,
    p_ship_zip => p_ship_zip,
    p_items => p_items
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- (e) Grants: both signatures, for guests and signed-in accounts.
-- ---------------------------------------------------------------------------
revoke all on function public.submit_quote(text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean) from public;
grant execute on function public.submit_quote(text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean) to anon, authenticated, service_role;

revoke all on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb) from public;
grant execute on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (f) Reverse (AW-213). Not run; copy into the SQL editor to undo this
-- migration. The new frontend keeps working after it (it falls back to the
-- 13-argument call); a frontend older than that needs nothing either. Orders
-- saved meanwhile keep their references; their license details go with the
-- columns.
--
-- drop function if exists public.submit_quote(text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean);
-- create or replace function public.submit_quote(p_ref_num text, …) … -- the
--   20260925120000 definition (security definer, inserts p_ref_num)
-- revoke all on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb) from public;
-- grant execute on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb) to anon, authenticated;
-- drop table if exists public.quote_throttle;
-- alter table public.orders
--   drop column if exists license_attested_at,
--   drop column if exists resale_cert_no,
--   drop column if exists license_no;
