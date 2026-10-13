// Admin -> Products with the fake client: the SKU and variant-count columns
// (AW-106), and an empty catalog says so instead of blaming the filters
// (AW-268).
import { act, render, screen, within } from '@testing-library/react';
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
const SWISHER = {
  id: 1, name: 'Swisher Sweets', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', sku: 'AW-SS', variants: ['Grape', 'Wine', 'Original', 'Peach'],
  variant_axis: 'flavor', unavailable_variants: [], description: '', sell_unit: 'box', img: null, tag: null, active: true, updated_at: '2026-09-28T12:00:00Z',
};
const KITE = { ...SWISHER, id: 2, name: 'Kite', brand: 'Kite', sub: 'Pipe Tobacco', sku: 'AW-KITE', variants: [], variant_axis: null };

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  resetAdminProductColumnsForTests();
  fake.reset();
  fake.tables = { products: [SWISHER, KITE], profiles: [ADMIN], orders: [] };
  fake.rpcData.admin_product_prices = { 1: { list: 10.5, variants: {} }, 2: { list: 12, variants: {} } };
});
afterEach(() => vi.restoreAllMocks());

const renderAdmin = async (path = '/admin/products') => {
  act(() => navigate(path, { replace: true }));
  await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" onCatalogChange={vi.fn()} />); });
};

const headers = () => [...document.querySelectorAll('table.admin-products thead th')].map((th) => th.textContent);
const rowOf = (id) => [...document.querySelectorAll('table.admin-products tbody tr')].find((tr) => tr.cells[1].textContent === String(id));

describe('the SKU and Variants columns (AW-106)', () => {
  it('shows each product’s SKU after its name, and how many variants it has', async () => {
    await renderAdmin();
    expect(headers()).toEqual(['Select all 2 filtered', 'ID', 'Photo', 'Name', 'SKU', 'Brand', 'Category', 'Variants', 'Price', 'Tag', 'Active', 'Updated', 'Actions']);
    const swisher = rowOf(1);
    expect(swisher.cells[4].querySelector('code').textContent).toBe('AW-SS');
    expect(swisher.cells[7].textContent).toBe('4');
    expect(swisher.cells[8].textContent).toBe('$10.50');
    expect(rowOf(2).cells[7].textContent).toBe('—');
    // The table scrolls in a named region the keyboard can reach (AW-266).
    expect(screen.getByRole('region', { name: 'Products table' }).tabIndex).toBe(0);
  });

  it('lets a SKU search show the SKU that matched', async () => {
    await renderAdmin('/admin/products?q=aw-kite');
    const rows = within(document.querySelector('table.admin-products tbody')).getAllByRole('row');
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText('AW-KITE', { selector: 'code' })).toBeTruthy();
  });

  it('shows a dash for a product without a SKU', async () => {
    fake.tables.products = [{ ...KITE, sku: null }];
    await renderAdmin();
    expect(rowOf(2).cells[4].textContent).toBe('—');
  });
});

describe('an empty catalog (AW-268)', () => {
  it('says no products loaded, not that the filters match nothing', async () => {
    fake.tables.products = [];
    fake.rpcData.admin_product_prices = {};
    await renderAdmin();
    expect(screen.getByText('No products loaded. Check the catalog connection.')).toBeTruthy();
    expect(screen.queryByText('No products match these filters.')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('still blames the filters when products are loaded', async () => {
    await renderAdmin('/admin/products?q=nothing');
    expect(screen.getByText('No products match these filters.')).toBeTruthy();
    expect(screen.queryByText('No products loaded. Check the catalog connection.')).toBeNull();
  });

  it('shows only the load problem when the catalog didn’t load', async () => {
    fake.respond = (request) => (request.table === 'products' ? { data: null, error: { code: '500', message: 'boom' } } : undefined);
    await renderAdmin();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeTruthy();
    expect(screen.queryByText('No products loaded. Check the catalog connection.')).toBeNull();
  });
});
