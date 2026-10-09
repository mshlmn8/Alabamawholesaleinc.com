// The catalog index counts a product's variants by their axis, only when
// there is a choice (AW-233, AW-332, AW-128). All products is a browsable
// page (AW-068): a row of cards per department, the SKU list kept as a
// secondary view, a catalog search, and labelled line pills (AW-229).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { departmentsFor } from '../../lib/departments.js';
import { navigate } from '../../lib/router.js';
import { CATALOG_PREVIEW, CatalogIndexPage, catalogPreview } from './CatalogIndexPage.jsx';

const products = [
  { id: 1, name: 'Swisher Sweets cigarillos', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SS', variants: ['Red', 'Grape'], variantAxis: 'Flavor' },
  { id: 2, name: 'Gas cans', brand: 'Assorted', cat: 'MOTOR OIL', sub: 'Auto', sku: 'AW-GAS', variants: ['1 gal', '2gal', '5 gal'], variantAxis: 'Size' },
  { id: 3, name: 'Gatorade', brand: 'Gatorade', cat: 'DRINKS & BAGS', sub: 'Sports', sku: 'AW-GATORADE', variants: ['Blue'] },
  { id: 4, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', variants: [] },
];
const row = (name) => screen.getByText(name).closest('a').querySelector('small').textContent;

// Products with photos and tags, and rows of the restricted lines (decision 2).
const photo = (id) => ({ src: `/img/p${id}.jpg`, width: 400, height: 400 });
const item = (id, fields) => ({ id, brand: 'Brand', sku: `AW-${id}`, variants: [], tag: null, picture: photo(id), img: `p${id}.jpg`, ...fields });
const CATALOG = [
  item(10, { name: 'Untagged cigars', cat: 'TOBACCO', sub: 'Cigars' }),
  item(11, { name: 'Bestseller cigars', cat: 'TOBACCO', sub: 'Cigars', tag: 'BESTSELLER' }),
  item(12, { name: 'New papers', cat: 'TOBACCO', sub: 'Papers', tag: 'NEW' }),
  item(13, { name: 'No-photo bestseller', cat: 'TOBACCO', sub: 'Papers', tag: 'BESTSELLER', picture: null, img: null }),
  item(14, { name: 'Deal wraps', cat: 'TOBACCO', sub: 'Wraps', tag: 'DEAL' }),
  item(15, { name: 'Ranked wraps', cat: 'TOBACCO', sub: 'Wraps', featuredRank: 1 }),
  item(16, { name: 'Last cigars', cat: 'TOBACCO', sub: 'Cigars' }),
  item(20, { name: 'Kava shot', cat: 'NOVELTIES', sub: 'Kratom & Kava', tag: 'BESTSELLER' }),
  item(21, { name: 'Mushroom gummies', cat: 'NOVELTIES', sub: 'Mushroom Products', tag: 'NEW', featuredRank: 2 }),
  item(22, { name: 'Disposable vape', cat: 'NOVELTIES', sub: 'Disposable Vapes', tag: 'NEW' }),
  item(28, { name: 'Enhancement honey', cat: 'MERCHANDISE', sub: 'Honey & Energy', tag: 'PREMIUM' }),
  item(29, { name: 'Energy honey sticks', cat: 'MERCHANDISE', sub: 'Honey & Energy' }),
];

const cardProps = { profile: null, isApprovedBuyer: false, cart: {}, addLine: () => {}, decLine: () => {}, onLoginClick: () => {}, onApplyClick: () => {} };
const page = (list = CATALOG, props = {}) => render(<CatalogIndexPage products={list} departments={departmentsFor(list)} {...cardProps} {...props} />);
const section = (label) => screen.getByRole('region', { name: label });
const cardNames = (el) => [...el.querySelectorAll('.card-grid .content-card h3')].map((h) => h.textContent);
const skuNames = (el) => [...el.querySelectorAll('details.sku-details .sku-list b')].map((b) => b.textContent);

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/catalog', { replace: true }));
});
afterEach(() => vi.restoreAllMocks());

