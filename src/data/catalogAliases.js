// Catalog keys that changed, and what they became (AW-135, AW-138, AW-126).
//
// Cart lines are keyed by product id and variant slug, Quick Reorder matches
// typed SKUs, and Reorder maps a saved order's lines back onto the catalog
// (src/lib/lines.js). When a SKU or a variant label changes, the old key has
// to keep working: in carts stored in browsers, in the codes buyers copy from
// their order history, and while the live database still has the old values
// (until the owner applies supabase/migrations/20261009120000_catalog_corrections.sql,
// the storefront reads the old labels and SKUs from Supabase and the new ones
// from this bundle). So every alias is an equivalence, used in both
// directions: an old key finds the new label, and a new key finds the old
// label on a product that still has it.
//
// Saved orders keep their own snapshot (order_items.sku, product_name,
// variant); nothing here rewrites them.
//
// Add an entry whenever a SKU or a variant label's slug changes in
// src/data/products.js; scripts/validate-catalog.mjs checks that every target
// exists. Never reuse an old code or slug for a different product or variant.

// Old product SKU -> the SKU it became (AW-135): codes that were cut at 17
// characters or ended in a hyphen, misspelled codes, and #329's bare 'AW-RAW'.
// A variant's SKU is its product's SKU plus the variant slug, so old variant
// codes follow their product's entry.
// TODO(owner): Does the business have its own item codes or UPCs that the site should use instead of these AW- codes? (AW-135)
export const SKU_ALIASES = Object.freeze({
  'AW-LOOSE-LEAFS-2P': 'AW-LOOSE-LEAFS-2PK', // #12
  'AW-ROYAL-BUNTS-MI': 'AW-ROYAL-BLUNTS-MINI', // #15
  'AW-BACKWOODS-SING': 'AW-BACKWOODS-SINGLES', // #16
  'AW-RHINO-PILLS-2P': 'AW-RHINO-PILLS-2PK', // #28
  'AW-WRIGGLY-SLIM-P': 'AW-WRIGLEY-SLIM-PACK', // #38
  'AW-WRIGGLY-50': 'AW-WRIGLEY-50', // #40
  'AW-ARGO-CORN-STAR': 'AW-ARGO-CORN-STARCH', // #45
  'AW-RAZ-VUE-FULL-K': 'AW-RAZ-VUE-FULL-KIT', // #65
  'AW-SHROOM-PUFF-DI': 'AW-SHROOM-PUFF-DISPOSABLE', // #69
  'AW-SHROOM-PUFF-GU': 'AW-SHROOM-PUFF-GUMMIES', // #72
  'AW-GOOD-TIMES-FLA': 'AW-GOOD-TIMES-FLAT', // #84
  'AW-6PK-BEER-CARRI': 'AW-6PK-BEER-CARRIERS', // #93
  'AW-TRASH-CAN-LINE': 'AW-TRASH-CAN-LINERS', // #95
  'AW-PEAK-ANTIFREEZ': 'AW-PEAK-ANTIFREEZE', // #99
  'AW-CHEAP-ANTIFREE': 'AW-CHEAP-ANTIFREEZE', // #100
  'AW-WINDSHIELD-WAS': 'AW-WINDSHIELD-WASHER', // #103
  'AW-AJAX-DISHWASHE': 'AW-AJAX-DISH-LIQUID', // #109
  'AW-BRILLO-DISHWAS': 'AW-BRILLO-DISH-LIQUID', // #110
  'AW-IRISH-SPRING-S': 'AW-IRISH-SPRING-SOAP', // #116
  'AW-AWESOME-LAUNDR': 'AW-AWESOME-LAUNDRY', // #117
  'AW-FABULOUSO': 'AW-FABULOSO', // #128
  'AW-HOME-AIR-FRESH': 'AW-HOME-AIR-FRESHENERS', // #129
  'AW-BRILLO-BASICS-': 'AW-BRILLO-BASICS', // #130
  'AW-RUBBING-ALCOHO': 'AW-RUBBING-ALCOHOL', // #134
  'AW-CHARCOAL-LIGHT': 'AW-CHARCOAL-LIGHTER', // #138
  'AW-TROPICANA-SMAL': 'AW-TROPICANA-SMALL', // #140
  'AW-WHITE-LONG-SLE': 'AW-WHITE-LONG-SLEEVE', // #153
  'AW-BLACK-LONG-SLE': 'AW-BLACK-LONG-SLEEVE', // #154
  'AW-CHICO-STICK-JA': 'AW-CHICK-O-STICK-JAR', // #175
  'AW-LAFFY-TAFFY-JA': 'AW-LAFFY-TAFFY-JAR', // #179
  'AW-LAFFY-TAFFY-RO': 'AW-LAFFY-TAFFY-ROPES', // #180
  'AW-20OZ-MINUTE-MA': 'AW-20OZ-MINUTE-MAID', // #207
  'AW-12OZ-MINUTE-MA': 'AW-12OZ-MINUTE-MAID', // #208
  'AW-HAPPY-VALENTIN': 'AW-HAPPY-VALENTINES', // #219
  'AW-PEPCID-COMPLET': 'AW-PEPCID-COMPLETE', // #222
  'AW-WOMEN-DEODORAN': 'AW-WOMEN-DEODORANT', // #225
  'AW-NESQUICK': 'AW-NESQUIK', // #233
  'AW-GAMBLER-BAGS-B': 'AW-GAMBLER-BAGS-BIG', // #238
  'AW-GAMBLER-BAGS-S': 'AW-GAMBLER-BAGS-SMALL', // #239
  'AW-BLUNTEFFECT-IN': 'AW-BLUNTEFFECT-INCENSE', // #245
  'AW-LATTAFA-AIR-FR': 'AW-LATTAFA-AIR-FRESHENER', // #247
  'AW-PSYCHED-PRE-RO': 'AW-PSYCHED-PRE-ROLLS', // #258
  'AW-BLUE-WOLF-HONE': 'AW-BLUE-WOLF-HONEY', // #266
  'AW-SNICKERS-CHOCO': 'AW-SNICKERS-CHOCOLATE', // #271
  'AW-LOOSE-LEAFS-SP': 'AW-LOOSE-LEAFS-SPLITS', // #273
  'AW-RAW-GUARANA-WR': 'AW-RAW-GUARANA-WRAPS', // #274
  'AW-JOLLY-RANCHER-': 'AW-JOLLY-RANCHER', // #275
  'AW-NOW-AND-LATER-': 'AW-NOW-AND-LATER-GIANT', // #276
  'AW-HUSH-HIT-PRE-R': 'AW-HUSH-HIT-PRE-ROLLS', // #281
  'AW-SHROOM-BANG-PR': 'AW-SHROOM-BANG-PRE-ROLLS', // #285
  'AW-AA-CELLULAR-BL': 'AW-AA-CELLULAR-BLUETOOTH', // #286
  'AW-BLUE-MONKEY-PR': 'AW-BLUE-MONKEY-PRE-ROLLS', // #288
  'AW-PSYCHED-DISPOS': 'AW-PSYCHED-DISPOSABLE', // #289
  'AW-ELECTROLYTE': 'AW-ELECTROLIT', // #292
  'AW-JELLY-HOLES-PR': 'AW-JELLY-HOLES-PRE-ROLLS', // #296
  'AW-SHROOM-ROLLS-P': 'AW-SHROOM-ROLLS-PRE-ROLLS', // #298
  'AW-MELTED-MUSHROO': 'AW-MELTED-MUSHROOM', // #300
  'AW-BETTER-ME-PILL': 'AW-BETTER-ME-PILLS', // #302
  'AW-HIGH-GRAVITY-P': 'AW-HIGH-GRAVITY-PILLS', // #303
  'AW-THIRD-EYE-PILL': 'AW-THIRD-EYE-PILLS', // #304
  'AW-STONED-MUSHROO': 'AW-STONED-MUSHROOM', // #306
  'AW-STONED-HONEY-M': 'AW-STONED-HONEY-MUSHROOM', // #307
  'AW-GEEKBAR-MATE-P': 'AW-GEEKBAR-MATE-PODS', // #311
  'AW-STONED-BLUE-LO': 'AW-STONED-BLUE-LOTUS', // #312
  'AW-PSYCHED-BLUE-L': 'AW-PSYCHED-BLUE-LOTUS', // #313
  'AW-COCO-NARA-CHAR': 'AW-COCO-NARA-CHARCOAL', // #314
  'AW-ALFAKHER-50-GR': 'AW-ALFAKHER-50-GRAM', // #315
  'AW-ALFAKHER-250-G': 'AW-ALFAKHER-250-GRAM', // #316
  'AW-BEER-SALTS-BOT': 'AW-BEER-SALTS-BOTTLES', // #323
  'AW-BEER-SALTS-PAC': 'AW-BEER-SALTS-PACKETS', // #324
  'AW-RAW': 'AW-RAW-TIPS', // #329
  'AW-BLACK-TIGER-HO': 'AW-BLACK-TIGER-HONEY', // #332
  'AW-GAIN-DISHWASHE': 'AW-GAIN-DISH-LIQUID', // #333
  'AW-BOB-MARLEY-PAP': 'AW-BOB-MARLEY-PAPERS', // #337
  'AW-BILLIONAIRE-WR': 'AW-BILLIONAIRE-WRAPS', // #339
  'AW-SLAPWOODS-SING': 'AW-SLAPWOODS-SINGLES', // #340
  'AW-SILLY-DOTS-PIL': 'AW-SILLY-DOTS-PILLS', // #341
  'AW-DUBAI-CHOCOLAT': 'AW-DUBAI-CHOCOLATE', // #342
  'AW-ZIGZAG-HEMP-WR': 'AW-ZIGZAG-HEMP-WRAPS', // #347
  'AW-UNCLE-AL-S-COO': 'AW-UNCLE-AL-S-COOKIES', // #351
  'AW-LOUISIANA-HOT-': 'AW-LOUISIANA-HOT', // #352
  'AW-STARBUST-BARS': 'AW-STARBURST-BARS', // #357
  'AW-LIFESAVER-SHAR': 'AW-LIFESAVER-SHARE', // #358
  'AW-DOMINOES-SUGAR': 'AW-DOMINO-SUGAR', // #361
  'AW-DISPOSABLE-GLO': 'AW-DISPOSABLE-GLOVES', // #362
  'AW-LOOSE-LEAFS-5P': 'AW-LOOSE-LEAFS-5PK', // #367
});

