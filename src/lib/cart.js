// The cart: a map of line key (see lines.js) to quantity. Pure helpers plus
// the useCart hook the app root uses. Where the cart is stored (one per
// account, kept in step across tabs, older carts moved over) is
// src/lib/cartStorage.js (AW-045, AW-046, AW-189, AW-354).

import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { PRODUCTS as BUNDLED_PRODUCTS } from '../data/products.js';
import { lineKey, requiresVariantChoice, normalizeCart, resolveCartItems } from './lines.js';
import { priceForProfile } from './pricing.js';
import {
  EMPTY_CART, EMPTY_LIST, GUEST, adoptGuestCart, migrateLegacyCart, readCart, readLegacyList, subscribeCart,
  takeFromLegacyList, updateCart, writeLegacyList,
} from './cartStorage.js';

export const cartCount = (cart) => Object.values(cart).reduce((a, b) => a + Number(b || 0), 0);

// The line key a product-page or card add goes to, or null when the product
// is unknown, inactive, or has several variants and none was chosen.
export function addableLineKey(products, productId, variant) {
  const product = products.find(p => Number(p.id) === Number(productId));
  if (!product || product.active === false) return null;
  if (requiresVariantChoice(product) && !variant) return null;
  return lineKey(product.id, variant || null);
}

export const incrementLine = (cart, key, n = 1) => ({ ...cart, [key]: (Number(cart[key]) || 0) + n });

// Batch add for reorders. Unlike a single add, a multi-variant product without
// a variant is kept as a bare line so the buyer can choose it in the cart.
export function mergeLines(cart, products, lines) {
  const next = { ...cart };
  for (const line of lines || []) {
    const product = products.find(p => Number(p.id) === Number(line.productId));
    const n = Math.floor(Number(line.qty));
    if (!product || product.active === false || !(n > 0)) continue;
    const key = lineKey(product.id, line.variant || null);
    next[key] = (Number(next[key]) || 0) + n;
  }
  return next;
}

export function decrementLine(cart, key) {
  const next = { ...cart };
  const v = (Number(next[key]) || 0) - 1;
  if (v <= 0) delete next[key]; else next[key] = v;
  return next;
}

export function deleteLine(cart, key) {
  const next = { ...cart };
  delete next[key];
  return next;
}

// Units in a list of resolved cart lines.
export const itemCount = (items) => items.reduce((sum, item) => sum + item.qty, 0);

// Cart lines resolved against the catalog, with the signed-in account's
// display price (null when prices are hidden, and for lines that can no
// longer be ordered). `options` go to resolveCartItems.
export const priceCartItems = (cart, products, profile, options) =>
  resolveCartItems(cart, products, options).map(item => ({
    ...item,
    price: item.unavailable ? null : priceForProfile(item.listPrice, profile),
  }));

export const cartTotal = (items) => items.reduce((s, i) => s + (i.price == null ? 0 : i.qty * i.price), 0);

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
// id, or 'guest'). catalogSettled is false while the live catalog is still
// loading; lines are only re-keyed, and unknown ones only flagged, after it.
//
// Returns { cart, count, items, total, legacy, addLine, addLines, decLine,
// removeLine, removeLines, clearCart, dismissLegacy }. items carry
// needsVariant and unavailable flags (src/lib/lines.js); legacy is the old
// cart's list of products to choose a variant for. The actions write
// through to storage at once, so they belong in event handlers.
export function useCart({ products, profile = null, owner = GUEST, catalogSettled = true }) {
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
    () => priceCartItems(cart, products, profile, { settled: catalogSettled, known: BUNDLED_PRODUCTS }),
    [cart, products, profile, catalogSettled],
  );
  const legacy = useMemo(() => resolveLegacyList(legacyList, products), [legacyList, products]);
  const count = itemCount(items);
  const total = cartTotal(items);

  // Every change is applied to the cart as stored now, not to this tab's
  // copy, so another tab's lines survive it (AW-046).
  const update = (fn) => updateCart(owner, (current) => fn(catalogSettled ? normalizeCart(current, products) : current));

  const addLine = (productId, variant, n = 1) => {
    const key = addableLineKey(products, productId, variant);
    if (!key) return;
    update(c => incrementLine(c, key, n));
    // Adding a product on the old cart's list (with the variant it needed)
    // uses up that much of its saved quantity.
    takeFromLegacyList(owner, productId, n);
  };
  const addLines = (lines) => update(c => mergeLines(c, products, lines));
  const decLine = (key) => update(c => decrementLine(c, key));
  const removeLine = (key) => update(c => deleteLine(c, key));
  const removeLines = (keys) => update(c => keys.reduce(deleteLine, c));
  const clearCart = () => updateCart(owner, () => ({}));
  const dismissLegacy = () => writeLegacyList(owner, []);

  return { cart, count, items, total, legacy, addLine, addLines, decLine, removeLine, removeLines, clearCart, dismissLegacy };
}
