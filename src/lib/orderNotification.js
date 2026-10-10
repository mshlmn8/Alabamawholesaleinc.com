// The order email (owner answer 2026-10, AW-024): when a customer places an
// order, it goes to the orders inbox, and staff prepare it from there.
//
// The order itself is saved by submit_quote (src/lib/orders.js); that is
// the record, and Admin -> Orders lists it. Once it is saved, checkout also
// posts a copy to Netlify Forms, form 'order-notification', and Netlify
// emails each submission to the address set in its dashboard (Forms -> Form
// notifications -> Email notification: alwholesale@gmail.com). Netlify only
// accepts submissions for a form it found in the deployed HTML, so
// index.html declares this one, hidden, with every field below and the
// honeypot (src/lib/orderNotification.test.js checks they match).
//
// The post never holds up or fails the order: checkout doesn't wait for it,
// it gives up after NOTIFY_TIMEOUT_MS, and a failure is logged with its
// status only, never the order's details (no personal data in logs). An
// order whose email didn't arrive is still in Admin -> Orders.
//
// Anyone can post to a Netlify form, so an email is a heads-up, not proof:
// staff prepare an order once they find its reference in Admin -> Orders,
// which the email links to (admin-link). The honeypot and Netlify's own spam
// filter catch simple bots.
//
// Pure apart from sendOrderNotification(), which takes its fetch as an
// option for tests.

import { currentSite } from '../data/siteFacts.js';
import { adminHref, isUuid } from './adminRoutes.js';
import { DELIVERY_LABELS, formatPreferredDate, formatSentAt } from './receipt.js';
import { timeoutSignal } from './network.js';

export const ORDER_NOTIFICATION_FORM = 'order-notification';
// Netlify's honeypot (netlify-honeypot="bot-field" on the form in
// index.html): people never see it, so it is always sent empty.
export const HONEYPOT_FIELD = 'bot-field';
// The fields of a submission, in the order Netlify lists them in the email.
// 'subject' is Netlify's: a hidden field of that name is the email's subject.
export const ORDER_NOTIFICATION_FIELDS = Object.freeze([
  'subject', 'reference', 'placed-at', 'business', 'contact', 'email', 'phone',
  'delivery', 'preferred-date', 'ship-to', 'items', 'line-count', 'total-units', 'notes', 'admin-link',
]);
// Netlify answers a form post within a second or two; past this the page
// stops waiting (the order is saved either way).
export const NOTIFY_TIMEOUT_MS = 10000;
// fetch's keepalive (the post finishes even if the buyer leaves the page)
// takes bodies up to 64 KiB; a bigger one is sent without it.
const KEEPALIVE_MAX_BYTES = 60000;

const text = (value) => String(value ?? '').trim();

// The product's own name, without the ' — Variant' the cart adds to a line.
const baseName = (line) => {
  const name = text(line.name);
  const variant = text(line.variant);
  return variant && name.endsWith(` — ${variant}`) ? name.slice(0, -(variant.length + 3)) : name;
};

// One line of the order, as staff pick it: quantity, product, variant, SKU
// and what quantity 1 is ('2 × Kite cigarette tobacco | Variant: Cherry |
// SKU: AW-KITE-CHERRY | Sell unit: case').
export function orderLineText(line) {
  const parts = [`${Number(line.qty) || 0} × ${baseName(line)}`];
  if (text(line.variant)) parts.push(`Variant: ${text(line.variant)}`);
  if (text(line.sku)) parts.push(`SKU: ${text(line.sku)}`);
  if (text(line.sellUnit)) parts.push(`Sell unit: ${text(line.sellUnit)}`);
  return parts.join(' | ');
}

// Where the order goes: the ship-to address for delivery, or the warehouse
// for will-call (its address as staff set it, AW-030).
function shipToText(data) {
  if (data.delivery === 'willcall') return `Will-call pickup at ${currentSite().addressShort}`;
  const street = text(data.shipStreet);
  const city = text(data.shipCity);
  const state = text(data.shipState).toUpperCase();
  const zip = text(data.shipZip);
  return [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(', ');
}

// The submission for a saved order: { field: text } for every field in
// ORDER_NOTIFICATION_FIELDS.
//   ref      the reference submit_quote made (or the client one an older
//            database stored)
//   orderId  the order's id, for the link to its pick list in Admin
//   data     the checkout form as it was sent
//   lines    the cart lines that were sent (name, variant, sku, qty, sellUnit)
//   savedAt  when it was saved (ms)
//   origin   the site's origin, for the admin link
export function orderNotificationFields({ ref, orderId = null, data = {}, lines = [], savedAt = Date.now(), origin = '' }) {
  const reference = text(ref);
  const business = text(data.business);
  const delivery = data.delivery === 'willcall' ? 'willcall' : 'delivery';
  const adminPath = isUuid(orderId)
    ? adminHref({ page: 'admin', section: 'orders', id: String(orderId).toLowerCase(), view: 'print' })
    : adminHref({ page: 'admin', section: 'orders' });
  const units = lines.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
  return {
    subject: `New order ${reference}${business ? ` from ${business}` : ''}`,
    reference,
    'placed-at': formatSentAt(savedAt),
    business,
    contact: text(data.contact),
    email: text(data.email),
    phone: text(data.phone),
    delivery: DELIVERY_LABELS[delivery],
    'preferred-date': formatPreferredDate(data.preferredDate) || 'Any day',
    'ship-to': shipToText({ ...data, delivery }),
    items: lines.map(orderLineText).join('\n'),
    'line-count': String(lines.length),
    'total-units': String(units),
    notes: text(data.notes),
    'admin-link': `${text(origin)}${adminPath}`,
  };
}

// The body Netlify Forms takes: form-name, the honeypot (empty) and the
// fields, x-www-form-urlencoded.
export function encodeOrderNotification(fields) {
  const params = new URLSearchParams();
  params.set('form-name', ORDER_NOTIFICATION_FORM);
  params.set(HONEYPOT_FIELD, '');
  for (const name of ORDER_NOTIFICATION_FIELDS) params.set(name, String(fields?.[name] ?? ''));
  return params.toString();
}

// Posts the submission to '/' (same origin: the Content-Security-Policy's
// connect-src 'self' allows it). Resolves true when Netlify took it, false
// otherwise; never rejects, so a caller can leave it running.
export async function sendOrderNotification(fields, {
  fetchImpl = typeof fetch === 'function' ? fetch : null,
  timeoutMs = NOTIFY_TIMEOUT_MS,
  endpoint = '/',
  log = (...args) => console.warn(...args),
} = {}) {
  if (typeof fetchImpl !== 'function') return false;
  const body = encodeOrderNotification(fields);
  const t = timeoutSignal(timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: t.signal,
      credentials: 'same-origin',
      keepalive: body.length <= KEEPALIVE_MAX_BYTES,
    });
    if (response?.ok) return true;
    log(`The order email wasn’t sent (status ${response?.status ?? 'unknown'}). The order is saved; it is in Admin -> Orders.`);
    return false;
  } catch (error) {
    log(`The order email wasn’t sent (${error?.name || 'error'}). The order is saved; it is in Admin -> Orders.`);
    return false;
  } finally {
    t.clear();
  }
}
