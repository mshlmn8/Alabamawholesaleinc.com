# Alabama Wholesale website review: start here

> **Update 2026-11-01:** this folder now lives in the website repository, under `audits/`. STATUS.md is the status on 2026-10-09. The owner's answers of October 10–13 settled more of the "waiting on the owner" items after that (the questions still open are in `docs/OWNER-TODO.md`). The review's file paths were written for the `redesign/2a-editorial` folder, which has the same layout as this repository.
>
> **Update 2026-10-09:** this review has been implemented on branch `fix/site-review-2026-09-28` (pushed to GitHub). See [STATUS.md](STATUS.md) for each finding's status: 284 fixed, 68 waiting on the owner, 3 partial. The rest of this file is the original review.

Reviewed September 27–28, 2026. Target: the site running at `http://127.0.0.1:3000/`, which is served from `alabamawholesaleinc-2a-editorial/` (branch `redesign/2a-editorial`). Every file path in this review is relative to that folder.

`~/Desktop/alabamawholesaleinc.com/alabama-wholesale-netlify-source` is an older copy of the site. It is not what's running, so don't edit it.

## How to use this with Cursor

1. Open `alabamawholesaleinc-2a-editorial` in Cursor. This review lives next to it in `../audits/site-review-2026-09-28/`. Drag that folder into Cursor's chat, or open the parent folder `Alabama Wholesale Online Website` as the workspace so Cursor can see both.
2. Paste this prompt into Cursor (Agent mode):

```text
Read audits/site-review-2026-09-28/00-START-HERE.md and follow its guardrails.
Work through the "Implementation plan" one phase at a time. For each finding ID in the
phase, find it in the numbered file (01–05), apply its Fix, and tick its "Done" checkbox.
For findings marked "Who: Owner → Cursor", do not invent the missing fact, price, photo
or legal text: add a TODO(owner) comment where the code needs it and list the open
question in your summary. Run `npm run build` at the end of
each phase, then stop so I can review before you start the next phase.
```

3. Before or while Cursor works, go through **Phase 8: Owner actions** and the **Owner decisions and actions** table at the bottom of this file. Cursor can't finish those 54 items without your answers, photos and account setup.

## Files in this folder

| File | What's in it |
| --- | --- |
| `00-START-HERE.md` | This page: guardrails, totals, the fix-first list, the implementation plan, conflicts, and owner decisions |
| `01-storefront-pages.md` | Home, header/navigation/search/footer, catalog and department pages, product pages |
| `02-cart-checkout-accounts-admin.md` | Cart, quote/checkout, sign-in and application, password recovery, signed-in buyer views, admin |
| `03-content-data-photos.md` | Support and policy pages, copy and business facts, catalog data, every product photo |
| `04-design-responsive-accessibility.md` | Design system, phone/tablet layout, Safari, zoom/print, forced dark mode, accessibility |
| `05-engineering-seo-security.md` | SEO and performance, code bugs, multi-tab/session state, offline states, security, launch readiness |
| `06-appendix-coverage.md` | What each reviewer checked, and what they couldn't |
| `findings.json` | The same findings as data, if you want to import them into a tracker |
| `screenshots/` | Evidence screenshots linked from each finding |

## How the review was done

- 87 AI review agents covered every route at widths from 360 to 1920 px and in landscape. They also tested:
  - Safari's engine (WebKit), dark mode and forced dark mode, zoom and larger text, print.
  - Slow and offline connections, multiple tabs.
  - Keyboard-only use, plus automated accessibility scans (axe-core).
- Agents also read the full source, the Supabase migrations, all 368 catalog rows and every product photo.
- Every finding was re-checked by a separate agent that tried to reproduce it. About 660 raw reports went through that check:
  - 13 couldn't be reproduced and were dropped.
  - 168 were corrected (severity, file references or the fix).
  - Reports of the same problem from different reviewers were merged, leaving the 355 distinct issues here.
- Nothing was submitted. No accounts were created, no quotes or applications were sent, and the test browsers blocked every write to Supabase. Signed-in buyer and admin screens were checked by reading the code and rendering with mocked data, not with real accounts.
- Not measured:
  - Real production speed (only the dev server and a local build).
  - Whether confirmation and reset emails actually arrive.
  - The live Supabase policies beyond the migration files in the repo.
- The legal and compliance items (restricted products, nicotine warnings, photo copyright, policy wording) are flags to take to a lawyer. They are not legal advice.
- The earlier review in `../alabama-wholesale-website-review-2026-09-25.md` was checked against the current site. Items that are now fixed are left out. Each finding says whether it is new, still open, or partly fixed.

## The short version

The design direction is strong. Purple, cream and orange with condensed type reads as a real distributor, and search, department structure and the support pages have come a long way since the 25th. What stands between this and a launch:

1. **The prices aren't real, and the "locked" prices are public.** Every list price is a placeholder carried over from the first commit. Bigger packs cost less than singles, and unrelated items share identical prices. Those same prices are also downloadable by anyone from the JavaScript bundle and the public Supabase API, even though the site says pricing is for approved accounts only.
2. **Some products are a legal risk in Alabama.** The storefront advertises kratom, "mushroom" products, synthetic urine and sexual-enhancement pills. Kratom's active compounds are Schedule I in Alabama. Have the owner and a lawyer decide on these lines before launch.
3. **The product photos undermine trust:**
   - At least 12 products show a different product (Pepsi shows Aquafina, Monster shows Softsoap).
   - 77 products have no photo at all.
   - Several use ad banners or retailer screenshots.
   - Many were copied from other retailers without permission.
4. **The homepage doesn't say what the business is.** The hero is a small packshot with no headline, no value proposition and no button. On tablets and phones those images spill over the carousel controls and the next section.
5. **Ordering isn't reliable yet:**
   - Sizes and flavours all share one price.
   - 344 of 368 products don't say what a quantity of 1 means.
   - Quote reference numbers can collide.
   - Nobody is notified when an order comes in.
   - The cart isn't cleared after checkout, and it breaks across multiple tabs.
6. **Launch blockers outside the code.** The domain `alabamawholesaleinc.com` isn't registered. Supabase has no production email sender, so confirmation and password-reset emails won't reach customers. A build without the Supabase keys silently ships a site with sign-in and checkout turned off.
7. **Accessibility gaps in the core flows.** Focus is lost after page changes and after adding to cart, focus rings are invisible in places, and nearly all navigation is buttons instead of links. That last point also means search engines see only one URL and, behind the age gate, 38 words.

## Guardrails for Cursor

- Never invent business facts or content. That covers prices, discounts, Net-30 terms, minimums, delivery fees, cutoffs and route ZIPs, approval times, license rules, flavors, sizes and pack counts, brand facts, legal or policy text, email addresses and the domain. Put 'TODO(owner): <question>' at the spot, list it in docs/OWNER-TODO.md with the finding id, and ship neutral copy that makes no claim.
- Never create, generate, AI-edit or download product, hero, brand-logo, warehouse or logo images. Wire in only files the owner supplies with the right to use them, named p<id>-<slug>.<ext> and processed by scripts/build-images.mjs. Missing art uses the Picture placeholder.
- Prices never enter the repo or the client bundle: not src/data/products.js, not supabase/seed, not tests or fixtures. Supabase is the source of truth: products, pricing_tiers, enforce_order_item_price, submit_quote and the pricing RPC. The browser displays prices returned by the server and never sends prices or totals.
- RLS and SECURITY DEFINER functions are the enforcement layer. Every client-side gate (admin, approved-buyer pricing, suspended accounts, document limits, quantity limits) needs a matching server check. Add new timestamped migrations only and never edit an existing one. Recreate functions from their latest definition with 'set search_path = public' and grant them again. Test on a local Supabase. Never run SQL against production, and never use the service-role key in client code.
- Catalog edits change src/data/products.js (never price), then run 'npm run seed', then add an idempotent UPDATE data migration for rows already in the database. Deactivate products instead of deleting them. Any change to ids, SKUs, variant labels or department and sub-line keys needs a redirect or alias, and must keep cart lines, Quick Reorder and order history working.
- Keep the 2A editorial palette tokens (--orange, --orange-dark, --button-orange, --purple, --purple-deep, --ink, --muted, --paper, --cream, --line) and the bundled Barlow Condensed and DM Sans in src/fonts. Write plain CSS in src/index.css using :root tokens only. No Tailwind, CSS-in-JS, UI kits, external font or CDN links, or new ad-hoc hex values. Light theme only.
- After Phase 1, every internal link uses the router's Link or navigate with path URLs rendered as <a href>. Read any '#/…' route in a finding's fix text as the equivalent path. Keep the legacy-hash redirect and Netlify's /* → /index.html fallback.
- Gate every phase and every cluster commit on Node 24: 'npm run build' (which includes the image build), lint, unit tests, and the Playwright smoke test against 'npm run preview' must all pass. Never disable a rule, test or check to get a green build.
- New UI must meet this accessibility floor:
  - real <a>, <button> and <input> elements;
  - a visible :focus-visible ring;
  - touch targets of at least 44px;
  - text of at least 12px, in rem;
  - labels and inline errors tied with aria-describedby;
  - state changes announced through the shared live region;
  - dynamic text as the only child of an always-rendered element;
  - hover styles only inside @media (hover: hover).
- Implement only the finding in hand plus this plan's cluster notes. Make one commit per id or cluster, with the ids in the commit message. Pure refactors change no behaviour. Don't delete data, exports or copy that another pending finding still uses.
- Don't add any third-party script, font, image or analytics host without updating the CSP in netlify.toml and the privacy policy's list of processors in the same change. Keep personal data out of URLs, analytics events and logs. Store nothing in localStorage beyond the cart and the age flag. Keep .env* files out of git.
- Copy uses sentence case and US English, with one terminology map for the basket, the apply CTA and account states. No profanity and no claims that can't be verified. The FDA nicotine warning is quoted verbatim.

## Totals

| | Critical | High | Medium | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| [Storefront pages](01-storefront-pages.md) | 0 | 7 | 22 | 23 | 52 |
| [Cart, checkout, accounts & admin](02-cart-checkout-accounts-admin.md) | 0 | 14 | 44 | 32 | 90 |
| [Content, catalog data & photos](03-content-data-photos.md) | 2 | 10 | 23 | 21 | 56 |
| [Design, responsive layout & accessibility](04-design-responsive-accessibility.md) | 0 | 9 | 34 | 26 | 69 |
| [Engineering, SEO, performance & security](05-engineering-seo-security.md) | 1 | 10 | 38 | 39 | 88 |
| **All** | **3** | **50** | **161** | **141** | **355** |

