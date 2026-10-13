# Going live: setup steps

Everything needed to put the new site online, in order. It takes about an
hour, plus waiting for the domain to switch over. Have your logins ready
for GitHub, Supabase, Netlify, your domain registrar (for example Hostinger)
and the two Gmail inboxes.

Do parts A and B in one sitting: A updates the database, B puts the new
site on it.

## Before you start: put the finished work on `main`

Netlify publishes the `main` branch; the finished site is in
`fix/site-review-2026-09-28`. Skip this if your developer has merged it.

1. Open <https://github.com/mshlmn8/Alabamawholesaleinc.com>.
2. Click **Pull requests** → **New pull request**.
3. Set **base** to `main` and **compare** to `fix/site-review-2026-09-28`.
4. Click **Create pull request**, then **Create pull request** again.
5. When the checks are green, click **Merge pull request** → **Confirm merge**.

## A. Supabase (the database)

Open <https://supabase.com/dashboard> and click the site's project.

1. **Back up.** On the Pro plan, open **Database → Backups** and check
   there is a backup from today. On any plan, also open **Table Editor**
   and, for each of `products`, `profiles`, `orders`, `order_items` and
   `pricing_tiers`, click the **⋯** next to the table name → **Export data**
   → **Export table as CSV**. Keep these files private: they hold your
   customers' details and your prices.
2. **Update the database.**
   1. On GitHub, open
      [`supabase/release/apply-to-live-database.sql`](supabase/release/apply-to-live-database.sql)
      on the `main` branch and click **Copy raw file** (the two squares at
      the top right of the file). If you don't see it, click **Raw**, then
      press Cmd+A and Cmd+C (Ctrl+A and Ctrl+C on Windows).
   2. In Supabase, click **SQL Editor** in the left bar, then **+** →
      **Create a new snippet**.
   3. Paste (Cmd+V or Ctrl+V) and click **Run**.
   4. Supabase warns that the query "includes destructive operations".
      That is expected: the file replaces old rules and removes two columns
      the site no longer uses; it deletes no customer, order or product.
      Click **Run query**.
   5. After a few seconds the result at the bottom says **Done: the live
      database has every update in this file.**

   It runs as one unit: if it stops with an error, nothing was changed.
   Copy the error and send it to your developer. If the error says the
   database **already has some or all of these updates**, this step was
   done before; go on to step 3.
3. **Check the storage buckets.** Click **Storage**. There are two:
   `application-documents` (private: the licence files) and
   `product-images` (public: the photos you upload in Admin).
4. **Let Supabase send email.** Supabase's built-in email only reaches your
   own Supabase team, so customers would never get their "confirm your
   email" and "reset your password" emails. Send them from your Gmail:
   1. In the Google account of **Alabamawholesaleinc@gmail.com** (the email
      the site shows customers), turn on **2-Step Verification** (Google
      Account → **Security**), then open
      <https://myaccount.google.com/apppasswords>, create an app password
      named `Supabase` and copy its 16 letters.
   2. In Supabase: **Authentication → Emails → SMTP Settings**. Turn on
      **Enable custom SMTP** and fill in: **Sender email address**
      `Alabamawholesaleinc@gmail.com`, **Sender name** `Alabama Wholesale`,
      **Host** `smtp.gmail.com`, **Port number** `465`, **Username**
      `Alabamawholesaleinc@gmail.com`, **Password** the 16 letters (no
      spaces). Click **Save**.
   3. Recommended: **Authentication → Sign In / Providers → Email**, turn on
      **Secure password change**, **Save**.
5. **Tell Supabase the site's address.** **Authentication → URL
   Configuration**:
   - **Site URL**: `https://alabama-wholesale.com` → **Save**.
   - **Redirect URLs** → **Add URL**, once for each of
     `https://alabama-wholesale.com/` and
     `https://alabama-wholesale.com/reset-password`.
   - After part B, add your Netlify address the same way (for example
     `https://alabama-wholesale.netlify.app/` and
     `https://alabama-wholesale.netlify.app/reset-password`), so sign-up
     works there before the domain does.
6. **Make yourself the admin.**
   1. No account on the site yet? **Authentication → Users → Add user →
      Create new user**, enter your email and a strong password, tick
      **Auto confirm user?** and click **Create user**. (Already signed up
      on the site with your email? Skip this.)
   2. **SQL Editor**, **+** → **Create a new snippet**. Paste
      [`supabase/seed/provision_owner.sql`](supabase/seed/provision_owner.sql)
      (copy it from GitHub as in step 2), replace
      `REPLACE_WITH_OWNER_EMAIL` with your email, and click **Run**.
   3. The result lists every admin account. It should show only you (and
      anyone you made admin on purpose).

## B. Netlify (the website)

Open <https://app.netlify.com>.

1. Click **Add new project** (older screens: **Add new site**) → **Import an
   existing project** → **GitHub**, let Netlify see your repositories, and
   pick **mshlmn8/Alabamawholesaleinc.com**. If Netlify already has a
   project for this site, open it instead: **Project configuration → Build
   & deploy → Link repository**.
2. Check the build settings (Netlify reads them from `netlify.toml`):
   **Branch to deploy** `main`, **Base directory** empty, **Build command**
   `npm run build`, **Publish directory** `dist`.
