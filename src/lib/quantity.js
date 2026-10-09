// One rule for a line's quantity (AW-013, AW-100): a whole number from
// MIN_QTY to MAX_QTY, everywhere a quantity is typed, stepped, stored or
// added. Pure, so the cart helpers, the stepper (src/components/
// QuantityInput.jsx) and Quick Reorder share it.
//
// MAX_QTY is the database's own limit: the order_items trigger
// (enforce_order_item_price, supabase/migrations/20261009110000_variant_model.sql)
// refuses a line over 100,000 with a bare 'Invalid quantity', so the
// storefront stops there first and says why.

export const MIN_QTY = 1;
export const MAX_QTY = 100000;

const count = (n) => Number(n).toLocaleString('en-US');

// 'a whole number from 1 to 100,000', for messages.
export const qtyRangeText = (min = MIN_QTY, max = MAX_QTY) => `a whole number from ${count(min)} to ${count(max)}`;
export const QTY_RANGE_TEXT = qtyRangeText();
// 'The most per line is 100,000.'
export const maxPerLineText = (max = MAX_QTY) => `The most per line is ${count(max)}.`;

// What the buyer typed (or a stored number), read strictly: only digits,
// after trimming. { qty, problem }, where problem is null or one of
//   'empty'      nothing typed
//   'not-whole'  anything but digits: 2.5, 1e3, -1, letters
//   'too-small'  0
//   'too-large'  more than MAX_QTY
// qty is null whenever problem is set.
export function readQty(text) {
  const raw = text == null ? '' : String(text).trim();
  if (raw === '') return { qty: null, problem: 'empty' };
  if (!/^\d+$/.test(raw)) return { qty: null, problem: 'not-whole' };
  const n = Number(raw);
  if (n < MIN_QTY) return { qty: null, problem: 'too-small' };
  if (n > MAX_QTY) return { qty: null, problem: 'too-large' };
  return { qty: n, problem: null };
}

// A number brought into range: whole (rounded down), at least MIN_QTY, at
// most MAX_QTY. For values already known to be numbers (sums, steps).
export function clampQty(n) {
  const whole = Math.floor(Number(n));
  if (Number.isNaN(whole)) return MIN_QTY;
  return Math.min(MAX_QTY, Math.max(MIN_QTY, whole));
}

// Whether a line can be sent as it is.
export const isOrderableQty = (n) => Number.isInteger(n) && n >= MIN_QTY && n <= MAX_QTY;

// A quantity being added to the cart (a reorder line, a product-page add):
// a whole number of 1 or more, capped at MAX_QTY; null for anything else.
export function addableQty(value) {
  const { qty, problem } = readQty(value);
  return problem === 'too-large' ? MAX_QTY : qty;
}
