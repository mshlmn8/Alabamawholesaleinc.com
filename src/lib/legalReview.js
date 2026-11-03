// The lines the AW-001 legal-review question names (docs/OWNER-TODO.md):
// these sub-lines, and the enhancement items of Merchandise -> Honey & Energy.
// The owner answered for Kratom & Kava and Mushroom Products (2026-10): they
// are off the site (src/data/delisted.js) and in no catalog the storefront
// loads; they stay in this list, so nothing would feature one that came back.
// Detox, Wellness Pills and the enhancement items wait for the answer, and
// until then nothing lifts them above where they already were:
// the homepage rails and the Featured sort (merchandising.js), the related
// products (related.js), a department's description (meta.js) and the boost
// a search gets for naming a product line (search.js, NEW-027).
//
// Node-safe: the only import is the stage-1 honey id list, plain data, so the
// search module can still load this file without React or Vite.

import { STAGE1_HONEY_IDS } from '../data/stage1Catalog.js';

export const LEGAL_REVIEW_SUBS = ['Kratom & Kava', 'Mushroom Products', 'Detox', 'Wellness Pills'];
// The original enhancement items, then every Honey & Energy row stage 1 adds.
export const LEGAL_REVIEW_IDS = [28, 265, 266, 321, 322, 332, ...STAGE1_HONEY_IDS];
export const underLegalReview = (p) => LEGAL_REVIEW_SUBS.includes(p?.sub) || LEGAL_REVIEW_IDS.includes(Number(p?.id));
