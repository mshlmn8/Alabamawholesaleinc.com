// Admin -> Orders' queries and export (AW-110, AW-199). Pure apart from the
// query builder it is handed (orderQueries.test.js).
//
//   ordersQuery(client, filters, { status, page })   one page of the orders
//                                  that match the toolbar and the status,
//                                  newest first, with the count of them all
//   orderStatusCounts(client, filters, states)       how many match each
//                                  status, and in all (HEAD requests)
//   ordersForExport(client, filters, status)         every match, for the CSV
//   orderCsvRecords(orders)        one CSV record per order line
//
// The three share applyOrderFilters, so a pill's count, its pages and its
// export always agree.
// filters: { search, from, to, on, method, account }. search is free text
// (a reference, business, contact, email or phone): it stays in the page's
// state and never goes into the URL. from/to are the days an order was
// placed (YYYY-MM-DD, this computer's days), on the day the buyer asked for,
// method 'delivery' or 'willcall', account a profile id (AccountDetail links
// to /admin/orders?account=<id>).

import { lineTotal } from '../../lib/pricing.js';
import { fetchAllRows } from '../../lib/paging.js';
import { isMissingSchema, withStatus } from './adminData.js';

// order_items(*): the workflow columns (original_qty, sell_unit) exist only
// after the October 2026 update. The account is named through its foreign key:
// since 20261008200000, orders.quoted_by is a second link to profiles, and
// since 20261010122000 orders.assigned_to a third, and PostgREST refuses an
// embed that could follow more than one (PGRST201).
export const ADMIN_ORDER_SELECT = '*, order_items(*), profiles!orders_user_id_fkey(business, name, pricing_tier)';

// Orders a page (AW-199): the status pills count on the server, and the
// list pages through every match.
export const ORDER_PAGE_SIZE = 50;
export const MAX_ORDER_SEARCH = 100;
export const ORDER_SEARCH_COLUMNS = ['ref_num', 'business', 'contact', 'email', 'phone'];

// A quote: kind 'quote' (a guest or an account that isn't approved; see
// 20261009150000). Without kind, a guest's or an unpriced request.
export const isQuote = (o) => (o?.kind ? o.kind === 'quote' : (o?.user_id == null || o?.subtotal == null));

// The search as it is sent: spaces collapsed, at most 100 characters.
export const cleanOrderSearch = (text) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_ORDER_SEARCH).trim();

// A value inside a PostgREST logic filter, or=(…): in double quotes, so the
// commas, dots, colons and parentheses a business name can hold stay text;
// a double quote or a backslash in it is escaped with a backslash.
export const postgrestQuote = (value) => `"${String(value).replace(/["\\]/g, '\\$&')}"`;

// The ILIKE pattern that finds `text` anywhere. LIKE's wildcards % and _
// (and its escape character \) are escaped, so a typed % or _ matches only
// itself. PostgREST turns every * of a LIKE pattern into %, and that can't be
// escaped, so a typed * matches any one character (_) instead of any run.
export const containsPattern = (text) => `%${String(text).replace(/[\\%_]/g, '\\$&').replace(/\*/g, '_')}%`;

// The or=(…) filter for the search: any of the five columns contains it.
export const orderSearchFilter = (text) => {
  const value = postgrestQuote(containsPattern(text));
  return ORDER_SEARCH_COLUMNS.map((column) => `${column}.ilike.${value}`).join(',');
};

// When a calendar day (YYYY-MM-DD) starts on this computer, as an ISO
// instant; plusDays moves to a later day (the end of a "Placed to" day is the
// start of the next one, which is right across a daylight-saving change too).
export function dayStart(isoDate, plusDays = 0) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(y, m - 1, d + plusDays);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

// The toolbar's filters from the URL query and the search box.
export const orderFilters = (query = {}, search = '') => ({
  search: cleanOrderSearch(search),
  from: query.from || null,
  to: query.to || null,
  on: query.on || null,
  method: query.method || null,
  account: query.account || null,
});
export const hasOrderFilters = (filters) => Object.values(filters).some(Boolean);

// The toolbar's filters on a query: placed on or after the start of `from`
// and before the end of `to`, asked for on `on`, by method and account, and
// matching the search.
export function applyOrderFilters(query, filters = {}) {
  let q = query;
  const search = cleanOrderSearch(filters.search);
  if (search) q = q.or(orderSearchFilter(search));
  if (filters.from) q = q.gte('created_at', dayStart(filters.from));
  if (filters.to) q = q.lt('created_at', dayStart(filters.to, 1));
  if (filters.on) q = q.eq('preferred_date', filters.on);
  if (filters.method) q = q.eq('delivery', filters.method);
  if (filters.account) q = q.eq('user_id', filters.account);
  return q;
}
const withOrderStatus = (query, status) => (status && status !== 'all' ? query.eq('status', status) : query);
// Newest first; orders placed in the same instant by id, so a page never
// repeats or skips one.
const newestFirst = (query) => query.order('created_at', { ascending: false }).order('id', { ascending: false });

