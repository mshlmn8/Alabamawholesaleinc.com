// Admin dashboard: orders, account approvals, product catalog edits.
// All write paths use the row-level-security policies in 20260517000001_rls_policies.sql.

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { DOCUMENT_TYPES, createDocumentViewUrl, listAllProfileDocuments } from '../../lib/documents.js';
import { formatMoney } from '../../lib/format.js';
import { MISSING_FUNCTION_CODES, lineTotal } from '../../lib/pricing.js';
import { Link } from '../../lib/router.js';
import { Breadcrumbs, HOME_CRUMB } from '../../components/Breadcrumbs.jsx';
import { AccountLoading, AccountProblem } from '../../components/AccountStatus.jsx';

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'products', label: 'Products' },
];

const ORDER_STATES = ['new', 'contacted', 'fulfilled', 'cancelled'];

// The tiers before pricing_tiers could be read here (AW-351): the options when
// that table can't be loaded.
const FALLBACK_TIERS = ['standard', 'silver', 'gold'];

// The product columns the Products tab shows. Not price: admins read list
// prices through admin_product_prices() (AW-003).
const ADMIN_PRODUCT_COLUMNS = 'id,name,brand,cat,sub,sku,tag,active';

// onCatalogChange: a product was edited; the storefront loads the catalog
// again so this tab shows the edit at once (AW-191).
export function AdminPage({
  profile, account = profile ? 'ready' : 'signed-out', onSignIn, onRetry, retrying = false, onSignOut, signingOut = false,
  onCatalogChange,
}) {
  const [tab, setTab] = useState('orders');

  // While auth loads, a real admin sees "Loading", not "access denied"
  // (AW-087). Not a dead end otherwise (AW-232): signed-out visitors can sign
  // in, and signed-in accounts without the admin role get a way back. The
  // server boundary is RLS (is_admin()); this is only what the page shows.
  // (Laid out like the dashboard, so its heading stays put when it loads.)
  if (account === 'loading' || account === 'no-profile') {
    return (
      <section>
        <div className="page-head">
          <Breadcrumbs items={[HOME_CRUMB, { label: 'Admin' }]} />
          <p className="eyebrow">TRADE DESK</p>
          <h1>Admin</h1>
          {account === 'loading'
            ? <AccountLoading />
            : <AccountProblem onRetry={onRetry} retrying={retrying} onSignOut={onSignOut} signingOut={signingOut} />}
        </div>
      </section>
    );
  }
  if (!profile || profile.role !== 'admin') {
    return (
      <section className="page-head">
        <Breadcrumbs items={[HOME_CRUMB, { label: 'Admin' }]} />
        <p className="eyebrow">TRADE DESK</p>
        <h1>{profile ? 'This page is for the trade desk' : 'Sign in to continue'}</h1>
        <p>{profile
          ? 'The admin area is only open to Alabama Wholesale staff accounts. Your account doesn’t have access.'
          : 'The admin area is only open to Alabama Wholesale staff accounts. Sign in with a staff account to continue.'}</p>
        <div className="dialog-actions compact-actions">
          {profile
            ? <Link className="button" to="/account">My account <span aria-hidden="true">↗</span></Link>
            : <button className="button" type="button" onClick={onSignIn}>Sign in <span aria-hidden="true">↗</span></button>}
          <Link className="text-link" to="/">Back to home</Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head">
        <Breadcrumbs items={[HOME_CRUMB, { label: 'Admin' }]} />
        <p className="eyebrow">TRADE DESK</p>
        <h1>Admin</h1>
        <p>Orders, account approvals, and catalog edits.</p>
      </div>

      <div className="sub-pills" role="tablist" aria-label="Admin sections">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`sub-pill ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'orders' && <OrdersTab />}
      {tab === 'accounts' && <AccountsTab />}
      {tab === 'products' && <ProductsTab onCatalogChange={onCatalogChange} />}
    </section>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('new');

  const reload = () => {
    supabase
      .from('orders')
      .select('*, order_items(id, product_name, sku, qty, unit_price), profiles(business, name, pricing_tier)')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setOrders(data || []));
  };
  useEffect(reload, []);

  const updateStatus = async (id, status) => {
    await supabase.from('orders').update({ status }).eq('id', id);
    reload();
  };

  if (!orders) return <p className="result-note">Loading…</p>;
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const filters = [...ORDER_STATES, 'all'];

  return (
    <div>
      <div className="sub-pills" aria-label="Order status">
        {filters.map(s => (
          <button
            key={s}
            type="button"
            className={`sub-pill ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {`${s} (${orders.filter(o => s === 'all' || o.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="order-list">
        {filtered.map(o => (
          <article className="order-card" key={o.id}>
            <div className="order-head">
              <div>
                <b className="order-ref">{o.ref_num}</b>
                <small>
                  <span>{`${new Date(o.created_at).toLocaleString()} · ${o.business} · ${o.contact} · ${o.email} · ${o.phone}`}</span>
                  {o.ship_street && <span>{` · Deliver to ${o.ship_street}, ${o.ship_city} ${o.ship_state} ${o.ship_zip}`}</span>}
                  {/* Will-call quotes have no address since submit_quote v2 (AW-079). */}
                  {o.delivery === 'willcall' && <span> · Will-call pickup</span>}
                  {o.profiles?.pricing_tier && <span> · tier: <b>{o.profiles.pricing_tier}</b></span>}
                </small>
              </div>
              <select aria-label={`Status for ${o.ref_num}`} value={o.status} onChange={e => updateStatus(o.id, e.target.value)}>
                {ORDER_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <ul className="order-items">
              {(o.order_items || []).map(it => (
                <li key={it.id}>
                  <span><span>{`${it.qty} × ${it.product_name}`}</span> <span className="sku">{`(${it.sku})`}</span></span>
                  <span className="line-total">{it.unit_price != null ? formatMoney(lineTotal(it.unit_price, it.qty)) : '—'}</span>
                </li>
              ))}
            </ul>
            {o.notes && <p className="order-notes">{`Notes: ${o.notes}`}</p>}
            {/* The store's license details, when the quote came with them (AW-014). */}
            {(o.license_no || o.resale_cert_no || o.license_attested_at) && (
              <p className="order-notes">{`License: ${o.license_no || '—'} · Resale certificate: ${o.resale_cert_no || '—'} · ${o.license_attested_at ? 'License statement confirmed' : 'License statement not confirmed'}`}</p>
            )}
          </article>
        ))}
      </div>
      {filtered.length === 0 && <p className="result-note">No orders in this state.</p>}
    </div>
  );
}

function AccountsTab() {
  const [profiles, setProfiles] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [viewError, setViewError] = useState(null);
  const [tiers, setTiers] = useState(FALLBACK_TIERS);
  const reload = () => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => setProfiles(data || []));
    listAllProfileDocuments().then(setDocuments).catch(() => setDocuments([]));
  };
  useEffect(reload, []);
  // The tier options are the pricing_tiers rows (AW-351): adding a tier is one
  // row there.
  useEffect(() => {
    let cancelled = false;
    supabase.from('pricing_tiers').select('tier,discount_pct').order('discount_pct', { ascending: true }).then(({ data, error }) => {
      if (!cancelled && !error && Array.isArray(data) && data.length) setTiers(data.map(t => t.tier));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = {};
      for (const row of documents) {
        try {
          next[`${row.profile_id}:${row.document_type}`] = await createDocumentViewUrl(row.storage_path);
        } catch {
          next[`${row.profile_id}:${row.document_type}`] = null;
        }
      }
      if (!cancelled) setSignedUrls(next);
    })();
    return () => { cancelled = true; };
  }, [documents]);

  const viewDocument = async (row, profile, label) => {
    setViewError(null);
    try {
      const url = await createDocumentViewUrl(row.storage_path);
      if (!url) throw new Error('Could not open that file.');
      setSignedUrls(prev => ({ ...prev, [`${row.profile_id}:${row.document_type}`]: url }));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setViewError(`Couldn’t open the ${label.toLowerCase()} for ${profile.business || profile.name}.`);
    }
  };

  const updateProfile = async (id, patch) => {
    await supabase.from('profiles').update(patch).eq('id', id);
    reload();
  };

  if (!profiles) return <p className="result-note">Loading…</p>;

  return (
    <div className="table-scroll">
      {viewError && <p className="form-error" role="alert">{viewError}</p>}
      <table className="aw-table">
        <thead>
          <tr>
            {['Business', 'Contact', 'Email', 'Status', 'Tier', 'Role', 'Documents', 'Actions'].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map(p => (
            <tr key={p.id}>
              <td>{p.business || '—'}</td>
              <td>{p.name}</td>
              <td className="muted">{p.email}</td>
              <td>
                <select aria-label={`Status for ${p.business || p.name}`} value={p.status} onChange={e => updateProfile(p.id, { status: e.target.value })}>
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="suspended">suspended</option>
                </select>
              </td>
              <td>
                <select aria-label={`Tier for ${p.business || p.name}`} value={p.pricing_tier} onChange={e => updateProfile(p.id, { pricing_tier: e.target.value })}>
                  {(tiers.includes(p.pricing_tier) ? tiers : [...tiers, p.pricing_tier]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td>
                <select aria-label={`Role for ${p.business || p.name}`} value={p.role} onChange={e => updateProfile(p.id, { role: e.target.value })}>
                  <option value="customer">customer</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td>
                {p.status === 'pending' ? (
                  <ul className="doc-admin">
                    {DOCUMENT_TYPES.map(doc => {
                      const row = documents.find(item => item.profile_id === p.id && item.document_type === doc.id);
                      return (
                        <li key={doc.id}>
                          <span>{doc.label}</span>
                          {row ? (
                            <>
                              <span>On file</span>
                              {signedUrls[`${p.id}:${doc.id}`] ? (
                                <a href={signedUrls[`${p.id}:${doc.id}`]} target="_blank" rel="noopener noreferrer">
                                  View<span className="sr-only">{` ${doc.label} for ${p.business || p.name}`}</span>
                                </a>
                              ) : (
                                <button type="button" className="text-link" onClick={() => viewDocument(row, p, doc.label)}>
                                  View<span className="sr-only">{` ${doc.label} for ${p.business || p.name}`}</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="muted">Not on file</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : '—'}
              </td>
              <td>
                {p.status === 'pending' && (
                  <button className="mini-btn primary" type="button" onClick={() => updateProfile(p.id, { status: 'approved' })}>
                    Approve
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Products and their list prices. Guests and signed-in accounts can't read
// products.price (AW-003), so the rows are read without it and the prices
// come from admin_product_prices(), which only admins may call. A database
// without that function (before 20260928120000) still lets select('*') read
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

function ProductsTab({ onCatalogChange }) {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [search, setSearch] = useState('');

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

  const filtered = !search ? rows : rows.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.brand.toLowerCase().includes(search.toLowerCase()) ||
    r.sku.toLowerCase().includes(search.toLowerCase())
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
                    <button className="mini-btn primary" type="button" onClick={() => saveEditing(p.id)}>Save</button>
                    <button className="mini-btn quiet" type="button" onClick={() => { setEditing(null); setSaveError(null); }}>Cancel</button>
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
                  <button className="mini-btn" type="button" onClick={() => { setEditing({ ...p, priceText: priceInput(p.price) }); setSaveError(null); }}>Edit</button>
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
