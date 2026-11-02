# Design, responsive layout & accessibility

Part of the Alabama Wholesale site review (2026-09-28). Start with [00-START-HERE.md](00-START-HERE.md) for the guardrails and the order to work in.

69 findings. Critical 0, High 9, Medium 34, Low 26. File paths are relative to the repo root `alabamawholesaleinc-2a-editorial/`. Each finding ends with a checkbox; tick it when the fix is in.

**Who** says who can act: **Cursor** can fix it from the finding alone. **Owner → Cursor** needs a decision, fact or asset from the business owner first; Cursor must not invent it, and should leave a `TODO(owner)` where the code depends on the answer.

## Contents

- Visual design system & consistency (19)
- Mobile & tablet layout (18)
- Safari / iPhone & touch behaviour (5)
- Text size, zoom & print (4)
- Forced dark mode & Google Translate (3)
- Accessibility (WCAG 2.2 AA) (20)

## Visual design system & consistency

#### AW-035 · The only logo asset is a 320px JPEG with a white fringe: the wordmark is unreadable in the header, and it is upscaled with a white edge line into the share image and app icons

**High** · visual-design · Who: **Owner → Cursor** · Effort: M · New · Viewports: all (1440: 72×72px; ≤850: 48×48px; ≤360: 42×42px)

