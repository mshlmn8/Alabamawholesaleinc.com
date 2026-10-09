// The homepage rails (AW-119): which products New arrivals and Bestsellers
// show, decided by the tags and the homepage rank staff set in Admin ->
// Products, instead of a list of ids in the code.
//
//   homeRails(products, { limit, hasPhoto }) -> { newArrivals, bestsellers }
//
// New arrivals: active products with a photo tagged NEW, by homepage rank
// (products.featured_rank, 1 first; unranked last), then by their place in
// the old hand-picked NEW_ARRIVALS_IDS (kept only to break ties, so today's
// order holds until staff rank them), then newest id first.
// Bestsellers: the same for BESTSELLER, by rank, then id (today's order).
// A product is never in both rails.
//
// Pure: no React, no network. HomePage passes its own hasPhoto.

import { NEW_ARRIVALS_IDS } from '../data/products.js';

export const RAIL_LIMIT = 8;

// The lines the AW-001 legal-review question names (docs/OWNER-TODO.md):
// these sub-lines, and the enhancement items of Merchandise -> Honey & Energy.
export const LEGAL_REVIEW_SUBS = ['Kratom & Kava', 'Mushroom Products', 'Detox', 'Wellness Pills'];
export const LEGAL_REVIEW_IDS = [28, 265, 266, 321, 322, 332];
export const underLegalReview = (p) => LEGAL_REVIEW_SUBS.includes(p?.sub) || LEGAL_REVIEW_IDS.includes(Number(p?.id));

// The same rule as HomePage's hasPhoto, which HomePage passes in.
const photoOf = (p) => Boolean(p?.picture?.src || p?.img);
const rankOf = (p) => (Number.isInteger(p?.featuredRank) ? p.featuredRank : null);
const idOf = (p) => Number(p?.id);

// Ranked first, 1 before 2; unranked after, in their own order.
function byRank(a, b) {
  const ra = rankOf(a);
  const rb = rankOf(b);
  if (ra === rb) return 0;
  if (ra == null) return 1;
  if (rb == null) return -1;
  return ra - rb;
}

export function homeRails(products, { limit = RAIL_LIMIT, hasPhoto = photoOf, legacyNewIds = NEW_ARRIVALS_IDS } = {}) {
  const shown = (products || []).filter((p) => p && p.active !== false && hasPhoto(p));
  const legacyPlace = new Map(legacyNewIds.map((id, i) => [id, i]));
  const placeOf = (p) => legacyPlace.get(idOf(p)) ?? Number.MAX_SAFE_INTEGER;

  // Status-quo guard (owner decision 2): an unranked product in a line under
  // legal review is featured only where the homepage before this change
  // would have shown it (today that keeps #75 Wava kava, the 8th old New
  // arrivals pick, and keeps #76 Mazza Shots and #218 off). Without it,
  // following the tags would add restricted products to the homepage. A
  // homepage rank set by staff still features them.
  // TODO(owner): After the legal review, may the Kratom & Kava, Mushroom Products, Detox, Wellness Pills and Honey & Energy enhancement items be featured on the homepage rails when they are tagged NEW or BESTSELLER, or only when staff rank them (as now), or never? (AW-119, AW-001)
  const byId = new Map(shown.map((p) => [idOf(p), p]));
  const before = {
    newArrivals: new Set(legacyNewIds.map((id) => byId.get(id)).filter(Boolean).slice(0, limit).map(idOf)),
    bestsellers: new Set(shown.filter((p) => p.tag === 'BESTSELLER').sort((a, b) => idOf(a) - idOf(b)).slice(0, limit).map(idOf)),
  };
  const mayFeature = (p, shownBefore) => rankOf(p) != null || !underLegalReview(p) || shownBefore.has(idOf(p));

  const newArrivals = shown
    .filter((p) => p.tag === 'NEW' && mayFeature(p, before.newArrivals))
    .sort((a, b) => byRank(a, b) || placeOf(a) - placeOf(b) || idOf(b) - idOf(a))
    .slice(0, limit);
  const taken = new Set(newArrivals.map(idOf));
  const bestsellers = shown
    .filter((p) => p.tag === 'BESTSELLER' && !taken.has(idOf(p)) && mayFeature(p, before.bestsellers))
    .sort((a, b) => byRank(a, b) || idOf(a) - idOf(b))
    .slice(0, limit);
  return { newArrivals, bestsellers };
}
