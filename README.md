# Alabama Wholesale Inc

Editorial wholesale storefront for licensed retailers. 368 SKUs across 8 departments — tobacco, novelties, merchandise, candies, food stuff, grocery, motor oil, drinks & bags — shipping from Birmingham.

Every page uses the 2A editorial system: Barlow Condensed and DM Sans (bundled in `src/fonts/`), purple / cream / orange, and plain CSS in `src/index.css`. Home, catalog, product, quote, cart, the sign-in dialog, the support pages, account (`/account`) and admin (`/admin`) all share it, with no CSS framework.

## Pages

Every page has a real path URL (History API router, `src/lib/router.js` and `src/lib/routes.js`). Netlify serves `index.html` for every page path (`netlify.toml`), and any other path with status 404 (NETLIFY-DEPLOY.md, "Page paths and 404s"); old `#/…` links redirect to their path.

| Route | Page |
| ----- | ---- |
| `/` | Home — split hero with a photo carousel, services, shop by department, new arrivals (`/#new-arrivals`), bestsellers (`/#bestsellers`), collections, and the steps to open a trade account |
| `/catalog` | All products: every department, product line and SKU |
| `/category/<department>[/<line>]` | Department catalog, optionally one product line, e.g. `/category/drinks-and-bags/energy-drinks`. Search, sort and filters live in the query string (`?q=&sort=&tags=&variants=1`) |
| `/product/<id>` | Product detail |
| `/search?q=` | Search results for name, brand, department, SKU and variants (marked `noindex`) |
| `/quote` | Checkout: an order from an approved trade account, or a quote request from a guest or an account still waiting for approval (the words come from `basketTerms()` in `src/data/terms.js`) |
| `/account` | Trade account and order history |
| `/admin`, `/admin/orders`, `/admin/accounts`, `/admin/products`, `/admin/pricing` | Admin back office: orders (`/admin/orders/<id>/print` for the pick list or packing slip), accounts (`/admin/accounts/<id>`), products (`/admin/products/<id>`, `/admin/products/new`) and pricing tiers. Filters that name no person live in the query string (`src/lib/adminRoutes.js`) |
| `/contact`, `/delivery`, `/shipping`, `/privacy`, `/terms`, `/apply`, `/reset-password` | Support pages |

Any other address shows a not-found page with a catalog search and the departments (marked `noindex`), served with status 404 when no page has that path (NEW-088). Department and line segments are slugs of the catalog names; other spellings (`/category/TOBACCO`) redirect to the canonical one. `npm run build` also writes `dist/sitemap.xml` and `dist/robots.txt` from the catalog the build reads (the live products table, else the bundled copy; `scripts/build-sitemap.mjs`, `scripts/catalog-source.mjs`), and a page file for every catalog and support page with that page's own title, description, canonical link and share tags, for crawlers and link previews that run no script (`scripts/build-route-heads.mjs`). Catalog changes made in Admin reach them with the next deploy (NETLIFY-DEPLOY.md, "Pages and the catalog").

Also on the storefront:

- 21+ age gate over the page (the page stays crawlable underneath), remembered in `localStorage` for a set period and cleared on sign-out (`src/lib/ageGate.js`; the period is an owner question, see `docs/OWNER-TODO.md`)
- Header search across name, brand, department, SKU, and variants
- Category menu for the eight departments
- Cart drawer. The cart is kept in `localStorage`, one per account on the device plus one for guests, and stays in step across open tabs; signing in adds the guest cart to the account's, and signing out leaves the next person an empty cart. Lines the catalog no longer has are flagged instead of dropped, and carts from earlier builds are moved over once (`src/lib/cartStorage.js`). Escape closes the cart, sign-in, and help overlays and unlocks page scrolling
- The catalog is read from Supabase's `products` table (`src/lib/catalog.jsx`). The copy built into the site shows first and is the fallback: a slow or failed load says so and offers **Try again**, a product only the live catalog has shows a loading view instead of "not found", open tabs load it again after five minutes away or when the connection comes back, and checkout checks it once more before sending
- Quote requests and orders are saved by the `submit_quote` function in Supabase, which prices the lines on the server. While the form is being filled in, a draft is kept in `sessionStorage` for that tab, so leaving `/quote` or a reload keeps what was typed; it is cleared on a successful submit and on sign-out (`src/lib/quoteDraft.js`). If saving fails, the quote page shows an error with the trade desk's phone number and email; there is no other fallback. After a save, the lines that were sent leave the cart and the page shows a printable receipt (reference, lines, delivery details). It is kept in `sessionStorage` for that tab only, so a reload or Back shows it again, and it is cleared on sign-out (`src/lib/receipt.js`)
- Trade sign-in and account applications through Supabase Auth. One provider (`src/lib/auth.jsx`) holds the session and profile; account pages wait for them instead of flashing a signed-out view, and email links are handled by `src/lib/authLink.js` (see BACKEND.md, "Email links"). Changing the password while signed in asks for the current password first and then signs the account out on its other devices (BACKEND.md, "Password changes (AW-349)")