**Where:** Every route → header .aw-logo (also #/ age gate .brand and footer .footer-brand)

**Problem:** The header renders src/assets/logo.jpg, a 320×320 JPG with an orange field (sampled #dc6c3e) and a small white 'Alabama' and purple 'WHOLESALE INC' mark. Measured on the canvas, the artwork fills x43–271 and y114–194 of the 320px source. At the 72px render size the mark is about 51×18px, so the 'WHOLESALE INC' line is about 4px tall and can't be read (see home-logo-zoom.png). On phones the tile is 48px and the mark is about 3px. The JPG has a 3–4px near-white frame on the left, right and bottom edges (edge pixels #fcffff/#fffffd) but none at the top. The tile orange #dc6c3e matches none of the tokens (--orange #ed5a21, --button-orange #c84716) and sits next to the #c84716 'Sign Up' button. The age gate (App.jsx:366) and the footer (App.jsx:1314) use a completely different text wordmark: DM Sans 46px/26px orange 'Alabama' with 'WHOLESALE INC.' below it and no swoosh. The brand therefore appears in two unrelated treatments. The approved 2A concept (wireframes/qa/screenshots/2a-editorial-split-hero-desktop.png) uses a horizontal transparent logo, and that asset already exists at ../wireframes/Alabama-Wholesale-Website/assets/logo.png (1386×588 RGBA). The utility row also repeats 'ALABAMA WHOLESALE INC.' as text beside the logo, which suggests the logo itself was not legible enough to carry the name.

**Also seen:**
- /og.jpg (link previews), /icon-512.png, /icon-192.png, /apple-touch-icon.png (home-screen icon) — src/assets/logo.jpg is 320x320. Rows 312-319 are a light band (row 312 = 240,198,184, rows 313-319 = 251-255 near white), and columns 0-3 and 316-319 are white. build-images.mjs:180 insets round(320×0.02) = 6px on every side, so the 308px tile keeps rows 312-313. Results: icon-512 bottom rows 509-511 = 228,171,150 / 247,218,209 / 254,248,245; icon-192 row 191 = 251,237,232; apple-touch-icon row 179 = 249,232,226; og.jpg y=513-514 = 248,194,182 / …

**Fix:** Create or obtain a vector (SVG) master of the logo with a transparent background. Use it for the header .aw-logo, the age gate .brand and the footer brand, sized so the wordmark is legible (App.jsx:366, 456-457). Regenerate og.jpg, icon-192.png, icon-512.png and apple-touch-icon.png from the vector master in scripts/build-images.mjs:176-208 with no white edge.

**Owner input needed:** Supply a vector (SVG) master of the Alabama Wholesale logo with a transparent background.

**Files:** `index.html:11`, `index.html:23-27`, `public/site.webmanifest:9-12`, `scripts/build-images.mjs:31`, `scripts/build-images.mjs:176-208`, `scripts/build-images.mjs:180`, `scripts/build-images.mjs:181`, `scripts/build-images.mjs:199`, `scripts/build-images.mjs:201`, `scripts/build-images.mjs:204`, `scripts/build-images.mjs:206`, `src/App.jsx:366`, `src/App.jsx:447`, `src/App.jsx:456`, `src/App.jsx:457`, `src/App.jsx:1314`, `src/assets/logo.jpg`, `src/data/theme.js:9`, `src/index.css:87`, `src/index.css:88`, `src/index.css:424`, `src/index.css:425`, `src/index.css:499`, `src/index.css:500`, `src/index.css:513`, `src/index.css:532`, `src/index.css:605`

**Evidence:** [design/home-header-1440.jpg](screenshots/design__home-header-1440.jpg), [design/home-logo-zoom.jpg](screenshots/design__home-logo-zoom.jpg), [design/agegate-1440.jpg](screenshots/design__agegate-1440.jpg), [design/footer-1440.jpg](screenshots/design__footer-1440.jpg), [design/home-390-viewport.jpg](screenshots/design__home-390-viewport.jpg), [home/crop-header-logo.jpg](screenshots/home__crop-header-logo.jpg), [home/crop-header-logo-4x.jpg](screenshots/home__crop-header-logo-4x.jpg), [nav/logo-1440.jpg](screenshots/nav__logo-1440.jpg), [nav/zoom-logo-3x.jpg](screenshots/nav__zoom-logo-3x.jpg), [nav/header-1440.jpg](screenshots/nav__header-1440.jpg), [nav/agegate-1440.jpg](screenshots/nav__agegate-1440.jpg), [responsive/home-390-header.jpg](screenshots/responsive__home-390-header.jpg), [photos2/header-logo-1440.jpg](screenshots/photos2__header-logo-1440.jpg), [photos2/header-logo-390.jpg](screenshots/photos2__header-logo-390.jpg), [photos2/logo-icons-og-1to1.jpg](screenshots/photos2__logo-icons-og-1to1.jpg), [seo/og-image-bottom-edge-zoom.jpg](screenshots/seo__og-image-bottom-edge-zoom.jpg), [seo/og-image-wordmark-zoom.jpg](screenshots/seo__og-image-wordmark-zoom.jpg), [seo/icon-512-bottom-edge.jpg](screenshots/seo__icon-512-bottom-edge.jpg), [seo/icon-512-wordmark-crop.jpg](screenshots/seo__icon-512-wordmark-crop.jpg), [photos2/icon-512-bottom-edge-light-line.jpg](screenshots/photos2__icon-512-bottom-edge-light-line.jpg), [photos2/og-bottom-edge-light-line.jpg](screenshots/photos2__og-bottom-edge-light-line.jpg)

- [ ] Done

#### AW-143 · Button system is fragmented: about 15 visual button styles with different sizes, radii, casing and hover colors

**Medium** · consistency · Who: **Cursor** · Effort: L · New · Viewports: all

**Where:** Header (Sign Up, Cart), product cards (Choose / QUOTE + / ADD +), carousel controls, dialogs, cart drawer, account/admin

**Problem:** Measured signatures include: .button (12px/700, radius 2px, 44px, bg #c84716, hover #b8390a); .aw-signup 'Sign Up ↗' (13px, radius 3px, padding 10×18, hover #a93208), a second primary button that looks similar but isn't the same component; .button.ghost (12px, radius 2px, 44px, transparent); .aw-cart-btn (13px, radius 3px); .home-carousel-controls button (12px, radius 2px, 40px, white bg); .card-add (11px, 1px tracking, radius 0, 40px); .mini-btn (10px UPPERCASE, radius 0, about 29px); .sub-pill (12px/600, radius 0); .variant-chips (12px/600, radius 2px, paper bg, no hover); .dept-jump (12px/700, radius 0); .active-filters chips (radius 999px). In one card slot the labels are 'Choose' (sentence case, App.jsx:832) and 'QUOTE +' / 'ADD +' (upper case, App.jsx:840), side by side in the same grid (home-cards-1440.png). There are four close-button variants: .dialog-close (40px, paper bg, 24px ×), .aw-menu-close (40px, white bg), .drawer-remove (40px, 22px ×) and the search close (36px, 20px ×). There are three stepper variants: card 40px/18px glyph/32px value, PDP 44px/20px/44px, drawer 40px/18px/34px. wireframes/skeleton/STYLE-GUIDE.md specifies 'mostly square; buttons use 2–3 px radius'.

**Fix:** Make .button the single button component. Variants: `.button` (primary orange), `.button.ghost` (purple outline), `.button.on-dark` (white outline, the current age-gate/contact-strip ghost), `.button.sm` (min-height 40px, padding 0 14px, 12px) and `.button.xs` (min-height 32px, 11px). Use radius 2px everywhere and sentence case. Then: header Sign Up (App.jsx:495) → `className="button aw-desktop-only"` and delete .aw-signup; Cart → `button ghost sm`; .card-add → `button ghost sm`; carousel controls → `button ghost sm`; .mini-btn → `button xs` (primary/ghost/text). Change the card labels at App.jsx:832/840 to 'Choose variant' and 'Add to quote' / 'Add to order'. Create one `.icon-btn` (40×40, radius 50%, 1px var(--line) border, white bg, 20px icon) and use it for .dialog-close, .aw-menu-close, .drawer-remove and the search-results close. Create one `.stepper` (44px buttons on touch, 40px on desktop, 20px icons, 40px value) for card, PDP and drawer.

**Files:** `src/App.jsx:495`, `src/App.jsx:832`, `src/App.jsx:840`, `src/index.css:98`, `src/index.css:103`, `src/index.css:104`, `src/index.css:105`, `src/index.css:130`, `src/index.css:151`, `src/index.css:166`, `src/index.css:185`, `src/index.css:215`, `src/index.css:219`, `src/index.css:262`, `src/index.css:323`, `src/index.css:326`, `src/index.css:407`, `src/index.css:438`, `src/index.css:470`, `src/index.css:474`

**Evidence:** [design/home-header-1440.jpg](screenshots/design__home-header-1440.jpg), [design/home-cards-1440.jpg](screenshots/design__home-cards-1440.jpg), [design/cart-drawer-1440.jpg](screenshots/design__cart-drawer-1440.jpg), [design/account-admin-css-mock-1280.jpg](screenshots/design__account-admin-css-mock-1280.jpg), [design/home-viewport-1440.jpg](screenshots/design__home-viewport-1440.jpg)

- [ ] Done

#### AW-144 · A 30px purple strip shows below the FDA warning band, and the legal row sits flush on top of the band

**Medium** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: all (30px at 1440, 22px at ≤600)

**Where:** Every route → footer bottom (.footer-main / .fda-note)

**Problem:** The page ends with the dark #1c0e40 FDA warning band followed by another band of #281459 purple. Measured: at 1440 the footer bottom is at 5248 and the .fda-note bottom at 5218, leaving a 30px strip. At 390 the strip is 22px (8408 vs 8386). The cause is that .fda-note is inside .footer-main, which has `padding: 44px 0 30px` (22px on mobile). The gap between the .footer-legal row and the band is 0px, so the '© 2026… / Delivery · Privacy · Trade terms' line touches the warning band.

**Also seen:**
- #/ → footer bottom (.footer-legal, .fda-note) — .fda-note sits inside .footer-main, which has padding-bottom 30px (index.css:416). So the dark warning band is followed by a 30px purple strip at the very end of the page (band bottom 5218, footer bottom 5248). The legal row has no bottom padding: its bottom edge (5152.8px) is exactly the band's top, so the 'Delivery / Privacy / Trade terms' underlines touch the band.
- Footer bottom: .footer-legal row and .fda-note bar — Measured on #/contact at 1440: - .footer-legal ends at y=1829.5 and .fda-note starts at exactly 1829.5, so the gap is 0px. The copyright and policy-link underlines nearly touch the dark bar. - .fda-note ends at 1894.9 but the footer ends at 1924.9. `.footer-main { padding: 44px 0 30px }` leaves a 30px band of lighter purple below the darker warning bar, so the page doesn't end on the dark bar.

**Fix:** In the footer, add spacing between .footer-legal and the .fda-note band, and remove the 30px purple strip below the band. Make .fda-note the last element with no parent padding or background showing beneath it (index.css:416, 426-428, 590).

**Files:** `src/App.jsx:1349`, `src/index.css:416`, `src/index.css:426`, `src/index.css:428`, `src/index.css:590`, `src/index.css:591`

**Evidence:** [design/footer-1440.jpg](screenshots/design__footer-1440.jpg), [design/footer-390.jpg](screenshots/design__footer-390.jpg), [home/crop-footer-bottom.jpg](screenshots/home__crop-footer-bottom.jpg), [home/sec-1440-footer.jpg](screenshots/home__sec-1440-footer.jpg), [nav/footer-bottom-edge-1440.jpg](screenshots/nav__footer-bottom-edge-1440.jpg)

- [ ] Done

#### AW-145 · No hover feedback on clickable cards, text links or variant chips

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: desktop (pointer devices)

**Where:** Product cards (.card-link), department cards (.content-card), editorial cards, mega-menu feature, every .text-link, section-head links ('Shop novelties ↗'), PDP variant chips, .filter-signin

**Problem:** index.css has 37 :hover rules, but none for .card-link, .content-card, .editorial-card, .aw-menu-feature, .text-link, `.section-head > button`, `.variant-chips button`, .filter-signin, `.sku-details summary` or .aw-utility a. Measured on #/product/1: hovering the 'Diamond' chip leaves it at bg rgb(246,243,238) and border rgb(231,226,220), exactly as before. Hovering a 365px-tall product card or a 276px editorial panel changes nothing, so they don't read as clickable.

**Also seen:**
- #/ → product cards, department tiles, collection cards, section links, top-bar links — Hovered each element with page.hover and compared getComputedStyle before and after. No change to background, colour, shadow, transform or text decoration on: .card-link, .card-block, card h3, department tile buttons, .editorial-card.cream and .purple, .section-head > button, the trade-bar 'Apply for a trade account' link and the utility-row phone link. Only the cursor turns into a pointer. Only .card-add and the price-login button change on hove…

**Fix:** Add :hover and :focus-visible states (image scale or lift, border/shadow, underline on titles) to product cards, department tiles, editorial/collection cards, the mega-menu feature tile, section-head links, top-bar links, every .text-link, PDP variant chips and .filter-signin (index.css:172, 198-202, 224).

**Files:** `src/index.css:73`, `src/index.css:137`, `src/index.css:172`, `src/index.css:198`, `src/index.css:201`, `src/index.css:202`, `src/index.css:224`, `src/index.css:294`, `src/index.css:323`

**Evidence:** [design/home-cards-1440.jpg](screenshots/design__home-cards-1440.jpg), [design/home-editorials-1440.jpg](screenshots/design__home-editorials-1440.jpg), [home/hover-product-card.jpg](screenshots/home__hover-product-card.jpg), [home/hover-dept-tile.jpg](screenshots/home__hover-dept-tile.jpg), [home/hover-editorial-cream.jpg](screenshots/home__hover-editorial-cream.jpg)

- [ ] Done

#### AW-146 · Form controls use different heights, backgrounds, borders, radii and label sizes on every form, and the file inputs are unstyled native controls

**Medium** · consistency · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/quote form, sign-in/application dialogs, #/reset-password, #/category filter search + sort, #/delivery state select, account Quick Reorder, admin table

**Problem:** Measured controls: .form-grid input/select are 44px, bg #f8f6f2, border #dcd5cc, radius 2px, 14px. The reset form overrides the bg to #fff. .filter-search input is 44px, #fff, border #d8d1c9, radius 0. .category-sort select is 40px, #fff, #d8d1c9, radius 0, 12px. .eligibility-form select is 44px, #fff, #dcd5cc, radius 2px. The header search is 48px, #f8f6f2, radius 3px (on mobile the border becomes #b9aed0). Quick-reorder inputs are 40px, #fff, #d8d1c9, radius 0, 13px. Admin table inputs are 34px, 12px. Labels: form-grid 11px/1.2px tracking, eligibility 10px, qr 9px/1.3px, sort 11px/1.3px muted, doc-upload 11px. The two document-upload fields in the application dialog show the browser's grey native 'Choose File' button inside the branded field (apply-form-dialog-bottom-1440.png). Native search inputs show the browser's default cancel '×'.

**Fix:** Add shared field tokens and one control rule: `:root { --field-h: 44px; --field-bg: #fff; --field-border: #dcd5cc; --field-radius: 2px; }` and `.form-grid input, .form-grid select, .filter-search input, .category-sort select, .eligibility-form select, .qr-field input, .qr-choice select { height: var(--field-h); background: var(--field-bg); border: 1px solid var(--field-border); border-radius: var(--field-radius); font-size: var(--text-base); }` (compact 34px only inside .aw-table). Give every label the .form-grid label style (11px, 1.2px tracking, purple). Style the file button: `.doc-file::file-selector-button { margin-right: 12px; padding: 8px 14px; border: 1px solid var(--purple); background: #fff; color: var(--purple); font: 700 var(--text-sm) var(--body); border-radius: 2px; cursor: pointer; }`. Hide the native search cancel with `input[type=search]::-webkit-search-cancel-button { -webkit-appearance: none; }` and provide a styled clear button if one is needed.

**Files:** `src/components/DocumentUploads.jsx:65`, `src/index.css:270`, `src/index.css:289`, `src/index.css:381`, `src/index.css:403`, `src/index.css:444`, `src/index.css:445`, `src/index.css:673`, `src/index.css:674`, `src/index.css:722`, `src/index.css:800`

**Evidence:** [design/apply-form-dialog-bottom-1440.jpg](screenshots/design__apply-form-dialog-bottom-1440.jpg), [design/tobacco-viewport-1440.jpg](screenshots/design__tobacco-viewport-1440.jpg), [design/account-admin-css-mock-1280.jpg](screenshots/design__account-admin-css-mock-1280.jpg), [design/delivery-1440-light.jpg](screenshots/design__delivery-1440-light.jpg)

- [ ] Done

#### AW-147 · Form inputs are 12–14px on phones, which makes iOS Safari zoom the page when a field is focused

**Medium** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 390 mobile (all ≤850px)

**Where:** #/quote (all 11 fields), sign-in/application/reset dialogs, #/category filter drawer (search 14px, sort 12px), #/delivery state select

**Problem:** Measured at 390px with a mobile UA: quote-business, contact, email, phone, street, city, state, zip, delivery select, date and notes are all 14px. aw-email and aw-pass in the sign-in dialog are 14px. category-search is 14px and category-sort 12px. delivery-state is 14px. Only the header search is raised to 16px (index.css:538). iOS Safari auto-zooms into any focused field under 16px, which breaks the layout mid-form on the checkout and application flows.

**Also seen:**
- Auth modal forms and #/reset-password form on phones — Measured at 390px: computed font-size is 14px on every .form-grid input/select (#aw-su-name … #aw-su-volume, #aw-email, #aw-pass) and 12px on .doc-file. iOS Safari auto-zooms inputs under 16px on focus, which shifts the fixed dialog sideways. The viewport meta is 'width=device-width, initial-scale=1.0'.
- #/quote form inputs/select; #/account Quick Reorder SKU/Qty inputs — At 390px, getComputedStyle font-size was 14px for all 11 quote controls (quote-business … quote-notes). Quick Reorder inputs are 13px (index.css:381). The header search is already bumped to 16px on mobile (index.css ~line 538 '.aw-search input { font-size: 16px }'), but form fields are not.

**Fix:** Set font-size to at least 16px on all inputs, selects and textareas at phone widths (the quote form, auth dialogs, #/reset-password, file inputs, category filter search/sort, #/delivery select, Quick Reorder SKU/Qty), so iOS Safari doesn't zoom on focus (index.css:270, 381, 445, 538, 594, 800).

**Files:** `src/index.css:270`, `src/index.css:289`, `src/index.css:381`, `src/index.css:445`, `src/index.css:538`, `src/index.css:594`, `src/index.css:674`, `src/index.css:800`

**Evidence:** [design/quote-print.pdf](screenshots/design__quote-print.pdf), [cart/m390-quote-full.jpg](screenshots/cart__m390-quote-full.jpg)

- [ ] Done

#### AW-148 · No print stylesheet: printed pages are full of site chrome and a garbled ticker, split cards and strand headings, lose link destinations, and #/catalog prints cut-off lines and no SKUs

**Medium** · visual-design · Who: **Cursor** · Effort: M · New · Viewports: print (Letter)

**Where:** #/quote, #/product/* (Cmd/Ctrl+P)

**Problem:** Verified 2026-09-27 with qvdes-01-print.mjs. printRules=0; quote PDF = 3 pages (3 lines); product/1 PDF = 4 pages. Page renders: evidence/design-verify/quote-print-p1.png (header chrome and controls), quote-print-p2.png (empty inputs, disabled submit, start of the footer), quote-print-p3.png (rest of the footer and the FDA note, printed mid-grey). Letter is about 816 CSS px wide, which is under the 850px breakpoint, so the quote prints in the phone layout (Menu button plus full-width search).

**Also seen:**
- Print of #/terms, #/privacy, #/shipping, #/delivery, #/contact, #/apply, #/catalog, #/category/TOBACCO (extends the known #/quote and #/product finding) — This extends the known #/quote and #/product print finding to the other pages. page.pdf, Letter, 0.4in margins, Chrome's default 'Background graphics' OFF. Sheet counts: terms 3 (content ≈1.4 pages), privacy 3 (content fits on 1; page 3 holds only the footer link 'Bestsellers', the © row and the nicotine warning), shipping 3, delivery 4 (page 4 = 'Bestsellers' + legal), contact 4 (page 4 = only the 2-line FDA warning), apply 3, catalog 4, #/categ…
- Print of #/terms, #/contact, #/catalog, #/apply, #/privacy, #/delivery (portrait and landscape) — Per-page PDF text (Letter portrait, 0.4in margins) shows the following splits. - #/terms: page 1 ends with the H2 'Orders and delivery' and its body starts on page 2. In landscape, page 1 ends with 'Account approval', page 2 ends with 'Your login', and the policy side-nav box splits ('Contact & visit' alone at the top of page 2). - #/contact: page 1 ends with the VISIT card's eyebrow, and the address starts on page 2. - #/catalog: page 2 ends wit…
- Print of #/contact ('Get directions ↗', 'Delivery policy', 'Delivery & service area', 'Application checklist'), #/terms body ('See Delivery for how that works'), ContactStrip on #/terms, #/privacy, #/shipping, #/delivery, #/apply ('Email us', 'Contact & visit') — The #/contact 'Get directions ↗' is an <a> to a Google Maps directions URL, but prints as a button label with no URL. The ContactStrip 'Email us' is a mailto: link whose label hides the address. With backgrounds off its border also disappears, leaving grey 'Email us' text (print-delivery-nobg-contactstrip). Internal cross-references are <button>s with no href: 'Delivery' inside the Trade terms body (PolicyPage.jsx:77, data-nav="shipping"), 'Deliv…
- #/catalog → print (Ctrl/Cmd+P) → department pill rows and 'All N … SKUs' lists — page.pdf (Letter, 0.4in margins) of #/catalog gives 4 portrait pages. The print layout is 739px wide, so the ≤850px rules apply. `.sub-pills` becomes a nowrap horizontal scroller (`overflow-x: auto`, index.css:550), and paper cannot scroll, so lines past the right edge are sliced. Measured in print media: Tobacco loses 3 of 7 (Pouches & ZYN, Tubes & Filters, Wraps & Leafs), Novelties & Vapes 4 of 8 (Mushroom Products, Smoke Accessories, Vape Pods…

**Fix:** Add @media print rules. Hide the trade bar/ticker, header, nav, footer chrome, carousel controls, cart and stepper controls, and use black on white. Add break-inside: avoid on cards and callouts and break-after: avoid on headings. Print destinations for external, mailto and tel links (e.g. a[href^='http']::after, a[href^='mailto']::after { content: ' (' attr(href) ')' }). On #/catalog, make .sub-pills wrap instead of scrolling or clipping (index.css:550, 758), and force the SKU <details> lists open. Give #/quote and #/product/* a clean one-page summary. Cover the #/terms, #/privacy, #/shipping, #/delivery, #/contact, #/apply, #/catalog and #/category/* layouts.

**Files:** `src/App.jsx:293`, `src/App.jsx:300`, `src/App.jsx:445`, `src/App.jsx:1310`, `src/index.css:550`, `src/index.css:609`, `src/index.css:626`, `src/index.css:711`, `src/index.css:732`, `src/index.css:747`, `src/index.css:758`, `src/index.css:812`, `src/pages/support/CatalogIndexPage.jsx:39`, `src/pages/support/CatalogIndexPage.jsx:45`, `src/pages/support/ContactPage.jsx:37`, `src/pages/support/PolicyPage.jsx:77`, `src/pages/support/SupportShell.jsx:43`, `src/pages/support/SupportShell.jsx:51`, `src/pages/support/SupportShell.jsx:52`, `src/pages/support/SupportShell.jsx:60`

**Evidence:** [design/quote-print.pdf](screenshots/design__quote-print.pdf), [design/product-print.pdf](screenshots/design__product-print.pdf), [gap1-text-size-print/print-sheet-terms.jpg](screenshots/gap1-text-size-print__print-sheet-terms.jpg), [gap1-text-size-print/print-sheet-privacy.jpg](screenshots/gap1-text-size-print__print-sheet-privacy.jpg), [gap1-text-size-print/print-sheet-shipping.jpg](screenshots/gap1-text-size-print__print-sheet-shipping.jpg), [gap1-text-size-print/print-sheet-delivery.jpg](screenshots/gap1-text-size-print__print-sheet-delivery.jpg), [gap1-text-size-print/print-sheet-contact.jpg](screenshots/gap1-text-size-print__print-sheet-contact.jpg), [gap1-text-size-print/print-sheet-apply.jpg](screenshots/gap1-text-size-print__print-sheet-apply.jpg), [gap1-text-size-print/print-sheet-tobacco.jpg](screenshots/gap1-text-size-print__print-sheet-tobacco.jpg), [gap1-text-size-print/print-terms-nobg-header.jpg](screenshots/gap1-text-size-print__print-terms-nobg-header.jpg), [gap1-text-size-print/print-delivery-nobg-contactstrip.jpg](screenshots/gap1-text-size-print__print-delivery-nobg-contactstrip.jpg), [print/terms-landscape-p1.jpg](screenshots/print__terms-landscape-p1.jpg), [print/terms-landscape-p2.jpg](screenshots/print__terms-landscape-p2.jpg), [gap1-text-size-print/print-fixpreview-terms.jpg](screenshots/gap1-text-size-print__print-fixpreview-terms.jpg), [gap1-text-size-print/print-terms-orphan-heading.jpg](screenshots/gap1-text-size-print__print-terms-orphan-heading.jpg), [gap1-text-size-print/print-contact-visit-split.jpg](screenshots/gap1-text-size-print__print-contact-visit-split.jpg), [gap1-text-size-print/print-sheet-catalog.jpg](screenshots/gap1-text-size-print__print-sheet-catalog.jpg), [gap1-text-size-print/print-catalog-clipped-pills.jpg](screenshots/gap1-text-size-print__print-catalog-clipped-pills.jpg), [gap1-text-size-print/print-fixpreview-catalog.jpg](screenshots/gap1-text-size-print__print-fixpreview-catalog.jpg), [print/catalog-nobg.pdf](screenshots/print__catalog-nobg.pdf)

- [ ] Done

#### AW-149 · Account and admin dashboards use their own micro-typography and show raw lowercase database values, plus an internal 'Role' field, to customers

**Medium** · consistency · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/account (signed in) stat cards, order cards, Quick Reorder; #/admin tabs, tables, status selects

**Problem:** Verified with qvdes-04-mock.mjs (evidence/design-verify/account-admin-mock.png): stat label 9px uppercase, status pill 9px uppercase, th 9px uppercase, qr label 9px uppercase, mini-btn 10px uppercase 'REORDER', storefront .button 12px none, stat value capitalize ('Approved'), order-head select uppercase. Source: AdminPage.jsx:97 renders `{s} ({count})` from ORDER_STATES ('new','contacted','fulfilled','cancelled','all'); :115 `<option>{s}</option>`; :200-215 raw lowercase options; QuickReorder.jsx:104 (mini-btn quiet 'Remove'), :110 (.button submit), :127 (mini-btn primary 'Review cart').

**Also seen:**
- #/account (signed in) → stat cards — AccountPage.jsx:87-89 passes profile.status, profile.pricing_tier and profile.role straight to <Stat>. Only CSS capitalization is applied (index.css:348), so a suspended buyer sees 'Account status: Suspended' on #/account but 'On hold' on #/apply (ApplyPage.jsx:68). A pending buyer sees 'Pending' vs 'Pending approval'. Every customer sees a 'Role: Customer' card. Tier shows as 'Standard' / 'Silver' / 'Gold' with no discount meaning; the discounts…

**Fix:** Map status, tier and role values to readable labels (e.g. 'pending' → 'Pending approval', 'silver' → 'Silver tier'). Remove the internal Role stat from #/account for non-admins (AccountPage.jsx:87-89). Restyle the account stat cards, order cards and Quick Reorder, and the admin tabs, tables and selects, with the site's shared type scale and eyebrow, label and heading styles.

**Files:** `src/index.css:347`, `src/index.css:348`, `src/index.css:349`, `src/index.css:357`, `src/index.css:358`, `src/index.css:380`, `src/index.css:398`, `src/index.css:407`, `src/pages/account/AccountPage.jsx:86`, `src/pages/account/AccountPage.jsx:87`, `src/pages/account/AccountPage.jsx:88`, `src/pages/account/AccountPage.jsx:89`, `src/pages/account/AccountPage.jsx:115`, `src/pages/account/AccountPage.jsx:140`, `src/pages/account/AccountPage.jsx:164`, `src/pages/account/QuickReorder.jsx:104`, `src/pages/account/QuickReorder.jsx:127`, `src/pages/admin/AdminPage.jsx:42`, `src/pages/admin/AdminPage.jsx:83`, `src/pages/admin/AdminPage.jsx:97`, `src/pages/admin/AdminPage.jsx:115`, `src/pages/admin/AdminPage.jsx:179`, `src/pages/admin/AdminPage.jsx:200`, `src/pages/admin/AdminPage.jsx:207`, `src/pages/admin/AdminPage.jsx:214`, `src/pages/admin/AdminPage.jsx:279`, `src/pages/support/ApplyPage.jsx:68`

**Evidence:** [design/account-admin-css-mock-1280.jpg](screenshots/design__account-admin-css-mock-1280.jpg)

- [ ] Done

#### AW-291 · No enforced type scale: 26 font-size values, 7 section-heading sizes and 13 letter-spacing values

**Low** · code-quality · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** src/index.css (whole file), visible across support pages, dialogs and home

**Problem:** index.css defines only 6 text tokens and --h2, yet it contains 26 distinct px font-sizes: 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 25, 26, 27, 28, 30, 31, 32, 34, 36, 38, 42 and 120. Rendered Barlow h2 sizes are 25 (Filters), 26 (policy/info-card), 28 (Your details), 30 (support-block/reset), 31 (mega menu), 34 (contact-strip, support-cta, status-panel, eligibility, checklist-card, info-lead), 36 (--h2), 38 (editorial) and 42 (dialog). Several are near-duplicates (25/26/28, 30/31/32, 34/36/38). Uppercase-label tracking uses 1, 1.2, 1.3, 1.4, 1.6, 1.8, 2, 2.4 and 3px, while card titles use -0.2px and wordmarks -1.2/-2px. The account, admin and support sections (lines 345-413, 614-812) mostly bypass the tokens with literal 11/12/13/14px, e.g. 351, 355, 363, 367, 372, 376, 386, 395, 397, 401, 621, 623, 629, 640, 642, 650, 658, 663, 680, 687-701, 728, 735, 738, 743, 754 and 761. For reference, wireframes/skeleton/STYLE-GUIDE.md specifies one section-heading size of 35px (30px on mobile).

**Fix:** In :root (index.css:25-31) add `--h3: 26px; --h2-sm: 30px; --h2: 36px; --h2-lg: 42px; --track-label: 1.2px; --track-eyebrow: 2px;`. Then map the values: 25/26/28px headings (286, 628, 734, 340, drawer-head 459) → var(--h3); 30/31/32/34px (129, 639, 649, 657, 662, 670, 713, 721, 807, info-lead 631) → var(--h2-sm); 38px (230) and dept-head 36px (750) → var(--h2); dialog 42px (440) → var(--h2-lg). Replace literal 11/12/13/14px in lines 345-413 and 614-812 with var(--text-xs/sm/md/base). Replace uppercase tracking 1/1.3/1.4/1.6/1.8px with var(--track-label) and 2.4/3px with var(--track-eyebrow).

**Files:** `src/index.css:25`, `src/index.css:31`, `src/index.css:129`, `src/index.css:230`, `src/index.css:286`, `src/index.css:340`, `src/index.css:440`, `src/index.css:628`, `src/index.css:639`, `src/index.css:649`, `src/index.css:657`, `src/index.css:662`, `src/index.css:670`, `src/index.css:713`, `src/index.css:734`

**Evidence:** [design/delivery-1440-light.jpg](screenshots/design__delivery-1440-light.jpg), [design/contact-1440-light.jpg](screenshots/design__contact-1440-light.jpg)

- [ ] Done

#### AW-292 · Color tokens are bypassed by about 35 ad-hoc hex values, including near-duplicate greys, purples and oranges

**Low** · code-quality · Who: **Cursor** · Effort: M · New

**Where:** src/index.css throughout; tailwind.config.js

**Problem:** index.css contains 47 distinct hex colors against 11 tokens. There are near-duplicates of --muted #6b6670: #655d68 (block-label 187/188), #5f5862 (mega-menu links 135, dialog .desc 442), #726b76 (search placeholder 92) and #8a8390 (qr placeholder 383; about 3.7:1 on white). Purple hover exists as both #38206a (111, 272, 278, 541) and #3a2270 (footer rule 426). The header 'Sign Up' hovers to #a93208 (104) while .button hovers to --orange-dark #b8390a (167). Off-whites: #f8f6f2 (89, 445, 800), #faf8f5 (143), #f8f4ee (153), #eee8e0 (93), #e1d8cb (94). Borders: #dcd5cc, #d8d1c9 (270, 289, 381, 403), #e5ddd4 (126), #f0ece7, #b9aed0 (537), #cfc5db (123). Lavenders on purple: #e9e2f5, #cbb8ec, #b4a1d9, #a993d1, #d5cce1. The success green #1f7a47 (349, 360) has no token. tailwind.config.js adds a third, unused palette (brand orange #DB6433, #B84F23, navy #1E1B5C) plus Inter and IBM Plex Mono fonts that nothing uses.

**Fix:** Add to :root (index.css:9-40): `--purple-hover: #38206a; --surface-soft: #f8f6f2; --line-soft: #f0ece7; --on-dark: #e9e2f5; --on-dark-muted: #cbb8ec; --on-dark-subtle: #b4a1d9; --success: #1f7a47;`. Leave the form-field tokens (--field-bg, --field-border) to the AW-146 fix and do not define them here. Replace #38206a (111, 272, 278, 541) and #3a2270 (426) with var(--purple-hover). Replace #a93208 (104) with var(--orange-dark). Replace #655d68 (187, 188), #5f5862 (135, 442), #726b76 (92) and #8a8390 (383) with var(--muted). Replace #e5ddd4 (126) with var(--line). Replace #faf8f5 (143) and #f8f4ee (153) with var(--paper). Use var(--surface-soft) for the header search background (89). Replace #f0ece7 with var(--line-soft), #e9e2f5 with var(--on-dark), #cbb8ec with var(--on-dark-muted), and #b4a1d9/#a993d1/#d5cce1 with var(--on-dark-subtle). Replace #1f7a47 (349, 360) with var(--success). Delete the `theme.extend` block (fontFamily and colors) from tailwind.config.js:4-20 and leave `theme: {}`.

**Files:** `src/index.css:9`, `src/index.css:92`, `src/index.css:93`, `src/index.css:104`, `src/index.css:111`, `src/index.css:135`, `src/index.css:143`, `src/index.css:187`, `src/index.css:228`, `src/index.css:270`, `src/index.css:349`, `src/index.css:383`, `src/index.css:419`, `src/index.css:426`, `src/index.css:442`, `src/index.css:767`, `tailwind.config.js:5`

**Evidence:** [design/footer-1440.jpg](screenshots/design__footer-1440.jpg), [design/mega-menu-1440.jpg](screenshots/design__mega-menu-1440.jpg)

- [ ] Done

#### AW-293 · Icon glyphs (↗ ⊞ ⌄ → × −/+) render from random system fallback fonts, and three icon systems are mixed

**Low** · consistency · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Header (⊞ Categories ⌄, Sign Up ↗, Exotics ↗), mega menu (All X →), every .button CTA, section-head links, editorial cards, checklist ✓

**Problem:** CDP getPlatformFontsForNode on #/ at 1440: .aw-signup span '↗' → PingFang SC (PingFangSC-Semibold). .grid-symbol '⊞' → Apple Symbols. .aw-chevron '⌄' → Menlo-Bold. Mega-menu 'All Tobacco →' arrow → Lucida Grande-Bold. None of these come from the bundled DM Sans or Barlow, so weight and baseline will differ on Windows and Android. src contains 46 '↗' glyphs. The mega menu uses '→' (App.jsx:536) while everything else uses '↗'. Other icons are CSS-drawn: the search ring (index.css:95-96), filter (273-274) and hamburger (529-530); .checklist uses a '✓' content glyph (692). The approved 2A skeleton also uses the text glyph ↗ as its CTA arrow, so the arrow should stay but be drawn consistently.

**Also seen:**
- #/ → header Categories toggle and nav icons — The Categories toggle uses the characters '⊞' and '⌄' (App.jsx:521), styled with odd font-size/line-height (index.css:112-113). The ⌄ glyph draws visibly below the 'Categories' text baseline. Help '?', close '×' and '↗' also depend on how each OS font renders them.
- Header → Categories toggle (.aw-chevron) — The chevron is the text glyph '⌄' at 18px with line-height 10px. Its box is centred, but the glyph's ink sits low in the box. In 3× captures the closed chevron is about 5px below the 'Categories' text midline. Rotated 180° when open, it rides about 4px above the midline, so it jumps vertically on every toggle.

**Fix:** Replace the Unicode glyph icons (⊞ ⌄ ↗ → × − + ✓) with one inline SVG icon set, sized and vertically centred with the text. That also fixes the Categories chevron sitting below the label and jumping when the menu opens (App.jsx:521, 556; index.css:112-114).

**Files:** `src/App.jsx:297`, `src/App.jsx:495`, `src/App.jsx:521`, `src/App.jsx:536`, `src/App.jsx:540`, `src/App.jsx:552`, `src/App.jsx:556`, `src/App.jsx:713`, `src/App.jsx:724`, `src/App.jsx:1123`, `src/components/AuthModal.jsx:201`, `src/components/AuthModal.jsx:275`, `src/components/AuthModal.jsx:295`, `src/index.css:95`, `src/index.css:112`, `src/index.css:113`, `src/index.css:114`, `src/index.css:692`, `src/pages/support/ContactPage.jsx:37`

**Evidence:** [design/home-header-1440.jpg](screenshots/design__home-header-1440.jpg), [design/mega-menu-1440.jpg](screenshots/design__mega-menu-1440.jpg), [design/signin-dialog-1440.jpg](screenshots/design__signin-dialog-1440.jpg), [home/crop-nav-row-2x.jpg](screenshots/home__crop-nav-row-2x.jpg), [nav/zoom-categories-closed.jpg](screenshots/nav__zoom-categories-closed.jpg), [nav/zoom-categories-open.jpg](screenshots/nav__zoom-categories-open.jpg)

- [ ] Done

#### AW-294 · Section heading color switches between ink and purple for the same component

**Low** · consistency · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/ ('New arrivals', 'Bestsellers', 'Shop by department'), #/product/* ('More cigars & cigarillos'), #/account sections vs catalog/support/dialog headings

**Problem:** qvdes-02-measure.mjs output: HOME section-head h2 = rgb(36,32,44) ×3; apply-intro h2 = rgb(40,20,89); service h3 = ink; apply-steps h3 = purple; PDP section-head h2 = ink; CATALOG dept h2 = purple; APPLY support h2 = purple.

**Fix:** Pick one rule and delete the per-context overrides. Recommended: `h1, h2 { color: var(--purple); }` at index.css:162, with an explicit `.editorial-card.purple h2, .contact-strip h2, .age-gate h1 { color: #fff; }` on dark surfaces. Then remove the redundant `color: var(--purple)` from lines 244, 255, 299, 314, 440, 459, 620 and similar. Use ink only for h3 card titles (.content-card h3, .service h3) and set .apply-steps h3 to ink as well.

**Files:** `src/index.css:162`, `src/index.css:164`, `src/index.css:239`, `src/index.css:244`, `src/index.css:249`, `src/index.css:620`

**Evidence:** [design/home-1440-light.jpg](screenshots/design__home-1440-light.jpg), [design/catalog-1440-light.jpg](screenshots/design__catalog-1440-light.jpg)

- [ ] Done

#### AW-295 · Seven different callout/notice styles, and errors share the decorative accent orange

**Low** · consistency · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/account notice, Quick Reorder summary, order-foot, #/apply support-alert, category filter-signin, status-panel, PDP pd-unit; all .form-error messages

**Problem:** The styles are: .notice (cream, solid 1px --orange border, index.css:351); .support-alert (cream, dashed --orange border, 623); .qr-summary (cream, solid --orange, 394); .order-foot (cream, top rule only, 371); .filter-signin (cream, dashed --orange-dark, 294); .status-panel (paper, 6px left border, 660); .pd-unit (paper, 3px left border, 317). There are no semantic tokens. Validation errors (.form-error, 451; e.g. 'Choose a variant for every product that has more than one.') use --orange-dark #b8390a, the same color as every eyebrow, kicker and card-kicker, so an error looks like a section label. Success uses a one-off #1f7a47.

**Fix:** Add `--danger: #b42318; --danger-bg: #fdecea; --success: #1f7a47; --success-bg: #e8f5ee;` and a single `.callout` component: `padding: 14px 16px; border-left: 4px solid var(--orange); background: var(--cream); font-size: var(--text-md);` with modifiers `.callout.info` (purple border, paper bg), `.callout.success` and `.callout.error`. Map .notice, .support-alert, .qr-summary, .order-foot and .pd-unit to .callout variants. Change .form-error to `color: var(--danger)` with an error icon prefix.

**Files:** `src/index.css:294`, `src/index.css:317`, `src/index.css:351`, `src/index.css:371`, `src/index.css:394`, `src/index.css:451`, `src/index.css:623`, `src/index.css:660`

**Evidence:** [design/account-admin-css-mock-1280.jpg](screenshots/design__account-admin-css-mock-1280.jpg), [design/quote-print.pdf](screenshots/design__quote-print.pdf)

- [ ] Done

#### AW-296 · Numbered markers use five styles and three different oranges

**Low** · consistency · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/ services '01/02/03' and apply steps '1/2/3'; #/delivery info cards '01 · ROUTE DELIVERY' and next-steps '1/2/3'; #/apply checklist '01 · Federal EIN' plus ✓; mega menu '01 Tobacco'; mobile menu; #/catalog dept-jump

**Problem:** qvdes-02-measure.mjs: .service > span 27px rgb(184,57,10); .apply-steps li::before counter(apply) 32px rgb(184,57,10); .next-steps li::before 26px rgb(237,90,33); .aw-department h3 > span 17px rgb(200,71,22); .dept-jump span 15px rgb(184,57,10); .menu-index 14px var(--button-orange) per index.css:489. Checklist labels: '01 · Federal EIN' … '05 · Account contact' with ✓ ::before (evidence/design-verify/apply-checklist-card.png).

**Fix:** Define one marker style, `.num { font: 700 28px/1 var(--display); color: var(--orange-dark); }`, with zero-padded numbers everywhere ('01'). Apply it to .service span, .apply-steps li::before and .next-steps li::before (change 686 from var(--orange) to var(--orange-dark)). Use var(--orange-dark) for the menu indices too. On #/apply drop the '01 · ' prefix (ApplyPage.jsx:34) or drop the ✓ box, not both.

**Files:** `src/index.css:134`, `src/index.css:238`, `src/index.css:248`, `src/index.css:489`, `src/index.css:686`, `src/index.css:744`, `src/pages/support/ApplyPage.jsx:34`, `src/pages/support/DeliveryPage.jsx:28`, `src/pages/support/DeliveryPage.jsx:33`, `src/pages/support/DeliveryPage.jsx:39`

**Evidence:** [design/home-services-1440.jpg](screenshots/design__home-services-1440.jpg), [design/home-apply-1440.jpg](screenshots/design__home-apply-1440.jpg), [design/apply-1440-light.jpg](screenshots/design__apply-1440-light.jpg)

- [ ] Done

#### AW-297 · Link styles vary in color, weight, underline offset and presence

**Low** · consistency · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Global: .text-link, section-head links, footer, utility bar, dialogs, policy body, card 'LOCKED · Sign in for pricing'

**Problem:** Text links appear in these forms: .text-link 12px/600 purple, underline offset 4px; section-head links ('Shop novelties ↗') 12px/600 ink, offset 4px; .aw-utility phone 11px muted, offset 2px; footer department/account links 13px lavender with no underline, while footer phone/email links are underlined (offset 2px); .footer-policies 10px #a993d1, offset 3px; .policy-body links 600 purple, offset 3px; .doc-uploads-note links 700 purple; support/checklist links offset 3px. Across the file there are 3 underline offsets (2px ×4, 3px ×14, 4px ×5). The product-card price prompt 'LOCKED · Sign in for pricing' (App.jsx:829) is a button styled as plain 11px muted text with no underline, so it doesn't look clickable.

**Fix:** Add link tokens `--link-color: var(--purple); --link-offset: 3px;` and one rule: `.text-link, .support-note a, .checklist a, .next-steps a, .policy-body a, .contact-grid a, .doc-uploads-note a { color: var(--link-color); font-weight: 600; text-decoration: underline; text-underline-offset: var(--link-offset); }`. Set `.section-head > button { color: var(--purple); }`. Underline footer department links too (or remove the underline from footer phone/email so the column is consistent). Change the card prompt to sentence case 'Sign in for pricing' with `text-decoration: underline`.

**Files:** `src/App.jsx:829`, `src/index.css:84`, `src/index.css:172`, `src/index.css:198`, `src/index.css:212`, `src/index.css:213`, `src/index.css:420`, `src/index.css:422`, `src/index.css:622`, `src/index.css:739`, `src/index.css:767`, `src/index.css:796`

**Evidence:** [design/footer-1440.jpg](screenshots/design__footer-1440.jpg), [design/home-cards-1440.jpg](screenshots/design__home-cards-1440.jpg)

- [ ] Done

#### AW-298 · Disabled buttons still darken on hover, disabled opacity varies, and no :active pressed state exists

**Low** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: desktop

**Where:** #/product/* 'Add to quote' (disabled until a variant is chosen), #/quote submit, account mini buttons, document uploads

**Problem:** qvdes-02-measure.mjs: before {bg: rgb(200,71,22), opacity 0.55, cursor not-allowed} → hover {bg: rgb(184,57,10)}. Screenshot: evidence/design-verify/pdp-disabled-hover.png.

**Fix:** Change `.button:hover` (167) to `.button:not(:disabled):hover`, and `.button.ghost:hover` (169) to `.button.ghost:not(:disabled):hover`. Add `--disabled-opacity: .5` and use it on 171, 370 and 801. Add `.button:not(:disabled):active, .card-add:active, .qty-stepper button:active, .card-stepper button:active { transform: translateY(1px); filter: brightness(.95); }`.

**Files:** `src/index.css:167`, `src/index.css:171`, `src/index.css:370`, `src/index.css:801`

**Evidence:** [design/pdp-info-disabled-hover-1440.jpg](screenshots/design__pdp-info-disabled-hover-1440.jpg)

- [ ] Done

#### AW-299 · Empty states are inconsistent; the empty cart drawer has no CTA and still shows totals

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Cart drawer (empty), #/quote (empty), #/account order history (empty), #/category no-results

**Problem:** qvdes-03-states.mjs, drawer: text 'Your order × Your cart is empty. Browse the catalog… Estimated total Sign in for pricing The minimum order…', buttons ['Close cart'] (evidence/design-verify/cart-drawer-empty.png). Quote empty: h1 74.88px, crumbs:false, 'Browse catalog ↗' (evidence/design-verify/quote-empty.png).

**Also seen:**
- Cart drawer with 0 items — The empty drawer shows two centered lines ('Your cart is empty. Browse the catalog and add items…') and no button. The footer still renders 'Estimated total / Sign in for pricing' and the $500/$1,500 fine print for an empty cart.
- #/category/<DEPT> → '.empty-results' (e.g. search 'zzzz' or an empty tag filter) — Measured gap between the 'No products match' H2 and the paragraph: 0px; paragraph to 'Clear filters' button: 0px (preflight zeroes p margins and h2 has margin-bottom:0). The three elements sit on top of each other. The box doesn't offer 'Search all departments for “zzzz”' or links to other departments.

**Fix:** Create one empty-state component (icon, message, primary CTA, spacing) for the empty cart drawer (with 'Browse the catalog' and no 'Estimated total' row), the empty #/quote, empty order history and category no-results. The no-results state also offers a catalog-wide search and links to other departments, not just 'Clear all' (App.jsx:346, 1031, 1382, 1396, 1421-1436; index.css:298-299).

**Files:** `src/App.jsx:346`, `src/App.jsx:1031`, `src/App.jsx:1206`, `src/App.jsx:1208`, `src/App.jsx:1382`, `src/App.jsx:1396`, `src/App.jsx:1421`, `src/App.jsx:1421-1427`, `src/App.jsx:1436`, `src/index.css:298`, `src/index.css:299`, `src/index.css:300`, `src/index.css:480`, `src/pages/account/AccountPage.jsx:117`

**Evidence:** [design/cart-drawer-empty-1440.jpg](screenshots/design__cart-drawer-empty-1440.jpg), [design/quote-empty-1440.jpg](screenshots/design__quote-empty-1440.jpg), [design/category-empty-results-1440.jpg](screenshots/design__category-empty-results-1440.jpg), [cart/drawer-empty-1440.jpg](screenshots/cart__drawer-empty-1440.jpg), [catalog/tobacco-empty-search-1440.jpg](screenshots/catalog__tobacco-empty-search-1440.jpg), [catalog/grocery-390-empty-state.jpg](screenshots/catalog__grocery-390-empty-state.jpg)

- [ ] Done

#### AW-300 · About 70px of dead space between the nav and the breadcrumb on every inner page

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 1440 (similar on mobile)

**Where:** #/catalog, #/category/*, #/product/*, #/quote, #/contact, #/delivery, #/apply, policies

**Problem:** At 1440 on all inner routes tested: navBottom 253, .page-head top 277 (padding 34px 0 8px), crumb button 36px tall, crumb text top 321.75 (69px gap), H1 top 396. On home, .home-carousel top is 277 (24px below the nav). At 390 (mobile) on #/category/TOBACCO and #/contact: header bottom 204, crumb text 236.75 (33px gap, acceptable). Screenshot: screenshots/vdesB__tobacco-top-1440.jpg

**Fix:** In index.css:253 change `.page-head { padding: 34px 0 8px; }` to `.page-head { padding: 8px 0 8px; }`. Leave the ≤850px override at index.css:549 (`padding-top: 22px`) as it is, because mobile already has a 33px gap. The result is 24px nav margin + 8px padding + about 11px crumb centering, so the breadcrumb text sits about 43px below the nav on desktop. Keep the 36px crumb tap height and the 18px `.crumbs` bottom margin.

**Files:** `src/index.css:109`, `src/index.css:253`

**Evidence:** [design/tobacco-viewport-1440.jpg](screenshots/design__tobacco-viewport-1440.jpg)

- [ ] Done

#### AW-301 · Inline style objects in App.jsx bypass the stylesheet

**Low** · code-quality · Who: **Cursor** · Effort: M · New

**Where:** #/quote empty and submitted states, mega menu 'All X →' links, footer brand paragraph, root wrapper, product page head

**Problem:** App.jsx has 11 `style={{…}}` objects. They include the root `{ minHeight: '100vh', background: '#fff' }` (292), the mega-menu `{ fontWeight: 700, color: 'var(--purple)' }` (536), `{ paddingBottom: 0 }` (1082), the quote empty and submitted states `{ textAlign: 'center', padding: '60px 0' }`, `{ margin: '0 auto 20px' }`, `{ color: 'var(--purple)' }`, `{ fontSize: 13 }` and `{ justifyContent: 'center' }` (1208-1225), and the footer `{ marginTop: 16 }` (1315). Because these can't be themed or overridden by media queries, the page-head padding rules for the quote empty and submitted pages are ignored on mobile.

**Also seen:**
- App root, mega menu 'All …' links, product page head, quote empty/submitted states, footer — App.jsx:292 sets `minHeight:'100vh', background:'#fff'`. The only literal colour is that #fff, and it is redundant because body already has background:#fff (index.css:47). App.jsx:1224 sets `fontSize: 13`, which equals var(--text-md) (index.css:28); .result-note uses var(--text-sm) (index.css:265). A visible side effect, measured at 1440px with the mega menu open: the inline `color: var(--purple)` on 'All Tobacco →' (App.jsx:536) beats `.aw-depar…

**Fix:** Move the inline style objects and hard-coded colours in App.jsx (root wrapper, mega-menu 'All …' links, product page head, quote empty/submitted states, footer brand paragraph) into index.css classes that use the colour tokens (App.jsx:292, 536, 1082).

**Files:** `src/App.jsx:292`, `src/App.jsx:536`, `src/App.jsx:1082`, `src/App.jsx:1208`, `src/App.jsx:1210`, `src/App.jsx:1218`, `src/App.jsx:1221`, `src/App.jsx:1222`, `src/App.jsx:1224`, `src/App.jsx:1225`, `src/App.jsx:1315`, `src/index.css:136`

- [ ] Done

## Mobile & tablet layout

#### AW-036 · Hero carousel images overflow the stage and cover the controls and the next section

**High** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 360x740, 390x844, 430x932, 600–850 wide, 768x1024, 844x390, 1024x768 (slides 2 and 4)

**Where:** #/ → HeroCarousel (.home-carousel-stage / .home-carousel-slide img)

**Problem:** Re-measured the active slide <img> against .home-carousel-stage on each of the 4 slides. The stage has overflow:visible, and max-height:100% does not resolve. Overflow past the stage bottom (candy / vape / lighters / gatorade): 360x740 (stage 220): -4 / +106 / +4 / +136px. 390x844: +4 / +136 / +25 / +169. 430x932: +29 / +176 / +52 / +212. 600x900: +137 / +346 / +169 / +398. 768x1024 and 844x390 (stage 320): +121 / +180 / +161 / +180. 1024x768 and 1280x800 (stage 480): -10 / +20 / +1 / +20. At 768 the Turtles box covers Previous/Play/Next and the 'FRESH INVENTORY / 01' eyebrow. At 390 the Gatorade bottles cover the controls, and the vape slide runs over the 'New arrivals' heading at y≈483-561. Screenshots: screenshots/vresp__carousel-768x1024-slide1.jpg, .../vresp/carousel-390x844-slide4.png, .../vresp/carousel-1024x768-slide4.png. I injected the proposed rules (stage overflow:hidden; img absolute inset:0 margin:auto max-width/max-height 100%; stage heights min(52vw,380px) at ≤850 and min(72vw,300px)/min-height 220px at ≤600): every slide fits inside the stage at 390, 600, 768 and 1280.

**Also seen:**
- #/ → hero carousel slides 2, 3 and 4 — Stage y=278–758 at 1440x900. Active img bottoms per slide: 748 / 778 / 759 / 778, i.e. overflow −10 / +20 / +1 / +20 px. getComputedStyle(.home-carousel-slide).gridTemplateRows = '0px 500px', because the <source> inside the display:contents <picture> is a grid item. In-page CSS tests: grid-template minmax(0,1fr) had no effect; img width/height 100% blew the images up to 1278x1278; display:flex with centring gave 480px-tall images and no overflow …
- #/ → .home-carousel (hero slides 1–4) — `.home-carousel-slide img { max-height:100% }` has no effect, because the slide is a grid with an auto-height row and the picture uses display:contents. Photos therefore render at their full size inside a fixed-height stage that has no overflow:hidden. How far each slide's image runs past the stage bottom: - 768px (stage 320px tall): 121, 180, 161 and 180px. The Turtles box covers the Previous/Pause/Next bar and the 'FRESH INVENTORY / 01' eyebrow…
- #/ → hero carousel (.home-carousel-stage / .home-carousel-slide img) — At 390px the stage is 220px tall, but the slide images paint at their intrinsic aspect: hero_candy 224px, hero_lighters 245px, hero_vape 356px, hero_gatorade 389px tall. They extend up to 169px below the stage. At 768px the stage is 320px and Gatorade paints 500px (180px overflow). At 1440 the stage is 480px while hero_vape and hero_gatorade paint 500px. Both the stage and the slides have computed overflow: visible, and the slides are absolutely …

**Fix:** Give .home-carousel-stage a fixed aspect-ratio with overflow:hidden. Make .home-carousel-slide img use width:100%; height:100%; object-fit:contain/cover inside the stage. Remove the absolute sizing that lets slides 2-4 spill over the control bar and the 'New arrivals' heading at every width, especially below 1024px (index.css:178-182, 543).

**Files:** `src/App.jsx:661`, `src/App.jsx:664-687`, `src/App.jsx:679`, `src/index.css:178`, `src/index.css:178-182`, `src/index.css:179`, `src/index.css:181`, `src/index.css:182`, `src/index.css:192`, `src/index.css:543`, `src/index.css:566`

**Evidence:** [responsive/home-768x1024-carousel-slide1-overflow.jpg](screenshots/responsive__home-768x1024-carousel-slide1-overflow.jpg), [responsive/home-390x844-carousel-slide4-overflow.jpg](screenshots/responsive__home-390x844-carousel-slide4-overflow.jpg), [responsive/home-600x900-carousel-slide4-overflow.jpg](screenshots/responsive__home-600x900-carousel-slide4-overflow.jpg), [responsive/home-390-carousel-controls-hidden.jpg](screenshots/responsive__home-390-carousel-controls-hidden.jpg), [responsive/home-1024x768-carousel-slide4-overflow.jpg](screenshots/responsive__home-1024x768-carousel-slide4-overflow.jpg), [home/hero-1440-slide2.jpg](screenshots/home__hero-1440-slide2.jpg), [home/hero-1440-slide4.jpg](screenshots/home__hero-1440-slide4.jpg), [home/hero-1440-slide3.jpg](screenshots/home__hero-1440-slide3.jpg), [photos2/hero-slide1-768-overflows-into-new-arrivals.jpg](screenshots/photos2__hero-slide1-768-overflows-into-new-arrivals.jpg), [photos2/hero-slide2-390-covers-controls.jpg](screenshots/photos2__hero-slide2-390-covers-controls.jpg), [photos2/hero-slide4-390-overflow.jpg](screenshots/photos2__hero-slide4-390-overflow.jpg), [photos2/hero-slide4-1440.jpg](screenshots/photos2__hero-slide4-1440.jpg), [photos2/fix2-hero768.jpg](screenshots/photos2__fix2-hero768.jpg), [seo/home-390-carousel-slide4-overflow.jpg](screenshots/seo__home-390-carousel-slide4-overflow.jpg)

- [ ] Done

#### AW-150 · On tablets and landscape phones the product page shows a full-width square photo, pushing the name, price and 'Add to quote' several screens down

**Medium** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 768x1024, 844x390, 601–850 wide; partly 1024x768

**Where:** #/product/<id> → .pd-grid / .pd-media

**Problem:** At ≤850px, .pd-grid switches to one column and .pd-media keeps aspect-ratio 1.05, so the photo box takes the full container width. Measured for products 162 (Snickers), 12 (LooseLeaf) and 306 (no photo, 'SM' initials). At 844x390 the photo box is 812x773px (almost 2 viewport heights), the h1 sits at y=1119 and 'Add to quote' at y=1520-1590, which is 3.7-4.2 screens down. At 768x1024 the box is 736x701px and the h1 is at y=1047, so the product name is not on the first screen; the add button is at 1.35-1.53 screens. For the photo-less product the 773px box contains only two initials. At 1024x768 (two columns) the add button is still below the fold (y=827-986) because the SKU/delivery paragraph and two notes sit above the price. For comparison, at 390x844 the add button is at 1.34-1.64 screens.

**Also seen:**
- #/product/<id> at ≤850px → .pd-grid single column — Measured top of the Add button: at 390x844 it is between 1006 and 1381px, e.g. #/product/162 1208, #/product/17 1381, #/product/62 1372. At 768x1000 #/product/12 it is at 1518px, because the photo alone is 736px wide in a single column (the breakpoint collapses .pd-grid at 850px, index.css:548). At 1440x900, multi-variant products put it at 842–967px, partly or fully below the fold. Before the price, the user scrolls past the breadcrumb, a full-w…

**Fix:** On tablets and phones (≤850px), cap the PDP image height (for example max-height: 45vh with aspect-ratio 4/3), or place the name, price and Add to quote above/beside the photo, so the purchase controls appear within the first screen (index.css:310-312, 548).

**Files:** `src/App.jsx:1089`, `src/App.jsx:1094`, `src/App.jsx:1099`, `src/App.jsx:1107`, `src/index.css:310`, `src/index.css:311`, `src/index.css:312`, `src/index.css:548`, `src/index.css:595`

**Evidence:** [responsive/product-844x390-fullpage.jpg](screenshots/responsive__product-844x390-fullpage.jpg), [responsive/first-screen-844x390_product_162.jpg](screenshots/responsive__first-screen-844x390_product_162.jpg), [responsive/first-screen-768x1024_product_162.jpg](screenshots/responsive__first-screen-768x1024_product_162.jpg), [product/m-162-first-screen.jpg](screenshots/product__m-162-first-screen.jpg), [product/tablet-768-p12.jpg](screenshots/product__tablet-768-p12.jpg), [product/p162-snickers-390-full.jpg](screenshots/product__p162-snickers-390-full.jpg)

- [ ] Done

#### AW-151 · Large phones in landscape (851–932px wide) get the full desktop header, filter sidebar and mega menu

**Medium** · layout-responsive · Who: **Cursor** · Effort: M · New · Viewports: 932x430 (any landscape phone wider than 850px)

**Where:** All routes → header / category layout, at 926–932 x 428–430 (e.g. iPhone Plus/Pro Max landscape)

**Problem:** The mobile layout depends only on width: MOBILE_QUERY is '(max-width: 850px)' and the CSS blocks are @media(max-width:850px). At 932x430 the page therefore uses the desktop chrome: trade-bar 34 + trade-only 30 + utility row 29 + masthead 106 + category nav 55 = a 253px header, which is 59% of the 430px screen. The first product card on #/category/CANDIES starts at y=652 (152% of the viewport). The category 'Filters' sidebar and the 3-column grid replace the drawer. The mega menu opens at y=253 with a 190px-tall inner scroll window for 702px of content, and its bottom (y=447) is below the viewport. The product page uses 2 columns there, but the Add button is at y=842 (about 2 screens).

**Fix:** Treat short touch screens as 'mobile'. In src/App.jsx:78 set `const MOBILE_QUERY = '(max-width: 850px), (hover: none) and (pointer: coarse) and (max-height: 500px)';`. In src/index.css change the two `@media(max-width:850px)` blocks (lines 522 and 770) to `@media (max-width: 850px), (hover: none) and (pointer: coarse) and (max-height: 500px)`. Update SIZES in src/lib/images.js:80-84 if needed. Afterwards, check 932x430 and 926x428: expect the compact header (menu/logo/sign in/cart + search), the Filter & Sort drawer and the menu drawer instead of the mega menu.

**Files:** `src/App.jsx:78`, `src/index.css:522`, `src/index.css:770`, `src/lib/images.js:80`

**Evidence:** [responsive/category-932x430-landscape-desktop-header.jpg](screenshots/responsive__category-932x430-landscape-desktop-header.jpg), [responsive/mega-menu-932x430-landscape.jpg](screenshots/responsive__mega-menu-932x430-landscape.jpg)

- [ ] Done

#### AW-152 · In landscape the cart drawer leaves a 90px strip for the item list because the footer takes 58% of its height

**Medium** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 844x390 (all landscape phones); partly 360x740

**Where:** Any route → Cart button → CartDrawer (.drawer-body / .drawer-foot)

**Problem:** Cart with 5 lines (ids 162, 306, 1, 12, 98). At 844x390: .drawer-head 73px, .drawer-foot 227px (Estimated total, Request quote, 'Sign in for account pricing', and a 61px, 3-line fine-print paragraph), .drawer-body 90px of a 577px scrollHeight; each line item is 109-115px tall, so less than one item is visible. At 932x430 the body is 130px. At 360x740 the foot is 248px (33% of the screen) and the body 423px; at 390x844 the body is 548px. Screenshot: screenshots/vresp__cart-drawer-844x390.jpg

**Fix:** In src/App.jsx move `<p className="fine drawer-fine">…</p>` (line 1436) out of `.drawer-foot` and render it as the last child of `.drawer-body` (after the `</ul>` at line 1418), so it scrolls with the list. In src/index.css add `@media (max-height: 500px) { .drawer-head { padding-block: 8px; } .drawer-head h2 { font-size: 22px; } .drawer-foot { padding-block: 10px; } .drawer-total { margin-bottom: 6px; } .drawer-signin { margin-top: 2px; min-height: 32px; } }`. Target: at 844x390, .drawer-body clientHeight is at least 50% of the drawer (≥ 195px).

**Files:** `src/App.jsx:1421`, `src/App.jsx:1436`, `src/index.css:458`, `src/index.css:461`, `src/index.css:476`, `src/index.css:479`

**Evidence:** [responsive/cart-drawer-844x390.jpg](screenshots/responsive__cart-drawer-844x390.jpg), [responsive/cart-drawer-360x740.jpg](screenshots/responsive__cart-drawer-360x740.jpg)

- [ ] Done

#### AW-153 · Header stack (trade bar + notice bar + utility row + masthead + nav) takes 253px and pushes content below the fold

**Medium** · layout-responsive · Who: **Cursor** · Effort: L · Partly fixed since the 2026-09-25 audit · Viewports: 360x740, 390x844, 844x390, 1024x768

**Where:** All routes → .trade-bar, .trade-only, .aw-header; #/category/* page head

**Problem:** Header bottom as a share of viewport height: 360x740 200px (27%), 390x844 204px (24%), 430x932 204px (22%), 768x1024 186px (18%), 844x390 186px (48%), 1024x768 253px (33%). On phones the 'WHOLESALE TO LICENSED RETAIL BUSINESSES ONLY · NO CONSUMER SALES · 21+' bar wraps to 2 lines (46px) under the 36px trade-bar, which already carries 'Apply' and 'Call'. At 1024x768 there are five stacked rows: trade-bar 34, trade-only 30, utility 29, masthead 106, nav 55, then a 58px gap before the breadcrumb. First product card on #/category/CANDIES: y=578 of 740 (78%) at 360, y=582 of 844 (69%) at 390, y=656 of 768 (85%) at 1024, y=556 of 390 (not visible) at 844x390. In landscape the masthead still wraps search onto its own row although there is room for it inline. The compact header and filter drawer from the prior audit are in place; the bars and page-head spacing are not.

**Also seen:**
- #/ → trade bar, notice bar, utility row, masthead, nav — At 1440x900, before any content: purple ticker bar 34px + cream notice 30px + utility row 29px + masthead 106px + nav row 55px = 253px, 28% of the viewport. The utility row repeats 'ALABAMA WHOLESALE INC.' directly above the logo. The phone, the main ordering channel for trade buyers, is 11px grey #6b6670 in the top-right corner, and the trade bar's call link is hidden on desktop (index.css:74).
- All desktop routes → trade bar, notice bar, utility row, masthead, navigation row — Five stacked bands come before any content: trade bar 34px, cream notice bar 30px, utility row 29px, masthead 106px and navigation row 55px, plus a 24px margin. That is 253px, or 28% of a 900px screen and 33% of 768px. `.aw-header` is position: relative (index.css:81). The Tobacco page is 11,639px tall (10,168px at 1024). After scrolling to y=2500 the header bottom is at -2247px, so search, cart and Categories can't be reached without scrolling a…
- #/category/<DEPT> → page head (crumbs, eyebrow, H1, intro, sub-pills, toolbar) — Measured .category-card-grid top / first .card-block: 1440x900 → 678px (Tobacco, Grocery) and 700px (Novelties), with 200–222px of the 296px-tall first image row visible. 1024x768 → 704px / 726px, with only 42–64px of the first image row visible because the sub-pills wrap to 2 rows (88px). 390x844 → 582px; the first-row images (582–745px) are fully visible, and their names and buttons are below the fold. The vertical stack at 1440: nav bottom 253…

**Fix:** Merge the trade bar and 'wholesale to licensed retail' notice into one slim bar. Fold the utility row into the masthead. Make a compact header sticky (or show a compact sticky bar on scroll) so cart/search stay reachable on long pages. Compact the category page head (crumbs, eyebrow, H1, intro, sub-pills, toolbar) so products start in the first screen on desktop and phones (App.jsx:293-300, 446; index.css:71-85; App.jsx:953-960).

**Files:** `src/App.jsx:293`, `src/App.jsx:296`, `src/App.jsx:300`, `src/App.jsx:446`, `src/App.jsx:953`, `src/App.jsx:958`, `src/App.jsx:960`, `src/index.css:46`, `src/index.css:71`, `src/index.css:74`, `src/index.css:78`, `src/index.css:81`, `src/index.css:82`, `src/index.css:85`, `src/index.css:109`, `src/index.css:163`, `src/index.css:253`, `src/index.css:255`, `src/index.css:527`, `src/index.css:537`

**Evidence:** [responsive/home-390-header.jpg](screenshots/responsive__home-390-header.jpg), [responsive/first-screen-844x390_category_CANDIES.jpg](screenshots/responsive__first-screen-844x390_category_CANDIES.jpg), [responsive/first-screen-1024x768_category_CANDIES.jpg](screenshots/responsive__first-screen-1024x768_category_CANDIES.jpg), [responsive/first-screen-360x740_category_CANDIES.jpg](screenshots/responsive__first-screen-360x740_category_CANDIES.jpg), [home/sec-1440-header.jpg](screenshots/home__sec-1440-header.jpg), [home/crop-topbars-2x.jpg](screenshots/home__crop-topbars-2x.jpg), [nav/header-1440.jpg](screenshots/nav__header-1440.jpg), [nav/category-scrolled-no-header-1440.jpg](screenshots/nav__category-scrolled-no-header-1440.jpg), [nav/category-scrolled-no-header-1024.jpg](screenshots/nav__category-scrolled-no-header-1024.jpg), [catalog/tobacco-1440-viewport.jpg](screenshots/catalog__tobacco-1440-viewport.jpg), [catalog/novelties-1024-viewport.jpg](screenshots/catalog__novelties-1024-viewport.jpg), [catalog/tobacco-390-viewport.jpg](screenshots/catalog__tobacco-390-viewport.jpg)

- [ ] Done

#### AW-154 · Product cards get too narrow at 601–1100px, and the card action buttons misalign across grid rows from 601px up to 1745px

**Medium** · layout-responsive · Who: **Cursor** · Effort: M · New · Viewports: 601–850 (e.g. 640, 700, 768, 844x390); 851–1100 (851, 900, 1024x768)

**Where:** #/ (New arrivals, Bestsellers, Shop by department), product 'More …' row; #/category/* grid at 851–1100px

**Problem:** Card widths: 124px at 601, 134 at 640, 149 at 700, 166 at 768, 185 at 844x390 and 179 at 851 (home); category 162px at 851, 178 at 900, 219 at 1024 (3 columns beside the 220px sidebar). Lines of text in the 'LOCKED · Sign in for pricing' button (counted with a Range): home 4 lines at 601-640, 3 at 700, 2 at 768-1024, 1 at 1280 and at 390; category 2 lines at 601-768, 2-3 at 851. Largest vertical spread between .card-add/.card-stepper tops in one row: 39px at 601-768 (home), 39px at 851 (home) and 900 (category), 18-21px at 1024, 18-20px at 390 (phones), 0 at 1280. The card-tag overlaps the block-label on 15/16 home product cards at 601, 13 at 640, 11 at 768 (e.g. 'MERCHANDISE|BESTSELLER' by 44px, 'NOVELTIES|BESTSELLER' 21px), 8 at 844x390, 9 at 851 and 3 at 900; at 640 the tag hides the label almost entirely ('TO', 'ME', 'MO' visible). Screenshots: screenshots/vresp__home-640-bestsellers-cards.jpg, .../vresp/home-768-new-arrivals-cards.png

**Also seen:**
- #/category/TOBACCO, #/category/NOVELTIES, #/category/CANDIES, #/ → .card-meta action row in each grid row — This extends the known 'Product cards … buttons don't align' finding, which names only 601–1100px. At 1152px, 7 rows on Tobacco have misaligned action rows (18–21px, one 39px). Example row: '4K's Wraps' meta at +329px, 'Backwoods cigars 5-pack' +347, 'LooseLeaf wraps 2-pack ($2.99 or $1.99)' +350. Novelties has 5 misaligned rows at 1152px, and the row 'Shroom puff Gummies | Mental Health disposable 4 gram | Mental Health pre rolls 2pk' stays 18px…

**Fix:** Make each product card (.card-link / .card-block container) a flex column and push the .card-meta action row to the bottom with margin-top:auto. The 'Choose' / 'QUOTE +' buttons then line up in every grid row at all widths (601–1100px and 1152–1745px). At 601–1100px, drop to 2–3 columns with a minimum card width of about 200px, and clamp product names to 2 lines so text stops wrapping badly. Apply this on home rails, department tiles, #/category/* grids and the PDP 'More …' row (index.css:199-211).

**Files:** `src/App.jsx:812`, `src/App.jsx:816`, `src/App.jsx:821`, `src/App.jsx:823`, `src/App.jsx:856`, `src/index.css:199`, `src/index.css:200`, `src/index.css:201`, `src/index.css:206`, `src/index.css:210`, `src/index.css:211`, `src/index.css:281`, `src/index.css:283`, `src/index.css:575`, `src/index.css:580`, `src/index.css:581`

**Evidence:** [responsive/home-640-4col-cramped-cards.jpg](screenshots/responsive__home-640-4col-cramped-cards.jpg), [responsive/home-768-card-tag-covers-label.jpg](screenshots/responsive__home-768-card-tag-covers-label.jpg), [responsive/category-851x800.jpg](screenshots/responsive__category-851x800.jpg), [catalog/merch-900-viewport.jpg](screenshots/catalog__merch-900-viewport.jpg), [catalog/novelties-900-badge-overlap.jpg](screenshots/catalog__novelties-900-badge-overlap.jpg), [catalog/grocery-390-scrolled-sticky.jpg](screenshots/catalog__grocery-390-scrolled-sticky.jpg), [gap1-text-size-print/card-meta-misalign-tobacco-1152.jpg](screenshots/gap1-text-size-print__card-meta-misalign-tobacco-1152.jpg), [gap1-text-size-print/card-meta-misalign-novelties-1440.jpg](screenshots/gap1-text-size-print__card-meta-misalign-novelties-1440.jpg)

- [ ] Done

#### AW-155 · In long or short-viewport modals the close button scrolls out of view, and landscape keeps desktop padding

**Medium** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 360x740, 390x844, 844x390 (and any height < 600)

**Where:** Sign In, Apply (checklist + application form) and Help dialogs (.dialog / .dialog-top)

**Problem:** Dialog content scrollHeight vs visible clientHeight. Application form: 1869/688 at 360x740 (2.7 screens), 1802/792 at 390x844 (2.3), 1243/338 at 844x390 (3.7). Checklist: 1016/688 at 360 and 798/338 at 844x390. Sign in: 532/338 at 844x390, where only the email field shows and Submit needs scrolling. Help: 507/338 at 844x390. The × close lives in `.dialog-top` inside the scroll area, so it scrolls away (see the scrolled application screenshot). The page area outside the dialog is only an 18px overlay margin, and phones have no Escape key. At 844x390 the dialog uses the desktop 34px padding and 42px h2 because the compact rule is width-based (≤600).

**Also seen:**
- Auth modal application form (and checklist) at 390x844 and 1440x900 — At 390x844 the application dialog is scrollHeight 1802px inside a clientHeight of 792px. At 1440x900 it is 1243px in 848px. After scrolling the dialog 900px, the close button sits at top -848px. It is not sticky, so the only ways out are Escape or tapping the thin backdrop strip, which also throws away the form.

**Fix:** Make the dialog header with the close button sticky (position: sticky; top:0) inside scrollable dialogs. Reduce padding on short and landscape viewports (max-height media queries), so the close control stays visible in the long application form and on short screens (index.css:433-440).

**Files:** `src/App.jsx:1361`, `src/components/AuthModal.jsx:163`, `src/index.css:433`, `src/index.css:435`, `src/index.css:436`, `src/index.css:440`, `src/index.css:592`

**Evidence:** [responsive/apply-form-modal-scrolled-390x844.jpg](screenshots/responsive__apply-form-modal-scrolled-390x844.jpg), [responsive/signin-modal-844x390.jpg](screenshots/responsive__signin-modal-844x390.jpg), [responsive/apply-form-modal-scrolled-844x390.jpg](screenshots/responsive__apply-form-modal-scrolled-844x390.jpg), [auth/signup-form-390-part2.jpg](screenshots/auth__signup-form-390-part2.jpg), [auth/signup-form-1440-part1.jpg](screenshots/auth__signup-form-1440-part1.jpg)

- [ ] Done

#### AW-156 · On short landscape screens the 21+ age gate cannot scroll, so its buttons are cut off

**Medium** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: landscape phones with browser chrome: 932x300, 667x280, 568x260 (fits at ≥340px tall)

**Where:** First visit (no aw-age-verified) → .age-gate

**Problem:** `.age-gate` is position:fixed, inset:0, display:flex, align-items:center with no overflow. The content block is about 326–335px tall. At 932x300 the 'Alabama' wordmark is cut at the top (inner top -17px) and the 'Yes, I am 21+' / 'No, exit' buttons end 17px below the viewport. At 667x280 they end 23px below. At 568x260 only 17px of the 50px buttons are visible. Wheel/touch scrolling does not move the content (button top stayed at 243 after scrolling). This gate blocks the whole site.

**Fix:** In src/index.css:497 change `.age-gate` to `overflow-y: auto; align-items: flex-start;` and add `.age-gate .inner { margin: auto; }` so the content centers when it fits and scrolls when it does not. Add `@media (max-height: 420px) { .age-gate { padding: 12px 24px; } .age-gate .brand span { font-size: 30px; } .age-gate h1 { font-size: 34px; margin: 12px 0 8px; } .age-gate p { font-size: 14px; line-height: 1.5; margin-bottom: 14px; } .age-gate .button { padding: 12px 20px; } }`. Check at 568x260 that both buttons are fully visible.

**Files:** `src/App.jsx:362`, `src/index.css:497`, `src/index.css:499`, `src/index.css:501`, `src/index.css:503`, `src/index.css:505`

**Evidence:** [responsive/agegate-932x300-landscape.jpg](screenshots/responsive__agegate-932x300-landscape.jpg), [responsive/agegate-568x260-landscape.jpg](screenshots/responsive__agegate-568x260-landscape.jpg)

- [ ] Done

#### AW-157 · On phones the selected product-line pill is often scrolled out of view in the horizontal pill row

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: 360x740, 390x844, 430x932

**Where:** #/category/<DEPT>/<Sub line> → .page-head .sub-pills (horizontal scroller ≤850px)

**Problem:** At 390x844, opening a product line from the menu, a breadcrumb or a direct link leaves the row at scrollLeft 0. The active pill sits off-screen: 'Sweets & Gummies (26)' at x=543–712 on #/category/CANDIES/Sweets%20%26%20Gummies, 'Wraps & Leafs (22)' at x=992–1131 on TOBACCO, 'Mushroom Products (19)' at x=640–811 on NOVELTIES (viewport 390). The visible pills are 'All (68)', 'Cigarettes (5)', 'Cigars & Cigarillos (21)' and none are highlighted, so nothing on screen shows which line is selected apart from the breadcrumb and the '1' filter badge. There is no fade or arrow hinting that the row scrolls; the last visible pill is simply cut off at the edge.

**Also seen:**
- #/category/<DEPT>/<Sub line> → sub-pill row — At 390x844, opening #/category/TOBACCO/Wraps%20%26%20Leafs puts the active pill 'Wraps & Leafs (22)' at x=992–1131 with row scrollLeft 0. The visible pills are All (68), Cigarettes (5), Cigars & Cigarillos (21) and a sliver of Loose Tobacco Bags, none highlighted. The same happens for MERCHANDISE/OTC & Health (x=1265) and NOVELTIES/Wellness Pills (x=1107). The selection still shows in the breadcrumb, in the 'Wraps & Leafs ×' chip and in 'Showing …

**Fix:** On mount and on sub-line change, call scrollIntoView({inline:'center', block:'nearest'}) on the active .sub-pills pill in the horizontal scroller (≤850px) so the selected line is visible (App.jsx:961-962, index.css:550).

**Files:** `src/App.jsx:961`, `src/App.jsx:962`, `src/index.css:550`

**Evidence:** [responsive/category-390-active-subpill-offscreen.jpg](screenshots/responsive__category-390-active-subpill-offscreen.jpg), [catalog/tobacco-wraps-390-active-pill-offscreen.jpg](screenshots/catalog__tobacco-wraps-390-active-pill-offscreen.jpg)

- [ ] Done

#### AW-158 · With filters applied, the sticky Filter & Sort bar grows to 152px on phones and covers about a fifth of the screen

**Medium** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 360x740, 390x844

**Where:** #/category/* → .category-toolbar (position: sticky on ≤850)

**Problem:** At 360x740 and 390x844 on #/category/CANDIES/Chocolate%20Bars, the sticky toolbar measures 108px with only the product-line chip ('Chocolate Bars ×' + 'Clear all'), which is the default state after picking a line from the menu. It grows to 152px after adding the 'Bestsellers' tag and the search 'bar'. Chips: 'Chocolate Bars ×', 'Bestsellers ×', '“bar” ×', 'Clear all' on 2 rows, plus the note 'Showing 3 of 58 items in Chocolate Bars' wrapped to 2 lines (36px). The bar stays at top: 0 over the grid while scrolling. With no filters (#/category/CANDIES) it is 62px. Screenshot: screenshots/vresp__category-360x740-sticky-toolbar-with-chips.jpg

**Fix:** In src/App.jsx CategoryPage, move the `{chips.length > 0 && (<ul className="active-filters" …>)}` block (lines 982–989) out of `<div className="category-toolbar">`. Render it as a sibling directly after the toolbar's closing `</div>` (line 990), so on ≤850 only `.toolbar-row` (Filter & Sort button + result note) stays sticky. The chips then scroll away with the page, while the active count stays visible in the Filter & Sort badge. In src/index.css add a rule so the moved list keeps its spacing below the toolbar: `.category-toolbar + .active-filters { margin: -8px 0 var(--block-gap); }`. Then remove `margin-bottom` from `.category-toolbar` only when it is followed by chips, or accept the default gap. At ≤600, shorten the result note (App.jsx:913–916) by dropping the ` in ${activeSub}` suffix when isMobile, since the breadcrumb and active pill already show the line. Check at 360x740 that the sticky toolbar is ≤ 64px with any combination of filters.

**Files:** `src/App.jsx:970`, `src/App.jsx:982`, `src/index.css:276`, `src/index.css:552`

**Evidence:** [responsive/category-360x740-sticky-toolbar-with-chips.jpg](screenshots/responsive__category-360x740-sticky-toolbar-with-chips.jpg), [responsive/category-390x844-sticky-toolbar-with-chips.jpg](screenshots/responsive__category-390x844-sticky-toolbar-with-chips.jpg)

- [ ] Done

#### AW-159 · Search placeholders and the quote form's Delivery method select are cut off, and the quote form column is squeezed at 851–1100px

**Medium** · layout-responsive · Who: **Cursor** · Effort: M · New · Viewports: 360–430 and 851–1000 (header search); 1024x768 (category search, quote select)

**Where:** Header search input; #/category/* 'Search in …' input; #/quote 'Delivery method' select

**Problem:** Header search (13px placeholder 'Search 368 SKUs — cigars, disposables, candy, drinks…' needs 327px): 244px available at 360, 274 at 390 (shows '…disposables, car'), 314 at 430, 307 at 851 (shows '…candy, dr'). It fits at ≥1000. Category sidebar input #category-search (14px 'Item, brand, SKU, variant…' needs 177px): 156px available at 851, 1000, 1024 and 1280, showing 'Item, brand, SKU, var' at every desktop width. Quote form #quote-delivery ('Next-day delivery (on route)' needs 184px + native arrow): 118px at 851 ('Next-day delive'), 159 at 1024 ('Next-day delivery (or'), 191 at 1180 ('Next-day delivery (on rout'). It fits at 1280. Screenshots: screenshots/vresp__header-search-390.jpg, …/vresp/header-search-851.png, …/vresp/category-1280-search-placeholder.png, …/vresp/quote-851-delivery-select.png, …/vresp/quote-1180-delivery-select.png

**Also seen:**
- #/quote → 'Your details' form at 860px and 1024px widths — I measured #quote-delivery's option text (184px) against the select's usable width. It is cut at 852 (select 143px, 'Next-day delive'), 900, 1000, 1100 (199px) and 1180 (215px, renders 'Next-day delivery (on rout'), and fits at 1240, 1280 and 1440. At 860px the form column is 315px with 2-column fields of 153/148px; at 1024px it is 383px. .checkout-grid (index.css:335) keeps two columns down to 851px, and .form-grid (index.css:443) only collapses…

**Fix:** On #/quote at 851–1100px, stack the checkout grid (line list above the form) or give the form column a minimum width of about 420px so fields aren't squeezed (index.css:335, 443). Make the Delivery method select full-width and shorten its option labels (App.jsx:1279-1283). Shorten the header search and category 'Search in …' placeholders, or swap in shorter ones with a media query, so they never cut off mid-word (App.jsx:460, 933).

**Files:** `src/App.jsx:395`, `src/App.jsx:460`, `src/App.jsx:933`, `src/App.jsx:1279-1283`, `src/App.jsx:1281`, `src/index.css:288`, `src/index.css:289`, `src/index.css:335`, `src/index.css:341`, `src/index.css:443`

**Evidence:** [responsive/home-390-header.jpg](screenshots/responsive__home-390-header.jpg), [responsive/quote-1024x768-fullpage.jpg](screenshots/responsive__quote-1024x768-fullpage.jpg), [responsive/category-851x800.jpg](screenshots/responsive__category-851x800.jpg), [design/home-390-viewport.jpg](screenshots/design__home-390-viewport.jpg), [design/tobacco-viewport-1440.jpg](screenshots/design__tobacco-viewport-1440.jpg), [catalog/tobacco-1440-viewport.jpg](screenshots/catalog__tobacco-1440-viewport.jpg), [cart/quote-860.jpg](screenshots/cart__quote-860.jpg), [cart/quote-1024.jpg](screenshots/cart__quote-1024.jpg)

- [ ] Done

#### AW-302 · Many phone and tablet controls are still smaller than a 44×44px touch target

**Low** · accessibility · Who: **Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: 360x740, 390x844, 430x932, 768x1024, 844x390

**Where:** Cart drawer, #/quote lines, dialogs, home carousel, sub-line pills, variant chips, breadcrumbs, footer, #/catalog, #/terms

**Problem:** Measured getBoundingClientRect() at 390x844 (same at other phone widths). Cart drawer and #/quote quantity −/+: 40x40. Line remove ×: 40x40. Dialog, drawer and menu close ×: 40x40. Search-results close ×: 36x36. Mega-menu close: 40x40. Carousel Previous 76x40, Pause 61x40, Next 54x40. Sub-line pills (e.g. 'All (58)' 71x40). Variant chips ('Regular' 73x40, 'King size' 80x40). 'LOCKED · Sign in for pricing' 171x40. Breadcrumb 'Home' 36x36, 'Candies' 52x36. Footer links 36px tall (e.g. 'Sign in' 39x36). #/catalog department jump buttons 36px tall; 'All N SKUs' summaries 36px. #/terms policy-nav buttons 34px ('Privacy' 43x34), inline 'Delivery' 55x25. 'Clear all' chip link 55x36. #/apply 'Reset your password' 120x20. At 601–850px the card 'Choose'/'QUOTE +' and card steppers are 40px (44 only applies at ≤600). The product-page stepper (44x44) and phone card buttons (44 tall) already meet the target, so this is partly fixed.

**Also seen:**
- Auth modal text links ('Forgot password?', 'No account? Apply instead', 'Back to the checklist', 'Already approved? Sign in') and × button — Measured .dialog .text-link at height 36px, font-size 12px; .dialog-close is 40×40. These are the controls for recovering a password and switching between sign-in and application on phones.
- #/shipping|privacy|terms policy nav; #/catalog department jump and 'All N SKUs' toggles; breadcrumbs; text links — Measured at 390: policy-nav buttons are 34px tall ('Delivery' 47×34, 'Privacy' 43×34); .dept-jump buttons 36px; .sku-details summary 148×36; breadcrumb 'Home' 36×36; text-links ('Delivery policy', 'Browse Tobacco') 36px. The site's own --tap token is 44px.

**Fix:** Give phone and tablet interactive controls a minimum 44x44px target (padding or min-height): the cart drawer and #/quote line controls, dialog text links and the close ×, carousel controls, sub-line pills, variant chips, breadcrumbs, footer links, the #/catalog jump bar and 'All N SKUs' toggles, and the policy nav (index.css:38, 130, 151, 172, 438, 728, 743, 754).

**Files:** `src/index.css:38`, `src/index.css:130`, `src/index.css:151`, `src/index.css:172`, `src/index.css:185`, `src/index.css:216`, `src/index.css:219`, `src/index.css:258`, `src/index.css:262`, `src/index.css:323`, `src/index.css:420`, `src/index.css:438`, `src/index.css:471`, `src/index.css:474`, `src/index.css:728`, `src/index.css:743`, `src/index.css:754`

**Evidence:** [responsive/quote-390-lines.jpg](screenshots/responsive__quote-390-lines.jpg), [responsive/cart-drawer-360x740.jpg](screenshots/responsive__cart-drawer-360x740.jpg), [responsive/search-results-390x844.jpg](screenshots/responsive__search-results-390x844.jpg), [auth/signin-modal-390.jpg](screenshots/auth__signin-modal-390.jpg), [support/terms-390-policy-layout.jpg](screenshots/support__terms-390-policy-layout.jpg), [support/catalog-390-top.jpg](screenshots/support__catalog-390-top.jpg)

- [ ] Done

#### AW-303 · On phones, 'Browse the catalog' and 'View department' section links wrap to two underlined lines

**Low** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: ≤600 (360x740, 390x844, 430x932)

**Where:** #/ ('Shop novelties', 'Shop tobacco', 'Browse the catalog'), #/product/* ('View department') → .section-head > button

**Problem:** At ≤600 the rule at index.css:574 sets max-width: 120px, white-space: normal and text-align: right on .section-head > button. At 360/390/430, 'Browse the catalog ↗' (home, 3rd section) and 'View department ↗' (#/product/*) are capped at 120px and wrap to two right-aligned text lines, with the underline broken across them and the ↗ floating beside the pair. 'Shop novelties ↗' and 'Shop tobacco ↗' fit on one line. Screenshots: screenshots/vresp__home-390-section-head-2.jpg, screenshots/vresp__pdp-390-section-head.jpg

**Fix:** In src/index.css:574 replace the ≤600 rule with `.section-head > button { gap: 6px; white-space: nowrap; max-width: none; flex-shrink: 0; }` and add `.section-head > div { min-width: 0; }` in the same block, so the heading wraps instead of the link. With this CSS injected, at 360 'Browse the catalog ↗' is 128px, 'View department ↗' is 119px, both are on one line, and there is no horizontal overflow. Optionally shorten the labels to 'All products' (App.jsx:751) and 'More {catLabel(p.cat)}' or 'View all' (App.jsx:1143).

**Files:** `src/App.jsx:751`, `src/App.jsx:1143`, `src/index.css:198`, `src/index.css:574`

**Evidence:** [responsive/product-390-section-head-wrap.jpg](screenshots/responsive__product-390-section-head-wrap.jpg), [responsive/home-390-catalog-head.jpg](screenshots/responsive__home-390-catalog-head.jpg)

- [ ] Done

#### AW-304 · SKU codes, opening hours and card kickers break at awkward points on narrow screens

**Low** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: 360–430, 768 (4-col cards)

**Where:** Product cards (.card-detail), cart/quote lines, Help dialog hours, support-page contact strip, home department cards

**Problem:** SKU codes break at their hyphens: 'AW- / GEEKBAR-25K', 'AW- / FOGER-FULL-KIT', 'AW-M-M- / S', 'AW- / BUTTERFINGER', 'AW-WRIGGLY-SLIM- / P' on 390 cards and at 768. Hours wrap in the middle of a time: 'Mon–Fri 7:00 AM – 6:00 PM · Sat–Sun 8:00 / AM – 5:30 PM' in the Help dialog at 360 and in the #/apply, #/delivery and #/terms contact strips. The department card kicker '7 PRODUCT LINES · 68 / SKUS' and the #/catalog eyebrow 'FULL ASSORTMENT · 8 DEPARTMENTS · 368 / SKUS' leave a one-word orphan.

**Also seen:**
- #/category/*, #/ product cards → .card-detail — SKUs broken across lines: 43 of 51 cards on #/category/NOVELTIES and 51 of 68 on #/category/TOBACCO at 390, 10 of 24 cards on #/ at 390, 19 of 51 (NOVELTIES) and 28 of 68 (TOBACCO) at 768, and 1 of 51 at 1440 ('Mental Health · 3 variants · AW-MENTAL-HEALTH-PREROLLS-2PK'). Examples at 390: 'Geek Bar · 2 variants · AW-' / 'GEEKBAR-15K', 'White Owl · 8 variants · AW-' / 'WO', 'Backwoods · 8 variants · AW-' / 'BACKWOODS-5PK'. Screenshot: screenshots/…

**Fix:** Prevent awkward breaks on narrow screens: white-space:nowrap (with ellipsis) for SKU codes on cards and cart/quote lines, keep hour ranges together (nowrap on each range), and shorten or allow clean wrapping for department card kickers (App.jsx:821, 1249, 1404; index.css:210).

**Files:** `src/App.jsx:762`, `src/App.jsx:821`, `src/App.jsx:1249`, `src/App.jsx:1368`, `src/App.jsx:1404`, `src/index.css:210`, `src/pages/support/CatalogIndexPage.jsx:16`, `src/pages/support/SupportShell.jsx:47`

**Evidence:** [responsive/help-dialog-360x740.jpg](screenshots/responsive__help-dialog-360x740.jpg), [responsive/home-390-dept-card.jpg](screenshots/responsive__home-390-dept-card.jpg), [responsive/home-768-card-tag-covers-label.jpg](screenshots/responsive__home-768-card-tag-covers-label.jpg), [design/novelties-cards-390.jpg](screenshots/design__novelties-cards-390.jpg)

- [ ] Done

#### AW-305 · On phones the footer is 1.5 screens of single-column links

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 360x740, 390x844, 430x932

**Where:** All routes → footer (.footer-grid at ≤600)

**Problem:** At 390x844 the footer is 1,308px tall (1.55 screens): the brand paragraph, 9 department links, 7 account/help links and the contact block are stacked in one column at 36px per row, followed by the legal row and the FDA warning. At 768 and 1024 (2-column grid), a large empty purple area sits under the brand paragraph because the Departments column is much longer.

**Fix:** In src/index.css, in the ≤600 block (line 589), replace `.footer-grid { grid-template-columns: 1fr; gap: 24px; }` with `.footer-grid { grid-template-columns: 1fr 1fr; gap: 24px 16px; } .footer-brand { grid-column: 1 / -1; } .footer-grid > div:last-child { grid-column: 1 / -1; }`. At ≤1100 (line 511), use `grid-template-columns: 1fr 1fr 1fr` with `.footer-brand { grid-column: 1 / -1 }` so the brand spans the top row. Target footer height ≤ 900px at 390.

**Files:** `src/index.css:417`, `src/index.css:511`, `src/index.css:589`

**Evidence:** [responsive/product-390x844-fullpage.jpg](screenshots/responsive__product-390x844-fullpage.jpg), [responsive/quote-1024x768-fullpage.jpg](screenshots/responsive__quote-1024x768-fullpage.jpg)

- [ ] Done

#### AW-306 · In the cart, the remove-item × looks identical to the close-drawer ×, one above the other

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: 360x740, 390x844 (all)

**Where:** Cart drawer and #/quote lines → .drawer-remove vs .dialog-close

**Problem:** At 360x740 the drawer close button (40x40 circle with ×, y≈15–55) and the first line's remove button (40x40 circle with ×, y≈91–131) sit in the same right-hand column, about 36px apart, with nearly identical styling. A thumb aimed at 'close' can remove the first item, and there is no undo.

**Fix:** Turn the × into a labelled text button in the quantity row. In src/App.jsx:1415 (drawer) and 1262 (#/quote), render `<button className="text-link drawer-remove" type="button" onClick={() => removeLine(it.lineKey)} aria-label={`Remove ${it.name}`}>Remove</button>`. In src/index.css:463 change `.drawer-line` grid-template-areas to `"thumb info info" "thumb qty remove"`. After line 338 add `.checkout-line { grid-template-areas: "thumb info total" "thumb qty remove"; }` so the approved-buyer line total keeps its own cell. Replace index.css:474 with `.drawer-remove { grid-area: remove; justify-self: end; width: auto; height: auto; min-height: var(--tap-sm); padding: 0 4px; border: 0; border-radius: 0; background: none; color: var(--purple); font-size: var(--text-sm); }`. Optionally keep the last removed line in state and show an 'Item removed · Undo' status for 5 seconds.

**Files:** `src/App.jsx:1262`, `src/App.jsx:1415`, `src/index.css:474`

**Evidence:** [responsive/cart-drawer-360x740.jpg](screenshots/responsive__cart-drawer-360x740.jpg)

- [ ] Done

#### AW-307 · In landscape the header search results panel runs past the bottom of the screen and scrolls inside itself

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 844x390 (landscape phones)

**Where:** Header search → .aw-search-results

**Problem:** Typing 'gum' at 844x390 opens the panel at y=179 with max-height 65dvh (254px), so it ends at y=432, 42px below the 390px viewport. Its 644px of results scroll inside a 252px box, nested in a scrolling page. With the on-screen keyboard (about half the height in landscape), almost none of the results would be visible. At 390x844 the panel spans 197–746, which is fine.

**Fix:** In the search input onFocus (src/App.jsx:463), when `isMobile`, call `e.currentTarget.closest('form').scrollIntoView({ block: 'start', behavior: 'smooth' })` so the search bar moves to the top of the viewport, and add `.aw-search { scroll-margin-top: 8px; }`. In the ≤850 block (index.css:542) set `.aw-search-results { max-height: calc(100dvh - 72px); }` so the panel always ends inside the viewport once the bar is at the top.

**Files:** `src/App.jsx:463`, `src/index.css:148`, `src/index.css:542`

**Evidence:** [responsive/search-results-844x390.jpg](screenshots/responsive__search-results-844x390.jpg)

- [ ] Done

#### AW-308 · The 'COLLECTION / 0x' label on the home collection cards is 4px out of line with the card text

**Low** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: all (≤600: label at 20px vs content at 24px; desktop: 24px vs 28px)

**Where:** #/ → .editorials → .editorial-card .block-label

**Problem:** Offsets measured from the card's left edge. ≤600 (390x844): 'COLLECTION / 01' at 20px vs 'EXOTICS & NOVELTIES' eyebrow and h2 at 24px (.block-label left 20px, index.css:569; card padding 24px, index.css:587). 601–850 (768x1024): label 24px vs content 22px (base left 24px, index.css:187; padding 22px, index.css:546). Desktop (1440): label 24px vs content 28px (padding 26px 28px, index.css:224). Screenshot: screenshots/vresp__home-390-editorial-card.jpg

**Fix:** Add `.editorial-card .block-label { left: 28px; top: 26px; }` after src/index.css:225. In the ≤850 block, add `.editorial-card .block-label { left: 22px; top: 22px; }` after line 546. In the ≤600 block, add `.editorial-card .block-label { left: 24px; top: 24px; }` after line 587. Check that the label's text-left equals the eyebrow's text-left at 390, 768 and 1440.

**Files:** `src/index.css:187`, `src/index.css:224`, `src/index.css:546`, `src/index.css:569`, `src/index.css:587`

**Evidence:** [responsive/home-390-editorials.jpg](screenshots/responsive__home-390-editorials.jpg)

- [ ] Done

## Safari / iPhone & touch behaviour

#### AW-037 · Page changes don't reset scroll correctly: the new page renders at the old scroll position and then smooth-scrolls up, and in Safari/WebKit it lands at the footer

**High** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: WebKit 390x844 (touch, DPR 3) and 1440x900; Chromium not affected

**Where:** All in-app navigation from a scrolled position: product cards on #/category/*, the home rails, footer links, the cart drawer's quote button. Affects Safari/WebKit on iPhone and Mac.

**Problem:** Playwright WebKit 390x844 touch DPR3: #/category/TOBACCO scrolled to y=6000 (max 14363), tapping a card goes to #/product/86 with final scrollY 2737 of max 2737. The H1 is at -2032px and only the footer is visible. Chromium gives scrollY 0. From the bottom of #/category/TOBACCO, footer 'Privacy' → #/privacy 2057/2057, 'Contact & visit' → #/contact 2810/2810, 'Trade terms' → #/terms 2991/2991 (Chromium: 0 for all). WebKit 1440x900: card from y=6000 → #/product/238 at 1271/1271 (H1 at -847px), and footer links stick at the page maximum (899, 1025, 1583). Adding html{scroll-behavior:auto!important}, or reducedMotion:'reduce' (which triggers the existing rule at src/index.css:609-610), gives y=0. The stuck position happens only when the old scrollY is greater than the new page's maximum scroll. Evidence: screenshots/qgap1wt__webkit-phone-card-landing.jpg, webkit-phone-footer-privacy-landing.png, webkit-desk-card-landing.png. Chromium equivalents are chromium-*.png in the same folder. Confirm on a physical iPhone after the fix.

**Also seen:**
- All in-app navigation (cards, footer links, header links) — index.css:46 sets html { scroll-behavior: smooth }, and navigate() calls window.scrollTo(0, 0) (App.jsx:210), which inherits smooth behaviour. Clicking the footer 'Contact & visit' from the bottom of home (scrollY 4446): the new Contact page first paints showing its footer, then scrollY samples every 50 ms were 1088, 876, 496, 295, 182, 110, 51, 24, 8, 1, 0. That is about half a second of visible scrolling on every navigation. From a product card…

**Fix:** On every route change, reset scroll before paint: in a useLayoutEffect, call window.scrollTo({top:0,left:0,behavior:'instant'}) (App.jsx:207-210). Stop `scroll-behavior: smooth` (index.css:46, 610) from applying to route changes. Use the same reset for the cart drawer's quote-button navigation (App.jsx:1198). Test in Safari on iPhone and Mac.

**Files:** `src/App.jsx:189`, `src/App.jsx:207`, `src/App.jsx:210`, `src/App.jsx:217`, `src/App.jsx:218`, `src/App.jsx:219`, `src/App.jsx:1198`, `src/index.css:46`, `src/index.css:610`, `src/pages/support/CatalogIndexPage.jsx:11`

**Evidence:** [sbs/phone-nav-product-landing.jpg](screenshots/sbs__phone-nav-product-landing.jpg), [gap1-webkit-touch/webkit-phone-after-card-tap.jpg](screenshots/gap1-webkit-touch__webkit-phone-after-card-tap.jpg), [gap1-webkit-touch/webkit-desktop-navscroll-category-card.jpg](screenshots/gap1-webkit-touch__webkit-desktop-navscroll-category-card.jpg), [gap1-webkit-touch/webkit-desktop-navscroll-home-bestseller-card.jpg](screenshots/gap1-webkit-touch__webkit-desktop-navscroll-home-bestseller-card.jpg), [code/smooth-scroll-midway-footer-nav.jpg](screenshots/code__smooth-scroll-midway-footer-nav.jpg), [catalog/tobacco-after-back-from-product.jpg](screenshots/catalog__tobacco-after-back-from-product.jpg)

- [ ] Done

#### AW-160 · Hover styles stick after a tap on touch screens, so tapped buttons look selected or current

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: WebKit and Chromium with touch at 390x844 and 1024x1366 (iPad)

**Where:** Touch devices, all routes. Seen on the home carousel Previous/Next, PDP and cart-drawer quantity steppers, PDP 'Add to quote', and on iPad the header 'Quick Reorder' and 'Categories' toggle.

**Problem:** Measured ~800ms after page.tap(). WebKit and Chromium 390x844 touch: #/ carousel Next changes from bg rgb(255,255,255)/color rgb(40,20,89) to bg rgb(40,20,89)/color rgb(255,255,255) and stays that way with :hover=true, while Previous stays white. #/product/86 qty '+' changes from bg #fff to rgb(246,243,238), :hover=true. At 1024x1366 touch (iPad), header 'Quick Reorder' → #/account, and the button stays color rgb(184,57,10) with :hover=true. Evidence: screenshots/qgap1wt__webkit-phone-carousel-next-sticky.jpg, webkit-ipad-quickreorder-sticky.png.

**Fix:** In src/index.css, wrap each :hover rule in place in `@media (hover: hover) { … }`. Do not move them to the end of the file, so cascade order is kept. Affected lines: 94, 100, 104, 106, 118, 131, 136, 153, 167, 169, 186, 214, 217, 220, 259, 263, 272, 278, 328, 408, 410, 412, 421, 423, 439, 472, 475, 488, 507, 632, 652, 729, 745, 760, 768. At line 541, nest the hover media inside the existing max-width:850px block. Split line 111 into two rules: keep `.aw-category-toggle[aria-expanded="true"] { background: #38206a; }` unconditional, and put only `.aw-category-toggle:hover { background: #38206a; }` inside the hover media. Then add touch press feedback outside any media query: `.home-carousel-controls button:active, .button.ghost:active, .card-add:active, .mini-btn:active { background: var(--purple); color: #fff; }`, `.button:not(:disabled):active { background: var(--orange-dark); }`, `.qty-stepper button:active, .card-stepper button:active, .drawer-line .qty button:active, .drawer-remove:active { background: var(--paper); }`. Verify with Playwright WebKit (hasTouch/isMobile) or iOS Safari: after tapping carousel Next, PDP '+' or iPad 'Quick Reorder', the control returns to its resting colours, and the Categories toggle still shows #38206a while its menu is open.

**Files:** `src/index.css:106`, `src/index.css:111`, `src/index.css:118`, `src/index.css:167`, `src/index.css:186`, `src/index.css:217`, `src/index.css:220`, `src/index.css:263`, `src/index.css:328`, `src/index.css:472`

**Evidence:** [gap1-webkit-touch/sticky-webkit-phone-carousel-prev.jpg](screenshots/gap1-webkit-touch__sticky-webkit-phone-carousel-prev.jpg), [gap1-webkit-touch/webkit-hover-carousel-next.jpg](screenshots/gap1-webkit-touch__webkit-hover-carousel-next.jpg), [gap1-webkit-touch/sticky-webkit-ipad-service-quick-reorder.jpg](screenshots/gap1-webkit-touch__sticky-webkit-ipad-service-quick-reorder.jpg), [gap1-webkit-touch/sticky-webkit-phone-pdp-qty-plus.jpg](screenshots/gap1-webkit-touch__sticky-webkit-phone-pdp-qty-plus.jpg)

- [ ] Done

#### AW-161 · The hero carousel ignores swipes on phones

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: Phones and tablets (tested 390x844 touch in Chromium and WebKit)

**Where:** #/ → hero carousel stage (.home-carousel-stage)

**Problem:** Autoplay was paused (reduced motion) so that only a gesture could change the slide.
- Chromium: a real CDP touch swipe across the stage (touchStart at x=330 → touchMove ×10 → touchEnd at x=40, then the reverse) left 'Slide 1 of 4' unchanged both ways, with scrollY still 0.
- WebKit: synthetic touch-type pointerdown/pointermove/pointerup across the stage left 'Slide 1 of 4' unchanged. (WebKit on macOS rejects the Touch constructor, so real TouchEvents could not be sent.)
- src/App.jsx has no onTouch*, onPointer* or swipe handling (grep found only an onFocus on the search input). The stage is not a scroll container either: overflow-x visible, scroll-snap-type none, scrollWidth equals clientWidth (356).

On a phone the only way to change slides is the small text buttons below the image, and on WebKit those are partly covered by the photo (see the Safari carousel finding).

**Fix:** In HeroCarousel (src/App.jsx:623-697), add swipe handling to the stage div at :661. Store the start point in a ref in onPointerDown={e => (start.current = { x: e.clientX, y: e.clientY })}. In onPointerUp, compute dx and dy; if Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy), call go(dx < 0 ? 1 : -1) and setPaused(true) so autoplay doesn't immediately move it again. Clear start.current in onPointerCancel. Add `touch-action: pan-y;` to `.home-carousel-stage` in src/index.css:178 so vertical page scrolling still works and horizontal swipes reach the handlers. Alternatively, rebuild the stage as an overflow-x: auto track with scroll-snap-type: x mandatory and sync the index from scroll position.

**Files:** `src/App.jsx:623`, `src/App.jsx:661`, `src/index.css:178`

- [ ] Done

#### AW-309 · In Safari, dropdowns drop the site's padding and corners and show the native double chevron

**Low** · consistency · Who: **Cursor** · Effort: S · New · Viewports: WebKit 390x844 and 1440x900

**Where:** #/quote 'Delivery method'; #/category/* 'Sort by' (toolbar and phone filter drawer); application dialog 'Business type', 'Store state', 'Expected monthly volume'; #/delivery state select; account Quick Reorder and admin selects

**Problem:** No select sets `appearance`, so WebKit draws the native menulist and overrides author styles.

Computed in WebKit:
- #quote-delivery: padding 0px/0px (authored 0 12px at src/index.css:445), border-radius 5px (authored 2px).
- .category-sort select: padding 0px/0px (authored 0 30px 0 10px at :270), radius 5px (authored square).
- #aw-su-type, #aw-su-state, #aw-su-volume: padding 0/0, radius 5px.
- Chromium, same controls: 12px/12px padding, 2px or 0px radius.

Visually, Safari draws the macOS up/down double chevron and a rounded 5px box beside square inputs. In the #/quote grid the select text starts about 10px from the left edge, while the neighbouring inputs' text starts at about 14px (sbs-phone-quote-formgrid.png). The 'Sort by' control becomes a rounded pill beside the square search box (sbs-desktop-category-sort.png).

Verified fix, injected into both engines: appearance:none plus an SVG chevron. WebKit then computes padding 12px/36px and radius 2px, identical to Chromium (webkit-phone-delivery-FIXED.png).

**Fix:** Add one shared rule near src/index.css:445: `.form-grid select, .category-sort select, .eligibility-form select, .qr-choice select, .aw-table select, .order-head select { -webkit-appearance: none; appearance: none; padding-right: 36px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23281459' stroke-width='2'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; background-size: 12px 8px; }`. Keep each rule's existing background-color (#f8f6f2 or #fff) by moving it to `background-color:` so the shorthand doesn't wipe it. Set the same border-radius as the neighbouring inputs (2px in forms, 0 for .category-sort). Remove the now-redundant `padding: 0 30px 0 10px` right padding at :270. Check #/quote, the sort select, #/delivery and the application dialog in Safari.

**Files:** `src/index.css:270`, `src/index.css:357`, `src/index.css:381`, `src/index.css:403`, `src/index.css:445`, `src/index.css:674`

**Evidence:** [forms/sbs-desktop-category-sort.jpg](screenshots/forms__sbs-desktop-category-sort.jpg), [forms/sbs-phone-quote-formgrid.jpg](screenshots/forms__sbs-phone-quote-formgrid.jpg), [forms/webkit-phone-delivery-FIXED.jpg](screenshots/forms__webkit-phone-delivery-FIXED.jpg)

- [ ] Done

#### AW-310 · In Safari the empty 'Preferred date' field shows today's date in grey, so it looks already filled in

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: WebKit 390x844 and 1440x900

**Where:** #/quote → 'Your details' → Preferred date (input#quote-date)

**Problem:** #/quote with a cart line, Playwright WebKit (macOS Safari engine) at 1440x900 and at 390px width: the empty Preferred date field shows the current date '09 / 28 / 2026' as grey segments with no calendar icon. input.value is '' and min is ''. Chromium at the same sizes shows 'mm/dd/yyyy' plus a calendar icon. A Safari user can read the grey date as selected, and submitting sends p_preferred_date: null (src/lib/orders.js:20). Evidence: screenshots/qgap1wt__webkit-phone-quote-select-date.jpg vs chromium-phone-quote-select-date.png. On iOS Safari the empty field would instead render blank; this was not reproducible in Playwright.

**Fix:** Keep preferredDate defaulting to '' (src/App.jsx:1169); do not pre-fill a date. On the input at src/App.jsx:1285, add `className={data.preferredDate ? undefined : 'is-empty'}` and `aria-describedby="quote-date-hint"`. Right after the input, add `<small className="field-hint" id="quote-date-hint">Optional. Leave blank for your next route day.</small>`. In src/index.css next to .form-grid input (line 445), add `.form-grid input[type="date"].is-empty:not(:focus)::-webkit-datetime-edit { color: transparent; }` so Safari no longer shows today's date as grey ghost text. Chrome keeps its mm/dd/yyyy placeholder only when focused, and the hint carries the meaning. Leave min/past-date validation to the known '[cart] Quote fields accept past delivery dates' fix. Verify in Safari on macOS and iOS: the empty field reads as empty, and picking a date shows it in normal ink.

**Files:** `src/App.jsx:1169`, `src/App.jsx:1285`

**Evidence:** [forms/sbs-desktop-date-delivery.jpg](screenshots/forms__sbs-desktop-date-delivery.jpg), [forms/sbs-phone-quote-formgrid.jpg](screenshots/forms__sbs-phone-quote-formgrid.jpg)

- [ ] Done

## Text size, zoom & print

#### AW-162 · All type is set in px, so the browser's text-size setting has no effect

**Medium** · accessibility · Who: **Cursor** · Effort: L · New · Viewports: all

**Where:** All routes → all text (verified on #/, #/product/162, #/quote, #/terms)

**Problem:** src/index.css contains 102 `font-size: Npx` declarations, 18 `font:` shorthands with px sizes, and px type tokens (--text-xs 11px … --h2 36px). It has no rem or em font sizes. The three clamp() headings (lines 163, 314, 501) are clamped between px values. I raised the browser default text size to 16, 24 and 32px with CDP Page.setFontSizes (the same effect as Chrome Settings › Appearance › Font size 'Very large' or Customize fonts), at 1280×800. `1rem` and `medium` computed to 16/24/32px as expected, but the site did not change: body 14px, main p 11px on #/ and PDP and 13px on #/quote and #/terms, h1 66.56px, search input 13px, nav 12px, crumbs 11px, PDP variant chips 12px, quote labels 11px, policy body 14px, footer links 13px, footer policy links 10px, FDA note 11px. Page heights did not change at any setting (#/ 5246px, #/product/162 2126px, #/quote 1971px, #/terms 2475px), and the 16px and 32px screenshots of each route are byte-identical (same md5). Simulating the preference being honoured (every font ×1.5 ≈ a 24px default) at 1280px gives a working layout (remsim-x1.5 screenshot), so a rem migration is feasible. The only new breakage is the trade bar at phone width, reported separately. Tiny 9–11px rules are already covered by the existing 'Much text is 9–12px' finding. This finding is about the unit, not the minimum size. The desktop header survives every width from 851 to 1400px with no wrapping or collisions (sweep in 7px steps).

**Fix:** Leave html font-size unset (100%) and move every text size to rem (px ÷ 16) in src/index.css. (1) Tokens at lines 26–31: --text-xs .6875rem, --text-sm .75rem, --text-md .8125rem, --text-base .875rem, --text-lg 1rem, --h2 2.25rem. Line 42: --h2 1.875rem. Lines 37–38: --tap 2.75rem, --tap-sm 2.5rem. (2) Convert every literal px font size and font shorthand to rem. These are on lines 112,113,129,130,134,140,142,151,157,205,209,216,230,232,238,239,248,279,286,296,313,320,327,340,347,348,351,355,356,357,358,363,367,372,376,377,380,381,386,388,393,395,397,398,401,403,407,424,438,440,459,464,471,474,486,489,499,503,538,545,571,578,588,593,595,602,621,623,628,629,631,633,639,640,642,649,650,657,658,662,663,670,671,673,674,676,677,680,681,686,687,688,692,693,694,697,698,699,700,701,705,713,721,727,728,734,735,738,743,744,750,754,756,761,762,767,782,783,785,807. Examples: 13px → .8125rem, 15px → .9375rem, 26px → 1.625rem, 34px → 2.125rem, 120px → 7.5rem, `font: 600 14px/1` → `font: 600 .875rem/1`. Keep line 538 at 1rem (≥16px stops iOS zoom). Take the new sizes for the 9–11px rules (347, 356–358, 377, 380, 388, 393, 398, 407, 673, 705, 727, 762, 767) from the existing tiny-text finding; don't just transliterate 9px. (3) Give the clamps a rem part so they scale: line 163 `clamp(2.75rem, 1.5rem + 3.5vw, 4.75rem)`, line 314 `clamp(2.375rem, 1.5rem + 2.5vw, 3.5rem)`, line 501 `clamp(2.625rem, 1.5rem + 3.5vw, 3.75rem)`. (4) Let text-holding controls grow: change `height:` to `min-height:` on .aw-search (89, 537), .category-sort select (270), .filter-search input (289), drawer select (304), .order-head select (357), .qr-field input/.qr-choice select (381), .aw-table input/select (403), .form-grid input/select (445) and .eligibility-form select (674). Set .aw-cart-count (107) to min-width 1.25rem and height 1.25rem, and .aw-help-icon (123) to 1.0625rem. (5) Switch breakpoints to em so the layout reflows when text is large: 1100px → 68.75em (line 510), 850px → 53.125em (522, 770), 600px → 37.5em (41, 561, 780), 360px → 22.5em (604). Update App.jsx:78 MOBILE_QUERY to '(max-width: 53.125em)' and the `sizes` strings in src/lib/images.js:81–83 and App.jsx:680. (6) Replace App.jsx:1224 `style={{ fontSize: 13 }}` with a class. Acceptance: with Chrome font size 'Very large' (24px), body copy on #/terms computes to 21px and there is no horizontal scroll at 390px or 1280px.

**Files:** `src/App.jsx:78`, `src/App.jsx:1224`, `src/index.css:26`, `src/index.css:42`, `src/index.css:47`, `src/index.css:163`, `src/index.css:314`, `src/index.css:501`, `src/index.css:510`, `src/index.css:522`, `src/index.css:537`, `src/index.css:561`, `src/index.css:604`, `src/index.css:770`, `src/index.css:780`, `src/lib/images.js:81`

**Evidence:** [gap1-text-size-print/fontpref-16px-terms-1280.jpg](screenshots/gap1-text-size-print__fontpref-16px-terms-1280.jpg), [gap1-text-size-print/fontpref-32px-terms-1280.jpg](screenshots/gap1-text-size-print__fontpref-32px-terms-1280.jpg), [gap1-text-size-print/fontpref-16px-product_162-1280.jpg](screenshots/gap1-text-size-print__fontpref-16px-product_162-1280.jpg), [gap1-text-size-print/fontpref-32px-product_162-1280.jpg](screenshots/gap1-text-size-print__fontpref-32px-product_162-1280.jpg), [gap1-text-size-print/fontpref-24px-quote-1280.jpg](screenshots/gap1-text-size-print__fontpref-24px-quote-1280.jpg), [gap1-text-size-print/fontpref-32px-home-1280.jpg](screenshots/gap1-text-size-print__fontpref-32px-home-1280.jpg), [gap1-text-size-print/remsim-x1.5-1280-product_162.jpg](screenshots/gap1-text-size-print__remsim-x1.5-1280-product_162.jpg)

- [ ] Done

#### AW-163 · On common laptop screens the product page's variant chips, price and 'Add to quote' are all below the fold

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: 1366×650 (1366×768 laptop), 1536×730 (1920 panel at 125%), 1280×600 (1920 at 150%), 1309×717 (1440 at 110%), 1152×631 (1440 at 125%), 960×526 (1440 at 150%), 1440×789

**Where:** #/product/<id> (e.g. 162, 61, 14) → .pd-info purchase block

**Problem:** #/product/162 'Add to quote' button: 841–885px at 1366x650, 842–886 at 1536x730 and 1440x789, 837–881 at 1280x600. Its bottom edge is 235px below the fold at 1366x650, 156px at 1536x730, 97px at 1440x789 and 281px at 1280x600. At 1366x650 the first screen shows only the header, breadcrumb, H1, description and the start of the SKU fine print. Info column at 1366x650: .pd-brand 391, H1 424–477, .pd-desc 485–529, .pd-fine 529–585, .variant-chips 599–639, two .in-cart-note lines 656–699, .pd-price 721–818, .qty-row 840–886. About 115px of description and SKU boilerplate sits between the title and the variant chips. A DOM reorder simulation moves the button bottom to 752px (#/product/162) and 663px (#/product/14); adding 12px top padding brings these to 716 and 627px. Screenshot: screenshots/vgap1tsp__pdp-162-1366x650-fold.jpg

**Fix:** 1. Reorder the children of .pd-info in ProductPage (src/App.jsx:1094–1137) to: .pd-brand (1095) → h1 (1096) → .variant-chips (1100–1106) → choose-variant note (1108) → variantError (1109) → .pd-price (1110–1116) → .pd-unit (1098, directly above the stepper it explains) → .qty-row (1117–1124) → 'Already in quote' note (1125) → sign-in/apply or approval-status actions (1126–1136) → .pd-desc (1097) → 'Flavors and availability…' note (1107) → .pd-fine (1099).
2. At App.jsx:1082, replace `style={{ paddingBottom: 0 }}` with className="page-head pd-head". In src/index.css add `.page-head.pd-head { padding: 12px 0 0; }`.
3. Change .pd-grid (src/index.css:310) to `padding: 12px 0 40px; align-items: start;`.
4. Do not make .pd-media sticky; it has no effect on the button position.

Acceptance: at 1366x650 the 'Add to quote' button is fully visible without scrolling on single-variant products (e.g. #/product/14). On multi-variant products (e.g. #/product/162) it is within about 70px of the fold, and fully visible once the known header-stack finding is fixed.

**Files:** `src/App.jsx:1082`, `src/App.jsx:1094`, `src/App.jsx:1097`, `src/App.jsx:1098`, `src/App.jsx:1099`, `src/App.jsx:1107`, `src/App.jsx:1110`, `src/App.jsx:1117`, `src/index.css:253`, `src/index.css:310`

**Evidence:** [gap1-text-size-print/pdp-fold-162-1366x650.jpg](screenshots/gap1-text-size-print__pdp-fold-162-1366x650.jpg), [gap1-text-size-print/pdp-fold-162-1536x730.jpg](screenshots/gap1-text-size-print__pdp-fold-162-1536x730.jpg), [gap1-text-size-print/pdp-fold-162-1280x600.jpg](screenshots/gap1-text-size-print__pdp-fold-162-1280x600.jpg), [gap1-text-size-print/win-1280x600_1.5-product_162.jpg](screenshots/gap1-text-size-print__win-1280x600_1.5-product_162.jpg)

- [ ] Done

#### AW-311 · The trade bar cannot wrap, so enlarged text clips the phone number and scrolls the page sideways on phones

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 390×844 with enlarged text

**Where:** All routes → purple .trade-bar ('Apply for a trade account ↗' + 'Call (205) 354-4473') at ≤600px

**Problem:** `.trade-bar a, .trade-bar button { flex: 0 0 auto; white-space: nowrap }` (index.css:73), and the ≤600px row (562–565) never wraps. At 390px with 12px minimum text (Chrome/Safari minimum-font-size setting, emulated by clamping computed sizes) nothing breaks. At 16px minimum the 'Call (205) 354-4473' link ends at x=404, so the page scrolls horizontally by 14px and the number is clipped. With text scaled ×1.5 (what a 24px text preference gives once the rem fix lands) the overflow is 26px: 'Call (205) 354-4…'. It was the only overflowing element on #/, #/category/TOBACCO, #/product/162, #/quote and #/terms. At the same sizes the badges (.card-tag, .block-label), cart badge (20×20 with a 16px digit) and footer legal row did not break.

**Fix:** In the ≤600px block of src/index.css (lines 561–565), add `.trade-bar .container { flex-wrap: wrap; row-gap: 0; }` and `.trade-bar a, .trade-bar button { flex: 0 1 auto; white-space: normal; text-align: left; }`. Keep the existing `min-height: 34px` from line 73; do not lower it. Verify at 390x844 by injecting `.trade-bar a, .trade-bar button { font-size: 16.5px !important }`: document.documentElement.scrollWidth must stay 390, and the Call link must wrap onto its own row with the full number visible.

**Files:** `src/index.css:72`, `src/index.css:73`, `src/index.css:562`

**Evidence:** [gap1-text-size-print/minfont16-390-home-top.jpg](screenshots/gap1-text-size-print__minfont16-390-home-top.jpg), [gap1-text-size-print/tradebar-390-x1.5.jpg](screenshots/gap1-text-size-print__tradebar-390-x1.5.jpg), [gap1-text-size-print/tradebar-390-x1.jpg](screenshots/gap1-text-size-print__tradebar-390-x1.jpg)

- [ ] Done

#### AW-312 · At 150–175% browser zoom the bottom of the sticky Filters sidebar is cut off and can't be reached while scrolling products

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 960×526 (1440 laptop at 150%), 1097×549 (1920 at 175%), 1280×600 (1920 at 150%)

**Where:** #/category/<DEPT> → .category-filters sidebar (sticky) while scrolling the product grid

**Problem:** `.category-filters { position: sticky; top: 18px }` (index.css:284) is 591px tall (search, Featured, Variants, 'Wholesale pricing is locked' box) and has no max-height or overflow. Scrolled to the middle of the Tobacco grid (scrollY ≈4000 of a 9884px page), the panel sits at 18–609px. That leaves 83px below the fold at 960×526, 60px at 1097×549 and 9px at 1280×600. The 'Wholesale pricing is locked / Sign in…' box is cut mid-line and stays unreachable until the grid ends. Measured identically on #/category/TOBACCO and #/category/MERCHANDISE. Larger text or more filter options would hide more.

**Fix:** In src/index.css line 284 change to `.category-filters { position: sticky; top: 18px; max-height: calc(100vh - 36px); overflow-y: auto; overscroll-behavior: contain; }`. Or apply stickiness only when it fits: move `position: sticky` into `@media (min-height: 44em) { .category-filters { position: sticky; } }`.

**Files:** `src/index.css:284`

**Evidence:** [gap1-text-size-print/sticky-filters-TOBACCO-960x526.jpg](screenshots/gap1-text-size-print__sticky-filters-TOBACCO-960x526.jpg), [gap1-text-size-print/sticky-filters-TOBACCO-1097x549.jpg](screenshots/gap1-text-size-print__sticky-filters-TOBACCO-1097x549.jpg)

- [ ] Done

## Forced dark mode & Google Translate

#### AW-038 · Browsers that force dark mode auto-darken the whole site because it declares no color scheme and has no dark theme

**High** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: 390x844 (isMobile, DPR 2) and 1440x900

**Where:** All routes → document <head> (index.html) and :root (src/index.css). Seen in Chromium force-dark, which is the engine behind Chrome Android 'Darken websites'/auto-dark and Opera/Brave force-dark. Samsung Internet applies similar forced darkening when the phone is in dark mode.

**Problem:** Chromium launched with --enable-features=WebContentsForceDark --blink-settings=forceDarkModeEnabled=true and colorScheme 'dark' (my scripts qa-gap2fd-01/06/07.mjs).
- Baseline (all routes): the page paints #121212 at DPR 1 (#101010 at DPR 2), but getComputedStyle(body).backgroundColor is rgb(255,255,255). There is no meta[name=color-scheme], and :root computes color-scheme 'normal'.

Consequences measured, merged from -4 to -11:
(a) Header hamburger bars (≤850px) and the search-button magnifier: purple #281459 on #121212, about 1.2:1. At 390px only the word 'Menu' stays visible (-4).
(b) Keyboard focus ring on the #/product/162 'Add to quote' button: #281459 on #121212 = 1.19:1, vs 15.74:1 in light mode (-5). The same purple override applies to .aw-signup, .filter-toggle, .aw-category-toggle and .sub-pill.active.
(c) Variant chips on #/product/162: selected #281459 vs idle #252320, about 1.0:1 luminance difference vs 14.22:1 in light mode. Only a faint purple hue marks the selection. The active .sub-pill has the same problem (-6).
(d) Native select arrows almost vanish: #/delivery state select, #/quote 'Delivery method', 'Sort by', and the application dialog selects (-7).
(e) White-background product and hero photos, cart/search thumbnails and the logo fringe show as bright white boxes on dark tiles (-8).
(f) The 53%-white ghost-button borders ('No, exit' on the age gate, 'Email us' on the contact strip) drop to about 1.4:1 (-9).
(g) Dialog, cart drawer, search panel and mega-menu edges merge into the dimmed page (-10).
(h) Purple headings take a pink cast, cream panels turn brown, and the NEW tag sinks into the tile (-11).

Opt-out verification (same force-dark browser, HTML patched at runtime):
- meta content="only light" → viewport paints #ffffff at 390 and 1440.
- CSS :root{color-scheme:only light} → #ffffff, with computed color-scheme 'light only'.
- meta content="light" → still #121212.

Screenshots: evidence/qa-gap2fd/fd-390-home.png, meta-onlylight-390-home.png, meta-light-390-home.png, css-onlylight-390-home.png, FD-chips.png, FD-delivery-select.png (under scratchpad).

**Fix:** 1) index.html: on a new line directly after line 5 (the viewport meta), add `<meta name="color-scheme" content="only light" />`. It must be in the static HTML so it applies from first paint.
2) src/index.css line 9: add `color-scheme: only light;` as the first declaration inside `:root {`.
3) Keep the explicit `body { background: #fff }` at src/index.css:47.
4) Retest on a real Samsung Galaxy with Samsung Internet dark mode on. Samsung uses its own darkening algorithm, and support for the opt-out has not been verified there.
5) Do this only if Samsung Internet still darkens the page. Ship a real dark theme instead of the opt-out:
- Change the meta to content="light dark" and set `:root{color-scheme: light dark}`.
- Inside `@media (prefers-color-scheme: dark) { :root { --ink:#f1edf5; --muted:#b3acb9; --paper:#1d1a22; --cream:#2a2320; --line:#4a4452; --purple:#b9a6ec; --orange-dark:#ff8a57; --focus-ring:#ffcdb5; } }`, replace the hard-coded #fff/white/#f8f6f2 backgrounds with tokens. Affected rules: body (47), .aw-header (86), .aw-mega-menu (126), .aw-search-results (148), .home-carousel-stage (178), .sub-pill (262), .dialog (435), .drawer (456) and .form-grid fields (445).
- In the same media block:
  - Keep photo plates white: `.card-block, .pd-media, .drawer-line .thumb, .sr-thumb, .home-carousel-stage { background:#fff }`.
  - Give selected states a light fill: `.variant-chips button[aria-pressed="true"], .sub-pill.active { background:#b9a6ec; color:#1b1030 }`.
  - Give floating surfaces an edge: `.dialog, .drawer, .aw-search-results, .aw-mega-menu { background:#1d1a24; border:1px solid #5a5462 }`.
  - Make ghost borders opaque: `.age-gate .button.ghost, .contact-strip .button.ghost { border-color:#a99bd0 }`.
  - Other fixes: `.card-tag.new { background:#6a4fc0 }` and `.editorial-card.cream img.bg { mix-blend-mode:normal; opacity:.18 }`.
  - Replace the CSS-drawn icons (index.css:95-96, 273-274, 529-530; App.jsx:453, 464, 974) with inline SVG using stroke="currentColor".

**Files:** `index.html:5`, `src/index.css:9`, `src/index.css:47`

**Evidence:** [gap2-forced-dark-transforms/fd-390-home.jpg](screenshots/gap2-forced-dark-transforms__fd-390-home.jpg), [gap2-forced-dark-transforms/fd-1440-home.jpg](screenshots/gap2-forced-dark-transforms__fd-1440-home.jpg), [gap2-forced-dark-transforms/fd-390-product_162.jpg](screenshots/gap2-forced-dark-transforms__fd-390-product_162.jpg), [gap2-forced-dark-transforms/m-fix-meta-390-home-viewport.jpg](screenshots/gap2-forced-dark-transforms__m-fix-meta-390-home-viewport.jpg), [gap2-forced-dark-transforms/m-fix-css-390-home-viewport.jpg](screenshots/gap2-forced-dark-transforms__m-fix-css-390-home-viewport.jpg), [gap2-forced-dark-transforms/m-fix-light-390-home-viewport.jpg](screenshots/gap2-forced-dark-transforms__m-fix-light-390-home-viewport.jpg), [gap2-forced-dark-transforms/fix-lightdark-390-home.jpg](screenshots/gap2-forced-dark-transforms__fix-lightdark-390-home.jpg)

- [ ] Done

#### AW-039 · With Google Translate on, common catalog, policy and reorder actions crash React and blank the whole site

**High** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: all (reproduced at 1440x900 and 390x844)

**Where:** Chrome 'Translate this page' active → - #/category/<DEPT>/<Sub line>: 'All (n)' pill, or removing the sub-line chip - #/category/* phone Filter & Sort drawer when results reach exactly 1 - #/privacy ↔ #/shipping via the 'Customer policies' side-nav or the footer - #/account Quick Reorder: clear the Qty field, then retype it

**Problem:** Simulated Chrome Translate: every text node under #root and the portals was replaced with <font><font>…</font></font>, which detaches the original nodes, and a MutationObserver translated new content, as Translate does. Reproduced crashes:
1) #/category/TOBACCO → 'Cigarettes' pill → 'Cigars & Cigarillos' pill → 'All (68)'. Result: NotFoundError "Failed to execute 'removeChild' on 'Node'", React "The above error occurred in the <Text> component at p … at CategoryPage", #root childElementCount 0, white page.
2) 390 #/category/CANDIES → 'Bags' pill → remove the 'Bags ×' chip → same removeChild crash.
3) 390 #/category/TOBACCO → Filter & Sort → type 'kite' in 'Search in Tobacco' (1 result) → crash. App.jsx:1007 removes the 's' of 'items'.
4) #/privacy → side-nav 'Delivery' → removeChild crash. #/shipping → 'Privacy' → "Failed to execute 'insertBefore'" crash. Cause: PolicyPage.jsx:128 conditional 'Last updated …' text.
5) #/account Quick Reorder (local mocked approved session): SKU 'AW-KITE' → clear Qty → type 5 → crash. Cause: QuickReorder.jsx:79 ' · Enter a quantity of 1 or more'.
Root cause: a conditional bare string sits next to sibling nodes, so React removes or inserts a text node that Translate has already detached: App.jsx:915 `{activeSub ? ` in ${activeSub}` : ''}`, App.jsx:1007 `item{…? '' : 's'}`, PolicyPage.jsx:128, QuickReorder.jsx:78-79 and 124-125. The same pattern exists, untested, in AccountPage.jsx:134-135 and 159-162. With no error boundary the whole site goes blank (links to the known '[code] No error boundary' finding).

