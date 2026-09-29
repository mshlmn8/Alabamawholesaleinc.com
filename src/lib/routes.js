// Every piece of URL knowledge for the storefront (AW-043, AW-185, AW-188):
// the path URLs, a parser that never throws, validation against the loaded
// catalog with canonical redirects, the department filter query string
// (AW-008) and the legacy '#/' links from the old hash router.
//
// Pure functions only: scripts/build-sitemap.mjs imports this file in Node.
//
//   /                                   home (anchors: /#new-arrivals, /#bestsellers)
//   /catalog                            all products
//   /category/:dept[/:line]?q=&sort=&tags=&variants=1
//   /product/:id
//   /search?q=                          reserved for the search page (AW-007)
//   /quote /account /admin
//   /contact /delivery /shipping /privacy /terms /apply /reset-password
//
// Department and product-line segments are slugs of the catalog's names
// ('DRINKS & BAGS' -> drinks-and-bags). Any spelling that slugs the same way
// (/category/TOBACCO, /category/DRINKS%20%26%20BAGS) resolves and is
// redirected to the canonical slug.

// The production origin. VITE_SITE_URL overrides it (see src/lib/meta.js and
// scripts/build-sitemap.mjs); this is the domain the site already uses.
export const DEFAULT_SITE_URL = 'https://alabamawholesaleinc.com';

// Normalises a configured site URL to `https://host` with no trailing slash.
// Anything that is not an absolute http(s) origin falls back to the default.
export function siteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_SITE_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return DEFAULT_SITE_URL;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

// Static support pages: /<page> — see src/pages/support/.
export const SUPPORT_PAGES = ['catalog', 'contact', 'delivery', 'shipping', 'privacy', 'terms', 'apply', 'reset-password'];
// Pages that take no parameters.
const SIMPLE_PAGES = ['quote', 'account', 'admin', ...SUPPORT_PAGES];

// Kept out of search engines (robots noindex) and out of the sitemap.
export const NOINDEX_PAGES = ['quote', 'account', 'admin', 'reset-password', 'search', 'not-found'];

// Department page sort orders; 'featured' is the default and never written.
export const SORTS = ['featured', 'name-asc', 'name-desc', 'variants', 'price-low', 'price-high'];
// Featured filters, as catalog tag values. The URL carries them in lower case.
export const TAGS = ['BESTSELLER', 'NEW', 'DEAL', 'PREMIUM'];

// 'DRINKS & BAGS' -> 'drinks-and-bags', 'Men’s Care' -> 'mens-care'.
export function slugify(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// decodeURIComponent throws on malformed escapes (a link cut off mid-escape,
// e.g. /category/%E0%A4%A). Those become null, and the route not-found.
const decode = (segment) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
};

const searchParams = (search) => {
  try {
    return new URLSearchParams(search || '');
  } catch {
    return new URLSearchParams();
  }
};

// The department filters in a query string. Unknown values are ignored.
export function parseCategoryQuery(search) {
  const params = searchParams(search);
  const q = (params.get('q') || '').slice(0, 200);
  const sort = SORTS.includes(params.get('sort')) ? params.get('sort') : 'featured';
  const wanted = (params.get('tags') || '').split(',').map((t) => t.trim().toUpperCase());
  const tags = TAGS.filter((t) => wanted.includes(t));
  const variants = params.get('variants') === '1';
  return { q, sort, tags, variants };
}

export const EMPTY_CATEGORY_QUERY = Object.freeze({ q: '', sort: 'featured', tags: [], variants: false });

// The query string for department filters, in a fixed order; '' when none.
export function categoryQueryString(query = EMPTY_CATEGORY_QUERY) {
  const params = new URLSearchParams();
  const q = String(query.q || '').trim();
  if (q) params.set('q', q);
  if (query.sort && query.sort !== 'featured' && SORTS.includes(query.sort)) params.set('sort', query.sort);
  const tags = TAGS.filter((t) => (query.tags || []).includes(t));
  if (tags.length) params.set('tags', tags.map((t) => t.toLowerCase()).join(','));
  if (query.variants) params.set('variants', '1');
  const text = params.toString().replace(/%2C/g, ',');
  return text ? `?${text}` : '';
}

