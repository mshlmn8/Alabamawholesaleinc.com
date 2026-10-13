// The stored cart in the smoke tests (src/lib/cartStorage.js, NEW-065):
// 'aw-cart-v3:<owner>' = {"v": 3, "savedAt": <ms>, "lines": [["<line key>", <quantity>], …]},
// the lines in the order they were added.
export const cartKey = (owner) => `aw-cart-v3:${owner}`; // cartKey() in src/lib/cartStorage.js
export const GUEST_CART = cartKey('guest');
// Carts as builds before NEW-065 stored them, the plain object {line key: quantity}.
export const v2CartKey = (owner) => `aw-cart-v2:${owner}`;

// The stored text for a cart given as an object (in its own key order) or as
// [[key, quantity], …] entries.
export const cartValue = (lines, savedAt = 1) => JSON.stringify({ v: 3, savedAt, lines: Array.isArray(lines) ? lines : Object.entries(lines) });

// A stored cart's text as {line key: quantity}; null for no key.
export function cartFromStored(raw) {
  if (raw == null) return null;
  const value = JSON.parse(raw);
  return Array.isArray(value?.lines) ? Object.fromEntries(value.lines) : value;
}

// A stored cart's line keys, in order.
export const orderFromStored = (raw) => (raw == null ? [] : JSON.parse(raw).lines.map(([key]) => key));
