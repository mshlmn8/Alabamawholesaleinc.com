// The buyer details on the quote/checkout form, and how they follow the
// signed-in account (AW-186, AW-190).
//
// - The account's profile fills business, contact, email, phone and, from
//   the store address on the application (AW-092), the ship-to address when
//   it arrives, also after the page opened (a reload or a direct link to
//   /quote renders before the profile has loaded). It fills only empty
//   fields, so anything the buyer typed stays.
// - When the account changes (a sign-out, or another buyer signing in from
//   another tab), the previous buyer's details, phone, ship-to address,
//   notes and tobacco license answers (AW-014) are cleared first, so an order
//   is never sent under one account with another buyer's details.
//
// - The account's last delivery address (src/lib/shipTo.js, AW-102) then
//   replaces the four ship-to fields, as a whole, while each is still empty
//   or exactly what the profile filled in (applyShipTo): never over typed
//   text. "Use a different address" clears them (clearShipTo) while they
//   hold the account's own address (accountShipToSource).
//
// A saved draft (AW-080, src/lib/quoteDraft.js) comes before profile values
// for the same account: initialQuoteForm(profile, draft) starts from the
// draft, and the profile fills only the fields it left empty. The draft is
// discarded when the account changes. A draft's typed address is typed
// text, so the last delivery address never replaces it.

import { routeStateCode } from '../data/quoteRules.js';

export const EMPTY_QUOTE_FORM = Object.freeze({
  business: '', contact: '', email: '', phone: '',
  notes: '', delivery: 'delivery', preferredDate: '',
  shipStreet: '', shipCity: '', shipState: '', shipZip: '',
  // Guest and unapproved quotes with tobacco or vape lines (AW-014).
  licenseNo: '', resaleCert: '', purchasers21: false,
});

// Fields that belong to one buyer.
const BUYER_FIELDS = [
  'business', 'contact', 'email', 'phone', 'shipStreet', 'shipCity', 'shipState', 'shipZip', 'notes',
  'licenseNo', 'resaleCert', 'purchasers21',
];
// Form field -> profiles column. The store columns exist once the 2026-10-08
// migrations are applied; until then they are simply missing.
const FROM_PROFILE = {
  business: 'business', contact: 'name', email: 'email', phone: 'phone',
  shipStreet: 'store_street', shipCity: 'store_city', shipState: 'state', shipZip: 'store_zip',
};
// A profile value as the form holds it. The ship-to State lists only the
// delivery route states (AW-078), so the store state fills it only when it
// is one of them, upper-case; a store in another state (or an older
// application's 'Other') leaves it empty.
const FROM_PROFILE_VALUE = { shipState: routeStateCode };
// The ship-to address, in the form's fields.
export const SHIP_FIELDS = ['shipStreet', 'shipCity', 'shipState', 'shipZip'];

// What the profile fills into `field`, or '' when it has nothing usable.
function profileValue(profile, field) {
  const raw = profile?.[FROM_PROFILE[field]];
  if (!raw) return '';
  const value = (FROM_PROFILE_VALUE[field] || String)(raw);
  return value ? String(value) : '';
}

// The form once the signed-in account is `profile` (or null), where
// `previousId` is the account the form was filled for before (or null).
export function quoteFormForAccount(data, profile, previousId = null) {
  const id = profile?.id ?? null;
  const next = { ...EMPTY_QUOTE_FORM, ...data };
  if (previousId !== null && previousId !== id) {
    for (const field of BUYER_FIELDS) next[field] = EMPTY_QUOTE_FORM[field];
  }
  if (profile) {
    for (const field of Object.keys(FROM_PROFILE)) {
      const value = profileValue(profile, field);
      if (value && !String(next[field] ?? '').trim()) next[field] = value;
    }
  }
  return next;
}

const shipValue = (data, field) => String(data?.[field] ?? '').trim();

// The ship-to address the profile fills in (the store address from the
// application), field by field, '' where it has none.
export function profileShipTo(profile) {
  return Object.fromEntries(SHIP_FIELDS.map((field) => [field, profileValue(profile, field).trim()]));
}

// The form with the account's saved ship-to address (shipTo, from
// loadLastShipTo()) in the four ship-to fields, when every one of them is
// empty or still exactly the profile's value; otherwise the form as it was.
export function applyShipTo(data, profile, shipTo) {
  if (!shipTo) return data;
  const filled = profileShipTo(profile);
  const untouched = SHIP_FIELDS.every((field) => {
    const value = shipValue(data, field);
    return value === '' || value === filled[field];
  });
  if (!untouched) return data;
  const next = { ...data };
  for (const field of SHIP_FIELDS) next[field] = shipTo[field] ?? '';
  return next;
}

// Whether the ship-to fields hold the account's own address: 'saved' (the
// last delivery address), 'store' (the profile's store address), or null
// (empty, typed, or changed).
export function accountShipToSource(data, profile, shipTo) {
  if (!shipValue(data, 'shipStreet')) return null;
  const same = (address) => !!address && SHIP_FIELDS.every((field) => shipValue(data, field) === String(address[field] ?? '').trim());
  if (same(shipTo)) return 'saved';
  if (same(profileShipTo(profile))) return 'store';
  return null;
}

// "Use a different address": the four ship-to fields emptied.
export function clearShipTo(data) {
  const next = { ...data };
  for (const field of SHIP_FIELDS) next[field] = '';
  return next;
}

export const initialQuoteForm = (profile, draft = null) => quoteFormForAccount(draft || EMPTY_QUOTE_FORM, profile);

// A US phone number has 10 digits, once a leading country code 1 is dropped
// (AW-078). The field's pattern allows the usual spaces, dots, dashes,
// brackets and +; this counts what is left.
export function phoneDigitsOk(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.length === 10;
}
