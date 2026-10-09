// Admin -> Products with the fake client: unsaved edits are not dropped
// without a word (AW-118). Leaving asks, Edit on another row and Cancel ask
// with a dialog, and a search keeps the edit.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { productEditChanged, SEARCH_DEBOUNCE_MS } = await import('./ProductsSection.jsx');
const { navigate, useRoute } = await import('../../lib/router.js');

const ADMIN = { id: 'admin-1', name: 'Desk Admin', role: 'admin', status: 'approved' };
const SWISHER = { id: 1, name: 'Swisher Sweets', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SW', tag: null, active: true };
const KITE = { id: 2, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Pipe', sku: 'AW-KITE', tag: 'NEW', active: true };
const url = () => window.location.pathname + window.location.search;

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/admin/products', { replace: true }));
  fake.reset();
  fake.tables = { products: [SWISHER, KITE], profiles: [ADMIN], orders: [] };
  fake.rpcData.admin_product_prices = { 1: { list: 10, variants: {} }, 2: { list: 12.5, variants: {} } };
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const renderProducts = async () => { await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" />); }); };
const editButton = (name) => screen.getByRole('button', { name: new RegExp(`^Edit ?${name}$`) });
const editRow = () => document.querySelector('tr.editing');

describe('productEditChanged', () => {
  it('counts a changed field, not a price typed another way', () => {
    const base = { ...KITE, price: 12.5 };
    expect(productEditChanged({ ...base, priceText: '12.50' }, base)).toBe(false);
    expect(productEditChanged({ ...base, priceText: '12.5', tag: 'NEW' }, base)).toBe(false);
    expect(productEditChanged({ ...base, priceText: '13' }, base)).toBe(true);
    expect(productEditChanged({ ...base, priceText: 'abc' }, base)).toBe(true);
    expect(productEditChanged({ ...base, priceText: '12.5', active: false }, base)).toBe(true);
    expect(productEditChanged(null, base)).toBe(false);
  });
});

describe('unsaved product edits (AW-118)', () => {
  it('moves focus into the row on Edit and back to its Edit button on a clean Cancel', async () => {
    await renderProducts();
    fireEvent.click(editButton('Swisher Sweets'));
    expect(document.activeElement).toBe(within(editRow()).getByLabelText('Product name'));
    fireEvent.click(within(editRow()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(editRow()).toBeNull();
    expect(document.activeElement).toBe(editButton('Swisher Sweets'));
  });

  it('asks before Edit on another row drops the changes, and keeps them on “Keep editing”', async () => {
    await renderProducts();
    fireEvent.click(editButton('Swisher Sweets'));
    fireEvent.change(within(editRow()).getByLabelText('Price'), { target: { value: '12.34' } });
    fireEvent.click(editButton('Kite'));
    const dialog = screen.getByRole('alertdialog', { name: 'Discard your changes?' });
    expect(within(dialog).getByText('Your changes to Swisher Sweets aren’t saved.')).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Keep editing' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(editRow()).getByLabelText('Price').value).toBe('12.34');
    fireEvent.click(editButton('Kite'));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(within(editRow()).getByLabelText('Product name').value).toBe('Kite');
    expect(document.activeElement).toBe(within(editRow()).getByLabelText('Product name'));
  });

  it('asks before Cancel drops the changes', async () => {
    await renderProducts();
    fireEvent.click(editButton('Kite'));
    fireEvent.change(within(editRow()).getByLabelText('Brand'), { target: { value: 'Kite Co' } });
    fireEvent.click(within(editRow()).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Discard changes' }));
    expect(editRow()).toBeNull();
    expect(document.activeElement).toBe(editButton('Kite'));
    expect(fake.find({ op: 'update' })).toHaveLength(0);
  });

  it('asks before another section or a reload drops the changes, and a search keeps them', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await renderProducts();
    fireEvent.click(editButton('Swisher Sweets'));
    fireEvent.change(within(editRow()).getByLabelText('Price'), { target: { value: '12.34' } });
    const orders = screen.getByRole('navigation', { name: 'Admin sections' }).querySelector('a[href^="/admin/orders"]');
    await act(async () => { fireEvent.click(orders); });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(url()).toBe('/admin/products');
    expect(within(editRow()).getByLabelText('Price').value).toBe('12.34');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    // The search filters and writes ?q= without asking; the edit stays.
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), { target: { value: 'swisher' } });
    await act(async () => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });
    expect(url()).toBe('/admin/products?q=swisher');
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(within(editRow()).getByLabelText('Price').value).toBe('12.34');
  });
});
