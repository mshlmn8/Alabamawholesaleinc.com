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
supabase/migrations/20260928120000_price_boundary.sql
supabase/seed/products.sql
```

On a project that is already running, apply only the migrations it doesn't
have yet, then the seed, then deploy the frontend (see the release checklist
at the end of this file).

Before applying a new migration, run `npm run test:db`. It replays every
migration and the seed in an in-memory Postgres with stubbed Supabase `auth`
and `storage` schemas, then runs the RLS and function assertions in
`supabase/tests/*.sql` (see `scripts/check-migrations.mjs` for the helpers).
CI runs it on every pull request. Add a test file there with each new
migration.

`supabase/seed/products.sql` is generated from `src/data/products.js` by
`npm run seed`. It is **insert-only**: a product whose id is already in the
table is left exactly as it is (`on conflict (id) do nothing`), so
re-applying the file never overwrites what was changed in Admin → Products
(names, brands, tags, prices, the active flag). Re-run it and re-apply the
file when products are added to `src/data/products.js`. A correction to a
product that is already in the database (a new name, SKU, variant list or
photo) ships as an idempotent `update public.products … where id = …` data
migration in `supabase/migrations/`, next to the `products.js` edit.

The seed has no `price` column: prices are set only in the database (see
"Loading your list prices" below), and a product the seed adds starts with
no price, which approved buyers see as "Price on request". Because
`products.price` was `not null` before `20260928120000_price_boundary.sql`,
apply that migration first: Postgres checks NOT NULL before ON CONFLICT, so
on an older database every row of the seed fails, even ids that already exist.

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

### The storefront catalog

One `CatalogProvider` (`src/lib/catalog.jsx`) reads the active rows of
`products`, a page of 1,000 at a time so the catalog is never cut off at the
API's row limit, and only the columns in `CATALOG_COLUMNS`. Change that list
when a column the storefront reads is added, renamed or revoked. The copy of
the catalog built into the site shows until the live one arrives, and stays
on screen if it can't be loaded, with a notice and a **Try again** button.
An open tab loads the catalog again when the buyer comes back to it after
five minutes or reconnects, so admin edits (prices, names, deactivations)
reach tabs that were already open. Checkout loads it once more before sending
and stops, naming the lines, when one was deactivated, lost its variant or
changed price.

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
     pricing tier (the `pricing_tiers` rows), or grant admin role.
   - **Products** — edit name/price/tag/active flag for any of the 368 SKUs.

## How pricing tiers work

List prices are stored only in the database, in `products.price`. They are
not in `src/data/products.js`, the seed or the built site, and guests and
signed-in accounts cannot read the column through the API
(`20260928120000_price_boundary.sql` moves `products` to column privileges;
a request that names `price`, or `select=*`, is refused). A product without a
price (`null`) shows as "Price on request".

`pricing_tiers` rows define the percentage off list price for each tier. The
first migration created these three:

| Tier      | Discount |
| --------- | -------- |
| standard  | 0%       |
| silver    | 5%       |
| gold      | 10%      |

An **approved** account's prices come from one database function,
`my_prices()`: each active product's list price less the account's tier
discount, rounded to cents by `tier_unit_price()`. The order trigger uses the
same function when `submit_quote` saves the lines, so the price on a card,
"each × quantity" in the cart and the saved subtotal agree to the cent. The
storefront (`src/lib/pricing.js`, `src/lib/prices.jsx`) only shows what
`my_prices()` returns; it has no discount table of its own. Guests, pending
and suspended accounts get no prices and don't ask for any. Admins read list
prices through `admin_product_prices()` (Admin → Products).

To add a tier, insert one `pricing_tiers` row. `profiles.pricing_tier` is a
foreign key to `pricing_tiers.tier`, so an account can only be given a tier
that exists, Admin → Accounts builds its tier options from the table, and
renaming a tier's key moves its accounts along with it.

### Loading your list prices

<!-- TODO(owner): What is the real wholesale list price of each of the 368 SKUs? The prices in the database are placeholders; load the real ones as described below. (AW-002) -->

The 368 list prices in the database are placeholders from the first version
of the site. Replace them before launch, in either of two ways:

- **Admin → Products**: edit a product and type its list price (leave it
  blank for "price on request"). The change reaches open storefront tabs
  within a few minutes, and checkout re-checks it before sending.
- **A private SQL file**, for many at once: create a file under
  `supabase/private/` (the folder is in `.gitignore`, so it is never
  committed), with one statement per product:

  ```sql
  update public.products set price = <list price> where id = <id>;
  ```

  and run it in the Supabase SQL editor.

Never put prices in `src/data/products.js`, the seed, a migration or any other
committed file: everything in the repository ships to, or can be read by,
people who must not see trade prices.

## Row-level security summary

- **profiles**: a user reads/updates their own row; admins read/update any.
  Users cannot self-promote (the policy explicitly blocks changing role,
  status, or pricing_tier in self-updates).
- **products**: anyone reads `active = true` rows, and every column except
  `price` (column privileges; `select=*` is refused). Admins read and write
  every row; they read list prices through `admin_product_prices()` and set
  them with an ordinary update. Approved buyers get their prices from
  `my_prices()`. A column added to `products` later needs its own
  `grant select (<column>) on public.products to anon, authenticated;`.
- **orders / order_items**: a user reads their own orders; admins read and
  update all. Customers and guests do not insert rows directly. `submit_quote`
  saves the header and lines together, sets `user_id` from the session, and
  calculates prices. Guest quotes are stored with `user_id` null.
- **pricing_tiers**: readable by admins and approved buyers only;
  admin-writable. `profiles.pricing_tier` must name one of its rows.
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

## Release checklist

The live project gets database changes before the frontend that uses them.
For each release:

1. Run `npm run test:db` (and `npm test`) on the release commit.
2. In the SQL editor, apply each migration below that the project doesn't
   have yet, in order.
3. Apply `supabase/seed/products.sql` (regenerated by `npm run seed`). It only
   inserts products whose id is new.
4. Deploy the frontend.

Every migration ends with a commented reverse-SQL block for rolling it back.

| Migration | What it changes | Before and after |
| --- | --- | --- |
| `20260928120000_price_boundary.sql` | `products.price` becomes nullable and unreadable to guests and signed-in accounts (column privileges); approved buyers' prices come from `my_prices()`, admins' from `admin_product_prices()`; the order trigger rounds with `tier_unit_price()`; `pricing_tiers` is readable by admins and approved buyers only; `profiles.pricing_tier` is a foreign key to `pricing_tiers`. The prices already stored are not changed. | Apply before the new seed (the seed has no price column). The frontend deployed before it reads `select=*`, which is now refused: it falls back to the catalog bundled with it, with a "couldn't load the latest catalog" notice, until the new frontend is deployed, so deploy right after. The new frontend also works before this migration (when `my_prices()` is missing it reads the prices the old way). |

