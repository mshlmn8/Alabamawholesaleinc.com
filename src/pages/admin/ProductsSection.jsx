// Admin -> Products: the catalog rows with their photo and list price
// (/admin/products), and the product editor (ProductEditor.jsx) at
// /admin/products/:id and /admin/products/new (AW-023). The rows are loaded
// once here and shared by both, so coming back from the editor shows the
// list at once, where it was.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { formatMoney } from '../../lib/format.js';
import { productImage } from '../../lib/images.js';
import { MISSING_FUNCTION_CODES } from '../../lib/pricing.js';
import { MAX_PRODUCT_QUERY } from '../../lib/adminRoutes.js';
import { Link, navigate } from '../../lib/router.js';
import { MissingPhoto } from '../../components/MissingPhoto.jsx';
import { adminErrorMessage, withStatus } from './adminData.js';
import { LoadProblem } from './AdminStatus.jsx';
import { ProductEditor } from './ProductEditor.jsx';

// The product columns Admin -> Products reads. Never price: admins read list
// prices through admin_product_prices() (AW-003).
const ADMIN_PRODUCT_COLUMNS = 'id,name,brand,cat,sub,sku,tag,active';
// What the load tries, in order, while the database answers 42703 (a column
// it doesn't have yet): everything the editor edits; then without
// stock_status and featured_rank (before 20261010120000); then without
// variant_axis and unavailable_variants (before 20261009110000).
export const ADMIN_COLUMN_STEPS = [
  `${ADMIN_PRODUCT_COLUMNS},updated_at,description,sell_unit,variants,variant_axis,unavailable_variants,img,stock_status,featured_rank`,
  `${ADMIN_PRODUCT_COLUMNS},updated_at,description,sell_unit,variants,variant_axis,unavailable_variants,img`,
  `${ADMIN_PRODUCT_COLUMNS},updated_at,description,sell_unit,variants,img`,
];
// The step that worked last, so the next load starts there.
let workingStep = 0;
export const resetAdminProductColumnsForTests = () => { workingStep = 0; };

// A product's own variant prices from admin_product_prices():
// { "<label>": { list } } -> { "<label>": list }.
const variantPricesOf = (entry) => Object.fromEntries(
  Object.entries(entry?.variants || {}).map(([label, value]) => [label, value?.list ?? null]),
);

// Products and their list prices. Guests and signed-in accounts can't read
// products.price (AW-003), so the rows are read without it and the prices
// (and each variant's own) come from admin_product_prices(), which only
// admins may call. A database without that function (before 20261009100000)
// still lets select('*') read the price. Returns { rows, error, columns }:
// columns is the set of products columns the rows carry, which tells the
// editor what the database has.
export async function loadAdminProducts(client) {
  const pricing = client.rpc('admin_product_prices', {}, { get: true }).then((result) => result);
  let products = null;
  let step = workingStep;
  for (; step < ADMIN_COLUMN_STEPS.length; step += 1) {
    products = await client.from('products').select(ADMIN_COLUMN_STEPS[step]).order('id');
    if (products.error?.code !== '42703') break;
  }
  step = Math.min(step, ADMIN_COLUMN_STEPS.length - 1);
  const prices = await pricing;
  if (prices.error && MISSING_FUNCTION_CODES.includes(prices.error.code)) {
    const legacy = await client.from('products').select('*').order('id');
    const error = withStatus(legacy);
    if (error) return { rows: null, error, columns: null };
    const rows = (legacy.data || []).map((p) => ({ ...p, variantPrices: {} }));
    return { rows, error: null, columns: rows.length ? new Set(Object.keys(rows[0])) : null };
  }
  const error = withStatus(products) || withStatus(prices);
  if (error) return { rows: null, error, columns: null };
  workingStep = step;
  const listed = prices.data || {};
  return {
    rows: (products.data || []).map((p) => ({ ...p, price: listed[p.id]?.list ?? null, variantPrices: variantPricesOf(listed[p.id]) })),
    error: null,
    columns: new Set(ADMIN_COLUMN_STEPS[step].split(',')),
  };
}

// How long the search box waits after typing stops before it writes ?q=.
export const SEARCH_DEBOUNCE_MS = 300;

const editorHref = (id) => `/admin/products/${id}`;
export const NEW_PRODUCT_LINK_ID = 'new-product';
export const editLinkId = (id) => `edit-product-${id}`;
const currentUrl = () => window.location.pathname + window.location.search;

