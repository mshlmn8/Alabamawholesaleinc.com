// Confirmation and feedback for status changes (AW-112), with the fake
// client: cancelling an order and suspending an account ask for a reason;
// other changes show at once, keep the focus, offer Undo, send one request
// at a time and go back visibly when refused; a moved order stays in the
// filter on screen (live reloads too) until Refresh.
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

const ADMIN = { id: 'a1', name: 'Desk Admin', business: 'Alabama Wholesale', email: 'desk@example.test', role: 'admin', status: 'approved', pricing_tier: 'standard' };
const ALPHA_ID = '11111111-2222-4333-8444-000000000aaa';
const ALPHA = { id: ALPHA_ID, business: 'Alpha Food Mart', name: 'Alice Alpha', email: 'alpha@example.test', status: 'approved', role: 'customer', pricing_tier: 'silver' };
const BRAVO = { id: 'p-bravo', business: 'Bravo Tobacco Outlet', name: 'Bea Bravo', email: 'bravo@example.test', status: 'pending', role: 'customer', pricing_tier: 'standard' };
const ORDER_ID = '11111111-2222-4333-8444-000000000001';
const REF = 'ALW-Q-41207AAAAA';
const order = (extra = {}) => ({
  id: ORDER_ID, ref_num: REF, user_id: null, status: 'new', created_at: '2026-10-08T15:00:00Z', updated_at: '2026-10-08T15:00:00Z', kind: 'quote',
  business: 'TEST Guest Corner Store', contact: 'Gus', email: 'gus@example.test', delivery: 'willcall', subtotal: null, profiles: null, order_items: [], ...extra,
});
const MISSING_FUNCTION = { code: 'PGRST202', message: 'Could not find the function' };
const MISSING_TABLE = { code: 'PGRST205', message: 'Could not find the table' };