3. Click **Add environment variables** (after the import: **Project
   configuration → Environment variables → Add a variable**) and add these
   two, with the same value for every deploy context:
   - `VITE_SUPABASE_URL`: in Supabase, **Project Settings → Data API** (or
     **API**), the **Project URL** (`https://….supabase.co`).
   - `VITE_SUPABASE_ANON_KEY`: in Supabase, **Project Settings → API
     Keys**, the **anon public** key (on newer screens under **Legacy API
     Keys**; it starts with `eyJ`). Never use the `service_role` or secret
     key.

   A third, `VITE_SITE_URL`, is only for a domain other than
   `alabama-wholesale.com`: set it to `https://` and that domain.
4. Click **Deploy**. The first build takes a few minutes. If it fails with
   "the Supabase settings are missing or invalid", fix the two values, then
   **Deploys → Trigger deploy → Deploy project**.
5. The site is now at an address like `https://<name>.netlify.app` (rename
   it in **Project configuration → General → Change project name**). Add
   that address to Supabase's Redirect URLs (part A, step 5).
6. **Order emails.** Each order is emailed to **alwholesaleorders@gmail.com**:
   1. **Forms** → **Enable form detection**. Then **Deploys → Trigger
      deploy → Deploy project**, so Netlify finds the order form. **Forms**
      then lists `order-notification`.
   2. **Project configuration → Notifications → Emails and webhooks → Form
      submission notifications → Add notification → Email notification**
      (older screens: **Forms → Form notifications**). **Email to notify**:
      `alwholesaleorders@gmail.com`; **Form**: `order-notification`. **Save**.
   3. If **Forms** lists old `apply`, `quote` or `newsletter` forms, delete
      them; nothing uses them.

   The free plan includes a limited number of form submissions a month
   (100 on the older Starter plan; newer plans use credits; see Netlify's
   pricing page). Past the limit the emails stop until the next month, but
   **every order is still saved in Admin → Orders**.

## C. The domain

1. The domain `alabama-wholesale.com` is in your GoDaddy account (Domain
   Portfolio). Keep auto-renew on.
2. In Netlify: **Domain management** → **Add a domain** → **Add a domain
   you already own**, type `alabama-wholesale.com`, **Verify**, **Add
   domain**. Netlify also adds `www.alabama-wholesale.com` and sends it
   to the main name, then shows the DNS records it needs.
3. At GoDaddy: **Domain Portfolio** → `alabama-wholesale.com` → **DNS**:
   - Change the **A** record named `@` so it points to `75.2.60.5`, and
     delete any other **A** or **AAAA** record named `@`.
   - Change the **CNAME** record named `www` so it points to your Netlify
     address (`<name>.netlify.app`).
   - Leave every other record alone, above all the **MX** and **TXT**
     records: they run the domain's Microsoft 365 email. If Netlify's
     domain page shows different values, use Netlify's.
4. Wait until Netlify no longer shows "Awaiting External DNS" (minutes to a
   few hours). Netlify then turns on HTTPS by itself; if **HTTPS** still
   says it is waiting, click **Verify DNS configuration**. Open
   <https://alabama-wholesale.com> to check.

## D. First checks after launch

1. Open the site, click **Yes, I am 21+**, click **Sign in** and sign in
   with your email. The header shows **Admin** (on a phone, under
   **Menu**). Admin's front page has a **How to use Admin** panel with the
   everyday jobs.
2. **A staff test account.** In a private (incognito) window, open the
   site, click **Apply for a trade account** and apply with a second email
   you can read (for example `alwholesaleorders+test@gmail.com`, which arrives in
   the alwholesaleorders inbox). Click the link in the confirmation email: that
   proves Supabase's email works.
3. **Approve an account.** In your own window: **Admin → Accounts**, find
   the test application, click **Details** to see its answers, then
   **Approve**. Then click **All**, find it again, set its **Role** to
   **Staff**, type a reason ("Test account") and click **Make staff**.
4. **Place a test order.** In the private window, reload, add a product,
   click **Order** (top right) → **Checkout**, fill in the form and click
   **Place order**. The page shows a reference like `ALW-O-…`.
5. **Check the email.** Within a few minutes **alwholesaleorders@gmail.com** gets
   "New order ALW-O-… from …". The first time, look in Spam and mark it
   **Not spam**. The order is also in **Admin → Orders**.
6. **Cancel the test order.** **Admin → Orders**, set its status to
   **Cancelled**, give a reason, click **Cancel the order**.
7. **Change a photo.** **Admin → Products**, search for a product, click
   **Edit**, under **Photo** choose **Upload a photo** (JPEG, PNG or WebP,
   up to 5 MB), click **Save product**, and open the product's page to see
   it. The home page's photos are in **Admin → Homepage**.
8. When you're done, set the test account's **Role** back to **Customer**,
   give a reason and click **Remove staff access**.

**Prices.** Approved customers see the list prices in the database, which
are still the placeholders from the first version of the site. Load your
real prices in **Admin → Products** (one at a time, or **Export CSV**, fill
in the `price` column, **Import CSV**) before you approve real customers.
[BACKEND.md](BACKEND.md), "Loading your list prices", has the details.

Other open questions, none needed to go live, are in
[docs/OWNER-TODO.md](docs/OWNER-TODO.md). The technical details behind
these steps are in [BACKEND.md](BACKEND.md) (database) and
[NETLIFY-DEPLOY.md](NETLIFY-DEPLOY.md) (hosting).