**Fix:** Rule: any string that can appear, disappear or change must be the ONLY child of an element that is always rendered.

1) Rewrite each call site:
- App.jsx:915 → `Showing <strong>{items.length}</strong> <span>{`of ${inCategory.length} item${inCategory.length === 1 ? '' : 's'}${activeSub ? ` in ${activeSub}` : ''}`}</span>`
- App.jsx:1007 → `<span>{`Show ${items.length} item${items.length === 1 ? '' : 's'}`}</span> <span aria-hidden="true">↗</span>`
- PolicyPage.jsx:128 → `<span>{policy.updated ? `Last updated ${UPDATED}. ` : ''}</span><span>Questions about this policy? Call </span><PhoneLink /><span> or email </span><EmailLink />.`
- QuickReorder.jsx:78 → `<b>{`${res.product.name}${res.variant ? ` — ${res.variant}` : ''}`}</b>`
- QuickReorder.jsx:79 → `<small>{`${variantSku(res.product.sku, res.variant)} · ${res.product.brand}${rowQty(row) > 0 ? '' : ' · Enter a quantity of 1 or more'}`}</small>`
- QuickReorder.jsx:124-125, AccountPage.jsx:134-135 and 159-162, and AuthModal.jsx:181-182: build one template string and render it as the sole child of a <span>.

