// Per-page <head> tags (AW-181, AW-338): title, description, canonical link,
// Open Graph and Twitter tags, the share image and robots noindex. Every URL
// is built from one SITE_URL, which VITE_SITE_URL overrides.
//
// Only the route decides the metadata. The header search is a dropdown, not
// a page, so what is typed there never reaches the title or history entries;
// only the /search?q= results page names its query, clipped and noindex
// (AW-007, AW-338).
//
// Titles stay within 60 characters and descriptions within 155, the lengths
// search results show (AW-318, AW-319): fitTitle() leaves out optional parts
// and fitSentences() whole sentences, so neither ends mid-phrase.
//
// Titles are in sentence case, the same words as the page's h1 (AW-131,
// LEFT-1): 'Contact & visit', 'All products · Wholesale catalog'. Product,
// department and line names are names and keep their own capitals.
//
// Department, line and product pages also carry their breadcrumb trail as
// BreadcrumbList structured data (AW-320): a <script type="application/ld+json"
// id="aw-breadcrumbs"> next to index.html's business and website nodes. A
// data block runs nothing, so the Content-Security-Policy needs no hash for it.

import { COMPANY, HOME_PITCH, HOME_TITLE, HOURS, ORDER_MINIMUM, hoursLine } from '../data/content.js';
import { APPLY_LABEL, TRADE_ACCOUNT_LABEL, basketTerms } from '../data/terms.js';
import { ADMIN_GATE_HEADINGS } from './accountStatus.js';
import { POLICY_TITLES, POLICY_INTROS } from '../pages/support/policyText.js';
import { resetTitle } from '../pages/support/resetView.js';
import { catalogCrumbs } from './crumbs.js';
import { topLines } from './departments.js';
import { brandLabel, catLabel, formatMoney, sharesDepartmentName } from './format.js';
import { underLegalReview } from './merchandising.js';
import { NOINDEX_PAGES, pathFor, siteUrl } from './routes.js';
import { MIN_QUERY_LENGTH, normalizeSearchText } from './search.js';

export const SITE_URL = siteUrl(import.meta.env.VITE_SITE_URL);
export const DEFAULT_IMAGE = { url: `${SITE_URL}/og.jpg`, width: 1200, height: 630, alt: `${COMPANY.name} logo` };

// The home page's h1 supporting line, word for word (AW-004).
export const HOME_DESCRIPTION = HOME_PITCH;

