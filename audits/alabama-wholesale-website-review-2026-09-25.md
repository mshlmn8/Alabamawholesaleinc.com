# Alabama Wholesale website review

Reviewed September 25, 2026. Target: the existing Safari tab at `http://127.0.0.1:3000/`, served from `alabamawholesaleinc-2a-editorial`.

The site has a coherent purple/orange identity, useful search and category organization, and a recognizable wholesale proposition. It needs functional account and order flows, complete catalog data, verified business information, and a more efficient mobile layout before it is ready for real customers.

## Scope and evidence

- Inspected the actual Safari homepage, Tobacco category, global Snickers search, Snickers detail page, cart drawer, quote page, account application, and Quick Reorder destination.
- Inspected homepage and Candies category in Safari Responsive Design Mode at 390 × 844. This is viewport emulation, not physical-device testing.
- Added one candy item locally to inspect the quote flow, then removed it. Cart was restored to zero. No forms were submitted, accounts created, messages sent, or orders placed.
- Returned Safari to normal browsing on the homepage. Application source was not edited.
- Reviewed source independently for catalog/account behavior and for accessibility, responsive CSS, SEO, and asset handling.
- Backend configuration is missing in this preview. Deployed database policies, successful receipt of orders/emails, signed-in journeys, production indexing, and real-user performance were not verified. Security observations below describe source behavior and deployment risks, not demonstrated production exploits.

All source references below are relative to `alabamawholesaleinc-2a-editorial/`.

## Fix before launch

### 1. Account application and sign-in are disabled

**Priority: High. Evidence: observed in Safari and confirmed in source.**

The application dialog displays “Backend not configured” followed by environment-variable instructions, and disables Submit application. The sign-in form uses the same configuration check. This blocks the site's main conversion path and exposes developer-oriented messaging to visitors.

Fix: configure the intended backend, test application → email confirmation → staff approval → sign-in, and provide a useful customer-facing unavailable state if a service fails. Add password recovery and an explicit pending-approval screen.

Location: `src/components/AuthModal.jsx:62`, `:66`, `:95`.

### 2. Variants cannot be selected or included in orders

**Priority: High. Evidence: observed and confirmed in source.**

Snickers lists Regular, King size, Almond reg, and almond king size as chips, but these are plain text spans. The cart records only the parent product ID and quantity, so it cannot distinguish sizes or flavors.

Fix: represent sellable variants with their own SKU, price, availability, and cart identity. Require selection where necessary and show the selection throughout cart, quote, order, and reorder.

Location: `src/App.jsx:165`, `:696`, `:719`; `src/lib/orders.js:29`.

### 3. Product information is incomplete

**Priority: High. Evidence: source counts and sampled Safari pages.**

173 of 368 catalog rows (47%) have no image and fall back to initials. Thirty-eight rows advertise flavor counts that differ from their stored variant lists. Product descriptions are generic; the Snickers page does not define whether quantity one means a bar, display box, or case.

Fix: add accurate product photos, full names, variant-specific package details, sell unit, units per case, minimum quantity, order increment, UPC where available, and truthful availability. Reconcile claimed variant counts. Prioritize frequently ordered products, then complete the remainder.

Location: `src/data/products.js`, including the Foger entry at `:78`; `src/App.jsx:713`, `:718`, `:723`.

### 4. Contact details and commercial claims need verification

**Priority: High. Evidence: confirmed placeholder; other claims unverified.**

The visible phone is `(205) 555-0199`, also used for help and submission failures. The site promises own-truck next-day delivery, free delivery over $1,500, Net-30 terms, discounts up to 18%, and approval within one business day. Visible service-area copy and stored FAQ/schema data are inconsistent.

Fix: replace placeholder contacts and verify the phone, email, address, opening hours, delivery routes, cutoffs, minimums, credit eligibility, and discounts with the business. Keep the header, footer, Help, structured data, and transactional messages synchronized. Do not publish unverified guarantees.

Location: `src/data/content.js:6`, `:19`, `:54`; `src/App.jsx:470`, `:471`, `:499`; `index.html:28`.

### 5. Account approval and pricing are not securely enforced by the source

**Priority: High. Evidence: source review; deployment not verified.**

