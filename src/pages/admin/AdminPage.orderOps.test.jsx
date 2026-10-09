// Admin -> Orders' operations (AW-110, AW-111) with a fake Supabase client:
// the toolbar (dates, method and account in the URL, the search never),
// status changes through admin_set_order_status with a cancellation reason
// (and the plain update on a database without it), "Staff notes and
// history" (lazy, notes, optimistic assignment), CSV export, the print view,
// live updates that keep an open editor, and the New marker.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { AdminPage } = await import('./AdminPage.jsx');
const { resetOrderStatusForTests, ORDER_SEARCH_DEBOUNCE_MS } = await import('./OrdersSection.jsx');
const { resetOrdersSeenForTests } = await import('./ordersSeen.js');
const { orderSearchFilter } = await import('./orderQueries.js');
const { POLL_MS } = await import('./liveOrders.js');
const { navigate, useRoute } = await import('../../lib/router.js');

function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

const ADMIN = { id: 'a1', name: 'Desk Admin', email: 'desk@example.test', role: 'admin', status: 'approved' };
const PAT = { id: 'a2', name: 'Pat Picker', email: 'pat@example.test', role: 'admin', status: 'approved' };
const MISSING_FUNCTION = { code: 'PGRST202', message: 'Could not find the function' };
const MISSING_TABLE = { code: 'PGRST205', message: 'Could not find the table' };
const ORDER_ID = '11111111-2222-4333-8444-000000000001';
const order = (extra = {}) => ({
  id: ORDER_ID, ref_num: 'ALW-O-BBBB222233', user_id: 'buyer-1', status: 'new', created_at: '2026-10-08T15:00:00Z', updated_at: '2026-10-08T15:00:00Z',
  business: 'Test Market', contact: 'Tess', email: 'tess@example.test', phone: '205-555-0100', delivery: 'delivery', preferred_date: '2026-10-10',
  subtotal: 21.7, kind: 'order', assigned_to: null, notes: 'Back door', profiles: { business: 'Test Market LLC', pricing_tier: 'silver' },
  order_items: [{ id: 301, product_id: 45, product_name: 'Argo corn starch', sku: 'AW-ARGO-CORN-STARCH', variant: null, qty: 2, unit_price: 10.85 }],
  ...extra,
});
const quote = (extra = {}) => order({
  id: '11111111-2222-4333-8444-000000000002', ref_num: 'ALW-Q-5E4F3A2B1C', user_id: null, kind: 'quote', subtotal: null, created_at: '2026-10-07T15:00:00Z',
  business: 'Guest Mart', contact: 'Gus', email: 'gus@example.test', delivery: 'willcall', profiles: null,
  order_items: [{ id: 101, product_id: 14, product_name: 'Kite cigarette tobacco', sku: 'AW-KITE', variant: null, qty: 2, unit_price: null }], ...extra,
});

const db = { rpcError: {}, updateResult: null, tableError: {} };
beforeEach(() => {
  act(() => navigate('/admin/orders?status=all', { replace: true }));
  fake.reset();
  resetOrderStatusForTests();
  resetOrdersSeenForTests();
  db.rpcError = {};
  db.updateResult = null;
  db.tableError = {};
  fake.tables = { orders: [order(), quote()], profiles: [ADMIN, PAT], pricing_tiers: [], order_events: [], order_admin_notes: [] };
  fake.rpcData.admin_mark_orders_seen = '2026-10-07T20:00:00Z';
  fake.respond = (request) => {
    if (request.kind === 'rpc' && db.rpcError[request.name]) return { data: null, error: db.rpcError[request.name] };
    if (request.table && db.tableError[request.table]) return { data: null, error: db.tableError[request.table] };
    if (request.op === 'update' && db.updateResult) return db.updateResult(request);
    if (request.op === 'insert' && request.table === 'order_admin_notes') {
      return { data: { id: 77, author: 'a1', created_at: new Date().toISOString(), who: { name: 'Desk Admin' }, ...request.rows }, error: null };
    }
    return undefined;
  };
});
afterEach(async () => {
  vi.useRealTimers();
  // ConfirmDialog's history entry is removed asynchronously.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  vi.restoreAllMocks();
});

