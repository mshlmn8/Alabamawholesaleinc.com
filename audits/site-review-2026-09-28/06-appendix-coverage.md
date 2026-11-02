# Appendix: what each reviewer covered

Coverage notes from each review agent, including what they could not check.

## Home page (desktop) (home) — 40 kept / 40 found
Checked the home route #/ with Playwright only (the lib.mjs helper; age gate bypassed with aw-age-verified=yes; guest, empty cart, light scheme). The dev server on 127.0.0.1:3000 was up and serving the 2a-editorial worktree. The page logged no console errors, page errors or failed requests.

Viewports: 1440x900, 1280x800 and 1920x1080, each above the fold, full page and per section (trade bar, notice bar, header, carousel, New arrivals, Collections, Bestsellers, services, Shop by department, apply panel, footer). Also measured card alignment at 1100 and 1024.

Hero: visited all 4 slides with Pause + Next. Measured each image's natural and rendered size and how much of the stage it covers, and the alt text. Timed autoplay (4.5s), and checked whether it pauses on hover and on keyboard focus (it doesn't). Checked the reduced-motion state.

Measurements: computed font sizes and colours for every text style on the page, contrast ratios, card heights and CTA rows at each width, whether labels and badges overlap the photos, and department-tile offsets. Ran axe-core (wcag2a/aa, 21, 22 and best-practice): 3 violations, no h1, 'DC' initials contrast 1.4:1, and bars outside landmarks. Tabbed through the first 40 stops; the focus ring is now visible on cards, so the earlier all:unset issue is fixed. Tested hover states on 16 element types. 2x/4x crops of the logo, nav row and footer bottom.

