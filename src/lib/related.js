// The "More …" row under a product (AW-231): which products sit next to it.
//
//   relatedProducts(products, p, { limit = 4, hasPhoto }) -> up to `limit` products
//
// Candidates: active products of the same department, other than p, whose
// photo is not p's photo (the same file twice in a row says nothing, e.g.
// Powerade big and small, #290). Each scores:
//   +4  the same brand (case-insensitive; never the placeholder "Assorted")
//   +2  the same product line
//   +1  the same department (every candidate)
// Highest first; ties put a photo before "Photo coming soon", then follow a
// rotation that depends on p, so pages of one line show different
// neighbours instead of the line's first four, then id. Two picks don't show
// the same photo either (Gatorade small and big) unless the row would
// otherwise be short. A small line is filled from its department, so a
// product alone in its line (#129) or with one other (#353) still gets a
// full row.
//
// Status-quo guard (owner decision 2, AW-001): a product in a line under
// legal review (underLegalReview) is a candidate only on a page of that same
// line, where the old same-line row already showed it; it is never offered
// from another line.
// TODO(owner): After the legal review, may products in the restricted lines be suggested beside other products of their department, or only beside their own line (as now)? (AW-231, AW-001)
//
// Pure: no React, no network.

import { brandLabel } from './format.js';
import { underLegalReview } from './merchandising.js';

export const RELATED_LIMIT = 4;

// The same rule as HomePage's hasPhoto.
const photoOf = (p) => Boolean(p?.picture?.src || p?.img);
const brandKey = (p) => brandLabel(p?.brand).toLowerCase();

// Two rows show the same photo when they have the same image address.
function samePhoto(a, b) {
  if (a?.picture?.src && a.picture.src === b?.picture?.src) return true;
  return Boolean(a?.img) && a.img === b?.img;
}

// A fixed, well-spread order of the candidates that starts somewhere else for
// each product: x's place is (x·7919 + p·619) mod 1009. 619/1009 is close to
// the golden ratio, so neighbouring ids start far apart in the cycle.
const rotation = (x, p) => (Number(x.id) * 7919 + Number(p.id) * 619) % 1009;

export function relatedProducts(products, p, { limit = RELATED_LIMIT, hasPhoto = photoOf } = {}) {
  if (!p) return [];
  const brand = brandKey(p);
  const score = (x) => (brand && brandKey(x) === brand ? 4 : 0) + (x.sub === p.sub ? 2 : 0) + 1;
  const photoLast = (x) => (hasPhoto(x) ? 0 : 1);
  const ranked = (products || [])
    .filter((x) => x
      && x.active !== false
      && x.cat === p.cat
      && Number(x.id) !== Number(p.id)
      && !samePhoto(x, p)
      && (!underLegalReview(x) || x.sub === p.sub))
    .map((x) => ({ x, score: score(x), photo: photoLast(x), turn: rotation(x, p) }))
    .sort((a, b) => b.score - a.score || a.photo - b.photo || a.turn - b.turn || Number(a.x.id) - Number(b.x.id))
    .map(({ x }) => x);
  const picks = [];
  for (const x of ranked) {
    if (picks.length >= limit) break;
    if (!picks.some((y) => samePhoto(x, y))) picks.push(x);
  }
  // A short row takes a repeated photo rather than stay short.
  for (const x of ranked) {
    if (picks.length >= limit) break;
    if (!picks.includes(x)) picks.push(x);
  }
  return ranked.filter((x) => picks.includes(x)).slice(0, Math.max(0, limit));
}