Trade prices are kept only in Supabase: the site's code and the product seed carry none. Approved accounts see their tier's prices, which the `my_prices()` database function works out; guests, pending and suspended accounts get no prices. The public API stops serving the price column once `supabase/migrations/20261009100000_price_boundary.sql` is applied (see BACKEND.md, "How pricing tiers work" and "Release checklist").

## Run locally

You need **Node.js 24** (the version in `.nvmrc`, which the Netlify build and CI also use; `nvm use` picks it up). `.npmrc` sets `engine-strict`, so npm refuses to install on an unsupported Node version. From this folder:

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Checks

| Command | What it runs |
| ------- | ------------ |
| `npm run lint` | ESLint (flat config in `eslint.config.js`: React, React Hooks, jsx-a11y and the project rule `aw/translate-safe-text`); warnings fail it |
| `npm test` | Vitest unit and component tests (`src/**/*.test.{js,jsx}`, `scripts/**/*.test.mjs`, jsdom) |
| `npm run test:db` | Replays `supabase/migrations` and the seed in an in-memory Postgres (PGlite) and runs the assertions in `supabase/tests/*.sql` |
| `npm run test:e2e` | Builds the site and runs the Playwright smoke test in `tests/smoke` against `vite preview` (run `npx playwright install chromium` once first) |

GitHub Actions (`.github/workflows/ci.yml`) runs all four, plus `npm audit --omit=dev --audit-level=high` (and a non-blocking `npm audit --audit-level=high` that also covers the build and test tools) and a check that the production build refuses to run without the Supabase settings. Dependabot (`.github/dependabot.yml`) opens weekly update PRs.

### Planned toolchain upgrades

The build runs on Vite 7 with `@vitejs/plugin-react` 5 and React 18. Two upgrades are planned as their own changes (AW-211), not bundled into a Dependabot PR:

- **Vite 8 with `@vitejs/plugin-react` 6.** Vite 8 bundles with Rolldown instead of Rollup, so check that the `manualChunks` split in `vite.config.js` still produces the separate `vendor` and `supabase` chunks and that the pages App.jsx loads with `React.lazy` are still files of their own (AW-179; the build fails when `scripts/chunk-urls.mjs` can't find one, since `src/lib/chunks.js` fetches them ahead into the cache, NEW-006), then run the full checks above.
- **React 19, after launch.** Plan it with the ESLint plugins: `eslint-plugin-react` and `eslint-plugin-jsx-a11y` do not declare ESLint 10 support yet, so ESLint stays on 9 for now.

### Supported browsers

The site supports the browsers `build.target` in `vite.config.js` names: Safari 14, Chrome 87, Edge 88 and Firefox 78, and anything newer. esbuild rewrites newer syntax for them, but not newer built-in functions, so `npm run lint` refuses `Array.prototype.at`, `findLast`, `toSorted` and the like, `Object.hasOwn`, `structuredClone`, `AbortSignal.timeout` and `new Intl.ListFormat` in `src/`, and `scripts/check-compat.mjs` checks the built files after `vite build` (NEW-019). In CSS, give a `dvh` height a `vh` line just before it, and keep `:has()` selectors in rules of their own: a browser that can't read one selector drops the whole list (`src/styles.test.js` checks both). To drop an old browser, raise `build.target` and this list together.

### Text that Google Translate can break

Translated pages replace React's text nodes, so a string that can change, appear or disappear must be the only child of an element that is always rendered: build one template string (`` {`Showing ${n} of ${total} items`} ``) or give the changing part its own `<span>`. `npm run lint` enforces this with `aw/translate-safe-text` (`scripts/eslint/translate-safe-text.mjs`), and `src/lib/domGuard.js` keeps a missed spot from blanking the page.

## Build for production

```bash
npm run build
```

Output goes to `dist/`; `npm run preview` serves it locally, with the security headers and Content-Security-Policy from `netlify.toml` (NETLIFY-DEPLOY.md, "Headers and caching"). The build also fails when that policy would block an inline script in `dist/index.html` (`scripts/check-headers.mjs`), when the built JavaScript calls a built-in function the supported browsers lack (`scripts/check-compat.mjs`), and without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see [BACKEND.md](BACKEND.md)). The site deploys from Git through Netlify; see [NETLIFY-DEPLOY.md](NETLIFY-DEPLOY.md). Do not drag and drop `dist/` onto Netlify.

## Customize

