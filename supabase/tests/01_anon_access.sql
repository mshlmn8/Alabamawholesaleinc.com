-- Guests (role anon): read the active catalog (without prices), nothing else.
-- The tier list is private from 20260928120000 (see 04_price_boundary.sql).
select test_anon();
do $$ begin
  assert (select count(*) from public.products) > 0, 'anon should see active products';
  assert not exists (select 1 from public.products where active = false), 'anon must not see inactive products';
  assert (select count(*) from public.pricing_tiers) = 0, 'anon must not see the pricing tiers';
  assert (select count(*) from public.profiles) = 0, 'anon should see no profiles';
  assert (select count(*) from public.orders) = 0, 'anon should see no orders';
  assert (select count(*) from public.order_items) = 0, 'anon should see no order lines';
  assert (select count(*) from public.profile_documents) = 0, 'anon should see no documents';
end $$;

-- Writes are refused. The column values are placeholders for rows that must
-- never be stored.
do $$ begin
  begin
    insert into public.products (id, name, brand, cat, sub, sku, price) values (99999, 'x', 'x', 'TOBACCO', 'x', 'AW-X', 1);
    raise exception 'anon insert into products should have failed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.orders (ref_num, business, contact, email, phone, delivery) values ('T-ANON', 'b', 'c', 'e@example.com', 'p', 'delivery');
    raise exception 'anon insert into orders should have failed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.pricing_tiers set discount_pct = discount_pct where tier = 'gold';
    assert not found, 'anon must not update pricing tiers';
  exception when insufficient_privilege then null;
  end;
end $$;
select test_reset();
