// Cart storage (AW-045, AW-046, AW-189, AW-354): guarded reads and writes,
// shape checks, per-account carts, the move from the old 'aw-cart' key and
// changes made against what is stored now. Fixtures carry no prices.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE } from '../data/content.js';
import { PRODUCTS } from '../data/products.js';
import {
  GUEST, OLD_CART_KEY, ORPHAN_KEYS, adoptGuestCart, cartKey, cartOrder, cartOwner, clearGuestCart, legacyListKey, mergeCarts,
  mergeLegacyLists, migrateLegacyCart, migrateV2Cart, parseStoredCart, readCart, readCartState, readLegacyList, resetCartStoreForTests,
  restoreCart, sanitizeCart, sanitizeLegacyList, splitOldCart, subscribeCart, takeAdoption, takeFromLegacyList, updateCart, v2CartKey,
  validLineKey, validQty, writeCart,
} from './cartStorage.js';
import { cartRecord, readStored, storedOrder, storedValue } from '../test/cartRecords.js';

const P = [
  { id: 1, sku: 'AW-SS', name: 'Cigarillos', variants: ['Diamond', 'Red'] },
  { id: 14, sku: 'AW-KITE', name: 'Kite', variants: [] },
  { id: 20, sku: 'AW-ONE', name: 'One', variants: ['Only'] },
];
const A = '11111111-2222-4333-8444-555555555555';
const B = '99999999-8888-4777-8666-555555555555';

const stored = readStored;
const otherTabWrites = (key, value) => {
  const raw = value === null ? null : JSON.stringify(storedValue(key, value));
  if (raw === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, raw);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: raw }));
};

beforeEach(() => {
  window.localStorage.clear();
  resetCartStoreForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetCartStoreForTests();
});

describe('shape checks (AW-045)', () => {
  it('accepts whole quantities of 1 or more, also as numeric strings', () => {
    expect([3, '3', 2.9, ' 4 '].map(validQty)).toEqual([3, 3, 2, 4]);
    expect([0, -1, 0.5, NaN, Infinity, 1e300, '', 'x', '1e3', null, true, {}, [2]].map(validQty)).toEqual(Array(13).fill(null));
  });

  it('repairs a stored quantity over the database’s 100,000 limit to the limit (AW-013)', () => {
    expect([1e9, '150000', 100000, 100001].map(validQty)).toEqual([100000, 100000, 100000, 100000]);
    // The finding's cart: a fraction and a billion.
    expect(sanitizeCart({ '1::diamond': 2.5, 366: 1e9 })).toEqual({ '1::diamond': 2, 366: 100000 });
    // Duplicate keys add up only to the limit.
    expect(sanitizeCart({ '1::Red': 60000, '1::red': 60000 })).toEqual({ '1::red': 100000 });
    expect(sanitizeLegacyList([{ productId: 1, qty: 60000 }, { productId: 1, qty: 60000 }])).toEqual([{ productId: 1, qty: 100000 }]);
  });

  it('reads the finding’s stored cart as 2 and 100,000', () => {
    window.localStorage.setItem(cartKey(GUEST), JSON.stringify({ '1::diamond': 2.5, 366: 1e9 }));
    expect(readCart(GUEST)).toEqual({ '1::diamond': 2, 366: 100000 });
  });

  it('accepts product ids and variant slugs only', () => {
    expect(validLineKey('14')).toBe('14');
    expect(validLineKey('1::white-grape')).toBe('1::white-grape');
    expect(validLineKey('1::White Grape')).toBe('1::white-grape');
    expect(validLineKey('014')).toBe('14');
    for (const bad of ['', 'abc', '0', '-1', '1.5', '1::', '::red', 'x::red', '99999999999999999999', '__proto__']) {
      expect(validLineKey(bad)).toBeNull();
    }
  });

  it('turns anything that is not a plain object of lines into an empty cart', () => {
    for (const bad of [null, undefined, 'x', 5, true, [1, 2], [{ 14: 1 }], new Date(), Object.create({ 14: 1 })]) {
      expect(sanitizeCart(bad)).toEqual({});
    }
    expect(sanitizeCart({ 14: '2', '1::Red': 1, '1::red': 2, 9: 0, x: 3, 20: 'lots' })).toEqual({ 14: 2, '1::red': 3 });
  });

  it('keeps one legacy entry per product with a valid quantity', () => {
    expect(sanitizeLegacyList({ productId: 1, qty: 1 })).toEqual([]);
    expect(sanitizeLegacyList([{ productId: 1, qty: 2 }, { productId: '1', qty: '1' }, { productId: 0, qty: 1 }, null, 'x', { productId: 5, qty: 0 }]))
      .toEqual([{ productId: 1, qty: 3 }]);
  });
});

