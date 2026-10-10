// Admin -> Orders past the newest 200 (AW-199), with the fake client: the
// status filter goes to the server, the pills count each status there, the
// list pages through every match (a page past the end goes to the last
// one), a moved card stays on its page, Export CSV fetches every match, and
// a page without rows still knows whether the database has the quote
// workflow.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { resetOrderStatusForTests } = await import('./OrdersSection.jsx');
const { resetOrdersSeenForTests } = await import('./ordersSeen.js');
const { POLL_MS } = await import('./liveOrders.js');
const { navigate, useRoute } = await import('../../lib/router.js');

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

const ADMIN = { id: 'a1', name: 'Desk Admin', email: 'desk@example.test', role: 'admin', status: 'approved' };
// 260 orders, newest first: 12 new, 30 contacted, 8 quoted, 120 picking, 90 fulfilled.
const MIX = [['new', 12], ['contacted', 30], ['quoted', 8], ['picking', 120], ['fulfilled', 90]];
const START = Date.parse('2026-10-08T15:00:00Z');
const orderRow = (i, status, extra = {}) => ({
  id: `o-${String(i).padStart(3, '0')}`, ref_num: `ALW-O-${String(i).padStart(10, '0')}`, user_id: 'buyer-1', status, kind: 'order',
  created_at: new Date(START - i * 60000).toISOString(), updated_at: '2026-10-08T15:00:00Z', business: `Store ${i}`, contact: 'Tess',
  email: 'tess@example.test', delivery: 'willcall', subtotal: 10, profiles: null, order_items: [], ...extra,
});
function seed(mix = MIX) {
  let i = 0;
  return mix.flatMap(([status, n]) => Array.from({ length: n }, () => orderRow(i++, status)));
}

beforeEach(() => {
  act(() => navigate('/admin/orders', { replace: true }));
  fake.reset();
  resetOrderStatusForTests();
  resetOrdersSeenForTests();
  fake.tables = { orders: seed(), profiles: [ADMIN], pricing_tiers: [] };
  fake.respond = (request) => {
    if (request.name === 'admin_set_order_status') {
      fake.tables.orders = fake.tables.orders.map((o) => (o.id === request.args.p_order_id ? { ...o, status: request.args.p_status } : o));
      return { data: { id: request.args.p_order_id, status: request.args.p_status, updated_at: '2026-10-08T16:00:00Z' }, error: null };
    }
    return undefined;
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const open = async (path) => {
  if (path) act(() => navigate(path, { replace: true }));
  await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" />); });
  await act(async () => {});
};
const url = () => window.location.pathname + window.location.search;
const pillTexts = () => [...screen.getByRole('group', { name: 'Order status' }).querySelectorAll('button')].map((b) => b.textContent);
const pill = (name) => screen.getByRole('button', { name: new RegExp(`^${name} \\(`) });
const countLine = () => document.querySelector('.admin-count');
const cards = () => document.querySelectorAll('.order-list article');
const pageRequests = () => fake.find({ table: 'orders', op: 'select' }).filter((c) => !c.options?.head && c.columns !== 'kind' && c.options?.count);
const countRequests = () => fake.find({ table: 'orders', op: 'select' }).filter((c) => c.options?.head);
const wait = async (ms = 10) => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); }); };

