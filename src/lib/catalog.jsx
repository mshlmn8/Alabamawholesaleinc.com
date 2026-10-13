// The product catalog for the whole app (AW-204, AW-191). One CatalogProvider,
// mounted in main.jsx, loads the live products table from Supabase and keeps
// it current; App reads it with useCatalog() and passes products down.
//
// The copy of the catalog bundled with the site (src/data/products.js) is on
// screen until the live one arrives, so the first paint never waits for the
// network, and it stays as the fallback when Supabase can't be reached. What
// changed is that the app now knows which of the two it is showing and says
// so, instead of switching silently.
//
// useCatalog() returns:
//   products        the catalog to show
//   source          'static' (the bundled copy) | 'live' (from Supabase)
//   status          'loading'  the first live load is running
//                   'ready'    the live catalog is loaded (a refresh may be running)
//                   'error'    the last load failed; products are the bundled
//                              copy (source 'static') or the last live catalog
//                              (source 'live', from lastLoadedAt)
//                   'static'   no backend is configured: the bundled copy is
//                              the catalog
//   error           null, or { kind, message, at } for the last failed load;
//                   kind is 'network' | 'timeout' | 'empty' | 'failed'
//   lastLoadedAt    when the live catalog last loaded (ms), or null
//   refreshing      a load is running
//   slow            the first load has taken longer than CATALOG_SLOW_MS
//   settled         cart lines can be checked against products: the live
//                   catalog is on screen, or there is no backend (AW-083).
//                   The bundled copy alone is not enough to call a line gone.
//   refresh()       loads the catalog again. Resolves to { ok, products,
//                   error }; calls made while a load runs share it.
//   refreshIfStale() refresh(), but only when the catalog is older than
//                   CATALOG_MAX_AGE_MS or the last failure older than
//                   CATALOG_RETRY_MS
//
// Open tabs refresh by themselves (AW-191): when the tab comes back into view
// and the catalog is stale, when the connection comes back, and (from App)
// when the buyer moves to another page and it is stale. Checkout loads it
// again right before a submit (src/pages/QuotePage.jsx).
//
// The query pages through the table in CATALOG_PAGE_SIZE ranges, so the
// catalog is never cut off at PostgREST's row limit, and asks only for the
// columns the storefront uses. The catalog has no prices (AW-003): approved
// buyers' prices come from src/lib/prices.jsx.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase as defaultClient } from './supabase.js';
import { isNetworkError } from './errors.js';
import { PRODUCTS as STATIC_PRODUCTS } from '../data/products.js';
import { hydrateProducts } from './catalogRows.js';

// A tab that comes back into view (or moves to another page) loads the
// catalog again once it is older than this.
export const CATALOG_MAX_AGE_MS = 5 * 60 * 1000;
// After a failed load, the same triggers try again once this has passed.
export const CATALOG_RETRY_MS = 30 * 1000;
// The first load says it is still loading after this long.
export const CATALOG_SLOW_MS = 3000;
// A load that has not finished after this long is given up (and reported).
export const CATALOG_TIMEOUT_MS = 15000;
// Rows per request. Supabase's default PostgREST row limit is 1000; a lower
// limit on the server is handled too (the loop goes by the row count).
export const CATALOG_PAGE_SIZE = 1000;
const MAX_PAGES = 50;

