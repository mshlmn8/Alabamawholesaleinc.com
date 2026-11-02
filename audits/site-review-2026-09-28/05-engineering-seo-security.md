# Engineering, SEO, performance & security

Part of the Alabama Wholesale site review (2026-09-28). Start with [00-START-HERE.md](00-START-HERE.md) for the guardrails and the order to work in.

88 findings. Critical 1, High 10, Medium 38, Low 39. File paths are relative to the repo root `alabamawholesaleinc-2a-editorial/`. Each finding ends with a checkbox; tick it when the fix is in.

**Who** says who can act: **Cursor** can fix it from the finding alone. **Owner → Cursor** needs a decision, fact or asset from the business owner first; Cursor must not invent it, and should leave a `TODO(owner)` where the code depends on the answer.

## Contents

- SEO, metadata & performance (16)
- Code quality & functional bugs (15)
- Multi-tab & session state (13)
- Slow network, offline & broken assets (10)
- Security, backend & data boundaries (24)
- Launch readiness & engineering lifecycle (10)

## SEO, metadata & performance

#### AW-044 · The age gate replaces the whole app, so crawlers and non-JS clients index only 38 words

**High** · seo · Who: **Cursor** · Effort: S · Still open from the 2026-09-25 audit · Viewports: all

**Where:** Every route in a fresh session (no aw-age-verified in localStorage), and with JavaScript disabled

**Problem:** App.jsx:282 runs `if (!verified) return <AgeGate .../>` before any content renders. Googlebot renders pages in a fresh profile and cannot click "Yes, I am 21+". I loaded fresh sessions on #/, #/product/61 and #/category/TOBACCO. Each rendered page had one h1 ("Are you 21 or older?"), 38 words, 0 links and 0 images; only document.title differed. With JavaScript disabled, body innerText is "" with 0 h1 and no <noscript> fallback (index.html:93 is an empty #root). The 2026-09-25 audit (#14) noted the age-gate-only interface; it is unchanged.

**Fix:** 1) In src/App.jsx:282 delete the early `if (!verified) return <AgeGate …/>`. Always return the normal tree. Inside the root <div> (after <Footer>), add `{!verified && <ModalLayer className="age-gate-layer"><AgeGate onYes={handleAgeYes} onNo={() => setTooYoung(true)} tooYoung={tooYoung} /></ModalLayer>}`. Do NOT pass onClose: ModalLayer then ignores Escape, sets #root inert + aria-hidden, traps Tab and moves focus into the gate. Keep the existing .age-gate CSS (index.css:497): it is opaque and covers the page, so no blur rule is needed. 2) In AgeGate (App.jsx:362-385), give the "Yes, I am 21+" button data-autofocus so it gets initial focus. 3) Don't sniff user agents or serve bots different content. 4) In index.html, right after <div id="root"></div> (line 93), add <noscript><p>Alabama Wholesale Inc — wholesale tobacco, vape, candy, drinks, grocery and motor-oil distributor for licensed retailers, 613 Graymont Ave N, Birmingham AL. Call (205) 354-4473. Please enable JavaScript to browse the catalog.</p></noscript>. 5) Once prerendering exists (seo-1), render the gate client-side over the prerendered HTML the same way.

**Files:** `index.html:93-94`, `src/App.jsx:282`, `src/App.jsx:362-385`

**Evidence:** [seo/crawler-fresh-session-product61-agegate.jpg](screenshots/seo__crawler-fresh-session-product61-agegate.jpg), [seo/nojs-raw-html-blank.jpg](screenshots/seo__nojs-raw-html-blank.jpg)

- [ ] Done

#### AW-177 · Carousel autoplay pushes homepage LCP to 7–13 s because later slides paint larger

**Medium** · performance · Who: **Cursor** · Effort: M · New · Viewports: all (measured 412 mobile throttled, 390 mobile and 1440 desktop unthrottled)

**Where:** #/ → HeroCarousel autoplay (4.5 s interval)

**Problem:** The production build was served with vite preview. Mobile (412x823, DPR 1.75, 4x CPU, slow-4G) LCP entries: text 2.6 s, then hero_candy at 3.4 s, then hero_vape at 7.0 s (2 runs: 6,996/6,964 ms). The last entry is the reported LCP. Unthrottled with no user input: desktop 1440 went hero_candy 100 ms, then hero_lighters at 9,068 ms; mobile 390 went hero_candy 100 ms, then hero_vape at 4,560 ms, then hero_gatorade at 13,560 ms. Cause: slides render at intrinsic size, so painted areas differ (desktop: candy 308,700px², lighters 336,700px²; mobile: candy 79,744, vape 126,736, gatorade 138,484). Each autoplay advance to a larger slide becomes a new, later LCP candidate. With prefers-reduced-motion (autoplay off) LCP stays at hero_candy, 3.5 s. The homepage is the only indexable URL, so this is the Core Web Vitals score Google records for the site.

**Fix:** 1) Give every slide the same painted box. Apply the overflow fix (img width:100%; height:100%; object-fit:contain inside a fixed-height stage). Also re-export all four hero sources (src/assets/hero_*.jpg) to one identical canvas, e.g. 1440x900 letterboxed on white, so no later slide is larger than slide 1. 2) Don't start the 4.5 s interval (App.jsx:651-655) until the user has interacted: set a `userInteracted` flag on the first pointerdown/keydown/scroll listener and add it to the effect's condition. Alternatively, initialise `paused` to true and autoplay only after interaction. 3) Re-measure: LCP should stay on slide 1 at about 3.4 s on slow-4G mobile.

**Files:** `scripts/build-images.mjs:35`, `src/App.jsx:651-655`, `src/App.jsx:664-687`, `src/data/content.js:42-45`, `src/index.css:178-182`

**Evidence:** [seo/perf-4180-mobile.json](screenshots/seo__perf-4180-mobile.json), [seo/perf-4181-mobile.json](screenshots/seo__perf-4181-mobile.json)

- [ ] Done

#### AW-178 · Fallback fonts don't match the web fonts: the font swap causes CLS 0.17 on product pages, and headings fall back to synthetic-bold Impact or a wide system sans when Barlow Condensed is blocked or loading

**Medium** · performance · Who: **Cursor** · Effort: M · New · Viewports: 412x823 mobile (CLS 0.17); smaller shifts on 1440

**Where:** #/product/61 (and any product whose breadcrumb wraps in the fallback font); all pages when fonts swap

**Problem:** Production build, 412x823 mobile, 4x CPU, slow-4G: CLS on #/product/61 was 0.1704 in both runs (Core Web Vitals threshold 0.1), with a single shift at about 4.28 s. Source: .pd-grid moved from y=304.5 to y=280 and the crumb span from 270 to 235.75. With .woff2 requests blocked, CLS was 0.0000, so the font swap is the cause. The 11px/700 breadcrumb "HOME / NOVELTIES & VAPES / GEEK BAR PULSE X 25K" measures 339px in the Verdana fallback against 280px in DM Sans, so it wraps to 2 lines (60.5px) and snaps to 1 line (36px) when DM Sans arrives. The fonts are discovered late: nothing preloads them, and @font-face files are only requested after React renders. DM Sans starts at 2,468 ms and finishes at 4,196 ms; Barlow 700 finishes at 3,616 ms. The main JS finishes at 2,377 ms. Four static Barlow weights (500/600/700/800, about 14.8 KB each) are bundled.

**Also seen:**
- All h1/h2/h3, .pd-price b, .info-lead, age-gate h1 → var(--display) when the Barlow Condensed woff2 is blocked or still loading — The bundled .woff2 fonts were blocked and CDP CSS.getPlatformFontsForNode read the rendered face on each platform: - macOS: Arial Narrow + Verdana, close to the design. - Windows without Office (no Arial Narrow): Impact. Its only weight is regular, so h1-h3 at font-weight 700 are faux-bolded. 'Contact & visit' and the '(205) 354-4473' lead number render as a crushed, heavy poster face. - iOS and Android (neither Arial Narrow nor Impact installed)…

**Fix:** Preload the display and body woff2 files in index.html. Define metric-matched fallback @font-face rules (e.g. local('Arial Narrow') / local('Arial') with size-adjust, ascent-override and descent-override) for --display and the body font (index.css:4, 22-23; fonts.css:4-38). Remove Impact and Verdana from the font stacks.

**Files:** `index.html:30`, `src/fonts/fonts.css:4-38`, `src/fonts/fonts.css:4`, `src/index.css:4`, `src/index.css:22-23`, `src/index.css:22`, `src/index.css:23`, `src/index.css:162`, `src/index.css:257-258`

**Evidence:** [seo/product61-412-fonts-blocked.jpg](screenshots/seo__product61-412-fonts-blocked.jpg), [seo/product61-412-fonts-normal.jpg](screenshots/seo__product61-412-fonts-normal.jpg), [gap1-degraded-states/font-win-1440_contact.jpg](screenshots/gap1-degraded-states__font-win-1440_contact.jpg), [gap1-degraded-states/font-loaded-1440_contact.jpg](screenshots/gap1-degraded-states__font-loaded-1440_contact.jpg), [gap1-degraded-states/font-win-390-pdp60.jpg](screenshots/gap1-degraded-states__font-win-390-pdp60.jpg), [gap1-degraded-states/agegate-win-fontfail-390.jpg](screenshots/gap1-degraded-states__agegate-win-fontfail-390.jpg), [gap1-degraded-states/font-mac-1440_contact.jpg](screenshots/gap1-degraded-states__font-mac-1440_contact.jpg)

- [ ] Done

#### AW-179 · One 638 KB main JS chunk with no code splitting; 46% unused on home, first paint 2.6 s on slow 4G

**Medium** · performance · Who: **Cursor** · Effort: M · New · Viewports: all (measured 412 mobile throttled)

**Where:** Production build: assets/index-*.js (loaded on every route)

**Problem:** `npx vite build` produces index-*.js at 637.76 kB (169.44 kB gzip), vendor (react-dom) at 140.87 kB (45.26 kB gzip) and CSS at 65.19 kB (12.68 kB gzip). Vite prints a >500 kB chunk warning. There is no React.lazy, dynamic import() or Suspense in src/. Main-chunk composition from the sourcemap (raw / gzip): all @supabase packages 206.6 KB / 53.3 KB, including realtime-js + phoenix (56 KB raw) that the app never uses; src/data/products.js 119.4 KB / 27.0 KB; inlined image data and URL imports 94.4 KB / 39.2 KB; images.js 72.1 KB / 9.8 KB; App.jsx 59.9 KB / 15.9 KB; AuthModal 15.2 KB; Admin + Account + QuickReorder + DocumentUploads + documents.js 25.3 KB / 9.5 KB; the support pages about 23 KB. Chrome coverage on #/ shows 45.5% of index.js and 63.3% of vendor.js unused. On slow-4G with 4x CPU the main JS finishes downloading at 2,377–2,393 ms, and FCP is 2.54–2.66 s on home, category and product. The live catalog is also fetched from Supabase on every load (368 rows), duplicating the bundled products.js.

**Also seen:**
- Initial JS bundle — On the dev server, an unverified visitor still on the age gate ('Are you 21 or older?') already downloads /src/pages/admin/AdminPage.jsx, /src/pages/account/AccountPage.jsx, /src/pages/account/QuickReorder.jsx, /src/components/AuthModal.jsx, /src/components/DocumentUploads.jsx and all 7 support pages. dist/assets/index-CvpKVAyY.js is 342,977 bytes (83,985 gzip) and vendor-nf7bT_Uh.js is 140,868 bytes. That main chunk contains no 'rest/v1', no '.r…

**Fix:** Code-split with React.lazy/dynamic import for AdminPage, AccountPage, AuthModal, the support pages and the Supabase client where possible. Add manualChunks for vendor code so the main bundle drops well below 638 KB (App.jsx:13-22; vite.config.js).

**Files:** `src/App.jsx:13-22`, `src/App.jsx:13`, `src/App.jsx:15`, `src/App.jsx:16`, `src/App.jsx:21`, `src/App.jsx:22`, `src/lib/supabase.js:5-18`, `src/lib/useCatalog.js:8`, `src/lib/useCatalog.js:16-40`, `vite.config.js:14-19`, `vite.config.js:16`

**Evidence:** [seo/bundle-composition.txt](screenshots/seo__bundle-composition.txt), [seo/perf-4180-mobile.json](screenshots/seo__perf-4180-mobile.json)

- [ ] Done

#### AW-180 · Eager glob of 1,278 image URLs plus 7 base64 images adds about 166 KB (49 KB gzip) to the main bundle

**Medium** · performance · Who: **Cursor** · Effort: L · New

**Where:** src/lib/images.js import.meta.glob → main JS chunk

**Problem:** images.js:16 runs `import.meta.glob('../assets/generated/*.{webp,jpg}', { eager: true, query: '?url' })` over 1,278 generated files. The built chunk contains 2,562 '/assets/...' URL strings (119 KB of text). The glob key object in images.js is 72.1 KB raw, and the URL imports are about 64 KB. Because vite.config.js:13 sets assetsInlineLimit: 4096, seven images under 4 KB are base64-inlined into the JS (27.7 KB): p150-phone-cables 320w.webp, p151-white-v-neck 320w jpg+webp, p216-grinders 320w jpg+webp, p356-gas-cans 320w.webp and paper_bags_2 320w.webp. The vite.config comment says the intent is to keep product photos as cacheable files. Together that is about 166 KB raw / about 49 KB gzip (about 29% of the gzipped main chunk), parsed on every page.

**Fix:** 1) Set `assetsInlineLimit: 0` in vite.config.js:13 so no product image is inlined. 2) Replace the eager glob with deterministic URLs. Have scripts/build-images.mjs write outputs to public/img/v2/<base>--<w>x<h>.{webp,jpg} (bump the folder when VERSION changes). Also write a compact manifest, src/data/image-sizes.json, shaped like { "<base>": [[320,320],[640,640],[1024,1024]] }. Rewrite fromSet() in images.js to build `/img/v2/${base}--${w}x${h}.webp` strings from that manifest. Delete the GENERATED glob. 3) Serve /img/v2/* with a long max-age (see the caching finding).

**Files:** `scripts/build-images.mjs:29`, `scripts/build-images.mjs:76-77`, `src/lib/images.js:16`, `src/lib/images.js:26-38`, `vite.config.js:13`

**Evidence:** [seo/bundle-composition.txt](screenshots/seo__bundle-composition.txt)

- [ ] Done

#### AW-181 · Shared product or category links always preview as the homepage

**Medium** · seo · Who: **Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit

**Where:** index.html Open Graph/Twitter tags; App.jsx meta effect; all non-home routes

**Problem:** The app updates document.title, meta description, og:title and og:description client-side (App.jsx:197-205). By design, canonical and og:url stay https://alabamawholesaleinc.com/ on all 29 routes (App.jsx:80-82 comment; meta-per-route.json). Facebook, iMessage, WhatsApp, Slack and LinkedIn scrapers don't run JavaScript and never receive the #fragment. Every shared link therefore shows the static index.html card: title "Alabama Wholesale Inc · Wholesale Distributor — Birmingham, AL" with the logo og.jpg, and never the product name or photo. og:type is "website" on product pages. There are no per-page og:image, twitter:title or twitter:description tags. The 2026-09-25 audit (#14) flagged homepage-only canonical and social tags. Titles and descriptions are now per page, but only in the browser.

**Also seen:**
- #/product/<id> → <head> title, canonical, og:url, og:image, twitter:image — Live #/product/162, 205, 329, 122, 166 and 60 all have <link rel=canonical href='https://alabamawholesaleinc.com/'>, og:url of the same URL, og:image and twitter:image 'https://alabamawholesaleinc.com/og.jpg', and no <meta name=robots>. Titles follow `${p.name} · ${p.brand} · ${site}` (App.jsx:105). Exact duplicates occur on 40 products, e.g. 'Pepsi · Pepsi · Alabama Wholesale Inc', 'WD-40 · WD-40 · …', 'Hard Steel · Hard Steel · …', 'Reese’s · R…
- public/sitemap.xml; all support routes — public/sitemap.xml lists only '/', 8 '#/category/…' URLs and '#/quote'. None of #/catalog, #/contact, #/delivery, #/terms, #/privacy or #/apply appear. All hash routes keep the homepage canonical and og:url (comment at App.jsx:80-82), so the most crawl-friendly, text-rich pages (contact, delivery area, terms) cannot rank or be linked on their own. The previous audit (#14) called for real paths.

**Fix:** Set per-route canonical, og:url, og:title, og:description and og:image/twitter:image (the product image on PDPs, a department image on category pages) in the App.jsx meta effect (80-83, 197-205), instead of the homepage values. Add all support pages (and products and categories once path routing exists) to public/sitemap.xml.

**Files:** `index.html:9`, `index.html:17-29`, `index.html:22`, `index.html:23`, `index.html:29`, `public/sitemap.xml`, `src/App.jsx:80-83`, `src/App.jsx:80-82`, `src/App.jsx:102`, `src/App.jsx:105`, `src/App.jsx:166-185`, `src/App.jsx:197-205`, `src/App.jsx:197`

**Evidence:** [seo/meta-per-route.json](screenshots/seo__meta-per-route.json)

- [ ] Done

#### AW-182 · Hashed build assets get no long-term cache headers on Netlify

**Medium** · performance · Who: **Cursor** · Effort: S · New

**Where:** netlify.toml (production deploy), /assets/*

**Problem:** netlify.toml has [build] and a single [[redirects]] rule, but no [[headers]]. Netlify's default for every file is `cache-control: public, max-age=0, must-revalidate`. So on every repeat visit the browser revalidates the content-hashed JS, CSS, fonts and the ~1,280 hashed product images: 22 requests on a home load and 20 on Tobacco, each a round trip (about 560 ms RTT on slow 4G), even though the files never change under the same name.

**Fix:** Append to netlify.toml:
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
[[headers]]
  for = "/*.png"
  [headers.values]
    Cache-Control = "public, max-age=604800"
Keep index.html uncached (Netlify default). If images move to public/img/v2/ (see the image-URL finding), add the same immutable rule for /img/v2/*.

**Files:** `netlify.toml:1-12`

- [ ] Done

#### AW-317 · sitemap.xml lists 9 fragment URLs (including the cart/quote page) and no products

**Low** · seo · Who: **Cursor** · Effort: S · Still open from the 2026-09-25 audit

**Where:** /sitemap.xml

**Problem:** public/sitemap.xml has 10 <url> entries: / plus 8 #/category/... URLs (lines 4-11) and #/quote (line 12). Google strips fragments, so lines 4-12 are all the homepage again. The cart/quote page shouldn't be in a sitemap in any form. None of the 368 products or the support pages (contact, delivery, shipping, privacy, terms, apply) are listed, and there is no <lastmod>. The 2026-09-25 audit (#14) named the fragment URLs; the file is unchanged.

**Fix:** Now: delete lines 4-12 so the sitemap lists only the homepage. After path routing: generate dist/sitemap.xml at build time (a new scripts/build-sitemap.mjs reading NAV_ORDER and CATALOG, run in the build script after vite build). Include /, /catalog, the 8 /category/<slug> pages, the sub-line pages, all /product/<id>-<slug> pages, and /contact, /delivery, /shipping, /privacy, /terms, /apply, each with <lastmod>. Exclude /quote, /account, /admin and /reset-password. Drop changefreq/priority, which Google ignores.

**Files:** `public/robots.txt:4`, `public/sitemap.xml:4-12`

- [ ] Done

#### AW-318 · Homepage meta description is 185 characters and gets truncated in results

**Low** · seo · Who: **Cursor** · Effort: S · New

**Where:** #/ <meta name=description> and og:description; index.html static tags

**Problem:** HOME_DESCRIPTION (App.jsx:83) and the static index.html:8 and :21 tags are 185 characters. Google cuts around 155–160, so "...from our Birmingham warehouse" is lost. The other routes are clipped to 155 by clip(), but the homepage (the only indexable page) is not. The home title "Alabama Wholesale Inc · Wholesale Distributor — Birmingham, AL" (62 chars) has none of the product terms people search for (tobacco, vape, candy wholesale).

**Fix:** Use one description of ≤155 characters in App.jsx:83 (HOME_DESCRIPTION), index.html:8 (meta description) and index.html:21 (og:description), e.g. "Wholesale tobacco, vapes, candy, drinks, grocery & motor oil for licensed retailers. Next-day route delivery in AL, MS & GA from Birmingham." (140 chars). Change the home title in App.jsx:117, index.html:7 (<title>) and index.html:20 (og:title) to e.g. "Wholesale Tobacco, Vape & C-Store Supply | Alabama Wholesale" (60 chars). Leave index.html:19 (og:site_name = "Alabama Wholesale Inc") unchanged.

**Files:** `index.html:7-8`, `index.html:20-21`, `src/App.jsx:83`, `src/App.jsx:117`

- [ ] Done

#### AW-319 · Page-title and description templates repeat the brand, show "Assorted" and cut sentences mid-phrase

**Low** · seo · Who: **Cursor** · Effort: M · New

**Where:** Product, category, sub-line and quote routes → document.title / meta description

**Problem:** The product template `${p.name} · ${p.brand} · ${site}` (App.jsx:105) repeats the brand in 297 of 368 titles (e.g. "Swisher Sweets cigarillos · Swisher Sweets · Alabama Wholesale Inc"). 66 titles show a meaningless "· Assorted ·" ("Cereal cups · Assorted · Alabama Wholesale Inc"). 55 titles exceed 60 characters (max 85). Product meta descriptions are p.description verbatim: 102 are under 70 characters with no wholesale context ("Claritin allergy relief for the OTC shelf."). Category descriptions are clipped to end "...and more. Sign in for…" (App.jsx:100). The sub-line route #/category/TOBACCO/Cigars%20%26%20Cigarillos has title "Cigars & Cigarillos · Tobacco · Wholesale Catalog · Alabama Wholesale Inc" (73 chars), but its description is identical to the Tobacco page and its h1 still says "Tobacco" (App.jsx:959). The #/quote title is "Checkout" while the h1 says "Your cart is empty" or "Request your quote" (App.jsx:107 vs 1209/1238).

**Also seen:**
- <meta name=description> / og:description on #/category/TOBACCO, NOVELTIES, DRINKS & BAGS — Live meta descriptions. TOBACCO: '…68 SKUs across Cigarettes, Cigars & Cigarillos, Loose Tobacco Bags, Papers & Cones and more. Sign in for…'. NOVELTIES: '…51 SKUs across Detox, Disposable Vapes, Hookah & Shisha, Kratom & Kava and more. Sign in for account…'. MERCHANDISE: '…60 SKUs across Adult Wellness, Air Fresheners & Incense, Apparel, Counter Goods and more. Sign in for…'. DRINKS & BAGS: '…44 SKUs across Bags & Carriers, Dairy & Milk, Energy …
- #/apply and #/contact → <meta name='description'> and og:description — The #/apply description reads 'What licensed retailers need to open a Alabama Wholesale Inc trade account…' ('a' should be 'an') (App.jsx:115). The #/contact description is clipped at 155 characters mid-hours: '…Mon–Fri 7:00 AM – 6:00 PM, Sat–Sun 8:00 AM –…' (App.jsx:112).

**Fix:** Fix the title/description templates (App.jsx:84-117): don't repeat the brand, omit 'Assorted' as a brand, and write complete descriptions under ~155 characters that aren't cut mid-phrase (category 'Sign in for…'). Fix the #/apply grammar error and the #/contact truncation.

**Files:** `src/App.jsx:84`, `src/App.jsx:87`, `src/App.jsx:94-107`, `src/App.jsx:99`, `src/App.jsx:100`, `src/App.jsx:112`, `src/App.jsx:115`, `src/App.jsx:137`, `src/App.jsx:959`, `src/App.jsx:1238`

**Evidence:** [seo/meta-per-route.json](screenshots/seo__meta-per-route.json)

- [ ] Done

#### AW-320 · Structured data is a bare LocalBusiness block with no logo, @id, geo, sameAs or breadcrumbs

**Low** · seo · Who: **Owner → Cursor** · Effort: S · New

**Where:** index.html JSON-LD

**Problem:** The only structured data is one static LocalBusiness object (index.html:33-56). It is valid JSON and its hours and phone match the footer. It uses the generic LocalBusiness type and has no @id, logo, geo, hasMap, sameAs (Google Business Profile, Facebook) or priceRange. Its image is the logo share card. There is no WebSite or Organization node and no BreadcrumbList on any route (routes are hash-based, so none could be emitted per page).

**Fix:** In index.html:33-56 change "@type" to "WholesaleStore". Add "@id": "https://alabamawholesaleinc.com/#business", "logo": "https://alabamawholesaleinc.com/icon-512.png", "hasMap" (Google Maps URL for 613 Graymont Ave N), "geo": {"@type":"GeoCoordinates","latitude":…,"longitude":…} (owner to supply exact coordinates), and "sameAs": [Google Business Profile URL, social profiles]. Add a second node {"@type":"WebSite","url":"https://alabamawholesaleinc.com/","name":"Alabama Wholesale Inc","publisher":{"@id":"https://alabamawholesaleinc.com/#business"}}. After path routing, emit a BreadcrumbList (Home › Department › Sub-line › Product) in each prerendered category and product page.

**Owner input needed:** Please provide the exact latitude and longitude of 613 Graymont Ave N, your Google Business Profile URL and any official social media profile URLs.

**Files:** `index.html:32-56`

- [ ] Done

#### AW-321 · Hidden carousel slides download at page load despite loading="lazy"

**Low** · performance · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/ → HeroCarousel slides 2–4

**Problem:** Inactive slides are absolutely positioned at opacity 0 inside the visible stage (index.css:179), so Chrome treats their lazy images as in-viewport and fetches them immediately. On mobile slow-4G, hero_vape (29 KB) starts at 2,619 ms, alongside hero_candy (the LCP image) at 2,478 ms. hero_gatorade (23 KB) and hero_lighters (46 KB) load in the same burst: about 99 KB competing with the LCP image and the first product cards. Same result at 1440 (all four hero files requested on load).

**Fix:** Render the <Picture>/<img> only for the active slide and the next one: in the media.map at App.jsx:664, render the image when `i === safeIndex || i === (safeIndex + 1) % count`, else an empty div. Alternatively give non-adjacent slides `display:none` (index.css:179), which keeps native lazy loading deferred. Keep priority/fetchpriority on slide 0 only.

**Files:** `src/App.jsx:664-687`, `src/index.css:179-180`

- [ ] Done

#### AW-322 · Phones download 640px card images where 320px is enough (sizes ignores the 14px padding)

**Low** · performance · Who: **Cursor** · Effort: S · Partly fixed since the 2026-09-25 audit · Viewports: 412x823 (DPR 1.75), 390x844 (DPR 2–3)

**Where:** Home/category/product-related card grids → .card-block img

**Problem:** At 412px the card box is 180 CSS px, and .card-block img has 14px padding (index.css:204), so the photo area is about 152px, needing 266 device px at DPR 1.75. SIZES.card says 46vw (189px, so 331 device px), so the browser skips the 320w file and downloads 640w. Average generated webp is 13.6 KB at 320w and 35.3 KB at 640w. Mobile home loaded 15 images / 458 KB against 290 KB for 18 images at 1440. Mobile Tobacco category loaded 433 KB of images. Only 320/640/1024 widths are generated, so there is no middle rung for 2x/3x phones.

**Fix:** In images.js:81 set card to '(max-width: 600px) calc(46vw - 28px), (max-width: 850px) calc(24vw - 28px), (max-width: 1344px) calc(23vw - 28px), 274px'. Make detail and editorial account for their padding the same way. In scripts/build-images.mjs:34 set PRODUCT_WIDTHS = [320, 480, 640, 1024] and bump VERSION to 3 (line 33) so 2x phones get about 21 KB 480w files instead of 35 KB 640w ones.

**Files:** `scripts/build-images.mjs:33-34`, `src/index.css:204`, `src/lib/images.js:80-84`

- [ ] Done

#### AW-323 · Category-page LCP image (first product card) is loading="lazy" with no fetch priority

**Low** · performance · Who: **Cursor** · Effort: S · New · Viewports: 412 mobile (LCP 3.76 s), 1440

**Where:** #/category/* → first product cards in .category-card-grid

**Problem:** On #/category/TOBACCO the LCP element is the first product card image (ss_cigarillos webp): at 412x823 DPR 1.75 (640w file), at 390x844 DPR 3 and at 1440x900 (320w file). It has loading="lazy" and no fetchpriority (PerformanceObserver: lazy 'lazy', fp null). The first card row is above the fold: two cards at top 583 px on phones, three cards at top 679 px at 1440. The reviewer measured 3.74-3.80 s LCP on a throttled production build. This does not apply to the home page (the LCP is the hero, already eager with fetchpriority=high) or to the product page (the LCP is the detail photo, already priority).

**Fix:** Change the ProductCard signature at App.jsx:802 to accept `eager = false, priority = false`. At App.jsx:817 render `<Picture picture={p.picture} alt={p.name} sizes={SIZES.card} loading={eager ? 'eager' : 'lazy'} priority={priority} />`. Picture.jsx already forwards `loading` and turns `priority` into eager + fetchpriority=high. At App.jsx:1028 render `items.map((p, i) => <ProductCard key={p.id} {...props} p={p} eager={i < 3} priority={i === 0} />)`, putting the explicit props after the spread so they cannot be overridden. The first row (2 cards on phones, 3 on desktop) then loads eagerly and only the likely LCP image gets fetchpriority=high. Leave the home New Arrivals and product-page related grids lazy.

**Files:** `src/App.jsx:802`, `src/App.jsx:817`, `src/App.jsx:1027-1028`, `src/components/Picture.jsx:6-20`

- [ ] Done

#### AW-324 · Thumbnails use 320px JPEGs in 38–52px boxes, and they and the logo have no width/height

**Low** · performance · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Header search results (.sr-thumb), cart drawer and checkout (.thumb), header logo

**Problem:** Search result, cart drawer and checkout thumbnails use p.img, the 320x320 JPEG (average 15.4 KB), shown at 38px (search) and 50–52px (cart/checkout). Typing "geek" fetched three 320px JPEGs, and each keystroke that changes the 10 results fetches more. These <img> tags (App.jsx:475, 1246, 1401) have no width/height/decoding, and cart/checkout ones have no loading attribute. The header logo <img> (App.jsx:457, 320x320 source shown at 72px) has no width/height. CSS gives it height:72px with width:auto, so its width is 0 until the image decodes and the search field shifts sideways.

**Fix:** In scripts/build-images.mjs also render a 112px thumbnail (<base>--thumb.webp/jpg) and expose it as `thumb` from fromSet() in images.js. Use it at App.jsx:475, 1246 and 1401 with width="52" height="52" loading="lazy" decoding="async". Add width={320} height={320} to the logo <img> at App.jsx:457 (CSS keeps it at 72px tall) so its box is reserved before load.

**Files:** `scripts/build-images.mjs:34`, `src/App.jsx:457`, `src/App.jsx:475`, `src/App.jsx:1246`, `src/App.jsx:1401`, `src/lib/images.js:51`

- [ ] Done

#### AW-325 · Breadcrumb links render in Title Case while the current item is UPPERCASE; the parent department is not a link on sub-line pages

**Low** · consistency · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/product/* and #/category/*/<sub> → .crumbs

