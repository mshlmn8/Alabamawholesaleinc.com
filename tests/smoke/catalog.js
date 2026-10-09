// A stand-in for the live products table in the smoke tests (AW-204). The
// rows come from supabase/seed/products.sql, which `npm run seed` generates
// from src/data/products.js, so the app sees the same catalog a freshly
// seeded database would serve. Without it the catalog request fails, and
// every page shows the "couldn't load the latest catalog" notice.
//
// Like the database after 20261009100000_price_boundary.sql, the table has no
// readable price: a request that names price, or asks for *, is refused with
// 42501, so a price request shows up as a failed catalog load. Approved
// buyers' prices come from fulfillMyPrices() instead (obviously synthetic
// test values, never catalog prices).
import { readFileSync } from 'node:fs';
import { tierUnitPrice } from '../../src/lib/pricing.js';

const SEED = new URL('../../supabase/seed/products.sql', import.meta.url);

// SQL literals in the generated seed: 'text' (with '' escapes), '[…]'::jsonb,
// null, true/false and numbers.
const TOKEN = /'((?:[^']|'')*)'(::jsonb)?|\b(null|true|false)\b|(-?\d+(?:\.\d+)?)/g;

function parseValues(tuple) {
  const values = [];
  for (const m of tuple.matchAll(TOKEN)) {
    if (m[1] !== undefined) {
      const text = m[1].replace(/''/g, "'");
      values.push(m[2] ? JSON.parse(text) : text);
    } else if (m[3] !== undefined) {
      values.push(m[3] === 'null' ? null : m[3] === 'true');
    } else {
      values.push(Number(m[4]));
    }
  }
  return values;
}

let cached = null;
// The seeded rows, as PostgREST returns them.
export function seedRows() {
  if (cached) return cached.map((r) => ({ ...r }));
  const sql = readFileSync(SEED, 'utf8');
  const insert = /insert into public\.products \(([^)]+)\) values/.exec(sql);
  const columns = insert[1].split(',').map((c) => c.trim());
  // Only the insert's own rows: the id and SKU guard before it (NEW-022) and
  // the sequence footer after it are not products.
  const end = sql.indexOf('\non conflict (id) do nothing;', insert.index);
  cached = sql.slice(insert.index, end === -1 ? undefined : end).split('\n')
    .filter((line) => /^\s+\(\d+,/.test(line))
    .map((line) => {
      const values = parseValues(line.trim().replace(/^\(/, '').replace(/\),?$/, ''));
      if (values.length !== columns.length) throw new Error(`seed row does not parse: ${line.slice(0, 80)}`);
      return Object.fromEntries(columns.map((c, i) => [c, values[i]]));
    });
  return cached.map((r) => ({ ...r }));
}

// Columns guests and signed-in accounts may not read (column privileges).
export const REVOKED_COLUMNS = ['price'];
// Every column of public.products the database has (after
// 20261009110000_variant_model.sql: variant_axis and unavailable_variants,
// no flavors; after 20261010120000_admin_product_editor.sql: stock_status and
// featured_rank). Columns the seed leaves out (unavailable_variants,
// featured_rank, stock_status) come back null, which the storefront reads as
// "every variant is available" and "no homepage rank".
const TABLE_COLUMNS = [
  'id', 'name', 'brand', 'cat', 'sub', 'sku', 'variants', 'variant_axis', 'unavailable_variants', 'img', 'tag', 'price', 'active',
  'updated_at', 'description', 'sell_unit', 'stock_status', 'featured_rank',
];

const postgrestError = (route, status, code, message) => route.fulfill({
  status,
  contentType: 'application/json',
  headers: { 'access-control-allow-origin': '*' },
  body: JSON.stringify({ code, message, details: null, hint: null }),
});

// Answers one products request the way PostgREST does: the columns in
// select= (42501 for a revoked column or *, 42703 for one the table doesn't
// have), active rows, in id order, the offset/limit page, and the total in
// Content-Range.
export function fulfillProducts(route, rows) {
  const req = route.request();
  if (req.method() !== 'GET') return route.abort();
  const url = new URL(req.url());
  const columns = (url.searchParams.get('select') || '*').split(',').map((c) => c.trim()).filter(Boolean);
  if (columns.includes('*') || columns.some((c) => REVOKED_COLUMNS.includes(c))) {
    return postgrestError(route, 401, '42501', 'permission denied for table products');
  }
  const unknown = columns.find((c) => !TABLE_COLUMNS.includes(c));
  if (unknown) return postgrestError(route, 400, '42703', `column products.${unknown} does not exist`);
  const active = rows.filter((r) => r.active !== false).sort((a, b) => a.id - b.id);
  const offset = Number(url.searchParams.get('offset') || 0);
  const limit = Number(url.searchParams.get('limit') || active.length);
  const page = active.slice(offset, offset + limit)
    .map((row) => Object.fromEntries(columns.map((c) => [c, row[c] ?? null])));
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-expose-headers': 'Content-Range',
      'content-range': page.length ? `${offset}-${offset + page.length - 1}/${active.length}` : `*/${active.length}`,
    },
    body: JSON.stringify(page),
  });
}

