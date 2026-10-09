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

  it('offers no price sort, and shows no price, to guests', () => {
    act(() => navigate('/category/tobacco?sort=price-low', { replace: true }));
    render(<Harness />);
    expect(screen.getByLabelText('Sort by').value).toBe('featured');
    expect(screen.queryByRole('option', { name: /Price/ })).toBeNull();
    // Featured instead: the bestseller, then the new product (AW-227).
    expect(cardNames()).toEqual(['Swisher Sweets', 'Kite tobacco', 'Backwoods']);
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('loads the first row of photos at once, the first one first; the rest lazily (AW-323)', () => {
    const photo = (id) => ({ picture: { src: `/p${id}.jpg`, srcSet: `/p${id}-320.jpg 320w`, webpSrcSet: `/p${id}-320.webp 320w`, width: 320, height: 320 } });
    const list = [1, 2, 3, 4, 5].map((id) => ({ id, name: `Cigar ${id}`, brand: 'X', cat: 'TOBACCO', sub: 'Cigars', sku: `AW-${id}`, variants: [], tag: null, ...photo(id) }));
    render(<Harness list={list} />);
    const imgs = [...document.querySelectorAll('.category-card-grid .card-block img')];
    expect(imgs.map((img) => img.getAttribute('loading'))).toEqual(['eager', 'eager', 'eager', 'lazy', 'lazy']);
    expect(imgs.map((img) => img.getAttribute('fetchpriority'))).toEqual(['high', null, null, null, null]);
  });

  it('sorts Featured by homepage rank, then tag, then photo, then id, without lifting restricted lines (AW-227)', () => {
    const photo = { picture: { src: '/p.jpg', width: 100, height: 100 } };
    const list = [
      { id: 21, name: 'Plain cigar', brand: 'X', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-21', variants: [], tag: null, ...photo },
      { id: 22, name: 'Placeholder cigar', brand: 'X', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-22', variants: [], tag: null },
      { id: 23, name: 'Premium cigar', brand: 'X', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-23', variants: [], tag: 'PREMIUM', ...photo },
      { id: 24, name: 'Deal cigar', brand: 'X', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-24', variants: [], tag: 'DEAL', ...photo },
      { id: 25, name: 'New cigar', brand: 'X', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-25', variants: [], tag: 'NEW', ...photo },
      { id: 26, name: 'Best cigar', brand: 'X', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-26', variants: [], tag: 'BESTSELLER', ...photo },
      { id: 27, name: 'Ranked cigar', brand: 'X', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-27', variants: [], tag: null, featuredRank: 1, ...photo },
      // A line under legal review (AW-001): its tag doesn't lift it.
      { id: 28, name: 'Kava shot', brand: 'X', cat: 'TOBACCO', sub: 'Kratom & Kava', sku: 'AW-28', variants: [], tag: 'BESTSELLER', ...photo },
    ];
    render(<Harness list={list} />);
    expect(screen.getByLabelText('Sort by').value).toBe('featured');
    expect(screen.getByRole('option', { name: 'Featured' })).toBeTruthy();
    expect(cardNames()).toEqual(['Ranked cigar', 'Best cigar', 'New cigar', 'Deal cigar', 'Premium cigar', 'Plain cigar', 'Kava shot', 'Placeholder cigar']);
    // The other sorts still work from the same list.
    act(() => navigate('/category/tobacco?sort=name-asc', { replace: true }));
    expect(cardNames()[0]).toBe('Best cigar');
  });

  it('explains pricing once, above the grid; the intro describes the department and the filters hold only filters (AW-224)', () => {
    const view = render(<Harness />);
    const intro = () => document.querySelector('.page-head h1 + p').textContent;
    expect(intro()).toBe('Wholesale tobacco for licensed retail accounts: 3 products in 2 product lines.');
    const notices = document.querySelectorAll('.pricing-notice');
    expect(notices).toHaveLength(1);
    expect(notices[0].nextElementSibling.classList.contains('category-card-grid')).toBe(true);
    expect(notices[0].textContent).toMatch(/^Trade prices are shown to approved accounts\./);
    expect(screen.getByRole('button', { name: 'Apply for a trade account' })).toBeTruthy();
    expect(document.querySelector('.filter-panel .filter-signin')).toBeNull();
    expect(screen.queryByText(/Wholesale pricing is locked|Sign in for pricing/)).toBeNull();
    // No card has a sign-in control of its own: its only controls are the add or choose ones.
    for (const control of document.querySelectorAll('.content-card .card-meta :is(button, a)')) expect(control.classList.contains('card-add')).toBe(true);
    // An account waiting for approval: the status link.
    view.unmount();
    render(<CategoryPage category="TOBACCO" products={products} departments={departments} profile={{ id: 'p', status: 'pending' }} isApprovedBuyer={false}
                         cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    expect(document.querySelector('.pricing-notice').textContent).toMatch(/^Pricing unlocks after your account is approved\./);
    expect(intro()).toBe('Wholesale tobacco for licensed retail accounts: 3 products in 2 product lines.');
  });

  it('shows approved buyers no pricing notice', () => {
    render(<Harness buyer={BUYER} />);
    expect(document.querySelector('.pricing-notice')).toBeNull();
    expect(document.querySelector('.page-head h1 + p').textContent).toBe('Wholesale tobacco for licensed retail accounts: 3 products in 2 product lines.');
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
