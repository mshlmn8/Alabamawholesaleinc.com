// Admin -> Orders: the order list with its toolbar (search, dates, method,
// account; AW-110), status filter, export, live updates and the marker for
// orders new since the last visit (AW-111), and each order or quote's card
// with Cursor's quote editor, Convert and Email (AW-024), its print links,
// and its staff notes and history.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { Link } from '../../lib/router.js';
import { formatMoney } from '../../lib/format.js';
import { MAX_QTY } from '../../lib/quantity.js';
import { MISSING_FUNCTION_CODES, lineTotal, tierUnitPrice, toCents, fromCents } from '../../lib/pricing.js';
import { DEFAULT_ORDER_STATUS, LEGACY_ORDER_STATES, ORDER_STATES, adminHref } from '../../lib/adminRoutes.js';
import { Icon } from '../../components/Icon.jsx';
import { useLeaveGuard } from './useLeaveGuard.js';
import { adminErrorMessage, checkedWrite, withStatus } from './adminData.js';
import { LoadProblem } from './AdminStatus.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { downloadCsv, toCsv } from './csv.js';
import {
  ADMIN_ORDER_SELECT, MAX_ORDER_SEARCH, ORDER_LIMIT, hasOrderFilters, isQuote, orderCsvRecords, orderFilters, ordersCsvFileName, ordersQuery,
} from './orderQueries.js';
import { MAX_NOTE, hasAssignment, staffName, statusLabel } from './orderStaff.js';
import { isNewSince, ordersActivity } from './ordersSeen.js';
import { useLiveOrders } from './liveOrders.js';
import { printHref } from './printSheet.js';
import { OrderStaff } from './OrderStaff.jsx';

// The order statuses (and the owner question about them, AW-024) are in
// src/lib/adminRoutes.js, which checks the status filter in the URL.
export { ORDER_STATES, LEGACY_ORDER_STATES };
// The select string and the quote test live in orderQueries.js (the query
// and the CSV use them too).
export { ADMIN_ORDER_SELECT, isQuote };

// The quote workflow is in the database (20261008200000): its orders carry
// kind. Without it (the live database before the October 2026 update),
// statuses are the first four and staff can't save prices or convert.
export const hasQuoteWorkflow = (orders) => (orders || []).some(o => o && 'kind' in o);

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
    // admin_set_order_status (20261010122000).
    case 'reason_required': return 'Give a reason for cancelling the order.';
    case 'invalid_status': return 'That status isn’t one the database accepts. Reload the page.';
    case 'note_too_long': return 'Keep the reason to 2,000 characters or fewer.';
    // A lost connection, an ended session, a refusal or a missing column
    // (AW-202), else the database's own message.
    default: return adminErrorMessage(error, 'The change wasn’t saved');
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
    if (!/^\d+$/.test(qtyText) || Number(qtyText) > MAX_QTY) return { ok: false, error: `Enter a whole quantity for ${line.product_name}.` };
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