// An obviously synthetic list price for a product: 10.10, 11.10, … 19.10 by
// the id's last digit (every one of them less 5% ends in half a cent, so the
// rounding is exercised). Ids ending in 7 have none: "price on request".
export const syntheticListPrice = (id) => (Number(id) % 10 === 7 ? null : (1010 + 100 * (Number(id) % 10)) / 100);

// my_prices() for an approved buyer, the way the database builds it: every
// active product's list price and the tier's unit price, rounded to cents.
export function myPricesPayload(rows, { tier = 'silver', label = 'Test silver', discountPct = 5, listPrice = syntheticListPrice } = {}) {
  const products = {};
  for (const row of rows) {
    if (row.active === false) continue;
    const list = listPrice(row.id);
    products[row.id] = { list, unit: tierUnitPrice(list, discountPct), variants: {} };
  }
  return { tier, tier_label: label, discount_pct: discountPct, products };
}

// Answers GET/POST /rest/v1/rpc/my_prices with myPricesPayload().
export function fulfillMyPrices(route, rows = seedRows(), options = {}) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(myPricesPayload(rows, options)),
  });
}

// The hero photos (public.home_slides, AW-119). The live database doesn't
// have the table until 20261011131000_home_slides.sql is applied, and
// PostgREST answers that with a 404 and PGRST205, so that is the default
// answer here; pass rows to serve them instead (active rows only, in sort
// then id order, the columns in select=, like the database).
export const HOME_SLIDES_MISSING = Object.freeze({ code: 'PGRST205', message: "Could not find the table 'public.home_slides' in the schema cache" });

export function fulfillHomeSlides(route, slides = null) {
  const req = route.request();
  if (req.method() !== 'GET') return route.abort();
  if (!slides) return postgrestError(route, 404, HOME_SLIDES_MISSING.code, HOME_SLIDES_MISSING.message);
  const url = new URL(req.url());
  const columns = (url.searchParams.get('select') || '*').split(',').map((c) => c.trim()).filter(Boolean);
  const rows = slides.filter((r) => r.active !== false)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id)
    .map((row) => (columns.includes('*') ? row : Object.fromEntries(columns.map((c) => [c, row[c] ?? null]))));
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(rows) });
}

// Serves the seeded catalog to every page of a context (or one page), and
// answers the hero photos request (fulfillHomeSlides) so a smoke run never
// reaches a real project. `rows()` may return a different list per request,
// e.g. to take a product out of the catalog mid-test; `homeSlides()` returns
// home_slides rows, or null for "no table yet" (the default).
export async function serveCatalog(target, { rows = () => seedRows(), homeSlides = () => null } = {}) {
  const calls = [];
  await target.route(/\/rest\/v1\/products/, (route) => {
    calls.push(route.request().url());
    return fulfillProducts(route, rows());
  });
  await target.route(/\/rest\/v1\/home_slides/, (route) => fulfillHomeSlides(route, homeSlides()));
  return calls;
}

// serveCatalog without Playwright routing (NEW-006). page.route and
// context.route turn the browser's HTTP cache off, and the offline specs
// need it on: the files fetched ahead must come from that cache. So a
// stand-in for window.fetch, installed before the site's code runs, answers
// Supabase inside the page: products as fulfillProducts does, home_slides as
// "no table yet", and every other Supabase request fails like a dropped
// connection. Nothing reaches a real project; other requests go out as
// usual (only the preview server's own files, under the site's CSP).
export async function serveCatalogInPage(context, { rows = seedRows() } = {}) {
  await context.addInitScript(({ rows: all, columnsOfTable, revoked }) => {
    const realFetch = window.fetch.bind(window);
    const json = (status, body, headers = {}) => Promise.resolve(new Response(JSON.stringify(body), {
      status, headers: { 'content-type': 'application/json', ...headers },
    }));
    const products = (url) => {
      const columns = (url.searchParams.get('select') || '*').split(',').map((c) => c.trim()).filter(Boolean);
      if (columns.includes('*') || columns.some((c) => revoked.includes(c))) return json(401, { code: '42501', message: 'permission denied for table products', details: null, hint: null });
      const unknown = columns.find((c) => !columnsOfTable.includes(c));
      if (unknown) return json(400, { code: '42703', message: `column products.${unknown} does not exist`, details: null, hint: null });
      const active = all.filter((r) => r.active !== false).sort((a, b) => a.id - b.id);
      const offset = Number(url.searchParams.get('offset') || 0);
      const limit = Number(url.searchParams.get('limit') || active.length);
      const page = active.slice(offset, offset + limit).map((row) => Object.fromEntries(columns.map((c) => [c, row[c] ?? null])));
      return json(200, page, { 'content-range': page.length ? `${offset}-${offset + page.length - 1}/${active.length}` : `*/${active.length}` });
    };
    window.fetch = (input, init) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, window.location.href);
      if (!/\.supabase\.co$/.test(url.hostname)) return realFetch(input, init);
      const method = (init?.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
      if (method === 'GET' && /\/rest\/v1\/products$/.test(url.pathname)) return products(url);
      if (method === 'GET' && /\/rest\/v1\/home_slides$/.test(url.pathname)) return json(404, { code: 'PGRST205', message: "Could not find the table 'public.home_slides' in the schema cache" });
      return Promise.reject(new TypeError('Failed to fetch'));
    };
  }, { rows, columnsOfTable: TABLE_COLUMNS, revoked: REVOKED_COLUMNS });
}
