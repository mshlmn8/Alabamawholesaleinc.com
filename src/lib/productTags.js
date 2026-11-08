// The one tag a product can carry (products.tag). It is a feature of the
// product: the storefront shows it on every card and product page, and
// NEW, DEAL and BESTSELLER also place it on the matching homepage row.
// PREMIUM is the Featured mark.

export const TAG_LABELS = {
  NEW: 'New',
  DEAL: 'Deal',
  BESTSELLER: 'Bestseller',
  PREMIUM: 'Featured',
};

const TAG_KIND = {
  NEW: 'new',
  DEAL: 'deal',
  BESTSELLER: 'bestseller',
  PREMIUM: 'featured',
};

export function tagLabel(tag) {
  if (tag == null || tag === '') return '';
  return TAG_LABELS[tag] || String(tag);
}

export function tagClass(tag) {
  const kind = TAG_KIND[tag];
  return kind ? `card-tag ${kind}` : 'card-tag';
}
