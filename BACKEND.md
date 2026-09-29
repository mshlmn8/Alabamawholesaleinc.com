# Backend setup (Supabase)

The storefront is a static React app deployed to Netlify. Real trade accounts,
order history, and the admin dashboard run on Supabase (Postgres + Auth + RLS).

When `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset the dev server
falls back to its old static-only behavior (catalog only, no sign-in, quotes or
admin). A production build (`npm run build`) refuses to run without them; see
section 4.

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
supabase/migrations/20260925120000_launch_order_boundaries.sql
supabase/migrations/20260927000000_application_fields.sql
supabase/migrations/20260927120000_product_copy.sql
supabase/migrations/20260927180000_application_documents.sql
supabase/seed/products.sql
```

Before applying a new migration, run `npm run test:db`. It replays every
migration and the seed in an in-memory Postgres with stubbed Supabase `auth`
and `storage` schemas, then runs the RLS and function assertions in
`supabase/tests/*.sql` (see `scripts/check-migrations.mjs` for the helpers).
CI runs it on every pull request. Add a test file there with each new
migration.

`supabase/seed/products.sql` is generated from `src/data/products.js` by
`npm run seed`; re-run it and re-apply the file whenever the catalog changes so
the live rows keep the same ids, SKUs, names, variants, photos, descriptions
and sell units. Re-applying is safe: rows are updated in place and an admin's
`active = false` is kept.

The first migration creates four tables — `profiles`, `products`, `orders`,
`order_items` — plus a `pricing_tiers` lookup. Later migrations add the
application columns and `profile_documents`. RLS is enabled on all of them.

`20260927180000_application_documents.sql` also creates a **private** Storage
bucket named `application-documents` (PDF, JPG, PNG, and HEIC, 10 MB maximum).
Confirm in **Storage** that the bucket is not public. No extra environment
variables. Applicants may upload a state retail tobacco license and a resale
certificate from the application form once they have a session, or later from
`/apply` while the account is pending. The license number and resale
certificate number stay required. Proof can also be emailed to the trade desk.

A trigger on `auth.users` auto-creates a `profiles` row on signup. **Every
signup starts as `customer` / `pending`.** Public signup never creates an
administrator. After the owner has confirmed their email, open
`supabase/seed/provision_owner.sql`, replace the placeholder email, and run
that statement in the SQL editor. Later accounts are approved from the
Admin → Accounts tab.

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

`npm run build` now fails when either variable is missing, or when
`VITE_SUPABASE_URL` is not an `https://<project-ref>.supabase.co` URL, so a
deploy can no longer ship a storefront with sign-in, applications and quotes
silently disabled. To build a static-only preview on purpose, set
`ALLOW_NO_BACKEND=1` for that build only; never set it on the production site.

### Email links (sign-up confirmation and password reset)

Under **Authentication → URL Configuration**:

- Set the **Site URL** to the production domain. Sign-up confirmation links
  return there.
- Add `https://<production domain>/reset-password` to the **Redirect URLs**
  allow list. Password-reset emails link to `/reset-password`. Until that
  address is allowed, Supabase sends the reset link to the Site URL instead,
  and the storefront still opens the new-password page from there.
- For local testing, also allow `http://localhost:3000/` and
  `http://localhost:3000/reset-password`.

The storefront reads the link's `#access_token=…` or `#error=…` fragment
once, at boot (`src/lib/authLink.js`), and removes it from the address bar
and the browser history. Only a password-recovery link opens the
new-password page. An expired or already used link shows a notice with
Sign in and Reset password, and never the text Supabase put in the link.
A buyer whose sign-up confirmation expired can ask for a new one from the
sign-in dialog (`auth.resend`).

### Sessions and sign-out

One `AuthProvider` (`src/lib/auth.jsx`) holds the session and the profile
for the whole site. The profile is loaded again when the buyer returns to
the tab, and every few minutes while the account is pending, so approving an
account in Admin → Accounts shows prices without a reload.

The header's **Sign Out** ends this browser's session only
(`signOut({ scope: 'local' })`). **Sign out of all devices** on `/account`
ends every session of that account. If Supabase cannot be reached, the
browser's saved session is still removed, so a shared computer is never
signed back in on the next load. Other open tabs follow a sign-out and say
that the session ended.

## 5. First-run sanity check

1. Open the site, click **SIGN IN → Open a trade account**.
2. Fill in the signup form. You'll get a confirmation email from Supabase.
   (You can disable email confirmation in Supabase → Authentication →
   Providers → Email if you'd rather skip it for internal testing.)
3. Click the confirmation link, then sign in.
4. Run `supabase/seed/provision_owner.sql` for that email. You should then see
   an **Admin** link in the header.
5. Open `/admin`. Three tabs:
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

An **approved** account sees `listPrice × (1 - tier.discount)` on product
cards, in the cart drawer, and on the quote page. Pending and suspended
profiles do not. The browser does not choose the saved price: `submit_quote`
reads `products.price` and `pricing_tiers` and writes `order_items.unit_price`.

To add new tiers: insert a row in `pricing_tiers` and add the discount to
`TIER_DISCOUNT` in `src/lib/pricing.js`.

## Row-level security summary

- **profiles**: a user reads/updates their own row; admins read/update any.
  Users cannot self-promote (the policy explicitly blocks changing role,
  status, or pricing_tier in self-updates).
- **products**: anyone reads `active = true`; admins read/write everything.
- **orders / order_items**: a user reads their own orders; admins read and
  update all. Customers and guests do not insert rows directly. `submit_quote`
  saves the header and lines together, sets `user_id` from the session, and
  calculates prices. Guest quotes are stored with `user_id` null.
- **pricing_tiers**: world-readable; admin-writable.
- **profile_documents**: a user reads, inserts, and replaces only their own
  rows (one tobacco license and one resale certificate). Admins read every row.
- **storage `application-documents`**: private. Object paths are
  `{user id}/{document type}/{filename}`. A user can upload, read, replace,
  and delete only inside their own folder. Admins can read every object, which
  is what the Accounts tab uses to mint a signed View link.

## Resetting

```sql
drop schema public cascade;
create schema public;
-- then re-run the migration files and supabase/seed/products.sql
```

`auth.users` lives in a separate schema and is preserved — you'll want to
delete those manually if you want a fully blank slate.
