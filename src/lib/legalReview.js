// The lines the AW-001 legal-review question names (docs/OWNER-TODO.md):
// these sub-lines, and the enhancement items of Merchandise -> Honey & Energy.
// Until the owner answers, nothing lifts them above where they already were:
// the homepage rails and the Featured sort (merchandising.js), the related
// products (related.js), a department's description (meta.js) and the boost
// a search gets for naming a product line (search.js, NEW-027).
//
// Pure, with no imports, so the Node-safe search module can use it.

export const LEGAL_REVIEW_SUBS = ['Kratom & Kava', 'Mushroom Products', 'Detox', 'Wellness Pills'];
export const LEGAL_REVIEW_IDS = [28, 265, 266, 321, 322, 332];
export const underLegalReview = (p) => LEGAL_REVIEW_SUBS.includes(p?.sub) || LEGAL_REVIEW_IDS.includes(Number(p?.id));
