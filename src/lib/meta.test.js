// Page titles and descriptions (AW-330).
import { describe, expect, it } from 'vitest';
import { applyPageMeta, clip, HOME_DESCRIPTION, pageMeta } from './meta.js';

const products = [{ id: 7, name: 'Kite', brand: 'Kite', sub: 'Cigarettes', sku: 'AW-KITE', description: '' }];
const departments = [{ key: 'TOBACCO', subs: ['Cigarettes', 'Cigars', 'Hookah', 'Wraps', 'Zyn'], count: 68 }];

describe('clip', () => {
  it('keeps short text and cuts long text at a word', () => {
    expect(clip('  short   text ')).toBe('short text');
    expect(clip('one two three four', 10)).toBe('one two…');
  });
});

describe('pageMeta', () => {
  it('titles the home, category, product, search and support pages', () => {
    expect(pageMeta({ page: 'home' }, products, departments, '')).toEqual({ title: 'Alabama Wholesale Inc · Wholesale Distributor — Birmingham, AL', description: HOME_DESCRIPTION });
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: 'Cigars' }, products, departments, '').title).toBe('Cigars · Tobacco · Wholesale Catalog · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: null }, products, departments, '').description).toContain('68 SKUs across Cigarettes, Cigars, Hookah, Wraps and more');
    expect(pageMeta({ page: 'category', category: 'NOPE' }, products, departments, '').title).toBe('Department not found · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'product', productId: 7 }, products, departments, '').title).toBe('Kite · Kite · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'product', productId: 8 }, products, departments, '').title).toBe('Product not found · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'privacy' }, products, departments, '').title).toBe('Privacy · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'quote' }, products, departments, 'kite').title).toBe('Search “kite” · Alabama Wholesale Inc');
  });
});

describe('applyPageMeta', () => {
  it('writes the title, description and Open Graph pair', () => {
    applyPageMeta({ title: 'T', description: 'D' });
    expect(document.title).toBe('T');
    expect(document.head.querySelector('meta[name="description"]').getAttribute('content')).toBe('D');
    expect(document.head.querySelector('meta[property="og:title"]').getAttribute('content')).toBe('T');
    expect(document.head.querySelector('meta[property="og:description"]').getAttribute('content')).toBe('D');
  });
});
