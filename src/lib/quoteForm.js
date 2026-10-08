// The buyer details on the quote/checkout form, and how they follow the
// signed-in account (AW-186, AW-190).
//
// - The account's profile fills business, contact, email, phone and, from
//   the store address on the application (AW-092, PR #12), the ship-to
//   address when it arrives, also after the page opened (a reload or a direct
//   link to /quote renders before the profile has loaded). It fills only
//   empty fields, so anything the buyer typed stays.
// - When the account changes (a sign-out, or another buyer signing in from
//   another tab), the previous buyer's details, phone, ship-to address,
//   notes and tobacco licence answers (AW-014) are cleared first, so an order
//   is never sent under one account with another buyer's details.
//
// A saved draft (AW-080, later) comes before profile values for the same
// account, and is discarded when the account changes.

export const EMPTY_QUOTE_FORM = Object.freeze({
  business: '', contact: '', email: '', phone: '',
  notes: '', delivery: 'delivery', preferredDate: '',
  shipStreet: '', shipCity: '', shipState: '', shipZip: '',
  // Guest and unapproved quotes with tobacco or vape lines (AW-014).
  licenseNo: '', resaleCert: '', purchasers21: false,
});

// Fields that belong to one buyer.
const BUYER_FIELDS = ['business', 'contact', 'email', 'phone', 'shipStreet', 'shipCity', 'shipState', 'shipZip', 'notes', 'licenseNo', 'resaleCert'];
// Form field -> profiles column. The store columns exist once the 2026-10-08
// migrations are applied; until then they are simply missing.
const FROM_PROFILE = {
  business: 'business', contact: 'name', email: 'email', phone: 'phone',
  shipStreet: 'store_street', shipCity: 'store_city', shipState: 'state', shipZip: 'store_zip',
};
// The application's "Store state" list ends with 'Other', which is no state.
const NOT_A_VALUE = new Set(['Other']);

// The form once the signed-in account is `profile` (or null), where
// `previousId` is the account the form was filled for before (or null).
export function quoteFormForAccount(data, profile, previousId = null) {
  const id = profile?.id ?? null;
  const next = { ...EMPTY_QUOTE_FORM, ...data };
  if (previousId !== null && previousId !== id) {
    for (const field of BUYER_FIELDS) next[field] = '';
    next.purchasers21 = false;
  }
  if (profile) {
    for (const [field, column] of Object.entries(FROM_PROFILE)) {
      const value = profile[column];
      if (!String(next[field] ?? '').trim() && value && !NOT_A_VALUE.has(value)) next[field] = String(value);
    }
  }
  return next;
}

export const initialQuoteForm = (profile) => quoteFormForAccount(EMPTY_QUOTE_FORM, profile);
