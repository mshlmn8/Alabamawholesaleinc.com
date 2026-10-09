// The catalog a build describes (NEW-087, AW-181): the live products table,
// read the way a visitor's browser reads it, so the sitemap and each page's
// head tags list what staff have added in Admin and leave out what they have
// deactivated. scripts/build-sitemap.mjs loads it and keeps what it got for
// scripts/build-route-heads.mjs, so both describe the same catalog.
//
// The request is one read-only GET per 1000 rows to
// <VITE_SUPABASE_URL>/rest/v1/products?active=eq.true with the anon key
// (the apikey and Authorization headers, Range paging), the columns the head
// tags need and updated_at for each product's <lastmod>. Guests may read
// every one of them (20261009100000_price_boundary.sql grants them) and the
// products_public_read policy returns active rows only. A database without
// one of the newer columns answers 42703, and the next, shorter list is
// tried. No price, ever.
//
// When the backend can't be reached (or answers an error, or has no active
// products), or ALLOW_NO_BACKEND=1, the build describes the bundled catalog
// (src/data/products.js) instead and says so in a warning. Either way the
// result is a snapshot of the catalog at build time: a product added or
// deactivated later reaches the sitemap and the page files with the next
// deploy (NETLIFY-DEPLOY.md, "Pages and the catalog").
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { SUPABASE_URL_PATTERN } from './build-env.mjs';

const HEAD_COLUMNS = 'id,name,brand,cat,sub,sku,img,active,description,sell_unit';
// Tried in order while the database answers 42703 (a missing column):
// description_hidden comes with 20261012120000, and updated_at is left out
// last, as the products table has always had it.
export const SOURCE_COLUMNS = [
  `${HEAD_COLUMNS},description_hidden,updated_at`,
  `${HEAD_COLUMNS},updated_at`,
  HEAD_COLUMNS,
];
export const SOURCE_PAGE_SIZE = 1000;
const MAX_PAGES = 50;
// Each request (answer and rows) gives up after this long; the build then
// uses the bundled catalog rather than waiting on a backend that doesn't
// answer. A page of 1000 rows is about 300 kB.
export const SOURCE_TIMEOUT_MS = 60000;

class SourceError extends Error {
  constructor(message, { code = null, status = null } = {}) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// '0-999/1234' -> 1234; null without a total.
const totalOf = (contentRange) => {
  const m = /\/(\d+)\s*$/.exec(String(contentRange || ''));
  return m ? Number(m[1]) : null;
};

/**
 * Every active product row with `columns`, a page at a time.
 * @param {{ url: string, key: string, columns: string, fetchImpl?: typeof fetch, pageSize?: number, timeoutMs?: number }} options
 * @returns {Promise<object[]>} rows; throws a SourceError with the PostgREST code on an error answer
 */
export async function fetchLiveRows({ url, key, columns, fetchImpl = globalThis.fetch, pageSize = SOURCE_PAGE_SIZE, timeoutMs = SOURCE_TIMEOUT_MS }) {
  const endpoint = `${String(url).replace(/\/+$/, '')}/rest/v1/products?select=${encodeURIComponent(columns)}&active=eq.true&order=id.asc`;
  const rows = [];
  let total = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = rows.length;
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        'Range-Unit': 'items',
        Range: `${from}-${from + pageSize - 1}`,
        ...(page === 0 ? { Prefer: 'count=exact' } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // A range past the last row, when the count is an exact multiple of the page.
    if (response.status === 416 && rows.length) break;
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new SourceError(`the products request answered ${response.status}${body?.code ? ` (${body.code})` : ''}`, { code: body?.code || null, status: response.status });
    }
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new SourceError('the products request did not answer with a list of rows');
    if (page === 0) total = totalOf(response.headers.get('content-range'));
    rows.push(...batch);
    if (batch.length === 0) break;
    if (total !== null ? rows.length >= total : batch.length < pageSize) break;
  }
  return rows;
}

// Rows with a positive whole-number id, each once.
function validRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const id = Number(row?.id);
    if (!Number.isInteger(id) || id < 1 || seen.has(id)) return false;
    seen.add(id);
    return row.active !== false;
  });
}

