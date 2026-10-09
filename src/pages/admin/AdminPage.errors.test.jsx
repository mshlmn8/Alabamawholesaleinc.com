// Every admin load and write checks its result (AW-202): failed loads show
// the error with Try again instead of an empty list, refused writes say so
// (a write that reaches no row too), and successes are announced.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { STATUS_MS } = await import('./AdminStatus.jsx');
const { resetOrderStatusForTests } = await import('./OrdersSection.jsx');
const { navigate } = await import('../../lib/router.js');

const ADMIN = { id: 'admin-1', name: 'Desk Admin', business: 'Alabama Wholesale', role: 'admin', status: 'approved', pricing_tier: 'standard' };
const BUYER = { id: 'buyer-1', name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', role: 'customer', status: 'pending', pricing_tier: 'standard' };
const ORDER = {
  id: 'o1', ref_num: 'ALW-O-AAAA111122', user_id: 'buyer-1', status: 'new', created_at: '2026-10-06T15:00:00Z', business: 'Test Market LLC', contact: 'Tess',
  email: 'tess@example.test', delivery: 'delivery', subtotal: 21.7, total_units: 2, kind: 'order', profiles: null, order_items: [],
};
const KITE = { id: 2, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Pipe', sku: 'AW-KITE', tag: null, active: true };
const failing = new Set();
const FAILURES = {
  network: { data: null, error: { message: 'TypeError: Failed to fetch' } },
  refused: { data: null, error: { code: '42501', message: 'permission denied' }, status: 403 },
  'no rows': { data: [], error: null, status: 200 },
  expired: { data: null, error: { code: 'PGRST303', message: 'JWT expired' }, status: 401 },
};
let writeFailure = null;
// The live database has no admin_set_order_status (20261010122000): status
// changes are the plain update.
let statusFunction = 'missing';

beforeEach(() => {
  act(() => navigate('/admin', { replace: true }));
  fake.reset();
  resetOrderStatusForTests();
  failing.clear();
  writeFailure = null;
  statusFunction = 'missing';
  fake.tables = { orders: [ORDER], profiles: [ADMIN, BUYER], products: [KITE], profile_documents: [] };
  fake.rpcData.admin_product_prices = { 2: { list: 12.5, variants: {} } };
  fake.respond = (request) => {
    if (failing.has(request.table || request.name)) return FAILURES.network;
    if (request.op === 'update' && writeFailure) return FAILURES[writeFailure];
    if (request.name === 'admin_set_order_status' && statusFunction === 'missing') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
    return undefined;
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const open = async (section) => {
  await act(async () => { render(<AdminPage profile={ADMIN} account="ready" route={{ page: 'admin', section, query: {} }} />); });
};
const tryAgain = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })); }); };
const statusText = () => screen.getByRole('status').textContent;

describe('failed loads (AW-202)', () => {
  it('Orders: shows the error and Try again, never "No orders in this state."', async () => {
    failing.add('orders');
    await open('orders');
    expect(screen.getByRole('alert').textContent).toMatch(/^The orders didn’t load: the database couldn’t be reached/);
    expect(screen.queryByText('No orders in this state.')).toBeNull();
    failing.delete('orders');
    await tryAgain();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('ALW-O-AAAA111122')).toBeTruthy();
  });

  it('Accounts: shows the error and Try again instead of an empty table', async () => {
    failing.add('profiles');
    await open('accounts');
    expect(screen.getByRole('alert').textContent).toMatch(/^The accounts didn’t load/);
    expect(screen.queryByRole('table')).toBeNull();
    failing.delete('profiles');
    await tryAgain();
    expect(screen.getByRole('cell', { name: 'Test Market LLC' })).toBeTruthy();
  });

  it('Accounts: a failed documents load says so, not "Not on file"', async () => {
    failing.add('profile_documents');
    await open('accounts');
    expect(screen.getByRole('alert').textContent).toMatch(/^The licence documents didn’t load/);
    const row = screen.getByRole('cell', { name: 'Test Market LLC' }).closest('tr');
    expect(within(row).queryByText('Not on file')).toBeNull();
    expect(within(row).getAllByText('Couldn’t check')).toHaveLength(2);
    failing.delete('profile_documents');
    await tryAgain();
    expect(within(row).getAllByText('Not on file')).toHaveLength(2);
  });

  it('Products: shows the error and Try again, never "0 products"', async () => {
    failing.add('products');
    await open('products');
    expect(screen.getByRole('alert').textContent).toMatch(/^The products didn’t load/);
    expect(screen.queryByText(/0 products/)).toBeNull();
    failing.delete('products');
    await tryAgain();
    expect(screen.getByText('1 product')).toBeTruthy();
  });
});

describe('checked writes (AW-202)', () => {
  it('a status change that reaches no row is an error, and the select goes back', async () => {
    await open('orders');
    writeFailure = 'no rows';
    const select = screen.getByRole('combobox', { name: 'Status for ALW-O-AAAA111122' });
    await act(async () => { fireEvent.change(select, { target: { value: 'picking' } }); });
    expect(fake.find({ op: 'update' })[0]).toMatchObject({ table: 'orders', patch: { status: 'picking' }, returning: 'id' });
    expect(screen.getByRole('alert').textContent).toBe('ALW-O-AAAA111122: The change wasn’t saved. Try again.');
    expect(screen.getByRole('combobox', { name: 'Status for ALW-O-AAAA111122' }).value).toBe('new');
  });

  it('a saved status change is announced, and the notice clears after 8 seconds', async () => {
    vi.useFakeTimers();
    await open('orders');
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Status for ALW-O-AAAA111122' }), { target: { value: 'contacted' } });
    });
    expect(statusText()).toBe('ALW-O-AAAA111122 is now contacted.');
    await act(async () => { vi.advanceTimersByTime(STATUS_MS); });
    expect(statusText()).toBe('');
  });

  it('an ended session says so', async () => {
    await open('accounts');
    writeFailure = 'expired';
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Approve ?Test Market LLC$/ })); });
    expect(screen.getByRole('alert').textContent).toBe('Your session ended. Sign in again.');
  });

  it('approving is announced', async () => {
    await open('accounts');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Approve ?Test Market LLC$/ })); });
    // The whole row comes back, with the approval stamp.
    expect(fake.find({ op: 'update' })[0]).toMatchObject({ table: 'profiles', patch: { status: 'approved' }, returning: '*' });
    expect(statusText()).toBe('Test Market LLC is now approved.');
  });

  it('a refused product save keeps the editor and what was typed (AW-023)', async () => {
    await act(async () => {
      render(<AdminPage profile={ADMIN} account="ready" route={{ page: 'admin', section: 'products', id: 2, query: {} }} />);
    });
    const price = screen.getByLabelText('List price');
    fireEvent.change(price, { target: { value: '13.40' } });
    const save = async () => { await act(async () => { fireEvent.submit(document.querySelector('form.product-form')); }); };
    writeFailure = 'refused';
    await save();
    expect(screen.getByRole('alert').textContent).toBe('The changes to Kite weren’t saved: your account isn’t allowed to do that.');
    expect(screen.getByLabelText('List price').value).toBe('13.40');
    writeFailure = 'no rows';
    await save();
    expect(screen.getByRole('alert').textContent).toBe('The changes to Kite weren’t saved. Try again.');
    writeFailure = null;
    await save();
    expect(fake.find({ op: 'update' }).at(-1)).toMatchObject({ table: 'products', patch: { price: 13.4 }, returning: 'id' });
    expect(statusText()).toBe('Saved Kite.');
  });
});