**Problem:** Computed styles on #/product/61: BUTTON "Home" and BUTTON "Novelties & Vapes" have text-transform:none (Tailwind preflight resets buttons), while SPAN "Geek Bar Pulse X 25K" is uppercase. All are 11px with 1.2px letter-spacing, so one breadcrumb mixes "Home / Novelties & Vapes / GEEK BAR PULSE X 25K". On #/category/TOBACCO/Cigars%20%26%20Cigarillos the parent "Tobacco" is a plain <span> (App.jsx:955), so there is no way back to the whole department from the breadcrumb.

**Also seen:**
- All inner pages → .crumbs (e.g. #/product/1 'Home / Tobacco / SWISHER SWEETS CIGARILLOS') — qvdes-02-measure.mjs gives crumb innerText 'Home / Tobacco / SWISHER SWEETS CIGARILLOS'. Screenshot: evidence/design-verify/crumbs-pdp.png.

**Fix:** Explicitly set text-transform on .crumbs buttons/links, since Tailwind preflight resets it on buttons, so every breadcrumb item uses the same case (index.css:257-258). Make the parent department a link on sub-line pages (App.jsx:954-957, 1083-1087).

**Files:** `src/App.jsx:954-957`, `src/App.jsx:1083-1087`, `src/index.css:5`, `src/index.css:257-258`, `src/index.css:257`, `src/index.css:258`

**Evidence:** [seo/crumbs-mixed-case-1440.jpg](screenshots/seo__crumbs-mixed-case-1440.jpg), [seo/product61-412-fonts-normal.jpg](screenshots/seo__product61-412-fonts-normal.jpg), [design/crumbs-mixed-case.jpg](screenshots/design__crumbs-mixed-case.jpg)

- [ ] Done

## Code quality & functional bugs

#### AW-045 · Browser-storage reads are unguarded: blocked storage crashes the first render, and a malformed stored cart ('null', arrays) blanks the site or creates phantom lines

**High** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** All routes → App initial state (age-gate flag read)

**Problem:** vcode-01-crash.mjs 'storage-throws': rootChildren 0, errors ['SecurityError: The operation is insecure.' x3]. Screenshot: screenshots/vcode__storage-blocked-blank.jpg

**Also seen:**
- All routes → cart hydration from localStorage 'aw-cart' — vcode-01-crash.mjs: cart-null → rootChildren 0, 'TypeError: Cannot convert undefined or null to object' x3. cart-array → stored '{"1":4}', checkout line 'Swisher Sweets cigarillos | AW-SS | Choose a variant before submitting.'. cart-string → recovers to {} after the effect. Screenshot: screenshots/vcode__cart-null-blank.jpg

**Fix:** Route every localStorage read and write (age gate flag, cart; App.jsx:46, 146, 148, 233, 265) through a safe helper that uses try/catch. Validate the parsed cart shape (a plain object whose valid line keys map to positive integer quantities) and fall back to defaults on any error.

**Files:** `src/App.jsx:46`, `src/App.jsx:46-50`, `src/App.jsx:146`, `src/App.jsx:148`, `src/App.jsx:233`, `src/App.jsx:265`, `src/lib/lines.js:126`, `src/lib/lines.js:126-131`, `src/main.jsx:6-10`

**Evidence:** [code/storage-blocked-blank.jpg](screenshots/code__storage-blocked-blank.jpg), [code/storage-cart-null-blank.jpg](screenshots/code__storage-cart-null-blank.jpg), [cart/drawer-bare-variant-line.jpg](screenshots/cart__drawer-bare-variant-line.jpg)

- [ ] Done

#### AW-183 · No error boundary: any render error blanks the whole site

**Medium** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** All routes → React root (src/main.jsx)

**Problem:** Playwright (vcode-01-crash.mjs) gave rootChildren 0 and a blank white page for all 5 triggers. Screenshots: screenshots/vcode__malformed-category-blank.jpg and screenshots/vcode__cart-null-blank.jpg

**Fix:** Create src/components/ErrorBoundary.jsx (class component with static getDerivedStateFromError + componentDidCatch that console.errors). Its fallback should show the logo, 'Something went wrong loading this page', a 'Reload' button (window.location.reload()), a 'Go to home' link (href="#/" plus a reload) and the trade-desk phone/email from COMPANY. Wrap <App/> with it in src/main.jsx. Also wrap the route switch inside <main> in App.jsx:315-341 with a second boundary using key={routeToHash(route)}, so one broken page does not remove the header and footer and navigating away resets it.

**Files:** `src/App.jsx:145`, `src/App.jsx:315`, `src/main.jsx:6`

**Evidence:** [code/router-malformed-percent-blank.jpg](screenshots/code__router-malformed-percent-blank.jpg), [code/storage-cart-null-blank.jpg](screenshots/code__storage-cart-null-blank.jpg)

- [ ] Done

#### AW-184 · Money is formatted without thousands separators

**Medium** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/quote line totals and total, cart drawer total, product card/page prices, #/account order history, #/admin orders and products

**Problem:** App.jsx:44 money = `$${Number(n).toFixed(2)}`, and AccountPage.jsx:135/:150 and AdminPage.jsx:122/:335 inline the same toFixed(2). Observed in the local approved-account simulation: line total '$1807.66', checkout total '$2167.05', order history '43 units · $2166.97', admin '$1234.50'. The support pages format with toLocaleString ('$1,500', '$500.00' in DeliveryPage.jsx:12-13 and PolicyPage.jsx:7-8), so the same site shows two money formats.

**Fix:** Create src/lib/format.js exporting formatMoney = (n) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)) and formatMoneyShort (maximumFractionDigits:0) for marketing copy. Replace App.jsx:44, the two inline toFixed calls in AccountPage, the two in AdminPage, and the local money/moneyExact helpers in DeliveryPage and PolicyPage.

**Files:** `src/App.jsx:44`, `src/pages/account/AccountPage.jsx:135`, `src/pages/account/AccountPage.jsx:150`, `src/pages/admin/AdminPage.jsx:122`, `src/pages/admin/AdminPage.jsx:335`, `src/pages/support/DeliveryPage.jsx:12`, `src/pages/support/PolicyPage.jsx:7`

**Evidence:** [code/approved-quote-money-format.jpg](screenshots/code__approved-quote-money-format.jpg), [code/account-order-card-server-totals.jpg](screenshots/code__account-order-card-server-totals.jpg)

- [ ] Done

#### AW-185 · Malformed percent-encoding in the hash crashes the router

**Medium** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/category/<bad>, #/product/<bad> (e.g. a truncated shared link)

**Problem:** parseHash calls decodeURIComponent on raw segments (App.jsx:169-170) with no try/catch. Fresh load of #/category/%E0 or #/product/%E0%A4%A gives a blank page (URIError: URI malformed; #root has 0 children). While already in the app, setting location.hash='#/category/%E0' from #/category/CANDIES throws inside the hashchange listener: the URL changes but the page and title stay on 'Candies', so URL and content disagree. A link cut off mid-escape by an SMS or email client (e.g. …/DRINKS%20%2) triggers this.

**Also seen:**
- #/category/%E0%A4%A (any route with an invalid percent escape) — Loading http://127.0.0.1:3000/#/category/%E0%A4%A throws 'URIError: URI malformed' 3 times. React logs 'The above error occurred in the <App> component… Consider adding an error boundary', and the page is completely white: no header, no footer, no way back. decodeURIComponent is called unguarded in parseHash, which is the useState initialiser, and there is no error boundary. Truncated links pasted from chat or email can trigger this.

