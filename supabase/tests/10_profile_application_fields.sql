-- 20261008191000_profile_store_address.sql, 20261008194000_strip_signup_metadata.sql,
-- 20261008195000_application_consent.sql and 20261008192000_profile_self_update_guard.sql
-- (AW-092, AW-348, AW-019, AW-196; Cursor's PR #12): the application's store
-- address and consent land on the profile, the sensitive answers leave the
-- auth metadata, and a customer cannot rewrite the verified fields.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000010a1', 'app10@example.com', '{"name": "App Buyer", "business": "App Store", "phone": "205-555-0101",
    "ein": "12-3456789", "license_no": "L-5", "resale_cert_no": "R-5", "business_type": "Convenience Store", "state": "AL",
    "expected_volume": "Under $5K", "store_street": "5 Main St", "store_city": "Birmingham", "store_zip": "35203",
    "terms_accepted": true, "terms_version": "2026-09", "age_confirmed": true}'),
  ('00000000-0000-4000-8000-0000000010b1', 'app10b@example.com', '{"name": "No Consent", "terms_accepted": false}');

do $$ begin
  assert (select store_street = '5 Main St' and store_city = 'Birmingham' and store_zip = '35203' and license_no = 'L-5' and ein = '12-3456789'
          from public.profiles where id = '00000000-0000-4000-8000-0000000010a1'), 'the store address and answers are copied to the profile';
  assert (select terms_accepted_at is not null and terms_version = '2026-09' and age_confirmed_at is not null
          from public.profiles where id = '00000000-0000-4000-8000-0000000010a1'), 'consent and 21+ are recorded with a time and the terms version';
  assert (select terms_accepted_at is null and terms_version is null and age_confirmed_at is null
          from public.profiles where id = '00000000-0000-4000-8000-0000000010b1'), 'no consent recorded without the boxes';
  assert (select not (raw_user_meta_data ?| array['ein', 'license_no', 'resale_cert_no', 'phone', 'expected_volume', 'store_street',
            'store_city', 'store_zip', 'terms_accepted', 'terms_version', 'age_confirmed'])
          from auth.users where id = '00000000-0000-4000-8000-0000000010a1'), 'sensitive answers are removed from the auth metadata';
  assert (select raw_user_meta_data->>'name' = 'App Buyer' and raw_user_meta_data->>'business' = 'App Store'
          from auth.users where id = '00000000-0000-4000-8000-0000000010a1'), 'name and business stay in the metadata';
end $$;

select test_login('00000000-0000-4000-8000-0000000010a1');
do $$ begin
  update public.profiles
     set license_no = 'FORGED', ein = '99-9999999', resale_cert_no = 'FORGED', email = 'other@example.com',
         approved_at = now(), verification_note = 'self-verified',
         phone = '205-555-0199', store_street = '6 Main St'
   where id = '00000000-0000-4000-8000-0000000010a1';
  assert found, 'a customer can still update their own profile';
  assert (select license_no = 'L-5' and ein = '12-3456789' and resale_cert_no = 'R-5' and email = 'app10@example.com'
          and approved_at is null and verification_note is null
          from public.profiles where id = '00000000-0000-4000-8000-0000000010a1'), 'verified fields keep their values';
  assert (select phone = '205-555-0199' and store_street = '6 Main St'
          from public.profiles where id = '00000000-0000-4000-8000-0000000010a1'), 'contact details can change';
end $$;
select test_reset();
