-- Intentional owner provisioning. This file is not a migration and does not
-- run on its own. After the owner has signed up, edit the email below and run
-- this statement in the Supabase SQL editor.
--
-- Match the login on auth.users, not profiles.email. A customer can no longer
-- change profiles.email, and this statement does not trust that copy.
-- Public signup never grants admin or approved status.

update public.profiles as p
set role = 'admin',
    status = 'approved'
from auth.users as u
where p.id = u.id
  and u.email = 'REPLACE_WITH_OWNER_EMAIL';
