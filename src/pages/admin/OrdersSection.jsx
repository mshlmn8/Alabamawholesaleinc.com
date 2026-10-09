// Admin -> Orders: the order list with its status filter, and each order or
// quote's card with Cursor's quote editor, Convert and Email (AW-024).

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { formatMoney } from '../../lib/format.js';
import { MISSING_FUNCTION_CODES, lineTotal, tierUnitPrice, toCents, fromCents } from '../../lib/pricing.js';
import { DEFAULT_ORDER_STATUS, LEGACY_ORDER_STATES, ORDER_STATES } from '../../lib/adminRoutes.js';

// The order statuses (and the owner question about them, AW-024) are in
// src/lib/adminRoutes.js, which checks the status filter in the URL.
export { ORDER_STATES, LEGACY_ORDER_STATES };

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

// query: the URL's filters (status, AW-118); onQuery writes them.
export function OrdersTab({ query = {}, onQuery }) {
  const [orders, setOrders] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const filter = query.status || DEFAULT_ORDER_STATUS;
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
      <div className="sub-pills" role="group" aria-label="Order status">
        {filters.map(s => (
          <button
            key={s}
            type="button"
            aria-pressed={filter === s}
            className={`sub-pill ${filter === s ? 'active' : ''}`}
            onClick={() => onQuery?.({ ...query, status: s })}
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
            <button className="button" type="button" disabled={busy || !workflow} onClick={save}>Save prices</button>
            <button className="button ghost" type="button" onClick={closeEditor}>Cancel</button>
          </>
        ) : (
          <button className="button ghost" type="button" onClick={openEditor}>
            <span>Edit quantities and prices</span><span className="sr-only">{` for ${o.ref_num}`}</span>
          </button>
        )}
        <a className="button ghost" href={orderEmail(o, draft || items, quote)}>
          <span>{quote ? 'Email the quote' : 'Email the order'}</span><span className="sr-only">{` ${o.ref_num} to ${o.email}`}</span>
        </a>
        {quote && !draft && (
          <button className="button ghost" type="button" disabled={busy || !workflow || unpriced} onClick={convert}>
            <span>Convert to order</span><span className="sr-only">{` ${o.ref_num}`}</span>
          </button>
        )}
      </div>
      {workflow && quote && !draft && unpriced && <p className="order-notes">Price every line to convert this quote to an order.</p>}
    </article>
  );
}