// Reads a URL (pathname and search) into a raw route. Parameters are not yet
// checked against the catalog; resolveRoute does that. Never throws.
export function parseUrl({ pathname = '/', search = '' } = {}) {
  const segments = String(pathname).split('/').filter(Boolean).map(decode);
  if (segments.some((s) => s === null)) return { page: 'not-found' };
  const [first, ...rest] = segments;
  if (!first) return { page: 'home' };
  const section = first.toLowerCase();
  if (section === 'index.html' && rest.length === 0) return { page: 'home' };
  if (section === 'product') return rest.length === 1 ? { page: 'product', id: rest[0] } : { page: 'not-found', kind: rest.length ? 'page' : 'product' };
  if (section === 'category') {
    if (rest.length === 1 || rest.length === 2) {
      return { page: 'category', dept: rest[0], sub: rest[1] ?? null, query: parseCategoryQuery(search) };
    }
    return { page: 'not-found', kind: rest.length ? 'page' : 'department' };
  }
  if (section === 'search' && rest.length === 0) return { page: 'search', q: (searchParams(search).get('q') || '').slice(0, 200) };
  if (SIMPLE_PAGES.includes(section) && rest.length === 0) return { page: section };
  return { page: 'not-found' };
}

// Canonical product ids are positive integers written without leading zeros.
const productIdOf = (id) => (/^\d{1,9}$/.test(String(id)) ? Number(id) : null);

// Checks a raw route against the catalog. Returns the route the pages render
// (department and line keys as the catalog spells them, numeric product ids)
// or a not-found route. Unknown things are never echoed into headings,
// breadcrumbs or titles.
export function resolveRoute(raw, { departments = [], products = [] } = {}) {
  if (raw.page === 'category') {
    const slug = slugify(raw.dept);
    const dept = slug ? departments.find((d) => slugify(d.key) === slug) : null;
    if (!dept) return { page: 'not-found', kind: 'department' };
    let sub = null;
    if (raw.sub != null) {
      const subSlug = slugify(raw.sub);
      sub = subSlug ? dept.subs.find((s) => slugify(s) === subSlug) || null : null;
      if (!sub) return { page: 'not-found', kind: 'line', category: dept.key };
    }
    return { page: 'category', category: dept.key, sub, query: raw.query || EMPTY_CATEGORY_QUERY };
  }
  if (raw.page === 'product') {
    const productId = productIdOf(raw.id);
    if (productId === null || productId < 1 || !products.some((p) => Number(p.id) === productId)) {
      return { page: 'not-found', kind: 'product' };
    }
    return { page: 'product', productId };
  }
  if (raw.page === 'not-found') return { page: 'not-found', kind: raw.kind || 'page' };
  return raw;
}

// The path of a route, without its query string. Not-found routes have none.
export function pathFor(route) {
  switch (route?.page) {
    case 'home': return '/';
    case 'product': return `/product/${route.productId}`;
    case 'category': return `/category/${slugify(route.category)}${route.sub ? `/${slugify(route.sub)}` : ''}`;
    case 'search': return '/search';
    case 'not-found': return null;
    default: return SIMPLE_PAGES.includes(route?.page) ? `/${route.page}` : '/';
  }
}

// The href for a route: its path plus the department filters or search query.
export function hrefFor(route) {
  const path = pathFor(route) ?? '/';
  if (route?.page === 'category') return path + categoryQueryString(route.query);
  if (route?.page === 'search') {
    const q = String(route.q || '').trim();
    return q ? `${path}?${new URLSearchParams({ q })}` : path;
  }
  return path;
}

// Identifies the rendered page, e.g. to reset per-page state on navigation.
export function routeKey(route) {
  if (route?.page === 'not-found') return `not-found:${route.kind || 'page'}${route.category ? `:${route.category}` : ''}`;
  return hrefFor(route);
}

// Identifies the page a URL shows, ignoring the product line and filters of a
// department page. Moving between two URLs with the same page key keeps the
// scroll position and focus; anything else is a new page.
export function pageKeyFor({ pathname = '/', search = '' } = {}) {
  const raw = parseUrl({ pathname, search });
  if (raw.page === 'category') return `category:${slugify(raw.dept)}`;
  if (raw.page === 'product') return `product:${productIdOf(raw.id) ?? raw.id}`;
  return raw.page;
}

// Old hash-router links ('/#/category/TOBACCO', '/#/product/12') map to their
// path. Anything else in the fragment ('#access_token=…', '#error=…',
// '#type=recovery', '#new-arrivals') is not a route and returns null, so
// Supabase auth links reach the auth layer untouched. A second fragment
// after the route ('#/reset-password#access_token=…') is kept.
export function legacyHashTarget(hash) {
  const match = /^#!?(\/[^#]*)(#.*)?$/.exec(String(hash || ''));
  if (!match) return null;
  // One leading slash: '#//host' must not become a protocol-relative URL.
  return `/${match[1].replace(/^\/+/, '')}${match[2] || ''}`;
}
