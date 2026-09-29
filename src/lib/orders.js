// Quote submission. Prices, totals and the reference number are made inside
// submit_quote; the browser sends the buyer's details and, per line, the
// product id, variant label and quantity.
//
// submit_quote v2 (supabase/migrations/20260928123000_submit_quote_v2.sql)
// makes the reference itself (AW-049), needs a ship-to address only for
// delivery (AW-079), stores the store's license details (AW-014), and refuses
// bad input, suspended accounts and floods with a typed hint (AW-198,
// AW-201), which quoteErrorMessage() turns into text for the buyer.
//
// The live database may not have v2 yet (the owner applies migrations
// later). Then the call fails with "no such function" (PGRST202 / 42883) and
// is sent once more the old way: the 13-argument signature with a long
// random reference made here (the old function stores the reference it is
// sent), without the license details, and for will-call with the warehouse
// address, which the old function requires.

import { COMPANY } from '../data/content.js';
import { DELIVERY_ROUTE_STATES } from '../data/quoteRules.js';
import { MISSING_FUNCTION_CODES } from './pricing.js';
import { supabase } from './supabase.js';

const text = (value) => String(value ?? '').trim();
const textOrNull = (value) => text(value) || null;

// The arguments of the v2 call. Will-call sends no address, whatever the
// hidden address fields still hold. The state is sent upper-case.
export function quoteParams(formData, items, license = null) {
  const willCall = formData.delivery === 'willcall';
  return {
    p_business: text(formData.business),
    p_contact: text(formData.contact),
    p_email: text(formData.email),
    p_phone: text(formData.phone),
    p_delivery: formData.delivery,
    p_preferred_date: formData.preferredDate || null,
    p_notes: textOrNull(formData.notes),
    p_ship_street: willCall ? null : text(formData.shipStreet),
    p_ship_city: willCall ? null : text(formData.shipCity),
    p_ship_state: willCall ? null : text(formData.shipState).toUpperCase(),
    p_ship_zip: willCall ? null : text(formData.shipZip),
    p_items: items.map((it) => ({
      product_id: it.productId,
      variant: it.variant || null,
      qty: it.qty,
    })),
    p_license_no: textOrNull(license?.licenseNo),
    p_resale_cert_no: textOrNull(license?.resaleCertNo),
    p_license_attested: Boolean(license?.attested),
  };
}

// 'ALW-Q-' and 10 hex digits (40 random bits), the shape of the references
// the server makes. Only for a database without submit_quote v2.
const HEX = '0123456789ABCDEF';
export function makeClientRef(getRandomValues = (bytes) => globalThis.crypto.getRandomValues(bytes)) {
  const bytes = getRandomValues(new Uint8Array(5));
  return `ALW-Q-${Array.from(bytes, (b) => HEX[b >> 4] + HEX[b & 15]).join('')}`;
}

// The arguments of the old 13-argument call, from the v2 ones.
export function legacyQuoteParams(params, refNum = makeClientRef()) {
  const legacy = { p_ref_num: refNum, ...params };
  delete legacy.p_license_no;
  delete legacy.p_resale_cert_no;
  delete legacy.p_license_attested;
  const noAddress = !legacy.p_ship_street && !legacy.p_ship_city && !legacy.p_ship_state && !legacy.p_ship_zip;
  if (legacy.p_delivery === 'willcall' && noAddress) {
    legacy.p_ship_street = COMPANY.addressStreet;
    legacy.p_ship_city = COMPANY.addressCity;
    legacy.p_ship_state = COMPANY.addressState;
    legacy.p_ship_zip = COMPANY.addressZip;
  }
  return legacy;
}

// Saves the quote. `license` is { licenseNo, resaleCertNo, attested } when
// the form asked for it, else null. Resolves { ok, order, legacy }, where
// order is what submit_quote returned ({ id, ref_num, total_units, subtotal,
// and from v2 kind, priced_lines, unpriced_lines }); throws the error
// otherwise (quoteErrorMessage() words it).
export async function submitOrder({ formData, items, license = null }, { client = supabase } = {}) {
  if (!client) {
    const err = new Error('Quote requests can’t be saved right now.');
    err.code = 'unavailable';
    throw err;
  }

  const params = quoteParams(formData, items, license);
  let { data, error } = await client.rpc('submit_quote', params);
  let legacy = false;
  if (error && MISSING_FUNCTION_CODES.includes(error.code)) {
    legacy = true;
    ({ data, error } = await client.rpc('submit_quote', legacyQuoteParams(params)));
  }
  if (error) throw error;
  if (!data?.id) throw new Error('The quote was not saved.');
  return { source: 'supabase', ok: true, order: data, legacy };
}

// Today's date in Birmingham (YYYY-MM-DD), the earliest preferred date
// submit_quote accepts (AW-198).
export function todayInBirmingham(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const listStates = (states) => (states.length > 1
  ? `${states.slice(0, -1).join(', ')} and ${states[states.length - 1]}`
  : states.join(''));

// Text for the hints submit_quote raises. An object is a sentence around the
// trade desk's phone and email (CallOrEmail's before/after); a string stands
// alone. AW-200 (Phase 6) adds the remaining ones.
const HINT_MESSAGES = {
  account_suspended: { before: 'Ordering is paused on this account. Call', after: ' and a trade rep will help you sort it out.' },
  rate_limited: { before: 'Too many quote requests in a short time, so this one wasn’t sent. Try again in a few minutes, or call the trade desk at', after: '.' },
  contact_required: 'Fill in the business, contact, email and phone.',
  field_too_long: 'One of the fields is too long. Shorten it and submit again.',
  invalid_email: 'Enter a valid email address.',
  address_required: 'Enter the ship-to street, city, state and ZIP, or choose will-call pickup.',
  invalid_zip: 'Enter a 5-digit ZIP code (or ZIP+4).',
  invalid_state: 'Enter the 2-letter state code, for example AL.',
  delivery_state: `Delivery routes cover ${listStates(DELIVERY_ROUTE_STATES)}. For another state, choose will-call pickup.`,
  past_date: 'Choose a preferred date from today on.',
  license_required: 'Enter the license and resale certificate numbers and check the statement to quote tobacco and novelty items.',
};

export const QUOTE_ERROR_GENERIC = { before: 'We couldn’t save this quote. Please call the trade desk at', after: '.' };
export const QUOTE_UNAVAILABLE = { before: 'Quote requests can’t be saved right now. Call', after: ' and the trade desk will write it up with you.' };

// What to tell the buyer when submitOrder() failed: the text for its hint,
// else the generic "call the trade desk" copy. Never a reference number: a
// failed quote has none.
export function quoteErrorMessage(err) {
  if (err?.code === 'unavailable') return QUOTE_UNAVAILABLE;
  return (err?.hint && HINT_MESSAGES[err.hint]) || QUOTE_ERROR_GENERIC;
}

// The form field a hint is about (quoteForm names), so the page can mark it.
const HINT_FIELDS = {
  invalid_email: 'email',
  address_required: 'shipStreet',
  invalid_zip: 'shipZip',
  invalid_state: 'shipState',
  delivery_state: 'shipState',
  past_date: 'preferredDate',
  license_required: 'licenseNo',
};
export const quoteErrorField = (err) => (err?.hint && HINT_FIELDS[err.hint]) || null;
