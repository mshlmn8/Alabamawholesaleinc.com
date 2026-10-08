// Admin dashboard: orders, account approvals, product catalog edits.
// All write paths use the row-level-security policies in 20260517000001_rls_policies.sql.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { DOCUMENT_TYPES, createDocumentViewUrl, listAllProfileDocuments } from '../../lib/documents.js';

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'products', label: 'Products' },
];

// TODO(owner): Confirm staff should price guest quotes and convert them to orders, and that orders use quoted and confirmed before picking. (AW-024)
const ORDER_STATES = ['new', 'contacted', 'quoted', 'confirmed', 'picking', 'ready', 'out_for_delivery', 'fulfilled', 'cancelled'];

export function AdminPage({ profile, goHome }) {
  const [tab, setTab] = useState('orders');

  if (!profile || profile.role !== 'admin') {
    return (
      <section className="page-head">
        <p className="eyebrow">ADMIN</p>
        <h1>Access denied</h1>
        <p>Admin role required.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head">
        <div className="crumbs">
          <button type="button" onClick={goHome}>Home</button>
          <span aria-hidden="true">/</span>
          <span>Admin</span>
        </div>
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
      {tab === 'products' && <ProductsTab />}
    </section>
  );
}

function quoteMailBody(order, lines) {
  const rows = lines.map(line => `${line.qty} × ${line.product_name} (${line.sku}) @ $${Number(line.unit_price || 0).toFixed(2)}`).join('\n');
  const total = lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unit_price || 0), 0);
  return `Quote ${order.ref_num}\n\n${rows}\n\nTotal $${total.toFixed(2)}`;
}

