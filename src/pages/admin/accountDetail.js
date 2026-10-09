// Admin -> Accounts' account search and account detail page (AW-113), pure
// (accountDetail.test.js). The page is AccountDetail.jsx.
//
//   matchesAccountSearch(profile, text)  the list's search box
//   accountStatusCounts(profiles)        the list's status pills (AW-268)
//   accountCountText({ listed, shown, filter, searching })   its count line
//   contactDraft / contactChanges / validateContact   the contact and store form
//   loadAccountOrders / ordersSummary                 the account's orders
//   loadStatusHistory / historyText                   its status and role history

import { fromCents, toCents } from '../../lib/pricing.js';
import { accountStatus } from '../../lib/accountStatus.js';
import { adminHref } from '../../lib/adminRoutes.js';
import { statusLabel } from './orderStaff.js';
import { adminDate } from './dates.js';

export const MAX_ACCOUNT_SEARCH = 100;

// What the list's search box looks in: business, name, email and phone,
// ignoring case. A search with three or more digits also finds a phone
// written with other punctuation ('2055550100' finds '205-555-0100').
export function matchesAccountSearch(profile, text) {
  const query = String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!query) return true;
  const fields = [profile?.business, profile?.name, profile?.email, profile?.phone].map((v) => String(v ?? '').toLowerCase());
  if (fields.some((value) => value.includes(query))) return true;
  const digits = query.replace(/\D/g, '');
  return digits.length >= 3 && digits.length === query.replace(/[\s().+-]/g, '').length
    && String(profile?.phone ?? '').replace(/\D/g, '').includes(digits);
}

// How many accounts each status pill of the list counts (AW-268):
// { pending, approved, suspended, all }. A status the site doesn't know
// counts as pending, as everywhere else (accountStatus.js). The counts come
// from the loaded accounts; AW-199's per-status count queries can take this
// function's place.
export function accountStatusCounts(profiles) {
  const counts = { pending: 0, approved: 0, suspended: 0, all: 0 };
  for (const profile of profiles || []) {
    counts[accountStatus(profile || {})] += 1;
    counts.all += 1;
  }
  return counts;
}

// The list's count line (AW-268): '3 pending accounts', '1 of 3 pending
// accounts' while searching, '40 accounts' for every status. Listed accounts
// whose status changed since the filter was chosen are counted apart
// ('2 pending accounts · 1 moved'), so the line agrees with the pills.
// listed: the filter's rows; shown: those the search keeps.
export function accountCountText({ listed = [], shown = listed, filter = 'all', searching = false }) {
  const moved = (rows) => (filter === 'all' ? 0 : rows.filter((p) => accountStatus(p || {}) !== filter).length);
  const total = listed.length - moved(listed);
  const noun = `${filter === 'all' ? '' : `${filter} `}${total === 1 ? 'account' : 'accounts'}`;
  const rows = searching ? shown : listed;
  const away = moved(rows);
  const text = searching ? `${rows.length - away} of ${total} ${noun}` : `${total} ${noun}`;
  return away ? `${text} · ${away} moved` : text;
}

// 'Test Market LLC', else the contact's name, else the email.
export const accountName = (p) => String(p?.business || p?.name || p?.email || 'this account').trim();

// The account's page, and the id of the list's link to it (it takes the
// focus again when the page is left).
export const accountHref = (id) => adminHref({ section: 'accounts', id });
export const accountLinkId = (id) => `account-link-${id}`;
// The account's orders in Admin -> Orders, every status.
export const accountOrdersHref = (id) => adminHref({ section: 'orders', query: { account: id, status: 'all' } });

// The contact and store fields staff edit, in form order. Their columns are
// the profile's own (store_* since Cursor's 20261008191000: the store
// address is the profile's address). Email is not here: it follows the
// sign-in email (hint profile_email, 20261009140000).
export const CONTACT_FIELDS = [
  { key: 'business', label: 'Business name', max: 200, required: true, autoComplete: 'organization' },
  { key: 'name', label: 'Contact name', max: 200, required: true, autoComplete: 'name' },
  { key: 'phone', label: 'Phone', max: 40, type: 'tel', autoComplete: 'tel' },
  { key: 'business_type', label: 'Business type', max: 100 },
  { key: 'store_street', label: 'Store street', max: 200, full: true, autoComplete: 'address-line1' },
  { key: 'store_city', label: 'City', max: 100, autoComplete: 'address-level2' },
  { key: 'state', label: 'Store state', max: 2, hint: 'Two letters, such as AL.', autoComplete: 'address-level1' },
  { key: 'store_zip', label: 'ZIP', max: 10, inputMode: 'numeric', autoComplete: 'postal-code' },
];
const STATE_PATTERN = /^[A-Z]{2}$/;
// submit_quote's ZIP rule (20261009130000).
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

// The form's values for a profile ('' for none).
export function contactDraft(profile) {
  return Object.fromEntries(CONTACT_FIELDS.map(({ key }) => [key, profile?.[key] == null ? '' : String(profile[key])]));
}

// A field's value as it is saved: trimmed, the state upper-cased, null for
// nothing.
function savedValue(key, value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return key === 'state' ? text.toUpperCase() : text;
}