**Fix:** Wrap decodeURIComponent in the hash router in try/catch and fall back to the not-found route on malformed percent-escapes (for example #/category/%E0%A4%A), so the app doesn't crash to a blank page (App.jsx:165-186).

**Files:** `src/App.jsx:165`, `src/App.jsx:169`, `src/App.jsx:170`, `src/App.jsx:186`, `src/App.jsx:189`, `src/main.jsx`

**Evidence:** [code/router-malformed-percent-blank.jpg](screenshots/code__router-malformed-percent-blank.jpg), [catalog/malformed-hash-crash-1440.jpg](screenshots/catalog__malformed-hash-crash-1440.jpg)

- [ ] Done

#### AW-186 · Auth loading state is ignored: signed-in users see signed-out pages and a blank checkout form

**Medium** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/account, #/admin, #/quote on reload or direct link while signed in

**Problem:** vcode-03-auth.mjs C/D and vcode-07-adminflash.mjs. Screenshots: screenshots/vcode__account-signedout-flash.jpg, screenshots/vcode__admin-access-denied-flash.jpg, screenshots/vcode__approved-checkout-unrounded-totals.jpg (header shows 'Test Market LLC' signed in while the Business/Contact/Email fields are empty)

**Also seen:**
- #/admin and #/account on a fresh load with a saved session — App passes only `profile` to AdminPage and AccountPage (App.jsx:329, 332). profile is null until getSession and the profiles select both finish. AdminPage renders 'Access denied / Admin role required.' whenever profile is null (AdminPage.jsx:19-27), and AccountPage renders the signed-out 'Sign in to view your account' state (AccountPage.jsx:43-56). A real admin opening a bookmarked #/admin therefore sees an access-denied flash. The server-side bo…
- #/quote for a signed-in user (reload or deep link) — QuotePage seeds the form once from `profile` in the useState initializer (App.jsx:1167-1171). useAuth loads the profile asynchronously: profile starts as null and setProfile runs after getSession and a profiles query (useAuth.js:27, 35, 57). Reloading or opening #/quote directly therefore leaves Business/Contact/Email blank for signed-in buyers. Until the profile arrives, the page also briefly shows the guest state ('Request your quote', 'Pricing…

**Fix:** Respect the auth loading state. On #/account, #/admin and #/quote, render a loading skeleton until the session and profile resolve, instead of flashing the signed-out/'Access denied' view. Prefill the #/quote buyer fields, including phone, when the profile arrives (a useEffect on profile), not only at mount (App.jsx:154, 329-332, 1167-1171; AccountPage.jsx:43; AdminPage.jsx:19).

**Files:** `src/App.jsx:154`, `src/App.jsx:329`, `src/App.jsx:332`, `src/App.jsx:1167`, `src/App.jsx:1167-1171`, `src/lib/useAuth.js:27-58`, `src/lib/useAuth.js:63`, `src/pages/account/AccountPage.jsx:43`, `src/pages/admin/AdminPage.jsx:19`

**Evidence:** [code/account-signed-out-flash.jpg](screenshots/code__account-signed-out-flash.jpg), [code/admin-access-denied-flash.jpg](screenshots/code__admin-access-denied-flash.jpg), [code/approved-quote-money-format.jpg](screenshots/code__approved-quote-money-format.jpg)

- [ ] Done

#### AW-187 · useAuth runs as separate copies that each fetch the profile, and the profile never refreshes

**Medium** · code-quality · Who: **Cursor** · Effort: M · New

**Where:** App, AuthModal, ApplicationDocuments (#/apply for pending accounts)

**Problem:** useAuth is a plain hook called in App.jsx:154, AuthModal.jsx:48 and DocumentUploads.jsx:112. Each call runs its own getSession, onAuthStateChange subscription and profiles fetch. Simulated a pending account on #/apply: 2 identical GET /rest/v1/profiles?id=eq.<uid> requests (one per instance). The profile effect depends only on session.user.id (useAuth.js:46-61), so when staff approve a pending buyer who is signed in, the site keeps showing 'Pricing after approval' until a full reload or sign-out.

**Also seen:**
- src/lib/useAuth.js used by App, AuthModal and ApplicationDocuments — src/lib/useAuth.js:1 says 'Single source of truth', but useAuth (useAuth.js:25) is a plain hook. Each call creates its own session/profile state, calls getSession(), subscribes with onAuthStateChange (useAuth.js:39) and runs its own profiles select (useAuth.js:46-61). It is instantiated separately in App.jsx:154, AuthModal.jsx:48 and DocumentUploads.jsx:112 (ApplicationDocuments). Measured live on #/apply signed out: supabase.auth.stateChangeEmit…
- src/lib/useAuth.js used by App, AuthModal and ApplicationDocuments — useAuth() (src/lib/useAuth.js:25) holds its own state and effects. It is called in App.jsx:154 (always mounted), AuthModal.jsx:48 (mounted only while the sign-in dialog is open, App.jsx:350-354) and DocumentUploads.jsx:112 (ApplicationDocuments, mounted on #/apply for pending accounts, ApplyPage.jsx:22). Each mounted instance opens its own onAuthStateChange subscription (useAuth.js:39) and runs its own `profiles select *` (useAuth.js:49-53). The …

**Fix:** Move auth and profile state into one AuthProvider context with a single onAuthStateChange subscription and one profile fetch, consumed by App, AuthModal and ApplicationDocuments. Add a refreshProfile (and/or realtime subscription) so approval status updates without a reload (useAuth.js:1-61).

**Files:** `src/App.jsx:154`, `src/components/AuthModal.jsx:48`, `src/components/DocumentUploads.jsx:112`, `src/lib/useAuth.js:1`, `src/lib/useAuth.js:25`, `src/lib/useAuth.js:39`, `src/lib/useAuth.js:46`, `src/lib/useAuth.js:61`, `src/main.jsx:6`

- [ ] Done

#### AW-188 · Router accepts unknown and non-canonical routes: unknown paths show the homepage, and invalid or wrong-case category/sub-line URLs show a fake page with a made-up breadcrumb and '0 of 68 items'

**Medium** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/foo, #/Account, #/product/ (no id), #/category/ (no key), #/product/01

**Problem:** parseHash falls back to { page: 'home' } for anything it doesn't recognise (App.jsx:175). #/foo, #/Account, #/product/ and #/category/ all render the full homepage with the homepage title while the URL keeps the bad hash, so a typo or broken link looks like a redirect. #/product/01 renders product 1 (Number('01')), creating a duplicate URL. #/category/tobacco (lowercase) shows 'Department not found' although TOBACCO exists.

**Also seen:**
- #/category/TOBACCO/<unknown sub>, #/category/tobacco — #/category/TOBACCO/Nonexistent%20Line renders title 'Nonexistent Line · Tobacco · Wholesale Catalog', breadcrumb 'HOME / TOBACCO / NONEXISTENT LINE', no pill active, a removable chip 'Nonexistent Line ×', 'Showing 0 of 68 items in Nonexistent Line' and the generic 'No products match' box. #/category/TOBACCO/cigarettes (lowercase) gives the same 0-result page even though 'Cigarettes (5)' exists. #/category/tobacco and #/category/Tobacco both give …

**Fix:** Validate route params in the hash parser (App.jsx:95-98, 165-170). Match department keys case-insensitively and redirect to the canonical casing. Redirect non-canonical product ids (01, 1.5) to the canonical id. Render a real NotFound view, with search and department links, for unknown sub-lines, departments, paths and empty ids (#/product/, #/category/). Never build breadcrumbs, H1s or titles from unvalidated params.

**Files:** `netlify.toml:9-12`, `src/App.jsx:94-118`, `src/App.jsx:95`, `src/App.jsx:98`, `src/App.jsx:165`, `src/App.jsx:165-176`, `src/App.jsx:169`, `src/App.jsx:170`, `src/App.jsx:175`, `src/App.jsx:186`, `src/App.jsx:866`, `src/App.jsx:867`, `src/App.jsx:868`, `src/App.jsx:877`, `src/App.jsx:898-905`, `src/App.jsx:1056-1063`, `src/lib/useAuth.js:10`

**Evidence:** [seo/unknown-route-renders-home.jpg](screenshots/seo__unknown-route-renders-home.jpg), [seo/product-not-found.jpg](screenshots/seo__product-not-found.jpg), [catalog/invalid-subline-1440.jpg](screenshots/catalog__invalid-subline-1440.jpg), [code/router-unknown-sub.jpg](screenshots/code__router-unknown-sub.jpg)

- [ ] Done

#### AW-326 · Account order history fetch has no cancellation or reset

**Low** · code-quality · Who: **Cursor** · Effort: S · New

**Where:** #/account → Order history

**Problem:** The AccountPage effect (AccountPage.jsx:30-41) has no cancelled flag and never resets orders/error when profile.id changes. After signing out and in as another account without a reload, the previous account's orders stay visible until the new request resolves, and a late response from the old request can overwrite the new one. Load errors are shown raw ('Couldn't load orders: <PostgREST message>', line 114).

**Fix:** At the start of the effect call setOrders(null); setError(null); add let cancelled = false and check it before setting state; return () => { cancelled = true; }. Replace the raw error text with 'We couldn’t load your orders. Refresh, or call the trade desk.' and console.error the detail.

**Files:** `src/pages/account/AccountPage.jsx:30`, `src/pages/account/AccountPage.jsx:114`

- [ ] Done

#### AW-327 · Navigation pushes duplicate history entries and 'Clear all' jumps to the top

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/category/<DEPT> → 'Clear all' / 'All (n)' pill / re-clicking the current department

**Problem:** navigate() always pushState()s (App.jsx:207-211), even when the target hash equals the current one. clearFilters always calls goCategory(category, null) (App.jsx:894), even when no product line is selected. Measured on #/category/TOBACCO: with only 'Bestsellers' ticked and scrollY 600, 'Clear all' took history.length 3→4 and scrollY 600→0. Clicking the already-active 'All (68)' pill twice took history.length 4→6, so Back appears to do nothing several times in a row.

**Also seen:**
- Header logo on #/, footer 'Contact & visit' on #/contact, and other self-links — navigate() always calls history.pushState, even when the target hash equals the current one. Clicking the logo twice on #/ grew history.length by 2. Clicking 'Contact & visit' twice while on #/contact also grew it by 2. The user then has to press Back several times with nothing visibly changing.
- #/category/<DEPT> → 'Clear all' in sidebar heading, chip row, drawer and empty state — On #/category/CANDIES with sort=name-desc, search 'gum' and scrollY=700, clicking 'Clear all (1)' increased history.length by 1 (#/category/CANDIES → #/category/CANDIES) and scrolled to y=0. So the first Back press after clearing seems to do nothing. The sort (name-desc) is not reset even though the label says 'all'. Removing a tag chip doesn't navigate, but removing the sub-line chip does, so the two behave differently.

**Fix:** In the navigate helper (App.jsx:207-214), skip pushing a history entry when the target hash equals the current one, and use replaceState for filter-only changes such as 'Clear all' and the 'All (n)' pill. Don't scroll to top when only filters change (App.jsx:890-908).

**Files:** `src/App.jsx:207`, `src/App.jsx:208`, `src/App.jsx:214`, `src/App.jsx:890`, `src/App.jsx:894`, `src/App.jsx:908`, `src/App.jsx:962`

- [ ] Done

#### AW-328 · Leftover exports and data still ship: SHOP_CATS, BRANDS, TRUST, FAQS, WELCOME_OFFERS and more

**Low** · code-quality · Who: **Cursor** · Effort: S · New

**Where:** src/data/content.js, src/data/products.js, src/lib/*

**Problem:** Unused, confirmed by grep: SHOP_CATS (content.js:26-35), BRANDS (:48), TRUST (:50-55), FAQS (:57-74, which also contradicts live copy: '24 hours' vs 'one business day', and 'orders of $1,500 or more' vs 'over $1,500'), WELCOME_OFFERS (:76-101), COMPANY.whatsapp (:10), STORAGE.user and STORAGE.welcome ('aw-welcome-seen', :106-107). Also unused: NAV_CATEGORIES (products.js:770), useCatalog's `source` state (useCatalog.js:14, App reads only products), orders.js' `source: 'supabase'` (:34), AuthModal's `open` prop and its `if (!open) return null` (App always passes open), and the HERO_SLIDES fields eyebrow/sub/cta1/cta2/accent/goCat (content.js:42-45; HeroCarousel reads only img/picture/title/videoUrl, so the slides link nowhere). Stale comments: content.js:1-2 ('FAQs, and welcome-popup offers') and lines.js:49-51 ('the catalog has a few duplicate SKUs'; there are no duplicate SKUs in the 368 rows).

**Also seen:**
- src/data/content.js (feeds the homepage) — grep over src/: the only content.js imports are COMPANY, ANNOUNCEMENTS, STORAGE, HERO_SLIDES, ORDER_MINIMUM (App.jsx:4) plus COMPANY/FREE_DELIVERY_THRESHOLD/ORDER_MINIMUM in support pages. STORAGE is used only for .age and .cart (App.jsx:146, :148, :225, :265); .user and .welcome are never read. HeroCarousel (App.jsx:623-697) reads only img, picture, videoUrl and title from each slide; eyebrow, sub, cta1, cta2, accent and goCat are never read. co…
- src/data/content.js exports (not rendered) — `grep -rlw` for each name across src/ and index.html matches only its defining file. content.js:63 (FAQS) says 'Most applications are approved within 24 hours'. AuthModal.jsx:172, App.jsx:786 and AccountPage.jsx:93 say 'within one business day'. content.js:71 says discounts are 'applied automatically at checkout', but the site has no checkout discounts. The quote flow says the trade desk confirms pricing. TRUST (content.js:50-55) also makes unver…
- src/data/content.js (not rendered) — These exports are never imported: SHOP_CATS (content.js:26-35, stale counts CANDIES 57 / FOOD STUFF 25 vs live 58 / 24); BRANDS (:48); TRUST (:50-55: 'Every SKU verified', 'Three generations serving Southeast retailers'); FAQS (:57-74: 'approved within 24 hours' vs 'one business day' elsewhere, 'Discounts kick in starting at 5 cases (5%)… applied automatically at checkout', 'orders of $1,500 or more' vs 'over $1,500', 'Contact your trade rep for …
- src/data/content.js, src/data/products.js, src/lib/useCatalog.js, src/lib/lines.js, src/pages/account/QuickReorder.jsx — grep of src/ shows App.jsx:4 imports only COMPANY, ANNOUNCEMENTS, STORAGE, HERO_SLIDES and ORDER_MINIMUM from content.js. The other importers use only COMPANY, FREE_DELIVERY_THRESHOLD and ORDER_MINIMUM. So SHOP_CATS (content.js:26), BRANDS (:48), TRUST (:50), FAQS (:57) and WELCOME_OFFERS (:76) have zero importers. STORAGE.user ('aw-trade-user', content.js:106) and STORAGE.welcome ('aw-welcome-seen', :107) are never referenced; only STORAGE.age a…

**Fix:** Delete the unused exports and data (SHOP_CATS, BRANDS, TRUST, FAQS, WELCOME_OFFERS, stale department counts, demo notes and unverified claims) from src/data/content.js and src/data/products.js, and remove the outdated comments in useCatalog.js, lines.js and QuickReorder.jsx, so stale claims can't resurface.

**Files:** `scripts/build-seed.mjs:58`, `src/App.jsx:821`, `src/components/AuthModal.jsx:88`, `src/data/content.js:1`, `src/data/content.js:10`, `src/data/content.js:26`, `src/data/content.js:38`, `src/data/content.js:42`, `src/data/content.js:48`, `src/data/content.js:50`, `src/data/content.js:57`, `src/data/content.js:76`, `src/data/content.js:103`, `src/data/content.js:106`, `src/data/content.js:107`, `src/data/products.js:5`, `src/data/products.js:763`, `src/data/products.js:768`, `src/data/products.js:770`, `src/lib/lines.js:49`, `src/lib/lines.js:50`, `src/lib/orders.js:34`, `src/lib/useCatalog.js:14`, `src/lib/useCatalog.js:24`, `src/pages/account/QuickReorder.jsx:2`, `src/pages/support/CatalogIndexPage.jsx:52`

- [ ] Done

#### AW-329 · README describes an older architecture

**Low** · code-quality · Who: **Cursor** · Effort: S · New

**Where:** README.md

**Problem:** README.md:76 says 'Tailwind CSS 3, still generated for Account, Admin, and the preflight reset', which contradicts README.md:5 ('Tailwind stays in the build only for its preflight reset'). README.md:77 says 'Lucide React, still used by Account and Admin', but lucide-react is in neither package.json nor src/. README.md:26 describes a Netlify Forms fallback that does not exist (orders.js throws instead). README.md:61 points departments at NAV_CATEGORIES, which nothing uses; App derives them with departmentsFor() at App.jsx:129. Also stale: README.md:13 describes the home page as 'warehouse hero, department strip…', but there is no department strip and the hero is a photo carousel. The routes table (lines 11-18) omits #/catalog, #/contact, #/delivery, #/shipping, #/privacy, #/terms, #/apply and #/reset-password. The README.md:65 note about leftover exports goes stale once AW-328 is done.

**Fix:** In README.md: (1) Replace the Stack list (lines 73-78) with: React 18, Vite 5, plain CSS in src/index.css, Supabase (Postgres + Auth + RLS + submit_quote RPC). Mention Tailwind only as the preflight reset, or drop it if code-31 removes it, and delete the Lucide line. (2) Replace line 26 with 'Quotes and orders are saved by the submit_quote RPC; if Supabase is unavailable the quote page asks the buyer to call the trade desk.' (3) Change the line 61 row to 'departmentsFor() in src/App.jsx (derived from cat and sub in src/data/products.js)'. (4) Add the 8 support routes to the routes table (after line 18), e.g. '| `#/catalog` | All products index |', '| `#/contact` | Contact & visit |' and so on. (5) Rewrite line 13 to describe the actual home sections: hero carousel, new arrivals, collections, bestsellers, services, shop by department, account application. (6) Delete line 65 when AW-328 is done.

**Files:** `README.md:13`, `README.md:18`, `README.md:26`, `README.md:61`, `README.md:65`, `README.md:76`, `README.md:77`

- [ ] Done

#### AW-330 · App.jsx is a 1,441-line monolith holding 13 components plus routing, SEO and pricing

**Low** · code-quality · Who: **Cursor** · Effort: L · New

**Where:** src/App.jsx

**Problem:** App.jsx defines App, AgeGate, Header, MobileMenu, HeroCarousel, HomePage, ProductCard, CategoryPage, ProductPage, TradeDeskContact, QuotePage, Footer, HelpDialog and CartDrawer, plus the hash router (165-185), page meta (84-127), search scoring (52-73) and tier pricing (27-32). Pages get one `shared` bag spread into every component (App.jsx:284-288, then {...props} into ProductCard). The support/account/admin pages already live in src/pages/.

**Fix:** Split without behaviour changes: src/lib/router.js (parseHash, routeToHash, navigate helpers), src/lib/meta.js (pageMeta, setMeta, clip), src/lib/search.js (getSearchMatches, productText), src/lib/pricing.js (priceForProfile), src/lib/format.js (money, initials, catLabel). Components go to src/components/{AgeGate,Header,MobileMenu,HeroCarousel,ProductCard,Footer,HelpDialog,CartDrawer}.jsx and pages to src/pages/{HomePage,CategoryPage,ProductPage,QuotePage}.jsx. Pass explicit props instead of spreading `shared`.

**Files:** `src/App.jsx:1`, `src/App.jsx:165`, `src/App.jsx:284`, `src/App.jsx:802`

- [ ] Done

#### AW-331 · Helpers and markup are duplicated across files

**Low** · code-quality · Who: **Cursor** · Effort: M · New

**Where:** Contact snippets, error text, money, cart line rendering, line-key parsing

**Problem:** Four near-identical 'Call X or email Y' components: TradeDeskContact (App.jsx:1157), TradeDesk (AuthModal.jsx:43), CallOrEmail (SupportShell.jsx:36) and ServiceUnavailable (ServiceUnavailable.jsx:8). The /fetch|network|load failed/i check plus 'unavailable right now' message exists three times (AuthModal.jsx:20-25, documents.js:39-46, ResetPasswordPage.jsx:28-30). Money formatting is implemented five ways (see the money finding). The cart line <li> (thumb, info, stepper, remove) is written twice: CartDrawer App.jsx:1399-1417 and QuotePage App.jsx:1244-1264. ProductCard re-implements parseLineKey with String(k).split('::') (App.jsx:808).

**Fix:** Keep CallOrEmail (SupportShell.jsx) as the single contact snippet and use it in App.jsx and AuthModal.jsx. Add src/lib/errors.js with isNetworkError(err) and unavailableMessage(what), used by the three callers. Extract a <CartLine item onInc onDec onRemove onChoose showPrice/> component used by CartDrawer and QuotePage. In ProductCard use parseLineKey(k).productId.

**Files:** `src/App.jsx:808`, `src/App.jsx:1157`, `src/App.jsx:1244`, `src/App.jsx:1399`, `src/components/AuthModal.jsx:20`, `src/components/AuthModal.jsx:43`, `src/lib/documents.js:39`, `src/pages/support/ResetPasswordPage.jsx:28`, `src/pages/support/SupportShell.jsx:36`

- [ ] Done

#### AW-332 · Redundant 'flavors' field duplicates variants.length and can drift

**Low** · catalog-data · Who: **Cursor** · Effort: M · New

**Where:** Product cards '· N variants', category 'Has flavors or variants' filter and 'Most variants' sort, catalog index

**Problem:** All 368 static rows have flavors === variants.length, and so does the live Supabase response on the dev server (368 rows, 0 mismatches). Readers of p.flavors: App.jsx:821 (card '· N variants'), :879 ('Has flavors or variants' filter), :885 ('Most variants' sort) and CatalogIndexPage.jsx:52. Cart and ordering logic uses variantList(p) from lines.js:4. The admin product editor saves only { name, brand, price, tag, active } (AdminPage.jsx:324), so variants/flavors can drift only through Supabase dashboard or SQL edits, and nothing keeps them in sync there. scripts/build-seed.mjs:18 lists 'flavors' as a seed column, and :58 enforces flavors === variants.length only at seed time.

**Fix:** Add `export const variantCount = (p) => variantList(p).length;` to src/lib/lines.js. Replace p.flavors with variantCount(p) at App.jsx:821, 879 (`variantCount(p) === 0`) and 885 (`variantCount(b) - variantCount(a)`), and at CatalogIndexPage.jsx:52. Then remove `flavors` from the CATALOG rows and the products.js:5 comment, remove 'flavors' from COLUMNS and the check at scripts/build-seed.mjs:18/58, and add a new migration `alter table public.products drop column flavors;`.

**Files:** `scripts/build-seed.mjs:18`, `scripts/build-seed.mjs:58`, `src/App.jsx:821`, `src/App.jsx:879`, `src/App.jsx:885`, `src/data/products.js:5`, `src/pages/support/CatalogIndexPage.jsx:52`, `supabase/migrations/20260517000000_initial_schema.sql:74`

- [ ] Done

#### AW-333 · Modal scroll lock doesn't compensate for the scrollbar

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: desktop browsers with classic scrollbars (Windows, Linux, macOS set to 'always show scrollbars')

**Where:** Cart drawer, Help, sign-in/apply dialog, mobile menu, filter drawer

**Problem:** Setup: Chromium launched without --hide-scrollbars, with a styled 15px ::-webkit-scrollbar to emulate Windows/Linux classic scrollbars, at #/ 1440×900. Before opening the cart: scrollbar width 15px, main/header left edge at x=72.5. With the cart drawer open: scrollbar width 0, left edge at x=80, so the whole page shifts 7.5px right, and back again on close. Variants tested: html{scrollbar-gutter:stable} still shifted 7.5px; body or html+body gutter still shifted 7.5px; html{scrollbar-gutter:stable;overflow-y:auto} shifted 0px, but a mouse wheel over the page scrolled it 800px behind the open drawer (lock broken); body padding-right set to the measured scrollbar width shifted 0px and scrollY stayed 0 (lock intact). Cause: ModalLayer.jsx:31-44 syncBackground sets only document.body.style.overflow. The default macOS overlay scrollbars hide the issue.

**Fix:** In ModalLayer.jsx syncBackground(), replace line 43 with: `if (open && document.body.style.overflow !== 'hidden') { const sbw = window.innerWidth - document.documentElement.clientWidth; document.body.style.paddingRight = sbw > 0 ? `${sbw}px` : ''; document.body.style.overflow = 'hidden'; } else if (!open) { document.body.style.overflow = ''; document.body.style.paddingRight = ''; }`. Measure before setting overflow, and only on the first layer, so that stacked dialogs do not re-measure 0. Do not rely on `scrollbar-gutter: stable` alone.

**Files:** `src/components/ModalLayer.jsx:31`, `src/components/ModalLayer.jsx:43`

- [ ] Done

## Multi-tab & session state

#### AW-046 · Cart changes in one tab overwrite another tab's cart: lines vanish silently and cleared carts come back

**High** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: all (tested 1280x800)

**Where:** All routes → header Cart badge, cart drawer and #/quote, with the site open in two or more tabs or windows

**Problem:** Script pw/gap1s-01-cart.mjs, two tabs in one browser:
(1) Tab 1 on #/product/14 (Kite) clicks 'Add to quote', giving aw-cart {"14":1}.
(2) Tab 2 on #/product/115 (Dove), opened earlier, clicks 'Add to quote', giving aw-cart {"115::original":1}. The Kite line is gone.
(3) Tab 1 still shows badge 1 and its drawer lists only 'Kite cigarette tobacco', although Dove is now the only line in storage.
(4) Tab 1 adds again, giving {"14":2}. Dove is now lost. After reloading, tab 2 shows badge 2 with Kite only.

Script gap1s-11-clear.mjs:
- Tab A on #/quote clicks 'Clear all items', giving aw-cart {}. Tab B still shows badge 8.
- Tab B adds Pure Guard 5W-30, giving {"14":5,"115::original":3,"57::5w-30":1}. The cleared cart is back.
- Reloading #/quote in tab A lists all three lines. The same thing happens after 'Back to home' clears a submitted order, so a duplicate order becomes possible.

Stale-catalog angle, script gap1s-08-stale.mjs:
- Tab B loads a catalog in which the Swisher 'Diamond' variant was renamed. normalizeCart drops the line and writes {}.
- The older tab A still shows the line. On its next add it writes {"14":1,"1::diamond":1} back, and the drawer shows 'Swisher Sweets cigarillos — Diamond'. Reloading B drops the line again, so it flickers depending on which tab wrote last.
- A quote submitted from any tab sends only that tab's in-memory lines.

Cause: the cart is read once at mount (App.jsx:148). Every mutation writes that tab's whole in-memory object back (the effect at App.jsx:225). There is no 'storage' listener anywhere in src (grep).

**Fix:** In src/App.jsx:
1) Delete the blanket write effect at line 225.
2) After line 231, define a write-through helper that runs OUTSIDE any setState updater (StrictMode runs updaters twice in dev):
const updateCart = (fn) => { const base = normalizeCart(safeReadJson(STORAGE.cart, {}), products); const next = fn(base); safeWriteJson(STORAGE.cart, next); setCart(next); };
3) Change addLine (244), addLines (249-259), decLine (261), removeLine (262) and clearCart (263) to call updateCart(c => …), keeping the bodies they pass to setCart today.
4) Replace the normalize effect (229-231) with:
useEffect(() => { const next = normalizeCart(safeReadJson(STORAGE.cart, {}), products); setCart(next); safeWriteJson(STORAGE.cart, next); }, [products]);
5) Add a sync effect:
useEffect(() => { const sync = () => setCart(normalizeCart(safeReadJson(STORAGE.cart, {}), products)); const onStorage = (e) => { if (e.storageArea === window.localStorage && (e.key === STORAGE.cart || e.key === null)) sync(); }; const onVis = () => { if (document.visibilityState === 'visible') sync(); }; window.addEventListener('storage', onStorage); document.addEventListener('visibilitychange', onVis); return () => { window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', onVis); }; }, [products]);

Acceptance test:
- With two tabs open, add a different product in each. localStorage holds both lines, and both badges show 2 without a reload.
- 'Clear all items' in one tab sets the other tab's badge to 0 right away.
- A single click on 'Add to quote' in dev adds exactly 1.

**Files:** `src/App.jsx:148`, `src/App.jsx:225`, `src/App.jsx:229-231`, `src/App.jsx:239-263`, `src/main.jsx:7`

**Evidence:** [gap1-multitab-session/cart-tab1-after-add.jpg](screenshots/gap1-multitab-session__cart-tab1-after-add.jpg), [gap1-multitab-session/cart-tab2-before-add-stale-badge.jpg](screenshots/gap1-multitab-session__cart-tab2-before-add-stale-badge.jpg), [gap1-multitab-session/cart-tab2-after-add.jpg](screenshots/gap1-multitab-session__cart-tab2-after-add.jpg), [gap1-multitab-session/cart-tab1-drawer-stale.jpg](screenshots/gap1-multitab-session__cart-tab1-drawer-stale.jpg), [gap1-multitab-session/cart-tab2-after-reload-line-lost.jpg](screenshots/gap1-multitab-session__cart-tab2-after-reload-line-lost.jpg), [gap1-multitab-session/cleared-cart-resurrected-by-other-tab.jpg](screenshots/gap1-multitab-session__cleared-cart-resurrected-by-other-tab.jpg), [gap1-multitab-session/stale-catalog-tabB-empty-quote.jpg](screenshots/gap1-multitab-session__stale-catalog-tabB-empty-quote.jpg), [gap1-multitab-session/stale-catalog-tabA-drawer-resurrects-line.jpg](screenshots/gap1-multitab-session__stale-catalog-tabA-drawer-resurrects-line.jpg)

- [ ] Done

#### AW-047 · If Sign Out can't reach Supabase, the session stays saved: the header says signed out, but a reload signs the previous buyer back in, and other tabs stay signed in

**High** · security-backend · Who: **Cursor** · Effort: S · New · Viewports: all (tested 1280x900)

**Where:** Header 'Sign Out' (desktop) and Menu → Account → 'Sign Out' (mobile), on any route

**Problem:** Script pw/gap1s-03-signout.mjs, with a mocked approved session and the POST /auth/v1/logout?scope=global aborted, as on flaky store Wi-Fi, a captive portal or a Supabase outage:
- After clicking Sign Out, the header shows 'Sign In or Sign Up' and the page goes to #/.
- localStorage 'aw-auth' (the full session with refresh token) is still present.
- page.reload() shows 'Test Market LLC · Sign Out' again, so the next person on the shared computer is signed in as the previous buyer.

Script gap1s-04-multitab-signout.mjs (abort case), admin profile: after Sign Out in a third tab, a tab on #/account still shows 'Test Market LLC… Role Admin', and a tab on #/admin still shows the Orders / Accounts / Products admin UI. With a successful (204) logout, the same tabs correctly switch to signed out.

Cause:
- auth-js _signOut returns {error} and skips _removeSession when the logout request fails with anything other than 401/403/404 (node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:3188-3196).
- useAuth.signOut ignores that result and only calls setProfile(null). The session state and storage stay as they were.
- handleLogout then navigates home as if sign-out worked.

**Fix:** Rewrite signOut in src/lib/useAuth.js:84-88:
const signOut = useCallback(async () => { if (!supabase) return { ok: true }; const { error } = await supabase.auth.signOut({ scope: 'local' }); if (error) { try { localStorage.removeItem('aw-auth'); localStorage.removeItem('aw-auth-code-verifier'); } catch {} } setSession(null); setProfile(null); setProfileFor(null); return { ok: !error }; }, []);

In the same hook, add a window 'storage' listener: when e.key === 'aw-auth' and e.newValue === null, call setSession(null) and setProfile(null). Other tabs then sign out even when there is no broadcast.

In App.jsx:266, make handleLogout await the result. If !ok, still navigate home and show a notice: 'Signed out on this computer. We couldn't reach the server, so other devices may still be signed in.'

**Files:** `src/App.jsx:266`, `src/lib/useAuth.js:84-88`

**Evidence:** [gap1-multitab-session/signout-abort-home-cart-kept.jpg](screenshots/gap1-multitab-session__signout-abort-home-cart-kept.jpg), [gap1-multitab-session/signout-abort-after-reload.jpg](screenshots/gap1-multitab-session__signout-abort-after-reload.jpg), [gap1-multitab-session/multitab-abort-account-tab-after-signout.jpg](screenshots/gap1-multitab-session__multitab-abort-account-tab-after-signout.jpg), [gap1-multitab-session/multitab-abort-admin-tab-after-signout.jpg](screenshots/gap1-multitab-session__multitab-abort-admin-tab-after-signout.jpg)

- [ ] Done

#### AW-048 · When the session ends, the site silently switches to guest mode: mid-checkout, 'Submit order' becomes an unpriced guest 'Submit quote request' with no message

**High** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all (tested 1280x900)

**Where:** #/quote (also #/account, cart drawer, all price displays) when the refresh token is revoked or the token endpoint can't be reached

**Problem:** Script pw/gap1s-06-midexpiry.mjs. An approved silver buyer's session expires in 125 s, and the token refresh returns 400 invalid_grant (what Supabase returns once the refresh token has been revoked, for example after a global Sign Out on another device; see the scope=global finding).

At t=0 on #/quote (prefilled):
- eyebrow 'CHECKOUT', H1 'Place your order'
- total '20 units | $823.27'
- button 'Submit order ↗'

About 30 s later, with no user action:
- header 'Sign In or Sign Up'
- eyebrow 'QUOTE REQUEST', H1 'Request your quote'
- total 'Pricing after sign-in'
- button 'Submit quote request ↗'
- no role=alert or role=status message; the form fields stay filled

A submit now runs submit_quote without a JWT:
- enforce_order_header sets user_id := auth.uid() = null.
- enforce_order_item_price leaves unit_price null for non-account orders.
- The order therefore never appears in #/account history and has no prices.

Offline variant, script gap1s-05-expiry.mjs (expired session, token endpoint unreachable):
- #/account shows 'Sign in to view your account…' although 'aw-auth' is still stored and the session is recoverable.
- 7 refresh attempts in 13 s, each logging console.error 'TypeError: Failed to fetch'.
- Nothing tells the buyer the server is unreachable.

With 400: 'aw-auth' is removed, and one 'AuthApiError: Invalid Refresh Token' is logged. No stale signed-in UI, loop or page error was observed.

**Fix:** 1) In useAuth (lines 33-44):
- Keep a ref userSignOutRef, set to true inside signOut().
- In onAuthStateChange, if event === 'SIGNED_OUT' and a session existed and userSignOutRef.current is false, setSessionEnded(true). Export sessionEnded and clearSessionEnded.
- In the getSession().then handler, if the returned error is an AuthRetryableFetchError, setConnectionProblem(true) instead of treating the user as signed out.

2) In App, render a dismissible banner below the header when sessionEnded is true: 'Your session ended. Sign in again to see your account pricing. Your cart is still here.' Its [Sign in] button calls openSignin. Show a separate banner when connectionProblem is true: 'Can't reach the account service — retrying.'

3) In QuotePage, add const wasApproved = useRef(isApprovedBuyer). If wasApproved.current && !isApprovedBuyer:
- Show <p className="form-error" role="alert">You were signed out. Sign in again to place this as an order.</p> above the submit button.
- Disable the submit (line 1296) until the buyer signs in again, or clicks an explicit 'Send as a guest quote instead' link that sets wasApproved.current = false.

**Files:** `src/App.jsx:159-161`, `src/App.jsx:1165-1200`, `src/App.jsx:1296`, `src/lib/useAuth.js:33-44`

**Evidence:** [gap1-multitab-session/midexpiry-before.jpg](screenshots/gap1-multitab-session__midexpiry-before.jpg), [gap1-multitab-session/midexpiry-after-silent-signout.jpg](screenshots/gap1-multitab-session__midexpiry-after-silent-signout.jpg), [gap1-multitab-session/expired-abort-account.jpg](screenshots/gap1-multitab-session__expired-abort-account.jpg), [gap1-multitab-session/expired-400-account.jpg](screenshots/gap1-multitab-session__expired-400-account.jpg)

- [ ] Done

#### AW-189 · Signing out leaves the buyer's cart on the device, and the lines carry into the next person's account and order

**Medium** · security-backend · Who: **Cursor** · Effort: M · New · Viewports: all (tested 1280x900)

**Where:** Header Sign Out → header Cart badge, cart drawer, #/quote on a shared store computer

**Problem:** Script pw/gap1s-03-signout.mjs. A signed-in buyer has aw-cart {"14":3,"115::original":2}.
- After Sign Out (with both a successful 204 and a failed logout), the header shows 'Sign In', the Cart badge still reads 5, and aw-cart is unchanged.
- The next person opening #/quote sees 'Kite cigarette tobacco' and 'Dove bar soap — Original'.

Script gap1s-12-nextuser.mjs:
- Buyer A (Alpha Food Mart) signs out, and buyer B (Bravo Tobacco Outlet) signs in on the same browser.
- A's 4× Kite line is now in B's checkout, priced at B's tier ('AW-KITE · $41.16 each', line total $164.65), under the H1 'Place your order'.

The cart uses one global key, 'aw-cart' (content.js:105). Nothing clears it or namespaces it by account.

**Fix:** In src/App.jsx:
1) Derive the key only after auth has settled:
const cartKey = (auth.loading || (auth.session && !auth.profileReady)) ? null : (profile?.id ? `${STORAGE.cart}:${profile.id}` : `${STORAGE.cart}:guest`);

2) Add const loadedKeyRef = useRef(null). Change line 148 to useState({}), and add an effect on [cartKey, products]:
if (!cartKey) return;
let next = normalizeCart(safeReadJson(cartKey, {}), products);
if (loadedKeyRef.current?.endsWith(':guest') && cartKey !== loadedKeyRef.current) { const guest = safeReadJson(loadedKeyRef.current, {}); for (const [k, q] of Object.entries(guest)) next[k] = (Number(next[k]) || 0) + Number(q); localStorage.removeItem(loadedKeyRef.current); }
loadedKeyRef.current = cartKey; setCart(next); safeWriteJson(cartKey, next);
The merge runs only on a real guest-to-account transition; a reload goes from null to the account key, so nothing is double-counted.

3) Replace the write effect at line 225 with:
useEffect(() => { if (cartKey && loadedKeyRef.current === cartKey) safeWriteJson(cartKey, cart); }, [cart, cartKey]);

4) In handleLogout (266), after signOut:
localStorage.removeItem(`${STORAGE.cart}:guest`); setCart({}); loadedKeyRef.current = null;
The account's own cart stays under its key and comes back at that account's next sign-in.

5) One-time migration at startup: if 'aw-cart' exists, copy it to `${STORAGE.cart}:guest`, then remove 'aw-cart'.

6) The cross-tab 'storage' listener from the cart-sync finding must compare e.key with the current cartKey.

Acceptance test:
- Buyer A adds 3 items and signs out: badge shows 0.
- Buyer B signs in: B's cart does not contain A's lines.
- A signs back in: A's 3 items return.
- Reloading while signed in never shows an empty cart and never doubles quantities.

**Files:** `src/App.jsx:148`, `src/App.jsx:225`, `src/App.jsx:229-231`, `src/App.jsx:266`, `src/data/content.js:103-108`

**Evidence:** [gap1-multitab-session/signout-204-home-cart-kept.jpg](screenshots/gap1-multitab-session__signout-204-home-cart-kept.jpg), [gap1-multitab-session/signout-204-next-user-quote.jpg](screenshots/gap1-multitab-session__signout-204-next-user-quote.jpg), [gap1-multitab-session/nextuser-quote-tab-previous-buyer-details-under-new-account.jpg](screenshots/gap1-multitab-session__nextuser-quote-tab-previous-buyer-details-under-new-account.jpg)

- [ ] Done

#### AW-190 · An open #/quote tab keeps the previous buyer's business, contact, email, phone and address after sign-out or an account switch

**Medium** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: all (tested 1280x900)

**Where:** #/quote → 'Your details' form in a tab left open while the account changes in another tab (shared device)

**Problem:** Script pw/gap1s-04-multitab-signout.mjs:
- A tab on #/quote is prefilled 'Test Market LLC / Test Buyer / buyer@example.test'.
- After a successful Sign Out in another tab, this tab's header shows 'Sign In', the eyebrow reads 'QUOTE REQUEST' and the button reads 'Submit quote request'.
- The Business, Contact and Email fields still hold the signed-out buyer's details.

Script gap1s-12-nextuser.mjs:
- Buyer A's #/quote tab has A's details plus a typed phone '205-000-0001' and street '1 Alpha Way'.
- A signs out and B signs in from another tab.
- The tab's header now reads 'Bravo Tobacco Outlet · Sign Out', with H1 'Place your order'.
- The form still reads 'Alpha Food Mart / Alice Alpha / alpha@example.test / 205-000-0001 / 1 Alpha Way'. Submitting would create an order in B's account with A's contact details and ship-to address.
- In the same run, B's #/account tab showed A's order 'ALW-Q-11111 · 12 units · $480.00' with a Reorder button under B's name until B's fetch returned. This is the privacy impact of the already-known 'order history fetch has no reset' item.

Cause: QuotePage seeds `data` from the profile only once, in useState (App.jsx:1167-1171).

**Fix:** In QuotePage, after the useState at 1167, add:
const profileId = profile?.id ?? null; const seededFor = useRef(profileId);
useEffect(() => { if (seededFor.current === profileId) return; const hadAccount = seededFor.current !== null; seededFor.current = profileId; setData(d => ({ ...d, business: profile?.business || '', contact: profile?.name || '', email: profile?.email || '', ...(hadAccount ? { phone: '', shipStreet: '', shipCity: '', shipState: '', shipZip: '', notes: '' } : {}) })); }, [profileId]);

This also fills the form when the profile arrives after mount. In App.jsx:327, render <AccountPage key={profile?.id || 'guest'} …/> so the order list and Quick Reorder state reset whenever the account changes.

**Files:** `src/App.jsx:323-330`, `src/App.jsx:1167-1172`

**Evidence:** [gap1-multitab-session/multitab-204-quote-tab-after-signout.jpg](screenshots/gap1-multitab-session__multitab-204-quote-tab-after-signout.jpg), [gap1-multitab-session/nextuser-quote-tab-previous-buyer-details-under-new-account.jpg](screenshots/gap1-multitab-session__nextuser-quote-tab-previous-buyer-details-under-new-account.jpg), [gap1-multitab-session/nextuser-account-tab-B-sees-A-orders.jpg](screenshots/gap1-multitab-session__nextuser-account-tab-B-sees-A-orders.jpg)

- [ ] Done

#### AW-191 · Open tabs never refresh the catalog, so a long-lived tab keeps old prices, deactivated products and renamed variants until reload

**Medium** · functional-bug · Who: **Cursor** · Effort: M · New

**Where:** All catalog routes, cart drawer and #/quote in a tab left open for hours

**Problem:** Script pw/gap1s-14-refresh.mjs: GET /rest/v1/products fires only at page load (2 requests, from React StrictMode). There were 0 further requests after the tab was re-focused, after visibilitychange, focus and online events, and after two route changes.

Script gap1s-08-stale.mjs: a tab opened before a variant rename still lists 'Swisher Sweets cigarillos — Diamond' in its drawer and would submit it.

Server side, enforce_order_item_price (supabase/migrations/20260925120000_launch_order_boundaries.sql) raises 'Unknown variant for …' or 'Product is not available' for such lines. That fails the whole quote, which the page shows only as the generic 'We couldn't save this quote' error.

Approved buyers in a long-lived tab also see tier prices computed from the list price as it was when the tab loaded.

**Fix:** In useCatalog:
- Move the query into a `load()` function that stores lastLoadedAt.
- Call it on mount.
- Call it on document 'visibilitychange' when visibilityState === 'visible' and Date.now() - lastLoadedAt > 5 * 60 * 1000.
- Call it on window 'online'.
- Export `refresh`.

In QuotePage.handleQuoteSubmit (App.jsx:1181), await refresh() before submitOrder, then resolve the cart again. If a line disappeared or changed, stop the submit and name the affected line: 'X is no longer available — remove it or choose another variant.'

**Files:** `src/lib/useCatalog.js:16-40`

**Evidence:** [gap1-multitab-session/stale-catalog-tabA-drawer-resurrects-line.jpg](screenshots/gap1-multitab-session__stale-catalog-tabA-drawer-resurrects-line.jpg)

- [ ] Done

#### AW-334 · The cart is saved only in the current browser, so approved buyers lose it when they switch devices, and no copy says so

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: 390x844 (phone) and 1280x800 (desktop)

**Where:** Header Cart / cart drawer / #/quote for signed-in trade accounts using more than one device

**Problem:** Script pw/gap1s-09-devices.mjs:
- The same approved account is signed in on a phone context (390px) and on a desktop context.
- On the phone, #/product/14 → Add gives aw-cart {"14":1} and badge 1.
- On the desktop, #/quote shows 'Your cart is empty / Add products, then come back to checkout'.
- The phone made no request that stores the cart; its Supabase traffic was only the products and profiles GETs.

The copy implies an account-based order:
- the sign-in dialog says 'Sign in to view wholesale pricing, build orders and see your order history' (AuthModal.jsx:170)
- the empty drawer says 'add items to build an order' (App.jsx:1396)

No text in src says the cart lives only in this browser. A grep for 'device' and 'browser' copy found only the document-upload and reset-password notes.

**Fix:** Now, copy only:
- In CartDrawer, directly below the .drawer-total block (after App.jsx:1427), add: <p className="fine">Your cart is saved in this browser only. Items added on another device won't appear here.</p>
- Add the same line on #/quote after the 'Clear all items' button (after App.jsx:1266).

Later, for a server cart:
1) Add a migration creating public.carts (user_id uuid primary key references auth.users on delete cascade, lines jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()). Enable RLS with select, insert, update and delete policies using (auth.uid() = user_id).
2) After auth settles for a signed-in user, select the row once. Do NOT sum quantities on every load:
- On a page load with an existing session, keep whichever of the server lines and the local lines is newer. Compare the server updated_at with a local 'aw-cart-updated-at' timestamp that is written on every cart change.
- Only on an explicit SIGNED_IN transition from a guest cart, add the guest lines to the server lines once, then clear the guest cart.
3) While signed in, upsert {user_id, lines, updated_at: now()} 500 ms after the last cart change.

**Files:** `src/App.jsx:148`, `src/App.jsx:225`, `src/App.jsx:1266`, `src/App.jsx:1396`, `src/App.jsx:1422-1427`, `src/components/AuthModal.jsx:170`

**Evidence:** [gap1-multitab-session/device-phone-cart-1.jpg](screenshots/gap1-multitab-session__device-phone-cart-1.jpg), [gap1-multitab-session/device-desktop-same-account-empty-cart.jpg](screenshots/gap1-multitab-session__device-desktop-same-account-empty-cart.jpg)

- [ ] Done

#### AW-335 · The Sign-in dialog stays open asking for a password after the same browser signs in from another tab

**Low** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: all (tested 1280x900)

**Where:** Header 'Sign In' dialog (AuthModal, mode 'signin'), in one tab while another tab completes sign-in

**Problem:** Script pw/gap1s-15-modal.mjs:
- Tab B opens the Sign in dialog.
- Another tab signs in. This was simulated with the same 'aw-auth' session write and the SIGNED_IN BroadcastChannel message that supabase-js sends.
- Behind the overlay, tab B's header changes to 'Test Market LLC · Sign Out'.
- The dialog stays on 'Sign in / Business email / Password'.

The modal only closes itself in mode 'checking' (AuthModal.jsx:76-81).

**Fix:** In src/components/AuthModal.jsx, after the effects at lines 76-86, add:

const sessionAtOpenRef = useRef(undefined);
useEffect(() => {
  if (!loading && sessionAtOpenRef.current === undefined) sessionAtOpenRef.current = session?.user?.id ?? null;
}, [loading, session]);
useEffect(() => {
  if (loading || sessionAtOpenRef.current !== null || !session || !profileReady) return;
  if (!['signin', 'reset', 'reset-sent'].includes(mode)) return;
  if (profile && profile.status !== 'approved') setMode('status'); else onCloseRef.current();
}, [loading, session, profileReady, profile, mode]);

Leave 'signup' and 'checklist' untouched, so typed application data isn't lost and signed-in users who open Apply are not closed out.

Acceptance test:
- Open Sign in in tab A, then sign in from tab B. Tab A's dialog closes, or shows the pending status.
- Signed in and approved, click 'Apply for a trade account'. The checklist stays open.

**Files:** `src/components/AuthModal.jsx:48-49`, `src/components/AuthModal.jsx:74-86`

**Evidence:** [gap1-multitab-session/crosstab-signin-modal-stays-open.jpg](screenshots/gap1-multitab-session__crosstab-signin-modal-stays-open.jpg)

- [ ] Done

#### AW-336 · Sign Out gives no feedback: the button stays active and nothing changes until the network call returns, and there's no confirmation afterwards

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all (tested 1280x900)

**Where:** Header 'Sign Out' (desktop) and Menu → 'Sign Out' (mobile)

**Problem:** Script pw/gap1s-13-slowsignout.mjs, with the logout response delayed by 4 s:
- At 0.3 s and 1.5 s after the click, the header still reads 'Test Market LLC · Sign Out'. The button is still enabled, and no 'Signing out…' text appears.
- After about 4 s the page jumps to #/ with the signed-out header and no message saying the buyer is signed out.
- On a shared store computer, the buyer walks away without knowing whether it worked. Combined with the failed-sign-out finding, a network failure looks exactly like a success.

**Fix:** In App, add const [signingOut, setSigningOut] = useState(false).

Rewrite handleLogout as:
async () => { if (signingOut) return; setSigningOut(true); const r = await signOut(); setSigningOut(false); navigate({ page: 'home' }); setFlash(r?.ok === false ? 'Signed out on this computer. We couldn’t reach the server, so other devices may still be signed in.' : 'You’re signed out.'); }

Pass signingOut to Header. On the buttons at App.jsx:489 and :598, render {signingOut ? 'Signing out…' : 'Sign Out'} with disabled={signingOut}.

Render the flash as a <p role="status"> notice at the top of <main> that clears on the next navigation.

**Files:** `src/App.jsx:266`, `src/App.jsx:489`, `src/App.jsx:598`

- [ ] Done

#### AW-337 · Sign Out ends the buyer's session on every device (scope=global), and those devices find out silently

**Low** · security-backend · Who: **Cursor** · Effort: S · New

**Where:** Header / mobile menu 'Sign Out' → POST /auth/v1/logout

**Problem:** The observed request on every Sign Out is 'POST /auth/v1/logout?scope=global' (pw/gap1s-03-signout.mjs). useAuth calls supabase.auth.signOut() with no options, and the default scope is global.

A buyer who signs out on the store's shared PC therefore also revokes the refresh tokens on their phone and office laptop. Those sessions die at the next refresh (within the access-token lifetime) and fall back to guest mode with no message; see the silent session-end finding. No 'sign out everywhere' choice is offered.

**Fix:** Change src/lib/useAuth.js:86 to `await supabase.auth.signOut({ scope: 'local' })`, which signs out only this browser.

On #/account (src/pages/account/AccountPage.jsx, next to the stat cards), add a secondary button 'Sign out of all devices' that calls supabase.auth.signOut({ scope: 'global' }) and then navigates home.

**Files:** `src/lib/useAuth.js:86`

- [ ] Done

#### AW-338 · Tab title and meta tags follow the live search box: browser history records 'Search “…”', titles go stale after Back, and long queries make 333-character titles

**Low** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: all (tested 1280x800)

**Where:** Header search (.aw-search input) on every route → document.title, meta description, og:title, og:description

**Problem:** Script pw/gap1s-02-title.mjs on #/product/14 ('Kite cigarette tobacco · Kite · Alabama Wholesale Inc'):
- Typing 'snickers' rewrote the title 7 times, from 'Search “sn” · …' to 'Search “snickers” · …'.
- The meta and og descriptions became 'Search results for “snickers” across 368 wholesale SKUs…', although no search results page exists.
- A 300-character query gave a 333-character title and a 389-character description.
- HTML-like input ('<img src=x onerror=…>') stays inert text; this is not an XSS risk.
- Picking a result: CDP Page.getNavigationHistory shows the entry '#/product/14 => Search “snickers” · Alabama Wholesale Inc'. The back-button history menu and browser history therefore show the search term instead of the product name.
- With the results open, pressing browser Back returns to #/product/14 while the title stays 'Search “backwoods” · Alabama Wholesale Inc', and #/product/162's history entry is renamed to 'Search “backwoods”'.
- Clearing the box, pressing Escape and blurring restore the page title correctly.

**Fix:** The search is a dropdown, not a page, so remove it from the page metadata:
- delete the `if (searchTerm) {…}` branch in pageMeta (App.jsx:91-93)
- delete the searchTerm state (196)
- remove searchTerm from the pageMeta call and the effect deps (200, 205)
- remove the onSearchChange prop (312) and parameter (390)
- remove the effect that reports the query (423-425)

If a real #/search?q= results route is added later, set its title there as `Search “${clip(q, 40)}” · ${site}`.

**Files:** `src/App.jsx:89-93`, `src/App.jsx:196-205`, `src/App.jsx:312`, `src/App.jsx:390`, `src/App.jsx:423-425`

**Evidence:** [gap1-multitab-session/title-long-query-no-results.jpg](screenshots/gap1-multitab-session__title-long-query-no-results.jpg), [gap1-multitab-session/title-stale-after-back.jpg](screenshots/gap1-multitab-session__title-stale-after-back.jpg)

- [ ] Done

#### AW-339 · Confirming 21+ in one tab leaves the other open tabs stuck on the age gate until reload

**Low** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: all (tested 1280x800)

**Where:** Age gate (.age-gate) in a second tab opened before verification

**Problem:** Script pw/gap1s-07-agegate-catalog.mjs:
- Two unverified tabs are open, on #/category/TOBACCO and #/product/14; both show the gate.
- Clicking 'Yes, I am 21+' in tab 1 sets localStorage aw-age-verified='yes'.
- Tab 2 still shows the gate (.age-gate count 1) until it is reloaded or its button is clicked again.

`verified` is read once in useState (App.jsx:146), and nothing listens for storage changes.

**Fix:** In the window 'storage' listener added for the cart (or in a new effect in App), add: if (e.key === STORAGE.age) setVerified(e.newValue === 'yes').

**Files:** `src/App.jsx:146`, `src/App.jsx:265`

**Evidence:** [gap1-multitab-session/agegate-tab2-still-gated-after-tab1-verified.jpg](screenshots/gap1-multitab-session__agegate-tab2-still-gated-after-tab1-verified.jpg)

- [ ] Done

#### AW-340 · The 21+ confirmation is stored forever and survives sign-out, so on a shared computer no later visitor sees the age gate

**Low** · security-backend · Who: **Owner → Cursor** · Effort: S · New

**Where:** Age gate → localStorage 'aw-age-verified'

**Problem:** handleAgeYes stores the bare string 'yes' with no timestamp (App.jsx:265). App.jsx:146 treats any 'yes' as verified permanently. handleLogout (App.jsx:266) does not touch the key.

On a store or public computer, one person's click therefore bypasses the tobacco/vape 21+ gate for every later visitor indefinitely. The gate text claims access is 'restricted to trade accounts and adults 21 years or older'.

**Fix:** Store a timestamp: localStorage.setItem(STORAGE.age, JSON.stringify({ ok: true, at: Date.now() })).

Read it with a helper `isAgeVerified()` that returns true only if the stored value parses and at > Date.now() - 30 * 24 * 60 * 60 * 1000. Treat a legacy 'yes' as expired so visitors see the gate once more.

In handleLogout, removeItem(STORAGE.age) so the next person on a shared device is asked again. Wrap all reads and writes in try/catch.

**Owner input needed:** For tobacco age-gate compliance, how long should a visitor's 21+ confirmation stay valid (e.g. 30 days, per session), and should it be cleared on sign-out?

**Files:** `src/App.jsx:146`, `src/App.jsx:265`, `src/App.jsx:266`

- [ ] Done

## Slow network, offline & broken assets

#### AW-192 · A failed product photo shows the browser's broken-image icon and alt text over the tile labels instead of the initials placeholder

**Medium** · imagery · Who: **Cursor** · Effort: M · New · Viewports: 1440x900 and 390x844 (all)

**Where:** #/ (New arrivals, Bestsellers, Shop by department, Collections card), #/category/* grid, #/product/<id> .pd-media and 'More …' row, cart drawer .thumb, #/quote .checkout-line .thumb, header search .sr-thumb

**Problem:** Method: Playwright aborted every request with resourceType()==='image'. The same states appear when the connection drops mid-session (see the reconnect finding). Measured at both widths:
(1) Product cards (home rails, category grid, PDP related row). Each <img> keeps its 300x273 box at 1440 (169x161 at 390) with naturalWidth 0. Chrome paints the broken icon plus the alt text ('Geek Bar Pulse X 25K', 'Swisher Sweets cigarillos', …) at the top-left. That is the same corner as the absolutely positioned .block-label ('NOVELTIES', 'TOBACCO'), so the two texts print on top of each other. At 390 the alt text wraps to 2 lines inside the tile.
(2) 'Shop by department' tiles use alt="". Chrome draws an empty 1px grey frame inset 14px (272x245 at 1440) with the broken icon under the 'DEPARTMENT' label. All 8 tiles look like empty picture frames.
(3) #/product/162: the 620x590 beige .pd-media box shows only a small broken icon and 'Snickers bars' at its top-left, with the BESTSELLER tag at top-right. At 390 the first 341px under the breadcrumb is this empty box.
(4) Cart drawer: 3 of 3 lines show a broken icon in a grey-framed 52px thumb. #/quote does the same.
(5) Header search for 'snickers': 2 of 2 result thumbnails are broken icons.
(6) The Collections 'Exotics & Novelties' card shows a small broken icon in its top-left corner (the .bg image at opacity .28).
The initials placeholder (.card-initials) exists but is used only when p.picture/it.img is missing, never when loading fails. Picture.jsx has no onError. The plain <img> thumbnails at App.jsx:475/1246/1401 have none either. Under normal operation 0 of the catalog images are broken (full scroll of all 8 departments), so this appears only on network, CDN or Storage failures, including an admin-set Storage URL that 404s.

**Fix:** 1) src/components/Picture.jsx: add a `fallback = null` prop and `const [failed, setFailed] = useState(false)`. Reset it with `useEffect(() => setFailed(false), [picture?.src])`. Put `onError={() => setFailed(true)}` on the <img>. When `failed`, return `fallback` instead of the <picture>/<img>.
2) src/App.jsx:817 and :1092: pass `fallback={<span className="card-initials" aria-hidden="true">{initials(p.name)}</span>}`. At :760 pass `fallback={<span className="card-initials">{String(c.count).padStart(2, '0')}</span>}`. At :722 (editorial bg) leave fallback null so the card stays a plain cream panel.
3) Add a small `Thumb` component in App.jsx (or src/components/Thumb.jsx): `({ src, name }) => { const [failed, setFailed] = useState(false); return src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : initials(name); }`. Use it at :475 (keep loading="lazy"), :1246 and :1401.
4) Belt and braces in src/index.css: add `.card-block img, .pd-media img, .sr-thumb img, .drawer-line .thumb img { color: transparent; }` so alt text never paints over labels, even for a frame before onError fires.

**Files:** `src/App.jsx:475`, `src/App.jsx:722`, `src/App.jsx:760`, `src/App.jsx:817`, `src/App.jsx:1092`, `src/App.jsx:1246`, `src/App.jsx:1401`, `src/components/Picture.jsx:6`, `src/index.css:158`, `src/index.css:204`, `src/index.css:205`, `src/index.css:312`, `src/index.css:465`

**Evidence:** [gap1-degraded-states/img-fail-home-newarrivals-390.jpg](screenshots/gap1-degraded-states__img-fail-home-newarrivals-390.jpg), [gap1-degraded-states/img-fail-home-departments-1440.jpg](screenshots/gap1-degraded-states__img-fail-home-departments-1440.jpg), [gap1-degraded-states/img-fail-home-departments-390.jpg](screenshots/gap1-degraded-states__img-fail-home-departments-390.jpg), [gap1-degraded-states/img-fail-category-tobacco-390.jpg](screenshots/gap1-degraded-states__img-fail-category-tobacco-390.jpg), [gap1-degraded-states/img-fail-pdp162-top-1440.jpg](screenshots/gap1-degraded-states__img-fail-pdp162-top-1440.jpg), [gap1-degraded-states/img-fail-pdp162-top-390.jpg](screenshots/gap1-degraded-states__img-fail-pdp162-top-390.jpg), [gap1-degraded-states/img-fail-cart-drawer-390.jpg](screenshots/gap1-degraded-states__img-fail-cart-drawer-390.jpg), [gap1-degraded-states/img-fail-quote-lines-1440.jpg](screenshots/gap1-degraded-states__img-fail-quote-lines-1440.jpg), [gap1-degraded-states/img-fail-search-1440.jpg](screenshots/gap1-degraded-states__img-fail-search-1440.jpg), [gap1-degraded-states/img-fail-home-editorials-1440.jpg](screenshots/gap1-degraded-states__img-fail-home-editorials-1440.jpg)

- [ ] Done

#### AW-193 · Blank white page until the JS bundle runs: no loading shell, no <noscript>, and a permanent blank page if the main chunk fails

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: 390x844 and 1440x900

**Where:** index.html → <body> / <div id="root"> (every route, first load)

**Problem:** Setup: a production build served locally with gzip, CDP Network.emulateNetworkConditions (560ms RTT, 1.47 Mbps down, 675 kbps up) and Emulation.setCPUThrottlingRate 4.
- #/ at 390: pure white at 1s. first-paint/FCP at 2684ms.
- #/category/TOBACCO: FCP at 2700ms (390) and 2688ms (1440). Until then the viewport is empty white.
- index-*.js (169,739 B transferred) and vendor-*.js (45,559 B) must download and execute before anything renders.
- First-time visitor (no age flag): white at 1.5s, then the purple age gate at 2.5s, a white-to-purple flash although index.html declares theme-color #281459.
- JavaScript disabled (prod and dev): 0 characters of text, no <noscript>, empty #root.
- Simulated failure of assets/index-*.js: permanent blank white page with only the tab title. No message and no phone number, so a buyer cannot even call.
On the Vite dev server under the same throttling the page stayed white for over 15s; that is a dev artifact of unbundled modules and is noted only for completeness. This is separate from the known bundle-size/LCP finding: that one is about how long loading takes, this one is that nothing is shown while it loads or when it fails.

**Fix:** index.html:
1) Inside the root (index.html:93) put a static shell: `<div id="root"><div class="boot" role="status"><span class="boot-brand">Alabama<small>WHOLESALE INC.</small></span><p>Loading the wholesale catalog…</p><p class="boot-help">Trouble loading? Call <a href="tel:+12053544473">(205) 354-4473</a></p></div></div>`. React 18 createRoot().render() (src/main.jsx:6) clears the container on its first commit, so no JS change is needed.
2) Add an inline <style> in <head> using system fonts only:
`.boot{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;background:#fff;color:#281459;font:600 16px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}`
`.boot-brand{font:800 32px/1 system-ui,sans-serif;color:#ed5a21}`
`.boot-brand small{display:block;margin-top:6px;font-size:12px;letter-spacing:2.4px;color:inherit}`
`.boot-help{visibility:hidden}`
`.boot.slow .boot-help{visibility:visible}`
`html.aw-gate .boot{background:#281459;color:#fff}`
3) Add an inline script in <head>, before the module script: `<script>try{if(localStorage.getItem('aw-age-verified')!=='yes')document.documentElement.classList.add('aw-gate')}catch(e){document.documentElement.classList.add('aw-gate')}setTimeout(function(){var b=document.querySelector('.boot');if(b)b.classList.add('slow')},8000);</script>`. First-time visitors, who will see the purple age gate, get a purple shell. Returning buyers get a white one. Neither sees a colour flash, and the phone line only appears if loading stalls or the chunk fails.
4) Right after the root div add `<noscript><div class="boot">This catalog needs JavaScript. To order, call (205) 354-4473 or email Alabamawholesaleinc@gmail.com.</div></noscript>`.
Keep the phone and email in sync with COMPANY in src/data/content.js. If a CSP is added later (see the security-headers finding), whitelist these inline blocks by hash.

**Files:** `index.html:6`, `index.html:58`, `index.html:93`, `src/main.jsx:6`

**Evidence:** [gap1-degraded-states/slow-prod_-390-1s.jpg](screenshots/gap1-degraded-states__slow-prod_-390-1s.jpg), [gap1-degraded-states/slow-prod_-390-3s.jpg](screenshots/gap1-degraded-states__slow-prod_-390-3s.jpg), [gap1-degraded-states/slow-prod_category_TOBACCO-1440-1s.jpg](screenshots/gap1-degraded-states__slow-prod_category_TOBACCO-1440-1s.jpg), [gap1-degraded-states/slow-prod-firstvisit-390-1500ms.jpg](screenshots/gap1-degraded-states__slow-prod-firstvisit-390-1500ms.jpg), [gap1-degraded-states/slow-prod-firstvisit-390-2500ms.jpg](screenshots/gap1-degraded-states__slow-prod-firstvisit-390-2500ms.jpg), [gap1-degraded-states/nojs-prod-390.jpg](screenshots/gap1-degraded-states__nojs-prod-390.jpg), [gap1-degraded-states/prod-main-js-failed-390.jpg](screenshots/gap1-degraded-states__prod-main-js-failed-390.jpg)

- [ ] Done

#### AW-194 · Network calls have no timeout: a stalled quote submit shows 'Sending…' forever, and the form and cart stay editable meanwhile

**Medium** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: 1280x900 (not viewport specific)

**Where:** #/quote → 'Submit order' / 'Submit quote request'; #/account → Order history; sign-in and reset dialogs

**Problem:** Same setup, with the RPC held in-browser and never forwarded. Submit button 'Sending… ↗' (disabled) at 1s and 20s. No alert. 11 form controls (10 inputs + Delivery select), the line's −/+/× buttons (3) and 'Clear all items' all stay enabled. #/account 'Loading…' never resolves while the orders GET hangs. A network error on GETs is retried 3 times by postgrest-js (1s+2s+4s backoff) before the UI resolves. None of submitOrder, the account orders query, listProfileDocuments or signIn passes an AbortSignal.

**Fix:** 1) Do NOT add a global fetch timeout in src/lib/supabase.js. supabase-js hands that fetch to storage-js too, so it would abort slow license uploads. Use per-call signals instead:
- src/lib/orders.js:13: `supabase.rpc('submit_quote', {...}).abortSignal(AbortSignal.timeout(25000))`
- src/pages/account/AccountPage.jsx:32-36: add `.abortSignal(AbortSignal.timeout(20000))` after `.order(...)`
- src/lib/documents.js:82-85 (listProfileDocuments): add the same.
2) src/App.jsx handleQuoteSubmit catch (:1199-1202): detect the timeout with `/^(AbortError|TimeoutError)\b/.test(err?.message || '')`. PostgrestError has no AbortError name. Set `submitError` to `{ before: 'This is taking longer than expected and may not have been saved. Call', after: ` before resubmitting and quote reference ${refNum}.` }`.
3) While `sending`, wrap the form grid (:1270-1287) in `<fieldset className="checkout-fieldset" disabled={sending}>` and add `.checkout-fieldset{border:0;margin:0;padding:0;min-width:0}` to index.css. Also add `disabled={sending}` to the −/+ buttons (:1256, :1258), the remove button (:1262) and 'Clear all items' (:1266).
4) AccountPage.jsx: add `const [reloadKey, setReloadKey] = useState(0)` and include it in the effect deps (:41). On error or timeout set `error`. Replace the raw message at :114 with `Couldn’t load your orders.` plus `<button className="text-link" onClick={() => { setError(null); setOrders(null); setReloadKey(k => k + 1); }}>Try again</button>`.
5) AuthModal.handleSignin (:95-101): auth-js signInWithPassword takes no AbortSignal, so race it: `await Promise.race([signIn(signin), new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), 20000))])`. In describeError (:21), map `err.code === 'timeout'` to 'Signing in is taking too long. Check your connection and try again, or call (205) 354-4473.'

**Files:** `src/App.jsx:1181`, `src/App.jsx:1199`, `src/App.jsx:1256`, `src/App.jsx:1258`, `src/App.jsx:1262`, `src/App.jsx:1266`, `src/App.jsx:1270`, `src/App.jsx:1296`, `src/components/AuthModal.jsx:21`, `src/components/AuthModal.jsx:95`, `src/lib/documents.js:82`, `src/lib/orders.js:13`, `src/lib/supabase.js:10`, `src/pages/account/AccountPage.jsx:30`, `src/pages/account/AccountPage.jsx:115`

**Evidence:** [gap1-degraded-states/quote-submit-hang-30s-1280.jpg](screenshots/gap1-degraded-states__quote-submit-hang-30s-1280.jpg), [gap1-degraded-states/orders-hang-20s-1280.jpg](screenshots/gap1-degraded-states__orders-hang-20s-1280.jpg)

- [ ] Done

#### AW-195 · When the document list fails to load, a pending applicant is told both documents are 'Not uploaded'

**Medium** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: 1280x900 (not viewport specific)

**Where:** #/apply (signed-in, status pending) → 'License documents' panel (.doc-panel)

**Problem:** Setup (local only): a fake pending session, with the profile_documents GET answered inside the test browser.
- Request aborted (as when offline or the server errors): after the silent 1+2+4s retries, both rows show 'Not uploaded' with data-document-status="missing". No error message and no retry control.
- Same session with a tobacco_license row returned: 'Uploaded on September 20, 2026 · license.pdf'.
So during any network blip, an applicant who has already sent documents is told they are missing. That invites duplicate uploads and 'did you get my license?' calls. Cause: DocumentUploads.jsx:128 `.catch(() => { if (!cancelled) setRecords([]); })` turns a failed load into 'no records'. The status logic at :57-60 then prints 'Not uploaded'.

**Fix:** In ApplicationDocuments:
- Add `const [loadError, setLoadError] = useState(false)`.
- In the catch at :128, call `setLoadError(true)` and leave `records` as null instead of setting [].
- Pass `loadError` into DocumentFields. When it is true, set the status text to 'Couldn’t check this document right now', use data-document-status="unknown" and do not add the is-missing class.
- Above the fields, render `<p className="form-error" role="alert">We couldn’t load your document status. <button className="text-link" onClick={reload}>Try again</button></p>`. `reload` re-runs listProfileDocuments.

**Files:** `src/components/DocumentUploads.jsx:55`, `src/components/DocumentUploads.jsx:78`, `src/components/DocumentUploads.jsx:126`, `src/components/DocumentUploads.jsx:128`, `src/lib/documents.js:80`

**Evidence:** [gap1-degraded-states/docs-list-fails-1280.jpg](screenshots/gap1-degraded-states__docs-list-fails-1280.jpg), [gap1-degraded-states/docs-list-ok-with-license-1280.jpg](screenshots/gap1-degraded-states__docs-list-ok-with-license-1280.jpg)

- [ ] Done

#### AW-341 · If logo.jpg fails, the header logo button shrinks to 0px wide: no brand, no home link, and an invisible keyboard stop

**Low** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: 1440x900 and 390x844 (all widths)

**Where:** Every route → header .aw-logo (masthead, left of search on desktop; between Menu and Sign In on phones)

**Problem:** With image requests aborted, the logo <img> has alt="" and naturalWidth 0. CSS sets `height: 72px; width: auto`, so the img and the .aw-logo button both measure 0x72 at 1440 and 0x48 at 390.
What the user sees: at 1440 only a 48px empty gap before the search box. At 390 an empty slot between 'Menu' and 'Sign In'. The header carries no brand at all, and on desktop the logo is the only 'home' link.
The button still has aria-label 'Alabama Wholesale home' and stays in the tab order. Tabbing to it draws the 3px focus ring around a zero-width box, which shows as a thin vertical orange bar. The age gate is unaffected because it uses a text wordmark (.age-gate .brand), not the JPEG.

**Fix:** 1) src/App.jsx:456-458: add `const [logoFailed, setLogoFailed] = useState(false)` in Header. Render `<img src={IMG.logo} alt="" width="72" height="72" onError={() => setLogoFailed(true)} />` until it fails. After that, render a text wordmark inside the same button: `<span className="aw-logo-text">Alabama<small>WHOLESALE INC.</small></span>`.
2) src/index.css: give the image a fixed width so the slot never collapses: `.aw-logo img { width: 72px; }` and matching widths in the media queries at :513 (64px), :532 (48px) and :605 (42px).
3) Add `.aw-logo-text` styles copied from `.footer-brand > span / small` (index.css:424-425), using var(--orange) and var(--purple) on white at 20-26px, so the fallback reads as the brand.

**Files:** `src/App.jsx:456`, `src/App.jsx:457`, `src/data/theme.js:9`, `src/index.css:87`, `src/index.css:88`, `src/index.css:513`, `src/index.css:532`, `src/index.css:605`

**Evidence:** [gap1-degraded-states/img-fail-home-hero-1440.jpg](screenshots/gap1-degraded-states__img-fail-home-hero-1440.jpg), [gap1-degraded-states/img-fail-header-390.jpg](screenshots/gap1-degraded-states__img-fail-header-390.jpg), [gap1-degraded-states/img-fail-logo-focused-1440.jpg](screenshots/gap1-degraded-states__img-fail-logo-focused-1440.jpg), [gap1-degraded-states/agegate-imgfail-390.jpg](screenshots/gap1-degraded-states__agegate-imgfail-390.jpg)

- [ ] Done

#### AW-342 · With failed hero images, the homepage opens on 480px of white showing only a caption, and autoplay keeps cycling through empty slides

**Low** · imagery · Who: **Cursor** · Effort: S · New · Viewports: 1440x900 (480px stage) and 390x844 (220px stage)

**Where:** #/ → HeroCarousel (.home-carousel-stage), top of the homepage

**Problem:** With image requests aborted:
- Slide 1's <img> renders a 243x153 broken box. Its only visible content is a tiny broken icon and the alt text 'The brands your customers ask for.', centred in a white stage 1280x480 at 1440 (358x220 at 390).
- Inactive slides have alt="" and collapse to 0x0.
- Autoplay keeps running. After 4.8s the counter reads 'Slide 2 of 4' and the stage shows only the words 'Geekbar 25K — now in stock.'
- Previous/Pause/Next keep working on slides that have nothing to show.
The first screen of the homepage becomes a big white rectangle with a floating caption and a table-pager bar. The carousel has no error handling: App.jsx:679-684 render <Picture>/<img> with no onError, and `media` (App.jsx:624) filters only on slide.img/videoUrl being set.

**Fix:** In HeroCarousel (src/App.jsx:623):
- Keep `const [failed, setFailed] = useState(() => new Set())`.
- Pass `onError={() => setFailed(s => new Set(s).add(i))}` to the Picture at :679 (via the new Picture onError/fallback support) and to the <img> at :683.
- Compute `const media = slides.filter((s, i) => (s.img || s.videoUrl) && !failed.has(i))`, keeping the original index for keys.
- If `media.length === 0`, return a static brand panel instead of null: purple background, the first slide's title as an <h2>, and a 'Browse the catalog' button calling goCatalog. Or return null so New arrivals moves up.
- The existing autoplay effect already stops when count < 2. Make sure `safeIndex` is recomputed after filtering so the counter never shows a dead slide.

**Files:** `src/App.jsx:623`, `src/App.jsx:624`, `src/App.jsx:651`, `src/App.jsx:679`, `src/App.jsx:683`, `src/index.css:178`

**Evidence:** [gap1-degraded-states/img-fail-home-hero-1440.jpg](screenshots/gap1-degraded-states__img-fail-home-hero-1440.jpg), [gap1-degraded-states/img-fail-home-hero-390.jpg](screenshots/gap1-degraded-states__img-fail-home-hero-390.jpg), [gap1-degraded-states/img-fail-hero-slide2-1440.jpg](screenshots/gap1-degraded-states__img-fail-hero-slide2-1440.jpg)

- [ ] Done

#### AW-343 · Photos that failed while offline stay broken after the connection returns, until the buyer leaves the page

**Low** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: 1440x900 and 390x844

**Where:** #/category/* grids (and any Picture/thumbnail) after a dropped connection

**Problem:** Steps:
1. Load #/ online.
2. context.setOffline(true).
3. Navigate in-app to #/category/CANDIES: 5 of 6 in-view images are broken at 1440 and 6 of 6 at 390.
4. context.setOffline(false) and wait 2.5s: still 5/6 (1440) and 6/6 (390) broken on the same page.
5. Navigate to #/category/TOBACCO and back to CANDIES: 0 broken, because React remounts the <img> and the browser re-requests it.
Nothing in src listens for the 'online' event (grep finds no 'online' or 'onLine'). A buyer whose signal drops for a moment in a store keeps looking at a grid of broken tiles after reconnecting.

**Fix:** Build this on the onError fallback from the broken-image finding. In Picture.jsx (and the new Thumb component):
- Keep `const [attempt, setAttempt] = useState(0)` alongside `failed`.
- When `failed` is true, add `useEffect(() => { if (!failed) return; const retry = () => { setFailed(false); setAttempt(a => a + 1); }; window.addEventListener('online', retry); return () => window.removeEventListener('online', retry); }, [failed])`.
- Render the <img>/<picture> with `key={attempt}` so React remounts it and the browser re-requests the file when the connection returns.
- Cap it at 3 attempts.

**Files:** `src/App.jsx:475`, `src/App.jsx:817`, `src/App.jsx:1246`, `src/App.jsx:1401`, `src/components/Picture.jsx:6`

**Evidence:** [gap1-degraded-states/offline-candies-1440.jpg](screenshots/gap1-degraded-states__offline-candies-1440.jpg), [gap1-degraded-states/offline-reconnected-candies-1440.jpg](screenshots/gap1-degraded-states__offline-reconnected-candies-1440.jpg), [gap1-degraded-states/offline-reconnected-candies-390.jpg](screenshots/gap1-degraded-states__offline-reconnected-candies-390.jpg)

- [ ] Done

#### AW-344 · No offline awareness: the site never says the connection dropped, and errors blame the service instead

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: 1440x900 and 390x844

**Where:** All routes while offline; #/quote submit; sign-in / reset dialogs; full reload

**Problem:** After context.setOffline(true) mid-session, navigator.onLine is false, but no page shows any offline notice. body.innerText has no 'offline' or 'connection' text on #/category/CANDIES, #/product/14, #/quote, #/apply, #/account or #/reset-password.
- #/quote keeps an enabled 'Submit quote request' button.
- A network failure on sign-in or reset is described as 'Account sign-in is unavailable right now. Call … or email …' (AuthModal.jsx:20-25). That tells the buyer the business is down when their own phone is offline.
- A reload while offline gives the browser's connection-error page (net::ERR_INTERNET_DISCONNECTED). There is no service worker, and site.webmanifest uses display: browser.
What works: in-app navigation, search and add-to-cart (the cart badge went to 1 and the item persisted in localStorage). An offline notice could honestly say 'keep building your order'.

**Fix:** 1) Add src/lib/useOnlineStatus.js: `useSyncExternalStore` over the window 'online'/'offline' events, returning navigator.onLine.
2) In App (src/App.jsx:293, under .trade-only) render, while offline, `<p className="offline-bar" role="status">You’re offline. You can keep browsing and building your order — we’ll reconnect automatically.</p>`. Style it as a slim cream bar with var(--purple) text.
3) In QuotePage, disable the submit button while offline and show 'Reconnect to submit' next to it.
4) In AuthModal.describeError (:21), check `navigator.onLine === false` first and return 'You appear to be offline. Check your connection and try again.'
5) Optional: add vite-plugin-pwa with a network-first app-shell cache so a reload while offline still opens the catalog.

**Files:** `src/App.jsx:293`, `src/App.jsx:1296`, `src/components/AuthModal.jsx:20`, `src/components/AuthModal.jsx:21`

**Evidence:** [gap1-degraded-states/offline_quote-1440.jpg](screenshots/gap1-degraded-states__offline_quote-1440.jpg), [gap1-degraded-states/offline-pdp14-1440.jpg](screenshots/gap1-degraded-states__offline-pdp14-1440.jpg), [gap1-degraded-states/offline-cart-390.jpg](screenshots/gap1-degraded-states__offline-cart-390.jpg), [gap1-degraded-states/offline-signin-empty-390.jpg](screenshots/gap1-degraded-states__offline-signin-empty-390.jpg)

- [ ] Done

#### AW-345 · On slow connections, lazy photos load into blank beige tiles with no loading cue, then pop in

**Low** · performance · Who: **Cursor** · Effort: S · New · Viewports: 390x844 and 1440x900

**Where:** #/category/* grid (.card-block), home rails, #/product/<id> .pd-media during in-app navigation

**Problem:** Production build with Fast-3G-like throttling (560ms RTT, 1.47 Mbps) and 4x CPU:
- #/category/TOBACCO, jump to 55% of the page: 250ms later 0 of 4 (390) and 0 of 6 (1440) in-view tiles have painted. The user sees empty beige boxes with only the 'TOBACCO' label; all had filled by +3s.
- #/category/CANDIES, scrolling 3 screens at a time: in-view tiles took 548-760ms (390) and up to 1553ms (1440) to fill.
- In-app navigation to #/product/335: the 341px .pd-media box stayed empty for about 900ms.
The loading state is indistinguishable from a tile whose photo is simply missing. Photos appear abruptly, with no fade. For the record, the tiles do not cause layout shift (aspect-ratio boxes); measured CLS was 0.004-0.04, from font and header shifts rather than images.

**Fix:** 1) src/components/Picture.jsx: add `const [loaded, setLoaded] = useState(false)` and reset it when `picture?.src` changes. On the <img> add `onLoad={(e) => { setLoaded(true); rest.onLoad?.(e); }}` and a ref callback `el => { if (el && el.complete && el.naturalWidth) setLoaded(true); }` for cached images. Set `className={[className, loaded && 'is-loaded'].filter(Boolean).join(' ') || undefined}`.
2) src/index.css, after :204 and :312: `.card-block img, .pd-media img { opacity: 0; transition: opacity .2s ease; } .card-block img.is-loaded, .pd-media img.is-loaded { opacity: 1; }`
3) Add the loading sheen only where an image is actually pending:
`@media (prefers-reduced-motion: no-preference) { .card-block:has(img:not(.is-loaded)), .pd-media:has(img:not(.is-loaded)) { background: linear-gradient(100deg, var(--paper) 40%, #efe9e1 50%, var(--paper) 60%) var(--paper); background-size: 200% 100%; animation: aw-sheen 1.2s linear infinite; } }`
`@keyframes aw-sheen { to { background-position: -200% 0; } }`
Do NOT use `:not(:has(img.is-loaded))`: it also matches .card-initials tiles, which have no img.
4) Ship this together with the onError fallback from AW-192, so a failed image is replaced by the initials placeholder instead of staying at opacity 0 with a sheen forever.

**Files:** `src/components/Picture.jsx:10`, `src/index.css:202`, `src/index.css:204`, `src/index.css:311`, `src/index.css:312`

**Evidence:** [gap1-degraded-states/slow-prod_category_TOBACCO-390-rapidscroll.jpg](screenshots/gap1-degraded-states__slow-prod_category_TOBACCO-390-rapidscroll.jpg), [gap1-degraded-states/slow-prod_category_TOBACCO-1440-rapidscroll.jpg](screenshots/gap1-degraded-states__slow-prod_category_TOBACCO-1440-rapidscroll.jpg), [gap1-degraded-states/slow-prod-pdp335-390-0.6s.jpg](screenshots/gap1-degraded-states__slow-prod-pdp335-390-0.6s.jpg)

- [ ] Done

#### AW-346 · With fallback fonts, overlay labels collide: the BESTSELLER tag covers the department label, and 'COLLECTION / 01' overlaps the eyebrow

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 1024x768 (Verdana fallback), 390x844 (system-sans fallback)

**Where:** #/ Bestsellers and New arrivals cards (.card-block .block-label vs .card-tag); #/ Collections card 1 (.editorial-card .block-label vs .eyebrow)

**Problem:** At 1024: Bestsellers 'MERCHANDISE' vs BESTSELLER gap is -14px (Verdana fallback) and 0px (system sans). 'DRINKS & BAGS' is -24px (Verdana), -8px (system sans) and +5px with fonts loaded, which is already tight. The BESTSELLER tag is 93px wide with DM Sans and 105px under Verdana, on a 222px card. At ≤600 the tag sits bottom-right (index.css:580), so there is no collision. At 1440 there is no collision in any font scenario. Editorial card 1 at 390 with the system-sans fallback: the H2 grows from 71px to 106px, and the 'EXOTICS & NOVELTIES' eyebrow (top 348) runs into the 'COLLECTION / 01' label (bottom 352).

**Fix:** 1) Cards: reuse the phone layout, which already avoids the collision. Inside `@media(max-width:1100px)` (index.css:510-519) add `.card-block .card-tag { top: auto; bottom: 12px; right: 12px; }`. The ≤600 rule at :580 keeps its 10px offsets. As a guard at every width, extend `.card-block .block-label` (index.css:203) with `max-width: calc(100% - 24px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`. Do not reserve a fixed 96px for the tag: it is 93px in DM Sans and 105px in the Verdana fallback.
2) Editorial: reserve the label row by adding `padding-top: 64px` to `.editorial-card` (index.css:224). Change the overrides to keep it: `padding: 64px 22px 22px` at :546 (≤850) and `padding: 64px 24px 24px` at :587 (≤600). The bottom-aligned content can then never reach the absolutely positioned .block-label at top 24px, and the card grows taller instead.

**Files:** `src/App.jsx:723`, `src/App.jsx:815`, `src/App.jsx:816`, `src/index.css:203`, `src/index.css:206`, `src/index.css:224`, `src/index.css:510`, `src/index.css:546`, `src/index.css:580`, `src/index.css:587`

**Evidence:** [gap1-degraded-states/font-blocked-1024-card-label-vs-tag.jpg](screenshots/gap1-degraded-states__font-blocked-1024-card-label-vs-tag.jpg), [gap1-degraded-states/font-loaded-1024-card-label-vs-tag.jpg](screenshots/gap1-degraded-states__font-loaded-1024-card-label-vs-tag.jpg), [gap1-degraded-states/font-android-390-editorials.jpg](screenshots/gap1-degraded-states__font-android-390-editorials.jpg), [gap1-degraded-states/font-loaded-390-editorials.jpg](screenshots/gap1-degraded-states__font-loaded-390-editorials.jpg)

- [ ] Done

## Security, backend & data boundaries

#### AW-003 · 'Locked' trade prices for all 368 SKUs are public in the JS bundle and the anonymous Supabase API

**Critical** · security-backend · Who: **Cursor** · Effort: L · Still open from the 2026-09-25 audit · Viewports: all

**Where:** All routes (e.g. #/product/1 → price block 'Sign in / Wholesale pricing is visible to approved trade accounts'); Supabase GET /rest/v1/products; production JS bundle

**Problem:** While signed out, the storefront itself calls GET /rest/v1/products?select=*&active=eq.true, which returns 200 with 368 rows. All 368 include `price` (for example id 1 Swisher Sweets cigarillos 41.76, id 2 White Owl 84.34). The page shows 'LOCKED · Sign in for pricing' on cards and 'Sign in' on the product page. The static catalog shipped to every browser has the same data: /src/data/products.js holds 368 `price:` fields, and the built dist/assets/index-CvpKVAyY.js has 368 `price:` literals. Anyone can call import('/src/data/products.js') and read PRODUCTS[0].price = 41.76. RLS policy products_public_read (`using (active = true)`) exposes every column, including price, to the anon role. pricing_tiers_public_read (`using (true)`) also publishes the tier discount table. The Trade terms page says prices 'are not for publication'. Approval gating in the UI and server-side pricing in submit_quote are now fixed; the exposure itself is not.

**Also seen:**
- #/product/<id> → .pd-price 'Sign in / Wholesale pricing is visible to approved trade accounts' — As a signed-out visitor, the page's own anonymous request GET <supabase>/rest/v1/products?select=*&active=eq.true returned 368 rows, all with a non-null `price` (e.g. id 1 = 41.76). src/data/products.js, which ships to every browser, also includes `price` on all 368 rows. The policy `products_public_read ... for select using (active = true)` exposes every column to anon. The PDP meanwhile tells guests that pricing is visible only to approved acco…
- Cart drawer 'Estimated total — Sign in for pricing' / #/quote 'Pricing after sign-in' (guest) — As a guest, the page's own request GET https://<project>.supabase.co/rest/v1/products?select=*&active=eq.true returned all 368 rows, with columns including `price`. All prices matched the static catalog. The static CATALOG in the JS bundle also has `price` on every row (e.g. id 1 'price: 41.76'). The cart hides prices from guests only in the UI (priceForProfile returns null), so anyone can read trade pricing from DevTools.
- GET https://<project>.supabase.co/rest/v1/products?select=*&active=eq.true (made by every visitor) and the static JS bundle — Loading #/catalog without signing in, the app's own anon request returned 368 rows including the `price` column (captured with Playwright). RLS policy products_public_read allows select of all columns on active rows (rls_policies.sql:39-40). The static CATALOG shipped to every browser also contains price. The UI only hides prices behind "LOCKED · Sign in for pricing".
- Production JS bundle (assets/index-*.js) and the Supabase REST products endpoint, for signed-out visitors — Signed-out users see "LOCKED · Sign in for pricing", and README.md says prices stay hidden. But the built main chunk contains 371 `price:` literals, e.g. price:41.76 (Swisher Sweets), price:84.34 (White Owl), because every CATALOG row in src/data/products.js carries `price` and products.js is bundled (119 KB raw). The live catalog request that useCatalog.js:19 makes as an anonymous visitor (`select('*')`) returned HTTP 200 with 368 rows. Every ro…

**Fix:** Remove price from the bundled static catalog (products.js, build-seed output) and from anon-readable columns. Revoke anon SELECT on products.price (a column privilege, or a view without price), and expose prices only through an RPC/view that checks auth and approved status, applying the tier server-side (rls_policies.sql:39, 89; launch_order_boundaries.sql:47, 111; useCatalog.js:19).

**Files:** `README.md:29`, `scripts/build-seed.mjs:18`, `scripts/build-seed.mjs:39`, `src/App.jsx:28-32`, `src/App.jsx:29`, `src/data/products.js:22`, `src/data/products.js:22-23`, `src/data/products.js:763`, `src/lib/useCatalog.js:19`, `src/pages/admin/AdminPage.jsx:269`, `src/pages/admin/AdminPage.jsx:274`, `src/pages/admin/AdminPage.jsx:309`, `src/pages/admin/AdminPage.jsx:335`, `src/pages/support/PolicyPage.jsx:73`, `supabase/migrations/20260517000000_initial_schema.sql:78`, `supabase/migrations/20260517000001_rls_policies.sql:39`, `supabase/migrations/20260517000001_rls_policies.sql:39-40`, `supabase/migrations/20260517000001_rls_policies.sql:89`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:47`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:47-111`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:111`

**Evidence:** [security/trade-prices-public-to-anonymous-1280.jpg](screenshots/security__trade-prices-public-to-anonymous-1280.jpg), [seo/bundle-composition.txt](screenshots/seo__bundle-composition.txt)

- [ ] Done

#### AW-049 · Quote reference numbers are a 5-digit client-side random value, so they collide and can be pre-claimed to block every quote

**High** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/quote → Submit quote request / Submit order

**Problem:** App.jsx:1173 sets `useState(`ALW-Q-${Math.floor(Math.random() * 90000) + 10000}`)`, which allows only 90,000 values. submit_quote inserts p_ref_num as-is into orders.ref_num, which is `text unique not null`. Any unique_violation is re-raised as 'This quote was already submitted' (launch_order_boundaries.sql:249-251). A new quote collides with probability N/90,000 when N quotes exist, and there is a 39% chance that at least one of the first 300 quotes collides. Because refNum is fixed for the life of the page, every retry reuses the same colliding value and fails. The customer sees only the generic 'We couldn't save this quote. Please call … and reference ALW-Q-xxxxx', which names a reference belonging to someone else's order. submit_quote is granted to anon, so a script can also claim all 90,000 references and block every future quote site-wide.

**Also seen:**
- #/quote submit → submit_quote(p_ref_num) — refNum = `ALW-Q-${Math.floor(Math.random()*90000)+10000}` (App.jsx:1173): 90,000 values. orders.ref_num is UNIQUE (initial_schema.sql:105) and submit_quote inserts the client value (launch_order_boundaries.sql:199-203). By the birthday bound, collisions become likely after a few hundred orders (~50% at ~350). A collision raises 'This quote was already submitted' (line 249-251). The client then shows 'We couldn't save this quote. Please call … and…
- #/quote → submit (submit_quote RPC) — refNum = `ALW-Q-${Math.floor(Math.random()*90000)+10000}` (App.jsx:1173), which allows only 90,000 values. It is sent as p_ref_num (orders.js:14) into a UNIQUE column (initial_schema.sql:105). A collision raises 'This quote was already submitted' (launch migration :250-251). By the birthday bound a collision is likely once a few hundred orders exist, and each new order already has about n/90,000 odds. Because refNum is held in useState for the pa…

**Fix:** Generate quote reference numbers server-side in submit_quote (a sequence or long random id with a unique constraint), return the ref to the client, and stop passing a client-chosen 5-digit p_ref_num (App.jsx:1173, 1199-1202; orders.js:14).

**Files:** `src/App.jsx:1173`, `src/App.jsx:1199-1202`, `src/App.jsx:1202`, `src/lib/orders.js:14`, `supabase/migrations/20260517000000_initial_schema.sql:105`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:149`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:199`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:199-215`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:249`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:249-251`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:250`

- [ ] Done

#### AW-050 · Nobody is notified when a quote or order is saved, so orders sit unseen until someone opens #/admin

**High** · security-backend · Who: **Owner → Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit

**Where:** #/quote submit → 'A trade desk rep will reach out within one business day'; backend order pipeline

**Problem:** submit_quote only inserts rows and returns JSON. The repo has no supabase/functions directory, database webhook, pg_net call, email trigger or Netlify function, and BACKEND.md has no notification step. The customer receives no email receipt with the reference, and staff receive no alert. The confirmation page still promises contact 'within one business day' (App.jsx:1222), and the Admin Orders tab only loads when an admin visits it. Prior audit item 8 asked to 'verify staff/customer notifications'. The atomic save and server-generated receipt are now in place, but notification is still missing.

**Also seen:**
- #/quote submit → confirmation copy 'A trade desk rep will reach out within one business day' — submit_quote (launch_order_boundaries.sql:149-253) only inserts orders and order_items, and there is no AFTER INSERT trigger that notifies anyone. index.html:59-61 has a comment saying 'the live React forms POST to "/" with matching field names', but src/ contains no fetch or POST to '/' and no 'newsletter' UI. So <form name="apply"> (62-72), <form name="quote"> (73-87) and <form name="newsletter"> (88-91) are all dead. README.md:26 still says 'i…

**Fix:** Add a notification when submit_quote saves an order (Supabase database webhook or Edge Function sending email/SMS to the trade desk, plus an optional buyer confirmation email), so the 'rep will reach out within one business day' promise is backed (launch_order_boundaries.sql:149-253).

**Owner input needed:** Which email address or phone number should receive new quote/order notifications, and which email/SMS provider account should send them?

**Files:** `BACKEND.md:78`, `index.html:59-91`, `README.md:26`, `src/App.jsx:1222`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:149`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:149-253`

- [ ] Done

#### AW-051 · Backend setup never configures a production email sender, so confirmation and password-reset emails will not reach customers

**High** · security-backend · Who: **Owner → Cursor** · Effort: S · New

**Where:** Apply for a trade account → 'Check your inbox'; Sign in → Forgot password? → 'Check your inbox'

**Problem:** The signup flow depends on the confirmation email (AuthModal.jsx:173, 286), and password reset depends on the reset email (useAuth.js:93-97). BACKEND.md covers env vars, Site URL and the redirect allow-list, but never covers custom SMTP, sender domain (SPF/DKIM), auth rate limits or email templates. It even suggests turning confirmation off (BACKEND.md:80-83). Supabase's built-in sender only delivers to members of the project's team ('Email address not authorized' for everyone else) and is limited to about 2 messages per hour (https://supabase.com/docs/guides/auth/auth-smtp). If the project still uses the default sender, real applicants never get a confirmation link and resets never arrive. The UI still says the email is on its way. signUp also passes no `emailRedirectTo`, so confirmation links always go to the Site URL. The dashboard settings could not be inspected in this review.

**Fix:** Add a 'Production email' section to BACKEND.md. Steps: configure custom SMTP (Resend, Postmark or SES) under Authentication → Emails → SMTP Settings, with a sender on the business domain and SPF/DKIM records. Raise 'Rate limit for sending emails' under Authentication → Rate Limits to a sensible value (e.g. 100/hour). Keep 'Confirm email' ON in production and state that it must not be disabled outside a test project. Customise the Confirm signup and Reset password templates with the business name. In src/lib/useAuth.js signUp, add `emailRedirectTo: `${window.location.origin}/`` inside `options`, and add the production and deploy-preview origins to the redirect allow-list.

**Owner input needed:** Set up an SMTP provider (Resend, Postmark or SES) with a sender address on your business domain and SPF/DKIM records, then enter it in the Supabase Auth settings along with the production and deploy-preview redirect URLs.

**Files:** `BACKEND.md:74`, `BACKEND.md:80`, `src/lib/useAuth.js:67`, `src/lib/useAuth.js:95`

- [ ] Done

#### AW-196 · RLS policy profiles_self_update lets customers rewrite any profile column (email, license, EIN, resale certificate), which also lets a customer be promoted to admin by the owner-provisioning script

**Medium** · security-backend · Who: **Cursor** · Effort: M · New

**Where:** RLS policy profiles_self_update on public.profiles (reachable from the browser with the anon key and a customer session)

**Problem:** profiles_self_update only blocks changes to role, status and pricing_tier. Any signed-in customer can `update profiles set license_no=…, ein=…, resale_cert_no=…, business=…, state=…, email=…` on their own row, including after approval. The status stays 'approved', so the account keeps tier pricing under a different, unverified license. The admin view shows profiles.email as the contact address (AdminPage.jsx:197), so a customer can also change where the trade desk sends replies. The storefront has no profile-edit UI (the only `from('profiles').update` is in AdminPage.jsx:175), so customers need no UPDATE rights at all. Auth email changes (`auth.updateUser({ email })`) are also never synced to profiles.email.

**Also seen:**
- supabase/seed/provision_owner.sql (the owner setup step in BACKEND.md §2 and §5), RLS policy profiles_self_update — provision_owner.sql runs `update public.profiles set role='admin', status='approved' where email = 'REPLACE_WITH_OWNER_EMAIL'`. profiles.email is a plain case-sensitive `text unique` column. The profiles_self_update policy lets a user update their own row whenever role, status and pricing_tier stay unchanged, so email is freely writable: `supabase.from('profiles').update({ email: 'Alabamawholesaleinc@gmail.com' }).eq('id', myId)` passes RLS. The …

**Fix:** Restrict self-updates on public.profiles to safe contact columns, using column-level GRANT UPDATE or a BEFORE UPDATE trigger that rejects changes to email, status, role, tier, license, EIN and resale certificate after submission (rls_policies.sql:22). Change supabase/seed/provision_owner.sql to match the owner by auth.users.id / auth.users.email instead of profiles.email.

**Files:** `BACKEND.md:50`, `BACKEND.md:113`, `src/pages/admin/AdminPage.jsx:197`, `supabase/migrations/20260517000000_initial_schema.sql:9`, `supabase/migrations/20260517000001_rls_policies.sql:22`, `supabase/seed/provision_owner.sql:7`

- [ ] Done

#### AW-197 · License proof is not kept or auditable after approval: documents disappear from admin, applicants can delete them, and approvals record no who or when

**Medium** · security-backend · Who: **Cursor** · Effort: L · New

**Where:** #/admin → Accounts → Documents column; storage bucket application-documents; table profile_documents

**Problem:** The Documents column renders only when `p.status === 'pending'` (AdminPage.jsx:219). After Approve, or after suspension, the admin can no longer see or open the license or resale proof. RLS lets the applicant delete or replace their profile_documents rows and storage objects at any time, including after approval (application_documents.sql:51-56 and 88-93). profile_documents_self_insert also has no status check. Approving only sets status (AdminPage.jsx:250). There is no approved_by, approved_at or verification note, and no history table, so the business cannot show when, by whom, or on what evidence a tobacco buyer was approved.

**Fix:** 1) New migration: `alter table public.profiles add column approved_at timestamptz, add column approved_by uuid references public.profiles(id), add column verification_note text;`. Add a BEFORE UPDATE trigger that sets approved_at = now() and approved_by = auth.uid() when status changes to 'approved'. Create an append-only `public.profile_status_log(profile_id, old_status, new_status, changed_by, changed_at, note)` filled by an AFTER UPDATE trigger (admin-read RLS, no update or delete policies). 2) Change profile_documents_self_insert/update/delete, application_documents_owner_update and application_documents_owner_delete so they also require `exists(select 1 from public.profiles where id = auth.uid() and status = 'pending')`, which locks proof once approved. 3) In AdminPage.jsx:219 show the documents for every status, not just pending, and show approved_at / approved_by in the row.

**Files:** `src/pages/admin/AdminPage.jsx:219`, `src/pages/admin/AdminPage.jsx:250`, `supabase/migrations/20260927180000_application_documents.sql:48`, `supabase/migrations/20260927180000_application_documents.sql:51`, `supabase/migrations/20260927180000_application_documents.sql:55`, `supabase/migrations/20260927180000_application_documents.sql:88`

- [ ] Done

#### AW-198 · The anonymous quote RPC has no rate limit, CAPTCHA, or length/format checks, so it can be used to flood the order inbox

**Medium** · security-backend · Who: **Cursor** · Effort: M · New

**Where:** #/quote guest form; RPC public.submit_quote (granted to anon)

**Problem:** submit_quote is `grant execute … to anon` (launch_order_boundaries.sql:256) and runs SECURITY DEFINER. It checks only that fields are non-blank, that there are 1–200 items, and that qty is at most 100000. It sets no maximum length on business, contact, email, phone, notes or the ship_* fields, does not validate email format, ZIP or state, and accepts preferred_date values in the past. It has no per-IP, per-email or per-session throttle. The guest form (App.jsx:1268-1297) has no honeypot or CAPTCHA. A script can therefore insert unlimited 200-line quotes under any business name and email. Combined with the Admin Orders tab loading only the newest 200 orders (separate finding), 200 junk quotes push every real order out of the admin view.

**Fix:** New migration that recreates public.submit_quote with the same signature and grants. After the existing blank checks add: (a) `if length(p_business) > 200 or length(p_contact) > 120 or length(p_email) > 254 or length(p_phone) > 40 or length(coalesce(p_notes,'')) > 2000 or length(p_ship_street) > 200 or length(p_ship_city) > 100 or length(p_ship_zip) > 10 then raise exception 'A field is too long'; end if;` (b) `if btrim(p_email) !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'Enter a valid email'; end if;` (c) `if btrim(p_ship_zip) !~ '^[0-9]{5}(-[0-9]{4})?$' then raise exception 'Enter a valid ZIP code'; end if;` (d) `if upper(btrim(p_ship_state)) !~ '^[A-Z]{2}$' then raise exception 'Use the 2-letter state code'; end if;` (e) `if p_delivery = 'delivery' and upper(btrim(p_ship_state)) not in ('AL','MS','GA') then raise exception 'Delivery routes cover AL, MS and GA — choose will-call'; end if;`. Do not restrict the state for will-call. (f) `if p_preferred_date is not null and p_preferred_date < (now() at time zone 'America/Chicago')::date then raise exception 'Choose a date from today on'; end if;`. Throttle: `create table public.quote_throttle(key text not null, created_at timestamptz not null default now()); alter table public.quote_throttle enable row level security;` (no policies). Inside submit_quote: `v_key := coalesce(auth.uid()::text, coalesce(btrim(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)), 'unknown') || ':' || lower(btrim(p_email)));`, then `if (select count(*) from public.quote_throttle where key = v_key and created_at > now() - interval '15 minutes') >= 5 then raise exception 'Too many quote requests — please call the trade desk'; end if; insert into public.quote_throttle(key) values (v_key);`. Client (src/App.jsx:1268-1297): add a visually hidden honeypot input (name="company_website", tabIndex={-1}, autoComplete="off", aria-hidden) and skip submission when it is filled. Add maxLength 200/120/254/40 to business/contact/email/phone, 200 to street, 100 to city, 2 plus pattern="[A-Za-z]{2}" to state, pattern="[0-9]{5}(-[0-9]{4})?" to ZIP, 2000 to notes, and min set to today's date (YYYY-MM-DD) on the date input. Optionally, for guests, add Cloudflare Turnstile verified in an Edge Function that calls submit_quote with the service role, then revoke execute on submit_quote from anon.

**Files:** `src/App.jsx:1268`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:177`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:195`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:256`

- [ ] Done

#### AW-199 · Admin Orders tab loads only the newest 200 orders and its filter counts are wrong beyond that; Accounts has no paging

**Medium** · functional-bug · Who: **Cursor** · Effort: M · New

**Where:** #/admin → Orders (status pills 'new (n)', 'all (n)'); #/admin → Accounts

**Problem:** OrdersTab queries `.order('created_at', { ascending: false }).limit(200)` (AdminPage.jsx:69-74) and computes pill counts from that array (AdminPage.jsx:97). With more than 200 orders, older 'new' orders vanish silently and counts under-report. The UI says nothing about truncation. AccountsTab selects every profile with no limit, status filter or paging (AdminPage.jsx:141), so above PostgREST's default max-rows (1000) accounts are cut off silently. Pending applications are also mixed in with everyone else.

**Also seen:**
- #/admin → Orders → status pills — OrdersTab fetches .limit(200) (AdminPage.jsx:73) and computes 'new (n) / contacted (n) / … / all (n)' from those 200 rows (line 97). Once there are more than 200 orders, older 'new' orders disappear from the admin view and the counts are wrong, with no pagination or notice.
- #/admin → Products tab — src/pages/admin/AdminPage.jsx:303 renders `filtered.slice(0, 200)`. The note at :292 says '{filtered.length} of {rows.length} products' ('368 of 368 products'), which implies everything is listed. The only disclosure, 'Showing first 200 — narrow the search to see others.', is at :346, below all 200 rows. Search (:281–285) matches only name, brand and SKU, not id or category, so an admin cannot jump to e.g. id 250 by number. Found by source review…

**Fix:** Add server-side pagination (range + count: 'exact') to the #/admin Orders, Accounts and Products tables. Compute the status pill counts with separate count queries, not from the loaded 200 rows. Stop claiming the list shows 'all' (AdminPage.jsx:69-141, 281-303).

**Files:** `src/pages/admin/AdminPage.jsx:69`, `src/pages/admin/AdminPage.jsx:73`, `src/pages/admin/AdminPage.jsx:97`, `src/pages/admin/AdminPage.jsx:141`, `src/pages/admin/AdminPage.jsx:281`, `src/pages/admin/AdminPage.jsx:292`, `src/pages/admin/AdminPage.jsx:303`, `src/pages/admin/AdminPage.jsx:346`

- [ ] Done

#### AW-200 · Every quote-save failure shows one generic message and cites a reference that was never saved

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/quote → submit error box

**Problem:** handleQuoteSubmit (App.jsx:1199-1202) replaces every error except code 'unavailable' with 'We couldn't save this quote. Please call … and reference ALW-Q-xxxxx.' submit_quote raises specific, customer-actionable messages that are thrown away: 'Choose a variant for <product>', 'Product is not available' (item deactivated by admin or stale static catalog), 'Invalid quantity' (qty over 100000 from a hand-edited cart), 'A ship-to address is required', 'This quote was already submitted' (double click or retry after a lost response), 'Too many items'. The cited reference does not exist in the database, so staff cannot find it.

**Also seen:**
- #/quote → submit error message — submit_quote raises specific, user-fixable errors: 'Invalid quantity' (qty > 100000), 'Choose a variant for %', 'Unknown variant for %', 'Product is not available' (deactivated since it was carted), 'A ship-to address is required', 'Too many items' (>200 lines), 'This quote was already submitted'. The catch block (App.jsx:1199-1203) ignores err.message and always shows 'We couldn’t save this quote. Please call … and reference ALW-Q-…', so a buyer…

**Fix:** Surface the submit_quote validation messages to the user, mapped to friendly text, instead of one generic error. Don't show a reference number unless the save succeeded (App.jsx:1199-1202; orders.js:32).

**Files:** `src/App.jsx:1199`, `src/App.jsx:1200`, `src/App.jsx:1202`, `src/lib/orders.js:32`, `src/lib/useCatalog.js:16`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:69`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:73`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:81`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:90`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:190`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:196`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:251`

- [ ] Done

#### AW-201 · Suspended accounts can still submit quotes, although the site tells them ordering is paused

**Medium** · security-backend · Who: **Cursor** · Effort: M · New

**Where:** #/quote and cart drawer for a profile with status 'suspended'

**Problem:** AuthModal.jsx:179 and ApplyPage.jsx:81 say 'Ordering is paused on this account'. isApprovedBuyer is false for suspended profiles, so the cart shows 'Request quote' (App.jsx:1432) with the wrong note 'Pricing unlocks when your account is approved' (App.jsx:1386/1426), and QuotePage enables 'Submit quote request' (App.jsx:1296). submit_quote never reads the caller's profile status, so the quote is saved under the suspended user_id. Only pricing is withheld (enforce_order_item_price, launch_order_boundaries.sql:106-113).

**Fix:** At the top of submit_quote add: `if auth.uid() is not null and exists (select 1 from public.profiles where id = auth.uid() and status = 'suspended') then raise exception using message = 'This account is on hold', hint = 'account_suspended'; end if;`. In App.jsx derive `const isSuspended = profile?.status === 'suspended'` and pass it to CartDrawer and QuotePage. Replace the Request quote/Submit buttons with the 'Ordering is paused — call the trade desk' message and a tel: link, and change the drawer note for suspended accounts.

**Files:** `src/App.jsx:1296`, `src/App.jsx:1386`, `src/App.jsx:1426`, `src/components/AuthModal.jsx:179`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:176`

- [ ] Done

#### AW-202 · Admin saves and loads ignore Supabase errors, so failed approvals or price edits look like they worked

**Medium** · functional-bug · Who: **Cursor** · Effort: M · New

**Where:** #/admin → Orders status select, Accounts status/tier/role selects and Approve, Products Edit → Save

**Problem:** updateStatus (AdminPage.jsx:78-81), updateProfile (174-177) and save (273-277) call `await supabase.from(...).update(...)`, never read `{ error }`, and then reload. When RLS rejects the write (session expired, admin demoted, admin's is_admin false) or a constraint fails, the select snaps back with no message. Clearing the Price input makes `parseFloat('')` NaN (AdminPage.jsx:309), which serialises to null and violates `price not null`, and this fails silently. Loads also drop errors: OrdersTab and AccountsTab do `.then(({ data }) => set(data || []))` (74, 141, 269), so a failed load shows 'No orders in this state.' instead of an error.

**Also seen:**
- #/admin → Orders status select, Accounts selects / Approve, Products Save — updateStatus (AdminPage.jsx:78-81), updateProfile (:174-177) and save (:273-277) await supabase …update() without reading { error }, then reload. The reload queries (:68-75, :141, :269) also ignore errors. When RLS rejects a write or the network fails, the select snaps back with no message, and 'Approve' appears to do nothing.
- #/admin → Orders status select, Accounts status/tier/role selects and Approve, Products Save — updateStatus, updateProfile and save (AdminPage.jsx:78-81, :174-177, :273-277) await supabase.update() and ignore { error }. All three reload functions do .then(({ data }) => set(data || [])) and swallow load errors too, so a failed load looks like 'No orders in this state' or '0 of 0 products'. Simulated an admin locally with all writes aborted: changing ALW-Q-48213 to 'fulfilled' snapped the select back to 'new' with no alert, and Save on a pro…

**Fix:** Check { error } on every admin Supabase call (orders status, accounts status/tier/role/Approve, product Save, and loads). Show an error toast and keep the attempted value, or roll back visibly, instead of silently snapping back (AdminPage.jsx:68-78, 140-141).

**Files:** `src/pages/admin/AdminPage.jsx:68`, `src/pages/admin/AdminPage.jsx:74`, `src/pages/admin/AdminPage.jsx:78`, `src/pages/admin/AdminPage.jsx:140`, `src/pages/admin/AdminPage.jsx:141`, `src/pages/admin/AdminPage.jsx:174`, `src/pages/admin/AdminPage.jsx:268`, `src/pages/admin/AdminPage.jsx:269`, `src/pages/admin/AdminPage.jsx:273`, `src/pages/admin/AdminPage.jsx:309`

- [ ] Done

#### AW-203 · Admin role can be granted or removed, including on yourself, with one dropdown change and no confirmation

**Medium** · security-backend · Who: **Cursor** · Effort: S · New

**Where:** #/admin → Accounts → Role select

**Problem:** The Role `<select>` calls `updateProfile(p.id, { role: e.target.value })` on change (AdminPage.jsx:212-217). A mis-click or keyboard arrow on a customer row grants full admin, which exposes every order, EIN and license document to that customer. The same control on the admin's own row demotes them immediately and locks them out. Status 'suspended' is also one click away. No confirmation dialog, undo or audit record exists.

**Also seen:**
- #/admin → Accounts → Role select — The Role <select> calls updateProfile(p.id, { role: e.target.value }) immediately on change (AdminPage.jsx:213-216). There is no confirmation or guard against the signed-in admin removing their own admin role, which would lock them out of #/admin.
- #/admin → Accounts table → Role / Status selects — The Role select (AdminPage.jsx:213-216) calls updateProfile(p.id, { role }) on change. One mis-click or a keyboard arrow on a focused select promotes a customer to admin, or demotes the signed-in owner (including their own row) and immediately locks them out of #/admin. Status changes to 'suspended' are also instant (line 199).

**Fix:** Add a confirmation step for role/status changes in the #/admin Accounts table (especially granting or removing admin), and block admins from demoting or suspending themselves (AdminPage.jsx:199-213).

**Files:** `src/pages/admin/AdminPage.jsx:199`, `src/pages/admin/AdminPage.jsx:212`, `src/pages/admin/AdminPage.jsx:213`

- [ ] Done

#### AW-204 · Live catalog loading has no loading or error state and silently falls back to the bundled static catalog; there is no row cap handling

**Medium** · functional-bug · Who: **Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** All catalog routes (#/, #/catalog, #/category/*, #/product/*), cart and #/quote

**Problem:** useCatalog now loads the live products table (the prior audit's 'storefront ignores admin catalog' is partly fixed). If that request errors, returns 0 rows or is slow, it keeps STATIC_PRODUCTS without notice (useCatalog.js:22). The static list still contains items an admin deactivated and the original names and prices. Buyers can add them, and submit_quote then rejects the whole quote with 'Product is not available', which reaches them as the generic error (see the separate finding). The first paint always uses static data, so admin price or name edits flash old values first. The comment at useCatalog.js:24-25 says 'The products table has no description or sell-unit columns yet', but the live response already includes description and sell_unit.

**Also seen:**
- src/lib/useCatalog.js (all catalog pages) — useCatalog swallows errors and empty results silently (useCatalog.js:22) and exposes no loading/ready flag. A product that exists only in the DB, e.g. #/product/369 in the mocked test, first renders 'Product not found' with that title until the fetch returns. select('*') is unpaginated, so PostgREST's default max-rows (1000) will silently truncate the catalog once it grows. It also pulls every column, including updated_at and price, for anonymous…

**Fix:** Make useCatalog return {products, status, error} (useCatalog.js:13-24). Show a loading state, and a visible error with a retry option, instead of silently switching to the static catalog. If stale data is kept, label it and block quote submission against stale prices. Page through Supabase results or set an explicit range so the catalog isn't truncated at the default row limit.

**Files:** `src/App.jsx:155`, `src/lib/useCatalog.js:13`, `src/lib/useCatalog.js:17`, `src/lib/useCatalog.js:22`, `src/lib/useCatalog.js:24`

- [ ] Done

#### AW-205 · No security headers are configured for the Netlify deploy (CSP, clickjacking protection, nosniff, HSTS, Referrer-Policy)

**Medium** · security-backend · Who: **Cursor** · Effort: S · New

**Where:** netlify.toml (production responses for every route, including #/admin)

**Problem:** netlify.toml holds only [build], [build.environment] and the SPA redirect. It has no [[headers]] block, and public/ has no _headers file. Production pages will therefore go out without Content-Security-Policy, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy or Strict-Transport-Security. The admin dashboard (approve accounts, grant admin via one select change) can be framed by another site for clickjacking. Supabase session tokens live in localStorage ('aw-auth'), so any future XSS would have no CSP backstop. The app loads no third-party scripts, iframes or fonts (fonts are bundled), so a strict 'self' policy is feasible. Hashed /assets/* files also get no long-lived Cache-Control.

**Fix:** Append to netlify.toml: `[[headers]]\n  for = "/*"\n  [headers.values]\n    Content-Security-Policy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://<project-ref>.supabase.co; font-src 'self'; connect-src 'self' https://<project-ref>.supabase.co wss://<project-ref>.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"\n    X-Frame-Options = "DENY"\n    X-Content-Type-Options = "nosniff"\n    Referrer-Policy = "strict-origin-when-cross-origin"\n    Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=()"\n    Strict-Transport-Security = "max-age=31536000; includeSubDomains"\n[[headers]]\n  for = "/assets/*"\n  [headers.values]\n    Cache-Control = "public, max-age=31536000, immutable"`. Replace <project-ref> with the real Supabase host. Test a deploy preview for CSP console errors before promoting it.

**Files:** `netlify.toml:1`

- [ ] Done

#### AW-206 · Trade signup has no bot protection (no CAPTCHA or honeypot), and password strength is enforced only in the browser

**Medium** · security-backend · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** Apply for a trade account dialog (AuthModal signup form); Supabase Auth settings

**Problem:** Live DOM of the Apply dialog (#/apply → Start application): inputs name, organization, email, tel, new-password, business_type, ein, state, license_no, resale_cert_no, tobacco_license (file), resale_certificate (file) and expected_volume. There are 0 iframes, no captcha/turnstile/hcaptcha/recaptcha markup outside the dead Netlify forms, and no hidden or honeypot input. supabase.auth.signUp is called without options.captchaToken (useAuth.js:67-73). The public /auth/v1/settings shows disable_signup:false, so self-signup is open. Supabase's default per-IP rate limits slow a single-IP flood, but a distributed bot can still create many pending profiles. Each profile lands in the unfiltered Accounts tab (AdminPage.jsx:141, 193) and, once confirmed, can upload files. The password minimum of 8 exists only in the browser: minLength at AuthModal.jsx:246 and the JS check at ResetPasswordPage.jsx:23. The server minimum could not be read from public settings, and Supabase defaults to 6. BACKEND.md does not mention CAPTCHA, password policy, rate-limit or custom-SMTP settings.

**Fix:** 1) In Supabase → Authentication → Attack Protection, enable CAPTCHA with Cloudflare Turnstile. 2) Add a small <Turnstile> wrapper component that loads https://challenges.cloudflare.com/turnstile/v0/api.js and returns a token via callback. Render it in all three AuthModal forms: sign-in (AuthModal.jsx:190-205), signup (:231-279) and reset (:323-334). Keep each submit button disabled until a token exists, and reset the widget after every attempt. 3) In src/lib/useAuth.js pass `options: { captchaToken }` to signInWithPassword (line 80), signUp (line 67, merged with the existing options.data) and resetPasswordForEmail (line 95, alongside redirectTo). 4) If you adopt the CSP from AW-205, add https://challenges.cloudflare.com to script-src and frame-src. 5) Under Authentication → Providers → Email, set the minimum password length to 8 (matching the UI) and enable leaked-password protection if the plan allows it. Configure custom SMTP so confirmation emails are not throttled by the built-in sender. 6) Add a 'Security settings' checklist to BACKEND.md §5 (around line 78) covering CAPTCHA, password length, rate limits and SMTP.

**Owner input needed:** Create a Cloudflare Turnstile site, enable CAPTCHA in Supabase Authentication > Attack Protection with its secret key, and give Cursor the public site key.

**Files:** `BACKEND.md:78`, `src/components/AuthModal.jsx:231`, `src/components/AuthModal.jsx:246`, `src/lib/useAuth.js:67`

- [ ] Done

#### AW-207 · Document storage layout is not enforced on the server: storage_path is client-chosen, and users can upload unlimited files

**Medium** · security-backend · Who: **Cursor** · Effort: M · New

**Where:** Storage bucket application-documents policies; table profile_documents

**Problem:** The storage insert/update policies check only that the first folder equals auth.uid() (application_documents.sql:60-76). Any confirmed signup can PUT any number of 10 MB objects under `{uid}/anything/…`, so storage cost is unbounded, and the document_type subfolder is not enforced. profile_documents.storage_path is written by the client (documents.js:126-135) with no check tying it to `{profile_id}/{document_type}/` (application_documents.sql:22-30). A user can point their row at an arbitrary path, which the admin then signs and opens, or reserve a path through the UNIQUE constraint. uploadProfileDocument uploads before writing the row and ignores errors from removing the old file (documents.js:120-140), which leaves orphaned objects.

**Also seen:**
- supabase/migrations/20260927180000_application_documents.sql policies — 20260927180000_application_documents.sql:48-53: `profile_documents_self_insert … with check (auth.uid() = profile_id)` and `profile_documents_self_update … with check (auth.uid() = profile_id)`. Nothing checks that storage_path starts with `${auth.uid()}/${document_type}/`. With the unique storage_path constraint (line 25), any authenticated user can insert a row claiming the path `<otherUserId>/tobacco_license/<name>` before that user uploads, a…

**Fix:** Tighten the application-documents storage and profile_documents policies: require storage_path to start with auth.uid()/, cap files per user, and block insert/update/delete by the applicant after approval (application_documents.sql:22-67).

**Files:** `src/lib/documents.js:110`, `src/lib/documents.js:138`, `supabase/migrations/20260927180000_application_documents.sql:22`, `supabase/migrations/20260927180000_application_documents.sql:48`, `supabase/migrations/20260927180000_application_documents.sql:51`, `supabase/migrations/20260927180000_application_documents.sql:60`, `supabase/migrations/20260927180000_application_documents.sql:67`

- [ ] Done

#### AW-208 · Admin 'View' links are signed for every document on load and expire after 10 minutes, leaving dead links on screen

**Medium** · functional-bug · Who: **Cursor** · Effort: S · New

**Where:** #/admin → Accounts → Documents → View

**Problem:** On load, AccountsTab mints a signed URL for every profile_documents row, one request at a time, including rows for approved accounts whose documents are never shown (AdminPage.jsx:146-160). Each URL is valid for 600 seconds (documents.js:159). After 10 minutes the rendered `<a href>` links (AdminPage.jsx:229-233) still point at expired URLs, and clicking one opens a Supabase error page. The fallback button path that re-signs on click (viewDocument) is only used when no pre-signed URL exists.

**Also seen:**
- #/admin → Accounts → Documents → View — AccountsTab creates a signed URL for every document at load (AdminPage.jsx:146-160), one request after another, with a 600 s TTL (documents.js:159). Once a URL exists, it renders a plain <a href={signedUrl}> (AdminPage.jsx:229-233) instead of the button that mints a fresh URL. A rep who opens the tab and clicks View 10+ minutes later gets Supabase's expired-token JSON error.
- #/admin → Accounts → Documents → View — AccountsTab signs a URL for every document on load, one at a time (AdminPage.jsx:146-160), with a 600-second lifetime (documents.js:159), and renders them as plain <a href> links (AdminPage.jsx:229-233). After the tab has been open for 10 minutes, 'View' opens Supabase's expired-token error. Every approve or tier change calls reload(), which re-signs every document again (N sequential storage requests).

**Fix:** Don't pre-sign document URLs on load. Generate the signed URL on click of 'View' (short expiry), then open it (AdminPage.jsx:146, 229; documents.js:157-159).

**Files:** `src/lib/documents.js:157`, `src/lib/documents.js:159`, `src/pages/admin/AdminPage.jsx:146`, `src/pages/admin/AdminPage.jsx:229`

- [ ] Done

#### AW-347 · Document checks rely on file extension and declared MIME type only, so disguised files are accepted; HEIC uploads cannot be previewed by admin

**Low** · security-backend · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Apply dialog → Optional documents; #/apply → License documents; admin View link

**Problem:** validateDocumentFile (documents.js:48-57) accepts a file whenever its extension is pdf/jpg/jpeg/png/heic/heif and its declared type is empty, application/octet-stream or allowed. Tested in the live form: an HTML/script payload named license.pdf with an empty MIME type showed 'Selected: license.pdf', and a file starting with the Windows 'MZ' executable header named resale.png with application/octet-stream showed 'Selected: resale.png' (screenshot). contentTypeFor then labels them application/pdf and image/png from the extension (documents.js:72-78), and the bucket's allowed_mime_types only checks that declared header. Admins open these files from untrusted applicants. HEIC/HEIF is accepted but Chrome and Firefox cannot display it, so the admin's View link downloads an unreadable file.

**Fix:** In validateDocumentFile make it async and read the first 12 bytes with `file.slice(0, 12).arrayBuffer()`. Require the magic numbers %PDF (25 50 44 46), JPEG FF D8 FF, PNG 89 50 4E 47 0D 0A 1A 0A, or HEIC 'ftyp' at offset 4 with brand heic/heix/mif1, and reject mismatches with 'That file doesn't look like a PDF, JPG, PNG or HEIC.'. Update callers in DocumentUploads.jsx:34 and documents.js:106 to await it. For HEIC, either drop it from DOCUMENT_ACCEPT/ALLOWED_EXT and the bucket list, or convert to JPEG in the browser before upload (e.g. the heic2any package). Optionally add a server-side check in an Edge Function triggered on storage upload.

**Files:** `src/lib/documents.js:48`, `src/lib/documents.js:72`, `supabase/migrations/20260927180000_application_documents.sql:15`

**Evidence:** [security/signup-doc-upload-accepts-disguised-files.jpg](screenshots/security__signup-doc-upload-accepts-disguised-files.jpg)

- [ ] Done

#### AW-348 · EIN, license number, resale certificate and phone are copied into Supabase user_metadata, which rides in every access token and stays user-editable

**Low** · security-backend · Who: **Cursor** · Effort: S · New

**Where:** Signup (useAuth.signUp → options.data); auth.users.raw_user_meta_data

**Problem:** signUp sends `{ name, business, phone, license_no, ein, resale_cert_no, business_type, state, expected_volume }` as user metadata (useAuth.js:67-72). handle_new_user copies it into profiles (application_fields.sql:15-32) but never removes it from auth.users. Supabase includes user_metadata in the JWT access token, so the EIN and license numbers sit in the 'aw-auth' localStorage token and go out with every API request. The user can also rewrite them at any time with `auth.updateUser({ data })`, which leaves a second, divergent copy.

**Fix:** At the end of handle_new_user (new migration replacing the function) add `update auth.users set raw_user_meta_data = raw_user_meta_data - 'ein' - 'license_no' - 'resale_cert_no' - 'phone' - 'expected_volume' where id = new.id;`. The function is SECURITY DEFINER and owned by postgres, so it can write auth.users. Keep only name/business in metadata, and treat public.profiles as the single copy.

**Files:** `src/lib/useAuth.js:71`, `supabase/migrations/20260927000000_application_fields.sql:14`

- [ ] Done

#### AW-349 · Signed-in users can change their password at #/reset-password without the current password, and other sessions stay signed in

**Low** · security-backend · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/reset-password while signed in

**Problem:** On #/reset-password, ResetPasswordPage.jsx:54 shows the 'SIGNED IN' new-password form whenever `session` is truthy, even without a recovery link. handleSubmit (line 26) calls updatePassword, which is `supabase.auth.updateUser({ password })` with no current-password check or reauthentication nonce (useAuth.js:99-103). Anyone with brief access to a signed-in browser can therefore change the password with no knowledge of the old one. The legitimate owner must then recover through the emailed reset link. Other sessions' refresh tokens are revoked by Supabase on password change, but their current access tokens stay valid until expiry. Live testing was not possible because the review cannot sign in.

**Also seen:**
- #/reset-password while signed in (non-recovery) — When a session exists, ResetPasswordPage shows the new-password form (ResetPasswordPage.jsx:54-76, eyebrow 'SIGNED IN') and calls supabase.auth.updateUser({ password }) (useAuth.js:99-103). It never asks for the current password, so anyone at an unlocked shop computer can take over the trade account.

**Fix:** On #/reset-password without a recovery session, require the current password (re-authenticate) before updateUser, and sign out other sessions after a password change (ResetPasswordPage.jsx:26-54; useAuth.js:99).

**Files:** `src/lib/useAuth.js:99`, `src/pages/support/ResetPasswordPage.jsx:3`, `src/pages/support/ResetPasswordPage.jsx:26`, `src/pages/support/ResetPasswordPage.jsx:54`

- [ ] Done

#### AW-350 · Unused Netlify form endpoints (apply, quote, newsletter) are still registered, and the README describes a Netlify fallback that no longer exists

**Low** · code-quality · Who: **Cursor** · Effort: S · New

**Where:** index.html hidden forms (present in the live DOM); README.md 'Also on the storefront' and 'Stack'

**Problem:** index.html:62-91 declares hidden forms named apply, quote and newsletter with data-netlify, and the live DOM contains all three. No React code posts to them: a grep finds no fetch or form-name usage, and orders go only through submit_quote. Netlify still registers them at build time, so anyone can POST fake 'quote' submissions with arbitrary items/subtotal or 'apply' submissions with license numbers into the Netlify Forms inbox, bypassing all database validation. README.md:26 says 'if that fails, the quote form falls back to Netlify Forms', and README.md:76-77 say Tailwind and Lucide React are 'still used by Account and Admin'. lucide-react is not in package.json, and both pages use plain CSS.

**Also seen:**
- index.html <body> — index.html:59-91 declares hidden Netlify forms 'apply', 'quote' and 'newsletter', with the comment 'the live React forms POST to "/" with matching field names'. That is false: quotes go to supabase.rpc('submit_quote') (src/lib/orders.js:13) and applications go through Supabase Auth. The 'apply' stub fields (license, volume) do not match the real fields (ein, license_no, resale_cert_no, expected_volume), and there is no newsletter UI anywhere.
- index.html <body> hidden forms; README — index.html:59-91 declares hidden Netlify forms apply, quote and newsletter, with a comment saying the live React forms POST to "/" with matching field names. No code in src/ posts to "/" (grep for POST, urlencoded or form-name finds nothing). Quotes go only to supabase.rpc('submit_quote') (src/lib/orders.js:13) and applications to Supabase Auth. The quote form's field list is also out of date (no shipStreet/shipCity/shipState/shipZip). README.md:…
- index.html hidden forms 'apply', 'quote', 'newsletter' — index.html:59-91 contains hidden data-netlify forms named apply, quote and newsletter. The app now submits applications through Supabase Auth and quotes through the submit_quote RPC, and there is no newsletter. Netlify still registers these endpoints at deploy, so bots can POST spam into the Netlify Forms inbox and use up form quota. README.md:26 still claims 'the quote form falls back to Netlify Forms', which is no longer true.

**Fix:** Delete the hidden Netlify form stubs ('apply', 'quote', 'newsletter') from index.html:59-91, and remove the README's Netlify Forms fallback claims (README.md:26, 76).

**Files:** `index.html:59`, `index.html:59-91`, `index.html:88`, `README.md:26`, `README.md:76`, `src/lib/orders.js:6-35`

- [ ] Done

#### AW-351 · Tier discounts are hard-coded in the browser and duplicate pricing_tiers, and the receipt never shows the server-calculated total

**Low** · code-quality · Who: **Cursor** · Effort: M · New

**Where:** Product cards, cart and #/quote totals for approved accounts; order confirmation screen

**Problem:** App.jsx:28 hard-codes `TIER_DISCOUNT = { standard: 0, silver: 0.05, gold: 0.10 }` for display. submit_quote prices lines from public.pricing_tiers. If an admin edits a tier's discount_pct, buyers see one total and are saved at another. The confirmation screen (App.jsx:1216-1224) ignores `receipt.subtotal` and `receipt.total_units` from the server. BACKEND.md:108-109 says a new tier only needs a pricing_tiers row plus TIER_DISCOUNT. It also needs the profiles_pricing_chk constraint (initial_schema.sql:25) and the admin Tier select options (AdminPage.jsx:206-210) to change.

**Fix:** Remove TIER_DISCOUNT from App.jsx and use the per-buyer prices from the `my_prices()` RPC proposed in the price-exposure finding. Until then, load `pricing_tiers` once for approved users and compute from it. On the confirmation screen render `Saved total: ${money(receipt.subtotal)} · ${receipt.total_units} units` when receipt.subtotal is not null. Update BACKEND.md:108-109 to list all three places a new tier must be added. Better, replace profiles_pricing_chk with a foreign key `profiles.pricing_tier references pricing_tiers(tier)` and build the admin options from the table.

**Files:** `BACKEND.md:108`, `src/App.jsx:28`, `src/App.jsx:1224`, `src/pages/admin/AdminPage.jsx:206`, `supabase/migrations/20260517000000_initial_schema.sql:25`

- [ ] Done

#### AW-352 · is_admin() ignores account status, so a suspended admin keeps full database admin rights

**Low** · security-backend · Who: **Cursor** · Effort: S · New

**Where:** public.is_admin() used by every admin RLS policy and the document read policy

**Problem:** is_admin() returns `role = 'admin'` for auth.uid() with no status check (rls_policies.sql:8-17). Setting an admin's status to 'suspended' from the Accounts tab therefore does not remove access to orders, all profiles (EINs, licenses), document signed URLs, or product and pricing writes.

**Fix:** 1) Add a new migration, e.g. supabase/migrations/20260928000000_is_admin_requires_approved.sql: `create or replace function public.is_admin() returns boolean language sql security definer stable set search_path = public as $$ select coalesce((select role = 'admin' and status = 'approved' from public.profiles where id = auth.uid()), false); $$;` (existing policies pick it up automatically). 2) In src/App.jsx:161 change to `const isAdmin = profile?.role === 'admin' && profile?.status === 'approved';`. 3) In src/pages/admin/AdminPage.jsx:19 change the guard to `if (!profile || profile.role !== 'admin' || profile.status !== 'approved')` and, when role is admin but status is not approved, render 'Your admin access is on hold. Contact the owner.' instead of 'Admin role required.'. 4) In AccountsTab updateProfile (AdminPage.jsx:174), block changing your own row's status or role (`if (id === currentAdminId) return;`, and disable those selects for the signed-in admin's row) so an admin cannot lock themself out. When the Role select is set to 'admin' on a non-approved row, also set status: 'approved' in the same update.

**Files:** `src/App.jsx:161`, `src/pages/admin/AdminPage.jsx:19`, `src/pages/admin/AdminPage.jsx:174`, `supabase/migrations/20260517000001_rls_policies.sql:13`

- [ ] Done

#### AW-353 · .gitignore ignores only .env and .env.local, not the other Vite env files

**Low** · code-quality · Who: **Cursor** · Effort: S · New

**Where:** .gitignore

**Problem:** .gitignore:7-8 lists `.env` and `.env.local` only. Vite also loads .env.production, .env.development, .env.production.local and .env.[mode].local, and none of those are ignored, so creating one to hold production keys would get it committed. The current state is clean: .env.local is ignored with permissions 600 and holds only the anon key (JWT role 'anon'), and a search of all 48 commits on all branches found no JWTs, sb_secret_ or service_role strings, or supabase.co project URLs.

**Fix:** Replace .gitignore lines 7-8 with `.env`, `.env.*` and `!.env.example`.

**Files:** `.gitignore:7`

- [ ] Done

## Launch readiness & engineering lifecycle

#### AW-052 · The production domain hard-coded across the site, alabamawholesaleinc.com, is not registered

**High** · security-backend · Who: **Owner → Cursor** · Effort: M · New

**Where:** index.html <head> (canonical, og:url, og:image, twitter:image, JSON-LD); /robots.txt; /sitemap.xml; BACKEND.md Supabase Auth 'Site URL' step

**Problem:** Checked 2026-09-28. `dig alabamawholesaleinc.com A` and `dig www.alabamawholesaleinc.com A` both return NXDOMAIN, and `whois -h whois.verisign-grs.com alabamawholesaleinc.com` returns 'No match'. The domain is hard-coded 17 times: index.html:9, 22, 23, 29, 38, 39 (6), public/robots.txt:4 (1) and public/sitemap.xml:3-12 (10). Nothing in src/, scripts/ or supabase/ uses it. og:image and twitter:image (index.html:23, 29) point at a host that does not resolve, so a shared link currently shows no preview image, and the JSON-LD url and image (38-39) point there too. signUp (src/lib/useAuth.js:67-73) passes no emailRedirectTo, so confirmation links go to whatever the Supabase Site URL is. BACKEND.md:74-76 says to set that URL to 'the production domain', and supabase-js's default implicit flow returns access_token/refresh_token in the URL fragment. Evidence: screenshots/qa-gap2-launch-lifecycle__dist-and-domain-check.txt

**Fix:** (1) Before launch, register alabamawholesaleinc.com (or decide the final domain) and add it in Netlify → Domain management as the primary domain with HTTPS. Add the www variant, and add a netlify.toml redirect `[[redirects]] from = "https://www.alabamawholesaleinc.com/*" to = "https://alabamawholesaleinc.com/:splat" status = 301 force = true`. (2) Set the Supabase Auth Site URL only after the domain resolves to the Netlify site; until then use the Netlify *.netlify.app URL. (3) Stop hard-coding the domain: add `VITE_SITE_URL` to .env.example and the Netlify env, and replace the literal in index.html:9,22,23,29,38,39 with `%VITE_SITE_URL%`, which Vite substitutes in index.html. Generate public/robots.txt and public/sitemap.xml from that variable in a small build script instead of committing literals. (4) In src/lib/useAuth.js signUp options (line 70), add `emailRedirectTo: `${window.location.origin}/``, so confirmation links return to the origin the applicant used, which must be allow-listed.

**Owner input needed:** Register alabamawholesaleinc.com (or tell us the final production domain) and connect it in Netlify, so Cursor can set VITE_SITE_URL and replace the hard-coded domain.

**Files:** `BACKEND.md:74`, `index.html:9`, `index.html:22`, `index.html:23`, `index.html:29`, `index.html:38`, `public/robots.txt:4`, `public/sitemap.xml:3`, `src/lib/useAuth.js:67`

**Evidence:** [gap2-launch-lifecycle/domain-check.txt](screenshots/gap2-launch-lifecycle__domain-check.txt)

- [ ] Done

#### AW-053 · A production build without the Supabase env vars succeeds silently and ships a site with sign-in, applications and quotes disabled

**High** · security-backend · Who: **Cursor** · Effort: S · Partly fixed since the 2026-09-25 audit

**Where:** Netlify production build → every route (auth dialog, #/quote submit, #/account, #/admin)

**Problem:** src/lib/supabase.js:7-18 creates a null client when either variable is missing. src/App.jsx:1183 and :1293 then show the 'can’t be saved' message, and the submit button at :1296 is disabled. The build passes anyway: neither vite.config.js nor netlify.toml has a guard. It has happened twice. (a) The old ~/Desktop/alabamawholesaleinc.com/alabama-wholesale-netlify-source/dist (2026-05-24) has 0 'supabase.co' in assets/index-D3CurPUo.js. (b) The current worktree's dist/ (built Sep 26 22:08:58, commit bf94cca) has 0 'supabase', 'auth/v1', 'rest/v1', 'aw-auth' or 'submit_quote' strings in dist/assets/*.js, and 4 copies of the 'can’t be saved right now' fallback. Deploying it would ship a site where sign-in, applications and quotes are all disabled. Evidence: screenshots/qa-gap2-launch-lifecycle__dist-and-domain-check.txt

**Fix:** Turn vite.config.js into a function and fail every production build that lacks the variables, not only Netlify production builds. `import { defineConfig, loadEnv } from 'vite'; export default defineConfig(({ command, mode }) => { const env = loadEnv(mode, process.cwd(), ''); if (command === 'build' && mode === 'production' && env.ALLOW_NO_BACKEND !== '1' && (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(env.VITE_SUPABASE_URL || '') || !env.VITE_SUPABASE_ANON_KEY)) { throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for production builds (set ALLOW_NO_BACKEND=1 to build a static-only preview on purpose).'); } return { /* existing config */ }; });`. Keep the CI workflow's dummy-value build working by passing ALLOW_NO_BACKEND=1, or valid-looking dummy values, in that job only. Delete the stale backend-less local dist/ (`rm -rf dist`). Add a line to BACKEND.md section 4 and NETLIFY-DEPLOY.md saying the build now fails without the variables.

**Files:** `BACKEND.md:6`, `netlify.toml:5`, `package.json:13`, `src/lib/supabase.js:7`, `vite.config.js:1`

- [ ] Done

#### AW-209 · No test, lint or CI safety net on any branch, while many unreviewed commits and Cursor merges sit ahead of main

**Medium** · code-quality · Who: **Cursor** · Effort: L · New

**Where:** Repository root: package.json scripts, no eslint/vitest/playwright config, no .github/workflows

**Problem:** package.json:7–15 defines only images, seed, predev, dev, prebuild, build and preview; there is no lint, test or typecheck script. None of these exist on HEAD or on any of the 7 branches (main, redesign/2a-editorial and four remote cursor/* branches): eslint or prettier config, vitest/jest/playwright config, *.test.* or *.spec.* files, a .github/ folder, PropTypes, or TypeScript. HEAD d19d7dc is 46 commits ahead of origin/main and 0 behind. Four Cursor branches were merged within 53 seconds on 2026-09-27 04:26:35–04:27:28 UTC (ea4feb0, 44868f3, 376c8a8, 23b062b) with no automated check. I ran ESLint 9 with eslint-plugin-react-hooks on a scratchpad copy of src/. It found 1 error (src/App.jsx:50, empty catch block) and 2 react-hooks/exhaustive-deps warnings: src/lib/useAuth.js:61 and src/pages/account/AccountPage.jsx:41, which is the known order-history fetch bug. It also found 16 unused `import React`. So lint alone catches little; the value is in tests. Six node:test tests against a copy of src/lib/lines.js (lineKey round-trip, the legacy {id:qty} cart, null/array carts, longest-base SKU match, bare multi-variant SKU, variant SKU suffix) all pass in 62 ms, so the lib is testable today. The risky helpers are inlined in App.jsx and cannot be imported by a test: money (App.jsx:44), parseHash/routeToHash (App.jsx:164–188) and priceForProfile. Tooling is also blocked by the build stack: vitest 4.x/5.x require Vite ≥6, and vitest 5 requires Node ^22.12. Known bugs a minimal suite would have caught, by title: 'Malformed percent-encoding in the hash crashes the router'; 'Router accepts unknown and non-canonical routes…'; 'Money is formatted without thousands separators'; 'Client price math does not round unit prices…'; 'Browser-storage reads are unguarded…'; 'No error boundary: any render error blanks the whole site'; 'Cart is not cleared after a successful quote/order unless the user clicks Back to home…'; 'Quick Reorder: Add N lines to order silently does nothing when any row has quantity 0 or a decimal…'; 'Clearing a price in the admin editor sends null and triggers a NaN warning' (a console-error assertion catches it); 'Account order history fetch has no cancellation or reset' (the exhaustive-deps warning above); 'Navigation pushes duplicate history entries…'; plus the new returning-visitor cart finding.

**Fix:** Keep steps (1)-(7) as written, with these changes. (1) Move `TIER_DISCOUNT` and `priceForProfile` from src/App.jsx:28-32 into a new src/lib/pricing.js, export both, and import them back into App.jsx. (5) In playwright.config.js, set webServer.command to `npm run build && npx vite preview --port 4173 --strictPort --open false`. Also change vite.config.js:8 to `open: !process.env.CI`. preview.open inherits server.open, so without these, CI and Playwright runs will try to open a browser. Optional: to start testing before the Node/Vite upgrades, vitest@^3.2 supports vite ^5 and Node 20, so the unit tests in step (4) can land first and the move to vitest 5 can come with the Vite 7 upgrade.

**Files:** `package.json:7`, `src/App.jsx:28`, `src/App.jsx:44`, `src/App.jsx:164`, `src/lib/lines.js:126`, `src/lib/orders.js:6`, `src/pages/account/AccountPage.jsx:41`, `vite.config.js:8`

**Evidence:** [gap2-launch-lifecycle/eslint-report.txt](screenshots/gap2-launch-lifecycle__eslint-report.txt), [gap2-launch-lifecycle/demo-lines.test.mjs](screenshots/gap2-launch-lifecycle__demo-lines.test.mjs), [gap2-launch-lifecycle/demo-lines.test.out](screenshots/gap2-launch-lifecycle__demo-lines.test.out)

- [ ] Done

#### AW-210 · No analytics, conversion events, error reporting or uptime alerts: the owner cannot see traffic, quote conversions, production crashes or a paused backend

**Medium** · code-quality · Who: **Owner → Cursor** · Effort: L · New

**Where:** All routes: index.html, src/main.jsx, src/App.jsx route effect / quote submit / add-to-quote / age gate, src/components/AuthModal.jsx application submit, 26 tel:/mailto: links

**Problem:** A grep of index.html, src/, public/ and netlify.toml for gtag, googletagmanager, plausible, sentry, posthog, umami, fathom, onerror, unhandledrejection and sendBeacon finds nothing. The only runtime log is `console.warn('profile load failed', error)` at src/lib/useAuth.js:56. The quote-submit catch at src/App.jsx:1199-1202 ignores `err` except for err.code and shows a generic message. The AuthModal sign-in catch (:99), sign-up catch (:125) and reset catch (:133) pass err to describeError() for on-screen text, but never log or report it. src/main.jsx:6-10 has no error hook. There are 26 tel:/mailto: links across 7 files (App.jsx 11, AuthModal 3, ContactPage 4, SupportShell 4, ServiceUnavailable 2, DocumentUploads 1, ApplyPage 1), and none is tracked. vite.config.js:10-21 sets no sourcemap, and package.json:4 is 1.0.0. The hash router means an automatic pageview sees only '/'.

**Fix:** (1) Create src/lib/telemetry.js with three exports. `track(name, props)` is a no-op until age verified and only allows the whitelisted props below. `reportError(err, context)`. `routeTemplate(route)` returns '/', '/catalog', '/category/:dept', '/category/:dept/:sub', '/product/:id', '/quote', '/account', '/admin' or '/<support page>', and never reads location.hash. (2) Choose a cookieless, first-party analytics tool (Plausible, self-hosted Umami, or Cloudflare Web Analytics). Turn off its automatic pageviews and hash mode. Do not add Meta Pixel or Google Ads remarketing tags: those platforms prohibit promoting tobacco and e-cigarettes, and this is a 21+ tobacco/vape catalog. Load the script from App.jsx only after `verified` is true (App.jsx:282). Never send email, business name, phone, EIN, license, resale certificate, address or Notes text in event props. (3) Wiring: • src/main.jsx before line 6: init error reporting, e.g. Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, release: import.meta.env.VITE_COMMIT_REF, sendDefaultPii: false, beforeSend scrubs `access_token|refresh_token` from event.request.url }). Or add window 'error' + 'unhandledrejection' listeners that sendBeacon to a Netlify Function. Also add one delegated capture listener: document.addEventListener('click', e => { const a = e.target.closest('a[href^="tel:"],a[href^="mailto:"]'); if (a) track(a.href.startsWith('tel:') ? 'call_click' : 'email_click', { page: current route template }); }, true). This one listener covers all 26 links. • App.jsx:197–205 route effect: track('pageview', { path: routeTemplate(shown) }). • App.jsx:265 handleAgeYes → track('age_verified'); App.jsx:282 onNo → track('age_gate_declined'). • App.jsx:239 addLine → track('add_to_quote', { dept: product.cat }). • App.jsx:274–275 openSignup/openApplication → track('application_started', { entry }) (pass an entry label from each caller). • AuthModal.jsx:121–122 → track('application_submitted', { confirmEmail: !data?.session, docs: chosen }); AuthModal.jsx:125 → reportError(err, { where: 'signup' }); AuthModal.jsx:99 → reportError. • App.jsx:1197 → track('quote_submitted', { lines: items.length, units: totalUnits, buyer: isApprovedBuyer ? 'approved' : 'guest', delivery: data.delivery }); App.jsx:1199 → reportError(err, { where: 'submit_quote', ref: refNum }) and track('quote_failed'). • useAuth.js:56 → reportError. • The known error boundary's componentDidCatch → reportError. (4) vite.config.js build: add `sourcemap: 'hidden'`, upload the maps from CI, and `define: { 'import.meta.env.VITE_COMMIT_REF': JSON.stringify(process.env.COMMIT_REF || 'dev') }` (Netlify sets COMMIT_REF). (5) Add an external uptime monitor (e.g. UptimeRobot or Better Stack) on the site URL and on `${VITE_SUPABASE_URL}/rest/v1/products?select=id&limit=1` with the anon key, alerting the owner. Or move the Supabase project to Pro so it never pauses. (6) Update the privacy policy: in src/pages/support/PolicyPage.jsx:43–47 add a 'Site usage and error data (pages viewed, buttons used, device/browser, error reports); no advertising cookies' bullet. In :49–53 add 'To measure how the site is used and fix errors', naming the analytics and error-monitoring vendors and their retention.

**Owner input needed:** Which cookieless analytics service (Plausible, Umami or Cloudflare Web Analytics), error-reporting service and uptime monitor do you want, and can you create those accounts and supply the site IDs/DSNs?

**Files:** `src/App.jsx:197`, `src/App.jsx:239`, `src/App.jsx:265`, `src/App.jsx:274`, `src/App.jsx:282`, `src/App.jsx:1197`, `src/App.jsx:1199`, `src/components/AuthModal.jsx:121`, `src/components/AuthModal.jsx:125`, `src/lib/useAuth.js:56`, `src/main.jsx:6`, `src/pages/support/PolicyPage.jsx:43`, `vite.config.js:10`

- [ ] Done

#### AW-211 · Build toolchain runs an unsupported Vite 5 with 8 open advisories (4 high), and npm audit is turned off everywhere

**Medium** · security-backend · Who: **Cursor** · Effort: M · New

**Where:** package.json devDependencies; package-lock.json; .npmrc; netlify.toml NPM_FLAGS

**Problem:** I ran `npm audit --package-lock-only` on a scratchpad copy of package.json and package-lock.json: 8 vulnerabilities (2 low, 2 moderate, 4 high, 0 critical). Each is installed → first patched version: • vite 5.4.21 (direct): GHSA-fx2h-pf6j-xcff HIGH server.fs.deny bypass on Windows alternate paths, fixed 6.4.3 / 7.3.5 / 8.0.16; GHSA-v6wh-96g9-6wx3 moderate launch-editor NTLMv2 hash disclosure, fixed 6.4.3 / 7.3.5 / 8.0.16; GHSA-4w7w-66w2-5vf9 moderate path traversal in optimized-deps .map, fixed 6.4.2 / 7.3.2 / 8.0.5. • esbuild 0.21.5 (via vite 5): GHSA-67mh-4wv8-2f99 moderate, the dev server answers cross-origin requests, fixed 0.25.0 (reachable only through a Vite major upgrade). • postcss 8.5.14 (direct): GHSA-r28c-9q8g-f849 HIGH, fixed 8.5.18; GHSA-fxqj-rqcc-2cmp moderate, fixed 8.5.23. • browserslist 4.28.2: GHSA-c83g-rgw3-j3cx HIGH and GHSA-73wf-gq98-2v4g HIGH, fixed 4.28.7. • nanoid 3.3.12: GHSA-28wg-ghj8-5hjv HIGH (fixed 3.3.16) and GHSA-2v37-7h3g-55p8 HIGH (fixed 3.3.18). • baseline-browser-mapping 2.10.29: GHSA-w5vr-8v7q-w6rv moderate, fixed 2.11.0. • @babel/core 7.29.0: GHSA-4x5r-pxfx-6jf8 low, fixed 7.29.6. • postcss-selector-parser 6.1.2: GHSA-w9m9-85wc-3x92 low, fixed 6.1.3. `npm audit --omit=dev` reports 0, so the shipped bundle (react, react-dom, @supabase/supabase-js) is clean; exposure is the dev server and build machine. Support status: vite.dev/releases lists regular patches for vite@8.3, important fixes and security patches for vite@7.3 and vite@8.2, and security patches only for vite@6.4 and vite@8.1. It states 'All versions before these are no longer supported'. Vite 5's last release was 5.4.21 on 2025-10-20, so the Vite fixes above will never reach 5.x. Other packages: @vitejs/plugin-react 4.7.0 (last 4.x, 2025-07-18; latest 6.1.1 needs vite ^8; 5.2.0 supports vite 4–8). @supabase/supabase-js 2.105.4 (2026-05-08) is 31 releases behind 2.117.2 (2026-09-25). react/react-dom 18.3.1 have had no React 18 release since 2024-04-26 and there is no stated support policy; latest is 19.3.0, and the backport tag points to 19.0.8. There are no current React 18 advisories, so this is not a launch blocker. tailwindcss 3.4.19 equals the maintained `v3-lts` dist-tag (fine). postcss latest is 8.5.28, autoprefixer 10.6.1, sharp 0.35.5. Audits are suppressed: .npmrc:2 `audit=false` and netlify.toml:7 `NPM_FLAGS = "--no-audit --no-fund"`. There is no Dependabot or Renovate config.

**Fix:** Do this after the Node 24 change (the Vite 7 and 8 lines require Node ^20.19 || >=22.12). (1) package.json: "vite": "^7.3.6" (in 'important fixes + security' support, and still Rollup-based, so vite.config.js keeps working as is), "@vitejs/plugin-react": "^5.2.0", "postcss": "^8.5.28", "autoprefixer": "^10.6.1", "sharp": "^0.35.5", "@supabase/supabase-js": "^2.117.2". (2) Run `npm install`, then `npm update browserslist nanoid @babel/core baseline-browser-mapping postcss-selector-parser caniuse-lite`. Confirm `npm audit` reports 0 and commit the regenerated package-lock.json. (3) Plan Vite 8.3 + @vitejs/plugin-react 6.1 as a follow-up: Vite 8 switches the bundler to Rolldown, so re-verify the manualChunks block at vite.config.js:14–19. Plan React 19 after launch. (4) Delete `audit=false` from .npmrc, and change netlify.toml:7 to `NPM_FLAGS = "--no-fund"`. Add `npm audit --omit=dev --audit-level=high` to CI (see the CI finding). (5) Add .github/dependabot.yml (package-ecosystem: npm, directory: /, schedule: weekly, with a group for vite/@vitejs/*, and a separate github-actions entry) so advisories become PRs.

**Files:** `.npmrc:2`, `netlify.toml:7`, `package-lock.json`, `package.json:17`, `package.json:22`, `package.json:24`, `package.json:27`, `vite.config.js:14`

**Evidence:** [gap2-launch-lifecycle/npm-audit.json](screenshots/gap2-launch-lifecycle__npm-audit.json), [gap2-launch-lifecycle/npm-audit-summary.txt](screenshots/gap2-launch-lifecycle__npm-audit-summary.txt), [gap2-launch-lifecycle/advisory-patched-versions.txt](screenshots/gap2-launch-lifecycle__advisory-patched-versions.txt), [gap2-launch-lifecycle/npm-audit-prod-only.json](screenshots/gap2-launch-lifecycle__npm-audit-prod-only.json), [gap2-launch-lifecycle/npm-view.txt](screenshots/gap2-launch-lifecycle__npm-view.txt), [gap2-launch-lifecycle/release-dates.txt](screenshots/gap2-launch-lifecycle__release-dates.txt), [gap2-launch-lifecycle/lockfile-installed-versions.txt](screenshots/gap2-launch-lifecycle__lockfile-installed-versions.txt)

- [ ] Done

#### AW-212 · Netlify builds on Node.js 20, which reached end-of-life on 2026-04-30, while local dev runs Node 24 and 26; there is no engines field

**Medium** · code-quality · Who: **Cursor** · Effort: S · New

**Where:** .nvmrc; netlify.toml [build.environment]; package.json (no engines); NETLIFY-DEPLOY.md

**Problem:** nodejs/Release schedule.json (GET): v20 'end': '2026-04-30'. The last 20.x release is v20.20.2 on 2026-03-24 (nodejs.org/dist/index.json), so Node 20 has had no security release for six months. v22 is in maintenance until 2027-04-30. v24 'Krypton' is Active LTS until 2026-10-20 and supported until 2028-04-30 (latest 24.21.0, 2026-09-07). v26 is Current until LTS on 2026-10-28. The repo pins 20: .nvmrc:1 = `20`, and netlify.toml:6 = `NODE_VERSION = "20"`. NETLIFY-DEPLOY.md:10 still calls it 'Node 20 LTS'. The machines disagree: the shell's nvm default is v24.20.0, and the running dev server on :3000 (pid 38714) runs /opt/homebrew/Cellar/node/26.8.1/bin/node, a non-LTS Current release. So what is tested locally is not what Netlify builds. package.json has no "engines" field, and package-lock.json's root has engines: null. Engine requirements of the dependencies: sharp 0.35.4/0.35.5 needs node >=20.9.0 (fine on 22/24). vite 7.x/8.x, @vitejs/plugin-react 5.2+/6.x and eslint 10 need ^20.19.0 || >=22.12.0. @supabase/supabase-js 2.110.0 and later (from 2026-06-30) declare node >=22.0.0, as does vitest 5 (^22.12 || ^24 || >=26). Staying on Node 20 therefore also blocks the dependency and test upgrades in the other two findings.

**Fix:** (1) .nvmrc → `24`. (2) netlify.toml:6 → `NODE_VERSION = "24"`. (3) package.json: add `"engines": { "node": ">=22.12.0 <27" }` after "description", and add `engine-strict=true` to .npmrc so a wrong Node version fails `npm ci` instead of warning. (4) NETLIFY-DEPLOY.md:10: replace the sentence with '`.nvmrc` and `NODE_VERSION = "24"` pin Node 24 LTS (supported to April 2028)'. (5) Locally, run the dev server through nvm (`nvm use` reads .nvmrc) instead of Homebrew's node 26. The CI workflow should use `node-version-file: .nvmrc`, so local, CI and Netlify all share one version. sharp 0.35's `>=20.9.0` requirement is satisfied by 24, and so are Vite 7/8, supabase-js 2.117 and vitest 5.

**Files:** `.nvmrc:1`, `NETLIFY-DEPLOY.md:10`, `netlify.toml:6`, `package.json:1`

**Evidence:** [gap2-launch-lifecycle/node-release-schedule.json](screenshots/gap2-launch-lifecycle__node-release-schedule.json), [gap2-launch-lifecycle/node-latest.txt](screenshots/gap2-launch-lifecycle__node-latest.txt), [gap2-launch-lifecycle/node-versions-in-use.txt](screenshots/gap2-launch-lifecycle__node-versions-in-use.txt)

- [ ] Done

#### AW-213 · The backend deploy runbook has no backup, rollback, migration tracking or deploy order, its redirect list is incomplete, and previews share the production database

**Medium** · security-backend · Who: **Owner → Cursor** · Effort: M · New

**Where:** BACKEND.md sections 2 (migrations), 4 (Netlify env), Auth URL configuration, 'Resetting'; supabase/ (no config.toml)

**Problem:** (a) No backup or plan guidance. BACKEND.md:10–13 just says 'create a new project'. The Supabase pricing page says Free projects have no automatic backups ('Not included'; Pro has 7 days) and are 'paused after 1 week of inactivity'. The only recovery step is 'Resetting: drop schema public cascade' (BACKEND.md:129–135), which deletes every order, profile and document row. (b) Rollback is a trap. 20260925120000_launch_order_boundaries.sql:258–262 drops the insert policies and revokes INSERT on orders/order_items. A frontend built before commit 4609eac, such as the current origin/main head f858342, inserts into orders directly (origin/main:src/lib/orders.js:9–24). 'Publish deploy' on an older Netlify deploy would therefore break every quote, and no down-migration exists. (c) No migration tracking. There is no supabase/config.toml, and migrations are pasted into the SQL editor, so nothing records which ones ran. I had to probe with anonymous GETs to learn that the configured project has every column through 20260927180000 (products.description/sell_unit, profiles.ein, orders.ship_street, order_items.variant, profile_documents). The first two files are not idempotent (`create table public.profiles` at 20260517000000:7; `create policy` without drop at 20260517000001:19–92), so re-running the list in BACKEND.md:18–28 on an existing DB fails at file 1. 20260517000000 was edited in place by 4609eac (2026-09-25) after shipping on main (2026-05-24). The first-signup-admin logic was removed; that is safe only because 20260925120000:11 and 20260927000000:8 redefine handle_new_user. (d) No deploy order. HEAD calls rpc('submit_quote') (src/lib/orders.js:13) and profile_documents/storage (src/lib/documents.js). If Netlify auto-deploys a merge before the SQL is run, quotes and uploads fail. (e) Redirect allow list: BACKEND.md:74–76 lists only http://localhost:3000/. The dev server actually serves http://127.0.0.1:3000 (vite --host 127.0.0.1), and deploy previews use *.netlify.app. resetPasswordForEmail uses window.location.origin (src/lib/useAuth.js:95), so those origins fall back to the Site URL. (f) BACKEND.md:67–70 scopes both env vars to 'All' deploy contexts, so deploy previews and branch deploys of cursor/* branches write real accounts and quotes into the production database. (g) Owner provisioning (BACKEND.md:48–52) has no step to list existing admins. A database first set up from main's migration made the first signup an approved admin. The 2026-09-25 audit (#6) asked to verify that, and the runbook still doesn't.

**Fix:** Add a 'Release checklist' section to BACKEND.md, and make these changes: (1) Plan: run production on Supabase Pro (daily backups, no pausing) before taking real orders or license documents. Before every migration, take `supabase db dump -f backups/$(date +%F).sql`, or a pg_dump with the connection string, and keep it off-repo. (2) Tracking: run `supabase init` (commits supabase/config.toml) and `supabase link --project-ref <ref>`. Mark the six applied files with `supabase migration repair --status applied 20260517000000 20260517000001 20260925120000 20260927000000 20260927120000 20260927180000`. From then on, apply with `supabase db push` and never edit a migration that has shipped; add a new file instead. (3) Order: 'Apply new migrations to production first, verify with a smoke test, then merge/deploy the frontend.' (4) Rollback: 'Frontend rollback via Netlify → Deploys → Publish deploy is only safe to deploys built at or after the latest applied migration (currently commit 4609eac or later). A database rollback means restoring the pre-migration dump.' For each future migration, add a commented reverse-SQL block at the bottom. (5) Auth URLs: allow-list http://localhost:3000/**, http://127.0.0.1:3000/**, https://<site>.netlify.app/**, https://deploy-preview-*--<site>.netlify.app/** and the www and apex production URLs. (6) Environments: create a separate staging Supabase project. In Netlify, set VITE_SUPABASE_URL/ANON_KEY per context (Production = prod project; Deploy Previews and Branch deploys = staging) instead of 'All'. (7) Owner step: before opening signups, run `select id, email, role, status, created_at from public.profiles where role = 'admin';` and demote any account that isn't the owner. (8) Replace the 'Resetting' block with a warning that it destroys all orders and profiles, and require a dump first.

**Owner input needed:** Will you upgrade production to Supabase Pro (backups, no pausing) and create a separate Supabase project for Netlify preview deploys, and who holds the project ref and backup storage location?

**Files:** `BACKEND.md:10`, `BACKEND.md:18`, `BACKEND.md:48`, `BACKEND.md:67`, `BACKEND.md:74`, `BACKEND.md:129`, `src/lib/useAuth.js:95`, `supabase/migrations/20260517000000_initial_schema.sql:7`, `supabase/migrations/20260517000001_rls_policies.sql:19`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:258`