describe('the status pills (AW-199)', () => {
  it('count each status on the server, with the toolbar’s filters, past the newest 200', async () => {
    await open();
    expect(pillTexts()).toEqual([
      'New (12)', 'Contacted (30)', 'Quoted (8)', 'Confirmed (0)', 'Picking (120)', 'Ready (0)', 'Out for delivery (0)', 'Fulfilled (90)',
      'Cancelled (0)', 'All (260)',
    ]);
    // The default status is asked of the server: 12 cards, not 260 filtered here.
    expect(pageRequests().at(-1).filters).toEqual([['eq', 'status', 'new']]);
    expect(cards()).toHaveLength(12);
    expect(countLine().textContent).toBe('12 orders');
    expect(countRequests().map((c) => c.filters)).toEqual([
      ...['new', 'contacted', 'quoted', 'confirmed', 'picking', 'ready', 'out_for_delivery', 'fulfilled', 'cancelled'].map((s) => [['eq', 'status', s]]),
      [],
    ]);
    // A toolbar filter goes into the counts too.
    fake.calls.length = 0;
    await act(async () => { fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'delivery' } }); });
    expect(countRequests().every((c) => c.filters[0][0] === 'eq' && c.filters[0][1] === 'delivery')).toBe(true);
    expect(pageRequests().at(-1).filters).toEqual([['eq', 'delivery', 'delivery'], ['eq', 'status', 'new']]);
  });

  it('show … for a count that didn’t load', async () => {
    const respond = fake.respond;
    fake.respond = (request) => (request.options?.head && request.filters.some(([, , value]) => value === 'quoted')
      ? { data: null, error: { code: '', message: 'TypeError: Failed to fetch' } } : respond(request));
    await open();
    expect(pillTexts().slice(0, 4)).toEqual(['New (12)', 'Contacted (30)', 'Quoted (…)', 'Confirmed (0)']);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('count again after a status change, and the moved card stays on its page through a live reload', async () => {
    vi.useFakeTimers();
    await open();
    const first = cards()[0];
    const ref = first.querySelector('.order-ref').textContent;
    await act(async () => { fireEvent.change(within(first).getByRole('combobox', { name: `Status for ${ref}` }), { target: { value: 'contacted' } }); });
    expect(pill('New').textContent).toBe('New (11)');
    expect(pill('Contacted').textContent).toBe('Contacted (31)');
    expect(within(cards()[0]).getByText('Moved to Contacted')).toBeTruthy();
    // The server no longer sends it for "new"; the reload keeps it.
    await act(async () => { vi.advanceTimersByTime(POLL_MS); });
    await act(async () => {});
    expect(cards()).toHaveLength(12);
    expect(screen.getByText(ref, { selector: '.order-ref' }).closest('article').textContent).toContain('Moved to Contacted');
    expect(countLine().textContent).toBe('11 orders');
    // Refresh lets it go.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh' })); });
    expect(cards()).toHaveLength(11);
  });
});

describe('the pages (AW-199)', () => {
  it('move through every match with Previous and Next, and focus the count line', async () => {
    await open('/admin/orders?status=picking');
    expect(countLine().textContent).toBe('Page 1 of 3 · 120 orders');
    expect(cards()).toHaveLength(50);
    expect(pageRequests().at(-1).modifiers.at(-1)).toEqual(['range', 0, 49]);
    const pager = screen.getByRole('navigation', { name: 'Order pages' });
    expect(within(pager).queryByRole('link', { name: 'Previous page' })).toBeNull();
    const next = within(pager).getByRole('link', { name: 'Next page' });
    expect(next.getAttribute('href')).toBe('/admin/orders?status=picking&page=2');
    const entries = window.history.length;
    await act(async () => { fireEvent.click(next); });
    await act(async () => {});
    expect(url()).toBe('/admin/orders?status=picking&page=2');
    expect(window.history.length).toBe(entries + 1);
    expect(pageRequests().at(-1).modifiers.at(-1)).toEqual(['range', 50, 99]);
    expect(countLine().textContent).toBe('Page 2 of 3 · 120 orders');
    expect(document.activeElement).toBe(countLine());
    expect(cards()[0].querySelector('.order-ref').textContent).toBe('ALW-O-0000000100');
    expect(within(screen.getByRole('navigation', { name: 'Order pages' })).getByRole('link', { name: 'Previous page' }).getAttribute('href'))
      .toBe('/admin/orders?status=picking');
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Next page' })); });
    await act(async () => {});
    expect(cards()).toHaveLength(20);
    expect(screen.queryByRole('link', { name: 'Next page' })).toBeNull();
    expect(screen.getByText('Page 3 of 3', { selector: '.admin-pager-text' })).toBeTruthy();
  });

  it('start again at page 1 when the status or a filter changes', async () => {
    await open('/admin/orders?status=picking&page=2');
    expect(countLine().textContent).toBe('Page 2 of 3 · 120 orders');
    await act(async () => { fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'willcall' } }); });
    expect(url()).toBe('/admin/orders?status=picking&method=willcall');
    act(() => navigate('/admin/orders?status=picking&page=3', { replace: true }));
    await act(async () => {});
    await act(async () => { fireEvent.click(pill('Fulfilled')); });
    expect(url()).toBe('/admin/orders?status=fulfilled');
    expect(countLine().textContent).toBe('Page 1 of 2 · 90 orders');
  });

  it('go to the last page from a page past the end', async () => {
    // The load, then the move a moment later, then the load of that page.
    const settle = async () => { await act(async () => {}); await wait(); await act(async () => {}); };
    await open('/admin/orders?status=picking&page=9');
    await settle();
    expect(url()).toBe('/admin/orders?status=picking&page=3');
    expect(countLine().textContent).toBe('Page 3 of 3 · 120 orders');
    expect(cards()).toHaveLength(20);
    expect(screen.queryByRole('alert')).toBeNull();
    // With nothing to show at all, page 1.
    act(() => navigate('/admin/orders?status=ready&page=4', { replace: true }));
    await settle();
    expect(url()).toBe('/admin/orders?status=ready');
    expect(screen.getByText('No orders in this state.')).toBeTruthy();
  });

  it('say "new orders came in" only on page 1', async () => {
    vi.useFakeTimers();
    await open('/admin/orders?status=picking&page=2');
    // A new order is placed: page 2's rows each move down one.
    fake.tables.orders = [orderRow(-1, 'picking', { id: 'o-fresh', ref_num: 'ALW-O-FRESH00001' }), ...fake.tables.orders];
    await act(async () => { vi.advanceTimersByTime(POLL_MS); });
    await act(async () => {});
    expect(screen.getByRole('status').textContent).toBe('');
    act(() => navigate('/admin/orders?status=picking', { replace: true }));
    await act(async () => {});
    fake.tables.orders = [orderRow(-2, 'picking', { id: 'o-fresh2', ref_num: 'ALW-O-FRESH00002' }), ...fake.tables.orders];
    await act(async () => { vi.advanceTimersByTime(POLL_MS); });
    await act(async () => {});
    expect(screen.getByRole('status').textContent).toBe('1 new order came in.');
  });
});

