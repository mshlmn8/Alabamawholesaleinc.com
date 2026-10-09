// Cart helpers (AW-330). Fixtures and prices are test values. Products carry
// no prices (AW-003): a line's price comes from priceOf(productId, variant).
import { describe, expect, it } from 'vitest';
import {
  NO_PRICES, addableLineKey, cartChanges, cartCount, cartTotal, decrementLine, deleteLine, describeCartChanges, incrementLine, mergeLines,
  moveLineToVariant, priceCartItems, setLineQuantity,
} from './cart.js';

const P = [
  { id: 1, sku: 'AW-SS', name: 'Cigarillos', variants: ['Diamond', 'Red'] },
  { id: 14, sku: 'AW-KITE', name: 'Kite', variants: [] },
  { id: 20, sku: 'AW-ONE', name: 'One', variants: ['Only'] },
  { id: 40, sku: 'AW-OFF', name: 'Off', variants: [], active: false },
];
// An approved buyer's unit prices, by product (and variant).
const UNIT = { 1: 10, 14: 20, 20: 5, 40: 1 };
const priceOf = (table) => (id, variant) => (variant && table[`${id}::${variant}`] != null ? table[`${id}::${variant}`] : table[id] ?? null);
const APPROVED = priceOf(UNIT);

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

  it('refuses a variant the product doesn’t have (AW-011)', () => {
    expect(addableLineKey(P, 1, 'Purple')).toBeNull();
    expect(addableLineKey(P, 14, 'Red')).toBeNull();
    expect(addableLineKey(P, 1, 'red')).toBe('1::red');
  });

  it('refuses a variant marked not available (AW-030)', () => {
    const products = [{ ...P[0], unavailableVariants: ['Red'] }, { ...P[2], unavailableVariants: ['Only'] }];
    expect(addableLineKey(products, 1, 'Red')).toBeNull();
    expect(addableLineKey(products, 1, 'Diamond')).toBe('1::diamond');
    expect(addableLineKey(products, 20, 'Only')).toBeNull();
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
      // Not a whole number: skipped, not rounded down (AW-100).
      { productId: 1, variant: 'Red', qty: 1.7 },
      { productId: 1, variant: 'Diamond', qty: '4' },
      { productId: 40, qty: 1 },
      { productId: 99, qty: 1 },
      { productId: 20, variant: 'Only', qty: 0 },
    ]);
    expect(next).toEqual({ 14: 3, 1: 3, '1::diamond': 4 });
  });

  it('never goes past 100,000 a line when adding or merging (AW-013)', () => {
    expect(incrementLine({ 14: 99999 }, '14', 5)).toEqual({ 14: 100000 });
    expect(incrementLine({}, '14', 1e9)).toEqual({ 14: 100000 });
    expect(mergeLines({ 14: 99990 }, P, [{ productId: 14, qty: 20 }, { productId: 20, variant: 'Only', qty: 150000 }]))
      .toEqual({ 14: 100000, '20::only': 100000 });
  });

  it('takes n off a line, 1 by default, and removes it at 0', () => {
    expect(decrementLine({ 14: 12 }, '14', 5)).toEqual({ 14: 7 });
    expect(decrementLine({ 14: 12 }, '14', 12)).toEqual({});
    expect(decrementLine({ 14: 12 }, '14', 40)).toEqual({});
    const cart = { 14: 3 };
    expect(decrementLine(cart, '14', 0)).toBe(cart);
    expect(decrementLine(cart, '14', NaN)).toBe(cart);
  });

  it('sets a typed quantity, clamped, and never removes or adds a line', () => {
    const cart = { 14: 3, '1::red': 2 };
    expect(setLineQuantity(cart, '14', 48)).toEqual({ 14: 48, '1::red': 2 });
    expect(setLineQuantity(cart, '14', 150000)).toEqual({ 14: 100000, '1::red': 2 });
    expect(setLineQuantity(cart, '14', 2.9)).toEqual({ 14: 2, '1::red': 2 });
    for (const n of [0, -4, NaN, '']) expect(setLineQuantity(cart, '14', n)).toBe(cart);
    // A line removed meanwhile (another tab) does not come back.
    expect(setLineQuantity(cart, '20::only', 5)).toBe(cart);
    expect(setLineQuantity(cart, '14', 3)).toBe(cart);
    expect(cart).toEqual({ 14: 3, '1::red': 2 });
  });

  it('moves a bare line onto a variant, adding to that variant’s line up to the limit (AW-011)', () => {
    expect(moveLineToVariant({ 1: 12, 14: 2 }, '1', '1::red')).toEqual({ 14: 2, '1::red': 12 });
    expect(moveLineToVariant({ 1: 12, '1::red': 3 }, '1', '1::red')).toEqual({ '1::red': 15 });
    expect(moveLineToVariant({ 1: 60000, '1::red': 60000 }, '1', '1::red')).toEqual({ '1::red': 100000 });
    const cart = { 14: 2 };
    expect(moveLineToVariant(cart, '1', '1::red')).toBe(cart);
    expect(moveLineToVariant({ '1::red': 2 }, '1::red', '1::red')).toEqual({ '1::red': 2 });
  });

  it('counts units', () => {
    expect(cartCount({ 14: 2, '1::red': '3' })).toBe(5);
    expect(cartCount({})).toBe(0);
  });
});

