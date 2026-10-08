# Alabama Wholesale Inc

Editorial wholesale storefront for licensed retailers. 368 SKUs across 8 departments — tobacco, novelties, merchandise, candies, food stuff, grocery, motor oil, drinks & bags — shipping from Birmingham.

Every page uses the 2A editorial system: Barlow Condensed and DM Sans (bundled in `src/fonts/`), purple / cream / orange, and plain CSS in `src/index.css`. Home, catalog, product, quote, cart, the sign-in dialog, the support pages, account (`/account`) and admin (`/admin`) all share it; Tailwind stays in the build only for its preflight reset.

## Pages

Every page has a real path URL (History API router, `src/lib/router.js` and `src/lib/routes.js`). Netlify serves `index.html` for every path (`netlify.toml`), and old `#/…` links redirect to their path.

| Route | Page |
| ----- | ---- |
| `/` | Home — warehouse hero, department strip, new arrivals (`/#new-arrivals`), collections, bestsellers (`/#bestsellers`), services, department grid, account application |
| `/catalog` | All products: every department, product line and SKU |
| `/category/<department>[/<line>]` | Department catalog, optionally one product line, e.g. `/category/drinks-and-bags/energy-drinks`. Search, sort and filters live in the query string (`?q=&sort=&tags=&variants=1`) |
| `/product/<id>` | Product detail |
| `/quote` | Checkout for a signed-in account, or a quote request for a guest |
| `/account` | Trade account and order history |
| `/admin` | Admin dashboard |
| `/contact`, `/delivery`, `/shipping`, `/privacy`, `/terms`, `/apply`, `/reset-password` | Support pages |

Any other address shows a not-found page with a catalog search and the departments (marked `noindex`). Department and line segments are slugs of the catalog names; other spellings (`/category/TOBACCO`) redirect to the canonical one. `npm run build` also writes `dist/sitemap.xml` from the catalog (`scripts/build-sitemap.mjs`).

Also on the storefront:

- 21+ age gate over the page (the page stays crawlable underneath), remembered in `localStorage` for a set period and cleared on sign-out (`src/lib/ageGate.js`; the period is an owner question, see `docs/OWNER-TODO.md`)
- Header search across name, brand, department, SKU, and variants
- Category menu for the eight departments
- Cart drawer. The cart is kept in `localStorage`, one per account on the device plus one for guests, and stays in step across open tabs; signing in adds the guest cart to the account's, and signing out leaves the next person an empty cart. Lines the catalog no longer has are flagged instead of dropped, and carts from earlier builds are moved over once (`src/lib/cartStorage.js`). Escape closes the cart, sign-in, and help overlays and unlocks page scrolling
- The catalog is read from Supabase's `products` table (`src/lib/catalog.jsx`). The copy built into the site shows first and is the fallback: a slow or failed load says so and offers **Try again**, a product only the live catalog has shows a loading view instead of "not found", open tabs load it again after five minutes away or when the connection comes back, and checkout checks it once more before sending
- Quote requests and orders are saved by the `submit_quote` function in Supabase, which prices the lines on the server. If saving fails, the quote page shows an error with the trade desk's phone number and email; there is no other fallback
- Trade sign-in and account applications through Supabase Auth. One provider (`src/lib/auth.jsx`) holds the session and profile; account pages wait for them instead of flashing a signed-out view, and email links are handled by `src/lib/authLink.js` (see BACKEND.md, "Email links")

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

GitHub Actions (`.github/workflows/ci.yml`) runs all four, plus `npm audit --omit=dev --audit-level=high` and a check that the production build refuses to run without the Supabase settings. Dependabot (`.github/dependabot.yml`) opens weekly update PRs.

### Planned toolchain upgrades

The build runs on Vite 7 with `@vitejs/plugin-react` 5 and React 18. Two upgrades are planned as their own changes (AW-211), not bundled into a Dependabot PR:

