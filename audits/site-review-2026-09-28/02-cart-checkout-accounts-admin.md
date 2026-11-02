# Cart, checkout, accounts & admin

Part of the Alabama Wholesale site review (2026-09-28). Start with [00-START-HERE.md](00-START-HERE.md) for the guardrails and the order to work in.

90 findings. Critical 0, High 14, Medium 44, Low 32. File paths are relative to the repo root `alabamawholesaleinc-2a-editorial/`. Each finding ends with a checkbox; tick it when the fix is in.

**Who** says who can act: **Cursor** can fix it from the finding alone. **Owner → Cursor** needs a decision, fact or asset from the business owner first; Cursor must not invent it, and should leave a `TODO(owner)` where the code depends on the answer.

## Contents

- Cart, quote/checkout & quick reorder (16)
- Sign-in, trade application, account & admin (signed out) (25)
- Onboarding & password-recovery states (19)
- Signed-in buyer views & order confirmation (18)
- Admin back office (12)

## Cart, quote/checkout & quick reorder

#### AW-011 · "Choose variant" on a bare cart line loses the reorder quantity and leaves an unfixable line that blocks checkout

**High** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Cart drawer and #/quote → line with no variant (created by account Reorder / addLines) → 'Choose variant' link → #/product/<id>

**Problem:** Seeded aw-cart {"1":12,"14":2} at 1440×900. (1) The header badge reads 'Cart 14'. The drawer line reads 'Swisher Sweets cigarillos AW-SS · Choose a variant' with a 'Choose variant' link and no quantity. (2) 'Choose variant' closes the drawer and opens #/product/1. All 8 chips have aria-pressed=false, and the page says 'Already in quote: 12'. (3) Choosing Red then 'Add to quote' gives storage {"1":12,"14":2,"1::red":1}, and the badge becomes 15. (4) On #/quote the lines are the bare 'Swisher Sweets cigarillos AW-SS Choose a variant before submitting', Kite ×2 and '— Red AW-SS-RED 1'. The total reads '15 units', the form's submit button is disabled=true, and it shows the alert 'Choose a variant for every product that has more than one.' 'Choose variant' on #/quote opens #/product/1 again, still showing 'Already in quote: 12'. Evidence: screenshots/vcart__drawer-bare-line.jpg, screenshots/vcart__quote-bare-line-blocked.jpg

**Fix:** (a) In src/App.jsx:9, add parseLineKey to the import from './lib/lines.js'. Next to removeLine (App.jsx:262), add `const chooseLineVariant = (bareKey, variant) => setCart(c => { const n = { ...c }; const q = Number(n[bareKey]) || 0; delete n[bareKey]; if (!variant || !(q > 0)) return n; const k = lineKey(parseLineKey(bareKey).productId, variant); n[k] = (Number(n[k]) || 0) + q; return n; });`. Pass it to CartDrawer and QuotePage. (b) In src/lib/lines.js:159-169, add `variants` to the bare-line object. (c) In CartDrawer (App.jsx:1406-1408) and QuotePage (App.jsx:1252-1254), replace the 'Choose variant' button with `<select aria-label={`Choose variant for ${it.name}`} defaultValue="" onChange={e => chooseLineVariant(it.lineKey, e.target.value)}><option value="" disabled>Choose variant…</option>{it.variants.map(v => <option key={v} value={v}>{v}</option>)}</select>`. (d) Change the bare-line <small> text in both places to `${it.qty} units · choose a variant`. (e) In ProductPage (App.jsx:1068), change to `const qty = (choiceRequired && !selected) ? 0 : (cart[key] || 0);` so the bare-line quantity is not shown as 'Already in quote: 12'.

**Files:** `src/App.jsx:248-260`, `src/App.jsx:1066-1068`, `src/App.jsx:1071-1078`, `src/App.jsx:1250-1253`, `src/App.jsx:1406-1408`, `src/lib/lines.js:158-169`, `src/pages/account/AccountPage.jsx:61-71`

**Evidence:** [cart/choose-variant-leaves-bare-line.jpg](screenshots/cart__choose-variant-leaves-bare-line.jpg), [cart/quote-bare-line-blocked.jpg](screenshots/cart__quote-bare-line-blocked.jpg)

- [ ] Done

#### AW-012 · Cart is not cleared after a successful quote/order unless the user clicks 'Back to home', inviting duplicate submissions

**High** · functional-bug · Who: **Cursor** · Effort: S · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/quote → submitted confirmation state

**Problem:** After a mocked successful submit, main shows 'Thank you, ZZ TEST.' with 'Reference number: ALW-Q-MOCK'. document.activeElement is BODY. localStorage aw-cart is still {"14":2,"30":1}, and the header badge still reads 'Cart 3'. After a reload, #/quote shows 'Request your quote' again with both lines and an empty form, ready for a duplicate submit with a new random ref. The confirmation lists no lines, units or subtotal. Evidence: screenshots/vcart__quote-submitted-mock.jpg

**Also seen:**
- #/quote → submitted state — handleQuoteSubmit (App.jsx:1194-1198) sets receipt and step='submitted' but leaves the cart alone. clearCart() runs only in the 'Back to home' button's onClick (App.jsx:1227). If the buyer leaves the thank-you screen any other way (header, logo, browser Back, closing the tab), the cart badge still shows every item. Returning to #/quote remounts QuotePage with step='review' and a new random refNum (line 1173), so the same order can be submitted ag…

**Fix:** Clear the cart (state and localStorage) as soon as submit_quote succeeds, not only when the user clicks 'Back to home', and disable resubmission (App.jsx:1181-1231).

**Files:** `src/App.jsx:1173`, `src/App.jsx:1181-1204`, `src/App.jsx:1194`, `src/App.jsx:1197`, `src/App.jsx:1216-1231`, `src/App.jsx:1227`

- [ ] Done

#### AW-013 · Quantity can only change one unit per tap and has no bounds/integer validation

**High** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Cart drawer .qty stepper, #/quote .checkout-line stepper, #/product/<id> .qty-stepper, product card .card-stepper

**Problem:** Every quantity control is a static <b> between − and + buttons (App.jsx:1411, 1257, 1120, 836). Nothing accepts typed input. To order 50 cases, a buyer must click + 49 times per line, in both the product page and the cart. For a wholesale site with a server-side limit of 100000 per line (launch_order_boundaries.sql:72), this is the main friction in the order flow. Measured: the drawer stepper is 40×40 buttons around a 34px-wide read-only number.

**Also seen:**
- #/product/<id> → .qty-stepper — The stepper is two buttons around a <b> (App.jsx:1118-1122) with no <input>, so values like 0, -1, abc or 99999 cannot be typed. The downside is that a wholesale buyer ordering 40 cases must tap + 39 times. My test needed 120 taps to reach 121. There is no upper bound (Math.max only on the low side), no minimum order or step, and '−' stays enabled at 1 and does nothing on tap.
- #/product/<id> 'Quantity to add' stepper; card steppers; cart drawer and #/quote line quantities — Every quantity control is − / <b>{qty}</b> / +, with no input. Getting a wholesale quantity of 48 cases takes 47 presses of '+', which is a real burden for switch, voice-control and tremor users (voice users can't say 'type 48'). The value lives in a <b> element, so it isn't editable or readable as a form value.
- #/product/<id> quantity stepper, cart/checkout steppers, #/account Quick Reorder qty, stored cart — addLine/addLines (App.jsx:239-260) and the product stepper (App.jsx:1121) have no maximum, and there is no typed quantity field on the product page (reaching 120 units takes 119 clicks on '+'). QuickReorder's <input type=number> (QuickReorder.jsx:73) has no max, and rowQty floors any value, so '1e9' adds 1,000,000,000. normalizeCart (lines.js:130) keeps fractional and huge values: a cart of {'1::diamond':2.5,'366':1e9} rendered steppers showing '…