2) Add a safety net in src/main.jsx, before `ReactDOM.createRoot(...)` (line 6), so any missed spot degrades to stale text instead of a white page. This is the widely used guard from facebook/react#11538:
`if (typeof Node === 'function' && Node.prototype) { const rc = Node.prototype.removeChild; Node.prototype.removeChild = function (child) { if (child.parentNode !== this) return child; return rc.apply(this, arguments); }; const ib = Node.prototype.insertBefore; Node.prototype.insertBefore = function (node, ref) { if (ref && ref.parentNode !== this) return node; return ib.apply(this, arguments); }; }`

3) Also wrap <App /> in an ErrorBoundary that shows a 'Something went wrong – Reload' panel (see the known error-boundary finding).

**Files:** `src/App.jsx:915`, `src/App.jsx:1007`, `src/components/AuthModal.jsx:181`, `src/main.jsx:6`, `src/pages/account/AccountPage.jsx:134`, `src/pages/account/AccountPage.jsx:159`, `src/pages/account/QuickReorder.jsx:78`, `src/pages/account/QuickReorder.jsx:79`, `src/pages/account/QuickReorder.jsx:124`, `src/pages/support/PolicyPage.jsx:128`

**Evidence:** [gap2-forced-dark-transforms/tr-1440-after-all-pill.jpg](screenshots/gap2-forced-dark-transforms__tr-1440-after-all-pill.jpg), [gap2-forced-dark-transforms/tr-1440-policy-nav-crash.jpg](screenshots/gap2-forced-dark-transforms__tr-1440-policy-nav-crash.jpg), [gap2-forced-dark-transforms/tr-390-filter-1item.jpg](screenshots/gap2-forced-dark-transforms__tr-390-filter-1item.jpg), [gap2-forced-dark-transforms/tr-1440-quickreorder-crash.jpg](screenshots/gap2-forced-dark-transforms__tr-1440-quickreorder-crash.jpg)