By who acts: Cursor 301 · Owner → Cursor 54.

## Fix-first list (critical and high)

| ID | Sev | Who | Finding | File |
| --- | --- | --- | --- | --- |
| AW-001 | Critical | Owner → Cursor | Storefront advertises kratom, 'mushroom', detox/synthetic-urine and sexual-enhancement products from an Alabama warehouse | [03-content-data-photos](03-content-data-photos.md) |
| AW-002 | Critical | Owner → Cursor | Every list price looks like a placeholder: pack sizes and product sizes are priced backwards and unrelated items share identical prices | [03-content-data-photos](03-content-data-photos.md) |
| AW-003 | Critical | Cursor | 'Locked' trade prices for all 368 SKUs are public in the JS bundle and the anonymous Supabase API | [05-engineering-seo-security](05-engineering-seo-security.md) |
| AW-004 | High | Cursor | Homepage hero has no headline, H1, value proposition or CTA (desktop and mobile) | [01-storefront-pages](01-storefront-pages.md) |
| AW-005 | High | Owner → Cursor | No trust signals anywhere on the homepage | [01-storefront-pages](01-storefront-pages.md) |
| AW-006 | High | Owner → Cursor | Hero imagery is small, low-res packshots that don't represent a multi-department distributor | [01-storefront-pages](01-storefront-pages.md) |
| AW-007 | High | Cursor | Search has no results page: Enter opens the first product and the result count stops at 10 | [01-storefront-pages](01-storefront-pages.md) |
| AW-008 | High | Cursor | Filter, sort and search state is not in the URL and is lost on Back and reload | [01-storefront-pages](01-storefront-pages.md) |
| AW-009 | High | Cursor | Product photo is cropped or pushed to the bottom edge because the <img> ignores the frame height | [01-storefront-pages](01-storefront-pages.md) |
| AW-010 | High | Owner → Cursor | Product photos show a different product (Pepsi → Aquafina, Monster → Softsoap, eFrutti → Gummi Eyez with AI watermark, etc.) | [01-storefront-pages](01-storefront-pages.md) |
| AW-011 | High | Cursor | "Choose variant" on a bare cart line loses the reorder quantity and leaves an unfixable line that blocks checkout | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-012 | High | Cursor | Cart is not cleared after a successful quote/order unless the user clicks 'Back to home', inviting duplicate submissions | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-013 | High | Cursor | Quantity can only change one unit per tap and has no bounds/integer validation | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-014 | High | Owner → Cursor | Guests can submit a quote for tobacco/vape products without any retail license, tobacco permit or tax ID | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-015 | High | Cursor | Auth email links take over the whole site: any recovery or error link keeps the Reset Password page on top of every route | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-016 | High | Cursor | No way to resend the sign-up confirmation email, and no landing state after confirming | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-017 | High | Cursor | Admin Accounts table hides the EIN, license, resale certificate and other application details staff must verify | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-018 | High | Cursor | The trade application loses everything typed after one click outside the dialog or one Escape press | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-019 | High | Owner → Cursor | The application captures no explicit consent to Trade terms or Privacy, and the privacy policy omits uploaded license files | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-020 | High | Cursor | Admin Orders cards hide the delivery method, requested date and order total, and show 'Deliver to' on will-call orders | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-021 | High | Cursor | Admin Accounts status, tier and role dropdowns are squeezed until their values are unreadable | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-022 | High | Cursor | Order confirmation screen shows only a thank-you and a reference: no items, delivery details, next step to order history, or print, and it disappears on reload | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-023 | High | Cursor | The Products editor can change only name, brand, price, tag and active. It can't add, delete or duplicate a SKU, change a photo, or edit the description, variants, sell unit, department/sub-line or SKU | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-024 | High | Owner → Cursor | A guest quote can't be priced, answered, edited or turned into an order, and orders have no quoted or confirmed stage | [02-cart-checkout-accounts-admin](02-cart-checkout-accounts-admin.md) |
| AW-025 | High | Owner → Cursor | Advertised 'Net-30 trade terms' and 'Save up to 18%' volume discounts are not backed by the pricing system (capped at 10%) or stated in the Trade terms | [03-content-data-photos](03-content-data-photos.md) |
| AW-026 | High | Cursor | Nicotine warning is non-standard, 11px, only below the footer, and missing on nicotine product pages | [03-content-data-photos](03-content-data-photos.md) |
| AW-027 | High | Owner → Cursor | Privacy policy omits uploaded license documents, browser storage, service providers, retention, sharing and user rights | [03-content-data-photos](03-content-data-photos.md) |
| AW-028 | High | Owner → Cursor | Trade terms omit returns and damaged goods, credit terms, taxes, risk of loss, liability and governing law | [03-content-data-photos](03-content-data-photos.md) |
| AW-029 | High | Owner → Cursor | 77 products (21%) have no photo and show a near-invisible two-letter initials placeholder | [03-content-data-photos](03-content-data-photos.md) |
| AW-030 | High | Owner → Cursor | Variants of different sizes and pack counts all share the parent's single price | [03-content-data-photos](03-content-data-photos.md) |
| AW-031 | High | Owner → Cursor | 344 of 368 products don't say what quantity 1 means (no sell unit) | [03-content-data-photos](03-content-data-photos.md) |
| AW-032 | High | Cursor | Re-running the product seed silently overwrites admin edits to name, brand, price and tag | [03-content-data-photos](03-content-data-photos.md) |
| AW-033 | High | Owner → Cursor | Many product photos were copied from retailers and competitor wholesalers, and Wikimedia images carry no attribution | [03-content-data-photos](03-content-data-photos.md) |
| AW-034 | High | Owner → Cursor | Ad banners, retailer listing tiles, lifestyle/stock shots and collages are used as product photos | [03-content-data-photos](03-content-data-photos.md) |
| AW-035 | High | Owner → Cursor | The only logo asset is a 320px JPEG with a white fringe: the wordmark is unreadable in the header, and it is upscaled with a white edge line into the share image and app icons | [04-design-responsive-accessibility](04-design-responsive-accessibility.md) |
| AW-036 | High | Cursor | Hero carousel images overflow the stage and cover the controls and the next section | [04-design-responsive-accessibility](04-design-responsive-accessibility.md) |
| AW-037 | High | Cursor | Page changes don't reset scroll correctly: the new page renders at the old scroll position and then smooth-scrolls up, and in Safari/WebKit it lands at the footer | [04-design-responsive-accessibility](04-design-responsive-accessibility.md) |
| AW-038 | High | Cursor | Browsers that force dark mode auto-darken the whole site because it declares no color scheme and has no dark theme | [04-design-responsive-accessibility](04-design-responsive-accessibility.md) |
| AW-039 | High | Cursor | With Google Translate on, common catalog, policy and reorder actions crash React and blank the whole site | [04-design-responsive-accessibility](04-design-responsive-accessibility.md) |
| AW-040 | High | Cursor | Keyboard focus ring is invisible on the age-gate buttons and on the purple contact strip | [04-design-responsive-accessibility](04-design-responsive-accessibility.md) |
| AW-041 | High | Cursor | SPA page changes drop keyboard focus to <body> or leave it in the header, and the new page is never announced | [04-design-responsive-accessibility](04-design-responsive-accessibility.md) |
| AW-042 | High | Cursor | Adding/removing items drops focus to <body> and nothing is announced | [04-design-responsive-accessibility](04-design-responsive-accessibility.md) |
| AW-043 | High | Cursor | All internal navigation is <button> + hash routing, so there are no real links and only one crawlable URL | [04-design-responsive-accessibility](04-design-responsive-accessibility.md) |
| AW-044 | High | Cursor | The age gate replaces the whole app, so crawlers and non-JS clients index only 38 words | [05-engineering-seo-security](05-engineering-seo-security.md) |
| AW-045 | High | Cursor | Browser-storage reads are unguarded: blocked storage crashes the first render, and a malformed stored cart ('null', arrays) blanks the site or creates phantom lines | [05-engineering-seo-security](05-engineering-seo-security.md) |
| AW-046 | High | Cursor | Cart changes in one tab overwrite another tab's cart: lines vanish silently and cleared carts come back | [05-engineering-seo-security](05-engineering-seo-security.md) |
| AW-047 | High | Cursor | If Sign Out can't reach Supabase, the session stays saved: the header says signed out, but a reload signs the previous buyer back in, and other tabs stay signed in | [05-engineering-seo-security](05-engineering-seo-security.md) |
| AW-048 | High | Cursor | When the session ends, the site silently switches to guest mode: mid-checkout, 'Submit order' becomes an unpriced guest 'Submit quote request' with no message | [05-engineering-seo-security](05-engineering-seo-security.md) |
| AW-049 | High | Cursor | Quote reference numbers are a 5-digit client-side random value, so they collide and can be pre-claimed to block every quote | [05-engineering-seo-security](05-engineering-seo-security.md) |
| AW-050 | High | Owner → Cursor | Nobody is notified when a quote or order is saved, so orders sit unseen until someone opens #/admin | [05-engineering-seo-security](05-engineering-seo-security.md) |
| AW-051 | High | Owner → Cursor | Backend setup never configures a production email sender, so confirmation and password-reset emails will not reach customers | [05-engineering-seo-security](05-engineering-seo-security.md) |
| AW-052 | High | Owner → Cursor | The production domain hard-coded across the site, alabamawholesaleinc.com, is not registered | [05-engineering-seo-security](05-engineering-seo-security.md) |
| AW-053 | High | Cursor | A production build without the Supabase env vars succeeds silently and ships a site with sign-in, applications and quotes disabled | [05-engineering-seo-security](05-engineering-seo-security.md) |

## Implementation plan

Work through the phases in order. Each phase lists finding IDs; the details are in the numbered files.

### Phase 1: Foundations: toolchain, code structure and client architecture

Make the repo safe to change (supported Node and Vite, env-guarded builds, lint, tests and CI, App.jsx split with no behaviour change, crash resilience). Then replace the shared client plumbing that most later fixes build on: path routing, the age gate overlay, one auth provider, a cart storage module and a catalog provider.