The storefront treats any loaded profile as a buyer, without requiring approved status. Static product prices are delivered to the browser even when the UI labels them locked. The supplied database policies expose active product records and do not require account approval when inserting an owned order. Browser-supplied unit prices and totals are accepted by the submission helper.

Fix: enforce approval, ownership, allowed catalog access, quantity validation, and authoritative price calculation on the server/database. Exclude protected trade prices from public data. Test pending, approved, suspended, guest, and admin cases against the deployed policies.

Location: `src/App.jsx:88`, `:529`, `:778`; `src/data/products.js:17`; `src/lib/orders.js:21`, `:35`; `supabase/migrations/20260517000001_rls_policies.sql:39`, `:54`.

### 6. Public signup can initialize the first account as administrator

**Priority: High. Evidence: migration behavior; deployment exposure not verified.**

The first profile created by signup is automatically made an approved administrator. This is dangerous on a fresh publicly accessible installation.

Fix: provision the owner through a trusted administrative process and remove public-signup promotion. Verify who owns any deployed administrator account before enabling customer signup.

Location: `supabase/migrations/20260517000000_initial_schema.sql:42`.

### 7. The storefront ignores admin catalog changes

**Priority: High. Evidence: source review.**

Admin editing writes to the database, while storefront search, product pages, and category pages use the static PRODUCTS array. The existing live catalog hook is unused. Changes to price or active status therefore do not update the storefront through this code path.

Fix: use one authoritative catalog across admin, storefront, search, quotes, and orders; verify that deactivating a product actually prevents it from being ordered.

Location: `src/pages/admin/AdminPage.jsx:214`; `src/App.jsx:5`, `:565`, `:684`; `src/lib/useCatalog.js:21`.

### 8. Quote and order submission need a complete receipt contract

**Priority: High. Evidence: source review; no submission performed.**

The form collects no delivery street address, city, or ZIP. Orders and line items are inserted in separate database requests. Guest insertion asks for a returned row even though the supplied read policy excludes guest-owned rows. The fallback considers a successful HTTP response sufficient to display a submitted state, which does not itself prove a saved order or delivered notification.

Fix: collect or select a validated ship-to address; confirm route eligibility, fees, and requested dates; submit header and items atomically; generate the receipt on the server; prevent duplicates; and verify staff/customer notifications on the chosen host. Distinguish quote requested, accepted order, and scheduled delivery.

Location: `src/App.jsx:762`, `:778`, `:783`, `:850`; `src/lib/orders.js:9`; `supabase/migrations/20260517000001_rls_policies.sql:59`.

## Improve the shopping experience

### 9. Simplify mobile navigation and collapse filters

**Priority: High for usability. Evidence: Safari at 390 × 844.**

The announcement, wholesale notice, logo, account actions, search, and navigation consume much of the first screen. The homepage call to action is below the initial viewport. On category pages, the full filter panel precedes the product grid, delaying the actual products further.

Fix: compact the mobile header to logo/account/cart plus prominent search; consolidate secondary navigation; show a Filter & Sort button that opens a drawer; keep selected filter chips and result count visible; increase small product metadata and quantity-control hit areas.

### 10. Make the hero represent the distributor

**Priority: Medium. Evidence: Safari visual review.**

The hero is a stretched, cropped Geek Bar advertisement. Its baked-in lettering competes with the page headline, and the image makes the business appear focused on one vape brand despite its eight departments. Its alternative text claims a warehouse scene that the image does not show.

Fix: use an authentic warehouse, delivery truck, or carefully photographed assortment image. Keep the purple/orange identity and strong type. Shorten the hero, move the actions up on phones, and correct the image description. Use a sufficiently large image with deliberate desktop/mobile crops.

Location: `src/App.jsx` HomePage hero; `src/data/theme.js:9`; `src/index.css:143`.

### 11. Complete discovery and repeat ordering

**Priority: Medium. Evidence: observed and source review.**

“Browse the catalog” opens Tobacco rather than a complete catalog. “Quick Reorder” opens an account page that tells signed-out users to sign in but provides no sign-in action in that page's content. The account history has no actual reorder control.

Fix: add an All Products or department-index destination, meaningful brand filters, and consistent product naming. Add a working reorder action, saved lists, and quick entry by SKU with quantities for frequent customers.

