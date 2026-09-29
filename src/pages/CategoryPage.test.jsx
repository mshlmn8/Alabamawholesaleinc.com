// Department page filters live in the URL (AW-008, AW-327, AW-228).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate, resolveRoute, useRoute } from '../lib/router.js';
import { CategoryPage } from './CategoryPage.jsx';

const products = [
  { id: 1, name: 'Kite tobacco', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', flavors: 0, variants: [], tag: 'NEW', price: 10 },
  { id: 2, name: 'Swisher Sweets', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SS', flavors: 2, variants: ['Grape', 'Diamond'], tag: 'BESTSELLER', price: 20 },
  { id: 3, name: 'Backwoods', brand: 'Backwoods', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-BW', flavors: 0, variants: [], tag: null, price: 30 },
  { id: 4, name: 'Snickers', brand: 'Snickers', cat: 'CANDIES', sub: 'Chocolate', sku: 'AW-SN', flavors: 0, variants: [], tag: 'NEW', price: 5 },
];
const departments = [
  { key: 'TOBACCO', label: 'Tobacco', subs: ['Cigarettes', 'Cigars'], count: 3 },
  { key: 'CANDIES', label: 'Candies', subs: ['Chocolate'], count: 1 },
];

// App's wiring: the URL resolved against the catalog, the page keyed by department.
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
const note = () => screen.getByRole('status').textContent;

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/category/tobacco', { replace: true }));
});
afterEach(() => vi.restoreAllMocks());

describe('CategoryPage', () => {
  it('reads the product line, search, sort and filters from the URL', () => {
    act(() => navigate('/category/tobacco/cigars?sort=name-asc&tags=bestseller', { replace: true }));
    render(<Harness />);
    expect(note()).toBe('Showing 1 of 2 items in Cigars');
    expect(screen.getByRole('checkbox', { name: 'Bestsellers' }).checked).toBe(true);
    expect(screen.getByLabelText('Sort by').value).toBe('name-asc');
    expect(screen.getByRole('link', { name: 'Cigars (2)' }).getAttribute('aria-current')).toBe('page');
  });

  it('writes filter changes to the URL without adding history entries', () => {
    render(<Harness />);
    const length = window.history.length;
    fireEvent.click(screen.getByRole('checkbox', { name: 'New' }));
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'variants' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Has flavors or variants' }));
    expect(url()).toBe('/category/tobacco?sort=variants&tags=new&variants=1');
    expect(window.history.length).toBe(length);
    expect(note()).toBe('Showing 0 of 3 items');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all (2)' }));
    expect(url()).toBe('/category/tobacco?sort=variants');
    expect(window.history.length).toBe(length);
  });

  it('updates the URL from the search box after a pause', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const box = screen.getByRole('searchbox', { name: 'Search in Tobacco' });
    fireEvent.change(box, { target: { value: 'kite ' } });
    expect(url()).toBe('/category/tobacco');
    act(() => vi.advanceTimersByTime(300));
    expect(url()).toBe('/category/tobacco?q=kite');
    expect(box.value).toBe('kite ');
    expect(note()).toBe('Showing 1 of 3 items');
    vi.useRealTimers();
  });

  it('follows Back/Forward: the page shows whatever the URL says', () => {
    render(<Harness />);
    act(() => {
      window.history.replaceState(window.history.state, '', '/category/tobacco?q=swisher');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('searchbox', { name: 'Search in Tobacco' }).value).toBe('swisher');
    expect(note()).toBe('Showing 1 of 3 items');
  });

  it('starts another department without the old filters (AW-228)', () => {
    act(() => navigate('/category/tobacco?tags=new', { replace: true }));
    render(<Harness />);
    expect(note()).toBe('Showing 1 of 3 items');
    act(() => navigate('/category/candies'));
    expect(note()).toBe('Showing 1 of 1 item');
    expect(screen.getByRole('checkbox', { name: 'New' }).checked).toBe(false);
  });
});
