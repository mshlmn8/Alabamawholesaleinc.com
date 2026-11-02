# Cursor handoff: tobacco, vapor and regulated-product items, plus everything waiting on the owner

Written 2026-10-08. Part of the site review in this folder (`00-START-HERE.md`). This file covers:

- **Part 1 — Tobacco, vapor, nicotine, age-gate and licence items** (22 findings): the restricted product lines, nicotine warnings, the 21+ age gate, and the checks that only licensed retailers can order tobacco and vapor.
- **Part 2 — Everything else that waits on the owner** (46 findings): real prices, photos, legal wording, business facts and account setup.
- **Part 3 — The owner's checklist**: the questions grouped by topic.

## Paste this into Cursor (Agent mode)

```text
Open audits/site-review-2026-09-28/CURSOR-tobacco-vapor-and-owner-items.md and follow it.
Work in the folder alabamawholesaleinc-fixes on branch fix/site-review-2026-09-28.
Do step 0 first. Then work through Part 1, then Part 2, one finding at a time:
apply the Fix, run the checks, commit with the finding ID in the message, tick its box.
Never invent prices, business facts, legal wording or product photos: keep the current
value, add a "TODO(owner): <question> (AW-xxx)" comment, and add a row to
docs/OWNER-TODO.md. Do not delist, hide, rename or reword the kratom/kava, mushroom,
detox, wellness-pill or enhancement product lines, or the Net-30 / "up to 18%" claims —
the owner decided to keep them for now; only mark them TODO(owner).
Stop after Part 1 so I can review.
```

## Step 0: get the right code (do this before anything else)

1. Open `alabamawholesaleinc-fixes` (next to this `audits` folder). It's on branch `fix/site-review-2026-09-28` and already has Phase 1 of the review: real page URLs instead of `#/`, one sign-in provider, safe cart storage, the age gate as an overlay, lint, tests and CI. Use Node 24 (`nvm use`).
2. Merge the two finished lane branches. They hold tested work for several items in this file:
   - `git merge --no-ff lane/p2-backend` — prices behind a server function, per-variant prices and sell units, a safer quote submission, licence and consent fields on the application.
   - `git merge --no-ff lane/p3-design` — design tokens, one button system, one form-field system.
   - Resolve any conflicts keeping both sides. Then run `npm ci`.
   - The folder `aw-lane-p3-design` also has uncommitted, unfinished work. Leave that folder alone.
3. Checks that must pass after every change: `npm run lint`, `npm test`, `npm run test:db` (replays the database migrations in an in-memory Postgres), `npm run build`, and `npm run test:e2e` if you changed the UI.
4. Database changes go in **new** timestamped files in `supabase/migrations/`, never edits to old ones. Add tests in `supabase/tests/`. Never run SQL against the live Supabase project; the owner applies migrations. Client code must keep working against the live database until they do (detect a missing function or column and fall back).
5. Read `docs/OWNER-TODO.md` and `README.md` in the repo for what's already been decided.

# Part 1: Tobacco, vapor, nicotine, age-gate and licence items

## Restricted and regulated products

### AW-001 · Storefront advertises kratom, 'mushroom', detox/synthetic-urine and sexual-enhancement products from an Alabama warehouse

**Critical** · Needs the owner's answer to finish · **Status:** Built on branch `lane/p2-backend` (merged in step 0). Check it; finish any owner TODO it left.

**Where:** #/ → 'Exotics & Novelties' editorial card; #/category/NOVELTIES sub-pills 'Kratom & Kava', 'Mushroom Products', 'Detox', 'Wellness Pills'; #/category/MERCHANDISE/Honey & Energy; #/product/308; Novelties meta description

**Problem:** Home editorial H2 reads 'Disposables, detox, kratom & more.' (App.jsx:724). The Novelties department has a 'Kratom & Kava' subcategory with 3 items: Wava kava, Mazza Shots and Sip happens. Their descriptions say '…from the kratom and kava line in our Novelties department' (products.js:172, :174, :608). The tab title is 'Kratom & Kava · Novelties & Vapes · Wholesale Catalog'. The Novelties meta description lists 'Detox, Disposable Vapes, Hookah & Shisha, Kratom & Kava'. Header search for 'kratom' returns 3 results. 'Mushroom Products' is the largest Novelties line at 19 of 51 SKUs (Shroom Puff disposable 3 Gram, Psyched disposable 9000mg, Stoned mushroom gummies, Melted mushroom pre rolls…), and none of them states an ingredient or legal status. Product 308 description: 'UPass toxin-free synthetic urine, 3 oz, from the detox line…' (products.js:638). 'Honey & Energy' holds Rhino pills…

**Fix:** Remove the 'Kratom & Kava' sub-line and its products (products.js:171-174, 607-608; supabase/seed/products.sql:81-82), and remove 'kratom' from the home Exotics & Novelties card headline (App.jsx:724). Get a legal/compliance review of the Mushroom Products, Detox, Wellness Pills and MERCHANDISE/Honey & Energy lines. Delist or de-feature the flagged items (drop the PREMIUM badge from the enhancement products). Remove these terms from the sub-pills, the mega menu, the #/catalog pills, the PDP descriptions (#75, #76, #293, #308) and the Novelties meta description.

**Owner must decide or supply:** After legal/compliance review, which product lines (Kratom & Kava, Mushroom Products, Detox, Wellness Pills, Honey & Energy enhancement items) should be delisted, de-featured or kept?

**Owner decision (overrides the fix above):** keep these product lines and claims exactly as they are for now. Do not delist, hide, rename, re-file or reword them. Only add `TODO(owner)` markers and `docs/OWNER-TODO.md` rows where they're missing, and build any code that doesn't change what customers see.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:724`, `src/data/products.js:159`, `src/data/products.js:171`, `src/data/products.js:173`, `src/data/products.js:607`, `src/data/products.js:637`, `src/data/products.js:77`, `src/data/products.js:551`, `src/data/products.js:663`, `src/data/products.js:685`, `src/lib/useCatalog.js:19`, `supabase/seed/products.sql`, `src/data/products.js:172`, `src/data/products.js:174`, `src/data/products.js:608`, `supabase/seed/products.sql:81`, `supabase/seed/products.sql:82`, `supabase/seed/products.sql:299`, `src/data/products.js:171-174`, `src/data/products.js:607-608`, `supabase/seed/products.sql:81-82`, `src/data/products.js:159-170`, `src/data/products.js:537`, `src/data/products.js:583-647`, `src/data/products.js:459`, `src/data/products.js:553`, `src/data/products.js:665`, `src/App.jsx:1099`, `scripts/build-seed.mjs:18`

Full details and screenshots: `findings.json` entry AW-001, in this folder.

- [ ] Done

### AW-070 · Products filed in the wrong department/sub-line (e.g. 'Mushroom Products' is about half blue-lotus and hemp items), plus near-empty and duplicate sub-lines

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/category/<DEPT>/<Sub line> pills and results; #/catalog pill lists

**Problem:** Misfiled items: Seneca filtered cigars (id 210) and Cheyenne filtered cigars (211) under Tobacco › Cigarettes. Wrigley's slim pack gum (38), Wrigley's 50¢ gum (40) and Mint candy lumps (191) under Candies › Sweets & Gummies, while 'Gum & Mints (4)' exists. Tweaker energy shots (22) under Merchandise › OTC & Health, while 'Energy Shots (2)' exists. Rhino pills 2-pack (28) and Hard Steel (265) under 'Honey & Energy', while 'Adult Wellness (2)' exists. Happy valentines jar (219) under Novelties › Wellness Pills. Register paper rolls (92) under Drinks & Bags › Bags & Carriers. Trash bags (107, Grocery › Bags & Storage) and Trash can liners (95, Drinks & Bags › Bags & Carriers) are split across two departments. Home air fresheners (129) is in 'Other Grocery (1)', while Merchandise has 'Air Fresheners & Incense'. Motor Oil › 'Motor Oil (8)' duplicates the department name (breadcrumb 'MOTOR…

**Fix:** Audit every product's department and sub-line in src/data/products.js. Move misfiled items, including the blue-lotus and hemp products in 'Mushroom Products', into the correct or new accurately named lines. Merge or remove near-empty and duplicate sub-lines. Rename products whose names hide what they contain. Regenerate the seed so the #/catalog pill lists, category pills and counts update.

**Owner must decide or supply:** Approve the department and sub-line for each misfiled product, especially the blue-lotus and hemp items now under 'Mushroom Products', and say whether those lines stay in the catalog.

**Owner decision (overrides the fix above):** keep these product lines and claims exactly as they are for now. Do not delist, hide, rename, re-file or reword them. Only add `TODO(owner)` markers and `docs/OWNER-TODO.md` rows where they're missing, and build any code that doesn't change what customers see.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:65`, `src/data/products.js:77`, `src/data/products.js:97`, `src/data/products.js:101`, `src/data/products.js:205`, `src/data/products.js:211`, `src/data/products.js:235`, `src/data/products.js:279`, `src/data/products.js:403`, `src/data/products.js:441`, `src/data/products.js:443`, `src/data/products.js:459`, `scripts/build-seed.mjs:47`, `src/data/products.js:687`, `src/data/products.js:213`, `src/data/products.js:731`, `src/data/products.js:605`, `src/data/products.js:119`, `src/data/products.js:49`, `src/data/products.js:175`, `src/data/products.js:255`, `src/data/products.js:133`, `supabase/seed/products.sql`, `src/data/products.js:444`, `src/data/products.js:22`, `src/data/products.js:167`, `src/data/products.js:169`, `src/data/products.js:583`, `src/data/products.js:599`, `src/data/products.js:613`, `src/data/products.js:619`, `src/data/products.js:635`, `src/data/products.js:645`, `src/data/products.js:647`, `src/assets/products/sources/novelties.md`, `src/lib/useCatalog.js:19`, `scripts/build-seed.mjs:18`

Full details and screenshots: `findings.json` entry AW-070, in this folder.

- [ ] Done

### AW-137 · Most disposable vapes and pods have no flavor list, so buyers can't say which flavor they want

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/category/NOVELTIES/Disposable%20Vapes and Vape Pods: cards show "QUOTE +" with no flavor choice

**Problem:** variants: [] on #64 RAZ 25K (NEW, in the home New arrivals rail), #65 RAZ Vue Full kit, #66 RAZ Vue Pods, #67 Kangvape 8000, #68 Kangvape 65K, #310 Geek Bar Mate 60K and #311 Geek Bar Mate 60K pods. #60 Geek Bar Pulse 15K and #61 Pulse X 25K (both BESTSELLER) list only 2 flavors, and #254 Luffbar only "Alaska". The home card for RAZ 25K shows "RAZ · AW-RAZ-25K" with a one-click "QUOTE +", so the quote line carries no flavor. Vapes are the site's headline category (hero slides 1–2 and the welcome offer).

**Fix:** Fill `variants` for ids 60, 61, 64, 65, 66, 67, 68, 254, 310 and 311 with the flavors the warehouse actually stocks, from the owner's current vape order sheet, and keep `flavors` equal to variants.length. If a product is genuinely sold as an assorted case, add a single variant "Assorted case" and say so in the description, so that requiresVariantChoice stays meaningful. Regenerate and apply the seed.

**Owner must decide or supply:** Which flavors does the warehouse actually stock for vape products 60, 61, 64, 65, 66, 67, 68, 254, 310 and 311 (or which are sold only as assorted cases)?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:141`, `src/data/products.js:143`, `src/data/products.js:149`, `src/data/products.js:151`, `src/data/products.js:153`, `src/data/products.js:155`, `src/data/products.js:157`, `src/data/products.js:529`, `src/data/products.js:641`, `src/data/products.js:643`, `src/lib/lines.js:27`

Full details and screenshots: `findings.json` entry AW-137, in this folder.

- [ ] Done

## Nicotine warnings

### AW-026 · Nicotine warning is non-standard, 11px, only below the footer, and missing on nicotine product pages

**High** · Cursor can do it now · **Status:** Not started.

**Where:** Footer .fda-note on every route; vape/pouch product pages (e.g. #/product/61, #/product/60); home New arrivals rail

**Problem:** The only nicotine warning is the footer strip (App.jsx:1350). It is 11px text rgb(203,184,236) on rgb(28,14,64), and on #/product/61 (Geek Bar Pulse X 25K) it starts at y=2076 of a 2171px page. Nothing near vape, ZYN/PIK pouch or cigarette product content carries a warning, and the homepage's first product rail opens with 3 disposable vapes. The wording 'Tobacco products sold by Alabama Wholesale Inc. contain nicotine…' is not FDA's required statement 'WARNING: This product contains nicotine. Nicotine is an addictive chemical.'. Under 21 CFR part 1143, ads for covered products must put that statement in the upper portion of the ad, covering at least 20% of it. The text ends 'Not for sale to minors.', which contradicts the federal 21+ minimum the site states everywhere else.

**Fix:** Use the exact FDA-required statement ('WARNING: This product contains nicotine. Nicotine is an addictive chemical.') in place of the reworded .fda-note text, and say 'under 21', not 'minors'. Set it at a legible size (at least 12-14px, meeting the FDA's required proportion of the ad area where applicable). Show it on every nicotine/tobacco PDP and card (Geek Bar, Foger, RAZ, ZYN, Black & Mild; App.jsx:1094), on the hero vape slide, and in the footer (App.jsx:1349-1350, index.css:428).

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:1350`, `src/App.jsx:293`, `src/App.jsx:1099`, `src/index.css:428`, `src/App.jsx:1349`, `src/data/content.js:43`, `src/App.jsx:716`, `src/App.jsx:738`, `src/index.css:429`, `src/App.jsx:953`, `src/App.jsx:1094`

Full details and screenshots: `findings.json` entry AW-026, in this folder.

- [ ] Done

### AW-144 · A 30px purple strip shows below the FDA warning band, and the legal row sits flush on top of the band

**Medium** · Cursor can do it now · **Status:** Not started.

**Where:** Every route → footer bottom (.footer-main / .fda-note)

**Problem:** The page ends with the dark #1c0e40 FDA warning band followed by another band of #281459 purple. Measured: at 1440 the footer bottom is at 5248 and the .fda-note bottom at 5218, leaving a 30px strip. At 390 the strip is 22px (8408 vs 8386). The cause is that .fda-note is inside .footer-main, which has `padding: 44px 0 30px` (22px on mobile). The gap between the .footer-legal row and the band is 0px, so the '© 2026… / Delivery · Privacy · Trade terms' line touches the warning band.

**Fix:** In the footer, add spacing between .footer-legal and the .fda-note band, and remove the 30px purple strip below the band. Make .fda-note the last element with no parent padding or background showing beneath it (index.css:416, 426-428, 590).

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/index.css:416`, `src/index.css:426`, `src/index.css:428`, `src/index.css:590`, `src/App.jsx:1349`, `src/index.css:591`

Full details and screenshots: `findings.json` entry AW-144, in this folder.

- [ ] Done

## Age gate (21+)

### AW-044 · The age gate replaces the whole app, so crawlers and non-JS clients index only 38 words

**High** · Cursor can do it now · **Status:** Done on the fix branch (Phase 1). Check it still works; no new work unless noted.

**Where:** Every route in a fresh session (no aw-age-verified in localStorage), and with JavaScript disabled

**Problem:** App.jsx:282 runs `if (!verified) return <AgeGate .../>` before any content renders. Googlebot renders pages in a fresh profile and cannot click "Yes, I am 21+". I loaded fresh sessions on #/, #/product/61 and #/category/TOBACCO. Each rendered page had one h1 ("Are you 21 or older?"), 38 words, 0 links and 0 images; only document.title differed. With JavaScript disabled, body innerText is "" with 0 h1 and no <noscript> fallback (index.html:93 is an empty #root). The 2026-09-25 audit (#14) noted the age-gate-only interface; it is unchanged.

**Fix:** 1) In src/App.jsx:282 delete the early `if (!verified) return <AgeGate …/>`. Always return the normal tree. Inside the root <div> (after <Footer>), add `{!verified && <ModalLayer className="age-gate-layer"><AgeGate onYes={handleAgeYes} onNo={() => setTooYoung(true)} tooYoung={tooYoung} /></ModalLayer>}`. Do NOT pass onClose: ModalLayer then ignores Escape, sets #root inert + aria-hidden, traps Tab and moves focus into the gate. Keep the existing .age-gate CSS (index.css:497): it is opaque and covers the page, so no blur rule is needed. 2) In AgeGate (App.jsx:362-385), give the "Yes, I am 21+" button data-autofocus so it gets initial focus. 3) Don't sniff user agents or serve bots different content. 4) In index.html, right after <div id="root"></div> (line 93), add <noscript><p>Alabama Wholesale Inc — wholesale tobacco, vape, candy, drinks, grocery and motor-oil distributor for licensed retailers, 613 Graymont Ave N, Birmingham AL. Call (205) 354-4473. Please enable JavaScript to browse the catalog.</p></noscript>. 5) Once prerendering exists (seo-1), render the gate client-side over the prerendered HTML the same way.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:282`, `src/App.jsx:362-385`, `index.html:93-94`

Full details and screenshots: `findings.json` entry AW-044, in this folder.

- [ ] Done

### AW-176 · Age gate: no initial focus, ambiguous copy, and 'No, exit' is a dead end that a reload undoes

**Medium** · Cursor can do it now · **Status:** Done on the fix branch (Phase 1). Check it still works; no new work unless noted.

**Where:** Age gate (verified = false) → 'No, exit'

**Problem:** On load document.activeElement is BODY, even though the gate is role=dialog aria-modal. After 'No, exit' the buttons unmount and focus falls to BODY. The page then has 0 focusable elements. The new h1 "We're sorry —" has no id, so the dialog's aria-labelledby="age-gate-title" points to nothing, and the change isn't announced. There is no way back other than reloading.

