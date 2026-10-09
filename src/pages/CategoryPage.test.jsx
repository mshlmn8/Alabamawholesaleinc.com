// Department page filters live in the URL (AW-008, AW-327, AW-228). Products
// carry no prices (AW-003); price sorts use the buyer's prices (test values).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate, resolveRoute, useRoute } from '../lib/router.js';
import { brandOptions, CategoryPage } from './CategoryPage.jsx';

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
    // The pill counts what it shows with the bestseller filter (AW-225).
    expect(screen.getByRole('link', { name: 'Cigars (1)' }).getAttribute('aria-current')).toBe('page');
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
    const group = () => screen.queryByRole('group', { name: 'Featured' });
    const boxes = () => (group() ? within(group()).getAllByRole('checkbox').map((b) => b.closest('label').textContent.trim()) : []);
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

// A department with two lines, ten named brands and the placeholder "Assorted".
const row = (id, name, brand, sub, tag = null) => ({ id, name, brand, cat: 'TOBACCO', sub, sku: `AW-${id}`, variants: [], tag });
const BRANDED = [
  row(1, 'Swisher Sweets cigarillo', 'Swisher Sweets', 'Cigars', 'BESTSELLER'),
  row(2, 'Swisher Sweets wraps', 'Swisher Sweets', 'Wraps'),
  row(3, 'Game cigarillo', 'Game', 'Cigars'),
  row(4, 'Game leaf', 'Game', 'Wraps', 'NEW'),
  row(5, 'Game blunt', 'Game', 'Wraps'),
  row(6, 'Backwoods', 'Backwoods', 'Cigars'),
  row(7, 'Black & Mild', 'Black & Mild', 'Cigars'),
  row(8, 'Dutch Masters', 'Dutch Masters', 'Cigars'),
  row(9, 'White Owl', 'White Owl', 'Cigars'),
  row(10, 'Zig-Zag papers', 'Zig-Zag', 'Wraps'),
  row(11, 'RAW papers', 'RAW', 'Wraps'),
  row(12, 'Kite tobacco', 'Kite', 'Cigars'),
  row(13, 'Gambler tubes', 'Gambler', 'Wraps'),
  row(14, 'Assorted lighter', 'Assorted', 'Wraps'),
];
const BRAND_DEPTS = [{ key: 'TOBACCO', label: 'Tobacco', subs: ['Cigars', 'Wraps'], count: 14 }];
function Branded() {
  const { raw } = useRoute();
  const route = resolveRoute(raw, { departments: BRAND_DEPTS, products: BRANDED });
  if (route.page !== 'category') return <p>{route.page}</p>;
  return (
    <CategoryPage key={route.category} category={route.category} sub={route.sub} query={route.query}
                  products={BRANDED} departments={BRAND_DEPTS} profile={null} isApprovedBuyer={false}
                  cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />
  );
}
const brandBox = () => screen.getByRole('group', { name: 'Brand' });
const brandLabels = () => within(brandBox()).getAllByRole('checkbox').map((b) => b.closest('label').textContent.trim());
const pills = () => [...document.querySelectorAll('.sub-pills a')].map((a) => ({ text: a.textContent, empty: a.classList.contains('is-empty'), href: a.getAttribute('href') }));

describe('brandOptions (AW-067)', () => {
  it('counts each named brand, most products first, then by name; "Assorted" names no brand', () => {
    const list = [{ brand: 'RAW' }, { brand: 'Zig-Zag' }, { brand: 'RAW' }, { brand: 'Assorted' }, { brand: ' Assorted ' }, { brand: 'Backwoods' }, { brand: '' }, { brand: null }];
    expect(brandOptions(list)).toEqual([
      { slug: 'raw', label: 'RAW', count: 2 },
      { slug: 'backwoods', label: 'Backwoods', count: 1 },
      { slug: 'zig-zag', label: 'Zig-Zag', count: 1 },
    ]);
  });

  it('keeps a picked brand at (0), named from the department; a slug no product carries is dropped', () => {
    const dept = [{ brand: 'Kite' }, { brand: 'RAW' }];
    expect(brandOptions([{ brand: 'RAW' }], ['kite', 'nope'], dept)).toEqual([
      { slug: 'raw', label: 'RAW', count: 1 },
      { slug: 'kite', label: 'Kite', count: 0 },
    ]);
  });
});

