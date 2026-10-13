// Tab titles that match the page (AW-131, AW-132, AW-024): checkout is
// titled like its heading for everyone, since customers place orders, not
// quotes; the account and apply pages in sentence case with the one apply
// label.
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from './departments.js';
import { pageMeta } from './meta.js';

const departments = departmentsFor(PRODUCTS);
const title = (route) => pageMeta(route, PRODUCTS, departments).title;

describe('page titles and the basket (AW-132, AW-024)', () => {
  it('titles /checkout like its heading, whoever is signed in', () => {
    expect(title({ page: 'checkout' })).toBe('Checkout · Alabama Wholesale Inc');
  });

  it('names a receipt over anything else', () => {
    expect(title({ page: 'checkout', received: 'order' })).toBe('Order received · Alabama Wholesale Inc');
  });
});

describe('page titles in sentence case (AW-131)', () => {
  it('titles the account and apply pages like their headings', () => {
    expect(title({ page: 'account' })).toBe('My account · Alabama Wholesale Inc');
    expect(title({ page: 'apply' })).toBe('Apply for a trade account · Alabama Wholesale Inc');
  });
});