**Fix:** Move focus into the age gate on open and trap it there. Rewrite the copy to clearly ask for 21+ and state that the site is for licensed retailers. On 'No, exit', show a proper exit screen with a message and heading, remove the dangling dash, persist the decline for the session, and don't lose the dialog's accessible name (App.jsx:282, 362-373).

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:362`, `src/App.jsx:364`, `src/App.jsx:369`, `src/App.jsx:377`, `src/App.jsx:282`, `src/App.jsx:373`, `src/App.jsx:378`, `src/App.jsx:370`, `src/App.jsx:372`, `src/App.jsx:379`

Full details and screenshots: `findings.json` entry AW-176, in this folder.

- [ ] Done

### AW-156 · On short landscape screens the 21+ age gate cannot scroll, so its buttons are cut off

**Medium** · Cursor can do it now · **Status:** Done on the fix branch (Phase 1). Check it still works; no new work unless noted.

**Where:** First visit (no aw-age-verified) → .age-gate

**Problem:** `.age-gate` is position:fixed, inset:0, display:flex, align-items:center with no overflow. The content block is about 326–335px tall. At 932x300 the 'Alabama' wordmark is cut at the top (inner top -17px) and the 'Yes, I am 21+' / 'No, exit' buttons end 17px below the viewport. At 667x280 they end 23px below. At 568x260 only 17px of the 50px buttons are visible. Wheel/touch scrolling does not move the content (button top stayed at 243 after scrolling). This gate blocks the whole site.

**Fix:** In src/index.css:497 change `.age-gate` to `overflow-y: auto; align-items: flex-start;` and add `.age-gate .inner { margin: auto; }` so the content centers when it fits and scrolls when it does not. Add `@media (max-height: 420px) { .age-gate { padding: 12px 24px; } .age-gate .brand span { font-size: 30px; } .age-gate h1 { font-size: 34px; margin: 12px 0 8px; } .age-gate p { font-size: 14px; line-height: 1.5; margin-bottom: 14px; } .age-gate .button { padding: 12px 20px; } }`. Check at 568x260 that both buttons are fully visible.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/index.css:497`, `src/index.css:499`, `src/index.css:501`, `src/index.css:503`, `src/index.css:505`, `src/App.jsx:362`

Full details and screenshots: `findings.json` entry AW-156, in this folder.

- [ ] Done

### AW-339 · Confirming 21+ in one tab leaves the other open tabs stuck on the age gate until reload

**Low** · Cursor can do it now · **Status:** Done on the fix branch (Phase 1). Check it still works; no new work unless noted.

**Where:** Age gate (.age-gate) in a second tab opened before verification

**Problem:** Script pw/gap1s-07-agegate-catalog.mjs:
- Two unverified tabs are open, on #/category/TOBACCO and #/product/14; both show the gate.
- Clicking 'Yes, I am 21+' in tab 1 sets localStorage aw-age-verified='yes'.
- Tab 2 still shows the gate (.age-gate count 1) until it is reloaded or its button is clicked again.

`verified` is read once in useState (App.jsx:146), and nothing listens for storage changes.

**Fix:** In the window 'storage' listener added for the cart (or in a new effect in App), add: if (e.key === STORAGE.age) setVerified(e.newValue === 'yes').

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:146`, `src/App.jsx:265`

Full details and screenshots: `findings.json` entry AW-339, in this folder.

- [ ] Done

### AW-340 · The 21+ confirmation is stored forever and survives sign-out, so on a shared computer no later visitor sees the age gate

**Low** · Needs the owner's answer to finish · **Status:** Done on the fix branch (Phase 1). Check it still works; no new work unless noted.

**Where:** Age gate → localStorage 'aw-age-verified'

**Problem:** handleAgeYes stores the bare string 'yes' with no timestamp (App.jsx:265). App.jsx:146 treats any 'yes' as verified permanently. handleLogout (App.jsx:266) does not touch the key.

On a store or public computer, one person's click therefore bypasses the tobacco/vape 21+ gate for every later visitor indefinitely. The gate text claims access is 'restricted to trade accounts and adults 21 years or older'.

**Fix:** Store a timestamp: localStorage.setItem(STORAGE.age, JSON.stringify({ ok: true, at: Date.now() })).

Read it with a helper `isAgeVerified()` that returns true only if the stored value parses and at > Date.now() - 30 * 24 * 60 * 60 * 1000. Treat a legacy 'yes' as expired so visitors see the gate once more.

In handleLogout, removeItem(STORAGE.age) so the next person on a shared device is asked again. Wrap all reads and writes in try/catch.

**Owner must decide or supply:** For tobacco age-gate compliance, how long should a visitor's 21+ confirmation stay valid (e.g. 30 days, per session), and should it be cleared on sign-out?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:146`, `src/App.jsx:265`, `src/App.jsx:266`

Full details and screenshots: `findings.json` entry AW-340, in this folder.

- [ ] Done

### AW-040 · Keyboard focus ring is invisible on the age-gate buttons and on the purple contact strip

**High** · Cursor can do it now · **Status:** Not started.

**Where:** Age gate (first visit, every route): 'Yes, I am 21+' and 'No, exit'. Also the purple 'Talk to the warehouse' / 'Apply with a trade rep' contact strip at the bottom of #/apply, #/delivery, #/shipping, #/privacy and #/terms: 'Call (205) 354-4473', 'Email us' and 'Contact & visit'

**Problem:** Measured on the focused elements at 1440x900. Both age-gate buttons get outline 3px rgb(40,20,89) with a 3px offset, drawn on the .age-gate background rgb(40,20,89), which is 1.00:1, so the ring cannot be seen. The 'No, exit' ghost button looks exactly the same focused and unfocused (screenshots). On #/apply the contact strip has the same problem: the 'Call' .button and the 'Email us' ghost get a purple ring on purple (1.00:1), and the 'Contact & visit' text-link gets #b8390a on #281459 (2.72:1, below 3:1). Cause: index.css:59 forces `.button:focus-visible { outline-color: var(--purple) }`, which overrides the light #ffcdb5 ring set for purple surfaces at :58, and .contact-strip is missing from that list. This fails WCAG 2.4.7 Focus Visible (AA) on the first screen every visitor sees.

**Fix:** Give buttons and links on purple backgrounds (the age-gate 'Yes, I am 21+' / 'No, exit' buttons and the .contact-strip Call/Email/Contact links) a contrasting focus-visible ring, for example white or orange with a 2px offset (index.css:58-59, 646).

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/index.css:58`, `src/index.css:59`, `src/App.jsx:372`, `src/App.jsx:373`, `src/pages/support/SupportShell.jsx:43`, `src/index.css:646`, `src/index.css:647`

Full details and screenshots: `findings.json` entry AW-040, in this folder.

- [ ] Done

## Licensed-retailer checks: who may order tobacco and vapor

### AW-014 · Guests can submit a quote for tobacco/vape products without any retail license, tobacco permit or tax ID

**High** · Needs the owner's answer to finish · **Status:** Built on branch `lane/p2-backend` (merged in step 0). Check it; finish any owner TODO it left.

**Where:** #/quote (guest) → 'Your details' form

**Problem:** As a signed-out guest I added Kite cigarette tobacco (TOBACCO) and Swisher Sweets cigarillos and opened #/quote. The form asks only for Business, Contact, Email, Phone, Street, City, State, ZIP, Delivery method, Preferred date and Notes. The site states 'WHOLESALE TO LICENSED RETAIL BUSINESSES ONLY · NO CONSUMER SALES · 21+', and the Apply flow collects license/EIN/resale certificate. submit_quote accepts anonymous calls (granted to anon, launch_order_boundaries.sql:256) and stores no license information. The quote page also offers no sign-in or apply link for guests; it just says 'Pricing after sign-in'.

**Fix:** When the cart contains any TOBACCO or NOVELTIES (vape) line and the visitor is not an approved buyer, add required fields 'State tobacco/retail license #' and 'Sales-tax / resale certificate #' to the quote form (autoComplete="off"). Add a checkbox 'I confirm this business holds a valid tobacco retail license and all purchasers are 21+'. Add matching p_license_no / p_resale_cert params and columns to submit_quote/orders, and reject in SQL when they are blank for tobacco lines. Alternatively, require sign-in for carts with age-restricted items. In both cases, show 'Have an account? Sign in' and 'New? Apply for a trade account' links above the form for guests.

**Owner must decide or supply:** Decide whether carts with tobacco/vape items should require sign-in as an approved buyer, or allow guest quotes that collect a tobacco license number, resale certificate number and a 21+ attestation.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:1270-1287`, `src/App.jsx:1290`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:149-197`

Full details and screenshots: `findings.json` entry AW-014, in this folder.

- [ ] Done

### AW-129 · Tobacco-license requirement contradicts itself: 'only needed for tobacco' vs required for every applicant

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Application checklist (#/apply and signup dialog) vs signup form, #/terms 'Who can buy' and #/ services 03

**Problem:** Checklist (onboarding.js:7): 'State retail tobacco license number — Issued by the state your store is in. Required before you can buy tobacco or vapor products.' That implies it is optional for other buyers. Yet the signup form makes 'State retail tobacco license #' required for every business type, including 'Auto Parts', 'Grocery / Bodega' and 'Liquor Store' (AuthModal.jsx:15, :257-259). Terms (PolicyPage.jsx:67) say every applicant must provide it, and home (App.jsx:745) says 'We verify your state retail tobacco license and resale certificate before your first order.' An auto-parts store buying only motor oil cannot apply.

**Fix:** Owner decision. If the license is only needed for tobacco, vapor and nicotine: drop `required` at AuthModal.jsx:258, set the hint to 'Required to buy tobacco, vapor and nicotine products.', and change PolicyPage.jsx:67 and App.jsx:745 to match. If it is required for everyone: change onboarding.js:7 detail to 'Required for every trade account.'

**Owner must decide or supply:** Is a tobacco license required for every trade account, or only for buying tobacco, vapor and nicotine products?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/onboarding.js:7`, `src/components/AuthModal.jsx:257`, `src/pages/support/PolicyPage.jsx:67`, `src/App.jsx:745`

Full details and screenshots: `findings.json` entry AW-129, in this folder.

- [ ] Done

### AW-092 · The application collects no store street address, city or ZIP

**Medium** · Cursor can do it now · **Status:** Built on branch `lane/p2-backend` (merged in step 0). Check it; finish any owner TODO it left.

**Where:** Auth modal application form field set

**Problem:** The only location field is 'Store state' (AuthModal.jsx:254-256). There is no street, city or ZIP. Yet approval checks a state tobacco license tied to a store location, delivery depends on the stop being on a route (ApplyPage.jsx:54), and submit_quote requires a ship-to address on every order (launch_order_boundaries.sql:185-190), which the customer must retype each time.

**Fix:** 1) In AuthModal.jsx add store_street, store_city and store_zip to EMPTY_SIGNUP (line 27) and add three required Fields after 'Store state' (line 254): 'Store street address' (autoComplete 'address-line1'), 'City' ('address-level2') and 'ZIP' (inputMode 'numeric', pattern '[0-9]{5}', autoComplete 'postal-code'). 2) In useAuth.js:65/71 add them to signUp's parameters and options.data. 3) Add a new migration (do not edit existing ones) with `alter table public.profiles add column if not exists store_street text, add column if not exists store_city text, add column if not exists store_zip text;` and recreate handle_new_user (copy of 20260927000000_application_fields.sql:8-35) inserting new.raw_user_meta_data->>'store_street'/'store_city'/'store_zip'. 4) In QuotePage (App.jsx:1167-1170) initialise phone: profile?.phone || '', shipStreet: profile?.store_street || '', shipCity: profile?.store_city || '', shipState: profile?.state || '', shipZip: profile?.store_zip || ''. 5) In src/data/onboarding.js:9 change the 'Store details' detail to 'Legal business name, store type, and the store's street address.'

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/components/AuthModal.jsx:27`, `src/components/AuthModal.jsx:254`, `src/lib/useAuth.js:65`, `src/lib/useAuth.js:71`, `supabase/migrations/20260927000000_application_fields.sql:8`, `src/App.jsx:1167`, `src/App.jsx:1170`, `src/data/onboarding.js:9`

Full details and screenshots: `findings.json` entry AW-092, in this folder.

- [ ] Done

### AW-017 · Admin Accounts table hides the EIN, license, resale certificate and other application details staff must verify

**High** · Cursor can do it now · **Status:** Not started.

**Where:** #/admin → Accounts tab table (admin only)

**Problem:** The application collects ein, license_no, resale_cert_no, phone, business_type, state and expected_volume (AuthModal.jsx:230-271; stored by the trigger in 20260927000000_application_fields.sql). The Accounts table only renders Business, Contact, Email, Status, Tier, Role, Documents and Actions (AdminPage.jsx:187). A trade rep pressing 'Approve' therefore cannot see the numbers they are meant to check without opening the database. Documents are also shown only while status === 'pending' (AdminPage.jsx:219), so they disappear after approval or suspension.

**Fix:** In the #/admin Accounts table (or a row-expand detail panel), show the EIN, license number, resale certificate, phone, store state, business type and monthly volume next to the documents, so staff can verify before approving (AdminPage.jsx:187-249).

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/admin/AdminPage.jsx:187`, `src/pages/admin/AdminPage.jsx:193`, `src/pages/admin/AdminPage.jsx:219`, `src/pages/admin/AdminPage.jsx:249`, `src/components/AuthModal.jsx:287`

Full details and screenshots: `findings.json` entry AW-017, in this folder.

- [ ] Done

### AW-094 · License-document status shows 'Not uploaded' for files that are uploading or already saved (two uploads at once, or an upload made while the list is still loading)

**Medium** · Cursor can do it now · **Status:** Not started.

**Where:** #/apply (signed in, pending) → 'License documents' panel → the status line under each file input

**Problem:** Uploads were mocked locally with a 2.5 s delay. Repro A, two uploads: choose the license, then the resale certificate 0.3 s later. At t=1.0 s the license reads 'Not uploaded' with its input re-enabled while its upload is still running. At t=2.9 s the license has finished, but the resale reads 'Not uploaded' with its input enabled while its upload is still running. Both show correctly only at t=4.4 s. Cause: busyType is a single string (DocumentUploads.jsx:115). Picking the second file overwrites it, and the first upload's finally block sets it to null (:155). Repro B, stale list: the initial list GET is slow (3 s) and shows 'Checking…', but both inputs stay enabled. Upload the license during the check: at t=1.5 s it shows 'Uploaded on September 28, 2026 · TEST-ONLY-license.pdf'. At t=4.0 s the stale initial response lands and sets it back to 'Not uploaded', although the server row…

**Fix:** In ApplicationDocuments, replace `const [busyType, setBusyType] = useState(null)` with `const [busy, setBusy] = useState({})`. In onPick call `setBusy(b => ({ ...b, [type]: true }))`, and in finally (still guarded by the token) call `setBusy(b => ({ ...b, [type]: false }))`. Pass `busy` to DocumentFields instead of busyType and compute `const isBusy = !!busy?.[doc.id]` at line 54. Disable the controls until the first list has loaded: `controlsDisabled = disabled || !isBackendConfigured || loading || !userId || records == null`. Also add `const touched = useRef(false)`, set it true at the start of onPick, and in the initial list effect only apply the rows when !touched.current (or merge by keeping the newer uploaded_at per document_type).

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/components/DocumentUploads.jsx:54`, `src/components/DocumentUploads.jsx:71`, `src/components/DocumentUploads.jsx:115`, `src/components/DocumentUploads.jsx:118`, `src/components/DocumentUploads.jsx:126`, `src/components/DocumentUploads.jsx:138`, `src/components/DocumentUploads.jsx:155`

Full details and screenshots: `findings.json` entry AW-094, in this folder.

- [ ] Done

### AW-196 · RLS policy profiles_self_update lets customers rewrite any profile column (email, license, EIN, resale certificate), which also lets a customer be promoted to admin by the owner-provisioning script

**Medium** · Cursor can do it now · **Status:** Built on branch `lane/p2-backend` (merged in step 0). Check it; finish any owner TODO it left.

**Where:** RLS policy profiles_self_update on public.profiles (reachable from the browser with the anon key and a customer session)

**Problem:** profiles_self_update only blocks changes to role, status and pricing_tier. Any signed-in customer can `update profiles set license_no=…, ein=…, resale_cert_no=…, business=…, state=…, email=…` on their own row, including after approval. The status stays 'approved', so the account keeps tier pricing under a different, unverified license. The admin view shows profiles.email as the contact address (AdminPage.jsx:197), so a customer can also change where the trade desk sends replies. The storefront has no profile-edit UI (the only `from('profiles').update` is in AdminPage.jsx:175), so customers need no UPDATE rights at all. Auth email changes (`auth.updateUser({ email })`) are also never synced to profiles.email.

**Fix:** Restrict self-updates on public.profiles to safe contact columns, using column-level GRANT UPDATE or a BEFORE UPDATE trigger that rejects changes to email, status, role, tier, license, EIN and resale certificate after submission (rls_policies.sql:22). Change supabase/seed/provision_owner.sql to match the owner by auth.users.id / auth.users.email instead of profiles.email.

**Files (lines are from before the refactor — search, don't trust line numbers):** `supabase/migrations/20260517000001_rls_policies.sql:22`, `src/pages/admin/AdminPage.jsx:197`, `BACKEND.md:113`, `supabase/seed/provision_owner.sql:7`, `supabase/migrations/20260517000000_initial_schema.sql:9`, `BACKEND.md:50`

Full details and screenshots: `findings.json` entry AW-196, in this folder.

- [ ] Done

### AW-197 · License proof is not kept or auditable after approval: documents disappear from admin, applicants can delete them, and approvals record no who or when

**Medium** · Cursor can do it now · **Status:** Built on branch `lane/p2-backend` (merged in step 0). Check it; finish any owner TODO it left.

**Where:** #/admin → Accounts → Documents column; storage bucket application-documents; table profile_documents

**Problem:** The Documents column renders only when `p.status === 'pending'` (AdminPage.jsx:219). After Approve, or after suspension, the admin can no longer see or open the license or resale proof. RLS lets the applicant delete or replace their profile_documents rows and storage objects at any time, including after approval (application_documents.sql:51-56 and 88-93). profile_documents_self_insert also has no status check. Approving only sets status (AdminPage.jsx:250). There is no approved_by, approved_at or verification note, and no history table, so the business cannot show when, by whom, or on what evidence a tobacco buyer was approved.

**Fix:** 1) New migration: `alter table public.profiles add column approved_at timestamptz, add column approved_by uuid references public.profiles(id), add column verification_note text;`. Add a BEFORE UPDATE trigger that sets approved_at = now() and approved_by = auth.uid() when status changes to 'approved'. Create an append-only `public.profile_status_log(profile_id, old_status, new_status, changed_by, changed_at, note)` filled by an AFTER UPDATE trigger (admin-read RLS, no update or delete policies). 2) Change profile_documents_self_insert/update/delete, application_documents_owner_update and application_documents_owner_delete so they also require `exists(select 1 from public.profiles where id = auth.uid() and status = 'pending')`, which locks proof once approved. 3) In AdminPage.jsx:219 show the documents for every status, not just pending, and show approved_at / approved_by in the row.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/admin/AdminPage.jsx:219`, `src/pages/admin/AdminPage.jsx:250`, `supabase/migrations/20260927180000_application_documents.sql:48`, `supabase/migrations/20260927180000_application_documents.sql:51`, `supabase/migrations/20260927180000_application_documents.sql:55`, `supabase/migrations/20260927180000_application_documents.sql:88`