**Fix:** Replace the +/− only steppers (PDP, cards, cart drawer, #/quote, Quick Reorder) with a numeric input (inputmode='numeric') flanked by −/+. Clamp to integers between 1 and 100,000 to match the server limit, disable − at 1, and validate on hydration and before submit (App.jsx:239-248, 834, 1118-1122, 1255-1259, 1409-1413).

**Files:** `src/App.jsx:239`, `src/App.jsx:248`, `src/App.jsx:261`, `src/App.jsx:834-838`, `src/App.jsx:834`, `src/App.jsx:1118-1122`, `src/App.jsx:1118`, `src/App.jsx:1119`, `src/App.jsx:1120`, `src/App.jsx:1121`, `src/App.jsx:1255-1259`, `src/App.jsx:1255`, `src/App.jsx:1409-1413`, `src/App.jsx:1409`, `src/index.css:326`, `src/lib/lines.js:130`, `src/pages/account/QuickReorder.jsx:13`, `src/pages/account/QuickReorder.jsx:73`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:72`

**Evidence:** [cart/drawer-guest-1440.jpg](screenshots/cart__drawer-guest-1440.jpg), [code/storage-cart-fractional-huge.jpg](screenshots/code__storage-cart-fractional-huge.jpg)

- [ ] Done

#### AW-014 · Guests can submit a quote for tobacco/vape products without any retail license, tobacco permit or tax ID

**High** · ux-flow · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** #/quote (guest) → 'Your details' form

**Problem:** As a signed-out guest I added Kite cigarette tobacco (TOBACCO) and Swisher Sweets cigarillos and opened #/quote. The form asks only for Business, Contact, Email, Phone, Street, City, State, ZIP, Delivery method, Preferred date and Notes. The site states 'WHOLESALE TO LICENSED RETAIL BUSINESSES ONLY · NO CONSUMER SALES · 21+', and the Apply flow collects license/EIN/resale certificate. submit_quote accepts anonymous calls (granted to anon, launch_order_boundaries.sql:256) and stores no license information. The quote page also offers no sign-in or apply link for guests; it just says 'Pricing after sign-in'.

**Fix:** When the cart contains any TOBACCO or NOVELTIES (vape) line and the visitor is not an approved buyer, add required fields 'State tobacco/retail license #' and 'Sales-tax / resale certificate #' to the quote form (autoComplete="off"). Add a checkbox 'I confirm this business holds a valid tobacco retail license and all purchasers are 21+'. Add matching p_license_no / p_resale_cert params and columns to submit_quote/orders, and reject in SQL when they are blank for tobacco lines. Alternatively, require sign-in for carts with age-restricted items. In both cases, show 'Have an account? Sign in' and 'New? Apply for a trade account' links above the form for guests.

**Owner input needed:** Decide whether carts with tobacco/vape items should require sign-in as an approved buyer, or allow guest quotes that collect a tobacco license number, resale certificate number and a 21+ attestation.

**Files:** `src/App.jsx:1270-1287`, `src/App.jsx:1290`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:149-197`

**Evidence:** [cart/quote-guest-1440.jpg](screenshots/cart__quote-guest-1440.jpg)

- [ ] Done

#### AW-076 · The $500 minimum is stated three times but never enforced, and checkout says 'You can still submit this order', even directly above a disabled Submit button

**Medium** · content-copy · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** #/quote page intro, notice above submit, fine print; cart drawer fine print

**Problem:** The quote page says 'The minimum order is $500.00' in the intro (App.jsx:1239) and the fine print (App.jsx:1298). For approved buyers below $500, it also shows 'The order minimum is $500.00. You can still submit this order.' (App.jsx:1292), which contradicts the word 'minimum'. submit_quote has no minimum check. Guests are told the minimum is $500 but see no subtotal ('Pricing after sign-in'), so they cannot tell whether their quote qualifies. The drawer and checkout copy hard-code '$500.00' and '$1,500' strings instead of using ORDER_MINIMUM / FREE_DELIVERY_THRESHOLD from content.js, which DeliveryPage/PolicyPage already use.

**Also seen:**
- #/quote as approved buyer → area under the total (.notice + .form-error + submit button) — #/quote as a silver buyer with cart {'162':3,'14':3} (the bare Snickers line needs a variant), total $220.53. Under the total are the .notice 'The order minimum is $500.00. You can still submit this order.' (51px at 1440, 72px at 390), a 12px .form-error 'Choose a variant for every product that has more than one.', and 'Submit order' with disabled=true and no aria-describedby. The Snickers line in the list already reads 'Choose a variant before s…

**Fix:** Choose one minimum-order policy and make every piece of copy agree with it (App.jsx:107, 743, 1239, 1292-1297, and the cart drawer fine print). If the minimum is enforced: when pricedBelowMinimum, disable submit and show 'Add $X more to reach the $500 minimum', and enforce the same rule in submit_quote on the server. If it is only a guideline: say so once, clearly. In both cases, remove the 'You can still submit this order' sentence. Never show a 'you can submit' notice while the button is disabled (needsVariant, or backend unavailable). Show the actual reason the button is blocked next to it instead.

**Owner input needed:** Is the $500 minimum order a hard rule that blocks submission, or only a guideline that orders below it may still be submitted?

**Files:** `src/App.jsx:107`, `src/App.jsx:743`, `src/App.jsx:1239`, `src/App.jsx:1250-1253`, `src/App.jsx:1292`, `src/App.jsx:1294`, `src/App.jsx:1296-1297`, `src/App.jsx:1298`, `src/App.jsx:1375`, `src/App.jsx:1436`, `src/data/content.js:20`, `src/data/content.js:45`, `src/data/content.js:52`, `src/data/content.js:61`, `src/data/content.js:65`, `src/data/content.js:110-111`, `src/pages/support/DeliveryPage.jsx:40`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:231-241`

**Evidence:** [cart/quote-guest-1440.jpg](screenshots/cart__quote-guest-1440.jpg), [copy/quote-guest-1440.jpg](screenshots/copy__quote-guest-1440.jpg), [gap1-approved-buyer/quote-silverbare-1440-total.jpg](screenshots/gap1-approved-buyer__quote-silverbare-1440-total.jpg), [gap1-approved-buyer/quote-silverbare-390-total.jpg](screenshots/gap1-approved-buyer__quote-silverbare-390-total.jpg)

- [ ] Done

#### AW-077 · Client price math does not round unit prices, so 'each' × qty ≠ line total and the estimate differs from the saved subtotal

**Medium** · functional-bug · Who: **Cursor** · Effort: S · New

**Where:** Cart drawer / #/quote line prices and totals for silver/gold approved buyers

**Problem:** priceForProfile returns an unrounded float (App.jsx:31); line totals use `it.qty * it.price` (App.jsx:1261) and cartTotal sums the same (App.jsx:238). The server rounds the unit price to cents first: `round(v_product.price * (1 - discount), 2)` (launch_order_boundaries.sql:111). Computed examples at qty 7. Silver, $45.10 list: checkout shows '$42.84 each' (JS toFixed on 42.845), line total $299.91, server $299.95. Silver, $51.51: '$48.93 each', line $342.54, but 7 × $48.93 = $342.51, which is what the server saves. Gold, $84.34: client $531.34 vs server $531.37. The client also hard-codes the discounts `{ standard: 0, silver: 0.05, gold: 0.10 }` (App.jsx:28), duplicating the pricing_tiers table, so they drift if an admin edits tiers.

**Also seen:**
- #/quote, cart drawer, product cards/page → approved silver/gold accounts — vcode-03-auth.mjs section A: lines '… $39.67 each | 3 | $119.02', '… $80.12 each | 3 | $240.37', '… $45.19 each | 40 | $1807.66', total '46 units | $2167.05'. Static prices: 41.76×0.95=39.672, 84.34×0.95=80.123, 47.57×0.95=45.1915. Screenshot: screenshots/vcode__approved-checkout-unrounded-totals.jpg

**Fix:** Round tier unit prices to cents before multiplying (Math.round(price*(1-discount)*100)/100), matching the server calculation, so each × qty equals the line total and the estimate matches the saved subtotal (App.jsx:28-32, 235-238, 1249).

**Files:** `src/App.jsx:28-32`, `src/App.jsx:28`, `src/App.jsx:29`, `src/App.jsx:235`, `src/App.jsx:238`, `src/App.jsx:1249`, `src/App.jsx:1261`, `src/App.jsx:1404`, `src/App.jsx:1425`, `supabase/migrations/20260517000001_rls_policies.sql:88`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:109-111`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:111`

**Evidence:** [code/approved-quote-money-format.jpg](screenshots/code__approved-quote-money-format.jpg), [code/account-order-card-server-totals.jpg](screenshots/code__account-order-card-server-totals.jpg)

- [ ] Done

#### AW-078 · Quote fields accept past delivery dates, any ZIP/State/phone text, and a one-line Notes field

**Medium** · ux-flow · Who: **Cursor** · Effort: S · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/quote → Preferred date, State, ZIP, Phone, Notes

**Problem:** Measured with validity.valid: Preferred date '2020-01-01' is valid (no min attribute), ZIP 'abcdefghijk' is valid (no pattern/maxLength), State 'Texas' is valid (free text, although delivery is only AL/MS/GA), Phone 'hello' is valid. Nothing warns about non-delivery days, the order cutoff, or that 'Next-day delivery (on route)' depends on the ZIP being on a route. Notes is an <input type=text> (App.jsx:1286), so dock hours and substitution notes are squeezed into one line. The server also accepts any preferred_date and state (launch_order_boundaries.sql:156, 186-191).

**Also seen:**
- #/quote → Preferred date — <input id="quote-date" type="date"> has no min or max (App.jsx:1285). Filling 2020-01-01 left validity.valid === true, and the server stores it as-is. Next-day delivery makes today and any past date meaningless requests.
- #/quote → Street/City/State/ZIP/Notes — #ship-state is a free-text <input> and #ship-zip has no pattern (App.jsx:1277-1278). 'Narnia' / 'hello' both passed validity checks. Delivery only covers AL, MS and GA (DELIVERY_STATES exists in onboarding.js), yet nothing ties the address to it. Notes (App.jsx:1286), meant for 'Dock hours, pallet needs, substitutions…', is a one-line <input>.

**Fix:** On #/quote, set min on Preferred date to tomorrow (a business day), make State a select, add pattern/inputmode for ZIP (5 digits) and phone, and make Notes a <textarea> (App.jsx:1274-1286).

**Files:** `src/App.jsx:1274`, `src/App.jsx:1277-1278`, `src/App.jsx:1277`, `src/App.jsx:1278`, `src/App.jsx:1285-1286`, `src/App.jsx:1285`, `src/App.jsx:1286`, `src/data/onboarding.js:13`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:186-191`

**Evidence:** [cart/quote-guest-1440.jpg](screenshots/cart__quote-guest-1440.jpg)

- [ ] Done

#### AW-079 · Choosing 'Will-call pickup' still requires a full ship-to street/city/state/ZIP

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/quote → Delivery method select = Will-call pickup

**Problem:** After selecting 'Will-call pickup', #ship-street still has required=true and stays visible, along with City, State and ZIP. submit_quote raises 'A ship-to address is required' whatever p_delivery is (launch_order_boundaries.sql:186-191). Pickup customers must invent a delivery address. The Delivery method select also sits after the address block, so buyers fill the address before choosing pickup.

**Fix:** Move the Delivery method select above the address fields. When data.delivery === 'willcall', hide Street/City/State/ZIP and show 'Pickup at 613 Graymont Ave N, Birmingham during business hours.' Drop `required` in that case and send nulls. In submit_quote, require the ship-to fields only `if p_delivery = 'delivery'`.

**Files:** `src/App.jsx:1275-1284`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:186-191`

- [ ] Done

#### AW-080 · Everything typed into the quote form is lost on navigation, including via the page's own 'Choose variant' link

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/quote form

**Problem:** I typed 'ZZ TEST' into Business and 'ZZ' into Contact, clicked the Home breadcrumb, then used browser Back to #/quote. Business came back as '' (form state lives only in QuotePage useState). The quote page itself sends users away with 'Choose variant' (App.jsx:1253) and product-name clicks, so a buyer who fixes a line loses 11 fields of details.

**Fix:** Save a draft of `data` (excluding nothing sensitive beyond contact info) to sessionStorage key 'aw-quote-draft' on change (debounced 300 ms). Initialize from it on mount and clear it on successful submit. Wrap reads and writes in try/catch like safeReadJson. Also fixing the inline variant select (see the bare-line finding) removes the need to leave the page.

**Files:** `src/App.jsx:1167-1172`, `src/App.jsx:1253`

- [ ] Done

#### AW-081 · Checkout line cards have zero horizontal padding: thumbnails touch the left border and the × touches the right

**Medium** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/quote → .checkout-line items

**Problem:** At 390px, the .checkout-line box starts at x=16 and its .thumb at x=17, flush against the 1px border. At 1440px the thumbnail sits at x=81 against the border at x=80, and the × button meets the right edge. Cause: `.checkout-line { padding: 12px }` (index.css:337) is overridden by the later equal-specificity rule `.drawer-line { padding: 12px 0 }` (index.css:463), because the <li> has both classes.

**Fix:** Raise specificity: change index.css:337 to `.drawer-line.checkout-line { border: 1px solid var(--line); padding: 12px 16px; }`, or move the .checkout-line rule below .drawer-line.

**Files:** `src/App.jsx:1245`, `src/index.css:337`, `src/index.css:463`

**Evidence:** [cart/m390-checkout-line.jpg](screenshots/cart__m390-checkout-line.jpg), [cart/quote-1024.jpg](screenshots/cart__quote-1024.jpg)

- [ ] Done

#### AW-082 · 'Clear all items' empties the whole cart instantly with no confirmation or undo

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/quote → 'Clear all items' text link under the line list

**Problem:** A single click on 'Clear all items' (App.jsx:1266) set aw-cart to {} and replaced the page with 'Your cart is empty'. There is no confirm and no undo. The link sits directly below the last line's controls, where a stray tap is likely on mobile.

**Fix:** Before clearing, keep the previous cart in a ref (`lastCleared = cart`). Show an inline banner 'Cart cleared · Undo' (role="status") for 8 seconds, with Undo calling setCart(lastCleared). Alternatively, gate the action with window.confirm('Remove all N items from this quote?'). Move the link to the right of a subtotal row, away from the steppers.

**Files:** `src/App.jsx:263`, `src/App.jsx:1266`

**Evidence:** [cart/quote-guest-1440.jpg](screenshots/cart__quote-guest-1440.jpg)

- [ ] Done

#### AW-083 · Cart lines are silently deleted when a product is deactivated or a variant renamed

**Medium** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** App load / live catalog refresh → normalizeCart

**Problem:** Seeded aw-cart with '9999' (unknown product) and '1::nonexistent' (unknown variant). After reload both lines were gone from storage and the drawer, with no message. Live products are loaded `.eq('active', true)` (useCatalog.js:19), so when an admin deactivates a product, every buyer's saved line for it disappears the next time they open the site. Reorders do report 'No longer available', but normal carts do not.

**Also seen:**
- All routes → cart normalization (App effect on products) — vcode-04-catalog.mjs: live 368 rows vs static 368, onlyLive [], onlyStatic [], variantDiff []. Simulated extra row: 'after load stored cart {"10":1} pdp 369 h1 Admin-added test row'.

**Fix:** Don't normalize/delete cart lines until the live catalog has loaded (App.jsx:229-231; useCatalog.js:13-36). For lines whose product is deactivated or whose variant was renamed, keep them flagged as 'no longer available' with a notice and let the user remove them, instead of silently deleting (lines.js:126-148).

**Files:** `src/App.jsx:229-231`, `src/App.jsx:229`, `src/lib/lines.js:126-148`, `src/lib/lines.js:133`, `src/lib/useCatalog.js:13`, `src/lib/useCatalog.js:19`, `src/lib/useCatalog.js:36`

- [ ] Done

#### AW-238 · No free-delivery ($1,500) or minimum-order progress meter; guests get no subtotal or unit summary in the drawer

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Cart drawer footer (.drawer-total) and #/quote .checkout-total

**Problem:** The drawer footer shows only 'Estimated total' plus a money figure (approved) or 'Sign in for pricing' (guest). There is no progress toward the $500 minimum or $1,500 free delivery, and no remaining-amount message. FREE_DELIVERY_THRESHOLD exists in content.js:110 but is never imported in App.jsx. With 7 units across 4 lines, a guest's drawer showed no line or unit count at all; the unit count ('7 units') appears only further down #/quote. The drawer never says what delivery costs under $1,500.

**Fix:** In CartDrawer's .drawer-foot, above the CTA, render a summary row '{lines} lines · {units} units' for everyone. For approved buyers, add a <progress> meter: below ORDER_MINIMUM show 'Add $X to reach the $500 minimum'; between that and FREE_DELIVERY_THRESHOLD show 'Add $Y for free delivery on route'; at or above it show 'Free delivery unlocked (on-route stops)'. Use role="status" on the text. Reuse the same component under .checkout-total on #/quote. For guests, show the units row plus 'Pricing, minimum and delivery are confirmed by your rep', and do not show a meter.

**Files:** `src/App.jsx:1288-1291`, `src/App.jsx:1421-1427`, `src/data/content.js:110`

**Evidence:** [cart/drawer-guest-1440.jpg](screenshots/cart__drawer-guest-1440.jpg)

- [ ] Done

#### AW-239 · Cart drawer and checkout line items don't link back to their product page

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Cart drawer .drawer-line and #/quote .checkout-line (name + thumbnail)

**Problem:** Drawer (App.jsx:1401-1404) and #/quote (App.jsx:1246-1249): the line name is <b>, the thumbnail is <span class="thumb">, and each line has 0 <a> and only −/+/× buttons. The only path back to the product is the 'Choose variant' button, and only on needsVariant lines. A buyer who wants to re-check a flavor, pack size or description has to search the catalog again. Sell-unit data: 24/368 products set sellUnit ('2-pack' ×8, '5-pack' ×4, '25-count box' ×2, 'twin pack', '50 g tin', '5 lb bag', '36-count box', '3-pack', '3 g/4 g disposable', '2.5 gal jug', '250 g/1 kg tin'). Each is already expressed in the product name the line displays.

**Fix:** In CartDrawer (App.jsx:1401-1404) replace `<b>{it.name}</b>` with `<button type="button" className="line-name" onClick={() => { onClose(); goProduct(it.productId); }}>{it.name}</button>` and wrap the thumbnail the same way, using tabIndex={-1} and aria-hidden so each line has only one tab stop. Do the same in QuotePage (App.jsx:1246-1249) with `goProduct(it.productId)`. goProduct is already a prop of both components. Style .line-name in index.css like the current `.drawer-line .info b` (display:block; font-size:var(--text-md); font-weight:700; color:var(--ink); background:none; border:0; padding:0; text-align:left), plus `text-decoration: underline` on hover or focus. Skip adding sellUnit to the cart line.

**Files:** `src/App.jsx:1168`, `src/App.jsx:1246-1249`, `src/App.jsx:1383`, `src/App.jsx:1401-1404`

**Evidence:** [cart/m390-drawer.jpg](screenshots/cart__m390-drawer.jpg)

- [ ] Done

#### AW-240 · Cart badge turns into a stretched ellipse for 3+ digit counts; aria-label says '1 items'

**Low** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Header .aw-cart-count badge

**Problem:** With 1,502 units in the cart, the badge measured 34.9×20px with border-radius 50%, rendering as an oval. The badge counts units, not lines, so wholesale carts quickly reach 3–4 digits. aria-label is `Cart, ${cartCount} items` (App.jsx:498), which reads 'Cart, 1 items' for a single unit.

**Also seen:**
- Header → Cart button badge (.aw-cart-count) — index.css:107 sets `.aw-cart-count { top:-9px; right:-9px; min-width:20px; height:20px; border-radius:50%; padding:0 5px }`. Measured badge size by cart contents: - {'145':3}: 20×20 circle. - {'145':129}: 27.3×20 ellipse. - {'145':1500}: 36.3×20 ellipse. The badge's right edge is 8px past the header container at every width: 1368 vs 1360 at 1440, 1000 vs 992 at 1024, 382 vs 374 at 390 (mobile). It stays inside the viewport. The count sums units (…
- Header → .aw-cart-count — The badge has `border-radius: 50%; min-width: 20px; height: 20px; padding: 0 5px`. Measured: a count of 3 gives 20×20 (circle), 48 gives 24.1×20 (oval) and 240 gives 31.2×20 (flattened ellipse).

**Fix:** Make .aw-cart-count a pill with min-width equal to its height, padding and border-radius:999px. Cap the display at '99+' so it doesn't become an ellipse or overhang the header column (index.css:107). Change the aria-label to use correct pluralization ('1 item').

**Files:** `src/App.jsx:233`, `src/App.jsx:498-500`, `src/App.jsx:498`, `src/App.jsx:500`, `src/index.css:107`

**Evidence:** [cart/badge-4digit-390.jpg](screenshots/cart__badge-4digit-390.jpg), [nav/cart-badge-129-1440.jpg](screenshots/nav__cart-badge-129-1440.jpg), [nav/cart-badge-1500-1440.jpg](screenshots/nav__cart-badge-1500-1440.jpg), [design/cart-badge-240.jpg](screenshots/design__cart-badge-240.jpg)

- [ ] Done

#### AW-241 · Checkout page spacing: list and form crowd the intro, and the mobile form is an 11-field single column

**Low** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: all (mobile detail at 390x844)

**Where:** #/quote page head → .checkout-grid

**Problem:** #/quote with 3 cart lines. At 1440x900: the intro paragraph box ends at y=524, and .page-head (padding-bottom 8px) ends at y=532, where .checkout-grid (margin-top 0) and the first .checkout-line card begin. That is an 8px gap against --block-gap 24px, and the card visibly sits right under the text. The .checkout-form-title box also starts at y=532 (margin 0 0 4px). At 390x844: all 11 fields (Business, Contact, Email, Phone, Street, City, State, ZIP, Delivery method, Preferred date, Notes) are 358px wide, one per row, because `.form-grid { grid-template-columns: 1fr }` applies at ≤600px (index.css:594). 'Submit quote request' is at y=1890 on an 844px viewport, about 2.2 screens down, and the document is 3453px tall. The empty and submitted states use inline style objects (App.jsx:1208, 1210, 1218, 1221-1225).

**Fix:** 1) index.css:335: add `margin-top: var(--block-gap);` to .checkout-grid. 2) index.css:340: add `line-height: 1;` to .checkout-form-title so its glyph top lines up with the first card (margin-top is already 0). 3) Inside `@media(max-width:600px)`, directly after line 594, add `.checkout-form-grid { grid-template-columns: 1fr 1fr; } .checkout-form-grid > div:not(.half) { grid-column: 1 / -1; }`. It must come after line 594 because the specificity is equal. Then add className="half" to the State and ZIP wrapper divs at App.jsx:1277-1278 so they share a row. 4) Replace the inline style objects at App.jsx:1208/1218 (and the child styles at 1210, 1221, 1222, 1224, 1225) with a `.page-head.centered { text-align: center; padding: 60px 0; } .page-head.centered > p { margin-inline: auto; } .page-head.centered .dialog-actions { justify-content: center; }` class in index.css.

**Files:** `src/App.jsx:1208`, `src/App.jsx:1218-1225`, `src/App.jsx:1239-1241`, `src/App.jsx:1276-1278`, `src/index.css:335`, `src/index.css:340`, `src/index.css:594`

**Evidence:** [cart/m390-quote-full.jpg](screenshots/cart__m390-quote-full.jpg), [cart/quote-guest-1440.jpg](screenshots/cart__quote-guest-1440.jpg)

- [ ] Done

## Sign-in, trade application, account & admin (signed out)

#### AW-015 · Auth email links take over the whole site: any recovery or error link keeps the Reset Password page on top of every route

**High** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Any route after opening an auth email link (e.g. /#error=access_denied&error_code=otp_expired&...) → <main> stuck on the Reset Password page

**Problem:** Reproduced (scratchpad/pw/vauth_01_trap.mjs). Sequence: landing → title 'Reset Password · Alabama Wholesale Inc', h2 'This link has expired or was already used'. Footer 'Candies (58)' → hash #/category/CANDIES, same title and h1. location.hash='#/contact' → same. Reload at #/contact → Contact page renders. Breadcrumb 'Home' → home renders. App.jsx:316 renders ResetPasswordPage whenever auth.recovery || auth.linkError, and nothing but ResetPasswordPage.finish() calls clearRecovery (useAuth.js:105). useAuth.js:19 turns ANY error fragment into linkError, so an expired sign-up confirmation link also shows 'Choose a new password' and the text 'Reset links work once…'. A confirmation-link failure is wrongly presented as a password reset.

**Also seen:**
- Any route after opening a valid recovery email link (/#access_token=…&type=recovery) → <main> (ResetPasswordPage), then the header nav, header search, footer links, browser Back and header Sign Out — Local fake recovery fragment (#access_token=QA-ONLY-fake&…&type=recovery), with GET /auth/v1/user and profiles answered locally and POST /auth/v1/logout answered 204, at 1440x900. Form state: header Bestsellers leaves H1 'Choose a new password' and the form unchanged. Done state (set via React state): footer 'Tobacco (68)' → hash #/category/TOBACCO, main unchanged, title still 'Reset Password · Alabama Wholesale Inc'. Search 'snickers' + Enter → …

**Fix:** In src/App.jsx (~158, 188-199, 316), stop rendering ResetPasswordPage in place of <main> through `accountLinkPage = auth.recovery || !!auth.linkError`. When the page detects an auth link in the URL, clear the auth hash. Only a type=recovery link should route (once) to #/reset-password. Other link errors, such as otp_expired on a sign-up confirmation, should get their own message (resend the confirmation, or sign in) and must never be described as a reset link. Clear auth.recovery and auth.linkError when the user navigates away, when they sign out, and after the password is saved, so the header nav, header search, footer links and browser Back work normally. Reset the 'Password updated' state on Sign Out. If the user signs out in the middle of a reset, show sign-in instead of 'This link has expired'.

**Files:** `src/App.jsx:116`, `src/App.jsx:158`, `src/App.jsx:188`, `src/App.jsx:189`, `src/App.jsx:199`, `src/App.jsx:207`, `src/App.jsx:266`, `src/App.jsx:316`, `src/lib/useAuth.js:19`, `src/lib/useAuth.js:39`, `src/lib/useAuth.js:65`, `src/lib/useAuth.js:93`, `src/lib/useAuth.js:105`, `src/pages/support/ResetPasswordPage.jsx:18`, `src/pages/support/ResetPasswordPage.jsx:77`, `src/pages/support/ResetPasswordPage.jsx:78`, `src/pages/support/ResetPasswordPage.jsx:85`, `src/pages/support/ResetPasswordPage.jsx:98`

**Evidence:** [auth/expired-link-trap-after-clicking-candies-1440.jpg](screenshots/auth__expired-link-trap-after-clicking-candies-1440.jpg), [auth/expired-link-landing-1440.jpg](screenshots/auth__expired-link-landing-1440.jpg), [code/recovery-link-page-sticks.jpg](screenshots/code__recovery-link-page-sticks.jpg), [security/link-error-description-injection-1280.jpg](screenshots/security__link-error-description-injection-1280.jpg), [gap2-onboarding-recovery-states/reset-done-after-nav-attempts-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-done-after-nav-attempts-1440.jpg), [gap2-onboarding-recovery-states/reset-done-then-signout-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-done-then-signout-1440.jpg), [gap2-onboarding-recovery-states/reset-recovery-signout-shows-expired-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-recovery-signout-shows-expired-1440.jpg)

- [ ] Done

#### AW-016 · No way to resend the sign-up confirmation email, and no landing state after confirming

**High** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Auth modal 'Check your inbox' step; sign-in error for unconfirmed accounts; site root after the confirmation link

**Problem:** The 'sent' step (AuthModal.jsx:282-299) offers only 'Done' and 'Sign in'. There is no 'Resend email' anywhere in the code (grep for 'resend' finds nothing). Signing in before confirming returns Supabase's raw 'Email not confirmed', which describeError passes straight through with no next step. useAuth.js:18 only recognises type=recovery. A successful confirmation (#access_token=…&type=signup) lands on the home page with no message, and the applicant's pending status is never explained. Applicants who miss or lose the email can only get unstuck by calling.

**Fix:** (1) Add resendConfirmation(email) to useAuth: supabase.auth.resend({ type: 'signup', email }). (2) On the 'sent' step, add a 'Resend confirmation email' text button that calls it with signup.email, then says 'Sent again' and disables for 60 s. (3) In handleSignin, when err.code === 'email_not_confirmed', show 'Confirm your email first — we sent a link to {email}.' with the same resend button. (4) In useAuth, parse linkParams.get('type') === 'signup' (or 'email') into a `confirmedLink` flag. In App, when it is true and the profile is loaded, open AuthModal in 'status' mode, add a 'Your email is confirmed' line, and strip the fragment with history.replaceState.

**Files:** `src/components/AuthModal.jsx:95`, `src/components/AuthModal.jsx:282`, `src/lib/useAuth.js:18`, `src/lib/useAuth.js:65`

- [ ] Done

#### AW-017 · Admin Accounts table hides the EIN, license, resale certificate and other application details staff must verify

**High** · functional-bug · Who: **Cursor** · Effort: S · New

**Where:** #/admin → Accounts tab table (admin only)

**Problem:** The application collects ein, license_no, resale_cert_no, phone, business_type, state and expected_volume (AuthModal.jsx:230-271; stored by the trigger in 20260927000000_application_fields.sql). The Accounts table only renders Business, Contact, Email, Status, Tier, Role, Documents and Actions (AdminPage.jsx:187). A trade rep pressing 'Approve' therefore cannot see the numbers they are meant to check without opening the database. Documents are also shown only while status === 'pending' (AdminPage.jsx:219), so they disappear after approval or suspension.

**Also seen:**
- #/admin → Accounts tab table — The application requires EIN, state retail tobacco license #, resale certificate #, phone, business type, store state and expected volume. AuthModal saves them into profiles through handle_new_user. The Accounts table renders only Business, Contact, Email, Status, Tier, Role, Documents and Actions (AdminPage.jsx:187). A repo-wide grep finds license_no, ein and resale_cert_no only in the signup code (useAuth.js:65, AuthModal.jsx:29/252/258/261). N…

**Fix:** In the #/admin Accounts table (or a row-expand detail panel), show the EIN, license number, resale certificate, phone, store state, business type and monthly volume next to the documents, so staff can verify before approving (AdminPage.jsx:187-249).

**Files:** `src/components/AuthModal.jsx:287`, `src/pages/admin/AdminPage.jsx:187`, `src/pages/admin/AdminPage.jsx:193`, `src/pages/admin/AdminPage.jsx:219`, `src/pages/admin/AdminPage.jsx:249`

- [ ] Done

#### AW-018 · The trade application loses everything typed after one click outside the dialog or one Escape press

**High** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Auth modal → 'Apply for an account' form (all entry points)

**Problem:** Reproduced (scratchpad/pw/vauth_02_dirty.mjs). Typed name 'x', business 'Test', EIN 'abc' → clicked backdrop at (40,450) (target .overlay) → 0 .dialog elements → reopened via 'Start application' → #aw-su-name '' and #aw-su-ein ''. Typing and pressing Escape did the same. The form has 11 inputs/selects (name, business, email, phone, password, business type, EIN, state, license #, resale #, monthly volume) plus 2 optional file inputs, all held in AuthModal state (AuthModal.jsx:57-58). They are discarded when App unmounts the modal (App.jsx:350).

**Fix:** In AuthModal, compute isDirty = mode === 'signup' && (Object.keys(EMPTY_SIGNUP).some(k => signup[k] !== EMPTY_SIGNUP[k]) || Object.values(proof).some(Boolean)). Pass a guarded close to the overlay onClick, the × button and ModalLayer's onClose: when isDirty, show window.confirm('Discard your application?') or an inline confirm bar, and ignore backdrop clicks outright. Also keep the non-password fields between openings: lift `signup` into App state, or save it to sessionStorage without the password, and restore it on reopen.

**Files:** `src/App.jsx:350`, `src/components/AuthModal.jsx:57`, `src/components/AuthModal.jsx:161`, `src/components/ModalLayer.jsx:49`

- [ ] Done

#### AW-019 · The application captures no explicit consent to Trade terms or Privacy, and the privacy policy omits uploaded license files

**High** · content-copy · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** Auth modal → application form footer; #/privacy 'What we collect'

**Problem:** The form ends with 'Submit application' plus a passive grey line: 'By applying you confirm all store staff handling tobacco products meet federal and state age requirements.' (AuthModal.jsx:344). There is no checkbox and no link to #/terms or #/privacy in the modal or on #/apply (grep finds none). Applicants hand over their EIN and license or resale certificate images. PolicyPage.jsx:45 lists the application fields but not the uploaded document files, where they are stored, or how long they are kept.

**Also seen:**
- #/apply page and the 'Start application' dialog — Verified at 1440: #/apply → Start application opens the signup form (evidence/vsupport/apply-signup-dialog.png). The dialog's links and buttons are ×, Alabamawholesaleinc@gmail.com, Submit application, Back to the checklist and Already approved? Sign in. input[type=checkbox] count is 0. The fine print reads '21+ licensed businesses only. By applying you confirm all store staff handling tobacco products meet federal and state age requirements.' (A…

**Fix:** Add required checkboxes to the application form: 'I agree to the Trade terms and Privacy policy' (linked) and 'I am 21 or older'. Store acceptance with a timestamp and terms version in the profile, and link Terms/Privacy from #/apply (AuthModal.jsx:230-279, 344; useAuth.js:71).

**Owner input needed:** Approve the consent checkbox wording and the Trade terms/Privacy policy version the application should record acceptance of.

**Files:** `src/components/AuthModal.jsx:230-279`, `src/components/AuthModal.jsx:274`, `src/components/AuthModal.jsx:344`, `src/lib/useAuth.js:71`, `src/pages/support/ApplyPage.jsx:39`, `src/pages/support/PolicyPage.jsx:45`, `supabase/migrations/20260927000000_application_fields.sql:8-29`

**Evidence:** [auth/signup-form-1440-part1.jpg](screenshots/auth__signup-form-1440-part1.jpg), [support/apply-1440-start-application-modal.jpg](screenshots/support__apply-1440-start-application-modal.jpg), [support/apply-1440-full.jpg](screenshots/support__apply-1440-full.jpg)

- [ ] Done

#### AW-084 · Auth and upload failures show raw Supabase error text to customers

**Medium** · content-copy · Who: **Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** Auth modal sign-in/sign-up/reset errors; upload errors; #/reset-password; #/account order-history error

**Problem:** describeError (AuthModal.jsx:21-25) only rewrites network errors and otherwise shows err.message verbatim. The same pattern is in documentErrorMessage (documents.js:41-46) and ResetPasswordPage.jsx:27-30. AccountPage.jsx:114 renders `Couldn't load orders: {error}` with the PostgREST message. Customers would therefore see backend strings such as 'Invalid login credentials', 'Email not confirmed', 'User already registered', 'For security purposes, you can only request this after 49 seconds', 'new row violates row-level security policy' or 'mime type image/heic-sequence is not supported'. Not triggered live, because remote writes are blocked in this review.

**Fix:** Create src/lib/authErrors.js exporting friendlyAuthError(err, what) that switches on err.code (supabase-js v2 AuthApiError): invalid_credentials → 'That email and password don’t match. Try again or reset your password.'; email_not_confirmed → 'Confirm your email first — check your inbox or resend the link.'; user_already_exists → 'An account already uses this email. Sign in or reset your password.'; weak_password → 'Choose a stronger password: ' + err.reasons; over_email_send_rate_limit / over_request_rate_limit → 'Please wait a minute before trying again.'; any other code → the existing phone/email fallback. Use it in AuthModal, ResetPasswordPage and documents.js, and replace AccountPage.jsx:114 with 'We couldn’t load your orders. Refresh the page or call the trade desk.' Log the raw error with console.warn.

**Files:** `src/components/AuthModal.jsx:21`, `src/lib/documents.js:41`, `src/pages/account/AccountPage.jsx:114`, `src/pages/support/ResetPasswordPage.jsx:27`

- [ ] Done

#### AW-085 · Pending applicants are sent to My account, which has no document upload, and chosen files are silently dropped

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Auth modal 'Check your inbox' and 'pending approval' steps → 'View account status' → #/account

**Problem:** After signup without a session the modal says 'Your files stay on this device until you are signed in. After you confirm your email, upload them from your application status…' (AuthModal.jsx:291). There is no link to that place, and the files live only in React state, so they are lost when the modal closes. The pending-status step's primary button 'View account status' goes to #/account (AuthModal.jsx:315). AccountPage renders no <ApplicationDocuments/>; the upload panel exists only on #/apply (ApplyPage.jsx:22). If uploads fail after a signup that did get a session, the modal shows the error with no retry control, and uploadSelectedProof stops at the first failure (documents.js:148-153).

**Also seen:**
- Apply for a trade account → Optional documents → Submit application → 'Check your inbox' — The signup form invites uploading the license and resale certificate (AuthModal.jsx:263-268). Uploads need a session (documents.js:99-103), and with confirmation enabled signUp returns no session, so handleSignup skips the upload (AuthModal.jsx:115-120). The files are then lost when the dialog closes. The only notice is 'Your files stay on this device until you are signed in … upload them from your application status' (AuthModal.jsx:291). The app…

**Fix:** When email confirmation is on, don't let applicants pick files that will be silently discarded. Either hold the files and upload them after confirmation, or tell applicants they'll upload after confirming. Add the document upload panel to #/account for pending applicants, and point 'View account status' to it (AuthModal.jsx:113, 263, 291, 315; AccountPage.jsx:92).

**Files:** `src/components/AuthModal.jsx:113`, `src/components/AuthModal.jsx:263`, `src/components/AuthModal.jsx:291`, `src/components/AuthModal.jsx:315`, `src/lib/documents.js:99`, `src/lib/documents.js:145`, `src/pages/account/AccountPage.jsx:92`, `src/pages/support/ApplyPage.jsx:22`

- [ ] Done

#### AW-086 · Signed-out My account, which is also where Quick Reorder sends guests, is a bare 'Sign in' page with no apply path, and signed-in Quick Reorder doesn't land on the reorder section

**Medium** · ux-flow · Who: **Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/account signed out (also reached from header 'Quick Reorder' and the mobile menu)

**Problem:** Measured on #/account: the text is only 'TRADE ACCOUNT / My account / Sign in to view your account, order history, and quick reorder. / Sign in'. There is no .crumbs element (every other support page has one), no link to apply, and no explanation for visitors without an account. The header 'Quick Reorder' (App.jsx:311) lands here and never scrolls to #quick-reorder after sign-in. AccountPage renders this signed-out state whenever profile is null, including while a signed-in user's profile is still loading, so returning customers briefly see a Sign in prompt.

**Also seen:**
- Header 'Quick Reorder' → #/account (signed out and signed in) — Signed out, at both 1440x900 and 390x844: clicking header 'Quick Reorder' from a scrolled home page opens #/account. The main content is only 'TRADE ACCOUNT / My account / Sign in to view your account, order history, and quick reorder.' plus a single 'Sign in' button. There is no explanation of the feature and no Apply CTA. Signed in (mocked approved profile): onReorder (App.jsx:311) calls navigate({page:'account'}), which does scrollTo(0,0) (App…

**Fix:** In src/pages/account/AccountPage.jsx (~43), give the signed-out state a breadcrumb, a short explanation of what a trade account offers (order history, Quick Reorder, pricing), and both 'Sign in' and 'Apply for a trade account' buttons. Wait for auth loading to finish before rendering the signed-out view, so signed-in users don't see a flash of it. In src/App.jsx (onReorder, ~311/329), when a guest clicks the header 'Quick Reorder', open the sign-in dialog and return them to #/account#quick-reorder after sign-in. For signed-in users, navigate to #/account and scroll to and focus the Quick Reorder section.

**Files:** `src/App.jsx:207-211`, `src/App.jsx:311`, `src/App.jsx:328-331`, `src/App.jsx:329`, `src/App.jsx:512`, `src/App.jsx:555`, `src/App.jsx:604`, `src/pages/account/AccountPage.jsx:25`, `src/pages/account/AccountPage.jsx:43`, `src/pages/account/AccountPage.jsx:43-56`, `src/pages/account/AccountPage.jsx:96-104`, `src/pages/account/AccountPage.jsx:96`

**Evidence:** [auth/page-account-1440.jpg](screenshots/auth__page-account-1440.jpg), [auth/page-account-390.jpg](screenshots/auth__page-account-390.jpg), [cart/reorder-signed-out-1440.jpg](screenshots/cart__reorder-signed-out-1440.jpg), [nav/quick-reorder-signed-out-1440.jpg](screenshots/nav__quick-reorder-signed-out-1440.jpg)

- [ ] Done

#### AW-087 · #/admin shows a bare 'Access denied / Admin role required.' dead end, and admins see it while loading

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/admin signed out or as a non-admin

**Problem:** Measured (scratchpad/pw/vauth_03_pages.mjs). #/admin main innerText 'ADMIN / Access denied / Admin role required.', crumbs 0, buttons [] at both 1440 and 390; the page height collapses to 134–178px. AdminPage has no loading or session input (App.jsx:332 passes only profile and goHome), so admins see the denial during auth loading. The title 'Admin · Alabama Wholesale Inc' is set, but with hash routing this is not an indexing issue.

**Also seen:**
- #/admin (signed out or non-admin) — qvdes-02-measure.mjs: 'ADMIN crumbs 0 buttons 0'. Screenshot: evidence/design-verify/admin-signed-out-1440.png.

**Fix:** On #/admin, show a loading state while auth resolves. For signed-out users, show a sign-in prompt with a breadcrumb. For signed-in non-admins, show a helpful 'You don't have access' page with links home and to My account, not a bare 'Access denied' (AdminPage.jsx:19; App.jsx:109, 332).

**Files:** `src/App.jsx:109`, `src/App.jsx:332`, `src/pages/admin/AdminPage.jsx:19`

**Evidence:** [auth/page-admin-1440.jpg](screenshots/auth__page-admin-1440.jpg), [auth/page-admin-390.jpg](screenshots/auth__page-admin-390.jpg), [design/admin-viewport-1440.jpg](screenshots/design__admin-viewport-1440.jpg), [design/account-viewport-1440.jpg](screenshots/design__account-viewport-1440.jpg)

- [ ] Done

#### AW-088 · Approving an account sends nothing, although every screen promises 'we'll contact you when approved'

**Medium** · ux-flow · Who: **Owner → Cursor** · Effort: M · New

**Where:** #/admin Approve; copy in the auth modal, #/apply and #/account

**Problem:** AdminPage.jsx:249-253 'Approve' → updateProfile(p.id, { status: 'approved' }) only. The repo has no supabase/functions, no netlify/functions and no webhook migration. The admin table doesn't even show the applicant's phone (see AW-017), so a rep has no prompt or context to make the promised call. Applicant copy: AuthModal.jsx:183 and ApplyPage.jsx:75 ('will contact you at {email} when … approved'); AuthModal.jsx:288 ('We’ll contact you at {email} or {phone}'). Home, App.jsx:786: 'You'll get price-list access by email.' No price list exists; approved buyers see prices on the site.

**Fix:** Either add a Supabase Database Webhook / Edge Function (supabase/functions/account-approved) on UPDATE of profiles where status changes to 'approved' that emails the applicant ('Your Alabama Wholesale trade account is approved — sign in to see pricing'), or, until that exists, render a mailto: link beside 'Approve' prefilled with that message, and change the customer copy to 'A trade rep will call or email you'. Remove 'price-list access by email' from App.jsx:786.

**Owner input needed:** Should approvals send an automatic email, which needs an email provider or SMTP set up in Supabase, or will a trade rep call or email each approved applicant by hand?

**Files:** `src/App.jsx:786`, `src/components/AuthModal.jsx:183`, `src/components/AuthModal.jsx:288`, `src/pages/admin/AdminPage.jsx:249`, `src/pages/support/ApplyPage.jsx:75`

- [ ] Done

#### AW-089 · After sign-in the dialog closes silently if the profile is missing or slow, leaving the header looking signed out

**Medium** · functional-bug · Who: **Cursor** · Effort: M · New

**Where:** Auth modal 'Signing you in…' step; header account actions

**Problem:** The checking effect (AuthModal.jsx:76-81) moves to 'status' only when `profile && profile.status !== 'approved'`. When the profile fetch fails (useAuth.js:56 just console.warns), the dialog calls onClose. A second effect (:82-86) also closes the dialog after 10 s with no message. App derives `user` from profile, not session (App.jsx:159), so a user with a valid session but no profile sees 'Sign In / Sign Up' and cannot sign out.

**Fix:** In AuthModal, when profileReady && !profile, set an error step: 'We signed you in but couldn’t load your account. Try again, or call the trade desk.' with 'Try again' (re-fetch) and 'Sign out' buttons. Replace the silent 10 s close with the same message. In App.jsx:159, build `user` from auth.session (email fallback) so Sign Out stays reachable whenever a session exists.

**Files:** `src/App.jsx:159`, `src/components/AuthModal.jsx:76`, `src/components/AuthModal.jsx:82`, `src/lib/useAuth.js:54`

- [ ] Done

#### AW-090 · Keyboard focus falls to <body> when the dialog returns to the step it opened on

**Medium** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Auth modal: Sign Up → Continue → 'Back to the checklist'; Sign In → 'No account? Apply instead' → 'Already approved? Sign in'

**Problem:** Measured document.activeElement. Header Sign Up → checklist (focus on Continue) → signup form (focus on #auth-title) → 'Back to the checklist' leaves focus on BODY. Sign In → Apply instead (focus on #auth-title) → 'Already approved? Sign in' also leaves focus on BODY. The effect at AuthModal.jsx:68-72 skips focusing the heading whenever mode equals the initial mode, and the button that had focus has unmounted.

**Fix:** Replace the initialModeRef guard with a first-run ref: `const firstRun = useRef(true); useEffect(() => { if (firstRun.current) { firstRun.current = false; return; } titleRef.current?.focus({ preventScroll: true }); }, [mode]);`. Focus then moves to the heading on every step change, including returns to the first step.

**Files:** `src/components/AuthModal.jsx:68`

- [ ] Done

#### AW-091 · Business type, store state and monthly volume are preselected, so applicants can submit answers they never chose

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Auth modal application form → Business type / Store state / Expected monthly volume selects

**Problem:** EMPTY_SIGNUP sets business_type 'Convenience Store', state 'AL' and expected_volume '$5K — $15K' (AuthModal.jsx:30). On load the selects read 'Convenience Store', 'AL' and '$5K — $15K', and none is required (validationMessage '' on empty submit). An applicant who skips them is recorded as an Alabama convenience store doing $5–15K a month, and staff can't tell a real answer from the default.

**Fix:** Set business_type: '', state: '', expected_volume: '' in EMPTY_SIGNUP. Give each select `required` and a first option `<option value='' disabled>Select…</option>`. Keep option values unchanged.

**Files:** `src/components/AuthModal.jsx:27`, `src/components/AuthModal.jsx:249`, `src/components/AuthModal.jsx:255`, `src/components/AuthModal.jsx:270`

**Evidence:** [auth/signup-form-1440-part0.jpg](screenshots/auth__signup-form-1440-part0.jpg)

- [ ] Done

#### AW-092 · The application collects no store street address, city or ZIP

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Auth modal application form field set

**Problem:** The only location field is 'Store state' (AuthModal.jsx:254-256). There is no street, city or ZIP. Yet approval checks a state tobacco license tied to a store location, delivery depends on the stop being on a route (ApplyPage.jsx:54), and submit_quote requires a ship-to address on every order (launch_order_boundaries.sql:185-190), which the customer must retype each time.

**Fix:** 1) In AuthModal.jsx add store_street, store_city and store_zip to EMPTY_SIGNUP (line 27) and add three required Fields after 'Store state' (line 254): 'Store street address' (autoComplete 'address-line1'), 'City' ('address-level2') and 'ZIP' (inputMode 'numeric', pattern '[0-9]{5}', autoComplete 'postal-code'). 2) In useAuth.js:65/71 add them to signUp's parameters and options.data. 3) Add a new migration (do not edit existing ones) with `alter table public.profiles add column if not exists store_street text, add column if not exists store_city text, add column if not exists store_zip text;` and recreate handle_new_user (copy of 20260927000000_application_fields.sql:8-35) inserting new.raw_user_meta_data->>'store_street'/'store_city'/'store_zip'. 4) In QuotePage (App.jsx:1167-1170) initialise phone: profile?.phone || '', shipStreet: profile?.store_street || '', shipCity: profile?.store_city || '', shipState: profile?.state || '', shipZip: profile?.store_zip || ''. 5) In src/data/onboarding.js:9 change the 'Store details' detail to 'Legal business name, store type, and the store's street address.'

