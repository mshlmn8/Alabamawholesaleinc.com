// Admin -> Products with the fake client: an empty catalog says so instead
// of blaming the filters (AW-268).
import { act, render, screen } from '@testing-library/react';
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