Full details and screenshots: `findings.json` entry AW-197, in this folder.

- [ ] Done

### AW-254 · Approved and suspended accounts cannot see, replace or add license documents anywhere

**Low** · Cursor can do it now · **Status:** Not started.

**Where:** #/apply signed in as approved or suspended (no documents panel); #/account (none)

**Problem:** ApplicationDocuments renders only when profile.status === 'pending' (ApplyPage.jsx:22). The measured DOM has no .doc-panel for approved or suspended accounts, and My account has no document section. Tobacco licenses and resale or exemption certificates expire and are renewed, and a suspension is often a paperwork problem (expired license). Yet a suspended buyer is told only to call, and an approved buyer has no way to send a renewed license, although the RLS policies already allow owners to update their own rows and objects.

**Fix:** In ApplyPage.jsx:22 render the panel for every signed-in profile: `{profile && <ApplicationDocuments status={profile.status} disabled={!isBackendConfigured} />}`. Add a `status` prop to ApplicationDocuments and set the eyebrow at DocumentUploads.jsx:161 from it: pending 'WHILE YOUR APPLICATION IS PENDING', approved 'KEEP YOUR LICENSE ON FILE', suspended 'SEND UPDATED PROOF'. In the suspended StatusPanel copy (ApplyPage.jsx:80-82) append 'If your license or resale certificate has changed, upload the new one below.' In AccountPage.jsx, after the account-stats block (lines 86-94), add <p className="notice">License and resale documents: <button className="text-link" type="button" onClick={() => navigate({ page: 'apply' })}>view or replace</button></p>. AccountPage has no navigate prop today, so pass `navigate` from App.jsx:329.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/support/ApplyPage.jsx:22`, `src/pages/support/ApplyPage.jsx:80`, `src/components/DocumentUploads.jsx:161`, `src/pages/account/AccountPage.jsx:86`

Full details and screenshots: `findings.json` entry AW-254, in this folder.

- [ ] Done

### AW-348 · EIN, license number, resale certificate and phone are copied into Supabase user_metadata, which rides in every access token and stays user-editable

**Low** · Cursor can do it now · **Status:** Built on branch `lane/p2-backend` (merged in step 0). Check it; finish any owner TODO it left.

**Where:** Signup (useAuth.signUp → options.data); auth.users.raw_user_meta_data

**Problem:** signUp sends `{ name, business, phone, license_no, ein, resale_cert_no, business_type, state, expected_volume }` as user metadata (useAuth.js:67-72). handle_new_user copies it into profiles (application_fields.sql:15-32) but never removes it from auth.users. Supabase includes user_metadata in the JWT access token, so the EIN and license numbers sit in the 'aw-auth' localStorage token and go out with every API request. The user can also rewrite them at any time with `auth.updateUser({ data })`, which leaves a second, divergent copy.

**Fix:** At the end of handle_new_user (new migration replacing the function) add `update auth.users set raw_user_meta_data = raw_user_meta_data - 'ein' - 'license_no' - 'resale_cert_no' - 'phone' - 'expected_volume' where id = new.id;`. The function is SECURITY DEFINER and owned by postgres, so it can write auth.users. Keep only name/business in metadata, and treat public.profiles as the single copy.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/lib/useAuth.js:71`, `supabase/migrations/20260927000000_application_fields.sql:14`

Full details and screenshots: `findings.json` entry AW-348, in this folder.

- [ ] Done

### AW-019 · The application captures no explicit consent to Trade terms or Privacy, and the privacy policy omits uploaded license files

**High** · Needs the owner's answer to finish · **Status:** Built on branch `lane/p2-backend` (merged in step 0). Check it; finish any owner TODO it left.

**Where:** Auth modal → application form footer; #/privacy 'What we collect'

**Problem:** The form ends with 'Submit application' plus a passive grey line: 'By applying you confirm all store staff handling tobacco products meet federal and state age requirements.' (AuthModal.jsx:344). There is no checkbox and no link to #/terms or #/privacy in the modal or on #/apply (grep finds none). Applicants hand over their EIN and license or resale certificate images. PolicyPage.jsx:45 lists the application fields but not the uploaded document files, where they are stored, or how long they are kept.

**Fix:** Add required checkboxes to the application form: 'I agree to the Trade terms and Privacy policy' (linked) and 'I am 21 or older'. Store acceptance with a timestamp and terms version in the profile, and link Terms/Privacy from #/apply (AuthModal.jsx:230-279, 344; useAuth.js:71).

**Owner must decide or supply:** Approve the consent checkbox wording and the Trade terms/Privacy policy version the application should record acceptance of.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/components/AuthModal.jsx:274`, `src/components/AuthModal.jsx:344`, `src/lib/useAuth.js:71`, `src/pages/support/PolicyPage.jsx:45`, `src/components/AuthModal.jsx:230-279`, `supabase/migrations/20260927000000_application_fields.sql:8-29`, `src/pages/support/ApplyPage.jsx:39`

Full details and screenshots: `findings.json` entry AW-019, in this folder.

- [ ] Done

### AW-027 · Privacy policy omits uploaded license documents, browser storage, service providers, retention, sharing and user rights

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/privacy

**Problem:** Live #/privacy at 1440 wide shows these H2s: 'What we collect', 'Why we collect it', 'Contact the trade desk', then the ContactStrip 'Talk to the warehouse'. The support-note reads 'Last updated September 2026. Questions about this policy? Call (205) 354-4473 or email …', directly below the 'Questions about what we collect: call …' section. The policy never mentions uploaded license or resale-certificate files (private bucket 'application-documents': PDF, JPEG, PNG or HEIC, up to 10 MB, per supabase/migrations/20260927180000_application_documents.sql:9-20). It also never mentions browser storage: aw-age-verified, aw-cart, and the Supabase session token under key 'aw-auth' (src/lib/supabase.js:13-15). It names no processors (Supabase, Netlify) and says nothing about sharing, retention, security or access/deletion requests. The only date is the month-level 'September 2026'…

**Fix:** Expand #/privacy (PolicyPage.jsx:37-59) to cover uploaded license/EIN documents, processors (Supabase, Netlify, email provider), sharing, retention periods, browser storage (localStorage age gate/cart), and access/deletion rights with a contact method. Update the date.

**Owner must decide or supply:** Provide or approve (ideally with counsel) the privacy policy details: service providers used, data sharing, retention periods for uploaded license/EIN documents, and the contact method for access/deletion requests.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/support/PolicyPage.jsx:9`, `src/pages/support/PolicyPage.jsx:37`, `src/pages/support/PolicyPage.jsx:55`, `src/pages/support/PolicyPage.jsx:127`, `src/pages/support/PolicyPage.jsx:37-59`, `src/pages/support/PolicyPage.jsx:43`

Full details and screenshots: `findings.json` entry AW-027, in this folder.

- [ ] Done

# Part 2: Everything else that waits on the owner

Cursor can build the code side of each of these now — the editor, the field, the placeholder, the page structure — and leave a `TODO(owner)` where the real value goes. Finish each one when the owner answers.

## Catalog data integrity

### AW-002 · Every list price looks like a placeholder: pack sizes and product sizes are priced backwards and unrelated items share identical prices

**Critical** · Needs the owner's answer to finish · **Status:** Built on branch `lane/p2-backend` (merged in step 0). Check it; finish any owner TODO it left.

**Where:** All routes that show price (approved-buyer cards, PDP, quote totals) and the server trigger that prices order lines

**Problem:** The 368 prices run from $4.76 to $119.99 (median $38.50). They have not changed since the initial commit f5e931b (2026-05-17), when product names were still placeholders like "SS" and "WO". Implausible pairs: #16 Backwoods singles $98.78 vs #11 Backwoods 5-pack $45.40; #340 Slapwoods singles $92.77 vs #77 5-pack $43.98; #236 OHM small bag $101.26 vs #237 big bag $31.71; Al Fakher #315 50 g $70.50, #316 250 g $71.51, #317 1 kg $49.29; #335 Gatorade small $51.72 vs #336 big $28.62; #140 Tropicana small $48.04 vs #214 big $12.15; #132 Charcoal small $30.14 vs #133 big $9.77; #190 Mamba small $43.60 vs #189 big $16.04; #144 Red Bull 8 oz $43.47 vs #143 12 oz $27.96; #160 White A-shirts $8.78 vs #161 Black A-shirts $76.71; #78 Black & Mild 5-pack $24.99 vs #17 25-count box $39.59; #6 Game Mini $85.05 vs #3 Game $62.97; #350 Uncle Al's $33.23 vs #351 (same cookies) $18.68. 31 price values are…

**Fix:** Replace the placeholder list prices in products.js, supabase/seed/products.sql and the products.price column with real wholesale prices, so larger packs and sizes cost more and unrelated items don't share identical prices. The submit_quote trigger reads this column, so correct the DB before launch.

**Owner must decide or supply:** Please supply the real wholesale list price for each of the 368 SKUs (e.g. a price sheet export).

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:22`, `supabase/seed/products.sql:6`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:111`, `scripts/build-seed.mjs:47`, `src/data/products.js:43`, `src/data/products.js:53`, `src/data/products.js:341`, `src/data/products.js:343`, `src/data/products.js:461`, `src/data/products.js:463`, `src/data/products.js:655`, `src/data/products.js:693`, `scripts/build-seed.mjs:57`

Full details and screenshots: `findings.json` entry AW-002, in this folder.

- [ ] Done

