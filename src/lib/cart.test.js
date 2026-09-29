// Cart helpers (AW-330). Fixtures and list prices are test values.
import { describe, expect, it } from 'vitest';
import { addableLineKey, cartCount, cartTotal, decrementLine, deleteLine, incrementLine, mergeLines, priceCartItems } from './cart.js';

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
