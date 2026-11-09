// The homepage rails (AW-119): which products New arrivals and Bestsellers
// show, decided by the tags and the homepage rank staff set in Admin ->
// Products, instead of a list of ids in the code.
//
//   homeRails(products, { limit, hasPhoto }) -> { newArrivals, deals, bestsellers }
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
// New deals: the same for DEAL, by rank, then id.
// Bestsellers: the same for BESTSELLER, by rank, then id (today's order).
// A product is never in more than one rail.
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
  // would have shown it (today that keeps #218, a Detox BESTSELLER, off;
  // #75 Wava kava and #76 Mazza Shots, which it used to decide on, are
  // delisted, AW-001). Without it,
  // following the tags would add restricted products to the homepage. A
  // homepage rank set by staff still features them. featuredOrder applies the
  // same rule to the department pages' Featured sort.
  // TODO(owner): After the legal review, may the Detox, Wellness Pills and Honey & Energy enhancement items be featured on the homepage rails, and lead the department pages' Featured sort, when they are tagged NEW, BESTSELLER, DEAL or PREMIUM, or only when staff rank them (as now), or never? (AW-119, AW-001)
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
  // The old homepage had no deals rail, so an unranked product under legal
  // review stays off until staff give it a homepage rank.
  const deals = shown
    .filter((p) => p.tag === 'DEAL' && !taken.has(idOf(p)) && mayFeature(p, new Set()))
    .sort((a, b) => byRank(a, b) || idOf(a) - idOf(b))
    .slice(0, limit);
  for (const p of deals) taken.add(idOf(p));
  const bestsellers = shown
    .filter((p) => p.tag === 'BESTSELLER' && !taken.has(idOf(p)) && mayFeature(p, before.bestsellers))
    .sort((a, b) => byRank(a, b) || idOf(a) - idOf(b))
    .slice(0, limit);
  return { newArrivals, deals, bestsellers };
}

// Every product in a home-page group, in the rail's order, with no card
// limit. New arrivals, new deals and hot sellers follow the homepage's
// legal-review guard. Hot sellers are the bestsellers that guard allows
// onto the homepage (a photo, and not held back). Bestsellers is the whole
// tag, including a product still waiting on a photo or held for review.
// A product has one tag, so the groups meet only where hot sellers are the
// featured part of bestsellers.
export function collectionList(products, page) {
  const shown = (products || []).filter((p) => p && p.active !== false);
  const legacyPlace = new Map(NEW_ARRIVALS_IDS.map((id, i) => [id, i]));
  const placeOf = (p) => legacyPlace.get(idOf(p)) ?? Number.MAX_SAFE_INTEGER;
  const withPhoto = shown.filter((p) => photoOf(p));
  const byId = new Map(withPhoto.map((p) => [idOf(p), p]));
  const before = {
    newArrivals: new Set(NEW_ARRIVALS_IDS.map((id) => byId.get(id)).filter(Boolean).slice(0, RAIL_LIMIT).map(idOf)),
    bestsellers: new Set(withPhoto.filter((p) => p.tag === 'BESTSELLER').sort((a, b) => idOf(a) - idOf(b)).slice(0, RAIL_LIMIT).map(idOf)),
  };
  const mayFeature = (p, shownBefore) => rankOf(p) != null || !underLegalReview(p) || shownBefore.has(idOf(p));
  const tagged = (tag) => shown.filter((p) => p.tag === tag);
  if (page === 'new-arrivals') {
    return tagged('NEW').filter((p) => mayFeature(p, before.newArrivals))
      .sort((a, b) => byRank(a, b) || placeOf(a) - placeOf(b) || idOf(b) - idOf(a));
  }
  if (page === 'new-deals') {
    return tagged('DEAL').filter((p) => mayFeature(p, new Set()))
      .sort((a, b) => byRank(a, b) || idOf(a) - idOf(b));
  }
  if (page === 'hot-sellers') {
    return tagged('BESTSELLER').filter((p) => photoOf(p) && mayFeature(p, before.bestsellers))
      .sort((a, b) => byRank(a, b) || idOf(a) - idOf(b));
  }
  if (page === 'bestsellers') {
    return tagged('BESTSELLER').sort((a, b) => byRank(a, b) || idOf(a) - idOf(b));
  }
  return [];
}

// What each home row shows: `limit` cards with a photo. Hot sellers takes
// the featured bestsellers first, so the Bestsellers row continues with the
// rest and a card is never in two rows.
export function homeSections(products, { limit = RAIL_LIMIT, hasPhoto = photoOf } = {}) {
  const taken = new Set();
  const sections = {};
  for (const page of ['new-arrivals', 'hot-sellers', 'bestsellers', 'new-deals']) {
    const cards = collectionList(products, page)
      .filter((p) => hasPhoto(p) && !taken.has(idOf(p)) && (rankOf(p) != null || !underLegalReview(p)))
      .slice(0, limit);
    for (const card of cards) taken.add(idOf(card));
    sections[page] = cards;
  }
  return sections;
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
