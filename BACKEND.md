# Backend setup (Supabase)

The storefront is a static React app deployed to Netlify. Real trade accounts,
order history, and the admin dashboard run on Supabase (Postgres + Auth + RLS).

When `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset the site falls
back to its old static-only behavior — useful for previews, broken in prod.

## 1. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. From **Project Settings → API**, copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon public key** → `VITE_SUPABASE_ANON_KEY`

## 2. Run the migrations

In the Supabase dashboard, open **SQL Editor** and run these files in order:

```
supabase/migrations/20260517000000_initial_schema.sql
supabase/migrations/20260517000001_rls_policies.sql
supabase/seed/products.sql
```

The schema creates four tables — `profiles`, `products`, `orders`,
`order_items` — plus a `pricing_tiers` lookup. RLS is enabled on all four.

A trigger on `auth.users` auto-creates a `profiles` row on signup. **The very
first user to sign up is promoted to `admin` / `approved`** so you can log
into the admin dashboard. Every subsequent signup starts as `customer` /
`pending` and must be approved from the Admin → Accounts tab.

## 3. Wire the env vars locally

```bash
cp .env.example .env
# paste your URL and anon key
npm run dev
```

## 4. Wire the env vars on Netlify

In your Netlify site → **Site configuration → Environment variables**, add:

| Key                       | Scope     |
| ------------------------- | --------- |
| `VITE_SUPABASE_URL`       | All       |
| `VITE_SUPABASE_ANON_KEY`  | All       |

Trigger a redeploy after saving.

## 5. First-run sanity check

1. Open the site, click **SIGN IN → Open a trade account**.
2. Fill in the signup form. You'll get a confirmation email from Supabase.
   (You can disable email confirmation in Supabase → Authentication →
   Providers → Email if you'd rather skip it for internal testing.)
3. Click the confirmation link, then sign in.
4. Because you're the first user, the trigger promoted you to `admin`. You
   should see an orange **ADMIN** link in the header utility bar.
5. Open `#/admin`. Three tabs:
   - **Orders** — every quote submitted via the storefront, with status dropdown.
   - **Accounts** — every trade account; flip `pending → approved`, change
     pricing tier (`standard` / `silver` / `gold`), or grant admin role.
   - **Products** — edit name/price/tag/active flag for any of the 368 SKUs.

## How pricing tiers work

`pricing_tiers` rows define percentage discounts off list price:

| Tier      | Discount |
| --------- | -------- |
| standard  | 0%       |
| silver    | 5%       |
| gold      | 10%      |

A signed-in customer sees `listPrice × (1 - tier.discount)` on every product
card, in the cart drawer, and on the quote page. The discounted prices are
also what gets written to `order_items.unit_price` when they submit a quote.

To add new tiers: insert a row in `pricing_tiers` and add the discount to
`TIER_DISCOUNT` in `src/App.jsx`.

## Row-level security summary

- **profiles**: a user reads/updates their own row; admins read/update any.
  Users cannot self-promote (the policy explicitly blocks changing role,
  status, or pricing_tier in self-updates).
- **products**: anyone reads `active = true`; admins read/write everything.
- **orders / order_items**: a user reads their own orders; guests can insert
  (anonymous quotes are stored with `user_id = null`); admins read/update all.
- **pricing_tiers**: world-readable; admin-writable.

## Resetting

```sql
drop schema public cascade;
create schema public;
-- then re-run the three SQL files
```

`auth.users` lives in a separate schema and is preserved — you'll want to
delete those manually if you want a fully blank slate.
