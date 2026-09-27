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
- #295 Snack wraps — product not identified (see below); `img` left empty.
- #353 Instant coffee — brand is `Assorted`; every instant-coffee packshot carries a maker's label, so no unbranded photo qualifies.

Identification (this pass):
- #361 Domino sugar stands. Domino Foods' Premium Pure Cane Granulated sugar is the only sugar sold under that name; Small/Big are the 2 lb and 4 lb bags. The earlier rename from `Dominoes sugar` is correct. Source: https://www.dominosugar.com/ and the Target listing in the table above.
- #350 Uncle Al's and #351 Uncle Al's cookies are the same cookie line, not two products to merge or delete. Wholesale lists Uncle Al's Cookies as 5 oz bags (12 per case) in many flavors, and Lemon Ice is one of those flavors (UPC 688149230030). #351 is that Lemon Ice variety. #350 has no flavor and already uses the same Lemon Ice box photo, so it is the same cookies listed without a flavor. Uncle Al's also sells stage planks and sugar wafers, which these two rows do not name. Rows left as they are. Sources: https://branexwholesale.com/product/uncle-als-cookies-5-oz-pack-of-12 and https://metroatlantawholesale.com/product/uncle-als-cookies-5-oz/
- #295 Snack wraps (40ct / 12ct) is still two candidates, so the name stays `Snack wraps` / `Assorted`. One is plastic snack bags sold as a 40-count box and a 12-count box (Ziploc snack bags are packed 40 per box, 12 boxes per case — the counts match, but the row sits under Chips & Crackers). The other is flour-tortilla or sandwich wraps, usually a 12-count pack, not a 40-count. No photo added.
- #51 Cereal cups already has `cereal_cups.jpg`. The variants are Kellogg's (Frosted Flakes, Apple Jacks, Froot Loops, Corn Pops). The photo is General Mills single-serve cups (Cheerios, Honey Nut Cheerios, Cinnamon Toast Crunch, Lucky Charms). Variants were not changed.