/**
 * The catalog for this build: { source: 'live', rows, columns } from the
 * products table, or { source: 'bundled', reason } when the build must use
 * src/data/products.js. Warns (through `warn`) whenever it falls back.
 * @param {{ env: Record<string, string | undefined>, fetchImpl?: typeof fetch, warn?: (message: string) => void, timeoutMs?: number }} options
 */
export async function loadCatalogSource({ env, fetchImpl = globalThis.fetch, warn = (m) => console.warn(m), timeoutMs } = {}) {
  const bundled = (reason) => {
    warn(`catalog-source: using the bundled catalog (src/data/products.js), because ${reason}. The sitemap and page files list products as the bundled copy has them, not as staff have changed them in Admin.`);
    return { source: 'bundled', reason };
  };
  if (env?.ALLOW_NO_BACKEND === '1') return bundled('ALLOW_NO_BACKEND=1');
  const url = String(env?.VITE_SUPABASE_URL || '').trim();
  const key = String(env?.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!SUPABASE_URL_PATTERN.test(url) || !key) return bundled('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set');
  for (const columns of SOURCE_COLUMNS) {
    try {
      const rows = validRows(await fetchLiveRows({ url, key, columns, fetchImpl, timeoutMs }));
      if (!rows.length) return bundled('the live products table has no active products');
      return { source: 'live', rows, columns };
    } catch (err) {
      if (err?.code === '42703') continue;
      const what = err?.name === 'TimeoutError' ? `it did not answer within ${Math.round((timeoutMs ?? SOURCE_TIMEOUT_MS) / 1000)} s` : err?.message || String(err);
      return bundled(`the live catalog could not be read: ${what}`);
    }
  }
  return bundled('the live products table lacks the columns the site reads');
}

/**
 * The <lastmod> date of a product: its updated_at as YYYY-MM-DD (UTC), or
 * null without a valid one.
 * @param {string | null | undefined} updatedAt
 */
export function productDate(updatedAt) {
  if (!updatedAt) return null;
  const time = Date.parse(updatedAt);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
}

// The catalog build-sitemap.mjs loaded, kept for build-route-heads.mjs
// (outside dist, so it is never published). It belongs to one vite build:
// `stamp` is a hash of that build's dist/index.html, and a snapshot with
// another stamp is ignored.
const snapshotFile = (root) => path.join(root, 'node_modules', '.cache', 'aw-build', 'catalog.json');

export async function buildStamp(root) {
  const html = await fs.readFile(path.join(root, 'dist', 'index.html'));
  return createHash('sha256').update(html).digest('hex');
}

export async function writeSnapshot(root, source) {
  const file = snapshotFile(root);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ stamp: await buildStamp(root), ...source }));
}

// The snapshot of this build, or null.
export async function readSnapshot(root) {
  try {
    const data = JSON.parse(await fs.readFile(snapshotFile(root), 'utf8'));
    if (data?.stamp !== await buildStamp(root)) return null;
    if (data.source === 'live' && Array.isArray(data.rows)) return { source: 'live', rows: data.rows, columns: data.columns };
    if (data.source === 'bundled') return { source: 'bundled', reason: data.reason };
  } catch { /* none yet */ }
  return null;
}

/**
 * Vite's SSR loader for the app's own modules (products.js resolves its
 * photos through import.meta.glob, so plain Node can't import it). `mode`
 * 'production' loads the same .env files as `vite build`, so
 * import.meta.env.VITE_SITE_URL is the build's.
 * @param {string} root
 * @param {string[]} ids module paths from the root, e.g. '/src/lib/meta.js'
 * @returns {Promise<object[]>} the modules, in order
 */
export async function loadAppModules(root, ids) {
  const { createServer } = await import('vite');
  // As in the build: import.meta.env.DEV is false, so a photo the image
  // manifest lacks has no URL rather than a file:// one (src/lib/images.js).
  process.env.NODE_ENV = 'production';
  const server = await createServer({
    root,
    mode: 'production',
    configFile: path.join(root, 'vite.config.js'),
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    // Only plain modules are loaded: no dependency scan, which otherwise
    // races the close below and prints a page of 'Request is outdated' errors.
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const modules = [];
    for (const id of ids) modules.push(await server.ssrLoadModule(id));
    return modules;
  } finally {
    await server.close();
  }
}
