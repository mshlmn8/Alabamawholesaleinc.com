// Department page filters live in the URL (AW-008, AW-327, AW-228). Products
// carry no prices (AW-003); price sorts use the buyer's prices (test values).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate, resolveRoute, useRoute } from '../lib/router.js';
import { SIZES } from '../lib/images.js';
import { brandOptions, CategoryPage, centredScrollLeft } from './CategoryPage.jsx';

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
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

  it('names the line it searches on a line page (NEW-051)', () => {
    act(() => navigate('/category/tobacco/cigars', { replace: true }));
    render(<Harness />);
    expect(screen.getByRole('searchbox', { name: 'Search in Cigars' })).toBeTruthy();
    act(() => navigate('/category/tobacco', { replace: true }));
    expect(screen.getByRole('searchbox', { name: 'Search in Tobacco' })).toBeTruthy();
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

  // One notice above the grid says why (AW-224); an account on hold is told
  // ordering is paused and who to call, never to wait for approval (AW-101).
  it('tells each account without prices why: guest, under review or on hold (AW-101)', () => {
    const intro = () => document.querySelector('.page-head h1 + p').textContent;
    const notice = () => document.querySelector('.pricing-notice p').textContent;
    const view = render(<Harness />);
    expect(intro()).toBe('Wholesale tobacco for licensed retail accounts: 3 products in 2 product lines.');
    expect(notice()).toBe('Trade prices are shown to approved accounts.');
    view.unmount();
    const pending = render(<CategoryPage category="TOBACCO" products={products} departments={departments} profile={{ id: 'p', status: 'pending' }} isApprovedBuyer={false}
                                         cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    expect(notice()).toBe('Pricing unlocks after your account is approved.');
    pending.unmount();
    render(<CategoryPage category="TOBACCO" products={products} departments={departments} profile={{ id: 's', status: 'suspended' }} isApprovedBuyer={false}
                         cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    expect(notice()).toMatch(/^Ordering is paused on this account\. Call .+ or email .+ and a trade rep will help you sort it out\.$/);
    expect(document.querySelector('.filter-signin')).toBeNull();
    expect([...document.querySelectorAll('.card-meta .lock')].map((el) => el.textContent)).toEqual(['Account on hold', 'Account on hold', 'Account on hold']);
    expect(document.body.textContent).not.toMatch(/after approval|unlocks after/);
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
    // The grid's own photo width (AW-322), on the WebP sources and the JPEG fallback.
    const sources = [...document.querySelectorAll('.category-card-grid .card-block source')];
    expect(sources).toHaveLength(5);
    for (const el of [...imgs, ...sources]) expect(el.getAttribute('sizes')).toBe(SIZES.categoryCard);
    expect(SIZES.categoryCard).not.toBe(SIZES.card);
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
    expect(screen.queryByText(/Wholesale pricing is locked/)).toBeNull();
    // A guest's card says 'Sign in for pricing' as plain text, never as a control (NEW-050).
    const locks = screen.getAllByText('Sign in for pricing');
    expect(locks.map((el) => `${el.tagName}.${el.className}`)).toEqual(locks.map(() => 'SPAN.lock'));
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
    // Whose prices the cards show (AW-107); no notice above the grid.
    expect(document.querySelector('.page-head h1 + p').textContent).toBe('Wholesale tobacco for licensed retail accounts: 3 products in 2 product lines. Prices shown are your account prices.');
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
// The phone layout: the filters are in the Filter & Sort drawer.
const phone = () => vi.stubGlobal('matchMedia', vi.fn((media) => ({ media, matches: true, addEventListener() {}, removeEventListener() {} })));

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

describe('CategoryPage line pages (AW-226)', () => {
  const crumbs = () => [...document.querySelectorAll('.crumbs li > *')].map((el) => ({ text: el.textContent, tag: el.tagName, href: el.getAttribute('href'), current: el.getAttribute('aria-current') }));
  const head = () => ({
    eyebrow: document.querySelector('.page-head .eyebrow').textContent,
    h1: screen.getByRole('heading', { level: 1 }).textContent,
    intro: document.querySelector('.page-head h1 + p').textContent,
  });

  it('names the line in the heading, eyebrow and intro; the trail leads back to All products and the department', () => {
    act(() => navigate('/category/tobacco/wraps', { replace: true }));
    render(<Branded />);
    expect(head()).toEqual({ eyebrow: 'Tobacco · 7 products', h1: 'Wraps', intro: 'Wholesale tobacco for licensed retail accounts: 7 products in Wraps.' });
    expect(crumbs()).toEqual([
      { text: 'Home', tag: 'A', href: '/', current: null },
      { text: 'All products', tag: 'A', href: '/catalog', current: null },
      { text: 'Tobacco', tag: 'A', href: '/category/tobacco', current: null },
      { text: 'Wraps', tag: 'SPAN', href: null, current: 'page' },
    ]);
    // The department crumb keeps the filters, as the All pill does.
    act(() => navigate('/category/tobacco/wraps?brand=game', { replace: true }));
    expect(screen.getByRole('link', { name: 'Tobacco' }).getAttribute('href')).toBe('/category/tobacco?brand=game');
    expect(head().eyebrow).toBe('Tobacco · 7 products');
  });

  it('keeps the department head on the department page', () => {
    render(<Branded />);
    expect(head()).toEqual({ eyebrow: 'DEPARTMENT · 14 SKUs', h1: 'Tobacco', intro: 'Wholesale tobacco for licensed retail accounts: 14 products in 2 product lines.' });
    expect(crumbs().map((c) => `${c.tag}:${c.text}`)).toEqual(['A:Home', 'A:All products', 'SPAN:Tobacco']);
  });

  it('names the department once on a line named like it: the trail says which is the department, the eyebrow just counts (NEW-029)', () => {
    const oil = [
      { id: 57, name: 'Pure Guard motor oil', brand: 'Pure Guard', cat: 'MOTOR OIL', sub: 'Motor Oil', sku: 'AW-PG', variants: [], tag: null },
      { id: 58, name: 'Fuel additive', brand: 'X', cat: 'MOTOR OIL', sub: 'Additives', sku: 'AW-FA', variants: [], tag: null },
    ];
    const depts = [{ key: 'MOTOR OIL', label: 'Motor Oil', subs: ['Additives', 'Motor Oil'], count: 2 }];
    act(() => navigate('/category/motor-oil/motor-oil', { replace: true }));
    const view = render(<CategoryPage category="MOTOR OIL" sub="Motor Oil" products={oil} departments={depts} profile={null} isApprovedBuyer={false}
                                      cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    expect(head()).toEqual({ eyebrow: '1 product', h1: 'Motor Oil', intro: 'Wholesale motor oil for licensed retail accounts: 1 product in Motor Oil.' });
    expect(crumbs().map((c) => `${c.tag}:${c.text}`)).toEqual(['A:Home', 'A:All products', 'A:Motor Oil department', 'SPAN:Motor Oil']);
    view.unmount();
    // Another line of the department keeps the department's name in both.
    render(<CategoryPage category="MOTOR OIL" sub="Additives" products={oil} departments={depts} profile={null} isApprovedBuyer={false}
                         cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    expect(head().eyebrow).toBe('Motor Oil · 1 product');
    expect(crumbs().map((c) => c.text)).toEqual(['Home', 'All products', 'Motor Oil', 'Additives']);
  });

  it('says "1 product" for a line of one', () => {
    const list = [...BRANDED, { ...row(15, 'Lone pouch', 'ZYN', 'Pouches') }];
    const depts = [{ ...BRAND_DEPTS[0], subs: ['Cigars', 'Pouches', 'Wraps'], count: 15 }];
    act(() => navigate('/category/tobacco/pouches', { replace: true }));
    render(<CategoryPage category="TOBACCO" sub="Pouches" products={list} departments={depts} profile={null} isApprovedBuyer={false}
                         cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    expect(head().eyebrow).toBe('Tobacco · 1 product');
    expect(head().intro).toBe('Wholesale tobacco for licensed retail accounts: 1 product in Pouches.');
  });
});

describe('CategoryPage on phones (AW-223)', () => {
  it('lets the Filter & Sort drawer change the product line, with filter-aware counts, without a history entry', () => {
    phone();
    act(() => navigate('/category/tobacco?brand=game', { replace: true }));
    render(<Branded />);
    fireEvent.click(screen.getByRole('button', { name: /Filter & Sort/ }));
    const drawer = screen.getByRole('dialog', { name: 'Filter & Sort' });
    const lines = within(drawer).getByRole('group', { name: 'Product line' });
    // First in the drawer, above the sort.
    expect(drawer.querySelector('.filter-drawer-body').firstElementChild.contains(lines)).toBe(true);
    const radios = within(lines).getAllByRole('radio');
    expect(radios.map((r) => r.closest('label').textContent.trim())).toEqual(['All (3)', 'Cigars (1)', 'Wraps (2)']);
    expect(radios.map((r) => r.name)).toEqual(['category-line', 'category-line', 'category-line']);
    expect(radios[0].checked).toBe(true);
    // The brand facet is in the drawer too.
    expect(within(drawer).getByRole('checkbox', { name: 'Game (3)' }).checked).toBe(true);
    const length = window.history.length;
    fireEvent.click(within(lines).getByRole('radio', { name: 'Wraps (2)' }));
    expect(url()).toBe('/category/tobacco/wraps?brand=game');
    expect(window.history.length).toBe(length);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Wraps');
    // The drawer stays open on the new line.
    expect(within(screen.getByRole('dialog', { name: 'Filter & Sort' })).getByRole('radio', { name: 'Wraps (2)' }).checked).toBe(true);
    fireEvent.click(within(lines).getByRole('radio', { name: 'All (3)' }));
    expect(url()).toBe('/category/tobacco?brand=game');
    fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('has no line choice in the desktop filters (the pills are there)', () => {
    render(<Branded />);
    expect(screen.queryByRole('group', { name: 'Product line' })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });
});

describe('CategoryPage on a phone (AW-158, AW-157)', () => {
  // The compact layout: MOBILE_QUERY matches.
  const phone = () => vi.stubGlobal('matchMedia', vi.fn((query) => ({ media: query, matches: true, addEventListener() {}, removeEventListener() {} })));
  afterEach(() => vi.unstubAllGlobals());

  it('puts the active-filter chips after the toolbar, so only the Filter & Sort row sticks (AW-158)', () => {
    phone();
    act(() => navigate('/category/tobacco/cigars?tags=bestseller&q=swish', { replace: true }));
    render(<Harness />);
    const toolbar = document.querySelector('.category-toolbar');
    const chips = screen.getByRole('list', { name: 'Active filters' });
    expect(toolbar.contains(chips)).toBe(false);
    expect(toolbar.nextElementSibling).toBe(chips);
    // The Filter & Sort badge keeps the count.
    expect(document.querySelector('.filter-toggle .filter-count').textContent).toBe(', 3 active');
    // The phone note leaves the line to screen readers, which still hear it.
    expect(note()).toBe('Showing 1 of 2 items in Cigars');
    expect(document.querySelector('.result-note .result-scope').textContent).toBe('in Cigars');
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Cigars' }));
    expect(note()).toBe('Showing 1 of 3 items');
    expect(document.querySelector('.result-note .result-scope').textContent).toBe('');
  });

  it('centres the current product line in the pill row, without scrolling the page (AW-157)', () => {
    phone();
    // Pill positions in the scrolling row, which is their offsetParent (it is
    // positioned in the compact layout); the row is 200px wide.
    const layout = { 'All (3)': [16, 80], 'Cigarettes (1)': [104, 120], 'Cigars (2)': [232, 100] };
    const pillBox = (el) => (el.classList.contains('sub-pill') ? layout[el.textContent] : null);
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function left() { return pillBox(this)?.[0] ?? 0; });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function width() { return pillBox(this)?.[1] ?? 0; });
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function parent() { return pillBox(this) ? this.parentElement : null; });
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function client() { return this.classList.contains('sub-pills') ? 200 : 0; });
    const scrolls = [];
    vi.spyOn(Element.prototype, 'scrollLeft', 'set').mockImplementation(function set(value) { if (this.classList.contains('sub-pills')) scrolls.push(value); });
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    act(() => navigate('/category/tobacco/cigars', { replace: true }));
    render(<Harness />);
    // Cigars (232 + 100 / 2) in the middle of 200px.
    expect(scrolls).toEqual([182]);
    fireEvent.click(screen.getByRole('link', { name: 'Cigarettes (1)' }));
    expect(url()).toBe('/category/tobacco/cigarettes');
    expect(scrolls).toEqual([182, 64]);
    // All sits at the start: the row goes back to 0, never below.
    fireEvent.click(screen.getByRole('link', { name: 'All (3)' }));
    expect(scrolls).toEqual([182, 64, 0]);
    // The page itself never moved.
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
    delete Element.prototype.scrollIntoView;
  });

  it('leaves the pill row alone in the desktop layout, where the pills wrap', () => {
    const set = vi.spyOn(Element.prototype, 'scrollLeft', 'set').mockImplementation(() => {});
    act(() => navigate('/category/tobacco/cigars', { replace: true }));
    render(<Harness />);
    expect(set).not.toHaveBeenCalled();
  });
});

describe('centredScrollLeft', () => {
  it('centres a pill measured from its row, and from a shared offsetParent when the row is not positioned', () => {
    const row = { offsetLeft: 40, clientWidth: 300 };
    expect(centredScrollLeft({ offsetParent: row, offsetLeft: 500, offsetWidth: 100 }, row)).toBe(400);
    expect(centredScrollLeft({ offsetParent: {}, offsetLeft: 540, offsetWidth: 100 }, row)).toBe(400);
    expect(centredScrollLeft({ offsetParent: row, offsetLeft: 16, offsetWidth: 80 }, row)).toBe(0);
  });
});
