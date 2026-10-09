// @vitest-environment node
// The catalog a build describes (NEW-087). Every request goes to a fake
// fetch: these tests never reach the network.
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SOURCE_COLUMNS, SOURCE_PAGE_SIZE, fetchLiveRows, loadCatalogSource, productDate, readSnapshot, writeSnapshot,
} from './catalog-source.mjs';

const URL = 'https://abcdefghijklmnop.supabase.co';
const KEY = 'anon-test-key';
const ENV = { VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: KEY };

const row = (id, extra = {}) => ({ id, name: `P${id}`, brand: 'B', cat: 'TOBACCO', sub: 'Cigarettes', sku: `AW-${id}`, img: null, active: true, description: '', sell_unit: '', updated_at: '2026-10-01T12:00:00+00:00', ...extra });

// A fake PostgREST: answers each request from `answer(request)`, which gets
// { url, init, from, to, columns } and returns { status, body, range }.
function fakeFetch(answer) {
  const calls = [];
  const impl = vi.fn(async (url, init) => {
    const [from, to] = String(init.headers.Range).split('-').map(Number);
    const columns = decodeURIComponent(new globalThis.URL(url).searchParams.get('select'));
    const request = { url, init, from, to, columns };
    calls.push(request);
    const { status = 200, body = [], range = null } = await answer(request);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...(range ? { 'content-range': range } : {}) } });
  });
  return { impl, calls };
}

// The rows of a table of `n` products, a Range at a time, with the total.
const table = (n) => ({ from, to }) => {
  const rows = Array.from({ length: n }, (_, i) => row(i + 1));
  const body = rows.slice(from, to + 1);
  if (!body.length && from > 0) return { status: 416, body: { code: 'PGRST103', message: 'Requested range not satisfiable' } };
  return { status: body.length < n ? 206 : 200, body, range: `${from}-${from + body.length - 1}/${n}` };
};

beforeEach(() => {
  // Nothing here may reach the network.
  vi.stubGlobal('fetch', () => { throw new Error('network access in a unit test'); });
});
afterEach(() => vi.unstubAllGlobals());

