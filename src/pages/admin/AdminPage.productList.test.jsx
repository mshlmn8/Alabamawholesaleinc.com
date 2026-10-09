// Admin -> Products' list with the fake client (AW-115): the filters and the
// sort in the URL, sortable headers with aria-sort, pages of 50, the count
// line, inactive rows, the empty result, and the Updated column.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { resetAdminProductColumnsForTests } = await import('./ProductsSection.jsx');
const { navigate, useRoute } = await import('../../lib/router.js');

const ADMIN = { id: 'admin-1', name: 'Desk Admin', role: 'admin', status: 'approved' };
const INACTIVE = [14, 162, 250, 330];
// 368 products: TOBACCO 1-66, CANDIES after; four inactive, #162 tagged
// BESTSELLER, #2 without a photo, every tenth without a sell unit.
const ROWS = Array.from({ length: 368 }, (_, i) => {
  const id = i + 1;
  return {
    id, name: `Product ${String(id).padStart(3, '0')}`, brand: id % 2 ? 'Odd' : 'Even', cat: id <= 66 ? 'TOBACCO' : 'CANDIES',
    sub: id <= 66 ? (id <= 30 ? 'Cigars & Cigarillos' : 'Pipe Tobacco') : 'Gum', sku: `AW-T${id}`, variants: [], variant_axis: null,
    unavailable_variants: [], description: '', sell_unit: id % 10 === 0 ? '' : 'box', img: id === 2 ? null : `p${id}.jpg`,
    tag: id === 162 ? 'BESTSELLER' : (id === 5 ? 'NEW' : null), active: !INACTIVE.includes(id),
    stock_status: id === 7 ? 'low' : 'in_stock', featured_rank: null, updated_at: `2026-09-${String((id % 28) + 1).padStart(2, '0')}T12:00:00Z`,
  };
});
const url = () => window.location.pathname + window.location.search;

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/admin/products', { replace: true }));
  resetAdminProductColumnsForTests();
  fake.reset();
  fake.tables = { products: ROWS, profiles: [ADMIN], orders: [] };
  fake.rpcData.admin_product_prices = Object.fromEntries(ROWS.map((r) => [r.id, { list: r.id === 3 ? null : r.id + 0.5, variants: {} }]));
});
afterEach(() => vi.restoreAllMocks());

const renderAdmin = async (path = '/admin/products') => {
  act(() => navigate(path, { replace: true }));
  await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" onCatalogChange={vi.fn()} />); });
};
const bodyRows = () => screen.getAllByRole('row').slice(1);
// Cell 0 is the row's checkbox (AW-114), then ID, Photo, Name, Brand,
// Category, Price, Tag, Active, Updated.
const idsShown = () => bodyRows().map((r) => Number(r.cells[1].textContent));
const count = () => document.querySelector('.admin-count').textContent;
const toolbar = () => screen.getByRole('group', { name: 'Filter products' });
const choose = async (label, value) => {
  await act(async () => { fireEvent.change(within(toolbar()).getByLabelText(label), { target: { value } }); });
};

