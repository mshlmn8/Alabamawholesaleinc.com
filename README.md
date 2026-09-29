# Alabama Wholesale Inc

Editorial wholesale storefront for licensed retailers. 368 SKUs across 8 departments — tobacco, novelties, merchandise, candies, food stuff, grocery, motor oil, drinks & bags — shipping from Birmingham.

Every page uses the 2A editorial system: Barlow Condensed and DM Sans (bundled in `src/fonts/`), purple / cream / orange, and plain CSS in `src/index.css`. Home, catalog, product, quote, cart, the sign-in dialog, the support pages, account (`#/account`) and admin (`#/admin`) all share it; Tailwind stays in the build only for its preflight reset.

## Pages

Hash routes:

| Route | Page |
| ----- | ---- |
| `#/` | Home — warehouse hero, department strip, new arrivals, collections, bestsellers, services, department grid, account application |
| `#/category/<name>` | Department catalog, with an optional `/<sub>` line |
| `#/product/<id>` | Product detail |
| `#/quote` | Checkout for a signed-in account, or a quote request for a guest |
| `#/account` | Trade account and order history |
| `#/admin` | Admin dashboard |

Also on the storefront:

- 21+ age gate, remembered in `localStorage`
- Header search across name, brand, department, SKU, and variants
- Category menu for the eight departments
- Cart drawer. Cart contents persist in `localStorage`. Escape closes the cart, sign-in, and help overlays and unlocks page scrolling
- Quote requests and orders are saved by the `submit_quote` function in Supabase, which prices the lines on the server. If saving fails, the quote page shows an error with the trade desk's phone number and email; there is no other fallback
- Trade sign-in and account applications through Supabase Auth

Prices stay hidden until someone is signed in. Approved accounts see tier pricing (standard, silver, gold).

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

### Text that Google Translate can break

Translated pages replace React's text nodes, so a string that can change, appear or disappear must be the only child of an element that is always rendered: build one template string (`` {`Showing ${n} of ${total} items`} ``) or give the changing part its own `<span>`. `npm run lint` enforces this with `aw/translate-safe-text` (`scripts/eslint/translate-safe-text.mjs`), and `src/lib/domGuard.js` keeps a missed spot from blanking the page.

## Build for production

```bash
npm run build
```

Output goes to `dist/`; `npm run preview` serves it locally. The build fails without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see [BACKEND.md](BACKEND.md)). The site deploys from Git through Netlify; see [NETLIFY-DEPLOY.md](NETLIFY-DEPLOY.md). Do not drag and drop `dist/` onto Netlify.

## Customize

`src/App.jsx` is the root: age gate, auth, cart and route state, the page layout and the route switch. Pages live in `src/pages/` (storefront pages at the top level; `account/`, `admin/` and `support/` below it), shared pieces in `src/components/`, and logic in `src/lib/`: `router.js` (the hash routes), `meta.js` (page titles), `search.js`, `departments.js`, `cart.js`, `pricing.js`, `format.js` (money and labels), `errors.js` (shared error copy) and `domGuard.js`. Product photos live in **`src/assets/products/`** and hero photos in **`src/assets/`**; each product row in `src/data/products.js` names its photo file.

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
