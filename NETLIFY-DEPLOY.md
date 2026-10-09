# Netlify deploy notes

The site deploys only from Git. Netlify installs and builds every push itself,
so each deploy runs the environment check and the image and site build, and
every deploy maps to a commit.

<!-- TODO(owner): Which cookieless analytics, error reporting and uptime monitor should the site use? None is added; adding one also changes the CSP in netlify.toml and the privacy policy's processor list. (AW-210) -->

## Site settings

Link the Netlify site to the GitHub repository (**Site configuration → Build &
deploy → Continuous deployment**):

- Production branch: `main`
- Base directory: leave blank (the files are at the repo root)
- Build command: `npm run build` (also set in `netlify.toml`)
- Publish directory: `dist` (also set in `netlify.toml`)
- Node version: from `netlify.toml` (`NODE_VERSION = "24"`, the same major as
  `.nvmrc`). `.nvmrc` and `NODE_VERSION = "24"` pin Node 24 LTS (supported to
  April 2028); `.npmrc` sets `engine-strict`, so an install on the wrong Node
  version fails instead of warning.

`netlify.toml` also sets `NPM_FLAGS = "--no-fund"` (npm audit stays on) and the
rewrites the single-page app needs ("Page paths and 404s" below). `npm run
build` also writes `dist/sitemap.xml` from the catalog; `public/robots.txt`
points at it.

Optional: `VITE_SITE_URL` sets the public origin used for canonical links,
share tags and the sitemap. It defaults to `https://alabamawholesaleinc.com`;
set it only if the site moves to another domain.

## Page paths and 404s

Every page has a path URL (`/product/12`, `/category/tobacco`, `/contact`),
and loading or reloading one must serve `index.html`, which starts the app.
`netlify.toml`'s `[[redirects]]` do this in three groups, in this order
(NEW-088):

1. A missing file under `/assets` or `/img` gets `public/404.html` with
   status 404 ("Headers and caching").
2. Each page path of the app gets `index.html` with status 200: `/`,
   `/index.html`, `/catalog`, `/category/*`, `/product/*`, `/search`,
   `/quote`, `/account`, `/admin`, `/admin/*`, `/contact`, `/delivery`,
   `/shipping`, `/privacy`, `/terms`, `/apply` and `/reset-password`.
3. Last, `/*` gets `index.html` with status **404**. The visitor still sees
   the app's "Page not found" page, with a search box and the departments,
   but a mistyped or retired link is a real 404 for search engines, link
   checkers and Search Console instead of a page that only says so.

Netlify serves a file that exists in the deploy before any of these rules
(none is forced), and matches a path with or without a trailing slash alike.
Its documentation calls rule paths case-sensitive, so `/CONTACT` is a 404
that still shows the contact page (the app reads page names in any case);
nothing links to such a spelling, as the old `#/` links all load `/`.

A new page path needs its rule in group 2. Without it the page still works
for visitors but is a 404 for crawlers: `scripts/netlify-redirects.test.mjs`
fails until the rule is there (it walks `PATH_SECTIONS` in
`src/lib/routes.js`). `npm run preview` and the Playwright smoke tests answer
with the same statuses (`aw-preview-redirects` in `vite.config.js`).

## Build cache for photos

`npm run build` first renders every product and hero photo (about 2,000
files) and the brand files from the originals in `src/assets/` (README,
"Images"). They are not in Git, so a plain Netlify build would render them all
on every deploy. The local build plugin `netlify/plugins/image-cache`,
registered in `netlify.toml` under `[[plugins]]`, restores the previous
deploy's `public/img`, `src/assets/generated` and brand files before the
build and saves them after it. The script then renders only photos whose
content hash is new. The plugin is part of the repository and needs no
install or setting in the Netlify UI.

If a deploy ever looks wrong because of the cache, use **Deploys → Trigger
deploy → Clear cache and deploy site**: everything is rendered again (about a
minute). `.github/workflows/ci.yml` caches the same paths for CI.

## Headers and caching

`netlify.toml` sets the response headers (AW-205, AW-182), with a comment
next to each one. On every path (`/*`):

- **Content-Security-Policy** says where a page may load things from.
  Scripts, styles, fonts and the manifest come only from the site itself.
  Images and network requests may also go to Supabase (`https://*.supabase.co`
  and, for Realtime, `wss://*.supabase.co`), which covers the live project,
  a deploy-preview project and Storage photo URLs. The policy also blocks
  plugins (`object-src 'none'`), framing by other sites
  (`frame-ancestors 'none'`), a rewritten `<base>`, and forms that post
  elsewhere. Inline scripts are refused except the one in `index.html`, which
  is allowed by its sha256 hash. Inline styles are allowed, for the
  boot-shell `<style>` blocks in `index.html`.
- **X-Frame-Options: DENY**: the older way to refuse framing, for browsers
  that predate `frame-ancestors`.
- **X-Content-Type-Options: nosniff**: browsers use each file only as the
  type Netlify sends.
- **Referrer-Policy: strict-origin-when-cross-origin**: other sites see only
  the site's origin, never the page path or query.
- **Permissions-Policy**: turns off camera, microphone, location, payment and
  USB, which the site doesn't use.
- **Strict-Transport-Security: max-age=31536000**: after one visit, browsers
  reach this host only over HTTPS for a year. `includeSubDomains` and
  `preload` wait for the owner (docs/OWNER-TODO.md, AW-205).