// Requests the test answers by hand: db.hold[name] = true makes the next
// such request wait for release().
const db = { rpcError: {}, tableError: {}, hold: {}, updateResult: null };
let waiting = [];
const release = async (result) => {
  const next = waiting.shift();
  await act(async () => { next(result); });
};
beforeEach(() => {
  act(() => navigate('/admin/orders', { replace: true }));
  fake.reset();
  resetOrderStatusForTests();
  resetOrdersSeenForTests();
  db.rpcError = {};
  db.tableError = {};
  db.hold = {};
  db.updateResult = null;
  waiting = [];
  fake.tables = { orders: [order()], profiles: [ADMIN, ALPHA, BRAVO], pricing_tiers: [], profile_documents: [], profile_admin_notes: [], profile_status_log: [] };
  fake.respond = (request) => {
    const key = request.kind === 'rpc' ? request.name : `${request.table}:${request.op}`;
    if (db.hold[key]) return new Promise((resolve) => { waiting.push((result) => resolve(result ?? { data: [{ id: request.filters.find(([n]) => n === 'eq')?.[2] }], error: null })); });
    if (request.kind === 'rpc' && db.rpcError[request.name]) return { data: null, error: db.rpcError[request.name] };
    if (request.table && db.tableError[request.table]) return { data: null, error: db.tableError[request.table] };
    if (request.name === 'admin_set_order_status') {
      // The server takes the change: later loads see it.
      fake.tables.orders = fake.tables.orders.map((o) => (o.id === request.args.p_order_id ? { ...o, status: request.args.p_status } : o));
      return { data: { id: request.args.p_order_id, status: request.args.p_status, updated_at: '2026-10-08T16:00:00Z' }, error: null };
    }
    if (request.op === 'update' && db.updateResult) return db.updateResult;
    if (request.op === 'insert' && request.table === 'profile_admin_notes') {
      return { data: { id: 50, author: 'a1', created_at: '2026-10-08T16:00:00Z', ...request.rows }, error: null };
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

const open = async (path) => {
  if (path) act(() => navigate(path, { replace: true }));
  await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" />); });
  await act(async () => {});
};
const statusSelect = () => screen.getByRole('combobox', { name: `Status for ${REF}` });
const card = () => screen.getByText(REF, { selector: '.order-ref' }).closest('article');
const statusCalls = () => fake.find({ kind: 'rpc', name: 'admin_set_order_status' }).map((c) => c.args);
const statusText = () => screen.getByRole('status').textContent;

describe('cancelling an order', () => {
  it('asks for a required reason, names the business, and sends it to admin_set_order_status', async () => {
    await open();
    await act(async () => { fireEvent.change(statusSelect(), { target: { value: 'cancelled' } }); });
    const dialog = screen.getByRole('alertdialog', { name: `Cancel ${REF} for TEST Guest Corner Store?` });
    // Until it is confirmed, the select keeps the saved status.
    expect(statusSelect().value).toBe('new');
    expect(within(dialog).getByLabelText('Reason for cancelling').required).toBe(true);
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel the order' })); });
    expect(statusCalls()).toEqual([]);
    expect(within(dialog).getByText('Enter reason for cancelling to continue.')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Reason for cancelling'), { target: { value: '  Store closed  ' } });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel the order' })); });
    expect(statusCalls()).toEqual([{ p_order_id: ORDER_ID, p_status: 'cancelled', p_note: 'Store closed' }]);
    expect(statusText()).toBe(`${REF} marked Cancelled.`);
    // No Undo out of a cancellation.
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(within(card()).getByText('Moved to Cancelled')).toBeTruthy();
  });

  it('falls back to the plain update without the function, and then says the reason can’t be stored and is optional', async () => {
    db.rpcError.admin_set_order_status = MISSING_FUNCTION;
    fake.tables.orders = [order(), order({ id: 'o2', ref_num: 'ALW-Q-41208BBBBB' })];
    await open();
    await act(async () => { fireEvent.change(statusSelect(), { target: { value: 'cancelled' } }); });
    fireEvent.change(screen.getByLabelText('Reason for cancelling'), { target: { value: 'Duplicate' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel the order' })); });
    expect(fake.find({ op: 'update' }).map((c) => [c.filters[0][2], c.patch, c.returning])).toEqual([[ORDER_ID, { status: 'cancelled' }, 'id, status, updated_at']]);
    expect(statusText()).toBe(`${REF} marked Cancelled. The reason wasn’t saved: notes and history need the October 2026 database update (see BACKEND.md).`);
    // The next cancellation knows the reason has nowhere to go.
    await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: 'Status for ALW-Q-41208BBBBB' }), { target: { value: 'cancelled' } }); });
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/A reason can’t be stored until the October 2026 database update/)).toBeTruthy();
    const box = within(dialog).getByLabelText('Reason for cancelling (optional)');
    expect(box.required).toBe(false);
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel the order' })); });
    expect(fake.find({ op: 'update' }).map((c) => [c.filters[0][2], c.patch])).toEqual([[ORDER_ID, { status: 'cancelled' }], ['o2', { status: 'cancelled' }]]);
    expect(fake.find({ kind: 'rpc', name: 'admin_set_order_status' })).toHaveLength(1);
    expect(statusText()).toBe('ALW-Q-41208BBBBB marked Cancelled.');
  });

  it('Escape keeps the order and gives the select its focus and its value back', async () => {
    await open();
    statusSelect().focus();
    await act(async () => { fireEvent.change(statusSelect(), { target: { value: 'cancelled' } }); });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep it' }));
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(statusSelect().value).toBe('new');
    expect(document.activeElement).toBe(statusSelect());
    expect(statusCalls()).toEqual([]);
  });
});