- [ ] Done

#### AW-164 · With Google Translate on, counts, totals, the slide counter and variant/state names stop updating and show stale or wrong values

**Medium** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: all (reproduced at 1440x900 and 390x844)

**Where:** Translated page → #/ hero carousel counter; #/category/* result note, eyebrow, filter badge, 'Clear all (n)', drawer 'Show n items'; #/product/<id> 'Already in quote' note and approved price-block SKU; #/quote units total; #/delivery service-area answer; #/account Quick Reorder button

**Problem:** Same Translate simulation as the crash finding. React writes updates into text nodes that Translate has already detached, so the visible text freezes:
1) #/ → Next ×2: slide 3 (BIC lighters) shows, but the counter says 'Slide 1 of 4' (App.jsx:690).
2) #/category/TOBACCO → Cigarettes → Cigars & Cigarillos: 21 cards show, but the note reads 'Showing 21 of 68 items in Cigarettes' (App.jsx:915).
3) #/category/TOBACCO → footer 'Candies (58)': h1 'Candies', but the eyebrow says 'DEPARTMENT · 68 SKUs' and the note 'Showing 58 of 68 items' (App.jsx:958, 915).
4) 390 drawer, Bestsellers + New checked: button still 'Show 68 items', 'Clear all (1)', and the toolbar badge stays '1' with two chips (App.jsx:1007, 1006, 976). At 1440 the sidebar shows 'Clear all (1)' with two filters (App.jsx:1019).
5) #/product/162 with cart {king-size:1, regular:3}: select Regular → 'Already in quote: 3 · King size'. After adding 3 more: '6 · King size' while Regular is selected (App.jsx:1125).
6) Approved buyer (local mock) #/product/162: the price line stays 'Wholesale unit price · AW-SNICKERS' after choosing Regular/Almond reg (App.jsx:1112).
7) #/quote: 2 → 4 Kite (5 units) still shows '3 units', and still '3 units' after removing a line (App.jsx:1289).
8) #/delivery: choose Alabama, then Georgia → 'We run delivery routes in Alabama.' (DeliveryPage.jsx:65).
9) Quick Reorder with a valid SKU: the button stays 'Add to order' instead of 'Add 1 line to order' (QuickReorder.jsx:111).
Same pattern, not exercised: App.jsx:1297 'Sending…' label; App.jsx:1249 and 1404 line price text.
Did not reproduce: header search count, cart badge, the drawer/quote/PDP quantity <b>s, and 'Choose · n'. These are sole children, so they update correctly.

