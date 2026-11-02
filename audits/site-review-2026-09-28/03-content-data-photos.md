# Content, catalog data & photos

Part of the Alabama Wholesale site review (2026-09-28). Start with [00-START-HERE.md](00-START-HERE.md) for the guardrails and the order to work in.

56 findings. Critical 2, High 10, Medium 23, Low 21. File paths are relative to the repo root `alabamawholesaleinc-2a-editorial/`. Each finding ends with a checkbox; tick it when the fix is in.

**Who** says who can act: **Cursor** can fix it from the finding alone. **Owner → Cursor** needs a decision, fact or asset from the business owner first; Cursor must not invent it, and should leave a `TODO(owner)` where the code depends on the answer.

## Contents

- Support pages (contact, delivery, policies, apply, catalog index) (17)
- Content, copy & business facts (19)
- Catalog data integrity (13)
- Product photos — Tobacco, Novelties, Merchandise, Candies (4)
- Product photos — Food, Grocery, Motor Oil, Drinks; hero, logo & share images (3)

## Support pages (contact, delivery, policies, apply, catalog index)

#### AW-120 · On phones the email and address on the Contact page render at 30px and the email breaks mid-address, dwarfing the phone number

**Medium** · layout-responsive · Who: **Cursor** · Effort: S · New · Viewports: ≤600px (390 measured); email break also at 1024

**Where:** #/contact → EMAIL and VISIT info cards

**Problem:** At 390px the computed font-size of .info-lead-small is 30px/42px instead of 17px. The @media(max-width:600px) rule '.info-lead { font-size: 30px; }' (index.css:782) comes after '.info-lead-small { font: 600 17px/1.4 … }' (index.css:633) and has the same specificity, so it wins. Result: 'Alabamawholesaleinc / @gmail.com' wraps onto 2 lines (84px tall), and the address takes 3 lines and 126px ('613 Graymont Ave N / Birmingham, AL / 35203'). The primary action, the phone number, is one 30px line, so secondary data looks bigger than the phone. At 1024px the 17px email breaks as 'Alabamawholesaleinc@gmail. / com' because of word-break: break-word (index.css:631).

**Also seen:**
- #/contact → EMAIL and VISIT info cards (.info-lead.info-lead-small) — Computed font sizes. At 768 and 1024: phone 34px Barlow, email 17px DM Sans, address 17px DM Sans (as designed). At 360 and 390: email and address become 30px DM Sans. The email wraps as 'Alabamawholesalei / nc@gmail.com' (2 lines, 84px tall). At 360 the address takes 4 lines ('613 Graymont Ave / N / Birmingham, AL / 35203', 168px tall), and both end up larger than the 30px phone number they were meant to sit below. Cause: the ≤600 rule `.info-le…

**Fix:** On phones, size .info-lead.info-lead-small (email/address) at body size or smaller than the phone number, and use overflow-wrap:anywhere or break before '@' so the email doesn't break mid-word (index.css:631-634, 782).

**Files:** `src/index.css:631-634`, `src/index.css:631`, `src/index.css:633`, `src/index.css:782`, `src/pages/support/ContactPage.jsx:29`, `src/pages/support/ContactPage.jsx:35`

**Evidence:** [support/contact-390-info-cards.jpg](screenshots/support__contact-390-info-cards.jpg), [support/contact-1024-info-cards.jpg](screenshots/support__contact-1024-info-cards.jpg), [responsive/contact-360-info-cards.jpg](screenshots/responsive__contact-360-info-cards.jpg), [responsive/contact-1024-info-cards.jpg](screenshots/responsive__contact-1024-info-cards.jpg)

- [ ] Done

#### AW-121 · Policy text and page intros run about 100 characters per line on desktop

**Medium** · visual-design · Who: **Cursor** · Effort: S · New · Viewports: 1440 (and ≥1024)

**Where:** #/terms, #/privacy, #/shipping policy body; intro paragraph on all support pages

**Problem:** Measured at 1440: .policy-body p and li are 700-720px wide at 14px, about 100-102 characters per line. .support-page .page-head > p is 640px wide at 13px, about 92-98 characters per line (contact, delivery, terms, privacy, catalog). The comfortable range is roughly 60-75 characters, so long legal text is tiring to read.

**Fix:** Set index.css:731 to '.policy-body { max-width: 66ch; }' and raise the body size to 16px at lines 735 and 738 ('font-size: var(--text-lg)'), which gives about 70 characters per line. Set index.css:619 to '.support-page .page-head > p { max-width: 60ch; font-size: var(--text-lg); }'.

**Files:** `src/index.css:619`, `src/index.css:731`, `src/index.css:735`, `src/index.css:738`

**Evidence:** [support/terms-1440-policy-layout.jpg](screenshots/support__terms-1440-policy-layout.jpg)

- [ ] Done

#### AW-122 · Support side-navigation only exists on the 3 policy pages and disappears on the pages it links to

**Medium** · consistency · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/contact, #/delivery, #/apply, #/catalog (no section nav) vs #/shipping, #/privacy, #/terms (PolicyNav)

**Problem:** hasPolicyNav, measured at 1440: terms/shipping/privacy true; contact, delivery, apply and catalog false. The footer .footer-policies buttons compute to font-size 10px and height 16.5px (index.css:767). From #/contact and #/delivery, Privacy and Trade terms are reachable only through the footer or indirectly: 'Delivery policy' → #/shipping → PolicyNav. #/apply is absent from POLICY_LINKS and PolicyNav (SupportShell.jsx:9-13, 58-69).