describe('reading and writing', () => {
  it('reads damaged values as an empty cart without throwing (AW-045)', () => {
    for (const raw of ['{broken', 'null', '[1,2]', '"text"', '5', '{"14":"x"}']) {
      window.localStorage.setItem(cartKey(GUEST), raw);
      expect(readCart(GUEST)).toEqual({});
    }
  });

  it('returns the same object while the stored text is unchanged', () => {
    writeCart(GUEST, { 14: 1 });
    expect(readCart(GUEST)).toBe(readCart(GUEST));
    expect(readCart(GUEST)).toEqual({ 14: 1 });
  });

  it('stores an empty cart as no key at all', () => {
    writeCart(GUEST, { 14: 1 });
    expect(stored(cartKey(GUEST))).toEqual({ 14: 1 });
    writeCart(GUEST, {});
    expect(window.localStorage.getItem(cartKey(GUEST))).toBeNull();
  });

  it('keeps the cart in memory when localStorage cannot be reached at all (AW-045)', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('The operation is insecure.', 'SecurityError'); });
    expect(readCart(GUEST)).toEqual({});
    expect(() => updateCart(GUEST, (c) => ({ ...c, 14: 2 }))).not.toThrow();
    expect(readCart(GUEST)).toEqual({ 14: 2 });
    expect(migrateLegacyCart(GUEST, P)).toBe(false);
  });

  it('keeps the cart in memory when a write fails (storage full)', () => {
    writeCart(GUEST, { 14: 1 });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    updateCart(GUEST, (c) => ({ ...c, 20: 1 }));
    expect(readCart(GUEST)).toEqual({ 14: 1, 20: 1 });
    setItem.mockRestore();
    updateCart(GUEST, (c) => ({ ...c, 20: 2 }));
    expect(stored(cartKey(GUEST))).toEqual({ 14: 1, 20: 2 });
  });
});

