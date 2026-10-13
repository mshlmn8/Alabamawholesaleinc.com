// The owner's photos of the Birmingham warehouse (AW-006, sent 2026-09-28,
// first collected in Cursor's draft PR #11): 37 frames in src/assets, each
// named hero_wh_<what it shows>.jpg. The image build renders them like every
// hero_* photo (scripts/build-images.mjs, HERO_WIDTHS). Plain data with no
// imports, so scripts and tests read it too.
//
//   HERO_REEL         the eight the home page's carousel shows by default
//                     (HERO_SLIDES in content.js; Admin -> Homepage replaces
//                     them once the home_slides table has rows), in order:
//                     the building's sign, a truck, Graymont Ave, an aisle,
//                     then drinks, snacks, candy and the candy room. The same
//                     eight, word for word, are the rows
//                     20261014110000_home_slides_warehouse_reel.sql puts in
//                     home_slides (warehousePhotos.test.js checks).
//   WAREHOUSE_GALLERY the other 29, shown on the contact page, in the order
//                     shown there. `nicotine` marks a photo whose subject is
//                     tobacco, vapes or nicotine pouches: the contact page
//                     groups those under the FDA statement, as a nicotine
//                     product card carries it (AW-026).
//
// Each photo: `file` (in src/assets), `alt` (what it shows, also its visible
// caption on the contact page; at most 200 characters, the home_slides
// limit), `goCat` (the department a hero slide links to, or null).
// PR #11's file names didn't match its photos (hero_wh_truck.jpg was shisha
// tins, hero_wh_candy.jpg pallets of Red Bull); every file was renamed after
// what it shows, and the reel was chosen by what each photo shows.
// Shelf stickers in the photos are not prices (owner, 2026-09-28): no price
// is ever taken from a photo.

export const HERO_REEL = Object.freeze([
  { file: 'hero_wh_sign.jpg', alt: 'The Alabama Wholesale Inc sign above the loading doors', goCat: null },
  { file: 'hero_wh_truck.jpg', alt: 'Two box trucks, one with the Alabama Wholesale logo, at the warehouse', goCat: null },
  { file: 'hero_wh_graymont.jpg', alt: 'The Graymont Ave N street sign in front of the warehouse', goCat: null },
  { file: 'hero_wh_aisle.jpg', alt: 'A long warehouse aisle of stocked pallet racks', goCat: null },
  { file: 'hero_wh_soda.jpg', alt: 'Pallets of Faygo soda by the case', goCat: 'DRINKS & BAGS' },
  { file: 'hero_wh_snack_aisle.jpg', alt: 'Cases of Cheez-It, Pop-Tarts and cereal on pallet racks', goCat: 'FOOD STUFF' },
  { file: 'hero_wh_candy.jpg', alt: 'Shelves of Reese’s, Hershey’s, M&M’s and Kit Kat', goCat: 'CANDIES' },
  { file: 'hero_wh_candy_room.jpg', alt: 'The candy room: shelves of candy boxes and stacked cases on a checkered floor', goCat: null },
].map(Object.freeze));

