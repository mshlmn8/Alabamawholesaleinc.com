// A department page with no matches (AW-299): the shared empty state, with
// Clear filters, a search of every department for the same words, and the
// other departments. Kept apart from CategoryPage.test.jsx, which other work
// edits.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate, resolveRoute, useRoute } from '../lib/router.js';
import { CategoryPage } from './CategoryPage.jsx';

const products = [
  { id: 1, name: 'Kite tobacco', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', variants: [], tag: 'NEW' },
  { id: 2, name: 'Swisher Sweets', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SS', variants: ['Grape', 'Diamond'], tag: null },
  { id: 4, name: 'Snickers', brand: 'Snickers', cat: 'CANDIES', sub: 'Chocolate', sku: 'AW-SN', variants: [], tag: 'NEW' },
  { id: 5, name: 'Argo corn starch', brand: 'Argo', cat: 'FOOD STUFF', sub: 'Baking', sku: 'AW-ARGO', variants: [], tag: null },
];
const departments = [
  { key: 'TOBACCO', label: 'Tobacco', subs: ['Cigarettes', 'Cigars'], count: 2 },
  { key: 'CANDIES', label: 'Candies', subs: ['Chocolate'], count: 1 },
  { key: 'FOOD STUFF', label: 'Food Stuff', subs: ['Baking'], count: 1 },
  // A department the live catalog has no products in yet: not offered.
  { key: 'MOTOR OIL', label: 'Motor Oil', subs: [], count: 0 },
];

function Harness() {
  const { raw } = useRoute();
  const route = resolveRoute(raw, { departments, products });
  if (route.page !== 'category') return <p>{route.page}</p>;
  return (
    <CategoryPage key={route.category} category={route.category} sub={route.sub} query={route.query}
                  products={products} departments={departments} profile={null} isApprovedBuyer={false}
                  cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />
  );
}
const url = () => window.location.pathname + window.location.search;
const box = () => document.querySelector('.empty-state');

beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('CategoryPage with no matches (AW-299)', () => {
  it('offers a search of every department for the same words, Clear filters and the other departments', () => {
    act(() => navigate('/category/tobacco?q=  zz top  ', { replace: true }));
    render(<Harness />);
    expect(box().className).toBe('empty-state is-boxed');
    expect(screen.getByRole('heading', { level: 2, name: 'No products match' })).toBeTruthy();
    expect(box().querySelector('.empty-state-text').textContent).toBe('Try another search, clear the filters or browse another department.');

    const search = screen.getByRole('link', { name: 'Search all departments for “zz top”' });
    expect(search.getAttribute('href')).toBe('/search?q=zz+top');
    expect(search.className).toBe('button');
    expect(screen.getByRole('button', { name: 'Clear filters' }).className).toBe('button ghost');

    // The other departments that have products, as pills; not this one.
    const list = screen.getByRole('list', { name: 'Other departments' });
    expect(list.className).toBe('sub-pills');
    expect([...list.querySelectorAll('a.sub-pill')].map((a) => [a.textContent, a.getAttribute('href')]))
      .toEqual([['Candies (1)', '/category/candies'], ['Food Stuff (1)', '/category/food-stuff']]);
    // In the order the actions read: search, clear, then the departments.
    const actions = box().querySelector('.empty-state-actions');
    expect([...actions.children].map((el) => el.tagName)).toEqual(['A', 'BUTTON', 'UL']);
  });

  it('follows the search link to the search page, which keeps the words', () => {
    act(() => navigate('/category/tobacco?q=snickers', { replace: true }));
    render(<Harness />);
    fireEvent.click(screen.getByRole('link', { name: 'Search all departments for “snickers”' }));
    expect(url()).toBe('/search?q=snickers');
  });

  // NEW-051: a line page whose search finds nothing in the line, but some
  // in the rest of the department.
  it('on a product line, first offers the department’s matches, keeping the search and filters', () => {
    act(() => navigate('/category/tobacco/cigarettes?q=swisher', { replace: true }));
    render(<Harness />);
    expect(screen.getByRole('searchbox', { name: 'Search in Cigarettes' }).value).toBe('swisher');
    expect(screen.getByRole('heading', { level: 2, name: 'No products match' })).toBeTruthy();
    const actions = box().querySelector('.empty-state-actions');
    const dept = screen.getByRole('link', { name: 'See 1 in all of Tobacco' });
    expect(actions.firstElementChild).toBe(dept);
    expect(dept.className).toBe('button');
    expect(dept.getAttribute('href')).toBe('/category/tobacco?q=swisher');
    // One main action: the other two are ghost buttons now.
    expect(screen.getByRole('link', { name: 'Search all departments for “swisher”' }).className).toBe('button ghost');
    expect(screen.getByRole('button', { name: 'Clear filters' }).className).toBe('button ghost');
    // It keeps the search, and focus lands on the result note, not <body>.
    act(() => dept.focus());
    fireEvent.click(dept);
    expect(url()).toBe('/category/tobacco?q=swisher');
    expect(box()).toBeNull();
    expect(document.activeElement).toBe(document.querySelector('.result-note'));
    expect(document.querySelector('.result-note').textContent).toBe('Showing 1 of 2 items');
  });

  it('offers no department link where the department has no matches either', () => {
    act(() => navigate('/category/tobacco/cigarettes?q=snickers', { replace: true }));
    render(<Harness />);
    expect(screen.queryByRole('link', { name: /in all of/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Search all departments for “snickers”' }).className).toBe('button');
  });

  it('offers no search link when only filters (no words) leave nothing to show', () => {
    act(() => navigate('/category/tobacco/cigars?tags=new', { replace: true }));
    render(<Harness />);
    expect(screen.getByRole('heading', { level: 2, name: 'No products match' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Search all departments/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(url()).toBe('/category/tobacco');
    expect(box()).toBeNull();
  });
});
