// Which catalog rows are nicotine products, and which quote lines need a
// tobacco-license attestation. Hemp-named wraps are left out of the nicotine
// statement so the page does not claim those products contain nicotine.

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

// AW-014: tobacco department lines, and the novelties vape lines.
export function lineNeedsTobaccoLicense(item) {
  if (!item) return false;
  if (item.cat === 'TOBACCO') return true;
  return item.sub === 'Disposable Vapes' || item.sub === 'Vape Pods';
}

export function cartNeedsTobaccoLicense(items) {
  return (items || []).some(lineNeedsTobaccoLicense);
}