**Evidence:** [gap2-launch-lifecycle/supabase-schema-probe.json](screenshots/gap2-launch-lifecycle__supabase-schema-probe.json)

- [ ] Done

#### AW-214 · NETLIFY-DEPLOY.md recommends deploying a prebuilt ZIP that does not exist; the local dist/ it would come from is 15 commits old

**Medium** · code-quality · Who: **Cursor** · Effort: S · New

**Where:** NETLIFY-DEPLOY.md 'Easiest drag-and-drop deploy'; local dist/

**Problem:** NETLIFY-DEPLOY.md:3-4 says to 'Use the static ZIP named alabama-wholesale-netlify-drop.zip'. A find across the project folder and the Desktop folder shows no such file. The local dist/ was built Sep 26 22:08:58 -0500 at commit bf94cca. HEAD d19d7dc is 18 commits later (12 non-merge), including 019dff2 (document uploads), 6f4cabb (confirmed business facts) and several photo commits. That dist/ contains 0 'supabase', 'auth/v1', 'rest/v1' or 'submit_quote' strings, so a drag-and-drop of it ships with accounts and quotes disabled. The file never mentions the Supabase env vars or migrations, and line 10 still describes Node 20 as LTS. Evidence: screenshots/qa-gap2-launch-lifecycle__dist-and-domain-check.txt

