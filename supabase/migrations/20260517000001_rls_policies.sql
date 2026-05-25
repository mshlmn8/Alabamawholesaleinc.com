-- Row-level security: who can read/write what.

-- PROFILES ====================================================================
alter table public.profiles enable row level security;

-- Admin check helper — kept in a SECURITY DEFINER function so policies don't
-- recurse on the profiles table (a common RLS footgun).
create or replace function public.is_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

create policy profiles_self_read on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id)
  with check (
    -- A user can update their own row but cannot escalate role/status/tier.
    auth.uid() = id
    and role = (select role from public.profiles where id = auth.uid())
    and status = (select status from public.profiles where id = auth.uid())
    and pricing_tier = (select pricing_tier from public.profiles where id = auth.uid())
  );

create policy profiles_admin_update on public.profiles
  for update using (public.is_admin())
  with check (public.is_admin());

-- PRODUCTS ====================================================================
alter table public.products enable row level security;

create policy products_public_read on public.products
  for select using (active = true);

create policy products_admin_read_inactive on public.products
  for select using (public.is_admin());

create policy products_admin_write on public.products
  for all using (public.is_admin())
  with check (public.is_admin());

-- ORDERS ======================================================================
alter table public.orders enable row level security;

-- Anyone (including guests) can submit a quote. user_id is set to auth.uid() if
-- logged in, otherwise null. Email/business/contact captured in the payload.
create policy orders_anyone_insert on public.orders
  for insert with check (
    user_id is null or user_id = auth.uid()
  );

create policy orders_self_read on public.orders
  for select using (auth.uid() = user_id or public.is_admin());

create policy orders_admin_update on public.orders
  for update using (public.is_admin())
  with check (public.is_admin());

-- ORDER_ITEMS =================================================================
alter table public.order_items enable row level security;

create policy order_items_insert on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_id
      and (o.user_id is null or o.user_id = auth.uid())
    )
  );

create policy order_items_read on public.order_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

-- PRICING_TIERS ===============================================================
alter table public.pricing_tiers enable row level security;

create policy pricing_tiers_public_read on public.pricing_tiers
  for select using (true);

create policy pricing_tiers_admin_write on public.pricing_tiers
  for all using (public.is_admin())
  with check (public.is_admin());