// The columns that changed: { column: value }. Only these are sent, so a
// database without the store_* columns still saves the others.
export function contactChanges(draft, profile) {
  const patch = {};
  for (const { key } of CONTACT_FIELDS) {
    const next = savedValue(key, draft?.[key]);
    const current = profile?.[key] ?? null;
    // A value left as it was is no change (an older row's state 'Other' too).
    if (next !== current && String(draft?.[key] ?? '').trim() !== current) patch[key] = next;
  }
  return patch;
}

// What is wrong with the changed fields: { column: message }. Unchanged
// values are left alone, so an older row (state 'Other', no business) still
// saves its other fields.
export function validateContact(draft, profile) {
  const patch = contactChanges(draft, profile);
  const errors = {};
  for (const { key, label, max, required } of CONTACT_FIELDS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (value == null) {
      if (required) errors[key] = `Enter the ${label.toLowerCase()}.`;
      continue;
    }
    if (value.length > max) errors[key] = `Keep it to ${max} characters or fewer.`;
    else if (key === 'state' && !STATE_PATTERN.test(value)) errors[key] = 'Use the two-letter state code, such as AL.';
    else if (key === 'store_zip' && !ZIP_PATTERN.test(value)) errors[key] = 'Enter a 5-digit ZIP code, or ZIP+4.';
    else if (key === 'phone' && value.replace(/\D/g, '').length < 7) errors[key] = 'Enter a phone number with its area code.';
  }
  return { ok: Object.keys(errors).length === 0, errors, patch };
}

// The business types already on file, for the field's suggestions, sorted.
export function businessTypes(profiles) {
  const seen = new Map();
  for (const p of profiles || []) {
    const text = String(p?.business_type ?? '').trim();
    if (text && !seen.has(text.toLowerCase())) seen.set(text.toLowerCase(), text);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

// The account's orders: the newest 50. A database without orders.kind (the
// live one before the October 2026 update) answers 42703, so it is asked
// again without it.
export const ACCOUNT_ORDER_LIMIT = 50;
export const ACCOUNT_ORDER_COLUMNS = 'id,ref_num,status,kind,subtotal,total_units,created_at';
const LEGACY_ACCOUNT_ORDER_COLUMNS = 'id,ref_num,status,subtotal,total_units,created_at';
export async function loadAccountOrders(client, id) {
  const query = (columns) => client.from('orders').select(columns).eq('user_id', id).order('created_at', { ascending: false }).limit(ACCOUNT_ORDER_LIMIT);
  let result = await query(ACCOUNT_ORDER_COLUMNS);
  if (result?.error && String(result.error.code) === '42703') result = await query(LEGACY_ACCOUNT_ORDER_COLUMNS);
  return result;
}

// The last order's date, and the total of the priced orders that aren't
// cancelled (in dollars, summed in cents): { count, lastAt, total, priced }.
export function ordersSummary(orders = []) {
  let cents = 0;
  let priced = 0;
  let lastAt = null;
  for (const o of orders) {
    const at = Date.parse(o?.created_at);
    if (!Number.isNaN(at) && (lastAt == null || at > lastAt)) lastAt = at;
    if (o?.status === 'cancelled' || o?.subtotal == null) continue;
    const value = toCents(o.subtotal);
    if (value == null) continue;
    cents += value;
    priced += 1;
  }
  return { count: orders.length, lastAt: lastAt == null ? null : new Date(lastAt).toISOString(), total: fromCents(cents), priced };
}

// 'Oct 8, 2026'.
export const dayText = (value) => adminDate(value);

// The account's status history, newest first (profile_status_log,
// 20261008193000), with the role changes 20261011111000 adds (AW-203). A
// database without the role columns answers 42703 (or PGRST204), so it is
// asked again without them.
export const HISTORY_LIMIT = 20;
export const HISTORY_COLUMNS = 'id, old_status, new_status, old_role, new_role, changed_by, changed_at';
const HISTORY_COLUMNS_BEFORE_ROLES = 'id, old_status, new_status, changed_by, changed_at';
export async function loadStatusHistory(client, id) {
  const query = (columns) => client.from('profile_status_log').select(columns).eq('profile_id', id).order('changed_at', { ascending: false }).limit(HISTORY_LIMIT);
  let result = await query(HISTORY_COLUMNS);
  if (result?.error && ['42703', 'PGRST204'].includes(String(result.error.code))) result = await query(HISTORY_COLUMNS_BEFORE_ROLES);
  return result;
}

// What a history row says: 'Approved', 'Made an admin', 'Admin access
// removed', or both at once: 'Approved and made an admin'.
export function historyText(row) {
  const role = row?.new_role && row.new_role !== row.old_role
    ? (row.new_role === 'admin' ? 'Made an admin' : 'Admin access removed')
    : null;
  const status = row?.new_status && row.new_status !== row.old_status ? statusLabel(row.new_status) : null;
  if (role && status) return `${status} and ${role[0].toLowerCase()}${role.slice(1)}`;
  return role || status || statusLabel(row?.new_status) || 'Status changed';
}
