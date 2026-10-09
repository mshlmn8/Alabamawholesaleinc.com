// The cart: a map of line key (see lines.js) to quantity. Pure helpers plus
// the useCart hook the app root uses. Where the cart is stored (one per
// account, kept in step across tabs, older carts moved over) is
// src/lib/cartStorage.js (AW-045, AW-046, AW-189, AW-354).

import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { PRODUCTS as BUNDLED_PRODUCTS } from '../data/products.js';
import { isVariantAvailable, lineKey, requiresVariantChoice, normalizeCart, resolveCartItems } from './lines.js';
import { sumLines } from './pricing.js';
import { formatMoney } from './format.js';
import { MAX_QTY, addableQty, clampQty } from './quantity.js';
import {
  EMPTY_CART, EMPTY_LIST, GUEST, adoptGuestCart, migrateLegacyCart, readCart, readLegacyList, subscribeCart,
  takeFromLegacyList, updateCart, writeLegacyList,
} from './cartStorage.js';

export const cartCount = (cart) => Object.values(cart).reduce((a, b) => a + Number(b || 0), 0);

// The line key a product-page or card add goes to, or null when the product
// is unknown, inactive, or has several variants and none was chosen, or the
// variant is marked not available (AW-030).
export function addableLineKey(products, productId, variant) {
  const product = products.find(p => Number(p.id) === Number(productId));
  if (!product || product.active === false) return null;
  if (requiresVariantChoice(product) && !variant) return null;
  if (!isVariantAvailable(product, variant)) return null;
  return lineKey(product.id, variant || null);
}

// Quantities stay whole numbers from 1 to MAX_QTY, the database's limit
// (src/lib/quantity.js, AW-013): adds and merges stop at it.
export const incrementLine = (cart, key, n = 1) => ({ ...cart, [key]: Math.min(MAX_QTY, (Number(cart[key]) || 0) + n) });

// Batch add for reorders. Unlike a single add, a multi-variant product without
// a variant is kept as a bare line so the buyer can choose it in the cart.
// A quantity that isn't a whole number of 1 or more is skipped, not rounded
// (AW-100).
export function mergeLines(cart, products, lines) {
  const next = { ...cart };
  for (const line of lines || []) {
    const product = products.find(p => Number(p.id) === Number(line.productId));
    const n = addableQty(line.qty);
    if (!product || product.active === false || n == null) continue;
    const key = lineKey(product.id, line.variant || null);
    next[key] = Math.min(MAX_QTY, (Number(next[key]) || 0) + n);
  }
  return next;
}

// n fewer of a line (1 by default); the line goes at 0.
export function decrementLine(cart, key, n = 1) {
  const step = Math.floor(Number(n));
  if (!(step >= 1)) return cart;
  const next = { ...cart };
  const v = (Number(next[key]) || 0) - step;
  if (v <= 0) delete next[key]; else next[key] = v;
  return next;
}

// A typed quantity for a line already in the cart, brought into range. Less
// than 1 changes nothing (removing is its own action), and neither does a
// line that is gone (another tab removed it).
export function setLineQuantity(cart, key, n) {
  const value = Number(n);
  if (!(value >= 1) || !Object.prototype.hasOwnProperty.call(cart, key)) return cart;
  const qty = clampQty(value);
  return Number(cart[key]) === qty ? cart : { ...cart, [key]: qty };
}

export function deleteLine(cart, key) {
  const next = { ...cart };
  delete next[key];
  return next;
}

// Units in a list of resolved cart lines.
export const itemCount = (items) => items.reduce((sum, item) => sum + item.qty, 0);

// No prices: what priceOf returns for guests and accounts that aren't approved.
export const NO_PRICES = () => null;

// Cart lines resolved against the catalog, each with the buyer's unit price
// from priceOf(productId, variant) (App: the signed-in account's price from
// usePrices(), src/lib/prices.jsx). price is null when the account sees no
// prices, the product has none (price on request), and for lines that can no
// longer be ordered. `options` go to resolveCartItems.
export const priceCartItems = (cart, products, priceOf = NO_PRICES, options) =>
  resolveCartItems(cart, products, options).map(item => ({
    ...item,
    price: item.unavailable ? null : (priceOf(item.productId, item.variant) ?? null),
  }));

