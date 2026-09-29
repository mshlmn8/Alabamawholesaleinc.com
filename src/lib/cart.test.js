// Cart helpers (AW-330). Fixtures and list prices are test values.
import { describe, expect, it } from 'vitest';
import {
  addableLineKey, cartChanges, cartCount, cartTotal, decrementLine, deleteLine, describeCartChanges, incrementLine, mergeLines,
  priceCartItems,
} from './cart.js';

const P = [
  { id: 1, sku: 'AW-SS', name: 'Cigarillos', variants: ['Diamond', 'Red'], price: 10 },
  { id: 14, sku: 'AW-KITE', name: 'Kite', variants: [], price: 20 },
  { id: 20, sku: 'AW-ONE', name: 'One', variants: ['Only'], price: 5 },
  { id: 40, sku: 'AW-OFF', name: 'Off', variants: [], active: false, price: 1 },
];

describe('addableLineKey', () => {
  it('keys a line by product and variant', () => {
    expect(addableLineKey(P, 14, null)).toBe('14');
    expect(addableLineKey(P, '1', 'Red')).toBe('1::red');
    expect(addableLineKey(P, 20, 'Only')).toBe('20::only');
  });

  it('refuses unknown, inactive and unchosen multi-variant products', () => {
    expect(addableLineKey(P, 99, null)).toBeNull();
    expect(addableLineKey(P, 40, null)).toBeNull();
    expect(addableLineKey(P, 1, null)).toBeNull();
  });
});

describe('line updates', () => {
  it('increments, decrements and deletes without touching the input', () => {
    const cart = { 14: 1 };
    expect(incrementLine(cart, '14', 3)).toEqual({ 14: 4 });
    expect(incrementLine(cart, '1::red')).toEqual({ 14: 1, '1::red': 1 });
    expect(decrementLine({ 14: 2 }, '14')).toEqual({ 14: 1 });
    expect(decrementLine({ 14: 1 }, '14')).toEqual({});
    expect(deleteLine({ 14: 5, '1::red': 1 }, '14')).toEqual({ '1::red': 1 });
    expect(cart).toEqual({ 14: 1 });
  });

  it('merges reorder lines, keeping a multi-variant product without a variant as a bare line', () => {
    const next = mergeLines({ 14: 1 }, P, [
      { productId: 14, qty: 2 },
      { productId: 1, variant: null, qty: 3 },
      { productId: 1, variant: 'Red', qty: 1.7 },
      { productId: 40, qty: 1 },
      { productId: 99, qty: 1 },
      { productId: 20, variant: 'Only', qty: 0 },
    ]);
    expect(next).toEqual({ 14: 3, 1: 3, '1::red': 1 });
  });

  it('counts units', () => {
    expect(cartCount({ 14: 2, '1::red': '3' })).toBe(5);
    expect(cartCount({})).toBe(0);
  });
});

describe('priceCartItems and cartTotal', () => {
  it('prices lines for approved accounts only', () => {
    const cart = { 14: 2, '1::red': 1, 1: 1 };
    const guest = priceCartItems(cart, P, null);
    expect(guest.every(i => i.price === null)).toBe(true);
    expect(cartTotal(guest)).toBe(0);
    const approved = priceCartItems(cart, P, { status: 'approved', pricing_tier: 'standard' });
    expect(approved.map(i => [i.lineKey, i.price])).toEqual([['1', 10], ['14', 20], ['1::red', 10]]);
    expect(cartTotal(approved)).toBe(60);
  });
});

// Checkout loads the catalog again before a submit (AW-191).
describe('cartChanges and describeCartChanges', () => {
  const APPROVED = { status: 'approved', pricing_tier: 'standard' };
  const cart = { 14: 2, '1::red': 1, '20::only': 3 };

  it('finds nothing when the catalog is the same', () => {
    const items = priceCartItems(cart, P, APPROVED);
    expect(cartChanges(items, priceCartItems(cart, P, APPROVED))).toEqual([]);
  });

  it('names lines that can no longer be ordered, and new prices', () => {
    const before = priceCartItems(cart, P, APPROVED);
    const next = P
      .filter(p => p.id !== 14)
      .map(p => (p.id === 1 ? { ...p, variants: ['Diamond', 'Crimson'] } : p.id === 20 ? { ...p, price: 6 } : p));
    const after = priceCartItems(cart, next, APPROVED, { known: P });
    const changes = cartChanges(before, after);
    expect(changes).toEqual([
      { kind: 'unavailable', reason: 'product', name: 'Kite', lineKey: '14' },
      { kind: 'unavailable', reason: 'variant', name: 'Cigarillos — Red', lineKey: '1::red' },
      { kind: 'price', from: 5, to: 6, name: 'One — Only', lineKey: '20::only' },
    ]);
    expect(describeCartChanges(changes)).toBe('The catalog changed since this page opened, so nothing was sent. '
      + 'Kite is no longer available — remove it to continue. '
      + 'Cigarillos — Red is no longer available — remove it or choose another variant. '
      + 'One — Only is now $6.00 each (was $5.00). '
      + 'Check your items, then submit again.');
  });

  it('ignores prices for accounts that don’t see them', () => {
    const next = P.map(p => ({ ...p, price: p.price + 1 }));
    expect(cartChanges(priceCartItems(cart, P, null), priceCartItems(cart, next, null))).toEqual([]);
  });

  it('matches a line whose key changed by product, and reports cart changes from another tab', () => {
    const before = [
      { lineKey: '20', productId: 20, name: 'One', qty: 3, price: null, unavailable: null },
      { lineKey: '14', productId: 14, name: 'Kite', qty: 2, price: null, unavailable: null },
      { lineKey: '1::red', productId: 1, name: 'Cigarillos — Red', qty: 1, price: null, unavailable: null },
    ];
    const after = [
      { lineKey: '20::only', productId: 20, name: 'One — Only', qty: 3, price: null, unavailable: null },
      { lineKey: '14', productId: 14, name: 'Kite', qty: 5, price: null, unavailable: null },
      { lineKey: '1', productId: 1, name: 'Cigarillos', qty: 1, price: null, unavailable: null, needsVariant: true },
      { lineKey: '99', productId: 99, name: 'New', qty: 1, price: null, unavailable: null },
    ];
    const changes = cartChanges(before, after);
    expect(changes.map(c => [c.kind, c.lineKey])).toEqual([['qty', '14'], ['variant', '1'], ['added', '99']]);
    expect(describeCartChanges(changes)).toBe('The catalog and your cart changed since this page opened, so nothing was sent. '
      + 'Cigarillos now comes in several variants — choose one. Check your items, then submit again.');
    expect(describeCartChanges([{ kind: 'removed', name: 'Kite', lineKey: '14' }]))
      .toBe('Your cart changed since this page opened, so nothing was sent. Check your items, then submit again.');
  });

  it('names at most three lines', () => {
    const changes = [1, 2, 3, 4, 5].map(n => ({ kind: 'unavailable', reason: 'product', name: `P${n}`, lineKey: String(n) }));
    expect(describeCartChanges(changes)).toMatch(/P3 is no longer available — remove it to continue\. 2 more items changed too\. Check/);
  });
});
