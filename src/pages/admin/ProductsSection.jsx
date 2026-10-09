// Admin -> Products: the catalog rows with their list prices, and the inline
// edit row.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { formatMoney } from '../../lib/format.js';
import { MISSING_FUNCTION_CODES } from '../../lib/pricing.js';
import { MAX_PRODUCT_QUERY } from '../../lib/adminRoutes.js';

// The product columns the Products tab shows. Not price: admins read list
// prices through admin_product_prices() (AW-003).
const ADMIN_PRODUCT_COLUMNS = 'id,name,brand,cat,sub,sku,tag,active';

// Products and their list prices. Guests and signed-in accounts can't read
// products.price (AW-003), so the rows are read without it and the prices
// come from admin_product_prices(), which only admins may call. A database
// without that function (before 20261009100000) still lets select('*') read
// the price. A blank price is saved as null: "price on request".
export async function loadAdminProducts(client) {
  const [products, prices] = await Promise.all([
    client.from('products').select(ADMIN_PRODUCT_COLUMNS).order('id'),
    client.rpc('admin_product_prices', {}, { get: true }),
  ]);
  if (prices.error && MISSING_FUNCTION_CODES.includes(prices.error.code)) {
    const { data, error } = await client.from('products').select('*').order('id');
    return error ? { rows: null, error } : { rows: data || [], error: null };
  }
  const error = products.error || prices.error;
  if (error) return { rows: null, error };
  const listed = prices.data || {};
  return { rows: (products.data || []).map(p => ({ ...p, price: listed[p.id]?.list ?? null })), error: null };
}

// The price field as typed: '' (no price) or a non-negative amount.
const priceInput = (price) => (price == null ? '' : String(price));
function parsePriceInput(text) {
  const value = String(text).trim();
  if (value === '') return { ok: true, price: null };
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? { ok: true, price: Math.round(n * 100) / 100 } : { ok: false, price: null };
}

// How long the search box waits after typing stops before it writes ?q=.
export const SEARCH_DEBOUNCE_MS = 300;

// query: the URL's filters (q, AW-118); onQuery writes them.
export function ProductsTab({ query = {}, onQuery, onCatalogChange }) {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saveError, setSaveError] = useState(null);
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

  const reload = () => {
    loadAdminProducts(supabase).then(({ rows: next, error }) => {
      setLoadError(error ? 'The products didn’t load. Reload the page to try again.' : null);
      if (next) setRows(next);
      else setRows((current) => current || []);
    });
  };
  useEffect(reload, []);

  const save = async (id, patch) => {
    setSaveError(null);
    const { error } = await supabase.from('products').update(patch).eq('id', id);
    if (error) {
      setSaveError(`The changes to product ${id} weren’t saved (${error.message || 'unknown error'}). Try again.`);
      return;
    }
    setEditing(null);
    reload();
    onCatalogChange?.();
  };
  const saveEditing = (id) => {
    const parsed = parsePriceInput(editing.priceText);
    if (!parsed.ok) {
      setSaveError('Enter the price as an amount such as 12.50, or leave it blank for price on request.');
      return;
    }
    save(id, { name: editing.name, brand: editing.brand, price: parsed.price, tag: editing.tag, active: editing.active });
  };

  if (!rows) return <p className="result-note">Loading…</p>;

  const needle = search.trim().toLowerCase();
  const filtered = !needle ? rows : rows.filter(r =>
    String(r.name || '').toLowerCase().includes(needle) ||
    String(r.brand || '').toLowerCase().includes(needle) ||
    String(r.sku || '').toLowerCase().includes(needle)
  );

  return (
    <div>
      <label className="filter-search admin-search">Search products
        <input type="search" placeholder="Name, brand, or SKU" value={search} onChange={e => setSearch(e.target.value)} />
      </label>
      <p className="result-note">{`${filtered.length} of ${rows.length} products`}</p>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <div className="table-scroll">
        <table className="aw-table">
          <thead>
            <tr>
              {['ID', 'Name', 'Brand', 'Category', 'Price', 'Tag', 'Active', ''].map(h => (
                <th key={h || 'actions'}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map(p => editing?.id === p.id ? (
              <tr key={p.id} className="editing">
                <td>{p.id}</td>
                <td><input aria-label="Product name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></td>
                <td><input aria-label="Brand" value={editing.brand} onChange={e => setEditing({ ...editing, brand: e.target.value })} /></td>
                <td className="muted">{`${p.cat} / ${p.sub}`}</td>
                <td><input aria-label="Price" type="number" step="0.01" min="0" value={editing.priceText} onChange={e => setEditing({ ...editing, priceText: e.target.value })} /></td>
                <td>
                  <select aria-label="Tag" value={editing.tag || ''} onChange={e => setEditing({ ...editing, tag: e.target.value || null })}>
                    <option value="">—</option>
                    <option value="BESTSELLER">BESTSELLER</option>
                    <option value="NEW">NEW</option>
                    <option value="DEAL">DEAL</option>
                    <option value="PREMIUM">PREMIUM</option>
                  </select>
                </td>
                <td>
                  <input aria-label="Active" type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} />
                </td>
                <td>
                  <div className="inline-actions">
                    <button className="button xs" type="button" onClick={() => saveEditing(p.id)}>Save</button>
                    <button className="button xs text" type="button" onClick={() => { setEditing(null); setSaveError(null); }}>Cancel</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{p.brand}</td>
                <td className="muted">{`${p.cat} / ${p.sub}`}</td>
                <td className="price">{p.price != null ? formatMoney(p.price) : 'On request'}</td>
                <td>{p.tag || '—'}</td>
                <td>{p.active ? 'Yes' : 'No'}</td>
                <td>
                  <button className="button xs ghost" type="button" onClick={() => { setEditing({ ...p, priceText: priceInput(p.price) }); setSaveError(null); }}>Edit</button>
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
