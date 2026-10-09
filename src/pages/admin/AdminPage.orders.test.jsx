// Admin -> Orders and the quote workflow (AW-024, Cursor's PR #13, with
// 20261009150000): staff edit quantities and prices, email the quote and
// convert a priced quote, on a database with the workflow and on the live one
// without it. A fake Supabase client; prices are test values.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const {
  AdminPage, approvalEmail, hasQuoteWorkflow, isQuote, orderActionError, orderEmail, parseOrderLines, suggestedUnitPrice,
} = await import('./AdminPage.jsx');
const { orderAccount, orderMethod, orderTotal, requestedDate, resetOrderStatusForTests } = await import('./OrdersSection.jsx');
const { navigate, useRoute } = await import('../../lib/router.js');

// The admin page as App renders it: its route follows the URL.
function RoutedAdmin(props) {
  const { raw } = useRoute();
  return <AdminPage route={raw} {...props} />;
}

const ADMIN = { id: 'admin-1', name: 'Desk Admin', role: 'admin', status: 'approved' };
const MISSING = { code: 'PGRST202', message: 'Could not find the function' };
const guestQuote = (extra = {}) => ({
  id: 'o-guest', ref_num: 'ALW-Q-5E4F3A2B1C', user_id: null, status: 'new', created_at: '2026-10-08T15:00:00Z',
  business: 'Guest Mart', contact: 'Gus', email: 'gus@example.test', phone: '(205) 000-0002', delivery: 'willcall', subtotal: null,
  kind: 'quote', profiles: null,
  order_items: [
    { id: 101, product_id: 14, product_name: 'Kite cigarette tobacco', sku: 'AW-KITE', variant: null, qty: 2, unit_price: null },
    { id: 102, product_id: 356, product_name: 'Gas cans — 5 gal', sku: 'AW-GAS-CANS-5-GAL', variant: '5 gal', qty: 1, unit_price: null },
  ],
  ...extra,
});
const tradeOrder = (extra = {}) => ({
  id: 'o-order', ref_num: 'ALW-O-BBBB222233', user_id: 'buyer-1', status: 'new', created_at: '2026-10-06T15:00:00Z',
  business: 'Test Market', contact: 'Tess', email: 'tess@example.test', phone: '205-555-0100', delivery: 'delivery', subtotal: 21.7,
  kind: 'order', profiles: { pricing_tier: 'silver' },
  order_items: [{ id: 301, product_id: 45, product_name: 'Argo corn starch', sku: 'AW-ARGO', variant: null, qty: 2, unit_price: 10.85 }],
  ...extra,
});
// A row from a database without 20261008200000: no kind column.
const withoutWorkflow = (o) => {
  const copy = { ...o };
  delete copy.kind;
  return copy;
};

const db = { orders: [], profiles: [], rpcError: {}, updateError: null };

beforeEach(() => {
  act(() => navigate('/admin', { replace: true }));
  fake.reset();
  resetOrderStatusForTests();
  db.orders = [guestQuote(), tradeOrder()];
  db.profiles = [ADMIN];
  db.rpcError = {};
  db.updateError = null;
  fake.tables = {
    orders: db.orders,
    profiles: db.profiles,
    pricing_tiers: [{ tier: 'standard', discount_pct: 0 }, { tier: 'silver', discount_pct: 5 }],
    products: [{ id: 14, price: 10 }, { id: 356, price: 16.1 }],
  };
  fake.rpcData.admin_product_prices = { 14: { list: 14.1, variants: {} }, 356: { list: 16.1, variants: { '5 gal': { list: 30.1 } } } };
  fake.respond = (request) => {
    if (request.kind === 'rpc' && db.rpcError[request.name]) return { data: null, error: db.rpcError[request.name] };
    if (request.op === 'update' && db.updateError) return { data: null, error: db.updateError };
    return undefined;
  };
});
const setOrders = (orders) => { db.orders = orders; fake.tables.orders = orders; };
const rpcCalls = (name) => fake.find({ kind: 'rpc', name }).map(({ args }) => [name, args]);
const updates = () => fake.find({ op: 'update' }).map(({ table, filters, patch }) => ({ table, id: filters.find(([f]) => f === 'eq')[2], patch }));

