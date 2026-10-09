// My account's order history (AW-104, AW-105). Ten orders at a time, newest
// first, with 'Show more' for the next ten; a status filter and a search by
// order number above them (a new filter starts again at the first page).
// Each card says whether it was an order or a quote request, when it was
// placed, the status in the buyer's words, how it was to be delivered and on
// what day, and the buyer's notes. Long orders show their first three lines
// until 'Show all'. Reorder puts an order's lines back in the cart.
//
// The status is a quiet tag under the reference, its tone a coloured dot,
// so Reorder is the head's only action and the status doesn't read as a
// second button beside it (NEW-070).
//
// The query and the wording are in ./orderHistory.js. Requests are cancelled
// when the filter changes or the page goes away, and give up after
// REQUEST_TIMEOUT_MS (AW-194). A load that failed says why in words (offline,
// too slow, or failed), with Try again and the trade desk (AW-326, AW-084);
// offline before the first page arrived it says so at once, and a failed
// load is tried again when the connection comes back (AW-344). AccountPage
// keys this by account, so another account starts from nothing.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { linesFromOrder } from '../../lib/lines.js';
import { formatMoney } from '../../lib/format.js';
import { lineTotal } from '../../lib/pricing.js';
import { announce } from '../../lib/announce.js';
import { REQUEST_TIMEOUT_MS, isOffline, isTimeoutError, timeoutSignal } from '../../lib/network.js';
import { useOnlineStatus } from '../../lib/useOnlineStatus.js';
import { CallOrEmail } from '../../components/ContactLinks.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { Link } from '../../lib/router.js';
import { MAX_ORDER_SEARCH, cleanOrderSearch } from '../admin/orderQueries.js';
import {
  ITEMS_SHOWN, KIND_LABEL, ORDER_FILTERS, ORDER_PAGE, STATUS_LEGEND, buyerStatus, countText, loadOrders, orderKind,
  placedDate, requestedDate, shipLine, statusTone,
} from './orderHistory.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Typing in the order-number box filters after a short pause (Enter at once).
const SEARCH_DELAY_MS = 350;
const PRICE_PENDING = 'Price on confirmation';
const NO_MATCH = 'No orders match';
const NO_ORDERS = 'No orders yet';

// Why the order history isn't on screen (AW-326, AW-344, AW-194): what to
// do, never the database's own message (AW-084).
export const ORDER_HISTORY_ERRORS = {
  offline: 'You’re offline. Your orders will load when you reconnect.',
  timeout: 'Your orders are taking too long to load.',
  failed: 'We couldn’t load your orders.',
};
export const ORDERS_LOAD_ERROR = ORDER_HISTORY_ERRORS.failed;
export function OrdersLoadError({ kind = 'failed', role }) {
  return <p className="form-error" role={role}><span>{ORDER_HISTORY_ERRORS[kind] || ORDERS_LOAD_ERROR}</span> <CallOrEmail before="Need an order now? Call" after="." /></p>;
}
// The error's kind, read when the request failed.
const failureOf = (error) => {
  if (isOffline()) return 'offline';
  return isTimeoutError(error) ? 'timeout' : 'failed';
};
// The database's own words, for the console only: they name no buyer.
const logFailure = (error) => {
  console.error('Order history did not load:', [error?.code, error?.message || String(error)].filter(Boolean).join(' '));
};

// The note under an order after Reorder, as one string (AW-039).
const reorderMessage = (note, target) => (note.lines > 0
  ? `Added ${plural(note.lines, 'line')} (${plural(note.units, 'unit')}) to your ${target}.`
  : 'None of these items are available right now.')
  + (note.needsVariant > 0 ? ` ${plural(note.needsVariant, 'line')} need${note.needsVariant === 1 ? 's' : ''} a variant choice in your ${target}.` : '')
  + (note.unavailable.length > 0 ? ` No longer available: ${note.unavailable.join(', ')}.` : '');

