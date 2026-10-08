// Quote submission. Prices, totals and the reference number are made inside
// submit_quote; the browser sends the buyer's details, the tobacco license
// answers (AW-014) and, per line, the product id, variant label and quantity.
//
// The current submit_quote (supabase/migrations/20261009130000_submit_quote_v3.sql)
// makes the reference itself (AW-049), needs a ship-to address only for
// delivery (AW-079), keeps PR #12's rule that a guest or unapproved account
// quoting tobacco or vape lines gives a license number, a resale certificate
// and the 21+ confirmation (AW-014, src/lib/regulated.js), and refuses bad
// input, suspended accounts and floods with a typed hint (AW-198, AW-201),
// which quoteErrorMessage() turns into text for the buyer.
//
// The live database may be older (the owner applies migrations later). A
// signature it doesn't have fails with "no such function" (PGRST202 / 42883),
// and the quote is sent once more with the next older one:
//   current   15 arguments, no p_ref_num             (20261009130000)
//   licensed  16 arguments: p_ref_num + the answers  (20261008190000, PR #12)
//   legacy    13 arguments: p_ref_num, the answers
//             go in the notes                        (20260925120000)
// The two older ones store the reference they are sent, so it is made here
// (40 random bits), and they need an address even for will-call, so will-call
// sends the warehouse address. The signature that worked is remembered for
// the rest of the visit, so a live database without the new functions costs
// one call per quote after the first.

import { COMPANY } from '../data/content.js';
import { DELIVERY_ROUTE_STATES } from '../data/quoteRules.js';
import { MISSING_FUNCTION_CODES } from './pricing.js';
import { supabase } from './supabase.js';

const text = (value) => String(value ?? '').trim();
const textOrNull = (value) => text(value) || null;

const isMissingFunction = (error) => MISSING_FUNCTION_CODES.includes(error?.code);

// The arguments of the current call. Will-call sends no address, whatever
// the hidden address fields still hold. The state is sent upper-case. The
// license answers are sent as the form holds them; QuotePage blanks them
// when the cart doesn't need them.
export function quoteParams(formData, items) {
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
    p_license_no: textOrNull(formData.licenseNo),
    p_resale_cert: textOrNull(formData.resaleCert),
    p_purchasers_21: Boolean(formData.purchasers21),
  };
}

// 'ALW-Q-' and 10 hex digits (40 random bits), the shape of the references
// the server makes. Only for a database without the current submit_quote.
const HEX = '0123456789ABCDEF';
export function makeClientRef(getRandomValues = (bytes) => globalThis.crypto.getRandomValues(bytes)) {
  const bytes = getRandomValues(new Uint8Array(5));
  return `ALW-Q-${Array.from(bytes, (b) => HEX[b >> 4] + HEX[b & 15]).join('')}`;
}

// The older functions require a ship-to address for will-call too.
function withPickupAddress(args) {
  const noAddress = !args.p_ship_street && !args.p_ship_city && !args.p_ship_state && !args.p_ship_zip;
  if (args.p_delivery === 'willcall' && noAddress) {
    args.p_ship_street = COMPANY.addressStreet;
    args.p_ship_city = COMPANY.addressCity;
    args.p_ship_state = COMPANY.addressState;
    args.p_ship_zip = COMPANY.addressZip;
  }
  return args;
}

// The arguments of PR #12's 16-argument call, from the current ones.
export function licensedQuoteParams(params, refNum = makeClientRef()) {
  return withPickupAddress({ p_ref_num: refNum, ...params });
}

// The arguments of the 13-argument call, from the current ones. It has no
// license parameters, so the answers go in the notes instead of being lost.
export function legacyQuoteParams(params, refNum = makeClientRef()) {
  const { p_license_no: licenseNo, p_resale_cert: resaleCert, p_purchasers_21: purchasers21, ...rest } = params;
  const licenseNote = [
    licenseNo ? `State tobacco/retail license #: ${licenseNo}` : '',
    resaleCert ? `Sales-tax / resale certificate #: ${resaleCert}` : '',
    purchasers21 ? 'Confirmed: valid tobacco retail license and purchasers are 21+.' : '',
  ].filter(Boolean).join('\n');
  return withPickupAddress({
    p_ref_num: refNum,
    ...rest,
    p_notes: [rest.p_notes, licenseNote].filter(Boolean).join('\n') || null,
  });
}

const SIGNATURES = ['current', 'licensed', 'legacy'];
let workingSignature = null;
export const resetQuoteSignatureForTests = () => { workingSignature = null; };

// Saves the quote. Resolves { ok, order, legacy }, where order is what
// submit_quote returned ({ id, ref_num, total_units, subtotal, and from the
// current function kind, priced_lines, unpriced_lines }) and legacy says an
// older signature saved it; throws the error otherwise (quoteErrorMessage()
// words it).
export async function submitOrder({ formData, items }, { client = supabase } = {}) {
  if (!client) {
    const err = new Error('Quote requests can’t be saved right now.');
    err.code = 'unavailable';
    throw err;
  }

  const params = quoteParams(formData, items);
  const order = workingSignature ? [workingSignature, ...SIGNATURES.filter((s) => s !== workingSignature)] : SIGNATURES;
  let refNum = null; // one client reference for every older call of this submit
  let missing = null;
  for (const signature of order) {
    let args = params;
    if (signature !== 'current') {
      refNum = refNum || makeClientRef();
      args = signature === 'licensed' ? licensedQuoteParams(params, refNum) : legacyQuoteParams(params, refNum);
    }
    const { data, error } = await client.rpc('submit_quote', args);
    if (error && isMissingFunction(error)) { missing = error; continue; }
    if (error) throw error;
    if (!data?.id) throw new Error('The quote was not saved.');
    workingSignature = signature;
    return { source: 'supabase', ok: true, order: data, legacy: signature !== 'current' };
  }
  workingSignature = null;
  throw missing;
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
  license_required: 'Enter the tobacco license and resale certificate numbers and confirm the 21+ statement to quote tobacco and vape items.',
};

// PR #12's 16-argument function raises the license rule without a hint.
const hintOf = (err) => err?.hint
  || (/tobacco license, resale certificate, and 21\+ confirmation/i.test(String(err?.message || '')) ? 'license_required' : null);

export const QUOTE_ERROR_GENERIC = { before: 'We couldn’t save this quote. Please call the trade desk at', after: '.' };
export const QUOTE_UNAVAILABLE = { before: 'Quote requests can’t be saved right now. Call', after: ' and the trade desk will write it up with you.' };

// What to tell the buyer when submitOrder() failed: the text for its hint,
// else the generic "call the trade desk" copy. Never a reference number: a
// failed quote has none.
export function quoteErrorMessage(err) {
  if (err?.code === 'unavailable') return QUOTE_UNAVAILABLE;
  const hint = hintOf(err);
  return (hint && HINT_MESSAGES[hint]) || QUOTE_ERROR_GENERIC;
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
export const quoteErrorField = (err) => {
  const hint = hintOf(err);
  return (hint && HINT_FIELDS[hint]) || null;
};
