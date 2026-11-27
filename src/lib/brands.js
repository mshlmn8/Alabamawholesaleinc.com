// Brands derived from the catalog the storefront is showing. "Assorted" is
// the placeholder for a row whose brand is not named (AW-286), so it is not
// a brand. Delisted rows stay off the site (AW-001). Inactive rows do too.

import { isDelisted } from '../data/delisted.js';
import { brandLabel } from './format.js';
import { slugify } from './routes.js';

// How many brands the home page shows. Show all opens /brands.
export const HOME_BRAND_COUNT = 8;

const onSite = (p) => p && p.active !== false && !isDelisted(p);

// [{ slug, label, products }], A to Z. Products keep catalog order.
export function catalogBrands(products) {
  const groups = new Map();
  for (const p of products || []) {
    if (!onSite(p)) continue;
    const label = brandLabel(p.brand);
    const slug = slugify(label);
    if (!slug) continue;
    let group = groups.get(slug);
    if (!group) {
      group = { slug, label, products: [] };
      groups.set(slug, group);
    }
    group.products.push(p);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'en'));
}

// A product with a photo, the first by name, for the brand's tile.
export function brandPhoto(brand) {
  return [...(brand?.products || [])]
    .filter((p) => p?.picture?.src || p?.img)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'en'))[0] || null;
}

// The home strip: the brands with the most products, a photo first, then
// the name. Ties keep A to Z.
export function homeBrands(products, limit = HOME_BRAND_COUNT) {
  const ranked = [...catalogBrands(products)].sort((a, b) => b.products.length - a.products.length || a.label.localeCompare(b.label, 'en'));
  const pictured = ranked.filter((b) => brandPhoto(b));
  const rest = ranked.filter((b) => !brandPhoto(b));
  return [...pictured, ...rest].slice(0, limit);
}

export function brandBySlug(products, slug) {
  const want = slugify(slug);
  if (!want) return null;
  return catalogBrands(products).find((b) => b.slug === want) || null;
}

// [['A', brands], …, ['#', brands]] for names that don't start with a letter.
export function brandGroups(brands) {
  const groups = new Map();
  for (const brand of brands) {
    const letter = /^[A-Za-z]/.test(brand.label) ? brand.label[0].toUpperCase() : '#';
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(brand);
  }
  const letters = [...groups.keys()].sort((a, b) => (a === '#') - (b === '#') || a.localeCompare(b));
  return letters.map((letter) => [letter, groups.get(letter)]);
}
