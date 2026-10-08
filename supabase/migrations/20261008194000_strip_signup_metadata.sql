-- Copy application answers onto the profile, then remove the sensitive keys
-- from auth.users so they do not stay inside the access token.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, name, business, phone, license_no, ein, resale_cert_no,
    business_type, state, expected_volume, store_street, store_city, store_zip,
    role, status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'business',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'license_no',
    new.raw_user_meta_data->>'ein',
    new.raw_user_meta_data->>'resale_cert_no',
    new.raw_user_meta_data->>'business_type',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'expected_volume',
    new.raw_user_meta_data->>'store_street',
    new.raw_user_meta_data->>'store_city',
    new.raw_user_meta_data->>'store_zip',
    'customer',
    'pending'
  );

  update auth.users
  set raw_user_meta_data = raw_user_meta_data
    - 'ein'
    - 'license_no'
    - 'resale_cert_no'
    - 'phone'
    - 'expected_volume'
  where id = new.id;

  return new;
end;
$$;