describe('other order status changes', () => {
  it('show at once, keep the card and the focus, send one request, and offer Undo', async () => {
    db.hold.admin_set_order_status = true;
    await open();
    statusSelect().focus();
    await act(async () => { fireEvent.change(statusSelect(), { target: { value: 'contacted' } }); });
    // Shown before the database answers; the card stays in "new", tagged.
    expect(statusSelect().value).toBe('contacted');
    expect(statusSelect().getAttribute('aria-disabled')).toBe('true');
    expect(within(card()).getByText('Moved to Contacted')).toBeTruthy();
    expect(document.activeElement).toBe(statusSelect());
    // A second change while the first is out is turned away.
    await act(async () => { fireEvent.change(statusSelect(), { target: { value: 'picking' } }); });
    expect(statusCalls()).toEqual([{ p_order_id: ORDER_ID, p_status: 'contacted', p_note: null }]);
    expect(statusSelect().value).toBe('contacted');
    await release({ data: { id: ORDER_ID, status: 'contacted', updated_at: '2026-10-08T16:00:00Z' }, error: null });
    expect(statusSelect().getAttribute('aria-disabled')).toBeNull();
    expect(statusText()).toBe(`${REF} marked Contacted.`);
    expect(document.activeElement).toBe(statusSelect());
    // Undo puts the previous status back the same way.
    db.hold = {};
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    expect(statusCalls().at(-1)).toEqual({ p_order_id: ORDER_ID, p_status: 'new', p_note: null });
    expect(statusSelect().value).toBe('new');
    expect(within(card()).queryByText(/^Moved to/)).toBeNull();
    expect(document.activeElement).toBe(statusSelect());
    expect(statusText()).toBe(`${REF} marked New.`);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('go back visibly, with the reason, when the database refuses', async () => {
    db.rpcError.admin_set_order_status = { code: '42501', message: 'Only admins can change orders', hint: 'admin_only' };
    await open();
    await act(async () => { fireEvent.change(statusSelect(), { target: { value: 'contacted' } }); });
    expect(statusSelect().value).toBe('new');
    expect(screen.getByRole('alert').textContent).toBe(`${REF}: Only an approved admin can change orders.`);
    expect(within(card()).queryByText(/^Moved to/)).toBeNull();
    expect(statusText()).toBe('');
  });

  it('keep a moved order through the live reloads, until Refresh or another filter', async () => {
    vi.useFakeTimers();
    await open();
    await act(async () => { fireEvent.change(statusSelect(), { target: { value: 'contacted' } }); });
    const loads = fake.find({ table: 'orders', op: 'select' }).length;
    await act(async () => { vi.advanceTimersByTime(POLL_MS); });
    expect(fake.find({ table: 'orders', op: 'select' }).length).toBe(loads + 1);
    expect(within(card()).getByText('Moved to Contacted')).toBeTruthy();
    // Another filter and back: it is in "contacted" now.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^contacted \(/ })); });
    expect(within(card()).queryByText(/^Moved to/)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^new \(/ })); });
    expect(screen.queryByText(REF, { selector: '.order-ref' })).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^contacted \(/ })); });
    await act(async () => { fireEvent.change(statusSelect(), { target: { value: 'quoted' } }); });
    expect(within(card()).getByText('Moved to Quoted')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh' })); });
    expect(screen.queryByText(REF, { selector: '.order-ref' })).toBeNull();
  });
});