describe('fetchLiveRows', () => {
  it('asks for active products only, read-only with the anon key, in Range pages', async () => {
    const { impl, calls } = fakeFetch(table(3));
    const rows = await fetchLiveRows({ url: `${URL}/`, key: KEY, columns: SOURCE_COLUMNS[0], fetchImpl: impl, pageSize: 2 });
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(calls).toHaveLength(2);
    const [first, second] = calls;
    expect(first.url).toBe(`${URL}/rest/v1/products?select=${encodeURIComponent(SOURCE_COLUMNS[0])}&active=eq.true&order=id.asc`);
    expect(first.init.method).toBe('GET');
    expect(first.init.body).toBeUndefined();
    expect(first.init.headers).toMatchObject({ apikey: KEY, Authorization: `Bearer ${KEY}`, 'Range-Unit': 'items', Range: '0-1', Prefer: 'count=exact' });
    expect(second.init.headers).toMatchObject({ Range: '2-3' });
    expect(second.init.headers.Prefer).toBeUndefined();
    expect(first.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('stops at the count, and treats a range past the end as the end', async () => {
    const exact = fakeFetch(table(4));
    expect(await fetchLiveRows({ url: URL, key: KEY, columns: 'id', fetchImpl: exact.impl, pageSize: 2 })).toHaveLength(4);
    expect(exact.calls).toHaveLength(2);
    // Without a count, a full last page asks once more and gets 416.
    const noCount = fakeFetch((req) => ({ ...table(4)(req), range: null }));
    expect(await fetchLiveRows({ url: URL, key: KEY, columns: 'id', fetchImpl: noCount.impl, pageSize: 2 })).toHaveLength(4);
    expect(noCount.calls).toHaveLength(3);
  });

  it('throws with the PostgREST code on an error answer', async () => {
    const { impl } = fakeFetch(() => ({ status: 400, body: { code: '42703', message: 'column products.description_hidden does not exist' } }));
    await expect(fetchLiveRows({ url: URL, key: KEY, columns: 'id', fetchImpl: impl })).rejects.toMatchObject({ code: '42703', status: 400 });
  });
});

describe('loadCatalogSource', () => {
  const quiet = () => {
    const warnings = [];
    return { warnings, warn: (m) => warnings.push(m) };
  };

  it('reads the live catalog with the head columns and updated_at', async () => {
    const { impl, calls } = fakeFetch(table(3));
    const { warnings, warn } = quiet();
    const source = await loadCatalogSource({ env: ENV, fetchImpl: impl, warn });
    expect(source).toEqual({ source: 'live', rows: [row(1), row(2), row(3)], columns: SOURCE_COLUMNS[0] });
    expect(calls).toHaveLength(1);
    expect(SOURCE_COLUMNS[0]).toMatch(/^id,.*\bcat\b.*\bsub\b.*\bactive\b.*updated_at$/);
    for (const columns of SOURCE_COLUMNS) expect(columns).not.toMatch(/price/);
    expect(warnings).toEqual([]);
    expect(SOURCE_PAGE_SIZE).toBe(1000);
  });

  it('on 42703 tries the next column list: without description_hidden, then without updated_at', async () => {
    const { impl, calls } = fakeFetch(({ columns, ...req }) => (/description_hidden|updated_at/.test(columns)
      ? { status: 400, body: { code: '42703', message: 'column does not exist' } }
      : table(2)({ columns, ...req })));
    const source = await loadCatalogSource({ env: ENV, fetchImpl: impl, warn: () => {} });
    expect(calls.map((c) => c.columns)).toEqual(SOURCE_COLUMNS);
    expect(source).toMatchObject({ source: 'live', columns: SOURCE_COLUMNS[2] });
    expect(SOURCE_COLUMNS[1]).toMatch(/updated_at$/);
    expect(SOURCE_COLUMNS[1]).not.toMatch(/description_hidden/);
    expect(SOURCE_COLUMNS[2]).not.toMatch(/updated_at/);
  });

  it('leaves out rows without a usable id, repeated ones and inactive ones', async () => {
    const { impl } = fakeFetch(() => ({ body: [row(2), row(2), { ...row(3), active: false }, { id: 'x' }, { id: 0 }, null, row(5)] }));
    const source = await loadCatalogSource({ env: ENV, fetchImpl: impl, warn: () => {} });
    expect(source.rows.map((r) => r.id)).toEqual([2, 5]);
  });

  it('falls back to the bundled catalog, with a warning, when it cannot use the backend', async () => {
    const cases = [
      [{ ...ENV, ALLOW_NO_BACKEND: '1' }, () => ({ body: [row(1)] }), /ALLOW_NO_BACKEND=1/],
      [{ VITE_SUPABASE_URL: URL }, () => ({ body: [row(1)] }), /VITE_SUPABASE_ANON_KEY is not set/],
      [{ ...ENV, VITE_SUPABASE_URL: 'https://example.com' }, () => ({ body: [row(1)] }), /not set/],
      [ENV, () => { throw new TypeError('fetch failed'); }, /could not be read: fetch failed/],
      [ENV, () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); }, /did not answer within 60 s/],
      [ENV, () => ({ status: 401, body: { message: 'Invalid API key' } }), /answered 401/],
      [ENV, () => ({ status: 500, body: { code: 'XX000' } }), /answered 500 \(XX000\)/],
      [ENV, () => ({ body: [] }), /no active products/],
      [ENV, () => ({ status: 400, body: { code: '42703' } }), /lacks the columns/],
    ];
    for (const [env, answer, reason] of cases) {
      const { impl } = fakeFetch(answer);
      const { warnings, warn } = quiet();
      const source = await loadCatalogSource({ env, fetchImpl: impl, warn });
      expect(source).toEqual({ source: 'bundled', reason: expect.stringMatching(reason) });
      expect(warnings).toEqual([expect.stringMatching(/using the bundled catalog \(src\/data\/products\.js\)/)]);
      if (env.ALLOW_NO_BACKEND || !env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_URL === 'https://example.com') expect(impl).not.toHaveBeenCalled();
    }
  });
});

describe('productDate', () => {
  it('gives a product’s <lastmod> from its updated_at, in UTC', () => {
    expect(productDate('2026-10-01T12:00:00+00:00')).toBe('2026-10-01');
    expect(productDate('2026-10-01T23:30:00-05:00')).toBe('2026-10-02');
    expect(productDate(null)).toBeNull();
    expect(productDate('soon')).toBeNull();
  });
});

describe('the build’s snapshot', () => {
  let root;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'aw-catalog-'));
    await mkdir(path.join(root, 'dist'));
    await writeFile(path.join(root, 'dist', 'index.html'), '<!doctype html><title>build 1</title>');
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it('hands the sitemap’s catalog to the page files of the same build only', async () => {
    expect(await readSnapshot(root)).toBeNull();
    await writeSnapshot(root, { source: 'live', rows: [row(1)], columns: SOURCE_COLUMNS[0] });
    expect(await readSnapshot(root)).toEqual({ source: 'live', rows: [row(1)], columns: SOURCE_COLUMNS[0] });
    await writeSnapshot(root, { source: 'bundled', reason: 'ALLOW_NO_BACKEND=1' });
    expect(await readSnapshot(root)).toEqual({ source: 'bundled', reason: 'ALLOW_NO_BACKEND=1' });
    // Another vite build: the snapshot is not this build's.
    await writeFile(path.join(root, 'dist', 'index.html'), '<!doctype html><title>build 2</title>');
    expect(await readSnapshot(root)).toBeNull();
  });
});
