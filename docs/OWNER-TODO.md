# Owner decisions still open

Part 1 of the 2026-10-08 site review (tobacco, vapor, age gate, and licence). The storefront keeps the current customer-facing value wherever a real price, photo, business fact, or legal sentence is missing. Each open item is also marked in code with `TODO(owner)`.

Do not apply the new SQL files in `supabase/migrations/` against production until you have reviewed them. The site keeps working on the current database until those migrations are applied.

| ID | Question | Status |
| --- | --- | --- |
| AW-001 | After legal review, which of these lines should be delisted, de-featured, or kept: Kratom & Kava, Mushroom Products, Detox, Wellness Pills, and the Honey & Energy enhancement items? | Waiting. Lines are unchanged. |
| AW-070 | Approve the department and sub-line for each misfiled product, especially the blue-lotus and hemp items under Mushroom Products, and say whether those lines stay in the catalog. | Waiting. Nothing was refiled. |
| AW-137 | Which flavors does the warehouse stock for vape products 60, 61, 64, 65, 66, 67, 68, 254, 310, and 311, or which of those are sold only as an assorted case? | Waiting. Variant lists are unchanged. |
| AW-014 | Should a cart with tobacco or vape items require sign-in as an approved buyer, or may a guest request a quote after entering a tobacco license number, a resale certificate number, and a 21+ attestation? | Guest quote fields are in place, with server enforcement in the new migration. Confirm this is the rule you want. |
| AW-129 | Is a state retail tobacco license required for every trade account, or only for buying tobacco, vapor, and nicotine products? | Waiting. The form, checklist, and terms still disagree, on purpose, until you choose. |
| AW-019 | Approve the consent checkbox wording and the Trade terms / Privacy version the application should record. The form currently records version `2026-09`, matching the "September 2026" date already printed on those pages. | Checkboxes are in place. Confirm the wording and the version. |
| AW-027 | Provide or approve the privacy policy details: service providers, data sharing, retention for uploaded license and EIN documents, and the contact method for access or deletion requests. | Waiting. The published privacy page is unchanged. |
| AW-340 | How long should a visitor's 21+ confirmation stay valid, and should sign-out clear it? | The gate currently expires after 30 days and clears on sign-out. Confirm or change that. |

## Part 2

Nothing below invents a price, a photo, a legal sentence, or a business email. Net-30 and “up to 18%” stay as published (AW-025). Kratom, kava, mushroom, detox, wellness-pill, and enhancement lines stay as published.