const open = async () => {
  await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" />); });
};
const card = (ref) => screen.getByText(ref, { selector: '.order-ref' }).closest('article');
const orderSelects = () => fake.find({ table: 'orders', op: 'select' }).filter((c) => c.columns !== 'id');
const lastOrderSelect = () => orderSelects().at(-1);
const field = (label) => within(screen.getByRole('group', { name: 'Filter orders' })).getByLabelText(label);
const openStaff = async (ref) => {
  const details = card(ref).querySelector('details.order-staff');
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
  });
  await act(async () => {});
  return details;
};

describe('the toolbar (AW-110)', () => {
  it('puts the dates, the method and the account in the URL, and queries the server with them', async () => {
    await open();
    expect(lastOrderSelect().modifiers).toEqual([['order', 'created_at', { ascending: false }], ['limit', 200]]);
    const entries = window.history.length;
    await act(async () => { fireEvent.change(field('Placed from'), { target: { value: '2026-10-01' } }); });
    await act(async () => { fireEvent.change(field('Placed to'), { target: { value: '2026-10-07' } }); });
    await act(async () => { fireEvent.change(field('Deliver on'), { target: { value: '2026-10-10' } }); });
    await act(async () => { fireEvent.change(field('Method'), { target: { value: 'willcall' } }); });
    expect(window.location.pathname + window.location.search).toBe('/admin/orders?status=all&from=2026-10-01&to=2026-10-07&on=2026-10-10&method=willcall');
    const filters = lastOrderSelect().filters;
    expect(filters.map(([name, column]) => `${name}:${column}`)).toEqual(['gte:created_at', 'lt:created_at', 'eq:preferred_date', 'eq:delivery']);
    expect(filters[3]).toEqual(['eq', 'delivery', 'willcall']);
    // Filters replace the history entry instead of adding one.
    expect(window.history.length).toBe(entries);
    await act(async () => { fireEvent.click(screen.getAllByRole('link', { name: 'Clear filters' })[0]); });
    expect(window.location.search).toBe('?status=all');
  });

  it('keeps the search out of the URL, waits for typing to stop, and escapes it', async () => {
    vi.useFakeTimers();
    await open();
    const before = orderSelects().length;
    await act(async () => { fireEvent.change(field('Search orders'), { target: { value: 'Mart, "Big"' } }); });
    expect(orderSelects()).toHaveLength(before);
    await act(async () => { vi.advanceTimersByTime(ORDER_SEARCH_DEBOUNCE_MS); });
    expect(lastOrderSelect().filters).toEqual([['or', orderSearchFilter('Mart, "Big"')]]);
    expect(window.location.search).toBe('?status=all');
    expect(screen.getByRole('link', { name: 'Clear filters' })).toBeTruthy();
    // The search survives a visit to another section (AdminPage keeps it).
    await act(async () => { navigate('/admin/accounts'); });
    await act(async () => { navigate('/admin/orders?status=all'); });
    expect(field('Search orders').value).toBe('Mart, "Big"');
  });

  it('says when the newest 200 came back, and filters by account from the URL', async () => {
    fake.tables.orders = Array.from({ length: 200 }, (_, i) => order({ id: `o${i}`, ref_num: `ALW-O-${i}`, user_id: '11111111-2222-4333-8444-555555555555' }));
    // (The 'picking' pill shows none of them, so the test doesn't draw 200 cards.)
    await act(async () => { navigate(`/admin/orders?status=picking&account=11111111-2222-4333-8444-555555555555`, { replace: true }); });
    await open();
    expect(screen.getByText('Showing the newest 200 matching orders.')).toBeTruthy();
    expect(lastOrderSelect().filters).toEqual([['eq', 'user_id', '11111111-2222-4333-8444-555555555555']]);
    expect(screen.getByText('Orders of Test Market LLC.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Show every account' }).getAttribute('href')).toBe('/admin/orders?status=picking');
  });
});

