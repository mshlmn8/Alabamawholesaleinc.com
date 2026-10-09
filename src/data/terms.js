// The site's words for applying, signing in and the basket (AW-131, AW-132),
// so every button, heading and title says the same thing. Pure: no imports.
//
// The apply action has one label everywhere: header, trade bar, phone menu,
// footer, home page, product page, Help, contact and apply pages, page
// titles and the application dialog.
//
// The basket is a quote for guests and for accounts that are waiting for
// approval or suspended, and an order for approved buyers, the same as
// submit_quote's 'kind' (ALW-Q / ALW-O). basketTerms(asOrder) gives every
// label for one of them; App, the header, the cart drawer, checkout and the
// page title read from it. Product cards, the product page and the add
// toast print the same add and view labels ('Add to quote', 'View quote');
// src/pages/ProductPage.price.test.jsx checks they still agree.
//
// TODO(owner): Approve the names: 'Apply for a trade account' on every apply button, and the basket called a quote for guests and accounts waiting for approval and an order for approved accounts. (AW-132)

export const APPLY_LABEL = 'Apply for a trade account';
export const SIGN_IN_LABEL = 'Sign in';
// The links between the sign-in and application screens. Anyone with an
// account signs in, also while it waits for approval (AW-131).
export const SIGN_IN_INSTEAD = `Already have an account? ${SIGN_IN_LABEL}`;
export const APPLY_INSTEAD = `New here? ${APPLY_LABEL}`;

const QUOTE = Object.freeze({
  kind: 'quote',
  noun: 'quote',
  label: 'Quote',
  title: 'Your quote',
  empty: 'Your quote is empty',
  items: 'Items in your quote',
  add: 'Add to quote',
  view: 'View quote',
  cta: 'Review quote',
  page: 'Request a quote',
  submit: 'Submit quote request',
});

const ORDER = Object.freeze({
  kind: 'order',
  noun: 'order',
  label: 'Order',
  title: 'Your order',
  empty: 'Your order is empty',
  items: 'Items in your order',
  add: 'Add to order',
  view: 'View order',
  cta: 'Review order',
  page: 'Place your order',
  submit: 'Submit order',
});

// asOrder: the signed-in account is an approved buyer.
//   kind    'quote' | 'order' (submit_quote's kind, the meta title's key)
//   noun    in running text: "Removed all items from your quote."
//   label   the header button
//   title   the cart drawer's heading
//   empty   an empty drawer and checkout page
//   items   the drawer's list of lines
//   add     add buttons; view  the add toast's action
//   cta     the drawer's button to checkout
//   page    checkout's breadcrumb, heading and tab title
//   submit  checkout's submit button
export function basketTerms(asOrder) {
  return asOrder ? ORDER : QUOTE;
}

// The header's basket button (AW-132, AW-240), n being the units in it: its
// name ('Quote, 1 item', 'Order, 1,500 items') and the count on its badge,
// which stops at '99+' so it stays a small pill.
export const basketButtonLabel = (basket, n) => `${basket.label}, ${n.toLocaleString('en-US')} ${n === 1 ? 'item' : 'items'}`;
export const basketBadge = (n) => (n > 99 ? '99+' : String(n));

// Where the cart is kept (AW-334): in this browser, one cart per account on
// this device plus one for guests (src/lib/cartStorage.js), never on the
// server, so it doesn't follow a buyer to another phone or computer. The
// drawer and checkout say so. A cart saved with the account is a later step.
export const CART_DEVICE_NOTE = Object.freeze({
  account: 'Saved on this device for your account. It won’t show up when you sign in on another phone or computer.',
  guest: 'Saved in this browser only. Items added on another device won’t appear here.',
});
export const cartDeviceNote = (signedIn) => (signedIn ? CART_DEVICE_NOTE.account : CART_DEVICE_NOTE.guest);
