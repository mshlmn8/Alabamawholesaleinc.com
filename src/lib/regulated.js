// Which catalog rows are nicotine products (AW-026). Hemp-named wraps are left
// out of the nicotine statement so the page does not claim those products
// contain nicotine.
//
// PR #12's guest licence rule (cartNeedsTobaccoLicense: tobacco and vape
// lines from a guest or an unapproved account needed a licence, a resale
// certificate and a 21+ attestation) went with guest orders: only approved
// accounts place orders (owner answer 2026-10, AW-014). submit_quote still
// carries the rule, which an approved account never meets.

export const FDA_NICOTINE_WARNING = 'WARNING: This product contains nicotine. Nicotine is an addictive chemical.';

const NICOTINE_SUBS = new Set([
  'Cigarettes',
  'Cigars & Cigarillos',
  'Loose Tobacco Bags',
  'Pouches & ZYN',
  'Wraps & Leafs',
  'Disposable Vapes',
  'Vape Pods',
]);

export function showsNicotineWarning(product) {
  if (!product) return false;
  const label = `${product.name || ''} ${product.brand || ''}`.toLowerCase();
  if (label.includes('hemp')) return false;
  if (NICOTINE_SUBS.has(product.sub)) return true;
  return /shisha/i.test(product.name || '');
}