describe('status changes', () => {
  it('go through admin_set_order_status', async () => {
    await open();
    await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: 'Status for ALW-O-BBBB222233' }), { target: { value: 'picking' } }); });
    expect(fake.find({ kind: 'rpc', name: 'admin_set_order_status' }).map((c) => c.args)).toEqual([{ p_order_id: ORDER_ID, p_status: 'picking', p_note: null }]);
    expect(fake.find({ op: 'update' })).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toBe('ALW-O-BBBB222233 marked Picking.');
  });

  it('ask for a reason before cancelling, and send it', async () => {
    await open();
    await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: 'Status for ALW-O-BBBB222233' }), { target: { value: 'cancelled' } }); });
    const dialog = screen.getByRole('alertdialog', { name: 'Cancel ALW-O-BBBB222233 for Test Market LLC?' });
    expect(fake.find({ kind: 'rpc', name: 'admin_set_order_status' })).toHaveLength(0);
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel the order' })); });
    expect(within(dialog).getByText('Enter reason for cancelling to continue.')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Reason for cancelling'), { target: { value: 'Duplicate order' } });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel the order' })); });
    expect(fake.find({ kind: 'rpc', name: 'admin_set_order_status' }).map((c) => c.args)).toEqual([{ p_order_id: ORDER_ID, p_status: 'cancelled', p_note: 'Duplicate order' }]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('keep the order when the dialog is dismissed', async () => {
    await open();
    await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: 'Status for ALW-O-BBBB222233' }), { target: { value: 'cancelled' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep it' })); });
    expect(screen.getByRole('combobox', { name: 'Status for ALW-O-BBBB222233' }).value).toBe('new');
    expect(fake.find({ kind: 'rpc', name: 'admin_set_order_status' })).toHaveLength(0);
  });

  it('fall back to the plain update without the function, and say a reason wasn’t saved', async () => {
    db.rpcError.admin_set_order_status = MISSING_FUNCTION;
    await open();
    await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: 'Status for ALW-O-BBBB222233' }), { target: { value: 'cancelled' } }); });
    fireEvent.change(screen.getByLabelText('Reason for cancelling'), { target: { value: 'Duplicate order' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel the order' })); });
    expect(fake.find({ op: 'update' }).map((c) => c.patch)).toEqual([{ status: 'cancelled' }]);
    expect(screen.getByRole('status').textContent).toBe('ALW-O-BBBB222233 marked Cancelled. The reason wasn’t saved: notes and history need the October 2026 database update (see BACKEND.md).');
    // The missing function is not asked for again.
    await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: 'Status for ALW-O-BBBB222233' }), { target: { value: 'contacted' } }); });
    expect(fake.find({ kind: 'rpc', name: 'admin_set_order_status' })).toHaveLength(1);
    expect(fake.find({ op: 'update' })).toHaveLength(2);
  });

  it('show the database’s refusal', async () => {
    db.rpcError.admin_set_order_status = { code: '22023', message: 'reason', hint: 'reason_required' };
    await open();
    await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: 'Status for ALW-O-BBBB222233' }), { target: { value: 'picking' } }); });
    expect(screen.getByRole('alert').textContent).toBe('ALW-O-BBBB222233: Give a reason for cancelling the order.');
  });
});

