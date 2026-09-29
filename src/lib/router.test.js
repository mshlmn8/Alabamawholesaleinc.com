// Hash routes (AW-330). The path router (AW-043) replaces these.
import { describe, expect, it } from 'vitest';
import { parseHash, routeToHash } from './router.js';

describe('parseHash', () => {
  it('reads every route', () => {
    expect(parseHash('')).toEqual({ page: 'home' });
    expect(parseHash('#/')).toEqual({ page: 'home' });
    expect(parseHash('#/product/12')).toEqual({ page: 'product', productId: 12 });
    expect(parseHash('#/category/TOBACCO')).toEqual({ page: 'category', category: 'TOBACCO', sub: null });
    expect(parseHash('#/category/DRINKS%20%26%20BAGS/Energy%20Drinks')).toEqual({ page: 'category', category: 'DRINKS & BAGS', sub: 'Energy Drinks' });
    expect(parseHash('#/quote')).toEqual({ page: 'quote' });
    expect(parseHash('#/account')).toEqual({ page: 'account' });
    expect(parseHash('#/admin')).toEqual({ page: 'admin' });
    expect(parseHash('#/privacy')).toEqual({ page: 'privacy' });
    expect(parseHash('#/reset-password')).toEqual({ page: 'reset-password' });
  });

  it('sends unknown routes home', () => {
    expect(parseHash('#/nowhere')).toEqual({ page: 'home' });
    expect(parseHash('#/product')).toEqual({ page: 'home' });
  });
});

describe('routeToHash', () => {
  it('round-trips through parseHash', () => {
    const routes = [
      { page: 'home' },
      { page: 'product', productId: 162 },
      { page: 'category', category: 'DRINKS & BAGS', sub: null },
      { page: 'category', category: 'TOBACCO', sub: 'Cigars & Cigarillos' },
      { page: 'quote' },
      { page: 'account' },
      { page: 'admin' },
      { page: 'catalog' },
      { page: 'terms' },
    ];
    for (const route of routes) expect(parseHash(routeToHash(route))).toEqual(route);
  });

  it('writes the home route as #/', () => {
    expect(routeToHash({ page: 'home' })).toBe('#/');
    expect(routeToHash({ page: 'unknown' })).toBe('#/');
  });
});
