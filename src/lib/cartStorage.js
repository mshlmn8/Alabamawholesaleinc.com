// Where the cart is kept (AW-045, AW-046, AW-189, AW-354, AW-083). Pure
// helpers plus a small store over localStorage; src/lib/cart.js builds the
// useCart hook on top of it.
//
// - One cart per account on this device, plus one for guests, under
//   `${STORAGE.cart}:<owner>` ('aw-cart-v2:guest', 'aw-cart-v2:<user id>').
//   The value is {"<line key>": <quantity>}; line keys are described in
//   src/lib/lines.js. An empty cart is no key at all.
// - Reading never throws and never trusts the stored value: anything that is
//   not a plain object of valid line keys to whole quantities of 1 or more is
//   dropped. Where storage is blocked or full, the cart lives in memory for
//   this page view instead.
// - Every change is made against what is stored right now (updateCart), not
//   against this tab's copy, so one tab never overwrites lines another tab
//   added or removed. The other tabs hear about it through the 'storage'
//   event, and re-read when they come back into view.
// - Whose cart a tab shows is cartOwner(): the signed-in user, or 'guest'.
//   Signing in adds the guest cart to the account's (adoptGuestCart);
//   signing out switches to the empty guest cart and leaves the account's
//   lines stored until it signs in again on this device.
// - Carts from before this version ('aw-cart', one per browser) move once
//   into the cart of whoever uses the device next (migrateLegacyCart). A
//   bare line of a product that has several variants cannot be ordered as
//   it is, so it goes to a separate list instead,
//   `${STORAGE.cartLegacy}:<owner>` = [{ "productId": 1, "qty": 3 }], which
//   the cart shows with a link to choose the variant. The leftover
//   'aw-trade-user' and 'aw-welcome-seen' keys from the first build are
//   removed at the same time.

import { STORAGE } from '../data/content.js';
import { parseLineKey, variantList, variantSlug } from './lines.js';

export const GUEST = 'guest';
// Keys written by earlier versions of the site.
export const OLD_CART_KEY = 'aw-cart';
export const ORPHAN_KEYS = ['aw-trade-user', 'aw-welcome-seen'];

export const cartKey = (owner) => `${STORAGE.cart}:${owner}`;
export const legacyListKey = (owner) => `${STORAGE.cartLegacy}:${owner}`;

const EMPTY_CART = Object.freeze({});
const EMPTY_LIST = Object.freeze([]);
export { EMPTY_CART, EMPTY_LIST };

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

// A whole quantity of 1 or more, or null. Numeric strings count (older
// builds stored whatever the stepper produced).
export function validQty(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\s*\d+(\.\d+)?\s*$/.test(value)) return null;
  const n = Math.floor(Number(value));
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

// '12' or '12::white-grape' for a valid key (the slug in its canonical form),
// or null.
export function validLineKey(key) {
  const raw = String(key);
  const { productId, variantSlug: slug } = parseLineKey(raw);
  if (!Number.isSafeInteger(productId) || productId < 1 || !/^\d+(::|$)/.test(raw)) return null;
  if (raw.includes('::') && !slug) return null;
  return slug ? `${productId}::${variantSlug(slug)}` : String(productId);
}

// The stored value as a cart: {line key: quantity}. Anything else becomes {}.
export function sanitizeCart(value) {
  if (!isPlainObject(value)) return {};
  const cart = {};
  for (const [rawKey, rawQty] of Object.entries(value)) {
    const key = validLineKey(rawKey);
    const qty = validQty(rawQty);
    if (key && qty) cart[key] = (cart[key] || 0) + qty;
  }
  return cart;
}

// The stored list of old lines that need a variant: [{ productId, qty }],
// one entry per product.
export function sanitizeLegacyList(value) {
  if (!Array.isArray(value)) return [];
  const byProduct = new Map();
  for (const entry of value) {
    if (!isPlainObject(entry)) continue;
    const productId = Number(entry.productId);
    const qty = validQty(entry.qty);
    if (!Number.isSafeInteger(productId) || productId < 1 || !qty) continue;
    byProduct.set(productId, (byProduct.get(productId) || 0) + qty);
  }
  return [...byProduct].map(([productId, qty]) => ({ productId, qty }));
}