describe('account changes', () => {
  const row = (business) => screen.getByRole('link', { name: business }).closest('tr');

  it('suspending asks for a reason, then saves it as an internal note', async () => {
    await open('/admin/accounts?status=all');
    const select = within(row('Alpha Food Mart')).getByRole('combobox', { name: 'Status for Alpha Food Mart' });
    await act(async () => { fireEvent.change(select, { target: { value: 'suspended' } }); });
    const dialog = screen.getByRole('alertdialog', { name: 'Suspend Alpha Food Mart?' });
    expect(select.value).toBe('approved');
    expect(fake.find({ op: 'update' })).toHaveLength(0);
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend the account' })); });
    expect(within(dialog).getByText('Enter reason for suspending to continue.')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('Reason for suspending'), { target: { value: 'Licence expired' } });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend the account' })); });
    expect(fake.find({ op: 'update' }).map((c) => c.patch)).toEqual([{ status: 'suspended' }]);
    expect(fake.find({ table: 'profile_admin_notes', op: 'insert' }).map((c) => c.rows)).toEqual([{ profile_id: ALPHA_ID, body: 'Suspended: Licence expired' }]);
    expect(statusText()).toBe('Alpha Food Mart is suspended. The reason is in its internal notes.');
    expect(within(row('Alpha Food Mart')).getByRole('combobox', { name: 'Status for Alpha Food Mart' }).value).toBe('suspended');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('says the account is suspended but the reason wasn’t saved when the notes table is missing', async () => {
    db.tableError.profile_admin_notes = MISSING_TABLE;
    await open('/admin/accounts?status=all');
    await act(async () => { fireEvent.change(screen.getByRole('combobox', { name: 'Status for Alpha Food Mart' }), { target: { value: 'suspended' } }); });
    fireEvent.change(screen.getByLabelText('Reason for suspending'), { target: { value: 'Licence expired' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Suspend the account' })); });
    expect(screen.getByRole('alert').textContent)
      .toBe('Alpha Food Mart is suspended, but the reason wasn’t saved: internal notes need the October 2026 database update (see BACKEND.md).');
    expect(screen.getByRole('combobox', { name: 'Status for Alpha Food Mart' }).value).toBe('suspended');
  });

  it('on the account page, the reason shows under Internal notes; Escape in the dialog gives the select back', async () => {
    await open(`/admin/accounts/${ALPHA_ID}`);
    const select = screen.getByLabelText('Status');
    select.focus();
    await act(async () => { fireEvent.change(select, { target: { value: 'suspended' } }); });
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(select.value).toBe('approved');
    expect(document.activeElement).toBe(select);
    await act(async () => { fireEvent.change(select, { target: { value: 'suspended' } }); });
    fireEvent.change(screen.getByLabelText('Reason for suspending'), { target: { value: 'Licence expired' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Suspend the account' })); });
    const notes = screen.getByRole('heading', { level: 3, name: 'Internal notes' }).closest('section');
    expect(within(notes).getByText('Suspended: Licence expired')).toBeTruthy();
    expect(document.querySelector('.account-pill').textContent).toBe('suspended');
    expect(document.activeElement).toBe(select);
  });

  it('a double click on Approve sends one update; the status select then has the focus, and Undo puts it back', async () => {
    db.hold['profiles:update'] = true;
    await open('/admin/accounts?status=all');
    const approve = within(row('Bravo Tobacco Outlet')).getByRole('button', { name: /^Approve ?Bravo Tobacco Outlet$/ });
    await act(async () => { fireEvent.click(approve); });
    await act(async () => { fireEvent.click(approve); });
    expect(fake.find({ op: 'update' })).toHaveLength(1);
    expect(approve.disabled).toBe(true);
    expect(approve.textContent).toMatch(/^Approving…/);
    // Shown at once.
    const select = within(row('Bravo Tobacco Outlet')).getByRole('combobox', { name: 'Status for Bravo Tobacco Outlet' });
    expect(select.value).toBe('approved');
    expect(select.getAttribute('aria-disabled')).toBe('true');
    await release({ data: [{ ...BRAVO, status: 'approved', approved_at: '2026-10-08T16:00:00Z', approved_by: 'a1' }], error: null });
    expect(within(row('Bravo Tobacco Outlet')).queryByRole('button', { name: /^Approve/ })).toBeNull();
    expect(document.activeElement).toBe(select);
    expect(statusText()).toBe('Bravo Tobacco Outlet is now approved.');
    // The approval stamp the database set shows at once.
    expect(within(row('Bravo Tobacco Outlet')).getByText(/^Approved Oct 8, 2026 by Desk Admin$/)).toBeTruthy();
    db.hold = {};
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    expect(fake.find({ op: 'update' }).map((c) => c.patch)).toEqual([{ status: 'approved' }, { status: 'pending' }]);
    expect(select.value).toBe('pending');
    expect(document.activeElement).toBe(select);
  });

  it('a tier change shows at once and goes back, with the reason, when it reaches no row', async () => {
    await open('/admin/accounts?status=all');
    const tier = () => screen.getByRole('combobox', { name: 'Tier for Alpha Food Mart' });
    db.updateResult = { data: [], error: null, status: 200 };
    await act(async () => { fireEvent.change(tier(), { target: { value: 'standard' } }); });
    expect(tier().value).toBe('silver');
    expect(screen.getByRole('alert').textContent).toBe('The change to Alpha Food Mart wasn’t saved. Try again.');
    db.updateResult = null;
    await act(async () => { fireEvent.change(tier(), { target: { value: 'standard' } }); });
    expect(tier().value).toBe('standard');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(statusText()).toBe('Alpha Food Mart is now on the standard tier.');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    expect(fake.find({ op: 'update' }).at(-1).patch).toEqual({ pricing_tier: 'silver' });
    expect(tier().value).toBe('silver');
    // No account change reloaded the accounts or the documents.
    expect(fake.find({ table: 'profiles', op: 'select' })).toHaveLength(1);
    expect(fake.find({ table: 'profile_documents' })).toHaveLength(1);
  });
});
