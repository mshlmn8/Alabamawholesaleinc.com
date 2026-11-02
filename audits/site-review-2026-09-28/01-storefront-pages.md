# Storefront pages

Part of the Alabama Wholesale site review (2026-09-28). Start with [00-START-HERE.md](00-START-HERE.md) for the guardrails and the order to work in.

52 findings. Critical 0, High 7, Medium 22, Low 23. File paths are relative to the repo root `alabamawholesaleinc-2a-editorial/`. Each finding ends with a checkbox; tick it when the fix is in.

**Who** says who can act: **Cursor** can fix it from the finding alone. **Owner → Cursor** needs a decision, fact or asset from the business owner first; Cursor must not invent it, and should leave a `TODO(owner)` where the code depends on the answer.

## Contents

- Home page (16)
- Header, navigation, search & footer (9)
- Catalog index & department pages (13)
- Product detail pages (14)

## Home page

#### AW-004 · Homepage hero has no headline, H1, value proposition or CTA (desktop and mobile)

**High** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: 1440x900, 1280x800, 1920x1080

**Where:** #/ → hero carousel (above the fold)

**Problem:** At 1440x900 the header takes 0–253px and the carousel takes 277–820px, so they fill the whole first screen. The carousel's only text is 'Slide 1 of 4 / Previous / Pause / Next'. The slides contain no link or button. Slide 1 is a Turtles Bites candy box on white. Nothing on the first screen says 'wholesale distributor', 'licensed retailers', 'next-day delivery' or 'apply'; that information only appears in 11px bars. HERO_SLIDES already defines eyebrow/title/sub/cta1/cta2/goCat for every slide (src/data/content.js:42-45), but HeroCarousel (src/App.jsx:659-696) renders only the image. At 1280x800 the fold even cuts through the control bar. This is a regression: the earlier hero had a headline.

**Also seen:**
- #/ → document outline — axe-core reports 'page-has-heading-one' (moderate). document.querySelectorAll('h1') returns [] on #/, and the first heading is the h2 'New arrivals'. Search engines and screen-reader users get no page-level topic.
- #/ → HeroCarousel and home section order — HeroCarousel renders only images and 'Slide 1 of 4 / Previous / Pause / Next'. The eyebrow/title/sub/cta1/cta2/goCat fields defined for each slide in content.js are never rendered; title is used only as alt text. The home page has no <h1> (document.querySelectorAll('h1') is empty). At 390x844 the first screen shows the bars, header, a Turtles candy box and the carousel controls, with nothing saying what the business is or how to act; slides are n…
- #/ → hero carousel (first screen) — document.querySelectorAll('h1').length === 0 on #/. The hero's innerText is only 'Slide 1 of 4 Previous Pause Next', and the first heading on the page is 'New arrivals'. First-time visitors see a box of Turtles Bites with no statement of who the business is or what it offers. HERO_SLIDES (content.js:42-45) defines eyebrow/title/sub/cta1/cta2/goCat, but HeroCarousel (App.jsx:660-694) renders only the images and uses slide.title as alt. So the Turt…
- #/ → .home-carousel (first viewport) — At 1440×900 the first viewport below the header is a 1280×480 white box containing one packshot (the Turtles Bites candy box). The box has about 400px of empty white on each side and a 'Slide 1 of 4 · Previous · Pause · Next' control bar, and there is no heading anywhere above the fold. The home page has no <h1>. HERO_SLIDES (content.js:42-45) already defines eyebrow, title ('The brands your customers ask for.'), sub, cta1/cta2 and goCat for each…
- #/ (home) — axe reports 'page-has-heading-one' on #/ at both 1440 and 390, and document.querySelectorAll('h1').length is 0. The first heading screen-reader users reach is h2 'New arrivals'. The carousel above it has no text at all. Every other route has an H1.
- #/ → top of <main> (hero carousel) — The heading outline on #/ starts with H2 "New arrivals" (36 headings, 0 h1). The home is also what #/does-not-exist renders. Above the fold at 1440x900 the only text in <main> is the carousel controls ("Slide 1 of 4 / Previous / Pause / Next") and "FRESH INVENTORY / 01". The carousel is photos only: the HERO_SLIDES eyebrow, title, sub and CTAs in content.js:42-45 are never rendered, except the active slide's title reused as alt text. The page nev…

**Fix:** Replace the text-less photo carousel with the approved split hero: a real <h1> that states the value proposition (licensed-retail wholesale distributor, departments, route delivery), a supporting line, and primary and secondary CTAs ('Apply for a trade account', 'Browse the catalog'). This text must be crawlable. If slides stay, make each one a link to its department/product so taps work on phones, and put the apply CTA above the fold instead of near the bottom of the 8,400px page (App.jsx:623-708).

**Files:** `src/App.jsx:623`, `src/App.jsx:623-697`, `src/App.jsx:659`, `src/App.jsx:660`, `src/App.jsx:664`, `src/App.jsx:679`, `src/App.jsx:689`, `src/App.jsx:706`, `src/App.jsx:706-708`, `src/App.jsx:708`, `src/App.jsx:772`, `src/data/content.js:37`, `src/data/content.js:42`, `src/data/content.js:42-45`, `src/index.css:177`, `src/index.css:178`

**Evidence:** [home/home-1440-fold.jpg](screenshots/home__home-1440-fold.jpg), [home/home-1280-fold.jpg](screenshots/home__home-1280-fold.jpg), [home/home-1920-fold.jpg](screenshots/home__home-1920-fold.jpg), [responsive/first-screen-390x844_home.jpg](screenshots/responsive__first-screen-390x844_home.jpg), [responsive/home-390-fullpage.jpg](screenshots/responsive__home-390-fullpage.jpg), [responsive/first-screen-1024x768_home.jpg](screenshots/responsive__first-screen-1024x768_home.jpg), [copy/home-1440-top.jpg](screenshots/copy__home-1440-top.jpg), [copy/home-390-top.jpg](screenshots/copy__home-390-top.jpg), [design/home-viewport-1440.jpg](screenshots/design__home-viewport-1440.jpg), [design/home-390-viewport.jpg](screenshots/design__home-390-viewport.jpg), [seo/home-1440-above-fold-no-h1.jpg](screenshots/seo__home-1440-above-fold-no-h1.jpg)

- [ ] Done

#### AW-005 · No trust signals anywhere on the homepage

**High** · content-copy · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** #/ → whole page (hero through footer)

**Problem:** The homepage has no brand logos, no photos of the warehouse, trucks or team, no years in business or number of stores served, no testimonials, no licence or registration IDs and no FAQ. All imagery is manufacturer packshots or vape ads. The only contact email is a consumer Gmail address, 'Alabamawholesaleinc@gmail.com' (src/data/content.js:11, also in the index.html JSON-LD). content.js already defines BRANDS (line 48), TRUST (50-55) and FAQS (57-74), but nothing imports them.

**Fix:** 1) Add a 'Brands we carry' strip directly under the hero: a grey logo row built from BRANDS (content.js:48), with logos stored in src/assets/brands/ and used with permission. 2) After the services strip (App.jsx:742–746), add a trust band that uses only facts the owner has verified: years in business, number of retail accounts or routes, a warehouse photo and a delivery-truck photo. Do not publish TRUST's unverified claims ('Three generations', '100% Authentic') without confirmation. 3) Add an FAQ accordion (<details>) fed by FAQS (content.js:57) once the owner verifies each answer. First reconcile FAQS 'approved within 24 hours' (content.js:63) with the homepage's 'within one business day' (App.jsx:786). 4) Replace 'Alabamawholesaleinc@gmail.com' with a domain address (e.g. orders@alabamawholesaleinc.com) in src/data/content.js:11 and in the JSON-LD at index.html:41.

**Owner input needed:** Confirm the trust facts to publish (years in business, number of retail accounts/routes, whether 'Three generations' and '100% Authentic' are true, correct approval time), supply warehouse/truck photos, and confirm which brand logos you have permission to show.

**Files:** `index.html:41`, `src/App.jsx:701`, `src/data/content.js:11`, `src/data/content.js:48`, `src/data/content.js:50`, `src/data/content.js:57`

**Evidence:** [home/home-1440-full.jpg](screenshots/home__home-1440-full.jpg)

- [ ] Done

#### AW-006 · Hero imagery is small, low-res packshots that don't represent a multi-department distributor

**High** · imagery · Who: **Owner → Cursor** · Effort: S · Partly fixed since the 2026-09-25 audit · Viewports: 1440x900, 1280x800, 1920x1080

**Where:** #/ → hero carousel, all four slides

**Problem:** The stage is 1278×480 at 1440 and 1920. Each photo renders at its native size and covers only part of the stage: hero_candy 700×441 (50%), hero_vape 500×500 (41%), hero_lighters 700×481 (55%), hero_gatorade 458×500 (37%). The largest source is 700px wide (src/assets/hero_*.jpg), so the images look soft on retina screens. Slide content: 1) a Turtles Bites candy box; 2) the Geek Bar Pulse X marketing ad with baked-in 'ACCEPT ALL CHALLENGES' text and JPEG artefacts; 3) BIC lighters with the lighter tops cut off at the top edge; 4) a retailer-style grid of 7 Gatorade/G2 bottles. None shows the distributor: no warehouse, trucks or assortment. The alt text is the unrendered marketing title (e.g. alt='The brands your customers ask for.' on the Turtles box), which does not describe the image.

**Also seen:**
- #/ → .home-carousel-stage — Sources: - hero_candy.jpg: 700x441, 30 KB - hero_vape.jpg: 500x500, 36 KB - hero_lighters.jpg: 700x481, 56 KB - hero_gatorade.jpg: 458x500, 30 KB HERO_WIDTHS [480, 720] caps output at the source width. At 1440 the stage is 1278x480 but the images show at 700x441, 500x500, 700x481 and 458x500, filling only 50%, 41%, 55% and 37% of it; the rest is flat white. `sizes` is set to the image's own width (App.jsx:680), so a 2x screen gets the same 700px …
- #/ hero carousel and the editorial Collections card — The hero sources are hero_candy 700x441, hero_lighters 700x481, hero_vape 500x500 and hero_gatorade 458x500 (src/assets). HERO_WIDTHS is [480, 720] (build-images.mjs:35). At 1440 the slides paint at 700/500/458 CSS px, so a 2x screen needs 1,400/1,000/916 px but gets 700/500/458 (half resolution). The same hero_candy image is reused as the editorial card background at 628 CSS px (App.jsx:699,722). The 2026-09-25 audit (#15) said the hero was enla…
- #/ → hero carousel slides 1–4 — The site sells eight departments (Tobacco, Novelties, Merchandise, Candies, Food Stuff, Grocery, Motor Oil, Drinks & Bags), but the four hero photos each show one brand from a retail listing: - Slide 1 (hero_candy.jpg, 700x441): a DeMet's Turtles Bites display box. - Slide 2 (hero_vape.jpg, 500x500): a Geek Bar Pulse X manufacturer ad with baked-in 'GEEK BAR PULSE X', 'WORLD'S FIRST 3D CURVED SCREEN' and 'ACCEPT ALL CHALLENGES'. - Slide 3 (hero_l…

**Fix:** Replace hero_candy/hero_vape/hero_lighters and the other slides with wide, high-resolution images (at least 2560px wide for the 1278x480 stage, with srcset) that show the warehouse or a multi-department assortment, not one-product packshots or a Geek Bar ad. Use object-fit: cover so the stage is filled, not a small image floating in a white box (content.js:42-45).

**Owner input needed:** Supply wide, high-resolution (2560px+) licensed photos of the warehouse or a multi-department assortment for the hero.

**Files:** `scripts/build-images.mjs:35`, `src/App.jsx:679`, `src/App.jsx:680`, `src/App.jsx:683`, `src/assets/hero_candy.jpg`, `src/assets/hero_gatorade.jpg`, `src/assets/hero_lighters.jpg`, `src/assets/hero_vape.jpg`, `src/data/content.js:42`, `src/data/content.js:42-45`, `src/data/content.js:43`, `src/data/content.js:44`, `src/data/content.js:45`, `src/index.css:178`, `src/index.css:182`

**Evidence:** [home/hero-1440-slide1.jpg](screenshots/home__hero-1440-slide1.jpg), [home/hero-1440-slide2.jpg](screenshots/home__hero-1440-slide2.jpg), [home/hero-1440-slide3.jpg](screenshots/home__hero-1440-slide3.jpg), [home/hero-1440-slide4.jpg](screenshots/home__hero-1440-slide4.jpg), [photos2/hero-slide1-1440.jpg](screenshots/photos2__hero-slide1-1440.jpg), [photos2/hero-slide4-1440.jpg](screenshots/photos2__hero-slide4-1440.jpg), [photos2/hero-sources-1to1.jpg](screenshots/photos2__hero-sources-1to1.jpg), [photos2/hero-slide2-1440.jpg](screenshots/photos2__hero-slide2-1440.jpg)

- [ ] Done

#### AW-054 · Carousel controls look like a table pager: no slide indicators, text-only buttons

**Medium** · visual-design · Who: **Cursor** · Effort: M · New · Viewports: 1440x900, 1280x800, 1920x1080

**Where:** #/ → hero carousel control bar

**Problem:** Under the image sits a separate 60px bar. On the left is 11px orange 'Slide 1 of 4'; on the right are three 40px outlined rectangular text buttons, 'Previous', 'Pause' and 'Next'. There are no dots, thumbnails, slide titles or on-image arrows, so the hero reads like a paginated data table. At 1280x800 the fold cuts the bar in half.

