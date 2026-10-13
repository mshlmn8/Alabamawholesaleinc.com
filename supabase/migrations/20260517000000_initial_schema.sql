-- Initial schema: trade accounts, catalog, orders.
-- Run from the Supabase SQL Editor or `supabase db push` (CLI).

-- =============================================================================
-- PROFILES  — extends auth.users with trade-account fields
-- =============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  business text,
  phone text,
  license_no text,
  business_type text,
  state text,
  expected_volume text,
  pricing_tier text not null default 'standard',  -- standard | silver | gold
  status text not null default 'pending',          -- pending | approved | suspended
  role text not null default 'customer',           -- customer | admin
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_status_chk     check (status in ('pending','approved','suspended')),
  constraint profiles_role_chk       check (role in ('customer','admin')),
  constraint profiles_pricing_chk    check (pricing_tier in ('standard','silver','gold'))
);

create index on public.profiles (status);
create index on public.profiles (role);

-- Auto-create a profile row when a new auth.users entry is inserted.
-- raw_user_meta_data.name / business are passed in from the sign-up form.
-- Every signup is a pending customer. Owner access is granted later by running
-- supabase/seed/provision_owner.sql in the SQL editor — never by public signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, business, phone, license_no, business_type, state, expected_volume, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'business',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'license_no',
    new.raw_user_meta_data->>'business_type',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'expected_volume',
    'customer',
    'pending'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- PRODUCTS  — the 368-SKU catalog, editable by admins
-- =============================================================================
create table public.products (
  id integer primary key,
  name text not null,
  brand text not null,
  cat text not null,
  sub text not null,
  sku text not null,
  flavors integer not null default 0,
  variants jsonb not null default '[]'::jsonb,
  img text,                       -- filename in /assets/products/ or full URL
  tag text,                       -- BESTSELLER | NEW | DEAL | PREMIUM | null
  price numeric(10,2) not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index on public.products (cat, sub);
create index on public.products (active);

-- =============================================================================
-- PRICING TIERS  — percentage off list price per account tier
-- =============================================================================
create table public.pricing_tiers (
  tier text primary key,
  discount_pct numeric(5,2) not null default 0,
  label text not null
);

insert into public.pricing_tiers (tier, discount_pct, label) values
  ('standard', 0.00,  'Standard'),
  ('silver',   5.00,  'Silver (5% off)'),
  ('gold',    10.00,  'Gold (10% off)');

-- =============================================================================
-- ORDERS / QUOTES
-- =============================================================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  ref_num text unique not null,
  user_id uuid references public.profiles(id) on delete set null,  -- null for guest quotes
  business text not null,
  contact text not null,
  email text not null,
  phone text not null,
  delivery text not null,                                          -- delivery | willcall
  preferred_date date,
  notes text,
  status text not null default 'new',                              -- new | contacted | fulfilled | cancelled
  total_units integer not null default 0,
  subtotal numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_status_chk   check (status in ('new','contacted','fulfilled','cancelled')),
  constraint orders_delivery_chk check (delivery in ('delivery','willcall'))
);

create index on public.orders (user_id, created_at desc);
create index on public.orders (status, created_at desc);

create table public.order_items (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id integer references public.products(id) on delete set null,
  product_name text not null,
  sku text not null,
  qty integer not null check (qty > 0),
  unit_price numeric(10,2)
);

create index on public.order_items (order_id);

-- updated_at trigger helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger touch_products before update on public.products
  for each row execute function public.touch_updated_at();
create trigger touch_orders before update on public.orders
  for each row execute function public.touch_updated_at();