// route: the admin route; route.id is a product id or 'new' for the editor.
// query: the URL's filters (q, AW-118); onQuery writes them.
// notify: shows what a change did (useAdminStatus).
// returnFocusId / onReturnFocus: the control the list focuses when it shows
// again (AdminPage keeps it), e.g. the Edit link of the product just saved.
export function ProductsTab({ route = {}, query = {}, onQuery, onCatalogChange, notify, returnFocusId = null, onReturnFocus }) {
  const [data, setData] = useState({ rows: null, columns: null });
  const [loadError, setLoadError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  // The editor URL the list opened, so leaving it goes Back to the list with
  // its filters and scroll position; an editor opened any other way goes to
  // the list by link.
  const [openedFrom, setOpenedFrom] = useState(null);

  // A failed load says so, with Try again, never "0 of 0 products" (AW-202);
  // rows already on screen stay.
  const reload = () => loadAdminProducts(supabase).then(({ rows, error, columns }) => {
    setLoadError(error ? adminErrorMessage(error, 'The products didn’t load') : null);
    if (rows) setData({ rows, columns });
  });
  useEffect(() => { reload(); }, []);
  const retry = async () => {
    setRetrying(true);
    await reload();
    setRetrying(false);
  };

  // productId: the product whose Edit link takes focus (null: New product).
  const leaveEditor = (productId) => {
    onReturnFocus?.(productId != null ? editLinkId(productId) : NEW_PRODUCT_LINK_ID);
    const back = openedFrom && openedFrom === currentUrl();
    setOpenedFrom(null);
    if (back) window.history.back();
    else navigate('/admin/products', { replace: true, force: true });
  };

  if (route.id != null) {
    return (
      <ProductEditor
        key={`${route.id}|${query.from ?? ''}`}
        id={route.id} fromId={query.from ?? null} rows={data.rows} columns={data.columns}
        loadError={loadError} onRetry={retry} retrying={retrying}
        onSaved={() => { onCatalogChange?.(); return reload(); }} notify={notify} onLeave={leaveEditor}
      />
    );
  }
  return (
    <ProductsList
      rows={data.rows} loadError={loadError} onRetry={retry} retrying={retrying} query={query} onQuery={onQuery}
      onOpen={setOpenedFrom} returnFocusId={returnFocusId} onReturnFocus={onReturnFocus}
    />
  );
}

// The 48px photo of a row (AW-023): the bundled file or the uploaded one, or
// the "photo coming soon" mark.
function Thumb({ img }) {
  const src = productImage(img).img;
  return src
    ? <img className="product-thumb" src={src} width="48" height="48" alt="" loading="lazy" />
    : <span className="product-thumb"><MissingPhoto compact /></span>;
}

function ProductsList({ rows, loadError, onRetry, retrying, query, onQuery, onOpen, returnFocusId, onReturnFocus }) {
  // The search box filters as you type and keeps ?q= in step a moment later,
  // so a reload, a bookmark or Back shows the same search. `seen` is the q
  // last read from the URL: a new one (Back, Forward, the section link) goes
  // into the box, the box's own writes don't come back into it.
  const urlSearch = query.q || '';
  const [search, setSearch] = useState(urlSearch);
  const [seen, setSeen] = useState(urlSearch);
  if (urlSearch !== seen) {
    setSeen(urlSearch);
    setSearch(urlSearch);
  }
  useEffect(() => {
    const next = search.trim().slice(0, MAX_PRODUCT_QUERY).trim();
    if (next === urlSearch || !onQuery) return undefined;
    const timer = setTimeout(() => {
      setSeen(next);
      onQuery({ ...query, q: next, page: undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, urlSearch, query, onQuery]);

  // Back from the editor: focus returns to the Edit link of the product that
  // was open (or to New product), once the rows are on screen.
  useEffect(() => {
    if (!returnFocusId || !rows) return;
    const target = document.getElementById(returnFocusId) || document.getElementById(NEW_PRODUCT_LINK_ID);
    onReturnFocus?.(null);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest' });
  }, [returnFocusId, rows, onReturnFocus]);

  if (!rows) {
    return loadError ? <LoadProblem message={loadError} onRetry={onRetry} retrying={retrying} /> : <p className="result-note">Loading…</p>;
  }

  const needle = search.trim().toLowerCase();
  const filtered = !needle ? rows : rows.filter(r =>
    String(r.name || '').toLowerCase().includes(needle) ||
    String(r.brand || '').toLowerCase().includes(needle) ||
    String(r.sku || '').toLowerCase().includes(needle)
  );
  const open = (href) => () => onOpen?.(href);

  return (
    <div>
      <div className="admin-products-head">
        <label className="filter-search admin-search">Search products
          <input type="search" placeholder="Name, brand, or SKU" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <Link id={NEW_PRODUCT_LINK_ID} className="button" to={editorHref('new')} onClick={open(editorHref('new'))}>New product</Link>
      </div>
      <p className="result-note">{`${filtered.length} of ${rows.length} products`}</p>
      {loadError && <LoadProblem message={loadError} onRetry={onRetry} retrying={retrying} />}
      <div className="table-scroll">
        <table className="aw-table">
          <thead>
            <tr>
              {['ID', 'Photo', 'Name', 'Brand', 'Category', 'Price', 'Tag', 'Active'].map(h => (
                <th key={h}>{h}</th>
              ))}
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(p => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td className="product-thumb-cell"><Thumb img={p.img} /></td>
                <td>{p.name}</td>
                <td>{p.brand}</td>
                <td className="muted">{`${p.cat} / ${p.sub}`}</td>
                <td className="price">{p.price != null ? formatMoney(p.price) : 'On request'}</td>
                <td>{p.tag || '—'}</td>
                <td>{p.active ? 'Yes' : 'No'}</td>
                <td>
                  <div className="inline-actions">
                    <Link id={editLinkId(p.id)} className="button xs ghost" to={editorHref(p.id)} onClick={open(editorHref(p.id))}>
                      <span>Edit</span><span className="sr-only">{` ${p.name}`}</span>
                    </Link>
                    {p.active && (
                      <Link className="button xs text" to={`/product/${p.id}`}>
                        <span>View on site</span><span className="sr-only">{`: ${p.name}`}</span>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 200 && <p className="result-note">Showing first 200 — narrow the search to see others.</p>}
    </div>
  );
}