**Files:** `src/App.jsx:1167`, `src/App.jsx:1170`, `src/components/AuthModal.jsx:27`, `src/components/AuthModal.jsx:254`, `src/data/onboarding.js:9`, `src/lib/useAuth.js:65`, `src/lib/useAuth.js:71`, `supabase/migrations/20260927000000_application_fields.sql:8`

- [ ] Done

#### AW-242 · The primary 'Start application' button on #/apply is below the fold on desktop and phone

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 1440x900, 390x844

**Where:** #/apply → checklist card 'Start application'

**Problem:** On #/apply the page's own primary action, 'Start application' in the checklist card, starts at page y=1117px at 1440x900 and y=1206px at 390x844, below the first screen in both. The first screen shows the 75px (desktop) / 42px (mobile) H1, the intro and the first checklist rows. The only application entry points above the fold are global chrome: the trade-bar 'Apply for a trade account ↗' link at 1440 and 390, and the header 'Sign Up ↗' at 1440 only. Nothing in the page content itself lets the visitor act on the page's purpose without scrolling. Evidence: screenshots/qa-auth__apply-first-screen-1440.jpg, screenshots/qa-auth__apply-first-screen-390.jpg

**Fix:** In src/pages/support/ApplyPage.jsx, inside PageHead's children (lines 16-18), after the intro <p>, render a CTA row only when there is no profile: {!profile && (<div className="dialog-actions">{isBackendConfigured ? <button className="button" type="button" onClick={onApplyClick}>Start application <span aria-hidden="true">↗</span></button> : <a className="button" href={`tel:${COMPANY.phoneRaw}`}>Apply by phone · {COMPANY.phone} <span aria-hidden="true">↗</span></a>}<button className="text-link" type="button" onClick={onLoginClick}>Already applied? Sign in</button></div>)}. Keep the existing buttons at the bottom of the checklist card (lines 40-45).

**Files:** `src/pages/support/ApplyPage.jsx:16`, `src/pages/support/ApplyPage.jsx:40`

**Evidence:** [auth/page-apply-1440.jpg](screenshots/auth__page-apply-1440.jpg), [auth/vp-apply-390.jpg](screenshots/auth__vp-apply-390.jpg)

- [ ] Done

#### AW-243 · The application field order mixes the login password into business details and puts volume after the uploads

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Auth modal application form grid

**Problem:** The two-column order is Your name | Business name, Business email | Phone, Password | Business type, Federal EIN | Store state, License # | Resale #, then Optional documents, then Expected monthly volume (full width, after the uploads). Login credentials sit beside store data, licensing numbers are split across rows next to unrelated fields, and a store question comes after the optional section.

**Fix:** Split the form into three <fieldset>s with legends, reusing the .doc-uploads legend style. 'Your login': name, business email, phone, password. 'Your store': business name, business type, store state (+ address), expected monthly volume. 'Licensing': Federal EIN, state retail tobacco license #, resale certificate #. Then 'Optional documents'. Put password and EIN each on its own row.

**Files:** `src/components/AuthModal.jsx:232`

**Evidence:** [auth/signup-form-1440-part0.jpg](screenshots/auth__signup-form-1440-part0.jpg)

- [ ] Done

#### AW-244 · The document upload uses the unstyled native file control, shows the filename twice, and has no Remove

**Low** · visual-design · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Auth modal → Optional documents; #/apply pending documents panel

**Problem:** After choosing a test PDF, the row shows the native 'Choose File' button with the full filename inside a beige box, then a second line 'Selected: <same filename>'. With nothing chosen it reads 'No file chosen' in system font. There is no control to remove a chosen file (0 buttons in .doc-upload). The 'Selected:' line is not referenced by aria-describedby (only the hint id is). A rejected file shows 'Use a PDF, JPG, PNG, or HEIC file.' without naming the file.

**Fix:** In DocumentFields (DocumentUploads.jsx:60-86): give the <input type='file'> className 'doc-file sr-only' (sr-only exists at index.css:61) and a ref per doc. Right after it, render <label htmlFor={id} className='button ghost doc-choose'>Choose file</label>. In index.css add `.doc-file:focus-visible + .doc-choose { outline: 3px solid var(--focus-ring); outline-offset: 3px; } fieldset:disabled .doc-choose { opacity: .6; cursor: not-allowed; }`. When files[doc.id] is set, replace the 'Selected:' <p> (line 82-84) with a chip <p className='doc-status' id={`${id}-selected`}>{name} · {Math.ceil(size/1024)} KB <button type='button' className='text-link' onClick={() => { inputRef.current.value = ''; onPick(doc.id, null, null); }}>Remove<span className='sr-only'> {doc.label}</span></button></p>, and add `${id}-selected` to aria-describedby. Change validateDocumentFile in src/lib/documents.js:54 to return `${file.name} isn’t a PDF, JPG, PNG or HEIC file.` (and line 55 to `${file.name} is over the 10 MB limit.`).

**Files:** `src/components/DocumentUploads.jsx:65`, `src/components/DocumentUploads.jsx:76`, `src/components/DocumentUploads.jsx:82`, `src/index.css:800`, `src/lib/documents.js:54`

**Evidence:** [auth/doc-uploads-selected-1440.jpg](screenshots/auth__doc-uploads-selected-1440.jpg)

- [ ] Done

#### AW-245 · Stacked 'TRADE ACCOUNT' eyebrow + kicker + 42px H2 push the password field and Sign in button off a landscape-phone screen

**Low** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: 844x390 landscape; all

**Where:** Auth modal header (all steps)

**Problem:** Every auth-modal step stacks the static eyebrow 'TRADE ACCOUNT' (with the close button), a second kicker ('EXISTING ACCOUNTS'), a 42px H2 and a description before the first field. At 844x390 (landscape phone, desktop padding 34px because width > 600), the sign-in dialog's visible height is 338px. Measured from the dialog's top edge: eyebrow row 38-78, kicker 93-110, H2 124-166, desc 172-194, email 238-282, password 319-363, Sign in button from 377. Only the top ~20px of the password input is visible, and the Sign in button is fully off-screen, so a two-field form needs scrolling. Evidence: screenshots/qa-auth__signin-landscape-844x390.jpg

**Fix:** Remove the static <p className='eyebrow'>TRADE ACCOUNT</p> and render {kicker} inside .dialog-top next to the close button. Add `@media (max-height: 500px) { .dialog { padding: 18px 22px; } .dialog h2 { font-size: 28px; } .dialog > .desc { margin-bottom: 10px; } }`.

**Files:** `src/components/AuthModal.jsx:163`, `src/components/AuthModal.jsx:167`, `src/index.css:440`

**Evidence:** [auth/signin-modal-landscape-844x390.jpg](screenshots/auth__signin-modal-landscape-844x390.jpg), [auth/signin-modal-1440.jpg](screenshots/auth__signin-modal-1440.jpg)

- [ ] Done

#### AW-246 · Approval-time and verification claims disagree across the site

**Low** · content-copy · Who: **Owner → Cursor** · Effort: S · Still open from the 2026-09-25 audit · Viewports: all

**Where:** Auth modal, home 'Become a retail account', FAQ, #/account pending notice

**Problem:** Visible copy: AuthModal.jsx:172 'Most applications are approved within one business day'; AuthModal.jsx:173 'a trade rep will verify your license within one business day'; AccountPage.jsx:93 'will verify your retail license and activate pricing within one business day' (unconditional); App.jsx:786 'checks your license with the state and approves most accounts within one business day. You'll get price-list access by email.' That last line conflicts with AuthModal.jsx:183, ApplyPage.jsx:75 and ApplyPage.jsx:54 ('Wholesale pricing and ordering unlock at that point' / 'wholesale pricing and checkout unlock'). content.js:57-63 (FAQS: '24 hours', 'retail business license… tobacco permit') is exported but never imported or rendered, so it is stale data that will drift further.

**Fix:** 1) Once the owner confirms the approval time, add `export const APPROVAL_TIME = 'one business day';` to src/data/onboarding.js and use it in AuthModal.jsx:172-173, AccountPage.jsx:93 and App.jsx:786. Phrase all of them the same way ('Most applications are approved within ${APPROVAL_TIME}'). 2) Rewrite App.jsx:786 as: 'A trade rep checks your EIN, tobacco license and resale certificate and approves most accounts within one business day. Wholesale pricing and ordering unlock when you sign in.' 3) Delete the unused FAQS export at content.js:57-72. If an FAQ section is added later, rewrite its answers to match the form: EIN, state retail tobacco license #, resale certificate #, optional document uploads, and APPROVAL_TIME.

**Owner input needed:** How long does trade-account approval actually take (e.g. 'one business day'), so one approval-time phrase can be used everywhere on the site?

**Files:** `src/App.jsx:786`, `src/components/AuthModal.jsx:172`, `src/components/AuthModal.jsx:173`, `src/data/content.js:57`, `src/pages/account/AccountPage.jsx:93`

- [ ] Done

#### AW-247 · The phone field accepts any text and has no format hint

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Auth modal application form → Phone

**Problem:** After filling #aw-su-phone with 'abc', validationMessage is '' (valid). type='tel' does no validation and there is no pattern or hint, yet staff use this number to contact the applicant ('We’ll contact you at {email} or {phone}').

**Fix:** On the Phone Field (AuthModal.jsx:242), pass hint='10-digit number we should call about this account, e.g. (205) 555-0123.'. On the input, add aria-describedby="aw-su-phone-hint", placeholder="(205) 555-0123", title="Enter a 10-digit US phone number", and pattern={String.raw`[0-9\(\)+.\-\s]{10,20}`}. The parentheses must be escaped or the /v-flag pattern is invalid and ignored. In handleSignup (line 108), before signUp: `const digits = signup.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); if (digits.length !== 10) { setError('Enter a 10-digit phone number.'); setSubmitting(false); return; }`. Then send phone formatted as `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`.

**Files:** `src/components/AuthModal.jsx:108`, `src/components/AuthModal.jsx:242`

- [ ] Done

#### AW-248 · The password field has only a 10px 'At least 8 characters' hint: no show toggle, no live check

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Auth modal sign-in and application password fields; #/reset-password

**Problem:** The signup password shows only 'At least 8 characters.' (10px), with no show/hide control on any password input and no live feedback. Any stricter rule the Supabase project enforces (character classes, leaked-password check) would come back as a raw server message after submit.