**50 findings:** AW-008, AW-015, AW-037, AW-039, AW-041, AW-043, AW-044, AW-045, AW-046, AW-047, AW-048, AW-053, AW-065, AW-083, AW-087, AW-089, AW-156, AW-164, AW-176, AW-181, AW-183, AW-184, AW-185, AW-186, AW-187, AW-188, AW-189, AW-190, AW-191, AW-193, AW-204, AW-209, AW-211, AW-212, AW-214, AW-228, AW-232, AW-317, AW-327, AW-330, AW-331, AW-335, AW-336, AW-337, AW-338, AW-339, AW-340*, AW-350, AW-353, AW-354

**How to do it:**

Send the owner the Phase 8 checklist on day 0.

Part A changes no behaviour. Land it, verify it and commit it before starting Part B:
1. AW-212: Node 24 in .nvmrc and netlify.toml, an engines field and engine-strict.
2. AW-211: Vite 7 and plugin-react 5. Turn npm audit back on in .npmrc and NPM_FLAGS.
3. AW-053: make vite.config a function that fails production builds without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
4. AW-353.
5. AW-209: ESLint, Vitest, a Playwright smoke test and GitHub Actions. Move TIER_DISCOUNT and priceForProfile into src/lib/pricing.js and cover them with tests.
6. AW-330: split App.jsx into src/lib/{router,meta,search,pricing,format,cart}.js and components as pure moves. Include AW-184 (src/lib/format.js) and AW-331 (CallOrEmail, src/lib/errors.js, CartLine).
7. AW-183: an ErrorBoundary around routes.
8. AW-193: a static boot shell and a noscript message.
9. AW-039 and AW-164: render each dynamic string as the only child of an always-rendered element, and add a lint check for it.
10. AW-350 and AW-214.

