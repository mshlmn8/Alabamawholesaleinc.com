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
  const columns = /insert into public\.products \(([^)]+)\) values/.exec(sql)[1].split(',').map((c) => c.trim());
  cached = sql.split('\n')
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

// Serves the seeded catalog to every page of a context (or one page).
// `rows()` may return a different list per request, e.g. to take a product
// out of the catalog mid-test.
export async function serveCatalog(target, { rows = () => seedRows() } = {}) {
  const calls = [];
  await target.route(/\/rest\/v1\/products/, (route) => {
    calls.push(route.request().url());
    return fulfillProducts(route, rows());
  });
  return calls;
}