**Fix:** Remove the separate .home-carousel-controls bar. Instead: 44px circular prev/next buttons with SVG chevrons overlaid at the vertical centre of the image column (position:absolute; left/right:16px; background:#fff; box-shadow). A row of 4 dot buttons at bottom centre (aria-label 'Show slide 2: Geekbar 25K', aria-current on the active one). A small pause/play icon button at bottom right. 'Slide N of 4' becomes a .sr-only element.

**Files:** `src/App.jsx:689`, `src/index.css:183`, `src/index.css:184`, `src/index.css:185`

**Evidence:** [home/sec-1440-carousel.jpg](screenshots/home__sec-1440-carousel.jpg), [home/home-1280-fold.jpg](screenshots/home__home-1280-fold.jpg)

- [ ] Done

#### AW-055 · Department label and tag chips are printed over product photos and become unreadable

**Medium** · visual-design · Who: **Cursor** · Effort: M · New · Viewports: 1440x900, 1280x800, 1920x1080

**Where:** #/ → New arrivals, Bestsellers and Shop by department cards (.block-label, .card-tag)

**Problem:** #/ at 1440x900. The .block-label (11px, #655d68, top/left 12px) sits inside the drawn photo on 13 of 15 photo cards (all but BIC lighters in both rails). The .card-tag overlaps the photo on 12 of 15 (not BIC x2; Almond Joy has no tag). On the dark Geek Bar ads the label is partly over purple background at about 1.8:1. Visible collisions: 'NOVELTIES' on Geek Bar Pulse X 25K (New arrivals #1, Bestsellers #6), Foger Switch Pro (New arrivals #2) and Geek Bar Pulse 15K (Bestsellers #5). BESTSELLER hides 'LSE' of the 'GEEK BAR PULSE' logo on the 15K card. 'DEPARTMENT' overlaps the Novelties (geekbar_15k) and Motor Oil (stp_oil_treatment) tiles. See evidence/vhome/sec-new-arrivals-1440.png, sec-bestsellers-1440.png and sec-catalog-1440.png.

**Also seen:**
- #/category/<DEPT> → product card top-left .block-label — Each card prints the raw department key p.cat in the image area ('NOVELTIES', 'DRINKS & BAGS', 'FOOD STUFF'). This is not the display name ('Novelties & Vapes') and is redundant on a department page. The photo sits under the label on 18/51 Novelties, 21/58 Candies, 20/68 Tobacco, 22/24 Food Stuff and 11/16 Motor Oil cards at 1440px, so the grey 11px text lies across packaging (Geek Bar, Imperial Sugar, Cheez-It, Speed Stick). At 900px the BESTSEL…
- All product and department cards → .card-block .block-label (e.g. 'NOVELTIES', 'CANDIES', 'DEPARTMENT') — `.block-label` (11px, #655d68, z-index 2) is positioned at top:12px/left:12px inside the card image box, and the photo fills the box with only 14px padding. Using the rendered object-fit:contain box, the label overlaps photo pixels on 13 of 24 home cards at 360–430 and 19 at 768/1024; on #/category/NOVELTIES on 18–21 of 51 cards; on #/category/MERCHANDISE on 13–15 of 60. Examples: 'NOVELTIES' across the dark Geek Bar Pulse X 25K and Foger Switch …
- #/category/* and home product cards: .block-label ('TOBACCO', 'NOVELTIES', 'MERCHANDISE' …) in the top-left of the photo box — Measured on live pages, not reconstructed. Label is 11px / weight 600, rgb(101,93,104). Flagged at 1440 (30): Swisher Sweets BLK/Mini/Leaf Wraps, Good Times Flat Wraps, Wild Hemp, Geek Bar Pulse 15K / X 25K, Foger Switch Pro kit/pods, Kangvape 8000/65K, Hush pre rolls, UPass, Al Fakher 250 g / 1 kg, BluntPower, Trojan Magnum, Lattafa, Hard Steel, Secret Miracle Honey, Bandaids, Orajel, Tootsie Frooties, Haribo, Life Savers Gummies, eFrutti jar, C…
- Product cards on #/, #/category/*, #/product/* related rows; department cards on #/ ('DEPARTMENT') — `.card-block .block-label` is absolute at top/left 12px with z-index 2, bare #655d68 11px text and no background, while `.card-block img` fills the card with only 14px padding. On photos whose artwork fills the square, the label sits on the packaging. Pixel sampling under the label box found non-background pixels on #/category/NOVELTIES at 390 for Geek Bar Pulse 15K, Geek Bar Pulse X 25K, Foger Switch Pro full kit, Foger Switch Pro pods, Kangvape…
- All product cards (category grids, home rows) → top-left '.block-label' (e.g. 'TOBACCO', 'NOVELTIES') and '.card-tag' (BESTSELLER/NEW/DEAL/PREMIUM) — The label is absolute at top:12px/left:12px (10px on mobile) with z-index 2 and no background. The photo is drawn inside a 14px inset, so the label overlaps the photo's top-left corner. At 1440 I measured the drawn photo rect against the label and tag rects: 50 of 63 Tobacco photos overlap the 'TOBACCO' label, plus 14 Merchandise, 18 Candies and 11 Novelties photos that had loaded. On dark photos the grey #655d68 label nearly disappears: 'NO|VELT…
- Category cards: .card-block .block-label ('FOOD STUFF', 'DRINKS & BAGS', 'DEPARTMENT') and .card-tag — Measured with getBoundingClientRect: - 1440: block 326x296, label top 13 to bottom 30, img padding 14px. On #/category/FOOD%20STUFF, 'FOOD STUFF' sits over the Cheez-It box; on DRINKS & BAGS/Sodas, 'DRINKS & BAGS' sits over the Sprite can. - 390 mobile, Energy Drinks: block 171x163, label x 11–108; .card-tag BESTSELLER at x 67–160, y 131–152, covering the '12oz' band on the #143 Red Bull 12 oz can. DEAL on Monster Energy is also at the bottom. - …

**Fix:** Move .block-label (department name) and .card-tag (BESTSELLER/NEW/DEAL/PREMIUM) out of the image area, for example into the card text above the name, or onto a solid chip with at least 4.5:1 contrast that does not overlap the photo. Make sure the tag and label never collide. This applies to product cards, department cards ('DEPARTMENT') and related rows (App.jsx:759, 815-816; index.css:187, 203-206, 577).

**Files:** `src/App.jsx:759`, `src/App.jsx:802`, `src/App.jsx:815`, `src/App.jsx:816`, `src/App.jsx:1028`, `src/index.css:187`, `src/index.css:203`, `src/index.css:204`, `src/index.css:206`, `src/index.css:577`, `src/index.css:580`

**Evidence:** [home/crop-na-geekbar-label-badge.jpg](screenshots/home__crop-na-geekbar-label-badge.jpg), [home/crop-bs-geekbar15k-label-badge.jpg](screenshots/home__crop-bs-geekbar15k-label-badge.jpg), [home/crop-na-foger-label.jpg](screenshots/home__crop-na-foger-label.jpg), [home/crop-dept-motoroil-label.jpg](screenshots/home__crop-dept-motoroil-label.jpg), [home/crop-dept-novelties-label.jpg](screenshots/home__crop-dept-novelties-label.jpg), [catalog/novelties-1024-card-row1.jpg](screenshots/catalog__novelties-1024-card-row1.jpg), [catalog/merch-900-badge-overlap.jpg](screenshots/catalog__merch-900-badge-overlap.jpg), [catalog/food-row-after-quote-add.jpg](screenshots/catalog__food-row-after-quote-add.jpg), [responsive/home-390-card-label-overlap.jpg](screenshots/responsive__home-390-card-label-overlap.jpg), [responsive/home-390-dept-card.jpg](screenshots/responsive__home-390-dept-card.jpg), [responsive/home-768-card-tag-covers-label.jpg](screenshots/responsive__home-768-card-tag-covers-label.jpg), [a11y/card-label-over-photo-1440-bluntpower.jpg](screenshots/a11y__card-label-over-photo-1440-bluntpower.jpg), [a11y/card-label-over-photo-390-swisher-blk.jpg](screenshots/a11y__card-label-over-photo-390-swisher-blk.jpg), [design/novelties-cards-390.jpg](screenshots/design__novelties-cards-390.jpg), [design/home-cards-1440.jpg](screenshots/design__home-cards-1440.jpg), [photos1/card-label-overlap-1440.jpg](screenshots/photos1__card-label-overlap-1440.jpg), [photos1/home-new-arrivals-1440.jpg](screenshots/photos1__home-new-arrivals-1440.jpg), [photos1/novelties-grid-390.jpg](screenshots/photos1__novelties-grid-390.jpg), [photos2/foodstuff-1440-card-row1-whitebox-label-overlap.jpg](screenshots/photos2__foodstuff-1440-card-row1-whitebox-label-overlap.jpg), [photos2/drinks-energy-390-cards.jpg](screenshots/photos2__drinks-energy-390-cards.jpg), [photos2/home-department-tiles-1440.jpg](screenshots/photos2__home-department-tiles-1440.jpg)

- [ ] Done

#### AW-056 · Homepage repeats the same products: New arrivals mostly duplicates Bestsellers, and the hero, department tiles and collections reuse the same photos

**Medium** · ux-flow · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** #/ → hero, New arrivals, Bestsellers, Shop by department, Collections

**Problem:** The Geek Bar Pulse X 25K photo appears 3 times (hero slide 2, New arrivals #1, Bestsellers #6). BIC lighters appear 3 times (hero slide 3, New arrivals #4, Bestsellers #2). The Geek Bar Pulse 15K photo is Bestsellers #5 and also the Novelties department tile. STP Oil Treatment is Bestsellers #3 and also the Motor Oil tile. The Turtles Bites photo is hero slide 1 and also the Novelties collection-card background. Bestsellers is simply the first 8 BESTSELLER rows in id order (App.jsx:704), so two Geek Bars and two motor oils sit next to each other.

**Also seen:**
- #/ → 'New arrivals' and 'Bestsellers' sections — Live #/ at 1440. New arrivals tags: BESTSELLER, NEW, NEW, BESTSELLER, BESTSELLER, (none), NEW, NEW. Bestsellers: Backwoods, BIC lighters, STP, Saxon, Geek Bar Pulse 15K, Geek Bar Pulse X 25K, Red Bull 12 oz, Snickers. Two products appear in both rails. NEW_ARRIVALS_IDS = [61, 62, 64, 31, 171, 167, 342, 184, 75, 76] (products.js:766). The only products tagged NEW are ids 62, 64, 75, 76, 184 and 342. Because of .slice(0, 8) at App.jsx:703, ids 75 a…

**Fix:** Give each homepage block its own product set. Fill New arrivals from a real date-added or 'new' tag and Bestsellers from the bestseller tag. Give the hero and department tiles dedicated imagery. Remove duplicates across the hero, New arrivals, Bestsellers, Shop by department and Collections (App.jsx:699-704, 755; products.js:766). Point each rail's CTA to a cross-department listing (e.g. all new arrivals / all bestsellers) instead of a single department.

**Owner input needed:** Which products are really new arrivals and which are real bestsellers, and can you supply dedicated hero and department images?

**Files:** `src/App.jsx:165`, `src/App.jsx:177`, `src/App.jsx:217`, `src/App.jsx:699`, `src/App.jsx:703`, `src/App.jsx:704`, `src/App.jsx:713`, `src/App.jsx:735`, `src/App.jsx:755`, `src/App.jsx:816`, `src/App.jsx:869`, `src/data/content.js:43`, `src/data/content.js:44`, `src/data/products.js:766`, `src/pages/support/CatalogIndexPage.jsx:10`

**Evidence:** [home/home-1440-full.jpg](screenshots/home__home-1440-full.jpg), [home/sec-1440-bestsellers.jpg](screenshots/home__sec-1440-bestsellers.jpg), [copy/home-new-arrivals-bestseller-tags.jpg](screenshots/copy__home-new-arrivals-bestseller-tags.jpg), [home/sec-1440-newarrivals.jpg](screenshots/home__sec-1440-newarrivals.jpg)

- [ ] Done

#### AW-057 · Card buttons are inconsistent and unclear: 'Choose' vs 'QUOTE +'

**Medium** · consistency · Who: **Owner → Cursor** · Effort: S · New · Viewports: all

**Where:** #/ → product card action buttons (.card-add)

**Problem:** 15 of 16 homepage cards show a sentence-case 'Choose' button (App.jsx:832). RAZ 25K (id 64) shows an uppercase 'QUOTE +' (App.jsx:840) because it has zero variants. Both are 11px with 1px letter spacing, but only one is capitalised. For guests, 'Choose' doesn't say what is being chosen (flavour/size), and 'QUOTE +' silently adds the item to the cart; the only feedback is the button turning into a stepper. RAZ 25K has no flavours in the data even though its photo shows 'Blue Raz Ice'.

**Fix:** Use one naming and casing scheme. Multi-variant items: 'Select options' (goes to the product page). Single items: 'Add to quote' for guests and pending accounts, 'Add to order' for approved buyers. Everything in sentence case at var(--text-sm). Show a short 'Added' toast or inline confirmation after adding. Give RAZ 25K (id 64) its real flavour variants in products.js and the database so it behaves like the other vapes.

**Owner input needed:** Which RAZ 25K flavours do you actually stock, so they can be added as its variants?

**Files:** `src/App.jsx:832`, `src/App.jsx:840`, `src/data/products.js:149`, `src/index.css:219`

**Evidence:** [home/crop-na-raz-quote-cta.jpg](screenshots/home__crop-na-raz-quote-cta.jpg), [home/sec-1440-newarrivals.jpg](screenshots/home__sec-1440-newarrivals.jpg)

- [ ] Done

#### AW-058 · Collection cards: Novelties card uses a faded Turtles candy photo, and the Tobacco card has no image

**Medium** · imagery · Who: **Owner → Cursor** · Effort: S · New · Viewports: 1440x900, 1280x800, 1920x1080

**Where:** #/ → Collections row (two .editorial-card promos)

**Problem:** EDITORIAL_BG = heroImage('hero_candy.jpg') (App.jsx:699) is a Turtles Bites candy box. It is the background of the 'EXOTICS & NOVELTIES' card (App.jsx:722), shown at opacity .28 with multiply blending (index.css:233-234), so it looks washed-out pink behind the purple headline. It shows no vape, hookah or novelty product, and it is the same photo as hero slide 1. The 'Tobacco, wraps & accessories' card (App.jsx:726-729) is flat purple with no image, so the pair looks unbalanced.

**Also seen:**
- #/ → .editorials 'COLLECTION / 01' card — EDITORIAL_BG = heroImage('hero_candy.jpg') (App.jsx:699) is laid behind 'EXOTICS & NOVELTIES / Disposables, detox, kratom & more.' at 28% opacity (index.css:233-234). So a candy box advertises the vape and kratom collection. The box's red and gold 'Turtles Bites' lettering runs right behind the headline ('Bites' sits against 'detox,'), which hurts readability. The paired 'COLLECTION / 02 Tobacco' card has no image at all, so the two cards don't m…
- #/ → .editorials 'COLLECTION / 01' card — EDITORIAL_BG = heroImage('hero_candy.jpg') (App.jsx:699) sits at 28% opacity behind 'Disposables, detox, kratom & more.' (App.jsx:722-724), so a Turtles Bites candy box illustrates the vape/novelties collection. The adjacent 'Tobacco, wraps & accessories' purple card has no image, so the pair is visually unbalanced (home-editorials-1440.png).

**Fix:** Give each homepage collection card an on-theme image: a real novelties/vape assortment for 'Exotics & Novelties' (not the Turtles candy photo) and a tobacco/cigar image for the purple Tobacco card, both at full opacity with a legible text overlay (App.jsx:699, 722-726).

**Owner input needed:** Supply or approve licensed photos for the 'Exotics & Novelties' collection card and the Tobacco/cigar collection card.

**Files:** `src/App.jsx:699`, `src/App.jsx:722`, `src/App.jsx:726`, `src/index.css:233`, `src/index.css:234`

**Evidence:** [home/crop-editorial-cream.jpg](screenshots/home__crop-editorial-cream.jpg), [home/sec-1440-editorials.jpg](screenshots/home__sec-1440-editorials.jpg), [photos2/home-editorial-cards-1440.jpg](screenshots/photos2__home-editorial-cards-1440.jpg), [photos2/home-editorial-cards-390.jpg](screenshots/photos2__home-editorial-cards-390.jpg), [design/home-editorials-1440.jpg](screenshots/design__home-editorials-1440.jpg)

- [ ] Done

#### AW-059 · Key selling points (delivery, Net-30, licensed only) sit at 59% page depth as plain text boxes

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: 1440x900, 1280x800, 1920x1080

**Where:** #/ → .services strip (01/02/03)

**Problem:** At 1440 the .services strip starts at y=3118 of 5,248 (59% down), after two 8-card product grids. It holds the main B2B selling points: next-day delivery on own trucks, Net-30, licensed businesses only. The three beige boxes are text only, with no icons, 13px grey body copy, and 48px of empty space at the bottom of cards 2 and 3 (heights equalised at 224px).

**Fix:** Move <section className='services'> (App.jsx:742-746) directly after <HeroCarousel/> (App.jsx:708). Condense it to one row of three items, each with a 28px SVG icon (truck, invoice/calendar, shield-check), a 15px bold headline and one line of 14px text, e.g. 'Next-day on our own trucks — AL, MS & GA routes'. Link each item to its detail page (#/delivery, #/terms, #/apply).

**Files:** `src/App.jsx:708`, `src/App.jsx:742`, `src/index.css:236`, `src/index.css:240`

**Evidence:** [home/sec-1440-services.jpg](screenshots/home__sec-1440-services.jpg), [home/home-1440-full.jpg](screenshots/home__home-1440-full.jpg)

- [ ] Done

#### AW-060 · Three identical 4×2 grids of beige tiles make the page monotonous

**Medium** · visual-design · Who: **Cursor** · Effort: M · New · Viewports: 1440x900, 1280x800, 1920x1080

**Where:** #/ → New arrivals, Bestsellers, Shop by department

**Problem:** New arrivals, Bestsellers and Shop by department are each 963px tall and use the same .card-grid: 8 beige 1.1:1 tiles with a grey caps label, orange caps kicker, 15px title and grey meta line. That is 24 near-identical tiles over about 2,500px, broken only by the two collection cards. Product cards also show internal SKU codes ('AW-GEEKBAR-25K') that mean nothing to a first-time visitor. Shop by department, the main navigation for trade buyers, sits at y=3342.

**Fix:** 1) Move Shop by department directly under the hero/services strip and restyle it as 8 wide 16:9 photo tiles with the department name overlaid bottom-left in 28px display type plus a SKU count (a new .dept-grid class, not .card-grid). 2) Show New arrivals and Bestsellers as a single row of 4 cards each (or a horizontal scroller) with a 'View all' link. 3) Remove the SKU from the homepage card detail line (App.jsx:821) and keep it on the product page.

**Files:** `src/App.jsx:715`, `src/App.jsx:737`, `src/App.jsx:753`, `src/App.jsx:821`, `src/index.css:199`

**Evidence:** [home/home-1440-full.jpg](screenshots/home__home-1440-full.jpg)

- [ ] Done

#### AW-061 · Department tiles show arbitrary product photos and alphabetical product lines

**Medium** · catalog-data · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/ → Shop by department tiles

**Problem:** Each tile's image is simply the first product in that department with a photo: products.find(p => p.cat === c.key && p.img) (App.jsx:755). Merchandise shows a Tweaker energy shot (an OTC & Health item), while its text lists 'Adult Wellness · Air Fresheners & Incense · Apparel'. Food Stuff shows Argo corn starch, while its text says 'Chips & Crackers · Coffee · Cookies'. Novelties reuses Geek Bar Pulse 15K and Motor Oil reuses STP Oil Treatment, both already shown in Bestsellers. The detail line is the first 3 product lines alphabetically (App.jsx:764), so Merchandise leads with 'Adult Wellness' and Candies with 'Bags'.

**Also seen:**
- #/ → 'Shop by department' tiles — #/ 'Shop by department' at 1440 and 390, images loaded after scroll: - Tobacco: ss_cigarillos - Novelties & Vapes: geekbar_15k, an ad graphic whose 'GEEK BAR PULSE' text collides with the 'DEPARTMENT' label - Merchandise: tweaker, an energy shot - Candies: butterfinger_regular (320x179) - Food Stuff: argo_corn_starch, a small jar at 62% fill - Grocery: vaseline_jelly - Motor Oil: stp_oil_treatment - Drinks & Bags: faygo_bottles_20oz, natural 302x…

**Fix:** Pick a representative, curated hero image per department for the 'Shop by department' tiles, not the first product that has a photo. List each department's top product lines by product count, not alphabetically (App.jsx:5, 755-764; products.js:18).

**Files:** `src/App.jsx:5`, `src/App.jsx:755`, `src/App.jsx:760`, `src/App.jsx:764`, `src/data/products.js:18`, `src/data/products.js:766`

**Evidence:** [home/sec-1440-depts.jpg](screenshots/home__sec-1440-depts.jpg), [home/crop-dept-merchandise-tweaker.jpg](screenshots/home__crop-dept-merchandise-tweaker.jpg), [photos2/home-department-tiles-1440.jpg](screenshots/photos2__home-department-tiles-1440.jpg), [photos2/home-department-tiles-390.jpg](screenshots/photos2__home-department-tiles-390.jpg)

- [ ] Done

#### AW-062 · Categories mega menu overflows the viewport, has an empty featured tile and lists lines alphabetically

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: 1440x900

**Where:** #/ → header → Categories mega-menu

**Problem:** Playwright, #/, Categories opened. .aw-mega-menu top=253 at every size. 1440x900: height 650, scrollHeight 702, clientHeight 646, bottom 903 (3px below the 900px viewport). 1366x768: height 532, bottom 785 (17px below). 1280x800: height 564, bottom 817 (17px below). 1920x1080: height still capped at 650 and scrolls, although 827px are free. At every size .aw-menu-footer ('View full catalog ↗ · 8 departments · 368 SKUs') starts at y=891, outside the visible menu. .aw-menu-feature is 354x330, background-image none, background rgb(40,20,89), no img/picture: a plain purple block with the text pushed to the bottom. Product lines use subs sorted alphabetically (App.jsx:137) and sliced to 3 (App.jsx:533), which surfaces thin lines: Candies 'Bags'(8) instead of 'Sweets & Gummies'(26); Grocery 'Bags & Storage'(2) instead of 'Personal Care'(13); Merchandise 'Adult Wellness'(2) instead of 'OTC & Health'(20); Drinks 'Bags & Carriers'(7) instead of 'Juices & Teas'(14); Tobacco shows 'Cigarettes'(5) but not 'Wraps & Leafs'(22). Screenshots: screenshots/vhomeB__mega-1440x900.jpg, .../evidence/vhomeB/mega-1366x768.png

**Also seen:**
- Header → Categories mega menu (.aw-department lists) — departmentsFor() sorts sub-lines alphabetically (App.jsx:137) and the menu renders `c.subs.slice(0, 3)` (App.jsx:533). Only 24 of the 52 product lines appear, and they are mostly the smallest ones: - Tobacco shows Cigarettes (5), Cigars & Cigarillos (21), Loose Tobacco Bags (6). Hidden: Wraps & Leafs (22), Papers & Cones (7), Pouches & ZYN (4), Tubes & Filters (3). - Novelties shows Detox (3), Disposable Vapes (9), Hookah & Shisha (4). Hidden: Mu…
- Header → Categories mega menu (.aw-mega-menu) — The max-height rule uses `calc(100dvh - var(--aw-menu-top, 220px) - 16px)` (index.css:126), but no code ever sets --aw-menu-top, and the menu actually starts at y=253. - At 1440×900 the menu spans y=253–903 (3px below the viewport). Its content is 702px tall inside a 646px box, so the footer row with 'View full catalog ↗' and '8 departments · 368 SKUs' sits at y=891–958, off-screen and inside a nested scroll. - At 1024×768 the menu ends at y=785 …
- Header → Categories mega menu → FEATURED 'Exotics & novelties.' tile — .aw-menu-feature is 354×330px at 1440 and 254×330px at 1024. Its background is rgb(40,20,89), background-image is none, and it contains 0 img/picture elements. The text block starts 167px below the tile's top edge, so the top 51% is empty. The grid is `262px 262px 262px 354px` at 1440 (`188.5px ×3 + 254px` at 1024). Motor Oil and Drinks & Bags sit in row 3 at x=30 and x=318, and row 3 columns 3–4 are empty. The menu content is 702px tall (scrollH…
- Desktop header → Categories → .aw-mega-menu — The max-height is `max(120px, min(650px, calc(100dvh - var(--aw-menu-top, 220px) - 16px)))`, but `--aw-menu-top` is not set anywhere in src/ (grep finds only index.css:126), so the 220px fallback is always used. The menu actually opens at y=253. At 1024x768 the panel spans 253→785 (17px below the viewport), and 702px of content sits in a 528px inner scroll box, so the Motor Oil and Drinks & Bags columns and the 'View full catalog / 8 departments …

**Fix:** Set the CSS variable the max-height formula depends on (header height), or use max-height: calc(100dvh - header) with overflow-y:auto, so 'View full catalog' stays visible at 1440x900 and 1024x768 (index.css:126-135). Fill the FEATURED 'Exotics & novelties' tile with an image and CTA, or remove it and rebalance the grid so no corner is empty (App.jsx:539-540, index.css:132). List each department's largest product lines first, by count, instead of the first three alphabetically (App.jsx:137-138, 532).

**Files:** `src/App.jsx:137`, `src/App.jsx:138`, `src/App.jsx:519`, `src/App.jsx:520`, `src/App.jsx:523`, `src/App.jsx:532`, `src/App.jsx:533`, `src/App.jsx:536`, `src/App.jsx:539`, `src/App.jsx:540`, `src/App.jsx:543`, `src/index.css:126`, `src/index.css:127`, `src/index.css:129`, `src/index.css:132`, `src/index.css:135`, `src/index.css:137`, `src/index.css:138`, `src/index.css:143`

**Evidence:** [home/header-mega-menu-1440.jpg](screenshots/home__header-mega-menu-1440.jpg), [nav/mega-menu-1440.jpg](screenshots/nav__mega-menu-1440.jpg), [nav/mega-menu-1024.jpg](screenshots/nav__mega-menu-1024.jpg), [nav/mega-open-focus-outside-1440.jpg](screenshots/nav__mega-open-focus-outside-1440.jpg), [responsive/mega-menu-1024x768.jpg](screenshots/responsive__mega-menu-1024x768.jpg), [responsive/mega-menu-932x430-landscape.jpg](screenshots/responsive__mega-menu-932x430-landscape.jpg)

- [ ] Done

#### AW-215 · Department tile photos misalign vertically by 9px at 1280px width

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 1280x800 (also 1024–1100 for product-card CTAs)

**Where:** #/ → Shop by department, first row

**Problem:** At 1280 the Tobacco tile's line 'Cigarettes · Cigars & Cigarillos · Loose Tobacco Bags' wraps to 2 lines, so the row stretches to 409px. The tiles are <button> elements, which centre their content vertically by default, so the Novelties, Merchandise and Candies photos sit 9px lower than Tobacco's (image top at 3443 vs 3434). At 1440 all tiles align. At 1024–1100, product-card CTA rows also misalign by 18px when .card-detail wraps.

**Fix:** index.css:200: .content-card { display:flex; flex-direction:column; justify-content:flex-start; align-items:stretch; } and add .content-card > .card-meta, .content-card .card-actions { margin-top:auto; }. Make .card-detail a single line: white-space:nowrap; overflow:hidden; text-overflow:ellipsis. Converting the tiles to <a> (see the links finding) also removes the button centring.

**Files:** `src/App.jsx:757`, `src/index.css:200`, `src/index.css:210`, `src/index.css:211`

**Evidence:** [home/sec-1280-depts.jpg](screenshots/home__sec-1280-depts.jpg)

- [ ] Done

#### AW-216 · Section numbering repeats and means nothing to a buyer

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/ → section eyebrows, collection labels, services, apply steps

**Problem:** One page shows: 'FRESH INVENTORY / 01', 'COLLECTION / 01', 'COLLECTION / 02', 'PROVEN MOVERS / 02', services '01 02 03', 'FULL ASSORTMENT / 03', 'OPEN AN ACCOUNT / 04', apply steps '1 2 3', and 01–08 in the mega-menu. That is three different '01's and two '02's; only the apply steps are a real sequence.

**Fix:** Drop the ' / 0N' suffixes from the eyebrows at App.jsx:712, 734, 750 and 775. Remove the 'COLLECTION / 0N' block labels (App.jsx:723, 727). Replace the '01/02/03' service numbers (App.jsx:743-745) with icons. Keep numbers only in the ordered apply steps.

**Files:** `src/App.jsx:712`, `src/App.jsx:723`, `src/App.jsx:727`, `src/App.jsx:734`, `src/App.jsx:743`, `src/App.jsx:750`, `src/App.jsx:775`

**Evidence:** [home/home-1440-full.jpg](screenshots/home__home-1440-full.jpg)

- [ ] Done

#### AW-217 · Novelties department has three names ('Exotics', 'Novelties & Vapes', 'NOVELTIES'), and department/count wording is inconsistent

**Low** · consistency · Who: **Owner → Cursor** · Effort: S · New · Viewports: all

**Where:** #/ → header nav, collection card, mega-menu feature, department tile, card labels

**Problem:** All of these open #/category/NOVELTIES: nav 'Exotics ↗' (App.jsx:552), collection eyebrow 'EXOTICS & NOVELTIES' (App.jsx:724), mega-menu feature 'Exotics & novelties.' (App.jsx:540), department label 'Novelties & Vapes' (CAT_LABEL, App.jsx:35) and card labels 'NOVELTIES' (raw p.cat, App.jsx:815).

**Also seen:**
- Header navigation row → 'Exotics ↗'; mega-menu feature tile 'Exotics & novelties.' — 'Exotics ↗' (App.jsx:552) and the FEATURED tile 'Exotics & novelties.' (App.jsx:540) both go to #/category/NOVELTIES, whose H1 and footer label are 'Novelties & Vapes' (CAT_LABEL, App.jsx:35). 'All Novelties & Vapes →' in the same menu goes to the same place. So one department appears under three different names, and 'Exotics' doesn't match any department, line or filter.
- Header nav 'Exotics ↗', mobile menu, mega-menu 'FEATURED Exotics & novelties.', home editorial card 01 — 'Exotics' (App.jsx:552, mobile :589) and the mega-menu feature 'Exotics & novelties.' (:540) both go to the NOVELTIES department, which already appears as 'Novelties & Vapes'. In wholesale 'exotics' usually means imported snacks and drinks, which live in other departments. The home editorial card 'EXOTICS & NOVELTIES — Disposables, detox, kratom & more.' uses the Turtles candy hero photo as its background (EDITORIAL_BG = heroImage('hero_candy.jpg…
- Header nav, mega menu, #/category/NOVELTIES, product cards, counts on all catalog pages — At 1440px on #/category/NOVELTIES: .aw-exotics-link='Exotics ↗'; .aw-menu-feature h3='Exotics & novelties.'; h1='Novelties & Vapes'; crumbs='Home / NOVELTIES & VAPES'; eyebrow='DEPARTMENT · 51 SKUS'; .block-label='NOVELTIES' (computed text-transform:none, so it is the raw key; other departments show 'FOOD STUFF' and 'DRINKS & BAGS'); .result-note='Showing 51 of 51 items'. Header placeholder='Search 368 SKUs — cigars, disposables, candy, drinks…'.…

**Fix:** Choose one department name and use it in the header nav item (not 'Exotics'), the mobile menu, the mega-menu feature, the collection card, department tiles and card labels (App.jsx:35, 540, 552, 589). Standardize count wording ('68 products' vs SKUs vs items) across the catalog pages.

**Owner input needed:** Which single name should the Novelties department use everywhere: 'Exotics', 'Novelties & Vapes' or 'Novelties'?

**Files:** `src/App.jsx:35`, `src/App.jsx:460`, `src/App.jsx:510`, `src/App.jsx:540`, `src/App.jsx:545`, `src/App.jsx:552`, `src/App.jsx:589`, `src/App.jsx:610`, `src/App.jsx:699`, `src/App.jsx:713`, `src/App.jsx:724`, `src/App.jsx:762`, `src/App.jsx:815`, `src/App.jsx:832`, `src/App.jsx:840`, `src/App.jsx:915`, `src/App.jsx:958`, `src/App.jsx:1007`, `src/pages/support/CatalogIndexPage.jsx:16`, `src/pages/support/CatalogIndexPage.jsx:25`, `src/pages/support/CatalogIndexPage.jsx:34`, `src/pages/support/CatalogIndexPage.jsx:46`

**Evidence:** [home/crop-nav-row-2x.jpg](screenshots/home__crop-nav-row-2x.jpg), [nav/mega-menu-1440.jpg](screenshots/nav__mega-menu-1440.jpg), [copy/mega-menu.jpg](screenshots/copy__mega-menu.jpg), [copy/home-editorial-kratom.jpg](screenshots/copy__home-editorial-kratom.jpg), [catalog/novelties-1024-viewport.jpg](screenshots/catalog__novelties-1024-viewport.jpg)

- [ ] Done

#### AW-218 · External-link arrow (↗) is used on internal links, and floats away from its text

**Low** · consistency · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/ → Sign Up, Exotics, section links, department tiles, collection cards, Start application

**Problem:** Section-head buttons at 1440: 'Shop novelties', 'Shop tobacco', 'Browse the catalog'. Measured gap between text and arrow is 24.0px (computed gap 24px, index.css:198); the button text is underlined, the arrow is not. Mega menu: → at App.jsx:535, ↗ at App.jsx:540 and :544. Other internal ↗ uses: age gate 'Yes, I am 21+ ↗' (App.jsx:372), mobile menu (:583, :589, :603, :612), filters 'Show N items ↗' (:1007), PDP 'Add to quote ↗' / 'View department ↗' (:1123, :1143), 'Browse catalog ↗' (:1211), 'Back to home ↗' (:1227), 'Submit quote request ↗' (:1297), Help 'Call now ↗' (:1372), cart 'Checkout ↗' / 'Request quote ↗' (:1430, :1432). Screenshot: screenshots/vhomeB__section-head-newarrivals.jpg

**Also seen:**
- #/contact, #/apply, #/catalog, ContactStrip on #/delivery, #/terms, #/privacy, #/shipping — Measured on live pages. #/contact: 'Call now ↗' (tel:), 'Get directions ↗' (Google Maps, target=_blank), 'Application checklist ↗' (internal). #/catalog: 8 'Browse <Dept> ↗' internal buttons. #/apply: 'Start application ↗' (opens modal), 'Call (205) 354-4473 ↗' (tel:). The site-wide header items 'Apply for a trade account ↗', 'Sign Up ↗' and 'Exotics ↗' appear on every page. Ghost buttons 'Email the trade desk', 'Email us' and 'Start application'…

**Fix:** Remove the ↗ external-link arrow from internal links and buttons (Sign Up, Exotics, section links, department tiles, collection cards, Start application, Contact/Apply/Catalog buttons, ContactStrip, phone links). Keep it only for truly external links, next to the text rather than floated away (index.css:198; App.jsx:297, 372; ContactPage.jsx:25-72).

**Files:** `src/App.jsx:297`, `src/App.jsx:372`, `src/App.jsx:495`, `src/App.jsx:535`, `src/App.jsx:540`, `src/App.jsx:544`, `src/App.jsx:552`, `src/App.jsx:583`, `src/App.jsx:589`, `src/App.jsx:603`, `src/App.jsx:612`, `src/App.jsx:713`, `src/App.jsx:724`, `src/App.jsx:728`, `src/App.jsx:735`, `src/App.jsx:751`, `src/App.jsx:765`, `src/App.jsx:777`, `src/App.jsx:1007`, `src/App.jsx:1123`, `src/App.jsx:1143`, `src/App.jsx:1211`, `src/App.jsx:1227`, `src/App.jsx:1297`, `src/App.jsx:1372`, `src/App.jsx:1430`, `src/App.jsx:1432`, `src/components/AuthModal.jsx:201`, `src/index.css:198`, `src/pages/support/ApplyPage.jsx:42-43`, `src/pages/support/ApplyPage.jsx:85`, `src/pages/support/CatalogIndexPage.jsx:37`, `src/pages/support/ContactPage.jsx:25`, `src/pages/support/ContactPage.jsx:37`, `src/pages/support/ContactPage.jsx:72`, `src/pages/support/ResetPasswordPage.jsx:47`, `src/pages/support/ResetPasswordPage.jsx:72`, `src/pages/support/ResetPasswordPage.jsx:89`, `src/pages/support/SupportShell.jsx:50`

**Evidence:** [home/sec-1440-newarrivals.jpg](screenshots/home__sec-1440-newarrivals.jpg), [support/contact-1440-full.jpg](screenshots/support__contact-1440-full.jpg)

- [ ] Done

## Header, navigation, search & footer

#### AW-007 · Search has no results page: Enter opens the first product and the result count stops at 10

**High** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Header search (.aw-search form) on every route

**Problem:** getSearchMatches(products, query, limit = 10) (App.jsx:53) cuts the list at 10, and the dropdown label shows hits.length. So 'cigar' reads '10 results' although 30 products match, and 'tobacco' reads '10 results' for 68 matches. There is no 'See all results' row and no search route. Pressing Enter on 'cigar' ran submitSearch (App.jsx:437-440), which went straight to #/product/5 ('4K's cigarillos') and cleared the query. Pressing Enter on 'xyz123' or on a 1-character query does nothing and shows no message. Clicking the magnifier with an empty field does nothing.

**Fix:** 1. Add a search route: in parseHash (App.jsx:165) map '#/search/<encodeURIComponent(q)>' to {page:'search', q}, and add the reverse in routeToHash (App.jsx:177).
2. Create src/pages/support/SearchPage.jsx. It calls getSearchMatches(products, q, Infinity), shows the heading 'N results for “q”' and renders the hits with ProductCard in the same grid the category page uses. Its empty state links to #/catalog.
3. Change submitSearch so that whenever query.trim().length >= 2 it calls navigate({page:'search', q: query.trim()}), and keep the query in the box.
4. In the dropdown, run the matcher with limit Infinity, display slice(0, 8), and label it 'Showing 8 of 30'. Add a final row 'See all 30 results for “cigar” →' that navigates to the search route.
5. When the query is shorter than 2 characters and the user presses Enter, show the helper line 'Type at least 2 characters'.

**Files:** `src/App.jsx:53`, `src/App.jsx:71`, `src/App.jsx:165`, `src/App.jsx:177`, `src/App.jsx:422`, `src/App.jsx:437`, `src/App.jsx:439`, `src/App.jsx:468`

**Evidence:** [nav/search-geekbar-dropdown-1440.jpg](screenshots/nav__search-geekbar-dropdown-1440.jpg), [nav/search-no-matches-1440.jpg](screenshots/nav__search-no-matches-1440.jpg)

- [ ] Done

#### AW-063 · Searches with more than one word are padded with unrelated products

**Medium** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Header search dropdown

**Problem:** The scorer awards `terms.filter(t => h.includes(t)).length * 8` whenever any single word matches, and keeps every product with score > 0 (App.jsx:66, :69). Observed dropdowns:
- 'geek bar' shows 10 results: the 4 Geek Bar products, then 3 Musketeers bars, Airheads bars, Almond Joy bars, Atkinson's Peanut Butter Bars jar, Butterfinger bars and Dove bar soap.
- 'red bull': the 4 Red Bull SKUs, then 24/7 cigarettes, 4K's cigarillos, 4K's Wraps, Airheads soda, Ajax dish liquid and American Club pipe tobacco (these match the variant 'Red' or other words).
- 'swisher sweets': 6 Swisher products, then Airheads, Charms Blow Pop, Cherry candy lumps and Ferrara boxes (they match 'Sweets & Gummies').
- 'white owl': 2 White Owl products, then Charcoal bags, Cheez-It, Durags and Foam bowls.
- 'ss': Bath tissue and Glass cleaner are ranked above Swisher Sweets AW-SS.
Products matching all words vs products matching any word: geek bar 4 vs 25, red bull 4 vs 52, swisher sweets 6 vs 32, white owl 2 vs 29.

**Fix:** In getSearchMatches, first keep only products where `terms.every(t => h.includes(t))`. Better, match at word starts with `new RegExp('\\b' + escape(t))`. Score and sort only that set: name match, then SKU prefix, then brand. Give an exact SKU match (`p.sku.toLowerCase() === q`) a +200 boost. Fall back to any-word matching only when the all-words set is empty, and then label the dropdown 'No exact matches — related products'. Remove the per-term `* 8` bonus from the main path.

**Files:** `src/App.jsx:53`, `src/App.jsx:60`, `src/App.jsx:65`, `src/App.jsx:66`, `src/App.jsx:69`

**Evidence:** [nav/search-geekbar-dropdown-1440.jpg](screenshots/nav__search-geekbar-dropdown-1440.jpg), [nav/search-red-bull-1440.jpg](screenshots/nav__search-red-bull-1440.jpg), [nav/search-swisher-sweets-1440.jpg](screenshots/nav__search-swisher-sweets-1440.jpg)

- [ ] Done

#### AW-064 · Search misses plurals, spacing variants, typos and apostrophe variants ('reese's', 'm&m's'), including the words in its own placeholder

**Medium** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Header search input and dropdown

**Problem:** The placeholder reads 'Search 368 SKUs — cigars, disposables, candy, drinks…' (App.jsx:460). Observed results:
- 'disposables' → 'No matches'.
- 'candy' → 9 results, although the Candies department has 58 products.
- 'snikers' → No matches.
- 'hersheys' → No matches (only "hershey's" works).
- 'redbull' → 3 results. It misses 'Red Bull 12 oz' because that SKU is AW-RED-BULL-12OZ, while the others are AW-REDBULL-16OZ, -20OZ and -8OZ (products.js:307).
- 'marlboro', 'newport' and 'juul' → No matches, with a generic tip and no route to request the item.
productText (App.jsx:52) includes the raw cat key (e.g. 'CANDIES') but not the display label, and does no stemming or normalisation.

**Also seen:**
- Header search and #/category/CANDIES "Search in Candies" box — #163 "M&M’s" (brand "M&M’s") and #166 "Reese’s" use U+2019, while the other 16 possessive names (Hershey's, Welch's, Goody's, Wrigley's…) use a straight apostrophe. Measured on #/category/CANDIES: "reese's" → Showing 0 of 58; "reese’s" → 1; "m&m's" → 0; "hershey’s" (curly, as iOS types it) → 0; "hershey's" → 1. The header search for "reese's" shows "No matches". productText and getSearchMatches lowercase but do not normalize apostrophes (App.jsx:…

**Fix:** Normalize both the query and the product text before matching, in the header search (App.jsx:52-65) and the category 'Search in …' box. Lowercase, treat curly and straight apostrophes the same and strip punctuation (’ ' & -), collapse whitespace, also match with spaces removed, apply simple singular/plural stemming, and add small typo tolerance (e.g. Fuse.js or edit distance 1). Also switch the curly apostrophes in products.js:347/353 to straight ones. Check that every term shown in the search placeholder returns results.

**Files:** `src/App.jsx:52`, `src/App.jsx:54`, `src/App.jsx:55`, `src/App.jsx:61`, `src/App.jsx:460`, `src/App.jsx:472`, `src/App.jsx:875`, `src/data/products.js:307`, `src/data/products.js:347`, `src/data/products.js:353`

**Evidence:** [nav/search-disposables-no-match-1440.jpg](screenshots/nav__search-disposables-no-match-1440.jpg), [nav/search-typo-snikers-1440.jpg](screenshots/nav__search-typo-snikers-1440.jpg), [nav/search-candy-1440.jpg](screenshots/nav__search-candy-1440.jpg), [data/search-reeses-straight-apostrophe.jpg](screenshots/data__search-reeses-straight-apostrophe.jpg)

- [ ] Done

#### AW-065 · Help, Sign-in/Apply dialogs and the cart drawer stay open after the browser Back button changes the page

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Header Help button / Sign Up / Sign In dialogs, then browser Back

**Problem:** Steps: on #/ click Exotics (→ #/category/NOVELTIES), open Help, press browser Back. The hash becomes #/ and the home page renders behind, but the 'Talk to the warehouse' dialog stays open. The same happens with Sign Up ('Apply for an account'), Sign In ('Sign in') and the Cart drawer ('Your order', .drawer still 430px wide). The popstate/hashchange handler (App.jsx:188-193) only calls setRoute(parseHash()). It never resets helpOpen, loginOpen or cartOpen (App.jsx:149-152), so Back, which many users press to dismiss an overlay, changes the page underneath instead.

**Fix:** In the effect at App.jsx:188-193 change onPop to `() => { setRoute(parseHash()); setHelpOpen(false); setLoginOpen(false); setCartOpen(false); }`. Optionally make Back close a dialog without leaving the page: when a dialog opens, call `history.pushState({ awDialog: true }, '')`, and in onPop, if a dialog is open, close it instead of routing.

**Files:** `src/App.jsx:149`, `src/App.jsx:150`, `src/App.jsx:152`, `src/App.jsx:188`, `src/App.jsx:189`, `src/App.jsx:346`, `src/App.jsx:349`, `src/App.jsx:350`

**Evidence:** [nav/signup-modal-persists-after-back-1440.jpg](screenshots/nav__signup-modal-persists-after-back-1440.jpg)

- [ ] Done

#### AW-066 · 'Apply for a trade account' still shows to signed-in buyers, and the signed-in admin header has a missing separator

**Medium** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: 1440, 1024 (found in code; signed-in states could not be exercised)

**Where:** Trade bar 'Apply for a trade account ↗' button and Help dialog 'Apply for an account' (signed-in state); header account actions for admins

**Problem:** Simulated approved customer 'Acme Market' at 1440. The trade bar shows 'Apply for a trade account ↗'. Account actions read 'Acme Market | · | Sign Out | Cart'. The Help dialog still shows 'Apply for an account'. Footer buttons include 'Apply for account', 'Application checklist' and 'Sign in'. Clicking the trade-bar Apply opens the AuthModal 'NEW ACCOUNTS · LICENSED RETAILERS ONLY / Apply for an account' checklist. Clicking the footer 'Sign in' opens 'EXISTING ACCOUNTS / Sign in' with BUSINESS EMAIL and PASSWORD fields. For a simulated admin, the account actions read 'Acme Market | Admin | · | Sign Out | Cart'. The name and Admin are both 13px/700 purple buttons separated only by the 13px flex gap. The mobile menu already guards its apply button with `{!user && …}` (App.jsx:612). Screenshots: screenshots/vnav2__signed-in-admin-header-1440.jpg, screenshots/vnav2__signed-in-apply-click-1440.jpg

**Fix:** 1) Trade bar (App.jsx:297): render `{user ? <button type="button" onClick={() => navigate({ page: 'account' })}>My account ↗</button> : <button type="button" onClick={openSignup}>Apply for a trade account ↗</button>}`. 2) HelpDialog: pass `user={user}` at App.jsx:349 and wrap the 'Apply for an account' button (App.jsx:1373) in `{!user && …}`. 3) Footer: pass `user` at App.jsx:343 and add it to the Footer signature (App.jsx:1308). When `user` is set, replace the 'Apply for account', 'Application checklist' and 'Sign in' buttons (App.jsx:1324-1326) with `<button type="button" onClick={() => navigate({ page: 'account' })}>My account</button>`. 4) Header account actions (App.jsx:486-488): add a separator between the name and Admin, `{isAdmin && <><span className="aw-account-or aw-desktop-only">·</span><button className="aw-signin aw-desktop-only" …>Admin</button></>}`, so it reads 'Acme Market · Admin · Sign Out'.

