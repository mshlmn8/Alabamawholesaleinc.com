// Stage 1 of the warehouse sheet (November 2026): names and departments.
// Photos listed in stage1Photos.js are transparent PNGs from the brand's own
// site. Every other row still has no photo. Prices and specifications are
// stage 3: no price field, and variants are empty because flavors, sizes and
// strengths were not on the sheet.
// Rows already in src/data/products.js are not repeated here.
//
// Kratom & Kava and Mushroom Products stay off the site, the same October
// 2026 answer as the rows already in those lines (src/data/delisted.js).
// New Honey & Energy rows join the enhancement items under legal review
// (STAGE1_HONEY_IDS, src/lib/legalReview.js).
//
// Ids start at 369 and follow this list. Append new rows; do not reorder
// these, or a SKU already seeded keeps the old id.

import { STAGE1_PHOTOS } from './stage1Photos.js';

const FIRST_ID = 369;
const DELISTED_SUBS = new Set(['Mushroom Products', 'Kratom & Kava']);
const DEPT = {
  TOBACCO: 'Tobacco',
  NOVELTIES: 'Novelties',
  MERCHANDISE: 'Merchandise',
  CANDIES: 'Candies',
  'FOOD STUFF': 'Food Stuff',
  GROCERY: 'Grocery',
  'MOTOR OIL': 'Motor Oil',
  'DRINKS & BAGS': 'Drinks & Bags',
};
const SKU_FORMAT = /^AW-[A-Z0-9]+(-[A-Z0-9]+)*$/;

