// Header search ranking (AW-330). Fixtures carry no prices.
import { describe, expect, it } from 'vitest';
import { getSearchMatches, productText } from './search.js';

const P = [
  { id: 1, name: 'Backwoods cigars', brand: 'Backwoods', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-BACKWOODS', variants: ['Honey berry'] },
  { id: 2, name: 'Honey sticks', brand: 'Farm', cat: 'CANDIES', sub: 'Candy', sku: 'AW-HONEY', variants: [] },
  { id: 3, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', variants: [] },
];

describe('productText', () => {
  it('joins the searchable fields in lower case', () => {
    expect(productText(P[0])).toBe('backwoods cigars backwoods tobacco cigars aw-backwoods honey berry');
  });
});

describe('getSearchMatches', () => {
  it('needs at least two characters', () => {
    expect(getSearchMatches(P, 'k')).toEqual([]);
    expect(getSearchMatches(P, '  ')).toEqual([]);
  });

  it('ranks name matches above variant matches', () => {
    expect(getSearchMatches(P, 'honey').map(p => p.id)).toEqual([2, 1]);
  });

  it('matches every term anywhere in the product text', () => {
    expect(getSearchMatches(P, 'tobacco kite').map(p => p.id)).toEqual([3, 1]);
  });

  it('respects the limit', () => {
    expect(getSearchMatches(P, 'aw-', 2)).toHaveLength(2);
  });
});
