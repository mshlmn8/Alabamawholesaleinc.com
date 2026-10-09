// Where the cart is kept (AW-045, AW-046, AW-189, AW-354, AW-083, NEW-065).
// Pure helpers plus a small store over localStorage; src/lib/cart.js builds
// the useCart hook on top of it.
//
// - One cart per account on this device, plus one for guests, under
//   `${STORAGE.cart}:<owner>` ('aw-cart-v3:guest', 'aw-cart-v3:<user id>').
//   The value is {"v": 3, "savedAt": <ms>, "lines": [["<line key>", <quantity>], …]}
//   with the lines in the order they were added (NEW-065): an object keyed
//   by line key can't keep that order, because JavaScript lists integer-like
//   keys ('14', '174') first, by number, also after JSON.parse. Line keys
//   are described in src/lib/lines.js. savedAt is when the cart last changed
//   on this device; it decides between this copy and the account's saved one
//   (src/lib/cartSync.js, AW-334), and never goes backwards. A guest's empty
//   cart is no key at all; an account's emptied cart keeps its savedAt, so
//   an older saved copy doesn't bring the lines back.
// - In memory a cart is still a plain object {line key: quantity} for every
//   helper, with its order beside it: readCartState(owner) gives
//   { cart, order, savedAt }, and cartOrder(cart) the order of a cart read
//   here. A change keeps the order: new lines go at the end, a line keeps its
//   place, a re-keyed line (an alias, a chosen variant) takes the old key's
//   place, and two keys that become one keep the first place. updateCart's
//   `arrange` says where lines go when that isn't enough (a guest cart or an
//   undo coming back in its own order).
// - Reading never throws and never trusts the stored value: anything that is
//   not a list of valid line keys and whole quantities of 1 or more is
//   dropped. Where storage is blocked or full, the cart lives in memory for
//   this page view instead.
// - Every change is made against what is stored right now (updateCart), not
//   against this tab's copy, so one tab never overwrites lines another tab
//   added or removed. The other tabs hear about it through the 'storage'
//   event (the order is in the stored value, so it travels too), and re-read
//   when they come back into view.
// - Whose cart a tab shows is cartOwner(): the signed-in user, or 'guest'.
//   Signing in adds the guest cart to the account's (adoptGuestCart), the
//   guest's lines after the account's; signing out switches to the empty
//   guest cart and leaves the account's lines stored until it signs in
//   again on this device.
// - The v2 cart ('aw-cart-v2:<owner>', the plain object, NEW-065) is read in
//   the order it was shown in until it is moved: migrateLegacyCart moves it
//   for the owner on screen, and any write of an owner's cart removes the
//   owner's v2 key, so nothing extra stays behind.
// - Carts from before v2 ('aw-cart', one per browser) move once into the
//   cart of whoever uses the device next (migrateLegacyCart). A bare line of
//   a product that has several variants cannot be ordered as it is, so it
//   goes to a separate list instead, `${STORAGE.cartLegacy}:<owner>` =
//   [{ "productId": 1, "qty": 3 }], which the cart shows with a link to
//   choose the variant. The leftover 'aw-trade-user' and 'aw-welcome-seen'
//   keys from the first build are removed at the same time.

import { STORAGE } from '../data/content.js';
import { orderedLineKeys, parseLineKey, variantList, variantSlug } from './lines.js';
import { MAX_QTY } from './quantity.js';

export const GUEST = 'guest';
// Keys written by earlier versions of the site.
export const OLD_CART_KEY = 'aw-cart';
export const ORPHAN_KEYS = ['aw-trade-user', 'aw-welcome-seen'];
export const V2_CART = 'aw-cart-v2';
export const CART_VERSION = 3;

export const cartKey = (owner) => `${STORAGE.cart}:${owner}`;
export const v2CartKey = (owner) => `${V2_CART}:${owner}`;
export const legacyListKey = (owner) => `${STORAGE.cartLegacy}:${owner}`;

const EMPTY_CART = Object.freeze({});
const EMPTY_LIST = Object.freeze([]);
const EMPTY_ORDER = Object.freeze([]);
// No cart: no lines, never changed on this device.
const EMPTY_STATE = Object.freeze({ cart: EMPTY_CART, order: EMPTY_ORDER, savedAt: 0 });
export { EMPTY_CART, EMPTY_LIST, EMPTY_STATE };

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