export const clip = (text, max = 155) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).replace(/[\s,;:—-]+\S*$/, '')}…`;
};

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

// The sentences of a text: split after . ! or ? and a space before a capital
// letter, digit or quote, but not after 'Mr.' and the like ("Mr. Goodbar").
// No lookbehind: Safari before 16.4 can't parse one, and the module would
// not load.
const ABBREVIATION = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|No|vs)\.$/;
export function sentencesOf(text) {
  const parts = String(text || '').replace(/\s+/g, ' ').trim().split(/([.!?]["”’)]?)\s+(?=[A-Z0-9"“‘(])/);
  const sentences = [];
  for (let i = 0; i < parts.length; i += 2) {
    const sentence = parts[i] + (parts[i + 1] || '');
    if (!sentence) continue;
    if (sentences.length && ABBREVIATION.test(sentences[sentences.length - 1])) sentences[sentences.length - 1] += ` ${sentence}`;
    else sentences.push(sentence);
  }
  return sentences;
}

// Whole sentences, in order, within `max` characters: a sentence that would
// go past it is left out and the ones after it are still tried, so a short
// 'SKU AW-SS.' can follow a long first sentence. Only a first sentence too
// long on its own is clipped, as nothing shorter says what the page is.
export function fitSentences(sentences, max = DESCRIPTION_MAX) {
  const list = sentences.map((s) => String(s || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!list.length) return '';
  if (list[0].length > max) return clip(list[0], max);
  let text = list[0];
  for (const sentence of list.slice(1)) {
    if (text.length + 1 + sentence.length <= max) text += ` ${sentence}`;
  }
  return text;
}

// A title from its parts, joined with ' · ', within `max` characters where
// the page's own name allows. parts[0] is that name and is never cut; the
// last part is the site name; the parts between are optional and are left
// out from the last one back, then the site name if the title is still too
// long. Empty parts are skipped.
export function fitTitle(parts, max = TITLE_MAX) {
  const [own, ...rest] = parts.filter(Boolean);
  const site = rest.pop();
  const middle = [...rest];
  const join = (list) => list.filter(Boolean).join(' · ');
  while (middle.length && join([own, ...middle, site]).length > max) middle.pop();
  const title = join([own, ...middle, site]);
  return title.length > max ? own : title;
}

// A department or line name inside a sentence: 'Cigars & Cigarillos' ->
// 'cigars & cigarillos', keeping capitals that are a name or an initialism
// ('Pouches & ZYN' -> 'pouches & ZYN', 'OTC & Health' -> 'OTC & health').
export const inSentence = (label) => String(label || '').replace(/\b[A-Z][a-z]+\b/g, (word) => word.toLowerCase());

// A product line inside a sentence. A catch-all line reads as its goods:
// 'Other Grocery' -> 'grocery', not 'Wholesale other grocery' (AW-319).
export const lineInSentence = (sub) => inSentence(sub).replace(/^other\s+(?=\S)/, '');

// 'A, B and C', or 'A, B, C and more' when there are more than those named.
const listOf = (items, more) => {
  if (more) return `${items.join(', ')} and more`;
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
};
const productCount = (n) => `${n} product${n === 1 ? '' : 's'}`;

// The first sentence from `build(k)` within `max` characters, naming up to
// `most` items and fewer when they don't fit.
const firstThatFits = (most, build, max = DESCRIPTION_MAX) => {
  for (let k = most; k > 0; k -= 1) {
    const sentence = build(k);
    if (sentence.length <= max) return sentence;
  }
  return build(0);
};

// Whether a product's name already says its brand, as whole words compared
// the way search compares text: 'Swisher Sweets cigarillos' names Swisher
// Sweets, 'Loose Leaf wraps' names LooseLeaf, 'Bicycle cards' doesn't name Bic.
export function nameHasBrand(name, brand) {
  const b = normalizeSearchText(brand);
  if (!b) return true;
  const words = normalizeSearchText(name).split(' ');
  const target = b.replace(/ /g, '');
  for (let i = 0; i < words.length; i += 1) {
    let joined = '';
    for (let j = i; j < words.length && joined.length < target.length; j += 1) {
      joined += words[j];
      if (joined === target) return true;
    }
  }
  return false;
}

// A line's brands, most products first (ties by name), without the
// placeholder brand "Assorted" (AW-286).
function brandsByCount(rows) {
  const counts = new Map();
  for (const p of rows) {
    const label = brandLabel(p.brand);
    if (!label) continue;
    const key = label.toLowerCase();
    const seen = counts.get(key);
    counts.set(key, { label: seen?.label || label, n: (seen?.n || 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).map((b) => b.label);
}

const SIGN_IN = 'Sign in for account pricing.';

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

// The admin section or view a title names (AW-118). Never a name or email:
// titles end up in history, bookmarks and screen-sharing.
function adminTitle(route) {
  if (route.section === 'accounts') return route.id ? 'Account details' : 'Accounts';
  if (route.section === 'pricing') return 'Pricing';
  if (route.section === 'homepage') return 'Homepage';
  if (route.section === 'products') {
    if (route.id === 'new') return 'New product';
    return route.id != null ? 'Edit product' : 'Products';
  }
  if (route.view === 'print') return route.query?.doc === 'slip' ? 'Packing slip' : 'Pick list';
  return 'Orders';
}

// The application page's title follows the account (AW-098): App sets
// route.applyAs to 'loading', 'no-profile' (signed in, the profile didn't
// load: NEW-002) or accountStatus(profile). Without it, the page is the one
// a visitor, or a search engine, sees. Sentence case, like every title and
// the page's own h1 (AW-131).
export const APPLY_TITLES = {
  guest: APPLY_LABEL,
  loading: TRADE_ACCOUNT_LABEL,
  'no-profile': TRADE_ACCOUNT_LABEL,
  pending: 'Application under review',
  approved: 'Your trade account',
  suspended: 'Account on hold',
};

// Title, description, canonical path, share image, breadcrumb trail and
// indexing for a resolved route (see resolveRoute in routes.js).
export function pageMeta(route, products, departments) {
  const meta = pageText(route, products, departments);
  const noindex = NOINDEX_PAGES.includes(route.page);
  return {
    ...meta,
    // Filters are not separate pages: the canonical URL has no query string.
    path: noindex ? null : pathFor(route),
    image: meta.image || null,
    breadcrumbs: noindex ? null : meta.breadcrumbs || null,
    noindex,
  };
}

// A catalog page's trail (catalogCrumbs) as [{ name, path }]: each crumb's
// own path, and the page's for the last one.
const trailOf = (items, ownPath) => items.map((item) => ({
  name: item.label,
  path: item.to ? (typeof item.to === 'string' ? item.to : pathFor(item.to)) : ownPath,
}));

function pageText(route, products, departments) {
  const site = COMPANY.name;
  if (route.page === 'not-found') {
    const what = route.catalog ? CATALOG_PENDING[route.kind] : null;
    if (what && route.catalog === 'loading') return { title: `Loading ${what}… · ${site}`, description: 'Getting the latest catalog.' };
    if (what) return { title: `Couldn’t load this ${what} · ${site}`, description: 'The latest catalog didn’t load. Check your connection and try again.' };
    const text = NOT_FOUND[route.kind] || NOT_FOUND.page;
    return { title: `${text.title} · ${site}`, description: text.description };
  }
  if (route.page === 'search') {
    const q = String(route.q || '').trim();
    if (q.length < MIN_QUERY_LENGTH) return { title: `Search · ${site}`, description: `Search the ${site} wholesale catalog.` };
    return {
      title: `Results for “${clip(q, 40)}” · ${site}`,
      description: clip(`Search results for “${q}” in the ${site} wholesale catalog.`),
    };
  }
  if (route.page === 'category') return categoryText(route, products, departments, site);
  if (route.page === 'product') {
    const p = products.find(x => Number(x.id) === route.productId);
    if (!p) return { title: `${NOT_FOUND.product.title} · ${site}`, description: NOT_FOUND.product.description };
    // The brand only when the name doesn't already say it, and never the
    // placeholder brand "Assorted" (AW-286, AW-319).
    const brand = brandLabel(p.brand);
    const ownBrand = brand && !nameHasBrand(p.name, brand) ? brand : '';
    const generated = `${p.name}${ownBrand ? ` by ${ownBrand}` : ''} from our ${catLabel(p.cat)} department.`;
    return {
      title: fitTitle([p.name, ownBrand, site]),
      description: fitSentences([
        ...sentencesOf(p.description || generated),
        p.sub ? `Wholesale ${lineInSentence(p.sub)} for licensed retailers.` : '',
        p.sku ? `SKU ${p.sku}.` : '',
      ]),
      image: imageOf(p, p.name),
      breadcrumbs: trailOf(catalogCrumbs({ category: p.cat, sub: p.sub || null, product: p }), pathFor(route)),
    };
  }
  // After a save, /quote shows the receipt (App sets route.received, AW-022);
  // before, its heading, once App knows the account (route.basket 'quote' or
  // 'order', AW-132).
  if (route.page === 'quote') return { title: route.received ? `${route.received === 'order' ? 'Order' : 'Quote'} received · ${site}` : `${route.basket ? basketTerms(route.basket === 'order').page : 'Checkout'} · ${site}`, description: `Review your items and submit a wholesale quote or order to ${site}. Minimum order ${formatMoney(ORDER_MINIMUM)}.` };
  if (route.page === 'account') return { title: `My account · ${site}`, description: `Your ${site} trade account: order history, reorders and quick entry by SKU.` };
  // route.unseen: orders placed since the admin last opened Orders (AW-111,
  // App's useAdminUnseen), as '(2) ' in front. route.gated: the page shows
  // its sign-in or staff-only gate, not a section (App's adminGate, NEW-020),
  // so the title says that, as the h1 does.
  if (route.page === 'admin') {
    const description = `Catalog and account administration for ${site}.`;
    if (route.gated === 'signin') return { title: `${ADMIN_GATE_HEADINGS.signin} · Admin · ${site}`, description };
    if (route.gated === 'staff') return { title: `Staff only · ${site}`, description };
    const unseen = route.unseen > 0 ? `(${route.unseen}) ` : '';
    return { title: `${unseen}${adminTitle(route)} · Admin · ${site}`, description };
  }
  // Support pages (src/pages/support/).
  if (route.page === 'catalog') return { title: `All products · Wholesale catalog · ${site}`, description: clip(`Every department and product line ${site} stocks — ${products.length} wholesale SKUs for licensed retailers, from the Birmingham warehouse.`) };
  // Short enough that both hours lines fit whole (the email is on the page).
  if (route.page === 'contact') return { title: `Contact & visit · ${site}`, description: clip(`Call ${COMPANY.phone} or visit ${COMPANY.addressShort}. ${HOURS.map(r => hoursLine(r, { nowrap: false })).join(', ')}.`) };
  if (route.page === 'delivery') return { title: `Delivery & service area · ${site}`, description: 'Next-day delivery on our own trucks when your stop is on a route in Alabama, Mississippi or Georgia, plus will-call pickup at the Birmingham warehouse.' };
  if (POLICY_TITLES[route.page]) return { title: `${POLICY_TITLES[route.page]} · ${site}`, description: clip(POLICY_INTROS[route.page]) };
  if (route.page === 'apply') return { title: `${APPLY_TITLES[route.applyAs] || APPLY_TITLES.guest} · ${site}`, description: `What licensed retailers need to open an ${site} trade account: EIN, state retail tobacco license, resale certificate and store details.` };
  // The reset page's title follows what it shows (AW-255): App sets
  // route.view from the page's resetView().
  if (route.page === 'reset-password') return { title: `${resetTitle(route.view)} · ${site}`, description: `Choose a new password for your ${site} trade account.` };
  return { title: `${HOME_TITLE} · ${site}`, description: HOME_DESCRIPTION };
}

// A department or product line page (AW-319). A department names its
// biggest lines; a line names its biggest brands. Products under legal
// review (AW-001) don't count toward the lines a department's description
// names, the same status-quo guard as the Featured sort and the /catalog
// previews; their lines keep their own pages, pills and titles.
function categoryText(route, products, departments, site) {
  const dept = departments.find(d => d.key === route.category);
  const label = catLabel(route.category);
  const inDept = products.filter(p => p.cat === route.category);
  const rows = route.sub ? inDept.filter(p => p.sub === route.sub) : inDept;
  const preview = rows.find(p => p.img);
  const scope = route.sub ? `${route.sub} · ${label}` : label;
  const breadcrumbs = trailOf(catalogCrumbs({ category: route.category, sub: route.sub || null }), pathFor(route));
  if (route.sub) {
    const brands = brandsByCount(rows);
    // Products with no brand of their own also make it '… and more'.
    const unbranded = rows.some(p => !brandLabel(p.brand));
    const first = firstThatFits(3, (k) => {
      const named = brands.slice(0, k);
      const from = named.length ? ` from ${listOf(named, unbranded || brands.length > named.length)}` : '';
      return `Wholesale ${lineInSentence(route.sub)} from our ${label} department: ${productCount(rows.length)}${from}.`;
    });
    return {
      // 'Motor Oil · Motor Oil' names the department once (NEW-029).
      title: fitTitle([route.sub, sharesDepartmentName(route.category, route.sub) ? '' : label, site]),
      description: fitSentences([first, SIGN_IN]),
      image: imageOf(preview, scope),
      breadcrumbs,
    };
  }
  const count = dept?.count ?? inDept.length;
  const lineCount = dept?.subs?.length ?? new Set(inDept.map(p => p.sub)).size;
  const lines = topLines(inDept.filter(p => !underLegalReview(p)), route.category, 3);
  const first = firstThatFits(3, (k) => {
    const named = lines.slice(0, k);
    const across = named.length ? ` across ${listOf(named, lineCount > named.length)}` : '';
    return `Wholesale ${inSentence(label)} for licensed retailers: ${productCount(count)}${across}.`;
  });
  return {
    title: fitTitle([label, 'Wholesale catalog', site]),
    description: fitSentences([first, SIGN_IN]),
    image: imageOf(preview, scope),
    breadcrumbs,
  };
}

// Absolute URL for a path or asset URL (on SITE_URL unless another base is given).
export const absoluteUrl = (url, base = SITE_URL) => {
  try { return new URL(url, `${base}/`).href; } catch { return `${base}/`; }
};

// The id of the page's BreadcrumbList script in the head (AW-320).
export const BREADCRUMBS_ID = 'aw-breadcrumbs';

// A pageMeta() trail as schema.org BreadcrumbList structured data, every
// item an absolute URL on SITE_URL (AW-320).
export function breadcrumbList(trail, base = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, name: crumb.name, item: absoluteUrl(crumb.path, base) })),
  };
}

// JSON for the inside of a <script> element: every '<' escaped, so no name
// in it can close the element or open a comment.
export const scriptJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

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

// The BreadcrumbList script in the head: written for a page with a trail,
// removed for any other.
function setBreadcrumbs(trail) {
  let el = document.getElementById(BREADCRUMBS_ID);
  if (!trail?.length) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = BREADCRUMBS_ID;
    document.head.appendChild(el);
  }
  el.textContent = scriptJson(breadcrumbList(trail));
}

// Writes a pageMeta() result into the document head. A product share image
// is resolved on the current origin, where this build's hashed file exists.
export function applyPageMeta({ title, description, path = null, image = null, breadcrumbs = null, noindex = false }) {
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
  setBreadcrumbs(breadcrumbs);
}