describe('priceCartItems and cartTotal', () => {
  it('prices lines through priceOf, and not at all without it', () => {
    const cart = { 14: 2, '1::red': 1, 1: 1 };
    const guest = priceCartItems(cart, P, NO_PRICES);
    expect(guest.every(i => i.price === null)).toBe(true);
    expect(priceCartItems(cart, P).every(i => i.price === null)).toBe(true);
    expect(cartTotal(guest)).toBe(0);
    const approved = priceCartItems(cart, P, APPROVED);
    expect(approved.map(i => [i.lineKey, i.price])).toEqual([['1', 10], ['14', 20], ['1::red', 10]]);
    expect(cartTotal(approved)).toBe(60);
  });

  it('asks priceOf with the line’s variant, so a variant’s own price is used', () => {
    const cart = { '1::red': 2, '1::diamond': 1 };
    const items = priceCartItems(cart, P, priceOf({ ...UNIT, '1::Red': 12.5 }));
    expect(items.map(i => [i.lineKey, i.price])).toEqual([['1::red', 12.5], ['1::diamond', 10]]);
  });

  it('leaves a product without a price unpriced, and never prices a line that can’t be ordered', () => {
    const cart = { 14: 2, 40: 1, 20: 1 };
    const items = priceCartItems(cart, P, priceOf({ 14: 20, 40: 1, 20: null }));
    expect(items.map(i => [i.lineKey, i.price, i.unavailable])).toEqual([['14', 20, null], ['20::only', null, null], ['40', null, 'product']]);
    expect(cartTotal(items)).toBe(40);
  });

  it('adds up in cents, so the total is the saved subtotal (AW-077)', () => {
    const items = priceCartItems({ 14: 7, 20: 3 }, P, priceOf({ 14: 42.85, 20: 0.1 }));
    expect(cartTotal(items)).toBe(300.25);
    const small = priceCartItems({ 14: 1, 20: 1 }, P, priceOf({ 14: 0.1, 20: 0.2 }));
    expect(cartTotal(small)).toBe(0.3);
    // Adding the same lines in floats is off by a hair.
    expect(small.reduce((s, i) => s + i.qty * i.price, 0)).not.toBe(0.3);
  });
});

// Checkout loads the catalog and prices again before a submit (AW-191).
describe('cartChanges and describeCartChanges', () => {
  const cart = { 14: 2, '1::red': 1, '20::only': 3 };

  it('finds nothing when the catalog is the same', () => {
    const items = priceCartItems(cart, P, APPROVED);
    expect(cartChanges(items, priceCartItems(cart, P, APPROVED))).toEqual([]);
  });

  it('names lines that can no longer be ordered, and new prices', () => {
    const before = priceCartItems(cart, P, APPROVED);
    const next = P
      .filter(p => p.id !== 14)
      .map(p => (p.id === 1 ? { ...p, variants: ['Diamond', 'Crimson'] } : p));
    const after = priceCartItems(cart, next, priceOf({ ...UNIT, 20: 6 }), { known: P });
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
    expect(cartChanges(priceCartItems(cart, P, NO_PRICES), priceCartItems(cart, P, NO_PRICES))).toEqual([]);
  });

  it('compares prices to the cent', () => {
    const before = priceCartItems(cart, P, priceOf({ ...UNIT, 20: 0.3 }));
    expect(cartChanges(before, priceCartItems(cart, P, priceOf({ ...UNIT, 20: 0.1 + 0.2 })))).toEqual([]);
    expect(cartChanges(before, priceCartItems(cart, P, priceOf({ ...UNIT, 20: 0.31 }))).map(c => c.kind)).toEqual(['price']);
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
    expect(describeCartChanges(changes)).toBe('The catalog and your quote changed since this page opened, so nothing was sent. '
      + 'Cigarillos now comes in several variants — choose one. Check your items, then submit again.');
    expect(describeCartChanges([{ kind: 'removed', name: 'Kite', lineKey: '14' }]))
      .toBe('Your quote changed since this page opened, so nothing was sent. Check your items, then submit again.');
  });

  it('names at most three lines', () => {
    const changes = [1, 2, 3, 4, 5].map(n => ({ kind: 'unavailable', reason: 'product', name: `P${n}`, lineKey: String(n) }));
    expect(describeCartChanges(changes)).toMatch(/P3 is no longer available — remove it to continue\. 2 more items changed too\. Check/);
  });
});