// The estimated total, added up in cents like the saved subtotal (AW-077).
export const cartTotal = (items) => sumLines(items);

// What changed for the buyer between the cart lines they reviewed (`before`)
// and the same cart resolved against a catalog loaded again just now
// (`after`), e.g. right before a submit (AW-191). Lines are matched by line
// key, then by product. Returns [{ kind, name, lineKey, ... }]:
//   unavailable  a line that could be ordered no longer can (reason:
//                'product' or 'variant', from resolveCartItems)
//   variant      a line now needs a variant chosen
//   price        the buyer's unit price changed (from, to)
//   qty          the quantity changed (another tab)
//   added        a line the buyer was not shown (another tab, or the live
//                catalog had not loaded when the page was drawn)
//   removed      a line that is gone (another tab)
export function cartChanges(before, after) {
  const left = [...before];
  const take = (match) => {
    const i = left.findIndex(match);
    return i === -1 ? null : left.splice(i, 1)[0];
  };
  const pairs = after.map((item) => [item, take((old) => old.lineKey === item.lineKey)]);
  for (const pair of pairs) {
    if (!pair[1]) pair[1] = take((old) => Number(old.productId) === Number(pair[0].productId));
  }
  const changes = [];
  for (const [item, old] of pairs) {
    const base = { name: item.name, lineKey: item.lineKey };
    if (item.unavailable) {
      if (!old?.unavailable) changes.push({ kind: 'unavailable', reason: item.unavailable, ...base });
    } else if (item.needsVariant) {
      if (!old?.needsVariant) changes.push({ kind: 'variant', ...base });
    } else if (!old || old.unavailable || old.needsVariant) {
      changes.push({ kind: 'added', ...base });
    } else {
      if (Number(old.qty) !== Number(item.qty)) changes.push({ kind: 'qty', ...base });
      if (old.price != null && item.price != null && Math.round(Number(old.price) * 100) !== Math.round(Number(item.price) * 100)) {
        changes.push({ kind: 'price', from: Number(old.price), to: Number(item.price), ...base });
      }
    }
  }
  for (const old of left) changes.push({ kind: 'removed', name: old.name, lineKey: old.lineKey });
  return changes;
}

const MAX_NAMED = 3;

// The checkout message for cartChanges() (AW-191): what changed, by name, so
// the buyer can fix it and submit again. One string, for a single text node.
export function describeCartChanges(changes) {
  const sentences = [];
  for (const change of changes) {
    if (change.kind === 'unavailable') {
      sentences.push(change.reason === 'variant'
        ? `${change.name} is no longer available — remove it or choose another variant.`
        : `${change.name} is no longer available — remove it to continue.`);
    } else if (change.kind === 'variant') {
      sentences.push(`${change.name} now comes in several variants — choose one.`);
    } else if (change.kind === 'price') {
      sentences.push(`${change.name} is now ${formatMoney(change.to)} each (was ${formatMoney(change.from)}).`);
    }
  }
  const named = sentences.slice(0, MAX_NAMED);
  const more = sentences.length - named.length;
  if (more > 0) named.push(`${more} more ${more === 1 ? 'item' : 'items'} changed too.`);
  const cartChanged = changes.some((c) => c.kind === 'qty' || c.kind === 'added' || c.kind === 'removed');
  let lead = 'The catalog changed since this page opened, so nothing was sent.';
  if (cartChanged) {
    lead = sentences.length
      ? 'The catalog and your cart changed since this page opened, so nothing was sent.'
      : 'Your cart changed since this page opened, so nothing was sent.';
  }
  return [lead, ...named, 'Check your items, then submit again.'].join(' ');
}

// The old cart's lines that still need a variant (AW-354), named from the
// catalog. Products that have left the catalog are not listed.
export function resolveLegacyList(list, products) {
  return list.flatMap(({ productId, qty }) => {
    const product = products.find(p => Number(p.id) === Number(productId));
    if (!product || product.active === false) return [];
    return [{ productId: product.id, qty, name: product.name, sku: product.sku }];
  });
}