**Files:** `src/App.jsx:297`, `src/App.jsx:343`, `src/App.jsx:349`, `src/App.jsx:486`, `src/App.jsx:487`, `src/App.jsx:488`, `src/App.jsx:612`, `src/App.jsx:1308`, `src/App.jsx:1324`, `src/App.jsx:1325`, `src/App.jsx:1326`, `src/App.jsx:1373`

- [ ] Done

#### AW-219 · Footer at 1024px leaves a large empty block under the brand blurb

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 1024

**Where:** Footer grid at 851–1100px

**Problem:** Measured .footer-grid on #/. At 1024px it is 464px + 464px. The footer-brand cell is 347px tall (it stretches to the row), but its content ends at 134px. That leaves 213px of empty purple under the blurb, next to the 9-link Departments column (347px). At 1100px the numbers are the same (134px of content in a 347px row). At 900px: 134 vs 347. At 768px and 700px: 157 vs 347. At 601px: 180 vs 347. At 600px the grid collapses to 1 column (index.css:589) and the gap disappears. Screenshot: screenshots/vnav2__footer-1024.jpg

**Fix:** In the `@media(max-width:1100px)` block, replace `.footer-grid { grid-template-columns: 1fr 1fr; }` (index.css:511) with: `.footer-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .footer-brand { grid-column: 1 / -1; } .footer-brand p { max-width: 68ch; }`. This makes the brand block a full-width row above the Departments, Account & help and Contact columns. In the `@media(max-width:850px)` block that starts at index.css:522, add `.footer-grid { grid-template-columns: 1fr 1fr; }` so tablets use 2 link columns under the full-width brand row. Leave the ≤600 one-column rule (index.css:589) as it is. Do NOT turn .footer-brand itself into a grid.

