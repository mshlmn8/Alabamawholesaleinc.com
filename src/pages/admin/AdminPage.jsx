// Admin dashboard: orders, account approvals, product catalog edits.
// All write paths use the row-level-security policies in 20260517000001_rls_policies.sql.

import { Fragment, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { DOCUMENT_TYPES, createDocumentViewUrl, listAllProfileDocuments } from '../../lib/documents.js';
import { formatMoney } from '../../lib/format.js';
import { MISSING_FUNCTION_CODES, lineTotal, tierUnitPrice, toCents, fromCents } from '../../lib/pricing.js';
import { Link } from '../../lib/router.js';
import { Breadcrumbs, HOME_CRUMB } from '../../components/Breadcrumbs.jsx';
import { AccountLoading, AccountProblem } from '../../components/AccountStatus.jsx';

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'products', label: 'Products' },
];

// The order statuses. The quote workflow (AW-024; Cursor's
// 20261008200000) adds quoted ... out_for_delivery; a database without it
// accepts only the first four (LEGACY_ORDER_STATES).
// TODO(owner): Confirm how quotes should work: should staff price and answer guest quotes and convert them to orders, and should orders go through 'quoted' and 'confirmed' stages before picking? (AW-024)
export const ORDER_STATES = ['new', 'contacted', 'quoted', 'confirmed', 'picking', 'ready', 'out_for_delivery', 'fulfilled', 'cancelled'];
export const LEGACY_ORDER_STATES = ['new', 'contacted', 'fulfilled', 'cancelled'];

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
  // Only an approved admin gets the dashboard, as only an approved admin
  // passes is_admin() in the database (AW-352). A suspended or pending admin
  // is told their access is on hold.
  if (!profile || profile.role !== 'admin' || profile.status !== 'approved') {
    const held = profile?.role === 'admin';
    return (
      <section className="page-head">
        <Breadcrumbs items={[HOME_CRUMB, { label: 'Admin' }]} />
        <p className="eyebrow">TRADE DESK</p>
        <h1>{profile ? 'This page is for the trade desk' : 'Sign in to continue'}</h1>
        <p>{held
          ? 'Your admin access is on hold. Contact the owner.'
          : profile
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
      {tab === 'accounts' && <AccountsTab currentAdminId={profile.id} />}
      {tab === 'products' && <ProductsTab onCatalogChange={onCatalogChange} />}
    </section>
  );
}

// The quote workflow is in the database (20261008200000): its orders carry
// kind. Without it (the live database before the October 2026 update),
// statuses are the first four and staff can't save prices or convert.
export const hasQuoteWorkflow = (orders) => (orders || []).some(o => o && 'kind' in o);

// A quote: kind 'quote' (a guest or an account that isn't approved; see
// 20261009150000). Without kind, a guest's or an unpriced request.
export const isQuote = (o) => (o?.kind ? o.kind === 'quote' : (o?.user_id == null || o?.subtotal == null));

// What Admin -> Orders says when a save or conversion is refused
// (20261009150000's hints), or the database has no quote workflow yet.
export function orderActionError(error) {
  const code = error?.code || '';
  if (MISSING_FUNCTION_CODES.includes(code)) return 'Pricing and converting quotes need the October 2026 database update (see BACKEND.md).';
  if (code === '23514') return 'That status needs the October 2026 database update (see BACKEND.md).';
  switch (error?.hint) {
    case 'admin_only': return 'Only an approved admin can change orders.';
    case 'order_not_found': return 'That order is gone. Reload the page.';
    case 'order_closed': return 'This order is fulfilled or cancelled, so it can’t be changed.';
    case 'no_items': return 'Keep at least one line on the order.';
    case 'invalid_line': return 'Enter whole quantities, and prices such as 12.50 or blank.';
    case 'unknown_line': return 'A line changed since the page loaded. Reload and try again.';
    case 'not_a_quote': return 'This is already an order.';
    case 'unpriced_lines': return 'Price every line before converting the quote.';
    case 'unknown_account':
    case 'account_mismatch': return 'This quote can’t be moved to that account.';
    default: return `The change wasn’t saved${error?.message ? ` (${error.message})` : ''}. Try again.`;
  }
}

// List prices for suggesting a quote's prices: { id: { list, variants: { label: list } } },
// from admin_product_prices(), or from products.price on a database without it.
export async function loadListPrices(client) {
  const { data, error } = await client.rpc('admin_product_prices', {}, { get: true });
  if (!error) {
    const out = {};
    for (const [id, row] of Object.entries(data || {})) {
      out[id] = { list: row?.list ?? null, variants: Object.fromEntries(Object.entries(row?.variants || {}).map(([label, v]) => [label.toLowerCase(), v?.list ?? null])) };
    }
    return out;
  }
  if (!MISSING_FUNCTION_CODES.includes(error.code)) return null;
  const legacy = await client.from('products').select('id,price');
  if (legacy.error) return null;
  return Object.fromEntries((legacy.data || []).map(row => [row.id, { list: row.price ?? null, variants: {} }]));
}

// A line's suggested unit price: its list price (the variant's own when it
// has one) less the account's tier discount; a guest's at the standard tier.
export function suggestedUnitPrice(line, listPrices, discountPct) {
  const entry = listPrices?.[line.product_id];
  if (!entry) return null;
  const own = line.variant ? entry.variants?.[String(line.variant).toLowerCase()] : undefined;
  return tierUnitPrice(own !== undefined ? own : entry.list, discountPct);
}

// The editor's text as numbers, or what's wrong with it.
export function parseOrderLines(lines) {
  const out = [];
  for (const line of lines) {
    const qtyText = String(line.qty).trim();
    const priceText = String(line.unit_price ?? '').trim();
    if (!/^\d+$/.test(qtyText) || Number(qtyText) > 100000) return { ok: false, error: `Enter a whole quantity for ${line.product_name}.` };
    if (priceText !== '' && !/^\d+(\.\d{1,2})?$/.test(priceText)) return { ok: false, error: `Enter the price for ${line.product_name} as an amount such as 12.50, or leave it blank.` };
    out.push({ item_id: line.id, qty: Number(qtyText), unit_price: priceText === '' ? null : Number(priceText) });
  }
  if (!out.some(l => l.qty > 0)) return { ok: false, error: 'Keep at least one line on the order.' };
  return { ok: true, lines: out };
}

// The total of the priced lines, in cents.
function linesTotal(lines) {
  let cents = 0;
  let priced = 0;
  for (const line of lines) {
    const unit = toCents(line.unit_price);
    if (unit == null || String(line.unit_price).trim() === '') continue;
    priced += 1;
    cents += unit * (Math.round(Number(line.qty)) || 0);
  }
  return priced ? fromCents(cents) : null;
}

// "Email the quote" (AW-024): a mailto: with the lines and the total, to send
// from the desk's own mail.
export function orderEmail(order, lines, quote = isQuote(order)) {
  const label = quote ? 'Quote' : 'Order';
  const rows = lines.filter(l => Number(l.qty) > 0).map(l => {
    const priced = String(l.unit_price ?? '').trim() !== '' && toCents(l.unit_price) != null;
    return priced
      ? `${l.qty} × ${l.product_name} (${l.sku}) at ${formatMoney(l.unit_price)} = ${formatMoney(lineTotal(l.unit_price, l.qty))}`
      : `${l.qty} × ${l.product_name} (${l.sku}), price to follow`;
  });
  const total = linesTotal(lines);
  const body = `${label} ${order.ref_num}\n\n${rows.join('\n')}\n\n${total != null ? `Total: ${formatMoney(total)}` : 'Prices to follow.'}\n`;
  return `mailto:${order.email}?subject=${encodeURIComponent(`${label} ${order.ref_num}`)}&body=${encodeURIComponent(body)}`;
}

// order_items(*): the workflow columns (original_qty, sell_unit) exist only
// after the October 2026 update. The account is named through its foreign key:
// since 20261008200000, orders.quoted_by is a second link to profiles, and
// PostgREST refuses an embed that could follow either (PGRST201).
export const ADMIN_ORDER_SELECT = '*, order_items(*), profiles!orders_user_id_fkey(business, name, pricing_tier)';

function OrdersTab() {
  const [orders, setOrders] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [filter, setFilter] = useState('new');
  const [tiers, setTiers] = useState({});

  const reload = () => {
    supabase
      .from('orders')
      .select(ADMIN_ORDER_SELECT)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        setLoadError(error ? 'The orders didn’t load. Reload the page to try again.' : null);
        setOrders(current => (error ? (current || []) : (data || [])));
      });
  };
  useEffect(reload, []);
  useEffect(() => {
    let cancelled = false;
    supabase.from('pricing_tiers').select('tier,discount_pct').then(({ data, error }) => {
      if (!cancelled && !error && Array.isArray(data)) setTiers(Object.fromEntries(data.map(t => [t.tier, Number(t.discount_pct) || 0])));
    });
    return () => { cancelled = true; };
  }, []);

  const updateStatus = async (order, status) => {
    setStatusError(null);
    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id);
    if (error) setStatusError(`${order.ref_num}: ${orderActionError(error)}`);
    reload();
  };

  if (!orders) return <p className="result-note">Loading…</p>;
  const workflow = hasQuoteWorkflow(orders);
  const states = workflow ? ORDER_STATES : LEGACY_ORDER_STATES;
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const filters = [...states, 'all'];

  return (
    <div>
      {loadError && <p className="form-error" role="alert">{loadError}</p>}
      <div className="sub-pills" aria-label="Order status">
        {filters.map(s => (
          <button
            key={s}
            type="button"
            className={`sub-pill ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {`${s.replace(/_/g, ' ')} (${orders.filter(o => s === 'all' || o.status === s).length})`}
          </button>
        ))}
      </div>
      {statusError && <p className="form-error" role="alert">{statusError}</p>}
      {orders.length > 0 && !workflow && (
        <p className="result-note">The quote workflow (more statuses, saving prices, converting quotes) needs the October 2026 database update (see BACKEND.md). Emailing a quote works now.</p>
      )}

      <div className="order-list">
        {filtered.map(o => (
          <OrderCard key={o.id} order={o} states={states} workflow={workflow} tiers={tiers} onStatus={updateStatus} onReload={reload} />
        ))}
      </div>
      {filtered.length === 0 && <p className="result-note">No orders in this state.</p>}
    </div>
  );
}

// One order or quote (AW-024, Cursor's PR #13): staff edit quantities and unit
// prices (suggested from the list price and the account's tier), email the
// quote, and convert a priced quote into a confirmed order.
function OrderCard({ order: o, states, workflow, tiers, onStatus, onReload }) {
  const quote = isQuote(o);
  const items = o.order_items || [];
  const [draft, setDraft] = useState(null); // the lines being edited, or null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [suggested, setSuggested] = useState(false);
  const discountPct = tiers[o.profiles?.pricing_tier || 'standard'] ?? 0;

  const openEditor = async () => {
    setError(null);
    const lines = items.map(it => ({ ...it, qty: String(it.qty), unit_price: it.unit_price == null ? '' : String(Number(it.unit_price).toFixed(2)) }));
    setDraft(lines);
    if (lines.every(l => l.unit_price !== '')) return;
    let listPrices = null;
    try {
      listPrices = await loadListPrices(supabase);
    } catch {
      listPrices = null;
    }
    if (!listPrices) return;
    const prices = new Map(lines.map(l => [l.id, suggestedUnitPrice(l, listPrices, discountPct)]));
    // Only fields still empty are filled; what staff typed meanwhile stays.
    setDraft(current => current && current.map(l => (l.unit_price === '' && prices.get(l.id) != null ? { ...l, unit_price: prices.get(l.id).toFixed(2) } : l)));
    setSuggested(lines.some(l => l.unit_price === '' && prices.get(l.id) != null));
  };
  const closeEditor = () => { setDraft(null); setSuggested(false); setError(null); };
  const setLine = (index, field) => (e) => {
    const value = e.target.value;
    setDraft(current => current.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const save = async () => {
    const parsed = parseOrderLines(draft);
    if (!parsed.ok) { setError(parsed.error); return; }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('admin_price_order', { p_order_id: o.id, p_lines: parsed.lines });
    setBusy(false);
    if (rpcError) { setError(orderActionError(rpcError)); return; }
    closeEditor();
    onReload();
  };
  const convert = async () => {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('admin_convert_quote', { p_order_id: o.id, p_user_id: null });
    setBusy(false);
    if (rpcError) setError(orderActionError(rpcError));
    else onReload();
  };

  const unpriced = items.some(it => it.unit_price == null);
  const draftTotal = draft ? linesTotal(draft) : null;
  const options = states.includes(o.status) ? states : [...states, o.status];
  const kindLabel = !quote ? 'Trade order' : (o.user_id == null ? 'Guest quote' : 'Account quote');

  return (
    <article className={`order-card${quote ? ' is-quote' : ''}`}>
      <div className="order-head">
        <div>
          <span className="order-kind">{kindLabel}</span>
          <b className="order-ref">{o.ref_num}</b>
          <small>
            <span>{`${new Date(o.created_at).toLocaleString()} · ${o.business} · ${o.contact} · `}</span>
            <a href={`mailto:${o.email}`}>{o.email}</a>
            {o.phone && <span> · </span>}
            {o.phone && <a href={`tel:${String(o.phone).replace(/[^\d+]/g, '')}`}>{o.phone}</a>}
            {o.ship_street && <span>{` · Deliver to ${o.ship_street}, ${o.ship_city} ${o.ship_state} ${o.ship_zip}`}</span>}
            {/* Will-call quotes have no address since submit_quote v3 (AW-079). */}
            {o.delivery === 'willcall' && <span> · Will-call pickup</span>}
            {o.profiles?.pricing_tier && <span> · tier: <b>{o.profiles.pricing_tier}</b></span>}
          </small>
        </div>
        <select aria-label={`Status for ${o.ref_num}`} value={o.status} onChange={e => onStatus(o, e.target.value)}>
          {options.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      {draft ? (
        <div className="order-edit">
          {suggested && <p className="order-edit-note">Empty prices are suggested from the list price and the account’s tier. Check them before saving.</p>}
          {draft.map((line, index) => (
            <div className="order-edit-line" key={line.id}>
              <span className="order-edit-name"><span>{line.product_name}</span> <span className="sku">{`(${line.sku})`}</span></span>
              <label><span>Qty</span>
                <input aria-label={`Quantity for ${line.product_name}`} type="text" inputMode="numeric" value={line.qty} onChange={setLine(index, 'qty')} />
              </label>
              <label><span>Unit price</span>
                <input aria-label={`Unit price for ${line.product_name}`} type="text" inputMode="decimal" placeholder="—" value={line.unit_price} onChange={setLine(index, 'unit_price')} />
              </label>
            </div>
          ))}
          <p className="order-edit-total">{draftTotal != null ? `Total of the priced lines: ${formatMoney(draftTotal)}` : 'No line is priced yet.'}</p>
          <p className="order-edit-note">A quantity of 0 removes the line.</p>
        </div>
      ) : (
        <ul className="order-items">
          {items.map(it => (
            <li key={it.id}>
              <span><span>{`${it.qty} × ${it.product_name}`}</span> <span className="sku">{`(${it.sku})`}</span><span>{it.unit_price != null ? ` · ${formatMoney(it.unit_price)} each` : ''}</span></span>
              <span className="line-total">{it.unit_price != null ? formatMoney(lineTotal(it.unit_price, it.qty)) : '—'}</span>
            </li>
          ))}
        </ul>
      )}
      {o.notes && <p className="order-notes">{`Notes: ${o.notes}`}</p>}
      {/* The store's license details, when the quote came with them (AW-014). */}
      {(o.license_no || o.resale_cert_no || o.purchasers_21) && (
        <p className="order-notes">{`Tobacco license: ${o.license_no || '—'} · Resale certificate: ${o.resale_cert_no || '—'} · ${o.purchasers_21 ? '21+ purchasers confirmed' : '21+ not confirmed'}`}</p>
      )}
      {error && <p className="form-error order-error" role="alert">{error}</p>}
      <div className="inline-actions order-actions-row">
        {draft ? (
          <>
            <button className="mini-btn primary" type="button" disabled={busy || !workflow} onClick={save}>Save prices</button>
            <button className="mini-btn" type="button" onClick={closeEditor}>Cancel</button>
          </>
        ) : (
          <button className="mini-btn" type="button" onClick={openEditor}>
            <span>Edit quantities and prices</span><span className="sr-only">{` for ${o.ref_num}`}</span>
          </button>
        )}
        <a className="mini-btn" href={orderEmail(o, draft || items, quote)}>
          <span>{quote ? 'Email the quote' : 'Email the order'}</span><span className="sr-only">{` ${o.ref_num} to ${o.email}`}</span>
        </a>
        {quote && !draft && (
          <button className="mini-btn" type="button" disabled={busy || !workflow || unpriced} onClick={convert}>
            <span>Convert to order</span><span className="sr-only">{` ${o.ref_num}`}</span>
          </button>
        )}
      </div>
      {workflow && quote && !draft && unpriced && <p className="order-notes">Price every line to convert this quote to an order.</p>}
    </article>
  );
}

// Who approved an account, and when (AW-197): the approver's name from the
// accounts already loaded. Accounts approved before 20261008193000, or on a
// database without it, have no approved_at, and show nothing.
export function approvalLine(p, profiles) {
  if (!p.approved_at) return null;
  const at = new Date(p.approved_at);
  if (Number.isNaN(at.getTime())) return null;
  const when = at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const approver = p.approved_by ? profiles.find(x => x.id === p.approved_by) : null;
  const by = approver ? (approver.name || approver.email) : null;
  return by ? `Approved ${when} by ${by}` : `Approved ${when}`;
}

// currentAdminId: the signed-in admin, whose own status and role can't be
// changed here (AW-352); the database refuses it too (profiles_guard).
function AccountsTab({ currentAdminId }) {
  const [profiles, setProfiles] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [viewError, setViewError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [updateError, setUpdateError] = useState(null);
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

  // A refused or failed change is shown, not ignored: the database refuses
  // some changes with 42501 (20261009140000), and an update that reaches no
  // row (RLS) returns no error, so the changed row is read back.
  const updateProfile = async (row, patch) => {
    setUpdateError(null);
    const who = row.business || row.name || row.email;
    if (row.id === currentAdminId && ('status' in patch || 'role' in patch)) {
      setUpdateError('You can’t change your own status or role.');
      return;
    }
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', row.id).select('id');
    if (error?.code === '42501') setUpdateError(`That change to ${who} isn’t allowed.`);
    else if (error) setUpdateError(profileSaveError(error, who));
    else if (!data?.length) setUpdateError(`The change to ${who} wasn’t saved. Try again.`);
    reload();
  };

  if (!profiles) return <p className="result-note">Loading…</p>;

  return (
    <div className="table-scroll">
      {viewError && <p className="form-error" role="alert">{viewError}</p>}
      {updateError && <p className="form-error" role="alert">{updateError}</p>}
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
            <Fragment key={p.id}>
            <tr>
              <td>{p.business || '—'}</td>
              <td>{p.name}</td>
              <td className="muted">{p.email}</td>
              <td>
                <select aria-label={`Status for ${p.business || p.name}`} value={p.status} disabled={p.id === currentAdminId} aria-describedby={p.id === currentAdminId ? 'admin-own-row' : undefined} onChange={e => updateProfile(p, { status: e.target.value })}>
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="suspended">suspended</option>
                </select>
                {p.id === currentAdminId && <small className="field-hint" id="admin-own-row">Your own status and role can’t be changed here.</small>}
                {p.approved_at && <small className="field-hint">{approvalLine(p, profiles)}</small>}
              </td>
              <td>
                <select aria-label={`Tier for ${p.business || p.name}`} value={p.pricing_tier} onChange={e => updateProfile(p, { pricing_tier: e.target.value })}>
                  {(tiers.includes(p.pricing_tier) ? tiers : [...tiers, p.pricing_tier]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td>
                {/* An admin must be an approved account (is_admin()), so
                    making a pending or suspended account an admin approves it. */}
                <select aria-label={`Role for ${p.business || p.name}`} value={p.role} disabled={p.id === currentAdminId} aria-describedby={p.id === currentAdminId ? 'admin-own-row' : undefined}
                  onChange={e => updateProfile(p, e.target.value === 'admin' && p.status !== 'approved' ? { role: 'admin', status: 'approved' } : { role: e.target.value })}>
                  <option value="customer">customer</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td>
                {/* Every status: the proof stays on file after approval (AW-197). */}
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
              </td>
              <td>
                <div className="inline-actions">
                  <button
                    className="mini-btn"
                    type="button"
                    aria-expanded={openId === p.id}
                    aria-controls={openId === p.id ? `account-details-${p.id}` : undefined}
                    onClick={() => { setOpenId(openId === p.id ? null : p.id); setNoteDraft(p.verification_note || ''); }}
                  >
                    <span>{openId === p.id ? 'Hide' : 'Details'}</span>
                    <span className="sr-only">{` for ${p.business || p.name}`}</span>
                  </button>
                  {p.status === 'pending' && (
                    <button className="mini-btn primary" type="button" onClick={() => updateProfile(p, { status: 'approved' })}>
                      Approve
                    </button>
                  )}
                  {/* No mail goes out on its own (AW-088): after approving,
                      staff send this from the desk's own mail. */}
                  {p.status === 'approved' && p.role !== 'admin' && p.email && (
                    <a className="mini-btn" href={approvalEmail(p)}>
                      <span>Email applicant</span><span className="sr-only">{` ${p.business || p.name}`}</span>
                    </a>
                  )}
                </div>
              </td>
            </tr>
            {openId === p.id && (
              <tr className="account-detail-row" id={`account-details-${p.id}`}>
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
                    <Fact label="21+ confirmed" value={p.age_confirmed_at ? new Date(p.age_confirmed_at).toLocaleString() : ''} />
                  </div>
                  <label className="account-note" htmlFor={`note-${p.id}`}>Verification note
                    <input id={`note-${p.id}`} value={noteDraft} onChange={e => setNoteDraft(e.target.value)} />
                  </label>
                  <button className="mini-btn" type="button" onClick={() => updateProfile(p, { verification_note: noteDraft || null })}>Save note</button>
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The "Email applicant" message after approval (AW-088, Cursor's PR #13).
// TODO(owner): Should approvals send an automatic email, which needs an email provider or SMTP set up in Supabase, or will a trade rep call or email each approved applicant by hand? (AW-088)
export function approvalEmail(p) {
  const subject = 'Your Alabama Wholesale trade account';
  const body = 'Your Alabama Wholesale trade account is approved. Sign in to see pricing.';
  return `mailto:${p.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// The live database gets the approval and consent columns from the
// 2026-10-08 migrations (AW-197, AW-019); until then they read as '—' and a
// note cannot be saved.
function profileSaveError(error, who) {
  const text = `${error?.code || ''} ${error?.message || ''}`;
  if (/PGRST204|42703/.test(text)) return 'Saving this needs the October 2026 database update (see BACKEND.md).';
  return `The change to ${who} wasn’t saved${error?.message ? ` (${error.message})` : ''}. Try again.`;
}

// One application answer in the details row (AW-017).
function Fact({ label, value }) {
  return (
    <div>
      <p className="fact-label">{label}</p>
      <p>{value || '—'}</p>
    </div>
  );
}

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