// The facts in an order card's head (AW-020).
// Will-call has no address (submit_quote v3, AW-079); delivery names it.
export function orderMethod(o) {
  if (o.delivery === 'willcall') return 'Will-call pickup';
  if (o.ship_street) return `Delivery to ${[o.ship_street, o.ship_city, [o.ship_state, o.ship_zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')}`;
  return o.delivery === 'delivery' ? 'Delivery' : '—';
}
// The date the buyer asked for, e.g. 'Oct 1, 2026', read as a calendar day.
export function requestedDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
export function orderTotal(o, quote = isQuote(o)) {
  if (o.subtotal == null) return quote ? 'Unpriced quote' : 'Not priced yet';
  const units = o.total_units ?? (o.order_items || []).reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  return `${units} ${units === 1 ? 'unit' : 'units'} · ${formatMoney(o.subtotal)}`;
}
// The business, and the account's tier when the order came from an account.
export function orderAccount(o) {
  const business = o.profiles?.business || o.business;
  return [business, o.profiles?.pricing_tier].filter(Boolean).join(' · ') || '—';
}
export function placedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// A status change: admin_set_order_status() (20261010122000; it logs the
// change, with a note) and, on a database without it, the checked plain
// update of before (logged without a note once the migration is in).
// Returns { error, via: 'rpc' | 'update', row: { id, status, updated_at } }.
// The missing function is remembered for the rest of the visit
// (orderStatusFunctionMissing(): the cancel dialog then says a reason can't
// be stored).
let statusFunctionMissing = false;
export const resetOrderStatusForTests = () => { statusFunctionMissing = false; };
export const orderStatusFunctionMissing = () => statusFunctionMissing;
export async function setOrderStatus(client, order, status, note = null) {
  if (!statusFunctionMissing) {
    let result;
    try {
      result = await client.rpc('admin_set_order_status', { p_order_id: order.id, p_status: status, p_note: note });
    } catch (error) {
      return { error, via: 'rpc', row: null };
    }
    if (!result?.error) return { error: null, via: 'rpc', row: result?.data && typeof result.data === 'object' ? result.data : null };
    if (!MISSING_FUNCTION_CODES.includes(result.error.code)) return { error: withStatus(result), via: 'rpc', row: null };
    statusFunctionMissing = true;
  }
  const { data, error } = await checkedWrite(client.from('orders').update({ status }).eq('id', order.id), 'id, status, updated_at');
  return { error, via: 'update', row: Array.isArray(data) ? data[0] ?? null : null };
}

// The search box waits this long after typing before it asks the database.
export const ORDER_SEARCH_DEBOUNCE_MS = 300;
const METHOD_OPTIONS = [['', 'Any'], ['delivery', 'Delivery'], ['willcall', 'Will-call']];
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
export const printLinkId = (orderId, doc) => `print-${doc}-${orderId}`;
// An order card's status select (focused again after Undo).
export const orderStatusId = (orderId) => `order-status-${orderId}`;
const NO_IDS = new Set();
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The filters above the status pills (AW-110). Dates, the method and the
// account go into the URL; the search (names, emails, phones) stays in the
// page's state.
function OrderFilters({ query, onFilter, search, onSearch, clearHref, filtered }) {
  return (
    <div className="admin-toolbar admin-order-filters" role="group" aria-label="Filter orders">
      <label className="admin-order-search">Search orders
        <input type="search" placeholder="Ref, business, contact, email or phone" maxLength={MAX_ORDER_SEARCH}
          value={search} onChange={(e) => onSearch?.(e.target.value)} />
      </label>
      <label>Placed from
        <input type="date" value={query.from || ''} max={query.to || undefined} onChange={(e) => onFilter({ from: e.target.value })} />
      </label>
      <label>Placed to
        <input type="date" value={query.to || ''} min={query.from || undefined} onChange={(e) => onFilter({ to: e.target.value })} />
      </label>
      <label>Deliver on
        <input type="date" value={query.on || ''} onChange={(e) => onFilter({ on: e.target.value })} />
      </label>
      <label>Method
        <select value={query.method || ''} onChange={(e) => onFilter({ method: e.target.value })}>
          {METHOD_OPTIONS.map(([value, label]) => <option key={value || 'any'} value={value}>{label}</option>)}
        </select>
      </label>
      {filtered && <Link className="text-link" to={clearHref} replace scroll={false} onClick={() => onSearch?.('')}>Clear filters</Link>}
    </div>
  );
}