**Files:** `src/App.jsx:1313`, `src/index.css:417`, `src/index.css:510`, `src/index.css:511`, `src/index.css:522`, `src/index.css:589`

**Evidence:** [nav/footer-1024.jpg](screenshots/nav__footer-1024.jpg)

- [ ] Done

#### AW-220 · Help dialog, auth dialog and policy pages stack two eyebrows; Help hours wrap mid-range; Help has no help-page links

**Low** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: 1440, 1024

**Where:** Header → Help → 'Talk to the warehouse' dialog

**Problem:** Help dialog at 1440 and at 1024. The 'ACCOUNT SERVICE' eyebrow (top 244px) and the 'WE ANSWER FAST' kicker (top 287px) are both 11px, rgb(184,57,10), uppercase. The Hours <dd> is 349px wide and wraps to 2 lines, split as 'Mon–Fri 7:00 AM – 6:00 PM · Sat–Sun 8:00 AM – ' / '5:30 PM'. The dialog's only interactive elements are ×, the phone link, the email link, 'Call now ↗' and 'Apply for an account'. There are no Contact & visit or Delivery links. AuthModal.jsx:164 ('TRADE ACCOUNT' eyebrow) and :167 (per-mode kicker) stack the same way. Screenshots: screenshots/vnav2__help-dialog-1440.jpg, screenshots/vnav2__help-dialog-1024.jpg

**Also seen:**
- #/ → header Help → 'Talk to the warehouse' dialog — Two orange caps eyebrows sit on top of each other: 'ACCOUNT SERVICE' then 'WE ANSWER FAST' (App.jsx:1361-1362). Hours are joined with ' · ' into one string (App.jsx:1368), which wraps as 'Mon–Fri 7:00 AM – 6:00 PM · Sat–Sun 8:00 AM – / 5:30 PM'. The primary button 'Call now ↗' is a tel: link that does nothing on most desktops.
- Help dialog ('ACCOUNT SERVICE' + 'WE ANSWER FAST'), auth dialog ('TRADE ACCOUNT' + 'EXISTING ACCOUNTS' / 'NEW ACCOUNTS · LICENSED RETAILERS ONLY'), #/shipping|privacy|terms ('CUSTOMER POLICIES' in the page head and again in the policy nav) — qvdes-03-states.mjs: HELP {top:'ACCOUNT SERVICE', kicker:'WE ANSWER FAST', gap:27, fs:[11px,11px], colors both rgb(184,57,10)}; SIGNIN {top:'TRADE ACCOUNT', kicker:'EXISTING ACCOUNTS'}. Shipping eyebrows: 'CUSTOMER POLICIES @13px', 'CUSTOMER POLICIES @9px'. Screenshots: evidence/design-verify/help-dialog.png and evidence/design-verify/signin-dialog.png.

**Fix:** Use a single eyebrow per heading in the Help dialog ('ACCOUNT SERVICE' + 'WE ANSWER FAST'), the auth dialog ('TRADE ACCOUNT' + kicker) and the policy pages (page-head plus nav 'CUSTOMER POLICIES'). Keep hour ranges together with white-space:nowrap or a two-column table. Add links to the Delivery, Terms and FAQ pages in the Help dialog (App.jsx:1361-1368; AuthModal.jsx:164).

**Files:** `src/App.jsx:349`, `src/App.jsx:1361`, `src/App.jsx:1362`, `src/App.jsx:1368`, `src/App.jsx:1372`, `src/App.jsx:1373`, `src/components/AuthModal.jsx:164`, `src/components/AuthModal.jsx:167`, `src/index.css:441`, `src/pages/support/PolicyPage.jsx:15`, `src/pages/support/SupportShell.jsx:61`

**Evidence:** [nav/help-dialog-1440.jpg](screenshots/nav__help-dialog-1440.jpg), [home/header-help-dialog.jpg](screenshots/home__header-help-dialog.jpg), [design/help-dialog-1440.jpg](screenshots/design__help-dialog-1440.jpg), [design/signin-dialog-1440.jpg](screenshots/design__signin-dialog-1440.jpg), [design/shipping-1440-light.jpg](screenshots/design__shipping-1440-light.jpg)

- [ ] Done

#### AW-221 · Header and footer never show which page you're on

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: 1440, 1024

**Where:** Header navigation row, Categories menu, footer department links

**Problem:** document.querySelectorAll('header [aria-current], footer [aria-current]').length is 0 on all 6 routes tested at 1440. On #/category/NOVELTIES, Exotics is rgb(36,32,44)/700 with no underline and no box-shadow, the same as New Arrivals and Bestsellers. The footer 'Novelties & Vapes (51)' is rgb(233,226,245)/400, the same as the other department links. Screenshot: screenshots/vnav2__nav-no-active-novelties-1440.jpg

**Fix:** Pass `route` into Header and Footer. Set `aria-current='page'` on the matching item: Exotics when route.page==='category' && route.category==='NOVELTIES'; Quick Reorder when route.page==='account'; the footer department when route.category===c.key; and the policy and support links. Add CSS `.aw-discovery-nav [aria-current='page'], .aw-service-nav [aria-current='page'] { color: var(--orange-dark); box-shadow: inset 0 -3px 0 var(--orange); }` and `.footer-grid [aria-current='page'] { color:#fff; text-decoration: underline; }`.

**Files:** `src/App.jsx:550`, `src/App.jsx:552`, `src/App.jsx:555`, `src/App.jsx:1320`, `src/index.css:118`

**Evidence:** [nav/quick-reorder-signed-out-1440.jpg](screenshots/nav__quick-reorder-signed-out-1440.jpg)

- [ ] Done

#### AW-222 · Search box: two different × buttons, a focus ring that skips the search button, and a placeholder cut mid-word

**Low** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: 1440, 1024; placeholder clipping at 851–~950px

**Where:** Header search field (.aw-search)

**Problem:** 1440, after typing 'snickers': the native search-cancel × shows inside the input. The dropdown shows a second round '×' (aria-label 'Close search results'). Clicking it only closes the list; the input value stays 'snickers'. On focus the input has outline 3px solid rgb(184,57,10) at offset -3px (index.css:57), while .aw-search:focus-within turns the wrapper border rgb(40,20,89), which also wraps the search button, so two different frames show. Placeholder width is 327px at 13px. Available text width: 244px at 360, 274px at 390, 314px at 430, 307px at 851, 316px at 860, 326px at 870 (all clipped). 327px at 871 and 356px at 900 are not clipped. At 390 it reads 'Search 368 SKUs — cigars, disposables, car'; at 860, '…candy, drir'. Search 'disposables' returns 'No matches', while 'disposable' and 'vape' each return 10 results. Screenshots: screenshots/vnav2__search-focus-typed-1440.jpg, screenshots/vnav2__search-cancel-zoom-1440.jpg, screenshots/vnav2__search-placeholder-860.jpg, screenshots/vnav2__search-placeholder-390.jpg

**Fix:** 1) Add `.aw-search input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }` after index.css:92. Keep the dropdown's close button, but make it clear the query too: at App.jsx:469 change onClick to `() => { setQuery(''); setResultsOpen(false); }` and set its aria-label to 'Clear search'. 2) In the rule at index.css:57, remove the `.aw-search input:focus-visible` selector and add `.aw-search input:focus-visible { outline: none; } .aw-search:focus-within { outline: 3px solid var(--focus-ring); outline-offset: 2px; }`. That gives one ring around the input and button together. 3) Change the placeholder at App.jsx:460 to 'Search products, brands or SKUs' (about 190px at 13px, so it fits at 360px).

**Files:** `src/App.jsx:460`, `src/App.jsx:469`, `src/index.css:57`, `src/index.css:89`, `src/index.css:90`, `src/index.css:91`, `src/index.css:539`

**Evidence:** [nav/search-snickers-1440.jpg](screenshots/nav__search-snickers-1440.jpg), [nav/header-860.jpg](screenshots/nav__header-860.jpg)

- [ ] Done

## Catalog index & department pages

#### AW-008 · Filter, sort and search state is not in the URL and is lost on Back and reload

**High** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/category/<DEPT> → sort select, 'Search in <dept>' box, Featured checkboxes

**Problem:** On #/category/CANDIES I set Sort = 'Name: A to Z', checked Bestsellers and searched 'bar' ('Showing 3 of 58 items'). I opened a product (#/product/171) and pressed Back. The page came back as sort=featured, q='', no checkboxes ticked, 'Showing 58 of 58 items'. Reloading after setting sort=name-desc and q='gum' also reset everything to featured with no search. The hash only ever holds #/category/CANDIES, so a filtered or sorted view can't be bookmarked or shared. The sub-line is the only state kept in the URL.

**Also seen:**
- #/category/<DEPT> → click card → #/product/<id> → browser Back — 1440x900: #/category/CANDIES, typed 'bar' in #category-search, sort 'Name: Z to A' gives 16 cards. Scrolled to 1577, clicked M&M's (#/product/163), then Back. Result: hash #/category/CANDIES, scrollY 1577, search '', sort 'featured', 58 cards. The query and sort are lost and the restored offset now points into the unfiltered list. Unfiltered run: scrollY 2400 → PDP → Back gives scrollY 0 at 50ms, 719/1787 at 200–300ms, 2400 at about 800ms, a visi…
- #/category/<DEPT> → open a product → browser Back — vcode-06-back.mjs: 'after back {"hash":"#/category/CANDIES","q":"","sort":"featured","cards":58,"y":900}'. Screenshot: screenshots/vcode__category-back-filters-lost.jpg

