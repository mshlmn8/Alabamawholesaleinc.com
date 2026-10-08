-- 20261008190000_quote_tobacco_license.sql (AW-014, Cursor's PR #12): a quote
-- with a tobacco or vape line from a guest or an unapproved account must name
-- a tobacco licence and a resale certificate and confirm purchasers are 21+.
-- Approved accounts were checked when they applied. The rule matches
-- cartNeedsTobaccoLicense in src/lib/regulated.js.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000009a1', 'tl-pending@example.com', '{"name": "Pending TL"}'),
  ('00000000-0000-4000-8000-0000000009b1', 'tl-approved@example.com', '{"name": "Approved TL"}');
update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000009b1';

-- Products that need no variant choice: one tobacco, one vape, one neither.
select set_config('test.t9_tobacco', (
  select id::text from public.products where active and cat = 'TOBACCO' and jsonb_array_length(variants) <= 1 order by id limit 1
), false);
select set_config('test.t9_vape', (
  select id::text from public.products where active and sub in ('Disposable Vapes', 'Vape Pods') and jsonb_array_length(variants) <= 1 order by id limit 1
), false);
select set_config('test.t9_plain', (
  select id::text from public.products where active and cat <> 'TOBACCO' and sub not in ('Disposable Vapes', 'Vape Pods')
    and jsonb_array_length(variants) <= 1 order by id limit 1
), false);

do $$ begin
  assert current_setting('test.t9_tobacco') <> '' and current_setting('test.t9_vape') <> '' and current_setting('test.t9_plain') <> '',
    'the seed has a tobacco, a vape and an unrestricted product without variants';
  assert (select count(*) from pg_proc where proname = 'submit_quote' and pronamespace = 'public'::regnamespace) = 1,
    'only the licence-aware submit_quote remains';
  assert has_function_privilege('anon', 'public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean)', 'execute'),
    'guests can call submit_quote';
end $$;

create or replace function pg_temp.tquote(ref text, product text, lic text, resale text, adult boolean) returns jsonb language sql as $$
  select public.submit_quote(ref, 'Store', 'Contact', 'buyer@example.com', '205-555-0100', 'delivery', null, null,
    '1 Main St', 'Birmingham', 'AL', '35203',
    jsonb_build_array(jsonb_build_object('product_id', current_setting(product)::int, 'qty', 1)),
    lic, resale, adult);
$$;

create or replace function pg_temp.refused(ref text, product text, lic text, resale text, adult boolean) returns boolean language plpgsql as $$
begin
  perform pg_temp.tquote(ref, product, lic, resale, adult);
  return false;
exception when raise_exception then
  if sqlerrm <> 'A tobacco license, resale certificate, and 21+ confirmation are required' then raise; end if;
  return true;
end $$;

select test_anon();
do $$ begin
  assert pg_temp.refused('T9-GUEST-1', 'test.t9_tobacco', null, null, false), 'a guest tobacco quote without a licence is refused';
  assert pg_temp.refused('T9-GUEST-2', 'test.t9_vape', null, null, false), 'a guest vape quote without a licence is refused';
  assert pg_temp.refused('T9-GUEST-3', 'test.t9_tobacco', 'TL-1', 'RC-1', false), 'the 21+ attestation is required';
  assert pg_temp.refused('T9-GUEST-4', 'test.t9_tobacco', '  ', 'RC-1', true), 'a blank licence is refused';
  assert pg_temp.refused('T9-GUEST-5', 'test.t9_tobacco', 'TL-1', '', true), 'a blank resale certificate is refused';
  perform pg_temp.tquote('T9-GUEST-OK', 'test.t9_tobacco', ' TL-1 ', ' RC-1 ', true);
  perform pg_temp.tquote('T9-GUEST-PLAIN', 'test.t9_plain', null, null, false);
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000009a1');
do $$ begin
  assert pg_temp.refused('T9-PENDING-1', 'test.t9_vape', null, null, false), 'a pending account is asked like a guest';
  perform pg_temp.tquote('T9-PENDING-OK', 'test.t9_vape', 'TL-2', 'RC-2', true);
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000009b1');
do $$ begin
  perform pg_temp.tquote('T9-APPROVED-1', 'test.t9_tobacco', null, null, false);
end $$;
select test_reset();

do $$ begin
  assert (select count(*) from public.orders where ref_num like 'T9-GUEST-_') = 0, 'refused quotes leave no order';
  assert (select license_no = 'TL-1' and resale_cert_no = 'RC-1' and purchasers_21 from public.orders where ref_num = 'T9-GUEST-OK'),
    'the answers are stored, trimmed';
  assert (select license_no is null and resale_cert_no is null and purchasers_21 = false from public.orders where ref_num = 'T9-GUEST-PLAIN'),
    'a quote without restricted lines stores no answers';
  assert (select user_id from public.orders where ref_num = 'T9-PENDING-OK') = '00000000-0000-4000-8000-0000000009a1', 'the pending quote is the account''s';
  assert exists (select 1 from public.orders where ref_num = 'T9-APPROVED-1' and license_no is null), 'an approved buyer is not asked again';
end $$;
