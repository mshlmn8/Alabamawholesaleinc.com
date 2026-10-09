// The catalog provider (AW-204, AW-191): status, errors, paging, refreshes.
// Rows are test values. The catalog never asks for or keeps a price (AW-003).
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { StrictMode, useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CATALOG_BASE_COLUMNS, CATALOG_COLUMNS, CATALOG_COLUMN_FALLBACKS, CATALOG_MAX_AGE_MS, CATALOG_RETRY_MS, CATALOG_SLOW_MS, CatalogProvider,
  catalogIsStale, fetchCatalogRows, hydrateProducts, loadCatalog, useCatalog,
} from './catalog.jsx';
import { CATALOG, PRODUCTS as BUNDLED } from '../data/products.js';
import { IMAGE_FILE_ALIASES, currentImageFile } from '../data/catalogAliases.js';

const row = (id, extra = {}) => ({
  id, name: `Product ${id}`, brand: 'Brand', cat: 'TOBACCO', sub: 'Line', sku: `AW-T${id}`, variants: [], variant_axis: null,
  unavailable_variants: [], img: null, tag: null, active: true, description: `About ${id}`, sell_unit: '', ...extra,
});
const ROWS = [row(1), row(2), row(3), row(4), row(5)];

// A stand-in for supabase-js's query builder. `respond(query, n)` answers the
// nth request; by default rows are served by range, at most maxRows at a time.
function fakeClient({ rows = ROWS, maxRows = Infinity, count = true, respond } = {}) {
  const calls = [];
  const serve = (q) => {
    const [from, to] = q.range || [0, rows.length - 1];
    const end = Math.min(to, from + maxRows - 1);
    return { data: rows.slice(from, end + 1), error: null, count: count && q.options?.count ? rows.length : null };
  };
  const client = {
    calls,
    rows,
    from: vi.fn((table) => {
      const q = { table, columns: null, options: null, filters: [], range: null, signal: null };
      const builder = {
        select(columns, options) { q.columns = columns; q.options = options; return builder; },
        eq(column, value) { q.filters.push([column, value]); return builder; },
        order() { return builder; },
        range(from, to) { q.range = [from, to]; return builder; },
        abortSignal(signal) { q.signal = signal; return builder; },
        then(resolve, reject) {
          calls.push(q);
          const answer = respond ? respond(q, calls.length, serve) : serve(q);
          return Promise.resolve(answer).then(resolve, reject);
        },
      };
      return builder;
    }),
  };
  return client;
}

