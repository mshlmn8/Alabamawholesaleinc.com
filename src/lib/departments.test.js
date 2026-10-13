// Department list derived from the catalog (AW-330), and each department's
// biggest product lines (AW-061).
import { describe, expect, it } from 'vitest';
import { NAV_ORDER, PRODUCTS } from '../data/products.js';
import { departmentsFor, topLines } from './departments.js';

describe('departmentsFor', () => {
  it('lists the navigation order first, then new departments, with sorted lines and counts', () => {
    const products = [
      { id: 1, cat: 'TOBACCO', sub: 'Wraps' },
      { id: 2, cat: 'TOBACCO', sub: 'Cigars' },
      { id: 3, cat: 'TOBACCO', sub: 'Cigars' },
      { id: 4, cat: 'SEASONAL', sub: '' },
    ];
    const depts = departmentsFor(products);
    expect(depts.map(d => d.key)).toEqual([...NAV_ORDER, 'SEASONAL']);
    expect(depts[0]).toEqual({ key: 'TOBACCO', label: 'Tobacco', subs: ['Cigars', 'Wraps'], count: 3 });
    expect(depts.at(-1)).toEqual({ key: 'SEASONAL', label: 'SEASONAL', subs: [], count: 1 });
  });
});

describe('topLines', () => {
  const products = [
    { id: 1, cat: 'CANDIES', sub: 'Jars' },
    { id: 2, cat: 'CANDIES', sub: 'Bags' },
    { id: 3, cat: 'CANDIES', sub: 'Sweets' },
    { id: 4, cat: 'CANDIES', sub: 'Sweets' },
    { id: 5, cat: 'CANDIES', sub: 'Sweets' },
    { id: 6, cat: 'CANDIES', sub: 'Chocolate' },
    { id: 7, cat: 'CANDIES', sub: 'Chocolate' },
    { id: 8, cat: 'CANDIES', sub: '' },
    { id: 9, cat: 'GROCERY', sub: 'Sweets' },
    { id: 10, cat: 'GROCERY', sub: 'Sweets' },
  ];

  it('lists the lines with the most products first, ties in name order', () => {
    expect(topLines(products, 'CANDIES')).toEqual(['Sweets', 'Chocolate', 'Bags']);
    expect(topLines(products, 'CANDIES', 5)).toEqual(['Sweets', 'Chocolate', 'Bags', 'Jars']);
    expect(topLines(products, 'CANDIES', 1)).toEqual(['Sweets']);
  });

  it('counts only the department\'s own products, and none without a line', () => {
    expect(topLines(products, 'GROCERY')).toEqual(['Sweets']);
    expect(topLines(products, 'MOTOR OIL')).toEqual([]);
    expect(topLines([], 'CANDIES')).toEqual([]);
  });

  it('leaves departmentsFor\'s alphabetical lines alone', () => {
    const [candies] = departmentsFor(products).filter((d) => d.key === 'CANDIES');
    expect(candies.subs).toEqual(['Bags', 'Chocolate', 'Jars', 'Sweets']);
  });

  it('puts the catalog\'s biggest lines first, not the alphabetical ones', () => {
    // Merchandise used to lead with 'Adult Wellness', Candies with 'Bags'.
    expect(topLines(PRODUCTS, 'MERCHANDISE')[0]).toBe('OTC & Health');
    expect(topLines(PRODUCTS, 'CANDIES')).toEqual(['Sweets & Gummies', 'Chocolate Bars', 'Bags']);
  });
});
