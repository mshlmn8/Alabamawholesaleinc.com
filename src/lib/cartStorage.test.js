// Cart storage (AW-045, AW-046, AW-189, AW-354): guarded reads and writes,
// shape checks, per-account carts, the move from the old 'aw-cart' key and
// changes made against what is stored now. Fixtures carry no prices.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE } from '../data/content.js';
import { PRODUCTS } from '../data/products.js';
import {
  GUEST, OLD_CART_KEY, ORPHAN_KEYS, adoptGuestCart, cartKey, cartOwner, clearGuestCart, legacyListKey, mergeCarts,
  migrateLegacyCart, readCart, readLegacyList, resetCartStoreForTests, sanitizeCart, sanitizeLegacyList,
  splitOldCart, subscribeCart, takeFromLegacyList, updateCart, validLineKey, validQty, writeCart,
} from './cartStorage.js';

const P = [
  { id: 1, sku: 'AW-SS', name: 'Cigarillos', variants: ['Diamond', 'Red'] },
  { id: 14, sku: 'AW-KITE', name: 'Kite', variants: [] },
  { id: 20, sku: 'AW-ONE', name: 'One', variants: ['Only'] },
];
const A = '11111111-2222-4333-8444-555555555555';
const B = '99999999-8888-4777-8666-555555555555';

const stored = (key) => {
  const raw = window.localStorage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
};
const otherTabWrites = (key, value) => {
  const raw = value === null ? null : JSON.stringify(value);
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
});
