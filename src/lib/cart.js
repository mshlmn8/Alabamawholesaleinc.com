// The cart: a map of line key (see lines.js) to quantity, with the order the
// lines were added in beside it (NEW-065). Pure helpers plus the useCart hook
// the app root uses. Where the cart is stored (one per account, kept in step
// across tabs, older carts moved over) is src/lib/cartStorage.js (AW-045,
// AW-046, AW-189, AW-354).

import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { PRODUCTS as BUNDLED_PRODUCTS } from '../data/products.js';
import {
  canonicalVariant, isVariantAvailable, lineKey, parseLineKey, requiresVariantChoice, normalizeCart, normalizeOrder, resolveCartItems,
} from './lines.js';
import { sumLines } from './pricing.js';
import { formatMoney } from './format.js';
import { MAX_QTY, addableQty, clampQty } from './quantity.js';
import {
  EMPTY_LIST, EMPTY_STATE, GUEST, adoptGuestCart, migrateLegacyCart, readCart, readCartState, readLegacyList, restoreCart,
  subscribeCart, takeFromLegacyList, updateCart, writeLegacyList,
} from './cartStorage.js';

export const cartCount = (cart) => Object.values(cart).reduce((a, b) => a + Number(b || 0), 0);

// The line key a product-page or card add goes to, or null when the product
// is unknown, inactive, or has several variants and none was chosen, or the
// variant is not one of the product's (AW-011) or is marked not available
// (AW-030).
export function addableLineKey(products, productId, variant) {
  const product = products.find(p => Number(p.id) === Number(productId));
  if (!product || product.active === false) return null;
  if (requiresVariantChoice(product) && !variant) return null;
  const label = variant ? canonicalVariant(product, variant) : null;
  if (variant && !label) return null;
  if (!isVariantAvailable(product, label)) return null;
  return lineKey(product.id, label);
}

// Quantities stay whole numbers from 1 to MAX_QTY, the database's limit
// (src/lib/quantity.js, AW-013): adds and merges stop at it.
export const incrementLine = (cart, key, n = 1) => ({ ...cart, [key]: Math.min(MAX_QTY, (Number(cart[key]) || 0) + n) });

// The line key a reorder line goes to (mergeLines), or null when it is
// skipped.
function reorderLineKey(products, line) {
  const product = products.find(p => Number(p.id) === Number(line?.productId));
  if (!product || product.active === false || addableQty(line.qty) == null) return null;
  return lineKey(product.id, line.variant || null);
}

// Batch add for reorders. Unlike a single add, a multi-variant product without
// a variant is kept as a bare line so the buyer can choose it in the cart.
// A quantity that isn't a whole number of 1 or more is skipped, not rounded
// (AW-100).
export function mergeLines(cart, products, lines) {
  const next = { ...cart };
  for (const line of lines || []) {
    const key = reorderLineKey(products, line);
    if (key == null) continue;
    next[key] = Math.min(MAX_QTY, (Number(next[key]) || 0) + addableQty(line.qty));
  }
  return next;
}

// The keys mergeLines adds to, in the lines' order: where new lines go
// (NEW-065).
export const mergeLinesOrder = (products, lines) => (lines || []).map((line) => reorderLineKey(products, line)).filter(Boolean);

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