async function openOrders() {
  await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" />); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^All \(/ })); });
}
const card = (ref) => screen.getByText(ref, { selector: '.order-ref' }).closest('article');

describe('quote workflow helpers', () => {
  it('tells quotes from orders, with or without the kind column', () => {
    expect(isQuote({ kind: 'quote', user_id: 'a' })).toBe(true);
    expect(isQuote({ kind: 'order', user_id: null })).toBe(false);
    // The live database: a guest's or an unpriced request is a quote.
    expect(isQuote({ user_id: null, subtotal: 12 })).toBe(true);
    expect(isQuote({ user_id: 'a', subtotal: null })).toBe(true);
    expect(isQuote({ user_id: 'a', subtotal: 12 })).toBe(false);
    expect(hasQuoteWorkflow([guestQuote()])).toBe(true);
    expect(hasQuoteWorkflow([withoutWorkflow(guestQuote())])).toBe(false);
  });

  it('suggests a variant’s own list price less the tier discount', () => {
    const prices = { 356: { list: 16.1, variants: { '5 gal': 30.1 } }, 14: { list: 10.1, variants: {} } };
    expect(suggestedUnitPrice({ product_id: 356, variant: '5 Gal' }, prices, 5)).toBe(28.6);
    expect(suggestedUnitPrice({ product_id: 356, variant: '2 gal' }, prices, 0)).toBe(16.1);
    // 10.10 less 5% is 9.595, which rounds to 9.60 like the server.
    expect(suggestedUnitPrice({ product_id: 14, variant: null }, prices, 5)).toBe(9.6);
    expect(suggestedUnitPrice({ product_id: 99, variant: null }, prices, 0)).toBeNull();
  });

  it('checks the edited lines', () => {
    const line = (qty, unit_price) => ({ id: 1, product_name: 'Kite', qty, unit_price });
    expect(parseOrderLines([line('3', '12.5'), { ...line('0', ''), id: 2 }])).toEqual({ ok: true, lines: [
      { item_id: 1, qty: 3, unit_price: 12.5 }, { item_id: 2, qty: 0, unit_price: null }] });
    expect(parseOrderLines([line('2.5', '1')]).ok).toBe(false);
    expect(parseOrderLines([line('2', '-1')]).ok).toBe(false);
    expect(parseOrderLines([line('2', '1.999')]).ok).toBe(false);
    expect(parseOrderLines([line('0', '1')])).toEqual({ ok: false, error: 'Keep at least one line on the order.' });
  });

  it('maps the database’s refusals to staff wording', () => {
    expect(orderActionError(MISSING)).toMatch(/October 2026 database update/);
    expect(orderActionError({ code: '23514' })).toMatch(/That status needs the October 2026 database update/);
    expect(orderActionError({ code: 'P0001', hint: 'unpriced_lines' })).toBe('Price every line before converting the quote.');
    expect(orderActionError({ code: '42501', hint: 'admin_only' })).toBe('Only an approved admin can change orders.');
    expect(orderActionError({ message: 'boom' })).toBe('The change wasn’t saved (boom). Try again.');
  });

  it('writes the quote email and the approval email', () => {
    const href = orderEmail(guestQuote(), [
      { qty: '3', product_name: 'Kite', sku: 'AW-KITE', unit_price: '12.5' },
      { qty: 1, product_name: 'Gas cans', sku: 'AW-GAS', unit_price: '' },
    ]);
    expect(href.startsWith('mailto:gus@example.test?subject=Quote%20ALW-Q-5E4F3A2B1C&body=')).toBe(true);
    const body = decodeURIComponent(href.split('&body=')[1]);
    expect(body).toBe('Quote ALW-Q-5E4F3A2B1C\n\n3 × Kite (AW-KITE) at $12.50 = $37.50\n1 × Gas cans (AW-GAS), price to follow\n\nTotal: $37.50\n');
    expect(decodeURIComponent(approvalEmail({ email: 'a@example.test' })))
      .toBe('mailto:a@example.test?subject=Your Alabama Wholesale trade account&body=Your Alabama Wholesale trade account is approved. Sign in to see pricing.');
  });
});