// name, brand, cat, sub, sku. Brand "Assorted" is the catalog's placeholder.
const SPECS = [
  // Tobacco — cigars
  ['Al Capone cigars 10-pack', 'Al Capone', 'TOBACCO', 'Cigars & Cigarillos', 'AW-AL-CAPONE-10PK'],
  ['Al Capone tower with filter', 'Al Capone', 'TOBACCO', 'Cigars & Cigarillos', 'AW-AL-CAPONE-TOWER-FILTER'],
  ['Al Capone tower without filter', 'Al Capone', 'TOBACCO', 'Cigars & Cigarillos', 'AW-AL-CAPONE-TOWER'],
  ['Backwoods True pack 2-pack', 'Backwoods', 'TOBACCO', 'Cigars & Cigarillos', 'AW-BACKWOODS-TRUE-2PK'],
  ['Djarum cigars', 'Djarum', 'TOBACCO', 'Cigars & Cigarillos', 'AW-DJARUM'],
  ['Hav-A-Tampa cigars', 'Hav-A-Tampa', 'TOBACCO', 'Cigars & Cigarillos', 'AW-HAV-A-TAMPA'],
  ['Jackpot cigarillos', 'Jackpot', 'TOBACCO', 'Cigars & Cigarillos', 'AW-JACKPOT'],
  ['Optimo cigars', 'Optimo', 'TOBACCO', 'Cigars & Cigarillos', 'AW-OPTIMO'],
  ['Snoop Dogg cigarillos 2-pack', 'Snoop Dogg', 'TOBACCO', 'Cigars & Cigarillos', 'AW-SNOOP-2PK'],
  ['Snoop Dogg cigarillos 4-pack', 'Snoop Dogg', 'TOBACCO', 'Cigars & Cigarillos', 'AW-SNOOP-4PK'],
  // Tobacco — wraps and leaf
  ['Backwoods True wrap 2-pack', 'Backwoods', 'TOBACCO', 'Wraps & Leafs', 'AW-BACKWOODS-TRUE-WRAP-2PK'],
  ['Big Bol wraps', 'Big Bol', 'TOBACCO', 'Wraps & Leafs', 'AW-BIG-BOL'],
  ['Big Leaf wraps singles', 'Big Leaf', 'TOBACCO', 'Wraps & Leafs', 'AW-BIG-LEAF-SINGLES'],
  ['Big Leaf wraps 3-pack', 'Big Leaf', 'TOBACCO', 'Wraps & Leafs', 'AW-BIG-LEAF-3PK'],
  ['Blazy Susan wraps', 'Blazy Susan', 'TOBACCO', 'Wraps & Leafs', 'AW-BLAZY-SUSAN'],
  ['Bob Marley wraps', 'Bob Marley', 'TOBACCO', 'Wraps & Leafs', 'AW-BOB-MARLEY-WRAPS'],
  ['Hemparillo rillo size blunts', 'Hemparillo', 'TOBACCO', 'Wraps & Leafs', 'AW-HEMPARILLO'],
  ['Jungo leaf 2-pack', 'Jungo', 'TOBACCO', 'Wraps & Leafs', 'AW-JUNGO-LEAF-2PK'],
  ['King Palm Goji wraps', 'King Palm', 'TOBACCO', 'Wraps & Leafs', 'AW-KING-PALM-GOJI'],
  ['LooseLeaf crushed', 'LooseLeaf', 'TOBACCO', 'Wraps & Leafs', 'AW-LOOSELEAF-CRUSHED'],
  ['LooseLeaf slugs', 'LooseLeaf', 'TOBACCO', 'Wraps & Leafs', 'AW-LOOSELEAF-SLUGS'],
  ['Metro Leaf wraps', 'Metro Leaf', 'TOBACCO', 'Wraps & Leafs', 'AW-METRO-LEAF'],
  // Tobacco — cigarettes, pouches, papers
  ['American Spirit tobacco', 'American Spirit', 'TOBACCO', 'Cigarettes', 'AW-AMERICAN-SPIRIT'],
  ['Bugler tobacco', 'Bugler', 'TOBACCO', 'Cigarettes', 'AW-BUGLER'],
  ['ALP nicotine pouches 6mg', 'ALP', 'TOBACCO', 'Pouches & ZYN', 'AW-ALP-6MG'],
  ['ALP nicotine pouches 9mg', 'ALP', 'TOBACCO', 'Pouches & ZYN', 'AW-ALP-9MG'],
  ['PIK nicotine pouches 6mg', 'PIK', 'TOBACCO', 'Pouches & ZYN', 'AW-PIK-6MG'],
  ['Rouge nicotine pouches', 'Rouge', 'TOBACCO', 'Pouches & ZYN', 'AW-ROUGE-POUCHES'],
  ['Bob Marley cones', 'Bob Marley', 'TOBACCO', 'Papers & Cones', 'AW-BOB-MARLEY-CONES'],
  ['Good Times paper jar', 'Good Times', 'TOBACCO', 'Papers & Cones', 'AW-GOOD-TIMES-PAPER-JAR'],
  ['JOB papers red jar', 'JOB', 'TOBACCO', 'Papers & Cones', 'AW-JOB-PAPERS-RED-JAR'],
  ['OCB cones', 'OCB', 'TOBACCO', 'Papers & Cones', 'AW-OCB-CONES'],
  ['OCB papers', 'OCB', 'TOBACCO', 'Papers & Cones', 'AW-OCB-PAPERS'],
  // Novelties — nicotine vapes and pods
  ['Bidi Stick', 'Bidi Stick', 'NOVELTIES', 'Disposable Vapes', 'AW-BIDI-STICK'],
  ['Breeze', 'Breeze', 'NOVELTIES', 'Disposable Vapes', 'AW-BREEZE'],
  ['Fifty Bar', 'Fifty Bar', 'NOVELTIES', 'Disposable Vapes', 'AW-FIFTY-BAR'],
  ['Foger Bit 35K', 'Foger', 'NOVELTIES', 'Disposable Vapes', 'AW-FOGER-BIT-35K'],
  ['Geek Bar 50K', 'Geek Bar', 'NOVELTIES', 'Disposable Vapes', 'AW-GEEKBAR-50K'],
  ['Geek Bar CLR', 'Geek Bar', 'NOVELTIES', 'Disposable Vapes', 'AW-GEEKBAR-CLR'],
  ['Geek Bar Pulse 2', 'Geek Bar', 'NOVELTIES', 'Disposable Vapes', 'AW-GEEKBAR-PULSE-2'],
  ['Geek Bar X2 50K', 'Geek Bar', 'NOVELTIES', 'Disposable Vapes', 'AW-GEEKBAR-X2-50K'],
  ['Kadobar 40K', 'Kadobar', 'NOVELTIES', 'Disposable Vapes', 'AW-KADOBAR-40K'],
  ['Lost Mary 35K', 'Lost Mary', 'NOVELTIES', 'Disposable Vapes', 'AW-LOST-MARY-35K'],
  ['MFU 150K', 'MFU', 'NOVELTIES', 'Disposable Vapes', 'AW-MFU-150K'],
  ['MFU 70K', 'MFU', 'NOVELTIES', 'Disposable Vapes', 'AW-MFU-70K'],
  ['MFU 80K', 'MFU', 'NOVELTIES', 'Disposable Vapes', 'AW-MFU-80K'],
  ['Nexa 35K', 'Nexa', 'NOVELTIES', 'Disposable Vapes', 'AW-NEXA-35K'],
  ['Nexa 80K', 'Nexa', 'NOVELTIES', 'Disposable Vapes', 'AW-NEXA-80K'],
  ['North 5000', 'North', 'NOVELTIES', 'Disposable Vapes', 'AW-NORTH-5000'],
  ['Tarbar', 'Tarbar', 'NOVELTIES', 'Disposable Vapes', 'AW-TARBAR'],
  ['Doom pods', 'Doom', 'NOVELTIES', 'Vape Pods', 'AW-DOOM-PODS'],
  ['Extre bar pods', 'Extre', 'NOVELTIES', 'Vape Pods', 'AW-EXTRE-BAR-PODS'],
  ['Juul pods 2-pack', 'Juul', 'NOVELTIES', 'Vape Pods', 'AW-JUUL-PODS-2PK'],
  ['Juul pods 4-pack menthol', 'Juul', 'NOVELTIES', 'Vape Pods', 'AW-JUUL-PODS-4PK'],
  ['MFU pods', 'MFU', 'NOVELTIES', 'Vape Pods', 'AW-MFU-PODS'],
  // Novelties — hookah
  ['Adalya shisha 50 g', 'Adalya', 'NOVELTIES', 'Hookah & Shisha', 'AW-ADALYA-50G'],
  ['Al Fakher charcoal', 'Al Fakher', 'NOVELTIES', 'Hookah & Shisha', 'AW-ALFAKHER-CHARCOAL'],
  ['Flat hookah', 'Assorted', 'NOVELTIES', 'Hookah & Shisha', 'AW-FLAT-HOOKAH'],
  ['Hookah hose', 'Assorted', 'NOVELTIES', 'Hookah & Shisha', 'AW-HOOKAH-HOSE'],
  ['Hookah tips', 'Assorted', 'NOVELTIES', 'Hookah & Shisha', 'AW-HOOKAH-TIPS'],
  ['Lost shisha vape 80K', 'Lost', 'NOVELTIES', 'Hookah & Shisha', 'AW-LOST-SHISHA-80K'],
  ['Mazaya shisha', 'Mazaya', 'NOVELTIES', 'Hookah & Shisha', 'AW-MAZAYA'],
  ['Olit Pro hookah', 'Olit', 'NOVELTIES', 'Hookah & Shisha', 'AW-OLIT-PRO'],
  ['Olit shisha vape 40K', 'Olit', 'NOVELTIES', 'Hookah & Shisha', 'AW-OLIT-40K'],
  ['Ploox Nest hookah', 'Ploox', 'NOVELTIES', 'Hookah & Shisha', 'AW-PLOOX-NEST'],
  ['Ploox Saloon shisha vape', 'Ploox', 'NOVELTIES', 'Hookah & Shisha', 'AW-PLOOX-SALOON'],
  ['Ploox shisha pods', 'Ploox', 'NOVELTIES', 'Hookah & Shisha', 'AW-PLOOX-PODS'],
  ['Ploox shisha vape 75K', 'Ploox', 'NOVELTIES', 'Hookah & Shisha', 'AW-PLOOX-75K'],
  ['SKE shisha vape', 'SKE', 'NOVELTIES', 'Hookah & Shisha', 'AW-SKE-SHISHA'],
  ['Starbuzz charcoal', 'Starbuzz', 'NOVELTIES', 'Hookah & Shisha', 'AW-STARBUZZ-CHARCOAL'],
  ['Three Kings charcoal', 'Three Kings', 'NOVELTIES', 'Hookah & Shisha', 'AW-THREE-KINGS'],
  ['Titanium charcoal', 'Assorted', 'NOVELTIES', 'Hookah & Shisha', 'AW-TITANIUM-CHARCOAL'],
  // Novelties — smoke accessories and CBD
  ['D-Tek scales', 'D-Tek', 'NOVELTIES', 'Smoke Accessories', 'AW-D-TEK-SCALES'],
  ['Gas mask', 'Assorted', 'NOVELTIES', 'Smoke Accessories', 'AW-GAS-MASK'],
  ['Glass pens', 'Assorted', 'NOVELTIES', 'Smoke Accessories', 'AW-GLASS-PENS'],
  ['Glass pipes', 'Assorted', 'NOVELTIES', 'Smoke Accessories', 'AW-GLASS-PIPES'],
  ['Glass tips', 'Assorted', 'NOVELTIES', 'Smoke Accessories', 'AW-GLASS-TIPS'],
  ['Ooze glass bowl', 'Ooze', 'NOVELTIES', 'Smoke Accessories', 'AW-OOZE-GLASS-BOWL'],
  ['Ooze pens', 'Ooze', 'NOVELTIES', 'Smoke Accessories', 'AW-OOZE-PENS'],
  ['Rolling trays', 'Assorted', 'NOVELTIES', 'Smoke Accessories', 'AW-ROLLING-TRAYS'],
  ['Smoking pipes', 'Assorted', 'NOVELTIES', 'Smoke Accessories', 'AW-SMOKING-PIPES'],
  ['Wax bongs', 'Assorted', 'NOVELTIES', 'Smoke Accessories', 'AW-WAX-BONGS'],
  ['Buzzy disposable CBD + CBG', 'Buzzy', 'NOVELTIES', 'CBD', 'AW-BUZZY-CBD-CBG'],
  ['Mellow Fellow beverage', 'Mellow Fellow', 'NOVELTIES', 'CBD', 'AW-MELLOW-FELLOW'],
  ['Mellow Fellow gummies', 'Mellow Fellow', 'NOVELTIES', 'CBD', 'AW-MELLOW-FELLOW-GUMMIES'],
  // Novelties — mushroom and kava lines, kept off the site
  ['Blue Infinity pre rolls 2-pack', 'Blue Infinity', 'NOVELTIES', 'Mushroom Products', 'AW-BLUE-INFINITY-PREROLLS'],
  ['Blue Monkey flower', 'Blue Monkey', 'NOVELTIES', 'Mushroom Products', 'AW-BLUE-MONKEY-FLOWER'],
  ['Blue Monkey gummies bags', 'Blue Monkey', 'NOVELTIES', 'Mushroom Products', 'AW-BLUE-MONKEY-GUMMIES-BAGS'],
  ['Blue Monkey gummies jars', 'Blue Monkey', 'NOVELTIES', 'Mushroom Products', 'AW-BLUE-MONKEY-GUMMIES-JARS'],
  ['Buzzy disposable 3 g', 'Buzzy', 'NOVELTIES', 'Mushroom Products', 'AW-BUZZY-3G'],
  ['Buzzy disposable CBD + blue lotus', 'Buzzy', 'NOVELTIES', 'Mushroom Products', 'AW-BUZZY-CBD-LOTUS'],
  ['Buzzy disposable CBD + mushroom', 'Buzzy', 'NOVELTIES', 'Mushroom Products', 'AW-BUZZY-CBD-MUSHROOM'],
  ['Buzzy disposable mushroom', 'Buzzy', 'NOVELTIES', 'Mushroom Products', 'AW-BUZZY-MUSHROOM'],
  ['Double stacked bites gummies', 'Assorted', 'NOVELTIES', 'Mushroom Products', 'AW-DOUBLE-STACKED-BITES'],
  ["Goo'd Mushroom disposable 2.2 g", "Goo'd", 'NOVELTIES', 'Mushroom Products', 'AW-GOOD-MUSHROOM-2G'],
  ['Harmony Dubai mushroom chocolate', 'Harmony', 'NOVELTIES', 'Mushroom Products', 'AW-HARMONY-MUSHROOM'],
  ['Hush Hit pre rolls jar', 'Hush Hit', 'NOVELTIES', 'Mushroom Products', 'AW-HUSH-HIT-JAR'],
  ['Magic Trip gummies 2-count', 'Magic Trip', 'NOVELTIES', 'Mushroom Products', 'AW-MAGIC-TRIP-GUMMIES'],
  ['Mental Health cartridges', 'Mental Health', 'NOVELTIES', 'Mushroom Products', 'AW-MENTAL-HEALTH-CARTRIDGES'],
  ['Mind melt mushroom pills', 'Assorted', 'NOVELTIES', 'Mushroom Products', 'AW-MIND-MELT'],
  ['Psyched mushroom disposable 9000mg', 'Psyched', 'NOVELTIES', 'Mushroom Products', 'AW-PSYCHED-MUSHROOM-9000'],
  ['Psyched pre rolls 2-pack', 'Psyched', 'NOVELTIES', 'Mushroom Products', 'AW-PSYCHED-PREROLLS-2PK'],
  ['Shroom Bang disposable 4 g', 'Shroom Bang', 'NOVELTIES', 'Mushroom Products', 'AW-SHROOM-BANG-4G'],
  ['Shroom Bang pills', 'Shroom Bang', 'NOVELTIES', 'Mushroom Products', 'AW-SHROOM-BANG-PILLS'],
  ['Shroom Rolls pre rolls 2-pack', 'Shroom Rolls', 'NOVELTIES', 'Mushroom Products', 'AW-SHROOM-ROLLS-2PK'],
  ['Silly Farms chocolate', 'Silly Farms', 'NOVELTIES', 'Mushroom Products', 'AW-SILLY-FARMS-CHOCOLATE'],
  ['Silly Farms gummies', 'Silly Farms', 'NOVELTIES', 'Mushroom Products', 'AW-SILLY-FARMS-GUMMIES'],
  ['Sprinkles shroom vape', 'Sprinkles', 'NOVELTIES', 'Mushroom Products', 'AW-SPRINKLES-SHROOM'],
  ['Stoned mushroom chocolate', 'Stoned', 'NOVELTIES', 'Mushroom Products', 'AW-STONED-CHOCOLATE'],
  ['Stoned mushroom gummies 2-pack', 'Stoned', 'NOVELTIES', 'Mushroom Products', 'AW-STONED-GUMMIES-2PK'],
  ['The House of Dream pre rolls 2-pack', 'The House of Dream', 'NOVELTIES', 'Mushroom Products', 'AW-HOUSE-OF-DREAM'],
  ['Ultra White Lotus disposable', 'Ultra White Lotus', 'NOVELTIES', 'Mushroom Products', 'AW-ULTRA-WHITE-LOTUS'],
  ['Kava Kalm', 'Kava Kalm', 'NOVELTIES', 'Kratom & Kava', 'AW-KAVA-KALM'],
  // Novelties — wellness pills, still published pending legal review
  ['Addall pills', 'Addall', 'NOVELTIES', 'Wellness Pills', 'AW-ADDALL'],
  ['Buzzers pills', 'Buzzers', 'NOVELTIES', 'Wellness Pills', 'AW-BUZZERS'],
  ['Sleep Walker pills 2-pack', 'Sleep Walker', 'NOVELTIES', 'Wellness Pills', 'AW-SLEEP-WALKER-2PK'],
  ['Stacker pills', 'Stacker', 'NOVELTIES', 'Wellness Pills', 'AW-STACKER'],
  ['Thizzies pills', 'Thizzies', 'NOVELTIES', 'Wellness Pills', 'AW-THIZZIES'],
  ['Third eye pills 2-pack', 'Third Eye', 'NOVELTIES', 'Wellness Pills', 'AW-THIRD-EYE-2PK'],
  // Merchandise — enhancement, OTC, apparel, counter, toys, lighters
  ['Black Bull honey', 'Black Bull', 'MERCHANDISE', 'Honey & Energy', 'AW-BLACK-BULL-HONEY'],
  ['Black Horse honey', 'Black Horse', 'MERCHANDISE', 'Honey & Energy', 'AW-BLACK-HORSE-HONEY'],
  ['Etumax pink honey', 'Etumax', 'MERCHANDISE', 'Honey & Energy', 'AW-ETUMAX-PINK-HONEY'],
  ['Libigrow pills 2-pack', 'Libigrow', 'MERCHANDISE', 'Honey & Energy', 'AW-LIBIGROW-2PK'],
  ['Pink Pussy honey', 'Pink Pussy', 'MERCHANDISE', 'Honey & Energy', 'AW-PINK-PUSSY-HONEY'],
  ['Rhino pills 1-pack', 'Rhino', 'MERCHANDISE', 'Honey & Energy', 'AW-RHINO-PILLS-1PK'],
  ['Rhino shots', 'Rhino', 'MERCHANDISE', 'Honey & Energy', 'AW-RHINO-SHOTS'],
  ['Sex gummies', 'Assorted', 'MERCHANDISE', 'Honey & Energy', 'AW-SEX-GUMMIES'],
  ['Viagra box', 'Assorted', 'MERCHANDISE', 'Honey & Energy', 'AW-VIAGRA-BOX'],
  ['VIP Gold sex pills', 'VIP', 'MERCHANDISE', 'Honey & Energy', 'AW-VIP-SEX-PILLS'],
  ['Aleve', 'Aleve', 'MERCHANDISE', 'OTC & Health', 'AW-ALEVE'],
  ['Alka-Seltzer', 'Alka-Seltzer', 'MERCHANDISE', 'OTC & Health', 'AW-ALKA-SELTZER'],
  ['DayQuil', 'DayQuil', 'MERCHANDISE', 'OTC & Health', 'AW-DAYQUIL'],
  ['Dramamine', 'Dramamine', 'MERCHANDISE', 'OTC & Health', 'AW-DRAMAMINE'],
  ['Midol', 'Midol', 'MERCHANDISE', 'OTC & Health', 'AW-MIDOL'],
  ['Motrin', 'Motrin', 'MERCHANDISE', 'OTC & Health', 'AW-MOTRIN'],
  ['Pepto-Bismol', 'Pepto-Bismol', 'MERCHANDISE', 'OTC & Health', 'AW-PEPTO-BISMOL'],
  ['Pregnancy test', 'Assorted', 'MERCHANDISE', 'OTC & Health', 'AW-PREGNANCY-TEST'],
  ['Stomach relief', 'Assorted', 'MERCHANDISE', 'OTC & Health', 'AW-STOMACH-RELIEF'],
  ['Zyrtec', 'Zyrtec', 'MERCHANDISE', 'OTC & Health', 'AW-ZYRTEC'],
  ['Energy Now shots', 'Energy Now', 'MERCHANDISE', 'Energy Shots', 'AW-ENERGY-NOW'],
  ['Happy Daze shots', 'Happy Daze', 'MERCHANDISE', 'Energy Shots', 'AW-HAPPY-DAZE'],
  ['Happy Hour shots', 'Happy Hour', 'MERCHANDISE', 'Energy Shots', 'AW-HAPPY-HOUR'],
  ['Juju shots', 'Juju', 'MERCHANDISE', 'Energy Shots', 'AW-JUJU-SHOTS'],
  ['Backpacks', 'Assorted', 'MERCHANDISE', 'Apparel', 'AW-BACKPACKS'],
  ['Bandana', 'Assorted', 'MERCHANDISE', 'Apparel', 'AW-BANDANA'],
  ['Nose rings', 'Assorted', 'MERCHANDISE', 'Apparel', 'AW-NOSE-RINGS'],
  ['Sunglasses', 'Assorted', 'MERCHANDISE', 'Apparel', 'AW-SUNGLASSES'],
  ['AirPods earbuds', 'Assorted', 'MERCHANDISE', 'Electronics', 'AW-AIRPODS'],
  ['Bottle opener', 'Assorted', 'MERCHANDISE', 'Counter Goods', 'AW-BOTTLE-OPENER'],
  ['ChapStick', 'ChapStick', 'MERCHANDISE', 'Counter Goods', 'AW-CHAPSTICK'],
  ['Cuba perfumes', 'Cuba', 'MERCHANDISE', 'Counter Goods', 'AW-CUBA-PERFUMES'],
  ['Jewelry display', 'Assorted', 'MERCHANDISE', 'Counter Goods', 'AW-JEWELRY-DISPLAY'],
  ['Knives display', 'Assorted', 'MERCHANDISE', 'Counter Goods', 'AW-KNIVES-DISPLAY'],
  ['Rose pens', 'Assorted', 'MERCHANDISE', 'Counter Goods', 'AW-ROSE-PENS'],
  ['Stage planks', 'Assorted', 'MERCHANDISE', 'Counter Goods', 'AW-STAGE-PLANKS'],
  ['Racing cars display', 'Assorted', 'MERCHANDISE', 'Toys', 'AW-RACING-CARS'],
  ['Robot toys display', 'Assorted', 'MERCHANDISE', 'Toys', 'AW-ROBOT-TOYS'],
  ['Squeeze toy', 'Assorted', 'MERCHANDISE', 'Toys', 'AW-SQUEEZE-TOY'],
  ['Incense singles', 'Assorted', 'MERCHANDISE', 'Air Fresheners & Incense', 'AW-INCENSE-SINGLES'],
  ['Arya candles', 'Arya', 'MERCHANDISE', 'Air Fresheners & Incense', 'AW-ARYA-CANDLES'],
  ['BluntEffects candles', 'BluntEffects', 'MERCHANDISE', 'Air Fresheners & Incense', 'AW-BLUNTEFFECTS-CANDLES'],
  ['BluntLife incense', 'BluntLife', 'MERCHANDISE', 'Air Fresheners & Incense', 'AW-BLUNTLIFE-INCENSE'],
  ['Chinese red box', 'Assorted', 'MERCHANDISE', 'Air Fresheners & Incense', 'AW-CHINESE-RED-BOX'],
  ['Lighter flints', 'Assorted', 'MERCHANDISE', 'Lighters & Torches', 'AW-LIGHTER-FLINTS'],
  ['Neon butane', 'Neon', 'MERCHANDISE', 'Lighters & Torches', 'AW-NEON-BUTANE'],
  ['Ronson butane', 'Ronson', 'MERCHANDISE', 'Lighters & Torches', 'AW-RONSON-BUTANE'],
  ['Zippo butane', 'Zippo', 'MERCHANDISE', 'Lighters & Torches', 'AW-ZIPPO-BUTANE'],
  ['Zippo lighter fluid', 'Zippo', 'MERCHANDISE', 'Lighters & Torches', 'AW-ZIPPO-LIGHTER-FLUID'],
  // Grocery
  ['Baby bottles', 'Assorted', 'GROCERY', 'Personal Care', 'AW-BABY-BOTTLES'],
  ['Hair rubber bands', 'Assorted', 'GROCERY', 'Personal Care', 'AW-HAIR-RUBBER-BANDS'],
  ['Hand soap', 'Assorted', 'GROCERY', 'Personal Care', 'AW-HAND-SOAP'],
  ['Mouthwash', 'Assorted', 'GROCERY', 'Personal Care', 'AW-MOUTHWASH'],
  ['Nail polish remover', 'Assorted', 'GROCERY', 'Personal Care', 'AW-NAIL-POLISH-REMOVER'],
  ['Razor blades', 'Assorted', 'GROCERY', 'Personal Care', 'AW-RAZOR-BLADES'],
  ['Sunscreen', 'Assorted', 'GROCERY', 'Personal Care', 'AW-SUNSCREEN'],
  ['Tooth floss', 'Assorted', 'GROCERY', 'Personal Care', 'AW-TOOTH-FLOSS'],
  ['Toothpaste', 'Assorted', 'GROCERY', 'Personal Care', 'AW-TOOTHPASTE'],
  ['Ajax dishwasher detergent', 'Ajax', 'GROCERY', 'Cleaning', 'AW-AJAX-DISHWASHER'],
  ['Ajax dishwasher detergent (big)', 'Ajax', 'GROCERY', 'Cleaning', 'AW-AJAX-DISHWASHER-BIG'],
  ['Chore Boy scrubbers', 'Chore Boy', 'GROCERY', 'Cleaning', 'AW-CHORE-BOY'],
  ['Baggies', 'Assorted', 'GROCERY', 'Bags & Storage', 'AW-BAGGIES'],
  ['Aluminum foil', 'Assorted', 'GROCERY', 'Paper & Plastic', 'AW-ALUMINUM-FOIL'],
  ['Straws', 'Assorted', 'GROCERY', 'Paper & Plastic', 'AW-STRAWS'],
  ['Plastic cups', 'Assorted', 'GROCERY', 'Paper & Plastic', 'AW-PLASTIC-CUPS'],
  ['Can opener', 'Assorted', 'GROCERY', 'Hardware', 'AW-CAN-OPENER'],
  ["Painter's tape", 'Assorted', 'GROCERY', 'Hardware', 'AW-PAINTERS-TAPE'],
  ['Price gun labels', 'Assorted', 'GROCERY', 'Hardware', 'AW-PRICE-GUN-LABELS'],
  ['Slip joint pliers', 'Assorted', 'GROCERY', 'Hardware', 'AW-SLIP-JOINT-PLIERS'],
  ['Squeegee', 'Assorted', 'GROCERY', 'Hardware', 'AW-SQUEEGEE'],
  ['Sticky gloves', 'Assorted', 'GROCERY', 'Hardware', 'AW-STICKY-GLOVES'],
  ['Working gloves', 'Assorted', 'GROCERY', 'Hardware', 'AW-WORKING-GLOVES'],
  ['Cat food cans', 'Assorted', 'GROCERY', 'Pet Food', 'AW-CAT-FOOD'],
  ['Dog food cans', 'Assorted', 'GROCERY', 'Pet Food', 'AW-DOG-FOOD'],
  // Candies
  ['Milky Way bars', 'Milky Way', 'CANDIES', 'Chocolate Bars', 'AW-MILKY-WAY'],
  ['Airheads bites', 'Airheads', 'CANDIES', 'Sweets & Gummies', 'AW-AIRHEADS-BITES'],
  ['Airheads Xtremes', 'Airheads', 'CANDIES', 'Sweets & Gummies', 'AW-AIRHEADS-XTREMES'],
  ['Big toy candies', 'Assorted', 'CANDIES', 'Sweets & Gummies', 'AW-BIG-TOY-CANDIES'],
  ['Fruit slice pops', 'Assorted', 'CANDIES', 'Sweets & Gummies', 'AW-FRUIT-SLICE-POPS'],
  ['Lemon squeeze', 'Assorted', 'CANDIES', 'Sweets & Gummies', 'AW-LEMON-SQUEEZE'],
  ['Life Savers hard candy', 'Life Savers', 'CANDIES', 'Sweets & Gummies', 'AW-LIFESAVERS-HARD'],
  ['Sour Jacks', 'Sour Jacks', 'CANDIES', 'Sweets & Gummies', 'AW-SOUR-JACKS'],
  ['Top Pops', 'Top Pops', 'CANDIES', 'Sweets & Gummies', 'AW-TOP-POPS'],
  ['Toxic Waste Slime Licker', 'Toxic Waste', 'CANDIES', 'Sweets & Gummies', 'AW-SLIME-LICKER'],
  ['Toy candies', 'Assorted', 'CANDIES', 'Sweets & Gummies', 'AW-TOY-CANDIES'],
  ['5 Gum', '5 Gum', 'CANDIES', 'Gum & Mints', 'AW-5-GUM'],
  ['Dentyne', 'Dentyne', 'CANDIES', 'Gum & Mints', 'AW-DENTYNE'],
  ['Dubble Bubble gum jar', 'Dubble Bubble', 'CANDIES', 'Gum & Mints', 'AW-DUBBLE-BUBBLE-JAR'],
  ['Extra gum share size', 'Extra', 'CANDIES', 'Gum & Mints', 'AW-EXTRA-SHARE'],
  ['Halls', 'Halls', 'CANDIES', 'Gum & Mints', 'AW-HALLS'],
  ["Wrigley's king size gum", "Wrigley's", 'CANDIES', 'Gum & Mints', 'AW-WRIGLEYS-KING'],
  ["Candyman's bags", "Candyman's", 'CANDIES', 'Bags', 'AW-CANDYMAN-BAGS'],
  ['Fruit Peelers bags (small)', 'Fruit Peelers', 'CANDIES', 'Bags', 'AW-FRUIT-PEELERS'],
  ['Bob stripes jar', 'Assorted', 'CANDIES', 'Jars', 'AW-BOB-STRIPES-JAR'],
  ['Gushmellow jar', 'Gushmellow', 'CANDIES', 'Jars', 'AW-GUSHMELLOW-JAR'],
  // Food
  ['All-purpose flour', 'Assorted', 'FOOD STUFF', 'Cooking Basics', 'AW-FLOUR'],
  ['Baking soda', 'Assorted', 'FOOD STUFF', 'Cooking Basics', 'AW-BAKING-SODA'],
  ['Morton Salt', 'Morton', 'FOOD STUFF', 'Cooking Basics', 'AW-MORTON-SALT'],
  ['Keebler crackers', 'Keebler', 'FOOD STUFF', 'Chips & Crackers', 'AW-KEEBLER-CRACKERS'],
  ['Pringles (big)', 'Pringles', 'FOOD STUFF', 'Chips & Crackers', 'AW-PRINGLES-BIG'],
  ['Pringles (small)', 'Pringles', 'FOOD STUFF', 'Chips & Crackers', 'AW-PRINGLES-SMALL'],
  ['Saltines', 'Assorted', 'FOOD STUFF', 'Chips & Crackers', 'AW-SALTINES'],
  ['Armour sausage', 'Armour', 'FOOD STUFF', 'Quick Meals', 'AW-ARMOUR-SAUSAGE'],
  ["Libby's sausage", "Libby's", 'FOOD STUFF', 'Quick Meals', 'AW-LIBBYS-SAUSAGE'],
  ['Vienna sausage', 'Assorted', 'FOOD STUFF', 'Quick Meals', 'AW-VIENNA-SAUSAGE'],
  ['Ranch dressing', 'Assorted', 'FOOD STUFF', 'Sauces & Salts', 'AW-RANCH'],
  ['Sauces', 'Assorted', 'FOOD STUFF', 'Sauces & Salts', 'AW-SAUCES'],
  ['Chips Ahoy cookies', 'Chips Ahoy', 'FOOD STUFF', 'Cookies', 'AW-CHIPS-AHOY'],
  ['Keebler wafers', 'Keebler', 'FOOD STUFF', 'Cookies', 'AW-KEEBLER-WAFERS'],
  ['Rice Krispies Treats', 'Rice Krispies', 'FOOD STUFF', 'Cookies', 'AW-RICE-KRISPIES'],
  ["Uncle Al's wafers", "Uncle Al's", 'FOOD STUFF', 'Cookies', 'AW-UNCLE-ALS-WAFERS'],
  ['Coffee-Mate', 'Coffee-Mate', 'FOOD STUFF', 'Coffee', 'AW-COFFEE-MATE'],
  // Motor oil and auto
  ['Armor All', 'Armor All', 'MOTOR OIL', 'Auto Accessories', 'AW-ARMOR-ALL'],
  ['Booster cables', 'Assorted', 'MOTOR OIL', 'Auto Accessories', 'AW-BOOSTER-CABLES'],
  ['Car ash tray', 'Assorted', 'MOTOR OIL', 'Auto Accessories', 'AW-CAR-ASH-TRAY'],
  ['Safe cans', 'Assorted', 'MOTOR OIL', 'Auto Accessories', 'AW-SAFE-CANS'],
  ['Tire repair kits', 'Assorted', 'MOTOR OIL', 'Auto Accessories', 'AW-TIRE-REPAIR'],
  ['Starting fluid', 'Assorted', 'MOTOR OIL', 'Fluids', 'AW-STARTING-FLUID'],
  // Drinks
  ['Fanta', 'Fanta', 'DRINKS & BAGS', 'Sodas', 'AW-FANTA'],
  ['Mistic juice', 'Mistic', 'DRINKS & BAGS', 'Juices & Teas', 'AW-MISTIC'],
  ['OKF aloe vera with fruit', 'OKF', 'DRINKS & BAGS', 'Juices & Teas', 'AW-OKF-ALOE-FRUIT'],
  ["OKF Farmer's aloe vera", 'OKF', 'DRINKS & BAGS', 'Juices & Teas', 'AW-OKF-FARMERS-ALOE'],
  ['Pocas Splash', 'Pocas', 'DRINKS & BAGS', 'Juices & Teas', 'AW-POCAS'],
  ['Skittles beverage', 'Skittles', 'DRINKS & BAGS', 'Juices & Teas', 'AW-SKITTLES-DRINK'],
  ['Toxic Waste juice', 'Toxic Waste', 'DRINKS & BAGS', 'Juices & Teas', 'AW-TOXIC-WASTE-JUICE'],
  ['V8 juice', 'V8', 'DRINKS & BAGS', 'Juices & Teas', 'AW-V8'],
  ['Total War', 'Total War', 'DRINKS & BAGS', 'Energy Drinks', 'AW-TOTAL-WAR'],
  ['Yoo-hoo', 'Yoo-hoo', 'DRINKS & BAGS', 'Dairy & Milk', 'AW-YOO-HOO'],
  ['Aquafina', 'Aquafina', 'DRINKS & BAGS', 'Water', 'AW-AQUAFINA'],
  ['Dasani', 'Dasani', 'DRINKS & BAGS', 'Water', 'AW-DASANI'],
  ['Niagara water', 'Niagara', 'DRINKS & BAGS', 'Water', 'AW-NIAGARA'],
  ['Sport water', 'Assorted', 'DRINKS & BAGS', 'Water', 'AW-SPORT-WATER'],
  ['Topo Chico', 'Topo Chico', 'DRINKS & BAGS', 'Water', 'AW-TOPO-CHICO'],
];

