-- Guest and unapproved quotes for tobacco or vape lines must name a tobacco
-- license, a resale certificate, and confirm purchasers are 21+.
-- Approved buyers already had those checked at application time.
-- TODO(owner): Confirm this guest-quote rule, or require an approved sign-in instead. (AW-014)

alter table public.orders
  add column if not exists license_no text,
  add column if not exists resale_cert_no text,
  add column if not exists purchasers_21 boolean;

drop function if exists public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb);

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
  p_items jsonb,
  p_license_no text,
  p_resale_cert text,
  p_purchasers_21 boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_qty integer;
  v_total_units integer := 0;
  v_subtotal numeric;
  v_has_price boolean := false;
  v_restricted boolean := false;
  v_approved boolean := false;
begin
  if p_delivery not in ('delivery', 'willcall') then
    raise exception 'Invalid delivery method';
  end if;
  if nullif(btrim(coalesce(p_business, '')), '') is null
     or nullif(btrim(coalesce(p_contact, '')), '') is null
     or nullif(btrim(coalesce(p_email, '')), '') is null
     or nullif(btrim(coalesce(p_phone, '')), '') is null then
    raise exception 'Contact details are required';
  end if;
  if nullif(btrim(coalesce(p_ship_street, '')), '') is null
     or nullif(btrim(coalesce(p_ship_city, '')), '') is null
     or nullif(btrim(coalesce(p_ship_state, '')), '') is null
     or nullif(btrim(coalesce(p_ship_zip, '')), '') is null then
    raise exception 'A ship-to address is required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Too many items';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(p_items) as item
    join public.products pr on pr.id = (item->>'product_id')::integer
    where pr.cat = 'TOBACCO'
       or pr.sub in ('Disposable Vapes', 'Vape Pods')
  ) into v_restricted;

  if auth.uid() is not null then
    select status = 'approved' into v_approved
    from public.profiles
    where id = auth.uid();
  end if;

  if v_restricted and not coalesce(v_approved, false) then
    if nullif(btrim(coalesce(p_license_no, '')), '') is null
       or nullif(btrim(coalesce(p_resale_cert, '')), '') is null
       or coalesce(p_purchasers_21, false) is not true then
      raise exception 'A tobacco license, resale certificate, and 21+ confirmation are required';
    end if;
  end if;

  insert into public.orders (
    ref_num, business, contact, email, phone, delivery, preferred_date, notes,
    ship_street, ship_city, ship_state, ship_zip,
    license_no, resale_cert_no, purchasers_21
  ) values (
    p_ref_num,
    btrim(p_business),
    btrim(p_contact),
    btrim(p_email),
    btrim(p_phone),
    p_delivery,
    p_preferred_date,
    nullif(btrim(coalesce(p_notes, '')), ''),
    btrim(p_ship_street),
    btrim(p_ship_city),
    btrim(p_ship_state),
    btrim(p_ship_zip),
    nullif(btrim(coalesce(p_license_no, '')), ''),
    nullif(btrim(coalesce(p_resale_cert, '')), ''),
    coalesce(p_purchasers_21, false)
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    insert into public.order_items (order_id, product_id, product_name, sku, variant, qty)
    values (
      v_order_id,
      (v_item->>'product_id')::integer,
      '',
      '',
      nullif(btrim(coalesce(v_item->>'variant', '')), ''),
      v_qty
    );
  end loop;

  select coalesce(sum(qty), 0),
         coalesce(bool_or(unit_price is not null), false),
         sum(unit_price * qty)
    into v_total_units, v_has_price, v_subtotal
  from public.order_items
  where order_id = v_order_id;

  update public.orders
  set total_units = v_total_units,
      subtotal = case when v_has_price then v_subtotal else null end
  where id = v_order_id;

  return jsonb_build_object(
    'id', v_order_id,
    'ref_num', p_ref_num,
    'total_units', v_total_units,
    'subtotal', case when v_has_price then v_subtotal else null end
  );
exception
  when unique_violation then
    raise exception 'This quote was already submitted';
end;
$$;

revoke all on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean) from public;
grant execute on function public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean) to anon, authenticated;
