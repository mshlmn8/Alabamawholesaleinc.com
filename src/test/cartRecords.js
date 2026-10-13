// Test helpers for the stored cart (src/lib/cartStorage.js, NEW-065): the v3
// record {"v": 3, "savedAt": <ms>, "lines": [["<line key>", <quantity>], …]},
// written and read the way the tests think of a cart, {line key: quantity}.
import { STORAGE } from '../data/content.js';

const isCartKey = (key) => String(key).startsWith(`${STORAGE.cart}:`);

// The record for a cart given as an object (in its own key order) or as
// [[key, quantity], …] entries.
export const cartRecord = (lines, savedAt = 1) => ({ v: 3, savedAt, lines: Array.isArray(lines) ? lines : Object.entries(lines) });

// What a storage key holds, as a test writes it: a cart object under a cart
// key becomes the v3 record; anything else (a record already) is stored as
// it is.
export const storedValue = (key, value) => (
  isCartKey(key) && value && typeof value === 'object' && !Array.isArray(value) && !Array.isArray(value.lines) ? cartRecord(value) : value
);

// What a storage key holds, as a test reads it: a cart key's record as
// {line key: quantity}; anything else parsed as it is; null for no key.
export function readStored(key) {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  const value = JSON.parse(raw);
  return isCartKey(key) && Array.isArray(value?.lines) ? Object.fromEntries(value.lines) : value;
}

// A cart key's line keys, in the stored order.
export function storedOrder(key) {
  const raw = window.localStorage.getItem(key);
  return raw === null ? [] : JSON.parse(raw).lines.map(([k]) => k);
}