**Fix:** Render each dynamic sentence as one template string that is the only child of its element:
- 690 → `<p aria-live="polite">{`Slide ${safeIndex + 1} of ${count}`}</p>`
- 958 → `<p className="eyebrow">{`DEPARTMENT · ${String(cat.count).padStart(2, '0')} SKUs`}</p>`
- 976 → `<span className="filter-count"><span className="sr-only">, </span><span>{activeFilterCount}</span><span className="sr-only"> active</span></span>`
- 1006 and 1019 → `{`Clear all (${activeFilterCount})`}`
- 1112 → `<span>{`Wholesale unit price · ${variantSku(p.sku, selected)}`}</span>`
- 1125 → `<p className="in-cart-note"><span>{`Already in ${isApprovedBuyer ? 'order' : 'quote'}: `}</span><strong>{qty}</strong><span>{selected ? ` · ${selected}` : ''}</span></p>`
- 1289 → `<span>{`${totalUnits} units`}</span>`
- 1297 → `<span>{sending ? 'Sending…' : …}</span> <span aria-hidden="true">↗</span>`
- DeliveryPage.jsx:65 → `<b>{`We run delivery routes in ${routeState.name}.`}</b>`
- QuickReorder.jsx:111 → wrap the ternary in `<span>`.
App.jsx:915 and 1007 are fixed as described in the crash finding. Do not use translate="no" on whole sentences, because buyers need them translated.

**Files:** `src/App.jsx:690`, `src/App.jsx:915`, `src/App.jsx:958`, `src/App.jsx:976`, `src/App.jsx:1006`, `src/App.jsx:1007`, `src/App.jsx:1019`, `src/App.jsx:1112`, `src/App.jsx:1125`, `src/App.jsx:1289`, `src/App.jsx:1297`, `src/pages/account/QuickReorder.jsx:111`, `src/pages/support/DeliveryPage.jsx:65`

**Evidence:** [gap2-forced-dark-transforms/tr-1440-carousel-stale.jpg](screenshots/gap2-forced-dark-transforms__tr-1440-carousel-stale.jpg), [gap2-forced-dark-transforms/tr-1440-resultnote-stale.jpg](screenshots/gap2-forced-dark-transforms__tr-1440-resultnote-stale.jpg), [gap2-forced-dark-transforms/tr-1440-dept-switch.jpg](screenshots/gap2-forced-dark-transforms__tr-1440-dept-switch.jpg), [gap2-forced-dark-transforms/tr-390-filterdrawer.jpg](screenshots/gap2-forced-dark-transforms__tr-390-filterdrawer.jpg), [gap2-forced-dark-transforms/tr-390-toolbar-stale.jpg](screenshots/gap2-forced-dark-transforms__tr-390-toolbar-stale.jpg), [gap2-forced-dark-transforms/tr-1440-filters-clearcount.jpg](screenshots/gap2-forced-dark-transforms__tr-1440-filters-clearcount.jpg), [gap2-forced-dark-transforms/tr-1440-pdp-note.jpg](screenshots/gap2-forced-dark-transforms__tr-1440-pdp-note.jpg), [gap2-forced-dark-transforms/tr-1440-approved-pdp-sku.jpg](screenshots/gap2-forced-dark-transforms__tr-1440-approved-pdp-sku.jpg), [gap2-forced-dark-transforms/tr-1440-quote-units.jpg](screenshots/gap2-forced-dark-transforms__tr-1440-quote-units.jpg), [gap2-forced-dark-transforms/tr-1440-delivery-stale.jpg](screenshots/gap2-forced-dark-transforms__tr-1440-delivery-stale.jpg)

- [ ] Done

## Accessibility (WCAG 2.2 AA)

#### AW-040 · Keyboard focus ring is invisible on the age-gate buttons and on the purple contact strip

**High** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Age gate (first visit, every route): 'Yes, I am 21+' and 'No, exit'. Also the purple 'Talk to the warehouse' / 'Apply with a trade rep' contact strip at the bottom of #/apply, #/delivery, #/shipping, #/privacy and #/terms: 'Call (205) 354-4473', 'Email us' and 'Contact & visit'

**Problem:** Measured on the focused elements at 1440x900. Both age-gate buttons get outline 3px rgb(40,20,89) with a 3px offset, drawn on the .age-gate background rgb(40,20,89), which is 1.00:1, so the ring cannot be seen. The 'No, exit' ghost button looks exactly the same focused and unfocused (screenshots). On #/apply the contact strip has the same problem: the 'Call' .button and the 'Email us' ghost get a purple ring on purple (1.00:1), and the 'Contact & visit' text-link gets #b8390a on #281459 (2.72:1, below 3:1). Cause: index.css:59 forces `.button:focus-visible { outline-color: var(--purple) }`, which overrides the light #ffcdb5 ring set for purple surfaces at :58, and .contact-strip is missing from that list. This fails WCAG 2.4.7 Focus Visible (AA) on the first screen every visitor sees.

**Also seen:**
- #/ age gate 'Yes, I am 21+' and 'No, exit'; .contact-strip on #/delivery, #/apply, #/shipping, #/privacy, #/terms — index.css:58 defines a light --focus-ring (#ffcdb5) for .trade-bar, .footer-main, .age-gate and .fda-note. Line 59 then sets `.button:focus-visible { outline-color: var(--purple) }` (specificity 0,2,0), which overrides it for every .button. After tabbing to 'Yes, I am 21+' on the age gate, the computed outline is `rgb(40, 20, 89) 3px solid` on an rgb(40, 20, 89) background, so the ring can't be seen (focus-agegate-button.png). On #/delivery the c…

**Fix:** Give buttons and links on purple backgrounds (the age-gate 'Yes, I am 21+' / 'No, exit' buttons and the .contact-strip Call/Email/Contact links) a contrasting focus-visible ring, for example white or orange with a 2px offset (index.css:58-59, 646).

**Files:** `src/App.jsx:372`, `src/App.jsx:373`, `src/index.css:58`, `src/index.css:59`, `src/index.css:646`, `src/index.css:647`, `src/pages/support/SupportShell.jsx:43`

**Evidence:** [a11y/age-gate-yes-focused.jpg](screenshots/a11y__age-gate-yes-focused.jpg), [a11y/age-gate-no-focused.jpg](screenshots/a11y__age-gate-no-focused.jpg), [a11y/contact-strip-call-button-focused.jpg](screenshots/a11y__contact-strip-call-button-focused.jpg), [a11y/contact-strip-email-button-focused.jpg](screenshots/a11y__contact-strip-email-button-focused.jpg), [a11y/contact-strip-textlink-focused.jpg](screenshots/a11y__contact-strip-textlink-focused.jpg), [design/focus-agegate-button.jpg](screenshots/design__focus-agegate-button.jpg), [design/focus-contact-strip-ghost.jpg](screenshots/design__focus-contact-strip-ghost.jpg)

- [ ] Done

#### AW-041 · SPA page changes drop keyboard focus to <body> or leave it in the header, and the new page is never announced

**High** · accessibility · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Every in-app navigation (product cards, search results, breadcrumbs, footer, mega menu, cart drawer → quote)

**Problem:** Keyboard journey at 1440x900: type 'backwoods' in the header search, Tab to the first result and press Enter. The URL becomes #/product/11 and document.activeElement is BODY. The next Tab lands on the header 'Sign In', so the user has to Tab through Sign Up, Cart, Categories, New Arrivals, Bestsellers, Exotics, Quick Reorder and Help again before reaching the product. Cart drawer → 'Request quote' goes to #/quote, but ModalLayer's restoreFocus puts focus back on the header 'Cart, 1 items' button, and the next Tab goes to 'Categories'. document.title does update, but no live region announces the route change, so screen-reader users get no cue that the page changed. navigate() only calls pushState, setRoute and scrollTo(0,0).

**Also seen:**
- Any card/search result/related card → #/product/<id> — After clicking a category card, document.activeElement was BODY. The clicked card unmounts, and no heading receives focus and no live region announces the new product, so screen-reader users get no signal that the page changed. Clicking the first related card on #/product/162 from scrollY 871 gave these scrollY samples every 60ms: 977, 816, 447, 242, 115, 51, 17, 5. The new product page visibly animates upward for about 450ms, because `html { scr…

**Fix:** After each SPA route change, move focus to the new page's <h1> (tabindex='-1') or <main>, and announce the new document title through a polite live region. Do this for product cards, search results, breadcrumbs, footer, mega menu and cart → quote, with no smooth-scroll animation (App.jsx:197, 207-215).

**Files:** `src/App.jsx:197`, `src/App.jsx:207`, `src/App.jsx:210`, `src/App.jsx:215`, `src/App.jsx:315`, `src/App.jsx:1096`, `src/components/ModalLayer.jsx:83`, `src/index.css:46`

**Evidence:** [a11y/kbd-search-results-focus.jpg](screenshots/a11y__kbd-search-results-focus.jpg)

- [ ] Done

#### AW-042 · Adding/removing items drops focus to <body> and nothing is announced

