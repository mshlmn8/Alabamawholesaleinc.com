-- Intentional owner provisioning. This file is not a migration and does not
-- run on its own. After the owner has signed up, edit the email below and run
-- this statement in the Supabase SQL editor.
--
-- Public signup never grants admin or approved status.

update public.profiles
set role = 'admin',
    status = 'approved'
where email = 'REPLACE_WITH_OWNER_EMAIL';
