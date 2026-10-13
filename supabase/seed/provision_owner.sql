-- Intentional owner provisioning. This file is not a migration. After the
-- owner has signed up AND confirmed their email, replace the placeholder
-- below with that email and run this file in the Supabase SQL editor.
-- Public signup never grants admin or approved status.
--
-- The owner is found by their sign-in account (auth.users), not by
-- profiles.email, and only once the email is confirmed (AW-196). Before the
-- 2026-10-08 migrations a customer could set their profile's email to any
-- address; matching the confirmed sign-in email means such a row can never
-- be promoted here. The match ignores case, because Supabase stores sign-in
-- emails in lower case while the site prints the address with a capital A.
--
-- `npm run test:db` runs this file with the placeholder, where it changes
-- nothing and the list below is empty.

update public.profiles as p
set role = 'admin',
    status = 'approved'
from auth.users as u
where p.id = u.id
  and lower(u.email) = lower('REPLACE_WITH_OWNER_EMAIL')
  and u.email_confirmed_at is not null;

-- Every admin account, to check after provisioning: it should list only the
-- owner and the staff you promoted on purpose. An admin made by the
-- first-signup rule of the very first version of the site shows up here too;
-- set such an account back with
--   update public.profiles set role = 'customer' where id = '<id>';
-- Only an approved admin has admin rights (is_admin(), 20261009140000).
select id, email, role, status, created_at
from public.profiles
where role = 'admin'
order by created_at;