### AW-029 · 77 products (21%) have no photo and show a near-invisible two-letter initials placeholder

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Product cards, PDPs, cart and quote lines for the listed ids; the home "New arrivals" rail (#342)

**Problem:** Rows with img: null, by department: TOBACCO 5/68 (9, 13, 211, 213, 274). NOVELTIES 17/51 (219, 220, 221, 258, 288, 289, 293, 298, 300, 301, 302, 303, 304, 306, 311, 313, 341). MERCHANDISE 18/60 (33, 34, 152, 153, 154, 155, 156, 157, 158, 160, 161, 246, 252, 266, 286, 331, 363, 364), which leaves 13 of 14 Apparel rows without a photo. CANDIES 1/58 (342, the NEW-tagged Dubai chocolate shown as "DC" in the home New arrivals rail). FOOD STUFF 2/24 (295, 353). GROCERY 23/47, 49% (53, 107, 118, 119, 121, 125, 126, 127, 129, 131, 132, 133, 134, 135, 137, 138, 253, 259, 283, 284, 297, 345, 362). MOTOR OIL 1/16 (100). DRINKS & BAGS 10/44 (87, 90, 92, 93, 94, 95, 139, 141, 212, 269). Improved from 173 in the prior audit. #/category/GROCERY/Hardware shows almost only initials tiles (M, CB, CB…).

**Fix:** Source real packshots for all 77 img:null products, starting with those on the homepage (Dubai chocolate #342 in New arrivals) and the largest departments (Grocery 23, Novelties, Merchandise, Tobacco, Drinks & Bags). Until then, replace the 1.41:1 grey initials with a designed 'Photo coming soon' placeholder (a department icon plus the product name at 4.5:1 contrast) on cards, the PDP, cart and quote lines (App.jsx:475, 817, 1092; index.css:205, 313). Exclude photo-less items from the home rails.

**Owner must decide or supply:** Supply real packshots for the 77 products without photos, starting with Dubai chocolate #342 and the Grocery items.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:705`, `src/data/products.js:766`, `src/App.jsx:475`, `src/App.jsx:817`, `src/App.jsx:1092`, `src/App.jsx:1246`, `src/App.jsx:1401`, `src/index.css:205`, `src/App.jsx:703`, `src/App.jsx:704`, `src/data/products.js`, `src/data/products.js:39`, `src/index.css:313`, `src/data/products.js:47`, `src/data/products.js:443`, `src/data/products.js:447`, `src/data/products.js:569`, `src/data/products.js:459`, `src/data/products.js:623`, `src/data/products.js:643`, `src/data/products.js:87`, `src/data/products.js:325`, `src/data/products.js:593`, `src/data/products.js:683`, `src/data/products.js:127`, `src/data/products.js:235`, `src/data/products.js:271`, `src/data/products.js:195`, `src/data/products.js:201`, `src/data/products.js:611`, `src/data/products.js:221`, `src/App.jsx:40`

Full details and screenshots: `findings.json` entry AW-029, in this folder.

- [ ] Done

### AW-030 · Variants of different sizes and pack counts all share the parent's single price

**High** · Needs the owner's answer to finish · **Status:** Built on branch `lane/p2-backend` (merged in step 0). Check it; finish any owner TODO it left.

**Where:** PDP variant chips, cart and quote lines, and server-side order line pricing for multi-size products

**Problem:** Variants are plain strings. lines.js sets listPrice = Number(product.price) for every variant (lines 168, 182), and the trigger prices every line with v_product.price (migration line 111). At least 80 products mix sizes or pack counts inside one variant list at one price. Examples: #162 Snickers Regular vs King size; #171 Hershey's reg vs king; #166 Reese's cups regular vs king size; #328 Takis small vs big; #27 Duracell 9V / AAA4 / AA2 / D2; #120 Foam cups 20oz vs 8oz; #356 Gas cans 1 gal vs 5 gal; #314 Coco Nara Small vs 1kg; #147 Trojan Magnum Regular vs "Jar big"; #24 Goody's 2pk vs 6pk; #227 BC Powder 6pk vs 2pk; #86 Seneca 100 vs short; #125 Baby diapers Small/Medium/Big; #33–#161 shirts S–5X. Variant cart identity and variant SKUs were added since the prior audit, but variant price was not.

**Fix:** Add per-variant price (and availability) to the variant model (products.js, lines.js:4-31, 168-182) and to the DB/order-line pricing trigger, so sizes such as 1 gal vs 5 gal and different pack counts price correctly on the PDP, cart, quote and orders.

**Owner must decide or supply:** Supply the price (and availability) for each size/pack-count variant of the multi-variant products.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/lib/lines.js:168`, `src/lib/lines.js:182`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:111`, `src/data/products.js:345`, `src/data/products.js:3`, `src/lib/lines.js:4`, `src/lib/lines.js:31`, `src/App.jsx:1070`, `src/App.jsx:1112`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:47`

Full details and screenshots: `findings.json` entry AW-030, in this folder.

- [ ] Done

### AW-031 · 344 of 368 products don't say what quantity 1 means (no sell unit)

**High** · Needs the owner's answer to finish · **Status:** Built on branch `lane/p2-backend` (merged in step 0). Check it; finish any owner TODO it left.

**Where:** PDP "Sold by the …" line (App.jsx:1098) is missing on 344 PDPs; quote quantities are ambiguous

**Problem:** Only 24 rows set sellUnit (11, 12, 17, 28, 37, 69, 70, 73, 74, 77, 78, 79, 81, 98, 275, 281, 285, 288, 300, 313, 315, 316, 317, 367). Names that state a unit but leave sellUnit empty: #122 "Bath tissue 4-pack", #16 "Backwoods cigars singles" (priced $98.78, so clearly not one cigar), #340 Slapwoods singles, the jars and tubs #174–#179, #258, #262, #276, #298, and #187 "Gushers box". Descriptions state a count that sellUnit omits: #175 "160-count jar", #179 "145-count tub", #186 "48-count display", #242/#243 "200 per box", #294 "20 per can", #358 "15 per box", #97 "8 oz bottles", #101/#102/#280 "in quarts". #122–#124 put "Case" in variants instead of sellUnit. Snickers, Red Bull, Pepsi and every other bestseller give no hint whether 1 means a bar, a box or a case.

**Fix:** Add a sell-unit field (each / box of N / case of N / size) to all 368 products, and show it on the PDP next to price and quantity ('Sold by the case of 24') and in cart/quote lines, so quantity 1 is unambiguous (App.jsx:1098, 1112).

**Owner must decide or supply:** Supply the sell unit (each, box of N, case of N, or size) for each of the 368 products.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:265`, `src/data/products.js:53`, `src/App.jsx:1098`, `scripts/build-seed.mjs:47`, `src/data/products.js:3`, `src/App.jsx:1112`, `supabase/migrations/20260927120000_product_copy.sql:6`

Full details and screenshots: `findings.json` entry AW-031, in this folder.

- [ ] Done

### AW-033 · Many product photos were copied from retailers and competitor wholesalers, and Wikimedia images carry no attribution

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** src/assets/products photos listed in sources/*.md

**Problem:** 44 retailer-sourced rows (list above in reason) plus about 25 from smoke-shop retailers and competing wholesalers, e.g. 4aceswholesale.com (#193), hswsupply.com (#309), mysmokewholesale.com (#281, #296), primesupplydistro.com (#69, #73, #285). Wikimedia licenses verified on their file pages: #149 p149-rolling-dice.jpg, Dietmar Rabich, CC BY-SA 4.0; #150 p150-phone-cables.jpg, J.Dncsn, CC BY-SA 3.0; #151 p151-white-v-neck.jpg, Rafasshop, CC BY-SA 4.0; #334 p334-bandaids.jpg, Beendy234, CC BY 4.0. No credit appears in src/.

**Fix:** Replace photos copied from retailers and competitor wholesalers with manufacturer-supplied or self-shot images. Add the required CC attribution (credits page and alt/caption) for the four Wikimedia images (dice, cables, V-neck shirts, bandaids) or replace them. Correct the source logs in src/assets/products/sources/*.md.

**Owner must decide or supply:** Supply manufacturer-provided or self-shot replacement photos for images copied from retailers and competitor wholesalers, and confirm whether to keep the four Wikimedia images with attribution.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/assets/products/sources/drinks-bags.md`, `src/assets/products/sources/merchandise.md`, `src/assets/products/sources/novelties.md`, `src/assets/products/sources/grocery.md`, `src/data/products.js:319`, `src/data/products.js:321`, `src/data/products.js:323`, `src/data/products.js:689`, `src/assets/products/sources/food-stuff.md`, `src/assets/products/sources/motor-oil.md`

Full details and screenshots: `findings.json` entry AW-033, in this folder.

- [ ] Done

### AW-136 · One photo file is shared across sibling products of different size/pack/format

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Cards and PDPs of the listed ids

**Problem:** 18 shared img files covering 37 rows: backwoods_5pk (#11, #16), zyn_6mg (#18, #19, #267), faygo_bottles_20oz (#58, #89), kang_vape_65k (#67, #68), slapwoods_5pk (#77, #340), gain.jpg (#112, #333), sour_punch_jar (#178, #182), nerds_pouches_1 (#188, #200), mamba_big_bars (#189, #190), american_club.png (#240, #241), raw_papers.jpg (#255, #329), loose_leafs_wraps_5pk (#273, #367), powerade_20oz (#290, #291), tyson_wraps (#305, #318), alfakher_250_gram (#316, #317), maruchan_packs (#326 cups, #327 packs), p_gatorade (#335, #336), uncle_al_s_cookies (#350, #351). Contact sheet: screenshots/vdata__sheet-shared.jpg

**Fix:** Give each of the 37 rows that share 18 photo files its own photo showing the correct size, pack or format. At minimum, show a visible size/pack badge. Make the alt text (the product name) match what the photo shows. This includes hero slide 4.

**Owner must decide or supply:** Can you supply (or license) correct photos for the 37 products that currently share 18 photo files, showing each one's actual size, pack or format?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:53`, `src/data/products.js:59`, `src/data/products.js:555`, `src/data/products.js:155`, `src/data/products.js:701`, `src/data/products.js:401`, `src/data/products.js:421`, `src/data/products.js:673`, `src/data/products.js:657`, `src/data/products.js:655`, `scripts/build-seed.mjs:47`, `src/data/products.js:503`, `src/data/products.js:601`, `src/data/products.js:603`, `src/data/products.js:693`, `src/data/products.js:687`, `src/data/products.js:721`, `src/data/products.js:723`, `src/data/products.js:691`, `src/data/content.js:45`, `src/data/products.js:199`, `src/data/products.js:679`, `supabase/seed/products.sql:339`, `src/lib/useCatalog.js:30`, `src/App.jsx:817`, `src/App.jsx:1092`

Full details and screenshots: `findings.json` entry AW-136, in this folder.

- [ ] Done

### AW-139 · Merchandising tags don't hold up: Featured filters return nothing, and DEAL/PREMIUM are unexplained

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/ "New arrivals" and "Bestsellers" rails; category filter panel "Featured" checkboxes

**Problem:** NEW_ARRIVALS_IDS = [61, 62, 64, 31, 171, 167, 342, 184, 75, 76], trimmed to 8 in the UI. The New arrivals rail therefore shows #61 Geek Bar Pulse X, #31 BIC lighters and #171 Hershey's, all badged BESTSELLER; #167 Almond Joy, untagged; and #342 with no photo. Meanwhile the NEW-tagged #75 and #76 are cut off. BIC and Geek Bar Pulse X appear in both home rails. Only 28 of 368 rows carry any tag (16 BESTSELLER, 6 NEW, 3 DEAL, 3 PREMIUM). DEAL (#82, #105, #270) and PREMIUM (#265, #321, #332) have no discount or compare-at price anywhere. GROCERY has zero tagged rows, yet shows Bestsellers/New/Deals/Premium checkboxes that each return "Showing 0 of 47 items" (measured). Every other department has two or more empty options, e.g. TOBACCO New/Premium and FOOD STUFF New/Deals/Premium.

**Fix:** Define and audit the tag set in products.js. On category pages, show only Featured checkboxes that have matching products in the current department (with counts), or hide the fieldset (App.jsx:869, 935, 1007). Either explain DEAL and PREMIUM on the PDP (what the deal is, what premium means) or remove those tags (App.jsx:816, 872, 1091).

**Owner must decide or supply:** What do the DEAL and PREMIUM tags mean for buyers (the actual deal terms and premium criteria), or should they be removed?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:766`, `src/App.jsx:703`, `src/App.jsx:704`, `src/App.jsx:869`, `src/App.jsx:935`, `scripts/build-seed.mjs:18`, `src/App.jsx:1007`, `src/App.jsx:816`, `src/App.jsx:1091`, `src/App.jsx:872`, `src/App.jsx:873`, `src/index.css:206`, `src/index.css:207`, `src/pages/admin/AdminPage.jsx:315`, `src/data/products.js:185`, `src/data/products.js:231`, `src/data/products.js:561`

Full details and screenshots: `findings.json` entry AW-139, in this folder.

- [ ] Done

### AW-140 · Duplicate and unidentified product rows

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Listed PDPs and their category grids

**Problem:** #350 "Uncle Al's" and #351 "Uncle Al's cookies" are the same Lemon Ice cookie with the same photo; food-stuff.md says so, yet they are priced $33.23 and $18.68. #366 "Garcia y Vega cigars" (variant Green) is pictured and sourced as "game-cigars-palma-green-40ct", which overlaps #3 Game cigarillos, whose variants include Green. #95 Trash can liners vs #107 Trash bags. Rows the photo notes could not identify: #295 "Snack wraps" (40ct/12ct), possibly plastic snack bags or tortillas yet filed in Chips & Crackers; #219 "Happy valentines jar" ("not identified; two candidates"); #126 Baby wipes Boys/Girls ("Not certain"); #253 "Ajax detergent" ("not confirmed as the current US retail package").

**Fix:** For #350: delete the row from CATALOG in src/data/products.js, which serves as the static fallback. Deactivate it in Supabase through Admin → Products → Edit → uncheck Active, or run `update public.products set active = false where id = 350;`, because the seed never changes `active` and never deletes rows. Add the other Uncle Al's flavors the warehouse stocks as variants on #351. For #366, ask the owner. If it is Game Palma Green, rename it "Game Palma cigars" with brand "Game" and variants ["Green"] (a distinct large-format product from #3 Game cigarillos). For #95/#107, ask whether they are the same stock. If so, fold #95 into #107's variants and deactivate #95 the same way as #350. For #295, #219, #126 and #253, get the exact product from the owner and set name, brand, sub and photo, or deactivate the row in Supabase until it is identified. Run `npm run seed` and apply the result afterwards.

**Owner must decide or supply:** Is #366 Game Palma Green cigars, are #95 and #107 the same stock, and which other Uncle Al's flavors are stocked for #351?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:27`, `src/data/products.js:211`, `src/data/products.js:235`, `src/data/products.js:273`, `src/data/products.js:459`, `src/data/products.js:527`, `src/data/products.js:611`, `src/data/products.js:721`, `src/data/products.js:723`, `src/data/products.js:753`, `src/assets/products/sources/food-stuff.md`, `src/assets/products/sources/grocery.md`, `src/assets/products/sources/novelties.md`, `src/assets/products/sources/tobacco.md`, `scripts/build-seed.mjs:19`

Full details and screenshots: `findings.json` entry AW-140, in this folder.

- [ ] Done

### AW-286 · Brand field is wrong or missing on several rows

**Low** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Card detail line (brand · variants · SKU) and PDP eyebrow ("BRAND · SUB-LINE")

**Problem:** #191 brand "Mint lumps" and #192 "Cherry lumps", while their packshots (src/assets/products/mint_lumps.jpg, cherry_lumps.jpg) show the brand "Candyman's" (Sumthin' Sweet line). #44 has brand "Mike and Ike" but name "Mike & Ike". #248 has name "Coke" but brand "Coca-Cola". #98 has brand "BlueDEF" while its description says "PEAK BlueDEF" (PEAK is the brand used on #99 and #103). #343 "Gummy novelty candy" has brand "Assorted" but an eFrutti Mini Burger photo, and its PDP eyebrow reads "ASSORTED · SWEETS & GUMMIES". #219 has brand "Happy". 66 rows use the placeholder brand "Assorted", which prints on cards (e.g. #342 Dubai chocolate on the home New arrivals rail: "Assorted · 2 variants · AW-DUBAI-CHOCOLAT") and in the PDP eyebrow.

**Fix:** In src/data/products.js set: #191 and #192 brand "Candyman's"; #44 name "Mike and Ike", matching the brand; #248 name "Coca-Cola"; #98 brand "PEAK" and name "PEAK BlueDEF diesel exhaust fluid 2.5 gal"; #343 brand "eFrutti" only if every variant is eFrutti (SpongeBob is not, so confirm with the owner). Replace "Assorted" with the actual stocked brand wherever the owner knows it. In App.jsx:821 render the brand segment only when p.brand !== 'Assorted'. In App.jsx:1094 render `{p.brand !== 'Assorted' ? `${p.brand} · ` : ''}{p.sub}`. Then run `npm run seed` and apply supabase/seed/products.sql so the live products table picks up the new brands and names.

**Owner must decide or supply:** For each product currently listed as 'Assorted' (and #343, which mixes eFrutti and SpongeBob), which brand do you actually stock?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:109`, `src/data/products.js:217`, `src/data/products.js:403`, `src/data/products.js:405`, `src/data/products.js:517`, `src/data/products.js:707`, `src/App.jsx:821`, `src/App.jsx:1094`

Full details and screenshots: `findings.json` entry AW-286, in this folder.

- [ ] Done

## Home page

### AW-005 · No trust signals anywhere on the homepage

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/ → whole page (hero through footer)

**Problem:** The homepage has no brand logos, no photos of the warehouse, trucks or team, no years in business or number of stores served, no testimonials, no licence or registration IDs and no FAQ. All imagery is manufacturer packshots or vape ads. The only contact email is a consumer Gmail address, 'Alabamawholesaleinc@gmail.com' (src/data/content.js:11, also in the index.html JSON-LD). content.js already defines BRANDS (line 48), TRUST (50-55) and FAQS (57-74), but nothing imports them.

**Fix:** 1) Add a 'Brands we carry' strip directly under the hero: a grey logo row built from BRANDS (content.js:48), with logos stored in src/assets/brands/ and used with permission. 2) After the services strip (App.jsx:742–746), add a trust band that uses only facts the owner has verified: years in business, number of retail accounts or routes, a warehouse photo and a delivery-truck photo. Do not publish TRUST's unverified claims ('Three generations', '100% Authentic') without confirmation. 3) Add an FAQ accordion (<details>) fed by FAQS (content.js:57) once the owner verifies each answer. First reconcile FAQS 'approved within 24 hours' (content.js:63) with the homepage's 'within one business day' (App.jsx:786). 4) Replace 'Alabamawholesaleinc@gmail.com' with a domain address (e.g. orders@alabamawholesaleinc.com) in src/data/content.js:11 and in the JSON-LD at index.html:41.

**Owner must decide or supply:** Confirm the trust facts to publish (years in business, number of retail accounts/routes, whether 'Three generations' and '100% Authentic' are true, correct approval time), supply warehouse/truck photos, and confirm which brand logos you have permission to show.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/content.js:11`, `src/data/content.js:48`, `src/data/content.js:50`, `src/data/content.js:57`, `src/App.jsx:701`, `index.html:41`

Full details and screenshots: `findings.json` entry AW-005, in this folder.

- [ ] Done

### AW-006 · Hero imagery is small, low-res packshots that don't represent a multi-department distributor

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/ → hero carousel, all four slides

**Problem:** The stage is 1278×480 at 1440 and 1920. Each photo renders at its native size and covers only part of the stage: hero_candy 700×441 (50%), hero_vape 500×500 (41%), hero_lighters 700×481 (55%), hero_gatorade 458×500 (37%). The largest source is 700px wide (src/assets/hero_*.jpg), so the images look soft on retina screens. Slide content: 1) a Turtles Bites candy box; 2) the Geek Bar Pulse X marketing ad with baked-in 'ACCEPT ALL CHALLENGES' text and JPEG artefacts; 3) BIC lighters with the lighter tops cut off at the top edge; 4) a retailer-style grid of 7 Gatorade/G2 bottles. None shows the distributor: no warehouse, trucks or assortment. The alt text is the unrendered marketing title (e.g. alt='The brands your customers ask for.' on the Turtles box), which does not describe the image.

**Fix:** Replace hero_candy/hero_vape/hero_lighters and the other slides with wide, high-resolution images (at least 2560px wide for the 1278x480 stage, with srcset) that show the warehouse or a multi-department assortment, not one-product packshots or a Geek Bar ad. Use object-fit: cover so the stage is filled, not a small image floating in a white box (content.js:42-45).

**Owner must decide or supply:** Supply wide, high-resolution (2560px+) licensed photos of the warehouse or a multi-department assortment for the hero.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/content.js:42`, `src/data/content.js:43`, `src/data/content.js:44`, `src/data/content.js:45`, `src/App.jsx:679`, `src/App.jsx:683`, `src/index.css:182`, `src/assets/hero_candy.jpg`, `src/assets/hero_vape.jpg`, `src/assets/hero_lighters.jpg`, `src/assets/hero_gatorade.jpg`, `scripts/build-images.mjs:35`, `src/App.jsx:680`, `src/index.css:178`, `src/data/content.js:42-45`

Full details and screenshots: `findings.json` entry AW-006, in this folder.

- [ ] Done

### AW-056 · Homepage repeats the same products: New arrivals mostly duplicates Bestsellers, and the hero, department tiles and collections reuse the same photos

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/ → hero, New arrivals, Bestsellers, Shop by department, Collections

**Problem:** The Geek Bar Pulse X 25K photo appears 3 times (hero slide 2, New arrivals #1, Bestsellers #6). BIC lighters appear 3 times (hero slide 3, New arrivals #4, Bestsellers #2). The Geek Bar Pulse 15K photo is Bestsellers #5 and also the Novelties department tile. STP Oil Treatment is Bestsellers #3 and also the Motor Oil tile. The Turtles Bites photo is hero slide 1 and also the Novelties collection-card background. Bestsellers is simply the first 8 BESTSELLER rows in id order (App.jsx:704), so two Geek Bars and two motor oils sit next to each other.

**Fix:** Give each homepage block its own product set. Fill New arrivals from a real date-added or 'new' tag and Bestsellers from the bestseller tag. Give the hero and department tiles dedicated imagery. Remove duplicates across the hero, New arrivals, Bestsellers, Shop by department and Collections (App.jsx:699-704, 755; products.js:766). Point each rail's CTA to a cross-department listing (e.g. all new arrivals / all bestsellers) instead of a single department.

**Owner must decide or supply:** Which products are really new arrivals and which are real bestsellers, and can you supply dedicated hero and department images?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:704`, `src/App.jsx:755`, `src/App.jsx:699`, `src/data/content.js:43`, `src/data/content.js:44`, `src/data/products.js:766`, `src/App.jsx:703`, `src/App.jsx:713`, `src/App.jsx:735`, `src/App.jsx:816`, `src/App.jsx:165`, `src/App.jsx:177`, `src/App.jsx:217`, `src/App.jsx:869`, `src/pages/support/CatalogIndexPage.jsx:10`

Full details and screenshots: `findings.json` entry AW-056, in this folder.

- [ ] Done

### AW-057 · Card buttons are inconsistent and unclear: 'Choose' vs 'QUOTE +'

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/ → product card action buttons (.card-add)

**Problem:** 15 of 16 homepage cards show a sentence-case 'Choose' button (App.jsx:832). RAZ 25K (id 64) shows an uppercase 'QUOTE +' (App.jsx:840) because it has zero variants. Both are 11px with 1px letter spacing, but only one is capitalised. For guests, 'Choose' doesn't say what is being chosen (flavour/size), and 'QUOTE +' silently adds the item to the cart; the only feedback is the button turning into a stepper. RAZ 25K has no flavours in the data even though its photo shows 'Blue Raz Ice'.

**Fix:** Use one naming and casing scheme. Multi-variant items: 'Select options' (goes to the product page). Single items: 'Add to quote' for guests and pending accounts, 'Add to order' for approved buyers. Everything in sentence case at var(--text-sm). Show a short 'Added' toast or inline confirmation after adding. Give RAZ 25K (id 64) its real flavour variants in products.js and the database so it behaves like the other vapes.

**Owner must decide or supply:** Which RAZ 25K flavours do you actually stock, so they can be added as its variants?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:832`, `src/App.jsx:840`, `src/index.css:219`, `src/data/products.js:149`

Full details and screenshots: `findings.json` entry AW-057, in this folder.

- [ ] Done

### AW-058 · Collection cards: Novelties card uses a faded Turtles candy photo, and the Tobacco card has no image

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/ → Collections row (two .editorial-card promos)

**Problem:** EDITORIAL_BG = heroImage('hero_candy.jpg') (App.jsx:699) is a Turtles Bites candy box. It is the background of the 'EXOTICS & NOVELTIES' card (App.jsx:722), shown at opacity .28 with multiply blending (index.css:233-234), so it looks washed-out pink behind the purple headline. It shows no vape, hookah or novelty product, and it is the same photo as hero slide 1. The 'Tobacco, wraps & accessories' card (App.jsx:726-729) is flat purple with no image, so the pair looks unbalanced.

**Fix:** Give each homepage collection card an on-theme image: a real novelties/vape assortment for 'Exotics & Novelties' (not the Turtles candy photo) and a tobacco/cigar image for the purple Tobacco card, both at full opacity with a legible text overlay (App.jsx:699, 722-726).

**Owner must decide or supply:** Supply or approve licensed photos for the 'Exotics & Novelties' collection card and the Tobacco/cigar collection card.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:699`, `src/App.jsx:722`, `src/App.jsx:726`, `src/index.css:233`, `src/index.css:234`

Full details and screenshots: `findings.json` entry AW-058, in this folder.

- [ ] Done

### AW-217 · Novelties department has three names ('Exotics', 'Novelties & Vapes', 'NOVELTIES'), and department/count wording is inconsistent

**Low** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/ → header nav, collection card, mega-menu feature, department tile, card labels

**Problem:** All of these open #/category/NOVELTIES: nav 'Exotics ↗' (App.jsx:552), collection eyebrow 'EXOTICS & NOVELTIES' (App.jsx:724), mega-menu feature 'Exotics & novelties.' (App.jsx:540), department label 'Novelties & Vapes' (CAT_LABEL, App.jsx:35) and card labels 'NOVELTIES' (raw p.cat, App.jsx:815).

**Fix:** Choose one department name and use it in the header nav item (not 'Exotics'), the mobile menu, the mega-menu feature, the collection card, department tiles and card labels (App.jsx:35, 540, 552, 589). Standardize count wording ('68 products' vs SKUs vs items) across the catalog pages.

**Owner must decide or supply:** Which single name should the Novelties department use everywhere: 'Exotics', 'Novelties & Vapes' or 'Novelties'?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:35`, `src/App.jsx:540`, `src/App.jsx:552`, `src/App.jsx:589`, `src/App.jsx:724`, `src/App.jsx:815`, `src/App.jsx:510`, `src/App.jsx:699`, `src/App.jsx:460`, `src/App.jsx:545`, `src/App.jsx:610`, `src/App.jsx:713`, `src/App.jsx:762`, `src/App.jsx:832`, `src/App.jsx:840`, `src/App.jsx:915`, `src/App.jsx:958`, `src/App.jsx:1007`, `src/pages/support/CatalogIndexPage.jsx:16`, `src/pages/support/CatalogIndexPage.jsx:25`, `src/pages/support/CatalogIndexPage.jsx:34`, `src/pages/support/CatalogIndexPage.jsx:46`

Full details and screenshots: `findings.json` entry AW-217, in this folder.

- [ ] Done

## Product detail pages

### AW-010 · Product photos show a different product (Pepsi → Aquafina, Monster → Softsoap, eFrutti → Gummi Eyez with AI watermark, etc.)

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/product/205, 270, 329, 318, 67, 89, 326, 182, 200, 248, 317, 267 → main product photo (the same photos appear on category and search cards)

**Problem:** Source-file contact sheet: screenshots/vproduct__mismatch-sheet.jpg. Mismatches: 205 'Pepsi' uses p205-pepsi.jpg, which is AQUAFINA 'Multipack 32 CT'. 270 'Monster Energy' (tag DEAL) uses p270-monster-energy.jpg, which is two Softsoap refill jugs. 248 'Coke' uses p248-coke.jpg, which is a 'Diet Coke 12 x 12oz' pack. 329 'RAW tips' uses raw_papers.jpg (papers and Challenge Cone boxes, same file as 255). 318 'Tyson 2.0 rolling papers' uses tyson_wraps.jpg (Futurola/Tyson 'Blunt Wraps' display, same as 305). 67 'Kangvape 8000' uses kang_vape_65k.jpg (Speedy Beast X 60K/30K ad, same as 68). 89 'Faygo cans' uses faygo_bottles_20oz.jpg (bottles). 326 'Maruchan ramen cups' uses maruchan_packs.jpg (flat packs). 182 'Sour Punch candy' uses the Sour Punch Twists tub, which is the photo for 178. 200 'Nerds bags' uses the Nerds Gummy Clusters display, which is the photo for 188. 317 'Al Fakher 1…

**Fix:** Replace the wrong photos with correct packshots for every listed id across Tobacco, Novelties, Candies, Drinks & Bags, Food Stuff, Grocery and Motor Oil (for example #205, 270, 329, 318, 67, 89, 326, 182, 200, 248, 317, 267, 262). Use a watermark-free eFrutti jar photo on the standard background. The fix applies to cards, PDPs and cart/quote thumbnails.

**Owner must decide or supply:** Supply correct, licensed packshots for the mismatched products (#205, 270, 329, 318, 67, 89, 326, 182, 200, 248, 317, 267, 262), including a watermark-free eFrutti jar photo.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:431`, `src/data/products.js:561`, `src/data/products.js:517`, `src/data/products.js:679`, `src/data/products.js:657`, `src/data/products.js:155`, `src/data/products.js:199`, `src/data/products.js:673`, `src/data/products.js:385`, `src/data/products.js:421`, `src/data/products.js:655`, `src/data/products.js:555`, `src/assets/products/p205-pepsi.jpg`, `src/assets/products/p270-monster-energy.jpg`, `src/assets/products/p248-coke.jpg`, `src/data/products.js:753`, `src/data/products.js:531`, `src/data/products.js:731`, `src/data/products.js:123`, `src/data/products.js:687`, `src/assets/products/sources/drinks-bags.md`, `src/assets/products/maruchan_packs.jpg`, `src/assets/products/gain.jpg`, `src/assets/products/faygo_bottles_20oz.jpg`, `src/assets/products/cereal_cups.jpg`, `src/assets/products/gold_band.jpg`, `supabase/seed/products.sql`, `src/data/products.js:59`, `src/data/products.js:353`, `src/data/products.js:567`, `src/data/products.js:545`, `src/assets/products/efrutti_jar.webp`, `supabase/seed/products.sql:268`

Full details and screenshots: `findings.json` entry AW-010, in this folder.

- [ ] Done

### AW-073 · Many product photos are too low-resolution for the product page and look soft or blurry

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/product/<id> → .pd-media photo (e.g. #/product/122, 335, 77, 263)

**Problem:** Largest generated webp width per product (src/assets/generated). No product image exceeds 1024px wide, because build-images.mjs:34 caps widths at [320, 640, 1024]. At 1440, the PDP content box is 550x522 CSS px. After the AW-009 fix, these 21 products are still upscaled at 1x: 10 500w, 14 512w, 47 500w, 56 512w, 77 227x333, 81 500w, 86 500w, 110 512w, 120 450w, 122 350w, 209 370w, 210 518x386, 218 380w, 240 500w, 241 500w, 251 500w, 263 211x384, 328 428w, 335 380w, 336 380w, 340 227x333. #/product/122 loads 4pk_tissues--350x350.webp into a 618px box (upscaled about 1.6x) and the label text is visibly soft. #/product/335 loads p_gatorade--380x380.webp into 618px. Screenshot: screenshots/vproduct__pdp-media-1440-122.jpg

**Fix:** Replace source photos under ~800px (and the enlarged low-detail copies such as #324, 112, 333, 96, 117, 346, 122, 335, 77, 263) with high-resolution packshots. In scripts/build-images.mjs, stop upscaling past the source width and cap the rendered size to the natural width (build-images.mjs:34, images.js:82).

**Owner must decide or supply:** Supply high-resolution, licensed packshots (at least 800px) for the low-resolution products listed, starting with #324, 112, 333, 96, 117, 346, 122, 335, 77 and 263.

**Files (lines are from before the refactor — search, don't trust line numbers):** `scripts/build-images.mjs:34`, `src/lib/images.js:82`, `src/data/products.js:265`, `src/data/products.js:691`, `src/data/products.js:693`, `src/data/products.js:547`, `src/data/products.js:175`, `src/data/products.js:701`, `src/data/products.js:439`, `src/data/products.js:457`, `src/data/products.js:441`, `src/data/products.js:41`, `src/data/products.js:183`, `src/data/products.js:193`, `src/data/products.js:501`, `src/data/products.js:503`, `src/data/products.js:523`, `src/data/products.js:49`, `src/data/products.js:33`, `src/data/products.js:107`, `src/data/products.js:575`, `src/data/products.js:417`, `src/data/products.js:79`, `src/data/products.js:685`, `src/data/products.js:27`, `src/data/products.js:677`, `src/data/products.js:261`, `src/data/products.js:115`, `src/data/products.js:133`, `src/data/products.js:241`, `src/data/products.js:249`, `src/data/products.js:669`, `src/data/products.js:255`, `src/data/products.js:245`, `src/data/products.js:687`, `src/data/products.js:213`, `src/assets/products/twang_beer_salts_packets.webp`, `src/assets/products/p117-las-totally-awesome-laundry.jpg`, `src/assets/products/gain.jpg`, `src/assets/products/autoguard_brake_fluid.webp`

Full details and screenshots: `findings.json` entry AW-073, in this folder.

- [ ] Done

### AW-075 · Descriptions are templated filler that repeats the name and the variant list, with casing errors

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/product/<id> → .pd-desc and meta description

**Problem:** 133 of 368 descriptions use the template '<name> from the <sub> line in our <Dept> department.' 46 end with 'Stocked in one variety: X.' 226 simply list the variants already shown as chips. Examples: #/product/205 'Pepsi from the soda line in our Drinks & Bags department.' #/product/329 'RAW rolling tips from the papers and cones line in our Tobacco department. Stocked in one variety: Tips.' #/product/122 'Bath tissue in 4-roll packs. Stocked in one variety: Case.' Casing and name mismatches: 9 'Ez roll' (name 'Royal Blunts EZ Roll'), 13 'Havana leaf wraps', 183 'Extra gum', 193 'Pure eyes', 213 'Lil leaf wraps', 260 'Backwoods true wraps', 274 'Raw guarana wraps', 310/311 'Geek Bar mate'. Odd statements: 132/133 charcoal 'Two colors: White and Red'; 219 'Happy valentines jar from the wellness pill line … 4 inch, 6 inch and Colored'; 258 'Stocked in one variety: Any flavor'.

**Fix:** Replace the templated descriptions ('from the X line in our Y department', name plus variant list) with real copy covering pack size, case count, dimensions and key attributes. Fix casing errors. Use this copy for the meta description too.

**Owner must decide or supply:** Provide the real pack size, case count, dimensions and key attributes for each product so real descriptions can be written.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:39`, `src/data/products.js:431`, `src/data/products.js:679`, `src/data/products.js:265`, `src/data/products.js:459`, `src/App.jsx:1097`, `src/data/products.js:23`, `src/data/products.js:432`, `src/data/products.js:444`, `src/data/products.js:538`, `src/App.jsx:1099`, `src/App.jsx:105`, `src/data/products.js:12`, `src/data/products.js:443`, `src/data/products.js:531`, `src/data/products.js:535`, `src/data/products.js:585`, `src/lib/useCatalog.js:28`

Full details and screenshots: `findings.json` entry AW-075, in this folder.

- [ ] Done

## Admin back office

### AW-024 · A guest quote can't be priced, answered, edited or turned into an order, and orders have no quoted or confirmed stage

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/admin → Orders tab → order card (guest quote ALW-Q-41207 vs approved-buyer order ALW-Q-51002)

**Problem:** The guest quote card offers exactly one control, 'SELECT: Status for ALW-Q-41207', with options new / contacted / fulfilled / cancelled.
- All 3 lines show '—' (unit_price null) and there is no total.
- There is no price input and no 'Send quote', 'Convert to order', 'Link to account' or 'Add line' action.
- Email and phone are plain text (0 mailto:, 0 tel: links), so staff must copy them into another app to reply.
- Guest quotes and account orders use the same header (background rgb(246,243,238), same border). The only difference is a trailing 'tier: silver' on account orders; there is no 'Guest quote' label.
- Priced cards show only line totals ($469.20), never the unit price.

The database blocks this as well:
- order_items has only a SELECT policy (rls_policies.sql:78-84). The insert policy was dropped and INSERT revoked (launch_order_boundaries.sql:258-262), and there is no…

**Fix:** Migration:
alter table public.orders drop constraint orders_status_chk;
alter table public.orders add constraint orders_status_chk check (status in ('new','quoted','confirmed','picking','ready','out_for_delivery','fulfilled','cancelled'));
alter table public.orders add column kind text not null default 'order' check (kind in ('quote','order'));
update public.orders set kind='quote' where user_id is null;
alter table public.orders add column quoted_at timestamptz, add column quoted_by uuid references public.profiles(id);
alter table public.order_items add column original_qty integer;

Re-create the trigger for INSERT only:
drop trigger order_items_price on public.order_items;
create trigger order_items_price before insert on public.order_items for each row execute function public.enforce_order_item_price();

Add SECURITY DEFINER RPCs that begin with 'if not public.is_admin() then raise exception ...':
- admin_price_order(p_order_id uuid, p_lines jsonb): each line is {item_id, qty, unit_price}. It updates order_items (storing original_qty on the first change), deletes lines with qty 0, recomputes orders.total_units and subtotal, and sets status='quoted', quoted_at=now(), quoted_by=auth.uid().
- admin_convert_quote(p_order_id uuid, p_user_id uuid default null): sets kind='order', status='confirmed' and optionally links user_id to a profile found by email.

UI, in OrdersTab (AdminPage.jsx:104-127):
- A 'Guest quote' / 'Trade order' badge.
- mailto: and tel: links for email and phone.
- A unit-price column.
- An 'Edit / price' mode with qty and unit-price inputs per line, prefilled from the catalog price × tier (standard for guests), plus a live subtotal.
- Buttons 'Save prices', 'Email quote' (mailto: with a prefilled body listing lines and total, or an Edge Function via the site's email provider), 'Convert to order', and 'Link to account' (matches profiles.email = orders.email).
- Update AccountPage STATUS_LABEL to the new states with customer wording ('Quote ready', 'Confirmed', 'Out for delivery').

**Owner must decide or supply:** Confirm how quotes should work: should staff price and answer guest quotes and convert them to orders, and should orders go through 'quoted' and 'confirmed' stages before picking?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/admin/AdminPage.jsx:14`, `src/pages/admin/AdminPage.jsx:104-127`, `src/pages/admin/AdminPage.jsx:109-116`, `src/pages/admin/AdminPage.jsx:122`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:67-70`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:105-113`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:119-123`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:258-262`, `supabase/migrations/20260517000001_rls_policies.sql:78-84`, `supabase/migrations/20260517000000_initial_schema.sql:103-135`, `src/pages/account/AccountPage.jsx:16-21`

Full details and screenshots: `findings.json` entry AW-024, in this folder.

- [ ] Done

## Content, copy & business facts

### AW-025 · Advertised 'Net-30 trade terms' and 'Save up to 18%' volume discounts are not backed by the pricing system (capped at 10%) or stated in the Trade terms

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Every page → top ticker; #/ → services block 02 'Net-30 trade terms'

**Problem:** Ticker (content.js:23, hidden below 600px by index.css:563): '★ VOLUME DISCOUNTS · Save up to 18% on pallet quantities'. Home services 02 (App.jsx:744): 'Volume discounts up to 18% on pallet quantities across all eight departments.' The only discounts are account tiers: TIER_DISCOUNT = { standard: 0, silver: 0.05, gold: 0.10 } (App.jsx:28) and the pricing_tiers seed of 0/5/10% (supabase/migrations/20260517000000_initial_schema.sql:95-98). Server line prices come from the trigger public.enforce_order_item_price (supabase/migrations/20260925120000_launch_order_boundaries.sql:47-123), which applies only the tier discount_pct (:106-110). No quantity or pallet discount exists, and #/terms 'Pricing and quotes' (PolicyPage.jsx:72) has no schedule. The unused FAQ (content.js:69) says the discount 'is applied automatically at checkout', which is false.

**Fix:** Settle the actual offer: who is eligible for Net-30, and the real maximum tier discount from pricing_tiers. State it the same way in the ticker (content.js:21, 23), the home services block 02 (App.jsx:744), the application dialog, and the #/terms Payment section (PolicyPage.jsx:79-81). If the offer doesn't exist, remove the claims everywhere.

**Owner must decide or supply:** Do you actually offer Net-30 terms (and to whom), and what is the real maximum volume discount, or should these claims be removed?

**Owner decision (overrides the fix above):** keep these product lines and claims exactly as they are for now. Do not delist, hide, rename, re-file or reword them. Only add `TODO(owner)` markers and `docs/OWNER-TODO.md` rows where they're missing, and build any code that doesn't change what customers see.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/content.js:23`, `src/App.jsx:744`, `src/App.jsx:28`, `src/data/content.js:53`, `src/data/content.js:69`, `src/data/content.js:96`, `supabase/migrations/20260517000000_initial_schema.sql:95`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:106`, `src/pages/support/PolicyPage.jsx:79-81`, `src/data/content.js:21`, `src/data/content.js:45`, `src/components/AuthModal.jsx:172`, `src/data/content.js:50-101`, `src/pages/support/PolicyPage.jsx:79`, `src/data/onboarding.js:5`

Full details and screenshots: `findings.json` entry AW-025, in this folder.

- [ ] Done

### AW-028 · Trade terms omit returns and damaged goods, credit terms, taxes, risk of loss, liability and governing law

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/terms

**Problem:** Sections present: Who can buy, Account approval, Pricing and quotes, Orders and delivery, Payment ('cash, checks, and electronic wiring and transfers'), Resale and compliance, Your login, Changes (PolicyPage.jsx:60-92). Missing for a B2B distributor: a returns / damaged / short-shipment claim window and credits; Net-30 and credit terms with late fees (promoted elsewhere); sales-tax exemption and tobacco excise/stamp responsibility; title and risk of loss at delivery or pickup; recalls and warranties; limitation of liability; governing law and venue (Alabama); cancellation of confirmed orders; the volume-discount schedule claimed on the homepage. The inline link 'See Delivery for how that works' points to a page titled only 'Delivery'.

**Fix:** Expand #/terms with returns, damaged/short-shipment claims, cancellations, substitutions, credit terms, taxes, risk of loss, limitation of liability and governing law (PolicyPage.jsx:60-92), and link these sections from the delivery page.

**Owner must decide or supply:** Provide or approve (ideally with counsel) your actual policies on returns, damaged/short shipments, cancellations, substitutions, credit terms, taxes, risk of loss, liability limits and governing law.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/support/PolicyPage.jsx:60`, `src/pages/support/PolicyPage.jsx:79`, `src/pages/support/PolicyPage.jsx:77`, `src/pages/support/PolicyPage.jsx:14-36`, `src/pages/support/PolicyPage.jsx:60-92`, `src/pages/support/SupportShell.jsx:9-13`, `src/App.jsx:1341-1345`

Full details and screenshots: `findings.json` entry AW-028, in this folder.

- [ ] Done

### AW-127 · Business contact email is a capitalised Gmail address instead of a domain address

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Footer Contact column, Help dialog, #/contact, all policy pages, error messages, document-upload note, JSON-LD

**Problem:** COMPANY.email = 'Alabamawholesaleinc@gmail.com' (content.js:11), with a capital A. It is shown in the footer, Help dialog, #/contact ('Email the trade desk'), #/shipping, #/privacy and #/terms (twice each), ServiceUnavailable, the AuthModal errors, the DocumentUploads note 'send proof later to Alabamawholesaleinc@gmail.com', and JSON-LD "email" (index.html:41). The site's canonical domain is alabamawholesaleinc.com. A free webmail address on a B2B page that collects EINs and license documents undermines trust and invites phishing look-alikes.

**Fix:** Replace the capitalised Gmail address in content.js COMPANY.email and the index.html JSON-LD with a lowercase domain address (for example orders@alabamawholesaleinc.com). This updates the footer, Help dialog, #/contact, policy pages, ContactStrip, error messages and the document-upload note.

**Owner must decide or supply:** Which domain email address (e.g. orders@alabamawholesaleinc.com) is set up and monitored, so it can replace the Gmail address site-wide?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/content.js:11`, `index.html:41`

Full details and screenshots: `findings.json` entry AW-127, in this folder.

- [ ] Done

### AW-130 · Two overlapping delivery pages (#/shipping and #/delivery) that still omit fees, cutoff, days and receiving rules

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/shipping, #/delivery, footer, PolicyNav

**Problem:** #/shipping has the H1 'Delivery' and is linked as 'Delivery' in the footer legal row and PolicyNav (SupportShell.jsx:10). #/delivery ('Delivery & service area') repeats most of the same copy and is linked in the footer 'Account & help' column, so the footer shows both 'Delivery' and 'Delivery & service area'. Neither page states the delivery fee for on-route orders under $1,500, the cutoff time for next-day delivery, route days, will-call lead time, or ID needed at pickup. 'Receiving your order: Count the cases and check for damage…' (PolicyPage.jsx:29-31) says nothing about what to do next. The out-of-area checker result 'Delivery is currently on routes in Alabama, Mississippi, and Georgia.' (DeliveryPage.jsx:70) offers no next step and adds an Oxford comma used nowhere else. #/shipping has no 'Last updated' line (no updated:true at PolicyPage.jsx:14), unlike #/privacy and #/terms.

**Fix:** Merge #/shipping and #/delivery into one 'Delivery & pickup' page, redirect the other route, and update the footer, PolicyNav and the Contact will-call block (PolicyPage.jsx:14-36, 77; DeliveryPage.jsx:15-102; SupportShell.jsx:9-13). Add the order cutoff time, delivery days per route, the fee for orders under $1,500, tobacco receiving/ID rules, and the damaged/short-shipment claim process.

**Owner must decide or supply:** What are the order cutoff time, delivery days per route, the fee for orders under $1,500, tobacco receiving/ID rules, and the damaged/short-shipment claim process?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/support/PolicyPage.jsx:14`, `src/pages/support/PolicyPage.jsx:29`, `src/pages/support/SupportShell.jsx:10`, `src/pages/support/DeliveryPage.jsx:70`, `src/App.jsx:1342`, `src/pages/support/PolicyPage.jsx:14-36`, `src/pages/support/PolicyPage.jsx:77`, `src/pages/support/DeliveryPage.jsx:15-102`, `src/pages/support/SupportShell.jsx:9-13`, `src/App.jsx:25`, `src/App.jsx:174`, `src/App.jsx:336`, `src/pages/support/ContactPage.jsx:59-60`, `src/pages/support/DeliveryPage.jsx:94`, `src/pages/support/PolicyPage.jsx:16`, `src/pages/support/PolicyPage.jsx:24`, `src/pages/support/PolicyPage.jsx:27`, `src/pages/support/DeliveryPage.jsx:26-43`, `src/pages/support/PolicyPage.jsx:19-34`

Full details and screenshots: `findings.json` entry AW-130, in this folder.

- [ ] Done

### AW-134 · Department and subcategory names are awkward, overlapping or mislabelled ('Food Stuff', 'Drinks & Bags', 'Motor Oil › Motor Oil', a non-pill jar under 'Wellness Pills')

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Mega menu, #/catalog, category pages, sub-pills, product card labels, footer

**Problem:** CAT_LABEL (App.jsx:34-38) renders 'Food Stuff' and 'Drinks & Bags' in the mega menu, the 390 mobile menu (e.g. '05 Food Stuff 24', '08 Drinks & Bags 44') and the footer. Subcategory data from products.js:
- MOTOR OIL › Motor Oil: 8 items
- TOBACCO › Wraps & Leafs: 24 items
- TOBACCO › Pouches & ZYN: 3 ZYN + 1 PIK
- MERCHANDISE › Honey & Energy: Black Tiger Honey, Blue Wolf honey, Hard Steel, Rhino pills 2-pack, Secret Miracle Honey, VIP Royal Honey gold
- MERCHANDISE › Energy Shots: 2 × 5-hour Energy
- GROCERY › Other Grocery: 1 item
- CANDIES › Jars: 4 jars + 4 tubs
- Bags in CANDIES › Bags, GROCERY › Bags & Storage and DRINKS & BAGS › Bags & Carriers (which also holds register paper rolls and trash can liners)
- NOVELTIES › Wellness Pills: 'Happy valentines jar' (products.js:459, variants '4 inch', '6 inch', 'Colored')
Category intro (App.jsx:960): 'Wholesale food stuff for licensed…

**Fix:** Rename the labels in CAT_LABEL, e.g. 'FOOD STUFF' → 'Snacks & Pantry' and 'DRINKS & BAGS' → 'Drinks' (move bags and carriers to Grocery 'Bags & Supplies'). Rename sub values in products.js: 'Motor Oil' sub → 'Oils & Additives', 'Wraps & Leafs' → 'Wraps & Leaf', 'Pouches & ZYN' → 'Nicotine Pouches', 'Honey & Energy' → a truthful name after the legal review, merge 'Other Grocery' into 'Cleaning', move row 219 out of 'Wellness Pills'. Use catLabel(p.cat) for the card label at App.jsx:815. Update the DB and seed.

**Owner must decide or supply:** Do you approve the proposed department/subcategory renames, and what truthful name (after legal review) should replace 'Honey & Energy' and where should row 219 go?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:34`, `src/App.jsx:815`, `src/App.jsx:960`, `src/data/products.js:459`, `src/data/products.js:20`

Full details and screenshots: `findings.json` entry AW-134, in this folder.

- [ ] Done

## Product photos — Tobacco, Novelties, Merchandise, Candies

### AW-034 · Ad banners, retailer listing tiles, lifestyle/stock shots and collages are used as product photos

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/category/NOVELTIES (first 8 cards), #/category/TOBACCO, #/category/MERCHANDISE; home New arrivals, Bestsellers and 'Shop by department' Novelties tile

**Problem:** These rows use ad creatives with slogans, spec badges and scenic backgrounds instead of packshots. #60 Geek Bar Pulse 15K geekbar_15k.webp ('MAY THE PULSE BE WITH YOU', pink splash). #61 Geek Bar Pulse X 25K geekbar_25k_pulse.webp ('ACCEPT ALL CHALLENGES', purple). #62 Foger Switch Pro full kit foger_full_kit.jpg ('DISPOSABLE & POWER BANK', purple and orange). #63 Foger Switch Pro pods foger_pods.webp ('30K PUFFS COMPATIBLE WITH SWITCH PRO', teal gradient). #67 and #68 Kangvape kang_vape_65k.jpg (outer-space scene, UFO, '3D curved screen', '30 minutes', '21+' feature icons). #69 Shroom Puff disposable p69-shroom-puff-disposable-3g.jpg (full-bleed poster card, 420x765). #70 Shroom Puff Pre rolls p70-shroom-puff-pre-rolls-2pk.jpg (flat print artwork with red dashed dieline and bleed marks, 357x1044). #210 Seneca filtered cigars seneca_filter_cigarettes.jpg ('Distinctively Smooth' poster,…

**Fix:** Replace every non-packshot image with a clean packshot on the standard background: Novelties vape banners, Seneca/Billionaire/Black Tiger/24/7 graphics, the Kroger OTC tiles with FSA/HSA badges, Red Bull and other listing graphics, stock/lifestyle/dieline images and multi-product collages.

**Owner must decide or supply:** Supply clean packshot photos to replace the ad banners, retailer tiles, lifestyle shots and collages currently used for Novelties, Tobacco and Merchandise products.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:141`, `src/data/products.js:143`, `src/data/products.js:145`, `src/data/products.js:147`, `src/data/products.js:155`, `src/data/products.js:157`, `src/data/products.js:159`, `src/data/products.js:161`, `src/data/products.js:441`, `src/data/products.js:699`, `src/data/products.js:685`, `src/data/products.js:439`, `src/data/products.js:651`, `src/App.jsx:755`, `src/data/products.js:766`, `src/data/products.js:63`, `src/data/products.js:129`, `src/data/products.js:293`, `src/data/products.js:307`, `src/data/products.js:309`, `src/data/products.js:311`, `src/data/products.js:313`, `src/data/products.js:435`, `src/data/products.js:485`, `src/data/products.js:487`, `src/data/products.js:519`, `src/data/products.js:601`, `src/data/products.js:603`, `src/data/products.js:219`, `src/assets/products/sources/drinks-bags.md`, `src/assets/products/sources/grocery.md`, `src/data/products.js:67`, `src/data/products.js:71`, `src/data/products.js:73`, `src/data/products.js:465`, `src/data/products.js:467`, `src/data/products.js:469`, `src/data/products.js:473`, `src/data/products.js:479`, `src/data/products.js:481`, `src/data/products.js:483`, `src/data/products.js:319`, `src/data/products.js:321`, `src/data/products.js:689`, `src/data/products.js:531`, `src/data/products.js:665`, `src/data/products.js:477`, `src/data/products.js:515`, `src/data/products.js:653`, `src/data/products.js:667`, `src/data/products.js:671`, `src/data/products.js:251`, `src/data/products.js:579`, `src/data/products.js:605`, `src/data/products.js:139`, `src/data/products.js:577`, `src/data/products.js:137`, `src/index.css:311`, `src/index.css:312`, `src/index.css:596`, `scripts/build-images.mjs:68`, `src/data/products.js:547`

Full details and screenshots: `findings.json` entry AW-034, in this folder.

- [ ] Done

### AW-141 · Photo backgrounds are inconsistent: white boxes on cream tiles, and full-bleed black/purple images next to cut-outs

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** All category grids (#/category/TOBACCO etc.), home product rows, and #/product/<id> photo

**Problem:** Card tiles (.card-block, index.css:202) and the PDP box (.pd-media, :311) use background var(--paper) #f6f3ee. Photos with white backgrounds render as a visible white rectangle on the cream tile. On #/category/TOBACCO at 1440 (3-column grid), the first three rows show a grey gradient (#1 Swisher Sweets), white boxes (#2 White Owl display, #5 4K's, #6 Game Mini), a transparent cut-out (#3 Game), a purple full-bleed (#4 BLK, RGB 55,33,73) and a black full-bleed (#7 Swisher Sweets Mini). Other dark or coloured full-bleed backgrounds: #32 BluntPower (magenta), #79 Game Leaf 3-pack and #80 Swisher Sweets Leaf Wraps (brown tobacco-leaf scene), #265 Hard Steel (grey studio). Injecting `.card-block img{mix-blend-mode:multiply}` removed every white box and left cut-outs intact. The site has no dark theme, so multiply has no side effect.

**Fix:** Standardize the image tile. Either make .card-block and .pd-media backgrounds pure white, or preprocess every product image in scripts/build-images.mjs to a consistent background (trim + pad onto the tile colour, or use mix-blend-mode: multiply for white-background shots). Replace dark or full-bleed photos with packshots on the standard background so framing is consistent across cards, search/cart thumbnails and the PDP (index.css:202-204, 311-312).

**Owner must decide or supply:** Supply (or approve sourcing/licensing of) replacement packshots on a plain background for the dark or full-bleed product photos, so Cursor can standardize the tiles.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/index.css:202`, `src/index.css:204`, `src/index.css:311`, `src/index.css:312`, `src/index.css:158`, `src/index.css:465`, `scripts/build-images.mjs:43`, `scripts/build-images.mjs:83`, `src/App.jsx:814`, `src/data/products.js:63`, `src/data/products.js:141`, `src/data/products.js:143`, `src/data/products.js:35`, `src/data/products.js:181`, `src/data/products.js:319`, `src/data/products.js:545`, `src/data/products.js:601`, `src/data/products.js:603`, `src/data/products.js:689`, `src/data/products.js:735`, `src/assets/products/`

Full details and screenshots: `findings.json` entry AW-141, in this folder.

- [ ] Done

### AW-142 · Photo shows a flavor or brand the row does not list (single-variant rows most visibly)

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/product/<id> photo vs. variant chips; category cards

**Problem:** On single-variant rows the photo shows a different variant: #294 PIK 16mg shows 'COLA ICE', variant Wintergreen (L609). #299 Psyched 6000mg shows '6000MG BLUEBERRY GELATO', variant Snow lotus (L619). #202 Rips bags shows 'Mango Chili', variant Grape (L425). #340 Slapwoods singles shows 'SWEET BANANA', variant Russian cream (L701). #358 Life Savers Gummies share size shows the '5 FLAVORS' pack, variant Wildberry (L737). On multi-variant rows the photo shows only unlisted flavors: #84 Good Times Flat Wraps shows Watermelon, Grape, Mango-licious, Cherry, Peach and Sour Apple, while the variants are Natural, Diamond, Vanilla, Fruit punch, Mango, Strawberry kiwi and Chocolate; only Mango overlaps (L189). #186 Charms Blow Pop shows a CHERRY ICE display; variants are Regular, Blue razz, Black cherry, Watermelon, Caramel apple (L393). #44 Mike & Ike shows the Orange box; Orange is not among the…

**Fix:** Make each photo match a listed variant: either replace the photo with one showing a listed flavor/grade/pack, or add the pictured variant to the row (especially single-variant rows).

**Owner must decide or supply:** For each product whose photo shows an unlisted flavor or brand, confirm whether that pictured variant is actually stocked (add it) or provide a correct photo of a listed variant.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/products.js:609`, `src/data/products.js:619`, `src/data/products.js:425`, `src/data/products.js:701`, `src/data/products.js:737`, `src/data/products.js:189`, `src/data/products.js:393`, `src/data/products.js:109`, `src/data/products.js:753`, `src/data/products.js:119`, `src/data/products.js:197`, `src/data/products.js:241`, `src/data/products.js:243`, `src/data/products.js:251`, `src/data/products.js:579`, `src/data/products.js:581`, `src/data/products.js:605`, `src/data/products.js:667`, `src/data/products.js:671`, `src/data/products.js:137`, `src/assets/products/sources/drinks-bags.md:7`

Full details and screenshots: `findings.json` entry AW-142, in this folder.

- [ ] Done

## Visual design system & consistency

### AW-035 · The only logo asset is a 320px JPEG with a white fringe: the wordmark is unreadable in the header, and it is upscaled with a white edge line into the share image and app icons

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Every route → header .aw-logo (also #/ age gate .brand and footer .footer-brand)

**Problem:** The header renders src/assets/logo.jpg, a 320×320 JPG with an orange field (sampled #dc6c3e) and a small white 'Alabama' and purple 'WHOLESALE INC' mark. Measured on the canvas, the artwork fills x43–271 and y114–194 of the 320px source. At the 72px render size the mark is about 51×18px, so the 'WHOLESALE INC' line is about 4px tall and can't be read (see home-logo-zoom.png). On phones the tile is 48px and the mark is about 3px. The JPG has a 3–4px near-white frame on the left, right and bottom edges (edge pixels #fcffff/#fffffd) but none at the top. The tile orange #dc6c3e matches none of the tokens (--orange #ed5a21, --button-orange #c84716) and sits next to the #c84716 'Sign Up' button. The age gate (App.jsx:366) and the footer (App.jsx:1314) use a completely different text wordmark: DM Sans 46px/26px orange 'Alabama' with 'WHOLESALE INC.' below it and no swoosh. The brand therefore…

**Fix:** Create or obtain a vector (SVG) master of the logo with a transparent background. Use it for the header .aw-logo, the age gate .brand and the footer brand, sized so the wordmark is legible (App.jsx:366, 456-457). Regenerate og.jpg, icon-192.png, icon-512.png and apple-touch-icon.png from the vector master in scripts/build-images.mjs:176-208 with no white edge.

**Owner must decide or supply:** Supply a vector (SVG) master of the Alabama Wholesale logo with a transparent background.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:456`, `src/App.jsx:457`, `src/App.jsx:366`, `src/App.jsx:1314`, `src/data/theme.js:9`, `src/index.css:88`, `src/index.css:513`, `src/index.css:532`, `src/index.css:605`, `src/index.css:424`, `src/index.css:425`, `src/index.css:499`, `src/index.css:500`, `src/assets/logo.jpg`, `scripts/build-images.mjs:31`, `index.html:11`, `src/App.jsx:447`, `src/index.css:87`, `scripts/build-images.mjs:176-208`, `index.html:23-27`, `public/site.webmanifest:9-12`, `scripts/build-images.mjs:180`, `scripts/build-images.mjs:181`, `scripts/build-images.mjs:199`, `scripts/build-images.mjs:201`, `scripts/build-images.mjs:204`, `scripts/build-images.mjs:206`

Full details and screenshots: `findings.json` entry AW-035, in this folder.

- [ ] Done

## Security, backend & data boundaries

### AW-050 · Nobody is notified when a quote or order is saved, so orders sit unseen until someone opens #/admin

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/quote submit → 'A trade desk rep will reach out within one business day'; backend order pipeline

**Problem:** submit_quote only inserts rows and returns JSON. The repo has no supabase/functions directory, database webhook, pg_net call, email trigger or Netlify function, and BACKEND.md has no notification step. The customer receives no email receipt with the reference, and staff receive no alert. The confirmation page still promises contact 'within one business day' (App.jsx:1222), and the Admin Orders tab only loads when an admin visits it. Prior audit item 8 asked to 'verify staff/customer notifications'. The atomic save and server-generated receipt are now in place, but notification is still missing.

**Fix:** Add a notification when submit_quote saves an order (Supabase database webhook or Edge Function sending email/SMS to the trade desk, plus an optional buyer confirmation email), so the 'rep will reach out within one business day' promise is backed (launch_order_boundaries.sql:149-253).

**Owner must decide or supply:** Which email address or phone number should receive new quote/order notifications, and which email/SMS provider account should send them?

**Files (lines are from before the refactor — search, don't trust line numbers):** `supabase/migrations/20260925120000_launch_order_boundaries.sql:149`, `src/App.jsx:1222`, `BACKEND.md:78`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:149-253`, `index.html:59-91`, `README.md:26`

Full details and screenshots: `findings.json` entry AW-050, in this folder.

- [ ] Done

### AW-051 · Backend setup never configures a production email sender, so confirmation and password-reset emails will not reach customers

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Apply for a trade account → 'Check your inbox'; Sign in → Forgot password? → 'Check your inbox'

**Problem:** The signup flow depends on the confirmation email (AuthModal.jsx:173, 286), and password reset depends on the reset email (useAuth.js:93-97). BACKEND.md covers env vars, Site URL and the redirect allow-list, but never covers custom SMTP, sender domain (SPF/DKIM), auth rate limits or email templates. It even suggests turning confirmation off (BACKEND.md:80-83). Supabase's built-in sender only delivers to members of the project's team ('Email address not authorized' for everyone else) and is limited to about 2 messages per hour (https://supabase.com/docs/guides/auth/auth-smtp). If the project still uses the default sender, real applicants never get a confirmation link and resets never arrive. The UI still says the email is on its way. signUp also passes no `emailRedirectTo`, so confirmation links always go to the Site URL. The dashboard settings could not be inspected in this review.

**Fix:** Add a 'Production email' section to BACKEND.md. Steps: configure custom SMTP (Resend, Postmark or SES) under Authentication → Emails → SMTP Settings, with a sender on the business domain and SPF/DKIM records. Raise 'Rate limit for sending emails' under Authentication → Rate Limits to a sensible value (e.g. 100/hour). Keep 'Confirm email' ON in production and state that it must not be disabled outside a test project. Customise the Confirm signup and Reset password templates with the business name. In src/lib/useAuth.js signUp, add `emailRedirectTo: `${window.location.origin}/`` inside `options`, and add the production and deploy-preview origins to the redirect allow-list.

**Owner must decide or supply:** Set up an SMTP provider (Resend, Postmark or SES) with a sender address on your business domain and SPF/DKIM records, then enter it in the Supabase Auth settings along with the production and deploy-preview redirect URLs.

**Files (lines are from before the refactor — search, don't trust line numbers):** `BACKEND.md:74`, `BACKEND.md:80`, `src/lib/useAuth.js:67`, `src/lib/useAuth.js:95`

Full details and screenshots: `findings.json` entry AW-051, in this folder.

- [ ] Done

### AW-206 · Trade signup has no bot protection (no CAPTCHA or honeypot), and password strength is enforced only in the browser

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Apply for a trade account dialog (AuthModal signup form); Supabase Auth settings

**Problem:** Live DOM of the Apply dialog (#/apply → Start application): inputs name, organization, email, tel, new-password, business_type, ein, state, license_no, resale_cert_no, tobacco_license (file), resale_certificate (file) and expected_volume. There are 0 iframes, no captcha/turnstile/hcaptcha/recaptcha markup outside the dead Netlify forms, and no hidden or honeypot input. supabase.auth.signUp is called without options.captchaToken (useAuth.js:67-73). The public /auth/v1/settings shows disable_signup:false, so self-signup is open. Supabase's default per-IP rate limits slow a single-IP flood, but a distributed bot can still create many pending profiles. Each profile lands in the unfiltered Accounts tab (AdminPage.jsx:141, 193) and, once confirmed, can upload files. The password minimum of 8 exists only in the browser: minLength at AuthModal.jsx:246 and the JS check at…

**Fix:** 1) In Supabase → Authentication → Attack Protection, enable CAPTCHA with Cloudflare Turnstile. 2) Add a small <Turnstile> wrapper component that loads https://challenges.cloudflare.com/turnstile/v0/api.js and returns a token via callback. Render it in all three AuthModal forms: sign-in (AuthModal.jsx:190-205), signup (:231-279) and reset (:323-334). Keep each submit button disabled until a token exists, and reset the widget after every attempt. 3) In src/lib/useAuth.js pass `options: { captchaToken }` to signInWithPassword (line 80), signUp (line 67, merged with the existing options.data) and resetPasswordForEmail (line 95, alongside redirectTo). 4) If you adopt the CSP from AW-205, add https://challenges.cloudflare.com to script-src and frame-src. 5) Under Authentication → Providers → Email, set the minimum password length to 8 (matching the UI) and enable leaked-password protection if the plan allows it. Configure custom SMTP so confirmation emails are not throttled by the built-in sender. 6) Add a 'Security settings' checklist to BACKEND.md §5 (around line 78) covering CAPTCHA, password length, rate limits and SMTP.

**Owner must decide or supply:** Create a Cloudflare Turnstile site, enable CAPTCHA in Supabase Authentication > Attack Protection with its secret key, and give Cursor the public site key.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/components/AuthModal.jsx:231`, `src/components/AuthModal.jsx:246`, `src/lib/useAuth.js:67`, `BACKEND.md:78`

Full details and screenshots: `findings.json` entry AW-206, in this folder.

- [ ] Done

## Launch readiness & engineering lifecycle

### AW-052 · The production domain hard-coded across the site, alabamawholesaleinc.com, is not registered

**High** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** index.html <head> (canonical, og:url, og:image, twitter:image, JSON-LD); /robots.txt; /sitemap.xml; BACKEND.md Supabase Auth 'Site URL' step

**Problem:** Checked 2026-09-28. `dig alabamawholesaleinc.com A` and `dig www.alabamawholesaleinc.com A` both return NXDOMAIN, and `whois -h whois.verisign-grs.com alabamawholesaleinc.com` returns 'No match'. The domain is hard-coded 17 times: index.html:9, 22, 23, 29, 38, 39 (6), public/robots.txt:4 (1) and public/sitemap.xml:3-12 (10). Nothing in src/, scripts/ or supabase/ uses it. og:image and twitter:image (index.html:23, 29) point at a host that does not resolve, so a shared link currently shows no preview image, and the JSON-LD url and image (38-39) point there too. signUp (src/lib/useAuth.js:67-73) passes no emailRedirectTo, so confirmation links go to whatever the Supabase Site URL is. BACKEND.md:74-76 says to set that URL to 'the production domain', and supabase-js's default implicit flow returns access_token/refresh_token in the URL fragment. Evidence:…

**Fix:** (1) Before launch, register alabamawholesaleinc.com (or decide the final domain) and add it in Netlify → Domain management as the primary domain with HTTPS. Add the www variant, and add a netlify.toml redirect `[[redirects]] from = "https://www.alabamawholesaleinc.com/*" to = "https://alabamawholesaleinc.com/:splat" status = 301 force = true`. (2) Set the Supabase Auth Site URL only after the domain resolves to the Netlify site; until then use the Netlify *.netlify.app URL. (3) Stop hard-coding the domain: add `VITE_SITE_URL` to .env.example and the Netlify env, and replace the literal in index.html:9,22,23,29,38,39 with `%VITE_SITE_URL%`, which Vite substitutes in index.html. Generate public/robots.txt and public/sitemap.xml from that variable in a small build script instead of committing literals. (4) In src/lib/useAuth.js signUp options (line 70), add `emailRedirectTo: `${window.location.origin}/``, so confirmation links return to the origin the applicant used, which must be allow-listed.

**Owner must decide or supply:** Register alabamawholesaleinc.com (or tell us the final production domain) and connect it in Netlify, so Cursor can set VITE_SITE_URL and replace the hard-coded domain.

**Files (lines are from before the refactor — search, don't trust line numbers):** `index.html:9`, `index.html:22`, `index.html:23`, `index.html:29`, `index.html:38`, `public/robots.txt:4`, `public/sitemap.xml:3`, `BACKEND.md:74`, `src/lib/useAuth.js:67`

Full details and screenshots: `findings.json` entry AW-052, in this folder.

- [ ] Done

### AW-210 · No analytics, conversion events, error reporting or uptime alerts: the owner cannot see traffic, quote conversions, production crashes or a paused backend

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** All routes: index.html, src/main.jsx, src/App.jsx route effect / quote submit / add-to-quote / age gate, src/components/AuthModal.jsx application submit, 26 tel:/mailto: links

**Problem:** A grep of index.html, src/, public/ and netlify.toml for gtag, googletagmanager, plausible, sentry, posthog, umami, fathom, onerror, unhandledrejection and sendBeacon finds nothing. The only runtime log is `console.warn('profile load failed', error)` at src/lib/useAuth.js:56. The quote-submit catch at src/App.jsx:1199-1202 ignores `err` except for err.code and shows a generic message. The AuthModal sign-in catch (:99), sign-up catch (:125) and reset catch (:133) pass err to describeError() for on-screen text, but never log or report it. src/main.jsx:6-10 has no error hook. There are 26 tel:/mailto: links across 7 files (App.jsx 11, AuthModal 3, ContactPage 4, SupportShell 4, ServiceUnavailable 2, DocumentUploads 1, ApplyPage 1), and none is tracked. vite.config.js:10-21 sets no sourcemap, and package.json:4 is 1.0.0. The hash router means an automatic pageview sees only '/'.

**Fix:** (1) Create src/lib/telemetry.js with three exports. `track(name, props)` is a no-op until age verified and only allows the whitelisted props below. `reportError(err, context)`. `routeTemplate(route)` returns '/', '/catalog', '/category/:dept', '/category/:dept/:sub', '/product/:id', '/quote', '/account', '/admin' or '/<support page>', and never reads location.hash. (2) Choose a cookieless, first-party analytics tool (Plausible, self-hosted Umami, or Cloudflare Web Analytics). Turn off its automatic pageviews and hash mode. Do not add Meta Pixel or Google Ads remarketing tags: those platforms prohibit promoting tobacco and e-cigarettes, and this is a 21+ tobacco/vape catalog. Load the script from App.jsx only after `verified` is true (App.jsx:282). Never send email, business name, phone, EIN, license, resale certificate, address or Notes text in event props. (3) Wiring: • src/main.jsx before line 6: init error reporting, e.g. Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, release: import.meta.env.VITE_COMMIT_REF, sendDefaultPii: false, beforeSend scrubs `access_token|refresh_token` from event.request.url }). Or add window 'error' + 'unhandledrejection' listeners that sendBeacon to a Netlify Function. Also add one delegated capture listener: document.addEventListener('click', e => { const a = e.target.closest('a[href^="tel:"],a[href^="mailto:"]'); if (a) track(a.href.startsWith('tel:') ? 'call_click' : 'email_click', { page: current route template }); }, true). This one listener covers all 26 links. • App.jsx:197–205 route effect: track('pageview', { path: routeTemplate(shown) }). • App.jsx:265 handleAgeYes → track('age_verified'); App.jsx:282 onNo → track('age_gate_declined'). • App.jsx:239 addLine → track('add_to_quote', { dept: product.cat }). • App.jsx:274–275 openSignup/openApplication → track('application_started', { entry }) (pass an entry label from each caller). • AuthModal.jsx:121–122 → track('application_submitted', { confirmEmail: !data?.session, docs: chosen }); AuthModal.jsx:125 → reportError(err, { where: 'signup' }); AuthModal.jsx:99 → reportError. • App.jsx:1197 → track('quote_submitted', { lines: items.length, units: totalUnits, buyer: isApprovedBuyer ? 'approved' : 'guest', delivery: data.delivery }); App.jsx:1199 → reportError(err, { where: 'submit_quote', ref: refNum }) and track('quote_failed'). • useAuth.js:56 → reportError. • The known error boundary's componentDidCatch → reportError. (4) vite.config.js build: add `sourcemap: 'hidden'`, upload the maps from CI, and `define: { 'import.meta.env.VITE_COMMIT_REF': JSON.stringify(process.env.COMMIT_REF || 'dev') }` (Netlify sets COMMIT_REF). (5) Add an external uptime monitor (e.g. UptimeRobot or Better Stack) on the site URL and on `${VITE_SUPABASE_URL}/rest/v1/products?select=id&limit=1` with the anon key, alerting the owner. Or move the Supabase project to Pro so it never pauses. (6) Update the privacy policy: in src/pages/support/PolicyPage.jsx:43–47 add a 'Site usage and error data (pages viewed, buttons used, device/browser, error reports); no advertising cookies' bullet. In :49–53 add 'To measure how the site is used and fix errors', naming the analytics and error-monitoring vendors and their retention.

**Owner must decide or supply:** Which cookieless analytics service (Plausible, Umami or Cloudflare Web Analytics), error-reporting service and uptime monitor do you want, and can you create those accounts and supply the site IDs/DSNs?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/main.jsx:6`, `src/App.jsx:197`, `src/App.jsx:239`, `src/App.jsx:265`, `src/App.jsx:274`, `src/App.jsx:282`, `src/App.jsx:1197`, `src/App.jsx:1199`, `src/components/AuthModal.jsx:121`, `src/components/AuthModal.jsx:125`, `src/lib/useAuth.js:56`, `src/pages/support/PolicyPage.jsx:43`, `vite.config.js:10`

Full details and screenshots: `findings.json` entry AW-210, in this folder.

- [ ] Done

### AW-213 · The backend deploy runbook has no backup, rollback, migration tracking or deploy order, its redirect list is incomplete, and previews share the production database

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** BACKEND.md sections 2 (migrations), 4 (Netlify env), Auth URL configuration, 'Resetting'; supabase/ (no config.toml)

**Problem:** (a) No backup or plan guidance. BACKEND.md:10–13 just says 'create a new project'. The Supabase pricing page says Free projects have no automatic backups ('Not included'; Pro has 7 days) and are 'paused after 1 week of inactivity'. The only recovery step is 'Resetting: drop schema public cascade' (BACKEND.md:129–135), which deletes every order, profile and document row. (b) Rollback is a trap. 20260925120000_launch_order_boundaries.sql:258–262 drops the insert policies and revokes INSERT on orders/order_items. A frontend built before commit 4609eac, such as the current origin/main head f858342, inserts into orders directly (origin/main:src/lib/orders.js:9–24). 'Publish deploy' on an older Netlify deploy would therefore break every quote, and no down-migration exists. (c) No migration tracking. There is no supabase/config.toml, and migrations are pasted into the SQL editor, so nothing…

**Fix:** Add a 'Release checklist' section to BACKEND.md, and make these changes: (1) Plan: run production on Supabase Pro (daily backups, no pausing) before taking real orders or license documents. Before every migration, take `supabase db dump -f backups/$(date +%F).sql`, or a pg_dump with the connection string, and keep it off-repo. (2) Tracking: run `supabase init` (commits supabase/config.toml) and `supabase link --project-ref <ref>`. Mark the six applied files with `supabase migration repair --status applied 20260517000000 20260517000001 20260925120000 20260927000000 20260927120000 20260927180000`. From then on, apply with `supabase db push` and never edit a migration that has shipped; add a new file instead. (3) Order: 'Apply new migrations to production first, verify with a smoke test, then merge/deploy the frontend.' (4) Rollback: 'Frontend rollback via Netlify → Deploys → Publish deploy is only safe to deploys built at or after the latest applied migration (currently commit 4609eac or later). A database rollback means restoring the pre-migration dump.' For each future migration, add a commented reverse-SQL block at the bottom. (5) Auth URLs: allow-list http://localhost:3000/**, http://127.0.0.1:3000/**, https://<site>.netlify.app/**, https://deploy-preview-*--<site>.netlify.app/** and the www and apex production URLs. (6) Environments: create a separate staging Supabase project. In Netlify, set VITE_SUPABASE_URL/ANON_KEY per context (Production = prod project; Deploy Previews and Branch deploys = staging) instead of 'All'. (7) Owner step: before opening signups, run `select id, email, role, status, created_at from public.profiles where role = 'admin';` and demote any account that isn't the owner. (8) Replace the 'Resetting' block with a warning that it destroys all orders and profiles, and require a dump first.

**Owner must decide or supply:** Will you upgrade production to Supabase Pro (backups, no pausing) and create a separate Supabase project for Netlify preview deploys, and who holds the project ref and backup storage location?

**Files (lines are from before the refactor — search, don't trust line numbers):** `BACKEND.md:10`, `BACKEND.md:18`, `BACKEND.md:48`, `BACKEND.md:67`, `BACKEND.md:74`, `BACKEND.md:129`, `supabase/migrations/20260517000000_initial_schema.sql:7`, `supabase/migrations/20260517000001_rls_policies.sql:19`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:258`, `src/lib/useAuth.js:95`

Full details and screenshots: `findings.json` entry AW-213, in this folder.

- [ ] Done

## Cart, quote/checkout & quick reorder

### AW-076 · The $500 minimum is stated three times but never enforced, and checkout says 'You can still submit this order', even directly above a disabled Submit button

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/quote page intro, notice above submit, fine print; cart drawer fine print

**Problem:** The quote page says 'The minimum order is $500.00' in the intro (App.jsx:1239) and the fine print (App.jsx:1298). For approved buyers below $500, it also shows 'The order minimum is $500.00. You can still submit this order.' (App.jsx:1292), which contradicts the word 'minimum'. submit_quote has no minimum check. Guests are told the minimum is $500 but see no subtotal ('Pricing after sign-in'), so they cannot tell whether their quote qualifies. The drawer and checkout copy hard-code '$500.00' and '$1,500' strings instead of using ORDER_MINIMUM / FREE_DELIVERY_THRESHOLD from content.js, which DeliveryPage/PolicyPage already use.

**Fix:** Choose one minimum-order policy and make every piece of copy agree with it (App.jsx:107, 743, 1239, 1292-1297, and the cart drawer fine print). If the minimum is enforced: when pricedBelowMinimum, disable submit and show 'Add $X more to reach the $500 minimum', and enforce the same rule in submit_quote on the server. If it is only a guideline: say so once, clearly. In both cases, remove the 'You can still submit this order' sentence. Never show a 'you can submit' notice while the button is disabled (needsVariant, or backend unavailable). Show the actual reason the button is blocked next to it instead.

**Owner must decide or supply:** Is the $500 minimum order a hard rule that blocks submission, or only a guideline that orders below it may still be submitted?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:107`, `src/App.jsx:743`, `src/App.jsx:1239`, `src/App.jsx:1292`, `src/App.jsx:1298`, `src/App.jsx:1375`, `src/App.jsx:1436`, `src/data/content.js:20`, `src/data/content.js:45`, `src/data/content.js:52`, `src/data/content.js:61`, `src/data/content.js:65`, `src/data/content.js:110-111`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:231-241`, `src/pages/support/DeliveryPage.jsx:40`, `src/App.jsx:1294`, `src/App.jsx:1296-1297`, `src/App.jsx:1250-1253`

Full details and screenshots: `findings.json` entry AW-076, in this folder.

- [ ] Done

## Sign-in, trade application, account & admin (signed out)

### AW-088 · Approving an account sends nothing, although every screen promises 'we'll contact you when approved'

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/admin Approve; copy in the auth modal, #/apply and #/account

**Problem:** AdminPage.jsx:249-253 'Approve' → updateProfile(p.id, { status: 'approved' }) only. The repo has no supabase/functions, no netlify/functions and no webhook migration. The admin table doesn't even show the applicant's phone (see AW-017), so a rep has no prompt or context to make the promised call. Applicant copy: AuthModal.jsx:183 and ApplyPage.jsx:75 ('will contact you at {email} when … approved'); AuthModal.jsx:288 ('We’ll contact you at {email} or {phone}'). Home, App.jsx:786: 'You'll get price-list access by email.' No price list exists; approved buyers see prices on the site.

**Fix:** Either add a Supabase Database Webhook / Edge Function (supabase/functions/account-approved) on UPDATE of profiles where status changes to 'approved' that emails the applicant ('Your Alabama Wholesale trade account is approved — sign in to see pricing'), or, until that exists, render a mailto: link beside 'Approve' prefilled with that message, and change the customer copy to 'A trade rep will call or email you'. Remove 'price-list access by email' from App.jsx:786.

**Owner must decide or supply:** Should approvals send an automatic email, which needs an email provider or SMTP set up in Supabase, or will a trade rep call or email each approved applicant by hand?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/admin/AdminPage.jsx:249`, `src/components/AuthModal.jsx:183`, `src/components/AuthModal.jsx:288`, `src/pages/support/ApplyPage.jsx:75`, `src/App.jsx:786`

Full details and screenshots: `findings.json` entry AW-088, in this folder.

- [ ] Done

### AW-246 · Approval-time and verification claims disagree across the site

**Low** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Auth modal, home 'Become a retail account', FAQ, #/account pending notice

**Problem:** Visible copy: AuthModal.jsx:172 'Most applications are approved within one business day'; AuthModal.jsx:173 'a trade rep will verify your license within one business day'; AccountPage.jsx:93 'will verify your retail license and activate pricing within one business day' (unconditional); App.jsx:786 'checks your license with the state and approves most accounts within one business day. You'll get price-list access by email.' That last line conflicts with AuthModal.jsx:183, ApplyPage.jsx:75 and ApplyPage.jsx:54 ('Wholesale pricing and ordering unlock at that point' / 'wholesale pricing and checkout unlock'). content.js:57-63 (FAQS: '24 hours', 'retail business license… tobacco permit') is exported but never imported or rendered, so it is stale data that will drift further.

**Fix:** 1) Once the owner confirms the approval time, add `export const APPROVAL_TIME = 'one business day';` to src/data/onboarding.js and use it in AuthModal.jsx:172-173, AccountPage.jsx:93 and App.jsx:786. Phrase all of them the same way ('Most applications are approved within ${APPROVAL_TIME}'). 2) Rewrite App.jsx:786 as: 'A trade rep checks your EIN, tobacco license and resale certificate and approves most accounts within one business day. Wholesale pricing and ordering unlock when you sign in.' 3) Delete the unused FAQS export at content.js:57-72. If an FAQ section is added later, rewrite its answers to match the form: EIN, state retail tobacco license #, resale certificate #, optional document uploads, and APPROVAL_TIME.

**Owner must decide or supply:** How long does trade-account approval actually take (e.g. 'one business day'), so one approval-time phrase can be used everywhere on the site?

**Owner decision (overrides the fix above):** keep these product lines and claims exactly as they are for now. Do not delist, hide, rename, re-file or reword them. Only add `TODO(owner)` markers and `docs/OWNER-TODO.md` rows where they're missing, and build any code that doesn't change what customers see.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/App.jsx:786`, `src/pages/account/AccountPage.jsx:93`, `src/components/AuthModal.jsx:172`, `src/components/AuthModal.jsx:173`, `src/data/content.js:57`

Full details and screenshots: `findings.json` entry AW-246, in this folder.

- [ ] Done

## Onboarding & password-recovery states

### AW-093 · Sign-up confirmation and password-reset email content isn't in the repo and is probably Supabase's unbranded default: no Alabama Wholesale name, logo, phone or next steps

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Transactional email: 'Apply for an account' → Submit application → confirmation email; Sign in → Forgot password? → reset email

**Problem:** supabase/ has only migrations/ and seed/; there is no config.toml and no templates/ directory. BACKEND.md:74-83 never mentions email templates ('You'll get a confirmation email from Supabase.'). The public auth settings (GET /auth/v1/settings) show mailer_autoconfirm=false, so every applicant receives a confirmation email and signUp returns no session. src/lib/useAuth.js:67-73 calls auth.signUp without emailRedirectTo; :95 sets the reset redirect to `${origin}/`. Unless someone edited the templates in Dashboard → Authentication → Emails, applicants get Supabase's stock 'Confirm your signup' / 'Reset your password' email. That email has no business name, logo, phone, hours, 21+/licensed-only line, expiry or next steps (trade review, uploading documents on #/apply). This contradicts the dialog's 'We sent a confirmation link to …' framing. An unbranded reset email reads like phishing.…

**Fix:** Apply the original fix (supabase/templates/confirmation.html and recovery.html with the header/footer shell, supabase/config.toml [auth] site_url / additional_redirect_urls / [auth.email] otp_expiry / [auth.email.template.*] subject + content_path, the same HTML and subjects pasted into Dashboard → Authentication → Emails → Templates, and the BACKEND.md update), with these corrections. (a) In the confirmation template's 'What happens next' step 2, replace 'open Trade account' with a direct link: <a href='https://alabamawholesaleinc.com/#/apply' style='color:#281459'>upload your license and resale certificate</a>. #/apply is the only page with the upload panel, and the header has no 'Trade account' item. (b) Keep `emailRedirectTo: `${window.location.origin}/?welcome=confirmed`` in useAuth.js signUp options (line 70), add the URL to the redirect allow list, and build the landing state under the known 'no landing state after confirming' finding rather than here. (c) Take the phone, address and hours in the template footer from src/data/content.js COMPANY ((205) 354-4473; 613 Graymont Ave N, Birmingham, AL 35203; Mon–Fri 7:00 AM – 6:00 PM, Sat–Sun 8:00 AM – 5:30 PM), and note in BACKEND.md that the template footer must be updated whenever COMPANY changes.

**Owner must decide or supply:** Confirm the production site URL (alabamawholesaleinc.com) and the sender name/logo for the emails, and agree to paste the branded confirmation and reset templates Cursor writes into Supabase Dashboard > Authentication > Emails.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/lib/useAuth.js:67`, `src/lib/useAuth.js:95`, `BACKEND.md:74`, `BACKEND.md:81`

Full details and screenshots: `findings.json` entry AW-093, in this folder.

- [ ] Done

### AW-099 · After both documents upload, the panel still says 'Optional … or send proof later': no 'received' summary, no way to open the uploaded file, and staff aren't notified

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/apply (signed in, pending) → status panel and 'License documents' panel after both files upload; also the dialog 'status' step after a sign-up that uploaded files

**Problem:** #/apply, pending profile, 1440x900, uploads mocked 200. After both files upload, only the two per-file lines change, to 'Uploaded on September 28, 2026 · QA-ONLY-license.pdf' and '… · QA-ONLY-resale.pdf' (12px, weight 400, rgb(36,32,44), no success styling). The panel still reads 'WHILE YOUR APPLICATION IS PENDING | License documents | OPTIONAL DOCUMENTS | Upload your state retail tobacco license and resale certificate now, or send proof later to …', with ' Optional' after both labels. The status panel still reads 'A trade rep is reviewing your license information…'. The panel's only link is the email address; createDocumentViewUrl (documents.js:157) is used only by admin. supabase/migrations/20260927180000_application_documents.sql has no trigger or webhook on profile_documents.

**Fix:** In ApplicationDocuments (DocumentUploads.jsx) compute `const have = DOCUMENT_TYPES.filter(d => records?.some(r => r.document_type === d.id)).length;`. Above <DocumentFields> render <p className="doc-summary" role="status">{have === 2 ? 'Both documents received. A trade rep will check them with your application; nothing else is needed.' : have === 1 ? '1 of 2 documents received.' : 'No documents yet. Uploading them now speeds up approval.'}</p>. In DocumentFields, when showStatus is true, omit the ' Optional' span (line 63) and replace the note at line 42 with 'Uploading a new file replaces the one on file.'. When showStatus && record, render a 'View' text-link button after the status text: onClick={async () => { const url = await createDocumentViewUrl(record.storage_path); if (url) window.open(url, '_blank', 'noopener'); }}. Add CSS after index.css:803: `.doc-status[data-document-status=uploaded] { font-weight: 600; color: var(--purple); } .doc-status[data-document-status=uploaded]::before { content: '✓ '; }`. Skip the AuthModal status-step change: it's unreachable while email confirmation is on. For staff: add a Supabase Database Webhook (Dashboard → Database → Webhooks) on INSERT and UPDATE of public.profile_documents that POSTs to a new Edge Function `notify-trade-desk`, which emails the trade desk the business name and document type. Build it so the same function can later serve the known order-notification finding.

**Owner must decide or supply:** Which staff email address (or channel) should be notified when an applicant uploads license documents, and how quickly will a trade rep review them?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/components/DocumentUploads.jsx:41`, `src/components/DocumentUploads.jsx:42`, `src/components/DocumentUploads.jsx:63`, `src/components/DocumentUploads.jsx:77`, `src/components/DocumentUploads.jsx:160`, `src/pages/support/ApplyPage.jsx:74`, `src/lib/documents.js:157`, `src/index.css:803`, `supabase/migrations/20260927180000_application_documents.sql:22`

Full details and screenshots: `findings.json` entry AW-099, in this folder.

- [ ] Done

## Support pages (contact, delivery, policies, apply, catalog index)

### AW-123 · The service-area check only asks for a state, with no ZIP or route lookup, so it answers nothing the page does not already say

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/delivery → 'Is my store in the service area?' form

**Problem:** The form is a single state <select> (DeliveryPage.jsx:51-73). Choosing Alabama returns 'We run delivery routes in Alabama. Routes don’t reach every address. Call (205) 354-4473 to confirm your stop…', which repeats the page intro. There is no ZIP or city input, no route map, no list of served cities or counties, and no delivery day per route. The 'Route states' block shows only three chips (AL, MS, GA). The previous audit (#12) asked for a ZIP-based eligibility check tied to actual routes.

**Fix:** Add a ZIP input (type='text', inputMode='numeric', maxLength 5, autoComplete='postal-code') above the state select. Add ROUTE_ZIPS to src/data/onboarding.js as a map from ZIP (or 3-digit prefix) to { route, days, cutoff }, with the data supplied by the owner. Render three outcomes: 'On our {route} route, deliveries {Tue & Fri}, order by {cutoff} for next-day'; 'Near a route, call to confirm'; 'Not on a route, will-call pickup in Birmingham is available'. Keep the state select as a fallback. Under 'Route states' add the list of cities or counties served.

**Owner must decide or supply:** Which ZIP codes or 3-digit prefixes are on each delivery route, and what are each route's delivery days and order cutoff time, plus the list of cities/counties served?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/support/DeliveryPage.jsx:45-74`, `src/pages/support/DeliveryPage.jsx:86-96`, `src/data/onboarding.js:13-22`

Full details and screenshots: `findings.json` entry AW-123, in this folder.

- [ ] Done

### AW-124 · The Contact page has no map, warehouse photo or practical will-call instructions

**Medium** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/contact → VISIT card and 'Pick up at the warehouse' block

**Problem:** #/contact is text only: three beige cards and two text columns, with no image anywhere on the page. The VISIT card has only the address and a 'Get directions ↗' link to Google Maps. The will-call block says 'Order ahead online or by phone, then collect your order…'. It does not say how far ahead to order, whether to wait for a ready call, where to park or which door or dock to use, how to pay at pickup, or that tobacco and vapor pickups need 21+ ID. The previous audit (#12) asked for a Contact/Visit page with warehouse photographs.

**Fix:** In the VISIT card (ContactPage.jsx:33-38), add a warehouse-front photo via the <Picture> component (a new asset in src/assets), or a static map image stored locally and linked to DIRECTIONS_URL, with meaningful alt text. In the will-call block (lines 53-62), replace the paragraph with a <ul> of: 'Order at least {N} hours ahead; we call when it’s ready', 'Entrance and parking: {details}', 'Bring your order reference and a 21+ photo ID for tobacco and vapor orders', 'Payment at pickup: {methods}'.

**Owner must decide or supply:** Please supply a warehouse-front photo (or approve a static map), plus how many hours ahead will-call orders must be placed, entrance/parking details, and accepted payment methods at pickup.

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/support/ContactPage.jsx:33-38`, `src/pages/support/ContactPage.jsx:53-62`

Full details and screenshots: `findings.json` entry AW-124, in this folder.

- [ ] Done

### AW-272 · The Apply page gives no approval timeframe and no credit-terms information

**Low** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/apply → 'Three steps to wholesale pricing' step 2

**Problem:** Step 2 on #/apply says 'A trade rep reviews the application and checks your license and resale certificate. Your account shows as pending until then' but gives no timeframe. The home page says 'approves most accounts within one business day' (App.jsx:786) and the dialog says 'Most applications are approved within one business day' (AuthModal.jsx:172). Net-30 or credit application steps are not mentioned, although the site advertises them.

**Fix:** Append 'Most applications are reviewed within one business day.' to step 2 in ApplyPage.jsx:53, using the owner-confirmed figure. If Net-30 is real, add a 4th item or a note: 'Want Net-30? Ask your trade rep for a credit application after approval.'

**Owner must decide or supply:** What approval timeframe should the Apply page promise, and do you offer Net-30 credit terms to approved accounts?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/support/ApplyPage.jsx:52-54`

Full details and screenshots: `findings.json` entry AW-272, in this folder.

- [ ] Done

### AW-277 · Policy dates are month-only, and the Delivery policy has no date at all

**Low** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** #/privacy, #/terms 'Last updated'; #/shipping (none)

**Problem:** UPDATED = 'September 2026' (PolicyPage.jsx:9), so there is no day, although Terms says 'the new version is posted here with an updated date'. POLICIES.shipping has no 'updated: true' (PolicyPage.jsx:14-18), so the delivery policy shows no date.

**Fix:** Give each policy its own ISO date (for example updated: '2026-09-27') and render <time dateTime={policy.updated}>September 27, 2026</time> at line 128. Add updated to POLICIES.shipping, or to #/delivery if the pages are merged.

**Owner must decide or supply:** What exact effective or last-updated date should each policy (Privacy, Terms, Delivery/Shipping) show?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/pages/support/PolicyPage.jsx:9`, `src/pages/support/PolicyPage.jsx:14-18`, `src/pages/support/PolicyPage.jsx:128`

Full details and screenshots: `findings.json` entry AW-277, in this folder.

- [ ] Done

### AW-279 · No FAQ anywhere in support; the FAQ data is unused and contradicts the live pages

**Low** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** Support area (no FAQ route/section); src/data/content.js exports

**Problem:** FAQS (content.js:57-74), TRUST, WELCOME_OFFERS, SHOP_CATS and BRANDS are exported but never imported; App.jsx:4 imports only COMPANY, ANNOUNCEMENTS, STORAGE, HERO_SLIDES and ORDER_MINIMUM. No support page answers common questions. The dormant FAQ text also conflicts with the live pages: 'approved within 24 hours' vs 'one business day'; requires 'a valid retail business license' vs the #/apply checklist (EIN, tobacco license, resale certificate); 'discount is applied automatically at checkout'. SHOP_CATS counts (Candies 57, Food Stuff 25) differ from the live 58 and 24.

**Fix:** 1. Rewrite FAQS in content.js:57-74 to match the live pages: 'one business day'; EIN + state retail tobacco license + resale certificate; delete 'The discount is applied automatically at checkout' unless checkout really applies it (App.jsx has no volume-discount logic). Confirm with the owner whether Net-30 is offered, because Terms (PolicyPage.jsx:80) lists only cash, checks and wires.
2. Render the FAQ on #/contact as a 'Common questions' section below the hours/will-call columns: `{FAQS.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}` inside `<section className="support-block" aria-labelledby="faq-title"><h2 id="faq-title">Common questions</h2>…</section>`.
3. Delete the unused SHOP_CATS (26-35), BRANDS (48), TRUST (50-55) and WELCOME_OFFERS (76-101) exports from content.js.

**Owner must decide or supply:** Do you offer Net-30 terms and automatic volume discounts at checkout, and do you approve the rewritten FAQ answers before they go live?

**Files (lines are from before the refactor — search, don't trust line numbers):** `src/data/content.js:26-35`, `src/data/content.js:48-74`, `src/data/content.js:76-101`, `src/App.jsx:4`

Full details and screenshots: `findings.json` entry AW-279, in this folder.

- [ ] Done

## Product photos — Food, Grocery, Motor Oil, Drinks; hero, logo & share images

### AW-288 · The social share image is just the logo on purple and says nothing about the business

**Low** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** public/og.jpg (og:image and twitter:image in index.html)

**Problem:** public/og.jpg is 1200x630 at 11,838 bytes. It is a 400x400 orange logo tile (enlarged from the 308px inset of the 320px logo.jpg) centred on flat #281459, so about 79% of the card is empty purple. There is no tagline, no 'Wholesale distributor for licensed retailers · Birmingham, AL' and no product imagery. og:image:alt (index.html:27) is 'Alabama Wholesale Inc logo'. The same file is the LocalBusiness JSON-LD image (index.html:39). The prior audit's missing-share-image issue is fixed; this is a content problem.

**Fix:** 1. Design a 1200x630 share card: left half, the horizontal logo (vector) plus 'Wholesale distributor for licensed retailers' and 'Birmingham, AL · Delivery in AL, MS, GA' in Barlow Condensed/DM Sans; right half, a warehouse or assortment photo.
2. Commit it as src/assets/og-card.png and change build-images.mjs:203-208 to copy or re-encode it to public/og.jpg instead of compositing the tile.
3. Update og:image:alt at index.html:27 to describe it.

**Owner must decide or supply:** Please supply a licensed warehouse or product-assortment photo, plus a vector copy of the logo, for the 1200x630 social share card.

**Files (lines are from before the refactor — search, don't trust line numbers):** `scripts/build-images.mjs:203`, `scripts/build-images.mjs:204`, `scripts/build-images.mjs:206`, `index.html:23`, `index.html:27`, `index.html:29`, `index.html:39`

Full details and screenshots: `findings.json` entry AW-288, in this folder.

- [ ] Done

## SEO, metadata & performance

### AW-320 · Structured data is a bare LocalBusiness block with no logo, @id, geo, sameAs or breadcrumbs

**Low** · Needs the owner's answer to finish · **Status:** Not started.

**Where:** index.html JSON-LD

**Problem:** The only structured data is one static LocalBusiness object (index.html:33-56). It is valid JSON and its hours and phone match the footer. It uses the generic LocalBusiness type and has no @id, logo, geo, hasMap, sameAs (Google Business Profile, Facebook) or priceRange. Its image is the logo share card. There is no WebSite or Organization node and no BreadcrumbList on any route (routes are hash-based, so none could be emitted per page).

**Fix:** In index.html:33-56 change "@type" to "WholesaleStore". Add "@id": "https://alabamawholesaleinc.com/#business", "logo": "https://alabamawholesaleinc.com/icon-512.png", "hasMap" (Google Maps URL for 613 Graymont Ave N), "geo": {"@type":"GeoCoordinates","latitude":…,"longitude":…} (owner to supply exact coordinates), and "sameAs": [Google Business Profile URL, social profiles]. Add a second node {"@type":"WebSite","url":"https://alabamawholesaleinc.com/","name":"Alabama Wholesale Inc","publisher":{"@id":"https://alabamawholesaleinc.com/#business"}}. After path routing, emit a BreadcrumbList (Home › Department › Sub-line › Product) in each prerendered category and product page.

**Owner must decide or supply:** Please provide the exact latitude and longitude of 613 Graymont Ave N, your Google Business Profile URL and any official social media profile URLs.

**Files (lines are from before the refactor — search, don't trust line numbers):** `index.html:32-56`

Full details and screenshots: `findings.json` entry AW-320, in this folder.

- [ ] Done

# Part 3: The owner's checklist

The same questions, grouped by topic. Send this list to the owner; each answer unblocks the findings in brackets.

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

Also already asked in the code (docs/OWNER-TODO.md):

- AW-340: how long a 21+ confirmation should last (placeholder 30 days), and whether signing out should clear it (it does for now).