**Fix:** 1) index.css:705: change .field-hint font-size from 10px to var(--text-sm) (12px). 2) Wrap each password input (AuthModal #aw-pass and #aw-su-pass; ResetPasswordPage #reset-password and #reset-confirm) in `<div className="pw-wrap">` with position: relative. Add `<button type="button" className="pw-toggle" aria-pressed={shown} aria-controls="<input id>" onClick={() => setShown(s => !s)}>{shown ? 'Hide' : 'Show'}</button>`, absolutely positioned at right: 0, height var(--tap), and set the input to type={shown ? 'text' : 'password'} with padding-right: 64px. 3) Under #aw-su-pass and #reset-password, render `<p className="field-hint" aria-live="polite">{pw.length >= 8 ? '✓ ' : ''}At least 8 characters</p>`. Add one line per extra rule if the Supabase Auth password policy requires more, so the UI never accepts a password the server rejects.

**Files:** `src/components/AuthModal.jsx:195`, `src/components/AuthModal.jsx:245`, `src/index.css:705`, `src/pages/support/ResetPasswordPage.jsx:62`, `src/pages/support/ResetPasswordPage.jsx:67`

- [ ] Done

#### AW-249 · On mobile, closing the application opened via Menu → Help leaves focus on <body>

**Low** · accessibility · Who: **Cursor** · Effort: M · New · Viewports: 390x844

**Where:** 390px: Menu → Help → 'Apply for an account' → Escape

**Problem:** With this chain, document.activeElement after Escape is BODY (activeElement text starts with the ticker 'FREE DELIVERY…'). On desktop the same path returns focus to 'Help ?'. The openers (menu item, then Help dialog button) have unmounted, and restoreFocus only tries activeAtOpen and one fallback.

**Fix:** Store the full opener chain: in the useState initializer, set fallbackOpener to below.fallbackOpener || below.activeAtOpen recursively, keeping an array of candidates. In restoreFocus, walk the array until an element is still connected. As a final fallback, focus document.querySelector('.aw-menu-toggle:not([hidden])') or the first focusable in <main>.

**Files:** `src/components/ModalLayer.jsx:83`, `src/components/ModalLayer.jsx:98`

- [ ] Done

#### AW-250 · The #/apply checklist omits the optional documents and uses 'checked' tick boxes for items not yet done

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/apply 'Application checklist' and the modal 'What you’ll need'

**Problem:** The five items (EIN, license #, resale #, store details, account contact) never mention that a photo/PDF of the license and resale certificate can be uploaded, although the form asks for them. Each item is prefixed with a filled orange ✓ box (index.css:692) plus '01 ·' numbering, so requirements look already completed and are marked twice.

**Also seen:**
- #/apply → Application checklist card; application dialog checklist — '.checklist li::before' (index.css:692) draws a filled orange square with '✓' before every requirement ('01 · Federal EIN', etc.). Items the applicant has not gathered yet look completed, which works against the 'have these ready' message. The #/apply version also repeats numbering ('01 ·') next to the tick.
- Apply dialog 'What you'll need' (Sign Up → checklist) and #/apply 'Application checklist' — .checklist li::before draws a 20–24px filled orange (#ed5a21) square with a white ✓ (index.css:692, 697). The static 'What you'll need' list (Federal EIN, State retail tobacco license number, …) therefore looks like five checkbox inputs already ticked, which suggests the requirements are done and the items can be clicked.

**Fix:** Render the 'What you'll need' checklist as a plain numbered/bulleted list with neutral icons, not orange ticked checkboxes that look already done, and include the optional documents (onboarding.js:5; index.css:692-697; ApplyPage.jsx:34; AuthModal.jsx:217).

**Files:** `src/components/AuthModal.jsx:217`, `src/data/onboarding.js:5`, `src/index.css:692`, `src/index.css:696-697`, `src/index.css:697`, `src/pages/support/ApplyPage.jsx:31`, `src/pages/support/ApplyPage.jsx:34`

**Evidence:** [auth/checklist-modal-1440.jpg](screenshots/auth__checklist-modal-1440.jpg), [support/apply-1440-checklist-card.jpg](screenshots/support__apply-1440-checklist-card.jpg), [design/apply-checklist-dialog-1440.jpg](screenshots/design__apply-checklist-dialog-1440.jpg), [design/apply-1440-light.jpg](screenshots/design__apply-1440-light.jpg)

- [ ] Done

#### AW-251 · HEIC sequence files pass client validation but are rejected by the bucket

**Low** · functional-bug · Who: **Cursor** · Effort: S · New

**Where:** Document upload (signup and #/apply pending panel)

**Problem:** documents.js accepts MIME 'image/heic-sequence' and 'image/heif-sequence' (lines 27-28), and contentTypeFor returns that MIME unchanged (:75). The bucket's allowed_mime_types is only pdf/jpeg/png/heic/heif (application_documents.sql:15). Some iPhone photos report the sequence type, so the upload fails with a raw storage error after passing client checks.

**Fix:** In contentTypeFor, map 'image/heic-sequence' → 'image/heic' and 'image/heif-sequence' → 'image/heif' before returning. Alternatively, add both sequence types to the bucket's allowed_mime_types in a new migration.

**Files:** `src/lib/documents.js:20`, `src/lib/documents.js:72`, `supabase/migrations/20260927180000_application_documents.sql:15`

- [ ] Done

#### AW-252 · My account has no Change password or Sign out control

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all (mobile especially)

**Where:** #/account (signed in)

**Problem:** AccountPage renders the profile heading, stats, Quick Reorder and order history, but no link to #/reset-password (the only place to change a password) and no Sign out. On phones, Sign Out exists only inside the hamburger menu (the header Sign Out has class aw-desktop-only, App.jsx:489).

**Fix:** Pass onSignOut={handleLogout} and navigate to AccountPage. Under the email in the page head (AccountPage.jsx:83), add a .dialog-actions row with text buttons 'Change password' (navigate({ page: 'reset-password' })) and 'Sign out' (onSignOut).

**Files:** `src/App.jsx:489`, `src/pages/account/AccountPage.jsx:75`

- [ ] Done

## Onboarding & password-recovery states

#### AW-093 · Sign-up confirmation and password-reset email content isn't in the repo and is probably Supabase's unbranded default: no Alabama Wholesale name, logo, phone or next steps

**Medium** · content-copy · Who: **Owner → Cursor** · Effort: M · New

**Where:** Transactional email: 'Apply for an account' → Submit application → confirmation email; Sign in → Forgot password? → reset email

**Problem:** supabase/ has only migrations/ and seed/; there is no config.toml and no templates/ directory. BACKEND.md:74-83 never mentions email templates ('You'll get a confirmation email from Supabase.'). The public auth settings (GET /auth/v1/settings) show mailer_autoconfirm=false, so every applicant receives a confirmation email and signUp returns no session. src/lib/useAuth.js:67-73 calls auth.signUp without emailRedirectTo; :95 sets the reset redirect to `${origin}/`. Unless someone edited the templates in Dashboard → Authentication → Emails, applicants get Supabase's stock 'Confirm your signup' / 'Reset your password' email. That email has no business name, logo, phone, hours, 21+/licensed-only line, expiry or next steps (trade review, uploading documents on #/apply). This contradicts the dialog's 'We sent a confirmation link to …' framing. An unbranded reset email reads like phishing. Owner action: check the dashboard templates.

**Fix:** Apply the original fix (supabase/templates/confirmation.html and recovery.html with the header/footer shell, supabase/config.toml [auth] site_url / additional_redirect_urls / [auth.email] otp_expiry / [auth.email.template.*] subject + content_path, the same HTML and subjects pasted into Dashboard → Authentication → Emails → Templates, and the BACKEND.md update), with these corrections. (a) In the confirmation template's 'What happens next' step 2, replace 'open Trade account' with a direct link: <a href='https://alabamawholesaleinc.com/#/apply' style='color:#281459'>upload your license and resale certificate</a>. #/apply is the only page with the upload panel, and the header has no 'Trade account' item. (b) Keep `emailRedirectTo: `${window.location.origin}/?welcome=confirmed`` in useAuth.js signUp options (line 70), add the URL to the redirect allow list, and build the landing state under the known 'no landing state after confirming' finding rather than here. (c) Take the phone, address and hours in the template footer from src/data/content.js COMPANY ((205) 354-4473; 613 Graymont Ave N, Birmingham, AL 35203; Mon–Fri 7:00 AM – 6:00 PM, Sat–Sun 8:00 AM – 5:30 PM), and note in BACKEND.md that the template footer must be updated whenever COMPANY changes.

**Owner input needed:** Confirm the production site URL (alabamawholesaleinc.com) and the sender name/logo for the emails, and agree to paste the branded confirmation and reset templates Cursor writes into Supabase Dashboard > Authentication > Emails.

**Files:** `BACKEND.md:74`, `BACKEND.md:81`, `src/lib/useAuth.js:67`, `src/lib/useAuth.js:95`

- [ ] Done

#### AW-094 · License-document status shows 'Not uploaded' for files that are uploading or already saved (two uploads at once, or an upload made while the list is still loading)

**Medium** · functional-bug · Who: **Cursor** · Effort: M · New · Viewports: all (tested 1440x900)

**Where:** #/apply (signed in, pending) → 'License documents' panel → the status line under each file input

**Problem:** Uploads were mocked locally with a 2.5 s delay. Repro A, two uploads: choose the license, then the resale certificate 0.3 s later. At t=1.0 s the license reads 'Not uploaded' with its input re-enabled while its upload is still running. At t=2.9 s the license has finished, but the resale reads 'Not uploaded' with its input enabled while its upload is still running. Both show correctly only at t=4.4 s. Cause: busyType is a single string (DocumentUploads.jsx:115). Picking the second file overwrites it, and the first upload's finally block sets it to null (:155). Repro B, stale list: the initial list GET is slow (3 s) and shows 'Checking…', but both inputs stay enabled. Upload the license during the check: at t=1.5 s it shows 'Uploaded on September 28, 2026 · TEST-ONLY-license.pdf'. At t=4.0 s the stale initial response lands and sets it back to 'Not uploaded', although the server row exists (1 row). Cause: the initial effect (:126-128) sets records unconditionally. A buyer who sees 'Not uploaded' re-uploads or emails the files.

**Fix:** In ApplicationDocuments, replace `const [busyType, setBusyType] = useState(null)` with `const [busy, setBusy] = useState({})`. In onPick call `setBusy(b => ({ ...b, [type]: true }))`, and in finally (still guarded by the token) call `setBusy(b => ({ ...b, [type]: false }))`. Pass `busy` to DocumentFields instead of busyType and compute `const isBusy = !!busy?.[doc.id]` at line 54. Disable the controls until the first list has loaded: `controlsDisabled = disabled || !isBackendConfigured || loading || !userId || records == null`. Also add `const touched = useRef(false)`, set it true at the start of onPick, and in the initial list effect only apply the rows when !touched.current (or merge by keeping the newer uploaded_at per document_type).

**Files:** `src/components/DocumentUploads.jsx:54`, `src/components/DocumentUploads.jsx:71`, `src/components/DocumentUploads.jsx:115`, `src/components/DocumentUploads.jsx:118`, `src/components/DocumentUploads.jsx:126`, `src/components/DocumentUploads.jsx:138`, `src/components/DocumentUploads.jsx:155`

**Evidence:** [gap2-onboarding-recovery-states/apply-docs-concurrent-both-inflight-clean-1440.jpg](screenshots/gap2-onboarding-recovery-states__apply-docs-concurrent-both-inflight-clean-1440.jpg), [gap2-onboarding-recovery-states/apply-docs-concurrent-resale-inflight-clean-1440.jpg](screenshots/gap2-onboarding-recovery-states__apply-docs-concurrent-resale-inflight-clean-1440.jpg), [gap2-onboarding-recovery-states/apply-docs-stale-list-overwrites-upload-1440.jpg](screenshots/gap2-onboarding-recovery-states__apply-docs-stale-list-overwrites-upload-1440.jpg), [gap2-onboarding-recovery-states/apply-docs-checking-1440.jpg](screenshots/gap2-onboarding-recovery-states__apply-docs-checking-1440.jpg)

- [ ] Done

#### AW-095 · After a failed upload the input still shows the failed file next to the old 'Uploaded' line, and picking the same file again does not retry

**Medium** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: all (tested 1440x900)

**Where:** #/apply (signed in, pending) → 'License documents' → choose a file whose upload fails

**Problem:** Replacing the uploaded resale certificate with a storage upload fulfilled locally as 413 leaves three messages that contradict each other: the native input shows 'TEST-ONLY-license.pdf' (the file that failed), the status line still reads 'Uploaded on September 28, 2026 · TEST-ONLY-resale.pdf', and the error line reads 'The object exceeded the maximum allowed size'. The same happens with a 400. onChange clears event.target.value only when client validation fails (DocumentUploads.jsx:34-35), so after any upload the input keeps its file. In Chrome and Safari, choosing the same file again fires no change event, so 'You can try again' (documents.js:45) cannot work without first choosing a different file. The status line never names the file that failed. (Raw error text and the filename shown twice are known and not re-reported.)

**Fix:** In DocumentFields onChange, read the file and then always reset the input: `const file = event.target.files?.[0] || null; event.target.value = '';` (so re-choosing the same file fires change). In ApplicationDocuments keep the last attempted File per type: `const [attempt, setAttempt] = useState({})`, set in onPick before uploading. On error, render the status line as `Couldn’t upload ${attempt[type].name}.` followed by `<button type="button" className="text-link" onClick={() => onPick(type, attempt[type], null)}>Try again</button>`, and keep the previous 'Uploaded on … · <old name>' as a second line prefixed 'Still on file:'. Clear attempt[type] on success.

**Files:** `src/components/DocumentUploads.jsx:28`, `src/components/DocumentUploads.jsx:34`, `src/components/DocumentUploads.jsx:132`, `src/components/DocumentUploads.jsx:151`, `src/lib/documents.js:45`

**Evidence:** [gap2-onboarding-recovery-states/apply-docs-error-413-1440.jpg](screenshots/gap2-onboarding-recovery-states__apply-docs-error-413-1440.jpg), [gap2-onboarding-recovery-states/apply-docs-error-400-1440.jpg](screenshots/gap2-onboarding-recovery-states__apply-docs-error-400-1440.jpg)

- [ ] Done

#### AW-096 · After Submit application the confirmation step opens where the long form was scrolled, so on landscape phones 'Check your inbox', the email address and step 1 are off-screen

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: 844x390 (severe); 1280x720 and 390x844 (a few px)

**Where:** Auth dialog → application form scrolled to 'Submit application' → 'sent' ('Check your inbox') or 'status' ('Your account is pending approval') step

**Problem:** Scrolled the form to its submit button (as a user must), then switched the step with the React state hook. At 844x390 the form scrollTop was 905. The 'sent' step opened at scrollTop 347 with the H2 at y=-199: the first thing visible is step 2 'We review your application' and the Done button. The 'status' step opened at scrollTop 306 with the H2 at y=-158. At 1280x720 the offset is 17 px, and at 390x844 it is 9-26 px. The mode effect focuses the heading with preventScroll: true (AuthModal.jsx:69-72), so focus lands on an off-screen heading and nothing scrolls it into view. The same leftover offset affects 'reset' → 'reset-sent' (scrollTop 55 at 844x390).

**Fix:** In the step-change effect (AuthModal.jsx:69-72) reset the dialog's scroll before focusing: `const dlg = titleRef.current?.closest('.dialog'); if (dlg) dlg.scrollTop = 0; titleRef.current?.focus({ preventScroll: true });`.

**Files:** `src/components/AuthModal.jsx:69`, `src/components/AuthModal.jsx:71`, `src/index.css:435`

**Evidence:** [gap2-onboarding-recovery-states/dialog-sent-after-submit-scroll-844x390.jpg](screenshots/gap2-onboarding-recovery-states__dialog-sent-after-submit-scroll-844x390.jpg), [gap2-onboarding-recovery-states/dialog-status-after-submit-scroll-844x390.jpg](screenshots/gap2-onboarding-recovery-states__dialog-status-after-submit-scroll-844x390.jpg)

- [ ] Done

#### AW-097 · On the 'account on hold' sign-in step, the phone and email look like plain text, and the main button goes to a page that doesn't explain the hold

**Medium** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all (measured at 1440x900)

**Where:** Auth dialog → sign in with a suspended account → 'ACCOUNT ON HOLD / Your account needs attention' step

**Problem:** Computed styles of the two links in '.dialog > .desc': color rgb(95,88,98), the same as the paragraph; text-decoration none; font-weight 400. The tel: and mailto: links cannot be told apart from body text (WCAG 1.4.1). The preflight rule `a { color: inherit; text-decoration: none }` (index.css:48) is not overridden for .desc; only .form-error a and .dialog .form-grid a are styled (index.css:452-453). Calling or emailing is the only thing a suspended buyer can do, yet the primary button is 'View account status ↗', which opens #/account showing only 'ACCOUNT STATUS Suspended' (that page's missing explanation is known). The same unstyled-link rule applies to any future TradeDesk link placed in .desc.

**Fix:** Add to index.css after line 442: `.dialog > .desc a { color: var(--purple); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }`. In AuthModal.jsx status actions (314-318), when status === 'suspended', render `<a className="button" href={`tel:${COMPANY.phoneRaw}`} data-autofocus>Call {COMPANY.phone}</a>`, then `<a className="button ghost" href={`mailto:${COMPANY.email}`}>Email the trade desk</a>`, then the 'Close' text-link. Keep 'View account status' only for pending.

**Files:** `src/components/AuthModal.jsx:43`, `src/components/AuthModal.jsx:177`, `src/components/AuthModal.jsx:314`, `src/index.css:442`, `src/index.css:452`

**Evidence:** [gap2-onboarding-recovery-states/dialog-suspended-desc-links-1440.jpg](screenshots/gap2-onboarding-recovery-states__dialog-suspended-desc-links-1440.jpg), [gap2-onboarding-recovery-states/dialog-status-suspended-signin-1440.jpg](screenshots/gap2-onboarding-recovery-states__dialog-status-suspended-signin-1440.jpg), [gap2-onboarding-recovery-states/after-view-account-status-suspended-1440.jpg](screenshots/gap2-onboarding-recovery-states__after-view-account-status-suspended-1440.jpg)

- [ ] Done

#### AW-098 · The #/apply page head, intro, contact strip and tab title are written for someone who hasn't applied, even for signed-in pending, approved or suspended accounts

**Medium** · content-copy · Who: **Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all (1440x900, 390x844)

**Where:** #/apply signed in with status 'pending' → page head eyebrow and intro, bottom contact strip, document title

**Problem:** For a pending account: eyebrow 'OPEN AN ACCOUNT'; H1 'Your trade account'; intro 'Here is what to have ready, and what happens after you apply.' The pending view renders neither the checklist nor 'How it works' (both absent in the DOM), so the intro promises content that isn't there. The bottom strip reads 'RATHER TALK IT THROUGH? / Apply with a trade rep' to someone who already applied. document.title is 'Apply for a Trade Account · Alabama Wholesale Inc' while the H1 says 'Your trade account'. The known finding covers only approved and suspended accounts; these are the pending-specific strings. The explicit pending screen the 2026-09-25 audit asked for now exists, but its framing is still the apply page's.

**Also seen:**
- #/apply when signed in (StatusPanel states) — ApplyPage.jsx:16-17 switches the H1 to 'Your trade account' for any profile, but always keeps the intro '…Here is what to have ready, and what happens after you apply.', including for approved buyers. For status === 'suspended', line 26 renders the full checklist with 'Start application' (line 41-42), inviting a suspended account to apply again rather than call. I could not verify this live because signing in is out of scope.

**Fix:** In src/pages/support/ApplyPage.jsx (lines 16-17, 26-46, 61) and pageMeta, choose the copy from profile.status. Pending: 'APPLICATION UNDER REVIEW', what happens next and the document upload. Approved: 'Your trade account is active', with links to the catalog, My account and Quick Reorder, and no application checklist. Suspended: 'Account on hold', with what to do and the contact details. Guests keep the current 'Open an account' copy. Update the eyebrow, intro paragraph, the bottom contact-strip heading ('Apply with a trade rep') and the document title ('Apply for a Trade Account') to match each state.

**Files:** `src/App.jsx:115`, `src/pages/support/ApplyPage.jsx:16`, `src/pages/support/ApplyPage.jsx:16-17`, `src/pages/support/ApplyPage.jsx:17`, `src/pages/support/ApplyPage.jsx:26-46`, `src/pages/support/ApplyPage.jsx:61`

**Evidence:** [gap2-onboarding-recovery-states/apply-pending-1440-full.jpg](screenshots/gap2-onboarding-recovery-states__apply-pending-1440-full.jpg), [gap2-onboarding-recovery-states/apply-pending-390-full.jpg](screenshots/gap2-onboarding-recovery-states__apply-pending-390-full.jpg)

- [ ] Done

#### AW-099 · After both documents upload, the panel still says 'Optional … or send proof later': no 'received' summary, no way to open the uploaded file, and staff aren't notified

**Medium** · ux-flow · Who: **Owner → Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all (tested 1440x900, 390x844)

**Where:** #/apply (signed in, pending) → status panel and 'License documents' panel after both files upload; also the dialog 'status' step after a sign-up that uploaded files

**Problem:** #/apply, pending profile, 1440x900, uploads mocked 200. After both files upload, only the two per-file lines change, to 'Uploaded on September 28, 2026 · QA-ONLY-license.pdf' and '… · QA-ONLY-resale.pdf' (12px, weight 400, rgb(36,32,44), no success styling). The panel still reads 'WHILE YOUR APPLICATION IS PENDING | License documents | OPTIONAL DOCUMENTS | Upload your state retail tobacco license and resale certificate now, or send proof later to …', with ' Optional' after both labels. The status panel still reads 'A trade rep is reviewing your license information…'. The panel's only link is the email address; createDocumentViewUrl (documents.js:157) is used only by admin. supabase/migrations/20260927180000_application_documents.sql has no trigger or webhook on profile_documents.

**Fix:** In ApplicationDocuments (DocumentUploads.jsx) compute `const have = DOCUMENT_TYPES.filter(d => records?.some(r => r.document_type === d.id)).length;`. Above <DocumentFields> render <p className="doc-summary" role="status">{have === 2 ? 'Both documents received. A trade rep will check them with your application; nothing else is needed.' : have === 1 ? '1 of 2 documents received.' : 'No documents yet. Uploading them now speeds up approval.'}</p>. In DocumentFields, when showStatus is true, omit the ' Optional' span (line 63) and replace the note at line 42 with 'Uploading a new file replaces the one on file.'. When showStatus && record, render a 'View' text-link button after the status text: onClick={async () => { const url = await createDocumentViewUrl(record.storage_path); if (url) window.open(url, '_blank', 'noopener'); }}. Add CSS after index.css:803: `.doc-status[data-document-status=uploaded] { font-weight: 600; color: var(--purple); } .doc-status[data-document-status=uploaded]::before { content: '✓ '; }`. Skip the AuthModal status-step change: it's unreachable while email confirmation is on. For staff: add a Supabase Database Webhook (Dashboard → Database → Webhooks) on INSERT and UPDATE of public.profile_documents that POSTs to a new Edge Function `notify-trade-desk`, which emails the trade desk the business name and document type. Build it so the same function can later serve the known order-notification finding.

**Owner input needed:** Which staff email address (or channel) should be notified when an applicant uploads license documents, and how quickly will a trade rep review them?

**Files:** `src/components/DocumentUploads.jsx:41`, `src/components/DocumentUploads.jsx:42`, `src/components/DocumentUploads.jsx:63`, `src/components/DocumentUploads.jsx:77`, `src/components/DocumentUploads.jsx:160`, `src/index.css:803`, `src/lib/documents.js:157`, `src/pages/support/ApplyPage.jsx:74`, `supabase/migrations/20260927180000_application_documents.sql:22`

**Evidence:** [gap2-onboarding-recovery-states/apply-pending-both-uploaded-1440.jpg](screenshots/gap2-onboarding-recovery-states__apply-pending-both-uploaded-1440.jpg), [gap2-onboarding-recovery-states/apply-docs-license-uploaded-1440.jpg](screenshots/gap2-onboarding-recovery-states__apply-docs-license-uploaded-1440.jpg), [gap2-onboarding-recovery-states/dialog-status-aftersignup-1440.jpg](screenshots/gap2-onboarding-recovery-states__dialog-status-aftersignup-1440.jpg)

- [ ] Done

#### AW-253 · Pressing Cancel on the password-reset form leaves the account signed in on that device, with no message

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all (tested 1440x900)

**Where:** #/reset-password opened from a reset email link → 'RESET LINK CONFIRMED' form → Cancel

**Problem:** Local fake recovery fragment at 1440x900. After the form loads, clicking Cancel lands on #/ with header 'QA ONLY Store / Sign Out' and localStorage 'aw-auth' present. The form and the page intro never say the link signed the user in. The intro reads 'Your trade account stays signed in once it is saved.' For a signed-in user (no link), Cancel always goes to #/ rather than back.

**Fix:** In ResetPasswordPage.jsx, when `recovery` is true, add under the h2 (line 58): <p className="field-hint">Opening this link signed you in on this device. Save a new password, or choose ‘Cancel and sign out’.</p>. Replace the single Cancel (line 73) with two text buttons. 'Cancel' calls finish('account'), so the user lands where the session is visible. 'Cancel and sign out' has onClick={async () => { await auth.signOut(); finish('home'); }}. auth.signOut already exists; pass it down or read it from auth, and no new hook is needed. Change the PageHead intro (line 99) to: 'Pick a password of at least 8 characters that you don’t use anywhere else.' For the signed-in, no-link case, Cancel should call window.history.length > 1 ? window.history.back() : navigate({ page: 'account' }).

**Files:** `src/lib/useAuth.js:84`, `src/lib/useAuth.js:105`, `src/pages/support/ResetPasswordPage.jsx:18`, `src/pages/support/ResetPasswordPage.jsx:57`, `src/pages/support/ResetPasswordPage.jsx:73`

**Evidence:** [gap2-onboarding-recovery-states/reset-recovery-form-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-recovery-form-1440.jpg), [gap2-onboarding-recovery-states/reset-recovery-after-cancel-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-recovery-after-cancel-1440.jpg)

- [ ] Done

#### AW-254 · Approved and suspended accounts cannot see, replace or add license documents anywhere

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all (1440x900, 390x844)

**Where:** #/apply signed in as approved or suspended (no documents panel); #/account (none)

**Problem:** ApplicationDocuments renders only when profile.status === 'pending' (ApplyPage.jsx:22). The measured DOM has no .doc-panel for approved or suspended accounts, and My account has no document section. Tobacco licenses and resale or exemption certificates expire and are renewed, and a suspension is often a paperwork problem (expired license). Yet a suspended buyer is told only to call, and an approved buyer has no way to send a renewed license, although the RLS policies already allow owners to update their own rows and objects.

**Fix:** In ApplyPage.jsx:22 render the panel for every signed-in profile: `{profile && <ApplicationDocuments status={profile.status} disabled={!isBackendConfigured} />}`. Add a `status` prop to ApplicationDocuments and set the eyebrow at DocumentUploads.jsx:161 from it: pending 'WHILE YOUR APPLICATION IS PENDING', approved 'KEEP YOUR LICENSE ON FILE', suspended 'SEND UPDATED PROOF'. In the suspended StatusPanel copy (ApplyPage.jsx:80-82) append 'If your license or resale certificate has changed, upload the new one below.' In AccountPage.jsx, after the account-stats block (lines 86-94), add <p className="notice">License and resale documents: <button className="text-link" type="button" onClick={() => navigate({ page: 'apply' })}>view or replace</button></p>. AccountPage has no navigate prop today, so pass `navigate` from App.jsx:329.

**Files:** `src/components/DocumentUploads.jsx:161`, `src/pages/account/AccountPage.jsx:86`, `src/pages/support/ApplyPage.jsx:22`, `src/pages/support/ApplyPage.jsx:80`

**Evidence:** [gap2-onboarding-recovery-states/apply-approved-1440-full.jpg](screenshots/gap2-onboarding-recovery-states__apply-approved-1440-full.jpg), [gap2-onboarding-recovery-states/apply-suspended-1440-full.jpg](screenshots/gap2-onboarding-recovery-states__apply-suspended-1440-full.jpg)

- [ ] Done

#### AW-255 · The Reset Password page head never changes: 'Choose a new password' shows in the signed-out, checking and done states, none of which has a password form

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all (1440x900, 390x844)

**Where:** #/reset-password → page head (eyebrow, H1, intro, tab title) in the checking and done states

**Problem:** PageHead is static (ResetPasswordPage.jsx:98-100). Measured: while checking, the H1 'Choose a new password' and the intro sit above a single 12px line 'Checking your reset link…'. In the done state the same 75px H1 and 'Pick a password … stays signed in once it is saved' sit directly above 'ALL SET / Password updated'. In the 'LINK NOT VALID' state (reachable by signing out mid-reset) the H1 still instructs the user to choose a password. The tab title stays 'Reset Password · Alabama Wholesale Inc' after success. (The signed-out 'Request a reset link' state is already a known finding; these are the other states.)

**Also seen:**
- #/reset-password signed out — The page reads H1 'Choose a new password' and 'Pick a password of at least 8 characters… Your trade account stays signed in once it is saved.', then a panel 'Request a reset link' whose button says 'Request a new reset link', even though the visitor has not requested one. The heading and intro describe a form that is not there.

**Fix:** In src/pages/support/ResetPasswordPage.jsx (~35-99), set the PageHead eyebrow, H1, intro and document title from the current state. Signed out: 'Reset your password' with request-a-link copy. Checking: 'Checking your reset link'. Form: 'Choose a new password' with the 8-character guidance. Done: 'Password updated'. Invalid or expired: 'Link not valid'. Show the 'Pick a password of at least 8 characters' intro only when the form is on screen.

**Files:** `src/App.jsx:116`, `src/pages/support/ResetPasswordPage.jsx:35`, `src/pages/support/ResetPasswordPage.jsx:89`, `src/pages/support/ResetPasswordPage.jsx:98`, `src/pages/support/ResetPasswordPage.jsx:99`

**Evidence:** [gap2-onboarding-recovery-states/reset-done-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-done-1440.jpg), [gap2-onboarding-recovery-states/reset-recovery-checking-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-recovery-checking-1440.jpg), [gap2-onboarding-recovery-states/reset-done-390.jpg](screenshots/gap2-onboarding-recovery-states__reset-done-390.jpg), [auth/page-reset-password-1440.jpg](screenshots/auth__page-reset-password-1440.jpg), [auth/vp-reset-password-390.jpg](screenshots/auth__vp-reset-password-390.jpg), [copy/reset-password-signed-out.jpg](screenshots/copy__reset-password-signed-out.jpg)

- [ ] Done

#### AW-256 · Reset page state changes never move focus or announce anything: the new-password field isn't focused and 'Password updated' is silent

**Low** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/reset-password → checking → form → done

**Problem:** After the recovery check resolves, document.activeElement is BODY (1440 and 390). The input carries data-autofocus (ResetPasswordPage.jsx:62), but only ModalLayer reads that attribute, so it does nothing on a page. When the save succeeds, the submit button unmounts and focus falls to BODY. The 'Password updated' panel (:40) has no role=status or heading focus, so screen-reader users get no confirmation. Only 'Checking your reset link…' has role=status.

**Fix:** Add `const passRef = useRef(null); const doneRef = useRef(null);`. Add `useEffect(() => { if (session && !done) passRef.current?.focus(); }, [!!session, done]);` and `useEffect(() => { if (done) doneRef.current?.focus(); }, [done]);`. Put ref={passRef} on #reset-password and remove data-autofocus. Give the done H2 `ref={doneRef} tabIndex={-1}` and the done panel role="status".

**Files:** `src/pages/support/ResetPasswordPage.jsx:38`, `src/pages/support/ResetPasswordPage.jsx:40`, `src/pages/support/ResetPasswordPage.jsx:62`

**Evidence:** [gap2-onboarding-recovery-states/reset-recovery-form-390.jpg](screenshots/gap2-onboarding-recovery-states__reset-recovery-form-390.jpg)

- [ ] Done

#### AW-257 · Keyboard focus is thrown to <body> while a document uploads, because the focused file input is disabled

**Low** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all (tested 1440x900)

**Where:** #/apply (signed in, pending) → 'License documents' → file input during 'Uploading…'

**Problem:** Focus #apply-doc-tobacco_license, then choose a file: during the upload activeElement is BODY and the input is disabled. The next Tab starts from the top of the document order. After the upload finishes, focus is not restored. Cause: `disabled={disabled || busy}` (DocumentUploads.jsx:71). A keyboard or screen-reader user loses their place on every upload.

**Fix:** Don't disable the busy input. Use `aria-disabled={busy ? 'true' : undefined}` and at the top of onChange add `if (busy) { event.target.value = ''; return; }`. Keep `disabled` only for the whole-fieldset cases (backend missing or signed out). Leave the 'Uploading…' status line with aria-live as is.

**Files:** `src/components/DocumentUploads.jsx:28`, `src/components/DocumentUploads.jsx:71`

**Evidence:** [gap2-onboarding-recovery-states/apply-docs-uploading-1440.jpg](screenshots/gap2-onboarding-recovery-states__apply-docs-uploading-1440.jpg)

- [ ] Done

#### AW-258 · Pending #/apply stacks two differently framed panels and four layers of labels ('WHILE YOUR APPLICATION IS PENDING' / 'License documents' / 'OPTIONAL DOCUMENTS' / 'Optional')

**Low** · visual-design · Who: **Cursor** · Effort: S · Partly fixed since the 2026-09-25 audit · Viewports: all (1440x900, 390x844)

**Where:** #/apply signed in, pending → .status-panel followed by .doc-panel

**Problem:** #/apply, pending profile. At 1440: .status-panel has border-left 6px, border-top 1px, padding 30px 32px (from `.contact-strip, .support-cta, .status-panel, .eligibility`), H2 'Pending approval' 34px. .doc-panel 22px below has border-left 1px, border-top 4px, padding 28px, eyebrow 'WHILE YOUR APPLICATION IS PENDING', H2 'License documents' 30px, legend 'OPTIONAL DOCUMENTS' 11px, and ' Optional' after both field labels. 'Pending' appears in both the status H2 and the documents eyebrow. At 390: pending buttons 'View account ↗' and 'Browse the catalog' stack (x=46, y=724 and y=780, 150px wide). Approved buttons sit side by side (x=46 and x=198). (The eyebrow-size mismatch is the known paragraph-selector finding.)

**Fix:** Change .doc-panel (index.css:805) to `margin-top: 22px; padding: 30px 32px; background: var(--paper); border: 1px solid var(--line); border-left: 6px solid var(--orange);`, and .doc-panel h2 (index.css:807) to font-size 34px (30px at ≤600px), so it matches .status-panel. Delete the 'WHILE YOUR APPLICATION IS PENDING' eyebrow (DocumentUploads.jsx:161). In DocumentFields, when showStatus is true, give the <legend> (line 41) className="sr-only" and omit the ' Optional' span (line 63). In the ≤600px media block add `.status-panel .contact-strip-actions .button { flex: 1 1 100%; justify-content: center; }` so every status stacks the same way. Eyebrow sizes: fix them under the known paragraph-selector finding by scoping `.status-panel p` (index.css:663), `.contact-strip p` (:650) and `.page-head > p` to `:not(.eyebrow)`.

**Files:** `src/components/DocumentUploads.jsx:41`, `src/components/DocumentUploads.jsx:63`, `src/components/DocumentUploads.jsx:161`, `src/index.css:660`, `src/index.css:805`, `src/index.css:807`

**Evidence:** [gap2-onboarding-recovery-states/apply-pending-initial-1440.jpg](screenshots/gap2-onboarding-recovery-states__apply-pending-initial-1440.jpg), [gap2-onboarding-recovery-states/apply-pending-390-panels.jpg](screenshots/gap2-onboarding-recovery-states__apply-pending-390-panels.jpg), [gap2-onboarding-recovery-states/apply-approved-390-panels.jpg](screenshots/gap2-onboarding-recovery-states__apply-approved-390-panels.jpg)

- [ ] Done

#### AW-259 · The password-reset 'Check your inbox' step says 'call us' with no number, has no resend, and 'Back to sign in' loses the email just typed

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all (1440x900, 390x844, 844x390)

**Where:** Auth dialog → Sign in → Forgot password? → Send reset link → 'PASSWORD HELP / Check your inbox' (reset-sent)

**Problem:** Reproduced at 1440x900 and 390x844 through the real UI; screenshots in screenshots/qa-gap2-onboarding-recovery-states__reset-sent-1440.jpg and reset-sent-390.png. Desc text: 'If an account exists for test@example.test, a password reset link is on its way. The link works once — if it doesn’t arrive within a few minutes, check your spam folder or call us.' (0 anchors). Actions: ['Done ↗', 'Back to sign in']. After 'Back to sign in', #aw-email = ''. After 'Forgot password?' again, #aw-reset-email = ''. Only the checklist (line 222) and status (lines 179, 310) steps render <TradeDesk />.

**Fix:** 1) AuthModal.jsx:176: change the end of the sentence to `…check your spam folder. Still nothing? <TradeDesk />.` so it reads 'Still nothing? Call (205) 354-4473 or email ….' Do not insert TradeDesk after 'or', because it begins with a capital 'Call' and already contains 'or'. 2) Add `const [resendIn, setResendIn] = useState(0);` plus a `useEffect` that counts it down once a second while it is > 0. In handleReset, after a successful `resetPassword` call, run `setResendIn(60)` (Supabase allows one recover request per email every 60 s). 3) In the reset-sent actions (lines 338-341), add `<button className="text-link" type="button" disabled={submitting || resendIn > 0} onClick={handleReset}>{resendIn > 0 ? `Send again in ${resendIn}s` : 'Send again'}</button>`. 4) Line 340 'Back to sign in': `onClick={() => { setSignin(s => ({ ...s, email: resetEmail })); switchMode('signin'); }}`. 5) Line 202: `setResetEmail(signin.email || resetEmail)`.

