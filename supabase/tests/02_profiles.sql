-- Signup creates a pending customer; users see and edit only their own
-- profile and cannot promote themselves. Since 20260928124000 a customer may
-- change only name, phone and store address (the rest raises
-- insufficient_privilege from the profiles_guard trigger; see 08).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000002a1', 'a@example.com', '{"name": "Buyer A", "business": "Store A", "license_no": "L-A", "ein": "E-A"}'),
  ('00000000-0000-4000-8000-0000000002b1', 'b@example.com', '{"name": "Buyer B"}'),
  ('00000000-0000-4000-8000-0000000002c1', 'admin@example.com', '{"name": "Admin"}');
update public.profiles set role = 'admin', status = 'approved' where id = '00000000-0000-4000-8000-0000000002c1';

do $$ begin
  assert (select role = 'customer' and status = 'pending' and pricing_tier = 'standard' and ein = 'E-A'
          from public.profiles where id = '00000000-0000-4000-8000-0000000002a1'), 'signup should create a pending customer with the application fields';
end $$;

select test_login('00000000-0000-4000-8000-0000000002a1');
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'a customer sees only their own profile';
  update public.profiles set phone = '555-0100' where id = '00000000-0000-4000-8000-0000000002a1';
  assert found, 'a customer can edit their own contact fields';
  update public.profiles set name = 'x' where id = '00000000-0000-4000-8000-0000000002b1';
  assert not found, 'a customer cannot edit another profile';
  begin
    update public.profiles set status = 'approved' where id = '00000000-0000-4000-8000-0000000002a1';
    raise exception 'self-approval should have failed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000002a1';
    raise exception 'self-promotion to admin should have failed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set pricing_tier = 'gold' where id = '00000000-0000-4000-8000-0000000002a1';
    raise exception 'choosing a pricing tier should have failed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set license_no = 'L-OTHER', ein = 'E-OTHER' where id = '00000000-0000-4000-8000-0000000002a1';
    raise exception 'rewriting the license and EIN should have failed';
  exception when insufficient_privilege then null;
  end;
  assert not public.is_admin(), 'a customer is not an admin';
end $$;
select test_reset();

select test_login('00000000-0000-4000-8000-0000000002c1');
do $$ begin
  assert public.is_admin(), 'the provisioned owner is an admin';
  assert (select count(*) from public.profiles) >= 3, 'an admin sees every profile';
  update public.profiles set status = 'approved', pricing_tier = 'silver' where id = '00000000-0000-4000-8000-0000000002b1';
  assert found, 'an admin can approve an account and set its tier';
  assert (select approved_by = '00000000-0000-4000-8000-0000000002c1' and approved_at is not null
          from public.profiles where id = '00000000-0000-4000-8000-0000000002b1'), 'the approval records who and when';
end $$;
select test_reset();