describe('changes against what is stored now (AW-046)', () => {
  it('keeps a line another tab added', () => {
    writeCart(GUEST, { 14: 1 });
    expect(readCart(GUEST)).toEqual({ 14: 1 });
    otherTabWrites(cartKey(GUEST), { 14: 1, '115::original': 1 });
    updateCart(GUEST, (c) => ({ ...c, 14: c[14] + 1 }));
    expect(stored(cartKey(GUEST))).toEqual({ 14: 2, '115::original': 1 });
  });

  it('does not bring back a cart another tab cleared', () => {
    writeCart(GUEST, { 14: 5, '115::original': 3 });
    otherTabWrites(cartKey(GUEST), null);
    updateCart(GUEST, (c) => ({ ...c, '57::5w-30': 1 }));
    expect(stored(cartKey(GUEST))).toEqual({ '57::5w-30': 1 });
  });

  it('tells subscribers about cart changes from other tabs only', () => {
    const listener = vi.fn();
    const stop = subscribeCart(listener);
    otherTabWrites(cartKey(A), { 14: 1 });
    otherTabWrites(STORAGE.age, 'x');
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    otherTabWrites(cartKey(A), { 14: 2 });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('moving the old cart (AW-354)', () => {
  it('moves {"1":3,"14":1,"20":2}: variant-less multi-variant lines go to the legacy list', () => {
    window.localStorage.setItem(OLD_CART_KEY, JSON.stringify({ 1: 3, 14: 1, 20: 2 }));
    window.localStorage.setItem('aw-trade-user', JSON.stringify({ name: 'Old Buyer', email: 'old@example.test' }));
    window.localStorage.setItem('aw-welcome-seen', '1');
    expect(migrateLegacyCart(GUEST, P)).toBe(true);
    expect(stored(cartKey(GUEST))).toEqual({ 14: 1, 20: 2 });
    expect(stored(legacyListKey(GUEST))).toEqual([{ productId: 1, qty: 3 }]);
    for (const key of [OLD_CART_KEY, ...ORPHAN_KEYS]) expect(window.localStorage.getItem(key)).toBeNull();
    expect(migrateLegacyCart(GUEST, P)).toBe(false);
  });

  it('keeps variant lines and unknown products as cart lines', () => {
    expect(splitOldCart({ '1::red': 2, 1: 1, 14: 1, 9999: 4, bad: 1 }, P)).toEqual({ cart: { '1::red': 2, 14: 1, 9999: 4 }, legacy: [{ productId: 1, qty: 1 }] });
    expect(splitOldCart(null, P)).toEqual({ cart: {}, legacy: [] });
  });

  it('moves into the cart of whoever uses the device, without doubling a cart moved twice', () => {
    writeCart(A, { 14: 2, '1::red': 1 });
    window.localStorage.setItem(OLD_CART_KEY, JSON.stringify({ 14: 2, 1: 3 }));
    migrateLegacyCart(A, P);
    // An old tab still open writes the same cart again.
    window.localStorage.setItem(OLD_CART_KEY, JSON.stringify({ 14: 2, 1: 3 }));
    migrateLegacyCart(A, P);
    expect(readCart(A)).toEqual({ 14: 2, '1::red': 1 });
    expect(readLegacyList(A)).toEqual([{ productId: 1, qty: 3 }]);
    expect(readCart(GUEST)).toEqual({});
  });

  it('moves a real old cart against the bundled catalog', () => {
    // Swisher Sweets and Snickers have several variants, Kite has none.
    window.localStorage.setItem(OLD_CART_KEY, JSON.stringify({ 1: 3, 162: 2, 14: 1 }));
    migrateLegacyCart(GUEST, PRODUCTS);
    expect(readCart(GUEST)).toEqual({ 14: 1 });
    expect(readLegacyList(GUEST)).toEqual([{ productId: 1, qty: 3 }, { productId: 162, qty: 2 }]);
  });

  it('removes a damaged old cart', () => {
    window.localStorage.setItem(OLD_CART_KEY, 'null');
    expect(migrateLegacyCart(GUEST, P)).toBe(true);
    expect(window.localStorage.getItem(OLD_CART_KEY)).toBeNull();
    expect(readCart(GUEST)).toEqual({});
  });

  it('uses up saved quantities as variants are chosen', () => {
    window.localStorage.setItem(legacyListKey(GUEST), JSON.stringify([{ productId: 1, qty: 3 }, { productId: 162, qty: 2 }]));
    takeFromLegacyList(GUEST, 1, 1);
    expect(readLegacyList(GUEST)).toEqual([{ productId: 1, qty: 2 }, { productId: 162, qty: 2 }]);
    takeFromLegacyList(GUEST, 1, 5);
    takeFromLegacyList(GUEST, 14, 1);
    expect(readLegacyList(GUEST)).toEqual([{ productId: 162, qty: 2 }]);
  });
});

describe('one cart per account (AW-189)', () => {
  it('picks the signed-in user, the saved session while it is checked, or guest', () => {
    expect(cartOwner({ loading: false, session: null })).toBe(GUEST);
    expect(cartOwner({ loading: false, session: { user: { id: A } } }, B)).toBe(A);
    expect(cartOwner({ loading: true, session: null }, A)).toBe(A);
    expect(cartOwner({ loading: false, session: null, connectionProblem: true }, A)).toBe(A);
    expect(cartOwner({ loading: false, session: null }, A)).toBe(GUEST);
    expect(cartOwner({ loading: true, session: null }, null)).toBe(GUEST);
    expect(cartOwner({ loading: false, session: { user: { id: 'bad id!' } } })).toBe(GUEST);
  });

  it('adds the guest cart to the account once at sign-in, then empties it', () => {
    writeCart(GUEST, { 14: 1, '1::red': 2 });
    window.localStorage.setItem(legacyListKey(GUEST), JSON.stringify([{ productId: 162, qty: 2 }]));
    writeCart(A, { 14: 2 });
    adoptGuestCart(A);
    adoptGuestCart(A); // a second tab seeing the same sign-in
    expect(readCart(A)).toEqual({ 14: 3, '1::red': 2 });
    expect(readLegacyList(A)).toEqual([{ productId: 162, qty: 2 }]);
    expect(window.localStorage.getItem(cartKey(GUEST))).toBeNull();
    expect(window.localStorage.getItem(legacyListKey(GUEST))).toBeNull();
  });

  it('keeps each account’s cart apart and leaves the next person an empty guest cart', () => {
    writeCart(A, { 14: 3 });
    writeCart(GUEST, { 20: 1 });
    clearGuestCart();
    expect(readCart(GUEST)).toEqual({});
    expect(readCart(B)).toEqual({});
    expect(readCart(A)).toEqual({ 14: 3 });
  });

  it('merges carts by sum or by the larger quantity', () => {
    expect(mergeCarts({ 14: 2, 20: 1 }, { 14: 3, 1: 1 })).toEqual({ 14: 5, 20: 1, 1: 1 });
    expect(mergeCarts({ 14: 2, 20: 1 }, { 14: 3, 1: 1 }, 'max')).toEqual({ 14: 3, 20: 1, 1: 1 });
  });

  it('never merges past 100,000 a line (AW-013)', () => {
    expect(mergeCarts({ 14: 70000 }, { 14: 40000 })).toEqual({ 14: 100000 });
    expect(mergeLegacyLists([{ productId: 1, qty: 70000 }], [{ productId: 1, qty: 40000 }])).toEqual([{ productId: 1, qty: 100000 }]);
    // A guest cart joining an account's at sign-in.
    writeCart(GUEST, { 14: 70000 });
    writeCart(A, { 14: 40000 });
    adoptGuestCart(A);
    expect(readCart(A)).toEqual({ 14: 100000 });
  });
});

describe('the order lines were added in (NEW-065)', () => {
  const order = (owner) => readCartState(owner).order;

  it('keeps integer-like keys after a variant key in the order they were added, stored and read back', () => {
    for (const key of ['1::white-grape', '174', '14']) updateCart(GUEST, (c) => ({ ...c, [key]: 1 }));
    expect(order(GUEST)).toEqual(['1::white-grape', '174', '14']);
    expect(storedOrder(cartKey(GUEST))).toEqual(['1::white-grape', '174', '14']);
    // A reload reads the same order.
    resetCartStoreForTests();
    expect(order(GUEST)).toEqual(['1::white-grape', '174', '14']);
    // A line keeps its place when its quantity changes, and a removed one goes.
    updateCart(GUEST, (c) => ({ ...c, 174: 5 }));
    updateCart(GUEST, (c) => { const next = { ...c }; delete next['1::white-grape']; return next; });
    expect(order(GUEST)).toEqual(['174', '14']);
    expect(readCart(GUEST)).toEqual({ 174: 5, 14: 1 });
  });

  it('stores the v3 record and reads the order another tab stored', () => {
    writeCart(GUEST, { 14: 2, '1::red': 1 }, { order: ['1::red', '14'] });
    expect(JSON.parse(window.localStorage.getItem('aw-cart-v3:guest'))).toEqual({ v: 3, savedAt: expect.any(Number), lines: [['1::red', 1], ['14', 2]] });
    const listener = vi.fn();
    const stop = subscribeCart(listener);
    otherTabWrites(cartKey(GUEST), cartRecord([['45', 1], ['14', 2], ['1::red', 1]]));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(order(GUEST)).toEqual(['45', '14', '1::red']);
    stop();
  });

  it('moves a v2 cart to v3 in the order it was shown in, and removes the v2 key', () => {
    // JSON.parse lists '14' and '174' first, by number: the order the v2 cart showed.
    window.localStorage.setItem(v2CartKey(GUEST), '{"1::white-grape":2,"174":1,"14":3}');
    expect(order(GUEST)).toEqual(['14', '174', '1::white-grape']);
    expect(migrateLegacyCart(GUEST, P)).toBe(false);
    expect(window.localStorage.getItem(v2CartKey(GUEST))).toBeNull();
    expect(storedOrder(cartKey(GUEST))).toEqual(['14', '174', '1::white-grape']);
    expect(readCart(GUEST)).toEqual({ 14: 3, 174: 1, '1::white-grape': 2 });
    // Its time isn't known, so an account's saved copy counts as newer (AW-334).
    expect(readCartState(GUEST).savedAt).toBe(0);
    // New lines go after it.
    updateCart(GUEST, (c) => ({ ...c, 45: 1 }));
    expect(order(GUEST)).toEqual(['14', '174', '1::white-grape', '45']);
  });

  it('adds what an old tab wrote to v2 after the move, without doubling a line, and leaves no v2 key', () => {
    writeCart(A, { 14: 2 });
    window.localStorage.setItem(v2CartKey(A), JSON.stringify({ 14: 2, '1::red': 1 }));
    migrateV2Cart(A);
    expect(readCart(A)).toEqual({ 14: 2, '1::red': 1 });
    expect(order(A)).toEqual(['14', '1::red']);
    expect(window.localStorage.getItem(v2CartKey(A))).toBeNull();
    // A damaged v2 value just goes.
    window.localStorage.setItem(v2CartKey(A), '{broken');
    expect(migrateV2Cart(A)).toBe(true);
    expect(window.localStorage.getItem(v2CartKey(A))).toBeNull();
    expect(migrateV2Cart(A)).toBe(false);
  });

  it('removes the owner’s v2 key on any write, so it never comes back', () => {
    window.localStorage.setItem(v2CartKey(GUEST), JSON.stringify({ 14: 1 }));
    updateCart(GUEST, (c) => ({ ...c, 45: 1 }));
    expect(readCart(GUEST)).toEqual({ 14: 1, 45: 1 });
    expect(window.localStorage.getItem(v2CartKey(GUEST))).toBeNull();
  });

  it('reads a list of entries or a plain object under the v3 key, and drops what isn’t a line', () => {
    expect(parseStoredCart([['174', 1], ['14', '2'], ['x', 1], ['14', 1], [20], 'y'])).toEqual({ cart: { 174: 1, 14: 3 }, order: ['174', '14'], savedAt: 0 });
    expect(parseStoredCart({ v: 3, savedAt: 1700000000000, lines: [['1::White Grape', 2]] })).toEqual({ cart: { '1::white-grape': 2 }, order: ['1::white-grape'], savedAt: 1700000000000 });
    expect(parseStoredCart({ v: 3, savedAt: 'soon', lines: 'all' })).toEqual({ cart: {}, order: [], savedAt: 0 });
    expect(parseStoredCart({ 14: 1 })).toEqual({ cart: { 14: 1 }, order: ['14'], savedAt: 0 });
    expect(parseStoredCart(null)).toEqual({ cart: {}, order: [], savedAt: 0 });
  });

  it('dates each change, never earlier than the last, and keeps the date for a change that isn’t the buyer’s', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5000);
    writeCart(A, { 14: 1 });
    expect(readCartState(A).savedAt).toBe(5000);
    updateCart(A, (c) => ({ ...c, 14: 2 }));
    expect(readCartState(A).savedAt).toBe(5001);
    updateCart(A, (c) => ({ ...c, 45: 1 }), { touch: false });
    expect(readCartState(A).savedAt).toBe(5001);
    // A cart taken from a device whose clock runs ahead.
    writeCart(A, { 14: 3 }, { savedAt: 9000 });
    updateCart(A, (c) => ({ ...c, 14: 4 }));
    expect(readCartState(A).savedAt).toBe(9001);
  });

  it('keeps an account’s emptied cart as a dated record with no lines; a guest’s goes', () => {
    writeCart(A, { 14: 1 });
    updateCart(A, () => ({}));
    expect(JSON.parse(window.localStorage.getItem(cartKey(A)))).toEqual({ v: 3, savedAt: expect.any(Number), lines: [] });
    expect(readCartState(A)).toMatchObject({ cart: {}, order: [], savedAt: expect.any(Number) });
    expect(readCartState(A).savedAt).toBeGreaterThan(0);
    writeCart(GUEST, { 14: 1 });
    updateCart(GUEST, () => ({}));
    expect(window.localStorage.getItem(cartKey(GUEST))).toBeNull();
  });

  it('puts undone lines back in their old order, ahead of lines added meanwhile', () => {
    writeCart(GUEST, { 45: 1, 14: 2, '1::red': 3 }, { order: ['1::red', '45', '14'] });
    const snapshot = readCart(GUEST);
    expect(cartOrder(snapshot)).toEqual(['1::red', '45', '14']);
    writeCart(GUEST, {});
    updateCart(GUEST, (c) => ({ ...c, 174: 1 }));
    restoreCart(GUEST, snapshot);
    expect(order(GUEST)).toEqual(['1::red', '45', '14', '174']);
  });

  it('adds the guest’s lines after the account’s at sign-in, and hands the adoption over once', () => {
    writeCart(A, { 45: 1, 14: 2 }, { order: ['45', '14'] });
    writeCart(GUEST, { 174: 1, '1::red': 1, 14: 1 }, { order: ['174', '1::red', '14'] });
    const before = readCartState(A);
    const adopted = adoptGuestCart(A);
    expect(order(A)).toEqual(['45', '14', '174', '1::red']);
    expect(readCart(A)).toEqual({ 45: 1, 14: 3, 174: 1, '1::red': 1 });
    expect(adopted.before).toBe(before);
    expect(adopted.guest.order).toEqual(['174', '1::red', '14']);
    expect(adopted.after).toBe(readCartState(A));
    expect(takeAdoption(A)).toBe(adopted);
    expect(takeAdoption(A)).toBeNull();
    // Nothing to adopt: nothing handed over.
    expect(adoptGuestCart(A)).toBeNull();
    expect(takeAdoption(A)).toBeNull();
  });
});