describe('Export CSV (AW-199)', () => {
  it('fetches every order the filters and the status match, not just the page, and turns itself off meanwhile', async () => {
    const blobs = [];
    URL.createObjectURL = vi.fn((blob) => { blobs.push(blob); return 'blob:aw/1'; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await open('/admin/orders?status=picking');
    let release;
    const respond = fake.respond;
    // The export's request waits for release().
    const picking = fake.tables.orders.filter((o) => o.status === 'picking');
    fake.respond = (request) => (request.table === 'orders' && !request.options && request.modifiers.some(([n]) => n === 'range')
      ? new Promise((resolve) => { release = () => resolve({ data: picking, error: null }); }) : respond(request));
    const button = screen.getByRole('button', { name: 'Export CSV of 120 orders' });
    await act(async () => { fireEvent.click(button); });
    expect(button.disabled).toBe(true);
    expect(button.textContent).toMatch(/^Exporting…/);
    await act(async () => { release(); });
    const exports = fake.find({ table: 'orders', op: 'select' }).filter((c) => !c.options);
    expect(exports.map((c) => [c.filters, c.modifiers.at(-1)])).toEqual([[[['eq', 'status', 'picking']], ['range', 0, 999]]]);
    const lines = (await blobs[0].text()).replace(/^\uFEFF/, '').trim().split('\r\n');
    // The header and one record per order (these have no lines).
    expect(lines).toHaveLength(121);
    expect(button.disabled).toBe(false);
    expect(screen.getByRole('status').textContent).toMatch(/^Exported 120 orders to orders-\d{4}-\d{2}-\d{2}\.csv\.$/);
  });

  it('says so when the export didn’t load, and downloads nothing', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:aw/1');
    await open('/admin/orders?status=picking');
    const respond = fake.respond;
    fake.respond = (request) => (request.table === 'orders' && !request.options && request.modifiers.some(([n]) => n === 'range')
      ? { data: null, error: { code: '', message: 'TypeError: Failed to fetch' } } : respond(request));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Export CSV of 120 orders' })); });
    expect(screen.getByRole('alert').textContent).toBe('The export didn’t finish: the database couldn’t be reached. Check the connection and try again.');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe('a page without rows (AW-199)', () => {
  it('asks once whether the database has the quote workflow', async () => {
    await open('/admin/orders?status=ready');
    expect(fake.find({ table: 'orders', columns: 'kind' })).toHaveLength(1);
    expect(pillTexts()).toHaveLength(10);
    expect(screen.getByText('No orders in this state.')).toBeTruthy();
    // Known from then on.
    await act(async () => { fireEvent.click(pill('Confirmed')); });
    expect(fake.find({ table: 'orders', columns: 'kind' })).toHaveLength(1);
  });

  it('offers the four old statuses on a database without kind', async () => {
    fake.tables.orders = seed([['new', 3], ['contacted', 2]]).map((row) => {
      const copy = { ...row };
      delete copy.kind;
      return copy;
    });
    const respond = fake.respond;
    fake.respond = (request) => (request.columns === 'kind'
      ? { data: null, error: { code: '42703', message: 'column orders.kind does not exist' } } : respond(request));
    await open('/admin/orders?status=fulfilled');
    expect(pillTexts()).toEqual(['New (3)', 'Contacted (2)', 'Fulfilled (0)', 'Cancelled (0)', 'All (5)']);
    expect(screen.getByText('No orders in this state.')).toBeTruthy();
  });
});
