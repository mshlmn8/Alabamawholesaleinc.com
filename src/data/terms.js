// The site's words for applying, signing in and the basket (AW-131, AW-132,
// AW-024), so every button, heading and title says the same thing. Pure: no
// imports.
//
// The apply action has one label everywhere: header, trade bar, phone menu,
// footer, home page, product page, Help, contact and apply pages, page
// titles and the application dialog.
//
// The basket is an order, for everyone (owner answer 2026-10, AW-024: "there
// are no quotes — customers place orders"). Guests and accounts waiting for
// approval build one too; checkout asks them to sign in, or says the account
// is being reviewed, instead of offering Place order (AW-014). App, the
// header, the cart drawer, checkout and the page title read BASKET. Product
// cards, the product page and the add toast print the same add and view
// labels ('Add to order', 'View order'); src/pages/ProductPage.price.test.jsx
// checks they still agree.
//
// TODO(owner): Approve the name 'Apply for a trade account' on every apply button. (AW-132)

export const APPLY_LABEL = 'Apply for a trade account';
// What links to /apply say once there is an account, which /apply then shows
// the status of: its crumb, the support pages' side nav and the footer
// (NEW-047). A guest's links keep the apply label or 'Application checklist'.
export const TRADE_ACCOUNT_LABEL = 'Trade account';
export const SIGN_IN_LABEL = 'Sign in';
// The links between the sign-in and application screens. Anyone with an
// account signs in, also while it waits for approval (AW-131).
export const SIGN_IN_INSTEAD = `Already have an account? ${SIGN_IN_LABEL}`;
export const APPLY_INSTEAD = `New here? ${APPLY_LABEL}`;

//   noun    in running text: "Removed all items from your order."
//   label   the header button
//   title   the cart drawer's heading
//   empty   an empty drawer and checkout page
//   items   the drawer's and checkout's list of lines
//   add     add buttons; view  the add toast's action
//   cta     the drawer's button to checkout
//   page    checkout's breadcrumb, heading and tab title
//   submit  checkout's submit button
//   received  the receipt's eyebrow and tab title after a save
export const BASKET = Object.freeze({
  noun: 'order',
  label: 'Order',
  title: 'Your order',
  empty: 'Your order is empty',
  items: 'Items in your order',
  add: 'Add to order',
  view: 'View order',
  cta: 'Checkout',
  page: 'Checkout',
  submit: 'Place order',
  received: 'Order received',
});

// The header's basket button (AW-132, AW-240), n being the units in it: its
// name ('Order, 1 item', 'Order, 1,500 items') and the count on its badge,
// which stops at '99+' so it stays a small pill.
export const basketButtonLabel = (n) => `${BASKET.label}, ${n.toLocaleString('en-US')} ${n === 1 ? 'item' : 'items'}`;
export const basketBadge = (n) => (n > 99 ? '99+' : String(n));

// Where the cart is kept (AW-334): in this browser, one cart per account on
// this device plus one for guests (src/lib/cartStorage.js). A signed-in
// account's cart is also saved with the account (src/lib/cartSync.js), but
// only once the database has the carts table and the saved copy was read:
// `synced` (useCartSync() === 'active'). Until then, and for guests, the
// drawer and checkout say it stays on this device.
export const CART_DEVICE_NOTE = Object.freeze({
  account: 'Saved on this device for your account. It won’t show up when you sign in on another phone or computer.',
  synced: 'Saved with your account. It shows up when you sign in on another phone or computer.',
  guest: 'Saved in this browser only. Items added on another device won’t appear here.',
});
export function cartDeviceNote(signedIn, synced = false) {
  if (!signedIn) return CART_DEVICE_NOTE.guest;
  return synced ? CART_DEVICE_NOTE.synced : CART_DEVICE_NOTE.account;
}