let seen = null;
function Spy() {
  const value = useCatalog();
  useEffect(() => { seen = value; });
  return null;
}
function Bare() {
  useCatalog();
  return null;
}
const mount = (client, { strict = false } = {}) => {
  const tree = <CatalogProvider client={client}><Spy /></CatalogProvider>;
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

let now = 1_000_000;
beforeEach(() => {
  seen = null;
  now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});
afterEach(() => {
  vi.useRealTimers();
  delete document.visibilityState;
});

describe('fetchCatalogRows', () => {
  it('asks for the active products and the storefront’s columns, in id order, with a count', async () => {
    const client = fakeClient();
    const { rows } = await fetchCatalogRows(client);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toMatchObject({ table: 'products', columns: CATALOG_COLUMNS, options: { count: 'exact' }, filters: [['active', true]], range: [0, 999] });
  });

  it('pages past a server row limit lower than the page size (AW-204)', async () => {
    const client = fakeClient({ maxRows: 2 });
    const { rows } = await fetchCatalogRows(client, { pageSize: 3 });
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(client.calls.map((q) => q.range)).toEqual([[0, 2], [2, 4], [4, 6]]);
    // Only the first request counts.
    expect(client.calls.slice(1).every((q) => q.options === undefined)).toBe(true);
  });

  it('without a count, pages until a short page', async () => {
    const client = fakeClient({ count: false });
    const { rows } = await fetchCatalogRows(client, { pageSize: 2 });
    expect(rows).toHaveLength(5);
    expect(client.calls).toHaveLength(3);
  });

  it('returns the error of a failed page', async () => {
    const client = fakeClient({ respond: (q, n, serve) => (n === 2 ? { data: null, error: { message: 'boom', code: 'XX000' } } : serve(q)) });
    const result = await fetchCatalogRows(client, { pageSize: 2 });
    expect(result).toEqual({ rows: null, error: { message: 'boom', code: 'XX000' } });
  });
});

describe('loadCatalog', () => {
  it('names network failures, server errors and an empty table', async () => {
    const network = fakeClient({ respond: () => ({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }) });
    expect((await loadCatalog(network)).error.kind).toBe('network');
    const failed = fakeClient({ respond: () => ({ data: null, error: { message: 'permission denied', code: '42501' } }) });
    expect((await loadCatalog(failed)).error).toEqual({ kind: 'failed', message: 'permission denied' });
    const empty = fakeClient({ rows: [] });
    expect((await loadCatalog(empty)).error.kind).toBe('empty');
  });

  it('gives up after the timeout', async () => {
    vi.useFakeTimers();
    const hanging = fakeClient({
      respond: (q) => new Promise((resolve) => {
        q.signal.addEventListener('abort', () => resolve({ data: null, error: { message: 'AbortError: aborted', code: '' } }));
      }),
    });
    const pending = loadCatalog(hanging, { timeoutMs: 5000 });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await pending).error.kind).toBe('timeout');
  });

  it('reads select(*) from a table that is missing one of the columns', async () => {
    const client = fakeClient({
      respond: (q, n, serve) => (q.columns === '*' ? serve(q) : { data: null, error: { message: 'column products.sell_unit does not exist', code: '42703' } }),
    });
    const result = await loadCatalog(client);
    expect(result.ok).toBe(true);
    expect(client.calls.map((q) => q.columns)).toEqual([CATALOG_COLUMNS, CATALOG_BASE_COLUMNS, '*']);
  });

  it('asks for the variant columns, and reads a database without them through the base list (AW-128, AW-030, AW-332)', async () => {
    const list = (columns) => columns.split(',');
    expect(list(CATALOG_COLUMNS)).toEqual(expect.arrayContaining(['variants', 'variant_axis', 'unavailable_variants', 'sell_unit']));
    expect(list(CATALOG_BASE_COLUMNS)).toEqual(expect.arrayContaining(['variants', 'sell_unit', 'description']));
    for (const columns of CATALOG_COLUMN_FALLBACKS) expect(list(columns)).not.toContain('flavors');
    for (const columns of [CATALOG_COLUMNS, CATALOG_BASE_COLUMNS]) expect(list(columns)).not.toContain('price');
    // The live database before 20261009110000: no variant_axis yet.
    const missing = { data: null, error: { message: 'column products.variant_axis does not exist', code: '42703' } };
    const old = fakeClient({ respond: (q, n, serve) => (q.columns === CATALOG_COLUMNS ? missing : serve(q)) });
    const result = await loadCatalog(old);
    expect(result.ok).toBe(true);
    expect(old.calls.map((q) => q.columns)).toEqual([CATALOG_COLUMNS, CATALOG_BASE_COLUMNS]);
  });

  it('never asks for price, and falls back column list by column list, ending with *', async () => {
    for (const columns of [CATALOG_COLUMNS, CATALOG_BASE_COLUMNS]) expect(columns.split(',')).not.toContain('price');
    expect(CATALOG_COLUMN_FALLBACKS.at(-1)).toBe('*');
    expect(new Set(CATALOG_COLUMN_FALLBACKS).size).toBe(CATALOG_COLUMN_FALLBACKS.length);
    const fallbacks = ['id,name,new_column', 'id,name', '*'];
    const missing = { data: null, error: { message: 'column products.new_column does not exist', code: '42703' } };
    const second = fakeClient({ respond: (q, n, serve) => (q.columns === fallbacks[0] ? missing : serve(q)) });
    expect((await loadCatalog(second, { fallbacks })).ok).toBe(true);
    expect(second.calls.map((q) => q.columns)).toEqual(['id,name,new_column', 'id,name']);
    // A revoked column (42501) is an error, not a reason to try select(*).
    const denied = fakeClient({ respond: () => ({ data: null, error: { message: 'permission denied for table products', code: '42501' } }) });
    expect((await loadCatalog(denied, { fallbacks })).error.kind).toBe('failed');
    expect(denied.calls.map((q) => q.columns)).toEqual(['id,name,new_column']);
  });
});