Location: `src/App.jsx:209`, `:389`, HomePage catalog CTA; `src/pages/account/AccountPage.jsx:32`, `:79`.

### 12. Finish account onboarding and business support pages

**Priority: Medium. Evidence: observed UI and source review; proposed additions.**

The homepage says applicants will provide an EIN and resale certificate, but the form has no corresponding fields or document collection. Footer navigation also lacks dedicated customer-facing policy pages.

Add:

- A clear application checklist, appropriate document upload, approval status, and next steps.
- Delivery/service-area information, pickup instructions, and a ZIP-based eligibility check tied to actual routes.
- A Contact/Visit page with verified click-to-call, address, directions, hours, and warehouse photographs.
- Shipping/delivery, returns/damaged-goods, privacy, and trade terms pages reflecting real operations.
- Saved ship-to locations, invoices, order status, and downloadable approved-account price lists when those capabilities are supported by the backend.

Location: `src/App.jsx:499`; `src/components/AuthModal.jsx:83`; footer navigation.

## Accessibility, search, and performance

### 13. Repair field labels, focus behavior, and contrast

**Priority: High for affected interactions. Evidence: source review and Safari accessibility tree.**

Most signup and quote inputs have visible labels without programmatic associations. Dialogs lack focus entry/trapping/restoration and background inertness. Product-card inline `all: unset` overrides the global focus outline. Hero orange on cream measures approximately 2.86:1, below the large-text contrast threshold; very small metadata also reduces readability.

Fix: associate controls with labels and autocomplete attributes, announce errors, use robust dialog focus management, preserve visible keyboard focus, darken hero text, and increase tiny text and controls. Validate full keyboard journeys and screen-reader form names.

Location: `src/components/AuthModal.jsx:83`; `src/App.jsx:518`, `:851`, `:920`; `src/index.css:10`, `:18`, `:28`, `:153`, `:158`.

References: [W3C form labels](https://www.w3.org/WAI/tutorials/forms/labels/), [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

### 14. Give categories and products discoverable pages

**Priority: High for search visibility. Evidence: source review; production indexing not measured.**

Routing uses `#/category/...` and `#/product/...`; most navigation uses buttons. The sitemap includes fragment URLs. Fresh sessions return an age-gate-only interface, and product/category metadata retains the homepage canonical and social tags. A referenced share image is missing.

Fix: use real category/product paths and anchor links, render the public content appropriate for each page, preserve appropriate age/account restrictions, generate unique canonical/description/social data, create valid share images, and include only canonical public URLs in the sitemap. No crawler-specific bypass or different content for bots.

Location: `src/App.jsx:91`, `:187`, `:368`, `:518`; `public/sitemap.xml:4`; `index.html:9`.

Impact: classical search and reliable link sharing; clearer rendered content may also help answer engines discover and cite the site. No ranking or citation lift is guaranteed.

Reference: [Google JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

### 15. Deliver appropriately sized product images

**Priority: Medium. Evidence: source and file-size inspection.**

The local image library is approximately 21.9 MiB; that is total asset size, not initial page transfer. Some 2000-pixel images are used for tiny cards without responsive sources. The hero has the opposite issue: a 500 × 500 source is enlarged for a major visual.

Fix: generate card and detail sizes, use responsive WebP/AVIF sources and meaningful dimensions, prioritize the hero, and retain below-fold lazy loading. Measure actual production LCP, layout shifts, and interactions after content and layout changes. No performance score was measured in this audit.

Location: `src/App.jsx:522`, `:713`; `src/data/theme.js:9`; `src/index.css:143`.

## Recommended sequence

1. Verify business facts and make backend account/approval/order boundaries correct.
2. Connect the authoritative catalog and implement variant/case ordering plus reliable quote receipts.
3. Complete the highest-priority product imagery and data.
4. Compact mobile navigation, collapse filters, and replace the hero imagery.
5. Finish reordering, onboarding/support pages, accessibility, real URLs, and sharing metadata.

The palette, typography direction, useful search, department organization, locally hosted fonts, lazy-loaded cards, responsive breakpoints, and reduced-motion support are worth retaining.