function sellUnitOf(name) {
  const pack = name.match(/(\d+)\s*-pack\b/i);
  if (pack) return `${pack[1]}-pack`;
  const count = name.match(/(\d+)\s*-count\b/i);
  if (count) return `${count[1]}-count`;
  const grams = name.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (grams) return `${grams[1]} g`;
  const kg = name.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kg) return `${kg[1]} kg`;
  if (/\bjars?\b/i.test(name)) return 'jar';
  if (/\bsingles?\b/i.test(name)) return 'single';
  return '';
}

function linePhrase(sub) {
  return sub.replace(/&/g, 'and').replace(/\b[A-Z][a-z]+\b/g, (word) => word.toLowerCase());
}

function brandInName(name, brand) {
  if (brand === 'Assorted') return true;
  const flat = (value) => value.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '');
  return flat(name).includes(flat(brand));
}

function build([name, brand, cat, sub, sku], index) {
  if (!DEPT[cat]) throw new Error(`stage 1 row ${sku}: unknown department ${cat}`);
  if (!SKU_FORMAT.test(sku)) throw new Error(`stage 1 row ${sku}: sku format`);
  if (name.length > 60) throw new Error(`stage 1 row ${sku}: name is longer than 60 characters`);
  if (!brandInName(name, brand)) throw new Error(`stage 1 row ${sku}: brand ${brand} is not in the name`);
  const row = {
    id: FIRST_ID + index,
    name,
    brand,
    cat,
    sub,
    sku,
    sellUnit: sellUnitOf(name),
    variants: [],
    img: STAGE1_PHOTOS[sku] ?? null,
    tag: null,
    description: sku === 'AW-JUUL-PODS-4PK'
      ? 'Juul pods 4-pack menthol, 5%, from the vape pods line in our Novelties department.'
      : `${name} from the ${linePhrase(sub)} line in our ${DEPT[cat]} department.`,
  };
  if (DELISTED_SUBS.has(sub)) row.active = false;
  return row;
}

export const STAGE1_ROWS = SPECS.map(build);
export const STAGE1_DELISTED_IDS = STAGE1_ROWS.filter((row) => row.active === false).map((row) => row.id);
export const STAGE1_HONEY_IDS = STAGE1_ROWS.filter((row) => row.sub === 'Honey & Energy').map((row) => row.id);