- No `Cache-Control`. `index.html`, which is served for every page path,
  keeps Netlify's default (`max-age=0, must-revalidate`), so visitors get a
  new deploy at once.

Caching:

- `/assets/*` (Vite's content-hashed JS, CSS, fonts and logo): `public,
  max-age=31536000, immutable`. A changed file always gets a new name, so
  browsers keep these for a year without asking again.
- `/img/*` (the product and hero photo renditions from
  `scripts/build-images.mjs`): the same, for the same reason. Each name
  carries a hash of the photo and its render settings.
- The brand files at fixed names (`/favicon.ico`, `/favicon-32.png`,
  `/apple-touch-icon.png`, `/icon-192.png`, `/icon-512.png`, `/og.jpg`):
  `public, max-age=604800` (a week), so a new logo still reaches visitors.
- Everything else (`robots.txt`, `sitemap.xml`, `site.webmanifest`) keeps the
  Netlify default.
- A file under `/assets/*` or `/img/*` that isn't in the deploy gets a real
  404 (`public/404.html`, a static page with no script) instead of
  `index.html`. Two `[[redirects]]` rules above the page rewrites do this.
  They aren't forced, and Netlify serves a file that exists before any rule,
  so they only answer for missing files. This matters after a deploy: the
  account, admin, quote and support pages and the sign-in dialog are separate
  code files that load when first opened (AW-179), and a tab still open on the
  last version asks for their old names. With a 404 the page says it didn't
  load and offers Reload; `index.html` sent under that name would fail as a
  script and, under the `/assets/*` rule above, be kept for a year. Keep both
  rules first: `scripts/netlify-headers.test.mjs` checks the order.

When you change something:

- **The `index.html` boot script.** Any edit, even to whitespace, changes its
  hash, and the policy then blocks the script. `npm test`
  (`scripts/netlify-headers.test.mjs`) and `npm run build`
  (`scripts/check-headers.mjs`, after `vite build`) fail and print the new
  `'sha256-…'` value: put it in `script-src` in place of the old one. A
  second inline script needs its own hash. The build refuses script
  `'unsafe-inline'` and `'unsafe-eval'`.
- **A third-party host** (analytics, error reporting, a CAPTCHA, an image
  CDN): add it to the matching directive in the same change that adds the
  script or request, and add the service to the privacy policy's list of
  processors in that change too (AW-210). The unit test lists the off-site
  hosts the policy allows, so it fails until it is updated on purpose.
- **A frame**: there is no `frame-src`, so the site can frame only itself.
  Admin opens signed document links in a new tab.
- **Netlify features that inject scripts** are blocked by the policy:
  snippet injection, analytics or other scripts added in the Netlify UI, and
  the deploy-preview collaboration drawer. Leave them off, or add their hosts
  as above.

Before promoting a deploy preview, open it with the browser console showing
and click through home, a category, a product, the cart, the quote page,
sign-in, Apply and (signed in as an admin) Admin. A
"Content-Security-Policy" or "Refused to load" error means the policy is
missing a source: fix it before promoting the deploy.

Locally, `npm run preview` (and the Playwright smoke run, `npm run test:e2e`)
sends the same `/*` headers, read from `netlify.toml` by
`scripts/netlify-headers.mjs`, so a CSP violation shows up there first and
fails the smoke tests. The caching rules are Netlify-only. The dev server
(`npm run dev`) sends none of these headers, because React Refresh needs
inline scripts.

## Environment variables, migrations and releases

The build fails unless `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
in the Netlify environment (scope "All", so deploy previews get them too).
Until there is a separate project for previews (owner question AW-213 in
`docs/OWNER-TODO.md`), deploy previews and branch deploys use the production
database: an application or quote sent from a preview is real.
[BACKEND.md](BACKEND.md) covers the variables and the Supabase auth URL
settings (section 4), the database migrations (section 2), the first-run
sanity check (section 5) and the release checklist: database changes go in
before the frontend that uses them, after a dump.

### Rolling back a deploy

**Deploys → an older deploy → Publish deploy** puts an earlier build back
live, but only a build at or after the latest migration applied to the live
database is safe to publish: one built from the commit that added
that migration (`supabase/migrations/<timestamp>_….sql`) or a later commit.
An older build can depend on what a later migration changed or removed (a
build from before `20260925120000` inserts orders directly, which that
migration forbids, so every quote would fail). Each deploy's page names its
commit; compare it with the newest migration the project has (`supabase
migration list`, or BACKEND.md's release checklist).

Publishing an older deploy never changes the database. Rolling the database
back means running that migration's commented Reverse SQL (at the end of
every file from `20261009100000` on) or restoring the dump taken before it
(BACKEND.md, "Release checklist", step 2, and "Rolling back"); the dump also
undoes every order and application made since.

## Netlify Forms

The site uses no Netlify Forms: quotes go to Supabase's `submit_quote`
function and applications to Supabase Auth. If the Netlify dashboard (**Forms**)
still lists `apply`, `quote` or `newsletter` forms from earlier deploys, delete
them and turn off form detection so nothing can post to them.

## Do not drag and drop `dist/`

Do not drag-and-drop `dist/` (or a ZIP of it) onto Netlify: it bypasses the
build, the environment check and version tracking, and a local `dist/` is
easily stale or built without the backend settings.

To look at a production build locally instead, rebuild it first:

```bash
rm -rf dist
npm run build
npm run preview
```