// Two carts as one. 'sum' adds quantities (a guest cart joining an account);
// 'max' keeps the larger one, so moving the same old cart twice (an old tab
// still open writes it again) does not double it.
export function mergeCarts(a, b, mode = 'sum') {
  const next = { ...a };
  for (const [key, qty] of Object.entries(b)) {
    const had = Number(next[key]) || 0;
    next[key] = mode === 'max' ? Math.max(had, qty) : had + qty;
  }
  return next;
}

export function mergeLegacyLists(a, b, mode = 'sum') {
  const byProduct = new Map(a.map((entry) => [entry.productId, entry.qty]));
  for (const { productId, qty } of b) {
    const had = byProduct.get(productId) || 0;
    byProduct.set(productId, mode === 'max' ? Math.max(had, qty) : had + qty);
  }
  return [...byProduct].map(([productId, qty]) => ({ productId, qty }));
}

// Splits a cart from before v2 (AW-354). Keys with a variant, and bare keys of
// products with one variant or none, stay cart lines (normalizeCart gives a
// one-variant product its variant). Bare keys of products with several
// variants go to the legacy list. Products this catalog does not know stay
// in the cart, where they are flagged if they never turn up (AW-083).
export function splitOldCart(oldCart, products) {
  const cart = {};
  const legacy = [];
  for (const [key, qty] of Object.entries(sanitizeCart(oldCart))) {
    const { productId, variantSlug: slug } = parseLineKey(key);
    const product = products.find((p) => Number(p.id) === productId);
    if (!slug && product && variantList(product).length > 1) legacy.push({ productId, qty });
    else cart[key] = qty;
  }
  return { cart, legacy };
}

// Whose cart this tab shows. While the saved session is being checked, or
// cannot be refreshed because Supabase is out of reach, that is the saved
// session's user (savedUserId), so a reload never flashes the wrong cart.
export function cartOwner({ loading = false, session = null, connectionProblem = false } = {}, savedUserId = null) {
  const id = session?.user?.id || ((loading || connectionProblem) ? savedUserId : null);
  return id && /^[A-Za-z0-9-]{1,64}$/.test(String(id)) ? String(id) : GUEST;
}

// ---- The store ------------------------------------------------------------

function localArea() {
  try {
    return window.localStorage || null;
  } catch {
    return null; // blocked cookies and site data, some private modes, sandboxed frames
  }
}

// Values this page view could not store: key -> raw string, or null for "no
// value". Once a write fails, the key is read from here until a later write
// succeeds.
const memory = new Map();

function getRaw(key) {
  if (memory.has(key)) return memory.get(key);
  const area = localArea();
  if (!area) return null;
  try {
    return area.getItem(key);
  } catch {
    return null;
  }
}

function setRaw(key, raw) {
  const area = localArea();
  try {
    if (!area) throw new Error('localStorage is not available');
    if (raw === null) area.removeItem(key);
    else area.setItem(key, raw);
    memory.delete(key);
    return true;
  } catch {
    memory.set(key, raw);
    return false;
  }
}

const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

// Parsed values by key, reused while the stored text is unchanged, so
// useSyncExternalStore gets the same object back.
const parsed = new Map();
function readParsed(key, parse) {
  const raw = getRaw(key);
  const hit = parsed.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let data = null;
  try {
    data = raw === null ? null : JSON.parse(raw);
  } catch {
    data = null; // damaged value: treated as empty, replaced on the next write
  }
  const value = parse(data);
  parsed.set(key, { raw, value });
  return value;
}

const toCart = (data) => {
  const cart = sanitizeCart(data);
  return Object.keys(cart).length ? cart : EMPTY_CART;
};
const toList = (data) => {
  const list = sanitizeLegacyList(data);
  return list.length ? list : EMPTY_LIST;
};

// The owner's cart as stored now. The same object while it is unchanged.
export const readCart = (owner) => readParsed(cartKey(owner), toCart);

