-- Store street, city, and ZIP collected on the trade application.

alter table public.profiles
  add column if not exists store_street text,
  add column if not exists store_city text,
  add column if not exists store_zip text;

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
  return new;
end;
$$;