describe('CatalogIndexPage', () => {
  it('counts variants by their axis, and not a single one', () => {
    render(<CatalogIndexPage products={products} departments={departmentsFor(products)} profile={null} isApprovedBuyer={false} onLoginClick={() => {}} />);
    expect(row('Swisher Sweets cigarillos')).toBe('Swisher · Cigars · AW-SS · 2 flavors');
    // The placeholder brand isn't printed (AW-286).
    expect(row('Gas cans')).toBe('Auto · AW-GAS · 3 sizes');
    expect(row('Gatorade')).toBe('Gatorade · Sports · AW-GATORADE');
    expect(row('Kite')).toBe('Kite · Cigarettes · AW-KITE');
    expect(screen.queryByText(/1 variants/)).toBeNull();
  });

  it('heads the page once with its counts, without repeating them (AW-068, AW-284)', () => {
    page(products);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('All products');
    expect(document.querySelector('.page-head .eyebrow').textContent).toBe('FULL ASSORTMENT');
    expect(document.querySelector('.page-head > p:not([class])').textContent).toBe('8 departments, 4 product lines and 4 products.');
    expect(document.querySelector('.catalog-index .result-note')).toBeNull();
  });

  it('shows each department as a row of up to four featured cards with a photo (AW-068)', () => {
    page();
    // The Featured order (AW-227): rank first, then the tag, then id; a
    // product without a photo is left out.
    expect(cardNames(section('Tobacco'))).toEqual(['Ranked wraps', 'Bestseller cigars', 'New papers', 'Deal wraps']);
    expect(CATALOG_PREVIEW).toBe(4);
    const tobacco = within(section('Tobacco'));
    expect(tobacco.getByRole('link', { name: 'See all 7 Tobacco products' }).getAttribute('href')).toBe('/category/tobacco');
    expect(tobacco.getByRole('link', { name: 'Browse Tobacco' }).getAttribute('href')).toBe('/category/tobacco');
    // Guests see the lock on each card, no price (AW-224).
    expect(tobacco.getAllByText('Pricing after approval')).toHaveLength(4);
  });

  it('never shows a product of a line under legal review as a card, even ranked or tagged (decision 2)', () => {
    page();
    expect(cardNames(section('Novelties & Vapes'))).toEqual(['Disposable vape']);
    expect(cardNames(section('Merchandise'))).toEqual(['Energy honey sticks']);
    expect(catalogPreview(CATALOG.filter((p) => p.cat === 'NOVELTIES')).map((p) => p.id)).toEqual([22]);
    // They stay in the SKU list, like every other product.
    expect(skuNames(section('Novelties & Vapes'))).toEqual(['Disposable vape', 'Kava shot', 'Mushroom gummies']);
    expect(skuNames(section('Merchandise'))).toEqual(['Energy honey sticks', 'Enhancement honey']);
  });

  it('keeps every SKU of a department in its list, by name, behind its toggle', () => {
    page();
    expect(skuNames(section('Tobacco'))).toEqual([
      'Bestseller cigars', 'Deal wraps', 'Last cigars', 'New papers', 'No-photo bestseller', 'Ranked wraps', 'Untagged cigars',
    ]);
    expect(section('Tobacco').querySelector('details.sku-details > summary').textContent).toBe('All 7 Tobacco SKUs');
  });

  it('leaves a department without a photographed product with its lines, link and SKU list', () => {
    page(products);
    expect(section('Motor Oil').querySelector('.card-grid')).toBeNull();
    expect(within(section('Motor Oil')).getByRole('link', { name: 'See the Motor Oil product' }).getAttribute('href')).toBe('/category/motor-oil');
    expect(skuNames(section('Motor Oil'))).toEqual(['Gas cans']);
  });

  it("loads the first department's photos at once, its first one first (AW-323)", () => {
    page();
    const imgs = (label) => [...section(label).querySelectorAll('.card-grid img')];
    expect(imgs('Tobacco').map((img) => img.getAttribute('loading'))).toEqual(['eager', 'eager', 'eager', 'eager']);
    expect(imgs('Tobacco').map((img) => img.getAttribute('fetchpriority'))).toEqual(['high', null, null, null]);
    expect(imgs('Novelties & Vapes').map((img) => img.getAttribute('loading'))).toEqual(['lazy']);
    expect(document.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
  });

  it("labels each department's product lines as a group of links, and jumps to its heading (AW-229)", () => {
    page();
    const group = screen.getByRole('group', { name: 'Tobacco product lines' });
    expect(within(group).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Cigars (3)', '/category/tobacco/cigars'], ['Papers (2)', '/category/tobacco/papers'], ['Wraps (2)', '/category/tobacco/wraps'],
    ]);
    // The jump links are anchors to the sections; the router focuses the
    // first heading in the section, which is its h2, not a card's h3.
    const jump = screen.getByRole('navigation', { name: 'Jump to department' });
    expect(within(jump).getAllByRole('link').slice(0, 2).map((a) => a.getAttribute('href'))).toEqual(['#dept-tobacco', '#dept-novelties']);
    expect(document.getElementById('dept-tobacco').querySelector('h1, h2, h3').id).toBe('dept-title-tobacco');
  });

  it('searches the whole catalog from its search box', () => {
    page();
    const form = screen.getByRole('search', { name: 'All products' });
    fireEvent.change(within(form).getByLabelText('Search all products'), { target: { value: '  backwoods ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Search' }));
    expect(window.location.pathname + window.location.search).toBe('/search?q=backwoods');
  });

  it('shows approved buyers their prices on the cards, and the sign-in box to guests only', () => {
    const { unmount } = page(CATALOG, { profile: { id: 'b', status: 'approved' }, isApprovedBuyer: true, priceOf: () => 12.5, pricesStatus: 'ready' });
    expect(within(section('Tobacco')).getAllByText('$12.50')).toHaveLength(4);
    expect(screen.queryByText('Wholesale pricing is locked')).toBeNull();
    unmount();
    page();
    expect(screen.getByRole('button', { name: /Wholesale pricing is locked/ })).toBeTruthy();
  });
});
