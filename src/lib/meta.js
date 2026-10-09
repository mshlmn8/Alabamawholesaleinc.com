// Per-page <head> tags (AW-181, AW-338): title, description, canonical link,
// Open Graph and Twitter tags, the share image and robots noindex. Every URL
// is built from one SITE_URL, which VITE_SITE_URL overrides.
//
// Only the route decides the metadata. The header search is a dropdown, not
// a page, so what is typed there never reaches the title or history entries.

import { COMPANY, HOURS, ORDER_MINIMUM, hoursLine } from '../data/content.js';
import { POLICY_TITLES, POLICY_INTROS } from '../pages/support/PolicyPage.jsx';
import { brandLabel, catLabel, formatMoney } from './format.js';
import { NOINDEX_PAGES, pathFor, siteUrl } from './routes.js';

export const SITE_URL = siteUrl(import.meta.env.VITE_SITE_URL);
export const DEFAULT_IMAGE = { url: `${SITE_URL}/og.jpg`, width: 1200, height: 630, alt: `${COMPANY.name} logo` };

export const HOME_DESCRIPTION = 'Wholesale tobacco, vapes, candy, drinks, grocery and motor oil for licensed retailers. Next-day delivery on our routes in Alabama, Mississippi and Georgia from our Birmingham warehouse.';