**High** · accessibility · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/category/* and home product cards ('QUOTE +' / 'ADD +' → stepper), #/product/<id> 'Add to quote', #/quote and cart drawer remove buttons

**Problem:** #/product/11 → choose Banana → Enter on 'Add to quote': focus stays on the button. The only live region on the page is the desired-qty <b aria-live> ('1'). 'Already in quote: 1 · Banana' (App.jsx:1125) has no role or aria-live, and the header button's aria-label silently becomes 'Cart, 1 items'. #/category/CANDIES → 'Long Boys coconut candy tub' → Enter on 'QUOTE +': the button unmounts and the stepper renders with its <b aria-live> already filled ('1'), which is not announced. document.activeElement = BODY (Chrome's next Tab does resume at the stepper's 'Decrease quantity', but screen readers get no confirmation and no focused control). Decrement to 0 → BODY. #/quote → 'Remove Long Boys…' → BODY. Action buttons on #/category/CANDIES: 58 'LOCKED · Sign in for pricing', 40 'Choose', 18 'QUOTE +'.

**Also seen:**
- #/category/<DEPT> → product card 'QUOTE +' / 'ADD +' button — On #/category/FOOD%20STUFF I focused 'QUOTE +' on Argo corn starch and pressed Enter. The button is replaced by a −/1/+ stepper and document.activeElement becomes BODY, so keyboard users lose their place. The only announcement is the aria-live <b> reading '1'. Nothing visible says 'Added'. The header cart badge ('Cart, 1 items') is not in view once the user has scrolled (the header isn't sticky), so sighted users get no feedback beyond the button…
- Cart drawer × / − at qty 1; #/quote × and 'Clear all items'; category card 'QUOTE +' / stepper − — Measured document.activeElement: after × on a drawer line → BODY; after − on a qty-1 drawer line (line removed) → BODY; after × on #/quote → BODY; after 'Clear all items' → BODY. On #/category/GROCERY, focusing 'QUOTE +' and pressing Enter swaps the button for a stepper and focus → BODY; stepper − down to 0 → BODY. The only live regions on the category page are 'Showing 47 of 47 items' and each stepper's <b aria-live>, which reads a bare number l…

**Fix:** When 'QUOTE +'/'ADD +' swaps to a stepper, move focus to the new stepper control. After removing or zeroing a line or clearing the cart, move focus to the next line, the list heading or the empty-state CTA. Announce 'Added X to quote' / 'Removed X' through a polite live region (App.jsx:239-262, 831-841, 1255-1266, 1409-1415).

**Files:** `src/App.jsx:239`, `src/App.jsx:261`, `src/App.jsx:262`, `src/App.jsx:346`, `src/App.jsx:831-841`, `src/App.jsx:833`, `src/App.jsx:834`, `src/App.jsx:836`, `src/App.jsx:840`, `src/App.jsx:1071`, `src/App.jsx:1125`, `src/App.jsx:1255-1266`, `src/App.jsx:1257`, `src/App.jsx:1262`, `src/App.jsx:1409-1415`, `src/App.jsx:1411`, `src/App.jsx:1415`

**Evidence:** [a11y/product-add-to-quote-no-announcement.jpg](screenshots/a11y__product-add-to-quote-no-announcement.jpg), [catalog/food-row-after-quote-add.jpg](screenshots/catalog__food-row-after-quote-add.jpg)

- [ ] Done

#### AW-043 · All internal navigation is <button> + hash routing, so there are no real links and only one crawlable URL

**High** · accessibility · Who: **Cursor** · Effort: L · Still open from the 2026-09-25 audit · Viewports: all

**Where:** Header nav, mega menu, search results, product/department cards, breadcrumbs, footer, catalog index, policy side-nav

**Problem:** Counted in the DOM: #/ has 0 internal <a href> and 97 <button>; #/category/TOBACCO has 0 links and 246 buttons; #/product/11 has 0 links and 60 buttons (the only anchors are tel: and mailto:). Screen-reader link lists are empty, every destination is announced as 'button', and users can't open a product in a new tab, copy its link or see the target on hover. Breadcrumbs (.crumbs) are a plain <div>: no <nav aria-label="Breadcrumb">, no list and no aria-current="page" on the last item.

**Also seen:**
- Header logo, Categories mega menu, New Arrivals / Bestsellers / Exotics / Quick Reorder, all footer links — On #/ with the mega menu open, the header contains 47 <button> elements and one <a> (a tel: link). The footer has 19 <button> elements and two <a> elements (tel: and mailto:). The page has no internal <a href> links at all. Middle-clicking or Cmd-clicking 'Tobacco (68)' in the footer opened no new tab (the browser context still had 1 page). Right-click offers no 'Copy link address', and crawlers can't follow department or product links. New Arriv…
- All routes (#/category/*, #/product/*, #/catalog, support pages), header, mega menu, product cards, footer, breadcrumbs — Every page lives behind a URL fragment (#/category/TOBACCO, #/product/61). Search engines drop the fragment, so the whole site is one URL (/). I captured the DOM on 29 routes (evidence meta-per-route.json). Every route has 0 internal <a href> links. Each page has only 4–10 <a> elements, all tel:/mailto:. Navigation uses <button onClick>: 97 buttons on home, 246 on Tobacco, 470 on #/catalog. That covers product cards (App.jsx:813), mega menu (App.…

**Fix:** Move to path-based routing (history API with Netlify SPA fallback) and render every internal navigation item as <a href> with a click handler that keeps SPA transitions. That covers the header logo, Categories mega menu, nav row, search results, footer, catalog index, policy side-nav and breadcrumbs. Wrap breadcrumbs in <nav aria-label='Breadcrumb'> with aria-current='page' (App.jsx:164-216, 456, 534-555, 954, 1083, 1236).

**Files:** `netlify.toml:9-12`, `src/App.jsx:164-185`, `src/App.jsx:177`, `src/App.jsx:207-216`, `src/App.jsx:217`, `src/App.jsx:456`, `src/App.jsx:474`, `src/App.jsx:530-545`, `src/App.jsx:534`, `src/App.jsx:536`, `src/App.jsx:539`, `src/App.jsx:544`, `src/App.jsx:550`, `src/App.jsx:552`, `src/App.jsx:555`, `src/App.jsx:813`, `src/App.jsx:954`, `src/App.jsx:1083`, `src/App.jsx:1236`, `src/App.jsx:1308-1345`, `src/App.jsx:1319`, `src/App.jsx:1320`, `src/App.jsx:1325`, `src/App.jsx:1342`, `src/pages/account/AccountPage.jsx:76`, `src/pages/support/CatalogIndexPage.jsx:22`, `src/pages/support/CatalogIndexPage.jsx:50`, `src/pages/support/SupportShell.jsx:18`

**Evidence:** [nav/footer-1440.jpg](screenshots/nav__footer-1440.jpg), [nav/mega-menu-1440.jpg](screenshots/nav__mega-menu-1440.jpg), [seo/meta-per-route.json](screenshots/seo__meta-per-route.json), [seo/nojs-raw-html-blank.jpg](screenshots/seo__nojs-raw-html-blank.jpg)

- [ ] Done

#### AW-165 · Open mega menu and search results stay open after focus leaves them and cover the next focused controls

**Medium** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: 1440x900 (desktop layout)

**Where:** Header: Categories mega menu; header search results panel (desktop ≥851px)

**Problem:** Mega menu: open Categories and Tab through all 35 menu buttons. Focus then moves on to New Arrivals … Help and then the carousel 'Previous slide' button, while the menu stays open. elementFromPoint at the centre and two corners of 'Previous slide' returns .aw-menu-grid, so the focused control is completely hidden. Search: type 'bic', then Tab past the results. The panel stays open, and 'New Arrivals', 'Bestsellers' and 'Exotics' each receive focus with 5/5 sample points covered by .aw-search-results ('Categories' 2/5). Both panels close only on a mouse click outside or Escape (App.jsx:400-420). This fails WCAG 2.4.11 Focus Not Obscured (Minimum).

**Also seen:**
- Header → Categories mega menu, keyboard use — Steps: open the menu with Enter and Tab through all 35 menu buttons. Focus moves on to New Arrivals, the carousel 'Previous' button and so on, but the menu stays open. document.elementFromPoint at the focused 'Previous' button (x=1128, y=769) returns an element inside .aw-mega-menu, so keyboard focus is hidden behind the menu (WCAG 2.4.11 Focus Not Obscured). Clicks outside do close it (App.jsx:413-420), but focus leaving it does not. Other probl…

**Fix:** Close the Categories mega menu and the search results panel when focus moves outside them (a focusout handler that checks relatedTarget) and on Escape, so they don't cover the next focused controls (App.jsx:413, 459, 518-523).

**Files:** `src/App.jsx:413`, `src/App.jsx:459`, `src/App.jsx:518`, `src/App.jsx:519`, `src/App.jsx:523`, `src/App.jsx:524`, `src/App.jsx:531`

**Evidence:** [a11y/kbd-megamenu-tab-out-obscured.jpg](screenshots/a11y__kbd-megamenu-tab-out-obscured.jpg), [a11y/kbd-search-results-cover-focused-new-arrivals.jpg](screenshots/a11y__kbd-search-results-cover-focused-new-arrivals.jpg), [nav/mega-open-focus-obscured-1440.jpg](screenshots/nav__mega-open-focus-obscured-1440.jpg), [nav/mega-open-focus-outside-1440.jpg](screenshots/nav__mega-open-focus-outside-1440.jpg)

- [ ] Done

#### AW-166 · No skip link: 14 header tab stops before page content on desktop, 8 on mobile

**Medium** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** All routes, top of page

**Problem:** No skip link exists (no a[href^='#'] and no 'skip' anywhere in App.jsx or index.css). Measured desktop tab order on #/: 1 'Apply for a trade account', 2 phone link, 3 logo, 4 search input, 5 Search, 6 Sign In, 7 Sign Up, 8 Cart, 9 Categories, 10 New Arrivals, 11 Bestsellers, 12 Exotics, 13 Quick Reorder, 14 Help, 15 carousel 'Previous slide'. At 390px the header takes 8 stops (Call, Apply, Menu, logo, search, Search, Sign In, Cart). Because of the SPA focus issue above, these stops are repeated after every page change.

**Also seen:**
- All routes → start of page — Keyboard order on #/category/TOBACCO: 1 'Apply for a trade account', 2 phone, 3 logo, 4 search, 5 Search button, 6 Sign In, 7 Sign Up, 8 Cart, 9 Categories, 10 New Arrivals, 11 Bestsellers, 12 Exotics, 13 Quick Reorder, 14 Help, then 15 'Home' breadcrumb in <main>. There is no 'Skip to content' link (no match for 'skip' anywhere in App.jsx or index.css), and <main> has no id to target.

**Fix:** Add a visible-on-focus 'Skip to main content' link as the first focusable element, targeting <main id='main' tabindex='-1'> (App.jsx:292, 315; index.css:61).

**Files:** `src/App.jsx:292`, `src/App.jsx:315`, `src/index.css:61`

**Evidence:** [nav/focus-first-tab-1440.jpg](screenshots/nav__focus-first-tab-1440.jpg)

- [ ] Done

#### AW-167 · Announcement ticker scrolls forever with no pause, cuts words, jumps each loop, and freezes mid-word under reduced motion

**Medium** · accessibility · Who: **Cursor** · Effort: M · New · Viewports: 601px and wider (hidden at ≤600px)

**Where:** Purple trade bar at the top of every route (viewports wider than 600px)

**Problem:** At 1440x900 and at 601px, the computed style of .ticker span is `animation: 36s linear infinite tick` with play-state 'running'. The strip moved from x=-66 to x=-179 during 1s of hover, so hover does not pause it, and nor does focus. There is no pause, stop or hide control. It is hidden at ≤600px (index.css:563) and stops only with OS reduced motion (index.css:609-612). The ticker is aria-hidden="true" (App.jsx:295). On #/ the Services section repeats most of the offers, but on #/category/*, #/product/*, #/quote and the support pages screen-reader users get none of them (free delivery over $1,500, Net-30, will-call, volume discounts).

**Also seen:**
- #/ → purple trade bar ticker — '.ticker span' runs 'tick 36s linear infinite' (index.css:76-77) with no pause button and no pause on hover. WCAG 2.2.2 requires a way to pause moving content that lasts more than 5s; only users with reduced-motion turned on get it stopped. The text is hard-clipped mid-word at both edges, e.g. '…Birmingham warehou' at 1440; at 1920 the ticker starts at x=320 in the middle of a full-width bar ('ALL · Pickup…'). Its four messages repeat the service…
- All routes → purple trade bar ticker (.ticker) — The .ticker span is 7,615px wide: TICKER_TEXT repeated 4 times (App.jsx:75, :295). The `tick` keyframe translates it by -50% (3,807px) in 36s, which is 105.8px/s, measured at both 1440 and 1024. Hovering leaves it moving at 105.8px/s with animationPlayState 'running'. There is no pause button, which fails WCAG 2.2.2 (Level A) for auto-moving content that runs longer than 5s. Text is 11px, weight 600, letter-spacing 1.2px. No mask or fade is appli…
- All routes → trade bar ticker when the OS 'Reduce motion' setting is on — With prefers-reduced-motion: reduce, the global rule at index.css:609-612 sets `animation: none` on the ticker span. It becomes static text clipped by `.ticker { overflow: hidden }` (index.css:75). The visible text ends '…approved retail accounts · ★ WILL-CALL · P' at 1440 and '…Mississippi & Georgia · ★ NET-30 TERMS availa' at 1024, so text is cut mid-word. The VOLUME DISCOUNTS announcement and most of the WILL-CALL one are never visible. The wh…
- All routes → trade bar ticker — The span has 4 copies of the text plus `padding-right: 60px` and animates to translateX(-50%). Measured: the span is 7,615px wide, so half is 3,807.5px. The third copy starts at 3,779.4px, so at the end of each loop the text is 28px past where the restart position begins, and it visibly snaps back. Captured frames: ticker-seam-before-loop.png at t=35.999s and ticker-seam-after-loop.png at t=0.
- Every route → .trade-bar .ticker (desktop/tablet >600px) — The ticker is clipped by `overflow: hidden` with hard edges, so screenshots show fragments such as 'er $1,500 on our delivery routes…' at the left and '…Pickup at the Birmingham wareho' at the right, directly against the 'Apply for a trade account ↗' link.

**Fix:** Replace the marquee with static announcements (or a slow, one-at-a-time fade rotator) that has a visible pause control and pauses on hover and focus (WCAG 2.2.2). Under prefers-reduced-motion, show the messages statically and in full, not a frozen strip cut mid-word. If a scroller is kept, duplicate the content and translate by exactly -50% so the 36s loop doesn't jump 28px, and add edge fade masks (App.jsx:295; index.css:71-77, 609-611).

**Files:** `src/App.jsx:75`, `src/App.jsx:295`, `src/data/content.js:19`, `src/data/content.js:22`, `src/data/content.js:23`, `src/index.css:71`, `src/index.css:75`, `src/index.css:76`, `src/index.css:77`, `src/index.css:609`, `src/index.css:611`

**Evidence:** [home/sec-1440-trade.jpg](screenshots/home__sec-1440-trade.jpg), [home/sec-1920-trade.jpg](screenshots/home__sec-1920-trade.jpg), [nav/ticker-1440.jpg](screenshots/nav__ticker-1440.jpg), [nav/ticker-1024.jpg](screenshots/nav__ticker-1024.jpg), [nav/ticker-reduced-motion-1440.jpg](screenshots/nav__ticker-reduced-motion-1440.jpg), [nav/ticker-reduced-motion-1024.jpg](screenshots/nav__ticker-reduced-motion-1024.jpg), [nav/ticker-seam-before-loop.jpg](screenshots/nav__ticker-seam-before-loop.jpg), [nav/ticker-seam-after-loop.jpg](screenshots/nav__ticker-seam-after-loop.jpg), [design/home-header-1440.jpg](screenshots/design__home-header-1440.jpg)

- [ ] Done

#### AW-168 · Carousel keeps rotating on hover/focus, announces every slide, and has a confusing Play/Pause toggle

**Medium** · accessibility · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/ → hero carousel controls ('Slide 1 of 4', Previous / Pause / Next)

**Problem:** The <p aria-live="polite"> text changed on its own while playing: 'Slide 1 of 4 → Slide 2 of 4 → Slide 3 of 4' over about 11 s, so screen readers get a polite interruption every 4.5 s for as long as the home page is open. Hovering the stage for 5 s went Slide 3 → Slide 1. Focusing the 'Previous slide' button went Slide 1 → Slide 2 in 5 s, so rotation does not stop on hover or focus. The Pause button pairs aria-pressed with a changing label: with reduced motion it reads 'Play' plus aria-pressed="true", which announces as 'Play, toggle button, pressed'. The slide wrappers have no role="group" / aria-roledescription="slide".

**Also seen:**
- #/ → hero carousel autoplay and controls — Measured with Playwright: while the mouse rested on the stage, slides went 3→4→1 within 9s; while keyboard focus sat on 'Next', slides went 1→2→3. The paragraph <p aria-live='polite'>Slide N of 4</p> (App.jsx:690) is announced to screen readers on every 4.5s auto-advance. The Pause button uses both aria-pressed and a changing label (Pause/Play) (App.jsx:692), a conflicting toggle pattern. The region is labelled 'Featured photos and videos', but t…

**Fix:** Pause autoplay on hover, on focus-within, and under prefers-reduced-motion. Put aria-live='polite' only while autoplay is off (aria-live='off' while rotating) so 'Slide N of 4' isn't announced every 4.5s. Make Pause/Play a clearly labelled toggle with aria-pressed (App.jsx:627, 651-660, 690).

**Files:** `src/App.jsx:627`, `src/App.jsx:651`, `src/App.jsx:660`, `src/App.jsx:667`, `src/App.jsx:690`, `src/App.jsx:692`, `src/index.css:179`

**Evidence:** [a11y/carousel-slide-1.jpg](screenshots/a11y__carousel-slide-1.jpg), [home/sec-1440-carousel.jpg](screenshots/home__sec-1440-carousel.jpg)

- [ ] Done

#### AW-169 · Hero slide alt text is marketing copy that does not describe the photo; one slide names brands that aren't shown

**Medium** · accessibility · Who: **Cursor** · Effort: S · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/ → hero carousel images

**Problem:** The active slide's alt comes from slide.title. Slide 1 alt 'The brands your customers ask for.' but the photo is a DeMet's Turtles Bites display box. Slide 4 alt 'Gatorade, Monster, Red Bull — by the case.' but the photo shows only Gatorade and G2 bottles (no Monster, no Red Bull). Slide 2 alt 'Geekbar 25K — now in stock.' is a Geek Bar Pulse X advert with baked-in text ('ACCEPT ALL CHALLENGES', 'World's first 3D curved screen') that the alt leaves out. The title, sub, cta1 and cta2 fields in HERO_SLIDES are never rendered visually, so sighted users and screen-reader users get different content.

**Also seen:**
- #/ → .home-carousel-slide img alt — The active slide's alt is `slide.title` (App.jsx:679). Measured alt vs actual image: - 'The brands your customers ask for.' on a Turtles Bites candy box - 'Geekbar 25K — now in stock.' on a Geek Bar Pulse X ad - 'BIC lighters & merchandise.' on a BIC 50-lighter display - 'Gatorade, Monster, Red Bull — by the case.' on Gatorade bottles only The carousel never displays title, eyebrow, sub, cta1, cta2 or goCat from HERO_SLIDES (content.js:42-45); th…
- #/ hero slides 1–3; header search placeholder "Search 368 SKUs" — Live #/ at 1440x900: .home-carousel innerText is only 'Slide 1 of 4 / Previous / Pause / Next'. No slide eyebrow, subtitle or CTA is in the DOM, and 'over 368' and 'Eagle torches' are absent from the rendered page. Stepping through the slides, the active image alts are: slide 1 'The brands your customers ask for.' (photo is a DeMet's Turtles Bites box; no Turtles/DeMet's product among the 368 rows); slide 2 'Geekbar 25K — now in stock.' (photo re…

**Fix:** Rewrite the hero slide alt text in content.js:42-45 to describe what each photo shows (or use alt='' if decorative, with the marketing message as visible text). Remove the claims that don't match the catalog ('over 368 SKUs', 'Geekbar 25K', BIC '50-count', brands not pictured), and correct the header search placeholder count.

**Files:** `src/App.jsx:460`, `src/App.jsx:545`, `src/App.jsx:610`, `src/App.jsx:676`, `src/App.jsx:679`, `src/App.jsx:683`, `src/App.jsx:762`, `src/App.jsx:958`, `src/data/content.js:42`, `src/data/content.js:43`, `src/data/content.js:44`, `src/data/content.js:45`, `src/pages/support/CatalogIndexPage.jsx:16`

**Evidence:** [a11y/carousel-slide-1.jpg](screenshots/a11y__carousel-slide-1.jpg), [a11y/carousel-slide-4.jpg](screenshots/a11y__carousel-slide-4.jpg), [a11y/carousel-slide-2.jpg](screenshots/a11y__carousel-slide-2.jpg), [photos2/hero-slide1-1440.jpg](screenshots/photos2__hero-slide1-1440.jpg), [photos2/hero-slide4-1440.jpg](screenshots/photos2__hero-slide4-1440.jpg)

- [ ] Done

#### AW-170 · Product/department cards are <button>s wrapping headings; action buttons have no product context

**Medium** · accessibility · Who: **Cursor** · Effort: L · New · Viewports: all

**Where:** Product cards (home, #/category/*, related products), 'Shop by department' cards and the two 'Collection' cards on #/, and the mega-menu feature tile

**Problem:** Accessibility snapshot of a product card: button "Geek Bar Pulse X 25K details". Its aria-label replaces the visible 'NOVELTIES', 'BESTSELLER', 'Disposable Vapes' and 'Geek Bar · 2 variants · AW-GEEKBAR-25K', so screen readers never hear the tag, line or SKU. Department card accessible name: "DEPARTMENT 7 PRODUCT LINES · 68 SKUs Tobacco Cigarettes · Cigars & Cigarillos · Loose Tobacco Bags Browse department". Collection card: "COLLECTION / 01 EXOTICS & NOVELTIES Disposables, detox, kratom & more. Browse novelties". These buttons contain <div>, <p> and <h2>/<h3>; HTML only allows phrasing content inside <button>, and WebKit/VoiceOver flattens button children, so those headings can't be navigated there. On #/category/CANDIES the action buttons carry no product: 40 named 'Choose', 18 'QUOTE +', and 58 'LOCKED · Sign in for pricing', which is useless in a screen-reader buttons list.

**Also seen:**
- #/ → product card action row — Tabbing through the page, each product card has 3 tab stops: '<name> details', 'LOCKED · Sign in for pricing' and 'Choose'. That is 48 stops for 16 cards. 15 buttons are named only 'Choose' and 1 only 'QUOTE +', with no product name, so screen-reader button lists are ambiguous. The same sign-in button repeats 16 times. Visitors without an account are told to 'Sign in' rather than to apply.
- #/category/<DEPT> → every product card — On #/category/TOBACCO (68 cards), the card buttons are named: 68 × '<name> details' (the aria-label replaces the kicker, brand, variant count and SKU; ariaSnapshot shows button "Swisher Sweets cigarillos details"), 68 × 'LOCKED · Sign in for pricing', 49 × 'Choose', 19 × 'QUOTE +'. None of the action buttons includes the product name. There are 0 <a href> inside cards. Cmd-click on a card changes the same tab to #/product/1 and opens no new tab. …
- #/ → product cards, department tiles, collection cards, footer department links — Product cards are <button class='card-link'> wrapping <div>, <p> and <h3> (App.jsx:813-822). Department tiles are <button class='content-card'> wrapping <div>, <p>, <h3> and <p> (App.jsx:757-766). Collection cards are <button> wrapping <div> and <h2> (App.jsx:721, :726). Footer department links are also buttons (App.jsx:1319-1320). document.querySelectorAll('a[href*="#/product/"], a[href*="#/category/"]').length is 0; the only anchors on the page…

**Fix:** Restructure cards as <article> with the product name in a real heading that contains an <a href> to the PDP. Nothing block-level may sit inside a button, and cards must be able to open in a new tab. Give the action button an accessible name that includes the product ('Add Swisher Sweets to quote'). Replace the 16 per-page 'LOCKED · Sign in for pricing' buttons with non-interactive text plus one sign-in link per page, which removes the extra tab stops. Apply the same pattern to department tiles, collection cards and the mega-menu feature tile (App.jsx:721, 757, 813-841).

**Files:** `src/App.jsx:539`, `src/App.jsx:721`, `src/App.jsx:726`, `src/App.jsx:757`, `src/App.jsx:813`, `src/App.jsx:815`, `src/App.jsx:820`, `src/App.jsx:829`, `src/App.jsx:832`, `src/App.jsx:840`, `src/App.jsx:962`, `src/App.jsx:965`, `src/App.jsx:1320`

**Evidence:** [home/sec-1440-newarrivals.jpg](screenshots/home__sec-1440-newarrivals.jpg), [catalog/motoroil-card-focus-ring.jpg](screenshots/catalog__motoroil-card-focus-ring.jpg), [home/sec-1440-depts.jpg](screenshots/home__sec-1440-depts.jpg)

- [ ] Done

#### AW-171 · Header search isn't exposed as a combobox: arrow keys do nothing and Enter jumps to an unseen first result

**Medium** · accessibility · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Header search (all routes)

**Problem:** The input has no role, aria-expanded, aria-controls or aria-autocomplete. After typing 'backwoods' ('3 results'), ArrowDown leaves focus in the input. Tab order is input → Search button → 'Close search results' → results, so results are reached only after two unrelated stops. Pressing Enter (submitSearch) opens the first hit's product page without saying which product that is. The <p role="status"> result count is mounted together with the results container, so the first count is often not announced. Results don't close on blur (see the focus-obscured finding).

**Also seen:**
- Header search input and results dropdown (.aw-search-results) — With 'geek bar' typed, ArrowDown and ArrowUp left focus in the input and highlighted nothing. Results can only be reached by pressing Tab past the Search button and the 'Close search results' button; the first result is the third Tab stop. The input has no role='combobox', aria-expanded, aria-controls, aria-autocomplete or aria-activedescendant, and the list has no listbox or option roles. The '10 results' role='status' element is created at the …

**Fix:** Implement the header search as an ARIA 1.2 combobox: role='combobox', aria-expanded, aria-controls, listbox/option roles, aria-activedescendant, and ArrowUp/Down/Home/End/Escape handling. Enter selects the highlighted option, or goes to a results page when nothing is highlighted (App.jsx:437, 459-465).

**Files:** `src/App.jsx:437`, `src/App.jsx:459`, `src/App.jsx:460`, `src/App.jsx:465`, `src/App.jsx:468`, `src/App.jsx:471`, `src/App.jsx:474`

**Evidence:** [a11y/kbd-search-results-focus.jpg](screenshots/a11y__kbd-search-results-focus.jpg), [nav/search-geekbar-dropdown-1440.jpg](screenshots/nav__search-geekbar-dropdown-1440.jpg)

- [ ] Done

#### AW-172 · Text inputs and selects have almost invisible borders (1.2–1.5:1; WCAG 1.4.11 needs 3:1)

**Medium** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Sign-in and application dialog fields, #/quote form, header search box, category 'Search in…' and 'Sort by', #/delivery state select, quick reorder inputs, admin table inputs

**Problem:** Measured computed colors. Dialog .form-grid input: border rgb(220,213,204) on white 1.46:1 and against its own fill #f8f6f2 1.35:1 (fill vs white 1.08:1). Header .aw-search: same 1.46:1. #category-search: border #d8d1c9 vs panel #f6f3ee 1.37:1. #category-sort: 1.51:1. #delivery-state: border vs cream panel 1.21:1. Mobile search border #b9aed0: 2.09:1. The 320px sign-in screenshot shows the Password field barely distinguishable from the dialog.

**Fix:** Add a token in :root, `--field-border: #857d8a;` (3.96:1 on white, 3.67:1 on #f8f6f2, 3.58:1 on #f6f3ee, 3.29:1 on cream #f5e8d8). Use it for the border color at index.css:89 (.aw-search), :270 (.category-sort select), :289 (.filter-search input), :381 (.qr-field input/.qr-choice select), :403 (.aw-table input/select), :445 (.form-grid input/select), :537 (mobile .aw-search, replacing #b9aed0), :674 (.eligibility-form select) and :800 (.doc-file). Also use it for the search button divider at :93.

**Files:** `src/index.css:89`, `src/index.css:270`, `src/index.css:289`, `src/index.css:381`, `src/index.css:403`, `src/index.css:445`, `src/index.css:537`, `src/index.css:674`, `src/index.css:800`

**Evidence:** [a11y/apply-form-field-borders.jpg](screenshots/a11y__apply-form-field-borders.jpg), [a11y/reflow-320-signin.jpg](screenshots/a11y__reflow-320-signin.jpg)

- [ ] Done

#### AW-173 · Form errors appear only as brief browser tooltips: no aria-invalid, no inline messages, no required/optional markers

**Medium** · accessibility · Who: **Cursor** · Effort: L · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/quote 'Your details' form; application dialog (Apply for an account); sign-in and reset dialogs; #/reset-password

**Problem:** #/quote with items: submitting the empty form moves focus to #quote-business and shows only Chrome's tooltip 'Please fill out this field.'. None of the 11 fields gets aria-invalid or aria-describedby. The labels ('Business', 'Contact', 'Email', 'Phone', 'Street', 'City', 'State', 'ZIP', 'Delivery method', 'Preferred date', 'Notes') give no hint that 8 are required and 'Preferred date'/'Notes' are optional. Application dialog: typing 'abc' in Federal EIN gives validity.valid=false ('Please match the requested format.') but no aria-invalid, no inline error and no invalid styling (screenshot). #/reset-password's custom errors ('The two passwords don’t match.') render in a <p role="alert"> not linked to either field. Only DocumentUploads sets aria-invalid/aria-describedby correctly.

**Also seen:**
- #/quote → 'Submit quote request' with all fields empty — Clicking submit on the empty form focused #quote-business with the native message 'Please fill out this field.' Measured: 8 fields matched :invalid, but aria-invalid was set on 0 elements, no .form-error text was rendered, and invalid fields kept the normal border rgb(220,213,204). Only the first field is flagged; the other 7 missing fields give no cue until each is reached. Labels ('BUSINESS', 'CONTACT', … 11px uppercase) have no required asteri…

**Fix:** Use custom validation on #/quote, the application, sign-in, reset dialogs and #/reset-password: mark required fields visibly, and on submit show inline error text tied through aria-describedby, set aria-invalid, and focus the first invalid field (or an error summary) instead of relying on the native bubble (App.jsx:1268-1297).

**Files:** `src/App.jsx:1268`, `src/App.jsx:1268-1297`, `src/App.jsx:1271`, `src/App.jsx:1286`, `src/components/AuthModal.jsx:33`, `src/components/AuthModal.jsx:231`, `src/components/AuthModal.jsx:252`, `src/components/DocumentUploads.jsx:72`, `src/index.css:444-446`, `src/index.css:451`, `src/pages/support/ResetPasswordPage.jsx:62`, `src/pages/support/ResetPasswordPage.jsx:70`

**Evidence:** [a11y/apply-form-field-borders.jpg](screenshots/a11y__apply-form-field-borders.jpg), [a11y/quote-empty-submit.jpg](screenshots/a11y__quote-empty-submit.jpg), [cart/quote-empty-submit-1440.jpg](screenshots/cart__quote-empty-submit-1440.jpg)

- [ ] Done

#### AW-174 · Much text is 9–12px site-wide, below the stylesheet's own 11px floor in many places

**Medium** · accessibility · Who: **Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** Footer policy links (every route); application dialog field hints; #/delivery state label; #/catalog SKU list; policy side-nav eyebrow; account/admin labels

**Problem:** index.css:25 says 'Nothing user-facing goes below --text-xs' (11px). Measured on the rendered pages: footer 'Delivery' / 'Privacy' / 'Trade terms' 10px, #a993d1 on purple, 15–17px tall, on every route; these are the only links to Privacy and Trade terms. Field hints in the application dialog ('At least 8 characters.', '9 digits, for example 12-3456789.') 10px. #/delivery label 'State your store is in' 10px. #/catalog SKU meta lines ('Brand · Line · SKU') 10px. Policy nav eyebrow 'CUSTOMER POLICIES' 9px. From source (signed-in views): .stat-card span 9px ('Account status', 'Pricing tier'), .status-pill 9px, .qr-field span 9px (the 'SKU'/'Qty' labels in Quick Reorder), .aw-table th 9px, .mini-btn 10px ('Reorder', 'Remove', 'Review cart').

**Also seen:**
- #/catalog SKU lists; footer policy links on every page; application/reset field hints; #/delivery state label; #/shipping policy nav; account and admin dashboards — The comment at index.css:25 reads 'Nothing user-facing goes below --text-xs' (11px), but 10 rules hard-code smaller sizes. 9px: .stat-card span (347), .status-pill (358), .qr-field span/.qr-choice span (380), .aw-table th (398), .policy-nav .eyebrow (727). 10px: .mini-btn (407; Reorder/Approve/Save/Remove/Review cart), .eligibility-form label (673), .field-hint (705; 'At least 8 characters.', EIN and licence hints), .sku-list small (762; 368 rows…
- Footer legal row → Delivery / Privacy / Trade terms — `.footer-policies button { font-size: 10px; color: #a993d1 }` measures 10px, with targets 37×17, 34×17 and 56×17px and contrast 5.83:1. index.css:25 declares 'Nothing user-facing goes below --text-xs' (11px). These are the only links to the privacy policy and trade terms.
- All routes → footer → .footer-policies — At 390x844: 'Delivery' 37x15px, 'Privacy' 34x15px, 'Trade terms' 56x15px. Font-size 10px in #a993d1 on the purple footer; there is 6px vertical and 16px horizontal gap between them. These are the only footer links to the Privacy and Trade terms pages, and they are the smallest text and targets on the site.
- #/account → Quick Reorder rows ('SKU', 'Qty', variant/product choice labels) — Live, mocked approved account at #/account, 1440x900: `.qr-field span` ('SKU', 'Qty') computes to 9px (index.css:380). The 'Remove' button on every row (.mini-btn) computes to 10px (index.css:407). The account stat labels 'Account status', 'Pricing tier' and 'Role' directly above (.stat-card span) compute to 9px (index.css:347). All of these are below the 11px --text-xs floor declared at index.css:25-26. The accessible names of the six inputs are…
- Auth modal hints ('At least 8 characters.', EIN, license, resale), #/reset-password hint — Computed font-size is 10px for .field-hint 'At least 8 characters.', '9 digits, for example 12-3456789.', 'From the state where the store is licensed.' and 'Sales tax resale or exemption certificate.'. index.css:25 says 'Nothing user-facing goes below --text-xs' (11px). Upload hints are overridden to 11px (index.css:802), so hint sizes are also inconsistent within one form.
- All support pages: policy-nav eyebrow, service-area label, SKU meta, card and step copy — Measured at 1440: .policy-nav .eyebrow 9px (index.css:727, #/shipping, #/privacy, #/terms); .eligibility-form label 10px (index.css:673, #/delivery); .sku-list small 10px (index.css:762, #/catalog). The comment on index.css:25 says nothing user-facing goes below --text-xs (11px). Running copy measured 13px muted rgb(107,102,112): .info-card p (629), .eligibility > div > p (671), .next-steps span (688), .support-cta p (658), .page-head > p (256), …
- Site-wide: product cards, product page, quote form, footer, trade bars, #/catalog, #/terms, #/delivery — The type token is `--text-xs: 11px`, and the stylesheet also hard-codes 10px and 9px, even though the comment at index.css:25 says 'Nothing user-facing goes below --text-xs'. Visible text under 12px at 390x844, summed over the 12 reviewed routes. 11px: card kicker (130 instances), block-label (108), 'LOCKED · Sign in for pricing' price-login button (98), 'Choose'/'QUOTE +' button text (98), card-tag BESTSELLER/NEW (26), trade-bar 'Apply'/'Call' l…
- #/ → card metadata, section links, top bars, footer — Computed at 1440: the '.card-meta .lock' text 'LOCKED · Sign in for pricing' is 11px #6b6670. .card-add ('Choose'), .card-kicker, .block-label and .card-tag are 11px. .card-detail (brand · variants · SKU) is 12px. Section links 'Shop novelties' and 'Browse the catalog' are 12px. The carousel's 'Slide 1 of 4' is 11px. The ticker, notice bar and utility phone are 11px, and the footer legal row is 11px. The footer policy links 'Delivery / Privacy / …
- Header utility row, account actions and navigation row — At 1440, 1024 and 860 (all identical): the trade-bar ticker, the Apply button and the .trade-only bar are 11px. The .aw-utility address and phone link are 11px, weight 400, rgb(107,102,112), and the phone link box is 83×14px. Sign In, Sign Up and Cart are 13px/700. The 'or' is 11px muted. New Arrivals, Bestsellers and Exotics are 12px/700. Quick Reorder and Help are 12px/600. Categories is 13px. `.trade-bar .trade-call` has display:none, so it me…

**Fix:** Raise the type tokens: nothing below 12px for labels/meta, 14-16px for body (index.css:25-28). Remove every 9-10px override: footer .footer-policies (index.css:766-767, which also need 44px tap targets), application/reset field hints (705, 802), #/delivery state label, #/catalog SKU lists (762), policy-nav eyebrow (727), Quick Reorder and account/admin labels (347, 358, 380, 407), and card pricing prompts. Make the header phone number prominent (larger, ink colour) and increase header utility/nav text.

**Files:** `src/App.jsx:448`, `src/App.jsx:1341`, `src/index.css:25`, `src/index.css:26`, `src/index.css:27`, `src/index.css:28`, `src/index.css:74`, `src/index.css:82`, `src/index.css:84`, `src/index.css:98`, `src/index.css:102`, `src/index.css:116`, `src/index.css:122`, `src/index.css:198`, `src/index.css:208`, `src/index.css:210`, `src/index.css:212`, `src/index.css:219`, `src/index.css:256`, `src/index.css:318`, `src/index.css:347`, `src/index.css:358`, `src/index.css:380`, `src/index.css:398`, `src/index.css:407`, `src/index.css:428`, `src/index.css:444`, `src/index.css:629`, `src/index.css:650`, `src/index.css:658`, `src/index.css:671`, `src/index.css:673`, `src/index.css:688`, `src/index.css:694`, `src/index.css:699`, `src/index.css:701`, `src/index.css:705`, `src/index.css:727`, `src/index.css:762`, `src/index.css:766`, `src/index.css:767`, `src/index.css:802`, `src/pages/account/QuickReorder.jsx:59-73`

**Evidence:** [a11y/apply-form-field-borders.jpg](screenshots/a11y__apply-form-field-borders.jpg), [design/account-admin-css-mock-1280.jpg](screenshots/design__account-admin-css-mock-1280.jpg), [design/apply-form-dialog-bottom-1440.jpg](screenshots/design__apply-form-dialog-bottom-1440.jpg), [design/policy-nav-9px-eyebrow.jpg](screenshots/design__policy-nav-9px-eyebrow.jpg), [design/footer-1440.jpg](screenshots/design__footer-1440.jpg), [nav/footer-bottom-edge-1440.jpg](screenshots/nav__footer-bottom-edge-1440.jpg), [responsive/footer-390-legal-policy-links.jpg](screenshots/responsive__footer-390-legal-policy-links.jpg), [auth/signup-form-1440-part0.jpg](screenshots/auth__signup-form-1440-part0.jpg), [support/shipping-1440-policy-layout.jpg](screenshots/support__shipping-1440-policy-layout.jpg), [support/delivery-1440-eligibility-AL.jpg](screenshots/support__delivery-1440-eligibility-AL.jpg), [responsive/home-390-card-label-overlap.jpg](screenshots/responsive__home-390-card-label-overlap.jpg), [home/sec-1440-newarrivals.jpg](screenshots/home__sec-1440-newarrivals.jpg), [home/crop-footer-bottom.jpg](screenshots/home__crop-footer-bottom.jpg), [nav/header-1440.jpg](screenshots/nav__header-1440.jpg), [nav/zoom-utility-row.jpg](screenshots/nav__zoom-utility-row.jpg)

- [ ] Done

#### AW-175 · In Windows High Contrast / forced-colors mode you can't tell which variant or product-line filter is selected

**Medium** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all (forced-colors: active)

**Where:** #/product/<id> variant chips; #/category/* product-line pills; also the hamburger bars and filter icon

**Problem:** Screenshots: screenshots/a11yv2__chips-forced-active.jpg, screenshots/a11yv2__pills-forced-active.jpg, screenshots/a11yv2__hamburger-forced-active.jpg, screenshots/a11yv2__filtericon-forced-active.jpg

**Fix:** Add a non-color selected indicator that everyone sees, e.g. `.variant-chips button[aria-pressed="true"]::before, .sub-pill[aria-pressed="true"]::before { content: '✓ ' / ''; }` (the `/ ''` keeps the glyph out of the accessible name), or a 2px inner border. Also add `@media (forced-colors: active) { .variant-chips button[aria-pressed="true"], .sub-pill.active { border: 3px solid Highlight; } .aw-menu-bars i, .filter-icon::after { background: ButtonText; } }` at the end of index.css.

**Files:** `src/index.css:264`, `src/index.css:274`, `src/index.css:324`, `src/index.css:530`

**Evidence:** [a11y/forced-colors-variant-chips.jpg](screenshots/a11y__forced-colors-variant-chips.jpg), [a11y/forced-colors-sub-pills.jpg](screenshots/a11y__forced-colors-sub-pills.jpg), [a11y/normal-variant-chips.jpg](screenshots/a11y__normal-variant-chips.jpg)

- [ ] Done

#### AW-176 · Age gate: no initial focus, ambiguous copy, and 'No, exit' is a dead end that a reload undoes

**Medium** · accessibility · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Age gate (verified = false) → 'No, exit'

**Problem:** On load document.activeElement is BODY, even though the gate is role=dialog aria-modal. After 'No, exit' the buttons unmount and focus falls to BODY. The page then has 0 focusable elements. The new h1 "We're sorry —" has no id, so the dialog's aria-labelledby="age-gate-title" points to nothing, and the change isn't announced. There is no way back other than reloading.

**Also seen:**
- Age gate (any route, first visit) → 'No, exit' — vcode-05-agegate.mjs output: labelTargetExists false, active BODY, links 0, stored null, ss 0. Screenshot: screenshots/vcode__agegate-no-exit-deadend.jpg
- Age gate (fresh visit, aw-age-verified unset) — App.jsx:369-373: H1 'Are you 21 or older?' and body 'This site lists tobacco and vapor products for licensed retail businesses. Access is restricted to trade accounts and adults 21 years or older.' The phrase 'trade accounts and adults' reads as either/or, which conflicts with 'NO CONSUMER SALES', and the gate never asks whether the visitor buys for a licensed business. 'No, exit' (:373) swaps in 'We're sorry —' / 'You must be 21 years or older t…

**Fix:** Move focus into the age gate on open and trap it there. Rewrite the copy to clearly ask for 21+ and state that the site is for licensed retailers. On 'No, exit', show a proper exit screen with a message and heading, remove the dangling dash, persist the decline for the session, and don't lose the dialog's accessible name (App.jsx:282, 362-373).

**Files:** `src/App.jsx:282`, `src/App.jsx:362`, `src/App.jsx:364`, `src/App.jsx:369`, `src/App.jsx:370`, `src/App.jsx:372`, `src/App.jsx:373`, `src/App.jsx:377`, `src/App.jsx:378`, `src/App.jsx:379`

**Evidence:** [a11y/age-gate-no-exit-dead-end.jpg](screenshots/a11y__age-gate-no-exit-dead-end.jpg), [code/agegate-no-exit-deadend.jpg](screenshots/code__agegate-no-exit-deadend.jpg), [copy/age-gate-1440.jpg](screenshots/copy__age-gate-1440.jpg)

- [ ] Done

#### AW-313 · Footer headings are h4 directly after page h1/h2, skipping a level on 14 routes

**Low** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Footer column headings 'Departments', 'Account & help', 'Contact' on every route

**Problem:** axe heading-order at 1440: footer h4 on the 11 routes listed. At 390: the same 11 plus #/category/TOBACCO and #/category/CANDIES/Chocolate%20Bars, where the failing node is the first product card's h3, not the footer. Heading sequence on #/quote: H1 'Your cart is empty' > H4 Departments > H4 Account & help > H4 Contact.

**Fix:** 1) App.jsx:1318, 1323, 1333: change the three footer <h4> elements to <h2>. 2) index.css:418: change the selector `.footer-grid h4` to `.footer-grid h2`. The rule already sets font, letter-spacing and margin 0 0 12px and outranks the global h2 rules at index.css:161-164, so nothing else is needed. 3) For category pages on phones/tablets, where the 'Filters' h2 at App.jsx:1018 is not rendered, add `<h2 className="sr-only">Products</h2>` as the first child of the results wrapper <div> at App.jsx:1025. The product-card <h3> (App.jsx:820) then always sits under an h2.

**Files:** `src/App.jsx:1018`, `src/App.jsx:1025`, `src/App.jsx:1318`, `src/App.jsx:1323`, `src/App.jsx:1333`, `src/index.css:418`

- [ ] Done

#### AW-314 · Landmark problems: trade bars outside any landmark, duplicate 'Customer policies' nav, role=dialog on <aside>, 8 extra nav landmarks in the mega menu

**Low** · accessibility · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Trade bar + 'WHOLESALE TO LICENSED RETAIL…' strip (all routes); #/shipping, #/privacy, #/terms; cart drawer, mobile menu, filter drawer; Categories mega menu

**Problem:** axe 'region' on every route: .trade-only, plus .trade-call at 390, sit outside all landmarks because they render before <header>. axe 'landmark-unique' on #/shipping, #/privacy, #/terms: PolicyNav and the footer both use <nav aria-label="Customer policies">. axe 'aria-allowed-role' (minor) on the cart drawer, #aw-mobile-menu and #aw-filter-drawer: `<aside role="dialog">`. With the mega menu open, the accessibility tree gains a region 'Browse by department.' plus 8 navigation landmarks named 'Tobacco', 'Novelties & Vapes' … 'Drinks & Bags', which floods landmark navigation.

**Also seen:**
- #/ → .trade-bar and .trade-only — axe-core run on #/ at 1440x900 (runOnly region/landmark rules): one 'region' violation, target '.trade-only' ('WHOLESALE TO LICENSED RETAIL BUSINESSES ONLY · NO CONSUMER SALES · 21+'). DOM check: .trade-bar and .trade-only are both children of the root wrapper div (App.jsx:292), outside <header class="aw-header container"> (App.jsx:445), <main> (App.jsx:315) and <footer>.
- #/shipping, #/privacy, #/terms → policy side nav and footer policy nav — axe 'landmark-unique' fails on all three policy pages at 1440 and 390. The side nav <nav aria-label='Customer policies'> (SupportShell.jsx:60) duplicates the footer <nav className='footer-policies' aria-label='Customer policies'> (App.jsx:1341), so screen-reader landmark lists show two identical entries.
- Cart drawer container — axe-core run on #aw-layers with the drawer open: 'aria-allowed-role' (minor), 'ARIA role dialog is not allowed for given element' on <aside class="drawer">. The mobile menu (App.jsx:569) and filter drawer (App.jsx:995) use the same pattern.

**Fix:** Move the trade bar and 'wholesale to licensed retail' strip inside the <header> landmark (App.jsx:293-300). Give the policy side-nav and the footer policy nav different aria-labels (SupportShell.jsx:60, App.jsx:1341). Change the cart drawer, mobile menu and filter drawer from <aside role='dialog'> to <div role='dialog' aria-modal='true'> (App.jsx:569, 995, 1390). Drop the extra <nav> landmarks inside the mega menu (App.jsx:531).

**Files:** `src/App.jsx:293`, `src/App.jsx:300`, `src/App.jsx:531`, `src/App.jsx:569`, `src/App.jsx:995`, `src/App.jsx:1341`, `src/App.jsx:1390`, `src/pages/support/SupportShell.jsx:60`

**Evidence:** [home/crop-topbars-2x.jpg](screenshots/home__crop-topbars-2x.jpg)

- [ ] Done

#### AW-315 · On phones the trade-bar tab order is the reverse of the visual order

**Low** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: ≤600px

**Where:** Purple trade bar at ≤600px: 'Apply for a trade account ↗' (left) and 'Call (205) 354-4473' (right)

**Problem:** Fresh-load tab order at 390x844 is 1 'Call (205) 354-4473' (shown on the right), then 2 'Apply for a trade account' (shown on the left). The DOM has the call link first (App.jsx:296) and CSS `order` swaps them visually (index.css:564-565). This fails WCAG 2.4.3 / 1.3.2 meaningful sequence.

**Fix:** Swap the DOM order at App.jsx:296-297 so the Apply button comes before the call link. Delete the `order` rules at index.css:564-565, and on desktop, where the call link is hidden, keep the layout the same with `margin-left: auto` on the Apply button.

**Files:** `src/App.jsx:296`, `src/App.jsx:297`, `src/index.css:564`, `src/index.css:565`

**Evidence:** [a11y/reflow-320-home-top.jpg](screenshots/a11y__reflow-320-home-top.jpg)

- [ ] Done

#### AW-316 · Screen-reader naming nits: 'Cart, 1 items', decorative glyphs read aloud, bare counts, unannounced new tab, two different pages both called 'Delivery'

**Low** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Header cart button; mega menu 'All Tobacco →'; #/catalog '+ All 68 Tobacco SKUs'; application checklist '✓'; mobile menu department counts; #/contact 'Get directions'; footer/policy nav 'Delivery'

**Problem:** Cart button aria-label is 'Cart, 1 items' (App.jsx:498). Mega menu links read 'All Tobacco →' ('right arrow'); the arrow isn't aria-hidden (App.jsx:536). The <details> summary's accessible name is '+ All 68 Tobacco SKUs' and checklist items read '✓ Federal EIN …', because CSS ::before glyphs (index.css:692, :756) are included in the name. Mobile menu departments read 'Tobacco 68', 'Candies 58' with no unit (App.jsx:580). 'Get directions' opens Google Maps in a new tab without warning (ContactPage.jsx:37). The footer and policy nav have 'Delivery' (#/shipping policy) and 'Delivery & service area' (#/delivery): two pages with nearly the same name.

**Fix:** App.jsx:498: `aria-label={`Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}`. App.jsx:536: `All {c.label} <span aria-hidden="true">→</span>`. App.jsx:580: `<span className="menu-count">{c.count}<span className="sr-only"> products</span></span>`. index.css:692 `content: '✓' / '';` and index.css:756 `content: '+' / '';` (and '−' / '' at :757). ContactPage.jsx:37: add `<span className="sr-only"> (opens in a new tab)</span>`. Rename the #/shipping policy label to 'Delivery policy' in SupportShell.jsx:10 POLICY_LINKS and footer App.jsx:1342.

**Files:** `src/App.jsx:498`, `src/App.jsx:536`, `src/App.jsx:580`, `src/App.jsx:1342`, `src/index.css:692`, `src/index.css:756`, `src/pages/support/ContactPage.jsx:37`, `src/pages/support/SupportShell.jsx:10`

- [ ] Done

