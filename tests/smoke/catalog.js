// A stand-in for the live products table in the smoke tests (AW-204). The
// rows come from supabase/seed/products.sql, which `npm run seed` generates
// from src/data/products.js, so the app sees the same catalog a freshly
// seeded database would serve. Without it the catalog request fails, and
// every page shows the "couldn't load the latest catalog" notice.
import { readFileSync } from 'node:fs';

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

// Answers one products request the way PostgREST does: active rows, in id
// order, the offset/limit page, and the total in Content-Range.
export function fulfillProducts(route, rows) {
  const req = route.request();
  if (req.method() !== 'GET') return route.abort();
  const url = new URL(req.url());
  const active = rows.filter((r) => r.active !== false).sort((a, b) => a.id - b.id);
  const offset = Number(url.searchParams.get('offset') || 0);
  const limit = Number(url.searchParams.get('limit') || active.length);
  const page = active.slice(offset, offset + limit);
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