// The rows of a page (1-based): [from, to] for range().
export function orderPageRange(page = 1, pageSize = ORDER_PAGE_SIZE) {
  const n = Math.max(1, Math.floor(Number(page)) || 1);
  return [(n - 1) * pageSize, n * pageSize - 1];
}
// How many pages `total` orders fill (at least one).
export const orderPageCount = (total, pageSize = ORDER_PAGE_SIZE) => Math.max(1, Math.ceil((Number(total) || 0) / pageSize));

// One page of the orders that match the filters and the status ('all' or
// none: every status), with { count: 'exact' }: the result's count is of
// every match. A page past the end is PostgREST's 416 (PGRST103), whose
// details say how many there are (rangeTotal).
export function ordersQuery(client, filters = {}, { status = 'all', page = 1, pageSize = ORDER_PAGE_SIZE, select = ADMIN_ORDER_SELECT } = {}) {
  const [from, to] = orderPageRange(page, pageSize);
  const query = withOrderStatus(applyOrderFilters(client.from('orders').select(select, { count: 'exact' }), filters), status);
  return newestFirst(query).range(from, to);
}

// The total a PGRST103 (a range past the end) names: "An offset of 100 was
// requested, but there are only 12 rows." null for any other error.
export function rangeTotal(error) {
  if (error?.code !== 'PGRST103') return null;
  const match = /only (\d+) rows?/.exec(String(error.details ?? ''));
  return match ? Number(match[1]) : 0;
}

// How many orders match the filters in each of `states`, and in 'all':
// { counts: { new: 12, …, all: 312 }, error }. HEAD requests (no rows), the
// way the header counts unseen orders (ordersSeen.js countUnseen). error:
// the first that failed (its counts are left out).
export async function orderStatusCounts(client, filters = {}, states = []) {
  const keys = [...states.filter((s) => s !== 'all'), 'all'];
  const results = await Promise.all(keys.map(async (status) => {
    try {
      return await withOrderStatus(applyOrderFilters(client.from('orders').select('id', { count: 'exact', head: true }), filters), status);
    } catch (error) {
      return { error };
    }
  }));
  const counts = {};
  let error = null;
  results.forEach((result, i) => {
    const failed = withStatus(result || {});
    if (failed) error = error || failed;
    else if (Number.isFinite(result?.count)) counts[keys[i]] = result.count;
  });
  return { counts, error };
}

// Every order the filters and the status match, for Export CSV, a page of
// 1000 at a time (fetchAllRows): { data, error, status, truncated }.
export function ordersForExport(client, filters = {}, status = 'all', { select = ADMIN_ORDER_SELECT, pageSize, max } = {}) {
  return fetchAllRows(
    () => newestFirst(withOrderStatus(applyOrderFilters(client.from('orders').select(select), filters), status)),
    { pageSize, max },
  );
}

// Whether the database has the quote workflow (orders.kind, 20261008200000),
// asked once when there is no row to tell by (hasQuoteWorkflow reads rows):
// true, false (42703: no such column), or null when it couldn't tell.
export async function probeQuoteWorkflow(client) {
  try {
    const { error } = await client.from('orders').select('kind').limit(1);
    if (!error) return true;
    return isMissingSchema(error) ? false : null;
  } catch {
    return null;
  }
}

// Export CSV: one record per order line (an order without lines gets one
// record with the line columns empty). Text cells go through toCsv's formula
// guard (csv.js): business, contact and notes come from the public quote
// form. Money and quantities are numbers.
export const ORDER_CSV_COLUMNS = [
  'ref_num', 'created_at', 'kind', 'status', 'business', 'contact', 'email', 'phone', 'delivery', 'preferred_date',
  'sku', 'product_name', 'variant', 'qty', 'unit_price', 'line_total', 'subtotal',
];
const amount = (value) => (value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));

export function orderCsvRecords(orders = []) {
  const records = [ORDER_CSV_COLUMNS];
  for (const o of orders) {
    const head = [
      o.ref_num, o.created_at, o.kind || (isQuote(o) ? 'quote' : 'order'), o.status, o.business, o.contact, o.email, o.phone,
      o.delivery, o.preferred_date ?? null,
    ];
    const items = o.order_items?.length ? o.order_items : [null];
    for (const it of items) {
      records.push([
        ...head,
        it?.sku ?? null, it?.product_name ?? null, it?.variant ?? null, it ? amount(it.qty) : null,
        it ? amount(it.unit_price) : null, it ? lineTotal(it.unit_price, it.qty) : null, amount(o.subtotal),
      ]);
    }
  }
  return records;
}

// orders-2026-10-08.csv, by this computer's date.
export function ordersCsvFileName(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `orders-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
}
