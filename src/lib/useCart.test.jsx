// The useCart hook over cart storage (AW-045, AW-046, AW-189, AW-354, AW-083).
// Products carry no prices (AW-003); the test prices come from priceOf.
import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCart } from './cart.js';
import { GUEST, OLD_CART_KEY, cartKey, legacyListKey, resetCartStoreForTests } from './cartStorage.js';
import { cartRecord as cartRecordOf, readStored, storedValue } from '../test/cartRecords.js';

const P = [
  { id: 1, sku: 'AW-SS', name: 'Cigarillos', variants: ['Diamond', 'Red'] },
  { id: 14, sku: 'AW-KITE', name: 'Kite', variants: [] },
  { id: 20, sku: 'AW-ONE', name: 'One', variants: ['Only'] },
];
const pricesFrom = (table) => (id) => table[id] ?? null;
const PRICE_OF = pricesFrom({ 1: 10, 14: 20, 20: 5 });
const A = '11111111-2222-4333-8444-555555555555';
const B = '99999999-8888-4777-8666-555555555555';

const stored = readStored;
const store = (key, value) => window.localStorage.setItem(key, JSON.stringify(storedValue(key, value)));
function otherTab(key, value) {
  const raw = value === null ? null : JSON.stringify(storedValue(key, value));
  if (raw === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, raw);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: raw }));
}
const useTestCart = (props) => useCart({ products: P, ...props });

beforeEach(() => {
  window.localStorage.clear();
  resetCartStoreForTests();
});
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetCartStoreForTests();
});