// Per product id, old variant slug -> the label it became (AW-138, AW-126),
// or null when the product no longer asks for a variant (a lone variant that
// was not a real choice, such as "Case" or "Tips"). Only renames that change
// the slug are listed; "Cookies cream" -> "Cookies & cream" keeps its key.
// #62's merged chip "Watermelon ice Kiwi dragon berry" became two flavors and
// has no single equivalent, so a line saved with it asks the buyer to choose
// again ("Choose variant"), like any variant the catalog no longer lists.
export const VARIANT_ALIASES = Object.freeze({
  27: Object.freeze({ aaa4: 'AAA 4-pack', aa4: 'AA 4-pack', d2: 'D 2-pack', aaa2: 'AAA 2-pack', aa2: 'AA 2-pack', c2: 'C 2-pack' }), // Duracell batteries
  51: Object.freeze({ 'apple-jack': 'Apple Jacks' }), // Cereal cups
  52: Object.freeze({ 'butter-flies': 'Butterflies' }), // Gurley's candy bags
  // The old label's cart key, for mapping stored carts and saved orders only;
  // it is never shown (AW-126).
  60: Object.freeze({ 'fuckin-fab': 'F*** fab' }), // Geek Bar Pulse 15K
  107: Object.freeze({ '13gal': '13 gal', '23gal': '23 gal' }), // Trash bags
  120: Object.freeze({ '20oz': '20 oz', '16oz': '16 oz', '12oz': '12 oz', '8oz': '8 oz' }), // Foam cups
  122: Object.freeze({ case: null }), // Bath tissue 4-pack
  123: Object.freeze({ case: null }), // Paper towels
  124: Object.freeze({ case: null }), // Bath tissue single rolls
  150: Object.freeze({ iphone: 'iPhone (Lightning)', 'type-c': 'USB-C', 'iphone-to-type-c': 'Lightning to USB-C', 'type-c-to-type-c': 'USB-C to USB-C', 'home-charger-with-type-c': 'Home charger with USB-C' }), // Phone cables & chargers
  162: Object.freeze({ 'almond-reg': 'Almond, regular' }), // Snickers bars
  163: Object.freeze({ 'yellow-reg': 'Yellow, regular', 'chocolate-reg': 'Chocolate, regular' }), // M&M’s
  164: Object.freeze({ 'vanilla-reg': 'Vanilla, regular' }), // Kit Kat bars
  166: Object.freeze({ 'white-cups-reg': 'White cups, regular', 'pieces-reg': 'Pieces, regular', 'fast-break-reg': 'Fast break, regular' }), // Reese’s
  169: Object.freeze({ 'red-reg': 'Red, regular', 'wildberry-reg': 'Wildberry, regular', 'sour-reg': 'Sour, regular', 'blue-reg': 'Blue, regular' }), // Skittles
  171: Object.freeze({ 'milk-reg': 'Milk, regular', 'cookies-reg': 'Cookies, regular', 'cookies-king': 'Cookies, king size', 'almond-reg': 'Almond, regular', 'almond-king': 'Almond, king size', 'mr-goodbar-reg': 'Mr. Goodbar, regular', 'mr-goodbar-king': 'Mr. Goodbar, king size' }), // Hershey's bars
  183: Object.freeze({ 'winter-fresh': 'Winterfresh' }), // Extra Gum
  212: Object.freeze({ '8lbs': '8 lb', '10lbs': '10 lb' }), // Ice bags
  242: Object.freeze({ 'gold-king': 'Gold king size', 'menthol-king': 'Menthol king size', 'red-king': 'Red king size' }), // Gambler cigarette tubes
  243: Object.freeze({ 'gold-king': 'Gold king size', 'menthol-king': 'Menthol king size', 'orange-king': 'Orange king size', 'silver-king': 'Silver king size' }), // Gambler Tube Cut cigarette tubes
  267: Object.freeze({ mix: null }), // ZYN European mix
  314: Object.freeze({ '1kg': '1 kg' }), // Coco Nara hookah charcoal
  329: Object.freeze({ tips: null }), // RAW tips
  330: Object.freeze({ organic: null }), // High Hemp organic wraps
  331: Object.freeze({ aaa2: 'AAA 2-pack' }), // Panasonic batteries
  354: Object.freeze({ small: null }), // Folgers coffee (small)
  356: Object.freeze({ '2gal': '2 gal' }), // Gas cans
  362: Object.freeze({ 'm-size': 'Medium', 'l-size': 'Large' }), // Disposable gloves
});