`src/App.jsx` is the root: age gate, auth, cart and route state, the page layout and the route switch. Pages live in `src/pages/` (storefront pages at the top level; `account/`, `admin/` and `support/` below it), shared pieces in `src/components/`, and logic in `src/lib/`: `routes.js` (URLs, validation, canonical paths), `router.js` (History API router, `<Link>`, scroll, focus and Back-closes-dialog behaviour), `announce.js` (the shared polite live region), `ageGate.js` (the dated 21+ confirmation, synced across tabs), `meta.js` (titles, canonical and share tags from one `SITE_URL`), `search.js`, `departments.js`, `cart.js`, `pricing.js`, `format.js` (money and labels), `errors.js` (shared error copy) and `domGuard.js`. Product photos live in **`src/assets/products/`** and hero photos in **`src/assets/`**; each product row in `src/data/products.js` names its photo file.

| What | Where |
| ---- | ----- |
| Editorial colors and type | `src/index.css` (`--purple`, `--orange`, `--cream`, `--display`, `--body`) |
| Logo | `IMG` in `src/data/theme.js` |
| Hero photos | `HERO_SLIDES` in `src/data/content.js` |
| Business facts: address, phone, email, hours, minimum order, free-delivery threshold | `COMPANY`, `HOURS`, `ORDER_MINIMUM` and `FREE_DELIVERY_THRESHOLD` in `src/data/content.js`; pages print them from there (money through `formatMoney`/`formatMoneyShort`), and `src/data/facts.test.js` fails when the phone, address, hours, minimum or threshold is typed into another source file |
| Wording: the apply and sign-in labels, quote or order, the licensed-only line | `src/data/terms.js` (`APPLY_LABEL`, `SIGN_IN_LABEL`, `basketTerms()`); `LICENSED_ONLY` in `src/data/content.js` |
| Trade bar announcements | `ANNOUNCEMENTS` in `src/data/content.js`, after the trade notice (`TRADE_NOTICE` in `src/components/TradeBar.jsx`) |
| Departments and product lines | `departmentsFor()` in `src/lib/departments.js`, derived from `cat` and `sub` in `src/data/products.js` (in `NAV_ORDER`) |
| The 368 products | `PRODUCTS` in `src/data/products.js` |
| Account and admin styles | the `account / admin` block in `src/index.css` |

`BRANDS`, `TRUST` and `FAQS` in `src/data/content.js` stay unpublished until the owner confirms them (see `docs/OWNER-TODO.md`).

### Images

`npm run images` (run automatically before `dev` and `build`) renders every photo in `src/assets/products/` and `src/assets/hero_*.jpg` into WebP sizes (320, 480, 640 and 1024px wide for products, never enlarged) with JPEG fallbacks up to 640px, plus a 112px JPEG thumbnail of each product for the search, cart and checkout lists. A product photo wider than 1024px also gets one larger WebP, up to 1600px, that only the product page's enlarged view (the zoom dialog) asks for; its name carries its own hash (`SETTINGS.zoom`), so the other sizes keep theirs. Product photos are first framed at one scale (AW-287): the photo's own near-white or transparent margins are measured off, and the product is placed on a canvas of the card tile's 1.1 aspect where it spans 89% of the limiting side, so every product fills about 80% of its card whatever margins the source came with. Photos with a dark or busy edge are framed whole. Only the margins change; the product's pixels are never scaled up or edited (`FRAME` in `scripts/image-pipeline.mjs`). The files go to `public/img/` (served at `/img/`), and each name carries a hash of the photo and its settings (`kite--640x640-1a2b3c4d.jpg`), so Netlify serves them as immutable. One small manifest, `src/assets/generated/manifest.json`, lists every photo's hash and sizes; `src/lib/images.js` builds the URLs from it. The script also builds the favicon set and `og.jpg` share image in `public/` from `src/assets/logo.jpg`. All of these outputs are gitignored; only the original photos are committed. Drop a new photo into `src/assets/products/`, reference its filename in `products.js`, and the next dev/build run picks it up.

Re-runs compare content hashes, not file dates, so an unchanged photo is never rendered again, even in a fresh checkout. Netlify keeps the outputs between deploys with a local build plugin (`netlify/plugins/image-cache`), and CI with a cache step, so a deploy renders only new or changed photos. To re-render everything, bump `VERSION` in `scripts/image-pipeline.mjs` (sizes, quality and the other settings already change the hash); to rebuild the brand files after changing how they are drawn, bump `BRAND_VERSION` in `scripts/build-images.mjs`. The card and product-page `sizes` in `src/lib/images.js` are worked out from the grid and photo-frame CSS; change them with it (`src/lib/images.test.js` reads the CSS and fails when they drift apart).

## Stack

- React 18
- Vite 7
- Plain CSS with `:root` design tokens and an explicit reset in `src/index.css` for every page, including Account and Admin (no Tailwind)
- Supabase (Postgres + Auth + RLS); see [BACKEND.md](BACKEND.md)

Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, `npm run dev` still serves the catalog, but trade accounts, quotes, order history and the admin dashboard are off, and `npm run build` stops with an error (set `ALLOW_NO_BACKEND=1` to build a static-only preview on purpose). See [BACKEND.md](BACKEND.md).

## License

Proprietary — © 2026 Alabama Wholesale Inc.