// The owner's old lines that need a variant (AW-354).
export const readLegacyList = (owner) => readParsed(legacyListKey(owner), toList);

function writeValue(key, value, isEmpty) {
  setRaw(key, isEmpty ? null : JSON.stringify(value));
  notify();
}

export function writeCart(owner, cart) {
  const clean = sanitizeCart(cart);
  writeValue(cartKey(owner), clean, Object.keys(clean).length === 0);
  return readCart(owner);
}

export function writeLegacyList(owner, list) {
  const clean = sanitizeLegacyList(list);
  writeValue(legacyListKey(owner), clean, clean.length === 0);
  return readLegacyList(owner);
}

// Applies fn to the cart as stored right now and stores the result (AW-046).
// Call it from event handlers, never inside a React state updater: React may
// run those twice.
export function updateCart(owner, fn) {
  const base = readCart(owner);
  const next = fn(base);
  if (next === base) return base;
  return writeCart(owner, next);
}

export function updateLegacyList(owner, fn) {
  const base = readLegacyList(owner);
  const next = fn(base);
  if (next === base) return base;
  return writeLegacyList(owner, next);
}

// A variant was added for a product on the legacy list: its saved quantity
// goes down by what was added, and the entry goes once it is used up.
export function takeFromLegacyList(owner, productId, qty) {
  return updateLegacyList(owner, (list) => {
    const id = Number(productId);
    if (!list.some((entry) => entry.productId === id)) return list;
    return list
      .map((entry) => (entry.productId === id ? { ...entry, qty: entry.qty - Math.max(1, Math.floor(Number(qty)) || 1) } : entry))
      .filter((entry) => entry.qty > 0);
  });
}

// Signing in (AW-189): the lines added as a guest join the account's cart
// and the guest cart is emptied, so they are added once even when several
// tabs see the sign-in.
export function adoptGuestCart(owner) {
  if (owner === GUEST) return;
  const guest = readCart(GUEST);
  const guestList = readLegacyList(GUEST);
  if (Object.keys(guest).length) {
    updateCart(owner, (cart) => mergeCarts(cart, guest));
    writeCart(GUEST, {});
  }
  if (guestList.length) {
    updateLegacyList(owner, (list) => mergeLegacyLists(list, guestList));
    writeLegacyList(GUEST, []);
  }
}

// Signing out: the next person at this computer starts with an empty cart.
// The account's own cart stays stored for its next sign-in here.
export function clearGuestCart() {
  writeCart(GUEST, {});
  writeLegacyList(GUEST, []);
}

// Moves a cart from before v2 into `owner`'s cart, once (AW-354), and
// removes the first build's leftover keys. `products` decides which bare
// lines need a variant. Returns true when there was an old cart.
export function migrateLegacyCart(owner, products) {
  for (const key of ORPHAN_KEYS) setRaw(key, null);
  // Where the old key cannot be removed, memory remembers it as gone, so it
  // moves once per page view at most.
  const raw = getRaw(OLD_CART_KEY);
  if (raw === null) return false;
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }
  const { cart, legacy } = splitOldCart(data, products);
  if (Object.keys(cart).length) updateCart(owner, (current) => mergeCarts(current, cart, 'max'));
  if (legacy.length) updateLegacyList(owner, (list) => mergeLegacyLists(list, legacy, 'max'));
  setRaw(OLD_CART_KEY, null);
  return true;
}

// Carts changed in another tab, or while this one was in the background.
function onStorage(event) {
  const key = event.key;
  if (key === null || key.startsWith(`${STORAGE.cart}:`) || key.startsWith(`${STORAGE.cartLegacy}:`)) notify();
}
function onVisible() {
  if (document.visibilityState === 'visible') notify();
}

// For useSyncExternalStore: listener runs whenever a cart may have changed.
export function subscribeCart(listener) {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', notify);
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', notify);
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
}

// Tests only: forgets values held in memory and parsed values.
export function resetCartStoreForTests() {
  memory.clear();
  parsed.clear();
}