// The columns the storefront reads. updated_at is left out, and so is price:
// from supabase/migrations/20261009100000_price_boundary.sql guests and
// signed-in accounts can't read it (a select naming it, or select('*'), fails
// with 42501), and nothing but my_prices() hands prices out. A column added to
// products needs its own `grant select (<column>)` in that migration's style
// before it can be listed here.
// TODO(owner): What is the real wholesale list price of each of the 368 SKUs? The prices in the database are placeholders; load the real ones through Admin -> Products or a private SQL file under supabase/private/ (BACKEND.md, "Loading your list prices"). (AW-002)
// variant_axis and unavailable_variants come with
// 20261009110000_variant_model.sql (AW-128, AW-030), which also drops the
// old flavors count (AW-332).
export const CATALOG_COLUMNS = 'id,name,brand,cat,sub,sku,variants,variant_axis,unavailable_variants,img,tag,active,description,sell_unit';
// Every database since 20260927120000_product_copy.sql has these, before and
// after 20261009110000 (the Phase 1 list without price and flavors).
export const CATALOG_BASE_COLUMNS = 'id,name,brand,cat,sub,sku,variants,img,tag,active,description,sell_unit';
// featured_rank, the order of the homepage rails (AW-119), comes with
// 20261010120000_admin_product_editor.sql. It is a tier of its own, tried
// first, so a database without it still gets every variant column.
// (stock_status, from the same file, is staff only for now: AW-023.)
// description_hidden, staff's "Show no description" (AW-023), comes with
// 20261012120000_product_description_hidden.sql, which goes in with or after
// 20261010120000; it rides in the same tier rather than adding a round trip
// to every load of a database without either (NEW-024), so a database with
// 20261010120000 but not 20261012120000 is read without featured_rank.
export const CATALOG_RANKED_COLUMNS = `${CATALOG_COLUMNS},featured_rank,description_hidden`;
// What a load tries, in order, while the database answers 42703 (a column
// it doesn't have, i.e. a missing migration). '*' works only on a database
// from before 20261009100000, where every column is readable.
export const CATALOG_COLUMN_FALLBACKS = [...new Set([CATALOG_RANKED_COLUMNS, CATALOG_COLUMNS, CATALOG_BASE_COLUMNS, '*'])];

// The list that worked last (NEW-024). A database without 20261009110000
// and 20261010120000 answers the first two lists with 42703, so walking the
// whole list on every load (first paint, each refreshIfStale, each check
// before a quote is sent) cost two failed requests, and two console errors,
// each time. A load starts from the list that worked instead, as orders.js
// does with submit_quote's signature. It goes back to the full list once
// CATALOG_MAX_AGE_MS has passed since that list was chosen, and on each page
// load (this is module state), so the full columns come back within minutes
// of the migrations being applied. A failed load forgets it. Only loads with
// CATALOG_COLUMN_FALLBACKS use it.
let workingColumns = null; // { index, at }
export const resetCatalogColumnsForTests = () => { workingColumns = null; };

function firstColumnList(fallbacks, now) {
  if (fallbacks !== CATALOG_COLUMN_FALLBACKS || !workingColumns) return 0;
  if (now - workingColumns.at >= CATALOG_MAX_AGE_MS) {
    workingColumns = null;
    return 0;
  }
  return workingColumns.index;
}

// index: the list that worked, or null when the load failed.
function rememberColumnList(fallbacks, index, now) {
  if (fallbacks !== CATALOG_COLUMN_FALLBACKS) return;
  if (!index) workingColumns = null;
  // The same list again keeps the time it was first chosen.
  else if (workingColumns?.index !== index) workingColumns = { index, at: now };
}

// Live rows in the storefront's shape: src/lib/catalogRows.js, which the
// build also loads for each page's head tags (AW-181).
export { hydrateProducts };

// Every active product, a page at a time. Returns { rows } or { error }.
export async function fetchCatalogRows(client, { signal = null, columns = CATALOG_COLUMNS, pageSize = CATALOG_PAGE_SIZE } = {}) {
  const rows = [];
  let total = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = rows.length;
    let query = client.from('products')
      .select(columns, page === 0 ? { count: 'exact' } : undefined)
      .eq('active', true)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error, count } = await query;
    if (error) return { rows: null, error };
    if (page === 0 && typeof count === 'number') total = count;
    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);
    if (batch.length === 0) break;
    if (total !== null ? rows.length >= total : batch.length < pageSize) break;
  }
  return { rows, error: null };
}

const messageOf = (err) => String(err?.message || err || 'Unknown error').slice(0, 300);

function failure(err, timedOut) {
  if (timedOut) return { kind: 'timeout', message: 'The catalog took too long to load.' };
  return { kind: isNetworkError(err) ? 'network' : 'failed', message: messageOf(err) };
}

