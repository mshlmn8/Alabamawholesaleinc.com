// My account's order history (AW-104, AW-105): the query, a page at a time,
// and how an order reads to the buyer. Pure apart from the query builder it
// is handed (orderHistory.test.js).
//
//   loadOrders(client, { userId, from, status, ref, signal })
//                    one page of the account's orders, newest first, with the
//                    total on the first page: { rows, total, error }
//   buyerStatus(o)   the status in the buyer's words ('Received', …)
//   orderKind(o)     'order' or 'quote'
//   shipLine(o)      'Will-call pickup' or 'Delivery to …', or null
//   requestedDate(o) 'Requested Oct 12, 2026', or null

import { cleanOrderSearch, containsPattern, isQuote } from '../admin/orderQueries.js';

export const ORDER_PAGE = 10;
// Lines a card shows before 'Show all n items'.
export const ITEMS_SHOWN = 3;

const FIELDS = 'id, ref_num, status, total_units, subtotal, created_at';
const DETAILS = 'delivery, preferred_date, notes, ship_street, ship_city, ship_state, ship_zip';
const ITEMS = 'order_items(id, product_id, variant, product_name, sku, qty, unit_price)';
// What the card shows, then the same less what an older database lacks:
// orders.kind arrives with the October 2026 update (20261008200000); the
// address, delivery, date and notes columns exist since 20260925120000.
export const ORDER_COLUMN_STEPS = [
  `${FIELDS}, ${DETAILS}, kind, ${ITEMS}`,
  `${FIELDS}, ${DETAILS}, ${ITEMS}`,
  `${FIELDS}, ${ITEMS}`,
];
const MISSING_COLUMN = ['42703', 'PGRST204'];
// The first step this database answered, so later pages skip the ones it
// refused.
let workingStep = 0;
export const resetOrderColumnsForTests = () => { workingStep = 0; };

// The status filter's groups. Open is every status before the order is
// delivered, picked up or cancelled (orders_status_chk's nine).
export const ORDER_FILTERS = [
  { value: 'all', label: 'All orders', statuses: null },
  { value: 'open', label: 'Open', statuses: ['new', 'contacted', 'quoted', 'confirmed', 'picking', 'ready', 'out_for_delivery'] },
  { value: 'done', label: 'Delivered or picked up', statuses: ['fulfilled'] },
  { value: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];
const statusesFor = (value) => ORDER_FILTERS.find((f) => f.value === value)?.statuses || null;

// One page of the account's orders, newest first. `from` is the index of
// the first row; the first page also asks for the total. `status` is an
// ORDER_FILTERS value, `ref` text the reference contains. `signal` aborts the
// request (a page change, a newer filter, a timeout).
export async function loadOrders(client, { userId, from = 0, status = 'all', ref = '', signal = null } = {}) {
  const statuses = statusesFor(status);
  const search = cleanOrderSearch(ref);
  for (let step = workingStep; step < ORDER_COLUMN_STEPS.length; step++) {
    let query = client.from('orders')
      .select(ORDER_COLUMN_STEPS[step], from === 0 ? { count: 'exact' } : undefined)
      .eq('user_id', userId);
    if (statuses) query = query.in('status', statuses);
    if (search) query = query.ilike('ref_num', containsPattern(search));
    query = query.order('created_at', { ascending: false }).range(from, from + ORDER_PAGE - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error, count } = await query;
    if (error && MISSING_COLUMN.includes(error.code) && step < ORDER_COLUMN_STEPS.length - 1) continue;
    if (error) return { rows: [], total: null, error };
    workingStep = step;
    return { rows: data || [], total: Number.isFinite(count) ? count : null, error: null };
  }
  return { rows: [], total: null, error: { code: 'unknown' } };
}

// The status in the buyer's words. An unknown status reads as received.
export const BUYER_STATUS = {
  new: 'Received',
  contacted: 'Confirming with a rep',
  quoted: 'Quote ready',
  confirmed: 'Confirmed',
  picking: 'Being picked',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  fulfilled: 'Delivered',
  cancelled: 'Cancelled',
};
export const buyerStatus = (o) => {
  if (o?.status === 'fulfilled' && o.delivery === 'willcall') return 'Picked up';
  return BUYER_STATUS[o?.status] || BUYER_STATUS.new;
};
// The pill's colour: done, stopped, waiting on the trade desk, or under way.
export const statusTone = (status) => {
  if (status === 'fulfilled') return 'fulfilled';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'contacted' || status === 'quoted') return 'contacted';
  return '';
};
// The one-line key above the list.
export const STATUS_LEGEND = 'How an order moves: Received, Confirming with a rep (Quote ready, for a quote request), Confirmed, Being picked, Ready or Out for delivery, then Delivered or Picked up.';

// An order or a quote request. The account's own rows carry no user_id, so a
// database without orders.kind goes by the subtotal, as Admin does.
export const orderKind = (o) => (isQuote({ ...o, user_id: o?.user_id ?? 'account' }) ? 'quote' : 'order');
export const KIND_LABEL = { order: 'Order', quote: 'Quote request' };

const DATE = { month: 'short', day: 'numeric', year: 'numeric' };
// 'Oct 8, 2026', on this computer's calendar.
export const placedDate = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', DATE);
};
// A day the buyer picked (YYYY-MM-DD) is that day wherever it is read: it is
// formatted from its parts, never shifted by a time zone.
export const dayDate = (ymd) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? ''));
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { ...DATE, timeZone: 'UTC' });
};
export const requestedDate = (o) => {
  const day = dayDate(o?.preferred_date);
  return day ? `Requested ${day}` : null;
};

// How the order was to reach the buyer, as they asked for it.
export function shipLine(o) {
  if (o?.delivery === 'willcall') return 'Will-call pickup';
  if (o?.delivery !== 'delivery') return null;
  const street = [o.ship_street, o.ship_city].map((part) => String(part ?? '').trim()).filter(Boolean).join(', ');
  const region = [o.ship_state, o.ship_zip].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
  const address = [street, region].filter(Boolean).join(', ');
  return address ? `Delivery to ${address}` : 'Delivery';
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// 'Showing 10 of 23 orders' above the list.
export function countText(shown, total, { filtered = false } = {}) {
  const noun = filtered ? 'matching order' : 'order';
  if (total == null || shown >= total) return `Showing ${plural(shown, noun)}`;
  return `Showing ${shown} of ${plural(total, noun)}`;
}
