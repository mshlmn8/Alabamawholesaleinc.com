// Department page filters live in the URL (AW-008, AW-327, AW-228). Products
// carry no prices (AW-003); price sorts use the buyer's prices (test values).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate, resolveRoute, useRoute } from '../lib/router.js';
import { CategoryPage } from './CategoryPage.jsx';

const products = [
  { id: 1, name: 'Kite tobacco', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', variants: [], tag: 'NEW' },
  { id: 2, name: 'Swisher Sweets', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SS', variants: ['Grape', 'Diamond'], tag: 'BESTSELLER' },
  { id: 3, name: 'Backwoods', brand: 'Backwoods', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-BW', variants: [], tag: null },
  { id: 4, name: 'Snickers', brand: 'Snickers', cat: 'CANDIES', sub: 'Chocolate', sku: 'AW-SN', variants: [], tag: 'NEW' },
];
const departments = [
  { key: 'TOBACCO', label: 'Tobacco', subs: ['Cigarettes', 'Cigars'], count: 3 },
  { key: 'CANDIES', label: 'Candies', subs: ['Chocolate'], count: 1 },
];

// App's wiring: the URL resolved against the catalog, the page keyed by department.
function Harness({ buyer = null, list = products }) {
  const { raw } = useRoute();
  const route = resolveRoute(raw, { departments, products: list });
  if (route.page !== 'category') return <p>{route.page}</p>;
  return (
    <CategoryPage key={route.category} category={route.category} sub={route.sub} query={route.query}
                  products={list} departments={departments} profile={buyer?.profile || null} isApprovedBuyer={!!buyer}
                  priceOf={buyer?.priceOf} pricesStatus={buyer?.status}
                  cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />
  );
}
// An approved buyer; product 2 has no price (price on request).
const UNIT = { 1: 20.5, 2: null, 3: 3.25 };
const BUYER = { profile: { id: 'b', status: 'approved' }, priceOf: (id) => UNIT[id] ?? null, status: 'ready' };
const cardNames = () => [...document.querySelectorAll('.content-card h3')].map((h) => h.textContent);
const cardPrices = () => [...document.querySelectorAll('.card-meta > span:first-child')].map((el) => el.textContent);

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
    expect(screen.getByRole('checkbox', { name: 'Bestsellers (1)' }).checked).toBe(true);
    expect(screen.getByLabelText('Sort by').value).toBe('name-asc');
    expect(screen.getByRole('link', { name: 'Cigars (2)' }).getAttribute('aria-current')).toBe('page');
  });

  it('writes filter changes to the URL without adding history entries', () => {
    render(<Harness />);
    const length = window.history.length;
    fireEvent.click(screen.getByRole('checkbox', { name: 'New (1)' }));
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

  it('searches with the catalog search rules: a straight apostrophe finds a curly one (AW-064)', () => {
    const list = [...products, { id: 7, name: 'Reese’s', brand: 'Reese’s', cat: 'CANDIES', sub: 'Chocolate', sku: 'AW-REESE-S', variants: ['Cups'], tag: null }];
    act(() => navigate("/category/candies?q=reese's", { replace: true }));
    render(<Harness list={list} />);
    expect(screen.getByRole('searchbox', { name: 'Search in Candies' }).value).toBe("reese's");
    expect(cardNames()).toEqual(['Reese’s']);
    expect(note()).toBe('Showing 1 of 2 items');
  });

  it('sorts by the buyer’s prices, products without one last (AW-003)', () => {
    act(() => navigate('/category/tobacco?sort=price-low', { replace: true }));
    const view = render(<Harness buyer={BUYER} />);
    expect(cardNames()).toEqual(['Backwoods', 'Kite tobacco', 'Swisher Sweets']);
    expect(cardPrices()).toEqual(['$3.25', '$20.50', 'Price on request']);
    act(() => navigate('/category/tobacco?sort=price-high', { replace: true }));
    expect(cardNames()).toEqual(['Kite tobacco', 'Backwoods', 'Swisher Sweets']);
    // While the prices load, every card says so and the catalog order stays.
    view.rerender(<Harness buyer={{ ...BUYER, priceOf: () => null, status: 'loading' }} />);
    expect(cardNames()).toEqual(['Kite tobacco', 'Swisher Sweets', 'Backwoods']);
    expect(cardPrices()).toEqual(['Loading price…', 'Loading price…', 'Loading price…']);
  });

  it('tells each account without prices why: guest, under review or on hold (AW-101)', () => {
    const intro = () => document.querySelector('.page-head h1 + p').textContent;
    const sidebar = () => document.querySelector('.filter-signin').textContent;
    const view = render(<Harness />);
    expect(intro()).toBe('Wholesale tobacco for licensed retail accounts. Sign in to see your wholesale pricing.');
    expect(sidebar()).toBe('Wholesale pricing is locked' + 'Sign in to see your account pricing.');
    view.unmount();
    const pending = render(<CategoryPage category="TOBACCO" products={products} departments={departments} profile={{ id: 'p', status: 'pending' }} isApprovedBuyer={false}
                                         cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    expect(intro()).toBe('Wholesale tobacco for licensed retail accounts. Pricing unlocks after your account is approved.');
    expect(sidebar()).toBe('Pricing after approval' + 'Your account is not approved for trade pricing yet.');
    pending.unmount();
    render(<CategoryPage category="TOBACCO" products={products} departments={departments} profile={{ id: 's', status: 'suspended' }} isApprovedBuyer={false}
                         cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    expect(intro()).toBe('Wholesale tobacco for licensed retail accounts. Ordering is paused on this account — call the trade desk.');
    expect(sidebar()).toBe('Account on hold' + 'Ordering is paused on this account — call the trade desk.');
    expect(document.querySelector('.filter-signin').tagName).toBe('P');
    expect([...document.querySelectorAll('.card-meta .lock')].map((el) => el.textContent)).toEqual(['Account on hold', 'Account on hold', 'Account on hold']);
    expect(document.body.textContent).not.toMatch(/after approval|unlocks after/);
  });

  it('offers no price sort, and shows no price, to guests', () => {
    act(() => navigate('/category/tobacco?sort=price-low', { replace: true }));
    render(<Harness />);
    expect(screen.getByLabelText('Sort by').value).toBe('featured');
    expect(screen.queryByRole('option', { name: /Price/ })).toBeNull();
    expect(cardNames()).toEqual(['Kite tobacco', 'Swisher Sweets', 'Backwoods']);
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('counts variants from the list: one variant is not "Has variants", and "Most variants" sorts by the count (AW-332, AW-233)', () => {
    const list = [
      ...products.slice(0, 3),
      // A stale count from an old row is not read.
      { id: 5, name: 'Garcia y Vega', brand: 'Garcia y Vega', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-GV', variants: ['Green'], flavors: 9, tag: null },
      { id: 6, name: 'Black & Mild', brand: 'Black & Mild', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-BM', variants: ['Regular', 'Wine', 'Casino'], tag: null },
    ];
    act(() => navigate('/category/tobacco?variants=1', { replace: true }));
    const view = render(<Harness list={list} />);
    expect(cardNames()).toEqual(['Swisher Sweets', 'Black & Mild']);
    act(() => navigate('/category/tobacco?sort=variants', { replace: true }));
    view.rerender(<Harness list={list} />);
    expect(cardNames()).toEqual(['Black & Mild', 'Swisher Sweets', 'Garcia y Vega', 'Kite tobacco', 'Backwoods']);
  });

  it('starts another department without the old filters (AW-228)', () => {
    act(() => navigate('/category/tobacco?tags=new', { replace: true }));
    render(<Harness />);
    expect(note()).toBe('Showing 1 of 3 items');
    act(() => navigate('/category/candies'));
    expect(note()).toBe('Showing 1 of 1 item');
    expect(screen.getByRole('checkbox', { name: 'New (1)' }).checked).toBe(false);
  });

  it('offers only the Featured tags the products in view carry, with counts (AW-139)', () => {
    const list = [
      ...products,
      { id: 7, name: 'Bleach', brand: 'Clorox', cat: 'GROCERY', sub: 'Cleaning', sku: 'AW-BL', variants: [], tag: null },
    ];
    const depts = [...departments, { key: 'GROCERY', label: 'Grocery', subs: ['Cleaning'], count: 1 }];
    function Many() {
      const { raw } = useRoute();
      const route = resolveRoute(raw, { departments: depts, products: list });
      return (
        <CategoryPage key={route.category} category={route.category} sub={route.sub} query={route.query}
                      products={list} departments={depts} profile={null} isApprovedBuyer={false}
                      cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />
      );
    }
    const boxes = () => screen.queryAllByRole('checkbox').map((b) => b.closest('label').textContent.trim()).filter((t) => !/variants/.test(t));
    render(<Many />);
    // Tobacco: one bestseller and one new product; no deals or premium.
    expect(boxes()).toEqual(['Bestsellers (1)', 'New (1)']);
    // The Cigars line has only the bestseller.
    act(() => navigate('/category/tobacco/cigars', { replace: true }));
    expect(boxes()).toEqual(['Bestsellers (1)']);
    // A tag picked in the URL stays, so it can be unpicked.
    act(() => navigate('/category/tobacco/cigars?tags=new', { replace: true }));
    expect(boxes()).toEqual(['Bestsellers (1)', 'New (0)']);
    // No tags at all: no Featured box.
    act(() => navigate('/category/grocery'));
    expect(screen.queryByRole('group', { name: 'Featured' })).toBeNull();
    expect(boxes()).toEqual([]);
  });
});
