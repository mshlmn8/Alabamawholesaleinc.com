// Tab titles that match the page (AW-131, AW-132): /quote is titled like its
// heading once App knows the account (route.basket), the account and apply
// pages in sentence case with the one apply label.
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from './departments.js';
import { pageMeta } from './meta.js';

const departments = departmentsFor(PRODUCTS);
const title = (route) => pageMeta(route, PRODUCTS, departments).title;

describe('page titles and the basket (AW-132)', () => {
  it('titles /quote like its heading for a quote or an order', () => {
    expect(title({ page: 'quote', basket: 'quote' })).toBe('Request a quote · Alabama Wholesale Inc');
    expect(title({ page: 'quote', basket: 'order' })).toBe('Place your order · Alabama Wholesale Inc');
  });

  it('says Checkout while the account is unknown, and names a receipt over anything else', () => {
    expect(title({ page: 'quote' })).toBe('Checkout · Alabama Wholesale Inc');
    expect(title({ page: 'quote', basket: 'order', received: 'order' })).toBe('Order received · Alabama Wholesale Inc');
    expect(title({ page: 'quote', basket: 'quote', received: 'quote' })).toBe('Quote received · Alabama Wholesale Inc');
  });
});

describe('page titles in sentence case (AW-131)', () => {
  it('titles the account and apply pages like their headings', () => {
    expect(title({ page: 'account' })).toBe('My account · Alabama Wholesale Inc');
    expect(title({ page: 'apply' })).toBe('Apply for a trade account · Alabama Wholesale Inc');
  });
});
