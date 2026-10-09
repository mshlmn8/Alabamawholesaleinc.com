// The homepage rails (AW-119): which products New arrivals and Bestsellers
// show, decided by the tags and the homepage rank staff set in Admin ->
// Products, instead of a list of ids in the code.
//
//   homeRails(products, { limit, hasPhoto }) -> { newArrivals, bestsellers }
//
// `limit` is how many cards each rail shows (the homepage shows RAIL_LENGTH,
// one row, AW-060). The legal-review guard below compares with the homepage
// as it was before the tags drove it, which showed RAIL_LIMIT (8) a rail,
// whatever `limit` is now.
//
// New arrivals: active products with a photo tagged NEW, by homepage rank
// (products.featured_rank, 1 first; unranked last), then by their place in
// the old hand-picked NEW_ARRIVALS_IDS (kept only to break ties, so today's
// order holds until staff rank them), then newest id first.
// Bestsellers: the same for BESTSELLER, by rank, then id (today's order).
// A product is never in both rails.
//
//   featuredOrder(products, { hasPhoto }) -> a new array (AW-227)
//
// The department pages' Featured sort: the homepage rank first, then the tag
// (BESTSELLER, NEW, DEAL, PREMIUM, untagged), then products with a photo
// before the placeholder, then id. The same status-quo guard applies.
//
// Pure: no React, no network. HomePage passes its own hasPhoto.

import { NEW_ARRIVALS_IDS } from '../data/products.js';
import { underLegalReview } from './legalReview.js';

// The legal-review lines (AW-001) live in legalReview.js, which search.js
// also reads; they are exported from here as before.
export { LEGAL_REVIEW_IDS, LEGAL_REVIEW_SUBS, underLegalReview } from './legalReview.js';

export const RAIL_LIMIT = 8;

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

export function homeRails(products, { limit = RAIL_LIMIT, hasPhoto = photoOf, legacyNewIds = NEW_ARRIVALS_IDS, legacyLimit = Math.max(limit, RAIL_LIMIT) } = {}) {
  const shown = (products || []).filter((p) => p && p.active !== false && hasPhoto(p));
  const legacyPlace = new Map(legacyNewIds.map((id, i) => [id, i]));
  const placeOf = (p) => legacyPlace.get(idOf(p)) ?? Number.MAX_SAFE_INTEGER;

  // Status-quo guard (owner decision 2): an unranked product in a line under
  // legal review is featured only where the homepage before this change
  // would have shown it (today that keeps #75 Wava kava, the 8th old New
  // arrivals pick, and keeps #76 Mazza Shots and #218 off). Without it,
  // following the tags would add restricted products to the homepage. A
  // homepage rank set by staff still features them. featuredOrder applies the
  // same rule to the department pages' Featured sort.
  // TODO(owner): After the legal review, may the Kratom & Kava, Mushroom Products, Detox, Wellness Pills and Honey & Energy enhancement items be featured on the homepage rails, and lead the department pages' Featured sort, when they are tagged NEW, BESTSELLER, DEAL or PREMIUM, or only when staff rank them (as now), or never? (AW-119, AW-001)
  const byId = new Map(shown.map((p) => [idOf(p), p]));
  const before = {
    newArrivals: new Set(legacyNewIds.map((id) => byId.get(id)).filter(Boolean).slice(0, legacyLimit).map(idOf)),
    bestsellers: new Set(shown.filter((p) => p.tag === 'BESTSELLER').sort((a, b) => idOf(a) - idOf(b)).slice(0, legacyLimit).map(idOf)),
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

// The order of the tags in the Featured sort (AW-227); untagged comes last.
// What DEAL and PREMIUM mean is the AW-139 owner question (CategoryPage.jsx).
export const TAG_RANK = { BESTSELLER: 0, NEW: 1, DEAL: 2, PREMIUM: 3 };
const UNTAGGED = Object.keys(TAG_RANK).length;

// The department pages' Featured sort (AW-227). Staff's homepage rank first
// (1 first, unranked after), then the tag, then a photo before the
// "Photo coming soon" placeholder, then id. A product under legal review
// without a homepage rank sorts as untagged (the status-quo guard above,
// owner decision 2): its tag doesn't lift it to the top of its department.
// Returns a new array; `products` is not changed.
export function featuredOrder(products, { hasPhoto = photoOf } = {}) {
  const tagRank = (p) => {
    if (rankOf(p) == null && underLegalReview(p)) return UNTAGGED;
    return TAG_RANK[p?.tag] ?? UNTAGGED;
  };
  const photoLast = (p) => (hasPhoto(p) ? 0 : 1);
  return [...(products || [])].sort((a, b) => byRank(a, b) || tagRank(a) - tagRank(b) || photoLast(a) - photoLast(b) || idOf(a) - idOf(b));
}
