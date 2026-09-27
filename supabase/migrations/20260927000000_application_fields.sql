-- Trade application fields: federal EIN and resale certificate number join the
-- state retail tobacco license number on the profile, and the signup trigger
-- copies them from the application form's metadata.

alter table public.profiles add column if not exists ein text;
alter table public.profiles add column if not exists resale_cert_no text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, name, business, phone, license_no, ein, resale_cert_no, business_type, state, expected_volume, role, status
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
    'customer',
    'pending'
  );
  return new;
end;
$$;
