// Admin sections and filters in the URL (AW-118): section links with
// aria-current, the Orders status filter and the Products search written to
// the query string, read back on load and on Back.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { SEARCH_DEBOUNCE_MS } = await import('./ProductsSection.jsx');
const { navigate, useRoute } = await import('../../lib/router.js');

const ADMIN = { id: 'admin-1', name: 'Desk Admin', role: 'admin', status: 'approved' };
const url = () => window.location.pathname + window.location.search;

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}
const order = (id, status) => ({
  id, ref_num: `ALW-O-${id}`, user_id: 'u1', status, created_at: '2026-10-06T15:00:00Z', business: 'Test Market', contact: 'Tess',
  email: 'tess@example.test', delivery: 'delivery', subtotal: 10, kind: 'order', profiles: null, order_items: [],
});

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/admin', { replace: true }));
  fake.reset();
  fake.tables = {
    orders: [order('A1', 'new'), order('B2', 'picking'), order('C3', 'picking')],
    profiles: [ADMIN],
    products: [
      { id: 1, name: 'Swisher Sweets', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SW', tag: null, active: true },
      { id: 2, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Pipe', sku: 'AW-KITE', tag: null, active: true },
    ],
  };
  fake.rpcData.admin_product_prices = { 1: { list: 10, variants: {} }, 2: { list: 12, variants: {} } };
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const renderAdmin = async () => { await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" />); }); };
const sectionLink = (name) => screen.getByRole('navigation', { name: 'Admin sections' }).querySelector(`a[href^="/admin/${name.toLowerCase()}"]`);

describe('admin sections (AW-118)', () => {
  it('shows Orders at /admin and links each section, marking the current one', async () => {
    await renderAdmin();
    const nav = screen.getByRole('navigation', { name: 'Admin sections' });
    expect([...nav.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-current')])).toEqual([
      ['Orders', '/admin/orders', 'page'], ['Accounts', '/admin/accounts', null], ['Products', '/admin/products', null],
      ['Pricing', '/admin/pricing', null], ['Homepage', '/admin/homepage', null],
    ]);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByText('ALW-O-A1')).toBeTruthy();
  });

  it('writes the status filter to the URL without a new history entry, and reads it back', async () => {
    await renderAdmin();
    const length = window.history.length;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^picking \(/ })); });
    expect(url()).toBe('/admin/orders?status=picking');
    expect(window.history.length).toBe(length);
    expect(screen.getByRole('button', { name: /^picking \(/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText('ALW-O-A1')).toBeNull();
    expect(screen.getByText('ALW-O-B2')).toBeTruthy();
    // The default status is not written.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^new \(/ })); });
    expect(url()).toBe('/admin/orders');
  });

  it('opens the section and filter a URL names, as after a reload, and drops what it doesn’t know', async () => {
    act(() => navigate('/admin/orders?email=tess@example.test&status=picking', { replace: true }));
    await renderAdmin();
    expect(screen.getByText('ALW-O-C3')).toBeTruthy();
    expect(screen.queryByText('ALW-O-A1')).toBeNull();
    expect(url()).toBe('/admin/orders?status=picking');
  });

  it('keeps the Products search in ?q= and gives it back after a visit to another section', async () => {
    vi.useFakeTimers();
    act(() => navigate('/admin/products', { replace: true }));
    await renderAdmin();
    const box = screen.getByRole('searchbox', { name: 'Search products' });
    fireEvent.change(box, { target: { value: 'swisher ' } });
    // Filters at once, writes the URL a moment later.
    expect(screen.getByText('1 of 2 products')).toBeTruthy();
    expect(url()).toBe('/admin/products');
    await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });
    expect(url()).toBe('/admin/products?q=swisher');
    expect(box.value).toBe('swisher ');
    // Orders, then back to Products by its link: the search is still there.
    await act(async () => { fireEvent.click(sectionLink('Orders')); });
    expect(url()).toBe('/admin/orders');
    expect(sectionLink('Products').getAttribute('href')).toBe('/admin/products?q=swisher');
    await act(async () => { fireEvent.click(sectionLink('Products')); });
    expect(screen.getByRole('searchbox', { name: 'Search products' }).value).toBe('swisher');
    expect(screen.getByText('1 of 2 products')).toBeTruthy();
  });

  it('Back returns to the previous section and its search', async () => {
    act(() => navigate('/admin/products?q=kite', { replace: true }));
    await renderAdmin();
    expect(screen.getByRole('searchbox', { name: 'Search products' }).value).toBe('kite');
    await act(async () => { fireEvent.click(sectionLink('Accounts')); });
    expect(url()).toBe('/admin/accounts');
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => { window.addEventListener('popstate', resolve, { once: true }); });
    });
    expect(url()).toBe('/admin/products?q=kite');
    expect(screen.getByRole('searchbox', { name: 'Search products' }).value).toBe('kite');
  });
});