**Fix:** Rewrite NETLIFY-DEPLOY.md to describe only Git-connected deploys: Netlify site linked to the GitHub repo, production branch main, build command `npm run build`, publish `dist`, Node from netlify.toml. Point to BACKEND.md for env vars, migrations and the release checklist. Delete the drag-and-drop section, or replace it with 'Do not drag-and-drop dist/: it bypasses the build, env checks and version tracking.' Add `rm -rf dist` or `npm run build` guidance for anyone previewing locally.

**Files:** `NETLIFY-DEPLOY.md:3`, `NETLIFY-DEPLOY.md:10`

- [ ] Done

#### AW-354 · Returning visitors' carts from the old build silently become 'Choose variant' lines that block checkout (234 of 368 products), and the old 'aw-trade-user' personal data is never cleared

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all (verified 1280×800 and 390×844)

**Where:** App load for any visitor with an old-build localStorage 'aw-cart' → header Cart badge, cart drawer, #/quote

**Problem:** Reproduced with Playwright at 1280x800 and 390x844. Seeding aw-cart={"1":3,"162":2,"14":1} gives a header badge of '6' ('Cart, 6 items'). The drawer lists 'Swisher Sweets cigarillos · AW-SS · Choose a variant' and 'Snickers bars · AW-SNICKERS · Choose a variant', each with only a 'Choose variant' link, so the quantities 3 and 2 are invisible. Only Kite shows a '1' stepper. #/quote shows 'Choose a variant before submitting.' twice plus 'Choose a variant for every product that has more than one.', and 'Submit quote request' is disabled. After load, aw-cart is unchanged and aw-trade-user and aw-welcome-seen remain. The catalog has 234 multi-variant, 46 single-variant and 88 no-variant ids. Whether any real returning visitor is affected is unverified: alabamawholesaleinc.com is NXDOMAIN and no Netlify site state exists in either project folder. Old build f858342 removes aw-trade-user whenever no user is signed in (old src/App.jsx:224-225), so leftover personal data only exists for users of the original f5e931b build. Screenshots: screenshots/qa-gap2-launch-lifecycle__oldcart-drawer-390.jpg, oldcart-drawer-1280.png, oldcart-quote-390.png, oldcart-quote-1280.png in the same folder.