// One load of the live catalog: { ok: true, rows } or { ok: false, error }.
// Gives up after timeoutMs. A table without one of CATALOG_COLUMNS (a
// database that is missing a migration) is read with the next column list in
// CATALOG_COLUMN_FALLBACKS instead, and the next load starts from the list
// that worked (workingColumns, NEW-024).
export async function loadCatalog(client, { timeoutMs = CATALOG_TIMEOUT_MS, fallbacks = CATALOG_COLUMN_FALLBACKS } = {}) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : 0;
  const signal = controller?.signal || null;
  let index = firstColumnList(fallbacks, Date.now());
  let worked = null;
  try {
    let result = null;
    for (; index < fallbacks.length; index += 1) {
      result = await fetchCatalogRows(client, { signal, columns: fallbacks[index] });
      if (result.error?.code !== '42703') break;
    }
    if (result.error) return { ok: false, error: failure(result.error, !!signal?.aborted) };
    if (!result.rows.length) return { ok: false, error: { kind: 'empty', message: 'The live catalog has no active products.' } };
    worked = index;
    return { ok: true, rows: result.rows };
  } catch (err) {
    return { ok: false, error: failure(err, !!signal?.aborted) };
  } finally {
    clearTimeout(timer);
    rememberColumnList(fallbacks, worked, Date.now());
  }
}

// Whether refreshIfStale() should load the catalog again at `now`.
export function catalogIsStale({ status, lastLoadedAt, error }, now = Date.now()) {
  if (status === 'error') return now - (error?.at || 0) >= CATALOG_RETRY_MS;
  if (status === 'ready') return now - (lastLoadedAt || 0) >= CATALOG_MAX_AGE_MS;
  return false;
}

function initialState(backend) {
  return {
    products: STATIC_PRODUCTS,
    source: 'static',
    status: backend ? 'loading' : 'static',
    error: null,
    lastLoadedAt: null,
    refreshing: backend,
  };
}

export const CatalogContext = createContext(null);

const STATIC_RESULT = Object.freeze({ ok: true, products: STATIC_PRODUCTS, error: null });

export function CatalogProvider({ client = defaultClient, children }) {
  const [state, setState] = useState(() => initialState(!!client));
  const [slow, setSlow] = useState(false);

  // Read by event handlers and the load callback only.
  const stateRef = useRef(state);
  const inflightRef = useRef(null);
  const activeRef = useRef(false);
  const signatureRef = useRef(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  const refresh = useCallback(() => {
    if (!client) return Promise.resolve(STATIC_RESULT);
    if (inflightRef.current) return inflightRef.current;
    setState((prev) => (prev.refreshing ? prev : { ...prev, refreshing: true }));
    const fail = (error) => {
      if (activeRef.current) setState((prev) => ({ ...prev, status: 'error', error, refreshing: false }));
      return { ok: false, products: null, error };
    };
    const run = loadCatalog(client).then((result) => {
      inflightRef.current = null;
      const at = Date.now();
      if (!result.ok) return fail({ ...result.error, at });
      // An unchanged catalog keeps the same products array, so nothing that
      // depends on it re-renders.
      const signature = JSON.stringify(result.rows);
      const current = stateRef.current;
      let products = current.products;
      if (!(current.source === 'live' && signature === signatureRef.current)) {
        products = hydrateProducts(result.rows);
        signatureRef.current = signature;
      }
      if (activeRef.current) {
        setState({ products, source: 'live', status: 'ready', error: null, lastLoadedAt: at, refreshing: false });
      }
      return { ok: true, products, error: null };
    }).catch((err) => {
      // A row the storefront can't read: report it like a failed load.
      inflightRef.current = null;
      return fail({ ...failure(err, false), at: Date.now() });
    });
    inflightRef.current = run;
    return run;
  }, [client]);

  const refreshIfStale = useCallback(() => {
    if (!client || !catalogIsStale(stateRef.current)) return null;
    return refresh();
  }, [client, refresh]);

  // The first load, and the refreshes an open tab needs (AW-191).
  useEffect(() => {
    if (!client) return undefined;
    activeRef.current = true;
    // Shared with the load a first (StrictMode) mount started.
    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshIfStale();
    };
    const onOnline = () => { refresh(); };
    const onPageShow = (event) => {
      if (event.persisted) refreshIfStale();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      activeRef.current = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [client, refresh, refreshIfStale]);

  // "Still loading" after CATALOG_SLOW_MS of the first load.
  const loading = state.status === 'loading';
  useEffect(() => {
    if (!loading) return undefined;
    const timer = setTimeout(() => setSlow(true), CATALOG_SLOW_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  const value = useMemo(() => ({
    ...state,
    slow: loading && slow,
    settled: state.source === 'live' || state.status === 'static',
    refresh,
    refreshIfStale,
  }), [state, loading, slow, refresh, refreshIfStale]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useCatalog() needs a <CatalogProvider> above it (see src/main.jsx).');
  return value;
}
