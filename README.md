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
- Signed-in orders go to Supabase; if that fails, the quote form falls back to Netlify Forms
- Trade sign-in and account applications through Supabase Auth

Prices stay hidden until someone is signed in. Approved accounts see tier pricing (standard, silver, gold).

## Run locally

You need **Node.js 24** (the version in `.nvmrc`, which the Netlify build and CI also use; `nvm use` picks it up). `.npmrc` sets `engine-strict`, so npm refuses to install on an unsupported Node version. From this folder:

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Build for production

```bash
npm run build
```

Output goes to `dist/`. See [NETLIFY-DEPLOY.md](NETLIFY-DEPLOY.md) for the Netlify source deploy. A drag-and-drop deploy is `npm run build`, then drop `dist/` on https://app.netlify.com/drop.

## Customize

Storefront layout lives in **`src/App.jsx`**. Product photos live in **`src/assets/products/`** and hero photos in **`src/assets/`**; each product row in `src/data/products.js` names its photo file.

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
- Tailwind CSS 3, still generated for Account, Admin, and the preflight reset
- Lucide React, still used by Account and Admin
- Supabase (Postgres + Auth + RLS) — optional; see [BACKEND.md](BACKEND.md)

Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the catalog still builds and browses. Trade accounts, order history, and the admin dashboard need those keys. See [BACKEND.md](BACKEND.md).

## License

Proprietary — © 2026 Alabama Wholesale Inc.