**Fix:** Add a one-time, versioned migration in a new src/lib/cartStorage.js and use it in the cart initialiser at src/App.jsx:148 (`useState(() => loadCart())`). loadCart(): (1) If 'aw-cart-v2' exists, parse and return it, guarded as in the known storage finding. (2) Otherwise read legacy 'aw-cart'. Keep keys containing '::' and bare keys of products with 0 or 1 variants as they are. Collect bare keys of multi-variant products into `legacy = [{ productId, qty }]`, write that to 'aw-cart-legacy', and don't put them in the cart. Write 'aw-cart-v2' and remove 'aw-cart'. (3) Remove the orphaned keys: `['aw-trade-user','aw-welcome-seen'].forEach(k => { try { localStorage.removeItem(k); } catch {} })`. Change src/data/content.js:105 to `cart: 'aw-cart-v2'`, delete the `user` and `welcome` entries, and update src/App.jsx:225 to write STORAGE.cart. (4) In the cart drawer and at the top of #/quote, when 'aw-cart-legacy' is non-empty, show a dismissible notice: 'Our catalog was updated. Choose a flavor or size for N items from your last visit.' List each item with its saved quantity and a 'Choose' button that opens #/product/<id> with that quantity prefilled in the qty stepper. Clear an entry once it is added, and clear the list on dismiss. Use the same quantity hand-off as the fix for the known 'Choose variant loses the reorder quantity' finding. (5) Add a unit test that feeds {"1":3,"14":1,"20":2} through loadCart and asserts the v2 cart, the legacy list and the removed keys.