**Fix:** Store category search text, sort and Featured/tag filters in the URL query (for example #/category/TOBACCO?q=&sort=&tags=), and read them back on mount, so Back from a product page, reload and shared links restore the state. Restore the scroll position when returning (App.jsx:851-889).

**Files:** `src/App.jsx:165`, `src/App.jsx:177`, `src/App.jsx:179`, `src/App.jsx:188`, `src/App.jsx:207`, `src/App.jsx:851`, `src/App.jsx:858`, `src/App.jsx:889`

**Evidence:** [code/back-filters-lost.jpg](screenshots/code__back-filters-lost.jpg)

- [ ] Done

#### AW-067 · No brand filter on any department page

**Medium** · ux-flow · Who: **Cursor** · Effort: M · Still open from the 2026-09-25 audit · Viewports: all

**Where:** #/category/<DEPT> → Filters sidebar / mobile 'Filter & Sort' drawer

**Problem:** Filter panel (App.jsx:930-948): 'Search in <dept>', FEATURED (Bestsellers/New/Deals/Premium), VARIANTS ('Has flavors or variants'). Sort (App.jsx:918-929): Featured, Name A to Z, Name Z to A, Most variants. Live brand counts per department (products / distinct brands, top brands): Tobacco 68/39 (Swisher Sweets 6, Gambler 4, RAW 4, Game 3, Backwoods 3, LooseLeaf 3); Novelties 51/30 (Geek Bar 4, Shroom Puff 4, Psyched 4, RAZ 3; 'Assorted' 4); Merchandise 60/38 ('Assorted' 20, Trojan 2); Candies 58/48; Food Stuff 24/18; Grocery 47/17 ('Assorted' 27, Ajax 3); Motor Oil 16/13; Drinks & Bags 44/28 (Red Bull 4, 'Assorted' 7). Today a brand can only be isolated by typing it into the department search.

**Fix:** In CategoryPage, build brandOptions from the rows in scope (after the sub-line filter): unique p.brand with counts, sorted by count desc then name, excluding 'Assorted'. Render a 'Brand' fieldset in filterPanel (App.jsx:930) with checkboxes labelled '<Brand> (<n>)'. Show the top 8 and add a 'Show all N brands' toggle. Keep the selection in a brandFilter array, and add `if (brandFilter.length && !brandFilter.includes(p.brand)) return false;` in the items filter (App.jsx:876). Add brand chips to `chips`, include the count in activeFilterCount, and put the value in the URL with the other filter state. Also add a 'Brand: A to Z' sort option.

**Files:** `src/App.jsx:876`, `src/App.jsx:918`, `src/App.jsx:930`

**Evidence:** [catalog/tobacco-1440-viewport.jpg](screenshots/catalog__tobacco-1440-viewport.jpg)

- [ ] Done

#### AW-068 · 'All products' page (#/catalog) shows no products: a text-only list of pills with no images or cross-department browsing

**Medium** · ux-flow · Who: **Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/catalog → whole page

**Problem:** The page is titled 'All products' ('FULL ASSORTMENT · 8 DEPARTMENTS · 368 SKUs'), but it renders 0 images and 0 product cards. It is 8 blocks of sub-line pills plus collapsed 'All N SKUs' lists of plain text (13px names, 10px meta). You can't search, filter or sort across the whole catalog, and you can't see products without opening details. The counts are repeated three times at the top (eyebrow, jump bar, '8 departments · 52 product lines · 368 SKUs'). A lone 'Wholesale pricing is locked' box sits at the bottom of a page that shows no prices. The home 'Browse the catalog' CTA and the mega-menu 'View full catalog' both land here.

**Also seen:**
- #/catalog (target of 'Browse the catalog', 'View full catalog' and footer 'All products') — At 1440 the page is 3,039px tall and shows no department image, product photo, price or add-to-cart. It has 8 sections of outlined text chips, and each hides a text-only SKU list behind 'All N SKUs'. The home 'Shop by department' grid uses image cards for the same departments (App.jsx:756-768), so the main catalog entry point looks like an unfinished sitemap next to it.

**Fix:** Turn #/catalog ('All products') into a real browsable page: product cards with images across departments (or per-department rows of cards with 'See all' links) instead of text-only pill lists, keeping the SKU index as a secondary view (CatalogIndexPage.jsx:5-54).

**Files:** `src/App.jsx:755-760`, `src/App.jsx:802`, `src/pages/support/CatalogIndexPage.jsx:5-6`, `src/pages/support/CatalogIndexPage.jsx:10`, `src/pages/support/CatalogIndexPage.jsx:16`, `src/pages/support/CatalogIndexPage.jsx:25`, `src/pages/support/CatalogIndexPage.jsx:32-38`, `src/pages/support/CatalogIndexPage.jsx:45`, `src/pages/support/CatalogIndexPage.jsx:48-54`, `src/pages/support/CatalogIndexPage.jsx:63`

**Evidence:** [catalog/catalog-index-1440-full.jpg](screenshots/catalog__catalog-index-1440-full.jpg), [catalog/catalog-index-tobacco-sku-list.jpg](screenshots/catalog__catalog-index-tobacco-sku-list.jpg), [support/catalog-1440-full.jpg](screenshots/support__catalog-1440-full.jpg)

- [ ] Done

#### AW-069 · On phones the All-products page hides most product lines: pill rows are indented and clipped to 2 visible pills

**Medium** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 390x844 (all ≤850px)

**Where:** #/catalog → each department's sub-line pill row

**Problem:** At 390px the rule `.dept-section .sub-pills { margin: 14px 0 12px }` overrides the mobile bleed `margin-inline:-16px` but keeps `padding: 6px 16px`. The first pill starts at x=32 while the heading starts at x=16, and the row is a hidden-scrollbar horizontal scroller only 358px wide. Measured: Tobacco 2 of 7 pills visible, Novelties 2 of 8, Merchandise 2 of 9 (scrollWidth 1336 vs 358). Nothing shows that more lines exist, so each department looks like it has two product lines.

**Also seen:**
- #/catalog → each department's product-line pills — At 390px the h2 starts at x=16 but the first pill starts at x=32. '.dept-section .sub-pills { margin: 14px 0 12px; }' (index.css:752) resets the mobile full-bleed 'margin-inline: -16px' (index.css:550) but keeps 'padding: 6px 16px'. Every department overflows horizontally (Tobacco: scrollWidth 1068 vs clientWidth 358), and the scrollbar is hidden (scrollbar-width: none), so only about 2.5 of the 7 Tobacco lines are visible with no cue that more e…
- #/catalog → each .dept-section .sub-pills row — At 390x844 the row box spans x=16–374 with padding 6px 16px, so the first pill starts at x=32 while the department h2 starts at x=16. The row's scroll area stops at 374, so pills are cut off inside the page gutter ('Loose T…'). On #/category/* the same component correctly spans 0–390 with the first pill at x=16. Cause: `.dept-section .sub-pills { margin: 14px 0 12px; }` (a more specific selector) resets the mobile `margin-inline: -16px`.

**Fix:** On phones, remove the extra 16px indent on #/catalog .dept-section .sub-pills and let the row run edge to edge, or wrap the pills instead of clipping them. Add a scroll affordance (fade or arrow) so hidden lines are discoverable (index.css:550-551, 752).

**Files:** `src/index.css:550`, `src/index.css:550-551`, `src/index.css:752`, `src/pages/support/CatalogIndexPage.jsx:39-44`, `src/pages/support/CatalogIndexPage.jsx:39`

**Evidence:** [catalog/catalog-index-390-merch-section.jpg](screenshots/catalog__catalog-index-390-merch-section.jpg), [catalog/catalog-index-390-full.jpg](screenshots/catalog__catalog-index-390-full.jpg), [support/catalog-390-top.jpg](screenshots/support__catalog-390-top.jpg), [support/catalog-390-tobacco-expanded.jpg](screenshots/support__catalog-390-tobacco-expanded.jpg), [responsive/catalog-390-subpills-indent.jpg](screenshots/responsive__catalog-390-subpills-indent.jpg)

- [ ] Done

#### AW-070 · Products filed in the wrong department/sub-line (e.g. 'Mushroom Products' is about half blue-lotus and hemp items), plus near-empty and duplicate sub-lines

**Medium** · catalog-data · Who: **Owner → Cursor** · Effort: L · New · Viewports: all

**Where:** #/category/<DEPT>/<Sub line> pills and results; #/catalog pill lists

**Problem:** Misfiled items: Seneca filtered cigars (id 210) and Cheyenne filtered cigars (211) under Tobacco › Cigarettes. Wrigley's slim pack gum (38), Wrigley's 50¢ gum (40) and Mint candy lumps (191) under Candies › Sweets & Gummies, while 'Gum & Mints (4)' exists. Tweaker energy shots (22) under Merchandise › OTC & Health, while 'Energy Shots (2)' exists. Rhino pills 2-pack (28) and Hard Steel (265) under 'Honey & Energy', while 'Adult Wellness (2)' exists. Happy valentines jar (219) under Novelties › Wellness Pills. Register paper rolls (92) under Drinks & Bags › Bags & Carriers. Trash bags (107, Grocery › Bags & Storage) and Trash can liners (95, Drinks & Bags › Bags & Carriers) are split across two departments. Home air fresheners (129) is in 'Other Grocery (1)', while Merchandise has 'Air Fresheners & Incense'. Motor Oil › 'Motor Oil (8)' duplicates the department name (breadcrumb 'MOTOR OIL / MOTOR OIL', title 'Motor Oil · Motor Oil'). Eight sub-lines have ≤2 items: Lubricants 2, Auto Accessories 2, Bags & Storage 2, Other Grocery 1, Adult Wellness 2, Energy Shots 2, Dairy & Milk 2, Coffee 2.

**Also seen:**
- #/category/NOVELTIES/Mushroom%20Products (19 items) — Per the photo-source log and packshots: #73 Mental Health disposable is "blue lotus 4 gram"; #74 Mental Health pre rolls are "blue lotus pre-rolls"; #281 Hush hit is "blue lotus 1.5g preroll"; #296 Jelly holes is "blue lotus 2g preroll"; #299 Psyched 6000mg is "blue lotus extracts"; #289 Psyched 9000mg has the flavor "Snow lotus"; #312 and #313 are blue-lotus gummies; #307 "Stoned honey mushroom bags" is "Stoned Mad Honey Nepal hemp gummies 10,00…

**Fix:** Audit every product's department and sub-line in src/data/products.js. Move misfiled items, including the blue-lotus and hemp products in 'Mushroom Products', into the correct or new accurately named lines. Merge or remove near-empty and duplicate sub-lines. Rename products whose names hide what they contain. Regenerate the seed so the #/catalog pill lists, category pills and counts update.

**Owner input needed:** Approve the department and sub-line for each misfiled product, especially the blue-lotus and hemp items now under 'Mushroom Products', and say whether those lines stay in the catalog.

**Files:** `scripts/build-seed.mjs:18`, `scripts/build-seed.mjs:47`, `src/assets/products/sources/novelties.md`, `src/data/products.js:22`, `src/data/products.js:49`, `src/data/products.js:65`, `src/data/products.js:77`, `src/data/products.js:97`, `src/data/products.js:101`, `src/data/products.js:119`, `src/data/products.js:133`, `src/data/products.js:167`, `src/data/products.js:169`, `src/data/products.js:175`, `src/data/products.js:205`, `src/data/products.js:211`, `src/data/products.js:213`, `src/data/products.js:235`, `src/data/products.js:255`, `src/data/products.js:279`, `src/data/products.js:403`, `src/data/products.js:441`, `src/data/products.js:443`, `src/data/products.js:444`, `src/data/products.js:459`, `src/data/products.js:583`, `src/data/products.js:599`, `src/data/products.js:605`, `src/data/products.js:613`, `src/data/products.js:619`, `src/data/products.js:635`, `src/data/products.js:645`, `src/data/products.js:647`, `src/data/products.js:687`, `src/data/products.js:731`, `src/lib/useCatalog.js:19`, `supabase/seed/products.sql`

**Evidence:** [catalog/catalog-index-1440-full.jpg](screenshots/catalog__catalog-index-1440-full.jpg), [data/grocery-hardware-no-photos-1440.jpg](screenshots/data__grocery-hardware-no-photos-1440.jpg), [photos2/drinks-energy-390-cards.jpg](screenshots/photos2__drinks-energy-390-cards.jpg), [copy/product-211-cheyenne-cigars-cigarette-line.jpg](screenshots/copy__product-211-cheyenne-cigars-cigarette-line.jpg)

- [ ] Done

#### AW-071 · Product names are inconsistently cased/formatted and include 'Cheap' and retail prices

**Medium** · content-copy · Who: **Cursor** · Effort: M · Still open from the 2026-09-25 audit · Viewports: all

**Where:** #/category/<DEPT> → card H3 and detail line

**Problem:** Trade-facing names include 'Cheap antifreeze' (id 100), 'Cheap scales' (221), 'Cheap incense' (246) and 'Cheap lighters' (250). 'LooseLeaf wraps 2-pack ($2.99 or $1.99)' (12) puts retail price points in the name. 'Sip happens' (293) has no product type. Pack formats are mixed: '2pk' (Shroom Puff Pre rolls 2pk, Hush hit / Shroom bang / Blue monkey / Melted mushroom / Mental Health pre rolls 2pk), '2-pack', '25ct box', '25-count', '36-count', '6pk beer carriers'. Casing is mixed: 'Shroom puff Gummies' vs 'Shroom Puff Pre rolls 2pk', 'Happy valentines jar'. 66 products have brand 'Assorted', which cards show as the brand ('Assorted · 3 variants · AW-SCALES'): 27 of 47 in Grocery and 20 of 60 in Merchandise.

**Also seen:**
- #/product/<id> → H1, cards and search results — Live H1s at #/product/<id> (1440, Supabase live data) match src/data/products.js exactly. Casing: 72 'Shroom puff Gummies' (brand 'Shroom Puff', and 69 is 'Shroom Puff disposable 3 Gram'), 75 'Wava kava', 235 'Kuii nata', 293 'Sip happens', 219 'Happy valentines jar', 281 'Hush hit pre rolls 2pk', 288 'Blue monkey pre rolls 2pk', 301-304 'Xuno/Better me/High gravity/Third eye pills', 306 'Stoned mushroom gummies bags regular'. Size wording: 290 '…
- Product cards, product H1s, cart lines, search results — 12 live names lowercase their own brand: 'Shroom puff Gummies' [Shroom Puff], 'Hush hit pre rolls 2pk', 'Shroom bang pre rolls 2pk', 'AA cellular Bluetooth headphones', 'Blue monkey pre rolls 2pk', 'Sip happens', 'Jelly holes pre rolls', 'Shroom rolls pre rolls jars', 'Better me pills', 'High gravity pills', 'Third eye pills', 'Silly dots pills'. Mixed casing: 'Shroom Puff Pre rolls 2pk' vs 'Shroom Puff pre rolls jars'. Descriptions re-case names…
- Card titles, PDP H1, cart/quote line names — Brand words left lowercase: #72 "Shroom puff Gummies", #281 "Hush hit pre rolls 2pk", #285 "Shroom bang…", #288 "Blue monkey…", #296 "Jelly holes…", #293 "Sip happens" (brand "Sip Happens"), #302 "Better me pills", #303 "High gravity pills", #304 "Third eye pills", #341 "Silly dots pills", #219 "Happy valentines jar". Generic words capitalized: #69 "disposable 3 Gram" vs #73 "disposable 4 gram", #65 "RAZ Vue Full kit", #70 "Pre rolls". Pack notat…
- Card titles and PDPs for #100, #221, #246, #250; the variant chip on #252 — Names: "Cheap antifreeze" (#100), "Cheap scales" (#221), "Cheap incense" (#246), "Cheap lighters" (#250). The #252 Playing cards variants are ["Aviator", "Cheap"]. The descriptions for 100, 246 and 250 already say "Value …", so names and copy disagree.

**Fix:** Normalize every product name in products.js and the seed to one convention: Brand + Product + Size/Pack in Title Case, one unit spelling (oz, ct, pk). Remove 'Cheap' (#100, #221, #246, #250, the #252 variant) and embedded retail prices.

**Files:** `scripts/build-seed.mjs:47`, `src/App.jsx:472`, `src/App.jsx:821`, `src/data/content.js:43`, `src/data/products.js:40`, `src/data/products.js:45`, `src/data/products.js:101`, `src/data/products.js:137`, `src/data/products.js:161`, `src/data/products.js:165`, `src/data/products.js:171`, `src/data/products.js:207`, `src/data/products.js:221`, `src/data/products.js:301`, `src/data/products.js:347`, `src/data/products.js:353`, `src/data/products.js:401`, `src/data/products.js:449`, `src/data/products.js:459`, `src/data/products.js:463`, `src/data/products.js:479`, `src/data/products.js:491`, `src/data/products.js:513`, `src/data/products.js:517`, `src/data/products.js:521`, `src/data/products.js:525`, `src/data/products.js:570`, `src/data/products.js:583`, `src/data/products.js:597`, `src/data/products.js:599`, `src/data/products.js:601`, `src/data/products.js:607`, `src/data/products.js:619`, `src/data/products.js:623`, `src/data/products.js:625`, `src/data/products.js:627`, `src/data/products.js:629`, `src/data/products.js:633`, `src/data/products.js:642`, `src/data/products.js:691`, `src/data/products.js:721`, `src/data/products.js:731`, `src/lib/useCatalog.js:22`, `src/pages/support/CatalogIndexPage.jsx:52`

**Evidence:** [catalog/catalog-index-tobacco-sku-list.jpg](screenshots/catalog__catalog-index-tobacco-sku-list.jpg), [copy/product-100-cheap-antifreeze.jpg](screenshots/copy__product-100-cheap-antifreeze.jpg)

- [ ] Done

#### AW-223 · No back-to-top or sub-line control once you scroll down long department pages (worst on phones)

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/category/<DEPT> → product grid

**Problem:** Measured scrollHeight: Tobacco 11,639px (1440), 10,168px (1024), 15,207px (390); Merchandise 13,598px and Candies 13,168px at 390. No 'Show more', 'Load more', 'Back to top' or pagination button exists on any department. At y=5000 on a phone the only sticky element is .category-toolbar (Filter & Sort + result count). The header with Menu, search and Cart scrolls away, and the Filter & Sort drawer (App.jsx:992-1012) has sort and filters but no sub-line pills, so switching from Tobacco › Cigarettes to Wraps & Leafs means scrolling back up to the pill row. On desktop the Filters sidebar (.category-filters) is sticky.

**Fix:** (1) Add a 'Back to top' button to CategoryPage (and CatalogIndexPage): fixed at bottom:16px; right:16px, 44x44, background var(--purple), white arrow, aria-label 'Back to top'. Show it only when window.scrollY > 1200 (a scroll listener with requestAnimationFrame throttling). On click call window.scrollTo({ top: 0, behavior: 'instant' }) and move focus to the page H1 (tabIndex=-1). (2) In the mobile Filter & Sort drawer body (App.jsx:1000-1003), add a 'Product line' fieldset above sortControl with radio buttons for 'All (N)' and each cat.subs entry with counts, bound to props.goCategory(category, s) with scroll:false. The line can then be changed from the sticky toolbar at any depth. (3) Optional: if the owner wants shorter pages, render in batches of 36 with a 'Show all N' button, and store the expanded state in the URL query (see AW-008) so Back restores it.

**Files:** `src/App.jsx:961`, `src/App.jsx:1000`, `src/App.jsx:1026`, `src/index.css:552`

**Evidence:** [catalog/tobacco-1440-full.jpg](screenshots/catalog__tobacco-1440-full.jpg)

- [ ] Done

#### AW-224 · The 'locked pricing' message is repeated three times per page and only offers 'Sign in' to guests

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all; wraps to 2 lines at ≤1100px

**Where:** #/category/<DEPT> → intro sentence, sidebar box, and 'LOCKED · Sign in for pricing' on every card

**Problem:** For guests the same message appears three times on every department page. The intro reads 'Sign in to see your wholesale pricing.' The sidebar has the box 'Wholesale pricing is locked / Sign in to see your account pricing.' Every card has an 11px #6b6670 button, 'LOCKED · Sign in for pricing' (60 on Merchandise, 68 on Tobacco), with 'LOCKED' in caps and the rest in sentence case. Between 851 and 1099px (measured at 1024 and 900) the button text wraps to 2 lines on 60/60 Merchandise cards. It stays on one line at 1100+ and at 390. All three controls open the sign-in dialog. Apply is reachable only through that dialog's 'No account? Apply instead' link or the trade-bar link at the very top of the page, so the grid never offers a direct Apply path.

**Fix:** Replace the per-card text (App.jsx:829) with a compact lock icon + 'Price' link at 12px (`aria-label="Sign in to see price for <name>"`) that fits on one line at 178px card width. Put one banner above the grid for guests only: 'Trade prices are shown to approved accounts. Sign in · Apply for an account', with both actions (onLoginClick / onApplyClick). Remove the duplicate sidebar box (App.jsx:945) and change the intro (App.jsx:960) to describe the department instead.

**Files:** `src/App.jsx:829`, `src/App.jsx:945`, `src/App.jsx:960`, `src/index.css:212`

**Evidence:** [catalog/merch-900-viewport.jpg](screenshots/catalog__merch-900-viewport.jpg), [catalog/tobacco-1440-viewport.jpg](screenshots/catalog__tobacco-1440-viewport.jpg)

- [ ] Done

#### AW-225 · Result count on sub-lines reads '22 of 68 items in Wraps & Leafs', using the department total as the denominator

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/category/<DEPT>/<Sub line> → toolbar result note; sub-pill counts

**Problem:** 'Showing 22 of 68 items in Wraps & Leafs' and 'Showing 3 of 58 items in Chocolate Bars' (with Bestsellers ticked) suggest the sub-line has 68 or 58 items; it has 22 and 12. The pill counts ('Chocolate Bars (12)', 'Jars (8)') stay the same while a tag or search filter is active, so 'Jars (8)' leads to 'Showing 0 of 58 items in Jars'.

**Fix:** Compute scopeCount = activeSub ? inCategory.filter(p => p.sub === activeSub).length : inCategory.length. Render 'Showing {items.length} of {scopeCount} in {activeSub || catLabel(category)}'. Compute the pill counts with the non-sub filters applied (tags, search, has-variants), so each pill shows how many results it would give; disable pills with 0 or show them as '(0)' in muted text.

**Files:** `src/App.jsx:913`, `src/App.jsx:964`

**Evidence:** [catalog/tobacco-wraps-390-active-pill-offscreen.jpg](screenshots/catalog__tobacco-wraps-390-active-pill-offscreen.jpg)

- [ ] Done

#### AW-226 · Sub-line pages keep the department heading, count and description; the department breadcrumb isn't clickable

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/category/<DEPT>/<Sub line> → breadcrumb, eyebrow, H1, meta description

**Problem:** On #/category/TOBACCO/Wraps%20%26%20Leafs the H1 is still 'Tobacco', the eyebrow still says 'DEPARTMENT · 68 SKUs', and the meta description is the department one ('Wholesale tobacco… 68 SKUs across Cigarettes, Cigars & Cigarillos…'). In the breadcrumb 'HOME / TOBACCO / WRAPS & LEAFS', 'TOBACCO' is a plain <span>, so you can't click back up to the department. The breadcrumb has no <nav aria-label="Breadcrumb"> or aria-current. 'Home' renders in title case (the button gets text-transform:none from preflight) while the other crumbs are uppercase.

**Fix:** Wrap the crumbs in `<nav className="crumbs" aria-label="Breadcrumb">` with an <ol>. When activeSub is set, render the department crumb as `<button onClick={() => props.goCategory(category, null)}>` and the sub-line as `<span aria-current="page">`. Add an 'All products' crumb after Home linking to #/catalog. Add `text-transform: inherit` to `.crumbs button` (index.css:258). When activeSub is set, make the H1 the sub-line name and the eyebrow '<Department> · <n> products'. In pageMeta (App.jsx:98), build the sub-line description from the sub-line's own count and top brands.

**Files:** `src/App.jsx:98`, `src/App.jsx:954`, `src/App.jsx:955`, `src/App.jsx:958`, `src/App.jsx:959`, `src/index.css:257`, `src/index.css:258`

**Evidence:** [catalog/tobacco-wraps-390-active-pill-offscreen.jpg](screenshots/catalog__tobacco-wraps-390-active-pill-offscreen.jpg)

- [ ] Done

#### AW-227 · 'Featured' sort is just database order and doesn't put featured items first

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/category/<DEPT> → Sort by: Featured (default)

**Problem:** Checked programmatically: with 'Featured' the order equals ascending id on all tested departments. Tagged items are buried: on Tobacco the BESTSELLERs are at positions 11 and 53 and the DEAL at 25; on Candies the BESTSELLERs are at 12, 16, 19 and 21 and the NEWs at 34 and 55; on Drinks & Bags the bestsellers are at 16 and 42. The other sorts verified correct (A–Z, Z–A, Most variants; price sorts show only to approved buyers and couldn't be tested).

**Fix:** Implement 'featured' as a real ranking: `const RANK = { BESTSELLER: 0, NEW: 1, DEAL: 2, PREMIUM: 3 }`; `if (sort === 'featured') items = [...items].sort((a,b) => (RANK[a.tag] ?? 9) - (RANK[b.tag] ?? 9) || (b.img ? 1 : 0) - (a.img ? 1 : 0) || a.id - b.id);`, which also puts photographed items before placeholders. Or rename the option to 'Catalog order'.

**Files:** `src/App.jsx:883`, `src/App.jsx:921`

- [ ] Done

#### AW-228 · Changing department briefly shows 'No products match' because the old filters are still applied

**Low** · code-quality · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/category/<DEPT> → navigating to another department with a filter active

**Problem:** With 'New' ticked on Candies, I clicked the footer 'Grocery (47)' link. A MutationObserver recorded the first commit as 'EMPTY Showing 0 of 47 items | Grocery', then 'Showing 47 of 47 items'. The reset lives in a useEffect([category]) that runs after the stale render is committed. It's the same component instance, so the previous department's filters are applied to the new one for one frame.

**Fix:** Remount CategoryPage per department: `<CategoryPage key={route.category} … />` at App.jsx:322, and delete the reset effect at App.jsx:858-864. (If filter state moves to the URL as recommended, the state is derived from the route and this goes away.)

**Files:** `src/App.jsx:322`, `src/App.jsx:858`

- [ ] Done

#### AW-229 · #/catalog index: 10px text, sub-44px targets, and 'jump to department' leaves focus behind

**Low** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/catalog → department jump bar, 'All N SKUs' disclosure, SKU list rows

**Problem:** At 1440 and 390: .dept-jump button 36px tall, 12px; .sku-details summary 36px tall, 12px (= --text-sm); .dept-head .text-link 36px tall; .sku-list small 10px (--text-xs is 11px); .dept-section .sub-pills role=null with aria-label 'Tobacco product lines'. Keyboard: focus '06 Grocery' then Enter gives activeElement 'BUTTON 06Grocery', hash '#/catalog', scrollY 2758; the next Tab focuses '07 Motor Oil' at top -2220.

**Fix:** index.css:762: set `.sku-list small { font-size: var(--text-xs); }`. index.css:754: add `min-height: var(--tap-sm);` to `.sku-details summary` and leave its font-size. index.css:743: add `min-height: var(--tap-sm);` to `.dept-jump button`. index.css:751: change to `.dept-head .text-link { white-space: nowrap; min-height: var(--tap-sm); }`. In the existing `@media (max-width:600px)` block, add `.dept-jump button, .sku-details summary, .dept-head .text-link { min-height: var(--tap); }`. CatalogIndexPage.jsx:35: add tabIndex={-1} to the H2. At line 11, change jumpTo to `const el = document.getElementById(`dept-${slug(key)}`); el?.scrollIntoView({ block: 'start' }); document.getElementById(`dept-title-${slug(key)}`)?.focus({ preventScroll: true });`. CatalogIndexPage.jsx:39: add role="group" to the .sub-pills div. Do not write the section id into location.hash; the hash router would treat it as the home route.

**Files:** `src/index.css:743`, `src/index.css:751`, `src/index.css:754`, `src/index.css:762`, `src/pages/support/CatalogIndexPage.jsx:11`, `src/pages/support/CatalogIndexPage.jsx:35`, `src/pages/support/CatalogIndexPage.jsx:39`

**Evidence:** [catalog/catalog-index-after-jump-grocery.jpg](screenshots/catalog__catalog-index-after-jump-grocery.jpg), [catalog/catalog-index-tobacco-sku-list.jpg](screenshots/catalog__catalog-index-tobacco-sku-list.jpg)

- [ ] Done

## Product detail pages

#### AW-009 · Product photo is cropped or pushed to the bottom edge because the <img> ignores the frame height

**High** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: all (1440, 1024, 768, 390)

**Where:** #/product/<id> → .pd-media photo frame (e.g. #/product/88, 57, 318, 69, 265, 237, 31, 329, 58)

**Problem:** Sweep of #/product/1–368 at 1440x900, measuring the drawn photo against the 620x590 frame. Bottom of the product cut off: 37 products, namely 15, 52, 57, 59, 69, 70, 72, 73, 75, 77, 78, 88, 101, 104, 113, 148, 151, 159, 204, 236, 237, 242, 250, 261, 263, 265, 271, 276, 280, 287, 292, 305, 318, 334, 340, 355, 360. Worst cases: 88 Tropical Fantasy loses 928px of a 1485px-tall drawing, so only the cap and neck show. 57 Pure Guard loses 546px, and at 390 only the cap and the top of the 'PURE' label are visible. 151 and 261 each lose 27px. Wide photos placed off-centre (top gap minus bottom gap > 40px): 27 products, namely 2, 3, 31, 35, 58, 79, 89, 106, 149, 150, 163, 170, 175, 181, 194, 203, 210, 215, 217, 228, 244, 255, 290, 291, 325, 329, 346. Examples: 31 BIC has a 194px gap above the photo and 88px below; 329 has 210px above and 93px below. The img box ends on the bottom border, but its 34px padding and contain-letterbox keep the photo off the edge. Square photos (e.g. 1, 162): the img box is 618px tall in a 588px inner frame, so there is 35px of space above the photo and only 5px below. Evidence: screenshots/vproduct__media-1440-88.jpg, media-1440-31.png, media-1440-318.png, media-390-57.png, media-390-88.png (same folder).

**Also seen:**
- #/product/<id> → .pd-media photo (all viewports) — `.pd-media` is a grid with aspect-ratio 1.05 and overflow:hidden. Its img uses width/height:100% but no absolute positioning, so the grid row grows to the image's intrinsic height and the overflow gets clipped. Measured at 1440: media box 620x590, but for #263 White Owl Mini the img box is 618x1069 (content 550x1001). Only the top ~55% of the pack shows, and the 211px source is stretched 2.6x, so it is also blurry. At 390: media 358x341 while the…
- #/product/<id> → .pd-media main photo (every product whose photo is taller than wide) — Measured at 1440 (box 620x590; img rendered height, then % of photo visible): #204 Welch's 1447px, 41%; #88 Tropical Fantasy 1550px, 38%; #101 Castrol GTX 1244px, 47%; #355 Gold Band 1223px, 48%; #113 Clorox 1083px, 54%; #292 Electrolit 768px, 77%; #59 Arizona 673px, 88%. The percentages are the same at 390 (box 358x341). On #204 only the yellow cap and bottle neck are visible. Wide photos sit low instead: the #290 Powerade img starts 143px down …

**Fix:** In .pd-media, set the img to width:100%; height:100%; object-fit:contain (not cover or natural height), so tall/portrait photos fit the frame and aren't cropped or pushed to the bottom edge (index.css:192, 311-312, 596).

**Files:** `src/App.jsx:1092`, `src/components/Picture.jsx:25`, `src/index.css:192`, `src/index.css:311`, `src/index.css:312`, `src/index.css:596`

**Evidence:** [product/crop-1440-88.jpg](screenshots/product__crop-1440-88.jpg), [product/crop-390-57.jpg](screenshots/product__crop-390-57.jpg), [product/crop-1440-77.jpg](screenshots/product__crop-1440-77.jpg), [product/pd-grid-1440-318.jpg](screenshots/product__pd-grid-1440-318.jpg), [product/pd-grid-1440-69.jpg](screenshots/product__pd-grid-1440-69.jpg), [product/pd-grid-1440-31.jpg](screenshots/product__pd-grid-1440-31.jpg), [product/photo-237-ohm-big.jpg](screenshots/product__photo-237-ohm-big.jpg), [photos1/pdp-263-media-1440.jpg](screenshots/photos1__pdp-263-media-1440.jpg), [photos1/pdp-crop-70-1440.jpg](screenshots/photos1__pdp-crop-70-1440.jpg), [photos1/pdp-crop-305-390.jpg](screenshots/photos1__pdp-crop-305-390.jpg), [photos1/pdp-crop-263-390.jpg](screenshots/photos1__pdp-crop-263-390.jpg), [photos1/pdp-crop-15-1440.jpg](screenshots/photos1__pdp-crop-15-1440.jpg), [photos1/pdp-crop-334-1440.jpg](screenshots/photos1__pdp-crop-334-1440.jpg), [photos1/pdp-fixed-preview-70-1440.jpg](screenshots/photos1__pdp-fixed-preview-70-1440.jpg), [photos1/pdp-fixed-preview-263-390.jpg](screenshots/photos1__pdp-fixed-preview-263-390.jpg), [photos2/pdp-204-welchs-1440-full-tall-image-overflow.jpg](screenshots/photos2__pdp-204-welchs-1440-full-tall-image-overflow.jpg), [photos2/pdp-101-390-cropped-photo.jpg](screenshots/photos2__pdp-101-390-cropped-photo.jpg), [photos2/pdp-292-1440-cropped-photo.jpg](screenshots/photos2__pdp-292-1440-cropped-photo.jpg), [photos2/pdp-290-1440-dpr1.jpg](screenshots/photos2__pdp-290-1440-dpr1.jpg), [photos2/fix-pdp204.jpg](screenshots/photos2__fix-pdp204.jpg)

- [ ] Done

#### AW-010 · Product photos show a different product (Pepsi → Aquafina, Monster → Softsoap, eFrutti → Gummi Eyez with AI watermark, etc.)

**High** · imagery · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** #/product/205, 270, 329, 318, 67, 89, 326, 182, 200, 248, 317, 267 → main product photo (the same photos appear on category and search cards)

**Problem:** Source-file contact sheet: screenshots/vproduct__mismatch-sheet.jpg. Mismatches: 205 'Pepsi' uses p205-pepsi.jpg, which is AQUAFINA 'Multipack 32 CT'. 270 'Monster Energy' (tag DEAL) uses p270-monster-energy.jpg, which is two Softsoap refill jugs. 248 'Coke' uses p248-coke.jpg, which is a 'Diet Coke 12 x 12oz' pack. 329 'RAW tips' uses raw_papers.jpg (papers and Challenge Cone boxes, same file as 255). 318 'Tyson 2.0 rolling papers' uses tyson_wraps.jpg (Futurola/Tyson 'Blunt Wraps' display, same as 305). 67 'Kangvape 8000' uses kang_vape_65k.jpg (Speedy Beast X 60K/30K ad, same as 68). 89 'Faygo cans' uses faygo_bottles_20oz.jpg (bottles). 326 'Maruchan ramen cups' uses maruchan_packs.jpg (flat packs). 182 'Sour Punch candy' uses the Sour Punch Twists tub, which is the photo for 178. 200 'Nerds bags' uses the Nerds Gummy Clusters display, which is the photo for 188. 317 'Al Fakher 1 kg' uses alfakher_250_gram.webp. 267 'ZYN European mix' uses US zyn_6mg.webp. The live GET /rest/v1/products img column is identical to CATALOG for all 368 rows, and the PDP for 205 loads generated/p205-pepsi--640x640.webp.

**Also seen:**
- #/product/205, #/product/270 and the other listed PDPs, their cards on category pages, and cart/quote thumbnails — Contact sheets: screenshots/vdata__sheet-wrong-1.jpg and sheet-wrong-2.png. Clearly wrong product: #205 Pepsi = Aquafina 32-ct water; #270 Monster Energy (DEAL) = two Softsoap refill jugs; #248 Coke = Diet Coke 12-pack; #355 Gold Band (variant Type A ATF) = Gold Band SAE 30 non-detergent oil; #51 Cereal cups (Frosted Flakes/Apple Jacks/Froot Loops/Corn Pops) = General Mills Cheerios/Chex cups; #333 Gain dish liquid = Gain laundry detergent; #88 T…
- #/category/DRINKS%20%26%20BAGS, #/category/FOOD%20STUFF, #/category/GROCERY, #/category/MOTOR%20OIL: product cards and #/product/<id> photos — I checked every photo in the four departments on contact sheets and at 1:1 crops. These eight show the wrong item: - #205 Pepsi (p205-pepsi.jpg): an Aquafina water 32-bottle pack with a 'Multipack 32 CT' banner. - #270 Monster Energy (p270-monster-energy.jpg): two Softsoap hand-soap refill jugs. On mobile the card also carries a 'DEAL' tag. - #248 Coke (p248-coke.jpg): a Diet Coke 12-pack with a '12 x 12oz / DIET' banner. The row is regular Coca-…
- #/category/TOBACCO, NOVELTIES, CANDIES → product cards and #/product/<id> photo — Checked each photo against its row's name and variants. The live Supabase `img` and `variants` values match src/data/products.js (0 differences across 368 rows). (1) #19 ZYN nicotine pouches 3mg (products.js:59) uses zyn_6mg.webp, which is correct for #18 'ZYN nicotine pouches 6mg'. The only cans in it with a visible strength (Peppermint, Menthol, Smooth) all read '6 MG'; the rest are covered by overlapping cans, and the filename is 6mg. So the 3…
- #/category/CANDIES → 'eFrutti jar' card; #/product/262 — #262 eFrutti jar (products.js:545, img efrutti_jar.webp, 940x883). (a) The jar label reads 'ALWAYS ORIGINAL! HERBERT'S BEST Gummi Eyez', not eFrutti. (b) The bottom-right corner carries the four-point sparkle mark Google Gemini adds to AI-generated or edited images. I scanned the bottom-right 16% of all 196 photos in the four departments and this is the only watermark (corner-watermark-scan.png). (c) The background is solid black (border average …

**Fix:** Replace the wrong photos with correct packshots for every listed id across Tobacco, Novelties, Candies, Drinks & Bags, Food Stuff, Grocery and Motor Oil (for example #205, 270, 329, 318, 67, 89, 326, 182, 200, 248, 317, 267, 262). Use a watermark-free eFrutti jar photo on the standard background. The fix applies to cards, PDPs and cart/quote thumbnails.

**Owner input needed:** Supply correct, licensed packshots for the mismatched products (#205, 270, 329, 318, 67, 89, 326, 182, 200, 248, 317, 267, 262), including a watermark-free eFrutti jar photo.

**Files:** `src/assets/products/cereal_cups.jpg`, `src/assets/products/efrutti_jar.webp`, `src/assets/products/faygo_bottles_20oz.jpg`, `src/assets/products/gain.jpg`, `src/assets/products/gold_band.jpg`, `src/assets/products/maruchan_packs.jpg`, `src/assets/products/p205-pepsi.jpg`, `src/assets/products/p248-coke.jpg`, `src/assets/products/p270-monster-energy.jpg`, `src/assets/products/sources/drinks-bags.md`, `src/data/products.js:59`, `src/data/products.js:123`, `src/data/products.js:155`, `src/data/products.js:199`, `src/data/products.js:353`, `src/data/products.js:385`, `src/data/products.js:421`, `src/data/products.js:431`, `src/data/products.js:517`, `src/data/products.js:531`, `src/data/products.js:545`, `src/data/products.js:555`, `src/data/products.js:561`, `src/data/products.js:567`, `src/data/products.js:655`, `src/data/products.js:657`, `src/data/products.js:673`, `src/data/products.js:679`, `src/data/products.js:687`, `src/data/products.js:731`, `src/data/products.js:753`, `supabase/seed/products.sql`, `supabase/seed/products.sql:268`

**Evidence:** [product/photo-205-pepsi-shows-aquafina.jpg](screenshots/product__photo-205-pepsi-shows-aquafina.jpg), [product/photo-270-monster-shows-softsoap.jpg](screenshots/product__photo-270-monster-shows-softsoap.jpg), [product/photo-329-raw-tips-shows-papers.jpg](screenshots/product__photo-329-raw-tips-shows-papers.jpg), [product/photo-318-tyson-papers-shows-wraps.jpg](screenshots/product__photo-318-tyson-papers-shows-wraps.jpg), [product/photo-67-kangvape8000-shows-65k.jpg](screenshots/product__photo-67-kangvape8000-shows-65k.jpg), [product/photo-89-faygo-cans-shows-bottles.jpg](screenshots/product__photo-89-faygo-cans-shows-bottles.jpg), [product/photo-326-ramen-cups-shows-packs.jpg](screenshots/product__photo-326-ramen-cups-shows-packs.jpg), [product/photo-248-coke-shows-diet.jpg](screenshots/product__photo-248-coke-shows-diet.jpg), [product/photo-267-zyn-euro-shows-us6mg.jpg](screenshots/product__photo-267-zyn-euro-shows-us6mg.jpg), [product/catalog-photo-contact-sheet-06.jpg](screenshots/product__catalog-photo-contact-sheet-06.jpg), [product/catalog-photo-contact-sheet-07.jpg](screenshots/product__catalog-photo-contact-sheet-07.jpg), [data/pdp-205.jpg](screenshots/data__pdp-205.jpg), [data/pdp-270.jpg](screenshots/data__pdp-270.jpg), [data/wrong-photo-pepsi-monster-coke-faygo.jpg](screenshots/data__wrong-photo-pepsi-monster-coke-faygo.jpg), [data/wrong-photo-raw-garcia.jpg](screenshots/data__wrong-photo-raw-garcia.jpg), [data/photo-variant-mismatch-88-51-355-333.jpg](screenshots/data__photo-variant-mismatch-88-51-355-333.jpg), [photos2/wrong-product-photos.jpg](screenshots/photos2__wrong-product-photos.jpg), [photos2/drinks-sodas-390-cards.jpg](screenshots/photos2__drinks-sodas-390-cards.jpg), [photos2/drinks-energy-390-cards.jpg](screenshots/photos2__drinks-energy-390-cards.jpg), [photos2/pdp-205-1440-dpr1.jpg](screenshots/photos2__pdp-205-1440-dpr1.jpg), [photos2/pdp-270-1440-dpr1.jpg](screenshots/photos2__pdp-270-1440-dpr1.jpg), [photos1/wrong-product-or-brand.jpg](screenshots/photos1__wrong-product-or-brand.jpg), [photos1/zyn-6mg-can-detail.jpg](screenshots/photos1__zyn-6mg-can-detail.jpg), [photos1/shared-image-pairs.jpg](screenshots/photos1__shared-image-pairs.jpg), [photos1/efrutti-jar-herberts-best-gemini-sparkle.jpg](screenshots/photos1__efrutti-jar-herberts-best-gemini-sparkle.jpg), [photos1/pdp-262-media-1440.jpg](screenshots/photos1__pdp-262-media-1440.jpg), [photos1/corner-watermark-scan.jpg](screenshots/photos1__corner-watermark-scan.jpg)

- [ ] Done

#### AW-072 · Adding to quote gives only weak confirmation: 12px grey text, below the fold at 1440, and the cart is off-screen on phones

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all; worst at 390 and 768

**Where:** #/product/<id> → 'Add to quote ↗' button (.qty-row .button)

**Problem:** #/product/162: chose King size, pressed + twice, clicked 'Add to quote'. Afterwards: 0 dialogs, 0 toasts, button label unchanged, stepper back to '1'. The only live region is the stepper's <b aria-live>, which just announces '1'. At 1440x900 the note 'Already in quote: 3 · King size' (12px, rgb(107,102,112)) has top=898, off-screen. The only visible change is the header badge becoming 3. At 390x844, after scrolling to the button (scrollY 470), the header cart is at top=-380 (off-screen, header not sticky), and the note is in view at y=794 as small grey text. At 768x1024 the note is at y=802 and the cart at y=-630. Screenshot: screenshots/vproduct__after-add-1440.jpg

**Also seen:**
- #/category/* and #/product/* at 390px → after tapping 'QUOTE +' / 'Add to quote' — 390x844 (mobile) on #/category/CANDIES: .aw-header computed position is 'relative' and only .category-toolbar is sticky (top 0). I scrolled to a 'QUOTE +' card at scrollY≈4741 and tapped it (Long Boys, id 174). aw-cart became {"174":1}, but no drawer opened, there was no toast, and the only live region was the card's own stepper <b>. The .aw-cart-btn rect top was -4651, so the badge was off-screen. At 1440x900 the same thing happens: header not s…

**Fix:** After an add from a PDP or card, show a visible toast/snackbar near the viewport (fixed position) with the item, the quantity and a 'View quote' action, plus a cart badge bump. That way confirmation is visible when the header is scrolled off-screen on phones and below the fold at 1440 (App.jsx:498-501, 1071, 1125).

**Files:** `src/App.jsx:498`, `src/App.jsx:498-501`, `src/App.jsx:840`, `src/App.jsx:1071`, `src/App.jsx:1071-1078`, `src/App.jsx:1125`, `src/index.css:81`, `src/index.css:330`, `src/index.css:552`

**Evidence:** [product/flow-after-add-1440.jpg](screenshots/product__flow-after-add-1440.jpg), [product/m-162-after-add.jpg](screenshots/product__m-162-after-add.jpg), [cart/m390-scrolled-no-cart.jpg](screenshots/cart__m390-scrolled-no-cart.jpg)

- [ ] Done

#### AW-073 · Many product photos are too low-resolution for the product page and look soft or blurry

**Medium** · imagery · Who: **Owner → Cursor** · Effort: M · New · Viewports: 1440/1024 desktop (worse on 2x retina), 768 tablet

**Where:** #/product/<id> → .pd-media photo (e.g. #/product/122, 335, 77, 263)

**Problem:** Largest generated webp width per product (src/assets/generated). No product image exceeds 1024px wide, because build-images.mjs:34 caps widths at [320, 640, 1024]. At 1440, the PDP content box is 550x522 CSS px. After the AW-009 fix, these 21 products are still upscaled at 1x: 10 500w, 14 512w, 47 500w, 56 512w, 77 227x333, 81 500w, 86 500w, 110 512w, 120 450w, 122 350w, 209 370w, 210 518x386, 218 380w, 240 500w, 241 500w, 251 500w, 263 211x384, 328 428w, 335 380w, 336 380w, 340 227x333. #/product/122 loads 4pk_tissues--350x350.webp into a 618px box (upscaled about 1.6x) and the label text is visibly soft. #/product/335 loads p_gatorade--380x380.webp into 618px. Screenshot: screenshots/vproduct__pdp-media-1440-122.jpg

**Also seen:**
- #/product/<id> photo (and search and cart thumbnails) — Natural source sizes (sharp) for the four departments. #263 White Owl Mini wo_mini.png 211x384; its largest generated file is wo_mini--211x384, drawn at 550px wide on the PDP (2.6x). #77 and #340 Slapwoods slapwoods_5pk.webp 227x333. #209 24_7.jpg 370x370. #218 p_qcarbo.jpg 380x380. #210 seneca_filter_cigarettes.jpg 518x386. #10 4k_wraps.jpg, #81 ss_twin_pack_mini.jpg, #86 seneca_120.png, #240/#241 american_club.png and #251 supreme.jpg are each …
- #/product/<id> photo (and cards on high-density screens) — Source sizes (sharp): - #122 4pk_tissues.avif: 350x350, 7 KB - #335/#336 p_gatorade.jpg: 380x380 - #328 takis.webp: 428x428 - #120 foam_cups.jpg: 450x450 - #47 cheezit.jpg: 500x500 - #56 saxon_motor_oil.png: 512x512 - #110 brillo_dishwasher.png: 512x512 - #114 ajax_bleach.jpg: 554x554 At 1440 the PDP content box is 550x550 CSS px. The browser loads 4pk_tissues--350x350.webp and p_gatorade--380x380.webp, which is about 1.5x upscaling at 1x density…
- #/product/324, 112, 333, 96, 117, 346 (photo) — Sharpness is Laplacian variance at full size divided by half size, measured over all 190 product photos 800px or wider (median 0.41): - #324 twang_beer_salts_packets.webp (2000x2000): 0.16. JPEG ringing and halftone on the 'LEMON LIME' packets. - #117 p117-las-totally-awesome-laundry.jpg (2560x2307, 325 KB): 0.20, soft label. - #112 and #333 gain.jpg (1280x1280): 0.21, soft 'Gain' logo. - #96 autoguard_brake_fluid.webp (1000x1000): 0.23, soft 'AU…

**Fix:** Replace source photos under ~800px (and the enlarged low-detail copies such as #324, 112, 333, 96, 117, 346, 122, 335, 77, 263) with high-resolution packshots. In scripts/build-images.mjs, stop upscaling past the source width and cap the rendered size to the natural width (build-images.mjs:34, images.js:82).

**Owner input needed:** Supply high-resolution, licensed packshots (at least 800px) for the low-resolution products listed, starting with #324, 112, 333, 96, 117, 346, 122, 335, 77 and 263.

**Files:** `scripts/build-images.mjs:34`, `src/assets/products/autoguard_brake_fluid.webp`, `src/assets/products/gain.jpg`, `src/assets/products/p117-las-totally-awesome-laundry.jpg`, `src/assets/products/twang_beer_salts_packets.webp`, `src/data/products.js:27`, `src/data/products.js:33`, `src/data/products.js:41`, `src/data/products.js:49`, `src/data/products.js:79`, `src/data/products.js:107`, `src/data/products.js:115`, `src/data/products.js:133`, `src/data/products.js:175`, `src/data/products.js:183`, `src/data/products.js:193`, `src/data/products.js:213`, `src/data/products.js:241`, `src/data/products.js:245`, `src/data/products.js:249`, `src/data/products.js:255`, `src/data/products.js:261`, `src/data/products.js:265`, `src/data/products.js:417`, `src/data/products.js:439`, `src/data/products.js:441`, `src/data/products.js:457`, `src/data/products.js:501`, `src/data/products.js:503`, `src/data/products.js:523`, `src/data/products.js:547`, `src/data/products.js:575`, `src/data/products.js:669`, `src/data/products.js:677`, `src/data/products.js:685`, `src/data/products.js:687`, `src/data/products.js:691`, `src/data/products.js:693`, `src/data/products.js:701`, `src/lib/images.js:82`

**Evidence:** [product/pd-grid-1440-122.jpg](screenshots/product__pd-grid-1440-122.jpg), [product/pd-grid-1440-335.jpg](screenshots/product__pd-grid-1440-335.jpg), [product/crop-1440-77.jpg](screenshots/product__crop-1440-77.jpg), [photos1/pdp-263-media-1440.jpg](screenshots/photos1__pdp-263-media-1440.jpg), [photos1/pdp-209-media-1440.jpg](screenshots/photos1__pdp-209-media-1440.jpg), [photos1/sheet-01-TOBACCO-1-14.jpg](screenshots/photos1__sheet-01-TOBACCO-1-14.jpg), [photos2/lowres-under-600.jpg](screenshots/photos2__lowres-under-600.jpg), [photos2/pdp-122-1440-dpr2.jpg](screenshots/photos2__pdp-122-1440-dpr2.jpg), [photos2/pdp-335-1440-dpr2.jpg](screenshots/photos2__pdp-335-1440-dpr2.jpg), [photos2/crops-soft-upscaled.jpg](screenshots/photos2__crops-soft-upscaled.jpg), [photos2/soft-upscaled.jpg](screenshots/photos2__soft-upscaled.jpg), [photos2/pdp-324-1440-dpr2.jpg](screenshots/photos2__pdp-324-1440-dpr2.jpg)

- [ ] Done

#### AW-074 · 'Add to quote' is disabled until a variant is chosen, so the 'Select a variant' error and other add/SKU-resolution branches are unreachable dead code

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/product/<multi-variant id> (e.g. 162, 1, 58) → 'Add to quote ↗'

**Problem:** #/product/162 at 1440/390/768: 'Add to quote ↗' is disabled until a chip is pressed, so it cannot be focused or clicked, and no .form-error ever renders. The only guidance is the 12px muted line 'Choose one variant. Each variant is quoted on its own line.' at App.jsx:1108, above the price block and about 150px above the button. 234 of 368 products (variants.length > 1, per requiresVariantChoice in src/lib/lines.js:27) are affected.

**Also seen:**
- #/product/<multi-variant id> 'Add to quote'; src/lib/lines.js resolveSkuLine — (1) ProductPage disables 'Add to quote' until a variant is chosen (App.jsx:1123), so handleAdd's variantError branch and the 'Select a variant before adding this product.' alert (App.jsx:1072-1075, 1109) can never show. A click on the disabled button gives no feedback, and the only hint is the grey note above. (2) lines.js:49-51 and QuickReorder.jsx:1-4 say 'the catalog has a few duplicate SKUs', but an in-browser scan of all 368 rows found 0 dup…

**Fix:** Keep 'Add to quote' enabled on multi-variant products. When it is clicked with no variant selected, show the inline 'Select a variant' error (announced through aria-live) and move focus to the variant group. Then remove the branches that are still unreachable in the add handler (App.jsx:1071-1078, 1109, 1123) and in src/lib/lines.js resolveSkuLine.

**Files:** `src/App.jsx:1071`, `src/App.jsx:1071-1078`, `src/App.jsx:1101`, `src/App.jsx:1108`, `src/App.jsx:1109`, `src/App.jsx:1123`, `src/index.css:171`, `src/lib/lines.js:47-51`, `src/pages/account/QuickReorder.jsx:1-4`

**Evidence:** [product/p162-snickers-1440.jpg](screenshots/product__p162-snickers-1440.jpg), [cart/pd1-before-variant.jpg](screenshots/cart__pd1-before-variant.jpg)

- [ ] Done

#### AW-075 · Descriptions are templated filler that repeats the name and the variant list, with casing errors

**Medium** · content-copy · Who: **Owner → Cursor** · Effort: L · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/product/<id> → .pd-desc and meta description

**Problem:** 133 of 368 descriptions use the template '<name> from the <sub> line in our <Dept> department.' 46 end with 'Stocked in one variety: X.' 226 simply list the variants already shown as chips. Examples: #/product/205 'Pepsi from the soda line in our Drinks & Bags department.' #/product/329 'RAW rolling tips from the papers and cones line in our Tobacco department. Stocked in one variety: Tips.' #/product/122 'Bath tissue in 4-roll packs. Stocked in one variety: Case.' Casing and name mismatches: 9 'Ez roll' (name 'Royal Blunts EZ Roll'), 13 'Havana leaf wraps', 183 'Extra gum', 193 'Pure eyes', 213 'Lil leaf wraps', 260 'Backwoods true wraps', 274 'Raw guarana wraps', 310/311 'Geek Bar mate'. Odd statements: 132/133 charcoal 'Two colors: White and Red'; 219 'Happy valentines jar from the wellness pill line … 4 inch, 6 inch and Colored'; 258 'Stocked in one variety: Any flavor'.

**Also seen:**
- #/product/<id> → description paragraph, fine print and meta description (133 of 368 products) — 133/368 descriptions contain 'from the … line in our … department'. 63 of those are only that sentence, e.g. products.js:432 'Pepsi from the soda line in our Drinks & Bags department.', :434 'Dr Pepper from the soda line…', :518 'Coca-Cola from the soda line…', :642 'Geek Bar mate from the disposable vape line…', :444 'Cheyenne from the cigarette line in our Tobacco department.'. The 63 bare IDs are 45,64-68,70-73,93-95,99,100,103,114,116,119,127…
- PDP description paragraph (first line under the H1) — 133 descriptions use the template "… from the X line in our Y department." In 102 of them that template is the only content. Examples: #205 "Pepsi from the soda line in our Drinks & Bags department."; #64 "RAZ 25K from the disposable vape line in our Novelties department."; #301–#304 "… pills from the wellness pill line…"; #129 "Home air fresheners, from the grocery line in our Grocery department." Ids: 2, 3, 5, 15, 41, 42, 45, 53, 54, 64, 65, 66…

**Fix:** Replace the templated descriptions ('from the X line in our Y department', name plus variant list) with real copy covering pack size, case count, dimensions and key attributes. Fix casing errors. Use this copy for the meta description too.

**Owner input needed:** Provide the real pack size, case count, dimensions and key attributes for each product so real descriptions can be written.

**Files:** `src/App.jsx:105`, `src/App.jsx:1097`, `src/App.jsx:1099`, `src/data/products.js:12`, `src/data/products.js:23`, `src/data/products.js:39`, `src/data/products.js:265`, `src/data/products.js:431`, `src/data/products.js:432`, `src/data/products.js:443`, `src/data/products.js:444`, `src/data/products.js:459`, `src/data/products.js:531`, `src/data/products.js:535`, `src/data/products.js:538`, `src/data/products.js:585`, `src/data/products.js:679`, `src/lib/useCatalog.js:28`

**Evidence:** [product/pd-grid-1440-9.jpg](screenshots/product__pd-grid-1440-9.jpg), [product/pd-grid-1440-329.jpg](screenshots/product__pd-grid-1440-329.jpg), [copy/product-211-cheyenne-cigars-cigarette-line.jpg](screenshots/copy__product-211-cheyenne-cigars-cigarette-line.jpg), [copy/product-1-info-guest.jpg](screenshots/copy__product-1-info-guest.jpg), [data/pdp-205.jpg](screenshots/data__pdp-205.jpg)

- [ ] Done

#### AW-230 · Breadcrumb skips the product line, is not a nav landmark, and 'View department' ignores the line

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/product/<id> → .crumbs and related-section 'View department ↗'

**Problem:** #/product/166 shows 'Home / Candies / REESE’S'. The sub-line 'Chocolate Bars' is missing, although the eyebrow says 'REESE’S · CHOCOLATE BARS'. The crumb is `<div class="crumbs">` with plain buttons: no <nav aria-label="Breadcrumb">, no <ol>, no aria-current on the last item. The Candies crumb and 'View department' under the heading 'More chocolate bars' both go to #/category/CANDIES (all 58 items), not #/category/CANDIES/Chocolate%20Bars. At 390, 'View department ↗' wraps onto two lines (max-width 120px, index.css:574).

**Fix:** Replace App.jsx:1083-1087 with `<nav aria-label="Breadcrumb"><ol className="crumbs"><li><button onClick={goHome}>Home</button></li><li><button onClick={() => goCategory(p.cat)}>{catLabel(p.cat)}</button></li><li><button onClick={() => goCategory(p.cat, p.sub)}>{p.sub}</button></li><li aria-current="page">{p.name}</li></ol></nav>`. Draw separators with CSS `li + li::before { content: '/' }` and update .crumbs for list-style:none/display:flex. Change App.jsx:1143 to `onClick={() => goCategory(p.cat, p.sub)}` with the label `View all {p.sub.toLowerCase()}`.

**Files:** `src/App.jsx:1083`, `src/App.jsx:1143`, `src/index.css:257`, `src/index.css:574`

**Evidence:** [product/p162-snickers-1440-full.jpg](screenshots/product__p162-snickers-1440-full.jpg)

- [ ] Done

#### AW-231 · Related products are always the first four rows of the line, and small lines show none

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/product/<id> → 'SAME LINE / More …' section

**Problem:** App.jsx:1069 takes the first 4 rows of the same sub by id order. 277 products are in lines with more than 5 items, so each line shows nearly the same 4 cards. All cigar pages except 1-4 show 1 Swisher Sweets, 2 White Owl, 3 Game and 4 BLK (verified on #/product/17). #/product/129 Home air fresheners, the only row in 'Other Grocery', gets no related section. Seven lines have 2 items (Lubricants, Auto Accessories, Bags & Storage, Adult Wellness, Energy Shots, Dairy & Milk, Coffee), so those pages show one card (#/product/353 shows only 'Folgers coffee'). On 16 pages (18, 19, 58, 89, 112, 267, 290, 291, 316, 317, 329, 333, 335, 336, 350, 351) the related row includes a product with the identical photo file. Example: #/product/290 Powerade big shows 'Powerade small' with the same powerade_20oz.webp banner.

**Fix:** Rank candidates: same brand first, then same sub, then same department. Exclude rows with the same `img` as the current product. Fill up to 4 from the department when the line has fewer than 4 others. Rotate deterministically by id (e.g. sort by `(x.id * 7919 + p.id) % 1000`) so different pages show different neighbours.

**Files:** `src/App.jsx:1069`, `src/App.jsx:1139`

- [ ] Done

#### AW-232 · Not-found, access-denied and filtered-result states are dead ends with thin or misleading copy

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/product/0, #/product/99999, #/product/abc, #/product/-1, #/product/1.5, #/product/01

**Problem:** 0, 99999, abc, -1, 1.5, 1abc and %20 all render only an H1 'Product not found' and a 'Back to home' link. There is no search box, no link to All products or the department, and no explanation (e.g. discontinued). Title 'Product not found · Alabama Wholesale Inc' uses the homepage meta description and no noindex. #/product/01 renders Swisher Sweets (id 1) at a second URL, because parseHash uses Number(). A product deactivated in Supabase also lands on this page after first paint, since useCatalog drops inactive rows while the static data already rendered it.

**Also seen:**
- #/category/FOO (any unknown department, including #/category/tobacco lowercase) — At 1440px, #/category/FOO main content is 147px tall with a single button 'Back to home' and no .crumbs. #/category/tobacco and #/category/Tobacco are identical. The footer in the same viewport lists All products, Tobacco (68), Novelties & Vapes (51) … Drinks & Bags (44). #/category/TOBACCO/Nope renders the Tobacco page with title 'Nope · Tobacco · Wholesale Catalog', 'Showing 0' and a 'Nope' chip. Screenshots: screenshots/vcatalog__dept-not-foun…
- #/product/9999, #/category/NOPE, #/admin (guest), category result note with a sub active — #/product/9999 shows 'Product not found' plus only a 'Back to home' link (App.jsx:1058-1061), with no search or catalog link. #/category/NOPE shows 'That department doesn't exist. Back to home' (:902). A guest at #/admin sees 'Access denied' / 'Admin role required.' (AdminPage.jsx:23-24), which is developer wording. With a sub active, the result note reads 'Showing 3 of 51 items in Kratom & Kava' (App.jsx:915), comparing the line's count with the…

**Fix:** Make 'Product not found' and 'Department not found' helpful: search box, department links and a catalog link, not just 'Back to home' (App.jsx:1056-1058, 898-902). Improve the #/admin denied copy and the sub-line result note wording (App.jsx:915).

**Files:** `src/App.jsx:97`, `src/App.jsx:104`, `src/App.jsx:169`, `src/App.jsx:332`, `src/App.jsx:866`, `src/App.jsx:898`, `src/App.jsx:902`, `src/App.jsx:915`, `src/App.jsx:1056`, `src/App.jsx:1058`, `src/pages/admin/AdminPage.jsx:19`, `src/pages/admin/AdminPage.jsx:23`

**Evidence:** [product/invalid-99999-1440.jpg](screenshots/product__invalid-99999-1440.jpg), [catalog/invalid-dept-FOO-1440.jpg](screenshots/catalog__invalid-dept-FOO-1440.jpg)

- [ ] Done

#### AW-233 · 46 single-variant products show a pre-selected 'variant' chip that isn't a real choice, and a '1 variants' count

**Low** · catalog-data · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/product/<single-variant id> → .variant-chips (e.g. 329, 122, 123, 124, 355, 267, 258, 331)

**Problem:** 46 rows have exactly one variant, rendered as a purple pressed chip that does nothing. The values often restate or contradict the name: 329 RAW tips [Tips], 122 Bath tissue 4-pack [Case], 123 Paper towels [Case], 124 Bath tissue single rolls [Case], 355 Gold Band [Type A], 267 ZYN European mix [Mix], 258 Psyched pre rolls jars [Any flavor], 331 Panasonic batteries [AAA2], 330 High Hemp organic wraps [Organic], 348/349 [Regular]. The cart then shows lines like 'RAW tips — Tips' and 'Bath tissue 4-pack — Case', and variant SKUs like AW-RAW-TIPS.

**Also seen:**
- Product card detail line and #/catalog index rows, e.g. #/category/DRINKS%20%26%20BAGS/Sports%20Drinks "Gatorade · 1 variants · AW-GATORADE-BIG" — App.jsx:821 renders `${p.flavors} variants` and CatalogIndexPage.jsx:52 does the same. 46 rows have exactly one variant, and #/catalog shows 46 rows reading "1 variants" (measured).

**Fix:** Treat products with one variant or fewer as having no variants. Hide .variant-chips on the PDP (show the variant name as plain text if it carries information). Omit the '· N variants' segment on product cards (App.jsx:821) and #/catalog rows (CatalogIndexPage.jsx:52) when N ≤ 1, and pluralize correctly elsewhere. Optionally remove single-entry variant arrays from products.js / lib/lines.js.

**Files:** `src/App.jsx:821`, `src/App.jsx:1100`, `src/data/products.js:265`, `src/data/products.js:679`, `src/lib/lines.js:27`, `src/pages/support/CatalogIndexPage.jsx:52`

**Evidence:** [product/pd-grid-1440-122.jpg](screenshots/product__pd-grid-1440-122.jpg), [product/pd-grid-1440-329.jpg](screenshots/product__pd-grid-1440-329.jpg), [data/card-1-variants-gatorade.jpg](screenshots/data__card-1-variants-gatorade.jpg), [catalog/catalog-index-tobacco-sku-list.jpg](screenshots/catalog__catalog-index-tobacco-sku-list.jpg), [support/catalog-1440-novelties-expanded.jpg](screenshots/support__catalog-1440-novelties-expanded.jpg), [support/catalog-390-tobacco-expanded.jpg](screenshots/support__catalog-390-tobacco-expanded.jpg)

- [ ] Done

#### AW-234 · The SKU is buried in 11px fine print and does not change when a variant is picked

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/product/<id> → .pd-desc.pd-fine ('SKU AW-… Supplied to licensed retail businesses…')

**Problem:** The SKU is the first words of an 11px #6b6670 paragraph that repeats the same delivery and will-call boilerplate on all 368 pages (App.jsx:1099). For guests and pending accounts the SKU stays at the base code (e.g. AW-SNICKERS) after choosing King size. The variant SKU (AW-SNICKERS-KING-SIZE), which Quick Reorder's SKU entry expects, appears only in the approved-buyer price label (App.jsx:1112).

**Fix:** Remove the SKU from the fine-print sentence and add it to the spec list proposed in the sell-unit finding as `SKU: {variantSku(p.sku, selected)}`, shown to everyone at 13px in var(--ink). Keep the delivery sentence once, under the purchase block, at var(--text-sm).

**Files:** `src/App.jsx:1099`, `src/App.jsx:1112`, `src/index.css:318`

**Evidence:** [product/p162-snickers-1440.jpg](screenshots/product__p162-snickers-1440.jpg)

- [ ] Done

#### AW-235 · Variant chips are exposed as independent toggle buttons instead of a required single-choice group

**Low** · accessibility · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/product/<multi-variant id> → .variant-chips

**Problem:** The chips are `<button aria-pressed>` inside role=group aria-label 'Choose a variant' (App.jsx:1101-1104). A screen reader announces each one as 'toggle button, not pressed' and never says only one can be chosen or that the choice is required. Arrow keys do nothing: focus stayed on 'King size' after ArrowRight. The visible focus ring works (3px #b8390a).

**Fix:** Use `role="radiogroup" aria-required="true" aria-labelledby="pd-variant-label"` on the container with a visible `<p id="pd-variant-label">Choose a flavor</p>`. Each chip gets `role="radio" aria-checked={selected === v}` and a roving tabIndex (0 on the checked or first chip, -1 on the others). Add an onKeyDown for ArrowLeft/ArrowRight/Home/End that moves focus and selection. Keep the existing chip styles, switching the selector from [aria-pressed=true] to [aria-checked=true] at index.css:324.

**Files:** `src/App.jsx:1101`, `src/App.jsx:1103`

- [ ] Done

#### AW-236 · No zoom, enlarge, or alternate views on product photos

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/product/<id> → .pd-media

**Problem:** #/product/58 and #/product/12 at 1440: .pd-media has cursor:auto and no button, link or tabindex inside. Clicking it opens no [role=dialog] and the hash stays the same. The rendered image is 618px wide (source faygo_bottles_20oz--640x331.webp and loose_leafs_2_99_1_99--640x640.webp). At 390 (mobile emulation) the image renders 356px wide. The largest generated sizes are 1024px for 77 photos, 1000px for 58 and 800px for 41 (e.g. faygo_bottles_20oz--800x414.webp). The viewport meta (index.html:5) does not block pinch-zoom, so phone users can already pinch the page. Evidence: screenshots/product__vq-pd-media-390-12.jpg and vq-pd-grid-1440-58.png.

**Fix:** In src/App.jsx around lines 1090-1093, when `p.picture` exists, wrap the PDP <Picture> in `<button type="button" className="pd-zoom" aria-label={`Enlarge photo of ${p.name}`} onClick={() => setZoomOpen(true)}>`. Add `const [zoomOpen, setZoomOpen] = useState(false)` to the product page component. When zoomOpen is true, render a <ModalLayer onClose={() => setZoomOpen(false)}> containing an <img> whose src is the last URL in `p.picture.webpSrcSet` (`p.picture.webpSrcSet.split(', ').pop().split(' ')[0] || p.picture.src`). Style it with `max-width: min(90vw, <natural width>px); max-height: 90vh; object-fit: contain`, so it is never upscaled past its natural size. Add `.pd-zoom { all: unset; display: contents; cursor: zoom-in; }` next to src/index.css:311, plus a visible :focus-visible outline on .pd-media. The larger view only helps if bigger files exist, so add 1600 to PRODUCT_WIDTHS in scripts/build-images.mjs:34 (the existing withoutEnlargement guard will skip sources smaller than that). Optional follow-up: add an `images: []` array to the product data for back-of-pack shots, shown as thumbnails under the frame.

**Files:** `scripts/build-images.mjs:34`, `src/App.jsx:1090`, `src/App.jsx:1092`, `src/components/ModalLayer.jsx`, `src/index.css:311`

- [ ] Done

#### AW-237 · PDP info column mixes a 480px text measure with 620px chips, price rules and qty row at wide viewports

**Low** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: 1440, 1024

**Where:** #/product/<id> at 1440 → .pd-info

**Problem:** Measured on #/product/58 and #/product/12 at 1440x900: .pd-info spans x 740-1360. Both .pd-desc paragraphs span 740-1220, and .pd-unit (#12) spans 740-1220. .variant-chips, .pd-price and .qty-row each span 740-1360, and the Faygo chips wrap with the last chip ending at x=1352. The .pd-price top and bottom borders therefore extend 140px past the right edge of the description and fine print above. At 1024x900 there is no mismatch: .pd-info and all child blocks span 525-992 (467px). The mismatch appears once the column is wider than 480px, at viewports above roughly 1070px. Screenshots: screenshots/product__vq-pd-grid-1440-58.jpg and vq-pd-grid-1024-58.png.

**Fix:** Put the whole info column on one measure. Add `.pd-info { max-width: 520px; }` in src/index.css (after line 313, before the .pd-info h1 rule). Change `max-width: 480px` to `max-width: none` in .pd-info .pd-desc (line 316) and .pd-info .pd-unit (line 317), so the description, unit note, chips, .pd-price rules and .qty-row all end at the same right edge. The media column stays 1fr, and the smaller info column leaves white space on the right at 1440, which is fine for this editorial layout. Leave the ↗ glyph on 'Add to quote' (App.jsx:1123) as it is. If the owner wants ↗ reserved for navigation, that has to be a sitewide change to every CTA listed by `grep -rn "↗" src`, not just this one button.

**Files:** `src/index.css:316`, `src/index.css:317`, `src/index.css:319`, `src/index.css:322`, `src/index.css:325`

**Evidence:** [product/pd-grid-1440-58.jpg](screenshots/product__pd-grid-1440-58.jpg)

- [ ] Done