describe('hydrateProducts', () => {
  it('marks rows whose photo file another row uses (AW-136)', () => {
    const rows = hydrateProducts([
      row(1, { img: 'shared.jpg' }), row(2, { img: 'shared.jpg' }), row(3, { img: 'own.jpg' }), row(4, { img: null }),
    ]);
    expect(rows.map((p) => p.sharedPhoto)).toEqual([true, true, false, false]);
    // The bundled catalog is marked the same way: the two Backwoods rows share one photo.
    expect(BUNDLED.filter((p) => p.sharedPhoto).length).toBeGreaterThan(1);
    expect(BUNDLED.find((p) => p.id === 11).sharedPhoto).toBe(true);
    expect(BUNDLED.find((p) => p.id === 16).sharedPhoto).toBe(true);
  });

  it('builds the picture of a row that still names a renamed photo file from the new file (AW-290)', () => {
    // The live table keeps the old names until 20261010131000_photo_filenames.sql runs.
    const fabuloso = BUNDLED.find((p) => p.id === 128);
    const [live, renamed, url] = hydrateProducts([
      row(128, { img: 'fabulouso.avif' }),
      row(128, { img: 'p128-fabuloso.avif' }),
      row(3, { img: 'https://example.test/photo.jpg' }),
    ]);
    expect(live.picture.src).toMatch(/p128-fabuloso/);
    expect(live.picture).toEqual(fabuloso.picture);
    expect(live.img).toBe(fabuloso.img);
    expect(renamed.picture).toEqual(fabuloso.picture);
    expect(url.img).toBe('https://example.test/photo.jpg');
    // An old and a new name for the same file count as one shared photo (AW-136).
    expect(hydrateProducts([row(1, { img: 'electrolyte.webp' }), row(2, { img: 'p292-electrolit.webp' })]).map((p) => p.sharedPhoto)).toEqual([true, true]);
    expect(hydrateProducts([row(1, { img: 'electrolyte.webp' }), row(2, { img: null })]).map((p) => p.sharedPhoto)).toEqual([false, false]);
  });

  it('renamed photo files: each new file exists and is a row’s img, and no row or file keeps an old name (AW-290)', () => {
    const files = new Set(readdirSync(resolve(process.cwd(), 'src/assets/products')));
    const imgs = new Set(CATALOG.map((p) => p.img));
    for (const [from, to] of Object.entries(IMAGE_FILE_ALIASES)) {
      expect(files.has(to), to).toBe(true);
      expect(imgs.has(to), to).toBe(true);
      expect(files.has(from), from).toBe(false);
      expect(imgs.has(from), from).toBe(false);
      expect(to).toMatch(/^p\d+-[a-z0-9]+(-[a-z0-9]+)*\.[a-z]+$/);
    }
    expect(currentImageFile(' fabulouso.avif ')).toBe('p128-fabuloso.avif');
    expect(currentImageFile('gain.jpg')).toBe('gain.jpg');
    expect(currentImageFile(null)).toBe(null);
  });

  it('fills an empty description and sell unit from the bundled copy of the same id', () => {
    const bundled = BUNDLED.find((p) => p.description && p.sellUnit) || BUNDLED[0];
    const [p] = hydrateProducts([{ ...row(bundled.id), description: '', sell_unit: '', variants: null }]);
    expect(p.description).toBe(bundled.description);
    expect(p.sellUnit).toBe(bundled.sellUnit);
    expect(p.variants).toEqual([]);
    const [own] = hydrateProducts([row(bundled.id, { sell_unit: '5-pack' })]);
    expect(own.description).toBe(`About ${bundled.id}`);
    expect(own.sellUnit).toBe('5-pack');
  });

  it('maps the variant axis and availability, taking the bundled axis when the row has none (AW-128, AW-030)', () => {
    const bundled = BUNDLED.find((p) => p.variantAxis === 'Size');
    const [own, fallback, old] = hydrateProducts([
      row(bundled.id, { variant_axis: 'Flavor', unavailable_variants: ['Big'] }),
      row(bundled.id, { variant_axis: null, unavailable_variants: null }),
      // select('*') on a database from before 20261009110000.
      { ...row(bundled.id), variant_axis: undefined, unavailable_variants: undefined, flavors: 2 },
    ]);
    expect(own).toMatchObject({ variantAxis: 'Flavor', unavailableVariants: ['Big'] });
    expect(fallback).toMatchObject({ variantAxis: 'Size', unavailableVariants: [] });
    expect(old).toMatchObject({ variantAxis: 'Size', unavailableVariants: [] });
    expect('flavors' in old).toBe(false);
    const [unknown] = hydrateProducts([row(999999)]);
    expect(unknown).toMatchObject({ variantAxis: '', unavailableVariants: [] });
  });

  it('the bundled catalog has no flavors count, and an axis wherever there is a choice (AW-332, AW-128)', () => {
    expect(BUNDLED.some((p) => 'flavors' in p)).toBe(false);
    expect(BUNDLED.filter((p) => p.variants.length > 1).every((p) => p.variantAxis)).toBe(true);
  });

  it('drops a price that came along with select(*) on an older database (AW-003)', () => {
    const input = row(1, { price: 12.34 });
    const [p] = hydrateProducts([input]);
    expect('price' in p).toBe(false);
    expect(input.price).toBe(12.34);
  });

  it('the bundled catalog carries no prices (AW-003)', () => {
    expect(BUNDLED.length).toBeGreaterThan(0);
    expect(BUNDLED.some((p) => 'price' in p)).toBe(false);
  });
});