describe('CategoryPage brand filter (AW-067)', () => {
  it('lists the top eight brands with counts, then "Show all N brands"; "Assorted" is not a brand', () => {
    render(<Branded />);
    expect(brandLabels()).toEqual(['Game (3)', 'Swisher Sweets (2)', 'Backwoods (1)', 'Black & Mild (1)', 'Dutch Masters (1)', 'Gambler (1)', 'Kite (1)', 'RAW (1)']);
    expect(screen.queryByRole('checkbox', { name: /Assorted/ })).toBeNull();
    const more = within(brandBox()).getByRole('button', { name: 'Show all 10 brands' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(more.getAttribute('aria-controls'))).toBe(brandBox().querySelector('#category-brands'));
    fireEvent.click(more);
    expect(brandLabels()).toHaveLength(10);
    expect(brandLabels().slice(-2)).toEqual(['White Owl (1)', 'Zig-Zag (1)']);
    expect(more.textContent).toBe('Show fewer brands');
    expect(more.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(more);
    expect(brandLabels()).toHaveLength(8);
    // Filters and the URL are untouched by the toggle.
    expect(url()).toBe('/category/tobacco');
  });

  it('picking a brand shows exactly its products, in the URL, as a chip, and Clear all clears it', () => {
    render(<Branded />);
    const length = window.history.length;
    fireEvent.click(screen.getByRole('checkbox', { name: 'Game (3)' }));
    expect(url()).toBe('/category/tobacco?brand=game');
    expect(note()).toBe('Showing 3 of 14 items');
    expect(cardNames().sort()).toEqual(['Game blunt', 'Game cigarillo', 'Game leaf']);
    expect(screen.getByRole('button', { name: 'Remove filter Brand: Game' })).toBeTruthy();
    // Brand counts leave the brands out, so picking one changes none of them.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Swisher Sweets (2)' }));
    expect(url()).toBe('/category/tobacco?brand=game,swisher-sweets');
    expect(note()).toBe('Showing 5 of 14 items');
    expect(brandLabels().slice(0, 2)).toEqual(['Game (3)', 'Swisher Sweets (2)']);
    expect(window.history.length).toBe(length);
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Brand: Game' }));
    expect(url()).toBe('/category/tobacco?brand=swisher-sweets');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all (1)' }));
    expect(url()).toBe('/category/tobacco');
    expect(note()).toBe('Showing 14 of 14 items');
  });

  it('reads brands from the URL: a picked brand stays listed, at (0) where the line has none; unknown ones are ignored', () => {
    act(() => navigate('/category/tobacco?brand=zig-zag', { replace: true }));
    render(<Branded />);
    // Past the top eight, but picked: listed without "Show all".
    expect(brandLabels()).toHaveLength(9);
    expect(screen.getByRole('checkbox', { name: 'Zig-Zag (1)' }).checked).toBe(true);
    act(() => navigate('/category/tobacco/wraps?brand=backwoods', { replace: true }));
    expect(screen.getByRole('checkbox', { name: 'Backwoods (0)' }).checked).toBe(true);
    expect(note()).toBe('Showing 0 of 7 items in Wraps');
    act(() => navigate('/category/tobacco?brand=nope,assorted', { replace: true }));
    expect(note()).toBe('Showing 14 of 14 items');
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show all 10 brands' })).toBeTruthy();
  });

  it('counts brands within the other filters', () => {
    act(() => navigate('/category/tobacco/wraps?q=papers', { replace: true }));
    render(<Branded />);
    expect(brandLabels()).toEqual(['RAW (1)', 'Zig-Zag (1)']);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
  });

  it('sorts Brand: A to Z, then by name, with products of no named brand last', () => {
    act(() => navigate('/category/tobacco/wraps?sort=brand', { replace: true }));
    render(<Branded />);
    expect(screen.getByLabelText('Sort by').value).toBe('brand');
    expect(screen.getByRole('option', { name: 'Brand: A to Z' })).toBeTruthy();
    expect(cardNames()).toEqual(['Gambler tubes', 'Game blunt', 'Game leaf', 'RAW papers', 'Swisher Sweets wraps', 'Zig-Zag papers', 'Assorted lighter']);
  });
});

describe('CategoryPage line counts follow the filters (AW-225)', () => {
  it('counts every line with the tag, search and brand filters applied; a line left empty is a muted link', () => {
    act(() => navigate('/category/tobacco?tags=new', { replace: true }));
    render(<Branded />);
    expect(pills()).toEqual([
      { text: 'All (1)', empty: false, href: '/category/tobacco?tags=new' },
      { text: 'Cigars (0)', empty: true, href: '/category/tobacco/cigars?tags=new' },
      { text: 'Wraps (1)', empty: false, href: '/category/tobacco/wraps?tags=new' },
    ]);
    act(() => navigate('/category/tobacco?q=swisher', { replace: true }));
    expect(pills().map((p) => p.text)).toEqual(['All (2)', 'Cigars (1)', 'Wraps (1)']);
    act(() => navigate('/category/tobacco?brand=game', { replace: true }));
    expect(pills().map((p) => p.text)).toEqual(['All (3)', 'Cigars (1)', 'Wraps (2)']);
    act(() => navigate('/category/tobacco?brand=backwoods&tags=new', { replace: true }));
    expect(pills().every((p) => p.empty)).toBe(true);
    // The current line keeps aria-current, even when it is empty.
    act(() => navigate('/category/tobacco/cigars?tags=new', { replace: true }));
    const current = screen.getByRole('link', { name: 'Cigars (0)' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.classList.contains('active')).toBe(true);
    // No filters: the plain line sizes.
    act(() => navigate('/category/tobacco', { replace: true }));
    expect(pills().map((p) => p.text)).toEqual(['All (14)', 'Cigars (7)', 'Wraps (7)']);
    expect(pills().some((p) => p.empty)).toBe(false);
  });
});
