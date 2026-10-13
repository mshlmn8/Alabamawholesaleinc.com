-- Customers cannot rewrite licence, EIN, email, role, status, or tier on their
-- own profile. Admins, and SQL run without a session (the owner provisioning
-- script), are unchanged.

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  new.email := old.email;
  new.status := old.status;
  new.role := old.role;
  new.pricing_tier := old.pricing_tier;
  new.license_no := old.license_no;
  new.ein := old.ein;
  new.resale_cert_no := old.resale_cert_no;
  return new;
end;
$$;

drop trigger if exists a_protect_profile_columns on public.profiles;
create trigger a_protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