// A bare line's quantity moved onto the variant the buyer chose (AW-011),
// added to that variant's line when there is one, up to the limit.
export function moveLineToVariant(cart, fromKey, toKey) {
  const qty = Number(cart[fromKey]) || 0;
  if (!(qty > 0) || fromKey === toKey) return cart;
  const next = { ...cart };
  delete next[fromKey];
  next[toKey] = Math.min(MAX_QTY, (Number(next[toKey]) || 0) + qty);
  return next;
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

// A line counts toward the estimated total once it can be ordered as it
// stands (AW-103): not a bare line still waiting for its variant, which
// can't be submitted, nor one that can no longer be ordered.
export const countsInTotal = (item) => !item.needsVariant && !item.unavailable;

// The estimated total, added up in cents like the saved subtotal (AW-077).
// Lines that don't count yet add nothing (AW-103); the server prices what is
// sent, so its subtotal is unaffected.
export const cartTotal = (items) => sumLines(items.filter(countsInTotal));

// Under the estimated total when some lines are left out of it (AW-103):
// '' when none is.
export function variantExcludedText(items) {
  const n = (items || []).filter((it) => it.needsVariant).length;
  if (!n) return '';
  return n === 1 ? '1 line needs a variant and isn’t in this total.' : `${n} lines need a variant and aren’t in this total.`;
}

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
// noun: 'quote' or 'order', what checkout calls the basket (AW-132).
export function describeCartChanges(changes, noun = 'quote') {
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
      ? `The catalog and your ${noun} changed since this page opened, so nothing was sent.`
      : `Your ${noun} changed since this page opened, so nothing was sent.`;
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
// id, or 'guest'). Lines are listed in the order they were added (NEW-065):
// a new line goes at the end, a line keeps its place when its quantity
// changes or it gets its variant, and an undo puts lines back where they
// were. catalogSettled is false until the live catalog is on
// screen (useCatalog().settled, src/lib/catalog.jsx); lines are only
// re-keyed, and unknown ones only flagged, after it. priceOf(productId,
// variant) gives a line's unit price (see priceCartItems); keep it stable
// between renders (useCallback), as the lines are priced again when it
// changes.
//
// Returns { cart, count, items, total, legacy, addLine, addLines, decLine,
// setLine, chooseVariant, removeLine, removeLines, clearCart, restoreLines,
// dismissLegacy, itemsFor }. items carry needsVariant and unavailable flags
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
//   chooseVariant(key, variant)         a bare line moves to the variant
//                                       (AW-011): { key, qty } of the line
//                                       it joined, or null
//   clearCart()                         empties the cart and returns what it
//                                       held ({line key: quantity}), for an
//                                       undo (AW-082)
//   restoreLines(snapshot)              puts cleared lines back, keeping
//                                       lines another tab added meanwhile
//                                       (restoreCart in cartStorage.js)
// itemsFor(products, priceOf) prices the cart as stored now against another
// product list and prices, e.g. the catalog and prices loaded again right
// before a submit (AW-191); it also reads storage, so it is for event
// handlers too.
export function useCart({ products, priceOf = NO_PRICES, owner = GUEST, catalogSettled = true }) {
  const stored = useSyncExternalStore(subscribeCart, () => readCartState(owner), () => EMPTY_STATE);
  const { cart, order } = stored;
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

  // Stored lines take their canonical keys once the catalog is final, each
  // where it was. Lines it does not know are kept and flagged (AW-083), never
  // dropped. Not a change of the buyer's: savedAt stays.
  useEffect(() => {
    if (catalogSettled) {
      updateCart(owner, (current) => normalizeCart(current, products), { arrange: (keys) => normalizeOrder(keys, products), touch: false });
    }
  }, [owner, products, catalogSettled]);

  const items = useMemo(
    () => priceCartItems(cart, products, priceOf, { settled: catalogSettled, known: BUNDLED_PRODUCTS, order }),
    [cart, order, products, priceOf, catalogSettled],
  );
  const legacy = useMemo(() => resolveLegacyList(legacyList, products), [legacyList, products]);
  const count = itemCount(items);
  const total = cartTotal(items);

  // Every change is applied to the cart as stored now, not to this tab's
  // copy, so another tab's lines survive it (AW-046). The lines keep their
  // order (NEW-065); `append` lists new keys in the order they go at the
  // end, `rename` {from: to} puts a re-keyed line in its old key's place.
  const update = (fn, { append = [], rename = null } = {}) => updateCart(
    owner,
    (current) => fn(catalogSettled ? normalizeCart(current, products) : current),
    {
      arrange: (keys) => [
        ...(catalogSettled ? normalizeOrder(keys, products) : keys).map((key) => (rename && rename[key]) || key),
        ...append,
      ],
    },
  );

  const addLine = (productId, variant, n = 1) => {
    const key = addableLineKey(products, productId, variant);
    const want = addableQty(n);
    if (!key || want == null) return null;
    let before = 0;
    const next = update(c => {
      before = Number(c[key]) || 0;
      return incrementLine(c, key, want);
    }, { append: [key] });
    const qty = Number(next[key]) || 0;
    const added = Math.max(0, qty - before);
    // Adding a product on the old cart's list (with the variant it needed)
    // uses up that much of its saved quantity.
    if (added > 0) takeFromLegacyList(owner, productId, added);
    return { key, qty, capped: added < want };
  };
  const addLines = (lines) => update(c => mergeLines(c, products, lines), { append: mergeLinesOrder(products, lines) });
  const decLine = (key, n = 1) => update(c => decrementLine(c, key, n));
  const setLine = (key, n) => update(c => setLineQuantity(c, key, n));
  const chooseVariant = (key, variant) => {
    const toKey = addableLineKey(products, parseLineKey(key).productId, variant);
    if (!toKey) return null;
    const next = update(c => moveLineToVariant(c, key, toKey), { rename: { [key]: toKey } });
    return next[toKey] ? { key: toKey, qty: Number(next[toKey]) } : null;
  };
  const removeLine = (key) => update(c => deleteLine(c, key));
  const removeLines = (keys) => update(c => keys.reduce(deleteLine, c));
  const clearCart = () => {
    const snapshot = readCart(owner);
    updateCart(owner, () => ({}));
    return snapshot;
  };
  const restoreLines = (snapshot) => restoreCart(owner, snapshot);
  const dismissLegacy = () => writeLegacyList(owner, []);
  const itemsFor = (nextProducts, nextPriceOf = priceOf) => {
    const now = readCartState(owner);
    return priceCartItems(now.cart, nextProducts, nextPriceOf, { settled: true, known: BUNDLED_PRODUCTS, order: now.order });
  };

  return { cart, count, items, total, legacy, addLine, addLines, decLine, setLine, chooseVariant, removeLine, removeLines, clearCart, restoreLines, dismissLegacy, itemsFor };
}