| ID | Question | Status |
| --- | --- | --- |
| AW-002 | Real wholesale list price for each of the 368 SKUs. | Waiting. Current prices are unchanged. |
| AW-030 | Price and availability for each size or pack-count variant. | The catalog can store per-variant prices. Until you supply them, every variant keeps the parent price. |
| AW-031 | Sell unit (each, box of N, case of N, or size) for each product that does not already state one. | Waiting. Known sell units still show on the product page and on quote lines. |
| AW-029 | Packshots for the products that have no photo, starting with Dubai chocolate #342 and Grocery. | Waiting. Those cards say “Photo coming soon” and are left off the home rails. |
| AW-033 | Replacement photos for images copied from retailers, and whether to keep the four Wikimedia photos. | Waiting. The four Wikimedia photos now carry the credit already on their file pages. |
| AW-136 | A correct photo for each product that shares a file with a different size or pack. | Waiting. Where a sell unit is already known, that pack size is badged on the shared photo. |
| AW-010 | Correct packshots for the mismatched products, including a watermark-free eFrutti jar. | Waiting. Current photos are unchanged. |
| AW-034 | Clean packshots to replace ad banners, retailer tiles, and collages. | Waiting. Current photos are unchanged. |
| AW-073 | High-resolution packshots, at least 800px, starting with the soft product photos. | The site no longer enlarges a photo past its own pixel size. Replacements are still needed. |
| AW-141 | Plain-background packshots for the dark and full-bleed photos. | Product tiles are white so a white packshot does not sit in a cream box. Dark photos are unchanged. |
| AW-142 | For each photo that shows an unlisted flavor, is that flavor stocked, or do you have a photo of a listed one? | Waiting. Variant lists are unchanged. |
| AW-139 | What DEAL and PREMIUM mean, or should those tags be removed? | Empty featured filters are hidden. The tags themselves are unchanged. |
| AW-140 | Is #366 Game Palma Green, are trash bags #95 and #107 the same stock, and which other Uncle Al’s flavors are stocked? | Waiting. No rows were removed or renamed. |
| AW-286 | Which brand is actually stocked for each “Assorted” row, and for #343? | “Assorted” is no longer printed on the card. #191, #192, #44, #98, and #248 were aligned with the packshot or the brand already on the row. |
| AW-075 | Pack size, case count, dimensions, and attributes so descriptions can be rewritten. | Waiting. Current descriptions are unchanged. |
| AW-005 | Years in business, account or route counts, warehouse and truck photos, and which brand logos you can show. | Waiting. Unverified trust claims are not on the page. |
| AW-006 | Wide licensed photos of the warehouse or a multi-department assortment for the hero. | Waiting. Current hero photos are unchanged. |
| AW-056 | Which products are really new and which are bestsellers, plus dedicated hero and department images. | Waiting. The current rails are unchanged except photo-less items are omitted. |
| AW-057 | Which RAZ 25K flavors are stocked? | Button labels now say “Select options”, “Add to quote”, or “Add to order”. Flavors were not invented. |
| AW-058 | Licensed photos for the novelties collection card and the tobacco collection card. | Waiting. Current cards are unchanged. |
| AW-217 | One name for the Novelties department: Exotics, Novelties & Vapes, or Novelties. | Waiting. All three names are still in use. |
| AW-134 | Approve department renames, and a lawful name for Honey & Energy after legal review. | Waiting. Names are unchanged, including Honey & Energy. |
| AW-025 | Who gets Net-30, and what is the real volume discount? | Kept exactly as published, by your earlier decision. |
| AW-028 | Returns, damage, credit, tax, risk of loss, liability, and governing law, ideally with counsel. | Waiting. Trade terms are unchanged. |
| AW-127 | Which domain email address is monitored, so it can replace the Gmail address? | Waiting. The Gmail address is unchanged. |
| AW-130 | Order cutoff, delivery days, the fee under $1,500, tobacco receiving rules, and the damage-claim process. | Waiting. The two delivery pages are both still there. |
| AW-123 | ZIP codes or prefixes on each route, delivery days, cutoff, and cities served. | The delivery page asks for a ZIP and tells the customer to call. It does not invent a route. |
| AW-124 | Warehouse photo, will-call lead time, entrance and parking, and payment at pickup. | Waiting. |
| AW-076 | Is the $500 minimum a hard block or a guideline? | The “you can still submit” note only appears when submit is actually available. The minimum is not newly enforced. |
| AW-024 | Should staff price guest quotes and convert them to orders, with quoted and confirmed stages? | The admin editor and migration are in place. Confirm this is the workflow you want, then apply the migration. |
| AW-050 | Which address or phone should receive new quote notifications, and which provider sends them? | Waiting. No mail is sent on its own. |
| AW-088 | Should approval send an automatic email, or will a rep call or email by hand? | Approve now has an “Email applicant” link. No automatic mail. |
| AW-099 | Which staff address should hear when a license file is uploaded? | The apply page says when both files are received and lets the applicant open them. No staff alert yet. |
| AW-051 | Set up SMTP on your domain and the Supabase redirect URLs. | Signup confirmation now returns to the site the applicant is using. SMTP is still yours to configure. |
| AW-093 | Confirm the sender name and paste branded confirmation and reset templates into Supabase. | Waiting on the sender and the domain. |
| AW-206 | Create a Cloudflare Turnstile site and enable CAPTCHA in Supabase. | Waiting on the site key. |
| AW-052 | Register the production domain and connect it in Netlify. | Waiting. The current domain strings are unchanged. |
| AW-210 | Which cookieless analytics, error reporting, and uptime monitor should we use? | Waiting. No tracker was added. |
| AW-213 | Will production be Supabase Pro, and will previews use a separate project? | Waiting. |
| AW-246 | How long does approval actually take? | The existing “one business day” sentences are unchanged. |
| AW-272 | What approval time should the Apply page promise, and is Net-30 offered? | Waiting. Net-30 copy elsewhere is unchanged. |
| AW-277 | The exact date each policy should show. | Waiting. Dates are still “September 2026” or blank. |
| AW-279 | Confirm FAQ answers, including Net-30 and volume discounts, before they are published. | Waiting. The unused FAQ is not on the site. |
| AW-035 | A vector logo with a transparent background. | Waiting. |
| AW-288 | A warehouse or assortment photo and the vector logo for the share card. | Waiting. |
| AW-320 | Latitude and longitude of the warehouse, plus Google Business and social profile URLs. | Waiting. |