export const clip = (text, max = 155) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).replace(/[\s,;:—-]+\S*$/, '')}…`;
};

// The size a generated photo's file name carries ('<base>--640x640-<hash>.jpg',
// see src/lib/images.js), or nothing for other URLs.
const sizeInName = (url) => {
  const match = /--(\d+)x(\d+)[-.]/.exec(String(url));
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: undefined, height: undefined };
};

// A product photo as a share image: the largest JPEG of its set. Its size is
// read from that file's name: picture.width/height describe the largest WebP,
// which can be bigger than the largest JPEG.
const imageOf = (product, alt) => {
  const url = product?.picture?.src || product?.img;
  if (!url) return null;
  return { url, ...sizeInName(url), alt };
};

const NOT_FOUND = {
  page: { title: 'Page not found', description: 'This page could not be found. Search the catalog or browse the departments.' },
  product: { title: 'Product not found', description: 'This product is not in the catalog. Search for it or browse the departments.' },
  department: { title: 'Department not found', description: 'This department does not exist. Browse the departments or search the catalog.' },
  line: { title: 'Product line not found', description: 'This product line does not exist. Browse the department or search the catalog.' },
};

// A product, department or line that isn't in the bundled catalog while the
// live one loads (route.catalog 'loading') or could not be loaded ('error')
// (AW-204, App.jsx).
const CATALOG_PENDING = { product: 'product', department: 'department', line: 'product line' };

// Title, description, canonical path, share image and indexing for a
// resolved route (see resolveRoute in routes.js).
export function pageMeta(route, products, departments) {
  const meta = pageText(route, products, departments);
  const noindex = NOINDEX_PAGES.includes(route.page);
  return {
    ...meta,
    // Filters are not separate pages: the canonical URL has no query string.
    path: noindex ? null : pathFor(route),
    image: meta.image || null,
    noindex,
  };
}

function pageText(route, products, departments) {
  const site = COMPANY.name;
  if (route.page === 'not-found') {
    const what = route.catalog ? CATALOG_PENDING[route.kind] : null;
    if (what && route.catalog === 'loading') return { title: `Loading ${what}… · ${site}`, description: 'Getting the latest catalog.' };
    if (what) return { title: `Couldn’t load this ${what} · ${site}`, description: 'The latest catalog didn’t load. Check your connection and try again.' };
    const text = NOT_FOUND[route.kind] || NOT_FOUND.page;
    return { title: `${text.title} · ${site}`, description: text.description };
  }
  if (route.page === 'search') return { title: `Search · ${site}`, description: `Search the ${site} wholesale catalog.` };
  if (route.page === 'category') {
    const dept = departments.find(d => d.key === route.category);
    const label = catLabel(route.category);
    const scope = route.sub ? `${route.sub} · ${label}` : label;
    const subs = dept?.subs || [];
    const lines = subs.slice(0, 4).join(', ') + (subs.length > 4 ? ' and more' : '');
    const preview = products.find(p => p.cat === route.category && (!route.sub || p.sub === route.sub) && p.img);
    return {
      title: `${scope} · Wholesale Catalog · ${site}`,
      description: clip(`Wholesale ${label.toLowerCase()} for licensed retailers — ${dept?.count ?? 0} SKUs across ${lines}. Sign in for account pricing.`),
      image: imageOf(preview, scope),
    };
  }
  if (route.page === 'product') {
    const p = products.find(x => Number(x.id) === route.productId);
    if (!p) return { title: `${NOT_FOUND.product.title} · ${site}`, description: NOT_FOUND.product.description };
    // The placeholder brand "Assorted" names no brand (AW-286).
    const brand = brandLabel(p.brand);
    return {
      title: brand ? `${p.name} · ${brand} · ${site}` : `${p.name} · ${site}`,
      description: clip(p.description || `${p.name} — wholesale ${p.sub.toLowerCase()}${brand ? ` from ${brand}` : ''}. SKU ${p.sku}.`),
      image: imageOf(p, p.name),
    };
  }
  if (route.page === 'quote') return { title: `Checkout · ${site}`, description: `Review your items and submit a wholesale quote or order to ${site}. Minimum order ${formatMoney(ORDER_MINIMUM)}.` };
  if (route.page === 'account') return { title: `My Account · ${site}`, description: `Your ${site} trade account: order history, reorders and quick entry by SKU.` };
  if (route.page === 'admin') return { title: `Admin · ${site}`, description: `Catalog and account administration for ${site}.` };
  // Support pages (src/pages/support/).
  if (route.page === 'catalog') return { title: `All Products · Wholesale Catalog · ${site}`, description: clip(`Every department and product line ${site} stocks — ${products.length} wholesale SKUs for licensed retailers, from the Birmingham warehouse.`) };
  if (route.page === 'contact') return { title: `Contact & Visit · ${site}`, description: clip(`Call ${COMPANY.phone}, email ${COMPANY.email}, or visit ${COMPANY.addressShort}. ${HOURS.map(r => hoursLine(r, { nowrap: false })).join(', ')}.`) };
  if (route.page === 'delivery') return { title: `Delivery & Service Area · ${site}`, description: 'Next-day delivery on our own trucks when your stop is on a route in Alabama, Mississippi or Georgia, plus will-call pickup at the Birmingham warehouse.' };
  if (POLICY_TITLES[route.page]) return { title: `${POLICY_TITLES[route.page]} · ${site}`, description: clip(POLICY_INTROS[route.page]) };
  if (route.page === 'apply') return { title: `Apply for a Trade Account · ${site}`, description: `What licensed retailers need to open a ${site} trade account: EIN, state retail tobacco license, resale certificate and store details.` };
  if (route.page === 'reset-password') return { title: `Reset Password · ${site}`, description: `Choose a new password for your ${site} trade account.` };
  return { title: `${site} · Wholesale Distributor — Birmingham, AL`, description: HOME_DESCRIPTION };
}

// Absolute URL for a path or asset URL (on SITE_URL unless another base is given).
export const absoluteUrl = (url, base = SITE_URL) => {
  try { return new URL(url, `${base}/`).href; } catch { return `${base}/`; }
};

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (content == null || content === '') {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', String(content));
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// Writes a pageMeta() result into the document head. A product share image
// is resolved on the current origin, where this build's hashed file exists.
export function applyPageMeta({ title, description, path = null, image = null, noindex = false }) {
  document.title = title;
  const url = path ? absoluteUrl(path) : null;
  setMeta('name', 'description', description);
  setCanonical(url);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  const img = image ? { ...image, url: absoluteUrl(image.url, window.location.origin) } : DEFAULT_IMAGE;
  setMeta('property', 'og:image', img.url);
  setMeta('property', 'og:image:type', image ? null : 'image/jpeg');
  setMeta('property', 'og:image:width', img.width);
  setMeta('property', 'og:image:height', img.height);
  setMeta('property', 'og:image:alt', img.alt);
  setMeta('name', 'twitter:image', img.url);
  setMeta('name', 'robots', noindex ? 'noindex' : null);
}
