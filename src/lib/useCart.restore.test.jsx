// Undo for "Clear all items" (AW-082): clearCart() returns the lines it
// removed, and restoreLines() puts them back into the cart as stored now, so
// a line another tab added in between stays (restoreCart in cartStorage.js).
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCart } from './cart.js';
import { GUEST, cartKey, readCart, resetCartStoreForTests, restoreCart, writeCart } from './cartStorage.js';

const P = [
  { id: 1, sku: 'AW-SS', name: 'Cigarillos', variants: ['Diamond', 'Red'] },
  { id: 14, sku: 'AW-KITE', name: 'Kite', variants: [] },
  { id: 45, sku: 'AW-ARGO', name: 'Argo', variants: [] },
];
const A = '11111111-2222-4333-8444-555555555555';
const stored = (key) => JSON.parse(window.localStorage.getItem(key) || 'null');
function otherTab(key, value) {
  const raw = value === null ? null : JSON.stringify(value);
  if (raw === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, raw);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: raw }));
}

beforeEach(() => {
  window.localStorage.clear();
  resetCartStoreForTests();
});
afterEach(() => {
  window.localStorage.clear();
  resetCartStoreForTests();
});

describe('restoreCart', () => {
  it('puts the lines back, keeping lines added since and the larger quantity of a line in both', () => {
    writeCart(GUEST, { 14: 1, 45: 9 });
    expect(restoreCart(GUEST, { 14: 4, '1::red': 2, 45: 3 })).toEqual({ 14: 4, 45: 9, '1::red': 2 });
    expect(stored(cartKey(GUEST))).toEqual({ 14: 4, 45: 9, '1::red': 2 });
  });

  it('ignores an empty or damaged snapshot', () => {
    writeCart(GUEST, { 14: 1 });
    expect(restoreCart(GUEST, null)).toEqual({ 14: 1 });
    expect(restoreCart(GUEST, { abc: 'x', 0: 5 })).toEqual({ 14: 1 });
    expect(restoreCart(GUEST, [1, 2])).toEqual({ 14: 1 });
  });

  it('only touches the owner it is given', () => {
    writeCart(A, { 45: 1 });
    restoreCart(GUEST, { 14: 2 });
    expect(readCart(A)).toEqual({ 45: 1 });
    expect(readCart(GUEST)).toEqual({ 14: 2 });
  });
});

describe('useCart clearCart and restoreLines (AW-082)', () => {
  it('returns what a clear removed, and an undo brings it back', () => {
    const { result } = renderHook(() => useCart({ products: P, owner: A }));
    act(() => { result.current.addLines([{ productId: 14, qty: 40 }, { productId: 1, variant: 'Red', qty: 2 }]); });
    let snapshot;
    act(() => { snapshot = result.current.clearCart(); });
    expect(snapshot).toEqual({ 14: 40, '1::red': 2 });
    expect(result.current.count).toBe(0);
    expect(window.localStorage.getItem(cartKey(A))).toBeNull();
    act(() => { result.current.restoreLines(snapshot); });
    expect(result.current.count).toBe(42);
    expect(stored(cartKey(A))).toEqual({ 14: 40, '1::red': 2 });
  });

  it('merges with a line another tab added after the clear, without doubling one both have', () => {
    const { result } = renderHook(() => useCart({ products: P, owner: GUEST }));
    act(() => { result.current.addLines([{ productId: 14, qty: 5 }, { productId: 45, qty: 1 }]); });
    let snapshot;
    act(() => { snapshot = result.current.clearCart(); });
    // Another tab adds 2 Kite and 1 Cigarillos (Red) to the empty cart.
    act(() => otherTab(cartKey(GUEST), { 14: 2, '1::red': 1 }));
    expect(result.current.count).toBe(3);
    act(() => { result.current.restoreLines(snapshot); });
    expect(stored(cartKey(GUEST))).toEqual({ 14: 5, 45: 1, '1::red': 1 });
    expect(result.current.count).toBe(7);
  });

  it('returns an empty snapshot for an empty cart, and keeps its other actions', () => {
    const { result } = renderHook(() => useCart({ products: P, owner: GUEST }));
    let snapshot;
    act(() => { snapshot = result.current.clearCart(); });
    expect(snapshot).toEqual({});
    expect(Object.keys(result.current)).toEqual(expect.arrayContaining([
      'cart', 'count', 'items', 'total', 'legacy', 'addLine', 'addLines', 'decLine', 'setLine', 'chooseVariant',
      'removeLine', 'removeLines', 'clearCart', 'restoreLines', 'dismissLegacy', 'itemsFor',
    ]));
  });
});
