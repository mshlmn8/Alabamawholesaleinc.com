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