**Files:** `src/App.jsx:148`, `src/App.jsx:225`, `src/App.jsx:229`, `src/data/content.js:103`, `src/lib/lines.js:126`

**Evidence:** [gap2-launch-lifecycle/oldcart-drawer-desktop.jpg](screenshots/gap2-launch-lifecycle__oldcart-drawer-desktop.jpg), [gap2-launch-lifecycle/oldcart-quote-mobile.jpg](screenshots/gap2-launch-lifecycle__oldcart-quote-mobile.jpg), [gap2-launch-lifecycle/oldcart-drawer-mobile.jpg](screenshots/gap2-launch-lifecycle__oldcart-drawer-mobile.jpg), [gap2-launch-lifecycle/oldcart-quote-desktop.jpg](screenshots/gap2-launch-lifecycle__oldcart-quote-desktop.jpg), [gap2-launch-lifecycle/oldcart-report.json](screenshots/gap2-launch-lifecycle__oldcart-report.json), [gap2-launch-lifecycle/cart-migration-scale.json](screenshots/gap2-launch-lifecycle__cart-migration-scale.json)

- [ ] Done

#### AW-355 · Every Netlify or CI build regenerates all 1,284 images from scratch (about 64 s on a 12-core Mac), and dev start always opens a browser

**Low** · performance · Who: **Cursor** · Effort: M · New

