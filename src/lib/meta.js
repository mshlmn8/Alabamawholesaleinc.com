// Per-page <title> and description. Every hash route shares one URL, so the
// canonical link and og:url stay on the homepage while title, description
// and the og:title/og:description pair follow the page being viewed.

import { COMPANY } from '../data/content.js';
import { POLICY_TITLES, POLICY_INTROS } from '../pages/support/PolicyPage.jsx';
import { catLabel } from './format.js';

export const HOME_DESCRIPTION = 'Wholesale tobacco, vapes, candy, drinks, grocery and motor oil for licensed retailers. Next-day delivery on our routes in Alabama, Mississippi and Georgia from our Birmingham warehouse.';

export const clip = (text, max = 155) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).replace(/[\s,;:—-]+\S*$/, '')}…`;
};

export function pageMeta(route, products, departments, searchTerm) {
  const site = COMPANY.name;
  if (searchTerm) {
    return { title: `Search “${searchTerm}” · ${site}`, description: `Search results for “${searchTerm}” across ${products.length} wholesale SKUs at ${site}, Birmingham, AL.` };
  }
  if (route.page === 'category') {
    const dept = departments.find(d => d.key === route.category);
    const label = catLabel(route.category);
    if (!dept) return { title: `Department not found · ${site}`, description: HOME_DESCRIPTION };
    const scope = route.sub ? `${route.sub} · ${label}` : label;
    const lines = dept.subs.slice(0, 4).join(', ') + (dept.subs.length > 4 ? ' and more' : '');
    return { title: `${scope} · Wholesale Catalog · ${site}`, description: clip(`Wholesale ${label.toLowerCase()} for licensed retailers — ${dept.count} SKUs across ${lines}. Sign in for account pricing.`) };
  }
  if (route.page === 'product') {
    const p = products.find(x => Number(x.id) === route.productId);
    if (!p) return { title: `Product not found · ${site}`, description: HOME_DESCRIPTION };
    return { title: `${p.name} · ${p.brand} · ${site}`, description: clip(p.description || `${p.name} — wholesale ${p.sub.toLowerCase()} from ${p.brand}. SKU ${p.sku}.`) };
  }
  if (route.page === 'quote') return { title: `Checkout · ${site}`, description: `Review your items and submit a wholesale quote or order to ${site}. Minimum order $500.00.` };
  if (route.page === 'account') return { title: `My Account · ${site}`, description: `Your ${site} trade account: order history, reorders and quick entry by SKU.` };
  if (route.page === 'admin') return { title: `Admin · ${site}`, description: `Catalog and account administration for ${site}.` };
  // Support pages (src/pages/support/).
  if (route.page === 'catalog') return { title: `All Products · Wholesale Catalog · ${site}`, description: clip(`Every department and product line ${site} stocks — ${products.length} wholesale SKUs for licensed retailers, from the Birmingham warehouse.`) };
  if (route.page === 'contact') return { title: `Contact & Visit · ${site}`, description: clip(`Call ${COMPANY.phone}, email ${COMPANY.email}, or visit ${COMPANY.addressShort}. ${COMPANY.hoursLine1}, ${COMPANY.hoursLine2}.`) };
  if (route.page === 'delivery') return { title: `Delivery & Service Area · ${site}`, description: 'Next-day delivery on our own trucks when your stop is on a route in Alabama, Mississippi or Georgia, plus will-call pickup at the Birmingham warehouse.' };
  if (POLICY_TITLES[route.page]) return { title: `${POLICY_TITLES[route.page]} · ${site}`, description: clip(POLICY_INTROS[route.page]) };
  if (route.page === 'apply') return { title: `Apply for a Trade Account · ${site}`, description: `What licensed retailers need to open a ${site} trade account: EIN, state retail tobacco license, resale certificate and store details.` };
  if (route.page === 'reset-password') return { title: `Reset Password · ${site}`, description: `Choose a new password for your ${site} trade account.` };
  return { title: `${site} · Wholesale Distributor — Birmingham, AL`, description: HOME_DESCRIPTION };
}

export function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

// Writes a pageMeta() result into the document head.
export function applyPageMeta({ title, description }) {
  document.title = title;
  setMeta('name', 'description', description);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
}
