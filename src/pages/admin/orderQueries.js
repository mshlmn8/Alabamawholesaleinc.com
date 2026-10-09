// Admin -> Orders' query and export (AW-110). Pure apart from the query
// builder it is handed (orderQueries.test.js).
//
//   ordersQuery(client, filters)   the orders that match the toolbar, newest
//                                  first, at most ORDER_LIMIT
//   orderCsvRecords(orders)        one CSV record per order line
//
// filters: { search, from, to, on, method, account }. search is free text
// (a reference, business, contact, email or phone): it stays in the page's
// state and never goes into the URL. from/to are the days an order was
// placed (YYYY-MM-DD, this computer's days), on the day the buyer asked for,
// method 'delivery' or 'willcall', account a profile id (AccountDetail links
// to /admin/orders?account=<id>).

import { lineTotal } from '../../lib/pricing.js';

// order_items(*): the workflow columns (original_qty, sell_unit) exist only
// after the October 2026 update. The account is named through its foreign key:
// since 20261008200000, orders.quoted_by is a second link to profiles, and
// since 20261010122000 orders.assigned_to a third, and PostgREST refuses an
// embed that could follow more than one (PGRST201).
export const ADMIN_ORDER_SELECT = '*, order_items(*), profiles!orders_user_id_fkey(business, name, pricing_tier)';

// The newest 200 that match. Paging and per-status counts from the server
// are AW-199, not built yet: the status pills count within these.
export const ORDER_LIMIT = 200;
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

// The query for the filters: placed on or after the start of `from` and
// before the end of `to`, asked for on `on`, by method and account, and
// matching the search; newest first.
export function ordersQuery(client, filters = {}, select = ADMIN_ORDER_SELECT) {
  let query = client.from('orders').select(select);
  const search = cleanOrderSearch(filters.search);
  if (search) query = query.or(orderSearchFilter(search));
  if (filters.from) query = query.gte('created_at', dayStart(filters.from));
  if (filters.to) query = query.lt('created_at', dayStart(filters.to, 1));
  if (filters.on) query = query.eq('preferred_date', filters.on);
  if (filters.method) query = query.eq('delivery', filters.method);
  if (filters.account) query = query.eq('user_id', filters.account);
  return query.order('created_at', { ascending: false }).limit(ORDER_LIMIT);
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