**Where:** package.json predev/prebuild → scripts/build-images.mjs; vite.config.js server.open

**Problem:** The prebuild step (package.json:12) runs scripts/build-images.mjs. Its outputs (src/assets/generated/ and the favicon/og files in public/) are gitignored (.gitignore:10–17), and netlify.toml has no build cache, so every deploy starts cold. Staleness is judged by file mtime (scripts/build-images.mjs:53–54, :70, :79, :173–175). A fresh git checkout gives every source a new mtime, so even a restored cache would be treated as stale. Timing on a scratchpad copy (Node 24.20.0, sharp 0.35.4, 12-core Apple Silicon, concurrency 8): cold run '276 sources → 1284 files … 64.1s' (real 66 s); warm rerun 1.6 s. Netlify build containers have fewer cores, so expect a multiple of that on every deploy, counting against build minutes. Locally the step is incremental and cheap, so this matters only for Netlify and CI. vite.config.js:8 `open: true` makes every `vite` start try to open a browser, which a Playwright webServer or CI job does not want.

**Fix:** (1) In scripts/build-images.mjs, replace the mtime comparison (lines 53–54, 70, 79, 173–175) with a content-hash manifest. Compute sha1 of each source's bytes plus VERSION and the widths. Store `{ [source]: hash }` in src/assets/generated/.manifest.json, and skip outputs whose hash matches and whose files exist. (2) Cache the outputs between Netlify builds: add to netlify.toml `[[plugins]] package = "netlify-plugin-cache"` with `[plugins.inputs] paths = ["src/assets/generated", "public/favicon.ico", "public/favicon-32.png", "public/apple-touch-icon.png", "public/icon-192.png", "public/icon-512.png", "public/og.jpg"]`, and add netlify-plugin-cache to devDependencies. In GitHub Actions, use actions/cache keyed on hashFiles('src/assets/products/**', 'src/assets/hero_*', 'src/assets/logo.jpg', 'scripts/build-images.mjs'). (3) vite.config.js:8 → `open: !process.env.CI`.

**Files:** `.gitignore:10`, `package.json:12`, `scripts/build-images.mjs:53`, `scripts/build-images.mjs:79`, `scripts/build-images.mjs:173`, `vite.config.js:8`

**Evidence:** [gap2-launch-lifecycle/build-images-timing.txt](screenshots/gap2-launch-lifecycle__build-images-timing.txt)

- [ ] Done

