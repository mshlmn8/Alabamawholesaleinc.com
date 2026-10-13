// A department page's headings go down one level at a time in both layouts
// (AW-313): h1 the department, h2 Products (hidden), then the cards' h3
// names. On desktop the Filters h2 comes first; the compact layout has none.
// Kept apart from CategoryPage.test.jsx, which other work edits.
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../lib/router.js';
import { MOBILE_QUERY } from '../lib/useMediaQuery.js';
import { CategoryPage } from './CategoryPage.jsx';

const products = [
  { id: 1, name: 'Kite tobacco', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', variants: [], tag: 'NEW' },
  { id: 2, name: 'Swisher Sweets', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SS', variants: ['Grape', 'Diamond'], tag: null },
];
const departments = [{ key: 'TOBACCO', label: 'Tobacco', subs: ['Cigarettes', 'Cigars'], count: 2 }];

const renderPage = (query) => render(
  <CategoryPage category="TOBACCO" query={query} products={products} departments={departments} profile={null} isApprovedBuyer={false}
                cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />,
);
const outline = () => [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => `${h.tagName} ${h.textContent}`);
const compact = (on) => {
  window.matchMedia = (query) => ({ matches: on && query === MOBILE_QUERY, media: query, addEventListener() {}, removeEventListener() {} });
};

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/category/tobacco', { replace: true }));
});
afterEach(() => {
  delete window.matchMedia;
  vi.restoreAllMocks();
});

describe('CategoryPage heading levels (AW-313)', () => {
  it('puts the card names under a hidden Products h2 on desktop, after Filters', () => {
    compact(false);
    renderPage();
    expect(outline()).toEqual(['H1 Tobacco', 'H2 Filters', 'H2 Products', 'H3 Kite tobacco', 'H3 Swisher Sweets']);
    expect(document.querySelector('h2.sr-only').textContent).toBe('Products');
  });

  it('puts the card names under the same h2 in the compact layout, which has no Filters heading', () => {
    compact(true);
    renderPage();
    expect(outline()).toEqual(['H1 Tobacco', 'H2 Products', 'H3 Kite tobacco', 'H3 Swisher Sweets']);
  });

  it('keeps the Products h2 first in the results when nothing matches', () => {
    compact(true);
    renderPage({ q: 'zz', sort: 'featured', tags: [], variants: false });
    expect(outline()).toEqual(['H1 Tobacco', 'H2 Products', 'H2 No products match']);
  });
});