**Files:** `src/components/AuthModal.jsx:176`, `src/components/AuthModal.jsx:202`, `src/components/AuthModal.jsx:337`

**Evidence:** [gap2-onboarding-recovery-states/dialog-reset-sent-1440.jpg](screenshots/gap2-onboarding-recovery-states__dialog-reset-sent-1440.jpg), [gap2-onboarding-recovery-states/dialog-reset-sent-390.jpg](screenshots/gap2-onboarding-recovery-states__dialog-reset-sent-390.jpg)

- [ ] Done

#### AW-260 · Post-submit dialog steps repeat themselves: the email appears three times on 'Check your inbox', 'Sign in' is offered before the email is confirmed, and 'While you wait' ticks three non-tasks

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all (1440x900, 390x844, 844x390)

**Where:** Auth dialog → 'CONFIRM YOUR EMAIL / Check your inbox' (sent) and 'APPLICATION UNDER REVIEW / Your account is pending approval' (status)

**Problem:** Rendered via the React state hook at 1440x900 and 390x844 with signup.email = test@example.test. The 'sent' dialog text contains 'test@example.test' 3 times: 'We sent a confirmation link to test@example.test…', 'Open the link we sent to test@example.test…' and 'We’ll contact you at test@example.test or 000-000-0000…'. Step 1 innerHTML ends '…Already have an account with this email? Sign in instead.</span>' (not a link). Status step actions: ['View account status ↗', 'Browse the catalog', 'Close']. The first bullet is also 'Browse the catalog.'. Dialog at 390: scrollHeight 801, clientHeight 792. Screenshots: screenshots/qa-gap2-onboarding-recovery-states__dialog-sent-1440.jpg, dialog-sent-390.png, dialog-status-1440.png, dialog-status-390.png

**Fix:** AuthModal.jsx:173: change to `<p className="desc">We sent a confirmation link to <strong>{signup.email}</strong>. Click it to activate your account.</p>`. Line 286: change the span to `Open the link in that email. Not there after a few minutes? Check your spam folder. Already have an account with this email? <button className="text-link" type="button" onClick={() => { setSignin(s => ({ ...s, email: signup.email })); switchMode('signin'); }}>Sign in instead</button>.` so the sentence becomes a real control and the address is not repeated. Line 288: `We’ll email you or call {signup.phone} when your account is approved. Wholesale pricing and ordering unlock then.` (drop the third copy of the address). Line 296: keep the 'Sign in' text-link but give it the same onClick that pre-fills signin.email with signup.email. Line 308: delete the 'Browse the catalog.' <li>, because the 'Browse the catalog' action at line 316 already covers it. Leave the ✓ tick styling to the already-known checklist finding.

**Files:** `src/components/AuthModal.jsx:173`, `src/components/AuthModal.jsx:286`, `src/components/AuthModal.jsx:288`, `src/components/AuthModal.jsx:296`, `src/components/AuthModal.jsx:306`

**Evidence:** [gap2-onboarding-recovery-states/dialog-sent-1440.jpg](screenshots/gap2-onboarding-recovery-states__dialog-sent-1440.jpg), [gap2-onboarding-recovery-states/dialog-sent-390.jpg](screenshots/gap2-onboarding-recovery-states__dialog-sent-390.jpg), [gap2-onboarding-recovery-states/dialog-status-pending-signin-1440.jpg](screenshots/gap2-onboarding-recovery-states__dialog-status-pending-signin-1440.jpg)

- [ ] Done

#### AW-261 · Reset-page status panels squeeze their text into a 290px column inside a 720px box, breaking the phone number

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 851px and wider (measured 900, 1024, 1440)

**Where:** #/reset-password → 'Request a reset link', 'LINK NOT VALID' and 'Password updated' panels (.reset-layout .status-panel)

**Problem:** Measured on .reset-layout .status-panel: layoutW 720, textW 290, actW 331, flexShrink '0', flexDirection 'row' at 900, 1024 and 1440. Paragraph lines: 5 for signed-out, 6 for the link-invalid panel. Telephone link getClientRects in the link-invalid panel: ['733:73', '756:32'], so it breaks. Done panel: textW 254, 3 lines, last line 14px wide ('in.'). Screenshots: screenshots/qa-gap2-onboarding-recovery-states__reset-recovery-invalid-panel-1440.jpg, reset-signedout-panel-1440.png, reset-done-panel-1440.png

**Fix:** Stack these panels: add `.reset-layout .status-panel { flex-direction: column; align-items: flex-start; }` after index.css:718, and add `.status-panel a[href^='tel:'] { white-space: nowrap; }`. The text then gets the full 720px width and the buttons sit under it.

**Files:** `src/index.css:646`, `src/index.css:654`, `src/index.css:717`, `src/index.css:718`

**Evidence:** [gap2-onboarding-recovery-states/reset-signedout-panel-squeezed-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-signedout-panel-squeezed-1440.jpg), [gap2-onboarding-recovery-states/reset-recovery-signout-shows-expired-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-recovery-signout-shows-expired-1440.jpg), [gap2-onboarding-recovery-states/reset-done-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-done-1440.jpg)

- [ ] Done

#### AW-262 · The 'New password for <email>' heading breaks the email mid-word at 30px on phones, under a redundant 'SIGNED IN' eyebrow

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 390x844 (and any phone)

**Where:** #/reset-password signed in (or via a reset link) → .reset-form H2

**Problem:** At 390: fontSize 30px, wordBreak 'break-word', H2 width 300px. Line breakdown for 'testonlyfoodmart@gmail.com': ['New password for ', 'testonlyfoodmart@gmail.co', 'm'] (88px tall). 'buyer@example.test' and 'orders@testonlymarket.test' fit. Screenshots: screenshots/qa-gap2-onboarding-recovery-states__reset-signedin-h2-390-gmail26.jpg, reset-signedin-h2-390-long.png

**Fix:** Change ResetPasswordPage.jsx:57-58 to `<p className="eyebrow">{recovery ? 'RESET LINK CONFIRMED' : 'YOUR ACCOUNT'}</p><h2 id="reset-form-title">Set a new password</h2><p className="reset-account">For <strong>{session.user?.email}</strong></p>`. Add CSS `.reset-account { margin: 0 0 16px; font-size: 14px; color: var(--muted); overflow-wrap: anywhere; }` and remove `word-break: break-word` from .reset-form h2 (index.css:721).

**Files:** `src/index.css:721`, `src/pages/support/ResetPasswordPage.jsx:57`, `src/pages/support/ResetPasswordPage.jsx:58`

**Evidence:** [gap2-onboarding-recovery-states/reset-signedin-390.jpg](screenshots/gap2-onboarding-recovery-states__reset-signedin-390.jpg), [gap2-onboarding-recovery-states/reset-signedin-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-signedin-1440.jpg)

- [ ] Done

#### AW-263 · 'Checking your reset link…' flashes for signed-in users who never used a link, and during a real check it's a single 12px grey line

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/reset-password → loading state (.support-note role=status)

**Problem:** Recorded transitions: signed-in direct load [{'Checking your reset link…', 1062 ms}, {'SIGNED IN / New password for buyer@example.test', 1145 ms}]; signed-out direct load [{'Checking your reset link…', 2922 ms}, {'RESET BY EMAIL / Request a reset link', 3096 ms}]. Recovery-link checking state: .support-note fontSize 12px, height 20px, no [aria-busy]. Screenshots: screenshots/qa-gap2-onboarding-recovery-states__reset-recovery-checking-1440.jpg, reset-recovery-checking-390.png

**Fix:** Change lines 52-53 to `body = <div className="reset-form" role="status" aria-busy="true"><p className="eyebrow">{recovery ? 'CHECKING YOUR LINK' : 'LOADING'}</p><p className="support-note">{recovery ? 'Checking your reset link…' : 'Loading your account…'}</p></div>;` so it keeps the form's frame, and delay rendering it by 300 ms (a `useState(false)` flag set by setTimeout) so fast loads don't flash.

**Files:** `src/index.css:621`, `src/pages/support/ResetPasswordPage.jsx:52`

**Evidence:** [gap2-onboarding-recovery-states/reset-recovery-checking-1440.jpg](screenshots/gap2-onboarding-recovery-states__reset-recovery-checking-1440.jpg), [gap2-onboarding-recovery-states/reset-recovery-checking-390.jpg](screenshots/gap2-onboarding-recovery-states__reset-recovery-checking-390.jpg)

- [ ] Done

#### AW-264 · Very long uploaded filenames run out of the documents panel and scroll the phone page sideways

**Low** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 390x844, 360x800

**Where:** #/apply (signed in, pending) → 'Uploaded on … · <filename>' status line (.doc-status)

**Problem:** At 390: clientW 300, scrollW 579, documentElement overflow 234px (91-character name). At 360: 52-character name gives scrollW 344 vs 270 and a 29px page overflow; 45-character name gives scrollW 287 vs 270 with no page overflow. Screenshot: screenshots/qa-gap2-onboarding-recovery-states__apply-doc-long-filename-390.jpg

**Fix:** Add `overflow-wrap: anywhere;` to .doc-status (index.css:803). In DocumentUploads.jsx:58 shorten the displayed name: `const shown = name.length > 40 ? `${name.slice(0, 26)}…${name.slice(-10)}` : name;`, and put the full name in a title attribute on the status <p>.

**Files:** `src/components/DocumentUploads.jsx:58`, `src/index.css:803`

**Evidence:** [gap2-onboarding-recovery-states/apply-pending-390-panels.jpg](screenshots/gap2-onboarding-recovery-states__apply-pending-390-panels.jpg)

- [ ] Done

## Signed-in buyer views & order confirmation

#### AW-020 · Admin Orders cards hide the delivery method, requested date and order total, and show 'Deliver to' on will-call orders

**High** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/admin → Orders tab → each .order-card header (.order-head small)

**Problem:** I mocked 24 orders as admin, each with delivery 'delivery' or 'willcall', preferred_date 2026-10-01, total_units and subtotal. The first card's header reads only: '9/26/2026, 10:04:09 AM · Birmingham Northside Convenience & Tobacco Outlet LLC · Test Contact · test0@example.test · 000-000-0000 · Deliver to 100 Test Street Suite 200, Testville AL 00000'. A regex test for '$<digit>' in the header returned false, so no order total is shown. Staff never see total_units or subtotal, whether the buyer chose Will-call pickup or delivery, or the requested date. submit_quote always requires a ship-to address, so every will-call order is also labelled 'Deliver to …'. The email and phone are plain text, not mailto:/tel: links. At 390px the header is a 66px run-on paragraph. AdminPage.jsx:109-111 renders only created_at, business, contact, email, phone, ship_* and tier. o.delivery, o.preferred_date, o.total_units and o.subtotal are never read, although the select('*') at line 71 already returns them.

**Fix:** In OrdersTab's .order-head (AdminPage.jsx:105-116), replace the single <small> run-on with a small definition list:
- 'Method': show 'Will-call pickup' when o.delivery === 'willcall', otherwise 'Delivery to {ship_street}, {ship_city}, {ship_state} {ship_zip}'. Render the address only for delivery.
- 'Requested': new Date(o.preferred_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), or '—'.
- 'Total': `${o.total_units} units · ${formatMoney(o.subtotal)}`, or 'Unpriced quote' when subtotal is null.
- 'Contact': the contact name, the email as <a href={`mailto:${o.email}`}> and the phone as <a href={`tel:${o.phone}`}>.
Lay it out as a 2-column grid (display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))) at 12–13px, and put the status select beside the ref number.

**Files:** `src/pages/admin/AdminPage.jsx:71`, `src/pages/admin/AdminPage.jsx:103-127`

**Evidence:** [gap1-approved-buyer/admin-many-orders-1440.jpg](screenshots/gap1-approved-buyer__admin-many-orders-1440.jpg), [gap1-approved-buyer/admin-many-orders-390.jpg](screenshots/gap1-approved-buyer__admin-many-orders-390.jpg)

- [ ] Done

#### AW-021 · Admin Accounts status, tier and role dropdowns are squeezed until their values are unreadable

**High** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: 1440, 1280, 1024, 390

**Where:** #/admin → Accounts tab → Status / Tier / Role <select> cells

**Problem:** Measured with the mocked admin and 9 profiles:
- 1440: status 91px, tier 77px, role 81px, clipped to 'suspende', 'standa', 'custom'.
- 1280: 83, 69 and 73px.
- 1024: 52, 37 and 41px; the tier shows only the chevron.
- 390: 41, 24 and 28px, inside a 356px-wide scroller with an 860px scrollWidth.
The Documents column is fixed at 244px because of .doc-admin { min-width: 220px } (index.css:810). Screenshots: screenshots/qv-gap1-approved-buyer__admin-accounts-1024.jpg, …/admin-accounts-1440.png, and after the fix …/admin-accounts-fixtest-1024.png

**Fix:** In src/index.css, split line 403 into two rules:
- `.aw-table input, .aw-table select { height: 34px; padding: 0 8px; border: 1px solid #d8d1c9; background: #fff; color: var(--ink); font-size: 12px; }`
- `.aw-table input { width: 100%; max-width: 220px; }` and `.aw-table select { width: auto; max-width: none; }`
At index.css:810, change `.doc-admin { … min-width: 220px; }` to `min-width: 0`.
Verified in the live page:
- 1024: the selects render at 101/88/92px and show 'suspended', 'standard' and 'customer' in full; the table fits (clientWidth 958 = scrollWidth 958).
- 1280: the same, with no overflow.
Optional: to stop 'Test Applicant 0' orphaning its digit, add className="aw-table accounts-table" to the <table> at AdminPage.jsx:184, and put `.accounts-table td:nth-child(2) { white-space: nowrap; }` inside `@media (min-width: 1200px)`. Do not apply nowrap to all .aw-table cells.

**Files:** `src/index.css:403`, `src/index.css:810`, `src/pages/admin/AdminPage.jsx:184`, `src/pages/admin/AdminPage.jsx:198-217`

**Evidence:** [gap1-approved-buyer/admin-accounts-selects-1440.jpg](screenshots/gap1-approved-buyer__admin-accounts-selects-1440.jpg), [gap1-approved-buyer/admin-many-accounts-1024-scrolled.jpg](screenshots/gap1-approved-buyer__admin-many-accounts-1024-scrolled.jpg), [gap1-approved-buyer/admin-accounts-selects-390.jpg](screenshots/gap1-approved-buyer__admin-accounts-selects-390.jpg)

- [ ] Done