describe('useCart', () => {
  it('adds exactly one per click, also under StrictMode, and stores it at once (AW-046)', () => {
    const { result } = renderHook(() => useTestCart({ owner: GUEST }), { wrapper: StrictMode });
    act(() => result.current.addLine(14, null));
    expect(result.current.count).toBe(1);
    expect(stored(cartKey(GUEST))).toEqual({ 14: 1 });
  });

  it('follows changes made in another tab without overwriting them (AW-046)', () => {
    const { result } = renderHook(() => useTestCart({ owner: GUEST }));
    act(() => result.current.addLine(14, null));
    act(() => otherTab(cartKey(GUEST), { 14: 1, '1::red': 1 }));
    expect(result.current.count).toBe(2);
    act(() => result.current.addLine(20, 'Only'));
    expect(stored(cartKey(GUEST))).toEqual({ 14: 1, '1::red': 1, '20::only': 1 });
    // A clear in another tab empties this one too.
    act(() => otherTab(cartKey(GUEST), null));
    expect(result.current.count).toBe(0);
    expect(result.current.items).toEqual([]);
  });

  it('gives each account its own cart and brings the guest cart along at sign-in (AW-189)', () => {
    store(cartKey(A), { 14: 3 });
    const { result, rerender } = renderHook((props) => useTestCart(props), { initialProps: { owner: GUEST } });
    act(() => result.current.addLine(20, 'Only', 2));
    rerender({ owner: A });
    expect(result.current.cart).toEqual({ 14: 3, '20::only': 2 });
    expect(window.localStorage.getItem(cartKey(GUEST))).toBeNull();
    // Signing out: the next person sees an empty cart; A's stays stored.
    rerender({ owner: GUEST });
    expect(result.current.count).toBe(0);
    expect(stored(cartKey(A))).toEqual({ 14: 3, '20::only': 2 });
    // Another buyer signing in does not get A's lines.
    rerender({ owner: B });
    expect(result.current.count).toBe(0);
    rerender({ owner: GUEST });
    rerender({ owner: A });
    expect(result.current.count).toBe(5);
  });

  it('starts on the account’s cart after a reload, without adding the guest cart to it', () => {
    store(cartKey(A), { 14: 1 });
    store(cartKey(GUEST), { 20: 1 });
    const { result, rerender } = renderHook((props) => useTestCart(props), { initialProps: { owner: A } });
    rerender({ owner: A });
    expect(result.current.cart).toEqual({ 14: 1 });
    expect(stored(cartKey(GUEST))).toEqual({ 20: 1 });
  });

  it('waits for the live catalog before flagging or re-keying lines, and never drops them (AW-083)', () => {
    store(cartKey(GUEST), { 14: 1, 999: 2, 20: 1, '1::purple': 1 });
    const { result, rerender } = renderHook((props) => useTestCart(props), { initialProps: { owner: GUEST, catalogSettled: false } });
    expect(result.current.items.map((i) => i.lineKey)).toEqual(['14', '20::only']);
    expect(stored(cartKey(GUEST))).toEqual({ 14: 1, 999: 2, 20: 1, '1::purple': 1 });
    rerender({ owner: GUEST, catalogSettled: true });
    // In the stored order, '20' re-keyed in its place (NEW-065).
    expect(result.current.items.map((i) => [i.lineKey, i.unavailable])).toEqual([
      ['14', null], ['20::only', null], ['999', 'product'], ['1::purple', 'variant'],
    ]);
    expect(result.current.count).toBe(5);
    expect(stored(cartKey(GUEST))).toEqual({ 14: 1, 999: 2, '20::only': 1, '1::purple': 1 });
    act(() => result.current.removeLines(['999', '1::purple']));
    expect(stored(cartKey(GUEST))).toEqual({ 14: 1, '20::only': 1 });
  });

  it('prices lines through priceOf and never prices unavailable lines', () => {
    store(cartKey(A), { 14: 2, 999: 1 });
    const { result, rerender } = renderHook((props) => useTestCart(props), { initialProps: { owner: A } });
    expect(result.current.items.map((i) => i.price)).toEqual([null, null]);
    expect(result.current.total).toBe(0);
    // The buyer's prices arrive.
    rerender({ owner: A, priceOf: PRICE_OF });
    expect(result.current.items.map((i) => i.price)).toEqual([20, null]);
    expect(result.current.total).toBe(40);
  });

  it('moves an old cart and lists the lines that still need a variant (AW-354)', () => {
    window.localStorage.setItem(OLD_CART_KEY, JSON.stringify({ 1: 3, 14: 1 }));
    window.localStorage.setItem('aw-trade-user', '{"name":"x"}');
    const { result } = renderHook(() => useTestCart({ owner: GUEST }));
    expect(result.current.cart).toEqual({ 14: 1 });
    expect(result.current.legacy).toEqual([{ productId: 1, qty: 3, name: 'Cigarillos', sku: 'AW-SS' }]);
    expect(window.localStorage.getItem(OLD_CART_KEY)).toBeNull();
    expect(window.localStorage.getItem('aw-trade-user')).toBeNull();
    // Choosing a variant uses up the saved quantity.
    act(() => result.current.addLine(1, 'Red', 2));
    expect(result.current.legacy).toEqual([{ productId: 1, qty: 1, name: 'Cigarillos', sku: 'AW-SS' }]);
    expect(result.current.cart).toEqual({ 14: 1, '1::red': 2 });
    act(() => result.current.dismissLegacy());
    expect(result.current.legacy).toEqual([]);
    expect(window.localStorage.getItem(legacyListKey(GUEST))).toBeNull();
  });

  it('works in memory when storage is blocked (AW-045)', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('The operation is insecure.', 'SecurityError'); });
    const { result } = renderHook(() => useTestCart({ owner: GUEST }));
    act(() => result.current.addLine(14, null));
    act(() => result.current.addLine(14, null));
    expect(result.current.count).toBe(2);
    act(() => result.current.clearCart());
    expect(result.current.count).toBe(0);
  });

  it('adds, steps and sets whole quantities from 1 to 100,000, and says when an add was capped (AW-013)', () => {
    const { result } = renderHook(() => useTestCart({ owner: GUEST }));
    let added;
    act(() => { added = result.current.addLine(14, null, 48); });
    expect(added).toEqual({ key: '14', qty: 48, capped: false });
    act(() => { added = result.current.addLine(14, null, 150000); });
    expect(added).toEqual({ key: '14', qty: 100000, capped: true });
    // Nothing to add: a multi-variant product without its variant, or a quantity that isn't whole.
    act(() => { added = result.current.addLine(1, null, 2); });
    expect(added).toBeNull();
    act(() => { added = result.current.addLine(20, 'Only', 2.5); });
    expect(added).toBeNull();
    act(() => result.current.decLine('14', 99952));
    expect(result.current.cart).toEqual({ 14: 48 });
    act(() => result.current.decLine('14'));
    expect(result.current.cart).toEqual({ 14: 47 });
    act(() => result.current.setLine('14', 12));
    expect(result.current.cart).toEqual({ 14: 12 });
    act(() => result.current.setLine('14', 0));
    expect(result.current.cart).toEqual({ 14: 12 });
    act(() => result.current.setLine('14', 1e9));
    expect(stored(cartKey(GUEST))).toEqual({ 14: 100000 });
    act(() => result.current.decLine('14', 100000));
    expect(result.current.count).toBe(0);
  });

  it('uses up only what an add actually added of an old cart’s saved quantity (AW-354, AW-013)', () => {
    store(cartKey(GUEST), { '1::red': 99999 });
    store(legacyListKey(GUEST), [{ productId: 1, qty: 5 }]);
    const { result } = renderHook(() => useTestCart({ owner: GUEST }));
    let added;
    act(() => { added = result.current.addLine(1, 'Red', 5); });
    expect(added).toEqual({ key: '1::red', qty: 100000, capped: true });
    expect(result.current.legacy.map((l) => l.qty)).toEqual([4]);
  });

  it('moves a bare line to the chosen variant, quantity and all (AW-011)', () => {
    store(cartKey(GUEST), { 1: 12, 14: 2 });
    const { result } = renderHook(() => useTestCart({ owner: GUEST }));
    expect(result.current.items[0]).toMatchObject({
      lineKey: '1', needsVariant: true, qty: 12,
      variants: [{ label: 'Diamond', available: true }, { label: 'Red', available: true }],
    });
    let moved;
    act(() => { moved = result.current.chooseVariant('1', 'Red'); });
    expect(moved).toEqual({ key: '1::red', qty: 12 });
    expect(stored(cartKey(GUEST))).toEqual({ 14: 2, '1::red': 12 });
    expect(result.current.count).toBe(14);
    // Onto a variant already in the cart: the quantities add up.
    store(cartKey(GUEST), { 1: 3, '1::red': 12 });
    act(() => { moved = result.current.chooseVariant('1', 'Red'); });
    expect(moved).toEqual({ key: '1::red', qty: 15 });
    // Not a variant of the product, or one marked not available: nothing moves.
    act(() => { moved = result.current.chooseVariant('1::red', 'Purple'); });
    expect(moved).toBeNull();
    expect(stored(cartKey(GUEST))).toEqual({ '1::red': 15 });
  });

  it('prices the stored cart against a catalog and prices loaded again (AW-191)', () => {
    const { result } = renderHook(() => useTestCart({ owner: GUEST, priceOf: PRICE_OF }));
    act(() => result.current.addLine(14, null, 2));
    // Another tab added a line the page has not drawn yet.
    window.localStorage.setItem(cartKey(GUEST), JSON.stringify({ 14: 2, '20::only': 1 }));
    const next = P.filter(p => p.id !== 20);
    const items = result.current.itemsFor(next, pricesFrom({ 14: 25 }));
    expect(items.map(i => [i.lineKey, i.qty, i.price, i.unavailable])).toEqual([['14', 2, 25, null], ['20::only', 1, null, 'product']]);
    // Without new prices, the ones on screen are used.
    expect(result.current.itemsFor(P).map(i => i.price)).toEqual([20, 5]);
  });
});