**Fix:** Add a SupportLayout({ current, navigate, children }) to SupportShell.jsx that renders <div className='policy-layout'><PolicyNav current={current} navigate={navigate} /><div>{children}</div></div>. Wrap the body of ContactPage, DeliveryPage and ApplyPage below PageHead in it, as PolicyPage already does. Rename the nav eyebrow to 'HELP & POLICIES' and give it these items in order: Contact & visit, Delivery & service area, Apply for an account (#/apply), Trade terms, Privacy. Keep the wrapped chip row on mobile (index.css:775-777).

**Files:** `src/pages/support/ApplyPage.jsx:15-62`, `src/pages/support/ContactPage.jsx:15-76`, `src/pages/support/DeliveryPage.jsx:21-100`, `src/pages/support/PolicyPage.jsx:114-131`, `src/pages/support/SupportShell.jsx:58-69`

**Evidence:** [support/contact-1440-full.jpg](screenshots/support__contact-1440-full.jpg), [support/terms-1440-full.jpg](screenshots/support__terms-1440-full.jpg)

- [ ] Done

#### AW-123 · The service-area check only asks for a state, with no ZIP or route lookup, so it answers nothing the page does not already say

**Medium** · ux-flow · Who: **Owner → Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/delivery → 'Is my store in the service area?' form

**Problem:** The form is a single state <select> (DeliveryPage.jsx:51-73). Choosing Alabama returns 'We run delivery routes in Alabama. Routes don’t reach every address. Call (205) 354-4473 to confirm your stop…', which repeats the page intro. There is no ZIP or city input, no route map, no list of served cities or counties, and no delivery day per route. The 'Route states' block shows only three chips (AL, MS, GA). The previous audit (#12) asked for a ZIP-based eligibility check tied to actual routes.

**Fix:** Add a ZIP input (type='text', inputMode='numeric', maxLength 5, autoComplete='postal-code') above the state select. Add ROUTE_ZIPS to src/data/onboarding.js as a map from ZIP (or 3-digit prefix) to { route, days, cutoff }, with the data supplied by the owner. Render three outcomes: 'On our {route} route, deliveries {Tue & Fri}, order by {cutoff} for next-day'; 'Near a route, call to confirm'; 'Not on a route, will-call pickup in Birmingham is available'. Keep the state select as a fallback. Under 'Route states' add the list of cities or counties served.

**Owner input needed:** Which ZIP codes or 3-digit prefixes are on each delivery route, and what are each route's delivery days and order cutoff time, plus the list of cities/counties served?

**Files:** `src/data/onboarding.js:13-22`, `src/pages/support/DeliveryPage.jsx:45-74`, `src/pages/support/DeliveryPage.jsx:86-96`

**Evidence:** [support/delivery-1440-eligibility-AL.jpg](screenshots/support__delivery-1440-eligibility-AL.jpg)

- [ ] Done

#### AW-124 · The Contact page has no map, warehouse photo or practical will-call instructions

**Medium** · ux-flow · Who: **Owner → Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/contact → VISIT card and 'Pick up at the warehouse' block

**Problem:** #/contact is text only: three beige cards and two text columns, with no image anywhere on the page. The VISIT card has only the address and a 'Get directions ↗' link to Google Maps. The will-call block says 'Order ahead online or by phone, then collect your order…'. It does not say how far ahead to order, whether to wait for a ready call, where to park or which door or dock to use, how to pay at pickup, or that tobacco and vapor pickups need 21+ ID. The previous audit (#12) asked for a Contact/Visit page with warehouse photographs.

**Fix:** In the VISIT card (ContactPage.jsx:33-38), add a warehouse-front photo via the <Picture> component (a new asset in src/assets), or a static map image stored locally and linked to DIRECTIONS_URL, with meaningful alt text. In the will-call block (lines 53-62), replace the paragraph with a <ul> of: 'Order at least {N} hours ahead; we call when it’s ready', 'Entrance and parking: {details}', 'Bring your order reference and a 21+ photo ID for tobacco and vapor orders', 'Payment at pickup: {methods}'.

**Owner input needed:** Please supply a warehouse-front photo (or approve a static map), plus how many hours ahead will-call orders must be placed, entrance/parking details, and accepted payment methods at pickup.

**Files:** `src/pages/support/ContactPage.jsx:33-38`, `src/pages/support/ContactPage.jsx:53-62`

**Evidence:** [support/contact-1440-full.jpg](screenshots/support__contact-1440-full.jpg)

- [ ] Done

#### AW-125 · The leftover Tailwind build (legacy config and preflight reset) plus over-broad support-page `p` selectors break typography: privacy lists lose their bullets, paragraphs run together, and notes and eyebrows are restyled

**Medium** · visual-design · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/contact → 'Pick up at the warehouse' and Hours note; #/delivery → 'Route states' note

**Problem:** Measured at 1440. Contact will-call <p>s (ContactPage.jsx:56-57) have margin-top and margin-bottom of 0, so 'Prefer delivery?…' starts at the same y (997) where the previous paragraph ends. .support-note ('Holiday hours can differ…' on #/contact, 'Tobacco and vapor products…' on #/delivery, 'Already have a login…' on #/apply) computes to 14px rgb(36,32,44), because `.support-block > p` (index.css:640, specificity 0,1,1) beats `.support-note` (index.css:621, 0,1,0). Eyebrow sizes, where home uses 11px throughout: #/contact TALK TO THE WAREHOUSE 13px, CALL/EMAIL/VISIT 13px, HOURS 14px, WILL-CALL PICKUP 14px, NEW TO ALABAMA WHOLESALE? 13px. #/delivery: OUR OWN TRUCKS 13, 01 · ROUTE DELIVERY 13, SERVICE AREA CHECK 13, HOW ROUTE DELIVERY WORKS 14, WHERE WE DRIVE 14. #/apply: OPEN AN ACCOUNT 13, WHAT YOU’LL NEED 11, HOW IT WORKS 14. #/catalog: page-head eyebrow 13px but department eyebrows 11px. The cause is `.page-head > p` (256), `.info-card p` (629), `.support-block > p` (640), `.contact-strip p` (650), `.support-cta p` (658) and `.eligibility > div > p` (671), which all match p.eyebrow. Evidence: screenshots/vsupport__contact-1440-hours-willcall.jpg

**Also seen:**
- #/privacy → 'What we collect' and 'Why we collect it' lists — The computed list-style-type of .policy-body ul is 'none': Tailwind preflight resets ul, and index.css:737 sets only margin and padding. The 4 list items show as indented plain paragraphs, so a reader cannot tell them apart from body text (see privacy-390-policy-layout.png).
- src/index.css @tailwind directives; tailwind.config.js — The dev-server CSS (/src/index.css?direct, 82KB) contains about 12.7KB of Tailwind output before `:root`. That includes `.container{width:100%}` with media-query max-widths, overridden by the custom `.container{width:calc(100% - 64px);max-width:1280px}` (computed max-width 1280px), plus the utilities .sr-only/.visible/.static/.block/.table/.grid/.hidden/.filter. A grep of src finds no className equal to any of those utilities. The app already def…

**Fix:** Remove the leftover Tailwind build: delete the @tailwind base/components/utilities directives at the top of src/index.css and the legacy tailwind.config.js, or at minimum set corePlugins.preflight: false. First confirm that no component still relies on Tailwind utility classes. Replace preflight with a small explicit reset in index.css that keeps list markers and paragraph spacing in prose, and add `.policy-body ul { list-style: disc; }` so the #/privacy lists show bullets. Scope the support-page paragraph rules (index.css ~619-640, and .page-head > p at 256) to the intended elements (.page-head > p, .support-block > p) so .support-note, eyebrows, the hours note and the 'Route states' note keep their own styles. Give empty states consistent vertical spacing.

**Files:** `package.json:26`, `postcss.config.js:3`, `src/index.css:5`, `src/index.css:6`, `src/index.css:7`, `src/index.css:161`, `src/index.css:165`, `src/index.css:256`, `src/index.css:258`, `src/index.css:298`, `src/index.css:299`, `src/index.css:300`, `src/index.css:621`, `src/index.css:629`, `src/index.css:640`, `src/index.css:650`, `src/index.css:658`, `src/index.css:663`, `src/index.css:671`, `src/index.css:727`, `src/index.css:737-738`, `src/pages/support/ContactPage.jsx:56-57`, `tailwind.config.js:4`

**Evidence:** [support/contact-1440-hours-willcall.jpg](screenshots/support__contact-1440-hours-willcall.jpg), [design/eyebrow-contact-pagehead-13px.jpg](screenshots/design__eyebrow-contact-pagehead-13px.jpg), [design/eyebrow-contact-supportblock-14px.jpg](screenshots/design__eyebrow-contact-supportblock-14px.jpg), [design/policy-nav-9px-eyebrow.jpg](screenshots/design__policy-nav-9px-eyebrow.jpg), [design/home-cards-1440.jpg](screenshots/design__home-cards-1440.jpg), [design/contact-willcall-paragraphs.jpg](screenshots/design__contact-willcall-paragraphs.jpg), [design/category-empty-results-1440.jpg](screenshots/design__category-empty-results-1440.jpg), [support/privacy-390-policy-layout.jpg](screenshots/support__privacy-390-policy-layout.jpg), [support/privacy-1440-full.jpg](screenshots/support__privacy-1440-full.jpg)

- [ ] Done

#### AW-270 · An out-of-area result is a dead end, and Tennessee is missing from the state list

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/delivery → service-area select → choose Florida or 'Another state'

**Problem:** Selecting Florida, Texas or 'Another state' shows only 'Delivery is currently on routes in Alabama, Mississippi, and Georgia.' It never says 'we don't deliver there' and offers no next step: no will-call alternative, no phone link, no 'call about future routes'. The 'Other' list (onboarding.js:19-22) is AR, FL, KY, LA, NC, SC, TX, VA and 'Another state'. Tennessee, which borders Alabama, is missing. The result also uses a serial comma ('Mississippi, and Georgia') while the rest of the site writes 'Mississippi and Georgia'.

**Fix:** In DeliveryPage.jsx:69-71, render: <b>We don’t run delivery routes in {otherState.name} yet.</b><span>You can collect orders at will-call in Birmingham, or call <PhoneLink /> to ask about your area.</span>, followed by a text-link to #/contact. Build the sentence with the existing routeStates constant. Add ['TN','Tennessee'] to OTHER_STATES (onboarding.js:20), or use the full list of 50 states.

**Files:** `src/data/onboarding.js:19-22`, `src/pages/support/DeliveryPage.jsx:69-71`

**Evidence:** [support/delivery-1440-eligibility-FL.jpg](screenshots/support__delivery-1440-eligibility-FL.jpg), [support/delivery-390-eligibility-FL.jpg](screenshots/support__delivery-390-eligibility-FL.jpg)

- [ ] Done

#### AW-271 · On the Contact page, 'Start application' shows the checklist again instead of the form

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/contact → 'Open a trade account' panel buttons

**Problem:** On #/contact the .support-cta panel has 'Application checklist ↗' (filled .button, navigates to #/apply) and 'Start application' (.button.ghost). Clicking 'Start application' opens the dialog in checklist mode with 0 form controls: the 'What you’ll need' list and a 'Continue to the application' button. On #/apply the same label opens the application form directly, with 13 input/select/textarea controls. So both Contact CTAs lead to a checklist first, and the filled, stronger style sits on the less direct action. Evidence: screenshots/vsupport__contact-1440-start-application-modal.jpg and screenshots/vsupport__apply-1440-start-application-modal.jpg

**Fix:** Change App.jsx:334 to <ContactPage {...supportShared} onApplyClick={openApplication} />. In ContactPage.jsx:72-73, make 'Start application' the filled .button, and turn 'Application checklist' into a .button.ghost or text-link.

**Files:** `src/App.jsx:289`, `src/App.jsx:334`, `src/pages/support/ContactPage.jsx:71-74`

**Evidence:** [support/contact-1440-start-application-modal.jpg](screenshots/support__contact-1440-start-application-modal.jpg), [support/apply-1440-start-application-modal.jpg](screenshots/support__apply-1440-start-application-modal.jpg)

- [ ] Done

#### AW-272 · The Apply page gives no approval timeframe and no credit-terms information

**Low** · content-copy · Who: **Owner → Cursor** · Effort: S · New · Viewports: all

**Where:** #/apply → 'Three steps to wholesale pricing' step 2

**Problem:** Step 2 on #/apply says 'A trade rep reviews the application and checks your license and resale certificate. Your account shows as pending until then' but gives no timeframe. The home page says 'approves most accounts within one business day' (App.jsx:786) and the dialog says 'Most applications are approved within one business day' (AuthModal.jsx:172). Net-30 or credit application steps are not mentioned, although the site advertises them.

**Fix:** Append 'Most applications are reviewed within one business day.' to step 2 in ApplyPage.jsx:53, using the owner-confirmed figure. If Net-30 is real, add a 4th item or a note: 'Want Net-30? Ask your trade rep for a credit application after approval.'

**Owner input needed:** What approval timeframe should the Apply page promise, and do you offer Net-30 credit terms to approved accounts?

**Files:** `src/pages/support/ApplyPage.jsx:52-54`

**Evidence:** [support/apply-1440-full.jpg](screenshots/support__apply-1440-full.jpg)

- [ ] Done

#### AW-273 · The policy side-nav marks the current page by colour alone

**Low** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/shipping, #/privacy, #/terms → 'Customer policies' side nav

**Problem:** The active item differs only in colour: rgb(184,57,10) versus rgb(36,32,44) for the others. Weight (600), size (12px) and marker are the same (index.css:730). Colour-blind users cannot tell which page they are on, and the page eyebrow 'CUSTOMER POLICIES' repeats the nav eyebrow 150px higher.

**Fix:** Change index.css:730 to '.policy-nav button[aria-current="page"] { color: var(--orange-dark); font-weight: 800; box-shadow: inset 3px 0 0 var(--orange); padding-left: 10px; }'. In the ≤850px block, use 'text-decoration: underline; text-underline-offset: 6px;' instead of the inset bar.

**Files:** `src/index.css:728`, `src/index.css:730`

**Evidence:** [support/terms-1440-policy-layout.jpg](screenshots/support__terms-1440-policy-layout.jpg)

- [ ] Done

#### AW-274 · The 'Wholesale pricing is locked' sign-in prompt is buried at the very bottom of All products

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/catalog → dashed 'Wholesale pricing is locked' box

**Problem:** For guests the sign-in prompt sits after all 8 departments, at y≈2328px (1440) and y≈2712px (390). It is a 440px dashed box aligned left under the last department, so it looks orphaned. Only a sentence in the intro mentions sign-in. There is also no 'Apply' option next to it for visitors without an account.

**Fix:** Move the block from lines 63-67 to directly after </PageHead> (line 18) as a compact full-width banner with two actions: 'Sign in' (onLoginClick) and 'Apply for an account' (onApplyClick; pass it through the shared props). Hide it when profile exists.

**Files:** `src/index.css:763`, `src/pages/support/CatalogIndexPage.jsx:63-67`

**Evidence:** [support/catalog-1440-full.jpg](screenshots/support__catalog-1440-full.jpg)

- [ ] Done

#### AW-275 · Hours lack a time zone and open-now state, and break mid-range on phones

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all; wrapping at 390

**Where:** #/contact 'When we’re open'; #/delivery will-call card; ContactStrip on all support pages

**Problem:** At 390×844, #/delivery 'Will-call' card <p> lines: ['Will-call is pickup at 613 Graymont Ave N, ', 'Birmingham, AL 35203 during business hours. Mon–', 'Fri 7:00 AM – 6:00 PM, Sat–Sun 8:00 AM – 5:30 PM.']. ContactStrip lines: ['Real people, same building as the inventory. Mon–', 'Fri 7:00 AM – 6:00 PM · Sat–Sun 8:00 AM – 5:30 ', 'PM.']. There is no 'CT' or 'Central' anywhere. The hours are stored in five places: ContactPage.jsx:8-11 (HOURS), content.js:15-16 (hoursLine1/2), content.js:67 (FAQS text), index.html openingHoursSpecification, and the hard-coded 'Holiday hours can differ' note. hoursLine1/2 are rendered at SupportShell.jsx:47, DeliveryPage.jsx:35, PolicyPage.jsx:27, App.jsx:112, App.jsx:1336 and App.jsx:1368. Screenshots: screenshots/qsup__delivery-390-contact-strip.jpg, screenshots/qsup__delivery-390-willcall-card.jpg

**Fix:** 1. In content.js, add `export const HOURS = [{ days: 'Mon–Fri', long: 'Monday – Friday', open: '7:00 AM', close: '6:00 PM' }, { days: 'Sat–Sun', long: 'Saturday – Sunday', open: '8:00 AM', close: '5:30 PM' }]`. Build hoursLine1/2 from it with non-breaking characters: `${d.days.replace('–', '–⁠')} ${open.replace(' ', ' ')} – ${close.replace(' ', ' ')} CT`. That yields e.g. 'Mon–⁠Fri 7:00 AM – 6:00 PM CT' with no break points inside a range.
2. Delete the local HOURS array in ContactPage.jsx:8-11 and map over the shared HOURS, using `long` for the <dt>. Append ' (Central Time)' to the 'When we’re open' heading, or add a note under the list: 'All times Central (CT). Georgia customers: 8:00 AM – 7:00 PM ET on weekdays.'
3. Every consumer (SupportShell.jsx:47, DeliveryPage.jsx:35, PolicyPage.jsx:27, App.jsx:112/1336/1368) then picks up the fix without further changes.
4. Optional: on #/contact, add an 'Open now · closes 6:00 PM CT' / 'Closed · opens 8:00 AM CT' badge computed with `new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false })`. Replace 'Holiday hours can differ' with the owner's actual holiday closure dates.

**Files:** `index.html:50-53`, `src/App.jsx:1336`, `src/App.jsx:1368`, `src/data/content.js:15-16`, `src/pages/support/ContactPage.jsx:8-11`, `src/pages/support/DeliveryPage.jsx:35`, `src/pages/support/PolicyPage.jsx:27`, `src/pages/support/SupportShell.jsx:47`

**Evidence:** [support/delivery-390-willcall-card-hours-wrap.jpg](screenshots/support__delivery-390-willcall-card-hours-wrap.jpg), [support/delivery-390-contact-strip-hours-wrap.jpg](screenshots/support__delivery-390-contact-strip-hours-wrap.jpg), [support/contact-1440-hours-willcall.jpg](screenshots/support__contact-1440-hours-willcall.jpg)

- [ ] Done

#### AW-276 · Redundant copy: back-to-back contact blocks on policy pages and restated sentences on Delivery

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/privacy, #/terms, #/shipping page end; #/delivery info cards

**Problem:** Every policy page ends with 'Questions about this policy? Call (205) 354-4473 or email …' (PolicyPage.jsx:127-129), followed immediately by the purple ContactStrip with the same phone and email. #/privacy adds a third contact prompt ('Contact the trade desk' section), giving three in a row. On #/delivery, card 01 repeats 'when … on a (delivery) route' in consecutive sentences, and card 03 says '$500.00 minimum' / 'The minimum order is $500.00.'

**Fix:** 1. PolicyPage.jsx:127-129: replace with `{policy.updated && <p className="support-note">Last updated {UPDATED}.</p>}` and drop the 'Questions about this policy?' sentence, since the ContactStrip directly below covers it.
2. PolicyPage.jsx:55-57: delete the privacy 'Contact the trade desk' section.
3. DeliveryPage.jsx:30: change to `Next-day delivery on our own trucks when your store is on a route. Free delivery on orders over {money(FREE_DELIVERY_THRESHOLD)}.`
4. DeliveryPage.jsx:41: replace the restated sentence with information that is not in the heading, using only facts already on the site, e.g. `<p>Per order, before delivery. Orders over {money(FREE_DELIVERY_THRESHOLD)} on a route also ride free.</p>`, with the wording confirmed by the owner. Or delete the <p> and let the heading stand alone.

**Files:** `src/pages/support/DeliveryPage.jsx:30`, `src/pages/support/DeliveryPage.jsx:40-41`, `src/pages/support/PolicyPage.jsx:55-57`, `src/pages/support/PolicyPage.jsx:127-129`

**Evidence:** [support/privacy-1440-full.jpg](screenshots/support__privacy-1440-full.jpg), [support/delivery-1440-info-cards.jpg](screenshots/support__delivery-1440-info-cards.jpg)

- [ ] Done

#### AW-277 · Policy dates are month-only, and the Delivery policy has no date at all

**Low** · content-copy · Who: **Owner → Cursor** · Effort: S · New · Viewports: all

**Where:** #/privacy, #/terms 'Last updated'; #/shipping (none)

**Problem:** UPDATED = 'September 2026' (PolicyPage.jsx:9), so there is no day, although Terms says 'the new version is posted here with an updated date'. POLICIES.shipping has no 'updated: true' (PolicyPage.jsx:14-18), so the delivery policy shows no date.

**Fix:** Give each policy its own ISO date (for example updated: '2026-09-27') and render <time dateTime={policy.updated}>September 27, 2026</time> at line 128. Add updated to POLICIES.shipping, or to #/delivery if the pages are merged.

**Owner input needed:** What exact effective or last-updated date should each policy (Privacy, Terms, Delivery/Shipping) show?

**Files:** `src/pages/support/PolicyPage.jsx:9`, `src/pages/support/PolicyPage.jsx:14-18`, `src/pages/support/PolicyPage.jsx:128`

**Evidence:** [support/shipping-1440-policy-layout.jpg](screenshots/support__shipping-1440-policy-layout.jpg)

- [ ] Done

#### AW-278 · The Contact page's Call, Email and Visit cards have no headings

**Low** · accessibility · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/contact → three info cards

**Problem:** The heading outline on #/contact is H1 'Contact & visit' → H2 'When we’re open' → H2 'Pick up at the warehouse' → H2 'Open a trade account'. CALL, EMAIL and VISIT are <p className='eyebrow'> (ContactPage.jsx:22, 28, 34), so the page's key information cannot be reached by heading navigation. The #/delivery cards use <h2>, so the two pages are also inconsistent.

**Fix:** In ContactPage.jsx lines 22, 28 and 34, change `<p className="eyebrow">CALL</p>` (and EMAIL, VISIT) to `<h2 className="eyebrow">Call</h2>` (text-transform keeps it uppercase). In index.css:628, change `.info-card h2 { … }` to `.info-card h2:not(.eyebrow) { font-size: 26px; margin: 0; }` so the eyebrow keeps its own size. After line 165, add `h2.eyebrow { font-family: var(--body); line-height: inherit; }` so it does not pick up the display face and tight line-height. The existing `.info-card .eyebrow` rule (index.css:627) already supplies color and margin.

**Files:** `src/pages/support/ContactPage.jsx:22`, `src/pages/support/ContactPage.jsx:28`, `src/pages/support/ContactPage.jsx:34`

**Evidence:** [support/contact-1440-full.jpg](screenshots/support__contact-1440-full.jpg)

- [ ] Done

#### AW-279 · No FAQ anywhere in support; the FAQ data is unused and contradicts the live pages

**Low** · content-copy · Who: **Owner → Cursor** · Effort: M · New

**Where:** Support area (no FAQ route/section); src/data/content.js exports

**Problem:** FAQS (content.js:57-74), TRUST, WELCOME_OFFERS, SHOP_CATS and BRANDS are exported but never imported; App.jsx:4 imports only COMPANY, ANNOUNCEMENTS, STORAGE, HERO_SLIDES and ORDER_MINIMUM. No support page answers common questions. The dormant FAQ text also conflicts with the live pages: 'approved within 24 hours' vs 'one business day'; requires 'a valid retail business license' vs the #/apply checklist (EIN, tobacco license, resale certificate); 'discount is applied automatically at checkout'. SHOP_CATS counts (Candies 57, Food Stuff 25) differ from the live 58 and 24.

**Fix:** 1. Rewrite FAQS in content.js:57-74 to match the live pages: 'one business day'; EIN + state retail tobacco license + resale certificate; delete 'The discount is applied automatically at checkout' unless checkout really applies it (App.jsx has no volume-discount logic). Confirm with the owner whether Net-30 is offered, because Terms (PolicyPage.jsx:80) lists only cash, checks and wires.
2. Render the FAQ on #/contact as a 'Common questions' section below the hours/will-call columns: `{FAQS.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}` inside `<section className="support-block" aria-labelledby="faq-title"><h2 id="faq-title">Common questions</h2>…</section>`.
3. Delete the unused SHOP_CATS (26-35), BRANDS (48), TRUST (50-55) and WELCOME_OFFERS (76-101) exports from content.js.

**Owner input needed:** Do you offer Net-30 terms and automatic volume discounts at checkout, and do you approve the rewritten FAQ answers before they go live?

**Files:** `src/App.jsx:4`, `src/data/content.js:26-35`, `src/data/content.js:48-74`, `src/data/content.js:76-101`

- [ ] Done

#### AW-280 · The Contact page offers only mailto: links, with no contact form or copy option

**Low** · ux-flow · Who: **Cursor** · Effort: S · New · Viewports: desktop mainly

**Where:** #/contact → EMAIL card and 'Email the trade desk' button

**Problem:** On #/contact, the EMAIL card's link and the 'Email the trade desk' button are both href='mailto:Alabamawholesaleinc@gmail.com'. There is no copy control, form or textarea on the page. The address is visible as plain link text, so it can be copied by hand. Webmail users (Gmail in a browser, common on store PCs) get the OS mail-app launcher or chooser instead of a compose window.

**Fix:** In ContactPage.jsx, after line 29, add `<button type="button" className="text-link" onClick={() => navigator.clipboard?.writeText(COMPANY.email).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy address'}</button>` with `const [copied, setCopied] = useState(false)`, and add a `<span className="sr-only" aria-live="polite">{copied ? 'Email address copied' : ''}</span>`. Optional contact form: add a `submit_contact_message` RPC plus an insert-only `contact_messages` table in a new supabase/migrations file, mirroring the submit_quote pattern. Call it from a small form (name, business, phone, message) via a new function in src/lib/orders.js. Do not use the unused Netlify form definitions in index.html.

**Files:** `src/pages/support/ContactPage.jsx:27-32`

**Evidence:** [support/contact-1440-full.jpg](screenshots/support__contact-1440-full.jpg)

- [ ] Done

## Content, copy & business facts

#### AW-001 · Storefront advertises kratom, 'mushroom', detox/synthetic-urine and sexual-enhancement products from an Alabama warehouse

**Critical** · content-copy · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** #/ → 'Exotics & Novelties' editorial card; #/category/NOVELTIES sub-pills 'Kratom & Kava', 'Mushroom Products', 'Detox', 'Wellness Pills'; #/category/MERCHANDISE/Honey & Energy; #/product/308; Novelties meta description

**Problem:** Home editorial H2 reads 'Disposables, detox, kratom & more.' (App.jsx:724). The Novelties department has a 'Kratom & Kava' subcategory with 3 items: Wava kava, Mazza Shots and Sip happens. Their descriptions say '…from the kratom and kava line in our Novelties department' (products.js:172, :174, :608). The tab title is 'Kratom & Kava · Novelties & Vapes · Wholesale Catalog'. The Novelties meta description lists 'Detox, Disposable Vapes, Hookah & Shisha, Kratom & Kava'. Header search for 'kratom' returns 3 results. 'Mushroom Products' is the largest Novelties line at 19 of 51 SKUs (Shroom Puff disposable 3 Gram, Psyched disposable 9000mg, Stoned mushroom gummies, Melted mushroom pre rolls…), and none of them states an ingredient or legal status. Product 308 description: 'UPass toxin-free synthetic urine, 3 oz, from the detox line…' (products.js:638). 'Honey & Energy' holds Rhino pills 2-pack, Hard Steel honey/shots/pills, VIP Royal Honey, Secret Miracle Honey and Black Tiger Honey (products.js:77, :551-553, :663-666, :685-686). Alabama added kratom's alkaloids (mitragynine, 7-hydroxymitragynine) to Schedule I in 2016. FDA has repeatedly warned that 'Rhino' and 'royal honey' enhancement products contain undeclared sildenafil/tadalafil. Several states restrict synthetic-urine sales. The owner and counsel need to confirm every item before launch.

**Also seen:**
- #/ → Collections row → cream card 'EXOTICS & NOVELTIES' headline — Live #/ at 1440x900: .editorial-card.cream innerText = 'EXOTICS & NOVELTIES / Disposables, detox, kratom & more.' (screenshot evidence/vhome/editorials-1440.png). A repo grep finds 'kratom' in src/App.jsx:724, in products.js:172, :174 and :608 (descriptions shown on product pages), and in supabase/seed/products.sql:81, :82 and :299. products.js:638 describes UPass as 'toxin-free synthetic urine'.
- #/catalog → Department 02 Novelties & Vapes → 'Kratom & Kava (3)' pill (also #/category/NOVELTIES/Kratom%20%26%20Kava) — Live PDPs: #/product/75 'Wava kava from the kratom and kava line in our Novelties department…', #/product/76 'Mazza Shots from the kratom and kava line…' and #/product/293 'Sip happens from the kratom and kava line…'. Mushroom descriptions give no ingredient information, e.g. #/product/289 'Psyched disposable 9000mg from the mushroom product line in our Novelties department.' and #/product/306 'Stoned mushroom gummies bags regular from the mushro…
- #/category/NOVELTIES/Kratom%20%26%20Kava sub-line pill and mega-menu; #/ editorial card "Disposables, detox, kratom & more."; PDP descriptions of #75, #76, #293 — sub: "Kratom & Kava" appears on #75 Wava kava, #76 Mazza Shots and #293 Sip happens. Each description says "from the kratom and kava line in our Novelties department". The home editorial card heading is "Disposables, detox,<br />kratom & more." (App.jsx:724). The category page shows a "Kratom & Kava (3)" pill. Alabama lists mitragynine and 7-hydroxymitragynine, kratom's active alkaloids, as Schedule I controlled substances (2016, Ala. Code § 20-2…
- #/category/MERCHANDISE/Honey%20%26%20Energy, #/category/NOVELTIES/Detox, Wellness Pills — #28 Rhino pills 2-pack; #265 Hard Steel (shots/honey/pills), #321 VIP Royal Honey gold and #332 Black Tiger Honey, all tagged PREMIUM; #266 Blue Wolf honey; #322 Secret Miracle Honey. FDA's tainted sexual-enhancement product notifications have repeatedly named "Rhino" pills and "royal honey" products for undeclared sildenafil/tadalafil. #308 UPass is described as "toxin-free synthetic urine", which a number of states restrict. #219 "Happy valenti…

**Fix:** Remove the 'Kratom & Kava' sub-line and its products (products.js:171-174, 607-608; supabase/seed/products.sql:81-82), and remove 'kratom' from the home Exotics & Novelties card headline (App.jsx:724). Get a legal/compliance review of the Mushroom Products, Detox, Wellness Pills and MERCHANDISE/Honey & Energy lines. Delist or de-feature the flagged items (drop the PREMIUM badge from the enhancement products). Remove these terms from the sub-pills, the mega menu, the #/catalog pills, the PDP descriptions (#75, #76, #293, #308) and the Novelties meta description.

**Owner input needed:** After legal/compliance review, which product lines (Kratom & Kava, Mushroom Products, Detox, Wellness Pills, Honey & Energy enhancement items) should be delisted, de-featured or kept?

**Files:** `scripts/build-seed.mjs:18`, `src/App.jsx:724`, `src/App.jsx:1099`, `src/data/products.js:77`, `src/data/products.js:159`, `src/data/products.js:159-170`, `src/data/products.js:171`, `src/data/products.js:171-174`, `src/data/products.js:172`, `src/data/products.js:173`, `src/data/products.js:174`, `src/data/products.js:459`, `src/data/products.js:537`, `src/data/products.js:551`, `src/data/products.js:553`, `src/data/products.js:583-647`, `src/data/products.js:607`, `src/data/products.js:607-608`, `src/data/products.js:608`, `src/data/products.js:637`, `src/data/products.js:663`, `src/data/products.js:665`, `src/data/products.js:685`, `src/lib/useCatalog.js:19`, `supabase/seed/products.sql`, `supabase/seed/products.sql:81`, `supabase/seed/products.sql:81-82`, `supabase/seed/products.sql:82`, `supabase/seed/products.sql:299`

**Evidence:** [copy/home-editorial-kratom.jpg](screenshots/copy__home-editorial-kratom.jpg), [copy/novelties-kratom-kava.jpg](screenshots/copy__novelties-kratom-kava.jpg), [copy/novelties-mushroom-products.jpg](screenshots/copy__novelties-mushroom-products.jpg), [home/crop-editorial-cream.jpg](screenshots/home__crop-editorial-cream.jpg), [home/sec-1440-editorials.jpg](screenshots/home__sec-1440-editorials.jpg), [support/catalog-1440-novelties-expanded.jpg](screenshots/support__catalog-1440-novelties-expanded.jpg), [data/novelties-kratom-kava-subline.jpg](screenshots/data__novelties-kratom-kava-subline.jpg), [data/home-editorial-kratom.jpg](screenshots/data__home-editorial-kratom.jpg)

- [ ] Done

#### AW-025 · Advertised 'Net-30 trade terms' and 'Save up to 18%' volume discounts are not backed by the pricing system (capped at 10%) or stated in the Trade terms

**High** · content-copy · Who: **Owner → Cursor** · Effort: S · Still open from the 2026-09-25 audit · Viewports: desktop/tablet (ticker hidden on phones); services block all

**Where:** Every page → top ticker; #/ → services block 02 'Net-30 trade terms'

**Problem:** Ticker (content.js:23, hidden below 600px by index.css:563): '★ VOLUME DISCOUNTS · Save up to 18% on pallet quantities'. Home services 02 (App.jsx:744): 'Volume discounts up to 18% on pallet quantities across all eight departments.' The only discounts are account tiers: TIER_DISCOUNT = { standard: 0, silver: 0.05, gold: 0.10 } (App.jsx:28) and the pricing_tiers seed of 0/5/10% (supabase/migrations/20260517000000_initial_schema.sql:95-98). Server line prices come from the trigger public.enforce_order_item_price (supabase/migrations/20260925120000_launch_order_boundaries.sql:47-123), which applies only the tier discount_pct (:106-110). No quantity or pallet discount exists, and #/terms 'Pricing and quotes' (PolicyPage.jsx:72) has no schedule. The unused FAQ (content.js:69) says the discount 'is applied automatically at checkout', which is false.

**Also seen:**
- #/terms → Payment section vs ticker (every page), home services, application dialog — Verified live with Playwright on #/terms and #/ at 1440. The ticker (ANNOUNCEMENTS, content.js:21 and :23) appears on every page, including #/terms. The home services card at App.jsx:744 says 'pay on Net-30 terms. Volume discounts up to 18%…'. The application dialog at AuthModal.jsx:172 says 'Net-30 terms available with credit verification.' The original finding missed one live location: hero slide 4 (content.js:45, rendered by HeroCarousel at Ap…

**Fix:** Settle the actual offer: who is eligible for Net-30, and the real maximum tier discount from pricing_tiers. State it the same way in the ticker (content.js:21, 23), the home services block 02 (App.jsx:744), the application dialog, and the #/terms Payment section (PolicyPage.jsx:79-81). If the offer doesn't exist, remove the claims everywhere.

**Owner input needed:** Do you actually offer Net-30 terms (and to whom), and what is the real maximum volume discount, or should these claims be removed?

**Files:** `src/App.jsx:28`, `src/App.jsx:744`, `src/components/AuthModal.jsx:172`, `src/data/content.js:21`, `src/data/content.js:23`, `src/data/content.js:45`, `src/data/content.js:50-101`, `src/data/content.js:53`, `src/data/content.js:69`, `src/data/content.js:96`, `src/data/onboarding.js:5`, `src/pages/support/PolicyPage.jsx:79-81`, `src/pages/support/PolicyPage.jsx:79`, `supabase/migrations/20260517000000_initial_schema.sql:95`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:106`

**Evidence:** [copy/home-services-18pct-net30.jpg](screenshots/copy__home-services-18pct-net30.jpg), [support/terms-1440-full.jpg](screenshots/support__terms-1440-full.jpg), [copy/terms-page-full.jpg](screenshots/copy__terms-page-full.jpg)

- [ ] Done

#### AW-026 · Nicotine warning is non-standard, 11px, only below the footer, and missing on nicotine product pages

**High** · content-copy · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Footer .fda-note on every route; vape/pouch product pages (e.g. #/product/61, #/product/60); home New arrivals rail

**Problem:** The only nicotine warning is the footer strip (App.jsx:1350). It is 11px text rgb(203,184,236) on rgb(28,14,64), and on #/product/61 (Geek Bar Pulse X 25K) it starts at y=2076 of a 2171px page. Nothing near vape, ZYN/PIK pouch or cigarette product content carries a warning, and the homepage's first product rail opens with 3 disposable vapes. The wording 'Tobacco products sold by Alabama Wholesale Inc. contain nicotine…' is not FDA's required statement 'WARNING: This product contains nicotine. Nicotine is an addictive chemical.'. Under 21 CFR part 1143, ads for covered products must put that statement in the upper portion of the ad, covering at least 20% of it. The text ends 'Not for sale to minors.', which contradicts the federal 21+ minimum the site states everywhere else.

**Also seen:**
- #/ → footer .fda-note; hero slide 2; Geek Bar, Foger and RAZ cards — The only nicotine warning is the 11px .fda-note at the very end of the page (y≈5153 of 5248 at 1440). It uses custom wording: 'WARNING: Tobacco products sold by Alabama Wholesale Inc. contain nicotine. Nicotine is an addictive chemical…' (src/App.jsx:1350). Meanwhile the page promotes e-cigarettes: hero slide 2 is a Geek Bar Pulse X ad (hero_vape.jpg), and the New arrivals and Bestsellers rows show Geek Bar, Foger and RAZ disposables, none with a…
- Footer → dark warning bar (.fda-note) — The only nicotine warning on the site is the last element on the page: 'WARNING: Tobacco products sold by Alabama Wholesale Inc. contain nicotine. Nicotine is an addictive chemical. Products are distributed exclusively…', set in 11px #cbb8ec on #1c0e40 (contrast 9.78, so colour is fine). The FDA required statement is 'WARNING: This product contains nicotine. Nicotine is an addictive chemical.' (21 CFR 1143.3). The site paraphrases it and it is no…
- #/product/<id> for TOBACCO and nicotine NOVELTIES items (e.g. #/product/60 Geek Bar Pulse 15K, 18 ZYN, 64 RAZ 25K, 17 Black & Mild) — #/product/60 Geek Bar Pulse 15K, 64 RAZ 25K and 17 Black & Mild: the .pd-info text contains no 'warning'/'nicotine'. #/product/18 ZYN matches only in the product name. The single warning on the page is the footer strip 'WARNING: Tobacco products sold by Alabama Wholesale Inc. contain nicotine…' (App.jsx:1350), at page y≈2090 of a 2171px document at 1440×900, about 1,100px below the purchase block. The product photos on 60, 61 and 62 are manufactu…

**Fix:** Use the exact FDA-required statement ('WARNING: This product contains nicotine. Nicotine is an addictive chemical.') in place of the reworded .fda-note text, and say 'under 21', not 'minors'. Set it at a legible size (at least 12-14px, meeting the FDA's required proportion of the ad area where applicable). Show it on every nicotine/tobacco PDP and card (Geek Bar, Foger, RAZ, ZYN, Black & Mild; App.jsx:1094), on the hero vape slide, and in the footer (App.jsx:1349-1350, index.css:428).

**Files:** `src/App.jsx:293`, `src/App.jsx:716`, `src/App.jsx:738`, `src/App.jsx:953`, `src/App.jsx:1094`, `src/App.jsx:1099`, `src/App.jsx:1349`, `src/App.jsx:1350`, `src/data/content.js:43`, `src/index.css:428`, `src/index.css:429`

**Evidence:** [copy/footer-nicotine-warning.jpg](screenshots/copy__footer-nicotine-warning.jpg), [copy/product-61-geekbar-no-warning.jpg](screenshots/copy__product-61-geekbar-no-warning.jpg), [home/hero-1440-slide2.jpg](screenshots/home__hero-1440-slide2.jpg), [home/crop-footer-bottom.jpg](screenshots/home__crop-footer-bottom.jpg), [nav/footer-bottom-edge-1440.jpg](screenshots/nav__footer-bottom-edge-1440.jpg)

- [ ] Done

#### AW-027 · Privacy policy omits uploaded license documents, browser storage, service providers, retention, sharing and user rights

**High** · content-copy · Who: **Owner → Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/privacy

**Problem:** Live #/privacy at 1440 wide shows these H2s: 'What we collect', 'Why we collect it', 'Contact the trade desk', then the ContactStrip 'Talk to the warehouse'. The support-note reads 'Last updated September 2026. Questions about this policy? Call (205) 354-4473 or email …', directly below the 'Questions about what we collect: call …' section. The policy never mentions uploaded license or resale-certificate files (private bucket 'application-documents': PDF, JPEG, PNG or HEIC, up to 10 MB, per supabase/migrations/20260927180000_application_documents.sql:9-20). It also never mentions browser storage: aw-age-verified, aw-cart, and the Supabase session token under key 'aw-auth' (src/lib/supabase.js:13-15). It names no processors (Supabase, Netlify) and says nothing about sharing, retention, security or access/deletion requests. The only date is the month-level 'September 2026' (PolicyPage.jsx:9).

**Also seen:**
- #/privacy → policy body — Verified at 1440 (evidence/vsupport/privacy-1440-body.png). The documents gap is real: supabase/migrations/20260927180000_application_documents.sql creates the private bucket 'application-documents' (line 11; 10 MB limit, PDF/JPEG/PNG/HEIC) and lets admins read every file (lines 78-86, public.is_admin()). Two corrections. (1) The Netlify form definitions in index.html:62-91 are dead markup: no code in src posts to them (grep finds no 'form-name' …
- #/privacy → 'What we collect' / 'Why we collect it' — The Privacy page lists application fields and order details only (PolicyPage.jsx:43-54). It does not mention: uploaded images/PDFs of the state tobacco license and resale certificate (stored in Supabase Storage); that account, application and order data are stored with Supabase and the site is hosted by Netlify; how long applications, documents and declined applicants' data are kept, and how to request deletion; or that the site stores the sessio…

**Fix:** Expand #/privacy (PolicyPage.jsx:37-59) to cover uploaded license/EIN documents, processors (Supabase, Netlify, email provider), sharing, retention periods, browser storage (localStorage age gate/cart), and access/deletion rights with a contact method. Update the date.

**Owner input needed:** Provide or approve (ideally with counsel) the privacy policy details: service providers used, data sharing, retention periods for uploaded license/EIN documents, and the contact method for access/deletion requests.

**Files:** `src/pages/support/PolicyPage.jsx:9`, `src/pages/support/PolicyPage.jsx:37`, `src/pages/support/PolicyPage.jsx:37-59`, `src/pages/support/PolicyPage.jsx:43`, `src/pages/support/PolicyPage.jsx:55`, `src/pages/support/PolicyPage.jsx:127`

**Evidence:** [copy/privacy-page-full.jpg](screenshots/copy__privacy-page-full.jpg), [support/privacy-1440-full.jpg](screenshots/support__privacy-1440-full.jpg)

- [ ] Done

#### AW-028 · Trade terms omit returns and damaged goods, credit terms, taxes, risk of loss, liability and governing law

**High** · content-copy · Who: **Owner → Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/terms

**Problem:** Sections present: Who can buy, Account approval, Pricing and quotes, Orders and delivery, Payment ('cash, checks, and electronic wiring and transfers'), Resale and compliance, Your login, Changes (PolicyPage.jsx:60-92). Missing for a B2B distributor: a returns / damaged / short-shipment claim window and credits; Net-30 and credit terms with late fees (promoted elsewhere); sales-tax exemption and tobacco excise/stamp responsibility; title and risk of loss at delivery or pickup; recalls and warranties; limitation of liability; governing law and venue (Alabama); cancellation of confirmed orders; the volume-discount schedule claimed on the homepage. The inline link 'See Delivery for how that works' points to a page titled only 'Delivery'.

**Also seen:**
- #/terms and #/shipping → policy body; footer policy links — #/terms has 8 H2 sections only: Who can buy, Account approval, Pricing and quotes, Orders and delivery, Payment, Resale and compliance, Your login, Changes. #/shipping has How we deliver, Minimum order, Will-call pickup, Receiving your order, Tobacco and vapor products. The only after-delivery guidance is 'Count the cases and check for damage when the order arrives or when you collect it.' It never says what to do next. Nothing covers returns, re…

**Fix:** Expand #/terms with returns, damaged/short-shipment claims, cancellations, substitutions, credit terms, taxes, risk of loss, limitation of liability and governing law (PolicyPage.jsx:60-92), and link these sections from the delivery page.

**Owner input needed:** Provide or approve (ideally with counsel) your actual policies on returns, damaged/short shipments, cancellations, substitutions, credit terms, taxes, risk of loss, liability limits and governing law.

**Files:** `src/App.jsx:1341-1345`, `src/pages/support/PolicyPage.jsx:14-36`, `src/pages/support/PolicyPage.jsx:60`, `src/pages/support/PolicyPage.jsx:60-92`, `src/pages/support/PolicyPage.jsx:77`, `src/pages/support/PolicyPage.jsx:79`, `src/pages/support/SupportShell.jsx:9-13`

**Evidence:** [copy/terms-page-full.jpg](screenshots/copy__terms-page-full.jpg), [support/terms-1440-full.jpg](screenshots/support__terms-1440-full.jpg), [support/shipping-1440-policy-layout.jpg](screenshots/support__shipping-1440-policy-layout.jpg)

- [ ] Done

#### AW-126 · Uncensored profanity 'Fuckin fab' appears on a product page and in its meta and social description

**Medium** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/product/60 (Geek Bar Pulse 15K) → variant chip, description, meta description, og:description

**Problem:** products.js:141 variants ['Blue razz ice', 'Fuckin fab']. products.js:142 description: 'Geek Bar Pulse 15,000-puff disposable vape. Two flavors: Blue razz ice and Fuckin fab.' Rendered on the page as a variant chip and in the description. document meta description and og:description both equal that sentence, so it also appears in search results and link previews. supabase/seed/products.sql contains it too.

**Also seen:**
- #/product/60 (Geek Bar Pulse 15K, BESTSELLER, shown in the home Bestsellers rail): variant chip, description, cart and quote line, order SKU — Row 60 has variants ["Blue razz ice", "Fuckin fab"] and the description "Two flavors: Blue razz ice and Fuckin fab." The PDP shows a "Fuckin fab" chip. With the variant in the cart, #/quote shows the line "Geek Bar Pulse 15K — Fuckin fab" with SKU "AW-GEEKBAR-15K-FUCKIN-FAB". The same SKU and product_name would be written to order_items by the server trigger.

**Fix:** Rename the 'Fuckin fab' Geek Bar Pulse 15K variant (#60) to a clean label (for example 'F*** Fab' or the manufacturer's clean name) in products.js:141-142 and the seed. That changes the variant chip, description, meta/og description and generated SKU.

**Files:** `src/data/products.js:141`, `src/data/products.js:142`, `supabase/seed/products.sql`

**Evidence:** [copy/product-60-profanity-variant.jpg](screenshots/copy__product-60-profanity-variant.jpg), [data/pdp-60-profanity-variant.jpg](screenshots/data__pdp-60-profanity-variant.jpg), [data/quote-sku-double-hyphen.jpg](screenshots/data__quote-sku-double-hyphen.jpg)

- [ ] Done

#### AW-127 · Business contact email is a capitalised Gmail address instead of a domain address

**Medium** · content-copy · Who: **Owner → Cursor** · Effort: S · New · Viewports: all

**Where:** Footer Contact column, Help dialog, #/contact, all policy pages, error messages, document-upload note, JSON-LD

**Problem:** COMPANY.email = 'Alabamawholesaleinc@gmail.com' (content.js:11), with a capital A. It is shown in the footer, Help dialog, #/contact ('Email the trade desk'), #/shipping, #/privacy and #/terms (twice each), ServiceUnavailable, the AuthModal errors, the DocumentUploads note 'send proof later to Alabamawholesaleinc@gmail.com', and JSON-LD "email" (index.html:41). The site's canonical domain is alabamawholesaleinc.com. A free webmail address on a B2B page that collects EINs and license documents undermines trust and invites phishing look-alikes.

**Also seen:**
- Footer Contact column, Help dialog, contact page (COMPANY.email) — COMPANY.email is 'Alabamawholesaleinc@gmail.com' (content.js:11). It displays with a capital 'A' in the footer and the Help dialog, and the mailto: link uses it too. A free Gmail address on a B2B trade site that collects EIN and licence documents weakens trust. The phone placeholder the earlier audit flagged has been replaced with a real number, but the email has not been updated.
- #/contact EMAIL card, every policy page, ContactStrip, footer, JSON-LD — COMPANY.email is 'Alabamawholesaleinc@gmail.com' (content.js:11). It is the only written channel, shown on #/contact ('Email the trade desk'), in every policy note, in ContactStrip 'Email us', in the footer and in the LocalBusiness JSON-LD (index.html:41). The site asks retailers for EINs, license numbers and scanned licenses, and a free-mail address looks unofficial and is easy to impersonate. The capital 'A' is also unusual in an email address.

**Fix:** Replace the capitalised Gmail address in content.js COMPANY.email and the index.html JSON-LD with a lowercase domain address (for example orders@alabamawholesaleinc.com). This updates the footer, Help dialog, #/contact, policy pages, ContactStrip, error messages and the document-upload note.

**Owner input needed:** Which domain email address (e.g. orders@alabamawholesaleinc.com) is set up and monitored, so it can replace the Gmail address site-wide?

**Files:** `index.html:41`, `src/data/content.js:11`

**Evidence:** [copy/help-dialog.jpg](screenshots/copy__help-dialog.jpg), [nav/footer-1440.jpg](screenshots/nav__footer-1440.jpg), [nav/help-dialog-1440.jpg](screenshots/nav__help-dialog-1440.jpg), [support/contact-1440-full.jpg](screenshots/support__contact-1440-full.jpg)

- [ ] Done

#### AW-128 · 'Flavors' is used for sizes, packaging and formats, and 'Flavors and availability change often' shows on condoms, motor oil and lighters

**Medium** · content-copy · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** #/product/265, #/product/332, #/product/257, #/product/171 and every product with more than one variant

**Problem:** products.js:552 Hard Steel 'Six flavors: Shots, Honey, Pills, Gold shots, Gold honey and Gold pills.' :686 Black Tiger Honey 'Two flavors: Flat box and Round box.' :536 TOP papers 'Two flavors: Jar and Box.' :532 RAW papers 'Two flavors: Classic 1 1/4 and Classic king size slim.' :364 Hershey's 'Eight flavors: Milk reg, Milk king size, Cookies reg, Cookies king…' Same pattern at :348 M&M's, :354 Reese's, :360 Skittles, :340 Little Trees 'Three flavors: Assorted display, Black ice single…' and :122 Cloverhill 'Two flavors: Big Texas and Honey bun'. App.jsx:1107 prints 'Flavors and availability change often. The trade desk confirms what is in stock.' for every product with more than one variant, including Trojan condoms, STP oil treatments, Saxon motor oil and BIC lighters. Variant labels mix 'reg', 'regular', 'king' and 'king size' (Hershey's 'Cookies king' vs 'Milk king size').

**Also seen:**
- #/product/<multi-variant id> → .in-cart-note lines under the chips — Every product with more than one variant shows 'Flavors and availability change often. The trade desk confirms what is in stock.' (App.jsx:1107), including 75 products whose variants are sizes, colors or grades: 151 White V-neck shirts (S–5X), 56 Saxon motor oil (5W-30…Type F), 27 Duracell (9V, AAA4…), 356 Gas cans (1 gal…), 21 Speed Stick (Small/Big), 270 Monster Energy ('Three colors'). The second note, 'Choose one variant. Each variant is quot…

**Fix:** Label the variant axis per product (Flavor / Size / Color / Grade / Format) instead of always saying 'Flavors'. Show 'Flavors and availability change often' only for flavored consumables, not condoms, motor oil or lighters. Rewrite the jargon variant help text (App.jsx:1107-1108).

**Files:** `src/App.jsx:1107`, `src/App.jsx:1108`, `src/data/products.js:364`, `src/data/products.js:532`, `src/data/products.js:536`, `src/data/products.js:552`, `src/data/products.js:686`, `src/index.css:330`

**Evidence:** [copy/product-265-six-flavors-shots-pills.jpg](screenshots/copy__product-265-six-flavors-shots-pills.jpg), [product/photo-151-vneck-shows-crewneck.jpg](screenshots/product__photo-151-vneck-shows-crewneck.jpg)

- [ ] Done

#### AW-129 · Tobacco-license requirement contradicts itself: 'only needed for tobacco' vs required for every applicant

**Medium** · content-copy · Who: **Owner → Cursor** · Effort: S · New · Viewports: all

**Where:** Application checklist (#/apply and signup dialog) vs signup form, #/terms 'Who can buy' and #/ services 03

**Problem:** Checklist (onboarding.js:7): 'State retail tobacco license number — Issued by the state your store is in. Required before you can buy tobacco or vapor products.' That implies it is optional for other buyers. Yet the signup form makes 'State retail tobacco license #' required for every business type, including 'Auto Parts', 'Grocery / Bodega' and 'Liquor Store' (AuthModal.jsx:15, :257-259). Terms (PolicyPage.jsx:67) say every applicant must provide it, and home (App.jsx:745) says 'We verify your state retail tobacco license and resale certificate before your first order.' An auto-parts store buying only motor oil cannot apply.

**Fix:** Owner decision. If the license is only needed for tobacco, vapor and nicotine: drop `required` at AuthModal.jsx:258, set the hint to 'Required to buy tobacco, vapor and nicotine products.', and change PolicyPage.jsx:67 and App.jsx:745 to match. If it is required for everyone: change onboarding.js:7 detail to 'Required for every trade account.'

**Owner input needed:** Is a tobacco license required for every trade account, or only for buying tobacco, vapor and nicotine products?

**Files:** `src/App.jsx:745`, `src/components/AuthModal.jsx:257`, `src/data/onboarding.js:7`, `src/pages/support/PolicyPage.jsx:67`

**Evidence:** [copy/auth-signup.jpg](screenshots/copy__auth-signup.jpg)

- [ ] Done

#### AW-130 · Two overlapping delivery pages (#/shipping and #/delivery) that still omit fees, cutoff, days and receiving rules

**Medium** · content-copy · Who: **Owner → Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** #/shipping, #/delivery, footer, PolicyNav

**Problem:** #/shipping has the H1 'Delivery' and is linked as 'Delivery' in the footer legal row and PolicyNav (SupportShell.jsx:10). #/delivery ('Delivery & service area') repeats most of the same copy and is linked in the footer 'Account & help' column, so the footer shows both 'Delivery' and 'Delivery & service area'. Neither page states the delivery fee for on-route orders under $1,500, the cutoff time for next-day delivery, route days, will-call lead time, or ID needed at pickup. 'Receiving your order: Count the cases and check for damage…' (PolicyPage.jsx:29-31) says nothing about what to do next. The out-of-area checker result 'Delivery is currently on routes in Alabama, Mississippi, and Georgia.' (DeliveryPage.jsx:70) offers no next step and adds an Oxford comma used nowhere else. #/shipping has no 'Last updated' line (no updated:true at PolicyPage.jsx:14), unlike #/privacy and #/terms.

**Also seen:**
- #/shipping and #/delivery; PolicyNav; footer; Contact will-call block — PolicyNav order, measured live: ['Delivery','Privacy','Trade terms','Delivery & service area','Contact & visit'] (SupportShell.jsx:9-13 plus lines 65-66). The footer bottom 'Delivery' goes to #/shipping (App.jsx:1342). Footer 'Account & help' → 'Delivery & service area' goes to #/delivery (App.jsx:1328). The Contact page shows 'Delivery & service area' and 'Delivery policy' side by side (ContactPage.jsx:59-60). DeliveryPage.jsx:94 links 'Delivery…
- Footer → 'Delivery & service area' (Account & help column) and 'Delivery' (legal row) — 'Delivery & service area' goes to #/delivery (H1 'Delivery & service area': next-day trucks, pick up in Birmingham, $500 minimum, route states). The legal-row 'Delivery' goes to #/shipping, whose H1 is also 'Delivery' and which covers 'How we deliver', 'Minimum order' and 'Will-call pickup'. The route key 'shipping' doesn't match its title, and buyers can't tell the two apart from the labels.
- #/delivery info cards and #/shipping policy — 'Next-day delivery' is promised on #/delivery, #/shipping and in the ticker, but no page gives an order cutoff time, which days each route runs, or what happens to Friday and weekend orders. Only 'Free delivery on orders over $1,500' is stated; the fee for $500-$1,499.99 route orders is never given. The pages do not say whether the $500 minimum also applies to will-call, or who may sign for tobacco and vapor deliveries (21+ ID). Card 03 reads '$5…

**Fix:** Merge #/shipping and #/delivery into one 'Delivery & pickup' page, redirect the other route, and update the footer, PolicyNav and the Contact will-call block (PolicyPage.jsx:14-36, 77; DeliveryPage.jsx:15-102; SupportShell.jsx:9-13). Add the order cutoff time, delivery days per route, the fee for orders under $1,500, tobacco receiving/ID rules, and the damaged/short-shipment claim process.

**Owner input needed:** What are the order cutoff time, delivery days per route, the fee for orders under $1,500, tobacco receiving/ID rules, and the damaged/short-shipment claim process?

**Files:** `src/App.jsx:25`, `src/App.jsx:174`, `src/App.jsx:336`, `src/App.jsx:1342`, `src/pages/support/ContactPage.jsx:59-60`, `src/pages/support/DeliveryPage.jsx:15-102`, `src/pages/support/DeliveryPage.jsx:26-43`, `src/pages/support/DeliveryPage.jsx:70`, `src/pages/support/DeliveryPage.jsx:94`, `src/pages/support/PolicyPage.jsx:14`, `src/pages/support/PolicyPage.jsx:14-36`, `src/pages/support/PolicyPage.jsx:16`, `src/pages/support/PolicyPage.jsx:19-34`, `src/pages/support/PolicyPage.jsx:24`, `src/pages/support/PolicyPage.jsx:27`, `src/pages/support/PolicyPage.jsx:29`, `src/pages/support/PolicyPage.jsx:77`, `src/pages/support/SupportShell.jsx:9-13`, `src/pages/support/SupportShell.jsx:10`

**Evidence:** [copy/delivery-other-state-result.jpg](screenshots/copy__delivery-other-state-result.jpg), [support/shipping-1440-full.jpg](screenshots/support__shipping-1440-full.jpg), [support/delivery-1440-full.jpg](screenshots/support__delivery-1440-full.jpg), [nav/footer-1440.jpg](screenshots/nav__footer-1440.jpg), [support/delivery-1440-info-cards.jpg](screenshots/support__delivery-1440-info-cards.jpg)

- [ ] Done

#### AW-131 · The 'apply for a trade account' action has up to seven different labels, and capitalization is mixed

**Medium** · consistency · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** Header, trade bar, mobile menu, footer, product page, Help dialog, auth dialog, product cards, page titles and breadcrumbs

**Problem:** Live 390px mobile menu, Account group: 'Sign In', 'Sign Up ↗', 'Quick Reorder', 'Help', then the menu-contact CTA 'Apply for a trade account ↗'. Header at 1440: 'Sign In' 'or' 'Sign Up ↗' … 'New Arrivals' 'Bestsellers' 'Exotics ↗' 'Quick Reorder' 'Help'. Footer: 'Apply for account', 'Sign in', 'New arrivals'. Home card actions: 7 cards 'LOCKED · Sign in for pricing / Choose', 1 card '… / QUOTE +'. Help dialog: 'Apply for an account'. AuthModal titles 'Apply for an account' (AuthModal.jsx:150-151) and 'No account? Apply instead' (:203). #/account tab title 'My Account · Alabama Wholesale Inc' vs H1 'My account'. #/apply tab title 'Apply for a Trade Account' vs H1 'Apply for a trade account'.

**Also seen:**
- #/ → trade bar, header, apply section, footer, Help dialog — The same signup modal (openSignup) is labelled: 'Apply for a trade account ↗' (trade bar, App.jsx:297), 'Sign Up ↗' (header, App.jsx:495), 'Become a retail account' + 'Start application ↗' (home apply section, App.jsx:776-777), 'Apply for account' (footer, App.jsx:1324) and 'Apply for an account' (Help dialog, App.jsx:1373). 'Sign Up' suggests an instant consumer signup on a vetted B2B site.
- Header 'Sign Up ↗', trade bar 'Apply for a trade account ↗', footer 'Apply for account', Help 'Apply for an account' — The header 'Sign Up ↗' opens a dialog whose H2 is 'Apply for an account' (AuthModal.jsx:150-151, verified live). Labels for the same openSignup/onApplyClick action: - 'Sign Up ↗': App.jsx:495 and mobile menu :603 - 'Apply for a trade account ↗': trade bar :297 and mobile menu :612 - 'Start application ↗': home :777, ContactPage.jsx:73, ApplyPage.jsx:42 - 'Apply for account': product page :1129 and footer :1324 - 'Apply for an account': Help dialo…
- Header, trade bar, home, footer, #/apply, Help dialog, product page, mobile menu, auth modal links — Labels found: 'Sign Up ↗' (header, mobile menu), 'Apply for a trade account ↗' (trade bar, mobile menu CTA), 'Start application' (home, #/apply), 'Become a retail account' (home H2), 'Apply for account' (footer, product page), 'Apply for an account' (Help dialog, modal title), 'No account? Apply instead'. For signing in, #/apply says 'Already applied? Sign in' but the modal says 'Already approved? Sign in', although pending applicants must sign i…
- Header, nav, footer, dialogs, product cards — The header and nav use Title Case ('Sign In', 'Sign Up', 'New Arrivals', 'Quick Reorder'), while the footer, dialogs, section headings and buttons use sentence case ('Sign in', 'New arrivals', 'Apply for account'). Card CTAs mix 'Choose' with 'QUOTE +' / 'ADD +'. The price prompt is 'LOCKED · Sign in for pricing'. The same action has seven labels: 'Sign Up ↗' (header), 'Apply for a trade account ↗' (trade bar and mobile menu), 'Apply for account'…

**Fix:** Pick one label (for example 'Apply for a trade account') and one casing convention (sentence case), and use them in the header, trade bar, mobile menu, footer, #/apply, Help dialog, product page, home apply section, auth modal links and page titles/breadcrumbs (App.jsx:108-113, 297, 489-495, 603). Change 'Already approved? Sign in' to 'Already have an account? Sign in' so pending applicants aren't turned away.

**Files:** `src/App.jsx:108`, `src/App.jsx:112`, `src/App.jsx:113`, `src/App.jsx:297`, `src/App.jsx:489`, `src/App.jsx:493`, `src/App.jsx:495`, `src/App.jsx:550`, `src/App.jsx:555`, `src/App.jsx:587`, `src/App.jsx:597`, `src/App.jsx:598`, `src/App.jsx:602`, `src/App.jsx:603`, `src/App.jsx:604`, `src/App.jsx:612`, `src/App.jsx:776`, `src/App.jsx:777`, `src/App.jsx:829`, `src/App.jsx:832`, `src/App.jsx:840`, `src/App.jsx:1129`, `src/App.jsx:1324`, `src/App.jsx:1373`, `src/components/AuthModal.jsx:150`, `src/components/AuthModal.jsx:151`, `src/components/AuthModal.jsx:203`, `src/components/AuthModal.jsx:224`, `src/components/AuthModal.jsx:225`, `src/components/AuthModal.jsx:277`, `src/pages/support/ApplyPage.jsx:42`, `src/pages/support/ContactPage.jsx:73`

**Evidence:** [copy/mobile-menu-390.jpg](screenshots/copy__mobile-menu-390.jpg), [copy/home-new-arrivals-bestseller-tags.jpg](screenshots/copy__home-new-arrivals-bestseller-tags.jpg), [home/sec-1440-header.jpg](screenshots/home__sec-1440-header.jpg), [home/sec-1440-apply.jpg](screenshots/home__sec-1440-apply.jpg), [nav/header-1440.jpg](screenshots/nav__header-1440.jpg), [design/home-header-1440.jpg](screenshots/design__home-header-1440.jpg), [design/footer-1440.jpg](screenshots/design__footer-1440.jpg)

- [ ] Done

#### AW-132 · The same basket is called Cart, Your order, Quote and Checkout, and guests are told pricing comes 'after sign-in'

**Medium** · content-copy · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Header Cart button, cart drawer, #/quote (title, crumb, H1, totals, labels)

**Problem:** The header button says 'Cart'. For a guest building a quote, the drawer title is 'Your order' (App.jsx:1392), its empty note says 'Your cart is empty', and its CTA says 'Request quote'. The #/quote tab title is always 'Checkout · Alabama Wholesale Inc' (App.jsx:107), even though the crumb says 'Request Quote' and the H1 'Request your quote'. The empty state H1 is 'Your cart is empty' with 'come back to checkout'. The guest totals row shows 'Pricing after sign-in' (App.jsx:1290), but a guest cannot sign in without applying and being approved. The form labels 'Business' and 'Contact' (App.jsx:1271-1272) are ambiguous.

**Also seen:**
- Header 'Cart'; drawer title 'Your order'; drawer empty 'Your cart is empty'; card button 'QUOTE +'; product 'Add to quote'; drawer CTA 'Request quote'; #/quote crumb 'Request Quote', h1 'Request your quote', tab title 'Checkout · Alabama Wholesale Inc' — For one guest flow I saw 'Cart' (header), 'Your order' (drawer h2, App.jsx:1392), 'Your cart is empty' (App.jsx:1396 and 1209), 'QUOTE +' in shouting caps (App.jsx:840) vs 'Add to quote' (App.jsx:1123), and document.title 'Checkout · Alabama Wholesale Inc' (App.jsx:107) on a page headed 'Request your quote'. Aria labels say 'Items in your order'.

**Fix:** Pick one name for the basket and flow (for example 'Quote': 'Quote (3)' in the header, drawer title 'Your quote', CTA 'Review quote', page 'Request a quote') and use it in the header, drawer, cards, PDP, #/quote crumb/H1/tab title. Tell guests pricing appears once their trade account is approved, not 'after sign-in' (App.jsx:107, 840, 1209, 1392-1396).

**Files:** `src/App.jsx:107`, `src/App.jsx:840`, `src/App.jsx:1209`, `src/App.jsx:1236`, `src/App.jsx:1271`, `src/App.jsx:1290`, `src/App.jsx:1392`, `src/App.jsx:1396`, `src/App.jsx:1398`

**Evidence:** [copy/cart-drawer-guest.jpg](screenshots/copy__cart-drawer-guest.jpg), [copy/quote-guest-1440.jpg](screenshots/copy__quote-guest-1440.jpg), [cart/drawer-guest-1440.jpg](screenshots/cart__drawer-guest-1440.jpg)

- [ ] Done

#### AW-133 · Product price block shows the words 'Sign in' as a large non-clickable price, then repeats a 'Sign in for pricing' link below

**Medium** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/product/<id> → price block (signed out)

**Problem:** App.jsx:1115 renders <b>Sign in</b> in price typography (a large display heading) with the caption 'WHOLESALE PRICING IS VISIBLE TO APPROVED TRADE ACCOUNTS'. It looks like a heading or button but is plain text. A separate 'Sign in for pricing' text link follows below the Add button (App.jsx:1128). Pending accounts see the bare word 'Pending' as the price (App.jsx:1114).

**Also seen:**
- #/product/<id> signed out → .pd-price — Signed out, the price slot renders `<b>Sign in</b>` in 34px Barlow Condensed purple (index.css:320). It looks like a heading or button but is plain text, with the caption 'WHOLESALE PRICING IS VISIBLE TO APPROVED TRADE ACCOUNTS'. The real controls are two small underlined text links below the Add button ('Sign in for pricing', 'Apply for account', 36px tall), so sign-in appears twice. Signed-in pending users see 'Pending' in the same style.
- #/product/* → .pd-price (signed out / pending) — #/product/1, 1440x900, guest. `.pd-price b` = 'Sign in', font-size 34px, Barlow Condensed, color rgb(40,20,89), cursor auto, tagName B, closest('button,a') = null. Its subline '.pd-price span' is 11px uppercase. The working 'Sign in for pricing' (.text-link) is 12px at y=973 and sits below the 'Add to quote' button at y=912. The pending branch (App.jsx:1114) renders '<b>Pending</b>' in the same 34px style. Screenshot: screenshots/vdesB__pdp-price…

**Fix:** In the PDP .pd-price slot for signed-out/pending users, don't render 'Sign in' or 'Pending' in 34px price type. Show a small locked-price note and one clickable 'Sign in to see wholesale price' button/link (or 'Pricing available after approval'), and remove the duplicate link below (App.jsx:1110-1126).

**Files:** `src/App.jsx:1110`, `src/App.jsx:1111`, `src/App.jsx:1113`, `src/App.jsx:1114`, `src/App.jsx:1115`, `src/App.jsx:1126`, `src/App.jsx:1128`, `src/index.css:294`, `src/index.css:320`, `src/index.css:321`

**Evidence:** [copy/product-1-info-guest.jpg](screenshots/copy__product-1-info-guest.jpg), [product/p162-snickers-1440-full.jpg](screenshots/product__p162-snickers-1440-full.jpg), [design/pdp-after-add-1440.jpg](screenshots/design__pdp-after-add-1440.jpg), [design/product-viewport-1440.jpg](screenshots/design__product-viewport-1440.jpg)

- [ ] Done

#### AW-134 · Department and subcategory names are awkward, overlapping or mislabelled ('Food Stuff', 'Drinks & Bags', 'Motor Oil › Motor Oil', a non-pill jar under 'Wellness Pills')

**Medium** · content-copy · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

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
Category intro (App.jsx:960): 'Wholesale food stuff for licensed retail accounts.' Product cards print p.cat (App.jsx:815), so Novelties cards read 'NOVELTIES' while the department is titled 'Novelties & Vapes'.

**Fix:** Rename the labels in CAT_LABEL, e.g. 'FOOD STUFF' → 'Snacks & Pantry' and 'DRINKS & BAGS' → 'Drinks' (move bags and carriers to Grocery 'Bags & Supplies'). Rename sub values in products.js: 'Motor Oil' sub → 'Oils & Additives', 'Wraps & Leafs' → 'Wraps & Leaf', 'Pouches & ZYN' → 'Nicotine Pouches', 'Honey & Energy' → a truthful name after the legal review, merge 'Other Grocery' into 'Cleaning', move row 219 out of 'Wellness Pills'. Use catLabel(p.cat) for the card label at App.jsx:815. Update the DB and seed.

**Owner input needed:** Do you approve the proposed department/subcategory renames, and what truthful name (after legal review) should replace 'Honey & Energy' and where should row 219 go?

**Files:** `src/App.jsx:34`, `src/App.jsx:815`, `src/App.jsx:960`, `src/data/products.js:20`, `src/data/products.js:459`

**Evidence:** [copy/mega-menu.jpg](screenshots/copy__mega-menu.jpg), [copy/novelties-kratom-kava.jpg](screenshots/copy__novelties-kratom-kava.jpg)

- [ ] Done

#### AW-281 · Homepage 'Become a retail account' heading is ungrammatical and the apply steps contradict the rest of the site

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/ → 'OPEN AN ACCOUNT / 04' panel

**Problem:** App.jsx:776 H2 'Become a retail account': a store cannot become an account. Step 2 (App.jsx:786) says 'Our team checks your license with the state … You'll get price-list access by email.', but everywhere else pricing unlocks on the site once approved (ApplyPage.jsx:53-54, AuthModal.jsx:183) and no price list is emailed. Step 1 says 'Takes about five minutes' while #/apply and the dialog say 'a few minutes'.

**Fix:** H2 → 'Open a trade account'. Step 2 → 'A trade rep verifies your license and resale certificate. Most accounts are approved within one business day, and we'll email you when wholesale pricing unlocks.' Step 1 → '…Takes a few minutes.'

**Files:** `src/App.jsx:776`, `src/App.jsx:782`, `src/App.jsx:786`

**Evidence:** [copy/home-apply-become-a-retail-account.jpg](screenshots/copy__home-apply-become-a-retail-account.jpg)

- [ ] Done

#### AW-282 · Auth dialog copy and data inconsistencies: application fine print on the Sign-in, Reset and Check-inbox steps, mismatched labels and dashes, and a store-state list that differs from the site's

**Low** · content-copy · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Sign in / Apply / Reset dialog; #/apply; #/delivery state picker

**Problem:** Live check at 1440px (Header 'Sign In' → dialog). The .fine text '21+ licensed businesses only. By applying you confirm…' is present in Sign in mode and in 'Reset your password' mode. Checklist and signup actions read 'Already approved? Sign in', while #/apply reads 'Already applied? Sign in'. The signup #aw-su-state options are [AL, GA, MS, TN, FL, LA, SC, NC, KY, Other]. The #aw-su-volume options are ['Under $5K', '$5K — $15K', '$15K — $50K', '$50K — $100K', '$100K+']. The #delivery-state options are [Alabama, Mississippi, Georgia, Arkansas, Florida, Kentucky, Louisiana, North Carolina, South Carolina, Texas, Virginia, Another state]. Screenshots: screenshots/vcopyB__auth-signin-fineprint.jpg, screenshots/vcopyB__auth-reset-fineprint.jpg

**Also seen:**
- Auth modal footer on the Sign in / Reset your password / Check your inbox steps — The sign-in dialog ends with '21+ licensed businesses only. By applying you confirm all store staff handling tobacco products meet federal and state age requirements.' The same line shows on 'Reset your password'. It is rendered unconditionally at AuthModal.jsx:344.
- Auth modal → Store state select — AuthModal.jsx:14 offers AL, GA, MS, TN, FL, LA, SC, NC, KY, Other as bare codes. DeliveryPage's lists (onboarding.js:13-22) use full names and include AR, TX and VA but not TN. An applicant from Texas must pick 'Other', which is saved as the literal string 'Other' in profiles.state.

**Fix:** Render the 'By applying you confirm…' fine print (AuthModal.jsx:344) only on the application step. Standardize the 'Already approved? Sign in' / 'Already applied?' labels, the 'Creating…' button text and the dash style. Replace the application's store-state list (AuthModal.jsx:14, 255) with the shared state list in src/data/onboarding.js that #/apply and #/delivery use. Handle out-of-area states with an explicit message instead of silently storing 'Other'.

**Files:** `src/components/AuthModal.jsx:14`, `src/components/AuthModal.jsx:16`, `src/components/AuthModal.jsx:30`, `src/components/AuthModal.jsx:225`, `src/components/AuthModal.jsx:255`, `src/components/AuthModal.jsx:275`, `src/components/AuthModal.jsx:277`, `src/components/AuthModal.jsx:344`, `src/data/onboarding.js:13`, `src/data/onboarding.js:19`, `src/pages/support/ApplyPage.jsx:44`, `src/pages/support/DeliveryPage.jsx:56`

**Evidence:** [copy/auth-signin.jpg](screenshots/copy__auth-signin.jpg), [copy/auth-signup.jpg](screenshots/copy__auth-signup.jpg), [auth/signin-modal-390.jpg](screenshots/auth__signin-modal-390.jpg)

- [ ] Done

#### AW-283 · Business facts (thresholds, minimums, hours, phone) are hard-coded as literals in many places

**Low** · consistency · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Header utility bar, Help dialog, mobile menu, footer, #/contact, manifest

**Problem:** Live output. .aw-utility reads 'ALABAMA WHOLESALE INC. / 613 Graymont Ave N, Birmingham AL 35203 · (205) 354-4473'. The Help dialog Will-call row reads '613 Graymont Ave N, Birmingham AL 35203'. The footer Contact column reads '613 Graymont Ave N / Birmingham, AL 35203'. The #/contact HOURS read 'Monday – Friday 7:00 AM – 6:00 PM / Saturday – Sunday 8:00 AM – 5:30 PM', while COMPANY.hoursLine1/2 read 'Mon–Fri 7:00 AM – 6:00 PM / Sat–Sun 8:00 AM – 5:30 PM'. Name variants: 'Alabama Wholesale Inc' (COMPANY.name, index.html title and JSON-LD), 'Alabama Wholesale Inc.' (App.jsx:1340, :1350) and 'ALABAMA WHOLESALE INC.' (:447). The $1,500 literals are at App.jsx:743, :1298, :1436 and content.js:20, :45, :52, :61, :65. The $500.00 literals are at App.jsx:107, :1298, :1375, :1436. There are 20 route-state literals across App.jsx, content.js, ContactPage, ApplyPage, PolicyPage and index.html, one of them in a different order (content.js:52). The /site.webmanifest short_name is 'AL Wholesale' and its description is '…licensed retailers in Birmingham, AL.'. Screenshot: screenshots/vcopyB__footer-1440.jpg

**Also seen:**
- #/quote, cart drawer, Help dialog, home services, page meta, ticker, footer — App.jsx:4 already imports ORDER_MINIMUM, and line 1179 uses it (`pricedBelowMinimum = isApprovedBuyer && Number(total) < ORDER_MINIMUM`). Directly beside it, lines 1239, 1292 and 1298 hard-code '$500.00', and 107, 1375 and 1436 do the same. '$1,500' is literal at App.jsx 743, 1298 and 1436 and at content.js:20 (ANNOUNCEMENTS). Live check at 1440px: the ticker reads '★ FREE DELIVERY on orders over $1,500…'; home .service p #2 reads '…across all ei…
- #/contact hours table, COMPANY hours lines, index.html JSON-LD — ContactPage.jsx:8-11 hard-codes HOURS ('Monday – Friday 7:00 AM – 6:00 PM', 'Saturday – Sunday 8:00 AM – 5:30 PM'). COMPANY.hoursLine1/2 (content.js:15-16) holds the same facts as strings for header/footer/help, and index.html:50-53 repeats them in openingHoursSpecification. They match today but have to be edited in three places.
- Drawer fine print, #/quote intro + fine print, Help dialog, FAQ — Live text scan: every visible mention reads 'over $1,500'. These are the marquee (content.js:20), home services (App.jsx:743), hero slide (content.js:45), #/delivery (DeliveryPage.jsx:30), #/shipping (PolicyPage.jsx:20), cart drawer (App.jsx:1436) and #/quote fine print (App.jsx:1298). The inclusive wordings 'orders of $1,500 or more' (content.js:61) and 'Free Delivery $1,500+' (content.js:52) sit in the FAQS/TRUST exports, which nothing renders,…

**Fix:** Define the $500 minimum, $1,500 free-delivery threshold, phone, hours (with time zone) and address once in content.js COMPANY. Use them in the #/quote copy, cart drawer, Help dialog, home services, page meta, ticker, footer, #/contact hours table, manifest and index.html JSON-LD. Use one display format, and show the minimum once per page on #/quote (App.jsx:4, 107, 743; ContactPage.jsx:8; index.html:50).

**Files:** `index.html:50`, `public/site.webmanifest:3`, `src/App.jsx:4`, `src/App.jsx:107`, `src/App.jsx:447`, `src/App.jsx:743`, `src/App.jsx:744`, `src/App.jsx:1239`, `src/App.jsx:1292`, `src/App.jsx:1298`, `src/App.jsx:1340`, `src/App.jsx:1350`, `src/App.jsx:1375`, `src/App.jsx:1436`, `src/data/content.js:12`, `src/data/content.js:15`, `src/data/content.js:20`, `src/data/content.js:45`, `src/data/content.js:52`, `src/data/content.js:61`, `src/data/content.js:65`, `src/data/content.js:110`, `src/data/content.js:110-111`, `src/pages/support/ContactPage.jsx:8`, `src/pages/support/DeliveryPage.jsx:12`, `src/pages/support/PolicyPage.jsx:7`

**Evidence:** [copy/help-dialog.jpg](screenshots/copy__help-dialog.jpg)

- [ ] Done

#### AW-284 · Uppercase styling turns 'SKUs' into 'SKUS' in eyebrows and card kickers

**Low** · content-copy · Who: **Cursor** · Effort: S · New · Viewports: all

**Where:** #/ department cards; #/category/* eyebrow; #/catalog eyebrow and department heads

**Problem:** The source text 'DEPARTMENT · 58 SKUs' renders as 'DEPARTMENT · 58 SKUS' because .eyebrow has text-transform: uppercase (measured on #/category/CANDIES). Also '7 PRODUCT LINES · 68 SKUS' (App.jsx:762) and 'FULL ASSORTMENT · 8 DEPARTMENTS · 368 SKUS' (CatalogIndexPage.jsx:16, :34).

**Also seen:**
- #/ → apply section heading; department kicker; footer; services — #/ 'Shop by department' cards at 1440x900: kickers read '7 PRODUCT LINES · 68 SKUS', '8 PRODUCT LINES · 51 SKUS', '9 PRODUCT LINES · 60 SKUS', '5 PRODUCT LINES · 58 SKUS', '6 PRODUCT LINES · 24 SKUS', '7 PRODUCT LINES · 47 SKUS', '4 PRODUCT LINES · 16 SKUS', '6 PRODUCT LINES · 44 SKUS'. The source says 'SKUs' (App.jsx:762), but .card-kicker { text-transform: uppercase } (index.css:208) turns it into 'SKUS'. The category page eyebrow ('DEPARTMENT …
- #/catalog → page eyebrow and result note; department eyebrows — The eyebrow 'FULL ASSORTMENT · 8 DEPARTMENTS · 368 SKUS' (CatalogIndexPage.jsx:16) is followed about 150px lower by '8 departments · 52 product lines · 368 SKUs' (line 25). Eyebrow text-transform turns 'SKUs' into 'SKUS' there and in every 'DEPARTMENT 01 · 68 SKUS' (line 34).

**Fix:** Wrap 'SKUs' in a span with text-transform:none (or stop uppercasing via CSS in eyebrows/kickers) so it doesn't render as 'SKUS' in the home department cards, #/category eyebrows, #/catalog eyebrow and department heads, and the apply section. On #/catalog, remove the duplicated count between the eyebrow and the result note (App.jsx:762, 958; CatalogIndexPage.jsx:16, 25, 34).

**Files:** `src/App.jsx:762`, `src/App.jsx:958`, `src/index.css:208`, `src/pages/support/CatalogIndexPage.jsx:16`, `src/pages/support/CatalogIndexPage.jsx:25`, `src/pages/support/CatalogIndexPage.jsx:34`

**Evidence:** [copy/novelties-kratom-kava.jpg](screenshots/copy__novelties-kratom-kava.jpg), [home/sec-1440-apply.jpg](screenshots/home__sec-1440-apply.jpg), [home/sec-1440-depts.jpg](screenshots/home__sec-1440-depts.jpg), [support/catalog-1440-head-duplicate-counts.jpg](screenshots/support__catalog-1440-head-duplicate-counts.jpg)

- [ ] Done

#### AW-285 · Footer information architecture and copy: misfiled links, missing Help/FAQ/account links, incomplete blurb, hard-coded year

**Low** · content-copy · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** Footer; trade-only bar; support-page contact strips

**Problem:** The footer 'Account & help' column contains 'New arrivals' and 'Bestsellers' (App.jsx:1329-1330). The brand blurb (App.jsx:1315) lists 'tobacco, vaping products, smoke-shop accessories, novelties, candy, beverages and general merchandise' and omits grocery, food and motor oil. The licensed-only statement appears four ways on each page: 'WHOLESALE TO LICENSED RETAIL BUSINESSES ONLY · NO CONSUMER SALES · 21+' (:300), '…never consumers.' (:1315), 'Sales to licensed retail businesses only · 21+ · No consumer orders' (:1346), and '…distributed exclusively to licensed retail businesses…' (:1350). 'Real people, same building as the inventory.' repeats in the Help dialog (:1364), on #/contact (ContactPage.jsx:17) and in every support-page ContactStrip (SupportShell.jsx:47).

**Also seen:**
- Footer → 'Account & help' column; footer brand block — 'New arrivals' and 'Bestsellers' (App.jsx:1329-1330) are listed under 'Account & help' rather than with the departments. The footer has no link to Help, My account/Quick reorder (#/account), an FAQ or a returns/damaged-goods policy. The 'Alabama WHOLESALE INC.' wordmark (App.jsx:1314) is a plain span, not a home link. The street address (App.jsx:1334) doesn't link to directions.
- #/ → footer 'Account & help' column and legal bar — Footer 'Account & help' → 'Delivery & service area' → #/delivery (App.jsx:1328). Footer legal bar 'Delivery' → #/shipping (App.jsx:1342), whose title comes from PolicyPage.jsx:16 title: 'Delivery'. POLICY_LINKS label 'Delivery' at SupportShell.jsx:10. PolicyNav adds a second 'Delivery & service area' button (SupportShell.jsx:65), so #/shipping's side nav lists both. The footer has no Quick reorder / My account entry; the header and mobile menu ha…
- Footer brand paragraph and legal row copyright — The blurb 'Wholesale distributor of tobacco, vaping products, smoke-shop accessories, novelties, candy, beverages and general merchandise' (App.jsx:1315) omits two of the eight departments: Grocery (47 SKUs) and Motor Oil (16 SKUs). The copyright reads a literal '© 2026 Alabama Wholesale Inc.' (App.jsx:1340), so it will be wrong from 1 January 2027. The paragraph also uses an inline style (marginTop: 16).
- Footer legal row — App.jsx:1340: '© 2026 Alabama Wholesale Inc. All rights reserved.' is a literal and will be stale on Jan 1, 2027.

**Fix:** Restructure the footer columns: move discovery links out of 'Account & help'; add Help/FAQ, My account and Quick reorder; keep a single Delivery link. Rewrite the brand blurb to name all departments. Use one wording for the licensed-only disclaimer. Compute the copyright year with new Date().getFullYear() (App.jsx:1307-1346).

**Files:** `src/App.jsx:300`, `src/App.jsx:343`, `src/App.jsx:1307`, `src/App.jsx:1314`, `src/App.jsx:1315`, `src/App.jsx:1322`, `src/App.jsx:1328`, `src/App.jsx:1329`, `src/App.jsx:1330`, `src/App.jsx:1334`, `src/App.jsx:1340`, `src/App.jsx:1342`, `src/App.jsx:1346`, `src/pages/support/PolicyPage.jsx:16`, `src/pages/support/SupportShell.jsx:7`, `src/pages/support/SupportShell.jsx:10`, `src/pages/support/SupportShell.jsx:47`, `src/pages/support/SupportShell.jsx:65`

**Evidence:** [copy/quote-guest-1440.jpg](screenshots/copy__quote-guest-1440.jpg), [nav/footer-1440.jpg](screenshots/nav__footer-1440.jpg), [home/sec-1440-footer.jpg](screenshots/home__sec-1440-footer.jpg)

- [ ] Done

## Catalog data integrity

#### AW-002 · Every list price looks like a placeholder: pack sizes and product sizes are priced backwards and unrelated items share identical prices

**Critical** · catalog-data · Who: **Owner → Cursor** · Effort: M · New

**Where:** All routes that show price (approved-buyer cards, PDP, quote totals) and the server trigger that prices order lines

**Problem:** The 368 prices run from $4.76 to $119.99 (median $38.50). They have not changed since the initial commit f5e931b (2026-05-17), when product names were still placeholders like "SS" and "WO". Implausible pairs: #16 Backwoods singles $98.78 vs #11 Backwoods 5-pack $45.40; #340 Slapwoods singles $92.77 vs #77 5-pack $43.98; #236 OHM small bag $101.26 vs #237 big bag $31.71; Al Fakher #315 50 g $70.50, #316 250 g $71.51, #317 1 kg $49.29; #335 Gatorade small $51.72 vs #336 big $28.62; #140 Tropicana small $48.04 vs #214 big $12.15; #132 Charcoal small $30.14 vs #133 big $9.77; #190 Mamba small $43.60 vs #189 big $16.04; #144 Red Bull 8 oz $43.47 vs #143 12 oz $27.96; #160 White A-shirts $8.78 vs #161 Black A-shirts $76.71; #78 Black & Mild 5-pack $24.99 vs #17 25-count box $39.59; #6 Game Mini $85.05 vs #3 Game $62.97; #350 Uncle Al's $33.23 vs #351 (same cookies) $18.68. 31 price values are shared by 67 unrelated rows, e.g. $112.92 = #73 Mental Health disposable, #75 Wava kava, #296 Jelly holes, #309 Water bongs, #311 Geek Bar Mate pods; $114.94 = #65 RAZ Vue kit and #308 UPass. The live Supabase table has the same values: all 368 rows diffed with 0 differences. submit_quote computes unit_price from products.price (migration 20260925120000 line 111). The $500 minimum and $1,500 free-delivery thresholds are also evaluated against these numbers.

**Also seen:**
- #/product/<id> → .pd-price, shown to approved buyers; submit_quote prices orders from the same products.price column — Prices in src/data/products.js, identical in the live Supabase table, contradict each other within pairs of the same product: Al Fakher shisha 1 kg $49.29 < 50 g $70.50 (ids 317/315). Gatorade big $28.62 < Gatorade small $51.72 (336/335). Tropicana juice (big) $12.15 < (small) $48.04 (214/140). Red Bull 8 oz $43.47 > 12 oz $27.96 (144/143). Backwoods singles $98.78 > Backwoods 5-pack $45.40 (16/11). White A-shirts $8.78 vs Black A-shirts $76.71 (…

**Fix:** Replace the placeholder list prices in products.js, supabase/seed/products.sql and the products.price column with real wholesale prices, so larger packs and sizes cost more and unrelated items don't share identical prices. The submit_quote trigger reads this column, so correct the DB before launch.

**Owner input needed:** Please supply the real wholesale list price for each of the 368 SKUs (e.g. a price sheet export).

**Files:** `scripts/build-seed.mjs:47`, `scripts/build-seed.mjs:57`, `src/data/products.js:22`, `src/data/products.js:43`, `src/data/products.js:53`, `src/data/products.js:341`, `src/data/products.js:343`, `src/data/products.js:461`, `src/data/products.js:463`, `src/data/products.js:655`, `src/data/products.js:693`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:111`, `supabase/seed/products.sql:6`

- [ ] Done

#### AW-029 · 77 products (21%) have no photo and show a near-invisible two-letter initials placeholder

**High** · imagery · Who: **Owner → Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** Product cards, PDPs, cart and quote lines for the listed ids; the home "New arrivals" rail (#342)

**Problem:** Rows with img: null, by department: TOBACCO 5/68 (9, 13, 211, 213, 274). NOVELTIES 17/51 (219, 220, 221, 258, 288, 289, 293, 298, 300, 301, 302, 303, 304, 306, 311, 313, 341). MERCHANDISE 18/60 (33, 34, 152, 153, 154, 155, 156, 157, 158, 160, 161, 246, 252, 266, 286, 331, 363, 364), which leaves 13 of 14 Apparel rows without a photo. CANDIES 1/58 (342, the NEW-tagged Dubai chocolate shown as "DC" in the home New arrivals rail). FOOD STUFF 2/24 (295, 353). GROCERY 23/47, 49% (53, 107, 118, 119, 121, 125, 126, 127, 129, 131, 132, 133, 134, 135, 137, 138, 253, 259, 283, 284, 297, 345, 362). MOTOR OIL 1/16 (100). DRINKS & BAGS 10/44 (87, 90, 92, 93, 94, 95, 139, 141, 212, 269). Improved from 173 in the prior audit. #/category/GROCERY/Hardware shows almost only initials tiles (M, CB, CB…).

**Also seen:**
- #/ → New arrivals → card 7 'Dubai chocolate' — Product id 342 (src/data/products.js:705) has img:null, so the card shows 58px 'DC' initials in #d6cec5 on #f6f3ee. That is 1.4:1 contrast (axe color-contrast violation). Its brand is 'Assorted' and its SKU 'AW-DUBAI-CHOCOLAT' is truncated. 77 catalog rows still have img:null, and the homepage rails don't filter them out.
- #/category/<DEPT> → product card image (.card-block .card-initials) — Measured after scrolling every department to load lazy images. Placeholder tiles per department: Grocery 23/47 (half the department), Merchandise 18/60, Novelties 17/51, Drinks & Bags 10/44, Tobacco 5/68, Food Stuff 2/24, Candies 1/58, Motor Oil 1/16. The initials are #d6cec5 on #f6f3ee, a contrast of 1.4:1 (axe color-contrast), so the tiles look like broken images. Initials repeat and mean nothing, e.g. 'BM' for both Blue monkey pre rolls and Be…
- #/product/<id> for products with img null → .pd-media .card-initials (e.g. #/product/9 'RB') — 77 of 368 rows have img: null. By department: Grocery 23 of 47, Merchandise 18 of 60, Novelties 17 of 51, Drinks & Bags 10 of 44, Tobacco 5 of 68, Food Stuff 2, Candies 1, Motor Oil 1. The PDP fills its 620x590 frame with 120px initials in #d6cec5 on #f6f3ee (axe color-contrast 1.4:1), e.g. 'RB' for Royal Blunts EZ Roll, 'GB' for Geek Bar Mate 60K pods, 'HV' for Happy valentines jar. The letters carry no meaning for buyers. IDs: 9, 13, 33, 34, 53…
- #/category/NOVELTIES, #/category/MERCHANDISE, #/category/TOBACCO, #/category/CANDIES → cards with grey two-letter initials; home 'New arrivals' row — `img: null`. TOBACCO has 5 of 68: #9 Royal Blunts EZ Roll (L39), #13 Havana Leaf little wraps (L47), #211 Cheyenne filtered cigars (L443), #213 Lil Leaf wraps (L447), #274 RAW Guarana wraps (L569). NOVELTIES has 17 of 51: #219 (L459), #220 (L461), #221 (L463), #258 (L537), #288 (L597), #289 (L599), #293 (L607), #298 (L617), #300 (L621), #301 (L623), #302 (L625), #303 (L627), #304 (L629), #306 (L633), #311 (L643), #313 (L647), #341 (L703). MERCHAN…
- #/category/GROCERY (23 of 47 cards), DRINKS & BAGS (10 of 44), FOOD STUFF (2 of 24), MOTOR OIL (1 of 16); cards and product pages — Rows with img:null: - GROCERY: #53 Glass cleaner, #107 Trash bags, #118 Foam plates, #119 Foam bowls, #121 Plastic cutlery, #125 Baby diapers, #126 Baby wipes, #127 Drain opener, #129 Home air fresheners, #131 Matches, #132/#133 Charcoal bags small/big, #134 Rubbing alcohol, #135 Hydrogen peroxide, #137 Nail clippers, #138 Charcoal lighter fluid, #253 Ajax detergent, #259 Paper plates, #283 Duct tape, #284 Clear tape, #297 Toothbrushes, #345 Supe…
- #/category/* cards and #/product/<id> media box for products without a photo (e.g. #9 Royal Blunts EZ Roll, cards 'RB', 'HL', 'CF', 'DC') — axe color-contrast (serious) on .card-initials: #d6cec5 on #f6f3ee = 1.41:1 at 58px (42px on phones). 77 of 368 catalog rows have img: null. The initials are aria-hidden, so screen readers are unaffected, but low-vision users see an empty beige box with no sign that the photo is missing rather than still loading.

**Fix:** Source real packshots for all 77 img:null products, starting with those on the homepage (Dubai chocolate #342 in New arrivals) and the largest departments (Grocery 23, Novelties, Merchandise, Tobacco, Drinks & Bags). Until then, replace the 1.41:1 grey initials with a designed 'Photo coming soon' placeholder (a department icon plus the product name at 4.5:1 contrast) on cards, the PDP, cart and quote lines (App.jsx:475, 817, 1092; index.css:205, 313). Exclude photo-less items from the home rails.

**Owner input needed:** Supply real packshots for the 77 products without photos, starting with Dubai chocolate #342 and the Grocery items.

**Files:** `src/App.jsx:40`, `src/App.jsx:475`, `src/App.jsx:703`, `src/App.jsx:704`, `src/App.jsx:817`, `src/App.jsx:1092`, `src/App.jsx:1246`, `src/App.jsx:1401`, `src/data/products.js`, `src/data/products.js:39`, `src/data/products.js:47`, `src/data/products.js:87`, `src/data/products.js:127`, `src/data/products.js:195`, `src/data/products.js:201`, `src/data/products.js:221`, `src/data/products.js:235`, `src/data/products.js:271`, `src/data/products.js:325`, `src/data/products.js:443`, `src/data/products.js:447`, `src/data/products.js:459`, `src/data/products.js:569`, `src/data/products.js:593`, `src/data/products.js:611`, `src/data/products.js:623`, `src/data/products.js:643`, `src/data/products.js:683`, `src/data/products.js:705`, `src/data/products.js:766`, `src/index.css:205`, `src/index.css:313`

**Evidence:** [data/grocery-hardware-no-photos-1440.jpg](screenshots/data__grocery-hardware-no-photos-1440.jpg), [data/apparel-no-photos-390.jpg](screenshots/data__apparel-no-photos-390.jpg), [data/home-new-arrivals.jpg](screenshots/data__home-new-arrivals.jpg), [home/crop-na-dubai-initials-card.jpg](screenshots/home__crop-na-dubai-initials-card.jpg), [catalog/grocery-grid-rows1-3.jpg](screenshots/catalog__grocery-grid-rows1-3.jpg), [catalog/grocery-1440-full.jpg](screenshots/catalog__grocery-1440-full.jpg), [product/pd-grid-1440-9.jpg](screenshots/product__pd-grid-1440-9.jpg), [photos1/merchandise-grid-apparel-placeholders-1440.jpg](screenshots/photos1__merchandise-grid-apparel-placeholders-1440.jpg), [photos1/novelties-grid-placeholders-1440.jpg](screenshots/photos1__novelties-grid-placeholders-1440.jpg), [photos1/home-new-arrivals-1440.jpg](screenshots/photos1__home-new-arrivals-1440.jpg), [photos2/grocery-1440-initials-placeholders.jpg](screenshots/photos2__grocery-1440-initials-placeholders.jpg), [photos2/drinks-1440-top.jpg](screenshots/photos2__drinks-1440-top.jpg)

- [ ] Done

#### AW-030 · Variants of different sizes and pack counts all share the parent's single price

**High** · catalog-data · Who: **Owner → Cursor** · Effort: L · Partly fixed since the 2026-09-25 audit

**Where:** PDP variant chips, cart and quote lines, and server-side order line pricing for multi-size products

**Problem:** Variants are plain strings. lines.js sets listPrice = Number(product.price) for every variant (lines 168, 182), and the trigger prices every line with v_product.price (migration line 111). At least 80 products mix sizes or pack counts inside one variant list at one price. Examples: #162 Snickers Regular vs King size; #171 Hershey's reg vs king; #166 Reese's cups regular vs king size; #328 Takis small vs big; #27 Duracell 9V / AAA4 / AA2 / D2; #120 Foam cups 20oz vs 8oz; #356 Gas cans 1 gal vs 5 gal; #314 Coco Nara Small vs 1kg; #147 Trojan Magnum Regular vs "Jar big"; #24 Goody's 2pk vs 6pk; #227 BC Powder 6pk vs 2pk; #86 Seneca 100 vs short; #125 Baby diapers Small/Medium/Big; #33–#161 shirts S–5X. Variant cart identity and variant SKUs were added since the prior audit, but variant price was not.

**Also seen:**
- #/product/<id> → variant chips + .pd-price (approved-buyer view) and cart/quote lines — Variant selection now carries into the cart correctly. Tested: #/product/162 King size ×3 produced cart key '162::king-size' and the drawer line 'Snickers bars — King size | AW-SNICKERS-KING-SIZE'. But each row has one `price`, so every variant shares it. 59 products have size/grade/count variants priced identically, e.g. 356 Gas cans [1 gal, 2gal, 5 gal] $30.10, 120 Foam cups [20oz, 16oz, 12oz, 8oz] $35.39, 56 Saxon [5W-30 … Multipurpose] $44.20…

**Fix:** Add per-variant price (and availability) to the variant model (products.js, lines.js:4-31, 168-182) and to the DB/order-line pricing trigger, so sizes such as 1 gal vs 5 gal and different pack counts price correctly on the PDP, cart, quote and orders.

**Owner input needed:** Supply the price (and availability) for each size/pack-count variant of the multi-variant products.

**Files:** `src/App.jsx:1070`, `src/App.jsx:1112`, `src/data/products.js:3`, `src/data/products.js:345`, `src/lib/lines.js:4`, `src/lib/lines.js:31`, `src/lib/lines.js:168`, `src/lib/lines.js:182`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:47`, `supabase/migrations/20260925120000_launch_order_boundaries.sql:111`

**Evidence:** [product/flow-cart-drawer-1440.jpg](screenshots/product__flow-cart-drawer-1440.jpg)

- [ ] Done

#### AW-031 · 344 of 368 products don't say what quantity 1 means (no sell unit)

**High** · catalog-data · Who: **Owner → Cursor** · Effort: L · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** PDP "Sold by the …" line (App.jsx:1098) is missing on 344 PDPs; quote quantities are ambiguous

**Problem:** Only 24 rows set sellUnit (11, 12, 17, 28, 37, 69, 70, 73, 74, 77, 78, 79, 81, 98, 275, 281, 285, 288, 300, 313, 315, 316, 317, 367). Names that state a unit but leave sellUnit empty: #122 "Bath tissue 4-pack", #16 "Backwoods cigars singles" (priced $98.78, so clearly not one cigar), #340 Slapwoods singles, the jars and tubs #174–#179, #258, #262, #276, #298, and #187 "Gushers box". Descriptions state a count that sellUnit omits: #175 "160-count jar", #179 "145-count tub", #186 "48-count display", #242/#243 "200 per box", #294 "20 per can", #358 "15 per box", #97 "8 oz bottles", #101/#102/#280 "in quarts". #122–#124 put "Case" in variants instead of sellUnit. Snickers, Red Bull, Pepsi and every other bestseller give no hint whether 1 means a bar, a box or a case.

**Also seen:**
- #/product/<id> → info column (description, .pd-unit, qty stepper) — Only 24 rows have `sellUnit` (ids 11, 12, 17, 28, 37, 69, 70, 73, 74, 77, 78, 79, 81, 98, 275, 281, 285, 288, 300, 313, 315, 316, 317, 367). No other product gets a 'Sold by' line. Example: #/product/205 Pepsi reads only 'Pepsi from the soda line in our Drinks & Bags department.' with no container, size or case count. #/product/111 Tide offers variants 'Big' and 'Small' with no volumes. #/product/162 Snickers has no bar count, although the photo …

**Fix:** Add a sell-unit field (each / box of N / case of N / size) to all 368 products, and show it on the PDP next to price and quantity ('Sold by the case of 24') and in cart/quote lines, so quantity 1 is unambiguous (App.jsx:1098, 1112).

**Owner input needed:** Supply the sell unit (each, box of N, case of N, or size) for each of the 368 products.

**Files:** `scripts/build-seed.mjs:47`, `src/App.jsx:1098`, `src/App.jsx:1112`, `src/data/products.js:3`, `src/data/products.js:53`, `src/data/products.js:265`, `supabase/migrations/20260927120000_product_copy.sql:6`

**Evidence:** [data/pdp-205.jpg](screenshots/data__pdp-205.jpg), [product/photo-205-pepsi-shows-aquafina.jpg](screenshots/product__photo-205-pepsi-shows-aquafina.jpg), [product/p162-snickers-1440.jpg](screenshots/product__p162-snickers-1440.jpg)

- [ ] Done

#### AW-032 · Re-running the product seed silently overwrites admin edits to name, brand, price and tag

**High** · functional-bug · Who: **Cursor** · Effort: S · New

**Where:** scripts/build-seed.mjs → supabase/seed/products.sql upsert; #/admin Products editor

**Problem:** UPDATED = every column except id and active (build-seed.mjs:20). The generated SQL ends with `on conflict (id) do update set name = excluded.name, brand = …, tag = …, price = …`. The admin editor saves exactly those fields: name, brand, price, tag, active (AdminPage.jsx:324). BACKEND.md:30-31 tells the owner to re-run `npm run seed` and re-apply the file whenever the catalog changes, for example after adding photos. Any real prices or names entered in #/admin would revert to the products.js placeholder values. Only `active` survives.

**Also seen:**
- supabase/seed/products.sql (ON CONFLICT clause); BACKEND.md §2 — scripts/build-seed.mjs:20 builds UPDATED from every column except id and active. products.sql:375-387 therefore runs `on conflict (id) do update set name, brand, cat, sub, sku, flavors, variants, img, tag, price, description, sell_unit = excluded.*`. BACKEND.md:30-34 tells the owner to 're-run it and re-apply the file whenever the catalog changes' and claims 're-applying is safe'. Only `active` survives. Any price, name, brand or tag changed in A…

**Fix:** Change the product seed upsert (scripts/build-seed.mjs:20, 86-87; supabase/seed/products.sql ON CONFLICT) to insert-only (ON CONFLICT DO NOTHING), or to update only non-admin-managed columns, so re-running it doesn't overwrite admin edits to name, brand, price and tag. Document this in BACKEND.md.

**Files:** `BACKEND.md:30`, `scripts/build-seed.mjs:20`, `scripts/build-seed.mjs:86`, `scripts/build-seed.mjs:87`, `src/pages/admin/AdminPage.jsx:324`, `supabase/seed/products.sql:375`

- [ ] Done

#### AW-033 · Many product photos were copied from retailers and competitor wholesalers, and Wikimedia images carry no attribution

**High** · imagery · Who: **Owner → Cursor** · Effort: M · New

**Where:** src/assets/products photos listed in sources/*.md

**Problem:** 44 retailer-sourced rows (list above in reason) plus about 25 from smoke-shop retailers and competing wholesalers, e.g. 4aceswholesale.com (#193), hswsupply.com (#309), mysmokewholesale.com (#281, #296), primesupplydistro.com (#69, #73, #285). Wikimedia licenses verified on their file pages: #149 p149-rolling-dice.jpg, Dietmar Rabich, CC BY-SA 4.0; #150 p150-phone-cables.jpg, J.Dncsn, CC BY-SA 3.0; #151 p151-white-v-neck.jpg, Rafasshop, CC BY-SA 4.0; #334 p334-bandaids.jpg, Beendy234, CC BY 4.0. No credit appears in src/.

**Also seen:**
- #/category/MERCHANDISE → Rolling dice, Phone cables & chargers, White V-neck shirts, Bandaids; their product pages — src/assets/products/sources/merchandise.md lists 4 photos taken from Wikimedia Commons and records no licence. I checked each Commons file page. #149 p149-rolling-dice.jpg, 'Würfel -- 2021 -- 4266.jpg' by Dietmar Rabich: CC BY-SA 4.0. #150 p150-phone-cables.jpg, 'USB_cable.jpg' by J.Dncsn: CC BY-SA 3.0. #151 p151-white-v-neck.jpg, 'Camiseta_Blanca_con_cuello_en_V.jpg' by Rafasshop: CC BY-SA 4.0. #334 p334-bandaids.jpg, 'Adhesive_bandage.jpg' by B…
- src/assets/products/sources/*.md and the files they list — drinks-bags.md, grocery.md, food-stuff.md and motor-oil.md record most new photos as downloaded from retailer CDNs rather than manufacturers or distributors: - kroger.com/product/images/xlarge/front/…: #88, 140, 142, 143, 144, 145, 205, 206, 207, 214, 232, 233, 234, 235, 248, 249, 270, 271, 272, 54, 109, 130, 136 - i5.walmartimages.com: #346 - target.com: #361 - costcobusinessdelivery.com: #50 - foodsco.net: #146 Retailer photography, with its pr…

**Fix:** Replace photos copied from retailers and competitor wholesalers with manufacturer-supplied or self-shot images. Add the required CC attribution (credits page and alt/caption) for the four Wikimedia images (dice, cables, V-neck shirts, bandaids) or replace them. Correct the source logs in src/assets/products/sources/*.md.

**Owner input needed:** Supply manufacturer-provided or self-shot replacement photos for images copied from retailers and competitor wholesalers, and confirm whether to keep the four Wikimedia images with attribution.

**Files:** `src/assets/products/sources/drinks-bags.md`, `src/assets/products/sources/food-stuff.md`, `src/assets/products/sources/grocery.md`, `src/assets/products/sources/merchandise.md`, `src/assets/products/sources/motor-oil.md`, `src/assets/products/sources/novelties.md`, `src/data/products.js:319`, `src/data/products.js:321`, `src/data/products.js:323`, `src/data/products.js:689`

**Evidence:** [photos1/non-packshot-stock-photos.jpg](screenshots/photos1__non-packshot-stock-photos.jpg), [photos1/sheet-11-MERCHANDISE-148-224.jpg](screenshots/photos1__sheet-11-MERCHANDISE-148-224.jpg), [photos2/wrong-product-photos.jpg](screenshots/photos2__wrong-product-photos.jpg), [photos2/retailer-banner-overlays.jpg](screenshots/photos2__retailer-banner-overlays.jpg)

- [ ] Done

#### AW-135 · 108 SKUs are truncated at 17 characters, some end in a hyphen or are misspelled

**Medium** · catalog-data · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** SKU text on cards, PDP ("SKU …"), cart/quote lines, Quick Reorder (#/account#quick-reorder)

**Problem:** 108 of 368 SKUs are exactly 17 characters and cut mid-word, e.g. AW-RAZ-VUE-FULL-K, AW-PEPCID-COMPLET, AW-CHEAP-ANTIFREE, AW-HAPPY-VALENTIN, AW-DUBAI-CHOCOLAT, AW-MELTED-MUSHROO. Four end in "-": #130 AW-BRILLO-BASICS-, #275 AW-JOLLY-RANCHER-, #276 AW-NOW-AND-LATER-, #352 AW-LOUISIANA-HOT-. #/quote shows "AW-BRILLO-BASICS--YELLOW" (double hyphen) and "AW-NOW-AND-LATER-". resolveSkuLine('AW-BRILLO-BASICS-YELLOW') and resolveSkuLine('AW-BRILLO-BASICS') both return not-found; only the double-hyphen form works. Misspellings: AW-ROYAL-BUNTS-MI (#15), AW-WRIGGLY-SLIM-P / AW-WRIGGLY-50 (#38/#40), AW-STARBUST-BARS (#357), AW-NESQUICK (#233), AW-FABULOUSO (#128), AW-DOMINOES-SUGAR (#361), AW-CHICO-STICK-JA (#175), AW-ELECTROLYTE for Electrolit (#292), and AW-AJAX-DISHWASHE / AW-BRILLO-DISHWAS / AW-GAIN-DISHWASHE for dish liquids (#109/#110/#333). #329 RAW tips uses the bare brand code AW-RAW, which is a prefix of three other RAW SKUs.

**Also seen:**
- Header search dropdown result lines ('Dept · Line · SKU'); same SKUs on cards and product pages — SKU length distribution from src/data/products.js: 108 codes are exactly 17 characters. The next largest group is 34 codes at 14 characters, and only 10 codes are longer than 17. That points to a 17-character cap. Four codes end in a bare hyphen: AW-BRILLO-BASICS- (id 130, has 4 variants), AW-JOLLY-RANCHER- (275), AW-NOW-AND-LATER- (276), AW-LOUISIANA-HOT- (352). Codes cut mid-word: AW-AJAX-DISHWASHE ('Ajax dish liquid'), AW-6PK-BEER-CARRI, AW-GE…
- #/category/<DEPT> → card detail line 'Brand · N variants · SKU'; #/catalog SKU lists — 108 of 368 SKUs are exactly 17 characters and many end mid-word. Four end with a bare hyphen: AW-BRILLO-BASICS- (Brillo Basics all-purpose cleaner), AW-JOLLY-RANCHER-, AW-NOW-AND-LATER-, AW-LOUISIANA-HOT-. Others: AW-AJAX-DISHWASHE, AW-BRILLO-DISHWAS, AW-RAZ-VUE-FULL-K, AW-SHROOM-PUFF-DI, AW-CHEAP-ANTIFREE, AW-PEAK-ANTIFREEZ, AW-RUBBING-ALCOHO, AW-DISPOSABLE-GLO, AW-MELTED-MUSHROO, AW-STONED-MUSHROO, AW-UNCLE-AL-S-COO, AW-HAPPY-VALENTIN, AW-GEEKB…
- Product cards ('Brand · N variants · SKU'), product pages, cart, Quick Reorder — Live SKU length histogram: 108 codes at exactly 17 characters (the next most common length, 14, has 34). Trailing-hyphen codes: 130 AW-BRILLO-BASICS- (4 variants), 275 AW-JOLLY-RANCHER-, 276 AW-NOW-AND-LATER-, 352 AW-LOUISIANA-HOT-. Adding 'Brillo Basics all-purpose cleaner — Yellow' to the cart shows the line SKU 'AW-BRILLO-BASICS--YELLOW' on #/quote, because variantSku (lines.js:31-35) appends '-' + slug to a code that already ends in '-'. Mid-…
- #/product/<id> → SKU text; cart/quote SKU column — 108 SKUs are cut at exactly 17 characters. Four end in a bare hyphen: 130 'AW-BRILLO-BASICS-', 275 'AW-JOLLY-RANCHER-', 276 'AW-NOW-AND-LATER-', 352 'AW-LOUISIANA-HOT-'. As a result, product 130's variant SKUs come out as 'AW-BRILLO-BASICS--YELLOW', '--ORANGE', '--PURPLE' and '--BROWN'. Typos: 15 'AW-ROYAL-BUNTS-MI', 357 'AW-STARBUST-BARS', 361 'AW-DOMINOES-SUGAR', 38/40 'AW-WRIGGLY-…', 128 'AW-FABULOUSO', 233 'AW-NESQUICK', 292 'AW-ELECTROLYTE' …

**Fix:** Regenerate SKUs in products.js (and the seed/DB) without the 17-character cut. Strip trailing hyphens and double hyphens (for example AW-BRILLO-BASICS--YELLOW) and fix misspellings. Update lines.js variant SKU generation (lines.js:31) so Quick Reorder resolves them. The corrected codes then show on cards, search results, the PDP, cart/quote and the #/catalog SKU lists.

**Files:** `scripts/build-seed.mjs`, `scripts/build-seed.mjs:18`, `scripts/build-seed.mjs:47`, `scripts/build-seed.mjs:54`, `src/App.jsx:476`, `src/data/products.js:22`, `src/data/products.js:51`, `src/data/products.js:97`, `src/data/products.js:187`, `src/data/products.js:239`, `src/data/products.js:281`, `src/data/products.js:307`, `src/data/products.js:371`, `src/data/products.js:571`, `src/data/products.js:573`, `src/data/products.js:705`, `src/data/products.js:725`, `src/data/products.js:735`, `src/data/products.js:743`, `src/lib/lines.js:31`, `src/lib/lines.js:43`, `src/lib/lines.js:52`, `src/lib/lines.js:58`, `src/pages/account/QuickReorder.jsx:53`

**Evidence:** [data/quote-sku-double-hyphen.jpg](screenshots/data__quote-sku-double-hyphen.jpg), [nav/search-red-bull-1440.jpg](screenshots/nav__search-red-bull-1440.jpg), [catalog/grocery-grid-rows1-3.jpg](screenshots/catalog__grocery-grid-rows1-3.jpg), [catalog/catalog-index-tobacco-sku-list.jpg](screenshots/catalog__catalog-index-tobacco-sku-list.jpg), [copy/home-new-arrivals-bestseller-tags.jpg](screenshots/copy__home-new-arrivals-bestseller-tags.jpg)

- [ ] Done

#### AW-136 · One photo file is shared across sibling products of different size/pack/format

**Medium** · imagery · Who: **Owner → Cursor** · Effort: L · New · Viewports: all

**Where:** Cards and PDPs of the listed ids

**Problem:** 18 shared img files covering 37 rows: backwoods_5pk (#11, #16), zyn_6mg (#18, #19, #267), faygo_bottles_20oz (#58, #89), kang_vape_65k (#67, #68), slapwoods_5pk (#77, #340), gain.jpg (#112, #333), sour_punch_jar (#178, #182), nerds_pouches_1 (#188, #200), mamba_big_bars (#189, #190), american_club.png (#240, #241), raw_papers.jpg (#255, #329), loose_leafs_wraps_5pk (#273, #367), powerade_20oz (#290, #291), tyson_wraps (#305, #318), alfakher_250_gram (#316, #317), maruchan_packs (#326 cups, #327 packs), p_gatorade (#335, #336), uncle_al_s_cookies (#350, #351). Contact sheet: screenshots/vdata__sheet-shared.jpg

**Also seen:**
- #/product/<id> photo for each pair listed — Shared image files not covered by AW-010, confirmed in the live Supabase img column: backwoods_5pk.webp for 11 Backwoods 5-pack and 16 Backwoods singles. zyn_6mg.webp for 18 ZYN 6mg and 19 ZYN 3mg (267 is in AW-010). slapwoods_5pk.webp for 77 5-pack and 340 singles. gain.jpg for 112 Gain laundry and 333 Gain dish liquid. mamba_big_bars.jpg for 189 big and 190 small. american_club.png for 240 big bag and 241 small bag. loose_leafs_wraps_5pk.webp f…
- #/category/TOBACCO, NOVELTIES, CANDIES → sibling cards; #/product/<id> — These pairs show the identical image: #11 Backwoods cigars 5-pack and #16 Backwoods cigars singles both use backwoods_5pk.webp (5-pack boxes shown for singles; products.js:43/53). #77 Slapwoods 5-pack and #340 Slapwoods singles both use slapwoods_5pk.webp (a 10-pack carton of 5-wrap packs, 227x333; L175/L701). #316 Al Fakher 250 g and #317 Al Fakher 1 kg both use alfakher_250_gram.webp (L653/L655); the 1 kg bag or tub is never shown. #240 America…
- Card grids and product pages for the pairs below; hero slide 4 — Files used by two rows each (img fields in products.js): - faygo_bottles_20oz.jpg: #58 and #89 - gain.jpg: #112 and #333 - powerade_20oz.webp: #290 and #291 - maruchan_packs.jpg: #326 and #327 - p_gatorade.jpg (380x380): #335 Gatorade small and #336 Gatorade big - uncle_al_s_cookies.jpg: #350 Uncle Al's and #351 Uncle Al's cookies. food-stuff.md:22 says #350 is the same Lemon Ice cookies listed without a flavor. The first four pairs are also cove…
- #/product/<id> main image (alt = product name) for the rows listed; the same photos appear on cards — Checked live on the product pages. Clear mismatches: #89 alt 'Faygo cans' shows 20 oz bottles (faygo_bottles_20oz); #333 alt 'Gain dish liquid' shows Gain laundry detergent (gain.jpg); #326 alt 'Maruchan ramen cups' shows flat ramen packs (maruchan_packs); #67 alt 'Kangvape 8000' shows the 65K (kang_vape_65k); #329 alt 'RAW tips' shows rolling papers (raw_papers); #16 alt 'Backwoods cigars singles' shows the 5-pack; #19 'ZYN 3mg' and #267 'ZYN Eu…

**Fix:** Give each of the 37 rows that share 18 photo files its own photo showing the correct size, pack or format. At minimum, show a visible size/pack badge. Make the alt text (the product name) match what the photo shows. This includes hero slide 4.

**Owner input needed:** Can you supply (or license) correct photos for the 37 products that currently share 18 photo files, showing each one's actual size, pack or format?

**Files:** `scripts/build-seed.mjs:47`, `src/App.jsx:817`, `src/App.jsx:1092`, `src/data/content.js:45`, `src/data/products.js:53`, `src/data/products.js:59`, `src/data/products.js:155`, `src/data/products.js:199`, `src/data/products.js:401`, `src/data/products.js:421`, `src/data/products.js:503`, `src/data/products.js:555`, `src/data/products.js:601`, `src/data/products.js:603`, `src/data/products.js:655`, `src/data/products.js:657`, `src/data/products.js:673`, `src/data/products.js:679`, `src/data/products.js:687`, `src/data/products.js:691`, `src/data/products.js:693`, `src/data/products.js:701`, `src/data/products.js:721`, `src/data/products.js:723`, `src/lib/useCatalog.js:30`, `supabase/seed/products.sql:339`

**Evidence:** [data/shared-photo-maruchan-zyn.jpg](screenshots/data__shared-photo-maruchan-zyn.jpg), [data/card-1-variants-gatorade.jpg](screenshots/data__card-1-variants-gatorade.jpg), [product/catalog-photo-contact-sheet-01.jpg](screenshots/product__catalog-photo-contact-sheet-01.jpg), [product/catalog-photo-contact-sheet-08.jpg](screenshots/product__catalog-photo-contact-sheet-08.jpg), [product/catalog-photo-contact-sheet-09.jpg](screenshots/product__catalog-photo-contact-sheet-09.jpg), [photos1/shared-image-pairs.jpg](screenshots/photos1__shared-image-pairs.jpg), [photos2/shared-photos.jpg](screenshots/photos2__shared-photos.jpg), [photos2/drinks-sodas-390-cards.jpg](screenshots/photos2__drinks-sodas-390-cards.jpg), [a11y/alt-mismatch-product-333.jpg](screenshots/a11y__alt-mismatch-product-333.jpg), [a11y/alt-mismatch-product-89.jpg](screenshots/a11y__alt-mismatch-product-89.jpg)

- [ ] Done

#### AW-137 · Most disposable vapes and pods have no flavor list, so buyers can't say which flavor they want

**Medium** · catalog-data · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** #/category/NOVELTIES/Disposable%20Vapes and Vape Pods: cards show "QUOTE +" with no flavor choice

**Problem:** variants: [] on #64 RAZ 25K (NEW, in the home New arrivals rail), #65 RAZ Vue Full kit, #66 RAZ Vue Pods, #67 Kangvape 8000, #68 Kangvape 65K, #310 Geek Bar Mate 60K and #311 Geek Bar Mate 60K pods. #60 Geek Bar Pulse 15K and #61 Pulse X 25K (both BESTSELLER) list only 2 flavors, and #254 Luffbar only "Alaska". The home card for RAZ 25K shows "RAZ · AW-RAZ-25K" with a one-click "QUOTE +", so the quote line carries no flavor. Vapes are the site's headline category (hero slides 1–2 and the welcome offer).

**Fix:** Fill `variants` for ids 60, 61, 64, 65, 66, 67, 68, 254, 310 and 311 with the flavors the warehouse actually stocks, from the owner's current vape order sheet, and keep `flavors` equal to variants.length. If a product is genuinely sold as an assorted case, add a single variant "Assorted case" and say so in the description, so that requiresVariantChoice stays meaningful. Regenerate and apply the seed.

**Owner input needed:** Which flavors does the warehouse actually stock for vape products 60, 61, 64, 65, 66, 67, 68, 254, 310 and 311 (or which are sold only as assorted cases)?

**Files:** `src/data/products.js:141`, `src/data/products.js:143`, `src/data/products.js:149`, `src/data/products.js:151`, `src/data/products.js:153`, `src/data/products.js:155`, `src/data/products.js:157`, `src/data/products.js:529`, `src/data/products.js:641`, `src/data/products.js:643`, `src/lib/lines.js:27`

**Evidence:** [data/home-new-arrivals.jpg](screenshots/data__home-new-arrivals.jpg)

- [ ] Done

#### AW-138 · Variant labels are inconsistent: mixed flavor and size axes, abbreviations, typos, merged flavors, and non-choices

**Medium** · catalog-data · Who: **Cursor** · Effort: M · Partly fixed since the 2026-09-25 audit · Viewports: all

**Where:** PDP variant chips, cart/quote line names and generated variant SKUs

**Problem:** Flavor and size mixed in one list with inconsistent abbreviations: #162 "Almond reg" / "Almond king size"; #171 "Cookies king" vs "Milk king size"; #166 "Cups regular" vs "White cups reg"; #169 "Red reg" / "Red king size". #62 merges two flavors into one chip, "Watermelon ice Kiwi dragon berry", so the count of 8 is wrong. Cryptic or misspelled: #62 "Omg b burst"; #63 "Sour Apple ice"; #150 "IPhone", "IPhone To type C", "Type C To Type C"; #52 "Butter flies"; #51 "Apple jack"; #183 "Winter fresh" vs #38 "Winterfresh"; #12 "Cookies cream" vs #1 "Cookies & cream"; #201 "5-flavors"; #27 "AAA4", "D2"; #331 "AAA2". Unit formats: #356 "1 gal; 2gal; 5 gal"; #107 "13gal; 23gal"; #212 "8lbs; 10lbs"; #120 "20oz"; #362 "M size; L size". Order: #314 [Big; Small; Medium; 1kg]; #125 [Big; Small; Medium]. Not real choices: #122–#124 ["Case"], #329 ["Tips"], #267 ["Mix"], #258 ["Any flavor"], #330 ["Organic"], #354 ["Small"]. Packaging colors instead of attributes: #108 Tampax Yellow/Green, #134 rubbing alcohol White/Green, #132/#133 charcoal White/Red, #324 Twangerz Yellow/Green, #28 Rhino Purple/Black/Gold. Improved since the prior audit's "almond king size" example, but still inconsistent.

**Fix:** Normalize every variants array in src/data/products.js.
(1) Use one axis per list: split size from flavor, e.g. Hershey's bars becomes flavors [Milk, Cookies 'n' Creme, Almond, Mr. Goodbar] plus a separate size row or product for King size, or at minimum a uniform "<Flavor> — Regular" / "<Flavor> — King size".
(2) Spell sizes "Regular" and "King size", never reg/king.
(3) Fix the spellings: iPhone (Lightning), USB-C, Lightning to USB-C, USB-C to USB-C, Butterflies, Apple Jacks, Winterfresh, Cookies & cream, 5 Flavors, AAA 4-pack, AA 4-pack, D 2-pack, AAA 2-pack, AA 2-pack, C 2-pack, 1 gal, 2 gal, 5 gal, 13 gal, 23 gal, 8 lb, 10 lb, 20 oz, 16 oz, 12 oz, 8 oz, Medium, Large.
(4) Split #62's merged chip into "Watermelon ice" and "Kiwi dragon berry", and get the real name of "Omg b burst" from the owner.
(5) Order sizes Small → Medium → Big (#125, #314).
(6) For one-item non-choices (#122–124 "Case", #329 "Tips", #267 "Mix", #258 "Any flavor", #330 "Organic", #354 "Small"), set variants: [] and flavors: 0, and move the information into sellUnit or the name.
(7) Ask the owner which real attribute the packaging colors stand for (#108, #134, #132, #133, #324, #28) and use it. Do not invent values.
Add a rule in validate() at scripts/build-seed.mjs:47 that pushes a problem for any variant label matching /^I[A-Z]|\bTo\b|\b(reg|king)$|\d(gal|lbs|oz)\b/.
Renaming a label changes its slug (lines.js:10) and the generated variant SKU (lines.js:31), so keep a map from old to new labels and check that QuickReorder still resolves past orders. Finally, run `npm run seed` and apply supabase/seed/products.sql to Supabase, because the storefront reads variants from the live products table.

**Files:** `scripts/build-seed.mjs:47`, `src/data/products.js:145`, `src/data/products.js:147`, `src/data/products.js:237`, `src/data/products.js:265`, `src/data/products.js:321`, `src/data/products.js:345`, `src/data/products.js:353`, `src/data/products.js:363`, `src/data/products.js:733`, `src/lib/lines.js:10`, `src/lib/lines.js:31`

- [ ] Done

#### AW-139 · Merchandising tags don't hold up: Featured filters return nothing, and DEAL/PREMIUM are unexplained

**Medium** · catalog-data · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** #/ "New arrivals" and "Bestsellers" rails; category filter panel "Featured" checkboxes

**Problem:** NEW_ARRIVALS_IDS = [61, 62, 64, 31, 171, 167, 342, 184, 75, 76], trimmed to 8 in the UI. The New arrivals rail therefore shows #61 Geek Bar Pulse X, #31 BIC lighters and #171 Hershey's, all badged BESTSELLER; #167 Almond Joy, untagged; and #342 with no photo. Meanwhile the NEW-tagged #75 and #76 are cut off. BIC and Geek Bar Pulse X appear in both home rails. Only 28 of 368 rows carry any tag (16 BESTSELLER, 6 NEW, 3 DEAL, 3 PREMIUM). DEAL (#82, #105, #270) and PREMIUM (#265, #321, #332) have no discount or compare-at price anywhere. GROCERY has zero tagged rows, yet shows Bestsellers/New/Deals/Premium checkboxes that each return "Showing 0 of 47 items" (measured). Every other department has two or more empty options, e.g. TOBACCO New/Premium and FOOD STUFF New/Deals/Premium.

**Also seen:**
- #/category/<DEPT> → Filters → FEATURED fieldset (Bestsellers / New / Deals / Premium); mobile drawer 'Show N items' — All four checkboxes show on every department with no counts, but the live catalog has only 16 BESTSELLER, 6 NEW, 3 DEAL and 3 PREMIUM rows. Zero-result options: Grocery all 4; Tobacco New, Premium; Candies Deals, Premium; Food Stuff New, Deals, Premium; Motor Oil New, Premium; Drinks & Bags New, Premium; Merchandise New, Deals; Novelties Deals, Premium. On mobile, Grocery with Deals ticked shows an enabled 'Show 0 items ↗' button that leads to 'N…
- #/product/82, 105, 270 (DEAL) and 265, 321, 332 (PREMIUM) → .card-tag on the photo — At 1440, #/product/82 (Pom Pom cigarillos), #/product/105 (WD-40) and #/product/270 (Monster Energy) show a 'DEAL' badge in .pd-media. The body text of #82 contains 'deal' once, in the badge. #/product/265, 321 and 332 show 'PREMIUM'. The home page's .card-tag backgrounds are BESTSELLER rgb(200,71,22) and NEW rgb(40,20,89); the PDP's DEAL and PREMIUM are also rgb(200,71,22). The data has 16 BESTSELLER, 6 NEW, 3 DEAL and 3 PREMIUM rows. #/category…

**Fix:** Define and audit the tag set in products.js. On category pages, show only Featured checkboxes that have matching products in the current department (with counts), or hide the fieldset (App.jsx:869, 935, 1007). Either explain DEAL and PREMIUM on the PDP (what the deal is, what premium means) or remove those tags (App.jsx:816, 872, 1091).

**Owner input needed:** What do the DEAL and PREMIUM tags mean for buyers (the actual deal terms and premium criteria), or should they be removed?

**Files:** `scripts/build-seed.mjs:18`, `src/App.jsx:703`, `src/App.jsx:704`, `src/App.jsx:816`, `src/App.jsx:869`, `src/App.jsx:872`, `src/App.jsx:873`, `src/App.jsx:935`, `src/App.jsx:1007`, `src/App.jsx:1091`, `src/data/products.js:185`, `src/data/products.js:231`, `src/data/products.js:561`, `src/data/products.js:766`, `src/index.css:206`, `src/index.css:207`, `src/pages/admin/AdminPage.jsx:315`

**Evidence:** [data/home-new-arrivals.jpg](screenshots/data__home-new-arrivals.jpg), [catalog/grocery-390-drawer-deals-zero.jpg](screenshots/catalog__grocery-390-drawer-deals-zero.jpg), [catalog/grocery-390-empty-state.jpg](screenshots/catalog__grocery-390-empty-state.jpg)

- [ ] Done

#### AW-140 · Duplicate and unidentified product rows

**Medium** · catalog-data · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** Listed PDPs and their category grids

**Problem:** #350 "Uncle Al's" and #351 "Uncle Al's cookies" are the same Lemon Ice cookie with the same photo; food-stuff.md says so, yet they are priced $33.23 and $18.68. #366 "Garcia y Vega cigars" (variant Green) is pictured and sourced as "game-cigars-palma-green-40ct", which overlaps #3 Game cigarillos, whose variants include Green. #95 Trash can liners vs #107 Trash bags. Rows the photo notes could not identify: #295 "Snack wraps" (40ct/12ct), possibly plastic snack bags or tortillas yet filed in Chips & Crackers; #219 "Happy valentines jar" ("not identified; two candidates"); #126 Baby wipes Boys/Girls ("Not certain"); #253 "Ajax detergent" ("not confirmed as the current US retail package").

**Fix:** For #350: delete the row from CATALOG in src/data/products.js, which serves as the static fallback. Deactivate it in Supabase through Admin → Products → Edit → uncheck Active, or run `update public.products set active = false where id = 350;`, because the seed never changes `active` and never deletes rows. Add the other Uncle Al's flavors the warehouse stocks as variants on #351. For #366, ask the owner. If it is Game Palma Green, rename it "Game Palma cigars" with brand "Game" and variants ["Green"] (a distinct large-format product from #3 Game cigarillos). For #95/#107, ask whether they are the same stock. If so, fold #95 into #107's variants and deactivate #95 the same way as #350. For #295, #219, #126 and #253, get the exact product from the owner and set name, brand, sub and photo, or deactivate the row in Supabase until it is identified. Run `npm run seed` and apply the result afterwards.

**Owner input needed:** Is #366 Game Palma Green cigars, are #95 and #107 the same stock, and which other Uncle Al's flavors are stocked for #351?

**Files:** `scripts/build-seed.mjs:19`, `src/assets/products/sources/food-stuff.md`, `src/assets/products/sources/grocery.md`, `src/assets/products/sources/novelties.md`, `src/assets/products/sources/tobacco.md`, `src/data/products.js:27`, `src/data/products.js:211`, `src/data/products.js:235`, `src/data/products.js:273`, `src/data/products.js:459`, `src/data/products.js:527`, `src/data/products.js:611`, `src/data/products.js:721`, `src/data/products.js:723`, `src/data/products.js:753`

**Evidence:** [data/wrong-photo-raw-garcia.jpg](screenshots/data__wrong-photo-raw-garcia.jpg)

- [ ] Done

#### AW-286 · Brand field is wrong or missing on several rows

**Low** · catalog-data · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** Card detail line (brand · variants · SKU) and PDP eyebrow ("BRAND · SUB-LINE")

**Problem:** #191 brand "Mint lumps" and #192 "Cherry lumps", while their packshots (src/assets/products/mint_lumps.jpg, cherry_lumps.jpg) show the brand "Candyman's" (Sumthin' Sweet line). #44 has brand "Mike and Ike" but name "Mike & Ike". #248 has name "Coke" but brand "Coca-Cola". #98 has brand "BlueDEF" while its description says "PEAK BlueDEF" (PEAK is the brand used on #99 and #103). #343 "Gummy novelty candy" has brand "Assorted" but an eFrutti Mini Burger photo, and its PDP eyebrow reads "ASSORTED · SWEETS & GUMMIES". #219 has brand "Happy". 66 rows use the placeholder brand "Assorted", which prints on cards (e.g. #342 Dubai chocolate on the home New arrivals rail: "Assorted · 2 variants · AW-DUBAI-CHOCOLAT") and in the PDP eyebrow.

**Fix:** In src/data/products.js set: #191 and #192 brand "Candyman's"; #44 name "Mike and Ike", matching the brand; #248 name "Coca-Cola"; #98 brand "PEAK" and name "PEAK BlueDEF diesel exhaust fluid 2.5 gal"; #343 brand "eFrutti" only if every variant is eFrutti (SpongeBob is not, so confirm with the owner). Replace "Assorted" with the actual stocked brand wherever the owner knows it. In App.jsx:821 render the brand segment only when p.brand !== 'Assorted'. In App.jsx:1094 render `{p.brand !== 'Assorted' ? `${p.brand} · ` : ''}{p.sub}`. Then run `npm run seed` and apply supabase/seed/products.sql so the live products table picks up the new brands and names.

**Owner input needed:** For each product currently listed as 'Assorted' (and #343, which mixes eFrutti and SpongeBob), which brand do you actually stock?

**Files:** `src/App.jsx:821`, `src/App.jsx:1094`, `src/data/products.js:109`, `src/data/products.js:217`, `src/data/products.js:403`, `src/data/products.js:405`, `src/data/products.js:517`, `src/data/products.js:707`

**Evidence:** [data/contact-sheet-3.jpg](screenshots/data__contact-sheet-3.jpg)

- [ ] Done

## Product photos — Tobacco, Novelties, Merchandise, Candies

#### AW-034 · Ad banners, retailer listing tiles, lifestyle/stock shots and collages are used as product photos

**High** · imagery · Who: **Owner → Cursor** · Effort: M · New · Viewports: all (at 390 the baked-in slogans are unreadable at 133px card width)

**Where:** #/category/NOVELTIES (first 8 cards), #/category/TOBACCO, #/category/MERCHANDISE; home New arrivals, Bestsellers and 'Shop by department' Novelties tile

**Problem:** These rows use ad creatives with slogans, spec badges and scenic backgrounds instead of packshots. #60 Geek Bar Pulse 15K geekbar_15k.webp ('MAY THE PULSE BE WITH YOU', pink splash). #61 Geek Bar Pulse X 25K geekbar_25k_pulse.webp ('ACCEPT ALL CHALLENGES', purple). #62 Foger Switch Pro full kit foger_full_kit.jpg ('DISPOSABLE & POWER BANK', purple and orange). #63 Foger Switch Pro pods foger_pods.webp ('30K PUFFS COMPATIBLE WITH SWITCH PRO', teal gradient). #67 and #68 Kangvape kang_vape_65k.jpg (outer-space scene, UFO, '3D curved screen', '30 minutes', '21+' feature icons). #69 Shroom Puff disposable p69-shroom-puff-disposable-3g.jpg (full-bleed poster card, 420x765). #70 Shroom Puff Pre rolls p70-shroom-puff-pre-rolls-2pk.jpg (flat print artwork with red dashed dieline and bleed marks, 357x1044). #210 Seneca filtered cigars seneca_filter_cigarettes.jpg ('Distinctively Smooth' poster, 518x386). #339 Billionaire hemp wraps billionaire_wraps.jpg ('FOR THOSE WITH EXQUISITE TASTE … SOLD HERE!', website URL and QR code). #332 Black Tiger Honey black_tiger_honey.jpg (orange hexagon ad frame, 579x474). #209 24/7 cigarettes 24_7.jpg (yellow halftone promo background, 370x370). #315 Al Fakher 50 g alfakher_50_gram.webp (paint-splash backdrop). A milder version is brand-logo lockups composited above the product: #5 4k_cigarillos.webp, #11 and #16 backwoods_5pk.webp, #12 loose_leafs_2_99_1_99.webp, #17 b_m_25ct.webp, #85 zigzag_wraps.webp, #240 and #241 american_club.png (grey 'AMERICAN CLUB' banner), #273 and #367 loose_leafs_wraps_5pk.webp. Visibility: the Novelties grid opens with 4 ad banners in a row. Home 'New arrivals' starts with #61 and #62. The home 'Shop by department' Novelties tile uses #60, because App.jsx:755 takes the first product in the department that has an image.

**Also seen:**
- Drinks & Bags, Grocery and Motor Oil cards and product pages; home Bestsellers (Red Bull 12 oz) — These product photos carry text overlays or are marketing art (checked at source resolution): - #21 men_s_deodorant.jpg: a concrete banner reading 'Explore our range of care products' over a row of seven small sticks. - #54 p54-stayfree-pads.jpg: 'FSA HSA', '24 COUNT' and 'MAXI' badges. - #136 p136-always-pads.jpg: an 'FSA HSA' badge. - #143–#146 Red Bull 12/8.4/16/20 oz: an 'ORIGINAL nn oz' banner from y=800 to 1000. The cans are scaled to about…
- #/category/MERCHANDISE → OTC & Health cards; #/product/<id> — These images are the retailer's hero graphics, not packshots. Each carries a 'FSA/HSA' roundel and/or a large coloured side or bottom panel with marketing text. #23 Tylenol p23-tylenol.jpg ('Easy to Swallow Pain Reliever / 24 caplets'). #25 Claritin p25-claritin.jpg ('TABLETS / 100 COUNT'). #26 Benadryl p26-benadryl.jpg ('ALLERGY RELIEF 24CT'). #222 Pepcid Complete ('ACID REDUCER + ANTACID BERRY / 25 CHEWABLES'). #223 Bayer ('GENUINE ASPIRIN TABL…
- #/category/MERCHANDISE, TOBACCO, NOVELTIES → cards; #/product/<id> — #149 Rolling dice p149-rolling-dice.jpg: art photo of a dice pyramid on a black background, not a retail dice pack. #150 Phone cables & chargers p150-phone-cables.jpg: macro of one generic USB-A plug on a grey shadow. The variants are iPhone, Type C, Android, car charger, home charger, and none of them is shown. #334 Bandaids p334-bandaids.jpg: a hand wrapping a bandage roll against a grey wall, not a bandage box. #255 RAW rolling papers raw_pape…
- #/category/FOOD%20STUFF, DRINKS%20%26%20BAGS, GROCERY cards — Photos that are not a single product on a plain background: - Lifestyle: #323 Twang beer salt bottles lying on a striped woven textile; #325 Jarritos, five bottles outdoors on grass (1024x737). - Multi-item collages or grids: #115 Dove (6 boxes, only 'Original' stocked), #279 Yakisoba (7 trays), #292 Electrolit (6 flavors, only 'Blue' stocked), #59 Arizona (12 cans, each about 30px wide on a card), #278 Van Holten's (8 pouches), #58 Faygo (6 bott…
- PDP hero image and cards for the listed ids — Non-packshots: #21 (Speed Stick banner with text), #290/#291 (Powerade banner, 640x276), #334 (bandage on a wrist, Wikimedia), #255/#329 (RAW collage), #149 (dice on black), #262 (jar on black), #60/#61/#62/#67/#68 (promo art with slogans). Low-res largest generated widths: wo_mini 211x384 (#263), slapwoods_5pk 227x333 (#77, #340), 4pk_tissues 350 (#122), 24_7 370 (#209), p_gatorade 380 (#335, #336), p_qcarbo 380 (#218), takis 428 (#328), foam_cu…

**Fix:** Replace every non-packshot image with a clean packshot on the standard background: Novelties vape banners, Seneca/Billionaire/Black Tiger/24/7 graphics, the Kroger OTC tiles with FSA/HSA badges, Red Bull and other listing graphics, stock/lifestyle/dieline images and multi-product collages.

**Owner input needed:** Supply clean packshot photos to replace the ad banners, retailer tiles, lifestyle shots and collages currently used for Novelties, Tobacco and Merchandise products.

**Files:** `scripts/build-images.mjs:68`, `src/App.jsx:755`, `src/assets/products/sources/drinks-bags.md`, `src/assets/products/sources/grocery.md`, `src/data/products.js:63`, `src/data/products.js:67`, `src/data/products.js:71`, `src/data/products.js:73`, `src/data/products.js:129`, `src/data/products.js:137`, `src/data/products.js:139`, `src/data/products.js:141`, `src/data/products.js:143`, `src/data/products.js:145`, `src/data/products.js:147`, `src/data/products.js:155`, `src/data/products.js:157`, `src/data/products.js:159`, `src/data/products.js:161`, `src/data/products.js:219`, `src/data/products.js:251`, `src/data/products.js:293`, `src/data/products.js:307`, `src/data/products.js:309`, `src/data/products.js:311`, `src/data/products.js:313`, `src/data/products.js:319`, `src/data/products.js:321`, `src/data/products.js:435`, `src/data/products.js:439`, `src/data/products.js:441`, `src/data/products.js:465`, `src/data/products.js:467`, `src/data/products.js:469`, `src/data/products.js:473`, `src/data/products.js:477`, `src/data/products.js:479`, `src/data/products.js:481`, `src/data/products.js:483`, `src/data/products.js:485`, `src/data/products.js:487`, `src/data/products.js:515`, `src/data/products.js:519`, `src/data/products.js:531`, `src/data/products.js:547`, `src/data/products.js:577`, `src/data/products.js:579`, `src/data/products.js:601`, `src/data/products.js:603`, `src/data/products.js:605`, `src/data/products.js:651`, `src/data/products.js:653`, `src/data/products.js:665`, `src/data/products.js:667`, `src/data/products.js:671`, `src/data/products.js:685`, `src/data/products.js:689`, `src/data/products.js:699`, `src/data/products.js:766`, `src/index.css:311`, `src/index.css:312`, `src/index.css:596`

**Evidence:** [photos1/ad-banners-marketing-graphics.jpg](screenshots/photos1__ad-banners-marketing-graphics.jpg), [photos1/home-new-arrivals-1440.jpg](screenshots/photos1__home-new-arrivals-1440.jpg), [photos1/home-departments-1440.jpg](screenshots/photos1__home-departments-1440.jpg), [photos1/novelties-grid-390.jpg](screenshots/photos1__novelties-grid-390.jpg), [photos1/p70-print-artwork-dieline.jpg](screenshots/photos1__p70-print-artwork-dieline.jpg), [photos1/sheet-07-NOVELTIES-60-71.jpg](screenshots/photos1__sheet-07-NOVELTIES-60-71.jpg), [photos2/retailer-banner-overlays.jpg](screenshots/photos2__retailer-banner-overlays.jpg), [photos2/drinks-energy-390-cards.jpg](screenshots/photos2__drinks-energy-390-cards.jpg), [photos2/pdp-290-1440-dpr1.jpg](screenshots/photos2__pdp-290-1440-dpr1.jpg), [photos2/pdp-21-1440-dpr1.jpg](screenshots/photos2__pdp-21-1440-dpr1.jpg), [photos2/redbull-8-12-16-20oz-same-can.jpg](screenshots/photos2__redbull-8-12-16-20oz-same-can.jpg), [photos1/card-otc-overlays-1440.jpg](screenshots/photos1__card-otc-overlays-1440.jpg), [photos1/otc-retailer-overlays.jpg](screenshots/photos1__otc-retailer-overlays.jpg), [photos1/non-packshot-stock-photos.jpg](screenshots/photos1__non-packshot-stock-photos.jpg), [photos1/sheet-12-MERCHANDISE-226-265.jpg](screenshots/photos1__sheet-12-MERCHANDISE-226-265.jpg), [photos1/sheet-13-MERCHANDISE-287-365.jpg](screenshots/photos1__sheet-13-MERCHANDISE-287-365.jpg), [photos2/crops-lifestyle-collage.jpg](screenshots/photos2__crops-lifestyle-collage.jpg), [photos2/contact-sheet-7.jpg](screenshots/photos2__contact-sheet-7.jpg), [photos2/drinks-sodas-390-cards.jpg](screenshots/photos2__drinks-sodas-390-cards.jpg), [data/non-packshot-banners.jpg](screenshots/data__non-packshot-banners.jpg), [data/pdp-263-lowres-upscaled.jpg](screenshots/data__pdp-263-lowres-upscaled.jpg)

- [ ] Done

#### AW-141 · Photo backgrounds are inconsistent: white boxes on cream tiles, and full-bleed black/purple images next to cut-outs

**Medium** · visual-design · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** All category grids (#/category/TOBACCO etc.), home product rows, and #/product/<id> photo

**Problem:** Card tiles (.card-block, index.css:202) and the PDP box (.pd-media, :311) use background var(--paper) #f6f3ee. Photos with white backgrounds render as a visible white rectangle on the cream tile. On #/category/TOBACCO at 1440 (3-column grid), the first three rows show a grey gradient (#1 Swisher Sweets), white boxes (#2 White Owl display, #5 4K's, #6 Game Mini), a transparent cut-out (#3 Game), a purple full-bleed (#4 BLK, RGB 55,33,73) and a black full-bleed (#7 Swisher Sweets Mini). Other dark or coloured full-bleed backgrounds: #32 BluntPower (magenta), #79 Game Leaf 3-pack and #80 Swisher Sweets Leaf Wraps (brown tobacco-leaf scene), #265 Hard Steel (grey studio). Injecting `.card-block img{mix-blend-mode:multiply}` removed every white box and left cut-outs intact. The site has no dark theme, so multiply has no side effect.

**Also seen:**
- #/ → all product and department cards (.card-block) — The tile background is --paper #f6f3ee (index.css:202), but most packshots have white backgrounds, so each card shows a white square inside a beige square: Hershey's, Almond Joy, Backwoods, STP, Saxon, Red Bull, Snickers, BIC and every department tile. Framing is also inconsistent. The Geek Bar Pulse X/15K and Foger ads fill the tile edge to edge with dark purple or pink backgrounds and baked-in ad text. BIC lighters is a 302×169 landscape fillin…
- #/category/<DEPT> → .card-block image area — Corner-pixel sampling of all 291 loaded card photos: 214 have an opaque white background. Inside the #f6f3ee tile with 14px padding they appear as off-centre white rectangles (Vaseline, Stayfree, Tampax, Butterfinger, Argo). 41 photos have extreme aspect ratios (wider than 1.4:1 or taller than 1:1.4), e.g. Faygo, Powerade, PayDay, Welch's juice, Tropical Fantasy, so tile fill varies widely. Several photos are marketing banners with slogans rather…
- All category card grids (.card-block) and product pages (.pd-media); search and cart thumbnails — Cards and product-page frames use a cream background (--paper #f6f3ee), but most sources have an opaque white background. In my four departments 83 of 95 photos have white (255,255,255) corners, so each shows a white rectangle inset in the cream card (Argo, Imperial Sugar, Vaseline, every Red Bull, etc.). Only the transparent PNG/WebP sources blend in: #48, #59, #109, #113, #235, #349, #360. A few are full-bleed photos with their own background (…
- #/product/<id> → .pd-media (e.g. 162, 7, 149, 262, 80, 21, 290, 291, 334) — .pd-media background rgb(246,243,238) (index.css:311). White-box inset on beige: 162 Snickers (snickers_almond_share). Solid black backgrounds: 7 Swisher Mini (p7-swisher-sweets-mini-cigarillos.jpg), 149 Rolling dice (p149-rolling-dice.jpg), 262 eFrutti jar (efrutti_jar.webp). Brown textured leaf backdrop: 80 Swisher Leaf Wraps (ss_wraps.webp). Tiny strip on beige: 357 Starburst (p357-starburst-favereds-share-size.png). Non-packshots: 21 Speed St…

**Fix:** Standardize the image tile. Either make .card-block and .pd-media backgrounds pure white, or preprocess every product image in scripts/build-images.mjs to a consistent background (trim + pad onto the tile colour, or use mix-blend-mode: multiply for white-background shots). Replace dark or full-bleed photos with packshots on the standard background so framing is consistent across cards, search/cart thumbnails and the PDP (index.css:202-204, 311-312).

**Owner input needed:** Supply (or approve sourcing/licensing of) replacement packshots on a plain background for the dark or full-bleed product photos, so Cursor can standardize the tiles.

**Files:** `scripts/build-images.mjs:43`, `scripts/build-images.mjs:83`, `src/App.jsx:814`, `src/assets/products/`, `src/data/products.js:35`, `src/data/products.js:63`, `src/data/products.js:141`, `src/data/products.js:143`, `src/data/products.js:181`, `src/data/products.js:319`, `src/data/products.js:545`, `src/data/products.js:601`, `src/data/products.js:603`, `src/data/products.js:689`, `src/data/products.js:735`, `src/index.css:158`, `src/index.css:202`, `src/index.css:204`, `src/index.css:311`, `src/index.css:312`, `src/index.css:465`

**Evidence:** [photos1/card-framing-inconsistency-1440.jpg](screenshots/photos1__card-framing-inconsistency-1440.jpg), [photos1/coloured-fullbleed-backgrounds.jpg](screenshots/photos1__coloured-fullbleed-backgrounds.jpg), [photos1/candies-grid-multiply-preview-1440.jpg](screenshots/photos1__candies-grid-multiply-preview-1440.jpg), [home/sec-1440-newarrivals.jpg](screenshots/home__sec-1440-newarrivals.jpg), [home/sec-1440-bestsellers.jpg](screenshots/home__sec-1440-bestsellers.jpg), [home/sec-1440-depts.jpg](screenshots/home__sec-1440-depts.jpg), [catalog/grocery-grid-rows1-3.jpg](screenshots/catalog__grocery-grid-rows1-3.jpg), [catalog/novelties-1024-card-row1.jpg](screenshots/catalog__novelties-1024-card-row1.jpg), [photos2/foodstuff-1440-card-row1-whitebox-label-overlap.jpg](screenshots/photos2__foodstuff-1440-card-row1-whitebox-label-overlap.jpg), [photos2/pdp-324-1440-dpr2.jpg](screenshots/photos2__pdp-324-1440-dpr2.jpg), [photos2/fix-food-top.jpg](screenshots/photos2__fix-food-top.jpg), [product/bg-inconsistency-strip.jpg](screenshots/product__bg-inconsistency-strip.jpg), [product/photo-21-speedstick-banner.jpg](screenshots/product__photo-21-speedstick-banner.jpg), [product/photo-290-powerade-banner.jpg](screenshots/product__photo-290-powerade-banner.jpg), [product/photo-334-bandaids-lifestyle.jpg](screenshots/product__photo-334-bandaids-lifestyle.jpg)

- [ ] Done

#### AW-142 · Photo shows a flavor or brand the row does not list (single-variant rows most visibly)

**Medium** · catalog-data · Who: **Owner → Cursor** · Effort: M · New · Viewports: all

**Where:** #/product/<id> photo vs. variant chips; category cards

**Problem:** On single-variant rows the photo shows a different variant: #294 PIK 16mg shows 'COLA ICE', variant Wintergreen (L609). #299 Psyched 6000mg shows '6000MG BLUEBERRY GELATO', variant Snow lotus (L619). #202 Rips bags shows 'Mango Chili', variant Grape (L425). #340 Slapwoods singles shows 'SWEET BANANA', variant Russian cream (L701). #358 Life Savers Gummies share size shows the '5 FLAVORS' pack, variant Wildberry (L737). On multi-variant rows the photo shows only unlisted flavors: #84 Good Times Flat Wraps shows Watermelon, Grape, Mango-licious, Cherry, Peach and Sour Apple, while the variants are Natural, Diamond, Vanilla, Fruit punch, Mango, Strawberry kiwi and Chocolate; only Mango overlaps (L189). #186 Charms Blow Pop shows a CHERRY ICE display; variants are Regular, Blue razz, Black cherry, Watermelon, Caramel apple (L393). #44 Mike & Ike shows the Orange box; Orange is not among the 7 variants (L109). Naming: #366 'Garcia y Vega cigars' (brand 'Garcia y Vega', L753) shows a Game (by Garcia y Vega) Green box, while #3 'Game cigarillos' (L27) uses brand 'Game', so the same line appears under two brand names.

**Also seen:**
- #/product/<id> photo vs the variant chips beside it (Food Stuff, Grocery, Motor Oil, Drinks & Bags) — Photo shown vs listed variants: - #49 Pop-Tarts: a Frosted Blueberry display box. Listed: Strawberry, S'mores, Brown sugar cinnamon. - #88 Tropical Fantasy: an 'APPLE' bottle with a $1.00 price print. Apple is not listed, and sources/drinks-bags.md:7 wrongly logs it as 'Mean Green Lemonade'. - #110 Brillo Basics: purple 'Clean Lavender' at 512px. Listed: Blue, Yellow, Orange, Green. - #111 Tide: a Canadian bilingual 'Tide + Bleach alternative / j…

**Fix:** Make each photo match a listed variant: either replace the photo with one showing a listed flavor/grade/pack, or add the pictured variant to the row (especially single-variant rows).

**Owner input needed:** For each product whose photo shows an unlisted flavor or brand, confirm whether that pictured variant is actually stocked (add it) or provide a correct photo of a listed variant.

**Files:** `src/assets/products/sources/drinks-bags.md:7`, `src/data/products.js:109`, `src/data/products.js:119`, `src/data/products.js:137`, `src/data/products.js:189`, `src/data/products.js:197`, `src/data/products.js:241`, `src/data/products.js:243`, `src/data/products.js:251`, `src/data/products.js:393`, `src/data/products.js:425`, `src/data/products.js:579`, `src/data/products.js:581`, `src/data/products.js:605`, `src/data/products.js:609`, `src/data/products.js:619`, `src/data/products.js:667`, `src/data/products.js:671`, `src/data/products.js:701`, `src/data/products.js:737`, `src/data/products.js:753`

**Evidence:** [photos1/variant-mismatch-examples.jpg](screenshots/photos1__variant-mismatch-examples.jpg), [photos1/sheet-03-TOBACCO-84-241.jpg](screenshots/photos1__sheet-03-TOBACCO-84-241.jpg), [photos1/sheet-16-CANDIES-175-186.jpg](screenshots/photos1__sheet-16-CANDIES-175-186.jpg), [photos2/variant-mismatch-photos.jpg](screenshots/photos2__variant-mismatch-photos.jpg), [photos2/contact-sheet-3.jpg](screenshots/photos2__contact-sheet-3.jpg)

- [ ] Done

#### AW-287 · Product scale in cards varies from about 26% to 100% of the tile because sources carry uneven built-in margins

**Low** · visual-design · Who: **Cursor** · Effort: M · New · Viewports: all

**Where:** All category grids → .card-block photo area

**Problem:** I trimmed each source's background with sharp (threshold 18) and measured how far the product reaches toward the edge of the 298x268 card photo area in its limiting dimension. Across the 196 photos in these departments, 117 reach at least 90% (many are full-bleed and touch all four edges, e.g. #1, #4, #7, #60–#63, #209, #262), 66 reach 75–90%, and 13 reach only 62–75%. The smallest: #65 RAZ Vue Full kit 62%, #216 Grinders 63%, #254 Luffbar 64%, #178 and #182 Sour Punch tub 65%, #73 Mental Health disposable 66%, #312 Stoned blue lotus gummies 67%, #31 BIC lighters 68%, #175 Chick-O-Stick jar 68%, #148 Trojan 69%, #66 RAZ Vue Pods 73%, #260 Backwoods True Wraps 73%, #164 Kit Kat 74%. In the grid, edge-to-edge images sit next to products with visible empty margins. (Tall or narrow items such as #285, #70, #245 and #257 already fill 85–96% of the tile height; their small area is due to their shape, not margins.)

**Also seen:**
- #/category/FOOD%20STUFF (Argo), GROCERY (Cottonelle, sandwich bags), Takis cards — Share of the frame the product fills on its longest side (trimmed bounding box / canvas): - #45 Argo corn starch: 62% (the jar sits small in a 1946px canvas) - #124 Bath tissue single rolls: 68% - #106 Sandwich bags: 73% (a 4032x3024 phone-size canvas) - #328 Takis: 77% Most other packshots fill 85–100%, so these read as noticeably smaller in the grid; Argo is also the home 'Food Stuff' tile. The build pipeline resizes but never trims margins (bu…

**Fix:** In scripts/build-images.mjs:81-83, trim each source's built-in whitespace and re-pad to a consistent product-to-tile ratio (~80%), so products don't vary from 26% to 100% of the tile (Argo, Cottonelle, sandwich bags, Takis).

**Files:** `scripts/build-images.mjs:81`, `scripts/build-images.mjs:83`, `src/data/products.js:111`, `src/data/products.js:233`, `src/data/products.js:269`, `src/data/products.js:677`, `src/index.css:204`

**Evidence:** [photos1/card-framing-inconsistency-1440.jpg](screenshots/photos1__card-framing-inconsistency-1440.jpg), [photos1/sheet-08-NOVELTIES-72-296.jpg](screenshots/photos1__sheet-08-NOVELTIES-72-296.jpg), [photos2/foodstuff-1440-card-row1-whitebox-label-overlap.jpg](screenshots/photos2__foodstuff-1440-card-row1-whitebox-label-overlap.jpg), [photos2/contact-sheet-1.jpg](screenshots/photos2__contact-sheet-1.jpg)

- [ ] Done

## Product photos — Food, Grocery, Motor Oil, Drinks; hero, logo & share images

#### AW-288 · The social share image is just the logo on purple and says nothing about the business

**Low** · seo · Who: **Owner → Cursor** · Effort: M · New

**Where:** public/og.jpg (og:image and twitter:image in index.html)

**Problem:** public/og.jpg is 1200x630 at 11,838 bytes. It is a 400x400 orange logo tile (enlarged from the 308px inset of the 320px logo.jpg) centred on flat #281459, so about 79% of the card is empty purple. There is no tagline, no 'Wholesale distributor for licensed retailers · Birmingham, AL' and no product imagery. og:image:alt (index.html:27) is 'Alabama Wholesale Inc logo'. The same file is the LocalBusiness JSON-LD image (index.html:39). The prior audit's missing-share-image issue is fixed; this is a content problem.

**Fix:** 1. Design a 1200x630 share card: left half, the horizontal logo (vector) plus 'Wholesale distributor for licensed retailers' and 'Birmingham, AL · Delivery in AL, MS, GA' in Barlow Condensed/DM Sans; right half, a warehouse or assortment photo.
2. Commit it as src/assets/og-card.png and change build-images.mjs:203-208 to copy or re-encode it to public/og.jpg instead of compositing the tile.
3. Update og:image:alt at index.html:27 to describe it.

**Owner input needed:** Please supply a licensed warehouse or product-assortment photo, plus a vector copy of the logo, for the 1200x630 social share card.

**Files:** `index.html:23`, `index.html:27`, `index.html:29`, `index.html:39`, `scripts/build-images.mjs:203`, `scripts/build-images.mjs:204`, `scripts/build-images.mjs:206`

**Evidence:** [photos2/logo-icons-og-1to1.jpg](screenshots/photos2__logo-icons-og-1to1.jpg)

- [ ] Done

#### AW-289 · The favicon mark is a blur at 16px, and the web manifest has no maskable icon

**Low** · visual-design · Who: **Cursor** · Effort: S · New

**Where:** Browser tab favicon; Android home-screen icon (public/site.webmanifest)

**Problem:** favicon.ico holds 16, 32 and 48px PNGs of the white swoosh on orange, cropped from the 320px logo.jpg (build-images.mjs:186). The mark is centred and not clipped, but it fills only 44% of the width and 70% of the height. At 16px it is a 7x11px white loop with a purple dot and is hard to recognise as the brand. There is no SVG favicon (index.html:12-13). site.webmanifest lists only icon-192 and icon-512 without "purpose": "maskable" (lines 9-12). Android therefore shows the full-bleed orange logo tile, with its tiny wordmark, shrunk inside a white legacy-icon circle.
Evidence: screenshots/qa-photos2__favicon-ico-16-x8.jpg, favicon-ico-48-x8.png

**Fix:** 1. Small favicons: in build-images.mjs:187, change the tile multiplier from 1.22 to about 1.05 so the mark fills more of the square. Once a vector logo exists, add public/favicon.svg (a bold swoosh or an 'AW' monogram in white on #D96A3A) and put `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` above index.html:12.
2. Maskable icon: in build-images.mjs after line 201, write public/icon-maskable-512.png. Composite the logo tile resized to 360px (about 70%, inside the 80% safe zone) centred on a 512x512 canvas filled with the `orange` colour from line 183. Add 'icon-maskable-512.png' to the outputs array at line 174 so the freshness check covers it, and add `public/icon-maskable-512.png` to .gitignore next to the other generated icons.
3. In site.webmanifest, add `{ "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }` to the icons array (after line 11).
4. Run `npm run images`.

**Files:** `.gitignore`, `index.html:12`, `index.html:13`, `public/site.webmanifest:9`, `scripts/build-images.mjs:174`, `scripts/build-images.mjs:186`, `scripts/build-images.mjs:187`, `scripts/build-images.mjs:194`, `scripts/build-images.mjs:201`

**Evidence:** [photos2/favicon-16-32-48-x-nearest.jpg](screenshots/photos2__favicon-16-32-48-x-nearest.jpg)

- [ ] Done

#### AW-290 · Photo filenames contain typos and misleading names

**Low** · code-quality · Who: **Cursor** · Effort: S · New

**Where:** src/assets/products/ (filenames referenced by products.js img)

**Problem:** - fabulouso.avif (#128): the brand is Fabuloso.
- coastal_moto_oil.jpg (#280): 'moto' should be 'motor'.
- brillo_dishwasher.png (#110): the product is dish liquid, not dishwasher.
- electrolyte.webp (#292): the brand is Electrolit.
- men_s_deodorant.jpg and women_s_deodorant.webp (#21, #225): brandless names.
- gain.jpg (#112/#333): ambiguous between laundry and dish.
- p_gatorade.jpg (#335/#336): no size.
Naming mixes the new 'p<id>-slug' convention with legacy ad-hoc names, which is how the shared and mismatched files (gain.jpg, p_gatorade.jpg) went unnoticed.

**Fix:** When replacing these photos (see the other findings), save them under the 'p<id>-<slug>.<ext>' convention, e.g. p128-fabuloso.avif, p280-coastal-motor-oil.jpg, p110-brillo-basics-dish-liquid.png, p292-electrolit.webp, p21-speed-stick-regular.jpg, p225-lady-speed-stick.webp, p112-gain-laundry.jpg. Update the img fields at the listed lines, delete the old files, run `npm run images` and `npm run seed`, and update the live products.img values. Don't change SKUs, since quick reorder matches them exactly.

**Files:** `src/data/products.js:63`, `src/data/products.js:241`, `src/data/products.js:245`, `src/data/products.js:277`, `src/data/products.js:471`, `src/data/products.js:581`, `src/data/products.js:605`, `src/data/products.js:691`

- [ ] Done