// A whole quantity of 1 or more, or null. Numeric strings count (older
// builds stored whatever the stepper produced). A stored fraction is rounded
// down and a quantity over the database's limit comes back as MAX_QTY
// (AW-013), so a damaged cart is repaired on read instead of failing at
// submit.
export function validQty(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\s*\d+(\.\d+)?\s*$/.test(value)) return null;
  const n = Math.floor(Number(value));
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, MAX_QTY) : null;
}

// Two quantities of one line added up, never past the limit (AW-013).
const addQty = (a, b) => Math.min(MAX_QTY, a + b);

// '12' or '12::white-grape' for a valid key (the slug in its canonical form),
// or null.
export function validLineKey(key) {
  const raw = String(key);
  const { productId, variantSlug: slug } = parseLineKey(raw);
  if (!Number.isSafeInteger(productId) || productId < 1 || !/^\d+(::|$)/.test(raw)) return null;
  if (raw.includes('::') && !slug) return null;
  return slug ? `${productId}::${variantSlug(slug)}` : String(productId);
}

// [[line key, quantity], …] as { cart, order }: valid keys (in their
// canonical form) and quantities only, a key listed twice added up at its
// first place.
export function sanitizeEntries(entries) {
  const cart = {};
  const order = [];
  if (!Array.isArray(entries)) return { cart, order };
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const key = typeof entry[0] === 'string' || typeof entry[0] === 'number' ? validLineKey(entry[0]) : null;
    const qty = validQty(entry[1]);
    if (!key || !qty) continue;
    if (has(cart, key)) {
      cart[key] = addQty(cart[key], qty);
    } else {
      cart[key] = qty;
      order.push(key);
    }
  }
  return { cart, order };
}

// A cart object's lines in `order` (then the keys it doesn't list), as
// entries.
const entriesOf = (cart, order) => orderedLineKeys(cart, order).map((key) => [key, cart[key]]);

// A plain object of lines as a cart: {line key: quantity}. Anything else
// becomes {}.
export function sanitizeCart(value) {
  if (!isPlainObject(value)) return {};
  return sanitizeEntries(Object.entries(value)).cart;
}

// When the cart last changed on this device (ms), or 0 when unknown.
const validTime = (value) => {
  const n = Number(value);
  return typeof value === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

// A stored value as { cart, order, savedAt }: the v3 record, a bare list of
// entries, or a v2 object (in the order it lists its keys, which is the
// order the cart showed them in). Anything else is an empty cart.
export function parseStoredCart(data) {
  if (isPlainObject(data) && Array.isArray(data.lines)) return { ...sanitizeEntries(data.lines), savedAt: validTime(data.savedAt) };
  if (Array.isArray(data)) return { ...sanitizeEntries(data), savedAt: 0 };
  if (isPlainObject(data)) return { ...sanitizeEntries(Object.entries(data)), savedAt: 0 };
  return { cart: {}, order: [], savedAt: 0 };
}

// The v3 record for a cart, its lines in `order`.
export function storedCartValue(cart, order, savedAt) {
  const { cart: clean, order: keys } = sanitizeEntries(entriesOf(cart, order));
  return { v: CART_VERSION, savedAt: validTime(savedAt), lines: keys.map((key) => [key, clean[key]]) };
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
    byProduct.set(productId, addQty(byProduct.get(productId) || 0, qty));
  }
  return [...byProduct].map(([productId, qty]) => ({ productId, qty }));
}

// Two carts as one. 'sum' adds quantities (a guest cart joining an account);
// 'max' keeps the larger one, so moving the same old cart twice (an old tab
// still open writes it again) does not double it. Where b's new lines go in
// the order is the caller's (updateCart's arrange).
export function mergeCarts(a, b, mode = 'sum') {
  const next = { ...a };
  for (const [key, qty] of Object.entries(b)) {
    const had = Number(next[key]) || 0;
    next[key] = mode === 'max' ? Math.max(had, qty) : addQty(had, qty);
  }
  return next;
}

