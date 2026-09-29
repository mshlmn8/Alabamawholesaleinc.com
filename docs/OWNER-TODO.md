# Owner questions

The site-review fixes (2026-09-28) leave some business, legal and content decisions to the owner. Each one is a `TODO(owner): … (AW-xxx)` comment next to the code it affects, and one row below. Until you answer, the code keeps the current value, or a placeholder default where there was none. Search the code for `TODO(owner)` to find them all.

| Finding | Question | Where in code |
| --- | --- | --- |
| AW-340 | How long should a visitor's 21+ confirmation stay valid before the site asks again (for example 30 days, or every browser session)? The placeholder is 30 days. Confirmations saved before this change have no date: they are kept, and the 30 days count from the visitor's first visit after the release. Say if they should be asked again straight away instead. | `AGE_CONFIRMATION_DAYS` in `src/lib/ageGate.js` (the boot script in `index.html` repeats the period; `src/boot-shell.test.js` checks they match) |
| AW-340 | Should signing out clear the 21+ confirmation, so the next person on a shared computer is asked again? It does for now. | `CLEAR_AGE_CONFIRMATION_ON_SIGN_OUT` in `src/lib/ageGate.js` |
| AW-002 | What is the real wholesale list price of each of the 368 SKUs (for example a price sheet export)? The prices in the database look like placeholders (larger packs cost less than smaller ones, and unrelated items share prices), and they have not changed since the first version of the site. Load the real ones through Admin → Products, or a private SQL file under `supabase/private/` (never committed); BACKEND.md, "Loading your list prices", shows how. | `products.price` in Supabase (read through `my_prices()`); the note at `CATALOG_COLUMNS` in `src/lib/catalog.jsx` and in BACKEND.md, "Loading your list prices" |