export function OrderHistory({ userId, products = [], addLines, onOpenCart, isApprovedBuyer }) {
  const uid = useId();
  const headingId = `${uid}-title`;
  // The filters the list shows; `attempt` counts Try again.
  const [query, setQuery] = useState({ status: 'all', ref: '', attempt: 0 });
  const [refText, setRefText] = useState('');
  // The first page (and any more) for `query`. Until it arrives the last
  // list stays, marked busy.
  const [view, setView] = useState({ query: null, rows: [], total: null, lastFull: false, error: null });
  const [more, setMore] = useState(null); // { loading, error: kind }
  // The filters stay once the account has shown an order (or a filter was used).
  const [hasHistory, setHasHistory] = useState(false);
  const [reorderNote, setReorderNote] = useState(null);
  const moreRequest = useRef(null);
  const announceResult = useRef(false);
  const retrying = useRef(false);
  const focusNext = useRef(null);
  const statusRef = useRef(null);

  const loading = view.query !== query;
  const filtered = query.status !== 'all' || query.ref !== '';
  const { rows, total } = view;

  const applyFilters = useCallback((patch) => {
    announceResult.current = true;
    setMore(null);
    setQuery((current) => ({ ...current, ...patch }));
  }, []);

  // The first page for the filters. A newer filter (or leaving the page)
  // cancels the request in flight, and any 'Show more' with it.
  useEffect(() => {
    if (!supabase || !userId) return undefined;
    const t = timeoutSignal(REQUEST_TIMEOUT_MS);
    let live = true;
    loadOrders(supabase, { userId, status: query.status, ref: query.ref, signal: t.signal }).then((result) => {
      t.clear();
      if (!live) return;
      const matching = query.status !== 'all' || query.ref !== '';
      if (result.error) logFailure(result.error);
      const error = result.error ? failureOf(result.error) : null;
      setView({ query, rows: result.rows, total: result.total, lastFull: result.rows.length === ORDER_PAGE, error });
      if (!result.error && (result.rows.length > 0 || matching)) setHasHistory(true);
      if (retrying.current) {
        retrying.current = false;
        if (!result.error) focusNext.current = headingId;
      }
      if (announceResult.current) {
        announceResult.current = false;
        if (error) announce(ORDER_HISTORY_ERRORS[error]);
        else if (result.rows.length) announce(countText(result.rows.length, result.total, { filtered: matching }));
        else announce(matching ? NO_MATCH : NO_ORDERS);
      }
    });
    return () => {
      live = false;
      t.abort();
      moreRequest.current?.abort();
    };
  }, [userId, query, headingId]);

  // The order-number box filters a moment after typing stops.
  useEffect(() => {
    const ref = cleanOrderSearch(refText);
    if (ref === query.ref) return undefined;
    const id = window.setTimeout(() => applyFilters({ ref }), SEARCH_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [refText, query.ref, applyFilters]);

  // Focus that waits for the list to redraw: the first order 'Show more'
  // added when no more are left, or the heading after Try again worked.
  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    focusNext.current = null;
    el.focus();
  });

  const searchNow = (e) => {
    e.preventDefault();
    const ref = cleanOrderSearch(refText);
    if (ref !== query.ref) applyFilters({ ref });
  };
  const clearFilters = () => {
    setRefText('');
    applyFilters({ status: 'all', ref: '' });
    statusRef.current?.focus();
  };
  const retry = () => {
    if (loading) return;
    retrying.current = true;
    applyFilters({ attempt: query.attempt + 1 });
  };
  // Back online after a failed load: try again by itself, from 'Loading…'.
  const online = useOnlineStatus();
  const [wasOnline, setWasOnline] = useState(online);
  if (wasOnline !== online) {
    setWasOnline(online);
    if (online && view.error && !loading) {
      setView((current) => ({ ...current, query: null, error: null }));
      setMore(null);
      setQuery((current) => ({ ...current, attempt: current.attempt + 1 }));
    }
  }
  // Offline before the first page arrived: say so at once, without waiting
  // for the request's retries.
  const problem = view.error || (!online && view.query === null ? 'offline' : null);

  const left = total != null ? total - rows.length : (view.lastFull ? ORDER_PAGE : 0);
  const showMore = async () => {
    if (more?.loading || loading || !supabase) return;
    const t = timeoutSignal(REQUEST_TIMEOUT_MS);
    moreRequest.current?.abort();
    moreRequest.current = t;
    setMore({ loading: true, error: null });
    const result = await loadOrders(supabase, { userId, from: rows.length, status: query.status, ref: query.ref, signal: t.signal });
    t.clear();
    if (moreRequest.current !== t) return;
    moreRequest.current = null;
    if (result.error) {
      logFailure(result.error);
      setMore({ loading: false, error: failureOf(result.error) });
      return;
    }
    setMore(null);
    const known = new Set(rows.map((o) => o.id));
    const added = result.rows.filter((o) => !known.has(o.id));
    const next = [...rows, ...added];
    const nextTotal = total != null ? Math.max(total, next.length) : null;
    setView((current) => ({ ...current, rows: next, total: nextTotal, lastFull: result.rows.length === ORDER_PAGE }));
    announce(countText(next.length, nextTotal, { filtered }));
    // The button stays, with focus, while there are more; else focus goes
    // to the first order it added.
    const moreLeft = nextTotal != null ? nextTotal > next.length : result.rows.length === ORDER_PAGE;
    if (!moreLeft && added.length) focusNext.current = `${uid}-order-${added[0].id}`;
  };

  const target = isApprovedBuyer ? 'order' : 'quote';
  const reorder = (order) => {
    const { lines, unavailable, needsVariant } = linesFromOrder(order, products);
    if (lines.length && addLines) addLines(lines);
    setReorderNote({
      orderId: order.id,
      lines: lines.length,
      units: lines.reduce((sum, line) => sum + line.qty, 0),
      unavailable,
      needsVariant,
    });
  };

  const showFilters = hasHistory || filtered;
  const initial = view.query === null;
  return (
    <section className="section buyer-orders" aria-labelledby={headingId}>
      <div className="section-head">
        <div>
          <p className="eyebrow">HISTORY</p>
          <h2 id={headingId} tabIndex={-1}>Order history</h2>
        </div>
      </div>

      {showFilters && (
        <form className="form-grid history-filters" role="search" aria-label="Find orders" onSubmit={searchNow}>
          <div>
            <label htmlFor={`${uid}-status`}>Show</label>
            <select id={`${uid}-status`} ref={statusRef} value={query.status} onChange={(e) => applyFilters({ status: e.target.value })}>
              {ORDER_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-ref`}>Order number</label>
            <input id={`${uid}-ref`} type="search" value={refText} onChange={(e) => setRefText(e.target.value)} maxLength={MAX_ORDER_SEARCH}
                   placeholder="ALW-…" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          </div>
        </form>
      )}

      {problem && (
        <div className="orders-problem">
          {/* Read out as it appears; Try again's own label changes say
              nothing new. */}
          <OrdersLoadError kind={problem} role="alert" />
          <button className="text-link" type="button" onClick={retry} aria-disabled={loading || undefined}>
            <span>{loading && view.error ? 'Trying again…' : 'Try again'}</span>
          </button>
        </div>
      )}
      {initial && !problem && <p className="result-note">Loading…</p>}
      {!view.error && !initial && rows.length === 0 && !loading && !filtered && (
        // The shared empty state (AW-299), under the section's h2.
        <EmptyState level={3} title={NO_ORDERS} className="is-boxed" actions={<Link className="button" to="/catalog">Browse the catalog</Link>}>
          Orders you place will show up here, each with a one-click Reorder.
        </EmptyState>
      )}
      {!view.error && !initial && rows.length === 0 && !loading && filtered && (
        <EmptyState level={3} title={NO_MATCH} className="is-boxed" actions={<button className="text-link" type="button" onClick={clearFilters}>Clear filters</button>}>
          Try another status or order number.
        </EmptyState>
      )}

      {!view.error && !initial && (rows.length > 0 || loading) && (
        <>
          <p className="order-legend">{STATUS_LEGEND}</p>
          <p className="result-note order-count">{loading ? 'Loading…' : countText(rows.length, total, { filtered })}</p>
          <div className="order-list" aria-busy={loading || undefined}>
            {rows.map((o) => (
              <OrderCard key={o.id} order={o} headingId={`${uid}-order-${o.id}`} onReorder={reorder} onOpenCart={onOpenCart}
                         note={reorderNote?.orderId === o.id ? reorderMessage(reorderNote, target) : null} noteHasLines={reorderNote?.lines > 0}
                         viewLabel={`View ${target}`} />
            ))}
          </div>
          {more?.error && <OrdersLoadError kind={more.error} />}
          {!loading && left > 0 && (
            <div className="order-more">
              <button className="button ghost" type="button" onClick={showMore} aria-disabled={more?.loading || undefined}>
                <span>{more?.loading ? 'Loading more orders…' : `Show ${Math.min(ORDER_PAGE, left)} more ${Math.min(ORDER_PAGE, left) === 1 ? 'order' : 'orders'}`}</span>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function OrderCard({ order: o, headingId, onReorder, onOpenCart, note, noteHasLines, viewLabel }) {
  const [open, setOpen] = useState(false);
  const items = o.order_items || [];
  const shown = open ? items : items.slice(0, ITEMS_SHOWN);
  const listId = `${headingId}-items`;
  const facts = [placedDate(o.created_at), plural(o.total_units ?? 0, 'unit'), o.subtotal != null ? formatMoney(o.subtotal) : PRICE_PENDING]
    .filter(Boolean).join(' · ');
  const delivery = [shipLine(o), requestedDate(o)].filter(Boolean).join(' · ');
  return (
    <article className="order-card" aria-labelledby={headingId}>
      <div className="order-head">
        <div className="order-summary">
          <h3 className="order-title" id={headingId} tabIndex={-1}>
            <span className="order-kind">{KIND_LABEL[orderKind(o)]}</span>{' '}<span className="order-ref">{o.ref_num}</span>
          </h3>
          <p className="order-status"><span className={`status-pill ${statusTone(o.status)}`.trim()}>{buyerStatus(o)}</span></p>
          <small>{facts}</small>
          {delivery && <small className="order-ship">{delivery}</small>}
        </div>
        <div className="order-actions">
          <button className="button xs ghost" type="button" onClick={() => onReorder(o)} disabled={!items.length}>
            {/* Which order, for a screen reader; the space stays outside the
                hidden span, where every accessible-name engine keeps it. */}
            Reorder{' '}<span className="sr-only">{o.ref_num}</span>
          </button>
        </div>
      </div>
      <ul className="order-items" id={listId}>
        {shown.map((it) => (
          <li key={it.id}>
            <span><span>{`${it.qty} × ${it.product_name}`}</span> <span className="sku">{`(${it.sku})`}</span></span>
            <span className={`line-total${it.unit_price == null ? ' is-pending' : ''}`}>{it.unit_price != null ? formatMoney(lineTotal(it.unit_price, it.qty)) : PRICE_PENDING}</span>
          </li>
        ))}
      </ul>
      {items.length > ITEMS_SHOWN && (
        <div className="order-items-toggle">
          <button className="text-link" type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
            <span>{open ? 'Show fewer items' : `Show all ${items.length} items`}</span>
          </button>
        </div>
      )}
      {o.notes && <p className="order-notes">{`Your notes: ${o.notes}`}</p>}
      {note && (
        <div className="order-foot" role="status">
          <p>{note}</p>
          {noteHasLines && <button className="button xs" type="button" onClick={onOpenCart}>{viewLabel}</button>}
        </div>
      )}
    </article>
  );
}