Header interactions: Categories mega-menu at 1440x900, New Arrivals/Bestsellers anchor jumps (they land correctly, 24px offset), search dropdown ('geek'), Help dialog, and Quick Reorder as a guest (it now shows a Sign in action, so that part of prior item #11 is fixed).

Source read: src/App.jsx lines 1-850 and 1300-1441, src/index.css in full, src/data/content.js, src/data/theme.js, src/lib/images.js, src/lib/useCatalog.js, src/components/Picture.jsx, index.html, the relevant rows of src/data/products.js (NEW_ARRIVALS_IDS, bestseller/NEW tags, the Kratom & Kava and Detox lines, Dubai chocolate), and the PolicyPage titles. Also read the prior audit (2026-09-25).

Things fixed since that audit and not re-reported: the placeholder phone number, 'Browse the catalog' now opening an all-products page, variant selection, the focus ring on cards, the missing og.jpg, and the Quick Reorder sign-in action.

Not checked:
- Signed-in or approved buyer states and card prices/steppers with items in the cart (no accounts are allowed).
- The age gate itself, dark mode, and mobile or tablet layouts below 1024 (other reviewers cover those).
- Real production performance or LCP (dev server only).
- Live Supabase data versus the static catalog. The page rendered the same 368-SKU catalog; I didn't check whether it came from Supabase or the static file.

The kratom (Alabama Schedule I) and FDA nicotine-warning findings are compliance risks to confirm with counsel, not legal conclusions.

Evidence screenshots are in screenshots/.

## Header, navigation, search & footer (nav) — 37 kept / 37 found
The dev server on http://127.0.0.1:3000/ was up the whole time. I drove it only with Playwright through scratchpad/pw/lib.mjs, using scripts prefixed nav-*.mjs.

Viewports
- Main: 1440×900 and 1024×768.
- Spot checks of the header at 860, 920, 1100, 1280 and 1920 wide.
- Reduced-motion emulation at 1440 and 1024.
- Age gate in the unverified state (1440).
- Some crops at 3× device scale for the logo and chevron.

Routes exercised
#/, #/category/TOBACCO, each of the 8 departments and all 24 sub-lines linked from the mega menu (every mega-menu link was clicked and landed on the correct hash and H1), #/catalog, #/product/1, #/product/5, #/contact, #/delivery, #/shipping, #/privacy, #/terms, #/apply, #/account (signed out).

Header
- Ticker: speed, loop seam, hover behaviour, reduced-motion fallback, aria-hidden.
- Notice bar and utility row, including the tel: link.
- Logo: rendered size, pixel analysis of logo.jpg, comparison with the age-gate and footer wordmarks.
- Search:
  - More than 40 queries, including snickers, SNICKERS, AW-SS, zyn, swisher, xyz123, snikers, snick, geek bar/geekbar, red bull/redbull, hersheys, candy/candies, disposable/disposables, marlboro, 1-character queries and 'aw-'.
  - Uncapped match counts computed from the catalog module.
  - Keyboard: ArrowUp/Down, Enter, Escape, Tab order.
  - Empty and short submits, native clear button, outside click, ARIA attributes.
- Sign In, Sign Up and trade-bar Apply open the right dialogs. Nothing was typed or submitted.
- Cart badge with counts of 3, 129 and 1500, set through the helper's cart option.
- Categories menu: hover (click-only by design), click, outside click, Enter/Space/Escape, focus return, Tab order, focus leaving the menu, viewport overflow, internal scroll.
- New Arrivals and Bestsellers from home, category, product and contact pages. They land correctly with a 24px offset.
- Exotics, Quick Reorder, and the Help dialog (content; Escape, overlay and × closing; focus trap and return; Apply link; browser Back behaviour).
- Sticky behaviour when scrolled, and count of internal anchors vs buttons, including a middle-click test.
- History growth when clicking the current page.

Footer
Every button and link was clicked from a fresh load and its destination recorded. Department counts (68/51/60/58/24/47/16/44) match the catalog exactly. I also measured font sizes and contrast for all footer text, spacing around the legal row and warning bar, and the 1024 layout.

axe-core over the trade bar, notice bar, header and footer found 0 violations in three states: default, mega menu open, and search open.

Source read
App.jsx sections 1–357 (root, router, search scorer), 390–618 (Header, MobileMenu) and 1308–1441 (Footer, Help, Cart drawer); index.css header, footer and responsive rules; content.js; theme.js; the top of products.js; useCatalog.js; ModalLayer.jsx; PolicyPage.jsx and SupportShell.jsx (policy links). I also read the prior audit.

Not checked
- Signed-in, approved-buyer and admin header states, because creating accounts or signing in is not allowed. The findings about those states come from reading the code only.
- Dark mode, the phone menu drawer below 850px, and the mobile header, which belong to other reviewers.

Prior-audit items in this area that are now fixed and not reported
- The placeholder phone number, now (205) 354-4473.
- The Quick Reorder destination missing a sign-in action.
- The missing footer policy and support pages.

## Catalog index & department pages (catalog) — 33 kept / 33 found
Dev server on 127.0.0.1:3000 was up the whole time. The page loads the live Supabase catalog (368 active rows via GET /rest/v1/products); I captured it and diffed it against src/data/products.js: 0 differences. No console errors on normal routes. Only malformed-hash routes threw errors.

Routes checked:
- #/catalog (desktop 1440 and mobile 390, full page, expanded SKU lists, jump bar).
- All 8 departments at 1440 (card-by-card audit after scrolling to load lazy images): TOBACCO, NOVELTIES, MERCHANDISE, CANDIES, FOOD%20STUFF, GROCERY, MOTOR%20OIL, DRINKS%20%26%20BAGS.
- Sub-lines, 2+ per department via pills and direct URLs: TOBACCO/Cigarettes, TOBACCO/Wraps & Leafs, CANDIES/Chocolate Bars, CANDIES/Jars, CANDIES/Bags, FOOD STUFF/Coffee, MOTOR OIL/Motor Oil, DRINKS & BAGS/Bags & Carriers, MERCHANDISE/OTC & Health, NOVELTIES/Wellness Pills, plus the first pill of each tested department.
- Invalid routes: #/category/FOO, /tobacco, /Tobacco, TOBACCO/Nonexistent Line, TOBACCO/cigarettes, trailing slash, empty #/category/, and the malformed %E0%A4%A.

Viewports: 1440×900, 1280, 1100, 1024×768, 900, 768 (mobile layout), 600, 390×844 (mobile UA), 360. Label/badge overlap and button alignment were measured at all of these.

Interactions:
- Every sort option, with order verified programmatically on Tobacco, Candies and Drinks & Bags.
- Tag checkboxes, 'Has variants', in-department search, chips, Clear all (history and scroll effects), empty state.
- Mobile Filter & Sort drawer: focus on open and close, Escape, 'Show 0 items'. Sticky mobile toolbar.
- State after Back and after reload; scroll animation measured on open-product and Back.
- QUOTE + add (focus loss) and Choose routing.
- Stale-filter flash on department switch.
- axe-core on #/category/TOBACCO main (only color-contrast on placeholder initials) and on #/catalog main (0 violations).
- Canvas sampling of photo backgrounds.

Files read: src/App.jsx (1-1048, all catalog/category/card/router code), src/index.css (all), src/pages/support/CatalogIndexPage.jsx, SupportShell.jsx, src/lib/lines.js, useCatalog.js, images.js, src/components/Picture.jsx, src/data/products.js (header, rows cited, derived exports), scripts/build-seed.mjs (sku check).

Not checked:
- Signed-in states (approved buyer price display, 'Price: Low/High' sorts, 'ADD +' label, 'Pricing after approval' text), since signing in is not allowed. Price sorting was reviewed only in code (App.jsx:886-887).
- Dark mode (the stylesheet has no dark scheme).
- The real Chrome tab (Playwright only, per instructions).

Prior-audit items in my area that are now fixed and not reported:
- 'Browse the catalog' opening Tobacco (it now goes to #/catalog).
- Mobile filters preceding the grid (now a drawer with chips and count).
- The card focus outline being overridden (a focus ring is now visible).

Evidence screenshots are in screenshots/. Scripts are catalog-*.mjs in the pw folder; the live catalog JSON is at pw/out/catalog-live-products.json.

## Product detail pages (product) — 32 kept / 32 found
Dev server on 127.0.0.1:3000 was up. All browsing used the Playwright helper (lib.mjs) with remote writes blocked. No forms were submitted, no sign-in happened, and nothing was typed into password fields.

Product pages opened at 1440x900 and 390x844 (mobile emulation), with DOM measurements for H1, image box, Add-button position, chips, sell unit, crumbs, related items and overflow. 66 ids: 1, 9, 11, 12, 14, 16, 17, 19, 86, 267, 273, 318, 329, 241, 60, 62, 64, 67, 69, 219, 311, 317, 313, 22, 31, 33, 147, 193, 265, 286, 162, 166, 174, 182, 190, 200, 342, 37, 45, 47, 295, 326, 350, 351, 359, 20, 53, 111, 122, 135, 333, 55, 56, 98, 100, 105, 58, 89, 143, 145, 290, 291, 335, 336, 93, 205. That covers all 8 departments and includes no-photo, 8-variant, single-variant, zero-variant and sellUnit products.

Also opened, with element screenshots:
- ids 88, 57, 77, 263, 64, 7, 149, 357, 21, 237, 334, 151, 248, 267, 270 and others.
- #12 at 1024, 900 and 768.

Photo check: all 291 product photos were compared against their names via 10 contact sheets (catalog-photo-contact-sheet-01..10.png), with every suspected mismatch confirmed on its PDP.

Flows tested:
- Variant required/disabled state; forced click; select, qty 3, add.
- Cart key and drawer line carry the variant (works: '162::king-size', 'Snickers bars — King size | AW-SNICKERS-KING-SIZE').
- Switching variant; − at 1; 120 × +.
- Add feedback at 1440 and 390.
- Category → product → Back (filters and scroll lost).
- Breadcrumb and 'View department' targets; related-card click and scroll behaviour.
- Keyboard focus on chips.
- Invalid ids 0, 99999, abc, -1, 1.5, 01, 1abc, %20 and empty.
- Unverified direct product link through the age gate.
- Titles/meta/canonical/og tags.
- axe-core on 162, 9 and 14.

Data checks: the live Supabase catalog (anon GET) was diffed against src/data/products.js (identical across 368 rows) and confirmed to return prices to anonymous visitors.

Files read: src/App.jsx (1–300, 795–1170), src/index.css (tokens, cards, product, responsive), src/lib/lines.js, src/lib/images.js, src/lib/useCatalog.js, src/components/Picture.jsx, src/data/products.js, index.html head, scripts/build-images.mjs (widths), scripts/build-seed.mjs (price check), and the RLS / product_copy / launch_order_boundaries migrations. Prior audit read and cross-referenced; variant-into-cart and product-card focus look fixed and are not reported.

Not checked:
- Approved-buyer and pending-buyer PDP states (price display, 'Add to order', 'View approval status'), since signing in was not allowed; reviewed in code only.
- Actual quote submission.
- Dark color scheme.
- 2x/retina rendering (DPR 1 only, so the retina blur is inferred from source sizes).
- Physical devices.

Evidence screenshots: screenshots/

## Cart drawer, quote/checkout & quick reorder (cart) — 33 kept / 33 found
The dev server at http://127.0.0.1:3000 was up for the whole review. Every check used the Playwright helper, with remote writes blocked; Supabase GET reads were allowed. I submitted nothing, signed in nowhere, and typed nothing into password fields. The only submit I clicked was on the empty quote form.

Routes and states checked:
- #/category/CANDIES, #/category/TOBACCO and #/category/GROCERY: card QUOTE +, stepper, Choose, and keyboard focus after each.
- #/product/14 (no variant), #/product/1 (8 variants; added the Red and Grape variants plus qty), #/product/115 (single variant).
- Header cart badge: aria-label, 4-digit counts.
- Cart drawer at 1440 and 390, guest: line +/−/remove, decrement to zero, empty state, Escape to close, focus on open and return to the Cart button, Tab trap order, background inert, body overflow lock, scroll position kept on open and close. Bare variant-less line from a seeded reorder-shaped cart.
- Persistence after reload with no seeded cart. Corrupt aw-cart values: null, array, fractional, unknown ids and variants.
- #/quote as a guest with items and with an empty cart at 1440, 1024, 860, 768 and 390: field types, autocomplete and labels, native validation on empty submit, date/ZIP/state/phone validity, will-call behaviour, form-state loss on navigation, Clear all, focus after remove.
- #/account signed out, reached from the header Quick Reorder link at 1440 and 390; mobile menu entry.
- axe-core run on #/quote and on the open drawer.
- resolveSkuLine run in the browser against all 368 products: every variant SKU round-trips, with no duplicate SKUs or variant-slug collisions.
- Live Supabase products compared with the static catalog: no differences in count, variants, price or SKU. Noted that price is readable by anonymous users.

Files read: src/App.jsx (root cart state, Header cart button, ProductCard, ProductPage, QuotePage, CartDrawer), src/lib/lines.js, src/lib/orders.js, src/lib/useCatalog.js, src/lib/useAuth.js (profile loading), src/pages/account/QuickReorder.jsx, src/pages/account/AccountPage.jsx, src/components/ModalLayer.jsx, src/data/content.js, the relevant src/index.css rules, index.html, src/main.jsx, supabase/migrations/20260925120000_launch_order_boundaries.sql (submit_quote and price trigger), and parts of the initial schema and RLS policies.

Not checked:
- Signed-in, pending, approved and admin states. No test account exists and creating one is not allowed, so the approved-buyer price display, the Checkout CTA, the below-minimum notice, the account order history Reorder button and the Quick Reorder form UI were reviewed from code only.
- The post-submit confirmation screen and real submit_quote behaviour; filled forms were not submitted.
- iOS Safari zoom and scroll-lock behaviour; inferred from computed font sizes under Chromium mobile emulation.
- Dark mode, since the cart and quote styles have no dark theme to compare.

Prior audit mapping: #2 (variant identity in the cart) and #13 (quote label association, dialog focus trapping and restore) are now fixed and not reported. #8 (receipt contract) is partially fixed: atomic RPC, ship-to fields and server pricing are in place, but notifications, date/route validation and duplicate prevention are still missing. #11 (Quick Reorder signed out) is partially fixed: a Sign in button now exists. #5 (prices exposed to guests) is still open.

## Sign-in, trade application, reset password, account & admin (signed-out) (auth) — 41 kept / 41 found
Dev server on 127.0.0.1:3000 was up. All browser work used the Playwright helper, which blocks remote non-GET requests. Nothing was typed into password fields, and no application, sign-in, reset or other form was submitted with data; only empty-form submits were used, plus reading validationMessage after entering obviously invalid values ('abc', 'x').

Entry points exercised at 1440x900 and 390x844 (mobile emulation), recording the mode opened, initial focus and focus after Escape:
- Header Sign In / Sign Up
- Mobile menu Sign In / Sign Up / 'Apply for a trade account' CTA
- Trade-bar 'Apply for a trade account'
- Home 'Start application'
- Footer 'Apply for account' / 'Sign in'
- #/apply 'Start application' / 'Already applied? Sign in' / 'Reset your password'
- #/reset-password 'Request a new reset link'
- #/account 'Sign in'
- Product #/product/1 'Apply for account'
- Help dialog 'Apply for an account'
- Not exercised: the cart-drawer sign-in (not present with an empty cart) and the category filter sign-in panel (locator timed out; that belongs to the catalog area).

States checked:
- Sign-in, checklist, application form, reset-request steps: empty submit, EIN pattern, backdrop close with data-loss check, tab order, step-change focus handling.
- File upload UI using generated test files via setInputFiles: valid PDF, .txt rejection, 11 MB rejection, clearing the selection. Never submitted.
- Dialog sizing and scrolling at 1440, 390 and 844x390 landscape.
- Signed-out pages #/apply, #/reset-password, #/account, #/admin at both widths (full-page and viewport screenshots, CTA positions measured).
- Auth link fragments: expired-link error fragment and a fake type=recovery token. Only a GET to Supabase /auth/v1/user was made, which returned 403.
- axe-core on main for the four pages and on the sign-in and application modals: 0 violations.

Files read: src/components/AuthModal.jsx, DocumentUploads.jsx, ModalLayer.jsx, ServiceUnavailable.jsx; src/pages/support/ApplyPage.jsx, ResetPasswordPage.jsx, SupportShell.jsx, parts of PolicyPage.jsx; src/pages/account/AccountPage.jsx; src/pages/admin/AdminPage.jsx; src/lib/useAuth.js, documents.js, supabase.js; src/data/onboarding.js and parts of content.js; auth-related parts of src/App.jsx (shell, header, mobile menu, home apply section, footer, Help dialog) and src/index.css; supabase migrations (initial schema, RLS, launch_order_boundaries, application_fields, application_documents); BACKEND.md notes.

Not verifiable without submitting or signing in, so these were reviewed from code only:
- Signed-in and pending account views, the 'Check your inbox' and pending-status modal steps.
- A real password-recovery session, the admin dashboard as an admin.
- Actual Supabase error strings, email delivery, and the Supabase Auth settings (password policy, email confirmation, redirect allow-list).

Dark mode was not checked; the site has no dark theme tokens in this area.

## Support pages: contact, delivery, shipping, privacy, terms, apply, catalog index (support) — 38 kept / 39 found
Dev server on http://127.0.0.1:3000 was up for the whole run. Browser: Playwright only, via the shared lib.mjs with remote writes blocked. No console errors, page errors or failed requests were logged on any support route.

Routes checked: #/contact, #/delivery, #/shipping, #/privacy, #/terms, #/apply, #/catalog.
- Full-page screenshots at 1440×900 (desktop) and 390×844 (mobile emulation).
- Overflow and layout checks at 1024×768, 768×1024 and 320×640. No horizontal page scroll at any width.

States and interactions exercised:
- Delivery state select with AL, FL, 'Another state' and empty.
- Policy side-nav clicks, the inline 'Delivery' link in Terms, sticky nav while scrolling, and browser back.
- The 'Start application' dialog opened from both #/contact and #/apply (not submitted).
- Department jump buttons and expanding the 'All N SKUs' lists on #/catalog.
- Focus position after support navigation.
- axe-core (wcag2a/aa, 21aa, 22aa, best-practice) on all 7 routes at both viewports.
- Measured computed font sizes, margins, tap-target sizes, line length in characters, pill overflow and alignment, and every tel:, mailto: and Google Maps directions href. All hrefs are correct; Get directions has target=_blank and rel=noopener noreferrer.

Files read:
- src/pages/support/SupportShell.jsx, ContactPage.jsx, DeliveryPage.jsx, PolicyPage.jsx, ApplyPage.jsx, CatalogIndexPage.jsx
- src/data/content.js, src/data/onboarding.js
- Support and responsive sections of src/index.css
- App.jsx routing, meta, footer and help dialog
- src/components/DocumentUploads.jsx, ServiceUnavailable.jsx, parts of AuthModal.jsx
- src/lib/documents.js (head)
- supabase/migrations/20260927180000_application_documents.sql (policies grep)
- index.html JSON-LD and Netlify forms, public/sitemap.xml
- products.js (parsed for variant counts and the Kratom/Mushroom lines)

Not checked:
- Signed-in StatusPanel and ApplicationDocuments states on #/apply (pending, approved, suspended). No sign-in allowed, so the related finding is from code only.
- #/reset-password (outside the assigned list).
- Dark mode, and real tel:/mailto: handoff on devices.

Business facts (hours, routes, Net-30, discounts, delivery fees, kratom content of SKUs) cannot be verified from the site and need owner or legal confirmation. Evidence screenshots are in screenshots/.

## Mobile & tablet responsiveness (responsive) — 26 kept / 26 found
The dev server on 127.0.0.1:3000 was up for the whole run. Nothing was logged at any viewport: no console errors, no page errors, no failed or blocked requests. No forms were submitted and nothing was typed into password fields.

Viewports checked with Playwright via lib.mjs (isMobile/hasTouch on 390x844, 844x390 and 932x430): 360x740, 390x844, 430x932, 768x1024, 1024x768 and 844x390. Extra widths were used for breakpoint sweeps: 600, 601, 640, 700, 851, 900, 960, 1280x800, 1280x720, 932x430. Short landscape heights were used for the age gate: 844x340, 568x320, 932x300, 667x280, 568x260.

Routes measured at all six main viewports (scrollWidth vs clientWidth, header bottom / % of viewport, text nodes under 12px, interactive elements under 44px, first-screen screenshot): #/, #/catalog, #/category/CANDIES, #/category/CANDIES/Chocolate%20Bars, #/product/162 (Snickers, variants), #/product/12 (long name, variants), #/product/306 (no photo), #/quote with a 5-line cart (two lines needing a variant choice), #/apply, #/contact, #/delivery, #/terms. Also looked at #/account (signed out), #/reset-password, and #/category/TOBACCO, NOVELTIES and MERCHANDISE plus their sub-lines.

States opened and measured: cart drawer, sign-in modal, apply checklist and application-form modals (including scrolled), Help dialog, mobile menu drawer, Filter & Sort drawer (including with active chips), header search results ('gum'), desktop Categories mega menu at 1024x768 and 932x430, the 21+ age gate (unverified), and the carousel on all four slides (paused).

Result on horizontal overflow: no page-level horizontal scroll at any tested viewport or route (scrollWidth equals clientWidth everywhere), so no offending element to report.

Files read: src/index.css (all 812 lines), src/App.jsx (all 1441 lines), src/components/ModalLayer.jsx, AuthModal.jsx, Picture.jsx, DocumentUploads.jsx, src/lib/useMediaQuery.js, images.js, lines.js, useCatalog.js (part), supabase.js (part), src/data/content.js (part), theme.js, products.js (header and rows), src/pages/support/SupportShell.jsx, ContactPage.jsx, DeliveryPage.jsx, ApplyPage.jsx, PolicyPage.jsx, CatalogIndexPage.jsx, index.html, and the 2026-09-25 prior audit.

Not checked:
- Real devices, the iOS/Android on-screen keyboard (effect on dvh, search results and modals) and Safari-specific toolbar behaviour. Landscape heights of 260–340px were used as stand-ins for browsers with visible chrome.
- Signed-in, pending or approved states (no sign-in allowed): pricing columns, account order history, quick reorder rows and the admin table at phone width. Their 9–10px CSS is only mentioned from source.
- Dark mode (not part of this area).

Evidence screenshots are in screenshots/. Measurement scripts are responsive-*.mjs in the pw folder.

## Accessibility (WCAG 2.2 AA) (a11y) — 26 kept / 26 found
The dev server at http://127.0.0.1:3000 was up for the whole session. I drove it only with Playwright via scratchpad/pw/lib.mjs (remote non-GET requests blocked) and did not submit any real form. I clicked Submit only on empty quote and application forms to observe validation.

**axe-core 4.x** (tags wcag2a/2aa/21a/21aa/22aa + best-practice), run at 1440x900 and at 390x844 (mobile) on:
- Pages: the age gate (unverified); #/, #/catalog, #/category/TOBACCO, #/category/CANDIES/Chocolate, #/product/1, #/quote (empty and with items, including a line that still needs a variant), #/apply, #/contact, #/delivery, #/privacy, #/terms, #/shipping, #/account, #/reset-password, #/admin.
- Open states: cart drawer, sign-in modal, apply modal (checklist and form), Categories mega menu, search results / no results, Help dialog.
- Mobile-only states: mobile menu, filter drawer, mobile cart, Help opened from the menu.

**Manual checks and measurements:**
- Keyboard: full desktop journey from the header, through search, product, add to quote, cart and quote; tab order at mobile.
- Focus: trapping and return for the cart, Help, sign-in, mobile menu and filter drawer (all work: Escape closes them, focus traps, focus returns to the opener, and #root is inert).
- Focus-ring contrast, computed per focused element on the age gate, #/, #/product, #/contact and #/apply.
- Focus obscured by the mega menu, the search panel and the sticky mobile toolbar (the toolbar does not fully hide focus).
- Carousel: auto-rotation, live region, hover/focus behaviour and reduced motion; the ticker animation.
- Heading outline and landmarks from the CDP accessibility tree; accessible names via ariaSnapshot.
- Alt text: all 4 hero slides, plus shared-photo product rows checked against the live pages.
- Text contrast on 11 pages plus the dialogs and mobile menu. Text colours now pass everywhere except the placeholder initials and labels over photos, the latter measured with per-pixel canvas sampling.
- Tiny text under 11px, input boundary contrast, forced-colors emulation.
- Target size (WCAG 2.5.8): all undersized targets pass through the spacing exception.
- Reflow: no horizontal scroll at 320x568 or at 640x450 (200% zoom) on 13 routes; 320x256 checked.
- Text-spacing override (WCAG 1.4.12): no clipping.
- Reduced motion: CSS and carousel handled correctly; only the ticker ignores the need for a pause control.

**Files read:** src/App.jsx (all), src/index.css (all), src/components/ModalLayer.jsx, AuthModal.jsx, DocumentUploads.jsx, Picture.jsx and ServiceUnavailable.jsx; src/pages/support/* (all); src/pages/account/AccountPage.jsx and QuickReorder.jsx; grep of src/pages/admin/AdminPage.jsx; src/data/content.js; src/lib/images.js and lines.js; src/data/products.js (image fields); index.html.

**Items from the prior audit's accessibility section now fixed, so not reported:** label associations, dialog focus management and inert background, the product-card focus outline (all:unset is gone), and hero orange-on-cream text (the hero no longer has text; muted and orange text colours now measure ≥4.5:1).

**Not checked:**
- Signed-in, approved and admin views: Quick Reorder, order history and the admin tables. Their tiny-text issues come from the CSS source only.
- The submitted-quote receipt screen.
- Real screen readers: VoiceOver and NVDA behaviour is inferred from the accessibility tree and the ARIA used.
- Windows forced-colors rendering was emulated in Chromium, not tested on Windows.
- Safari/WebKit rendering of headings inside buttons.
- Zoom via the browser's actual zoom setting, approximated by viewport size.

Evidence screenshots are in screenshots/. The raw axe JSON is at scratchpad/pw/a11y-axe-1440.json and a11y-axe-390.json.

## Content, copy & business-fact consistency (copy) — 36 kept / 36 found
Dev server on http://127.0.0.1:3000 was up the whole time, and every route was driven with Playwright through the scratchpad helper. No console errors, page errors or blocked writes occurred.

Routes whose rendered text, document.title, meta description and og tags I captured at 1440×900: #/, #/catalog, #/category/TOBACCO, #/category/NOVELTIES, #/category/NOVELTIES/Kratom & Kava, #/category/NOVELTIES/Mushroom Products, #/category/FOOD STUFF, #/category/DRINKS & BAGS, #/category/NOPE (404), #/product/1, 60, 61, 75, 100, 171, 211, 265, 293, 308, #/product/9999 (404), #/quote (empty, and with a seeded guest cart), #/account (signed out), #/admin (guest), #/contact, #/delivery (state checker set to AL, TX and 'Another state'), #/shipping, #/privacy, #/terms, #/apply, #/reset-password (signed out).

States and overlays: age gate (unverified), Help dialog, guest cart drawer with items, Sign-in, Checklist, Apply form and Reset modes of the auth dialog (no submission; no password typed), mega menu, header search (no results, and 'kratom'), mobile header and menu at 390×844. Measurements: nicotine warning font size, colour and position; H1 count on the home page; text-transform on the eyebrows.

Sources read in full: src/App.jsx; src/data/content.js, onboarding.js, theme.js; products.js (analysed programmatically for templated copy, casing, units, 'flavors' misuse, SKU truncation, sensitive categories); src/components/AuthModal.jsx, DocumentUploads.jsx, ServiceUnavailable.jsx; src/pages/support/* (all 7); src/pages/account/AccountPage.jsx and QuickReorder.jsx; AdminPage.jsx (copy grep only); src/lib/orders.js, useAuth.js, useCatalog.js, documents.js (strings); index.html (meta and JSON-LD); public/site.webmanifest, robots.txt, sitemap.xml; the pricing-tier migrations. I also read the prior audit from 2026-09-25.

Items from the prior audit that I found fixed and so did not report: the placeholder phone (now (205) 354-4473); JSON-LD vs footer weekend hours (both 08:00–17:30); service-area inconsistency (AL/MS/GA everywhere except the manifest); the 'Backend not configured' developer message; the missing Contact, Delivery and policy pages (they now exist, but their gaps are reported); the missing quote address fields.

Could not check:
- Signed-in, pending, approved and admin states: no sign-in allowed. The account-page and admin copy comes from source review only.
- The submitted and receipt states of quotes and applications (no submission allowed).
- Actual email templates sent by Supabase.

The legal points (Alabama kratom scheduling, FDA nicotine-warning rules, FDA warnings on enhancement products, synthetic-urine restrictions) are flagged for owner and counsel confirmation, not given as legal advice.

The live catalog is served from the Supabase products table (it matched the static file). Every products.js copy fix therefore also needs the seed regenerated (supabase/seed/products.sql) and the database updated.

## Catalog data integrity (data) — 30 kept / 30 found
Area: catalog data integrity. I analyzed the data with node scripts in scratchpad/pw (data-01 … data-19) and drove the running site at http://127.0.0.1:3000 (up throughout) with Playwright through lib.mjs.

Files analyzed: src/data/products.js (all 368 CATALOG rows, NEW_ARRIVALS_IDS, NAV_CATEGORIES); src/data/content.js; src/lib/images.js; src/lib/lines.js (SKU resolution tested with a copied module); src/lib/useCatalog.js; supabase/seed/products.sql (parsed and diffed); scripts/build-seed.mjs; supabase/migrations (products RLS, launch_order_boundaries trigger, product_copy); src/pages/admin/AdminPage.jsx (products table); src/pages/support/CatalogIndexPage.jsx; src/assets/products (272 files) and src/assets/generated (1,284 files, 276 bases); src/assets/products/sources/*.md (all 8); README.md and BACKEND.md; git history of products.js. Evidence is under scratchpad/evidence/data/: contact-sheet-0..7.png are photo contact sheets of all 291 imaged rows, and catalog-dump.txt is the full grouped catalog.

Checks that came out clean (no findings):
- Ids 1–368 are contiguous and unique.
- No duplicate SKUs, names (case-insensitive) or descriptions.
- flavors == variants.length on every row, so the prior audit's 38 mismatches are fixed.
- No duplicate variant slugs within a product and no variant-SKU collisions.
- Every referenced image exists, no image file is unreferenced, and every photo has a generated responsive set.
- The seed SQL matches products.js exactly (0 diffs across 368 rows × 12 columns).
- The live Supabase products table (anon GET, 368 active rows) matches products.js exactly (0 diffs).
- Department counts in the UI are now derived from data; only content.js has hard-coded counts.

Routes and states checked:
- 1440×900: #/ (New arrivals and Bestsellers rails, editorial card); #/catalog (index rows); #/category/NOVELTIES/Kratom%20%26%20Kava; #/category/CANDIES (in-page search with straight vs curly apostrophes, plus header search dropdown); #/category/GROCERY (all four Featured tag filters); #/category/GROCERY/Hardware; #/category/DRINKS%20%26%20BAGS/Sports%20Drinks; #/product/60, 205, 270, 263, 77, 209; #/quote with a seeded localStorage cart (130::yellow, 276, 60 variant) to read generated SKUs.
- 390×844 mobile: #/category/MERCHANDISE/Apparel.
- Everything was viewed signed out, in light mode, with age verification set.

Not checked:
- Approved-buyer price display and tier math: no credentials, and signing in is not allowed.
- The admin UI in the browser: the 200-row cap is from source.
- Actual Wikimedia and retailer license terms: not fetched.
- Legal status of specific products: kratom, blue lotus, FDA-flagged items, synthetic urine and vape authorization are flagged for owner and counsel confirmation, not legal conclusions.
- Whether prices are real: they are inferred to be placeholders from implausible inversions and their unchanged origin in the initial commit. The owner should confirm.

No files in the repo were modified and no npm scripts were run.

## Product photo QA — Tobacco, Novelties, Merchandise, Candies (photos1) — 14 kept / 14 found
Area photos1: product photo QA for TOBACCO (68 rows), NOVELTIES (51), MERCHANDISE (60) and CANDIES (58), 237 rows in total: 196 with a photo, 41 without.

Data and sources checked:
- Parsed CATALOG from src/data/products.js with line numbers.
- Captured the live Supabase `products` response through Playwright (GET only). All 368 live `img` values match the static rows, so what the site shows comes from these files.
- Read natural pixel size, format and alpha of every source in src/assets/products with sharp.
- Checked the generated responsive sets in src/assets/generated; none are missing.
- Read src/lib/images.js, src/components/Picture.jsx, scripts/build-images.mjs, the card and PDP markup in src/App.jsx (lines 755, 815–817, 1090–1092) and the relevant index.css rules (lines 158, 192, 202–207, 311–312, 465, 577–580, 596).
- Read the photo source notes in src/assets/products/sources/*.md and verified the licences of the 4 Wikimedia Commons files on their Commons pages.
- Read the 2026-09-25 audit. Item 3 (missing photos) is now partially fixed: 173 photo-less rows catalog-wide became 77. Item 15 (responsive image sizes) is fixed, so it is not reported.

Contact sheets and automated scans:
- Built and read 18 contact sheets of 12 tiles each, covering every photo on a card-coloured tile with id, name, brand, variants, file and pixel size. Copies are in evidence/photos1/sheet-*.png.
- Scanned the bottom-right corner of all 196 photos for watermarks. Only #262 has one.
- Ran a perceptual-hash duplicate scan. It found no re-uploaded duplicates under different names in these departments; the only duplicates are the shared filenames reported in the findings.
- Classified each photo's border background (white, transparent, grey or coloured).
- Measured how much of the card each product fills after trimming its margin.
- Ran a sharpness ratio check. It found no high-pixel-count files that look soft at display size (TOP, BIC and Game box inspected at 560px).
- Rendered close-ups of the suspect photos listed in the findings.

Live site checks (Playwright via the lib.mjs helper, age gate bypassed):
- Took full-page screenshots of #/category/TOBACCO, NOVELTIES, MERCHANDISE and CANDIES at 1440x900 and read them in slices. At 1440, 68/51/60/58 cards rendered, with no "load more".
- Took a Novelties grid screenshot at 390x844 with mobile emulation.
- Measured overlap between the photo and the label/tag chips at 1440 and 390.
- On the home page (1440), checked the New arrivals, Bestsellers and Shop-by-department tiles.
- On product pages, measured #/product/263, 77, 209, 218, 3 and 262 at 1440 and 390, and took crop screenshots of 70, 305, 15, 334 and 263.
- Previewed two CSS fixes by injecting styles in the browser, not in the repo: absolute positioning for the product-page photo, and mix-blend-mode multiply on card photos. Both worked.
- No console errors or failed requests were logged on the routes checked.

Not checked or out of scope:
- The FOOD STUFF, GROCERY, MOTOR OIL and DRINKS & BAGS photos belong to another area. I only noticed that the four Red Bull files (#143–#146) hash identically; I did not verify it.
- Dark mode, the admin photo-upload flow, and signed-in or approved-buyer states were not checked.
- Photo identity was judged visually from the pack artwork. I could not confirm which exact flavour or size of each SKU the business actually stocks, so the flavor-mismatch fixes offer either swapping the photo or correcting the variants.
- #66 RAZ Vue Pods and #75 Wava kava look plausible and are not reported.
- Licences of the retailer, manufacturer and distributor images (Kroger, Target and others) were not assessed beyond noting their source; only the Wikimedia Commons licences were verified.

Nothing in the repo was modified. All scripts and outputs are in the scratchpad (pw/photos1-*.mjs, pw/photos1/, evidence/photos1/).

## Product photo QA — Food Stuff, Grocery, Motor Oil, Drinks & Bags, plus hero/logo/share images (photos2) — 25 kept / 25 found
Dev server on 127.0.0.1:3000 was up the whole time. Supabase GET reads were allowed: the live products table has 368 rows, and its img values match static src/data/products.js for all 131 rows in my departments. Nothing was submitted and no repo files were modified. All browsing was Playwright via the pw helper.

Photo QA (every product in FOOD STUFF 24, GROCERY 47, MOTOR OIL 16, DRINKS & BAGS 44 = 131 rows; 95 with photos, 36 without):
- Built 8 captioned contact sheets from src/assets/products originals (id, name, brand, category/sub, variants, file, dimensions, shared-with) and read every one.
- Checked 1:1 native-resolution crops for ~50 photos.
- Measured natural dimensions, format and alpha with sharp.
- Computed a Laplacian sharpness ratio (full vs half size) to catch upscaled or soft files, trimmed-content fill, and corner background color.
- Ran perceptual-hash duplicate detection across all 272 product files, a can-bounding-box comparison for the Red Bull set, and a hero_gatorade vs p_gatorade diff.
- Read src/assets/products/sources/{drinks-bags,food-stuff,grocery,motor-oil}.md and cross-checked them against the actual files.
- No watermarks were found on any photo in these departments.

Routes and viewports:
- #/category/FOOD%20STUFF, GROCERY, MOTOR%20OIL, DRINKS%20%26%20BAGS: full-page at 1440x900, card data (currentSrc, natural and rendered size) for all 131 cards.
- #/category/DRINKS%20%26%20BAGS/Sodas and /Energy%20Drinks at 390x844 mobile.
- #/product/<id> for about 30 ids (20, 46, 47, 56, 57, 59, 88, 101, 104, 110, 113, 114, 120, 122, 204, 205, 21, 248, 270, 271, 280, 290, 292, 324, 326, 328, 333, 335, 346, 355, 360, 51, 89) at 1440 (1x and 2x density) and at 390.
- #/ hero carousel: all 4 slides at 1440, 1024, 768 and 390, measuring stage vs image size and alt text.
- Home department tiles and editorial cards at 1440 and 390, with Supabase reads both allowed and blocked.
- Header logo at 1440, 1024 and 390.

Proposed CSS fixes were verified by injecting styles in Playwright: product-page image containment, hero containment, multiply blending and label padding. Injected fixes and screenshots are in evidence/photos2.

Brand assets: inspected src/assets/logo.jpg, the hero_*.jpg sources, public/og.jpg, icon-512/192, apple-touch-icon, favicon-32 and the favicon.ico entries (16/32/48). Measured pixel rows for the edge-line defect and confirmed all are served with HTTP 200.

Code read: src/lib/images.js, src/components/Picture.jsx, src/lib/useCatalog.js, src/data/theme.js, src/data/content.js (HERO_SLIDES), src/App.jsx (HeroCarousel, HomePage, ProductCard, product page media, header logo, pageMeta), src/index.css image rules, scripts/build-images.mjs, index.html head, public/site.webmanifest, .gitignore, and supabase/seed/products.sql image fields.

Not checked or out of scope:
- Tobacco, Novelties, Merchandise and Candies photos (another reviewer's area), apart from site-wide notes in the product-page crop finding.
- Image licensing can't be verified from here; the provenance finding is a risk flag based on the sources notes.
- Real-device rendering and production CDN delivery.
- Other-page open-graph behavior beyond the shared og.jpg.

## SEO, metadata & performance (seo) — 24 kept / 24 found
Checked on the dev site http://127.0.0.1:3000 with the Playwright helper; it was up the whole time and I did not restart it.

Metadata capture at 1440x900 on 29 hash routes: #/, #/catalog, all 8 departments, one sub-line (TOBACCO/Cigars & Cigarillos), #/category/FOO, #/product/1, /9, /61, /368, /9999, /abc, #/quote, #/account, #/admin, #/contact, #/delivery, #/shipping, #/privacy, #/terms, #/apply, #/reset-password and #/does-not-exist. For each I recorded title, description, canonical, og:* and twitter:* tags, h1, anchor/button counts and console output; results are in meta-per-route.json.

Console pass at 390x844 (mobile, dark scheme, cart pre-filled) on 16 routes, with interactions: filter drawer, mobile menu, cart drawer, header search, sign-in modal, and the age gate's "No, exit". There were 0 console errors or warnings, 0 page errors and 0 failed requests.

Crawler views: a fresh unverified session on #/, #/product/61 and #/category/TOBACCO, and a JavaScript-disabled load. I also used curl to check robots.txt, sitemap.xml, site.webmanifest, the favicon set and og.jpg (all 200), and confirmed that /catalog, /product/1, /wp-admin and other arbitrary paths return a 200 SPA fallback. JSON-LD parses as valid JSON. I visually inspected og.jpg, the icons and favicon-32, and measured their edge pixels with sharp.

Performance: I ran `npx vite build` into scratch pw/dist-seo, plus a second sourcemap build into pw/dist-seo-map, and decoded the sourcemaps to get bundle composition (bundle-composition.txt). The repo stayed clean (git status). I served the build with `vite preview` on 4180, which gzip-compresses, and with a small gzip static server on 4181 in scratch as a cross-check. Measurements used chromium launched directly:
- LCP, CLS, long tasks and FCP via PerformanceObserver, with 4x CPU throttling and Lighthouse slow-4G conditions (562.5 ms latency, 1.47 Mbps) over CDP.
- Pages: home, #/category/TOBACCO and #/product/61, at 412x823 DPR 1.75 (2 runs on 4181, 1 on 4180) and desktop 1350/1440 unthrottled.
- LCP phase breakdown, a font-blocked CLS A/B test, a 15-second carousel LCP-drift test at 1440 and 390, JS/CSS coverage, and image request lists plus currentSrc/sizes checks at 412 and 1440.

Both preview servers were killed afterwards (ports 4180/4181 closed).

Read-only Supabase: one anonymous GET of the products endpoint (via the app's own request) confirmed price columns are returned. I didn't print env values.

Files read: index.html, vite.config.js, netlify.toml, package.json, tailwind.config.js, .gitignore, README.md, public/*, scripts/build-images.mjs, src/App.jsx (full), src/main.jsx, src/index.css (tokens, carousel, crumbs, cards), src/fonts/fonts.css, src/lib/images.js, src/lib/useCatalog.js, src/lib/supabase.js, src/lib/orders.js, src/components/Picture.jsx, src/data/theme.js, src/data/content.js, the head and tail of src/data/products.js, CatalogIndexPage.jsx and SupportShell.jsx (navigation elements), and supabase/migrations/20260517000001_rls_policies.sql. I also read the prior audit (items 5, 13, 14, 15).

Not checked:
- Real Netlify production headers and compression, or brotli.
- Google Search Console, indexing or CrUX field data.
- Live social-scraper previews (Facebook/iMessage debuggers).
- Safari/Firefox fallback-font metrics (CLS was measured in Chromium with macOS system fonts; Android lacks Verdana and may shift less).
- Signed-in or approved-buyer states, since no sign-in was allowed.
- Lighthouse scoring as such (I used raw PerformanceObserver metrics instead).

## Code quality & functional bugs (code) — 42 kept / 42 found
Dev server on 127.0.0.1:3000 was up the whole time (HTTP 200). I read the whole repo, read-only: src/App.jsx (all 1,441 lines), src/main.jsx, src/components/* (AuthModal, ModalLayer, DocumentUploads, Picture, ServiceUnavailable), src/lib/* (useAuth, useCatalog, lines, orders, documents, images, supabase, useMediaQuery), src/pages/** (Account, QuickReorder, Admin, and the support pages Apply, CatalogIndex, Contact, Delivery, Policy, ResetPassword, SupportShell), src/data/content.js, onboarding.js, theme.js, the products.js header and tail (plus a script over all 368 CATALOG rows checking duplicate SKUs, variant slug collisions, flavors vs variants and cross-department subs; none found), index.html, public/*, package.json, vite/tailwind/postcss configs, README.md, the compiled dist CSS, and the supabase migrations (initial schema, RLS, launch_order_boundaries/submit_quote, application_fields, product_copy).

Runtime checks, all with Playwright via the helper (scripts prefixed code-*.mjs):
- Router edge cases (13 hashes, including malformed %E0, trailing slashes, unknown, lowercase and non-canonical ids) and the in-app hashchange crash.
- localStorage cases: aw-cart null, array, string, fractional, huge and missing ids, plus a blocked-storage SecurityError.
- Age gate on #/privacy: 'No, exit', then reload.
- Back/forward and scroll: filter state after Back, smooth-scroll sampling, duplicate history from Clear all and repeated pill clicks, section jumps on desktop and a 390px mobile menu.
- Live-catalog race: the Supabase products response mocked with an extra id 369.
- Expired password-reset link (#error=…otp_expired) plus header, mega menu, footer and logo navigation.
- Quote form: native validation on an empty submit, past date, free-text ZIP/state.
- Modal scroll lock.
- A console-warning sweep of 24 routes plus cart, menu, mega menu, filter drawer and the sign-in/apply dialog at 1280 and 390 (mobile): no warnings or errors.

Signed-in states (approved silver buyer, pending applicant, admin) were simulated only inside the test browser. I put a fake session in localStorage, and page.route answered every Supabase request locally with fake profile/orders/products or aborted it. No credentials were typed, no account was created, and no write reached Supabase: the admin PATCHes were aborted locally. No quote, order, application, contact or reset form was submitted with data; only an empty quote submit was clicked, to see native validation.

Not checked:
- A real successful submit_quote round trip. The cart-not-cleared and ref-collision findings come from reading the code.
- Real email recovery links with a valid token. Only the expired/error link path was exercised.
- Windows classic-scrollbar layout shift. Headless Chromium on macOS has overlay scrollbars, so the modal-shift finding is from code.
- Physical devices.

Prior audit: its items 7 (live catalog), 8 (atomic, server-priced submit), 11 (catalog index, reorder), 13 (dialog focus) and the lucide-react dependency are fixed in code and not re-reported. Findings tied to its item 8 (duplicate prevention, server-side receipt) are marked partially-fixed. Security topics outside this area, such as public price exposure, were left to the security reviewer.

All evidence screenshots are in screenshots/.

## Security, backend & data boundaries (security) — 32 kept / 32 found
Area: security, backend and data boundaries. Everything was read-only. Nothing was submitted, and Supabase received no writes and no custom calls. I only watched the storefront's own GET /rest/v1/products request through the helper.

Files reviewed:
- All 6 supabase/migrations/*.sql, supabase/seed/provision_owner.sql, the head and ON CONFLICT clause of supabase/seed/products.sql, scripts/build-seed.mjs.
- src/lib: orders.js, documents.js, useAuth.js, useCatalog.js, supabase.js, lines.js, images.js.
- src/components: AuthModal.jsx, DocumentUploads.jsx.
- src/pages: admin/AdminPage.jsx, account/AccountPage.jsx (parts), support/ApplyPage.jsx, support/ResetPasswordPage.jsx, support/PolicyPage.jsx (privacy/terms).
- src/App.jsx: root, router, pricing helpers, QuotePage, CartDrawer.
- src/data/content.js, src/data/onboarding.js, BACKEND.md, README.md, NETLIFY-DEPLOY.md, netlify.toml, index.html, .gitignore, .env.example, .npmrc, vite.config.js, package.json, and the dist/ build output.

Checks:
- .env.local: variable names and key type only. It holds VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (JWT role=anon, not service_role). It is gitignored and was never committed.
- Git history, all 48 commits on all branches: no JWTs, sb_secret_, service_role or supabase.co URLs. No values were printed.
- Installed versions: vite 5.4.21 (patched for the 2025 dev-server CVEs), @supabase/supabase-js 2.105.4. The dev server listens on 127.0.0.1 only. No source maps in dist.

Live checks (Playwright, 1280/1440 px, age-verified, signed out):
- Anonymous products GET returns price on 368/368 rows. The live DB already has the description and sell_unit columns.
- The static bundle carries 368 prices.
- The crafted #error_description link renders attacker text on the reset page.
- #type=recovery with no token shows the expired-link state.
- Client-side document validation accepts disguised PDF/PNG files and rejects files over 10 MB. Files were only chosen, never submitted.
- The signup form has no CAPTCHA or honeypot.
- The Netlify hidden forms are present in the live DOM.

Prior audit items 5–8:
- Fixed: first signup no longer becomes admin; client unit prices and totals are ignored (server pricing); order and items are saved atomically through submit_quote; the guest insert no longer needs a readable row; the UI requires status=approved before showing prices.
- Still open: public exposure of trade prices.
- Partially fixed: the storefront catalog (useCatalog is used, but has a silent static fallback and reseeds overwrite admin edits); the order receipt contract (no notifications).
- New: the owner-provisioning path now matches on a user-editable email column.

Could not check:
- Whether the deployed Supabase project actually has all migrations applied (the RPC is POST-only and was not called).
- Auth dashboard settings: SMTP, email confirmation, CAPTCHA, password policy, secure password change, redirect allow-list.
- Whether a pre-fix admin account exists in production.
- Real Netlify response headers, because the site is not deployed from this worktree.
- Signed-in, pending, approved, suspended and admin journeys, because no accounts may be created.

Source: https://supabase.com/docs/guides/auth/auth-smtp (default SMTP delivers only to team addresses, about 2 emails per hour).

## Visual design system & cross-page consistency (design) — 37 kept / 37 found
Area: visual design system and cross-page consistency (key: design). The dev server at http://127.0.0.1:3000 was up the whole time. The site was driven only through the Playwright helper; scripts are pw/design-*.mjs and evidence is in scratchpad/evidence/design/.

Routes rendered and inspected:
- 1440×900: #/, #/catalog, #/category/TOBACCO, #/product/1, #/quote (empty and with cart lines), #/account (signed out), #/admin (signed out), #/contact, #/delivery, #/shipping, #/privacy, #/terms, #/apply, #/reset-password.
- 390×844 mobile: #/ and #/category/NOVELTIES (including the filter drawer and footer).
- 1280: the CSS mock described below.

Overlays and states inspected:
- Mega menu, cart drawer (filled and empty), Help dialog, sign-in dialog, application checklist dialog and the full application form dialog.
- Header search results and the no-results state, category empty results, PDP variant/disabled/after-add states, and cart badge at 3, 48 and 240.
- Keyboard focus on the age gate and on the contact-strip buttons.
- Age gate at 1440 and 390.

Measurements:
- Computed styles were aggregated across routes: every rendered font-size, line-height, letter-spacing, family, weight, color, background, border and radius.
- About 40 distinct button signatures were enumerated.
- Actual rendering fonts for the icon glyphs were read through CDP CSS.getPlatformFontsForNode.
- Also measured: logo pixels, spacing, placeholder widths and mobile input font sizes.

Dark mode: colorScheme 'dark' was compared with 'light' on #/, #/quote, #/category/TOBACCO and #/delivery. The site has no prefers-color-scheme rules and no color-scheme declaration, so it renders identically in light. Nothing breaks, so this is not reported as a flaw.

Print: page.pdf (Letter) was produced for #/quote (3 pages) and #/product/1 (4 pages).

Source read in full: src/index.css (all 813 lines), src/App.jsx, AuthModal.jsx, the support pages, AccountPage.jsx, the top of QuickReorder.jsx and the relevant parts of AdminPage.jsx, theme.js, useCatalog.js, Picture.jsx, tailwind.config.js and index.html.

Compared against: ../wireframes/skeleton/STYLE-GUIDE.md, ../wireframes/qa/screenshots/2a-editorial-split-hero-desktop.png and ../wireframes/Alabama-Wholesale-Website/assets/logo.png.

Prior audit (2026-09-25): read. Items fully fixed are not re-reported, including: Account/Admin are no longer Tailwind+lucide (now plain CSS, no lucide imports), labels are associated, and the Geek Bar hero ad is gone.

Not checked:
- Signed-in #/account and #/admin could not be rendered for real, because signing in is not allowed. Their styles were evaluated with a CSS-only DOM mock injected into the page using the exact class names from AccountPage, QuickReorder and AdminPage; nothing was submitted.
- No real toast system exists, so toast feedback was assessed as absent. Add-to-cart feedback is only a card-to-stepper swap, the badge count and an inline PDP note.
- Pages were not tested on real iOS; the zoom finding is inferred from the measured sub-16px input font sizes.
- Intermediate tablet widths (768–1100) and the mobile menu drawer were only glanced at; the responsive and navigation reviewers cover them.
- The reset-password recovery form and the pending-status document panel were not rendered, because they need an auth session.

## Approved, pending and suspended buyer storefront, dashboards and confirmation screens, rendered with mocked auth (gap1-approved-buyer) — 19 kept / 20 found
The dev server on 127.0.0.1:3000 was up for the whole run (HTTP 200). Everything was driven with Playwright through pw/code-fakeauth-lib.mjs (openAs). Scripts are pw/gap1ab-01 … gap1ab-19 and pw/gap1ab-fixtures.mjs. Evidence is in scratchpad/evidence/gap1-approved-buyer/.

Nothing reached Supabase:
- Profiles, orders and profile_documents GETs were answered locally.
- For admin I also fulfilled profiles?order=created_at and products GETs with mock data built from the static CATALOG.
- rpc/submit_quote was fulfilled locally with page.route. The assertions showed the POST was intercepted, the openAs handler saw no other writes, and logs.blocked was empty.
- The form was filled only with 'TEST ONLY' / 'test@example.test' / '000-000-0000' placeholders. No password fields were touched.

States and viewports:
- Silver approved, gold approved, pending, suspended, admin (approved), and a long business name, with and without admin.
- 1440x900, 1024x768 and 390x844 (mobile:true), plus 900 and 700 for cards and 1280 for the admin selects.

Routes and areas covered:
1. Header and mobile menu in every state: name link, Admin/Sign Out placement, truncation, banners.
2. Product cards on #/, #/category/CANDIES and #/category/TOBACCO: price typography, labels, row stacking at 700/900/1024/390, alignment.
3. Price Low→High and High→Low on CANDIES, TOBACCO and DRINKS & BAGS, checked programmatically:
   - 0 order violations;
   - no ties in these departments;
   - the static catalog has no null prices (the schema makes price NOT NULL);
   - ties would keep 'Featured' order (stable sort);
   - the price options are hidden for non-approved users.
   No sort defect was found, so none is reported.
4. PDP #/product/162, 1, 14, 11 and 37 at qty 6, for silver/gold/pending/suspended.
5. Cart drawer with 3 and 12 lines (total over $2,000, lines needing a variant).
6. #/quote by direct load and by in-app navigation; the prefill check used a profile with phone and state set.
7. The post-submit confirmation for silver at 1440 and 390, and for pending.
8. #/account with 0, 1 and 25 orders, every status, 30-line and unpriced orders, and long notes; Reorder; Quick Reorder with variant select, not-found, qty 0/2.5/150000, and 20 rows.
9. #/admin Orders/Accounts/Products with many rows and empty data, sticky headers, overflow, select widths, SKU search and the edit row.
10. Pending and suspended copy across #/, category, PDP, drawer, #/quote and #/account.

Not checked, and why:
- The 'choose-product' duplicate-SKU select: the static catalog has no duplicate SKUs.
- The admin document View links: they need storage signing.
- Real Supabase behaviour.

Deliberately not re-reported (already known):
- the 'Choose' vs 'ADD +' labels;
- thousands separators;
- the unenforced minimum;
- the free-delivery meter;
- the blank checkout on direct load (auth loading);
- the cart not clearing;
- the missing server total on the receipt;
- the admin role dropdown, EIN column, lowercase values and micro-typography;
- the Quick Reorder landing;
- the variant-choice qty loss.

Prior-audit mapping (2026-09-25):
- 'still-open': the history not distinguishing quote vs order (audit #8, 'Distinguish quote requested, accepted order…', and #12 'order status'), and the missing saved ship-to (audit #12).
- 'partially-fixed': the receipt, since the server RPC now returns a receipt (audit #8) but the screen shows nothing from it; and the pending status, since audit #1 asked for an explicit pending-approval screen, which exists only in the modal and on #/account.

## Safari/WebKit rendering and touch-device behaviour (never tested; every reviewer used Chromium) (gap1-webkit-touch) — 5 kept / 6 found
Engines: Playwright 1.63, Chromium (HeadlessChrome 153) and WebKit build 2336 at ~/Library/Caches/ms-playwright/webkit-2336/pw_run.sh (UA Version/26.6 Safari). Both used the same safety route (only 127.0.0.1:3000, data:, blob: and Supabase GETs allowed) and set aw-age-verified through addInitScript. Firefox is not installed and was not tested. The dev server on :3000 was up throughout; nothing was submitted and no repo files were touched. Scripts are pw/gap1wt-*.mjs. Evidence is under scratchpad/evidence/gap1-webkit-touch/ (raw/, sbs/ side-by-sides, diff/ pixel diffs, forms/, glyphs/).

1) Side-by-side screenshots and pixel diffs at iPhone 390x844 (isMobile, hasTouch, DPR 3) and 1440x900 for #/, #/category/TOBACCO, #/category/CANDIES/Chocolate%20Bars, #/product/162, #/product/12, #/quote (cart {'14':3,'162::king-size':2}), #/apply, #/contact, #/terms, plus the age gate in a fresh context. Layout is essentially identical in both engines: same scrollWidth/scrollHeight within 1px, same H1 boxes, and pixel diffs of 0.6–6% are anti-aliasing and image resampling only. The same holds at 375x667 and 320x568 on 9 routes, with no horizontal overflow in either engine. The same fonts load (DM Sans; Barlow Condensed 500/700). Glyphs ⊞ ⌄ ↗ → × ✓ − + have identical measured widths and heights and no emoji or tofu in macOS WebKit. iOS's system font fallback could not be tested on a Mac. Underlines, buttons, the mega menu, the cart drawer, details/summary on #/catalog, and the sticky .category-toolbar, .category-filters and .policy-nav all match.

WebKit differences found and reported: the navigation scroll bug, the carousel offset, select styling and date-field rendering. The file input and search cancel button differ natively but are covered by known findings.

2) Overlays (cart, Sign in, Sign up, Help, mobile menu, filter drawer) in both engines:
- #root gets inert and aria-hidden, and focusing a background button is blocked.
- body overflow is hidden; wheel scrolling and PageDown over the backdrop did not move the page (WebKit desktop, Chromium).
- A Chromium CDP touch scroll over the open drawers did not move the page, and the drawer body stopped at its end. Native touch-scroll gestures cannot be synthesized in Playwright WebKit (mouse.wheel is unsupported in mobile WebKit), so the scroll lock is untested on real iOS.
- dvh max-heights resolve (dialog max-height 796px at 844).
- backdrop-filter computes to blur(3px) in WebKit, but Playwright WebKit screenshots do not paint backdrop-filter even on a minimal control page (webkit-blur-control-test.png), so the blur could not be judged visually. Not reported.
- The production CSS in dist/ does contain -webkit-backdrop-filter (autoprefixer). Only the dev-server CSS lacks it, so older-Safari support is fine in production.
- Opening and closing overlays kept the page position within about 15–45px.

3) Touch: page.tap on Cart, sub-pills, QUOTE +, carousel controls, footer links, steppers, Add to quote, and iPad nav items (reported as the sticky-hover finding). tap-highlight-color is already transparent via Tailwind preflight.

4) Carousel swipe: confirmed that it does nothing (reported).

5) Four rapid taps on the PDP and drawer '+' each registered all four increments with visualViewport.scale 1 in both engines. iOS double-tap-to-zoom is a UIKit gesture that WebKit on macOS does not emulate, so it is not reported.

6) .sub-pills: the scrollbar is hidden in WebKit and scrolling works identically. Momentum scrolling cannot be tested. -webkit-overflow-scrolling: touch at index.css:550 is a no-op (hygiene only).

7) Smooth scroll: section jumps (footer Bestsellers) and Back-button restoration work in both engines. Forward navigation fails in WebKit (reported as critical).

Also checked with no WebKit difference: PDP image fit (same as the known Chromium crop), the age gate, and newer JS APIs (none used that Safari lacks).

Not testable here: real iOS Safari (dynamic toolbars, safe areas, font fallback, native date picker, iOS click-dispatch rules for the document-level outside-click listener at App.jsx:418, and iOS <15.4 lacking dvh or inert).

## Multi-tab, shared-device and session-lifecycle state (cart, sign-out, token expiry, tab title) (gap1-multitab-session) — 13 kept / 13 found
Dev server on http://127.0.0.1:3000/ was up the whole time; it was not restarted. All testing used Playwright through pw/lib.mjs plus my own helper pw/gap1s-lib.mjs, which adds a context-wide mocked session so every tab in a context is "signed in". Nothing reached Supabase except anonymous products GETs; logout, token, profiles and orders calls were all fulfilled or aborted locally. No password field was typed into, and no form was submitted.

Scripts: pw/gap1s-01 … gap1s-15 (.mjs). Evidence: screenshots/

**States checked (viewports 1280x800 and 1280x900, plus a 390x844 mobile context):**
- Cross-tab cart: add, add, stale drawer, clear-all resurrected, stale catalog with a renamed variant.
- Search-driven title: keystrokes, special characters, HTML, emoji, 300-character query, clear, Escape, refocus, picking a result, Back with results open. History titles were read via CDP Page.getNavigationHistory.
- Sign-out with logout succeeding (204) and failing (network abort). Checked the cart, aw-auth, the next user's #/quote, and a reload.
- Sign-out in one tab while others sit on #/quote (prefilled via in-app navigation), #/account and #/admin as an admin profile.
- Account switch on one device: A signs out and B signs in. This was simulated with the SIGNED_IN BroadcastChannel message supabase-js uses, because real sign-in needs a password.
- Device-local cart: phone and desktop contexts on the same account.
- Age gate across two unverified tabs.
- Expired session with the token endpoint aborted, and with 400 invalid_grant, on #/account and #/quote. Also a session expiring mid-checkout, about 30 s in.
- Slow logout (4 s delay).
- Catalog refetch on focus, visibility, online and route change.
- Sign-in dialog left open while another tab signs in.
- Browser Back/Forward after sign-out from #/admin and #/account.

**Checked and found OK (not reported):**
- Back after sign-out shows no stale signed-in content, for both logout outcomes.
- An expired session does not loop, throw page errors or show stale signed-in UI. It becomes signed-out UI; the silent part is reported.
- A successful sign-out does propagate to the other tabs.
- HTML typed into search stays inert in document.title.

**Known items confirmed but not re-reported:**
- The account order-history state is not reset: user B's #/account showed A's order ALW-Q-11111 with a Reorder button until B's fetch returned (evidence nextuser-account-tab-B-sees-A-orders.png). This is the already-known '[code] Account order history fetch has no cancellation or reset'; the fix is in finding 5 (AccountPage keyed by profile id).
- The blank quote form on direct load, the profile never refreshing, and the dead keys 'aw-welcome-seen' and 'aw-trade-user' in STORAGE are covered by the known 'leftover exports' and 'auth loading' findings.
- Help and search panels staying open after Back is known. Its title consequence is in finding 11.

**Not tested:**
- A real Supabase sign-in, refresh or logout; the backend behaviour was reasoned from auth-js 2.105.4 source in node_modules, at GoTrueClient.js:3179-3205 and around 3848-3861.
- Real multi-device sync, real token lifetimes, iOS Safari's storage-event timing, and private-window storage partitioning.
- The multiple products GETs seen per load come from React StrictMode in dev plus postgrest retries on the mocked aborts. That is not a production issue and was not reported.

**Files read:** src/App.jsx (routing, cart, meta, header, quote, drawer), src/lib/useAuth.js, src/lib/supabase.js, src/lib/lines.js, src/lib/useCatalog.js, src/lib/orders.js, src/components/AuthModal.jsx (effects), src/pages/account/AccountPage.jsx, src/data/content.js (STORAGE), supabase/migrations/20260925120000_launch_order_boundaries.sql (submit_quote, order and price triggers), and the 2026-09-25 audit. That audit covers none of these session or multi-tab items, so all findings are marked 'new'.

## Degraded network and asset-failure states: broken images, font failure, offline and slow connections (gap1-degraded-states) — 11 kept / 11 found
All browser work used Playwright through scratchpad/pw/lib.mjs; scripts are prefixed gap1ds-*. The dev server on :3000 was up the whole time and was not touched. No repo files were modified and no npm scripts were run.

WHAT I CHECKED
1) Broken images (image requests aborted), at 1440x900 and 390x844 (mobile):
   - #/: hero slides 1-2 with autoplay, New arrivals, Collections cards, Shop by department.
   - #/product/162: top of page and related row.
   - Cart drawer and #/quote thumbnails, with a seeded cart.
   - Header search results ('snickers').
   - Header logo, including keyboard focus.
   - #/category/TOBACCO and #/category/CANDIES.
   - Age gate: it has no logo image (text wordmark), so it is unaffected by image failure.
   - Control run: under normal conditions all 8 departments scrolled end to end with 0 broken images.
2) Web-font failure (font requests aborted), at 1440, 1024 and 390, on #/, #/category/TOBACCO, #/product/162 and #/contact (plus #/product/60 and the editorial cards):
   - Real macOS stack (renders Arial Narrow + Verdana).
   - Simulated Windows without Office (Impact), iOS (system sans) and Android (sans for both families).
   - Header/nav wrapping, horizontal overflow and clipped text measured: none.
   - Text collisions scanned across 9 routes at 390, 768, 1024 and 1440.
3) Offline mid-session (context.setOffline), at 1440 and 390:
   - In-app navigation, PDP with an image not yet loaded, add to cart, cart drawer.
   - Sign-in dialog: submit clicked on the empty form only (HTML5 'Please fill out this field' on email and password).
   - #/apply, #/account, #/reset-password and #/quote.
   - Reconnect behaviour and full reload offline.
   - No spinners hung for signed-out users; the only console errors were ERR_INTERNET_DISCONNECTED resource errors.
4) Slow connection:
   - The dev server under throttling stayed white for more than 15s. That is a dev-only artifact of unbundled modules, so the timings come from the production build.
   - That production build (scratch dist-seo, built today from the current source) was served from a scratch gzip server on :4191, stopped afterwards. Throttling: CDP Fast-3G-like profile (560ms RTT, 1.47 Mbps down, 675 kbps up) plus 4x CPU.
   - Filmstrips at 1/3/6/10/15s of #/ (390) and #/category/TOBACCO (390 and 1440).
   - First visit through the age gate.
   - JavaScript disabled, and main-chunk failure.
   - Fast-scroll tile fill times, in-app PDP photo delay, and font arrival time.
   - Layout shift as cards fill: none from images (aspect-ratio boxes); CLS 0.004-0.04.
5) Slow Supabase: products GET delayed 6s on #/, #/category/TOBACCO, NOVELTIES and DRINKS & BAGS, #/product/60 and 205, and #/catalog. Before/after diff of titles, search placeholder, H1, counts, pills, card names, kickers, details, image files, variant chips, descriptions and footer counts found no visible change. The static catalog renders immediately and live data swaps in invisibly, so there is no finding.
6) Signed-in failure states, using a fake local session where every Supabase call was answered or held inside the test browser and nothing reached Supabase:
   - Pending applicant's document list failing.
   - Order history hanging.
   - Quote submit hanging: filled with obviously fake values, POST held locally and never continued.

NOT CHECKED OR NOT REPORTED
- Real sign-in, reset and signup network submissions (no password typing, no realistic data). Their error copy was reviewed in code instead.
- A real service-worker or PWA install.
- Real Windows, iOS and Android devices: font fallbacks were simulated by overriding the CSS stack on macOS Chromium.
- Deliberately not re-reported (already known): missing error boundary, silent static-catalog fallback, useCatalog loading state, LCP/CLS/bundle size, raw Supabase error text, generic quote-failure message.
- The prior 2026-09-25 audit has no degraded-state items, so every finding is marked new.

Evidence (all under the evidence folder): screenshots/

## User text-size preference, browser zoom levels between 110% and 175%, and printing of pages other than quote and product (gap1-text-size-print) — 9 kept / 9 found
Dev server on 127.0.0.1:3000 was up the whole time (HTTP 200); I did not touch it. I used Playwright through my own helper, gap1tsp-lib.mjs, which has the same guard as lib.mjs (every remote non-GET is aborted) and adds support for deviceScaleFactor. Scripts are pw/gap1tsp-*.mjs. Evidence is in evidence/gap1-text-size-print/ (PDFs and page PNGs in print/). Nothing was submitted, and no repo files were modified.

GAP 1, text size:
- Default font 16/24/32px via CDP Page.setFontSizes on #/, #/product/162, #/quote (cart with 3 lines) and #/terms at 1280×800. Computed sizes were measured and screenshots taken; they are byte-identical across settings.
- I also simulated the preference being honoured (all fonts ×1.5 and ×1.25) at 1280 and 390px, on the four routes plus #/category/TOBACCO.
- Minimum font size: Chrome's webkit.webprefs.minimum_font_size in a persistent profile did not take effect in headless Playwright. I emulated it by clamping every computed font-size to 12px and to 16px at 1280 and 390, on #/, #/category/TOBACCO, #/product/162, #/terms, #/catalog and #/delivery.
- At 12px nothing breaks (.card-tag, .block-label, footer legal row, cart badge, trade bar all fine). At 16px only the phone trade bar overflows (reported).
- I did not re-report the 9–11px sizes; they are cited in the fix.

GAP 2, zoom and Windows scaling:
- 1536×730 at DPR 1.25, 1280×600 at DPR 1.5 and 1366×650 at DPR 1 (inner viewports for 1920@125%, 1920@150% and 1366×768).
- At each I captured #/, #/category/TOBACCO, #/product/162, #/quote and the open mega menu.
- Header sweep from 851 to 1400px in 7px steps: no masthead or nav wrapping, no nav/utility collision (min gaps 181px nav, 292px utility), no horizontal scroll.
- PDP fold measured at 7 laptop and zoom viewports. Card-row alignment measured at 7 desktop widths on 3 departments and home. Sticky filter panel measured at 6 viewports.
- Hairlines at DPR 1 / 1.25 / 1.5: I sampled pixels on the nav borders, Categories toggle edges, mega-menu seam, search box, sort select, card borders, quote input, checkout line, footer-legal rule and FDA band. 1px rules render as one device pixel, softened across two pixels when the edge lands on a half pixel (e.g. nav top border #f3f0ed + #ede9e4 at 1.25). No gaps, doubled lines or vanishing borders were found, so there is no finding.
- The mega menu scrolling internally at short heights (360 of 702px at 1280×600) and the 253px header stack are already known, so not re-reported.

GAP 3, print:
- page.pdf, Letter, 0.4in margins, backgrounds off and on, for #/terms, #/privacy, #/shipping, #/delivery, #/contact and #/catalog.
- Also landscape for #/terms and #/catalog, and backgrounds off for #/apply, #/category/TOBACCO and #/.
- PDFs were rendered to PNG with a compiled Swift/PDFKit tool (pdftoppm was not installed), and page text was extracted to locate breaks.
- The proposed print CSS and the card-alignment CSS were validated by injection.

Not checked:
- Signed-in, approved and admin states (account/admin tables, order history, and admin table rules at fractional DPR), because signing in is prohibited.
- Real Windows ClearType/GDI rendering; DPR was emulated in headless Chromium on macOS.
- Firefox and Safari text-size and zoom behaviour, and Android Chrome text scaling.
- The real Chrome print dialog's own headers/footers and scale options.

## Browser-forced dark mode (Samsung Internet, Chrome Android 'Darken websites', Opera/Brave) and other browser-applied page transformations (Google Translate, contrast and transparency preferences) (gap2-forced-dark-transforms) — 3 kept / 12 found
Dev server on 127.0.0.1:3000 was up the whole time and was never restarted. No repo files were modified and no npm scripts were run. No forms were submitted and no accounts were created. The quote error box was checked by injecting a .form-error node into the DOM.

Tooling:
- Own launcher pw/gap2fd-lib.mjs uses the same network guard as lib.mjs: only 127.0.0.1:3000, data: and blob: are allowed, plus Supabase GETs; everything else is aborted. It sets aw-age-verified via addInitScript and can patch index.html in the route handler to test fixes.
- Forced dark: Chromium with --enable-features=WebContentsForceDark --blink-settings=forceDarkModeEnabled=true and colorScheme 'dark', at 390x844 (isMobile, hasTouch, DPR 2) and 1440x900 (DPR 2).
- Contrast was measured by sampling screenshot pixels in a separate non-dark browser via canvas. getComputedStyle was only a sanity check; it still reports light colours.
- Scripts: pw/gap2fd-01…13*.mjs and pw/gap2fd-tr-01…06.mjs, plus gap2fd-tr-lib.mjs. Evidence is in scratchpad/evidence/gap2-forced-dark-transforms/.

Forced-dark states checked:
- Age gate (unverified) and its Tab focus.
- #/: header, trade bars, carousel, all three card grids, editorial cards, services, apply panel, footer, FDA band.
- #/catalog.
- #/category/TOBACCO and CANDIES: grid, sub-pills, sticky toolbar, phone filter drawer with checked boxes and active chips, 1440 sidebar.
- #/category/CANDIES/Chocolate Bars.
- #/product/162: chips unselected and selected, qty stepper, in-cart note. #/product/1: disabled 'Add to quote'. #/product/306: initials placeholder.
- Cart drawer with seed cart {'14':2,'162::king-size':1}.
- #/quote: inputs, select, date field, native validation tooltip, injected error box.
- Sign-in dialog (empty submit) and application dialog (checklist, form, file inputs, hints).
- Help dialog, mega menu, header search results, mobile menu.
- #/contact, #/delivery, #/terms, #/apply, #/account (signed out), contact strip, policy nav.
- Focus rings on 12 control types.
- Badges: BESTSELLER, NEW, cart count, filter count.
- White-box scan of all 368 cards in the 8 departments, and all 4 hero slides at 390 and 1440.

Fix tests (runtime injection only):
- meta 'only light' and CSS ':root{color-scheme: only light}' both stop auto-darkening.
- meta 'light' does not.
- meta 'light dark' also stops it.

Google Translate:
- Simulated by replacing text nodes with <font><font>, plus a MutationObserver that translates new content.
- Exercised: carousel, category sub-pills, All pill, chip removal, footer department switch, phone drawer filters and search, desktop filters, PDP chips/stepper/add, quote +/remove/clear/typing, cart drawer +/−/remove to empty, header search typing and Enter, delivery state select, and policy side-nav between shipping, privacy and terms.
- Approved-buyer PDP and Quick Reorder were run through the existing local mocked session (qvab-lib; every Supabase call is fulfilled or aborted locally, and no real sign-in happens).
- Did not exercise: AccountPage order-history notes, the admin page, the reset-password page, and AuthModal step transitions while translated.
- Real Chrome Translate output (e.g. whether brand names or SKUs get translated) could not be checked offline.

Also checked: prefers-contrast: more and prefers-reduced-transparency: reduce via CDP.

Not tested:
- Real Samsung Internet, Opera or Brave devices. Chromium force-dark was the proxy; Samsung uses its own dark-mode algorithm, so the opt-out should be confirmed on a Galaxy phone.
- Dark Reader and other extensions.
- Windows forced-colors (already known).

Known items were not re-reported: light-mode input borders, light-mode white photo boxes and logo fringe (only noted where forced dark makes them materially worse), and the age-gate / contact-strip focus rings. The Translate crashes rely on the known missing error boundary.

## Session-dependent onboarding and account-recovery screens nobody rendered: auth dialog post-submit steps, #/apply signed-in panels and the document-upload lifecycle, #/reset-password form and success states, transactional email content (gap2-onboarding-recovery-states) — 20 kept / 20 found
The dev server on :3000 was up throughout. All driving was done with Playwright scripts prefixed pw/gap2or-*: gap2or-hook.mjs (React DevTools hook shim and fiber state setter), gap2or-docmock.mjs (local profile_documents and storage mocks), then scripts 01-13. Evidence is in scratchpad/evidence/gap2-onboarding-recovery-states/.

(A) Auth dialog, at 1440x900, 390x844 (mobile) and 844x390 (landscape):
- 'sent' was rendered with filled fake signup data plus the proof-waiting note, and again with empty signup data.
- 'status' was rendered after sign-up (Thanks …) and after sign-in (Welcome back …), for pending and suspended profiles. The sign-in path was simulated with openAs and a delayed profile: open Sign In, dispatch 'checking', and the component moves itself to 'status'.
- 'checking' was rendered for both profiles.
- 'reset' → 'reset-sent' was reached through the real UI (Forgot password → test@example.test → POST /auth/v1/recover fulfilled locally as 200).
- Focus moved to #auth-title on every step change (no defect). The known items were only used as evidence: the 10 s timeout, the ↗ arrows, the 21+ fine print on every step, and the landscape header height.
- The empty signup.email copy ('We sent a confirmation link to .' / 'contact you at or') renders as expected, but it cannot happen in real use: 'sent' is only reached after a successful signUp with the required email and phone fields. So it is not reported.

(B) #/apply signed in (pending, approved, suspended) at 1440 and 390. The pending document lifecycle was tested with local mocks:
- the Checking… state (delayed list);
- a valid PDF → Uploading… → 'Uploaded on September 28, 2026 · name' (formatUploadedOn output is fine; new Date(null) → 1969 cannot happen because uploaded_at is NOT NULL);
- replacement (old object DELETE observed);
- a .txt rejected by client validation;
- storage 413 and 400 errors;
- concurrent uploads, and the race with the initial list;
- keyboard focus during an upload;
- long filenames at 390 and 360.
There is no delete or remove path, and there is no applicant view link (both included in the findings). Approved and suspended accounts get no document view (reported).

(C) #/reset-password:
- the signed-in form with a long email at 1440 and 390;
- the recovery fragment with GET /auth/v1/user fulfilled locally, plus a 1.8 s delay to render 'Checking your reset link…';
- the done state, set through the ResetPasswordPage state hook. No password was typed and PUT /auth/v1/user was never sent;
- Cancel (signed in, and from recovery);
- header, footer, search and Back while the recovery page was showing;
- Sign Out (POST /auth/v1/logout fulfilled locally as 204) from the form and from the done state.
The empty-submit native validation was not re-tested (known).

(D) Emails: there is no config.toml or templates in the repo, and BACKEND.md confirms the default Supabase email. The default subjects and bodies were taken from the current supabase/auth source (templatemailer.go) plus the Supabase docs (auth-email-templates, auth-smtp, local-development/customizing-email-templates). I could not see the hosted project's dashboard, so if the owner has already pasted custom templates there, the template part of that finding does not apply. The emailRedirectTo gap still applies either way.

Network safety: every run showed logs.blocked = [] and pageErrors = []. In openAs and recovery runs, every Supabase request was either fulfilled locally or aborted. Signed-out runs let only anonymous products GETs through. Nothing was submitted to Supabase or Netlify, and no password field was typed into.

Not checked: real email delivery or rendering in mail clients, HEIC (known), the approved-profile 'status' dialog mode (unreachable: 'checking' closes for approved profiles), and Safari/WebKit rendering of these states.

## Owner back-office completeness: can staff actually run the catalog, quotes and accounts from #/admin? (gap2-admin-operations) — 12 kept / 12 found
The dev server on 127.0.0.1:3000 was up (HTTP 200). All browsing used Playwright scripts in scratchpad/pw with the prefix gap2ad-, through a new helper, gap2ad-lib.mjs. It uses a fake local admin session plus mock rows:
- 6 orders: 3 guest quotes with unit_price null (one with long notes, one will-call, one cancelled), 2 approved-buyer orders, and 1 fulfilled order;
- 5 profiles: admin, 2 approved, 1 pending with a document, 1 suspended;
- the 368-row catalog, with ids 14, 162, 250 and 330 set inactive.

Nothing reached Supabase. Every GET was answered from the mocks, every PATCH/POST was answered locally and its body recorded, and the count of blocked Supabase requests was 0 in every run.

Checked:
- #/admin Orders, Accounts and Products at 1440x900, 1024x768 and 390x844 (mobile);
- #/ (homepage rails, to test tag control);
- #/product/2 and #/category/TOBACCO (effect of an invalid save).

All 11 owner tasks were walked: add SKU, change photo, edit description/variants/sell unit/sub-line, deactivate and re-find, bulk price, a new guest quote (auto-refresh waited 40 s plus focus/visibility events), find/print/export an order (print media and PDF), line edit/internal note/history, account lookup/edit/history, keyboard use of the edit row plus state loss on tab switch/reload/Back, and irreversible status changes (cancel, suspend, tier, double-click Approve).

Source read: src/pages/admin/AdminPage.jsx (all), App.jsx router/home rails, useCatalog.js, images.js, orders.js, documents.js, AccountPage status labels, content.js HERO_SLIDES, index.css admin rules, all 6 migrations, seed/build-seed.mjs, and the 2026-09-25 audit (#7 now fixed; #8 still open → the quote-workflow finding).

Not checked:
- behaviour against the real Supabase RLS and triggers (the order_items policy and trigger conclusions come from source only);
- Windows/Edge keyboard behaviour on native selects (arrow keys on a closed select did not change the value in headless Chromium on macOS, so not reported);
- email delivery.

Evidence is in scratchpad/evidence/gap2-admin-operations/. Items in the known list (squeezed selects, sticky header, SKU column, 200-order cap, ignored errors, role confirmation, hidden EIN, missing delivery/total on cards, notifications, seed overwrite) were deliberately not re-reported.

## Launch readiness and engineering lifecycle: EOL runtime, unsupported and unaudited dependencies, no tests/lint/CI, no error monitoring or analytics, and migrating returning visitors from the current live site (gap2-launch-lifecycle) — 10 kept / 10 found
Area gap2-launch-lifecycle. Everything was read-only in the repo: no npm scripts or installs ran there, no files were modified, and no forms were submitted.

Checked:
(1) Dependencies. Copied package.json and package-lock.json to scratchpad/pw/gap2lc-audit and ran `npm audit --package-lock-only` (full and --omit=dev). Took patched versions from the GitHub advisory API. Ran npm view (version, dist-tags, engines, peerDependencies, release times) for vite, @vitejs/plugin-react, react, react-dom, @supabase/supabase-js, tailwindcss, postcss, autoprefixer, sharp and vitest. Fetched the vite.dev/releases support policy and react.dev/versions.
(2) Node lifecycle. Read nodejs/Release schedule.json and nodejs.org/dist/index.json (Node 20 EOL 2026-04-30), plus .nvmrc, netlify.toml, the local shell Node (24.20.0) and the running dev server's Node binary (Homebrew 26.8.1).
(3) Tests, lint and CI. Checked HEAD and all 7 branches for test, lint and CI files. Ran ESLint 9 + react-hooks on a scratchpad copy of src (report saved), and ran six node:test tests against a copy of src/lib/lines.js.
(4) Observability. Grepped index.html, src, public and netlify.toml for analytics and error tools, located the event wiring points and verified their line numbers, and checked Supabase pricing for Free-plan pausing and backups.
(5) Returning visitors. Ran Playwright (gap2lc-oldcart.mjs) at 1280×800 and 390×844 with the old {id:qty} cart plus old keys and captured the drawer and #/quote. Compared old and new products.js for all 368 ids (gap2lc-scale.mjs). Checked old-build storage keys, including git history f5e931b.
(6) Deploy docs. Read BACKEND.md, NETLIFY-DEPLOY.md, supabase/migrations/* and seed/provision_owner.sql. Diffed migrations against origin/main. Probed the configured Supabase project with anonymous GETs only, inside Playwright, and never printed the URL or key: all migrations through 20260927180000 are applied, with 368 product rows and 3 pricing tiers. Timed build-images on a scratchpad copy.
Evidence is under scratchpad/evidence/gap2-launch-lifecycle/.

Could not check:
- Production. alabamawholesaleinc.com is NXDOMAIN and unregistered (Verisign whois), so I could not tell which old build, if any, is live, or on which origin.
- The Netlify site settings (production branch, deploy previews, env-var scopes).
- The Supabase dashboard (plan tier, Auth Site URL, redirect list, existing admin accounts).
- Build time on actual Netlify hardware.
- Whether Netlify applies netlify.toml to drag-and-drop deploys (its docs don't say), so I did not claim it.

Not re-reported (already known): README, the App.jsx monolith, leftover exports, the error boundary, cache and security headers, bundle size, unused Netlify forms, the seed overwrite, and the 'Choose variant loses quantity' bug. The returning-visitor finding only adds the migration angle and its scale.

