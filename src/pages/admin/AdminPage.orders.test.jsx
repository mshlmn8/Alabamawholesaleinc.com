// Admin -> Orders and the quote workflow (AW-024, Cursor's PR #13, with
// 20261009150000): staff edit quantities and prices, email the quote and
// convert a priced quote, on a database with the workflow and on the live one
// without it. A fake Supabase client; prices are test values.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ orders: [], profiles: [], rpc: [], rpcError: {}, listPrices: null, updates: [], updateError: null, selects: [] }));
vi.mock('../../lib/supabase.js', () => {
  const from = (table) => {
    const rows = () => {
      if (table === 'orders') return db.orders;
      if (table === 'profiles') return db.profiles;
      if (table === 'pricing_tiers') return [{ tier: 'standard', discount_pct: 0 }, { tier: 'silver', discount_pct: 5 }];
      if (table === 'products') return [{ id: 14, price: 10 }, { id: 356, price: 16.1 }];
      return [];
    };
    const builder = {
      select: (columns) => { db.selects.push([table, columns]); return builder; },
      order: () => builder,
      limit: () => builder,
      update: (patch) => ({
        eq: async (_col, id) => {
          db.updates.push({ table, id, patch });
          return { data: null, error: db.updateError };
        },
      }),
      then: (resolve, reject) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
    };
    return builder;
  };
  const rpc = async (name, args) => {
    db.rpc.push([name, args]);
    if (db.rpcError[name]) return { data: null, error: db.rpcError[name] };
    if (name === 'admin_product_prices') return { data: db.listPrices, error: null };
    return { data: null, error: null };
  };
  return { supabase: { from, rpc }, isBackendConfigured: true };
});
vi.mock('../../lib/documents.js', async (original) => ({
  ...(await original()),
  listAllProfileDocuments: vi.fn(async () => []),
  createDocumentViewUrl: vi.fn(async () => 'https://example.test/signed'),
}));

const {
  AdminPage, approvalEmail, hasQuoteWorkflow, isQuote, orderActionError, orderEmail, parseOrderLines, suggestedUnitPrice,
} = await import('./AdminPage.jsx');

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

beforeEach(() => {
  db.orders = [guestQuote(), tradeOrder()];
  db.profiles = [ADMIN];
  db.rpc = [];
  db.rpcError = {};
  db.updates = [];
  db.updateError = null;
  db.listPrices = { 14: { list: 14.1, variants: {} }, 356: { list: 16.1, variants: { '5 gal': { list: 30.1 } } } };
});

async function openOrders() {
  await act(async () => { render(<AdminPage profile={ADMIN} account="ready" />); });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^all \(/ })); });
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
    expect(db.selects).toContainEqual(['orders', '*, order_items(*), profiles!orders_user_id_fkey(business, name, pricing_tier)']);
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
    expect(db.rpc.find(([name]) => name === 'admin_price_order')).toEqual(['admin_price_order', {
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
    expect(db.rpc.some(([name]) => name === 'admin_price_order')).toBe(false);
    fireEvent.change(within(guest).getByLabelText('Quantity for Kite cigarette tobacco'), { target: { value: '2' } });
    await act(async () => { fireEvent.click(within(guest).getByRole('button', { name: 'Save prices' })); });
    expect(within(guest).getByRole('alert').textContent).toBe('This order is fulfilled or cancelled, so it can’t be changed.');
    expect(within(guest).getByLabelText('Quantity for Kite cigarette tobacco')).toBeTruthy();
  });

  it('converts a priced quote with admin_convert_quote', async () => {
    db.orders = [guestQuote({ status: 'quoted', order_items: guestQuote().order_items.map(it => ({ ...it, unit_price: 9.99 })) })];
    await openOrders();
    const guest = card('ALW-Q-5E4F3A2B1C');
    await act(async () => { fireEvent.click(within(guest).getByRole('button', { name: /^Convert to order/ })); });
    expect(db.rpc.find(([name]) => name === 'admin_convert_quote')).toEqual(['admin_convert_quote', { p_order_id: 'o-guest', p_user_id: null }]);
  });

  it('shows a refused status change', async () => {
    db.updateError = { code: '23514', message: 'violates check constraint' };
    await openOrders();
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Status for ALW-O-BBBB222233' }), { target: { value: 'picking' } });
    });
    expect(db.updates).toEqual([{ table: 'orders', id: 'o-order', patch: { status: 'picking' } }]);
    expect(screen.getByRole('alert').textContent).toBe('ALW-O-BBBB222233: That status needs the October 2026 database update (see BACKEND.md).');
  });
});

describe('Admin orders on the live database (no quote workflow yet)', () => {
  it('offers the four old statuses, lets staff email a priced quote, and can’t save or convert', async () => {
    db.orders = [withoutWorkflow(guestQuote()), withoutWorkflow(tradeOrder())];
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
    db.profiles = [
      ADMIN,
      { id: 'p1', business: 'Alpha Mart', name: 'Al', email: 'al@example.test', status: 'approved', role: 'customer', pricing_tier: 'standard' },
      { id: 'p2', business: 'Bravo Mart', name: 'Bea', email: 'bea@example.test', status: 'pending', role: 'customer', pricing_tier: 'standard' },
    ];
    await act(async () => { render(<AdminPage profile={ADMIN} account="ready" />); });
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Accounts' })); });
    const links = screen.getAllByRole('link', { name: /^Email applicant/ });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toMatch(/^mailto:al@example\.test\?subject=/);
  });
});