describe('Admin orders with the quote workflow', () => {
  it('labels quotes and orders, links the email and phone, and offers every status', async () => {
    await openOrders();
    // orders has two links to profiles once quoted_by exists; the embed names user_id's.
    expect(fake.find({ table: 'orders', op: 'select' }).map(({ columns }) => columns)).toContain('*, order_items(*), profiles!orders_user_id_fkey(business, name, pricing_tier)');
    const guest = card('ALW-Q-5E4F3A2B1C');
    expect(within(guest).getByText('Guest quote')).toBeTruthy();
    expect(within(guest).getByRole('link', { name: 'gus@example.test' }).getAttribute('href')).toBe('mailto:gus@example.test');
    expect(within(guest).getByRole('link', { name: '(205) 000-0002' }).getAttribute('href')).toBe('tel:2050000002');
    expect(within(card('ALW-O-BBBB222233')).getByText('Trade order')).toBeTruthy();
    const options = within(guest).getByRole('combobox', { name: 'Status for ALW-Q-5E4F3A2B1C' }).querySelectorAll('option');
    expect([...options].map(o => o.value)).toEqual(['new', 'contacted', 'quoted', 'confirmed', 'picking', 'ready', 'out_for_delivery', 'fulfilled', 'cancelled']);
    // An unpriced quote can't be converted yet.
    expect(within(guest).getByRole('button', { name: /^Convert to order/ }).disabled).toBe(true);
    // Orders aren't converted.
    expect(within(card('ALW-O-BBBB222233')).queryByRole('button', { name: /^Convert to order/ })).toBeNull();
  });

  it('suggests prices, saves quantities and prices with admin_price_order', async () => {
    await openOrders();
    const guest = card('ALW-Q-5E4F3A2B1C');
    await act(async () => { fireEvent.click(within(guest).getByRole('button', { name: /^Edit quantities and prices/ })); });
    const qty = within(guest).getByLabelText('Quantity for Kite cigarette tobacco');
    const price = within(guest).getByLabelText('Unit price for Kite cigarette tobacco');
    // Suggested at the guest's standard tier: list price, the 5 gal variant's own.
    expect(price.value).toBe('14.10');
    expect(within(guest).getByLabelText('Unit price for Gas cans — 5 gal').value).toBe('30.10');
    expect(within(guest).getByText(/suggested from the list price/)).toBeTruthy();
    fireEvent.change(qty, { target: { value: '3' } });
    fireEvent.change(price, { target: { value: '12.5' } });
    expect(within(guest).getByText('Total of the priced lines: $67.60')).toBeTruthy();
    expect(decodeURIComponent(within(guest).getByRole('link', { name: /^Email the quote/ }).getAttribute('href'))).toMatch(/3 × Kite cigarette tobacco \(AW-KITE\) at \$12\.50 = \$37\.50/);
    await act(async () => { fireEvent.click(within(guest).getByRole('button', { name: 'Save prices' })); });
    expect(rpcCalls('admin_price_order')[0]).toEqual(['admin_price_order', {
      p_order_id: 'o-guest',
      p_lines: [{ item_id: 101, qty: 3, unit_price: 12.5 }, { item_id: 102, qty: 1, unit_price: 30.1 }],
    }]);
    // Saved: the editor closes.
    expect(within(card('ALW-Q-5E4F3A2B1C')).queryByLabelText('Quantity for Kite cigarette tobacco')).toBeNull();
  });

  it('says why a save was refused, and keeps the editor open', async () => {
    db.rpcError.admin_price_order = { code: 'P0001', message: 'This order is closed', hint: 'order_closed' };
    await openOrders();
    const guest = card('ALW-Q-5E4F3A2B1C');
    await act(async () => { fireEvent.click(within(guest).getByRole('button', { name: /^Edit quantities and prices/ })); });
    fireEvent.change(within(guest).getByLabelText('Quantity for Kite cigarette tobacco'), { target: { value: 'two' } });
    await act(async () => { fireEvent.click(within(guest).getByRole('button', { name: 'Save prices' })); });
    expect(within(guest).getByRole('alert').textContent).toBe('Enter a whole quantity for Kite cigarette tobacco.');
    expect(rpcCalls('admin_price_order')).toHaveLength(0);
    fireEvent.change(within(guest).getByLabelText('Quantity for Kite cigarette tobacco'), { target: { value: '2' } });
    await act(async () => { fireEvent.click(within(guest).getByRole('button', { name: 'Save prices' })); });
    expect(within(guest).getByRole('alert').textContent).toBe('This order is fulfilled or cancelled, so it can’t be changed.');
    expect(within(guest).getByLabelText('Quantity for Kite cigarette tobacco')).toBeTruthy();
  });

  it('asks before leaving a quote with unsaved changes (AW-118)', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openOrders();
    const guest = card('ALW-Q-5E4F3A2B1C');
    await act(async () => { fireEvent.click(within(guest).getByRole('button', { name: /^Edit quantities and prices/ })); });
    // Suggested prices alone are not changes.
    act(() => navigate('/admin/accounts'));
    expect(confirm).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/admin/accounts');
    await act(async () => { navigate('/admin/orders?status=all'); });
    const again = card('ALW-Q-5E4F3A2B1C');
    await act(async () => { fireEvent.click(within(again).getByRole('button', { name: /^Edit quantities and prices/ })); });
    fireEvent.change(within(again).getByLabelText('Quantity for Kite cigarette tobacco'), { target: { value: '5' } });
    act(() => navigate('/admin/accounts'));
    expect(confirm).toHaveBeenCalledWith('Your changes to ALW-Q-5E4F3A2B1C aren’t saved. Leave without saving them?');
    expect(window.location.pathname).toBe('/admin/orders');
    expect(within(again).getByLabelText('Quantity for Kite cigarette tobacco').value).toBe('5');
    confirm.mockRestore();
  });

  it('converts a priced quote with admin_convert_quote', async () => {
    setOrders([guestQuote({ status: 'quoted', order_items: guestQuote().order_items.map(it => ({ ...it, unit_price: 9.99 })) })]);
    await openOrders();
    const guest = card('ALW-Q-5E4F3A2B1C');
    await act(async () => { fireEvent.click(within(guest).getByRole('button', { name: /^Convert to order/ })); });
    expect(rpcCalls('admin_convert_quote')[0]).toEqual(['admin_convert_quote', { p_order_id: 'o-guest', p_user_id: null }]);
  });

  it('shows a refused status change (the plain update, without the October 2026 function)', async () => {
    db.rpcError.admin_set_order_status = MISSING;
    db.updateError = { code: '23514', message: 'violates check constraint' };
    await openOrders();
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Status for ALW-O-BBBB222233' }), { target: { value: 'picking' } });
    });
    expect(updates()).toEqual([{ table: 'orders', id: 'o-order', patch: { status: 'picking' } }]);
    expect(screen.getByRole('alert').textContent).toBe('ALW-O-BBBB222233: That status needs the October 2026 database update (see BACKEND.md).');
  });
});

