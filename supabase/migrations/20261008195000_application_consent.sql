-- Record that the applicant checked the Trade terms / Privacy box and the 21+ box.
-- TODO(owner): Approve the checkbox wording and the terms version string. (AW-019)

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists age_confirmed_at timestamptz;

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
    terms_accepted_at, terms_version, age_confirmed_at,
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
    case when new.raw_user_meta_data->>'terms_accepted' = 'true' then now() else null end,
    nullif(new.raw_user_meta_data->>'terms_version', ''),
    case when new.raw_user_meta_data->>'age_confirmed' = 'true' then now() else null end,
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
    - 'store_street'
    - 'store_city'
    - 'store_zip'
    - 'terms_accepted'
    - 'terms_version'
    - 'age_confirmed'
  where id = new.id;

  return new;
end;
$$;