// Photo files renamed to the p<id>-<slug> convention (AW-290), old filename ->
// new filename. Unlike the keys above this is one-way: only the new file
// ships with the site, but rows in the live products table keep the old name
// until the owner applies supabase/migrations/20261010131000_photo_filenames.sql,
// and the storefront builds each picture from the row's img
// (hydrateProducts in src/lib/catalog.jsx). So every img goes through
// currentImageFile(). Never reuse an old name for a different photo.
export const IMAGE_FILE_ALIASES = Object.freeze({
  'men_s_deodorant.jpg': 'p21-speed-stick-mens-deodorant.jpg', // #21
  'brillo_dishwasher.png': 'p110-brillo-basics-dish-liquid.png', // #110
  'fabulouso.avif': 'p128-fabuloso.avif', // #128
  'women_s_deodorant.webp': 'p225-lady-speed-stick-deodorant.webp', // #225
  'coastal_moto_oil.jpg': 'p280-coastal-motor-oil.jpg', // #280
  'electrolyte.webp': 'p292-electrolit.webp', // #292
});

// The photo file a catalog row's img names today: the new name for a renamed
// file, otherwise img as it is (another filename, a URL, null). Not
// Object.hasOwn, which is newer than the browsers the build targets.
export function currentImageFile(img) {
  if (typeof img !== 'string') return img;
  const name = img.trim();
  return Object.prototype.hasOwnProperty.call(IMAGE_FILE_ALIASES, name) ? IMAGE_FILE_ALIASES[name] : img;
}