- **Vite 8 with `@vitejs/plugin-react` 6.** Vite 8 bundles with Rolldown instead of Rollup, so check that the `manualChunks` split in `vite.config.js` still produces the separate `vendor` chunk, then run the full checks above.
- **React 19, after launch.** Plan it with the ESLint plugins: `eslint-plugin-react` and `eslint-plugin-jsx-a11y` do not declare ESLint 10 support yet, so ESLint stays on 9 for now.

### Text that Google Translate can break

Translated pages replace React's text nodes, so a string that can change, appear or disappear must be the only child of an element that is always rendered: build one template string (`` {`Showing ${n} of ${total} items`} ``) or give the changing part its own `<span>`. `npm run lint` enforces this with `aw/translate-safe-text` (`scripts/eslint/translate-safe-text.mjs`), and `src/lib/domGuard.js` keeps a missed spot from blanking the page.

## Build for production

```bash
npm run build
```

Output goes to `dist/`; `npm run preview` serves it locally. The build fails without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see [BACKEND.md](BACKEND.md)). The site deploys from Git through Netlify; see [NETLIFY-DEPLOY.md](NETLIFY-DEPLOY.md). Do not drag and drop `dist/` onto Netlify.

## Customize

`src/App.jsx` is the root: age gate, auth, cart and route state, the page layout and the route switch. Pages live in `src/pages/` (storefront pages at the top level; `account/`, `admin/` and `support/` below it), shared pieces in `src/components/`, and logic in `src/lib/`: `routes.js` (URLs, validation, canonical paths), `router.js` (History API router, `<Link>`, scroll, focus and Back-closes-dialog behaviour), `announce.js` (the shared polite live region), `ageGate.js` (the dated 21+ confirmation, synced across tabs), `meta.js` (titles, canonical and share tags from one `SITE_URL`), `search.js`, `departments.js`, `cart.js`, `pricing.js`, `format.js` (money and labels), `errors.js` (shared error copy) and `domGuard.js`. Product photos live in **`src/assets/products/`** and hero photos in **`src/assets/`**; each product row in `src/data/products.js` names its photo file.

| What | Where |
| ---- | ----- |
| Editorial colors and type | `src/index.css` (`--purple`, `--orange`, `--cream`, `--display`, `--body`) |
| Logo | `IMG` in `src/data/theme.js` |
| Hero photos | `HERO_SLIDES` in `src/data/content.js` |
| Address, phone, hours, email | `COMPANY` in `src/data/content.js` |
| Top ticker | `ANNOUNCEMENTS` in `src/data/content.js` |
| Departments and sub-lines | `NAV_CATEGORIES` in `src/data/products.js` |
| The 368 products | `PRODUCTS` in `src/data/products.js` |
| Account and admin styles | the `account / admin` block in `src/index.css` |

`SHOP_CATS`, `BRANDS`, `TRUST`, `FAQS`, and `WELCOME_OFFERS` in `src/data/content.js` are leftover from the previous layout. The editorial pages do not render them.

### Images

`npm run images` (run automatically before `dev` and `build`) renders every photo in `src/assets/products/` and `src/assets/hero_*.jpg` into WebP and JPEG card/detail sizes under `src/assets/generated/`, and builds the favicon set and `og.jpg` share image in `public/` from `src/assets/logo.jpg`. Those outputs are gitignored; only the original photos are committed. Drop a new photo into `src/assets/products/`, reference its filename in `products.js`, and the next dev/build run picks it up.

## Stack

- React 18
- Vite 7
- Plain CSS for the editorial storefront
- Tailwind CSS 3, kept in the build only for its preflight reset (Account and Admin use the plain CSS too)
- Supabase (Postgres + Auth + RLS); see [BACKEND.md](BACKEND.md)

Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, `npm run dev` still serves the catalog, but trade accounts, quotes, order history and the admin dashboard are off, and `npm run build` stops with an error (set `ALLOW_NO_BACKEND=1` to build a static-only preview on purpose). See [BACKEND.md](BACKEND.md).

## License

Proprietary — © 2026 Alabama Wholesale Inc.