describe('the order card head (AW-020)', () => {
  const facts = (ref) => Object.fromEntries([...card(ref).querySelectorAll('.order-facts > div')]
    .map((row) => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]));

  it('shows the method, requested date, total, placed time, contact and account as separate facts', async () => {
    setOrders([
      guestQuote({ preferred_date: '2026-10-01', total_units: 3, ship_street: '2 Guest Rd', ship_city: 'Hoover', ship_state: 'AL', ship_zip: '35244' }),
      tradeOrder({ preferred_date: '2026-10-09', total_units: 2, ship_street: '2 Test Way', ship_city: 'Hoover', ship_state: 'AL', ship_zip: '35244', profiles: { business: 'Test Market LLC', pricing_tier: 'silver' } }),
    ]);
    await openOrders();
    // Will-call: no address, even when the request carried one.
    expect(facts('ALW-Q-5E4F3A2B1C')).toMatchObject({ Method: 'Will-call pickup', Requested: 'Oct 1, 2026', Total: 'Unpriced quote', Account: 'Guest Mart' });
    expect(facts('ALW-O-BBBB222233')).toMatchObject({
      Method: 'Delivery to 2 Test Way, Hoover, AL 35244', Requested: 'Oct 9, 2026', Total: '2 units · $21.70', Account: 'Test Market LLC · silver',
    });
    expect(facts('ALW-O-BBBB222233').Placed).toMatch(/^Oct 6, 2026, \d{1,2}:\d{2} [AP]M$/);
    expect(facts('ALW-Q-5E4F3A2B1C').Contact).toBe('Gusgus@example.test(205) 000-0002');
    // The status sits in the title row, beside the ref.
    const title = card('ALW-O-BBBB222233').querySelector('.order-title');
    expect(within(title).getByRole('combobox', { name: 'Status for ALW-O-BBBB222233' })).toBeTruthy();
    expect(card('ALW-O-BBBB222233').querySelector('.order-head small')).toBeNull();
  });

  it('formats each fact', () => {
    expect(orderMethod({ delivery: 'willcall', ship_street: '1 A St', ship_city: 'B', ship_state: 'AL', ship_zip: '35000' })).toBe('Will-call pickup');
    expect(orderMethod({ delivery: 'delivery', ship_street: '1 A St', ship_city: 'Bessemer', ship_state: 'AL', ship_zip: '35020' })).toBe('Delivery to 1 A St, Bessemer, AL 35020');
    expect(orderMethod({ delivery: 'delivery' })).toBe('Delivery');
    expect(orderMethod({})).toBe('—');
    expect(requestedDate('2026-10-01')).toBe('Oct 1, 2026');
    expect(requestedDate(null)).toBe('—');
    expect(requestedDate('soon')).toBe('—');
    expect(orderTotal({ subtotal: 1500, total_units: 1, kind: 'order' })).toBe('1 unit · $1,500.00');
    expect(orderTotal({ subtotal: 12.5, order_items: [{ qty: 2 }, { qty: 3 }], kind: 'order' })).toBe('5 units · $12.50');
    expect(orderTotal({ subtotal: null, kind: 'quote' })).toBe('Unpriced quote');
    expect(orderAccount({ business: 'Guest Mart', profiles: null })).toBe('Guest Mart');
    expect(orderAccount({ business: 'Typed Name', profiles: { business: 'Account Name', pricing_tier: 'gold' } })).toBe('Account Name · gold');
  });
});

