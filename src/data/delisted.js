// Products taken off the site on the owner's instruction (AW-001, answered
// 2026-10): every Kratom & Kava product and every mushroom product. They are
// deactivated, never deleted: order history, print sheets and old carts still
// know them, and staff still see them in Admin -> Products as inactive.
//
// The rows stay in src/data/products.js with `active: false`, the seed writes
// them inactive, and supabase/migrations/20261014100000_delist_kratom_mushroom.sql
// deactivates exactly DELISTED_IDS in a database that already has them. Until
// the owner applies that migration the live products table still marks them
// active, so the storefront (hydrateProducts in src/lib/catalogRows.js) and the
// build's sitemap and page files (scripts/catalog-source.mjs) also leave out
// every row of DELISTED_LINES, whatever the database says. A product staff
// add to one of those lines stays off the site too.
//
// The lines' old addresses (/category/novelties/kratom-and-kava,
// /category/novelties/mushroom-products) move to their department:
// resolveRoute in src/lib/routes.js redirects them, and netlify.toml answers
// them with a permanent (301) redirect.
//
// Detox, Wellness Pills and the Honey & Energy enhancement items were not part
// of the answer: they stay published, under the AW-001 legal-review guard
// (src/lib/legalReview.js).
//
// To bring a product back (the owner's call), take its id out of
// DELISTED_IDS, move it out of the delisted lines (or take the line out of
// DELISTED_LINES), set it active in Admin -> Products, and remove the line's
// redirect from netlify.toml if the whole line returns.
//
// Pure, with no imports: src/lib/routes.js and the Node build scripts read it.

// The product lines (products.sub) that are off the site.
export const DELISTED_LINES = Object.freeze(['Kratom & Kava', 'Mushroom Products']);

// Their URL slugs (slugify() in src/lib/routes.js; delisted.test.js checks
// they match), for the redirects.
export const DELISTED_LINE_SLUGS = Object.freeze(['kratom-and-kava', 'mushroom-products']);

// The department each delisted line belonged to: its old address redirects
// there.
export const DELISTED_LINE_DEPARTMENT = 'NOVELTIES';

// Every product the answer covers, by id: Kratom & Kava #75 Wava kava, #76
// Mazza Shots, #293 Sip happens; Mushroom Products #69-#74 (Shroom Puff,
// Mental Health), #258, #289, #299, #313 (Psyched), #281 (Hush Hit), #285
// (Shroom Bang), #288 (Blue Monkey), #296 (Jelly Holes), #298 (Shroom Rolls),
// #300 (Melted), #306, #307, #312 (Stoned). No mushroom product is filed in
// another line (names and descriptions were checked; delisted.test.js checks
// again).
export const DELISTED_IDS = Object.freeze([
  69, 70, 71, 72, 73, 74, 75, 76, 258, 281, 285, 288, 289, 293, 296, 298, 299, 300, 306, 307, 312, 313,
]);

// Whether a catalog row (products.js or a products table row) is off the site.
export function isDelisted(p) {
  if (!p) return false;
  return DELISTED_LINES.includes(String(p.sub ?? '').trim()) || DELISTED_IDS.includes(Number(p.id));
}
