// The receipt for a quote or order that was just saved (AW-012, AW-022).
//
// buildReceipt() is a snapshot of what was sent: the reference and totals
// submit_quote returned, the lines, and the delivery details from the form.
// It is taken once, when the save succeeds, so edits made while the request
// was on its way (or the cart lines removed right after) never change it.
//
// The store keeps ONE record in sessionStorage (STORAGE.receipt), for this
// tab only: { owner, entryKey, receipt }. `owner` is the cart owner
// (cartOwner(): a user id or 'guest') and `entryKey` the history entry the
// receipt was shown on (the router's location.key). App shows it again only
// on that entry for that owner, so a reload or Back keeps the confirmation,
// a fresh visit to /quote shows checkout, and nothing can be sent twice from
// it. Where sessionStorage is blocked or full it is kept in memory for this
// page view instead; damaged values read as no receipt.
//
// A receipt holds the buyer's contact details: it never goes in a URL or a
// log, and App clears it on sign-out (handleLogout).

import { useSyncExternalStore } from 'react';
import { STORAGE, TIME_ZONE, TIME_ZONE_LABEL } from '../data/content.js';
import { usPhone } from './phone.js';

// The delivery options as checkout names them (QuotePage's select), so the
// receipt repeats the buyer's choice word for word.
export const DELIVERY_LABELS = Object.freeze({
  delivery: 'Next-day delivery (on route)',
  willcall: 'Will-call pickup',
});

// A form date ('2026-10-09') as US English ('Friday, October 9, 2026'), or ''
// for no date or one that doesn't exist. The day is the one the buyer picked,
// whatever this computer's time zone.
export function formatPreferredDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return '';
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// When the request was sent (NEW-062): savedAt (ms) on the warehouse's
// clock, 'Oct 9, 2026, 3:45 PM CT', or '' when there is no such time. The
// parts are named one by one, which prints what dateStyle 'medium' and
// timeStyle 'short' do, because Safari 14.0 and Firefox 78 ignore those two.
// Made on first use, inside the try: a browser without the time zone throws.
let sentFormat = null;
export function formatSentAt(savedAt) {
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return '';
  try {
    sentFormat = sentFormat || new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
    return `${sentFormat.format(savedAt)} ${TIME_ZONE_LABEL}`;
  } catch {
    return ''; // out of the Date range, or no such time zone
  }
}

// Where the trade desk will reach the buyer (NEW-062): a ten-digit phone
// number written the usual way, '(205) 555-0123', whatever was typed; an
// email, or anything else, as given. Applied when the receipt is shown, so
// receipts saved before this still benefit.
export const reachAtText = (value) => usPhone(value)?.formatted ?? String(value ?? '');

const text = (value) => String(value ?? '').trim();
const countOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// The receipt for a saved quote or order. `order` is submit_quote's answer:
// { id, ref_num, total_units, subtotal } from every signature, plus kind,
// priced_lines and unpriced_lines from v3 (each may be missing). `lines` are
// the cart items that were sent, `data` the form as it was sent, and
// `asOrder` whether it was saved as an order (QuotePage decides).
export function buildReceipt({ order, lines = [], data = {}, asOrder = false }) {
  const delivery = data.delivery === 'willcall' ? 'willcall' : 'delivery';
  return {
    ref: text(order?.ref_num),
    kind: asOrder ? 'order' : 'quote',
    totalUnits: countOrNull(order?.total_units),
    subtotal: countOrNull(order?.subtotal),
    pricedLines: countOrNull(order?.priced_lines),
    unpricedLines: countOrNull(order?.unpriced_lines),
    lines: lines.map((it) => ({
      lineKey: String(it.lineKey),
      name: text(it.name),
      sku: text(it.sku),
      qty: Number(it.qty) || 0,
      sellUnit: text(it.sellUnit),
    })),
    delivery,
    ship: delivery === 'delivery'
      ? { street: text(data.shipStreet), city: text(data.shipCity), state: text(data.shipState).toUpperCase(), zip: text(data.shipZip) }
      : null,
    preferredDate: text(data.preferredDate),
    notes: text(data.notes),
    contact: text(data.contact),
    business: text(data.business),
    reachAt: text(data.phone) || text(data.email),
    savedAt: Date.now(),
  };
}

// ---- The store ------------------------------------------------------------

const KEY = STORAGE.receipt;

function sessionArea() {
  try {
    return window.sessionStorage || null;
  } catch {
    return null; // blocked site data, some private modes, sandboxed frames
  }
}

// The value this page view could not store: a raw string, null for "no
// receipt", or undefined while storage works.
let memory;

function getRaw() {
  if (memory !== undefined) return memory;
  const area = sessionArea();
  if (!area) return null;
  try {
    return area.getItem(KEY);
  } catch {
    return null;
  }
}

function setRaw(raw) {
  const area = sessionArea();
  try {
    if (!area) throw new Error('sessionStorage is not available');
    if (raw === null) area.removeItem(KEY);
    else area.setItem(KEY, raw);
    memory = undefined;
  } catch {
    memory = raw;
  }
}

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

// A stored record, or null for anything that isn't one.
function toRecord(data) {
  if (!isPlainObject(data) || !isPlainObject(data.receipt)) return null;
  const { owner, entryKey, receipt } = data;
  if (typeof owner !== 'string' || !owner || typeof entryKey !== 'string' || !entryKey) return null;
  if (typeof receipt.ref !== 'string' || !receipt.ref || !Array.isArray(receipt.lines)) return null;
  return { owner, entryKey, receipt };
}

// The record as stored now, the same object while the stored text is
// unchanged (useSyncExternalStore compares snapshots by identity).
let cache = { raw: null, value: null };
export function readLastReceipt() {
  const raw = getRaw();
  if (raw === cache.raw) return cache.value;
  let data = null;
  try {
    data = raw === null ? null : JSON.parse(raw);
  } catch {
    data = null; // damaged value: no receipt, replaced on the next save
  }
  cache = { raw, value: toRecord(data) };
  return cache.value;
}

const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

export function subscribeReceipt(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Keeps `record` ({ owner, entryKey, receipt }) as this tab's last receipt,
// replacing the one before.
export function saveReceipt({ owner, entryKey, receipt }) {
  const record = toRecord({ owner, entryKey, receipt });
  if (!record) return;
  setRaw(JSON.stringify(record));
  notify();
}

// Forgets the last receipt (sign-out).
export function clearReceipt() {
  setRaw(null);
  notify();
}

// This tab's last receipt record, or null.
export function useLastReceipt() {
  return useSyncExternalStore(subscribeReceipt, readLastReceipt, () => null);
}

// Tests only: forgets the value held in memory and the parsed copy.
export function resetReceiptStoreForTests() {
  memory = undefined;
  cache = { raw: null, value: null };
}
