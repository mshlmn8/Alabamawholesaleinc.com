// The buyer details on the quote/checkout form, and how they follow the
// signed-in account (AW-186, AW-190).
//
// - The account's profile fills business, contact, email, phone and the
//   ship-to address (the store's, AW-092) when it arrives, also after the
//   page opened (a reload or a direct link to /quote renders before the
//   profile has loaded). It fills only empty fields, so anything the buyer
//   typed stays.
// - When the account changes (a sign-out, or another buyer signing in from
//   another tab), the previous buyer's details, phone, ship-to address and
//   notes are cleared first, so an order is never sent under one account with
//   another buyer's contact details or address.
//
// A saved draft (AW-080, later) comes before profile values for the same
// account, and is discarded when the account changes.
//
// The store's license details (AW-014) belong to the buyer too, so they are
// cleared with the rest.

export const EMPTY_QUOTE_FORM = Object.freeze({
  business: '', contact: '', email: '', phone: '',
  notes: '', delivery: 'delivery', preferredDate: '',
  shipStreet: '', shipCity: '', shipState: '', shipZip: '',
  licenseNo: '', resaleCertNo: '', licenseAttested: false,
});

// Fields that belong to one buyer.
const BUYER_FIELDS = [
  'business', 'contact', 'email', 'phone', 'shipStreet', 'shipCity', 'shipState', 'shipZip', 'notes',
  'licenseNo', 'resaleCertNo', 'licenseAttested',
];
// Form field -> profiles column. The ship-to address starts as the store's
// address from the application (AW-092); the store state fills the state
// field only when it is a 2-letter code (the application also offers
// 'Other').
const FROM_PROFILE = {
  business: 'business', contact: 'name', email: 'email', phone: 'phone',
  shipStreet: 'store_street', shipCity: 'store_city', shipState: 'state', shipZip: 'store_zip',
};
const PROFILE_VALUE_OK = { shipState: (value) => /^[A-Za-z]{2}$/.test(value) };

// The form once the signed-in account is `profile` (or null), where
// `previousId` is the account the form was filled for before (or null).
export function quoteFormForAccount(data, profile, previousId = null) {
  const id = profile?.id ?? null;
  const next = { ...EMPTY_QUOTE_FORM, ...data };
  if (previousId !== null && previousId !== id) {
    for (const field of BUYER_FIELDS) next[field] = EMPTY_QUOTE_FORM[field];
  }
  if (profile) {
    for (const [field, column] of Object.entries(FROM_PROFILE)) {
      const value = profile[column];
      if (!value || (PROFILE_VALUE_OK[field] && !PROFILE_VALUE_OK[field](String(value)))) continue;
      if (!String(next[field] ?? '').trim()) next[field] = String(value);
    }
  }
  return next;
}

export const initialQuoteForm = (profile) => quoteFormForAccount(EMPTY_QUOTE_FORM, profile);