// The cart for `owner` (cartOwner() in cartStorage.js: the signed-in user's
// id, or 'guest'). catalogSettled is false until the live catalog is on
// screen (useCatalog().settled, src/lib/catalog.jsx); lines are only
// re-keyed, and unknown ones only flagged, after it. priceOf(productId,
// variant) gives a line's unit price (see priceCartItems); keep it stable
// between renders (useCallback), as the lines are priced again when it
// changes.
//
// Returns { cart, count, items, total, legacy, addLine, addLines, decLine,
// setLine, removeLine, removeLines, clearCart, dismissLegacy, itemsFor }. items carry needsVariant and unavailable flags
// (src/lib/lines.js); legacy is the old cart's list of products to choose a
// variant for. The actions write through to storage at once, so they belong
// in event handlers. Quantities follow src/lib/quantity.js (AW-013):
//   addLine(productId, variant, n = 1)  { key, qty, capped } (qty is the
//                                       line's quantity now; capped when the
//                                       limit cut the add short), or null
//                                       when nothing could be added
//   decLine(key, n = 1)                 n fewer; the line goes at 0
//   setLine(key, n)                     a typed quantity, clamped; below 1
//                                       changes nothing
// itemsFor(products, priceOf) prices the cart as stored now against another
// product list and prices, e.g. the catalog and prices loaded again right
// before a submit (AW-191); it also reads storage, so it is for event
// handlers too.
export function useCart({ products, priceOf = NO_PRICES, owner = GUEST, catalogSettled = true }) {
  const cart = useSyncExternalStore(subscribeCart, () => readCart(owner), () => EMPTY_CART);
  const legacyList = useSyncExternalStore(subscribeCart, () => readLegacyList(owner), () => EMPTY_LIST);

  // A new owner: an old cart moves in (once per device, AW-354), and signing
  // in brings the guest cart along (AW-189). Before paint, so the badge never
  // shows the cart without them.
  const lastOwner = useRef(null);
  useLayoutEffect(() => {
    const previous = lastOwner.current;
    lastOwner.current = owner;
    migrateLegacyCart(owner, products);
    if (previous === GUEST && owner !== GUEST) adoptGuestCart(owner);
  }, [owner, products]);

  // Stored lines take their canonical keys once the catalog is final. Lines
  // it does not know are kept and flagged (AW-083), never dropped.
  useEffect(() => {
    if (catalogSettled) updateCart(owner, (current) => normalizeCart(current, products));
  }, [owner, products, catalogSettled]);

  const items = useMemo(
    () => priceCartItems(cart, products, priceOf, { settled: catalogSettled, known: BUNDLED_PRODUCTS }),
    [cart, products, priceOf, catalogSettled],
  );
  const legacy = useMemo(() => resolveLegacyList(legacyList, products), [legacyList, products]);
  const count = itemCount(items);
  const total = cartTotal(items);

  // Every change is applied to the cart as stored now, not to this tab's
  // copy, so another tab's lines survive it (AW-046).
  const update = (fn) => updateCart(owner, (current) => fn(catalogSettled ? normalizeCart(current, products) : current));

  const addLine = (productId, variant, n = 1) => {
    const key = addableLineKey(products, productId, variant);
    const want = addableQty(n);
    if (!key || want == null) return null;
    let before = 0;
    const next = update(c => {
      before = Number(c[key]) || 0;
      return incrementLine(c, key, want);
    });
    const qty = Number(next[key]) || 0;
    const added = Math.max(0, qty - before);
    // Adding a product on the old cart's list (with the variant it needed)
    // uses up that much of its saved quantity.
    if (added > 0) takeFromLegacyList(owner, productId, added);
    return { key, qty, capped: added < want };
  };
  const addLines = (lines) => update(c => mergeLines(c, products, lines));
  const decLine = (key, n = 1) => update(c => decrementLine(c, key, n));
  const setLine = (key, n) => update(c => setLineQuantity(c, key, n));
  const removeLine = (key) => update(c => deleteLine(c, key));
  const removeLines = (keys) => update(c => keys.reduce(deleteLine, c));
  const clearCart = () => updateCart(owner, () => ({}));
  const dismissLegacy = () => writeLegacyList(owner, []);
  const itemsFor = (nextProducts, nextPriceOf = priceOf) => priceCartItems(readCart(owner), nextProducts, nextPriceOf, { settled: true, known: BUNDLED_PRODUCTS });

  return { cart, count, items, total, legacy, addLine, addLines, decLine, setLine, removeLine, removeLines, clearCart, dismissLegacy, itemsFor };
}