export function mergeLegacyLists(a, b, mode = 'sum') {
  const byProduct = new Map(a.map((entry) => [entry.productId, entry.qty]));
  for (const { productId, qty } of b) {
    const had = byProduct.get(productId) || 0;
    byProduct.set(productId, mode === 'max' ? Math.max(had, qty) : addQty(had, qty));
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
  const { cart: clean, order } = isPlainObject(oldCart) ? sanitizeEntries(Object.entries(oldCart)) : { cart: {}, order: [] };
  for (const [key, qty] of entriesOf(clean, order)) {
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

const parseJson = (raw) => {
  try {
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null; // damaged value: treated as empty, replaced on the next write
  }
};

// Parsed values by key, reused while the stored text is unchanged, so
// useSyncExternalStore gets the same object back.
const parsed = new Map();
function readParsed(key, parse) {
  const raw = getRaw(key);
  const hit = parsed.get(key);
  if (hit && hit.raw === raw) return hit.value;
  const value = parse(parseJson(raw));
  parsed.set(key, { raw, value });
  return value;
}

const toList = (data) => {
  const list = sanitizeLegacyList(data);
  return list.length ? list : EMPTY_LIST;
};

// Each cart read here, with its order (cartOrder).
const ORDERS = new WeakMap();
// The parsed cart of each owner, reused while the stored text (v3, or v2
// while there is no v3) is unchanged, so useSyncExternalStore gets the same
// object back.
const cartStates = new Map();

// The owner's cart as stored now: { cart, order, savedAt }. The same object
// (and the same cart object) while it is unchanged.
export function readCartState(owner) {
  const raw = getRaw(cartKey(owner));
  const rawV2 = raw === null ? getRaw(v2CartKey(owner)) : null;
  const hit = cartStates.get(owner);
  if (hit && hit.raw === raw && hit.rawV2 === rawV2) return hit.state;
  const parsedCart = parseStoredCart(parseJson(raw ?? rawV2));
  let state = EMPTY_STATE;
  if (parsedCart.order.length || parsedCart.savedAt) {
    state = Object.freeze({
      cart: parsedCart.order.length ? parsedCart.cart : EMPTY_CART,
      order: Object.freeze(parsedCart.order),
      savedAt: parsedCart.savedAt,
    });
  }
  ORDERS.set(state.cart, state.order);
  cartStates.set(owner, { raw, rawV2, state });
  return state;
}

// The owner's cart as stored now ({line key: quantity}). The same object
// while it is unchanged.
export const readCart = (owner) => readCartState(owner).cart;

// The order of a cart's lines (NEW-065): for a cart read here, the order
// they were added in; for any other object, its own key order.
export function cartOrder(cart) {
  return (cart && ORDERS.get(cart)) || orderedLineKeys(cart);
}

// The owner's old lines that need a variant (AW-354).
export const readLegacyList = (owner) => readParsed(legacyListKey(owner), toList);

function writeValue(key, value, isEmpty) {
  setRaw(key, isEmpty ? null : JSON.stringify(value));
  notify();
}

// A change's savedAt: now, and never before the last one, so a cart taken
// from a device whose clock runs ahead still counts as changed after it.
const nextSavedAt = (last) => Math.max(Date.now(), last + 1);

// Stores the owner's cart, its lines in `order` (by default the cart's own,
// cartOrder), with savedAt (by default now). Removes the owner's v2 key.
export function writeCart(owner, cart, { order = cartOrder(cart), savedAt } = {}) {
  const value = storedCartValue(isPlainObject(cart) ? cart : {}, order, 0);
  value.savedAt = savedAt === undefined ? nextSavedAt(readCartState(owner).savedAt) : validTime(savedAt);
  // A guest's empty cart, or one with no time, is no key at all.
  const empty = value.lines.length === 0 && (owner === GUEST || value.savedAt === 0);
  setRaw(cartKey(owner), empty ? null : JSON.stringify(value));
  setRaw(v2CartKey(owner), null);
  notify();
  return readCart(owner);
}

// Applies fn to the cart as stored now and stores the result (AW-046).
// Call it from event handlers, never inside a React state updater: React may
// run those twice. The lines keep their order (see the top of this file);
// arrange(order, next) gives another order for the result, e.g. lines that
// come back from an undo first. touch: false keeps savedAt, for a change
// that isn't the buyer's (re-keying lines to the catalog's keys).
export function updateCart(owner, fn, { arrange = null, touch = true } = {}) {
  const base = readCartState(owner);
  const next = fn(base.cart);
  if (next === base.cart) return base.cart;
  const order = arrange ? arrange(base.order, next) : base.order;
  return writeCart(owner, next, { order, savedAt: touch ? undefined : base.savedAt });
}

export function writeLegacyList(owner, list) {
  const clean = sanitizeLegacyList(list);
  writeValue(legacyListKey(owner), clean, clean.length === 0);
  return readLegacyList(owner);
}

export function updateLegacyList(owner, fn) {
  const base = readLegacyList(owner);
  const next = fn(base);
  if (next === base) return base;
  return writeLegacyList(owner, next);
}

// Undo for "Clear all items" (AW-082): the lines that were cleared go back
// into the owner's cart as stored now, in their old order, ahead of any line
// another tab added meanwhile (NEW-065). A line in both keeps the larger
// quantity, so an undo never doubles one. `snapshot` is what readCart(owner)
// gave just before the clear.
export function restoreCart(owner, snapshot) {
  if (!isPlainObject(snapshot)) return readCart(owner);
  const { cart: lines, order } = sanitizeEntries(entriesOf(snapshot, cartOrder(snapshot)));
  if (!order.length) return readCart(owner);
  return updateCart(owner, (cart) => mergeCarts(cart, lines, 'max'), { arrange: (current) => [...order, ...current] });
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

// Signing in (AW-189): the lines added as a guest join the account's cart,
// after its own lines, and the guest cart is emptied, so they are added once
// even when several tabs see the sign-in. Returns { before, guest, after }
// (cart states) when guest lines were added, else null; the same record
// waits for takeAdoption(owner), so the account's saved cart can take the
// guest lines too (src/lib/cartSync.js, AW-334).
const adoptions = new Map();
export function adoptGuestCart(owner) {
  if (owner === GUEST) return null;
  const guest = readCartState(GUEST);
  const guestList = readLegacyList(GUEST);
  let adopted = null;
  if (guest.order.length) {
    const before = readCartState(owner);
    updateCart(owner, (cart) => mergeCarts(cart, guest.cart), { arrange: (order) => [...order, ...guest.order] });
    writeCart(GUEST, {});
    adopted = { before, guest, after: readCartState(owner) };
    adoptions.set(owner, adopted);
  }
  if (guestList.length) {
    updateLegacyList(owner, (list) => mergeLegacyLists(list, guestList));
    writeLegacyList(GUEST, []);
  }
  return adopted;
}

// The last guest cart adoptGuestCart added to owner's this page view, once.
export function takeAdoption(owner) {
  const adopted = adoptions.get(owner) || null;
  adoptions.delete(owner);
  return adopted;
}

// Signing out: the next person at this computer starts with an empty cart.
// The account's own cart stays stored for its next sign-in here.
export function clearGuestCart() {
  writeCart(GUEST, {});
  writeLegacyList(GUEST, []);
}

// Moves owner's v2 cart (the plain object) to the v3 record, in the order
// the cart showed it in, and removes it (NEW-065). An old tab that wrote it
// again after the move adds its lines with the larger quantity of a line in
// both, so a cart moved twice isn't doubled. Returns true when there was one.
export function migrateV2Cart(owner) {
  const rawV2 = getRaw(v2CartKey(owner));
  if (rawV2 === null) return false;
  const old = parseStoredCart(parseJson(rawV2));
  if (!old.order.length) {
    setRaw(v2CartKey(owner), null);
    notify();
  } else if (getRaw(cartKey(owner)) === null) {
    // Its time isn't known: the account's saved copy counts as newer.
    writeCart(owner, old.cart, { order: old.order, savedAt: 0 });
  } else {
    updateCart(owner, (cart) => mergeCarts(cart, old.cart, 'max'), { arrange: (order) => [...order, ...old.order] });
  }
  return true;
}

// Moves a cart from before v2 into `owner`'s cart, once (AW-354), and
// removes the first build's leftover keys; moves owner's v2 cart to v3
// (migrateV2Cart). `products` decides which bare lines need a variant.
// Returns true when there was a cart from before v2.
export function migrateLegacyCart(owner, products) {
  for (const key of ORPHAN_KEYS) setRaw(key, null);
  migrateV2Cart(owner);
  // Where the old key cannot be removed, memory remembers it as gone, so it
  // moves once per page view at most.
  const raw = getRaw(OLD_CART_KEY);
  if (raw === null) return false;
  const { cart, legacy } = splitOldCart(parseJson(raw), products);
  if (Object.keys(cart).length) updateCart(owner, (current) => mergeCarts(current, cart, 'max'), { arrange: (order) => [...order, ...cartOrder(cart)] });
  if (legacy.length) updateLegacyList(owner, (list) => mergeLegacyLists(list, legacy, 'max'));
  setRaw(OLD_CART_KEY, null);
  return true;
}

// Carts changed in another tab, or while this one was in the background.
function onStorage(event) {
  const key = event.key;
  if (key === null || [STORAGE.cart, V2_CART, STORAGE.cartLegacy].some((prefix) => key.startsWith(`${prefix}:`))) notify();
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

// Tests only: forgets values held in memory, parsed values and adoptions.
export function resetCartStoreForTests() {
  memory.clear();
  parsed.clear();
  cartStates.clear();
  adoptions.clear();
}