describe('the products list: counts and pages (AW-115)', () => {
  it('shows 50 rows a page, the count with the inactive ones, and Next', async () => {
    await renderAdmin();
    expect(count()).toBe('368 products · 4 inactive');
    expect(idsShown()).toHaveLength(50);
    expect(idsShown()[0]).toBe(1);
    expect(screen.getByText('Page 1 of 8')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Previous page' })).toBeNull();
    const next = screen.getByRole('link', { name: 'Next page' });
    expect(next.getAttribute('href')).toBe('/admin/products?page=2');
    const pushes = vi.spyOn(window.history, 'pushState');
    await act(async () => { fireEvent.click(next); });
    expect(url()).toBe('/admin/products?page=2');
    expect(pushes).toHaveBeenCalled();
    expect(idsShown()[0]).toBe(51);
    expect(screen.getByText('Page 2 of 8')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Previous page' }).getAttribute('href')).toBe('/admin/products');
    // The count line takes focus at the top of the new page.
    expect(document.activeElement).toBe(document.querySelector('.admin-count'));
  });

  it('opens a page from the URL, and clamps one past the end', async () => {
    await renderAdmin('/admin/products?page=8');
    expect(idsShown()).toEqual(Array.from({ length: 18 }, (_, i) => 351 + i));
    expect(screen.queryByRole('link', { name: 'Next page' })).toBeNull();
    await act(async () => { navigate('/admin/products?page=40', { replace: true }); });
    expect(screen.getByText('Page 8 of 8')).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(url()).toBe('/admin/products?page=8');
    expect(screen.getByText('Page 8 of 8')).toBeTruthy();
  });
});

describe('the products list: filters in the URL (AW-115)', () => {
  it('filters by status, department and sub-line, starting again at page 1, replacing the history entry', async () => {
    await renderAdmin('/admin/products?page=3');
    const replaces = vi.spyOn(window.history, 'replaceState');
    await choose('Status', 'inactive');
    expect(url()).toBe('/admin/products?status=inactive');
    expect(replaces).toHaveBeenCalled();
    expect(idsShown()).toEqual(INACTIVE);
    expect(count()).toBe('4 of 368 products · 4 inactive');
    await choose('Status', '');
    expect(within(toolbar()).getByLabelText('Sub-line').disabled).toBe(true);
    await choose('Department', 'tobacco');
    expect(url()).toBe('/admin/products?dept=tobacco');
    expect(count()).toBe('66 of 368 products · 1 inactive');
    const sub = within(toolbar()).getByLabelText('Sub-line');
    expect(sub.disabled).toBe(false);
    expect([...sub.options].map((o) => o.textContent)).toEqual(['All sub-lines', 'Cigars & Cigarillos', 'Pipe Tobacco']);
    await choose('Sub-line', 'pipe-tobacco');
    expect(url()).toBe('/admin/products?dept=tobacco&sub=pipe-tobacco');
    expect(count()).toBe('36 of 368 products');
    // A new department clears the sub-line.
    await choose('Department', 'candies');
    expect(url()).toBe('/admin/products?dept=candies');
  });

  it('filters by tag, no photo, no sell unit and stock status', async () => {
    await renderAdmin();
    await choose('Tag', 'bestseller');
    expect(idsShown()).toEqual([162]);
    await choose('Tag', 'none');
    expect(count()).toBe('366 of 368 products · 3 inactive');
    await choose('Tag', '');
    await act(async () => { fireEvent.click(within(toolbar()).getByLabelText('No photo')); });
    expect(url()).toBe('/admin/products?photo=none');
    expect(idsShown()).toEqual([2]);
    await act(async () => { fireEvent.click(within(toolbar()).getByLabelText('No photo')); });
    await act(async () => { fireEvent.click(within(toolbar()).getByLabelText('No sell unit')); });
    expect(url()).toBe('/admin/products?unit=none');
    expect(count()).toBe('36 of 368 products · 2 inactive');
    await choose('Stock', 'low');
    expect(url()).toBe('/admin/products?unit=none&stock=low');
    expect(screen.getByText('No products match these filters.')).toBeTruthy();
  });

  it('shows no stock filter on a database without stock_status', async () => {
    fake.respond = (request) => (request.table === 'products' && request.op === 'select' && /stock_status/.test(request.columns)
      ? { data: null, error: { code: '42703', message: 'column products.stock_status does not exist' } } : undefined);
    await renderAdmin();
    expect(within(toolbar()).queryByLabelText('Stock')).toBeNull();
  });

  it('says when nothing matches, with a Clear filters link that keeps the sort', async () => {
    await renderAdmin('/admin/products?q=nothing+like+it&tag=deal&sort=name&dir=desc');
    expect(screen.queryByRole('table')).toBeNull();
    expect(count()).toBe('0 of 368 products');
    expect(screen.getByText('No products match these filters.')).toBeTruthy();
    const clear = screen.getAllByRole('link', { name: 'Clear filters' });
    expect(clear.map((a) => a.getAttribute('href'))).toEqual(['/admin/products?sort=name&dir=desc', '/admin/products?sort=name&dir=desc']);
    await act(async () => { fireEvent.click(clear[1]); });
    expect(url()).toBe('/admin/products?sort=name&dir=desc');
    expect(screen.getByRole('searchbox', { name: 'Search products' }).value).toBe('');
    expect(count()).toBe('368 products · 4 inactive');
    expect(screen.queryByRole('link', { name: 'Clear filters' })).toBeNull();
  });

  it('searches the id exactly, the department and the sub-line', async () => {
    await renderAdmin('/admin/products?q=250');
    expect(idsShown()).toEqual([250]);
    await act(async () => { navigate('/admin/products?q=pipe+tobacco', { replace: true }); });
    expect(count()).toBe('36 of 368 products');
    await act(async () => { navigate('/admin/products?q=TOBACCO', { replace: true }); });
    expect(count()).toBe('66 of 368 products · 1 inactive');
  });
});

describe('the products list: sort (AW-115)', () => {
  const header = (name) => screen.getByRole('columnheader', { name });

  it('sorts by ID, Name, Brand, Price and Updated with a button in each header and aria-sort on the sorted one', async () => {
    await renderAdmin();
    const sortable = screen.getAllByRole('columnheader').filter((th) => th.querySelector('button.sort-button'));
    expect(sortable.map((th) => th.textContent)).toEqual(['ID', 'Name', 'Brand', 'Price', 'Updated']);
    expect(header('ID').getAttribute('aria-sort')).toBe('ascending');
    expect(screen.getAllByRole('columnheader').filter((th) => th.hasAttribute('aria-sort'))).toHaveLength(1);

    await act(async () => { fireEvent.click(within(header('Price')).getByRole('button')); });
    expect(url()).toBe('/admin/products?sort=price&dir=asc');
    expect(header('Price').getAttribute('aria-sort')).toBe('ascending');
    expect(header('ID').hasAttribute('aria-sort')).toBe(false);
    expect(idsShown().slice(0, 3)).toEqual([1, 2, 4]);
    await act(async () => { fireEvent.click(within(header('Price')).getByRole('button')); });
    expect(header('Price').getAttribute('aria-sort')).toBe('descending');
    expect(idsShown()[0]).toBe(368);

    await act(async () => { fireEvent.click(within(header('Updated')).getByRole('button')); });
    expect(url()).toBe('/admin/products?sort=updated&dir=desc');
    expect(bodyRows()[0].cells[9].querySelector('time').getAttribute('datetime')).toBe('2026-09-28T12:00:00Z');
    expect(bodyRows()[0].cells[9].textContent).toBe('Sep 28, 2026');

    // Back to ID, A to Z: the default, so no sort in the URL.
    await act(async () => { fireEvent.click(within(header('ID')).getByRole('button')); });
    expect(url()).toBe('/admin/products');
    expect(header('ID').getAttribute('aria-sort')).toBe('ascending');
    await act(async () => { fireEvent.click(within(header('ID')).getByRole('button')); });
    expect(url()).toBe('/admin/products?sort=id&dir=desc');
    expect(idsShown()[0]).toBe(368);
  });
});

describe('the products list: inactive products (AW-115)', () => {
  it('greys inactive rows, with an Inactive pill and their tag marked not shown', async () => {
    await renderAdmin('/admin/products?status=inactive');
    const rows = bodyRows();
    expect(rows.every((r) => r.className === 'inactive')).toBe(true);
    const row162 = rows.find((r) => r.cells[1].textContent === '162');
    expect(row162.cells[7].textContent).toBe('BESTSELLER (not shown)');
    expect(row162.cells[8].querySelector('.admin-pill').textContent).toBe('Inactive');
    expect(within(row162).queryByRole('link', { name: /View on site/ })).toBeNull();
    await act(async () => { navigate('/admin/products?q=162', { replace: true }); });
    await act(async () => { navigate('/admin/products', { replace: true }); });
    const active = bodyRows()[0];
    expect(active.className).toBe('');
    expect(active.cells[8].textContent).toBe('Yes');
  });
});
