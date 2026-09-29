// Department list derived from the catalog (AW-330).
import { describe, expect, it } from 'vitest';
import { NAV_ORDER } from '../data/products.js';
import { departmentsFor } from './departments.js';

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
