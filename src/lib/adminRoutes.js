// The admin back office's URLs (AW-118). Pure functions only: routes.js uses
// them, and scripts/build-sitemap.mjs imports routes.js in Node.
//
//   /admin                              Orders (exactly { page: 'admin' })
//   /admin/orders?status=&from=&to=&on=&method=&account=
//   /admin/orders/:uuid/print?doc=pick|slip   an order's pick list or packing slip
//   /admin/accounts                     /admin/accounts/:uuid
//   /admin/products?q=&status=&dept=&sub=&tag=&photo=&unit=&stock=&sort=&dir=&page=
//   /admin/products/:id                 /admin/products/new?from=:id
//   /admin/pricing                      the pricing tiers (AW-114)
//
// Only filters that name no person go in the query: statuses, dates, the
// delivery method, ids and product filters. Free-text order and account
// searches (names, emails, phones) stay in the page's state. Every query
// value is checked here; unknown keys and bad values are dropped, never
// echoed.

export const ADMIN_SECTIONS = ['orders', 'accounts', 'products', 'pricing'];

// The order statuses. The quote workflow (AW-024; Cursor's
// 20261008200000) adds quoted ... out_for_delivery; a database without it
// accepts only the first four (LEGACY_ORDER_STATES).
// TODO(owner): Confirm how quotes should work: should staff price and answer guest quotes and convert them to orders, and should orders go through 'quoted' and 'confirmed' stages before picking? (AW-024)
export const ORDER_STATES = ['new', 'contacted', 'quoted', 'confirmed', 'picking', 'ready', 'out_for_delivery', 'fulfilled', 'cancelled'];
export const LEGACY_ORDER_STATES = ['new', 'contacted', 'fulfilled', 'cancelled'];
// The Orders status filter: a status or 'all'. 'new' is the default.
export const ORDER_STATUS_FILTERS = [...ORDER_STATES, 'all'];
export const DEFAULT_ORDER_STATUS = 'new';
export const ORDER_METHODS = ['delivery', 'willcall'];
// The print view's sheets (AW-110): the pick list (also without ?doc) and
// the packing slip.
export const PRINT_SHEETS = ['pick', 'slip'];

// Products filters. Their meaning belongs to the Products section
// (src/pages/admin/productList.js); this only says which values a URL may
// carry. photo=none and unit=none are the 'No photo' and 'No sell unit'
// toggles (AW-115).
export const PRODUCT_STATUSES = ['active', 'inactive'];
export const PRODUCT_TAGS = ['bestseller', 'new', 'deal', 'premium', 'none'];
export const PRODUCT_PHOTO = ['none'];
export const PRODUCT_UNITS = ['none'];
export const PRODUCT_SORTS = ['id', 'name', 'brand', 'category', 'price', 'updated'];
export const SORT_DIRECTIONS = ['asc', 'desc'];
export const MAX_PRODUCT_QUERY = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A department or line slug (see slugify in routes.js), a sell unit or a
// stock status: lower-case words joined by - or _.
const KEY = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

export const isUuid = (value) => UUID.test(String(value ?? ''));
const positiveInt = (value) => (/^[1-9]\d{0,8}$/.test(String(value ?? '')) ? Number(value) : null);
const oneOf = (list) => (value) => (list.includes(value) ? value : null);
const key = (max) => (value) => (value.length <= max && KEY.test(value) ? value : null);

// YYYY-MM-DD for a real calendar day.
export function isIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
const isoDate = (value) => (isIsoDate(value) ? value : null);