// query: the URL's filters (status, from, to, on, method, account; AW-118);
// onQuery writes them. search/onSearch: the free-text search, kept by
// AdminPage (never in the URL). notify: shows what a change did
// (useAdminStatus). since: the previous visit (ordersSeen.js); orders placed
// after it are marked New. onOpenPrint(href, linkId): a print link was
// followed. returnFocusId/onReturnFocus: the print link to focus when the
// list shows again.
export function OrdersTab({
  query = {}, onQuery, notify, search = '', onSearch, since = null, onOpenPrint, returnFocusId = null, onReturnFocus,
}) {
  const [orders, setOrders] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusError, setStatusError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [admins, setAdmins] = useState(null);
  const filter = query.status || DEFAULT_ORDER_STATUS;
  const [tiers, setTiers] = useState({});

  // The search goes to the database a moment after typing stops.
  const typed = orderFilters({}, search).search;
  const [sentSearch, setSentSearch] = useState(typed);
  useEffect(() => {
    if (typed === sentSearch) return undefined;
    const timer = setTimeout(() => setSentSearch(typed), ORDER_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed, sentSearch]);
  const filters = useMemo(() => orderFilters(query, sentSearch), [query, sentSearch]);
  const filtersKey = JSON.stringify(filters);

  // Status changes on their way (id -> the status shown meanwhile, AW-112):
  // a reload keeps showing it, and the card's select takes no other change.
  const savingRef = useRef(new Map());
  const [saving, setSaving] = useState(NO_IDS);
  // Orders moved out of the status on screen: they stay, tagged "Moved to
  // …", until Refresh or another filter; the live reloads keep them.
  const movedKey = `${filter}|${filtersKey}`;
  const [moved, setMoved] = useState({ key: null, ids: NO_IDS });
  // Another filter forgets them (so coming back to this one doesn't bring
  // them back).
  if (moved.key !== null && moved.key !== movedKey) setMoved({ key: null, ids: NO_IDS });
  const movedIds = moved.key === movedKey ? moved.ids : NO_IDS;

  // A failed load says so, with Try again, instead of "No orders" (AW-202);
  // orders already on screen stay, and so do the filters, the focus and any
  // card's open editor (cards are keyed by order id). Only the newest
  // request's answer is used. ordersQuery keeps the newest 200: paging and
  // per-status counts from the server are AW-199, not built yet.
  const filtersRef = useRef(filters);
  const notifyRef = useRef(notify);
  useEffect(() => {
    filtersRef.current = filters;
    notifyRef.current = notify;
  });
  const requestRef = useRef(0);
  const lastLoad = useRef({ key: null, newest: null });
  const reload = useCallback(async () => {
    const current = filtersRef.current;
    const key = JSON.stringify(current);
    const request = ++requestRef.current;
    let result;
    try {
      result = await ordersQuery(supabase, current);
    } catch (error) {
      result = { error };
    }
    if (request !== requestRef.current) return false;
    const error = withStatus(result || {});
    setLoadError(error ? adminErrorMessage(error, 'The orders didn’t load') : null);
    if (error) return false;
    const rows = result.data || [];
    // Orders placed since the last load of the same filters: say so, and
    // let the header count them.
    const newest = rows.reduce((max, row) => Math.max(max, Date.parse(row.created_at) || 0), 0);
    const last = lastLoad.current;
    if (last.key === key && last.newest != null) {
      const fresh = rows.filter((row) => (Date.parse(row.created_at) || 0) > last.newest).length;
      if (fresh) {
        notifyRef.current?.(`${plural(fresh, 'new order')} came in.`);
        ordersActivity();
      }
    }
    lastLoad.current = { key, newest: Math.max(newest, last.key === key ? last.newest ?? 0 : 0) };
    const pending = savingRef.current;
    setOrders(pending.size ? rows.map((row) => (pending.has(row.id) ? { ...row, status: pending.get(row.id) } : row)) : rows);
    setUpdatedAt(new Date());
    return true;
  }, []);
  useEffect(() => { reload(); }, [filtersKey, reload]);
  // Realtime, plus a reload every minute while the tab is visible (AW-111).
  useLiveOrders(reload, { client: supabase });
  const retry = async () => {
    setRetrying(true);
    await reload();
    setRetrying(false);
  };
  const refresh = async () => {
    setRefreshing(true);
    const ok = await reload();
    setRefreshing(false);
    if (ok) {
      setMoved({ key: null, ids: NO_IDS });
      notify?.(`Orders updated at ${timeFormat.format(new Date())}.`);
    }
  };

  useEffect(() => {
    let cancelled = false;
    supabase.from('pricing_tiers').select('tier,discount_pct').then(({ data, error }) => {
      if (!cancelled && !error && Array.isArray(data)) setTiers(Object.fromEntries(data.map(t => [t.tier, Number(t.discount_pct) || 0])));
    });
    return () => { cancelled = true; };
  }, []);

  // The approved admins, for "Assigned to" (only when the database has
  // orders.assigned_to).
  const assignment = hasAssignment(orders);
  useEffect(() => {
    if (!assignment) return undefined;
    let cancelled = false;
    supabase.from('profiles').select('id, name, email').eq('role', 'admin').eq('status', 'approved').order('name').then(({ data, error }) => {
      if (!cancelled) setAdmins(error || !Array.isArray(data) ? [] : data);
    }, () => {
      if (!cancelled) setAdmins([]);
    });
    return () => { cancelled = true; };
  }, [assignment]);
  const assigned = (id, assignedTo, updated) => {
    setOrders((list) => list?.map((o) => (o.id === id ? { ...o, assigned_to: assignedTo, ...(updated ? { updated_at: updated } : {}) } : o)) ?? list);
  };

  // A status change shows at once (AW-112): the card takes the new status
  // where it is (no reload), stays in this filter tagged "Moved to …", and
  // its select keeps the focus. One request per order at a time. A refused
  // change goes back to the saved status, beside the error. The status line
  // offers Undo, which puts the previous status back the same way (not into
  // or out of cancelled: cancelling asks for a reason). A cancellation
  // carries its reason (ConfirmDialog); without the October 2026 update the
  // reason has nowhere to go, and the status line says so.
  const updateStatus = async (order, status, note = null, { undoable = true } = {}) => {
    if (savingRef.current.has(order.id)) return false;
    const previous = order.status;
    if (status === previous) return true;
    const patchStatus = (value, extra = {}) => setOrders((list) => list?.map((o) => (o.id === order.id ? { ...o, status: value, ...extra } : o)) ?? list);
    savingRef.current.set(order.id, status);
    setSaving(new Set(savingRef.current.keys()));
    setStatusError(null);
    patchStatus(status);
    setMoved((m) => ({ key: movedKey, ids: new Set([...(m.key === movedKey ? m.ids : []), order.id]) }));
    const { error, via, row } = await setOrderStatus(supabase, order, status, note);
    savingRef.current.delete(order.id);
    setSaving(new Set(savingRef.current.keys()));
    if (error) {
      patchStatus(previous);
      setStatusError(`${order.ref_num}: ${orderActionError(error)}`);
      return false;
    }
    // The new updated_at: an open "Staff notes and history" loads the change.
    if (row?.updated_at) patchStatus(status, { updated_at: row.updated_at });
    const lost = note && via === 'update' ? ' The reason wasn’t saved: notes and history need the October 2026 database update (see BACKEND.md).' : '';
    const canUndo = undoable && status !== 'cancelled' && previous !== 'cancelled';
    notify?.(`${order.ref_num} marked ${statusLabel(status)}.${lost}`, canUndo ? {
      undo: () => {
        document.getElementById(orderStatusId(order.id))?.focus();
        updateStatus({ ...order, status }, previous, null, { undoable: false });
      },
    } : undefined);
    return true;
  };

  // Back from a print view: its print link takes focus again.
  useEffect(() => {
    if (!returnFocusId || !orders) return;
    const target = document.getElementById(returnFocusId);
    onReturnFocus?.(null);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest' });
  }, [returnFocusId, orders, onReturnFocus]);

  const setFilter = (change) => onQuery?.({ ...query, ...change });
  const filtered = hasOrderFilters(filters) || !!typed;
  const clearHref = adminHref({ section: 'orders', query: { status: query.status } });
  const toolbar = (
    <OrderFilters query={query} onFilter={setFilter} search={search} onSearch={onSearch} clearHref={clearHref} filtered={filtered} />
  );
  const updatedText = <p className="admin-updated">{updatedAt ? `Updated ${timeFormat.format(updatedAt)}` : ''}</p>;

  if (!orders) {
    return (
      <div className="admin-orders">
        {toolbar}
        {loadError ? <LoadProblem message={loadError} onRetry={retry} retrying={retrying} /> : <p className="result-note">Loading…</p>}
        {updatedText}
      </div>
    );
  }
  const workflow = hasQuoteWorkflow(orders);
  const states = workflow ? ORDER_STATES : LEGACY_ORDER_STATES;
  const shown = filter === 'all' ? orders : orders.filter(o => o.status === filter || movedIds.has(o.id));
  const pills = [...states, 'all'];
  const accountName = query.account ? (orders.find((o) => o.profiles?.business)?.profiles.business || 'one account') : null;

  // Export CSV: the orders the filters and the status pill show, one row
  // per line, built in the browser.
  const exportCsv = () => {
    const name = ordersCsvFileName();
    downloadCsv(name, toCsv(orderCsvRecords(shown)));
    notify?.(`Exported ${plural(shown.length, 'order')} to ${name}.`);
  };

  return (
    <div className="admin-orders">
      {toolbar}
      {accountName && (
        <p className="result-note admin-account-filter">
          <span>{`Orders of ${accountName}.`}</span> <Link className="text-link" to={adminHref({ section: 'orders', query: { ...query, account: undefined } })} replace scroll={false}>Show every account</Link>
        </p>
      )}
      {loadError && <LoadProblem message={loadError} onRetry={retry} retrying={retrying} />}
      <div className="sub-pills" role="group" aria-label="Order status">
        {pills.map(s => (
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
      <div className="admin-orders-bar">
        <p className="result-note admin-count">{orders.length >= ORDER_LIMIT ? `Showing the newest ${ORDER_LIMIT} matching orders.` : ''}</p>
        <div className="admin-orders-actions">
          <button className="button xs ghost" type="button" disabled={shown.length === 0} onClick={exportCsv}>Export CSV</button>
          <button className="button xs ghost" type="button" disabled={refreshing} onClick={refresh}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          {updatedText}
        </div>
      </div>
      {statusError && <p className="form-error" role="alert">{statusError}</p>}
      {orders.length > 0 && !workflow && (
        <p className="result-note">The quote workflow (more statuses, saving prices, converting quotes) needs the October 2026 database update (see BACKEND.md). Emailing a quote works now.</p>
      )}

      <div className="order-list">
        {shown.map(o => (
          <OrderCard key={o.id} order={o} states={states} workflow={workflow} tiers={tiers} onStatus={updateStatus} onReload={reload} notify={notify}
            isNew={isNewSince(o, since)} admins={admins} assignment={assignment} onAssigned={assigned} onOpenPrint={onOpenPrint}
            saving={saving.has(o.id)} movedTo={filter !== 'all' && movedIds.has(o.id) && o.status !== filter ? o.status : null} />
        ))}
      </div>
      {shown.length === 0 && !loadError && (
        filtered
          ? (
            <div className="empty-results">
              <p>No orders match these filters.</p>
              <Link className="text-link" to={clearHref} replace scroll={false} onClick={() => onSearch?.('')}>Clear filters</Link>
            </div>
          )
          : <p className="result-note">No orders in this state.</p>
      )}
    </div>
  );
}

// One order or quote (AW-024, Cursor's PR #13): staff edit quantities and unit
// prices (suggested from the list price and the account's tier), email the
// quote, and convert a priced quote into a confirmed order. AW-110 adds the
// print links, the cancellation reason and "Staff notes and history";
// AW-111 the New marker (isNew). AW-112: saving (a status change is on its
// way: the select takes no other), movedTo (the status the card moved to,
// out of the filter on screen).
function OrderCard({
  order: o, states, workflow, tiers, onStatus, onReload, notify, isNew = false, admins = null, assignment = false, onAssigned, onOpenPrint,
  saving = false, movedTo = null,
}) {
  const quote = isQuote(o);
  const items = o.order_items || [];
  const [draft, setDraft] = useState(null); // the lines being edited, or null
  // The lines as the editor opened them (with any suggested prices): a draft
  // that differs is unsaved, and leaving the page asks first (AW-118).
  const [baseline, setBaseline] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [suggested, setSuggested] = useState(false);
  const discountPct = tiers[o.profiles?.pricing_tier || 'standard'] ?? 0;

  const openEditor = async () => {
    setError(null);
    const lines = items.map(it => ({ ...it, qty: String(it.qty), unit_price: it.unit_price == null ? '' : String(Number(it.unit_price).toFixed(2)) }));
    setDraft(lines);
    setBaseline(lines);
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
    const fill = (current) => current && current.map(l => (l.unit_price === '' && prices.get(l.id) != null ? { ...l, unit_price: prices.get(l.id).toFixed(2) } : l));
    setDraft(fill);
    setBaseline(fill);
    setSuggested(lines.some(l => l.unit_price === '' && prices.get(l.id) != null));
  };
  const closeEditor = () => { setDraft(null); setBaseline(null); setSuggested(false); setError(null); };
  const dirty = !!draft && !!baseline && draft.some((l, i) => l.qty !== baseline[i]?.qty || l.unit_price !== baseline[i]?.unit_price);
  useLeaveGuard(dirty, `Your changes to ${o.ref_num} aren’t saved. Leave without saving them?`);
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
    notify?.(`Saved the quantities and prices of ${o.ref_num}.`);
    onReload();
  };
  const convert = async () => {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('admin_convert_quote', { p_order_id: o.id, p_user_id: null });
    setBusy(false);
    if (rpcError) setError(orderActionError(rpcError));
    else {
      notify?.(`${o.ref_num} is now an order.`);
      onReload();
    }
  };

  // Cancelling asks for a reason first (admin_set_order_status needs one);
  // the select keeps the saved status until it is confirmed, and Keep it or
  // Escape gives it the focus back (ModalLayer). On a database without the
  // function the reason can't be stored, so the dialog says so and doesn't
  // require it.
  const [cancelling, setCancelling] = useState(null); // { reasonStored }
  const [cancelBusy, setCancelBusy] = useState(false);
  const chooseStatus = (e) => {
    const value = e.target.value;
    if (saving) return;
    if (value === 'cancelled' && o.status !== 'cancelled') setCancelling({ reasonStored: !orderStatusFunctionMissing() });
    else onStatus(o, value);
  };
  const confirmCancel = async (reason) => {
    setCancelBusy(true);
    await onStatus(o, 'cancelled', reason);
    setCancelBusy(false);
    setCancelling(null);
  };
  const business = o.profiles?.business || o.business || o.contact;
  const [staffOpen, setStaffOpen] = useState(false);
  // Once opened, the panel stays mounted while it is closed, so closing it
  // doesn't drop a note being typed (its leave guard still asks; AW-118).
  const [staffOpened, setStaffOpened] = useState(false);

  const unpriced = items.some(it => it.unit_price == null);
  const draftTotal = draft ? linesTotal(draft) : null;
  const options = states.includes(o.status) ? states : [...states, o.status];
  const kindLabel = !quote ? 'Trade order' : (o.user_id == null ? 'Guest quote' : 'Account quote');

  return (
    <article className={`order-card${quote ? ' is-quote' : ''}${isNew ? ' is-new' : ''}`}>
      {/* AW-020: the status beside the ref, then what staff need to pick and
          deliver it, one fact per line instead of a run-on sentence. */}
      <div className="order-head admin-order-head">
        <div className="order-title">
          {isNew && <span className="order-new"><span>New</span><span className="sr-only"> since your last visit</span></span>}
          <span className="order-kind">{kindLabel}</span>
          <b className="order-ref">{o.ref_num}</b>
          <select id={orderStatusId(o.id)} aria-label={`Status for ${o.ref_num}`} value={o.status} aria-disabled={saving || undefined} onChange={chooseStatus}>
            {options.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          {movedTo && <span className="order-moved">{`Moved to ${statusLabel(movedTo)}`}</span>}
          {/* The status as text, for a printed list (the select doesn't print). */}
          <span className="order-status-print">{statusLabel(o.status)}</span>
        </div>
        <dl className="order-facts">
          <div><dt>Method</dt><dd>{orderMethod(o)}</dd></div>
          <div><dt>Requested</dt><dd>{requestedDate(o.preferred_date)}</dd></div>
          <div><dt>Total</dt><dd>{orderTotal(o, quote)}</dd></div>
          <div><dt>Placed</dt><dd>{placedAt(o.created_at)}</dd></div>
          <div>
            <dt>Contact</dt>
            <dd className="order-contact">
              <span>{o.contact || '—'}</span>
              {o.email && <a href={`mailto:${o.email}`}>{o.email}</a>}
              {o.phone && <a href={`tel:${String(o.phone).replace(/[^\d+]/g, '')}`}>{o.phone}</a>}
            </dd>
          </div>
          {/* The account's page (AW-113), when the order came from one. */}
          <div><dt>Account</dt><dd>{o.user_id ? <Link className="order-account-link" to={adminHref({ section: 'accounts', id: o.user_id })}>{orderAccount(o)}</Link> : orderAccount(o)}</dd></div>
          {o.assigned_to && (
            <div><dt>Assigned to</dt><dd>{staffName((admins || []).find((a) => a.id === o.assigned_to)) || 'A former admin'}</dd></div>
          )}
        </dl>
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
        {/* AW-110: the order's pick list and packing slip, on their own page. */}
        <Link id={printLinkId(o.id, 'pick')} className="button ghost" to={printHref(o.id, 'pick')} onClick={() => onOpenPrint?.(printHref(o.id, 'pick'), printLinkId(o.id, 'pick'))}>
          <span>Print pick list</span><span className="sr-only">{` for ${o.ref_num}`}</span>
        </Link>
        <Link id={printLinkId(o.id, 'slip')} className="button ghost" to={printHref(o.id, 'slip')} onClick={() => onOpenPrint?.(printHref(o.id, 'slip'), printLinkId(o.id, 'slip'))}>
          <span>Print packing slip</span><span className="sr-only">{` for ${o.ref_num}`}</span>
        </Link>
      </div>
      {workflow && quote && !draft && unpriced && <p className="order-notes">Price every line to convert this quote to an order.</p>}
      {/* Internal: notes, assignment and history load when this is opened. */}
      <details className="order-staff" open={staffOpen} onToggle={(e) => {
        const open = e.currentTarget.open;
        setStaffOpen(open);
        if (open) setStaffOpened(true);
      }}>
        <summary>
          <Icon name="plus" className="order-staff-plus" />
          <Icon name="minus" className="order-staff-minus" />
          <span>Staff notes and history</span><span className="sr-only">{` for ${o.ref_num}`}</span>
        </summary>
        {staffOpened && <OrderStaff order={o} admins={admins} assignment={assignment} onAssigned={onAssigned} notify={notify} />}
      </details>
      {cancelling && (
        <ConfirmDialog
          title={business ? `Cancel ${o.ref_num} for ${business}?` : `Cancel ${o.ref_num}?`}
          body={cancelling.reasonStored
            ? 'The order moves to cancelled. Say why: the reason goes in its history, which only staff see.'
            : 'The order moves to cancelled. A reason can’t be stored until the October 2026 database update (see BACKEND.md), so it is optional.'}
          confirmLabel="Cancel the order" cancelLabel="Keep it"
          reasonLabel={cancelling.reasonStored ? 'Reason for cancelling' : 'Reason for cancelling (optional)'} reasonOptional={!cancelling.reasonStored}
          reasonMax={MAX_NOTE} busy={cancelBusy}
          onConfirm={confirmCancel} onCancel={() => { if (!cancelBusy) setCancelling(null); }}
        />
      )}
    </article>
  );
}