describe('catalogIsStale', () => {
  it('reloads a ready catalog after 5 minutes and a failed one after 30 seconds', () => {
    expect(catalogIsStale({ status: 'ready', lastLoadedAt: 0 }, CATALOG_MAX_AGE_MS - 1)).toBe(false);
    expect(catalogIsStale({ status: 'ready', lastLoadedAt: 0 }, CATALOG_MAX_AGE_MS)).toBe(true);
    expect(catalogIsStale({ status: 'error', error: { at: 0 } }, CATALOG_RETRY_MS - 1)).toBe(false);
    expect(catalogIsStale({ status: 'error', error: { at: 0 } }, CATALOG_RETRY_MS)).toBe(true);
    expect(catalogIsStale({ status: 'loading' }, 1e12)).toBe(false);
    expect(catalogIsStale({ status: 'static' }, 1e12)).toBe(false);
  });
});

describe('CatalogProvider', () => {
  it('without a backend, the bundled catalog is the catalog', async () => {
    mount(null);
    expect(seen).toMatchObject({ status: 'static', source: 'static', settled: true, error: null, products: BUNDLED });
    await expect(seen.refresh()).resolves.toMatchObject({ ok: true, products: BUNDLED });
  });

  it('shows the bundled copy while loading, then the live catalog, with one request under StrictMode', async () => {
    const client = fakeClient();
    mount(client, { strict: true });
    expect(seen).toMatchObject({ status: 'loading', source: 'static', settled: false, products: BUNDLED });
    await waitFor(() => expect(seen.status).toBe('ready'));
    expect(seen).toMatchObject({ source: 'live', settled: true, error: null, lastLoadedAt: now, refreshing: false });
    expect(seen.products.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
    expect(client.calls).toHaveLength(1);
  });

  it('reports a failed load, keeps the bundled copy, and recovers on retry (AW-204)', async () => {
    let fail = true;
    const client = fakeClient({ respond: (q, n, serve) => (fail ? { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } } : serve(q)) });
    mount(client);
    await waitFor(() => expect(seen.status).toBe('error'));
    expect(seen).toMatchObject({ source: 'static', settled: false, products: BUNDLED, error: { kind: 'network', at: now } });
    fail = false;
    let result;
    await act(async () => { result = await seen.refresh(); });
    expect(result.ok).toBe(true);
    expect(seen).toMatchObject({ status: 'ready', source: 'live', settled: true, error: null });
    expect(result.products).toBe(seen.products);
  });

  it('keeps the live catalog when a refresh fails', async () => {
    let fail = false;
    const client = fakeClient({ respond: (q, n, serve) => (fail ? { data: null, error: { message: 'boom', code: 'XX000' } } : serve(q)) });
    mount(client);
    await waitFor(() => expect(seen.status).toBe('ready'));
    const live = seen.products;
    fail = true;
    now += 1000;
    await act(async () => { await seen.refresh(); });
    expect(seen).toMatchObject({ status: 'error', source: 'live', settled: true, lastLoadedAt: 1_000_000, error: { kind: 'failed', at: now } });
    expect(seen.products).toBe(live);
  });

  it('reports rows it can’t read as a failed load instead of throwing', async () => {
    // JSON.stringify throws on a BigInt.
    mount(fakeClient({ rows: [row(1, { tag: 10n })] }));
    await waitFor(() => expect(seen.status).toBe('error'));
    expect(seen).toMatchObject({ source: 'static', refreshing: false, error: { kind: 'failed' } });
  });

  it('shares one load between overlapping calls, and keeps the same array when nothing changed', async () => {
    const client = fakeClient();
    mount(client);
    await waitFor(() => expect(seen.status).toBe('ready'));
    const first = seen.products;
    let a;
    let b;
    await act(async () => { [a, b] = await Promise.all([seen.refresh(), seen.refresh()]); });
    expect(client.calls).toHaveLength(2);
    expect(a).toBe(b);
    expect(seen.products).toBe(first);
    client.rows.push(row(6));
    await act(async () => { await seen.refresh(); });
    expect(seen.products).not.toBe(first);
    expect(seen.products).toHaveLength(6);
  });

  it('loads again when the tab comes back after 5 minutes, and when the connection returns (AW-191)', async () => {
    const client = fakeClient();
    mount(client);
    await waitFor(() => expect(seen.status).toBe('ready'));
    const back = async () => { await act(async () => { document.dispatchEvent(new Event('visibilitychange')); }); };
    await back();
    expect(client.calls).toHaveLength(1);
    now += CATALOG_MAX_AGE_MS;
    await back();
    await waitFor(() => expect(client.calls).toHaveLength(2));
    await waitFor(() => expect(seen.lastLoadedAt).toBe(now));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(client.calls).toHaveLength(3));
    // refreshIfStale follows the same rule.
    expect(seen.refreshIfStale()).toBeNull();
    now += CATALOG_MAX_AGE_MS;
    await act(async () => { await seen.refreshIfStale(); });
    expect(client.calls).toHaveLength(4);
  });

  it('does not load while the tab is hidden', async () => {
    const client = fakeClient();
    mount(client);
    await waitFor(() => expect(seen.status).toBe('ready'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    now += CATALOG_MAX_AGE_MS * 2;
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(client.calls).toHaveLength(1);
  });

  it('says a slow first load is slow', async () => {
    vi.useFakeTimers();
    let release;
    const client = fakeClient({ respond: (q, n, serve) => new Promise((resolve) => { release = () => resolve(serve(q)); }) });
    mount(client);
    expect(seen.slow).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(CATALOG_SLOW_MS); });
    expect(seen).toMatchObject({ status: 'loading', slow: true });
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(0); });
    expect(seen).toMatchObject({ status: 'ready', slow: false });
  });

  it('needs a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // React reports the render error to window as well; keep it out of the log.
    const swallow = (e) => e.preventDefault();
    window.addEventListener('error', swallow);
    try {
      expect(() => render(<Bare />)).toThrow(/CatalogProvider/);
    } finally {
      window.removeEventListener('error', swallow);
    }
  });
});