Part B, in this order:
1. Router (AW-043): History API, a Link component that renders <a href>, and a boot redirect from legacy '#/' URLs. The redirect runs only after the auth provider has read any Supabase '#access_token' or '#error' fragment. Then AW-185; AW-188 with AW-232 (a NotFound view with search and department links); AW-327; AW-037 (scroll reset in useLayoutEffect); AW-041 (focus the h1 and announce it); AW-065 (Back closes dialogs through the dialog's close handler); AW-008 (the query string is the only filter state, so AW-228 reduces to keying CategoryPage by department); AW-181 and AW-338 (a meta module reading one SITE_URL); AW-317 (a path sitemap generated at build time).
2. Age gate as a ModalLayer overlay: AW-044, AW-176, AW-156, AW-339 and AW-340. The re-prompt interval is owner input: use a default constant with a TODO(owner).
3. AuthProvider: AW-187 first, then AW-186, AW-087, AW-089, AW-015 and AW-047, AW-337, AW-048, AW-335, AW-336 and AW-190.
4. src/lib/cartStorage.js: AW-045, AW-354, AW-046, AW-189 and AW-083.
5. Catalog provider: AW-204 and AW-191.

Blocked on owner: AW-340.

Test when done:
- npm ci works on Node 24.
- The build fails without the env vars and passes with them.
- Lint, unit tests and the Playwright smoke pass in CI.
- On a Netlify deploy preview, /product/12, /category/TOBACCO and /quote load directly and on reload, and old '#/' links redirect.
- Back and Forward restore filters and scroll position.
- Malformed URLs show NotFound.
- Focus lands on each page's h1 and is announced by a screen reader.
- A fresh browser profile renders page content beneath the age-gate overlay.
- Two tabs stay in sync for the cart, age confirmation and sign-out.
- Signing out while offline still leaves you signed out after a reload.
- Only type=recovery links open the reset page.
- Chrome Translate on the category, policy and reorder pages causes no crash.

### Phase 2: Foundations: backend boundaries, pricing and catalog data model

Make Supabase the only source of prices and business rules, and give variants and sell units a real data model. Harden submit_quote, profiles, document storage, hosting headers and transactional email before any UI depends on them.

**35 findings:** AW-001*, AW-002*, AW-003, AW-014*, AW-019*, AW-030*, AW-031*, AW-032, AW-049, AW-050*, AW-051*, AW-052*, AW-077, AW-079, AW-088*, AW-092, AW-093*, AW-126, AW-128, AW-135, AW-138, AW-182, AW-196, AW-197, AW-198, AW-201, AW-205, AW-206*, AW-207, AW-213*, AW-233, AW-332, AW-348, AW-351, AW-352

**How to do it:**

Write new timestamped migrations only. Test each one on a local Supabase (supabase start, db reset, seed) and list it in the BACKEND.md release checklist (AW-213). Cursor never runs SQL against production.

Order:
1. AW-032: make the seed insert-only. From here on, every catalog correction ships as the products.js edit plus an idempotent UPDATE data migration.
2. Pricing boundary (AW-003, AW-351, AW-077):
- Revoke the price columns from anon and authenticated, with column grants or a price-less view.
- Make products.price nullable (null means price on request).
- Strip price from products.js and build-seed.
- Add an RPC for approved buyers only that returns list price, tier and a unit price rounded to cents for each product and variant.
- Make src/lib/pricing.js an adapter over that RPC and update the Phase 1 tests.
- AW-002: the owner's prices go in through admin or a private SQL file, never the repo.
3. Variant model: AW-030 (price and availability per variant, read by enforce_order_item_price), AW-332, AW-233, AW-128 (axis label), AW-138, AW-135 (plus an old-to-new SKU alias for Quick Reorder), AW-126, and AW-031 (a required sell unit shown on the PDP, cards, cart and quote).
4. AW-001: deactivate the kratom rows by migration and remove them from products.js and the home copy now. The other flagged lines wait for the owner's legal review.
5. One migration that recreates submit_quote with AW-049, AW-198, AW-201, AW-079 (address optional for will-call, UI included) and AW-014 (add the license parameters now, enforce once the owner sets the policy).
6. One profile migration: AW-196, AW-352, AW-197, AW-207, AW-348, AW-092 (store address fields in the form) and AW-019 (consent checkboxes and columns).
7. Email: AW-051 docs and the AW-093 templates and config. Then one dispatcher (DB webhook plus Edge Function) for AW-050 (order created) and AW-088 (account approved).
8. Hosting: AW-205 and AW-182 headers, the AW-052 www redirect and SITE_URL, and a AW-206 Turnstile wrapper with its host added to the CSP.

Blocked on owner: AW-002, AW-030, AW-031 (the values), AW-001 (the non-kratom lines), AW-014, AW-019, AW-050, AW-051, AW-088, AW-093, AW-206, AW-213 and AW-052. Land the schema and plumbing with TODO(owner) markers and neutral fallbacks. Don't hold the phase for them.

Test:
- An anonymous REST select of price is denied, and a grep of dist/ finds no prices.
- An approved test buyer's line totals equal the saved subtotal to the cent.
- Guests, pending and suspended users see no prices.
- Suspended and over-limit submissions fail with typed hints.
- Reference numbers are generated on the server and are unique.
- A will-call quote saves without an address.
- Self-updates of role, status, license or EIN fail.
- Uploads outside auth.uid()/ fail.
- is_admin() is false for a suspended admin.
- Re-running the seed keeps admin edits.
- curl -I on the deploy preview shows the headers, and the console shows no CSP errors.

### Phase 3: Foundations: design system and media pipeline

Replace the Tailwind leftovers and ad-hoc px and hex values with one token-driven stylesheet plus shared component and state rules. Make images resilient and consistent before any page-level visual work.

**36 findings:** AW-038, AW-040, AW-073*, AW-125, AW-141*, AW-143, AW-145, AW-146, AW-147, AW-151, AW-160, AW-162, AW-172, AW-174, AW-175, AW-178, AW-180, AW-192, AW-218, AW-287, AW-291, AW-292, AW-293, AW-294, AW-295, AW-296, AW-297, AW-298, AW-301, AW-302, AW-309, AW-322, AW-324, AW-343, AW-345, AW-355

**How to do it:**

1. AW-125 first:
- Remove the @tailwind directives, tailwind.config.js, the PostCSS plugin and the dependency.
- Re-add only the resets that pages relied on.
- Screenshot home, category, PDP, quote, dialogs, account and admin at 375, 768 and 1280 before and after, and fix regressions.
2. Tokens in :root:
- AW-292 colors.
- AW-174, AW-162 and AW-291 as one rem scale with a 12px floor.
- AW-294 and AW-038.
- AW-178: metric-matched fallbacks and a woff2 preload for the bundled fonts.
3. Shared rules:
- AW-143 and AW-298: buttons.
- AW-146, AW-172, AW-147 and AW-309: one field rule.
- AW-297: links.
- AW-295: callouts using the danger and success tokens.
- AW-296: number markers, for ordered steps only.
- AW-293 with AW-218: inline SVG icons.
- AW-301: move inline styles into classes.
4. States:
- AW-145 and AW-160: hover rules only inside @media (hover: hover).
- AW-040, AW-175 and AW-302.
- AW-151: one mobile and short-landscape condition shared by JS and CSS.
5. Picture component: AW-192, AW-343 and AW-345.
6. Rewrite scripts/build-images.mjs:
- AW-180 and AW-355: one manifest, assetsInlineLimit 0, no eager glob.
- AW-287 and AW-141.
- AW-073: never upscale.
- AW-322 and AW-324.

Keep the 2A palette and the bundled fonts.

Blocked on owner: AW-141 (white or cream tiles; default to white) and AW-073 (high-resolution sources).

Test:
- Visual diffs are reviewed and accepted.
- A second build skips unchanged images, and the main chunk has no base64 images.
- PDP CLS is under 0.1.
- At 200% browser text size and 200% zoom at 320px there is no horizontal scroll.
- iOS Safari doesn't zoom when a field gets focus.
- Forced-colors emulation shows which chips and pills are selected.
- Focus rings are visible on purple surfaces.
- Hover doesn't stick under touch emulation.
- A broken image URL shows the placeholder and recovers after reconnecting.

### Phase 4: Critical and high-severity user-facing fixes

Fix the launch-blocking defects in the homepage, search, checkout, onboarding, imagery, admin and legal copy, together with the lower-severity findings that live in the same components.

**65 findings:** AW-004, AW-005*, AW-006*, AW-007, AW-009, AW-010*, AW-011, AW-012, AW-013, AW-016, AW-017, AW-018, AW-020, AW-021, AW-022, AW-023, AW-024*, AW-025*, AW-026, AW-027*, AW-028*, AW-029*, AW-033*, AW-034*, AW-035*, AW-036, AW-042, AW-054, AW-059, AW-060, AW-061, AW-063, AW-064, AW-072, AW-076*, AW-100, AW-108, AW-116, AW-117, AW-118, AW-127*, AW-129*, AW-136*, AW-142*, AW-144, AW-161, AW-165, AW-168, AW-169, AW-171, AW-177, AW-202, AW-208, AW-216, AW-222, AW-246*, AW-275, AW-283, AW-288*, AW-289, AW-290, AW-307, AW-321, AW-341, AW-342

**How to do it:**

Work one cluster at a time, and run the build and smoke test after each.

(A) Business facts and legal copy:
- AW-283 first: one facts module in src/data/content.js with contact details, HOURS with time zone, ORDER_MINIMUM, FREE_DELIVERY_THRESHOLD, APPROVAL_TIME, the license policy and credit terms.
- Then AW-025, AW-076, AW-129, AW-246, AW-127 and AW-275.
- AW-026 with AW-144: the FDA warning verbatim and legible, also on nicotine product pages.
- Then AW-027 and AW-028.
- Until the owner confirms a fact, remove the claim (for example Net-30 or 'up to 18%') instead of rewording it.

(B) Cart and checkout:
- AW-011.
- AW-013 and AW-100 on one QuantityInput that uses the server's 100,000 limit.
- AW-042 and AW-072 on one toast that is also the polite live region.
- AW-012: clear the cart on success and lock the form while it sends.
- AW-022 and AW-108: a receipt built from the submit_quote response and kept in sessionStorage.

(C) Search, in order: AW-063 and AW-064 in src/lib/search.js with unit tests; AW-171 (combobox) with AW-165; AW-007 (a /search?q= page with noindex); AW-222 and AW-307.

(D) Homepage:
- Settle the hero form first (see conflicts). Then AW-004, AW-036, AW-177 and AW-169.
- AW-054, AW-168, AW-161, AW-321 and AW-342 apply only if a rotator stays.
- Section order: hero, then AW-059 services, AW-005 brand strip and trust band, AW-060 and AW-061 departments, then the product rails. Apply AW-216.

(E) AW-009.

(F) Imagery, using owner-supplied files only:
- AW-010, AW-034, AW-033 (remove unlicensed files and add a credits page for CC images), AW-136 and AW-142.
- AW-029: a new placeholder through the Phase 3 Picture fallback until photos arrive.
- AW-290: file naming.
- AW-035 (vector logo), then AW-289, AW-288 and AW-341.

(G) Onboarding: AW-016 (resend link and a landing page after confirmation) and AW-018 (a dirty-form guard, also wired into the Phase 1 Back-to-close).

(H) Admin, in order:
1. AW-118: routed sections.
2. AW-202: error-checked calls.
3. AW-017 as an AccountDetail view, with AW-208 signing document URLs on click.
4. AW-020 and AW-021.
5. AW-023: a ProductEditor that includes AW-116 and AW-117.
6. AW-024: order statuses in a new migration.

Blocked on owner: AW-005, AW-006, AW-010, AW-034, AW-033, AW-136, AW-142, AW-029, AW-035, AW-288, AW-024, AW-025, AW-027, AW-028, AW-076, AW-129, AW-246 and AW-127.

Test:
- Playwright: a guest quote and an approved order, where the UI total equals the saved subtotal.
- A bare reorder line is fixed through 'Choose variant'.
- A double-click on submit creates one order.
- The receipt survives a reload, and the cart is empty afterwards.
- Search finds reese's, m&m's, 'geek bar pulse' and an exact SKU, and works with the arrow keys and Enter.
- The homepage has one h1, LCP is under 2.5 s in Lighthouse mobile, and nothing overflows at 375, 768 or 1280.
- A screen reader announces adds and removals.
- Admin can approve a test account with the EIN, license and documents visible, an invalid price is rejected, and a forced RLS failure shows an error.
- The owner signs off the legal copy.

### Phase 5: Medium polish: storefront, catalog, product, cart and checkout

Rebuild the shared storefront components (header, product card, PDP purchase block, cart drawer and forms) and apply the owner's catalog and merchandising decisions.

**69 findings:** AW-055, AW-056*, AW-057*, AW-058*, AW-062, AW-066, AW-067, AW-068, AW-069, AW-070*, AW-071, AW-074, AW-075*, AW-078, AW-080, AW-081, AW-082, AW-091, AW-102, AW-103, AW-107, AW-119, AW-131, AW-132, AW-133, AW-134*, AW-137*, AW-139*, AW-140*, AW-148, AW-150, AW-152, AW-153, AW-154, AW-157, AW-158, AW-159, AW-163, AW-166, AW-167, AW-170, AW-173, AW-179, AW-215, AW-217*, AW-221, AW-224, AW-225, AW-227, AW-229, AW-234, AW-235, AW-237, AW-238, AW-239, AW-241, AW-243, AW-247, AW-248, AW-265, AW-267, AW-274, AW-306, AW-310, AW-311, AW-314, AW-315, AW-323, AW-346

**How to do it:**

Start with the terminology map (AW-132, AW-131, AW-057) and the owner's department names (AW-134, AW-217). Later labels read from them. Renamed department and sub-line keys need router redirects and a data migration.

Then:

(A) Header:
- AW-153: a compact sticky header that publishes --header-h.
- AW-166: a skip link to main#main.
- AW-167: static announcements with a pause control.
- AW-314, AW-315, AW-311, AW-066, AW-267, AW-221 and AW-062.

(B) ProductCard as an <article> with a heading link: AW-170, AW-154, AW-055, AW-107, AW-224, AW-215, AW-346 and AW-323.

(C) Merchandising: AW-119 (featured_rank migration; the NEW tag drives New arrivals), AW-056, AW-139, AW-227 and AW-058.

(D) Category and /catalog pages:
- AW-067, AW-225, AW-157 and AW-158.
- AW-068 first, then AW-069, AW-229 and AW-274 on its secondary SKU index.

(E) The owner's catalog audit, shipped as data migrations: AW-070, AW-071, AW-137, AW-140 and AW-075.

(F) PDP purchase block:
- AW-163: reorder the column.
- AW-150, AW-237 and AW-133.
- AW-265, using data from the pricing RPC.
- AW-234.
- AW-074 and AW-235: a required radiogroup with an inline error.

(G) Cart drawer: AW-103, AW-238 (thresholds from the facts module), AW-152, AW-306 and AW-239.

(H) Forms and checkout:
- The shared Field layer for AW-173 first, then AW-078, AW-091, AW-247, AW-248, AW-243 and AW-310.
- AW-080 (a draft keyed by profile id) and AW-102; see the form-seeding conflict.
- AW-081, AW-241 and AW-159.
- AW-082: undo through the cart storage module.

(I) AW-148 (print stylesheet), then AW-179 (route-level React.lazy) last.

Blocked on owner: AW-056, AW-057, AW-058, AW-134, AW-217, AW-070, AW-137, AW-139, AW-140 and AW-075.

Test:
- Keyboard and screen-reader pass of the header, cards and PDP.
- Cards open in a new tab.
- The sticky header, filter bar and mega menu fit at 375x812, 812x375 and 1024x768.
- Brand filter counts match the results.
- An approved buyer's per-item and line totals match the saved quote.
- Inline errors are announced, and focus moves to the first invalid field.
- Print preview of the PDP, quote and receipt.
- The bundle report shows admin, account and auth in separate chunks, and a forced chunk failure offers Reload.

### Phase 6: Medium polish: accounts, onboarding, admin operations and support

Give buyers, applicants and staff reliable error handling, clear account states, working document uploads, a scalable admin, consolidated support pages and launch telemetry.

**52 findings:** AW-084, AW-085, AW-086, AW-090, AW-094, AW-095, AW-096, AW-097, AW-098, AW-099*, AW-101, AW-104, AW-105, AW-106, AW-109, AW-110, AW-111, AW-112, AW-113, AW-114, AW-115, AW-120, AW-121, AW-122, AW-123*, AW-124*, AW-130*, AW-149, AW-155, AW-194, AW-195, AW-199, AW-200, AW-203, AW-210*, AW-244, AW-245, AW-249, AW-251, AW-252, AW-254, AW-257, AW-258, AW-264, AW-266, AW-268, AW-269, AW-273, AW-326, AW-333, AW-344, AW-347

**How to do it:**

(A) Error and network layer first:
- src/lib/errors.js with AW-084 and AW-200 (map the submit_quote hints).
- AW-194: a timeout per call using AbortSignal. Don't add a global fetch timeout, because it would abort uploads.
- AW-344: useOnlineStatus and an offline bar.

(B) Account:
- AW-086.
- One status-label map for AW-149, AW-101 and AW-097 and AW-098.
- One rewrite of the order-history fetch for AW-104, AW-105 and AW-326.
- AW-109 and AW-252.

(C) Dialog shell: AW-155 and AW-245 (sticky header and padding for short landscape screens), AW-090, AW-096, AW-249 and AW-333.

(D) Documents:
- One state machine per document for AW-094, AW-095, AW-257 and AW-264, AW-195, AW-244, AW-251 and AW-347.
- One status-aware panel on /apply and /account for AW-085 and AW-254 and AW-258.
- AW-099: a 'received' summary plus a notice to staff through the Phase 2 dispatcher. The recipients come from the owner.

(E) Admin:
- One paged query helper with counts per status (AW-199), then AW-115 and AW-106, AW-268, AW-266 and AW-269.
- AW-112 and AW-203 through the ConfirmDialog, with self-demotion also blocked in SQL.
- AW-113 extends the Phase 4 AccountDetail view.
- AW-110: order_events audit and notes, CSV export, pick-list print.
- AW-111: realtime updates and a 'new since last visit' marker.
- AW-114: bulk price changes and CSV import and export. Prices are never written to the repo.

(F) Support:
- AW-122 (SupportLayout) first, then AW-121, AW-273 and AW-120.
- AW-130: merge /shipping into /delivery, with a redirect.
- AW-123: ZIP lookup.
- AW-124: map, photo and will-call details.

(G) AW-210 (telemetry) last. Update the CSP and the privacy policy in the same change, and put no personal data in events.

Blocked on owner: AW-099, AW-123, AW-124, AW-130 and AW-210.

Test:
- On offline and stalled networks, submit and sign-in time out with a friendly message and the form unlocks.
- Guest, pending, approved and suspended accounts each see the right copy on /account and /apply.
- Two uploads at once work, a failed upload can be retried with the same file, and a renamed .exe is rejected.
- Admin with 250+ seeded orders pages correctly and shows correct counts.
- Cancelling an order requires a reason.
- An admin cannot demote themselves, in the UI or in SQL.
- A new guest quote appears live in admin.
- /shipping redirects to /delivery.

### Phase 7: Low-severity nits, cleanup and docs

Clear the remaining low-severity copy, layout, SEO and accessibility nits, delete dead code, and document the final architecture.

**48 findings:** AW-219, AW-220, AW-223, AW-226, AW-230, AW-231, AW-236, AW-240, AW-242, AW-250, AW-253, AW-255, AW-256, AW-259, AW-260, AW-261, AW-262, AW-263, AW-270, AW-271, AW-272*, AW-276, AW-277*, AW-278, AW-279*, AW-280, AW-281, AW-282, AW-284, AW-285, AW-286*, AW-299, AW-300, AW-303, AW-304, AW-305, AW-308, AW-312, AW-313, AW-316, AW-318, AW-319, AW-320*, AW-325, AW-328, AW-329, AW-334, AW-349

**How to do it:**

These are small, independent fixes. Batch them by component and make one commit per id.

Suggested order:
1. Breadcrumbs component: AW-230, AW-226 and AW-325.
2. Reset-password state model: AW-349 (re-authenticate, and sign out other sessions), then AW-253, AW-255, AW-256, AW-261, AW-262 and AW-263.
3. Auth dialog copy: AW-282 and AW-259 and AW-260.
4. Apply page: AW-242, AW-250 and AW-272.
5. Support pages: AW-270 (add Tennessee only if the owner confirms the routes), AW-271, AW-276, AW-277, AW-278, AW-279 and AW-280, and AW-220.
6. Footer: AW-285, AW-219, AW-305 and AW-313.
7. SEO text: AW-318, AW-319 and AW-320.
8. Remaining nits:
- AW-240, AW-316, AW-281 and AW-284.
- AW-303, AW-304 and AW-308.
- AW-299: a shared EmptyState.
- AW-300, AW-312, AW-223, AW-231 and AW-236.
- AW-334: wording that matches per-account carts.
- AW-286.
9. AW-328: delete only exports that are still unused.
10. AW-329 last: rewrite the README for the final architecture.

Blocked on owner: AW-272, AW-277, AW-279, AW-286 and AW-320.

Test (full regression):
- The Playwright suite passes.
- An axe scan of every route finds no serious or critical issues.
- Lighthouse mobile scores 90 or more for performance, accessibility and SEO on the home, category and product pages.
- Every TODO(owner) is either resolved or listed in docs/OWNER-TODO.md.

### Phase 8: Owner actions (outside the code)

Collect the owner decisions, content, assets and account setup that unblock the 54 owner-then-cursor findings placed in Phases 1–7.

**How to do it:**

No finding is owner-only, so this phase has no ids. It is the owner's half of the 54 owner-then-cursor findings. Send it on day 0: the owner's answers can arrive while Phases 1–7 are underway, and each answer unblocks the ids in brackets.

Policy and legal:
- Legal review of the kratom, mushroom, detox and sexual-enhancement lines [AW-001].
- Privacy policy and trade terms reviewed with counsel, plus a terms version [AW-027, AW-028, AW-019].
- Who is eligible for Net-30, and the real maximum discount [AW-025].
- Whether the $500 minimum is enforced [AW-076].
- Which buyers need a tobacco license, and what a guest tobacco quote must include [AW-129, AW-014].
- Approval time and the credit application [AW-246, AW-272].
- A lowercase email address on the business domain [AW-127].
- FAQ answers and policy dates [AW-279, AW-277].
- Delivery fees, cutoff, route days and route ZIPs [AW-130, AW-123].
- How often to show the age gate again [AW-340].

Catalog:
- Real list prices, prices per variant and tier discounts, entered through admin or a private SQL file and never the repo [AW-002, AW-030].
- Sell units and pack counts [AW-031].
- Vape flavor lists [AW-137].
- Taxonomy, department names, duplicates, brand facts, descriptions and what each tag means [AW-070, AW-134, AW-217, AW-140, AW-286, AW-075, AW-139].
- Homepage product picks and button naming [AW-056, AW-057].

Imagery, with usage rights:
- Correct, high-resolution packshots to replace missing, wrong, copied, shared or mismatched photos, and the choice of tile background [AW-010, AW-034, AW-033, AW-029, AW-136, AW-142, AW-073, AW-141].
- Hero, collection and warehouse photos [AW-006, AW-058, AW-124].
- Brand logos, with permission [AW-005].
- A vector logo and a share card [AW-035, AW-288].

Accounts and infrastructure:
- Register the domain and point DNS at Netlify [AW-052].
- An SMTP provider with SPF and DKIM, and branded email templates [AW-051, AW-093].
- Who receives order, approval and document notifications [AW-050, AW-088, AW-099].
- Enable Turnstile in Supabase and supply the keys [AW-206].
- Supabase Pro, backups and a separate preview project [AW-213].
- An analytics and error-reporting provider [AW-210].
- The order workflow statuses [AW-024].
- Business profiles and coordinates for structured data [AW-320].

The owner also runs the migrations in production following the BACKEND.md release checklist, and sets the Netlify env vars.

This phase is done when every TODO(owner) marker is resolved or explicitly accepted.

`*` = needs owner input first (Owner → Cursor).

## Shared root causes

One change fixes each group together. Do the change once instead of patching each finding separately.

- **Hash router with <button> navigation** (AW-008, AW-037, AW-041, AW-043, AW-065, AW-181, AW-185, AW-188, AW-228, AW-232, AW-317, AW-327, AW-338). Replace the in-App hash router with src/lib/router.js on the History API. It provides:
  - path URLs, and a Link component that renders <a href>;
  - a boot redirect from legacy '#/' URLs;
  - validated params with canonical redirects and a NotFound view;
  - per-route meta built from one SITE_URL;
  - filter state in the query string, updated with replaceState;
  - a post-navigation hook that resets scroll before paint, closes overlays, and focuses and announces the new h1.
- **Age gate replaces the whole app** (AW-044, AW-156, AW-176, AW-339, AW-340). Always render the app, and show AgeGate as a ModalLayer overlay with a focus trap and an exit screen. Back it with an ageGate helper that stores a timestamped record, expires it, and listens for 'storage' events.
- **useAuth runs as independent copies** (AW-015, AW-047, AW-048, AW-087, AW-089, AW-186, AW-187, AW-190, AW-335, AW-336, AW-337). Use one AuthProvider with:
  - a single onAuthStateChange subscription;
  - one profile fetch, plus refreshProfile;
  - explicit loading, profileReady and sessionEnded states;
  - auth-link parsing in which only type=recovery routes to the reset page;
  - a local-scope sign-out that always clears the stored session.
- **Cart persisted by an unguarded blanket localStorage effect** (AW-045, AW-046, AW-083, AW-189, AW-354). Create src/lib/cartStorage.js with:
  - storage access wrapped in try/catch, and shape validation;
  - a versioned key with a one-time migration;
  - per-user keys, chosen after auth settles;
  - write-through updates outside setState, plus a 'storage' listener;
  - normalization only after the live catalog loads, flagging unavailable lines instead of deleting them.
- **Catalog loading has no status and never refreshes** (AW-191, AW-204). useCatalog becomes a provider that returns products, status, error, refresh and lastLoadedAt. It shows loading, error and retry states, labels stale data, and refreshes when the tab regains focus or the connection comes back.
- **Prices are public and computed in the browser** (AW-002, AW-003, AW-077, AW-351). Revoke the price columns from anon and authenticated, and remove price from products.js and the seed. Add an RPC for approved buyers only that returns list price, tier and unit prices rounded to cents. src/lib/pricing.js becomes an adapter over it, and the order trigger uses the same rounding.
- **Variants are bare strings with a separate count and no sell unit** (AW-030, AW-031, AW-126, AW-128, AW-135, AW-138, AW-233, AW-332). Add a structured variant model in products.js and the DB (label, axis, sku, price, available) plus a required sell_unit. Provide variantCount and requiresVariantChoice helpers, generate variant SKUs without truncation, and add an old-to-new SKU alias map.
- **submit_quote trusts the client and checks nothing about the caller** (AW-014, AW-049, AW-079, AW-198, AW-201). One migration that recreates submit_quote with:
  - a unique reference number generated on the server;
  - length and format checks, and rate limits;
  - a check for suspended accounts;
  - will-call orders that need no address;
  - license fields for tobacco quotes from buyers who aren't approved;
  - typed error hints the client can map to friendly text.
- **Profile and document rules are enforced only in the browser** (AW-019, AW-092, AW-196, AW-197, AW-207, AW-348, AW-352). One profile and storage migration with:
  - an allow-list of columns users may update on their own profile;
  - is_admin() true only for an approved admin;
  - approval audit columns;
  - store address and consent columns;
  - a handle_new_user that strips sensitive user_metadata;
  - storage policies bound to auth.uid()/ with a cap per user.
- **No transactional email or notification pipeline** (AW-050, AW-051, AW-088, AW-093). Configure production SMTP and branded templates. Then build one Supabase dispatcher (DB webhook plus Edge Function) for order-created and account-approved events.
- **Netlify config has no headers or domain rules** (AW-052, AW-182, AW-205). One block of headers and redirects in netlify.toml: CSP and security headers, immutable caching for hashed assets, and a www-to-apex redirect.
- **Google Translate mutates mixed text nodes** (AW-039, AW-164). Render every dynamic string as one template string that is the only child of an always-rendered element.
- **Tailwind leftovers and ad-hoc px/hex values instead of tokens** (AW-125, AW-143, AW-146, AW-147, AW-162, AW-172, AW-174, AW-291, AW-292, AW-294, AW-295, AW-296, AW-297, AW-298, AW-301, AW-309). Remove Tailwind. Define in :root a rem type scale with a 12px floor, plus color, field, status and link tokens. Write one rule each for buttons, fields, links, callouts, number markers and headings. Move inline styles into classes.
- **Interaction states are not systematized** (AW-040, AW-145, AW-160, AW-175, AW-302). Put all hover rules inside @media (hover: hover). Add a :focus-visible ring token per surface, :active and :disabled states, forced-colors selection indicators, and a 44px minimum target rule.
- **Unicode glyphs used as icons** (AW-218, AW-293). Use one inline SVG icon set, with arrows only on external links.
- **Picture has no loading or error states** (AW-192, AW-343, AW-345). Picture gains an onError fallback, a retry when the connection returns, a loading state, and intrinsic width and height.
- **Image build pipeline** (AW-073, AW-141, AW-180, AW-287, AW-322, AW-324, AW-355). Rewrite scripts/build-images.mjs to:
  - trim and re-pad to one product-to-tile ratio and background;
  - never upscale;
  - add a thumbnail size;
  - emit deterministic URLs from one content-hash manifest;
  - stop the eager glob.
  Fix the sizes attribute in images.js.
- **Only a 320px raster logo** (AW-035, AW-288, AW-289, AW-341). A vector logo master drives the header, age-gate and footer logo (with a text fallback), the favicons, maskable icons and the share card.
- **Autoplay hero carousel with no text and slide boxes of different sizes** (AW-004, AW-006, AW-036, AW-054, AW-161, AW-168, AW-169, AW-177, AW-321, AW-342). A split hero with a real h1, value proposition and CTAs over one fixed-aspect image stage, with descriptive alt text. An optional rotator gets pause, swipe, and loading of adjacent slides only.
- **Search is a dropdown with naive substring scoring** (AW-007, AW-063, AW-064, AW-165, AW-171, AW-222, AW-307). src/lib/search.js (normalization, all-terms and word-start matching, exact SKU first) behind an ARIA combobox, with a /search results page.
- **Quantity has no shared input or limit** (AW-013, AW-100). One QuantityInput (numeric, clamped to 1–100,000, the server's limit) used by the PDP, cards, drawer, quote page and Quick Reorder.
- **Submitted quote state is discarded** (AW-012, AW-022, AW-108). Lock submit while sending, clear the cart on success, and render a persisted receipt snapshot from the submit_quote response.
- **Business facts and policy claims hard-coded and unverified** (AW-025, AW-076, AW-127, AW-129, AW-246, AW-275, AW-283). One facts module confirmed by the owner (contact details, hours with time zone, minimum order, free-delivery threshold, approval time, license policy, credit terms), referenced by all copy. Remove unverified claims.
- **Product photos were scraped or mismatched** (AW-010, AW-029, AW-033, AW-034, AW-136, AW-142, AW-290). A licensed packshot set supplied by the owner, named p<id>-<slug>, with one photo for each size, pack or variant shown, and a designed placeholder until then. All of it goes through the image pipeline.
- **Admin is one file of inline-edit tables with unchecked calls** (AW-017, AW-023, AW-116, AW-117, AW-118, AW-202, AW-208). Routed admin sections with detail views (AccountDetail and ProductEditor), document URLs signed on click, and a data layer that checks every Supabase error.
- **No shared terminology for the basket and the apply action** (AW-057, AW-131, AW-132). One terminology map keyed by account state that drives every basket label, add button and apply CTA.
- **Five stacked header bars outside the header landmark** (AW-062, AW-066, AW-153, AW-166, AW-167, AW-221, AW-267, AW-311, AW-314, AW-315). One compact header component with:
  - the trade and notice bars merged and moved inside <header>;
  - static announcements and a skip link;
  - a sticky compact state that publishes --header-h;
  - account-aware CTAs and aria-current.
- **Product card is a <button> wrapping block content with overlaid labels** (AW-055, AW-107, AW-154, AW-170, AW-215, AW-224, AW-323, AW-346). Rebuild ProductCard as an <article> with a heading link. Make it a flex column with the action row at the bottom, keep labels and tags off the photo, add a price and unit block, and load the first row eagerly.
- **Merchandising driven by hard-coded id lists** (AW-056, AW-119, AW-139, AW-227). tag, featured_rank and created_at, with one selector for the homepage rails, the Featured sort and the filters, deduplicated across blocks.
- **Catalog content was never audited** (AW-070, AW-071, AW-075, AW-134, AW-137, AW-140, AW-217). An owner-approved catalog audit (taxonomy, names, duplicates, flavors, descriptions, department names) applied to products.js with data migrations.
- **PDP purchase block order and pricing context** (AW-074, AW-133, AW-150, AW-163, AW-234, AW-235, AW-237, AW-265). Restructure the PDP info column on one measure, in this order: name, variant radiogroup, price with tier context from the RPC, unit and SKU spec list, then quantity and add. Cap the image height.
- **Forms rely on native validation and ad-hoc markup** (AW-078, AW-091, AW-173, AW-243, AW-247, AW-248, AW-310). A shared Field and Form layer with visible required markers, inline errors tied by aria-describedby, aria-invalid, focus on the first invalid field, and patterns and inputmode per field type.
- **Raw errors, no timeouts, no offline awareness** (AW-084, AW-194, AW-200, AW-326, AW-344). A src/lib/errors.js mapping, timeouts per call using AbortSignal, and a useOnlineStatus hook, used by every network call site.
- **No account-state model** (AW-097, AW-098, AW-101, AW-149). A derived accountState (guest, pending, approved or suspended) and one map of status labels and copy used by the account, apply and sign-in screens.
- **Document uploads track one busy flag and hide load errors** (AW-085, AW-094, AW-095, AW-099, AW-195, AW-244, AW-251, AW-254, AW-257, AW-258, AW-264, AW-347). A state machine per document (idle, uploading, saved, failed, load-error) with:
  - an input reset after each pick;
  - a busy state that doesn't disable the input;
  - validation by file byte signature;
  - a received summary;
  - one status-aware panel shared by /apply and /account.
- **Dialog shell lacks sticky header, scroll and focus handling** (AW-090, AW-096, AW-155, AW-245, AW-249, AW-333). In ModalLayer and AuthModal:
  - a sticky dialog header;
  - less padding on short screens;
  - scroll reset and focus on each step change;
  - focus restore along the chain of openers;
  - compensation for the scrollbar width.
- **Admin lists load everything client-side and change state without confirmation** (AW-106, AW-112, AW-115, AW-199, AW-203, AW-266, AW-268, AW-269). One paged query helper with server-side filters, search and counts per status, used by the orders, accounts and products tables. Add a shared ConfirmDialog for destructive changes, with checks enforced in SQL.
- **No shared support-page layout** (AW-121, AW-122, AW-273). A SupportLayout with the PolicyNav (current page marked by more than color) and a readable text measure, wrapping every support page.
- **Reset-password page has no explicit state model** (AW-253, AW-255, AW-256, AW-261, AW-262, AW-263, AW-349). Derive the heading, copy, focus target, announcements and actions from one state (signed-out, checking, form, done or recovery). Require re-authentication for signed-in password changes.
- **Breadcrumbs are hand-built on each page** (AW-226, AW-230, AW-325). One Breadcrumbs component (nav plus an ordered list, every ancestor a link, consistent case) used on category, sub-line and product pages.
- **Footer structure** (AW-219, AW-285, AW-305, AW-313). Rebuild the footer: h2 column headings, a responsive grid at 1100px and 600px, and reorganized links and blurb.

## Fixes that conflict or overlap

- **AW-007 + AW-008 + AW-023 + AW-043 + AW-113 + AW-118 + AW-185 + AW-188 + AW-317.** Many fixes are written against the hash router: '#/search/<q>', '#/category/X?q=', '#/admin/products/<id>', a try/catch in the hash parser, and an interim sitemap of '#/' URLs. Meanwhile AW-043 replaces hash routing with path routing.
  **Resolution:** Land AW-043 in Phase 1. Implement every later route as its path equivalent: /search?q=, /category/:dept?sort=&tags=, /admin/products/:id and /admin/accounts/:id. Put the AW-185 and AW-188 validation in the new path parser. Skip AW-317's interim edit and generate the path sitemap directly.
- **AW-015 + AW-043 + AW-052 + AW-093.** Supabase's implicit-flow links arrive as '/#access_token=…&type=…' or '/#error=…', and resetPasswordForEmail redirects to '/'. A legacy-hash redirect or the new router can swallow these links, and the email template and redirect URLs point at hash routes.
  **Resolution:** The AuthProvider reads Supabase fragments before the router's legacy '#/' redirect runs, then clears them. This is safe because auth fragments never start with '/'. Recovery emails redirect to /reset-password. The owner updates the Supabase Site URL and redirect allow-list to the final domain's paths.
- **AW-002 + AW-003 + AW-030 + AW-032 + AW-114.** AW-002 and AW-030 put real prices, including per-variant prices, in products.js and the seed. AW-003 removes prices from the bundle and the anon API. AW-032 makes the seed insert-only, and products.price is NOT NULL.
  **Resolution:** Prices live only in the database. Make price nullable (null means price on request) and stop build-seed from writing prices. Until the Phase 6 CSV import exists, the owner's prices go in through the Phase 4 ProductEditor or a private SQL file that is never committed. Per-variant prices use the same protected storage.
- **AW-077 + AW-209 + AW-265 + AW-351.** AW-209 moves TIER_DISCOUNT and priceForProfile into src/lib/pricing.js and tests them. AW-351 deletes TIER_DISCOUNT. AW-077 adds rounding in the browser. AW-265 builds the tier, list-price and savings display from TIER_DISCOUNT.
  **Resolution:** Phase 1 moves the code and freezes current behaviour under tests. Phase 2 turns pricing.js into an adapter over the pricing RPC for approved buyers and updates the tests. The server already rounds unit prices to cents, and a line total is round(unit × qty). AW-265 reads the tier name, discount and list price from the RPC payload.
- **AW-001 + AW-031 + AW-032 + AW-070 + AW-071 + AW-075 + AW-126 + AW-134 + AW-135 + AW-137 + AW-138 + AW-140 + AW-286.** Once the seed is insert-only (AW-032), catalog corrections made in products.js no longer reach rows that already exist in the database. Keeping the upsert instead would overwrite admin edits.
  **Resolution:** Ship each catalog correction as the products.js edit plus an idempotent UPDATE … WHERE id = … data migration. The seed only inserts new rows. Deactivate products rather than deleting them.
- **AW-070 + AW-083 + AW-126 + AW-134 + AW-135 + AW-137 + AW-138 + AW-354.** Renaming variants, regenerating SKUs, adding flavor lists, and renaming or moving departments all change keys already in use: cart line keys, Quick Reorder SKUs, and category URLs in stored carts and bookmarks.
  **Resolution:** Make key-changing edits before launch and after the Phase 1 cart storage module lands, where AW-083 flags stale lines and AW-354 migrates old carts. Add old-to-new SKU aliases in resolveSkuLine, and router redirects for renamed department and sub-line slugs. order_items keep their snapshots, so order history is unaffected.
- **AW-014 + AW-049 + AW-079 + AW-198 + AW-200 + AW-201.** Five findings each recreate public.submit_quote, and AW-049 changes its signature by dropping p_ref_num. AW-200 depends on the errors the function raises.
  **Resolution:** Write one Phase 2 migration that:
  - drops the 13-argument function;
  - recreates it from the 20260925120000 definition with all the changes and typed error hints;
  - grants execute to anon and authenticated again.
  Update src/lib/orders.js in the same commit. If the owner's license policy for AW-014 arrives later, a follow-up migration recreates the function from the newest definition. AW-200 (Phase 6) only maps the hints.
- **AW-019 + AW-092 + AW-113 + AW-196 + AW-197 + AW-348.** Several findings rewrite handle_new_user or add profile columns: store address, consent and terms version, approval audit, and admin notes. At the same time, AW-196 restricts which columns users may update.
  **Resolution:** Write one Phase 2 profile migration. It adds all the columns, including admin notes for AW-113, and replaces handle_new_user once. Its self-update allow-list covers only the contact and address fields users may edit. Consent, audit, status, role, tier, license, EIN and resale certificate stay locked.
- **AW-085 + AW-197 + AW-207 + AW-254.** AW-207 and AW-197 block applicants from changing documents after approval, so the proof stays auditable. AW-254 and AW-085 want approved and suspended accounts to see, replace or add license documents.
  **Resolution:** After approval, users can view their documents and add new versions (for example a renewed license) under auth.uid()/, and new versions arrive flagged for staff review. Updating or deleting existing records is denied. One status-aware ApplicationDocuments panel serves /apply and /account.
- **AW-004 + AW-036 + AW-054 + AW-161 + AW-164 + AW-168 + AW-169 + AW-177 + AW-321 + AW-342.** AW-004 replaces the carousel, which has no text, with a split hero. The other findings fix parts of that carousel: stage, controls, autoplay, swipe, loading, failure handling, alt text and the slide counter.
  **Resolution:** Decide the hero form first. The recommendation is a split hero with a static h1, value proposition and CTAs beside one fixed-aspect image, which also fixes the overflow and LCP. If the owner keeps a rotating image column, apply AW-054, AW-168, AW-161, AW-321 and AW-342 to it. If not, check that their intent is met and close them as superseded.
- **AW-005 + AW-059 + AW-060 + AW-216 + AW-296.** AW-059 puts services directly after the hero. AW-005 adds a brand strip under the hero and a trust band after services. AW-060 moves departments under the hero and services. AW-296 restyles the service numbers that AW-216 replaces with icons.
  **Resolution:** Use a fixed section order: hero, services strip (three SVG icons, no numbers), brand strip and trust band, shop by department, new arrivals and bestsellers, collections, apply steps. The .num marker is used only for ordered apply steps and next steps.
- **AW-146 + AW-172 + AW-292 + AW-295.** AW-146 sets --field-border to #dcd5cc, which is below 3:1 contrast, while AW-172 sets it to #857d8a. AW-292 and AW-295 both define --success.
  **Resolution:** Define each token once in :root. --field-border is #857d8a (AW-172's value) and AW-146's shared field rule uses it. --success, --danger and their backgrounds come from AW-295. AW-292 adds only the remaining colors.
- **AW-162 + AW-174 + AW-291.** AW-162 converts the 11px --text-xs to .6875rem, but AW-174 sets a 12px floor, and AW-291 adds heading tokens in px.
  **Resolution:** Raise the sizes, then convert them. Use one rem scale with --text-xs at .75rem (12px), remove every 9–11px override, and write AW-291's heading and tracking tokens in rem.
- **AW-143 + AW-145 + AW-160 + AW-298.** AW-160 wraps the existing :hover rules in @media (hover: hover) where they stand. AW-143 and AW-298 rewrite the button hover rules, and AW-145 adds new ones. Done in the wrong order, rules get wrapped twice or sticky hover comes back.
  **Resolution:** Do AW-143, then AW-298, then AW-145, and write every new hover rule inside @media (hover: hover), keeping :focus-visible outside it. Then run AW-160 over the remaining legacy rules without moving them.
- **AW-125 + AW-325 + AW-329.** Removing the Tailwind preflight changes list, button and heading defaults that other findings were measured against. AW-325 works around a text-transform reset from the preflight, and AW-329 documents Tailwind.
  **Resolution:** Remove Tailwind at the start of Phase 3, take new baseline screenshots, and re-add the needed resets explicitly. AW-325 becomes a plain rule in the Breadcrumbs component, and the README drops Tailwind.
- **AW-005 + AW-279 + AW-328.** AW-328 deletes BRANDS and FAQS as unused, but AW-005 builds the brand strip from BRANDS and AW-279 rewrites FAQS for a live FAQ.
  **Resolution:** Run AW-328 in Phase 7 after AW-279, and delete only exports that are still unused. Keep BRANDS and FAQS if they were adopted.
- **AW-048 + AW-057 + AW-066 + AW-131 + AW-132 + AW-281.** AW-132 wants one basket name everywhere. AW-057 wants 'Add to quote' for guests and pending accounts but 'Add to order' for approved buyers. AW-048 relies on the difference between 'Submit order' and 'Submit quote request'. AW-131 wants one apply label, while AW-281 and other pages use their own.
  **Resolution:** Use one terminology map keyed by account state, approved by the owner: 'Quote' for guests and pending accounts, 'Order' for approved buyers, consistent within each state. Use one APPLY_LABEL constant for every apply CTA, hidden for signed-in users (AW-066). Headings may differ from CTA labels.
- **AW-080 + AW-102 + AW-186 + AW-190.** Four findings change how the quote form gets its values: fill them when the profile arrives, reset them when the account changes, prefill phone, state and saved address, and restore a sessionStorage draft.
  **Resolution:** Use one precedence rule in QuotePage:
  - A draft saved for the same profile id wins.
  - Profile values fill only empty fields.
  - A change of profile id (A to B, or A to signed out) discards the draft and fills the form again from the new profile.
  - A successful submit clears the draft.
- **AW-047 + AW-189 + AW-337 + AW-349.** Three findings change the sign-out scope, and AW-349 wants other sessions ended after a password change. The per-user cart key has to follow the same events.
  **Resolution:** signOut defaults to scope 'local' and always clears the stored session. /account offers 'Sign out of all devices', which uses the global scope. A password change calls signOut({ scope: 'others' }). Sign-out switches to the guest cart key without copying the buyer's lines.
- **AW-042 + AW-072.** Both findings confirm an add to the quote: AW-042 through a live-region announcement and a focus move, AW-072 through a visible toast. Done separately, each add is announced twice.
  **Resolution:** Use one toast component that is also the polite live region. Focus stays on the new stepper and never moves to the toast, and the header badge updates.
- **AW-018 + AW-065.** AW-065 closes every dialog on browser Back. That would silently discard a half-filled trade application, which AW-018 protects with a dirty-form guard.
  **Resolution:** Phase 1 routes Back-to-close through the dialog's close handler, and Phase 4 adds the guard there. Back, ×, overlay click and Escape then all ask before discarding input. Cancelling puts the dialog's history entry back.
- **AW-017 + AW-023 + AW-106 + AW-113 + AW-116 + AW-117.** AW-017 suggests a row-expand panel, while AW-113 builds a full AccountDetail page. AW-116 and AW-117 fix the inline product edit row that AW-023 replaces with a ProductEditor, and AW-106 adds SKU to that edit row.
  **Resolution:** Build AccountDetail (/admin/accounts/:id) in Phase 4 with the verification fields and documents, and extend it in Phase 6. Implement the -9 validation and the -10 keyboard and focus behaviour inside the ProductEditor form: Enter saves, Escape cancels, and focus returns to the row's Edit link. AW-106 adds SKU to the read-only list.
- **AW-024 + AW-112 + AW-203.** Confirmations for cancel and suspend (AW-112), role changes (AW-203) and the new order statuses (AW-024) would each get their own confirmation design.
  **Resolution:** Phase 4 builds one ConfirmDialog for the cancel transition in AW-024. Phase 6 reuses it for suspend and role changes and adds a required reason, stored in order_events or the admin notes. Self-demotion and self-suspension are blocked in SQL as well as in the UI.
- **AW-073 + AW-141 + AW-180 + AW-287 + AW-289 + AW-322 + AW-324 + AW-355.** Eight findings each edit scripts/build-images.mjs or the sizes in images.js: deterministic URLs, a second hash manifest, trim and pad, background, no upscaling, thumbnail size and favicon scale.
  **Resolution:** Do one pipeline rewrite in Phase 3, with a single manifest used both for skipping unchanged images by hash and as the URL map. AW-289 later changes only the favicon step, once the vector logo exists.
- **AW-027 + AW-205 + AW-206 + AW-210.** A strict CSP (script-src 'self') blocks Cloudflare Turnstile and any telemetry host added later. Each new processor must also appear in the privacy policy.
  **Resolution:** Ship the CSP first. Add each third-party host to the CSP in the commit that introduces it, check the deploy preview for CSP errors in the console, and update the privacy policy's list of processors at the same time.
- **AW-037 + AW-062 + AW-153 + AW-158 + AW-312.** A compact sticky header changes the offsets used by the sticky filter bar and sidebar, the mega-menu max-height, scroll-padding-top and the scroll reset on route change.
  **Resolution:** The header publishes its measured height as --header-h using a ResizeObserver. The sticky tops, scroll-padding-top and the mega-menu max-height all use it.
- **AW-179 + AW-182 + AW-183 + AW-193.** Code splitting by route adds chunk loads that can fail after a deploy or on a flaky network. Immutable caching makes errors from stale chunks more likely.
  **Resolution:** Wrap lazy routes in the ErrorBoundary with a Reload action for chunk-load errors. Keep index.html uncached, and keep the help text in the boot shell.
- **AW-056 + AW-119 + AW-139 + AW-227.** There are three definitions of featured, new and bestseller (featured_rank plus tag, a set of recently added products with deduplication, and a tag rank for sorting), plus a separate tag audit.
  **Resolution:** Use one merchandising model (tag, featured_rank and created_at) with a shared selector for the homepage rails (deduplicated across blocks), the category Featured sort and the filters.
- **AW-130 + AW-276 + AW-277 + AW-285 + AW-316.** AW-277, AW-276, AW-316 and AW-285 patch /shipping and /delivery separately, while AW-130 merges the two pages.
  **Resolution:** Merge the pages in Phase 6, with /shipping redirecting to /delivery. Then apply the date, deduplication, naming and footer-link fixes to the merged page in Phase 7.
- **AW-068 + AW-069 + AW-229 + AW-274 + AW-284.** AW-068 rebuilds /catalog as a browsable card page, while the other findings fix the current layout of pills and the SKU index.
  **Resolution:** Build AW-068 first, then apply AW-069, AW-229, AW-274 and AW-284 to the SKU index it keeps as a secondary view.
- **AW-007 + AW-181 + AW-338.** Today the meta effect follows the live search box. AW-181 rewrites the meta for each route, and AW-007 adds a search page that needs its own title.
  **Resolution:** The search dropdown never touches the meta. Only /search?q= sets a title, 'Search results for …', clipped to length and marked noindex.
- **AW-013 + AW-100 + AW-198.** The quantity input, Quick Reorder and submit_quote each define their own quantity limits.
  **Resolution:** Share one MAX_QTY of 100,000, the existing limit in the order_items trigger, across QuantityInput, Quick Reorder and the submit_quote checks. Validate quantities as whole numbers of at least 1 everywhere.
- **AW-055 + AW-060.** AW-060 overlays department names on 16:9 photos, while AW-055 moves labels off photos so they stay legible.
  **Resolution:** Product cards keep labels off the photo. Department tiles may overlay text only on a scrim that gives at least 4.5:1 contrast.
- **AW-001 + AW-062 + AW-217.** AW-062 fills the 'Exotics & novelties' feature tile in the mega menu. AW-001 removes kratom from that department, and AW-217 gives the department a single name.
  **Resolution:** Remove the kratom content first, in Phase 2. Then fill the tile using the owner's single department name (AW-217) and products that weren't flagged.

## Owner decisions and actions

These 54 findings need a decision, fact, asset or account setup from the business owner before Cursor can finish them. Phase 8 above groups the same questions by topic.

| ID | Sev | What the owner must decide or supply |
| --- | --- | --- |
| AW-001 | Critical | After legal/compliance review, which product lines (Kratom & Kava, Mushroom Products, Detox, Wellness Pills, Honey & Energy enhancement items) should be delisted, de-featured or kept? |
| AW-002 | Critical | Please supply the real wholesale list price for each of the 368 SKUs (e.g. a price sheet export). |
| AW-005 | High | Confirm the trust facts to publish (years in business, number of retail accounts/routes, whether 'Three generations' and '100% Authentic' are true, correct approval time), supply warehouse/truck photos, and confirm which brand logos you have permission to show. |
| AW-006 | High | Supply wide, high-resolution (2560px+) licensed photos of the warehouse or a multi-department assortment for the hero. |
| AW-010 | High | Supply correct, licensed packshots for the mismatched products (#205, 270, 329, 318, 67, 89, 326, 182, 200, 248, 317, 267, 262), including a watermark-free eFrutti jar photo. |
| AW-014 | High | Decide whether carts with tobacco/vape items should require sign-in as an approved buyer, or allow guest quotes that collect a tobacco license number, resale certificate number and a 21+ attestation. |
| AW-019 | High | Approve the consent checkbox wording and the Trade terms/Privacy policy version the application should record acceptance of. |
| AW-024 | High | Confirm how quotes should work: should staff price and answer guest quotes and convert them to orders, and should orders go through 'quoted' and 'confirmed' stages before picking? |
| AW-025 | High | Do you actually offer Net-30 terms (and to whom), and what is the real maximum volume discount, or should these claims be removed? |
| AW-027 | High | Provide or approve (ideally with counsel) the privacy policy details: service providers used, data sharing, retention periods for uploaded license/EIN documents, and the contact method for access/deletion requests. |
| AW-028 | High | Provide or approve (ideally with counsel) your actual policies on returns, damaged/short shipments, cancellations, substitutions, credit terms, taxes, risk of loss, liability limits and governing law. |
| AW-029 | High | Supply real packshots for the 77 products without photos, starting with Dubai chocolate #342 and the Grocery items. |
| AW-030 | High | Supply the price (and availability) for each size/pack-count variant of the multi-variant products. |
| AW-031 | High | Supply the sell unit (each, box of N, case of N, or size) for each of the 368 products. |
| AW-033 | High | Supply manufacturer-provided or self-shot replacement photos for images copied from retailers and competitor wholesalers, and confirm whether to keep the four Wikimedia images with attribution. |
| AW-034 | High | Supply clean packshot photos to replace the ad banners, retailer tiles, lifestyle shots and collages currently used for Novelties, Tobacco and Merchandise products. |
| AW-035 | High | Supply a vector (SVG) master of the Alabama Wholesale logo with a transparent background. |
| AW-050 | High | Which email address or phone number should receive new quote/order notifications, and which email/SMS provider account should send them? |
| AW-051 | High | Set up an SMTP provider (Resend, Postmark or SES) with a sender address on your business domain and SPF/DKIM records, then enter it in the Supabase Auth settings along with the production and deploy-preview redirect URLs. |
| AW-052 | High | Register alabamawholesaleinc.com (or tell us the final production domain) and connect it in Netlify, so Cursor can set VITE_SITE_URL and replace the hard-coded domain. |
| AW-056 | Medium | Which products are really new arrivals and which are real bestsellers, and can you supply dedicated hero and department images? |
| AW-057 | Medium | Which RAZ 25K flavours do you actually stock, so they can be added as its variants? |
| AW-058 | Medium | Supply or approve licensed photos for the 'Exotics & Novelties' collection card and the Tobacco/cigar collection card. |
| AW-070 | Medium | Approve the department and sub-line for each misfiled product, especially the blue-lotus and hemp items now under 'Mushroom Products', and say whether those lines stay in the catalog. |
| AW-073 | Medium | Supply high-resolution, licensed packshots (at least 800px) for the low-resolution products listed, starting with #324, 112, 333, 96, 117, 346, 122, 335, 77 and 263. |
| AW-075 | Medium | Provide the real pack size, case count, dimensions and key attributes for each product so real descriptions can be written. |
| AW-076 | Medium | Is the $500 minimum order a hard rule that blocks submission, or only a guideline that orders below it may still be submitted? |
| AW-088 | Medium | Should approvals send an automatic email, which needs an email provider or SMTP set up in Supabase, or will a trade rep call or email each approved applicant by hand? |
| AW-093 | Medium | Confirm the production site URL (alabamawholesaleinc.com) and the sender name/logo for the emails, and agree to paste the branded confirmation and reset templates Cursor writes into Supabase Dashboard > Authentication > Emails. |
| AW-099 | Medium | Which staff email address (or channel) should be notified when an applicant uploads license documents, and how quickly will a trade rep review them? |
| AW-123 | Medium | Which ZIP codes or 3-digit prefixes are on each delivery route, and what are each route's delivery days and order cutoff time, plus the list of cities/counties served? |
| AW-124 | Medium | Please supply a warehouse-front photo (or approve a static map), plus how many hours ahead will-call orders must be placed, entrance/parking details, and accepted payment methods at pickup. |
| AW-127 | Medium | Which domain email address (e.g. orders@alabamawholesaleinc.com) is set up and monitored, so it can replace the Gmail address site-wide? |
| AW-129 | Medium | Is a tobacco license required for every trade account, or only for buying tobacco, vapor and nicotine products? |
| AW-130 | Medium | What are the order cutoff time, delivery days per route, the fee for orders under $1,500, tobacco receiving/ID rules, and the damaged/short-shipment claim process? |
| AW-134 | Medium | Do you approve the proposed department/subcategory renames, and what truthful name (after legal review) should replace 'Honey & Energy' and where should row 219 go? |
| AW-136 | Medium | Can you supply (or license) correct photos for the 37 products that currently share 18 photo files, showing each one's actual size, pack or format? |
| AW-137 | Medium | Which flavors does the warehouse actually stock for vape products 60, 61, 64, 65, 66, 67, 68, 254, 310 and 311 (or which are sold only as assorted cases)? |
| AW-139 | Medium | What do the DEAL and PREMIUM tags mean for buyers (the actual deal terms and premium criteria), or should they be removed? |
| AW-140 | Medium | Is #366 Game Palma Green cigars, are #95 and #107 the same stock, and which other Uncle Al's flavors are stocked for #351? |
| AW-141 | Medium | Supply (or approve sourcing/licensing of) replacement packshots on a plain background for the dark or full-bleed product photos, so Cursor can standardize the tiles. |
| AW-142 | Medium | For each product whose photo shows an unlisted flavor or brand, confirm whether that pictured variant is actually stocked (add it) or provide a correct photo of a listed variant. |
| AW-206 | Medium | Create a Cloudflare Turnstile site, enable CAPTCHA in Supabase Authentication > Attack Protection with its secret key, and give Cursor the public site key. |
| AW-210 | Medium | Which cookieless analytics service (Plausible, Umami or Cloudflare Web Analytics), error-reporting service and uptime monitor do you want, and can you create those accounts and supply the site IDs/DSNs? |
| AW-213 | Medium | Will you upgrade production to Supabase Pro (backups, no pausing) and create a separate Supabase project for Netlify preview deploys, and who holds the project ref and backup storage location? |
| AW-217 | Low | Which single name should the Novelties department use everywhere: 'Exotics', 'Novelties & Vapes' or 'Novelties'? |
| AW-246 | Low | How long does trade-account approval actually take (e.g. 'one business day'), so one approval-time phrase can be used everywhere on the site? |
| AW-272 | Low | What approval timeframe should the Apply page promise, and do you offer Net-30 credit terms to approved accounts? |
| AW-277 | Low | What exact effective or last-updated date should each policy (Privacy, Terms, Delivery/Shipping) show? |
| AW-279 | Low | Do you offer Net-30 terms and automatic volume discounts at checkout, and do you approve the rewritten FAQ answers before they go live? |
| AW-286 | Low | For each product currently listed as 'Assorted' (and #343, which mixes eFrutti and SpongeBob), which brand do you actually stock? |
| AW-288 | Low | Please supply a licensed warehouse or product-assortment photo, plus a vector copy of the logo, for the 1200x630 social share card. |
| AW-320 | Low | Please provide the exact latitude and longitude of 613 Graymont Ave N, your Google Business Profile URL and any official social media profile URLs. |
| AW-340 | Low | For tobacco age-gate compliance, how long should a visitor's 21+ confirmation stay valid (e.g. 30 days, per session), and should it be cleared on sign-out? |

