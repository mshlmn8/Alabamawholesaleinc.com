# FOOD STUFF — photo sources

Photos added for catalog rows that had no `img`. Each file is the retail packshot as published by the source; files over ~400 KB were re-encoded to JPEG q85 at 1600 px max. Review or replace freely — the row's `img` in `src/data/products.js` points at the filename.

| id | Product | File | Source URL | Source type | Date |
| --- | --- | --- | --- | --- | --- |
| 48 | Ritz crackers (Original 13.7 oz box shown) | `p48-ritz-crackers.png` | https://www.snackworks.com/products/ritz-original-crackers-snacks-for-kids-and-adults-lunch-snacks-137-oz/ | manufacturer (Mondelēz, snackworks.com) | 2026-09-27 |
| 50 | Cloverhill pastries (Big Texas cinnamon roll 4 oz shown) | `p50-cloverhill-pastries.jpg` | https://www.costcobusinessdelivery.com/p/-/cloverhill-bakery-big-texas-cinnamon-roll-4-oz-12-ct/100206041 | retailer (Costco Business Center) — jtmfoods.net only has 500 px marketing art | 2026-09-27 |
| 349 | Nutter Butter cookies (1.9 oz 4-cookie snack pack) | `p349-nutter-butter-cookies.png` | https://www.snackworks.com/products/nutter-butter-peanut-butter-sandwich-cookies-19-oz-snack-pack-4-cookies-per-pack/ | manufacturer (Mondelēz, snackworks.com) | 2026-09-27 |
| 354 | Folgers coffee, Small (Classic Roast 9.6 oz canister, UPC 025500304014) | `p354-folgers-coffee.jpg` | https://www.folgerscoffee.com/coffee/ground/classic-roast | manufacturer (J.M. Smucker, folgerscoffee.com) | 2026-09-27 |
| 361 | Domino sugar (Premium Pure Cane Granulated 4 lb bag) | `p361-domino-sugar.jpg` | https://www.target.com/p/domino-premium-pure-cane-granulated-sugar-4-lb/-/A-13379072 | retailer (Target) — dominosugar.com blocks direct image downloads | 2026-09-27 |

Notes:
- #361 was a guessed name (`Dominoes sugar` → `Domino sugar`). The search confirms Domino (Domino Foods, since 1901) is the only sugar brand by that name and its Small/Big bags are the 2 lb and 4 lb; photo added on that basis — owner to confirm.

Skipped:
- #295 Snack wraps — owner confirmed this is a chips brand, not storage bags and not tortillas. The specific maker is still not certain, so no packshot was added and the brand stays `Assorted`. Copy now says it is a chips brand. Flavors were not invented.
- #350 Uncle Al's cookies and #351 Uncle Al's creme — the previous packshot is an Uncle Al's Lemon Ice box. The owner said not to keep a Lemon Ice name, so that file is no longer referenced. Both rows show the photo placeholder.
- #353 Instant coffee — brand is `Assorted`; every instant-coffee packshot carries a maker's label, so no unbranded photo qualifies.

Identification (this pass):
- #361 Domino sugar stands. Domino Foods' Premium Pure Cane Granulated sugar is the only sugar sold under that name; Small/Big are the 2 lb and 4 lb bags. The earlier rename from `Dominoes sugar` is correct. Source: https://www.dominosugar.com/ and the Target listing in the table above.
- #350 is Uncle Al's cookies and #351 is Uncle Al's creme. The owner said both are cookies, not biscuits, and named the rows this way. The rows stay separate. The earlier Lemon Ice variety name was removed.
- #295 Snack wraps (40ct / 12ct) is a chips brand. It is not storage bags and not tortillas. No packshot: a search did not identify one chips brand with certainty, and a watermarked or priced image would not qualify.
- #51 Cereal cups already has `cereal_cups.jpg`. The variants are Kellogg's (Frosted Flakes, Apple Jacks, Froot Loops, Corn Pops). The photo is General Mills single-serve cups (Cheerios, Honey Nut Cheerios, Cinnamon Toast Crunch, Lucky Charms). Variants were not changed.