#### AW-022 · Order confirmation screen shows only a thank-you and a reference: no items, delivery details, next step to order history, or print, and it disappears on reload

**High** · ux-flow · Who: **Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/quote → after 'Submit order' / 'Submit quote request' succeeds (step === 'submitted')

**Problem:** I fulfilled rpc/submit_quote locally with page.route. The RPC was intercepted (POST with 3 items). openAs saw no other writes and logs.blocked was empty, so nothing left the browser. As an approved silver buyer with 18 units in 3 lines, <main> contains only: 'ORDER RECEIVED / Thank you, TEST ONLY. / Your order has been saved. A trade desk rep will reach out within one business day at TEST ONLY to confirm details. / Reference number: ALW-Q-96435 / Call to discuss / Back to home'. Missing from the screen:
- line items and unit count;
- delivery method, requested date, ship-to and notes;
- a 'View order history' link to #/account;
- a Print or Save control.
The reference number, the one thing the buyer must keep, is 13px (inline style fontSize 13). document.title stays 'Checkout · Alabama Wholesale Inc' and the URL stays #/quote, so a reload or Back discards the receipt and shows the checkout form again. The pending-buyer variant ('QUOTE RECEIVED') is the same. The missing server-calculated total and the uncleared cart are already reported separately.

**Fix:** In QuotePage, snapshot the submitted `items` and `data` into the receipt state inside handleQuoteSubmit before setStep('submitted') (App.jsx:1196). Then render in the submitted branch (1216-1231):
1. The ref number as a 24px+ bold line with a copy button.
2. A compact table of the submitted lines (name, SKU, qty).
3. 'Delivery: Next-day delivery to {street, city, state zip}' or 'Will-call pickup', plus 'Requested date' and 'Notes'.
4. Buttons: 'View order history' (navigate({ page: 'account' })), 'Print' (window.print()) and 'Continue shopping'.
Also:
- set document.title = `${isApprovedBuyer ? 'Order' : 'Quote'} received · ${COMPANY.name}`;
- persist the receipt to sessionStorage under 'aw-last-receipt' and restore it when #/quote loads with that key present, so a reload keeps the confirmation.

**Files:** `src/App.jsx:1194-1198`, `src/App.jsx:1216-1231`, `src/lib/orders.js:33-34`

**Evidence:** [gap1-approved-buyer/receipt-silver-1440.jpg](screenshots/gap1-approved-buyer__receipt-silver-1440.jpg), [gap1-approved-buyer/receipt-silver-390.jpg](screenshots/gap1-approved-buyer__receipt-silver-390.jpg), [gap1-approved-buyer/receipt-pending-1440.jpg](screenshots/gap1-approved-buyer__receipt-pending-1440.jpg)

- [ ] Done

#### AW-100 · Quick Reorder: 'Add N lines to order' silently does nothing when any row has quantity 0 or a decimal, and 150,000 units are accepted

**Medium** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/account → Quick Reorder ('Reorder by SKU') form → 'Add N lines to order' button

**Problem:** Signed in as a silver buyer, I tested three cases:
- Case A: row 1 AW-KITE qty 3, row 2 AW-SS-RED qty 0. The button reads 'Add 1 line to order' and is enabled. Clicking it leaves aw-cart at '{}' with no summary: form.checkValidity() is false because the qty input has min=1 ('Value must be greater than or equal to 1'), so the browser blocks the submit and only shows a native tooltip. The app's own note says '1 line needs attention before it can be added', which implies the other line will go through.
- Case B: qty 2.5 counts as ready (rowQty floors it to 2) and the row shows no warning. The button reads 'Add 2 lines to order', but step=1 validation blocks it again with no in-app message.
- Case C: qty 150000 is accepted into the cart ('1::red':150000; summary 'Added 2 lines (150003 units)'), but enforce_order_item_price rejects qty > 100000, so the buyer only finds out at checkout through a generic save error.
Also, the qty-0 hint 'Enter a quantity of 1 or more' is grey 11px small text, while other row problems are orange (.qr-problem).

**Fix:** In QuickReorder.jsx:
1. Add noValidate to the <form> (line 51) so rows needing attention never block the ready ones.
2. Replace rowQty with `const rowQty = (row) => { const n = Number(row.qty); return Number.isInteger(n) && n >= 1 && n <= 100000 ? n : 0; };` so decimals and out-of-range values count as needing attention instead of being floored.
3. Add max="100000" to the qty input (line 73).
4. For an ok match with an invalid qty, render the hint as <p className="qr-problem">Enter a whole number from 1 to 100,000</p> instead of the grey small text on line 79.
5. Keep the enabled button's label equal to the number of lines that will actually be added.

**Files:** `src/pages/account/QuickReorder.jsx:13`, `src/pages/account/QuickReorder.jsx:28-29`, `src/pages/account/QuickReorder.jsx:36-48`, `src/pages/account/QuickReorder.jsx:51`, `src/pages/account/QuickReorder.jsx:73`, `src/pages/account/QuickReorder.jsx:79`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:72`

**Evidence:** [gap1-approved-buyer/qr-filled-1440.jpg](screenshots/gap1-approved-buyer__qr-filled-1440.jpg), [gap1-approved-buyer/qr-blocked-by-native-validation-1440.jpg](screenshots/gap1-approved-buyer__qr-blocked-by-native-validation-1440.jpg), [gap1-approved-buyer/qr-filled-390.jpg](screenshots/gap1-approved-buyer__qr-filled-390.jpg)

- [ ] Done

#### AW-101 · Suspended accounts are told they are 'Pending' and that pricing unlocks 'after approval', and My account gives them no explanation

**Medium** · content-copy · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Suspended profile: product cards, #/category/* intro and sidebar, #/product/<id> price block and link, cart drawer total, #/quote total, #/account

**Problem:** With status 'suspended' (tier silver):
- Every card shows 'Pricing after approval'.
- The CANDIES intro says 'Pricing unlocks after your account is approved.' and the sidebar says 'Pricing after approval / Your account is not approved for trade pricing yet.'
- The #/product/162 price block shows a 34px 'Pending' with 'PRICING UNLOCKS AFTER YOUR ACCOUNT IS APPROVED' and a 'View approval status' link.
- The drawer says 'Pricing unlocks when your account is approved'.
- #/quote says 'Pricing after approval'.
Following 'View approval status' lands on #/account, which shows the stat 'Suspended' with no notice at all: the .notice renders only for status === 'pending'. The site already has the right copy elsewhere, 'On hold' / 'Ordering is paused on this account. Call … and a trade rep will help you sort it out.' (ApplyPage.jsx:68,80-81; AuthModal.jsx:143,179), but the storefront never uses it.

**Fix:** In App.jsx, derive `const accountState = !profile ? 'guest' : profile.status` and pass it through `shared`. For 'suspended':
- cards (826-828): 'Account on hold';
- category intro (960) and sidebar (946): 'Ordering is paused on this account — call the trade desk.';
- PDP price block (1113-1115): <b>On hold</b><span>Ordering is paused — call {COMPANY.phone}</span>, and change the link (1134) to 'View account status';
- drawer (1426) and quote total (1290): 'Account on hold'.
In AccountPage.jsx after line 94, add `{profile.status === 'suspended' && <p className="notice">Ordering is paused on this account. Call {COMPANY.phone} or email {COMPANY.email} and a trade rep will help you sort it out.</p>}`, reusing the CallOrEmail helper from ApplyPage.

**Files:** `src/App.jsx:826-828`, `src/App.jsx:946`, `src/App.jsx:960`, `src/App.jsx:1113-1115`, `src/App.jsx:1132-1135`, `src/App.jsx:1290`, `src/App.jsx:1426`, `src/pages/account/AccountPage.jsx:92-94`, `src/pages/support/ApplyPage.jsx:80-81`

**Evidence:** [gap1-approved-buyer/pdp-suspended-162-1440-qty6.jpg](screenshots/gap1-approved-buyer__pdp-suspended-162-1440-qty6.jpg), [gap1-approved-buyer/state-suspended-candies-1440.jpg](screenshots/gap1-approved-buyer__state-suspended-candies-1440.jpg), [gap1-approved-buyer/account-suspended-1440.jpg](screenshots/gap1-approved-buyer__account-suspended-1440.jpg), [gap1-approved-buyer/drawer-suspended-3lines-1440.jpg](screenshots/gap1-approved-buyer__drawer-suspended-3lines-1440.jpg)

- [ ] Done

#### AW-102 · Checkout does not prefill the approved buyer's phone or store state, and has no saved ship-to address

**Medium** · ux-flow · Who: **Cursor** · Effort: M · Still open from the 2026-09-25 audit · Viewports: all

**Where:** #/quote as approved buyer → 'Your details' form (Phone, Street, City, State, ZIP)

**Problem:** The profile was mocked with phone '000-000-0000' and state 'AL'. After in-app navigation (Cart → Checkout) at 1440, 1024 and 390, the form values are: business 'Test Market LLC', contact 'Test Buyer', email 'buyer@example.test', and phone, ship-street, ship-city, ship-state and ship-zip all ''. The profiles table stores phone and state (initial_schema.sql:12-15), but QuotePage seeds only business, contact and email. There is no saved or last-used ship-to, so an approved account retypes 5 required fields on every order. That is 11 stacked fields at 390px, with the Submit button at y≈1,800px.

**Fix:** In QuotePage's initial state (App.jsx:1168-1170), seed phone: profile?.phone || '' and shipState: profile?.state || ''.
Add a useEffect keyed on profile?.id that fills any still-empty business, contact, email, phone and shipState fields when the profile arrives.
After a successful submit, store {shipStreet, shipCity, shipState, shipZip, delivery} in localStorage under `aw-shipto:${profile.id}` and prefill from it next time, with a 'Use a different address' link that clears those four fields. Longer term, add ship_street/ship_city/ship_zip columns to profiles.

**Files:** `src/App.jsx:1167-1171`, `supabase/migrations/20260517000000_initial_schema.sql:12-15`

**Evidence:** [gap1-approved-buyer/quote-inapp-1440-full.jpg](screenshots/gap1-approved-buyer__quote-inapp-1440-full.jpg), [gap1-approved-buyer/quote-inapp-390-full.jpg](screenshots/gap1-approved-buyer__quote-inapp-390-full.jpg)

- [ ] Done

#### AW-103 · Cart drawer shows unit prices with no 'each' or line totals, and its total includes lines still waiting for a variant

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Cart drawer (.drawer-line) and #/quote total row (.checkout-total), approved buyer

**Problem:** In the 3-line cart each drawer line reads like 'AW-KITE · $41.16' with qty 2. The price has no 'each' and no line total, although the .drawer-line grid reserves a 'total' area (index.css:463) and #/quote shows '$41.16 each' and '$82.33'. In the 12-line cart (lines with 10, 12 and 6 units) the buyer must multiply 12 prices in their head to check '$2448.34'. That total includes three 'Choose a variant' lines (Black & Mild 8 × $37.61, Geek Bar 15K 3 × $41.07, Snickers 3 × $32.35 = $521.14), which cannot be submitted. The checkout total row ('6 units … $219.04') has no label such as 'Estimated subtotal'.

**Fix:** In CartDrawer:
- change the small line (App.jsx:1404) to `${it.sku}${isApprovedBuyer && it.price != null ? ` · ${money(it.price)} each` : ''}`;
- add `{isApprovedBuyer && it.price != null && !it.needsVariant && <b className="line-total">{money(it.qty * it.price)}</b>}` before the remove button, styled with `.drawer-line .line-total { grid-area: total; justify-self: end; }`.
In App.jsx:238, compute cartTotal only over items without needsVariant. When some lines are excluded, add under the drawer total and the checkout total: '{n} line(s) need a variant and aren't in this total'.
Label the checkout total row (1289) 'Estimated subtotal · {totalUnits} units'.

**Files:** `src/App.jsx:238`, `src/App.jsx:1288-1291`, `src/App.jsx:1399-1417`, `src/App.jsx:1404`, `src/App.jsx:1422-1427`, `src/index.css:463`

**Evidence:** [gap1-approved-buyer/drawer-silver-12lines-1440.jpg](screenshots/gap1-approved-buyer__drawer-silver-12lines-1440.jpg), [gap1-approved-buyer/drawer-silver-3lines-390.jpg](screenshots/gap1-approved-buyer__drawer-silver-3lines-390.jpg), [gap1-approved-buyer/quote-silverbare-1440-full.jpg](screenshots/gap1-approved-buyer__quote-silverbare-1440-full.jpg)

- [ ] Done

#### AW-104 · Order history doesn't say what was requested, or whether each entry was a quote or an order, and uses internal status names

**Medium** · ux-flow · Who: **Cursor** · Effort: M · Still open from the 2026-09-25 audit · Viewports: all

**Where:** #/account → Order history → .order-card

**Problem:** I mocked 25 orders covering every status. Each card shows only the ref, 'the date at 10:04:09 AM' (seconds included), units, subtotal, a status pill and the lines. The account query (AccountPage.jsx:34) doesn't select delivery, preferred_date, ship_* or notes, so a buyer can't check which date or address they requested; 480-character notes are never shown. Quotes submitted while pending (unit_price null) render 'ALW-Q-10037 · 3 units' with no prices and no 'Quote — pricing to be confirmed' label. Every entry uses the 'ALW-Q-' prefix, so orders and quote requests look identical, although checkout called one 'Place your order'. The statuses 'New' and 'Contacted' are internal workflow states with no customer meaning ('New' on an order weeks old). All 25 cards have an identical button named 'Reorder' with no ref in its name.

**Fix:** In AccountPage.jsx:
- Extend the select (line 34) with delivery, preferred_date, ship_street, ship_city, ship_state, ship_zip and notes.
- In each card header, show `{o.subtotal == null ? 'Quote request' : 'Order'}`, the date as toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), and a second line 'Will-call pickup' or 'Delivery to …' plus 'Requested {date}'. Show notes in a muted paragraph under the items.
- Map statuses to buyer language (new → 'Received', contacted → 'Confirming with rep', fulfilled → 'Delivered / picked up', cancelled → 'Cancelled') and add a one-line legend above the list.
- Give the Reorder button aria-label={`Reorder ${o.ref_num}`}.
- For unpriced lines, show 'Price on confirmation' instead of nothing.

**Files:** `src/pages/account/AccountPage.jsx:9-21`, `src/pages/account/AccountPage.jsx:34`, `src/pages/account/AccountPage.jsx:124-167`, `src/pages/account/AccountPage.jsx:134`, `src/pages/account/AccountPage.jsx:140-142`

**Evidence:** [gap1-approved-buyer/account-unpriced-order-1024.jpg](screenshots/gap1-approved-buyer__account-unpriced-order-1024.jpg), [gap1-approved-buyer/account-orderhead-390.jpg](screenshots/gap1-approved-buyer__account-orderhead-390.jpg), [gap1-approved-buyer/account-1order-1440-full.jpg](screenshots/gap1-approved-buyer__account-1order-1440-full.jpg)

- [ ] Done

#### AW-105 · Order history lists every past order fully expanded with no paging: 25 orders make the page 9–12k px tall

**Medium** · performance · Who: **Cursor** · Effort: M · New · Viewports: all (worst at 390)

**Where:** #/account → Order history (.order-list)

**Problem:** With 25 mocked orders (the first has 30 lines), .order-list is 9,439px tall at 390, 6,261px at 1024 and 5,000+ at 1440. Page height is 8,186px at 1440 and 12,171px at 390. Every line item of every order is rendered expanded. There is no 'Show more', date or status filter, or ref search, and the query has no .limit(), so the list grows forever. A long unbroken SKU line ('Discontinued item … (AW-GONE-LONG-SKU-CODE-XYZ)') takes 80px per line at 390.

**Fix:** In AccountPage.jsx:
- Fetch with .range(0, 9) and add a 'Show 10 more orders' button that extends the range.
- Render each card's order_items collapsed to the first 3 lines, with a <button className="text-link">Show all {n} items</button> toggle (aria-expanded).
- Add a small toolbar above the list: a status <select> (All / Received / Confirming / Delivered / Cancelled) and a ref search input that filters client-side.

**Files:** `src/pages/account/AccountPage.jsx:32-36`, `src/pages/account/AccountPage.jsx:122-171`

**Evidence:** [gap1-approved-buyer/account-25orders-1440-full.jpg](screenshots/gap1-approved-buyer__account-25orders-1440-full.jpg), [gap1-approved-buyer/account-25orders-390-full.jpg](screenshots/gap1-approved-buyer__account-25orders-390-full.jpg)

- [ ] Done

#### AW-106 · Admin Products table has no SKU column, although its search matches on SKU

**Medium** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/admin → Products tab → search 'Name, brand, or SKU' and table columns

**Problem:** The columns are ID, Name, Brand, Category, Price, Tag, Active and Edit. Searching 'AW-SS' returns '3 of 30 products': Swisher Sweets cigarillos, Swisher Sweets Mini cigarillos and Swisher Sweets Leaf. None shows its SKU, so the admin can't tell which row matched or verify a code a buyer quoted from Quick Reorder or an order line. The table also shows no variant count or photo, so rows like 'Snickers bars' can't be checked against their 4 variants.

**Fix:** In ProductsTab:
- Add 'SKU' after 'Name' in the header array (line 297), and add <td className="muted"><code>{p.sku}</code></td> to both the read row (after line 332) and the editing row (after line 306).
- Add a 'Variants' column showing (p.variants || []).length.
- Add a 36px thumbnail cell using the same image resolver as the storefront, so wrong photos can be spotted.

**Files:** `src/pages/admin/AdminPage.jsx:281-285`, `src/pages/admin/AdminPage.jsx:297`, `src/pages/admin/AdminPage.jsx:304-328`, `src/pages/admin/AdminPage.jsx:330-341`

**Evidence:** [gap1-approved-buyer/admin-products-sku-search-page-1440.jpg](screenshots/gap1-approved-buyer__admin-products-sku-search-page-1440.jpg), [gap1-approved-buyer/admin-many-products-1440-scrolled.jpg](screenshots/gap1-approved-buyer__admin-many-products-1440-scrolled.jpg)

- [ ] Done

#### AW-107 · Product-card price is smaller than the product name and has no unit or tier context

**Medium** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/, #/category/CANDIES, #/category/TOBACCO, related cards on #/product/* → .card-meta price (approved buyer)

**Problem:** Mocked approved Silver buyer, measured with getComputedStyle:
- #/category/CANDIES at 1440: price '.card-meta > span' 13px/600 rgb(40,20,89); h3 15px/600; .card-detail 12px/400; .card-kicker and .card-add 11px/700.
- The Airheads card shows '$20.34' with no '36-count box'. 24 of 368 products carry sellUnit (e.g. 11 Backwoods 5-pack, 17 Black & Mild 25-count box, 37 Airheads 36-count box), and cards never render it.
- Category intro text: 'Wholesale candies for licensed retail accounts. Your tier pricing is shown on each card.' The tier name (Silver) appears nowhere on cards or on #/.
- Price rows misaligned within a grid row at 390 (#/category/TOBACCO): Game cigarillos 1196 vs Swisher Sweets BLK 1233; Swisher Mini 1980 vs Swisher Leaf 1960. The 601–1100px case is already known.
- Evidence: screenshots/qa-gap1-approved-buyer__card-airheads-1440.jpg and cards-390.png.

**Fix:** 1. App.jsx:825: replace `<span>{money(price)}</span>` with `<span className="card-price"><b>{money(price)}</b>{p.sellUnit && <small>per {p.sellUnit}</small>}</span>`.
2. index.css, after line 212, add: `.card-price b { display: block; font: 700 20px/1.05 var(--display); color: var(--purple); } .card-price small { display: block; margin-top: 2px; font: 400 var(--text-xs)/1.3 var(--body); color: var(--muted); }`. This matches the .pd-price b treatment at index.css:320.
3. index.css:200: change `.content-card` from `display: block` to `display: flex; flex-direction: column;`, and add `.content-card > .card-meta { margin-top: auto; }` so price rows line up across a grid row at every width, 390 included.
4. App.jsx:960: replace 'Your tier pricing is shown on each card.' with `Prices shown are your ${profile.pricing_tier[0].toUpperCase() + profile.pricing_tier.slice(1)} tier price.` (use props.profile). Add the same one-line caption under the 'New arrivals' and 'Bestsellers' section heads on #/ when isApprovedBuyer.

**Files:** `src/App.jsx:823-826`, `src/App.jsx:960`, `src/index.css:200`, `src/index.css:211`

**Evidence:** [gap1-approved-buyer/cards-silver-__category_CANDIES-1440.jpg](screenshots/gap1-approved-buyer__cards-silver-__category_CANDIES-1440.jpg), [gap1-approved-buyer/card-price-row-zoom-1440.jpg](screenshots/gap1-approved-buyer__card-price-row-zoom-1440.jpg), [gap1-approved-buyer/cards-silver-__-700.jpg](screenshots/gap1-approved-buyer__cards-silver-__-700.jpg), [gap1-approved-buyer/cards-silver-__category_TOBACCO-390.jpg](screenshots/gap1-approved-buyer__cards-silver-__category_TOBACCO-390.jpg)

- [ ] Done

#### AW-108 · Confirmation screen's 'ORDER RECEIVED' eyebrow and reference number are 360px off-centre on desktop

**Medium** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: 1440, 1024 (any width above ~600px)

**Where:** #/quote → submitted confirmation (.page-head eyebrow and .result-note)

**Problem:** Measured text centres at 1440 (page centre 720):
- H1 'Thank you, …': 720.
- Body paragraph: 720, because it has an inline margin: 0 auto.
- 'ORDER RECEIVED' eyebrow: 360.
- 'Reference number: ALW-Q-…': 360.
At 1024 (centre 512) the eyebrow and reference sit at 312. Cause: `.page-head > p { max-width: 560px }` without auto margins, so the text-align:center paragraphs centre inside a 560px box pinned to the left edge. The same happens for 'QUOTE RECEIVED'.

**Fix:** Give the submitted section a class (e.g. <section className="page-head receipt-head">) instead of the inline textAlign, and add `.receipt-head { text-align: center; } .receipt-head > p { margin-inline: auto; }` to index.css. Also remove the inline `style={{ fontSize: 13 }}` on the reference paragraph (line 1224).

**Files:** `src/App.jsx:1218-1224`, `src/index.css:256`

**Evidence:** [gap1-approved-buyer/receipt-silver-1440.jpg](screenshots/gap1-approved-buyer__receipt-silver-1440.jpg), [gap1-approved-buyer/receipt-pending-1440.jpg](screenshots/gap1-approved-buyer__receipt-pending-1440.jpg)

- [ ] Done

#### AW-109 · Quick Reorder rows waste space: three blank rows each with Remove, a ~600px gap before Remove, no prices, and 'Add another line' doesn't focus the new row

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/account → Quick Reorder (.qr-row, .qr-actions)

**Problem:** Mocked approved Silver buyer on #/account:
- Empty form: 3 .qr-row elements and 3 Remove buttons. Qty right edge / Remove left edge: 649/1276 at 1440, 464/907 at 1024. At 390 Remove moves beside Qty (274/290).
- Matched row for 'AW-KITE': 'Kite cigarette tobacco | AW-KITE · Kite'. No $ amount at any width.
- After clicking 'Add another line', document.activeElement is BUTTON.text-link 'Add another line' at 1440, 1024 and 390.
- 20 rows: form height 1,941px at 1440 and 1024, 2,003px at 390; each row 89px.
- No textarea inside .quick-reorder.
- Screenshot: screenshots/qa-gap1-approved-buyer__qr-empty-1440.jpg

**Fix:** 1. QuickReorder.jsx:9: set `const START_ROWS = 1;`.
2. QuickReorder.jsx:58: render `<div className={`qr-row${res.status === 'empty' ? ' is-empty' : ''}`} ...>`. At line 104, render the Remove button only when `rows.length > 1 || row.sku`.
3. index.css, after line 385, add:
`.qr-row.is-empty { grid-template-columns: minmax(0, 1.2fr) 84px auto; justify-content: start; }`
`.qr-row.is-empty .qr-status { display: none; }`
This keeps Remove beside Qty on empty rows. Hiding the empty status cell stops Remove wrapping. For matched rows, keep the 4-column grid.
4. Focus management:
- Add `const [focusKey, setFocusKey] = useState(null); const inputRefs = useRef({});`.
- In addRow, create the row first (`const r = blankRow(); setRows(c => [...c, r]); setFocusKey(r.key);`).
- Set `ref={el => { inputRefs.current[row.key] = el; if (i === 0) firstInput.current = el; }}` on the SKU input.
- Add `useEffect(() => { if (focusKey) inputRefs.current[focusKey]?.focus(); }, [focusKey]);`.
5. Prices:
- Move `TIER_DISCOUNT`, `priceForProfile` and `money` from App.jsx:27-31 and :44 into a new `src/lib/pricing.js` and import them in App.jsx.
- Pass `profile` from AccountPage.jsx:103 into `<QuickReorder profile={profile} …/>`.
- In the .qr-match small at QuickReorder.jsx:79, append `{isApprovedBuyer && ` · ${money(priceForProfile(res.product.price, profile))} each · ${money(priceForProfile(res.product.price, profile) * rowQty(row))}`}`.
6. Bulk entry: add a 'Paste a list' disclosure below .qr-actions with a <textarea> (one `SKU, qty` or `SKU<tab>qty` per line). On 'Add rows', split each line on /[,\t ]+/ and append a blankRow() with sku and qty filled in, replacing any trailing empty rows.

**Files:** `src/App.jsx:29-31`, `src/App.jsx:44`, `src/index.css:378`, `src/index.css:384`, `src/index.css:556-559`, `src/pages/account/AccountPage.jsx:103`, `src/pages/account/QuickReorder.jsx:9`, `src/pages/account/QuickReorder.jsx:33-34`, `src/pages/account/QuickReorder.jsx:58`, `src/pages/account/QuickReorder.jsx:75-104`, `src/pages/account/QuickReorder.jsx:113`

**Evidence:** [gap1-approved-buyer/qr-empty-1440.jpg](screenshots/gap1-approved-buyer__qr-empty-1440.jpg), [gap1-approved-buyer/qr-filled-1440.jpg](screenshots/gap1-approved-buyer__qr-filled-1440.jpg), [gap1-approved-buyer/qr-empty-390.jpg](screenshots/gap1-approved-buyer__qr-empty-390.jpg)

- [ ] Done

#### AW-265 · Product page price block never explains the tier discount, list price or quantity × price

**Low** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/product/162, #/product/1, #/product/14 (approved buyer) → .pd-price block and qty row; #/account 'Pricing tier' stat

**Problem:** For a silver buyer, #/product/162 shows '$32.35 | WHOLESALE UNIT PRICE · AW-SNICKERS', and a gold buyer sees '$30.64' with the same label. Neither says it is the Silver/Gold price, what the list price ($34.05) is, or how much is saved. With the stepper at 6 the block still shows only '$32.35'; no '6 × $32.35 = $194.10' line appears anywhere before or after 'Add to order'. Before a variant is picked the label shows the parent SKU (AW-SNICKERS). #/account shows 'PRICING TIER: Silver' with no explanation of what Silver means. Same result on #/product/1 ($39.67) and #/product/14 ($41.16).

**Fix:** In ProductPage (App.jsx:1110-1116) for approved buyers, render:
- <b>{money(price)}</b>;
- <span>{tierLabel} price · list <s>{money(p.price)}</s> · you save {Math.round(discount*100)}%</span>, where tierLabel and discount come from TIER_DISCOUNT/pricing_tiers;
- the variant SKU only once one is chosen, and 'Choose a variant' before that.
Under the qty row (after line 1124), add <p className="in-cart-note">{desiredQty} × {money(price)} = <strong>{money(desiredQty*price)}</strong></p>.
In AccountPage.jsx:88, show 'Silver · 5% off list' instead of the bare tier name.

**Files:** `src/App.jsx:28-32`, `src/App.jsx:1110-1116`, `src/App.jsx:1117-1125`, `src/pages/account/AccountPage.jsx:88`

**Evidence:** [gap1-approved-buyer/pdp-silver-162-1440-qty6.jpg](screenshots/gap1-approved-buyer__pdp-silver-162-1440-qty6.jpg), [gap1-approved-buyer/pdp-gold-162-1440-qty6.jpg](screenshots/gap1-approved-buyer__pdp-gold-162-1440-qty6.jpg), [gap1-approved-buyer/pdp-silver-162-390-qty6.jpg](screenshots/gap1-approved-buyer__pdp-silver-162-390-qty6.jpg)

- [ ] Done

#### AW-266 · Admin tables have no sticky header, and on phones the horizontal scrollbar sits at the bottom of a 3,500–12,000px table

**Low** · layout-responsive · Who: **Cursor** · Effort: M · New · Viewports: 1024, 390 (header issue at all widths)

**Where:** #/admin → Accounts and Products tabs (.table-scroll > .aw-table); Orders status filter pills

**Problem:** Measured with the mocked admin, 368 catalog rows and 24 orders:
- .aw-table th is position: static at every width. The Products .table-scroll is 10,036px tall at 1440, 10,070px at 1024 and 12,079px at 390. After window.scrollTo(0,3000) the first <th> is at top -2313px.
- At 390 the scroller clientWidth is 356px against a 720px scrollWidth for Products and 860px for Accounts. There's no scroll shadow or hint that columns are hidden, though touch panning works.
- At 390 the Orders pill row scrollWidth is 515px against 390px, with 'cancelled (6)' and 'all (24)' off-screen.
Screenshots: screenshots/qv-gap1-approved-buyer__admin-products-scrolled-1440.jpg, …/admin-orders-pills-390.png, …/admin-products-390.png

**Fix:** In index.css:
- change .table-scroll to `overflow: auto; max-height: min(70vh, 900px);`;
- add `.aw-table thead th { position: sticky; top: 0; z-index: 1; }` (background is already var(--paper));
- add `.table-scroll .aw-table td:first-child, .table-scroll .aw-table th:first-child { position: sticky; left: 0; background: #fff; }` to pin the business/ID column.
At ≤600px, render Accounts rows as stacked cards (business, contact, email, then the three selects and Approve in a 2-column grid).
Override the admin status pills with `.admin-page .sub-pills { flex-wrap: wrap; }` so 'all (n)' stays visible; add className="admin-page" on the AdminPage <section>.

**Files:** `src/index.css:396-399`, `src/index.css:550`, `src/pages/admin/AdminPage.jsx:89-100`, `src/pages/admin/AdminPage.jsx:182-259`, `src/pages/admin/AdminPage.jsx:293-345`

**Evidence:** [gap1-approved-buyer/admin-many-products-1440-scrolled.jpg](screenshots/gap1-approved-buyer__admin-many-products-1440-scrolled.jpg), [gap1-approved-buyer/admin-many-accounts-390.jpg](screenshots/gap1-approved-buyer__admin-many-accounts-390.jpg), [gap1-approved-buyer/admin-many-orders-390.jpg](screenshots/gap1-approved-buyer__admin-many-orders-390.jpg)

- [ ] Done

#### AW-267 · The only 'My account' entry is the business name, cut off with no tooltip or label

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Header .aw-account-name button (all routes); mobile menu 'Account' group

**Problem:** Mocked approved buyer with a long business name:
- .aw-account-name at 1440 and 1024: width 180, scrollWidth 378. At 390: width 120, scrollWidth 350, visible text 'Birmingham Nort…'.
- title=null and aria-label=null at all widths. The accessible name is the full business name, and the purpose ('My account') is never stated.
- Mobile menu (390) Account group buttons: 'Birmingham Northside Convenience & Tobacco Outlet LLC' (wraps to 2 lines), 'Quick Reorder', 'Sign Out', 'Help'.
- Screenshots: screenshots/qa-gap1-approved-buyer__header-longname-390.jpg and mobilemenu-account-390.png.

**Fix:** 1. App.jsx:486: change the header button to `<button className="aw-signin aw-account-name" type="button" title={user.business || user.name} aria-label={`My account: ${user.business || user.name || ''}`} onClick={() => runNav(onAccountClick)}><small className="aw-account-kicker">My account</small><span className="aw-account-label">{user.business || user.name || 'My Account'}</span></button>`.
2. index.css:101: move the ellipsis rules from .aw-account-name onto `.aw-account-name .aw-account-label { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`. Make .aw-account-name `display: inline-flex; flex-direction: column; align-items: flex-start; line-height: 1.2; max-width: 180px;`. Add `.aw-account-kicker { font-size: var(--text-xs); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }`. Keep max-width 120px at index.css:535.
3. App.jsx:595: render `<button type="button" onClick={go.account}><span>My account<small className="menu-sub">{user.business || user.name}</small></span></button>` and style `.menu-sub { display: block; font-size: var(--text-sm); font-weight: 400; color: var(--muted); }`.
4. Leave Quick Reorder visible for pending accounts.

**Files:** `src/App.jsx:486`, `src/App.jsx:595`, `src/index.css:101`, `src/index.css:535`

**Evidence:** [gap1-approved-buyer/header-longadmin-1024.jpg](screenshots/gap1-approved-buyer__header-longadmin-1024.jpg), [gap1-approved-buyer/header-long-390.jpg](screenshots/gap1-approved-buyer__header-long-390.jpg), [gap1-approved-buyer/mobilemenu-longadmin-390.jpg](screenshots/gap1-approved-buyer__mobilemenu-longadmin-390.jpg)

- [ ] Done

#### AW-268 · Admin Accounts has no status filter or pending count, and empty Accounts/Products tabs show just a header row

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/admin → Accounts tab; Products tab when empty

**Problem:** With 40 mocked profiles, pending applications are mixed with approved and suspended ones in created_at order: 'Approve' appears on rows 1, 4, 7, 10… with nothing to filter or count them. The Orders tab has 'new (6) / contacted (6) …' pills, but Accounts has none. With zero rows, Accounts renders only 'BUSINESS CONTACT EMAIL STATUS TIER ROLE DOCUMENTS ACTIONS' (a 36px table), and Products renders 'SEARCH PRODUCTS / 0 of 0 products' plus an empty header row. Neither has an empty-state message, while Orders says 'No orders in this state.'

**Fix:** In AccountsTab:
- add `const [filter, setFilter] = useState('pending')` and a .sub-pills row like OrdersTab's (lines 89-100) with pending (n) / approved (n) / suspended (n) / all (n); filter `profiles` before mapping, defaulting to pending;
- when the filtered list is empty, render <p className="result-note">No {filter} accounts.</p> instead of the table.
In ProductsTab, when rows.length === 0, render <p className="result-note">No products loaded. Check the catalog connection.</p> instead of the empty table.

**Files:** `src/pages/admin/AdminPage.jsx:135-261`, `src/pages/admin/AdminPage.jsx:179-192`, `src/pages/admin/AdminPage.jsx:287-300`

**Evidence:** [gap1-approved-buyer/admin-many-accounts-1440.jpg](screenshots/gap1-approved-buyer__admin-many-accounts-1440.jpg), [gap1-approved-buyer/admin-empty-accounts-1440.jpg](screenshots/gap1-approved-buyer__admin-empty-accounts-1440.jpg), [gap1-approved-buyer/admin-empty-products-1440.jpg](screenshots/gap1-approved-buyer__admin-empty-products-1440.jpg)

- [ ] Done

#### AW-269 · Admin tab bar uses role=tab without tab panels or arrow-key support, and the status filters don't expose which one is selected

**Low** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/admin → Orders / Accounts / Products tabs; Orders status filter pills

**Problem:** The three buttons have role=tab and aria-selected, but aria-controls is null on all of them, the page has 0 elements with role=tabpanel, and all three have tabIndex 0 (no roving tabindex). There is no onKeyDown, so Left/Right arrows do nothing, contrary to the ARIA tabs pattern that the role promises to screen-reader users. The Orders status filter pills ('new (6)', …) are plain buttons with only a CSS .active class and no aria-pressed or aria-current. Their container has aria-label='Order status' but no role, so the label isn't exposed.

**Fix:** Implement the tabs pattern:
- give each tab id={`admin-tab-${t.id}`}, aria-controls={`admin-panel-${t.id}`} and tabIndex={tab === t.id ? 0 : -1};
- add onKeyDown handling ArrowLeft/ArrowRight/Home/End that moves both selection and focus;
- wrap each tab's content in <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`} tabIndex={0}>.
For the status filters, add role="group" to the container and aria-pressed={filter === s} to each pill.

**Files:** `src/pages/admin/AdminPage.jsx:42-59`, `src/pages/admin/AdminPage.jsx:89-100`

**Evidence:** [gap1-approved-buyer/admin-many-orders-1440.jpg](screenshots/gap1-approved-buyer__admin-many-orders-1440.jpg)

- [ ] Done

## Admin back office

#### AW-023 · The Products editor can change only name, brand, price, tag and active. It can't add, delete or duplicate a SKU, change a photo, or edit the description, variants, sell unit, department/sub-line or SKU

**High** · ux-flow · Who: **Cursor** · Effort: L · New · Viewports: all (checked 1440x900, 1024x768, 390x844)

**Where:** #/admin → Products tab → Edit row (and the missing 'Add product' action)

**Problem:** Control inventory of the Products tab at all three widths: one 'Search products' input and 200 'Edit' buttons. There is no Add/New/Import/Upload/Duplicate/Delete control (0 matches). The table has no thumbnail column (0 <img>), so staff can't see which photo a row uses. Clicking Edit gives five fields: Product name (text), Brand (text), Price (number), Tag (select with 4 fixed values) and Active (checkbox). Category stays read-only text ('TOBACCO / Cigars & Cigarillos'). The Save PATCH observed was /rest/v1/products?id=eq.3 with body {name, brand, price, tag, active} and nothing else (AdminPage.jsx:324).

Owner task walk-through:
(1) Add a new SKU: impossible from the UI. A developer must edit src/data/products.js, drop a photo into src/assets/products, run npm run images and npm run seed, run the SQL and rebuild/deploy (6+ developer steps). RLS already allows admin insert/delete (rls_policies.sql:45-47), so only the UI is missing.
(2) Change a product photo: impossible. img is not editable. The only storage bucket is 'application-documents' (20260927180000_application_documents.sql:9-20); there is no product-image bucket. A bare filename resolves only if it was bundled at build time: productImage() → fromSet() returns no image in production for a file not in the build (images.js:45-47, 64-70). So even a SQL edit to a new filename shows no photo; only a full URL works.
(3) Fix a description, variant list, sell unit or sub-line: impossible, although the columns exist (description and sell_unit in 20260927120000_product_copy.sql:6-7; variants jsonb; cat/sub in initial_schema.sql:71-75).
(4) Mark stock as short: there is no stock/availability field. The only lever is Active = off, which removes the product from the storefront and from carts.

Also, useCatalog.js:24-25 still says 'The products table has no description or sell-unit columns yet', and line 30 falls back to the static description whenever the DB value is '', so a cleared description could never be saved as empty.

**Fix:** 1) Replace the inline edit row with a ProductEditor component (a drawer on desktop, a full page on phones) at #/admin/products/<id> and #/admin/products/new. Fields: Name, Brand, Department (<select> of NAV_ORDER), Sub-line (<select> of existing subs for that department plus 'New sub-line…' text), SKU (uppercase, unique), Sell unit, Description (<textarea>), Variants (chip editor with add/remove/drag-reorder; set flavors = variants.length on save), Tag, Price, Stock status, Active, and Photo (preview + upload + 'Remove').
2) Add 'New product' and 'Duplicate' buttons above the table, and a 'Delete' in the editor. Delete is allowed only when no order_items reference the product; otherwise offer 'Deactivate'.
3) Add a 48px thumbnail column (p.img via productImage()).
4) Add a 'View on site' link (#/product/<id>).
5) New migration:
create sequence if not exists public.products_id_seq owned by public.products.id;
select setval('public.products_id_seq', (select max(id) from public.products));
alter table public.products alter column id set default nextval('public.products_id_seq');
alter table public.products add constraint products_sku_key unique (sku);  -- no duplicate SKUs exist today
alter table public.products add column stock_status text not null default 'in_stock' check (stock_status in ('in_stock','low','out','discontinued'));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy product_images_admin_write on storage.objects for all to authenticated using (bucket_id='product-images' and public.is_admin()) with check (bucket_id='product-images' and public.is_admin());
6) The upload writes the public URL into products.img. productImage() already accepts full URLs (images.js:68).
7) In useCatalog.js, use p.description / p.sell_unit whenever the key is present (p.description ?? local?.description), and delete the stale comment at lines 24-25.

