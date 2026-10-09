# Backend setup (Supabase)

The storefront is a static React app deployed to Netlify. Real trade accounts,
order history, and the admin dashboard run on Supabase (Postgres + Auth + RLS).

When `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset the dev server
falls back to its old static-only behavior (catalog only, no sign-in, quotes or
admin). A production build (`npm run build`) refuses to run without them; see
section 4.

<!-- TODO(owner): Will production be on Supabase Pro (backups, no pausing), and will deploy previews use a separate project? (AW-213) -->

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
supabase/migrations/20261008200000_variant_prices_and_quote_workflow.sql
supabase/migrations/20261009100000_price_boundary.sql
supabase/migrations/20261009110000_variant_model.sql
supabase/migrations/20261009120000_catalog_corrections.sql
supabase/migrations/20261009130000_submit_quote_v3.sql
supabase/migrations/20261009140000_profile_and_document_boundaries.sql
supabase/migrations/20261009150000_quote_workflow.sql
supabase/migrations/20261010120000_admin_product_editor.sql
supabase/migrations/20261010121000_admin_bulk_products.sql
supabase/migrations/20261010122000_order_operations.sql
supabase/migrations/20261010130000_catalog_apostrophes.sql
supabase/migrations/20261010131000_photo_filenames.sql
supabase/migrations/20261011110000_order_item_hints.sql
supabase/migrations/20261011111000_profile_role_audit.sql
supabase/migrations/20261011130000_catalog_names.sql
supabase/migrations/20261011131000_home_slides.sql
supabase/migrations/20261012100000_document_storage_lock.sql
supabase/migrations/20261012110000_carts.sql
supabase/migrations/20261012120000_product_description_hidden.sql
supabase/migrations/20261012130000_catalog_fixups.sql
supabase/migrations/20261012140000_admin_import_create.sql
supabase/seed/products.sql
```

On a project that is already running, apply only the migrations it doesn't
have yet, in that order, then the seed, then deploy the frontend (see the
release checklist at the end of this file). The live project has the files
up to `20260927180000`; the twenty-seven `20261008…`/`20261009…`/`20261010…`/`20261011…`/`20261012…`
files are new.
Review them before applying them; the site keeps working without them (see
`docs/OWNER-TODO.md` and "Before and after" in the release checklist).

