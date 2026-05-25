# Alabama Wholesale Inc

Wholesale retail catalog website. 368 SKUs across 8 departments — tobacco, novelties, merchandise, candies, food stuff, grocery, motor oil, drinks & bags.

## Improvements in this version

- Working global product search in the desktop and mobile header
- Quick-order panel for fast B2B quote building by SKU, brand, flavor, or category
- Persistent age verification, cart contents, and trade sign-in state via `localStorage`
- Welcome popup now appears only once per browser instead of every verified visit
- Cart drawer now includes a free-delivery progress meter for the $1,500 threshold
- Escape key closes open drawers and modals; open overlays lock background scrolling
- Product cards have stronger hover states and faster quote controls
- Embedded base64 images were moved into `src/assets/` so the production bundle is smaller and images are cacheable
- Vite build now splits React/vendor/icon code into separate cacheable chunks

## Run locally

You need **Node.js 20+** installed (matches `.nvmrc` and Netlify build env). From this folder:

```bash
npm install
npm run dev
```

Then open http://localhost:3000

## Build for production

```bash
npm run build
```

Output goes to `dist/`. Upload the contents of that folder to any static host — Netlify, Vercel, Cloudflare Pages, GitHub Pages, or your own server.

## Deploy to Netlify (drag-and-drop)

1. Run `npm run build`
2. Go to https://app.netlify.com/drop
3. Drag the `dist` folder onto the page
4. Done

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

## Customize

Most storefront logic is in **`src/App.jsx`**. Product and hero images now live in **`src/assets/`** for better production performance. Look for these constants near the top to change things:

| Constant         | What it controls                                              |
| ---------------- | ------------------------------------------------------------- |
| `IMG`            | Product/logo/hero image asset references in `src/assets/`      |
| `C`              | Brand colors (orange `#DB6433` + navy `#1E1B5C`)              |
| `COMPANY`        | Address, phone, hours, email, WhatsApp number                 |
| `ANNOUNCEMENTS`  | The rotating banner at the top of the page                    |
| `NAV_CATEGORIES` | Mega-menu departments + sub-categories                        |
| `PRODUCTS`       | All 368 products (id, name, brand, cat, sub, sku, price, etc) |
| `SHOP_CATS`      | The 8 department tiles on the home page                       |
| `HERO_SLIDES`    | The auto-playing carousel slides (set `videoUrl` for video)   |
| `BRANDS`         | The scrolling brand marquee                                   |
| `WELCOME_OFFERS` | Content of the welcome popup (NEW / RESTOCK / SALE entries)   |
| `FAQS`           | Q&A pairs in the FAQ section                                  |

## Adding videos to the hero carousel

Find `HERO_SLIDES` in `src/App.jsx`. For any slide, set `videoUrl` to a public MP4 URL:

```js
{ eyebrow: 'NEW THIS WEEK', title: '...', img: IMG.hero_candy,
  videoUrl: 'https://your-cdn.com/clip.mp4',   // <-- this
  ... }
```

Use short 5-10 second silent loops. Vimeo direct MP4s, Cloudflare Stream, or S3 work well.

## Stack

- React 18
- Vite 5 (build tool)
- Tailwind CSS 3 (utility classes)
- Lucide React (icons)
- Supabase (Postgres + Auth + RLS) — optional; see [BACKEND.md](BACKEND.md)

The site works as a pure static catalog when no Supabase env vars are set.
Once `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured, real
trade accounts, order history, and the admin dashboard light up. See
[BACKEND.md](BACKEND.md) for the setup recipe.

## License

Proprietary — © 2026 Alabama Wholesale Inc.
