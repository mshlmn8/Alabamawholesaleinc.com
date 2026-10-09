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
//
// Each call gives up after QUOTE_SUBMIT_TIMEOUT_MS (AW-194,
// src/lib/network.js). A call that timed out may still have been saved, so
// it is never sent again with an older signature: the buyer is told to call
// before submitting again, with the reference an older signature was sent
// with (the only reference ever shown for a quote that wasn't confirmed).

import { COMPANY } from '../data/content.js';
import { DELIVERY_STATE_NOTE } from '../data/quoteRules.js';
import { MISSING_FUNCTION_CODES } from './pricing.js';
import { QTY_RANGE_TEXT } from './quantity.js';
import { QUOTE_SUBMIT_TIMEOUT_MS, isOffline, isTimeoutError, timeoutError, timeoutSignal } from './network.js';
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

// One submit_quote call, abandoned after timeoutMs: { data, error }.
async function callSubmitQuote(client, args, timeoutMs) {
  const t = timeoutSignal(timeoutMs);
  try {
    const request = client.rpc('submit_quote', args);
    return await (typeof request?.abortSignal === 'function' ? request.abortSignal(t.signal) : request);
  } catch (error) {
    return { data: null, error };
  } finally {
    t.clear();
  }
}

// Saves the quote. Resolves { ok, order, legacy }, where order is what
// submit_quote returned ({ id, ref_num, total_units, subtotal, and from the
// current function kind, priced_lines, unpriced_lines }) and legacy says an
// older signature saved it; throws the error otherwise (quoteErrorMessage()
// words it). A call that took too long throws code 'timeout', with refNum
// when an older signature was sent that reference.
// TODO(owner): Which address or phone should hear about a new quote, and which provider sends it? Nothing is sent on its own yet. (AW-050)
export async function submitOrder({ formData, items }, { client = supabase, timeoutMs = QUOTE_SUBMIT_TIMEOUT_MS } = {}) {
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
    const { data, error } = await callSubmitQuote(client, args, timeoutMs);
    if (error && isMissingFunction(error)) { missing = error; continue; }
    if (error && isTimeoutError(error)) {
      const late = Object.assign(timeoutError('The quote request took too long.'), { cause: error });
      if (signature !== 'current') late.refNum = refNum;
      throw late;
    }
    if (error) throw error;
    if (!data?.id) throw new Error('The quote was not saved.');
    workingSignature = signature;
    return { ok: true, order: data, legacy: signature !== 'current' };
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

// Text for the hints submit_quote raises. An object is a sentence around the
// trade desk's phone and email (CallOrEmail's before/after); a string stands
// alone.
const HINT_MESSAGES = {
  account_suspended: { before: 'Ordering is paused on this account. Call', after: ' and a trade rep will help you sort it out.' },
  rate_limited: { before: 'Too many quote requests in a short time, so this one wasn’t sent. Try again in a few minutes, or call the trade desk at', after: '.' },
  contact_required: 'Fill in the business, contact, email and phone.',
  field_too_long: 'One of the fields is too long. Shorten it and submit again.',
  invalid_email: 'Enter a valid email address.',
  address_required: 'Enter the ship-to street, city, state and ZIP, or choose will-call pickup.',
  invalid_zip: 'Enter a 5-digit ZIP code (or ZIP+4).',
  invalid_state: 'Enter the 2-letter state code, for example AL.',
  delivery_state: DELIVERY_STATE_NOTE,
  past_date: 'Choose a preferred date from today on.',
  license_required: 'Enter the tobacco license and resale certificate numbers and confirm the 21+ statement to quote tobacco and vape items.',
  // AW-200: the remaining ones.
  no_items: 'Add at least one item before you submit.',
  // submit_quote takes 200 lines; the storefront has no constant for that.
  too_many_items: { before: 'This request has more lines than one request can take. Split it into two, or call', after: '.' },
  invalid_delivery: 'Choose delivery or will-call pickup.',
  ref_unavailable: { before: 'We couldn’t assign a reference number, so nothing was sent. Try again in a moment, or call', after: '.' },
  invalid_quantity: `Quantities must be ${QTY_RANGE_TEXT}.`,
  // The 13- and 16-argument functions refuse a reference they already have
  // ("This quote was already submitted"): a double send, or a retry after a
  // lost answer.
  already_submitted: { before: 'This request may already have been sent. Call', after: ' before you submit it again.' },
};

// Hints about one product (the order-line trigger, 20261011110000, puts its
// id in the error's details). They name it when the request's lines say
// which one it is.
const PRODUCT_HINT_MESSAGES = {
  product_unavailable: (name) => (name
    ? `‘${name}’ is no longer available. Remove it, then submit again.`
    : 'An item in this request is no longer available, so nothing was sent. Reload the page to see which, remove it, then submit again.'),
  variant_required: (name) => (name
    ? `Choose a variant for ‘${name}’, then submit again.`
    : 'Choose a variant for every product that has more than one, then submit again.'),
  unknown_variant: (name) => (name
    ? `The variant chosen for ‘${name}’ is no longer offered. Choose another, then submit again.`
    : 'One of the chosen variants is no longer offered. Choose another, then submit again.'),
  variant_unavailable: (name) => (name
    ? `‘${name}’ can’t be ordered right now. Choose another variant or remove it, then submit again.`
    : 'One of the chosen variants can’t be ordered right now. Choose another or remove it, then submit again.'),
};

// A database without 20261009130000 (or 20261011110000) raises these without
// a hint: the hint is read from the message instead.
const MESSAGE_HINTS = [
  [/^Product is not available/, 'product_unavailable'],
  [/^Invalid quantity/, 'invalid_quantity'],
  [/^Choose a variant for /, 'variant_required'],
  [/^Unknown variant for /, 'unknown_variant'],
  [/^Too many items/, 'too_many_items'],
  [/^Add at least one item/, 'no_items'],
  [/^A ship-to address is required/, 'address_required'],
  [/^Contact details are required/, 'contact_required'],
  [/^Invalid delivery method/, 'invalid_delivery'],
  [/^This quote was already submitted/, 'already_submitted'],
  // PR #12's 16-argument function raises the license rule without a hint.
  [/tobacco license, resale certificate, and 21\+ confirmation/i, 'license_required'],
];
const hintOf = (err) => {
  if (err?.hint) return err.hint;
  const message = String(err?.message || '');
  return MESSAGE_HINTS.find(([pattern]) => pattern.test(message))?.[1] || null;
};

// The product a hint is about, as the buyer's lines name it: by the id in
// the error's details, else from the message ("Choose a variant for <name>").
const NAMED_IN_MESSAGE = /^(?:Choose a variant|Unknown variant) for (.+)$/;
const baseName = (it) => (it.variant && String(it.name).endsWith(` — ${it.variant}`)
  ? String(it.name).slice(0, -(it.variant.length + 3))
  : String(it.name));
function productNameOf(err, items) {
  const id = Number(String(err?.details ?? '').trim());
  const lines = Number.isInteger(id) && id > 0 ? items.filter((it) => Number(it?.productId) === id && it?.name) : [];
  // One line names its variant too; several lines of the product, the product.
  if (lines.length === 1) return String(lines[0].name);
  if (lines.length > 1) return baseName(lines[0]);
  return NAMED_IN_MESSAGE.exec(String(err?.message || '').trim())?.[1] || null;
}

export const QUOTE_ERROR_GENERIC = { before: 'We couldn’t save this quote. Please call the trade desk at', after: '.' };
export const QUOTE_UNAVAILABLE = { before: 'Quote requests can’t be saved right now. Call', after: ' and the trade desk will write it up with you.' };
export const QUOTE_OFFLINE = 'You’re offline, so nothing was sent. Reconnect and submit again.';

// A submit that took too long may have been saved (AW-194). With the
// reference an older signature was sent, the trade desk can look it up.
export function quoteTimeoutMessage(refNum = null) {
  const before = 'This is taking longer than expected, and the request may have been saved. Call';
  return refNum
    ? { before, after: ` and give quote reference ${refNum} before you submit it again.` }
    : { before, after: ' before you submit it again, so it isn’t sent twice.' };
}

// What to tell the buyer when submitOrder() failed: a timeout first, then
// the text for its hint (naming the product from `items`, the lines that
// were sent), then that the browser is offline, else the generic "call the
// trade desk" copy. Never a reference number for a quote that failed; a
// timed-out one may have been saved, and is cited only with "may".
export function quoteErrorMessage(err, { items = [] } = {}) {
  if (isTimeoutError(err)) return quoteTimeoutMessage(err.refNum || null);
  if (err?.code === 'unavailable') return QUOTE_UNAVAILABLE;
  const hint = hintOf(err);
  if (hint && PRODUCT_HINT_MESSAGES[hint]) return PRODUCT_HINT_MESSAGES[hint](productNameOf(err, items || []));
  if (hint && HINT_MESSAGES[hint]) return HINT_MESSAGES[hint];
  if (isOffline()) return QUOTE_OFFLINE;
  return QUOTE_ERROR_GENERIC;
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
