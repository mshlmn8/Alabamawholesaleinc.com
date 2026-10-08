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
supabase/migrations/20261008190000_quote_tobacco_license.sql
supabase/migrations/20261008191000_profile_store_address.sql
supabase/migrations/20261008192000_profile_self_update_guard.sql
supabase/migrations/20261008193000_profile_approval_audit.sql
supabase/migrations/20261008194000_strip_signup_metadata.sql
supabase/migrations/20261008195000_application_consent.sql
supabase/seed/products.sql
```

The six `20261008…` files are part 1 of the tobacco, vapor and licence review
(Cursor's PR #12). Review them before applying them to the live project; the
site keeps working without them (see `docs/OWNER-TODO.md`):

- `20261008190000_quote_tobacco_license.sql`: `orders.license_no`,
  `resale_cert_no`, `purchasers_21`, and a `submit_quote` that refuses a quote
  with a tobacco or vape line from a guest or an unapproved account unless it
  names a licence and a resale certificate and confirms 21+ (AW-014). It
  replaces the 13-argument `submit_quote` with a 16-argument one. Until it is
  applied, the storefront falls back to the old function and puts the licence
  answers in the quote's notes.
- `20261008191000_profile_store_address.sql`: the store street, city and ZIP
  from the application (AW-092).
- `20261008192000_profile_self_update_guard.sql`: a trigger keeps a
  customer's email, role, status, tier, licence, EIN and resale certificate as
  they were when the customer edits their own profile (AW-196).
- `20261008193000_profile_approval_audit.sql`: `approved_at`, `approved_by`,
  `verification_note`, the `profile_status_log` and
  `profile_document_history` tables (admin-read), and proof that only a
  pending applicant can delete (AW-197, AW-254).
- `20261008194000_strip_signup_metadata.sql` and
  `20261008195000_application_consent.sql`: the signup trigger copies the
  answers and the Trade terms / Privacy consent (with its version) and 21+
  confirmation onto the profile, then removes EIN, licence, resale
  certificate, phone, volume, address and consent keys from the auth metadata
  (AW-348, AW-019).

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
`/apply` (any signed-in account, so an approved or suspended store can send a
renewal). The license number and resale
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
     pricing tier (`standard` / `silver` / `gold`), or grant admin role.
     Licence documents show for every status, and **Details** opens the
     application answers (EIN, licence, resale certificate, phone, store
     address, volume, approval, consent) and a verification note. The
     approval, consent and note fields fill in once the 2026-10-08
     migrations are applied.
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
  status, or pricing_tier in self-updates). Since
  `20261008192000_profile_self_update_guard.sql`, a trigger also keeps email,
  licence, EIN, resale certificate and the approval fields as they were in a
  customer's own update (the update succeeds; those columns don't change).
- **profile_status_log / profile_document_history**: written by triggers;
  admins read them, nobody edits them.
- **products**: anyone reads `active = true`; admins read/write everything.
- **orders / order_items**: a user reads their own orders; admins read and
  update all. Customers and guests do not insert rows directly. `submit_quote`
  saves the header and lines together, sets `user_id` from the session, and
  calculates prices. Guest quotes are stored with `user_id` null.
- **pricing_tiers**: world-readable; admin-writable.
- **profile_documents**: a user reads, inserts, and replaces only their own
  rows (one tobacco license and one resale certificate). Only a pending
  applicant can delete; approved and suspended accounts can upload a renewal.
  Admins read every row.
- **storage `application-documents`**: private. Object paths are
  `{user id}/{document type}/{upload time}-{filename}`, so a renewal keeps
  the previous file. A user can upload, read and replace only inside their own
  folder, and delete there only while the application is pending. Admins can
  read every object, which is what the Accounts tab uses to mint a signed
  View link.

## Resetting

```sql
drop schema public cascade;
create schema public;
-- then re-run the migration files and supabase/seed/products.sql
```

`auth.users` lives in a separate schema and is preserved — you'll want to
delete those manually if you want a fully blank slate.
