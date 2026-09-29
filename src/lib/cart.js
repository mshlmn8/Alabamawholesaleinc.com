// The cart: a map of line key (see lines.js) to quantity, kept in
// localStorage. Pure helpers plus the useCart hook the app root uses. Storage
// moves into src/lib/cartStorage.js with AW-045.

import { useEffect, useMemo, useState } from 'react';
import { STORAGE } from '../data/content.js';
import { lineKey, requiresVariantChoice, normalizeCart, resolveCartItems } from './lines.js';
import { priceForProfile } from './pricing.js';

const safeReadJson = (key, fallback) => {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
};
const safeWriteJson = (key, value) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: keep the in-memory value */ }
};

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

// Cart lines resolved against the catalog, with the signed-in account's
// display price (null when prices are hidden).
export const priceCartItems = (cart, products, profile) =>
  resolveCartItems(cart, products).map(item => ({ ...item, price: priceForProfile(item.listPrice, profile) }));

export const cartTotal = (items) => items.reduce((s, i) => s + (i.price == null ? 0 : i.qty * i.price), 0);

export function useCart(products, profile) {
  const [cart, setCart] = useState(() => safeReadJson(STORAGE.cart, {}));

  useEffect(() => { safeWriteJson(STORAGE.cart, cart); }, [cart]);

  useEffect(() => {
    // Re-keys stored lines once the live catalog arrives. Moves into the cart
    // storage module in Phase 1 Part B (AW-045).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart(current => normalizeCart(current, products));
  }, [products]);

  const count = cartCount(cart);
  const items = useMemo(() => priceCartItems(cart, products, profile), [cart, products, profile]);
  const total = cartTotal(items);

  const addLine = (productId, variant, n = 1) => {
    const key = addableLineKey(products, productId, variant);
    if (!key) return;
    setCart(c => incrementLine(c, key, n));
  };
  const addLines = (lines) => setCart(c => mergeLines(c, products, lines));
  const decLine = (key) => setCart(c => decrementLine(c, key));
  const removeLine = (key) => setCart(c => deleteLine(c, key));
  const clearCart = () => setCart({});

  return { cart, count, items, total, addLine, addLines, decLine, removeLine, clearCart };
}