The six `20261008…` files are part 1 of the tobacco, vapor and licence review
(Cursor's PR #12):

- `20261008190000_quote_tobacco_license.sql`: `orders.license_no`,
  `resale_cert_no`, `purchasers_21`, and a `submit_quote` that refuses a quote
  with a tobacco or vape line from a guest or an unapproved account unless it
  names a licence and a resale certificate and confirms 21+ (AW-014). It
  replaces the 13-argument `submit_quote` with a 16-argument one
  (`20261009130000` turns both into wrappers of the new function).
- `20261008191000_profile_store_address.sql`: the store street, city and ZIP
  from the application (AW-092).
- `20261008192000_profile_self_update_guard.sql`: a trigger keeps a
  customer's email, role, status, tier, licence, EIN and resale certificate as
  they were when the customer edits their own profile (AW-196;
  `20261009140000` extends it to every column but name, phone and store
  address).
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

`20261008200000_variant_prices_and_quote_workflow.sql` is part 2 (Cursor's PR
#13): a `products.variant_prices` column for per-variant prices, and the
quote workflow (`orders.kind`, the statuses quoted, confirmed, picking, ready
and out_for_delivery, `quoted_at`/`quoted_by`, `order_items.original_qty`, the
order-line trigger on INSERT only, `admin_price_order()` and
`admin_convert_quote()`) (AW-030, AW-024). The `20261009…` files build on it:
`20261009110000` moves `variant_prices` into the private
`product_variant_prices` table and drops the column, and `20261009150000`
makes the workflow agree with `submit_quote` v3.

The six `20261009…` files are the site review's backend changes (prices,
variants, catalog corrections, `submit_quote` v3, profile and document
boundaries, the quote workflow), built on the schema the `20261008…` files
create; the release checklist below says what each one changes.

Before applying a new migration, run `npm run test:db`. It replays every
migration and the seed in an in-memory Postgres with stubbed Supabase `auth`
and `storage` schemas, then runs the RLS and function assertions in
`supabase/tests/*.sql` (see `scripts/check-migrations.mjs` for the helpers).
CI runs it on every pull request. Add a test file there with each new
migration.

### Tracking which migrations ran (Supabase CLI)

Migrations pasted into the SQL editor leave no record of which ones ran, and
the first two files are not safe to run twice (`create table`, `create
policy`). To let the Supabase CLI keep that record, set it up once, from the
repository root, with the [Supabase CLI](https://supabase.com/docs/guides/cli)
installed and logged in (`supabase login`):

1. `supabase init` writes `supabase/config.toml` (commit it; it holds no
   secret). Keep the existing `supabase/migrations`, `supabase/seed` and
   `supabase/tests` folders as they are.
2. `supabase link --project-ref <ref>`, where `<ref>` is the project's
   reference ID (**Project Settings → General**). It asks for the database
   password.
3. `supabase migration list` shows each file under Local and, once applied
   through the CLI, under Remote. Files applied in the SQL editor show no
   Remote entry yet.
4. For every file already applied in the SQL editor (today the six up to
   `20260927180000`, plus any later ones applied the same way), record it
   without running it:
   `supabase migration repair --status applied <version> [<version> …]`, with
   each file's timestamp as the version (for example `20260927180000`). Run
   `supabase migration list` again: every applied file must show a Remote
   entry. A file left out would run again on the next push.
5. From then on, `supabase db push` applies the files the project doesn't
   have yet, in order, and records them. It asks before applying. Take the
   dump first (release checklist, step 2).

Never edit a migration that has been applied anywhere; add a new file.

`supabase/seed/products.sql` is generated from `src/data/products.js` by
`npm run seed`. It is **insert-only**: a product whose id is already in the
table is left exactly as it is (`on conflict (id) do nothing`), so
re-applying the file never overwrites what was changed in Admin → Products
(names, brands, tags, prices, the active flag). Re-run it and re-apply the
file when products are added to `src/data/products.js`. A correction to a
product that is already in the database (a new name, SKU, variant list or
photo) ships as an idempotent `update public.products … where id = …` data
migration in `supabase/migrations/`, next to the `products.js` edit.

**Ids of new products (NEW-022).** Admin → Products gives each product it
creates the next id from `products_id_seq`, the same id space the rows in
`src/data/products.js` use. So a new row in `products.js` needs an id above
the live `select max(id) from public.products`, not just above the file's
own ids. The seed checks this before it inserts anything: a seed id the
table already has under another SKU is skipped and named in a notice ("Seed
rows skipped: …"; the database keeps its row, and the bundled catalog and the
database then disagree about that id), and a new seed id whose SKU another
product already uses (in any case, with or without surrounding spaces) stops
the file with an error that names the SKU and both ids ("Seed not applied:
…"), before any row is inserted. Apply the file as one script (the SQL
editor does; with psql, `psql -v ON_ERROR_STOP=1 --single-transaction -f
supabase/seed/products.sql`), so nothing after that error runs.

The seed has no `price` column: prices are set only in the database (see
"Loading your list prices" below), and a product the seed adds starts with
no price, which approved buyers see as "Price on request". Because
`products.price` was `not null` before `20261009100000_price_boundary.sql`,
apply that migration first: Postgres checks NOT NULL before ON CONFLICT, so
on an older database every row of the seed fails, even ids that already exist.
The seed's last statement moves `products_id_seq`
(`20261010120000_admin_product_editor.sql`) past the ids it inserted, never
back, so the next product added in Admin → Products gets a new id; on a
database without that sequence it does nothing.

The first migration creates four tables — `profiles`, `products`, `orders`,
`order_items` — plus a `pricing_tiers` lookup. Later migrations add the
application columns and `profile_documents`. RLS is enabled on all of them.

`20260927180000_application_documents.sql` also creates a **private** Storage
bucket named `application-documents` (10 MB maximum). Since
`20261012100000_document_storage_lock.sql` it takes PDF, JPG and PNG only,
like the site (AW-347); that list gates new uploads only, so HEIC/HEIF files
sent before the site stopped offering them keep their type and still open.
Confirm in **Storage** that the bucket is not public. No extra environment
variables. Applicants may upload a state retail tobacco license and a resale
certificate from the application form once they have a session, or later from
`/apply` (any signed-in account, so an approved or suspended store can send a
renewal). The license number and resale certificate number stay required.
Proof can also be emailed to the trade desk. Every upload is a new file
(`{user id}/{document type}/{upload time}-{filename}`); a replaced file stays
in the bucket and in `profile_document_history`
(`20261008193000_profile_approval_audit.sql`), and only a pending applicant
can delete proof. Since `20261009140000_profile_and_document_boundaries.sql`
files and rows must use that layout, and an account can upload at most 10
files in 24 hours. Since `20261012100000_document_storage_lock.sql` a stored
file can't be overwritten or renamed by anyone but the SQL editor and the
service role (AW-197): the file staff saw when they approved an account
stays the one on file. The site uploads with upsert off, so it never needs
to.

The site checks what a file is before it uploads it (AW-347): its first bytes
must be a PDF, JPEG or PNG that matches its extension (a PDF must start with
`%PDF-`, after at most a byte order mark and whitespace), so a program or web
page renamed `license.pdf` is refused in the browser, even one with `%PDF-`
further in. That check runs only in the browser. Storage checks only the type
the upload declares (PDF, JPEG or PNG since `20261012100000`), and SQL can't
read an object's bytes, so a request made outside the site can still store a
disguised file under the applicant's own folder. Staff open these files from
untrusted applicants: open them in the browser's viewer (the View link), not
in a desktop program. Closing the gap needs an Edge Function that reads each
new object's first bytes on upload and removes the ones that don't match; it
isn't built.

A trigger on `auth.users` auto-creates a `profiles` row on signup. **Every
signup starts as `customer` / `pending`.** Public signup never creates an
administrator. The trigger copies the application (including the store
address and when the Trade terms, Privacy policy and 21+ boxes were ticked,
with the terms version) to the profile, then removes everything but the name
and business from the account's auth metadata, which is sent with every
access token and editable by the user (AW-348).

**Provisioning the owner.** After the owner has signed up **and confirmed
their email**, open `supabase/seed/provision_owner.sql`, replace the
placeholder with that email, and run the file in the SQL editor. It finds the
owner by the confirmed sign-in email in `auth.users` (upper or lower case
doesn't matter), never by the email stored on the profile, and then lists
every admin account: check that the list shows only the owner and staff you
promoted on purpose. Only an **approved** admin has admin rights; setting an
admin's status to suspended removes them at once. Later accounts are approved
from the Admin → Accounts tab, which records who approved them and when.

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

- Set the **Site URL** to the production domain.
- Add `https://<production domain>/` to the **Redirect URLs** allow list.
  Sign-up confirmation links (and a resent confirmation) ask to return to the
  site the applicant signed up on (`emailRedirectTo`, AW-051); an address
  that isn't allowed falls back to the Site URL. Add each deploy-preview
  origin you test sign-up on too.
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
sign-in dialog (`auth.resend`), and an applicant can send it again from the
dialog's "Check your inbox" step (AW-016). Either button then waits a
minute (`RESEND_COOLDOWN_MS` in `src/components/AuthModal.jsx`, matching
Supabase's default minimum interval between emails to one address); when
Supabase still refuses (`over_email_send_rate_limit` / HTTP 429) the dialog
says to wait a minute instead of showing Supabase's text. After a
confirmation link, an account under review gets a notice that leads to its
status and documents on `/apply`.

### Production email (owner set-up, AW-051)

<!-- TODO(owner): Set up an SMTP provider with a sender address on the business domain (SPF/DKIM), and confirm the sender name for the confirmation and reset emails. (AW-051, AW-093) -->

Supabase's built-in mailer is rate-limited and meant for testing, so
confirmation and password-reset emails may not reach customers until a
custom SMTP sender is set up:

1. Pick a provider (Resend, Postmark, Amazon SES or similar) and verify a
   sender address on the business domain, with its SPF and DKIM records.
2. Enter it under **Authentication → Emails → SMTP Settings**.
3. Raise **Authentication → Rate Limits → emails sent** to fit your
   sign-ups.
4. Keep **Confirm email** on in production.
5. Put the business name in the **Confirm signup** and **Reset password**
   templates.

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

### Password changes (AW-349)

`/reset-password` changes the password in two ways:

- **From a reset email.** The link signs the buyer in for this purpose, and
  the page asks only for the new password.
- **While signed in, without a link.** The page asks for the current password
  first and checks it by signing in again with it (`verifyPassword` in
  `src/lib/auth.jsx`, `POST /auth/v1/token?grant_type=password`). A wrong
  one saves nothing, and Supabase's sign-in rate limit applies to the tries.
  A buyer who doesn't know it can ask for a reset email from the same form.

Either way, after the new password is saved (`PUT /auth/v1/user`), the page
ends the account's sessions on other devices
(`POST /auth/v1/logout?scope=others`); this browser stays signed in. If that
last call fails, the password is still changed, and the page asks the buyer
to use **Sign out of all devices** on `/account`. These are standard Supabase
Auth endpoints, so no migration is involved.

<!-- TODO(owner): Turn on 'Secure password change' in the Supabase Auth settings (AW-349) -->

**Recommended setting:** turn on **Secure password change** in the Email
provider's settings (**Authentication → Sign In / Providers → Email**). With
it on, Supabase itself refuses a password change from a session more than 24
hours old unless the user enters a code it emails them, so the rule above
also holds for someone who calls the Auth API directly from a browser left
signed in. The storefront already works with it: the signed-in form signs in
again just before it saves, and a reset link starts a new session, so both
changes come from a session minutes old and never need the code.

### The storefront catalog

One `CatalogProvider` (`src/lib/catalog.jsx`) reads the active rows of
`products`, a page of 1,000 at a time so the catalog is never cut off at the
API's row limit, and only the columns in `CATALOG_COLUMNS` (plus
`featured_rank`, the homepage rank, first: a database without it answers
42703 and is read with the next list in `CATALOG_COLUMN_FALLBACKS`). Change
that list when a column the storefront reads is added, renamed or revoked. The copy of
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
4. Run `supabase/seed/provision_owner.sql` for that email (it has to be
   confirmed first), and check the admin list it prints. You should then see
   an **Admin** link in the header.
5. Open `/admin`. Three tabs:
   - **Orders** — every quote submitted via the storefront, with status dropdown.
   - **Accounts** — every trade account; flip `pending → approved` (the row
     then shows who approved it and when), change pricing tier (the
     `pricing_tiers` rows), grant the admin role (which also approves the
     account), and open each account's license documents, for every status.
     **Details** opens the application answers (EIN, licence, resale
     certificate, phone, store address, volume, approval, consent) and a
     verification note. Your own status and role can't be changed there. The
     approval, consent and note fields fill in once the 2026-10-08
     migrations are applied.
   - **Products** — edit name/price/tag/active flag for any of the 368 SKUs.

## How pricing tiers work

List prices are stored only in the database, in `products.price`. They are
not in `src/data/products.js`, the seed or the built site, and guests and
signed-in accounts cannot read the column through the API
(`20261009100000_price_boundary.sql` moves `products` to column privileges;
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

**Admin → Pricing** (`/admin/pricing`) changes a tier's label and discount
(0 to 99.99%, two decimals at most) without SQL; it doesn't add or remove
tiers or rename their keys. Approved buyers see the new prices on their next
page load; orders already saved keep their prices. Since
`20261010121000_admin_bulk_products.sql` the database also refuses a discount
below 0 or of 100 or more (`pricing_tiers_discount_range`, `NOT VALID`, so
rows already there are checked only when next changed). If a label names the
discount ("Silver (5% off)"), change it with the discount.

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
- **Admin → Products → Import CSV**, for many at once without SQL (after
  `20261010121000_admin_bulk_products.sql`): **Export CSV**, fill in the
  `price` column in a spreadsheet, and import the file; the preview lists
  every change before anything is saved. Keep the file out of the
  repository, like the SQL file above.

Never put prices in `src/data/products.js`, the seed, a migration or any other
committed file: everything in the repository ships to, or can be read by,
people who must not see trade prices.

## Variants, availability and sell units

`20261009110000_variant_model.sql` gives variants a data model without
changing their shape: `products.variants` is still a list of label strings,
and cart lines, Quick Reorder and order history keep working with them.

- **Variant axis** (`products.variant_axis`): what the variants differ by,
  one of Flavor, Size, Color, Style, Format, Strength, Type or Variety. The
  storefront says "Choose a flavor", counts "8 flavors" on cards, and shows
  the "flavors change often" note only for Flavor. Every product with two or
  more variants has one; a product with one variant or none needs none.
- **A variant's own price** (`product_variant_prices`): a row for a
  product's variant wins over `products.price` in `my_prices()` and in the
  order trigger, so the cart, the product page ("From $x" until a variant is
  chosen) and the saved line agree. A row with a null price is "price on
  request" for that variant; a variant without a row costs the product's
  price. Labels match case-insensitively. Only admins read or write the
  table; it is private like `products.price`. This is the only place for
  variant prices: Cursor's `products.variant_prices` column
  (`20261008200000`) sat on the public `products` table (one grant away from
  every visitor, with no per-variant checks), so `20261009110000` moves any
  values it holds here and drops it. Don't fill `variant_prices` between
  those two migrations; apply them in one session.
- **Availability** (`products.unavailable_variants`): labels that can't be
  ordered right now. The product page shows them as disabled choices that
  say so, a cart line with one is flagged like a variant that went away, and
  `submit_quote` refuses it (hint `variant_unavailable`).
- **Sell unit** (`products.sell_unit`): what quantity 1 means ("5-pack",
  "box of 200"). It shows on the product page, the card and every cart and
  checkout line, and `order_items.sell_unit` keeps the value a line was saved
  with. Rows whose name or description states the unit have one; the rest
  are empty until you supply them.
- The old `products.flavors` count is gone; the storefront counts the
  variants.

<!-- TODO(owner): What is the price, and is it in stock, for each size or pack-count variant of the multi-variant products (for example gas cans 1 gal / 2 gal / 5 gal)? Load them as below. (AW-030) -->
<!-- TODO(owner): What is the sell unit (each, box of N, case of N, or a size) of each product that has none yet? Load them as below. (AW-031) -->

Admin → Products edits them one product at a time (a variant's list price,
"Can't be ordered", the sell unit; see "The product editor" below). For many
at once, load them from a private SQL file under `supabase/private/` (never
committed), run in the SQL editor:

```sql
-- A variant's own list price (leave price null for "price on request").
insert into public.product_variant_prices (product_id, variant, price)
values (<id>, '<variant label>', <list price>)
on conflict (product_id, variant) do update set price = excluded.price;

-- Variants that can't be ordered right now ('[]' when all can).
update public.products set unavailable_variants = '["<variant label>"]'::jsonb where id = <id>;

-- What quantity 1 means.
update public.products set sell_unit = '<sell unit, e.g. case of 24>' where id = <id>;
```

Sell units are not prices, so they may also go in `src/data/products.js`
(`sellUnit`) with an UPDATE data migration, like any other catalog
correction.

### Changing a SKU or a variant label

Cart lines are stored as product id plus variant slug, buyers type SKUs into
Quick Reorder, and Reorder maps a saved order back onto the catalog. A code
or label that changes must keep working for all three, so every change goes
in `src/data/catalogAliases.js` next to the `products.js` edit:
`SKU_ALIASES` (old product code -> new code) and `VARIANT_ALIASES`
(product id -> old variant slug -> new label, or null when the product no
longer has a variant choice). The storefront reads each alias both ways, so
it also works while the database still has the old values. `npm run seed`
refuses an alias that points at a code or label the catalog doesn't have.
Saved orders keep their own `sku`, `product_name` and `variant`.

`20261009120000_catalog_corrections.sql` applied the first set (AW-135,
AW-138, AW-126): SKUs cut at 17 characters or ending in a hyphen, misspelled
codes, and inconsistent or abbreviated labels. A renamed label also renames
its `product_variant_prices` row and its `unavailable_variants` entry.

The product editor (below) can change a SKU or rename or remove a variant,
but it can't add an alias: carts and Quick Reorder entries saved with the old
value no longer match it, and the editor says so under those fields. To stop
orders of a variant for now, tick "Can't be ordered" instead of removing it;
for a SKU that must change, add the alias in `catalogAliases.js` in the next
release.

## The product editor (Admin → Products)

Admin → Products lists every product with its photo, list price, tag and
whether it is active; **New product** and each row's **Edit** open a
full-page editor at `/admin/products/new` and `/admin/products/<id>`
(`src/pages/admin/ProductEditor.jsx`; the checks are in
`src/pages/admin/productForm.js`). It edits the name, brand, department,
sub-line (or a new one), SKU, sell unit, description, the variants (order,
"Can't be ordered", and each one's own list price), what the variants differ
by, the tag, the list price (blank: price on request), the homepage rank, the
stock status, whether it is active, and the photo. **Duplicate** starts a new
product from a copy; **Delete** removes one that no order refers to.

`20261010120000_admin_product_editor.sql` (AW-023, AW-116, AW-119) adds what
it needs:

- **New products** take the next id from `products_id_seq`, the column's new
  default. The seed moves the sequence past the ids it inserts. Rows added
  to `src/data/products.js` share that id space, so a new one needs an id
  above the live `select max(id) from public.products` (see "Ids of new
  products" in section 2; the seed names an id staff already took, and stops
  on a SKU they already used).
- **Checks**: a SKU is used by one product only, whatever its case or
  surrounding spaces (the unique index `products_sku_upper_key`, created only
  when the table has no such duplicates; otherwise the migration prints a
  notice with the query that finds them); a product needs a name and a brand;
  a list price is at most 99,999.99 (`price >= 0` is `20261009100000`'s). The
  name, brand and price checks are `NOT VALID`: rows already in the table are
  checked only when someone next edits them. The editor checks the same
  things first and names the field.
- **Stock status** (`products.stock_status`: `in_stock`, `low`, `out`,
  `discontinued`; new rows are `in_stock`). Staff only for now: the
  storefront doesn't show it (owner question AW-023 in `docs/OWNER-TODO.md`).
- **Homepage rank** (`products.featured_rank`, 1 to 999, or empty). The
  homepage's New arrivals shows active products with a photo tagged NEW, and
  Bestsellers those tagged BESTSELLER (`src/lib/merchandising.js`); a rank puts
  a product first, 1 before 2, and unranked ones follow in today's order.
  Products in the lines under legal review (AW-001) are featured only with a
  rank, or where the homepage already showed them (owner question
  AW-119/AW-001).
- **Delete** is refused for a product that an order line refers to (errcode
  23503, hint `product_has_orders`): `order_items.product_id` would be set to
  null and the order history would lose its link. Deactivate it instead; the
  editor counts its order lines first and offers only that.
- **Photos**: a public Storage bucket, `product-images` (JPEG, PNG or WebP,
  at most 5 MB). Only approved admins add, replace, list or remove files. The
  editor uploads to `products/<id>/<upload time>-<name>.<ext>`
  (`products/new/…` for a product not saved yet) and saves the file's public
  URL in `products.img`; a photo file bundled with the site (`kite.jpg`) still
  works. A replaced or removed photo stays in the bucket. The site's
  Content-Security-Policy (`netlify.toml`) allows images only from the site
  and `https://*.supabase.co`, so the editor accepts only a bundled file name
  or a public Supabase Storage address
  (`https://<project>.supabase.co/storage/v1/object/public/…`); a photo on
  any other host would be blocked. A new image host needs `img-src` and the
  privacy policy's processor list changed first.

Without this migration the editor still works on the live database: a new
product is inserted with the next free id (the table has no id default), the
stock status and homepage rank fields say they need the update, a photo
upload says so too (a file name or URL still works), and the editor checks a
product's order lines before it offers Delete. Before `20261009110000` the
variants' axis, "Can't be ordered" and own prices are not offered, and before
`20261009100000` a blank price can't be saved ("price on request" needs that
update).

**Show no description** (`products.description_hidden`,
`20261012120000_product_description_hidden.sql`, AW-023). A product whose
description is blank shows the one bundled with the site
(`src/data/products.js`), because rows saved before `20260927120000` have
`''` there, so clearing a wrong description used to bring the bundled text
back. Ticking "Show no description" in the editor gives the product page no
description at all (neither text nor the generic "Wholesale … from …"
sentence); the text in the Description box is kept and comes back when the
box is unticked. Everyone can read the column; only approved admins change
it. Before the migration the box isn't offered; a save that the database
answers with a missing column says the box "needs the October 2026 database
update". The storefront asks for the column together with `featured_rank`,
so apply it with or after `20261010120000`: on a database with
`20261010120000` but without it, the catalog is read without the homepage
rank until it is applied.

### Bulk changes and CSV (Admin → Products)

The products list filters by status, department, sub-line, tag, stock
status, "No photo" and "No sell unit", searches the name, brand, SKU,
department, sub-line and id, sorts by ID, name, brand, price or last change,
and shows 50 products a page; all of it is in the address
(`/admin/products?status=inactive&dept=tobacco&page=2`), so a filtered list
can be bookmarked or shared with staff (AW-115).

Ticking products (or "Select all … filtered") opens the bulk bar (AW-114):

- **Set price**, **Set tag**, **Activate** and **Deactivate** are one update
  of the chosen products; they work on any version of the database.
- **Adjust price** raises or lowers the list prices by a percentage or an
  amount, and by default the variants' own prices, with a preview of old and
  new prices first. It calls `admin_bulk_adjust_prices()`
  (`20261010121000_admin_bulk_products.sql`), which rounds to the cent like
  `tier_unit_price()`, skips products on request, and changes nothing if any
  new price would fall below 0 or rise above 99,999.99 (hint
  `price_out_of_range`).
- **Export CSV** downloads the selection, or every product the filters show:
  `id, sku, name, brand, cat, sub, sell_unit, price, tag, active`, then
  `stock_status` and `featured_rank`. The file has list prices in it: treat
  it like the private SQL files above. Cells that a spreadsheet would run as
  a formula are written with a leading apostrophe.
- **Import CSV** reads such a file back, matched on `sku` (any case), and
  shows each changed product's fields, old and new, before anything is saved.
  A column the file doesn't have is left alone; an empty `price` cell means
  "price on request"; for a product already in the catalog, `id`, `cat` and
  `sub` are not imported (change a product's department in its editor).
  Rows that fail the editor's checks block the import, and so does a SKU
  listed twice.
- **New products from a file** (AW-114): a row whose SKU no product has is
  added as a new product when the file has `name`, `brand`, `cat` and `sub`
  columns and the row fills them in. `cat` must be one of the catalog's
  departments and `sub` one of its sub-lines, as the export writes them (any
  case); a new sub-line is still added in the product editor. The SKU, name,
  price, tag and the other columns get the editor's checks, and the preview
  lists them under "New products (n)". A new product gets the next id, no
  photo and no variants, and **is inactive unless the file has an `active`
  column that says true**, so nothing reaches the storefront by accident:
  finish it in the editor, then activate it. A row whose SKU is unknown and
  that lacks one of the four is listed under "Not imported".
- The import calls `admin_import_products_v2()`
  (`20261012140000_admin_import_create.sql`): one call, every row saved or
  none (hints `unknown_sku`, `duplicate_sku` and `invalid_input`), returning
  how many products it updated and added. On a database without it, updates
  go through `admin_import_products()` (`20261010121000`) as before, and the
  new rows are listed as not imported: "Creating products from a file needs
  the October 2026 database update." A file with new rows saves nothing on
  such a database until staff confirm the updates on their own.

Every change asks first, with the number of products, and the storefront
reloads its catalog afterwards. Without `20261010121000`, Adjust price and
Import CSV say they need the October 2026 database update and turn
themselves off; everything else works. With it but without
`20261012140000`, Import CSV updates products and doesn't add any.

A renamed photo file in `src/assets/products` works the same way, in one
direction: `IMAGE_FILE_ALIASES` (old filename -> new filename) lets the
storefront build the picture from the new file while a row still names the
old one, and the data migration that updates `products.img` is applied after
the frontend that ships the new file (`20261010131000_photo_filenames.sql`,
AW-290). New photos are named `p<id>-<slug>.<ext>`.

## The homepage (Admin → Homepage)

Admin → Homepage (`/admin/homepage`, `src/pages/admin/HomepageSection.jsx`)
edits the photos beside the home page's headline and shows what the two
product rails hold (AW-119).

- **Hero photos** are the rows of `public.home_slides`
  (`20261011131000_home_slides.sql`), shown in `sort` order (ties by id):
  each has a photo, its alt text (what it shows, 1 to 200 characters), the
  department it links to (or none), whether it shows a nicotine product (the
  FDA warning then shows under it) and whether it is active. Staff add,
  edit, reorder (Move up / Move down swaps two rows' `sort`), turn off and
  delete photos. A photo is one of the hero photos bundled with the site
  (`hero_candy.jpg`, `hero_vape.jpg`, `hero_lighters.jpg`,
  `hero_gatorade.jpg`) or an upload to the `product-images` bucket, saved
  under `home/<upload time>-<name>.<ext>` with its public address
  (`https://<project>.supabase.co/storage/v1/object/public/product-images/…`);
  the table's check refuses anything else, as the site's CSP would block it.
  A deleted or replaced photo stays in the bucket.
- With every photo turned off the home page shows the headline alone, which
  is how to answer "one fixed photo or rotating photos" (AW-004): leave one
  photo active for a fixed one. Turn photos off rather than deleting every
  row: the migration adds the four bundled photos back to an empty table if
  it is run again.
- The storefront shows the bundled photos first and swaps in the table's
  active rows once they load (`src/lib/homeSlides.js`, one request per visit).
  Without the migration, or when the request fails, it keeps the bundled
  photos, and Admin → Homepage says editing them needs the October 2026
  database update.
- **Homepage rails** (read-only here): New arrivals and Bestsellers come from
  the products' tags and homepage rank, set in Admin → Products (see "The
  product editor"), with the legal-review rule described there; each product
  has an Edit link.

## Quotes and orders (`submit_quote`)

The storefront saves a quote (or an approved buyer's order) with one call,
`submit_quote`. Since `20261009130000_submit_quote_v3.sql`:

- **The reference number is made by the server** (AW-049): `ALW-Q-` for a
  quote, `ALW-O-` for an approved buyer's order, then 10 random hex digits.
  The checkout shows it only once the quote is saved.
- **Will-call needs no address** (AW-079). Delivery needs street, city,
  state and ZIP, and only to a state on the delivery routes.
- **Input is checked on the server** (AW-198): field lengths, the email, ZIP
  and 2-letter state formats, and no preferred date before today (Birmingham
  time). A refused call raises an error with a typed hint (for example
  `invalid_zip`, `delivery_state`, `address_required`), which the checkout
  turns into a sentence next to the field.
- **Throttle** (AW-198): 5 saved quotes per account, or per guest address
  and email, in 15 minutes, and 20 per guest address in an hour (hint
  `rate_limited`). `public.quote_throttle` keeps only SHA-256 digests of those
  keys, for a day; nobody but the function can read it. The guest address is
  the first `X-Forwarded-For` entry, which a client can spoof, so this slows
  casual flooding and is not a guarantee. The checkout also has a hidden
  honeypot field that simple bots fill in.
- **Suspended accounts can't submit** (AW-201, hint `account_suspended`);
  the cart and checkout tell them ordering is paused.
- **Line refusals name the product** (AW-200, `20261011110000`): the
  order-line trigger's refusals carry a hint (`product_unavailable`,
  `invalid_quantity`, `variant_required`, `unknown_variant`,
  `variant_unavailable`) and the line's product id as the error's detail,
  so the checkout says which item to fix. On a database without it the
  checkout reads the same refusals from their message text.
- **A send that takes too long** (AW-194): the checkout gives up on
  `submit_quote` after 25 seconds and says the request may have been saved,
  so the buyer calls before sending it again; it never re-sends it with an
  older signature.
- **Tobacco license answers** (AW-014, PR #12's rule, unchanged): a quote
  with a tobacco line (department Tobacco) or a vape line (Disposable Vapes
  or Vape Pods) from a guest or an account that isn't approved must name a
  state tobacco/retail license number and a sales-tax / resale certificate
  number and confirm "all purchasers are 21+" (hint `license_required`).
  The checkout asks for them only then (`cartNeedsTobaccoLicense` in
  `src/lib/regulated.js`, whose test reads the rule from the migration). They
  are stored with the order (`orders.license_no`, `resale_cert_no`,
  `purchasers_21`); Admin → Orders shows them.

<!-- TODO(owner): Confirm guest tobacco and vape quotes may collect a license number, resale certificate and 21+ attestation instead of requiring an approved sign-in. (AW-014) -->
<!-- TODO(owner): confirm route states: do the delivery routes cover exactly Alabama, Mississippi and Georgia? (AW-198) -->

The delivery-route states the checkout mirrors are
`DELIVERY_ROUTE_STATES` in `src/data/quoteRules.js`, twin of
`v_route_states` at the top of `submit_quote`. Change both together; the
database side is a new migration that recreates `submit_quote` from its
newest definition.

Three signatures exist. The current one has no `p_ref_num` and takes the
license answers last (15 arguments). PR #12's 16-argument
`submit_quote(p_ref_num, …, p_license_no, p_resale_cert, p_purchasers_21)`
and the original 13-argument `submit_quote(p_ref_num, …)` are thin wrappers
that ignore `p_ref_num` and run the current one, so frontends deployed
before the migration keep working (with the new checks and the license
rule). Drop the wrappers later (release checklist).

The storefront (`src/lib/orders.js`) calls the current signature and, when
the database doesn't have it (`PGRST202`), the 16-argument one and then the
13-argument one, with a client-made `ALW-Q-` reference (40 random bits), the
warehouse address for will-call, and, for the 13-argument call, the license
answers in the notes. It remembers which signature worked for the rest of the
visit.

### Pricing quotes and converting them (Admin → Orders)

<!-- TODO(owner): Confirm how quotes should work: should staff price and answer guest quotes and convert them to orders, and should orders go through 'quoted' and 'confirmed' stages before picking? (AW-024) -->

Cursor's `20261008200000` and `20261009150000_quote_workflow.sql` give the
saved requests one workflow (AW-024):

- **kind**: `order` when an approved account placed it (its lines were
  priced when it was saved, `ALW-O-` reference); `quote` for a guest or an
  account that isn't approved (unpriced, `ALW-Q-`). `submit_quote` returns
  the same kind it stores.
- **Statuses**: new, contacted, quoted ("Quote ready" on the customer's
  account page), confirmed, picking, ready, out_for_delivery, fulfilled,
  cancelled.
- **Edit quantities and prices** calls `admin_price_order(order, lines)`
  (admins only): each line's quantity (0 removes it) and unit price (blank
  for none). Empty prices are suggested from the list price and the
  account's tier (a guest's at standard); staff check them before saving.
  The totals are recomputed, `quoted_at`/`quoted_by` recorded, and
  `order_items.original_qty` keeps the quantity the customer asked for. A
  new or contacted quote becomes quoted; an order keeps its status. The
  order-line trigger runs on INSERT only, so the prices staff set stay.
- **Email the quote** opens a message to the customer with the lines and
  the total, from the desk's own mail (nothing is sent by the site).
- **Convert to order** calls `admin_convert_quote(order)` (admins only) once
  every line is priced: the quote becomes a confirmed order. The function
  can also attach a guest quote to an existing account
  (`p_user_id`); Admin doesn't offer that yet.
- Refusals carry a hint (`order_closed`, `no_items`, `invalid_line`,
  `unknown_line`, `not_a_quote`, `unpriced_lines`, `unknown_account`,
  `account_mismatch`, `admin_only`) that Admin → Orders turns into a
  sentence.

Before these migrations, Admin → Orders offers the four old statuses, treats
a guest's or an unpriced request as a quote, and can still email a quote with
prices typed in the editor; saving prices and converting say the database
update is needed.

### Finding, printing and following orders (Admin → Orders)

Admin → Orders (AW-110, AW-111) has a filter row above the status pills:

- **Search orders** looks in the reference, business, contact, email and
  phone, on the server. What is typed stays on the page and never goes into
  the address bar (it names people). **Placed from / to** (the days the order
  was placed, on the admin's computer), **Deliver on** (the requested date) and
  **Method** (delivery or will-call) go into the address
  (`/admin/orders?status=…&from=…&to=…&on=…&method=…`), and so does
  `?account=<profile id>` (the orders of one account).
- **Pages and counts** (AW-199): the status and the filters go to the
  server, which sends 50 orders a page, newest first ("Page 2 of 7 · 312
  orders", Previous / Next, `&page=` in the address; a page past the end
  shows the last one). Each status pill counts every matching order on the
  server ("Picking (120)"; "…" while a count is out), and counts again after
  a status change. A filter or status change starts at page 1.
- **Print pick list** and **Print packing slip** open
  `/admin/orders/<id>/print?doc=pick|slip`: the order's facts and its lines
  by department, sub-line and name, with an empty box to tick, the SKU, the
  quantity and the sell unit. Neither shows prices. The packing slip adds the
  store's name and address; both show the customer's notes, never staff notes.
  Printing hides the site around the sheet.
- **Export CSV** downloads every order the filters and the status pill
  match (not just the page; up to 20,000), one row per order line (ref,
  dates, kind, status, business, contact, email, phone, delivery, SKU,
  product, variant, quantity, unit price, line total, subtotal). Cells that
  would run as a spreadsheet formula are defused. The file holds customers'
  contact details and prices: keep it private.
- **Staff notes and history** under each card (loaded when opened): who the
  order is assigned to (an approved admin), internal notes, and every status
  and assignment change with who made it and when. Cancelling asks for a
  reason, which goes in the history.
- The list keeps itself current: Supabase Realtime tells it about new and
  changed orders at once, and it also reloads every minute while the tab is
  visible (and when the tab comes back). **Refresh** reloads now, and
  "Updated 9:14 AM" says when it last did. Reloads keep the filters, the
  focus and any quote being edited.
- Orders placed since the admin last opened Orders are marked **New**, and
  the header's Admin link and the page title (`(2) Orders · Admin · …`) count
  the orders that came in since then.

`20261010122000_order_operations.sql` adds what this needs:
`order_events` (the history, written only by the `orders_log_change`
trigger), `order_admin_notes` (internal notes), `orders.assigned_to` (a staff
profile id; the customer can see the id, never a name or a note), an index
on `orders.preferred_date`, `admin_set_order_status(order, status, note)`
(admins only; `cancelled` needs a reason, hint `reason_required`; also
`invalid_status`, `note_too_long`, `order_not_found`, `admin_only`),
`admin_order_views` with `admin_mark_orders_seen()` (each admin's last visit;
returns the previous one), and `public.orders` in the `supabase_realtime`
publication. `orders` now has three foreign keys to `profiles`, so every
embed from `orders` names `profiles!orders_user_id_fkey(...)`.

Before it, Admin → Orders still searches, filters, prints and exports; status
changes use the plain update (as before, without a history); the notes panel
says it needs the update, the "Assigned to" select is hidden, the New marker
counts from the first time Orders was opened in that tab, there is no header
count, and the list refreshes every minute instead of at once. Realtime also
needs the site's Content-Security-Policy to allow
`wss://<project-ref>.supabase.co` in `connect-src`.

### Accounts and their pages (Admin → Accounts)

Admin → Accounts (AW-113, AW-112) loads every account, and every account's
licence document rows, 1000 at a time (AW-199: one request used to stop at
PostgREST's 1000-row limit without a word; Admin → Products loads its rows
the same way). It has a **Search accounts** box that looks in
the business, name, email and phone of the loaded accounts; what is typed
stays on the page and never goes into the address bar. Each business links
to its own page, `/admin/accounts/<profile id>`, and each order card's
account line links there too. The page shows:

- **Status, tier and role**, with the list's rules (an admin can't change
  their own status or role; the database refuses it too).
- **Contact and store**: business, contact name, phone, business type, store
  street, city, state (two letters) and ZIP, saved to the profile's own
  columns (`store_*` are the store address). Only the changed columns are
  sent. The email is read only: it follows the sign-in email.
- **Verification**: the application answers and the verification note (which
  the account holder can read).
- **Licence documents**, signed when View is clicked.
- **Internal notes** (`profile_admin_notes`): staff only, with the author's
  name and the date; 1 to 2,000 characters.
- **Orders**: the newest 50 with the last order's date and the total of the
  priced orders that weren't cancelled; every link opens Admin → Orders for
  the account (`?account=<profile id>`).
- **Status history** (`profile_status_log`): status changes, and role
  changes once `20261011111000` is applied.

Status and tier changes (on the list and the page) show at once, with
Undo for 8 seconds, and go back with the reason if the database refuses
them; one request per account at a time. **Suspending** asks for a reason,
which is saved as an internal note ("Suspended: …"). **Making an account an
admin** or **removing admin access** (AW-203) asks too ("Make … an admin?",
"Remove admin access from …?"), with a required reason saved as an internal
note ("Made an admin: …", "Admin access removed: …"); making a pending or
suspended account an admin approves it, which the question says. The select
keeps the saved role until it is confirmed, and none of these three has Undo.
Since `20261011111000`, the **Status history** lists role changes too ("Made
an admin by …", "Approved and made an admin by …"). **Cancelling an order**
asks for a reason that goes in its history (`admin_set_order_status`); other
order status changes keep the card where it is, tagged "Moved to …", until
Refresh or another filter, with Undo.

The page uses `20261008191000` (store address), `20261008193000` (approval
stamp, status history), `20261009140000` (internal notes) and
`20261011111000` (role changes in the history). Before those are applied,
saving a column the database doesn't have says it needs the October 2026
update, the notes say so too (and a suspension or role change says its
reason wasn't saved), the status history is left out (or, before
`20261011111000` alone, shows status changes only), and a cancellation's
reason is optional because it can't be stored.

Staff can't create or invite an account from Admin yet: that needs a
Supabase Edge Function with the service-role key and an email provider (see
docs/OWNER-TODO.md, AW-113 and AW-088).

## Saved carts

The cart lives in the browser: one per account on each device, plus one for
guests (`src/lib/cartStorage.js`, localStorage `aw-cart-v3:<owner>`, the
lines in the order they were added). From `20261012110000_carts.sql` on, a
signed-in account's cart is also saved in `public.carts`, so a buyer who
fills it on a phone finds it on the computer (`src/lib/cartSync.js`, AW-334):

- Once a session is confirmed the site reads the account's row once. On a
  page load, whichever of the row and the device's copy changed last is kept
  (the row's `updated_at` against the time the device last changed its
  copy); the two are never added together. When a buyer signs in with items
  added as a guest, those items are added to the newer copy once, then saved.
- Each change is saved about 1.5 seconds after the last one (an upsert of
  `user_id`, `lines` and `updated_at`), and at once when the tab is hidden. A
  tab that comes back into view after half a minute reads the row again.
  Offline nothing is sent; it catches up once the browser is back online.
- A row holds line keys and quantities only (`[["14", 2], ["1::white-grape",
  1]]`), never a price, name or note: prices come from `my_prices()` when the
  cart is shown. Admins don't see carts.
- Guests' carts are never sent.
- Until the migration is applied, the read finds no table (404 /
  `PGRST205`), the site stops trying for that page view, and the drawer and
  checkout say the cart is kept on this device, as before. Once the read
  succeeds they say "Saved with your account".

Storing what is in a buyer's cart is a new use of their data: the privacy
policy doesn't mention it yet (owner question AW-334 in docs/OWNER-TODO.md).

## Row-level security summary

- **Admins**: `is_admin()` is true only for a profile with role `admin`
  **and** status `approved` (`20261009140000`), so a suspended or pending
  admin has no admin rights anywhere below.
- **profiles**: a user reads their own row; admins read any. In a signed-in
  customer's own update, every column but the name, phone and store address
  (street, city, ZIP) keeps its value (Cursor's `a_protect_profile_columns`
  trigger, extended in `20261009140000`): the update succeeds, those columns
  don't change. Admins update any row, but changing their own role or status,
  the consent (`terms_*`, `age_confirmed_at`) or approval (`approved_at`,
  `approved_by`) records, or an email to anything but the account's sign-in
  email is refused with `insufficient_privilege`; only the signup and
  approval triggers write those records. `profiles.email` follows the sign-in
  email (a trigger on `auth.users` copies changes). The SQL editor is not
  limited. `verification_note` is readable by the account holder.
- **profile_status_log / profile_document_history**: written by triggers;
  admins read them, nobody can add, change or delete rows.
- **profile_admin_notes**: internal notes about an account; admins only (the
  account holder can't read them).
- **order_events** (`20261010122000`): the history of each order's status and
  assignment, written only by the `orders_log_change` trigger; admins read it,
  nobody adds, changes or deletes rows through the API.
- **order_admin_notes** (`20261010122000`): internal notes about an order;
  admins read, add and delete them, in their own name only; customers and
  guests have no access. Notes are 1 to 2000 characters.
- **admin_order_views** (`20261010122000`): each admin reads only their own
  last visit to Admin → Orders; only `admin_mark_orders_seen()` writes it.
- **products**: anyone reads `active = true` rows, and every column except
  `price` (column privileges; `select=*` is refused). Admins read and write
  every row; they read list prices through `admin_product_prices()` and set
  them with an ordinary update. Approved buyers get their prices from
  `my_prices()`. A column added to `products` later needs its own
  `grant select (<column>) on public.products to anon, authenticated;`.
  Since `20261010120000`, a product that an order line refers to can't be
  deleted (hint `product_has_orders`), and admins' inserts take their id from
  `products_id_seq` (guests have no use of it). Since `20261010121000`,
  `admin_bulk_adjust_prices()` and `admin_import_products()` change many
  products at once, all or nothing; both check `is_admin()` and can't be
  called by guests. `admin_import_products_v2()` (`20261012140000`) does the
  same and also adds the products a file describes, inactive unless the file
  says otherwise.
- **product_variant_prices**: admins only (read and write); guests have no
  privileges on it at all. Approved buyers get its prices, at their tier,
  from `my_prices()`.
- **orders / order_items**: a user reads their own orders; admins read and
  update all orders. Customers and guests do not insert rows directly.
  `submit_quote` saves the header and lines together, sets `user_id` from the
  session, makes the reference number, stamps `kind` and calculates prices.
  Guest quotes are stored with `user_id` null. Nobody updates `order_items`
  directly; staff change lines only through `admin_price_order()` and
  `admin_convert_quote()`, which check `is_admin()` and can't be called by
  guests. Since `20261010122000`, admins also change a status through
  `admin_set_order_status()` (with a note), every status and assignment
  change is logged in `order_events`, `orders.assigned_to` names the staff
  member looking after an order, and `orders` is in the Realtime publication
  (Realtime applies the same policies: a customer hears only their own
  orders).
- **quote_throttle**: no access for guests or signed-in accounts (RLS on, no
  policies, privileges revoked); only `submit_quote` uses it.
- **pricing_tiers**: readable by admins and approved buyers only;
  admin-writable (Admin → Pricing). `profiles.pricing_tier` must name one of
  its rows. Since `20261010121000` a discount is from 0 up to (not including)
  100.
- **profile_documents**: a user reads, inserts and replaces their own rows
  (one tobacco license and one resale certificate), whatever the account's
  status, and a row's `storage_path` must be
  `{their id}/{its document type}/{file}`. Only a pending applicant can
  delete; approved and suspended accounts can file a renewal. Admins read
  every row.
- **storage `application-documents`**: private. Object paths are
  `{user id}/{document type}/{upload time}-{filename}`, where the type folder
  is `tobacco_license` or `resale_certificate`. A user reads their own folder
  and uploads there at that layout only, at most 10 files in 24 hours; only a
  pending applicant deletes there. Since `20261012100000` nobody changes a
  stored object (no UPDATE policy), whatever the account's status: a renewal
  is a new file. PDF, JPEG and PNG only. Admins can read every object, which
  is what the Accounts tab uses to mint a signed View link.
- **storage `product-images`** (`20261010120000`): public, so anyone loads a
  product photo by its URL; only approved admins add, replace, list or
  remove files.
- **carts** (`20261012110000`): each signed-in account reads, adds,
  changes and deletes its own row only (`auth.uid() = user_id`); guests have
  no privileges; admins see no one's cart. A row is deleted with its
  account. See "Saved carts".
- **home_slides** (`20261011131000`): the home page's hero photos. Guests
  and signed-in accounts read the active rows; approved admins read every row
  and add, change and delete them (`updated_at` and `updated_by` follow each
  change). The id comes from the identity column, so no role needs the
  sequence. A photo must be a bundled `hero_*.jpg/jpeg/png/webp` file or a
  `product-images` Storage address.

## Resetting

> **Destructive.** `drop schema public cascade` permanently deletes every
> table in `public` and every row in it: all orders and quotes with their
> lines and history, every profile with its application answers, approval
> record, status history and internal notes, the licence document records,
> the list prices, the tier discounts and the catalog. There is no undo
> without a backup. Never run it on the production project to fix a
> problem; restore a dump or run a migration's reverse SQL instead (see
> "Rolling back" in the release checklist).

Only on a project whose data can be thrown away, and only after taking a
dump of it (release checklist, step 2) and checking that the dump files are
not empty:

```sql
drop schema public cascade;
create schema public;
-- then re-run the migration files and supabase/seed/products.sql
```

`auth.users` lives in a separate schema and is preserved — you'll want to
delete those manually if you want a fully blank slate. Files in Storage
(`application-documents`, `product-images`) stay too, but their
`profile_documents` rows are gone.

## Release checklist

The live project gets database changes before the frontend that uses them.
For each release:

1. Run `npm run test:db` (and `npm test`) on the release commit.
2. **Before applying any migration, take a dump** of the live database and
   keep it outside the repository (it holds customers' personal data and
   licence records; never commit it). With the CLI linked (above), name the
   files after the date and the first migration they precede, for example:

   ```bash
   mkdir -p ~/aw-db-backups
   supabase db dump --linked -f ~/aw-db-backups/2026-10-12-pre-20261012100000-schema.sql
   supabase db dump --linked --data-only -f ~/aw-db-backups/2026-10-12-pre-20261012100000-data.sql
   ```

   `supabase db dump` writes the schema only unless `--data-only` is given,
   so take both, and check that neither file is empty. On the Pro plan the
   Dashboard also keeps daily backups (**Database → Backups**; owner
   question AW-213 covers the plan), but the latest can be up to a day old,
   so take the dump as well. Files in Storage are not in a database dump.
3. Apply each migration below that the project doesn't have yet, in order:
   in the SQL editor, or with `supabase db push` once tracking is set up
   ("Tracking which migrations ran").
4. Apply `supabase/seed/products.sql` (regenerated by `npm run seed`). It only
   inserts products whose id is new; read its notice if it prints one, and
   it stops, inserting nothing, on a new row whose SKU another product
   already uses ("Ids of new products" in section 2).
5. Deploy the frontend.
6. Then apply the migrations the table below marks "Apply AFTER deploying
   the new frontend" (`20261010131000_photo_filenames.sql`).

**Rolling back.** The frontend and the database roll back separately:

- **Frontend:** Netlify → **Deploys** → an older deploy → **Publish deploy**.
  Publish only a deploy built from a commit at or after the latest migration
  applied to the live project (the commit that added that migration file, or
  a later one). An older build can call functions, columns or policies that
  the applied migrations changed or removed: a frontend from before
  `20260925120000`, for example, inserts orders directly, which that
  migration forbids, so every quote would fail. See NETLIFY-DEPLOY.md.
- **Database:** there are no down-migrations. Rolling a migration back means
  running the commented Reverse SQL at the end of its file (every file from
  `20261009100000` on has one; read it first, as some changes, such as data
  moved or stripped, aren't put back), or restoring the dump from step 2,
  which also undoes every order, application and edit made since. The files
  before `20261009100000` have no Reverse SQL: for those, the dump is the
  way back. Roll the database back first, while the current frontend stays
  published (it works before and after its migrations; see "Before and
  after" below), then publish an older frontend only if it is at or after
  the latest migration still applied.

The live project needs all twenty-seven, in this order (Cursor's seven
`20261008…` files, then the six `20261009…` ones, which build on them, then
the five `20261010…` ones: three for the admin back office and two data-only
catalog fixes, then `20261011110000` and `20261011111000`, which can go in
any time, then the data-only `20261011130000` and the home page's
`20261011131000`, then the document lock `20261012100000` and the saved
carts `20261012110000`, also any time, then "Show no description"
`20261012120000`, with or after `20261010120000`, then the data-only
catalog fix-ups `20261012130000`, any time, then the import that adds
products, `20261012140000`, after `20261010121000`, any time).
Apply
`20261008200000` and `20261009100000`–`20261009150000` in one session: the
price boundary hides `products.variant_prices` and `20261009110000` moves it.
Each `20261009…` migration ends with a commented reverse-SQL block for
rolling it back.

1. `20261008190000_quote_tobacco_license.sql`
2. `20261008191000_profile_store_address.sql`
3. `20261008192000_profile_self_update_guard.sql`
4. `20261008193000_profile_approval_audit.sql`
5. `20261008194000_strip_signup_metadata.sql`
6. `20261008195000_application_consent.sql`
7. `20261008200000_variant_prices_and_quote_workflow.sql`
8. `20261009100000_price_boundary.sql`
9. `20261009110000_variant_model.sql`
10. `20261009120000_catalog_corrections.sql`
11. `20261009130000_submit_quote_v3.sql`
12. `20261009140000_profile_and_document_boundaries.sql`
13. `20261009150000_quote_workflow.sql`
14. `20261010120000_admin_product_editor.sql` (Admin → Products; it can be
    applied later on its own)
15. `20261010121000_admin_bulk_products.sql` (Admin → Products' Adjust price
    and Import CSV, and the tier discount check; after 14, also on its own)
16. `20261010122000_order_operations.sql` (Admin → Orders' history, notes,
    assignment, new-order marker and Realtime; after 13, also on its own)
17. `20261010130000_catalog_apostrophes.sql` (data only; any time)
18. `20261010131000_photo_filenames.sql` (data only; **after the new
    frontend is deployed**, step 6 above)
19. `20261011110000_order_item_hints.sql` (the checkout names the item a
    refused line is about; any time, after 9)
20. `20261011111000_profile_role_audit.sql` (role changes in an account's
    history; any time, after 12; before it, role changes aren't in the
    history, only their reasons in the internal notes)
21. `20261011130000_catalog_names.sql` (data only; any time)
22. `20261011131000_home_slides.sql` (the home page's hero photos, Admin →
    Homepage; any time, also on its own)
23. `20261012100000_document_storage_lock.sql` (stored licence files can't be
    overwritten, and the bucket takes PDF, JPEG and PNG only; any time,
    before or after the frontend, also on its own)
24. `20261012110000_carts.sql` (a signed-in account's cart is saved with the
    account and follows it to other devices, see "Saved carts"; any time,
    before or after the frontend, also on its own: the site feature-detects
    the table)
25. `20261012120000_product_description_hidden.sql` (Admin → Products' "Show
    no description", see "The product editor"; with or after 14, before or
    after the frontend: the site feature-detects the column)
26. `20261012130000_catalog_fixups.sql` (data only; any time, best with or
    after the new frontend, whose Quick Reorder reads the old SKUs too)
27. `20261012140000_admin_import_create.sql` (Admin → Products' Import CSV
    adds the products a file describes; after 15, before or after the
    frontend, also on its own: the site feature-detects the function)

Then `supabase/seed/products.sql`, then the frontend, then 18.

| Migration | What it changes | Before and after |
| --- | --- | --- |
| `20261008190000_quote_tobacco_license.sql` | PR #12: `orders.license_no`, `resale_cert_no`, `purchasers_21`; a 16-argument `submit_quote` that refuses a guest's or unapproved account's tobacco or vape quote without a license, a resale certificate and 21+; drops the 13-argument one. | The frontend deployed before PR #12 calls the 13-argument function, so apply `20261009130000` in the same session (it brings that signature back as a wrapper). The new frontend works before and after (it falls back to the 13-argument call with the answers in the notes). |
| `20261008191000_profile_store_address.sql` | PR #12: `profiles.store_street`, `store_city`, `store_zip`; the signup trigger copies them. | Until applied, the application's store address stays in auth metadata; `20261009140000` moves it to the profile. |
| `20261008192000_profile_self_update_guard.sql` | PR #12: the `a_protect_profile_columns` trigger keeps a customer's verified columns in their own update. | No frontend change needed. `20261009140000` extends the same trigger. |
| `20261008193000_profile_approval_audit.sql` | PR #12: `approved_at`, `approved_by`, `verification_note`, `profile_status_log`, `profile_document_history`; only a pending applicant deletes proof. | Admin → Accounts shows '—' and can't save a note until it is applied. |
| `20261008194000_strip_signup_metadata.sql` | PR #12: the signup trigger strips EIN, license, resale certificate, phone and volume from auth metadata. | Only new signups; `20261009140000` strips older accounts. |
| `20261008195000_application_consent.sql` | PR #12: `terms_accepted_at`, `terms_version`, `age_confirmed_at`, copied at signup; the address and consent keys are stripped too. | Until applied, consent stays in auth metadata; `20261009140000` moves it for accounts made meanwhile. |
| `20261008200000_variant_prices_and_quote_workflow.sql` | PR #13 (Cursor, unchanged): `products.variant_prices` (per-variant list prices; moved and dropped by `20261009110000`); `orders.kind`, the statuses quoted … out_for_delivery, `quoted_at`, `quoted_by`; `order_items.original_qty`; the order-line trigger on INSERT only; `stamp_order_kind()`, `admin_price_order()`, `admin_convert_quote()` (both redefined by `20261009150000`). | Apply in the same session as `20261009100000`–`20261009150000`. On its own, `variant_prices` would be readable by guests like `price` still is, and every signed-in request would be stamped `order`. The new frontend works before and after (Admin → Orders feature-detects the `kind` column). |
| `20261009100000_price_boundary.sql` | `products.price` becomes nullable and unreadable to guests and signed-in accounts (column privileges; `variant_prices` isn't granted either); approved buyers' prices come from `my_prices()`, admins' from `admin_product_prices()`; the order trigger function rounds with `tier_unit_price()` (the trigger stays Cursor's INSERT-only one); `pricing_tiers` is readable by admins and approved buyers only; `profiles.pricing_tier` is a foreign key to `pricing_tiers`. The prices already stored are not changed. | Apply before the new seed (the seed has no price column). The frontend deployed before it reads `select=*`, which is now refused: it falls back to the catalog bundled with it, with a "couldn't load the latest catalog" notice, until the new frontend is deployed, so deploy right after. The new frontend also works before this migration (when `my_prices()` is missing it reads the prices the old way). |
| `20261009110000_variant_model.sql` | Adds `products.variant_axis` and `products.unavailable_variants` (readable by everyone), the private `product_variant_prices` table (taking over any values in Cursor's `products.variant_prices`, which is dropped) and `order_items.sell_unit`; recreates the order trigger (variant prices, unavailable variants refused with hint `variant_unavailable`, no variant kept on a product without variants, the sell unit saved with the line), `my_prices()` and `admin_product_prices()` (per-variant prices); drops `products.flavors`; fills the variant axis, the sell units the catalog states and 20 corrected descriptions on existing rows, only where nobody has set them (see "Variants, availability and sell units"). | Apply after `20261009100000` and before the new seed (the seed has `variant_axis` and no `flavors`). The frontend deployed before `20261009100000` is unaffected beyond what that migration already did. The new frontend also works before this migration: it reads the columns every database has, takes the axis and sell units from its bundled catalog, and treats every variant as available at its product's price. |
| `20261009120000_catalog_corrections.sql` | Data only: completes 86 SKUs (cut at 17 characters, a trailing hyphen, misspelled, or #329's bare `AW-RAW`), corrects the variant labels of 33 products (spelled-out sizes, fixed spellings, #62's merged flavor split, one-item non-choices removed, #60's profanity starred out), their descriptions, #354's name and #123/#124's sell unit, and aligns five names and brands with the packshot (#44, #98, #191, #192, #248; AW-286, PR #13); renames the matching `product_variant_prices` rows and `unavailable_variants` entries. Each row changes only while it still has the value the seed wrote, so admin edits are kept (see "Changing a SKU or a variant label"). | Apply after `20261009110000` and before the new seed. The new frontend also works before it (its aliases read the old codes and labels). Deploy the new frontend right after: the frontend deployed before it doesn't know the new labels, and a quote it sends with a renamed variant is refused ("Unknown variant"). Stored carts, Quick Reorder codes and order history keep working with the new frontend. |
| `20261009130000_submit_quote_v3.sql` | Recreates `submit_quote` without `p_ref_num` and with the license answers last (`p_license_no`, `p_resale_cert`, `p_purchasers_21`, with defaults): the server makes the reference (`ALW-Q-`/`ALW-O-` and 10 hex digits), checks lengths, email, ZIP, state, route state and date, throttles (new private table `quote_throttle`), refuses suspended accounts, needs an address only for delivery, and keeps PR #12's license rule and columns; every refusal has a typed hint. Turns PR #12's 16-argument function into a wrapper and brings back the 13-argument one as a wrapper; both ignore `p_ref_num` (see "Quotes and orders"). | Apply after `20261009120000`, before the new frontend. Frontends deployed before it keep working through the wrappers (their reference is ignored; a will-call quote sends the address they always required; the 13-argument call has no license answers, so its guest tobacco and vape quotes are refused, as `20261008190000` intends). The new frontend also works before it: it falls back to the 16-argument call, then the 13-argument one, with a long random reference and the warehouse address for will-call. **Later step:** drop the wrappers (below). |
| `20261009140000_profile_and_document_boundaries.sql` | `is_admin()` requires an approved admin; Cursor's self-update guard keeps every column but name, phone and store address in a customer's own update, and refuses an admin's change to their own role or status, the consent or approval records, or a made-up email; `profiles.email` follows the sign-in email (a trigger on `auth.users`, and existing rows are realigned); new table `profile_admin_notes` (internal notes, admins only) and an index for `profile_status_log`; accounts from before `20261008194000` get their metadata answers, store address and consent copied to the profile (`backfill_profiles_from_metadata()`, run once) and the keys stripped; license rows and files must sit at `{user id}/{type}/{file}`, with at most 10 uploads per account in 24 hours. | Apply after `20261009130000`, before the new frontend. Before running it, check with `select id, email, status from public.profiles where role = 'admin';` that every real admin is `approved`: the others lose admin rights. The frontend deployed before it keeps working (its admins must be approved). The new frontend also works before it: the store address and consent stay in auth metadata until this migration moves them, Admin → Accounts shows '—' for the missing columns, and the document paths it uploads already match the layout. Then run `supabase/seed/provision_owner.sql`'s admin list once. |
| `20261009150000_quote_workflow.sql` | One quote workflow (see "Pricing quotes and converting them"): `kind` is `order` only for an approved account's request, as `submit_quote` returns it (existing unpriced requests become quotes); `quoted_by` is set to null when that admin's profile is deleted; `admin_price_order()` and `admin_convert_quote()` check their input, keep an order's status, need every line priced before converting, and refuse guests (EXECUTE revoked from anon), with typed hints. | Apply after `20261009140000`, before the new frontend. The frontend deployed before it doesn't use these functions. The new frontend also works before it (and before `20261008200000`): Admin → Orders offers the old four statuses and says saving prices and converting need the update. |
| `20261010120000_admin_product_editor.sql` | The product editor (see "The product editor"): `products.id` defaults to the new `products_id_seq`; a SKU is unique whatever its case (`products_sku_upper_key`, skipped with a notice when duplicates exist); `NOT VALID` checks for a name and a brand and a list price of at most 99,999.99; `products.stock_status` (staff only) and `products.featured_rank` (homepage rank), readable like every column but price; a trigger that refuses to delete a product an order line refers to (hint `product_has_orders`); the public `product-images` bucket that only approved admins write to. | Apply after `20261009150000`, then re-apply the regenerated seed (its last statement moves the id sequence past the seeded ids). The frontend deployed before it doesn't read the new columns. The new frontend works before and after: without it, a new product gets the next free id from the editor, stock status, homepage rank and photo upload say they need the update, Delete checks for order lines in the editor only, and the homepage rails follow the tags without a rank. |
| `20261010121000_admin_bulk_products.sql` | Bulk product changes and tier discounts (see "Bulk changes and CSV" and "How pricing tiers work"): `admin_bulk_adjust_prices(p_ids, p_pct, p_amount, p_variants)` adjusts up to 1000 products' list prices (and their variants' own prices) by a percentage and/or an amount, rounded like `tier_unit_price()`, skipping prices on request, all or nothing (hints `price_out_of_range`, `invalid_input`); `admin_import_products(p_rows)` updates the products matched by SKU in the CSV columns given (name, brand, sell_unit, description, price, tag, active, stock_status, featured_rank), never creating one, all or nothing (hint `unknown_sku`); both are SECURITY DEFINER, check `is_admin()` (42501, hint `admin_only`) and are revoked from guests; `pricing_tiers_discount_range` (`NOT VALID`) keeps a discount from 0 to under 100. A commented Reverse block is at the end. | Apply after `20261010120000`. No seed change. The frontend deployed before it doesn't call these functions. The new frontend works before and after: without it, Adjust price and Import CSV say they need the update and turn themselves off, while Set price, Set tag, Activate, Deactivate, Export CSV and Admin → Pricing work as they are. |
| `20261010122000_order_operations.sql` | Admin → Orders' operations (see "Finding, printing and following orders"): `order_events` (status and assignment history, written by the `orders_log_change` trigger, admin read only), `order_admin_notes` (internal notes, admins only, 1–2000 characters, in their own name), `orders.assigned_to` (a profile id; the third foreign key from `orders` to `profiles`) with an index, an index on `orders.preferred_date`, `admin_set_order_status(p_order_id, p_status, p_note)` (admins only; a cancellation needs a reason; hints `reason_required`, `invalid_status`, `note_too_long`, `order_not_found`, `admin_only`), `admin_order_views` and `admin_mark_orders_seen()` (each admin's last visit to Orders), and `public.orders` in the `supabase_realtime` publication (skipped where it doesn't exist). Every new table and function is revoked from guests. A commented Reverse block is at the end. | Apply after `20261009150000` (in order after `20261010121000`). No seed change. The frontend deployed before it keeps working: its plain status updates are logged without a note. The new frontend works before and after: without it, status changes use the plain update, "Staff notes and history" says it needs the update, "Assigned to" is hidden, the New marker counts from the first visit in the tab, the header shows no count, and Orders reloads every minute. Realtime also needs `wss://<project-ref>.supabase.co` in the CSP's `connect-src`. |
| `20261010130000_catalog_apostrophes.sql` | Data only (AW-064): #163 and #166 get a straight apostrophe in their name and brand ("M&M's", "Reese's"), like every other possessive name in the catalog. Each row changes only while it still has the curly value the seed wrote, so admin edits are kept and a re-run changes nothing. | Apply any time, before or after the frontend: the storefront search treats ’ and ' alike, so both spellings are found before and after. Ids, SKUs and variant labels don't change. |
| `20261010131000_photo_filenames.sql` | Data only (AW-290): six products' `img` move to the renamed photo files (#21 `p21-speed-stick-mens-deodorant.jpg`, #110 `p110-brillo-basics-dish-liquid.png`, #128 `p128-fabuloso.avif`, #225 `p225-lady-speed-stick-deodorant.webp`, #280 `p280-coastal-motor-oil.jpg`, #292 `p292-electrolit.webp`). Each row changes only while it still names the old file the seed wrote, so a photo an admin has set is kept and a re-run changes nothing. | **Apply AFTER deploying the new frontend.** The frontend deployed before it ships only the old file names, so after this migration it would show "Photo coming soon" for these six products; the new frontend ships only the new files and reads both names (`IMAGE_FILE_ALIASES` in `src/data/catalogAliases.js`). Ids, SKUs and variant labels don't change. |
| `20261011110000_order_item_hints.sql` | AW-200: recreates the order-line trigger function `enforce_order_item_price()` from `20261009110000`, changing only its refusals: each keeps its message word for word and gets a typed hint (`order_missing`, `product_unavailable`, `invalid_quantity`, `variant_required`, `unknown_variant`; `variant_unavailable` had one) and, as its detail, the line's product id. Still SECURITY DEFINER, revoked from guests and signed-in accounts; Cursor's `order_items_price` trigger is unchanged. A commented Reverse block is at the end. | Apply any time after `20261009110000`. No seed change. The frontend deployed before it shows its generic "couldn't save" message for these refusals either way. The new frontend works before and after: before it, the checkout words these errors from the message text (and names the product only for "Choose a variant for …" and "Unknown variant for …"); after it, it names the product of the refused line from the detail. |
| `20261011111000_profile_role_audit.sql` | AW-203: `profile_status_log.old_role` and `new_role`; recreates the log trigger function `log_profile_status()` from `20261008193000` so it writes a row when the status or the role changes (`old_status`/`new_status` always, `old_role`/`new_role` only when the role changed, `changed_by` and the note as before). Still SECURITY DEFINER with `search_path = public`, revoked from guests and signed-in accounts; the `profile_status_log_write` trigger, the admin-only read policy and the own-role/status guard (`own_role_status`) are unchanged. A commented Reverse block is at the end. | Apply any time after `20261009140000`. No seed change. The frontend deployed before it doesn't read the new columns. The new frontend works before and after: the account page's Status history asks for the role columns and, without them (42703/PGRST204), shows status changes only; before it, role changes aren't in the history (each one's reason is in the account's internal notes either way). |
| `20261011130000_catalog_names.sql` | Data only (AW-071): one naming style, from each row's own data. Names: "Value" for "Cheap" (#100, #221, #246, #250), no retail price in #12's name ("LooseLeaf wraps 2-pack"), size words in brackets (#132, #133, #190, #290, #291, #335, #336, e.g. "Powerade (big)"), "Faygo bottles 20 oz" (#58), "6-pack beer carriers" (#93), "AA Cellular" (#286), and a product noun from the description for #25, #350 and #355 (#350's is undone by `20261012130000`, as it was #351's name, NEW-023); descriptions of #9, #221, #274, #310 and #311 spelled like their names. The lines under legal review keep their names (decision 2). Each column changes only while it still has the value the seed wrote, so admin edits are kept and a re-run changes nothing. | Apply any time, before or after the frontend: every frontend reads names from the database. Ids, SKUs (the AW-CHEAP-* Quick Reorder codes) and variant labels don't change; order lines keep the name they were placed with. |
| `20261011131000_home_slides.sql` | The home page's hero photos (see "The homepage"): the `home_slides` table (`img` a bundled `hero_*` file or a `product-images` Storage address, `alt` 1–200 characters, `go_cat`, `nicotine_warning`, `sort` 0–999, `active`, `created_at`, `updated_at`, `updated_by`), readable by everyone for active rows and by approved admins for all, written only by approved admins (RLS with `is_admin()`); the identity sequence and the trigger function are revoked from guests; today's four photos are added, in today's order, when the table is empty. Uploads use the existing `product-images` bucket; storage is unchanged. A commented Reverse block is at the end. | Apply any time, before or after the frontend. No seed change. The frontend deployed before it doesn't read the table. The new frontend works before and after: without it the home page shows the photos bundled with it (the request answers 404 / `PGRST205`) and Admin → Homepage shows those photos read-only with a note that editing needs the update; the rails work either way. |
| `20261012100000_document_storage_lock.sql` | AW-197, AW-347: drops `application_documents_owner_update`, so no account (pending, approved or suspended) can overwrite or rename a stored licence or resale file, and admins never could; uploads still add new files at `{user id}/{type}/{upload time}-{file}` (renewals included) and the `profile_documents` row upsert keeps the replaced path in `profile_document_history`. The `application-documents` bucket's `allowed_mime_types` becomes PDF, JPEG and PNG (no HEIC/HEIF). Deleting, reading, the layout and the upload cap are unchanged. A commented Reverse block is at the end. | Apply any time, before or after the frontend. No seed change. The new frontend uploads with upsert off and never updates an object, so it works before and after. A frontend built before it uploads with upsert on to a new path each time, which needs only the insert policy, so it keeps working too. HEIC files already stored keep their type and still open; an upload of a new one is refused. |
| `20261012110000_carts.sql` | AW-334 (see "Saved carts"): the `carts` table, one row per account (`user_id` references `auth.users`, deleted with it; `lines` is a JSON list of `[line key, quantity]` pairs in the order they were added, at most 500, quantities 1 to 100,000, checked by `cart_lines_valid()`, so no price or other value fits; `updated_at`). Row-level security: each signed-in account reads, adds, changes and deletes its own row only; guests have no privileges at all; admins see no one's cart. A commented Reverse block is at the end. | Apply any time, before or after the frontend, also on its own. No seed change. The frontend deployed before it doesn't read the table. The new frontend works before and after: before it, its one read finds the table missing (404 / `PGRST205`), it stops trying for that page view, carts stay on each device, and the drawer and checkout say so; after it, a signed-in account's cart is saved with the account and the drawer and checkout say "Saved with your account". |
| `20261012120000_product_description_hidden.sql` | AW-023 (see "The product editor"): `products.description_hidden` (boolean, not null, default false), readable by guests and signed-in accounts like every products column but price; only approved admins change it (`products_admin_write`). When it is true the product page shows no description at all, instead of the bundled description a blank one falls back to; the stored text is kept. A commented Reverse block is at the end. | Apply with or after `20261010120000`, before or after the frontend. No seed change (the seed leaves the column out, so every row keeps the default). The frontend deployed before it doesn't read the column. The new frontend works before and after: the storefront asks for it together with `featured_rank` and, on a database without it (42703), reads the catalog without both (so with `20261010120000` applied and this one not, the homepage rails follow the tags without a rank); Admin → Products offers "Show no description" only once its load sees the column. |
| `20261012130000_catalog_fixups.sql` | Data only. SKUs (AW-135): four completed, each with an alias from its old code in `src/data/catalogAliases.js`: #83 `AW-DUTCH-MASTERS` (was `AW-DUTCH-MASTER`), #90 `AW-T-SHIRT-BAGS` (was `AW-BAGS`), #121 `AW-PLASTIC-CUTLERY` (was `AW-PLASTIC`) and #143 `AW-REDBULL-12OZ` (was `AW-RED-BULL-12OZ`, now written like #144–#146). Names: #65 "RAZ Vue full kit" (AW-071, and its description), and #350 "Uncle Al's" again, as `20261011130000` had given it #351's name (NEW-023). Descriptions (AW-075): the brand spelled as the row's brand and name spell it in #13, #183, #193, #213 and #260; a blank description isn't matched. Sell units (AW-136): `single` for #16 and #340, which are sold as singles (only while `sell_unit` is ''). Each column changes only while it still has the value the seed wrote, and a SKU only while no other product has the new code (any case), so admin edits are kept and a re-run changes nothing. A commented Reverse block is at the end. | Apply any time, also on its own; best with or after the new frontend. The new frontend reads both codes, so Quick Reorder, stored carts and Reorder from order history work before and after; the frontend deployed before it knows only the codes in the database. Order lines keep the code and name they were placed with. Every frontend reads names, descriptions and sell units from the database; the new one already shows the bundled `single` while the database's is ''. |
| `20261012140000_admin_import_create.sql` | Admin → Products' Import CSV can add products (AW-114): `admin_import_products_v2(p_rows)` updates the products whose SKU a row names exactly as `admin_import_products()` does (cat and sub are not changed), and inserts a row whose SKU no product has when it has a name, a brand, a department some product already has and a sub-line, with a SKU of 2 to 41 capital letters, digits and hyphens, a price of 0 to 99,999.99 or null, a tag from the four and variants (if any) as a list of names; the id comes from `products_id_seq`, there is no photo, and it is inactive unless the row says `"active": true`. Otherwise an unknown SKU refuses the file (hint `unknown_sku`), as does a SKU listed twice (hint `duplicate_sku`) or a bad value (`invalid_input`, or the table's checks). Up to 1000 rows, all or nothing; returns `{ updated, created }`. SECURITY DEFINER, `is_admin()` first (42501, hint `admin_only`), revoked from guests. `admin_import_products()` stays. A commented Reverse block is at the end. | Apply after `20261010121000`, before or after the frontend, also on its own. The frontend deployed before it calls only `admin_import_products()`. The new frontend calls v2 and, without it (PGRST202/42883), imports the updates through `admin_import_products()` and lists the new rows as not imported ("Creating products from a file needs the October 2026 database update."). |

### Later steps

- **Drop the old `submit_quote` signatures** (after
  `20261009130000_submit_quote_v3.sql`). Once the frontend that calls the
  current signature has been live for a few days, so no open tab still runs
  an older one, run in the SQL editor:

  ```sql
  drop function if exists public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb);
  drop function if exists public.submit_quote(text, text, text, text, text, text, date, text, text, text, text, text, jsonb, text, text, boolean);
  ```

  In the same change, the frontend's fallbacks to those signatures
  (`licensedQuoteParams`, `legacyQuoteParams` and the signature chain in
  `submitOrder`, `src/lib/orders.js`) can go.

- **Turn on Secure password change** (any time; AW-349). Under
  **Authentication → Sign In / Providers → Email**. No migration and no
  frontend change: `/reset-password` already changes passwords only from a
  fresh session (see "Password changes").