**Files:** `src/lib/images.js:45-47`, `src/lib/images.js:64-70`, `src/lib/useCatalog.js:23-35`, `src/pages/admin/AdminPage.jsx:263-349`, `src/pages/admin/AdminPage.jsx:297`, `src/pages/admin/AdminPage.jsx:304-328`, `src/pages/admin/AdminPage.jsx:324`, `supabase/migrations/20260517000000_initial_schema.sql:67-81`, `supabase/migrations/20260517000001_rls_policies.sql:45-47`, `supabase/migrations/20260927120000_product_copy.sql:6-7`, `supabase/migrations/20260927180000_application_documents.sql:9-20`

**Evidence:** [gap2-admin-operations/inventory-products-1440.jpg](screenshots/gap2-admin-operations__inventory-products-1440.jpg), [gap2-admin-operations/products-edit-row-1440.jpg](screenshots/gap2-admin-operations__products-edit-row-1440.jpg)

- [ ] Done

#### AW-024 · A guest quote can't be priced, answered, edited or turned into an order, and orders have no quoted or confirmed stage

**High** · ux-flow · Who: **Owner → Cursor** · Effort: L · Still open from the 2026-09-25 audit · Viewports: all (1440x900, 1024x768, 390x844)

**Where:** #/admin → Orders tab → order card (guest quote ALW-Q-41207 vs approved-buyer order ALW-Q-51002)

**Problem:** The guest quote card offers exactly one control, 'SELECT: Status for ALW-Q-41207', with options new / contacted / fulfilled / cancelled.
- All 3 lines show '—' (unit_price null) and there is no total.
- There is no price input and no 'Send quote', 'Convert to order', 'Link to account' or 'Add line' action.
- Email and phone are plain text (0 mailto:, 0 tel: links), so staff must copy them into another app to reply.
- Guest quotes and account orders use the same header (background rgb(246,243,238), same border). The only difference is a trailing 'tier: silver' on account orders; there is no 'Guest quote' label.
- Priced cards show only line totals ($469.20), never the unit price.

The database blocks this as well:
- order_items has only a SELECT policy (rls_policies.sql:78-84). The insert policy was dropped and INSERT revoked (launch_order_boundaries.sql:258-262), and there is no update/delete policy, so admins cannot change a quantity or remove a line (task 8: short stock).
- The order_items_price trigger also fires BEFORE UPDATE OF unit_price/qty (launch_order_boundaries.sql:119-123). It sets new.unit_price := null whenever orders.user_id is null (lines 105-113), so a staff-entered price on a guest quote would be wiped. It also raises 'Product is not available' when touching a line whose product was deactivated (lines 67-70).
- orders.status allows only new/contacted/fulfilled/cancelled (initial_schema.sql:114,120; AdminPage.jsx:14). There is no quoted, confirmed, ready-for-pickup, out-for-delivery or invoiced state, and customers see the same four labels (AccountPage.jsx:16-21).
- Staff can't create an order for a customer who phones it in.

The 2026-09-25 audit (#8) asked to 'distinguish quote requested, accepted order, and scheduled delivery'. That is still not possible.

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

**Owner input needed:** Confirm how quotes should work: should staff price and answer guest quotes and convert them to orders, and should orders go through 'quoted' and 'confirmed' stages before picking?

**Files:** `src/pages/account/AccountPage.jsx:16-21`, `src/pages/admin/AdminPage.jsx:14`, `src/pages/admin/AdminPage.jsx:104-127`, `src/pages/admin/AdminPage.jsx:109-116`, `src/pages/admin/AdminPage.jsx:122`, `supabase/migrations/20260517000000_initial_schema.sql:103-135`, `supabase/migrations/20260517000001_rls_policies.sql:78-84`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:67-70`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:105-113`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:119-123`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:258-262`

**Evidence:** [gap2-admin-operations/orders-guest-quote-card-1440.jpg](screenshots/gap2-admin-operations__orders-guest-quote-card-1440.jpg), [gap2-admin-operations/orders-buyer-order-card-1440.jpg](screenshots/gap2-admin-operations__orders-buyer-order-card-1440.jpg)

- [ ] Done

#### AW-110 · Orders can't be searched, filtered by date, printed as a pick list or packing slip, exported, given an internal note, or audited for who changed what

**Medium** · ux-flow · Who: **Cursor** · Effort: L · New · Viewports: all

**Where:** #/admin → Orders tab (whole tab)

**Problem:** Local admin mock, 1440x900, Orders tab. Pills: 'new (3)', 'contacted (1)', 'fulfilled (1)', 'cancelled (1)', 'all (6)'. There are 0 <input>/<textarea> outside the cards and 0 buttons or links matching print|export|csv|pick|packing|invoice. Staff cannot search by ref, business, email or phone, and cannot filter by created date, preferred_date or delivery method, so there is no way to list tomorrow's route. A fulfilled order can be found only by opening the 'fulfilled' or 'all' pill and scrolling. Printing (emulateMedia print, 'all' view) gives 3 Letter pages. They include the trade bar, header and footer; status selects print as dropdowns; and there is no per-order pick list or packing slip. The only note on a card is the customer's orders.notes ('Notes: …', AdminPage.jsx:126). orders has no internal-note, assignee or event-history table (initial_schema.sql:103-122). orders_self_read (rls_policies.sql:59-60) exposes every orders column to the customer, so internal notes can't live on orders. A status change sends PATCH {status} only (AdminPage.jsx:79), and nothing records who changed what, or when. orders.updated_at is touched by a trigger (initial_schema.sql touch_orders) but is never displayed. The generic site-chrome-in-print problem is covered by the known '[design] No print stylesheet' finding. This item is about the admin-specific pick list and packing slip.

**Fix:** 1) Add a toolbar above .order-list in OrdersTab (AdminPage.jsx:88-100):
- A search input that queries server-side with .or(`ref_num.ilike.%${q}%,business.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,contact.ilike.%${q}%`).
- 'Placed from/to' (created_at) and 'Deliver on' (preferred_date) date inputs, plus a Delivery / Will-call select.
- Keep all of these in the hash, e.g. #/admin/orders?q=&status=&from=&to=.
2) Add per-order 'Print pick list' and 'Print packing slip' buttons that open #/admin/orders/<id>/print. That view shows lines sorted by department/sub-line with a ☐ column, SKU, qty and unit, plus ship-to, delivery method, date and customer notes.
3) Add an admin-scoped print block at the end of src/index.css: @media print { .trade-bar, .trade-only, .aw-header, footer, .sub-pills, .order-head select { display:none } .order-card { break-inside: avoid } }. The site-wide print stylesheet is tracked separately.
4) Add an 'Export CSV' button for the current filter. Columns: ref_num, created_at, business, email, delivery, preferred_date, status, sku, product_name, qty, unit_price, line_total, subtotal.
5) Migration: create public.order_admin_notes (id bigserial pk, order_id uuid references orders on delete cascade, author uuid default auth.uid(), body text not null, created_at timestamptz default now()) and public.order_events (id bigserial pk, order_id uuid references orders on delete cascade, at timestamptz default now(), actor uuid default auth.uid(), from_status text, to_status text, note text). Add an 'after update of status on public.orders' trigger that inserts into order_events. Enable RLS on both tables with admin-only policies (using/with check public.is_admin()). Add alter table public.orders add column assigned_to uuid references public.profiles(id).
6) Under each order card, render a notes box, an 'Assigned to' select and a timeline ('Contacted by Test Owner · Sep 28 9:14 AM').