describe('staff notes and history', () => {
  beforeEach(() => {
    fake.tables.order_events = [
      { id: 1, order_id: ORDER_ID, at: '2026-10-08T15:30:00Z', actor: 'a1', kind: 'status', from_value: 'new', to_value: 'contacted', note: null, who: { name: 'Desk Admin' } },
      { id: 2, order_id: ORDER_ID, at: '2026-10-08T16:00:00Z', actor: 'a1', kind: 'status', from_value: 'contacted', to_value: 'cancelled', note: 'Store closed', who: { name: 'Desk Admin' } },
    ];
    fake.tables.order_admin_notes = [{ id: 5, order_id: ORDER_ID, author: 'a2', body: 'Gate code 1234', created_at: '2026-10-08T15:45:00Z', who: { name: 'Pat Picker' } }];
  });

  it('load only when opened, and show the merged history', async () => {
    await open();
    expect(fake.find({ table: 'order_events' })).toHaveLength(0);
    const details = await openStaff('ALW-O-BBBB222233');
    expect(fake.find({ table: 'order_events' })[0].filters).toEqual([['eq', 'order_id', ORDER_ID]]);
    const lines = [...details.querySelectorAll('.order-timeline-line')].map((p) => p.textContent);
    expect(lines.map((l) => l.replace(/ · .*$/, ''))).toEqual(['Cancelled by Desk Admin', 'Note by Pat Picker', 'Contacted by Desk Admin']);
    expect(lines[2]).toMatch(/^Contacted by Desk Admin · Oct 8, \d{1,2}:30 [AP]M$/);
    expect([...details.querySelectorAll('.order-timeline-text')].map((p) => p.textContent)).toEqual(['Store closed', 'Gate code 1234']);
  });

  it('add a note, with an inline error for an empty one', async () => {
    await open();
    const details = await openStaff('ALW-O-BBBB222233');
    const box = within(details).getByLabelText('Add a staff note');
    await act(async () => { fireEvent.click(within(details).getByRole('button', { name: 'Add note' })); });
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(details.querySelector('.order-note-form .form-error').textContent).toBe('Write the note first.');
    expect(box.getAttribute('aria-describedby')).toContain(details.querySelector('.order-note-form .form-error').id);
    fireEvent.change(box, { target: { value: '  Call before delivery  ' } });
    await act(async () => { fireEvent.click(within(details).getByRole('button', { name: 'Add note' })); });
    expect(fake.find({ table: 'order_admin_notes', op: 'insert' })[0].rows).toEqual({ order_id: ORDER_ID, body: 'Call before delivery' });
    expect(box.value).toBe('');
    expect(details.querySelector('.order-timeline-text').textContent).toBe('Call before delivery');
    expect(screen.getByRole('status').textContent).toBe('Added a note to ALW-O-BBBB222233.');
  });

  it('say they need the October 2026 update when the tables are missing, and hide "Assigned to" without the column', async () => {
    db.tableError.order_events = MISSING_TABLE;
    // Rows from a database without orders.assigned_to.
    fake.tables.orders = [order(), quote()].map((row) => {
      const copy = { ...row };
      delete copy.assigned_to;
      return copy;
    });
    await open();
    const details = await openStaff('ALW-O-BBBB222233');
    expect(within(details).getByText('Notes and history need the October 2026 database update (see BACKEND.md).')).toBeTruthy();
    expect(within(details).queryByLabelText('Assigned to')).toBeNull();
    expect(within(details).queryByLabelText('Add a staff note')).toBeNull();
  });

  it('assign the order at once, and put it back with the reason when the database refuses', async () => {
    await open();
    const details = await openStaff('ALW-O-BBBB222233');
    const select = within(details).getByLabelText('Assigned to');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Nobody', 'Desk Admin', 'Pat Picker']);
    expect(fake.find({ table: 'profiles' }).at(-1).filters).toEqual([['eq', 'role', 'admin'], ['eq', 'status', 'approved']]);
    await act(async () => { fireEvent.change(select, { target: { value: 'a2' } }); });
    expect(fake.find({ op: 'update' }).at(-1)).toMatchObject({ table: 'orders', patch: { assigned_to: 'a2' }, returning: 'id, assigned_to, updated_at' });
    expect(within(details).getByLabelText('Assigned to').value).toBe('a2');
    expect(within(card('ALW-O-BBBB222233')).getByText('Pat Picker', { selector: 'dd' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('ALW-O-BBBB222233 is assigned to Pat Picker.');

    // Refused (no row changed): the select shows the change, then goes back.
    let finish;
    db.updateResult = () => new Promise((resolve) => { finish = () => resolve({ data: [], error: null }); });
    await act(async () => { fireEvent.change(within(details).getByLabelText('Assigned to'), { target: { value: '' } }); });
    expect(within(details).getByLabelText('Assigned to').value).toBe('');
    await act(async () => { finish(); });
    expect(within(details).getByLabelText('Assigned to').value).toBe('a2');
    expect(within(details).getByRole('alert').textContent).toBe('The assignment wasn’t saved. Try again. It is still assigned to Pat Picker.');
  });
});

describe('export, print and live updates', () => {
  it('exports the orders on screen as CSV, one row per line', async () => {
    const blobs = [];
    URL.createObjectURL = vi.fn((blob) => { blobs.push(blob); return 'blob:aw/1'; });
    URL.revokeObjectURL = vi.fn();
    const names = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function record() { names.push(this.download); });
    await open();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Export CSV' })); });
    expect(names[0]).toMatch(/^orders-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = await blobs[0].text();
    const rows = text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatch(/^ALW-O-BBBB222233,2026-10-08T15:00:00Z,order,new,Test Market,Tess,/);
    expect(screen.getByRole('status').textContent).toBe(`Exported 2 orders to ${names[0]}.`);
  });

  it('links each card to its pick list and packing slip, and goes back to the list from the print view', async () => {
    await open();
    const pick = within(card('ALW-O-BBBB222233')).getByRole('link', { name: /^Print pick list/ });
    expect(pick.getAttribute('href')).toBe(`/admin/orders/${ORDER_ID}/print?doc=pick`);
    expect(within(card('ALW-O-BBBB222233')).getByRole('link', { name: /^Print packing slip/ }).getAttribute('href')).toBe(`/admin/orders/${ORDER_ID}/print?doc=slip`);
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    await act(async () => { fireEvent.click(pick); });
    expect(window.location.pathname).toBe(`/admin/orders/${ORDER_ID}/print`);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Pick list ALW-O-BBBB222233');
    expect(screen.queryByRole('group', { name: 'Filter orders' })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Back to orders' })); });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('subscribes once, reloads on a change without losing an open editor, and unsubscribes when Orders closes', async () => {
    vi.useFakeTimers();
    await open();
    expect(fake.channels.map((c) => c.name)).toEqual(['admin-orders']);
    const guest = card('ALW-Q-5E4F3A2B1C');
    await act(async () => { fireEvent.click(within(guest).getByRole('button', { name: /^Edit quantities and prices/ })); });
    fireEvent.change(within(guest).getByLabelText('Quantity for Kite cigarette tobacco'), { target: { value: '7' } });
    const loads = orderSelects().length;
    fake.tables.orders = [order({ id: 'o-new', ref_num: 'ALW-O-NEW0000001', created_at: '2026-10-08T17:00:00Z' }), order(), quote()];
    await act(async () => { fake.channels[0].handlers[0][2]({ eventType: 'INSERT' }); vi.advanceTimersByTime(600); });
    await act(async () => {});
    expect(orderSelects()).toHaveLength(loads + 1);
    expect(screen.getByText('ALW-O-NEW0000001')).toBeTruthy();
    expect(within(card('ALW-Q-5E4F3A2B1C')).getByLabelText('Quantity for Kite cigarette tobacco').value).toBe('7');
    expect(screen.getByRole('status').textContent).toBe('1 new order came in.');
    // A minute later it reloads again.
    await act(async () => { vi.advanceTimersByTime(POLL_MS); });
    expect(orderSelects()).toHaveLength(loads + 2);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => { navigate('/admin/accounts'); });
    expect(fake.channels).toHaveLength(0);
  });

  it('marks orders placed since the last visit, and says when the list was updated', async () => {
    await open();
    expect(fake.find({ kind: 'rpc', name: 'admin_mark_orders_seen' })).toHaveLength(1);
    const fresh = card('ALW-O-BBBB222233');
    expect(fresh.className).toContain('is-new');
    expect(fresh.querySelector('.order-new').textContent).toBe('New since your last visit');
    // The status as print-only text (the select doesn't print).
    expect(fresh.querySelector('.order-status-print').textContent).toBe('New');
    expect(card('ALW-Q-5E4F3A2B1C').className).not.toContain('is-new');
    expect(document.querySelector('.admin-updated').textContent).toMatch(/^Updated \d{1,2}:\d{2} [AP]M$/);
    // Moving between filters is the same visit.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^new \(/ })); });
    expect(fake.find({ kind: 'rpc', name: 'admin_mark_orders_seen' })).toHaveLength(1);
  });
});