describe('Admin orders on the live database (no quote workflow yet)', () => {
  it('offers the four old statuses, lets staff email a priced quote, and can’t save or convert', async () => {
    setOrders([withoutWorkflow(guestQuote()), withoutWorkflow(tradeOrder())]);
    db.rpcError.admin_product_prices = MISSING;
    await openOrders();
    expect(screen.getByText(/The quote workflow .* needs the October 2026 database update/)).toBeTruthy();
    const guest = card('ALW-Q-5E4F3A2B1C');
    expect(within(guest).getByText('Guest quote')).toBeTruthy();
    const options = within(guest).getByRole('combobox', { name: 'Status for ALW-Q-5E4F3A2B1C' }).querySelectorAll('option');
    expect([...options].map(o => o.value)).toEqual(['new', 'contacted', 'fulfilled', 'cancelled']);
    expect(within(guest).getByRole('button', { name: /^Convert to order/ }).disabled).toBe(true);
    await act(async () => { fireEvent.click(within(guest).getByRole('button', { name: /^Edit quantities and prices/ })); });
    // List prices come from products.price on the live database.
    expect(within(guest).getByLabelText('Unit price for Kite cigarette tobacco').value).toBe('10.00');
    expect(within(guest).getByRole('button', { name: 'Save prices' }).disabled).toBe(true);
    expect(within(guest).getByRole('link', { name: /^Email the quote/ })).toBeTruthy();
  });
});

describe('Admin accounts', () => {
  it('offers "Email applicant" for approved customer accounts only (AW-088)', async () => {
    fake.tables.profiles = [
      ADMIN,
      { id: 'p1', business: 'Alpha Mart', name: 'Al', email: 'al@example.test', status: 'approved', role: 'customer', pricing_tier: 'standard' },
      { id: 'p2', business: 'Bravo Mart', name: 'Bea', email: 'bea@example.test', status: 'pending', role: 'customer', pricing_tier: 'standard' },
    ];
    await act(async () => { render(<RoutedAdmin profile={ADMIN} account="ready" />); });
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Accounts' })); });
    expect(window.location.pathname).toBe('/admin/accounts');
    const links = screen.getAllByRole('link', { name: /^Email applicant/ });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toMatch(/^mailto:al@example\.test\?subject=/);
  });
});