**Files:** `src/index.css:353-370`, `src/pages/admin/AdminPage.jsx:64-133`, `src/pages/admin/AdminPage.jsx:68-75`, `src/pages/admin/AdminPage.jsx:78-81`, `src/pages/admin/AdminPage.jsx:84-100`, `src/pages/admin/AdminPage.jsx:126`, `supabase/migrations/20260517000000_initial_schema.sql:103-122`, `supabase/migrations/20260517000001_rls_policies.sql:59-64`

**Evidence:** [gap2-admin-operations/inventory-orders-1440.jpg](screenshots/gap2-admin-operations__inventory-orders-1440.jpg), [gap2-admin-operations/orders-print-media-1440.jpg](screenshots/gap2-admin-operations__orders-print-media-1440.jpg), [gap2-admin-operations/orders-print-all.pdf](screenshots/gap2-admin-operations__orders-print-all.pdf)

- [ ] Done

#### AW-111 · The admin Orders list never refreshes: a new quote appears only after a tab switch or reload, and nothing marks orders that are new since the last visit

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/admin → Orders tab; header 'Admin' link; browser tab title

**Problem:** Steps: #/admin was loaded, a new order ALW-Q-99001 was added to the (mocked) backend, window 'focus' and 'visibilitychange' were fired, and the page waited 40 s.
- Orders requests: 2 before, 2 after. The new order was not shown and the pill still read 'new (3)'.
- Only clicking Accounts then Orders re-fetched (4 GETs) and showed it.
- There is no Supabase realtime channel. The only setInterval in src is the hero carousel (App.jsx:653).
- There is no 'Refresh' button or 'Last updated' time.
- document.title stays 'Admin · Alabama Wholesale Inc' (App.jsx:109), and the header 'Admin' button (App.jsx:487) has no count.
- No card is highlighted as new since the last visit.

The missing email notification is a separate, known finding. This one is about in-app awareness.

**Fix:** 1) In OrdersTab, subscribe with supabase.channel('admin-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, reload).subscribe(). Remove the channel on unmount. Migration: alter publication supabase_realtime add table public.orders;
2) Fall back to setInterval(reload, 60000), plus reload on document visibilitychange when visible.
3) Add a 'Refresh' mini-btn and 'Updated hh:mm' text next to the status pills.
4) Save localStorage 'aw-admin-orders-seen-at' (wrapped in try/catch) when the tab is viewed. Give cards with created_at > seenAt a 'NEW' badge and a 3px orange left border.
5) When the unseen count > 0, set document.title to `(${n}) Admin · Alabama Wholesale Inc` and show the count as a badge on the header 'Admin' button.

**Files:** `src/App.jsx:109`, `src/App.jsx:487`, `src/pages/admin/AdminPage.jsx:68-76`, `src/pages/admin/AdminPage.jsx:89-100`

**Evidence:** [gap2-admin-operations/inventory-orders-1440.jpg](screenshots/gap2-admin-operations__inventory-orders-1440.jpg)

- [ ] Done

#### AW-112 · Order status (including 'cancelled') and account status/tier change the instant a dropdown value is picked: no confirmation, feedback or undo, and the order card vanishes

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/admin → Orders card status select; Accounts Status / Tier selects and Approve button

**Problem:** Orders, on the default 'new' view: choosing 'cancelled' on ALW-Q-41207 immediately sent PATCH /rest/v1/orders?id=eq.o-guest-1 {"status":"cancelled"}.
- The card disappeared from the list at once (pills went to 'cancelled (2)').
- Keyboard focus fell to <body>.
- 0 dialogs, 0 role=status/alert messages, no Undo. Staff had to open 'cancelled' to find the order again.

Accounts:
- Status → 'suspended' sent PATCH /profiles?id=eq.u-1 {"status":"suspended"} instantly, with no reason asked.
- Tier → 'standard' sent PATCH {"pricing_tier":"standard"} instantly.
- Double-clicking 'Approve' sent 2 identical PATCH {status:'approved'} requests, because the button is not disabled while saving.

Every account change also re-signs every document URL (an extra POST /storage/v1/object/sign on each change).

Role changes are a known finding and are excluded here.

**Fix:** 1) Cancelling an order and suspending an account open a confirm dialog: 'Cancel ALW-Q-41207 for TEST Guest Corner Store?' with a required reason <textarea>. Store the reason in order_events.note or profile admin notes (see the other findings).
2) Other transitions apply optimistically: update local state with setOrders(prev => prev.map(...)) instead of reload(), and keep the card visible in the current filter until the next refresh, with a 'Moved to contacted' tag.
3) Show a role=status toast for 8 s, e.g. 'ALW-Q-41207 marked Contacted · Undo'. Undo PATCHes the previous status.
4) Keep focus on the same select, or move it to the toast.
5) Disable the select or button while the request is in flight (a savingId state), so double-clicks send one request.
6) Don't reload documents on every profile change: split reload() so updateProfile refetches only profiles.

**Files:** `src/pages/admin/AdminPage.jsx:78-81`, `src/pages/admin/AdminPage.jsx:84`, `src/pages/admin/AdminPage.jsx:114-116`, `src/pages/admin/AdminPage.jsx:140-143`, `src/pages/admin/AdminPage.jsx:174-177`, `src/pages/admin/AdminPage.jsx:199-210`, `src/pages/admin/AdminPage.jsx:249-253`

**Evidence:** [gap2-admin-operations/orders-after-cancel-1440.jpg](screenshots/gap2-admin-operations__orders-after-cancel-1440.jpg), [gap2-admin-operations/accounts-1440.jpg](screenshots/gap2-admin-operations__accounts-1440.jpg)

- [ ] Done

#### AW-113 · The Accounts tab has no search, no account detail page, no way to edit phone, business or address, no notes, no per-account order history and no 'Add account'

**Medium** · ux-flow · Who: **Cursor** · Effort: L · New · Viewports: all (1440x900, 390x844 checked)

**Where:** #/admin → Accounts tab

**Problem:** Columns: Business, Contact, Email, Status, Tier, Role, Documents, Actions.
- 0 text inputs and no search box. Finding one store means scrolling the whole table.
- 0 mailto:/tel: links.
- Clicking the business name 'TEST Approved Market LLC' does nothing (hash stays #/admin, 0 dialogs, the cell is plain text).
- The account's phone (000-000-0001 in the fixture), state and signup date appear nowhere.
- Nothing can be edited except the three selects. There is no field for phone, business name or ship-to address.
- profiles has no address or notes columns at all (initial_schema.sql:7-26). The application_fields migration adds only ein and resale_cert_no.
- Order history is not linked in either direction. Account orders show only 'tier: silver' with no link to the account, account rows have no 'Orders (n)' link, and Orders can't be filtered by account.
- A store that phones in can't be set up or invited by staff.

Hidden EIN/license columns are a known finding and are excluded. profiles_self_read (rls_policies.sql:19-20) lets customers read their own profile row, so staff notes can't be stored on profiles.

**Fix:** 1) Add a search input above the Accounts table that filters business/name/email/phone, case-insensitive.
2) Make the business name a button that opens #/admin/accounts/<id> (an AccountDetail component) with:
- editable business, name, phone, state, business_type and ship-to street/city/state/ZIP (saved with supabase.from('profiles').update(...)); email is shown read-only;
- the verification fields;
- an internal notes list;
- that account's orders (supabase.from('orders').select('id,ref_num,status,subtotal,total_units,created_at').eq('user_id', id).order('created_at',{ascending:false})), with last-order date and lifetime total.
3) In OrdersTab, make 'tier: silver' a link to the account, and add '?account=<id>' filter support.
4) Add an 'Invite account' button that calls an Edge Function using auth.admin.inviteUserByEmail and pre-creates an approved profile.
5) Migration:
alter table public.profiles add column ship_street text, add column ship_city text, add column ship_state text, add column ship_zip text, add column approved_at timestamptz, add column approved_by uuid references public.profiles(id);
create table public.profile_admin_notes (id bigserial primary key, profile_id uuid not null references public.profiles(id) on delete cascade, author uuid default auth.uid() references public.profiles(id), body text not null, created_at timestamptz default now());
alter table public.profile_admin_notes enable row level security;
create policy admin_only on public.profile_admin_notes for all using (public.is_admin()) with check (public.is_admin());

**Files:** `src/pages/admin/AdminPage.jsx:111`, `src/pages/admin/AdminPage.jsx:135-261`, `src/pages/admin/AdminPage.jsx:187`, `src/pages/admin/AdminPage.jsx:193-197`, `supabase/migrations/20260517000000_initial_schema.sql:7-26`, `supabase/migrations/20260517000001_rls_policies.sql:19-20`, `supabase/migrations/20260927000000_application_fields.sql:5-6`

**Evidence:** [gap2-admin-operations/accounts-1440.jpg](screenshots/gap2-admin-operations__accounts-1440.jpg), [gap2-admin-operations/accounts-390.jpg](screenshots/gap2-admin-operations__accounts-390.jpg)

- [ ] Done

#### AW-114 · No bulk price change, no CSV export or import, and no way to edit tier discounts: a supplier price rise means editing every row by hand

**Medium** · ux-flow · Who: **Cursor** · Effort: L · New · Viewports: all

**Where:** #/admin → Products tab

**Problem:** Test case: a 5% supplier increase across Swisher Sweets. Admin search 'Swisher' finds 6 rows.
- It took 18 UI actions (Edit → type price → Save, ×6).
- That produced 6 separate PATCHes, and each Save re-downloaded the entire 368-row catalog (6 full products?select=* GETs; AdminPage.jsx:273-277).
- Only one row can be in edit mode at a time (a single `editing` object, line 265).
- The same change across the whole catalog would be 368 × 3 = 1,104 actions.

No row checkboxes or multi-select. 0 'Export'/'Import'/'CSV' controls on any admin tab.

pricing_tiers is admin-writable (rls_policies.sql:92-94) but has no admin UI, so changing Silver from 5% to 7% needs SQL. The client-side hard-coded tier values are a separate known finding.

**Fix:** 1) Add a leading checkbox column plus 'Select all (filtered)'. When anything is selected, show a bulk bar: 'Set price', 'Adjust price by % / $' (with a preview table old → new, rounded to 0.01), 'Set tag', 'Activate', 'Deactivate'.
2) Back the bar with one RPC so it runs as a single transaction:
create function public.admin_bulk_price(p_ids int[], p_pct numeric default 0, p_amount numeric default 0) returns int language plpgsql security definer set search_path=public as $$ begin if not public.is_admin() then raise exception 'admin only'; end if; update public.products set price = round(price*(1+p_pct/100)+p_amount,2) where id = any(p_ids); return (select count(*) from public.products where id = any(p_ids)); end $$;
3) After a save, update the changed rows locally instead of re-fetching all 368.
4) 'Export CSV' (client-side from rows: id, sku, name, brand, cat, sub, sell_unit, price, tag, active, stock_status).
5) 'Import CSV': parse, show a diff preview matched on sku, then call an admin_upsert_products(p_rows jsonb) RPC.
6) A 'Pricing' tab listing pricing_tiers rows with editable discount_pct (0–50) and label, saved via supabase.from('pricing_tiers').update(...).

**Files:** `src/pages/admin/AdminPage.jsx:265`, `src/pages/admin/AdminPage.jsx:273-277`, `src/pages/admin/AdminPage.jsx:296-303`, `supabase/migrations/20260517000000_initial_schema.sql:89-98`, `supabase/migrations/20260517000001_rls_policies.sql:92-94`

**Evidence:** [gap2-admin-operations/inventory-products-1440.jpg](screenshots/gap2-admin-operations__inventory-products-1440.jpg)

- [ ] Done

#### AW-115 · In the Products list, inactive products look identical to active ones, there's no status, department or tag filter and no sort, and products 201–368 can only be reached by searching

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/admin → Products tab → table and 'Search products'

**Problem:** Test setup: ids 14, 162, 250 and 330 deactivated.
- Rows 14 and 162 render with the same background (rgba(0,0,0,0)) and text colour (rgb(36,32,44)) as active rows. Only the Active cell reads 'No'. Row 162 still carries a BESTSELLER tag with no warning.
- The table renders only the first 200 rows (max id shown 200), so inactive ids 250 and 330 never appear unless searched.
- The count reads '368 of 368 products' and never says how many are inactive.
- Search matches only name, brand and SKU (AdminPage.jsx:281-285): 'inactive' → 0, '250' → 1 (a name match, not id 250), '330' → 0, 'TOBACCO' → 7 (not the 66 Tobacco rows), 'Honey & Energy' → 0.
- 0 sortable headers (no <button> or aria-sort in th), and 0 filter controls outside the rows.

So task 4 (deactivate a product, find it again) works only if you remember its name.

**Fix:** 1) Add a filter row beside the search:
- Status (All / Active / Inactive);
- Department (NAV_ORDER);
- Sub-line (depends on department);
- Tag (Any / none / BESTSELLER / NEW / DEAL / PREMIUM);
- quick toggles 'No photo' (!img) and 'No sell unit' (!sell_unit).
2) Extend search to String(r.id) === q and to r.cat and r.sub.
3) Make ID, Name, Brand, Price and Updated sortable (buttons in th with aria-sort), and add an Updated column from updated_at.
4) Replace filtered.slice(0,200) with 50-row pagination ('Page 2 of 8').
5) Change the count to '368 products · 4 inactive'.
6) Give inactive rows className 'inactive' with .aw-table tr.inactive td { color: var(--muted); background: #faf8f5 } and replace 'No' with an 'INACTIVE' pill.

**Files:** `src/index.css:396-402`, `src/pages/admin/AdminPage.jsx:281-285`, `src/pages/admin/AdminPage.jsx:289-292`, `src/pages/admin/AdminPage.jsx:297-303`, `src/pages/admin/AdminPage.jsx:330-341`, `src/pages/admin/AdminPage.jsx:346`

**Evidence:** [gap2-admin-operations/products-search-snickers-inactive-row-1440.jpg](screenshots/gap2-admin-operations__products-search-snickers-inactive-row-1440.jpg), [gap2-admin-operations/inventory-products-1440.jpg](screenshots/gap2-admin-operations__inventory-products-1440.jpg)

- [ ] Done

#### AW-116 · The admin product editor has no validation: it saves a blank name or brand and negative or absurd prices, and a cleared price becomes NaN and is sent as null

**Medium** · functional-bug · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/admin → Products → Edit row (name, brand, price inputs) → storefront #/product/2 and #/category/TOBACCO

**Problem:** On row 2 (White Owl cigarillos) the name and brand were cleared, price set to -5 and Save clicked.
- The browser sent PATCH /rest/v1/products?id=eq.2 {"name":"","brand":"","price":-5,"tag":null,"active":true}.
- The table showed an empty name and brand and '$-5.00'.
- After a reload, the storefront #/product/2 had an empty <h1>, the price block read '$-5.00 WHOLESALE UNIT PRICE · AW-WO', and the tab title was '· · Alabama Wholesale Inc'. The Tobacco grid card showed '$-5.00'.
- A price of 99999999 was also accepted and sent.
- The inputs have no required, min or max attributes (checkValidity() is true for all of them).
- The DB has no check constraints on products.name, brand or price (initial_schema.sql:69-78), and enforce_order_item_price would price approved buyers' lines at round(-5 × (1 − discount), 2), a negative value (launch_order_boundaries.sql:111).

Clearing the price to null is a known finding and is excluded.

**Also seen:**
- #/admin → Products → Edit → Price — Price onChange stores parseFloat(e.target.value) (AdminPage.jsx:309). An empty field becomes NaN, and React logged 'Warning: Received NaN for the `value` attribute' plus Chrome's 'The specified value "NaN" cannot be parsed'. Save then sent PATCH products?id=eq.1 {"price":null,…} (JSON turns NaN into null), which the NOT NULL column rejects, and the error is ignored.

**Fix:** In src/pages/admin/AdminPage.jsx (306-309, 324), keep the price input's raw string in editing state instead of calling parseFloat on every keystroke. On Save, trim and require name and brand, and require price to be a finite number >= 0 below a sensible upper limit. Show inline errors and block the save until they are fixed, and parse the number only at save time. Back this up in the database with CHECK constraints (price >= 0, name and brand not empty) so the storefront can never show an empty title or '$-5.00'.

**Files:** `src/pages/admin/AdminPage.jsx:306-309`, `src/pages/admin/AdminPage.jsx:309`, `src/pages/admin/AdminPage.jsx:324`, `supabase/migrations/20260517000000_initial_schema.sql:69-78`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:111`

**Evidence:** [gap2-admin-operations/products-saved-blank-name-negative-price-row.jpg](screenshots/gap2-admin-operations__products-saved-blank-name-negative-price-row.jpg), [gap2-admin-operations/storefront-pdp-2-after-blank-name-negative-price-1440.jpg](screenshots/gap2-admin-operations__storefront-pdp-2-after-blank-name-negative-price-1440.jpg), [code/admin-price-nan.jpg](screenshots/code__admin-price-nan.jpg)

- [ ] Done

#### AW-117 · In the Products edit row, Enter doesn't save, Escape doesn't cancel, focus drops to <body> on Edit/Save/Cancel, and opening another row silently discards edits

**Medium** · accessibility · Who: **Cursor** · Effort: M · New · Viewports: all; the product name is hidden while editing at 390x844

**Where:** #/admin → Products → Edit / Save / Cancel in the table row

**Problem:** At 1440:
- After clicking Edit, document.activeElement is BODY (the Edit button unmounts and focus isn't moved into 'Product name').
- Typing a name and pressing Enter: 0 PATCH, the row stays in edit mode.
- Escape: still in edit mode.
- After Save: activeElement is BODY and there is no status message.
- With row 1's name changed to 'Swisher Sweets cigarillos TEST', clicking Edit on row 3 replaced the edit state. Row 1 went back to 'Swisher Sweets cigarillos', with 0 writes and no prompt.

At 390: the 720px-wide table sits in a 356px scroller. When the Save/Cancel column is in view, the Product name input is at x = −294px, so the product being edited can be identified only by its price. At 1024 the whole row fits.

**Fix:** 1) Render a hidden <form id={`edit-${p.id}`} onSubmit={e => { e.preventDefault(); save(...) }}> outside the table. Give each input form={`edit-${p.id}`}, and make Save type="submit" form={...}, so Enter saves.
2) Add onKeyDown on the row: Escape → cancel.
3) Use a ref to focus the name input when editing starts.
4) Keep a Map of Edit-button refs by id and, after Save or Cancel, call editBtnRefs.get(id)?.focus().
5) Add a role=status region that announces 'Saved White Owl cigarillos'.
6) Before switching editing to another row, compare with the original row; if dirty, confirm('Discard changes to <name>?').
7) At ≤600px, open the ProductEditor drawer (see the Products editor finding) instead of inline editing, or make the ID and Name columns sticky: .aw-table td:nth-child(-n+2), th:nth-child(-n+2) { position: sticky; left: 0; background: inherit }.

**Files:** `src/index.css:396-405`, `src/pages/admin/AdminPage.jsx:265`, `src/pages/admin/AdminPage.jsx:303-328`, `src/pages/admin/AdminPage.jsx:339`

**Evidence:** [gap2-admin-operations/products-edit-row-1440.jpg](screenshots/gap2-admin-operations__products-edit-row-1440.jpg), [gap2-admin-operations/products-edit-row-390.jpg](screenshots/gap2-admin-operations__products-edit-row-390.jpg)

- [ ] Done

#### AW-118 · Unsaved product edits and the Products search are lost on tab switch, reload or Back with no warning, and the admin tab isn't in the URL

**Medium** · ux-flow · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/admin → Orders / Accounts / Products tabs; browser reload and Back

**Problem:** - Searched 'Swisher', clicked Edit, changed the price to 12.34, then clicked Orders and back to Products: 0 editing rows, the admin search box reset to '', 0 dialogs, 0 writes. The edit was silently thrown away.
- A dispatched beforeunload was not prevented (defaultPrevented false), so reloading or closing also drops edits silently.
- Reloading while on Products returns to the Orders tab. The hash stays '#/admin' because the tab is plain useState('orders') (AdminPage.jsx:17), and the router maps only 'admin' (App.jsx:173, 182).
- Browser Back from the Products tab leaves admin entirely (hash '#/').
- The Orders status filter ('all', etc.) also resets on reload.
- Accounts, Products or a filtered order view can't be bookmarked or shared.

**Fix:** 1) Route admin sections as #/admin/orders, #/admin/accounts and #/admin/products. In parseHash (App.jsx:173) return { page: 'admin', section: rest[0] || 'orders', query: ... } and have routeToHash (App.jsx:182) produce it.
2) Pass route.section and navigate into AdminPage. Tab clicks push the hash instead of calling setTab.
3) Keep the Orders filter and the Products search/filters in the hash query (e.g. #/admin/products?q=swisher&status=inactive).
4) Track a dirty flag (editing differs from the original row). When dirty, confirm before a tab switch or before starting another row's edit, and add window.addEventListener('beforeunload', e => { e.preventDefault(); e.returnValue = '' }) while dirty.

**Files:** `src/App.jsx:173`, `src/App.jsx:182`, `src/App.jsx:332`, `src/pages/admin/AdminPage.jsx:17`, `src/pages/admin/AdminPage.jsx:42-59`, `src/pages/admin/AdminPage.jsx:66`, `src/pages/admin/AdminPage.jsx:265-266`

**Evidence:** [gap2-admin-operations/inventory-products-1024.jpg](screenshots/gap2-admin-operations__inventory-products-1024.jpg)

- [ ] Done

#### AW-119 · The admin 'NEW' tag doesn't drive the homepage New arrivals rail, Bestsellers shows only the first 8 tagged products by id, and the hero is code-only

**Medium** · ux-flow · Who: **Cursor** · Effort: L · New · Viewports: all

**Where:** #/admin → Products → Tag select → effect on #/ New arrivals and Bestsellers rails

**Problem:** Local admin mock, 1440x900. All static NEW tags were cleared, Nerds bags (id 200) was tagged NEW and 'Melted mushroom pre rolls 2pk' (id 300) BESTSELLER, for 17 bestsellers in total. Home #new-arrivals still showed the 8 hard-coded NEW_ARRIVALS_IDS items (Geek Bar Pulse X 25K, Foger Switch Pro full kit, RAZ 25K, BIC lighters, Hershey's bars, Almond Joy bars, Dubai chocolate, Tueni chews), and Nerds bags never appeared. Bestsellers showed ids 11, 31, 55, 56, 60, 61, 143 and 162, the first 8 BESTSELLER rows in id order. Id 300 can't appear, and the admin has no way to rank or pin items. The Tag select has 4 fixed values (AdminPage.jsx:311-317), and hero slides are constants in content.js:37-46. So the owner can't change what the homepage features without a code deploy. The 'rail ignores tags' symptom itself is shared with the known [data] merchandising-tags finding. This item covers admin control of homepage merchandising.

**Fix:** 1) Migration: alter table public.products add column featured_rank integer;
2) New arrivals: products.filter(p => p.tag === 'NEW').sort((a,b) => (a.featured_rank ?? 999) - (b.featured_rank ?? 999) || b.id - a.id).slice(0,8). Delete NEW_ARRIVALS_IDS.
3) Bestsellers: sort the same way before slice(0,8).
4) Add a 'Homepage rank' number input to the product editor.
5) Move HERO_SLIDES to a table public.home_slides (id serial, eyebrow text, title text, sub text, img text, cta_label text, go_cat text, sort int, active boolean) with public read and admin write RLS. Add an admin 'Homepage' tab to edit, reorder and toggle slides, using the product-images bucket for photos.

**Files:** `src/App.jsx:703-704`, `src/data/content.js:37-46`, `src/data/products.js:766`, `src/pages/admin/AdminPage.jsx:311-317`

**Evidence:** [gap2-admin-operations/home-new-arrivals-ignores-admin-NEW-tag-1440.jpg](screenshots/gap2-admin-operations__home-new-arrivals-ignores-admin-NEW-tag-1440.jpg)

- [ ] Done