export const WAREHOUSE_GALLERY = Object.freeze([
  // Outside and the floor.
  { file: 'hero_wh_building.jpg', alt: 'The warehouse building, with box trucks and a van at the loading docks' },
  { file: 'hero_wh_street.jpg', alt: 'The warehouse seen from across the street' },
  { file: 'hero_wh_main_floor.jpg', alt: 'The main warehouse floor with tall pallet racks of cases' },
  // Drinks.
  { file: 'hero_wh_energy_drinks.jpg', alt: 'Pallets of Red Bull and other energy drinks' },
  { file: 'hero_wh_sports_drinks.jpg', alt: 'Pallets of Powerade, Electrolit and other sports drinks' },
  { file: 'hero_wh_aloe_drinks.jpg', alt: 'Pallets of aloe vera drinks' },
  { file: 'hero_wh_water.jpg', alt: 'Pallets of bottled water and soda' },
  // Food.
  { file: 'hero_wh_noodles.jpg', alt: 'Cases of Maruchan noodles along a pallet-rack aisle' },
  { file: 'hero_wh_noodle_cases.jpg', alt: 'Cases of Maruchan Yakisoba and other noodles on pallet racks' },
  // Merchandise and smoke accessories.
  { file: 'hero_wh_lighters.jpg', alt: 'BIC lighters, torch lighters and lighter fluid on pallet racks' },
  { file: 'hero_wh_slatwall.jpg', alt: 'A slatwall of chargers, earbuds, flags and other hanging items' },
  { file: 'hero_wh_rolling_papers.jpg', alt: 'Shelves of RAW rolling papers and cones' },
  { file: 'hero_wh_rolling_papers_wall.jpg', alt: 'A wall of RAW rolling papers by the box' },
  { file: 'hero_wh_glass.jpg', alt: 'Shelves of glass water pipes' },
  // Motor oil and household.
  { file: 'hero_wh_motor_oil.jpg', alt: 'Cases of Castrol GTX motor oil and power steering fluid' },
  { file: 'hero_wh_cleaners.jpg', alt: 'Shelves of laundry detergent, bleach and cleaners' },
  { file: 'hero_wh_disposables.jpg', alt: 'Foam cups, plates and other disposables on pallet racks' },
  { file: 'hero_wh_bags.jpg', alt: 'Bins of plastic bags along a pallet-rack aisle' },
  { file: 'hero_wh_cases.jpg', alt: 'Cases stacked on pallets against the warehouse wall' },
  // Tobacco, vapes and nicotine pouches.
  { file: 'hero_wh_cigarillos.jpg', alt: 'Cigarillos and cigars on pallet racks', nicotine: true },
  { file: 'hero_wh_cigarillo_racks.jpg', alt: 'White Owl, Game and other cigarillos on pallet racks', nicotine: true },
  { file: 'hero_wh_cigars.jpg', alt: 'Shelves of Black & Mild cigars and rolling cones', nicotine: true },
  { file: 'hero_wh_cigarettes.jpg', alt: 'Cartons of Seneca and 24/7 cigarettes', nicotine: true },
  { file: 'hero_wh_pipe_tobacco.jpg', alt: 'Bags of pipe tobacco and boxes of cigarette tubes', nicotine: true },
  { file: 'hero_wh_shisha.jpg', alt: 'Tins of Al Fakher shisha tobacco', nicotine: true },
  { file: 'hero_wh_shisha_shelves.jpg', alt: 'Long shelves of Al Fakher shisha tobacco', nicotine: true },
  { file: 'hero_wh_vapes.jpg', alt: 'Disposable vapes on display shelves', nicotine: true },
  { file: 'hero_wh_vape_shelves.jpg', alt: 'Shelves of disposable vapes in their boxes', nicotine: true },
  { file: 'hero_wh_pouches.jpg', alt: 'Nicotine pouches and tins on shelves behind the counter', nicotine: true },
].map((photo) => Object.freeze({ nicotine: false, ...photo })));

// The hero photos that came with the site before the warehouse photos. They
// stay bundled: Admin -> Homepage still offers them, a home_slides row may
// name them, and the home page's collection card uses hero_candy.jpg.
export const EARLIER_HERO_PHOTOS = Object.freeze([
  { file: 'hero_candy.jpg', alt: 'Display box of Turtles Bites chocolates' },
  { file: 'hero_vape.jpg', alt: 'Geek Bar Pulse X disposable vape advertisement', nicotine: true },
  { file: 'hero_lighters.jpg', alt: 'BIC lighters in a counter display tray' },
  { file: 'hero_gatorade.jpg', alt: 'Gatorade and G2 bottles' },
].map((photo) => Object.freeze({ nicotine: false, ...photo })));

// Every bundled hero photo, as Admin -> Homepage lists them: the reel, the
// gallery, then the earlier four.
export const BUNDLED_PHOTOS = Object.freeze([
  ...HERO_REEL.map(({ file, alt }) => ({ file, alt, nicotine: false })),
  ...WAREHOUSE_GALLERY.map(({ file, alt, nicotine }) => ({ file, alt, nicotine })),
  ...EARLIER_HERO_PHOTOS.map(({ file, alt, nicotine }) => ({ file, alt, nicotine })),
].map(Object.freeze));

// A bundled photo by file name, or null.
export const bundledPhoto = (file) => BUNDLED_PHOTOS.find((photo) => photo.file === String(file ?? '').trim()) || null;