describe('useCart keeps the order lines were added in (NEW-065)', () => {
  const keys = (result) => result.current.items.map((i) => i.lineKey);

  it('lists new lines at the end, whatever their keys, and keeps it after a reload', () => {
    const { result, unmount } = renderHook(() => useTestCart({ owner: GUEST }));
    act(() => result.current.addLine(20, 'Only'));
    act(() => result.current.addLine(14, null));
    act(() => result.current.addLine(1, 'Red'));
    expect(keys(result)).toEqual(['20::only', '14', '1::red']);
    // More of a line leaves it where it is.
    act(() => result.current.addLine(20, 'Only', 2));
    act(() => result.current.setLine('14', 5));
    expect(keys(result)).toEqual(['20::only', '14', '1::red']);
    unmount();
    resetCartStoreForTests();
    const again = renderHook(() => useTestCart({ owner: GUEST }));
    expect(keys(again.result)).toEqual(['20::only', '14', '1::red']);
  });

  it('adds a reorder’s lines in its order, and a chosen variant takes the bare line’s place', () => {
    const { result } = renderHook(() => useTestCart({ owner: GUEST }));
    act(() => result.current.addLine(14, null));
    act(() => { result.current.addLines([{ productId: 1, qty: 2 }, { productId: 20, variant: 'Only', qty: 1 }]); });
    expect(keys(result)).toEqual(['14', '1', '20::only']);
    act(() => { result.current.chooseVariant('1', 'Diamond'); });
    expect(keys(result)).toEqual(['14', '1::diamond', '20::only']);
  });

  it('puts the account’s lines first and the guest’s after them at sign-in, and an undo back in order', () => {
    store(cartKey(A), { 1: 1 });
    const { result, rerender } = renderHook((props) => useTestCart(props), { initialProps: { owner: GUEST } });
    act(() => result.current.addLine(20, 'Only'));
    act(() => result.current.addLine(14, null));
    rerender({ owner: A });
    expect(keys(result)).toEqual(['1', '20::only', '14']);
    let snapshot;
    act(() => { snapshot = result.current.clearCart(); });
    act(() => result.current.addLine(1, 'Red'));
    act(() => result.current.restoreLines(snapshot));
    expect(keys(result)).toEqual(['1', '20::only', '14', '1::red']);
  });

  it('re-keys a line to the catalog’s key in its place once the catalog is final', () => {
    store(cartKey(GUEST), cartRecordOf([['14', 1], ['20', 2], ['1::red', 1]]));
    const { result, rerender } = renderHook((props) => useTestCart(props), { initialProps: { owner: GUEST, catalogSettled: false } });
    rerender({ owner: GUEST, catalogSettled: true });
    expect(keys(result)).toEqual(['14', '20::only', '1::red']);
  });
});