// Each section's query keys, in the order they are written, with the check
// that turns a raw value into a kept one (or null) and the default that is
// never written.
const QUERY = {
  orders: {
    status: { read: (v) => oneOf(ORDER_STATUS_FILTERS)(v.toLowerCase()), fallback: DEFAULT_ORDER_STATUS },
    from: { read: isoDate },
    to: { read: isoDate },
    on: { read: isoDate },
    method: { read: (v) => oneOf(ORDER_METHODS)(v.toLowerCase()) },
    account: { read: (v) => (isUuid(v) ? v.toLowerCase() : null) },
  },
  accounts: {},
  products: {
    q: { read: (v) => v.trim().slice(0, MAX_PRODUCT_QUERY).trim() || null },
    status: { read: (v) => oneOf(PRODUCT_STATUSES)(v.toLowerCase()) },
    dept: { read: (v) => key(60)(v.toLowerCase()) },
    sub: { read: (v) => key(60)(v.toLowerCase()) },
    tag: { read: (v) => oneOf(PRODUCT_TAGS)(v.toLowerCase()) },
    photo: { read: (v) => oneOf(PRODUCT_PHOTO)(v.toLowerCase()) },
    unit: { read: (v) => oneOf(PRODUCT_UNITS)(v.toLowerCase()) },
    stock: { read: (v) => key(30)(v.toLowerCase()) },
    sort: { read: (v) => oneOf(PRODUCT_SORTS)(v.toLowerCase()) },
    dir: { read: (v) => oneOf(SORT_DIRECTIONS)(v.toLowerCase()) },
    page: { read: positiveInt, fallback: 1 },
    from: { read: positiveInt },
  },
  pricing: {},
};
// A view's own query, in place of its section's (the print view takes only
// ?doc=; the list's filters stay with the list).
const VIEW_QUERY = {
  print: {
    doc: { read: (v) => oneOf(PRINT_SHEETS)(v.toLowerCase()) },
  },
};
const specOf = (section, view) => (view && VIEW_QUERY[view]) || QUERY[section] || {};

const searchParams = (search) => {
  try {
    return new URLSearchParams(search || '');
  } catch {
    return new URLSearchParams();
  }
};

// The checked query of a section (or of one of its views): only known keys
// with valid values, and none that equals its default.
export function parseAdminQuery(section, search, view = null) {
  const spec = specOf(section, view);
  const params = searchParams(search);
  const out = {};
  for (const [name, { read, fallback }] of Object.entries(spec)) {
    const raw = params.get(name);
    if (raw == null || raw === '') continue;
    const value = read(raw);
    if (value != null && value !== fallback) out[name] = value;
  }
  return out;
}

// The query string for a section's filters, keys in a fixed order, defaults
// and unknown keys left out; '' when there are none.
export function adminQueryString(section, query = {}, view = null) {
  const spec = specOf(section, view);
  const params = new URLSearchParams();
  for (const [name, { read, fallback }] of Object.entries(spec)) {
    const raw = query?.[name];
    if (raw == null || raw === '') continue;
    const value = read(String(raw));
    if (value != null && value !== fallback) params.set(name, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

// Reads the segments after /admin (already percent-decoded) and the query
// string. Never throws.
export function parseAdminPath(rest = [], search = '') {
  if (rest.length === 0) return { page: 'admin' };
  const section = String(rest[0]).toLowerCase();
  if (!ADMIN_SECTIONS.includes(section)) return { page: 'not-found' };
  const query = parseAdminQuery(section, search);
  if (rest.length === 1) return { page: 'admin', section, query };
  const id = String(rest[1]);
  if (section === 'orders' && rest.length === 3 && isUuid(id) && String(rest[2]).toLowerCase() === 'print') {
    return { page: 'admin', section, id: id.toLowerCase(), view: 'print', query: parseAdminQuery(section, search, 'print') };
  }
  if (rest.length !== 2) return { page: 'not-found' };
  if (section === 'accounts' && isUuid(id)) return { page: 'admin', section, id: id.toLowerCase(), query };
  if (section === 'products') {
    if (id.toLowerCase() === 'new') return { page: 'admin', section, id: 'new', query };
    const productId = positiveInt(id);
    if (productId != null) return { page: 'admin', section, id: productId, query };
  }
  return { page: 'not-found' };
}

// The path of an admin route, without its query string.
export function adminPath(route = {}) {
  if (!route.section || !ADMIN_SECTIONS.includes(route.section)) return '/admin';
  let path = `/admin/${route.section}`;
  if (route.id != null && route.id !== '') path += `/${route.id}`;
  if (route.id != null && route.view) path += `/${route.view}`;
  return path;
}

// The href of an admin route: its path plus its section's query.
export const adminHref = (route = {}) => adminPath(route)
  + (route.section ? adminQueryString(route.section, route.query, route.id != null ? route.view : null) : '');

// The section a route shows: bare /admin is Orders.
export const adminSection = (route) => (ADMIN_SECTIONS.includes(route?.section) ? route.section : 'orders');