function OrderCard({ order, onStatus, onReload }) {
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState(() => (order.order_items || []).map(line => ({
    ...line,
    unit_price: line.unit_price ?? line.products?.price ?? '',
  })));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const isQuote = order.kind === 'quote' || order.user_id == null;
  const savePrices = async () => {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('admin_price_order', {
      p_order_id: order.id,
      p_lines: lines.map(line => ({
        item_id: line.id,
        qty: Math.max(0, Math.floor(Number(line.qty) || 0)),
        unit_price: line.unit_price === '' ? null : Number(line.unit_price),
      })),
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message || 'Prices could not be saved. Apply the quote-workflow migration first.');
      return;
    }
    setEditing(false);
    onReload();
  };
  const convert = async () => {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('admin_convert_quote', {
      p_order_id: order.id,
      p_user_id: null,
    });
    setBusy(false);
    if (rpcError) setError(rpcError.message || 'This quote could not be converted yet.');
    else onReload();
  };
  return (
    <article className={`order-card${isQuote ? ' is-quote' : ''}`}>
      <div className="order-head">
        <div>
          <span className="order-kind">{isQuote ? 'Guest quote' : 'Trade order'}</span>
          <b className="order-ref">{order.ref_num}</b>
          <small>
            {new Date(order.created_at).toLocaleString()} · {order.business} · {order.contact}
            {' · '}<a href={`mailto:${order.email}`}>{order.email}</a>
            {order.phone && <> · <a href={`tel:${String(order.phone).replace(/[^\d+]/g, '')}`}>{order.phone}</a></>}
            {order.ship_street && <span> · Deliver to {order.ship_street}, {order.ship_city} {order.ship_state} {order.ship_zip}</span>}
            {order.license_no && <span> · Tobacco license {order.license_no}</span>}
            {order.resale_cert_no && <span> · Resale certificate {order.resale_cert_no}</span>}
            {order.purchasers_21 && <span> · 21+ purchasers confirmed</span>}
            {order.profiles?.pricing_tier && <span> · tier: <b>{order.profiles.pricing_tier}</b></span>}
          </small>
        </div>
        <select aria-label={`Status for ${order.ref_num}`} value={order.status} onChange={e => onStatus(order.id, e.target.value)}>
          {ORDER_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {editing ? (
        <div className="order-edit">
          {lines.map((line, index) => (
            <label key={line.id}>
              <span>{line.product_name} <span className="sku">({line.sku})</span></span>
              <input aria-label={`Quantity for ${line.product_name}`} type="number" min="0" value={line.qty} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, qty: e.target.value } : row))} />
              <input aria-label={`Unit price for ${line.product_name}`} type="number" min="0" step="0.01" value={line.unit_price} onChange={e => setLines(current => current.map((row, i) => i === index ? { ...row, unit_price: e.target.value } : row))} />
            </label>
          ))}
        </div>
      ) : (
        <ul className="order-items">
          {(order.order_items || []).map(it => (
            <li key={it.id}>
              <span>{it.qty} × {it.product_name} <span className="sku">({it.sku})</span>{it.unit_price != null ? ` · $${Number(it.unit_price).toFixed(2)} each` : ''}</span>
              <span className="line-total">{it.unit_price != null ? `$${(it.unit_price * it.qty).toFixed(2)}` : '—'}</span>
            </li>
          ))}
        </ul>
      )}
      {order.notes && <p className="order-notes">Notes: {order.notes}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="inline-actions">
        <button className="mini-btn" type="button" onClick={() => setEditing(value => !value)}>{editing ? 'Close editor' : 'Edit / price'}</button>
        {editing && <button className="mini-btn primary" type="button" disabled={busy} onClick={savePrices}>Save prices</button>}
        <a className="mini-btn" href={`mailto:${order.email}?subject=${encodeURIComponent(`Quote ${order.ref_num}`)}&body=${encodeURIComponent(quoteMailBody(order, editing ? lines : (order.order_items || [])))}`}>Email quote</a>
        {isQuote && <button className="mini-btn" type="button" disabled={busy} onClick={convert}>Convert to order</button>}
      </div>
    </article>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('new');

  const reload = () => {
    supabase
      .from('orders')
      .select('*, order_items(id, product_id, product_name, sku, qty, unit_price, products(price)), profiles(business, name, pricing_tier)')
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
            {s} ({orders.filter(o => s === 'all' || o.status === s).length})
          </button>
        ))}
      </div>

      <div className="order-list">
        {filtered.map(o => (
          <OrderCard key={o.id} order={o} onStatus={updateStatus} onReload={reload} />
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
  const [openId, setOpenId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const reload = () => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => setProfiles(data || []));
    listAllProfileDocuments().then(setDocuments).catch(() => setDocuments([]));
  };
  useEffect(reload, []);

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
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    if (error) setViewError(error.message);
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
            <React.Fragment key={p.id}>
            <tr>
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
                  <option value="standard">standard</option>
                  <option value="silver">silver</option>
                  <option value="gold">gold</option>
                </select>
              </td>
              <td>
                <select aria-label={`Role for ${p.business || p.name}`} value={p.role} onChange={e => updateProfile(p.id, { role: e.target.value })}>
                  <option value="customer">customer</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td>
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
                                View<span className="sr-only"> {doc.label} for {p.business || p.name}</span>
                              </a>
                            ) : (
                              <button type="button" className="text-link" onClick={() => viewDocument(row, p, doc.label)}>
                                View<span className="sr-only"> {doc.label} for {p.business || p.name}</span>
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
              </td>
              <td>
                <div className="inline-actions">
                  <button className="mini-btn" type="button" onClick={() => { setOpenId(openId === p.id ? null : p.id); setNoteDraft(p.verification_note || ''); }}>
                    {openId === p.id ? 'Hide' : 'Details'}
                  </button>
                  {p.status === 'pending' && (
                    <button className="mini-btn primary" type="button" onClick={() => updateProfile(p.id, { status: 'approved' })}>
                      Approve
                    </button>
                  )}
                  <a className="mini-btn" href={`mailto:${p.email}?subject=${encodeURIComponent('Your Alabama Wholesale trade account')}&body=${encodeURIComponent('Your Alabama Wholesale trade account is approved. Sign in to see pricing.')}`}>Email applicant</a>
                </div>
              </td>
            </tr>
            {openId === p.id && (
              <tr key={`${p.id}-detail`} className="account-detail-row">
                <td colSpan={8}>
                  <div className="account-facts">
                    <Fact label="EIN" value={p.ein} />
                    <Fact label="Tobacco license" value={p.license_no} />
                    <Fact label="Resale certificate" value={p.resale_cert_no} />
                    <Fact label="Phone" value={p.phone} />
                    <Fact label="Store state" value={p.state} />
                    <Fact label="Street" value={p.store_street} />
                    <Fact label="City" value={p.store_city} />
                    <Fact label="ZIP" value={p.store_zip} />
                    <Fact label="Business type" value={p.business_type} />
                    <Fact label="Monthly volume" value={p.expected_volume} />
                    <Fact label="Approved" value={p.approved_at ? new Date(p.approved_at).toLocaleString() : ''} />
                    <Fact label="Approved by" value={profiles.find(row => row.id === p.approved_by)?.name || p.approved_by || ''} />
                    <Fact label="Terms accepted" value={p.terms_accepted_at ? `${new Date(p.terms_accepted_at).toLocaleString()}${p.terms_version ? ` · ${p.terms_version}` : ''}` : ''} />
                  </div>
                  <label className="account-note" htmlFor={`note-${p.id}`}>Verification note
                    <input id={`note-${p.id}`} value={noteDraft} onChange={e => setNoteDraft(e.target.value)} />
                  </label>
                  <button className="mini-btn" type="button" onClick={() => updateProfile(p.id, { verification_note: noteDraft || null })}>Save note</button>
                </td>
              </tr>
            )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <p className="fact-label">{label}</p>
      <p>{value || '—'}</p>
    </div>
  );
}

function ProductsTab() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const reload = () => {
    supabase.from('products').select('*').order('id').then(({ data }) => setRows(data || []));
  };
  useEffect(reload, []);

  const save = async (id, patch) => {
    await supabase.from('products').update(patch).eq('id', id);
    setEditing(null);
    reload();
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
      <p className="result-note">{filtered.length} of {rows.length} products</p>
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
                <td className="muted">{p.cat} / {p.sub}</td>
                <td><input aria-label="Price" type="number" step="0.01" value={editing.price} onChange={e => setEditing({ ...editing, price: parseFloat(e.target.value) })} /></td>
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
                    <button className="mini-btn primary" type="button" onClick={() => save(p.id, { name: editing.name, brand: editing.brand, price: editing.price, tag: editing.tag, active: editing.active })}>Save</button>
                    <button className="mini-btn quiet" type="button" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{p.brand}</td>
                <td className="muted">{p.cat} / {p.sub}</td>
                <td className="price">${Number(p.price).toFixed(2)}</td>
                <td>{p.tag || '—'}</td>
                <td>{p.active ? 'Yes' : 'No'}</td>
                <td>
                  <button className="mini-btn" type="button" onClick={() => setEditing({ ...p })}>Edit</button>
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
