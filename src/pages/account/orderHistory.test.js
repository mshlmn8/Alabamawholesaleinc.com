// My account's order history (AW-104, AW-105): the page query with its
// filters and the live-database column fallback, and how an order reads to
// the buyer.
import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeSupabase } from '../admin/fakeSupabase.js';
import {
  BUYER_STATUS, KIND_LABEL, ORDER_COLUMN_STEPS, ORDER_FILTERS, ORDER_PAGE, STATUS_LEGEND, buyerStatus, countText, dayDate,
  loadOrders, orderKind, placedDate, requestedDate, resetOrderColumnsForTests, shipLine, statusTone,
} from './orderHistory.js';

const STATUSES = ['new', 'contacted', 'quoted', 'confirmed', 'picking', 'ready', 'out_for_delivery', 'fulfilled', 'cancelled'];
const ROWS = Array.from({ length: 23 }, (_, i) => ({ id: `o${i}`, user_id: 'u1', ref_num: `ALW-O-${10000 + i}`, status: STATUSES[i % 9] }));

let fake;
beforeEach(() => {
  resetOrderColumnsForTests();
  fake = createFakeSupabase({ tables: { orders: ROWS } });
});
const modifiers = (call) => Object.fromEntries(call.modifiers.map(([name, ...args]) => [name, args]));

describe('loadOrders', () => {
  it('asks for one page of the account’s orders, newest first, with the total on the first page', async () => {
    const result = await loadOrders(fake.client, { userId: 'u1' });
    const [call] = fake.find({ table: 'orders' });
    expect(call.columns).toBe(ORDER_COLUMN_STEPS[0]);
    expect(call.columns).toMatch(/delivery, preferred_date, notes, ship_street, ship_city, ship_state, ship_zip, kind, order_items\(/);
    expect(call.options).toEqual({ count: 'exact' });
    expect(call.filters).toEqual([['eq', 'user_id', 'u1']]);
    expect(modifiers(call)).toMatchObject({ order: ['created_at', { ascending: false }], range: [0, ORDER_PAGE - 1] });
    expect(ORDER_PAGE).toBe(10);
    expect(result.total).toBe(23);
    expect(result.error).toBeNull();
  });

  it('asks for a later page by its first row, without the count, and passes the abort signal', async () => {
    const controller = new AbortController();
    await loadOrders(fake.client, { userId: 'u1', from: 20, signal: controller.signal });
    const [call] = fake.find({ table: 'orders' });
    expect(call.options).toBeUndefined();
    expect(modifiers(call)).toMatchObject({ range: [20, 29], abortSignal: [controller.signal] });
  });

  it('filters by status group and by a reference the search text is part of', async () => {
    await loadOrders(fake.client, { userId: 'u1', status: 'open', ref: '  alw-o_1%  ' });
    const [call] = fake.find({ table: 'orders' });
    expect(call.filters).toEqual([
      ['eq', 'user_id', 'u1'],
      ['in', 'status', ['new', 'contacted', 'quoted', 'confirmed', 'picking', 'ready', 'out_for_delivery']],
      // LIKE wildcards typed in the box match only themselves.
      ['ilike', 'ref_num', '%alw-o\\_1\\%%'],
    ]);
    for (const [value, statuses] of [['done', ['fulfilled']], ['cancelled', ['cancelled']]]) {
      fake.calls.length = 0;
      await loadOrders(fake.client, { userId: 'u1', status: value });
      expect(fake.find({ table: 'orders' })[0].filters[1]).toEqual(['in', 'status', statuses]);
    }
    fake.calls.length = 0;
    await loadOrders(fake.client, { userId: 'u1', status: 'all', ref: '   ' });
    expect(fake.find({ table: 'orders' })[0].filters).toEqual([['eq', 'user_id', 'u1']]);
  });

  it('groups every status in exactly one filter besides All', () => {
    expect(ORDER_FILTERS.map((f) => [f.value, f.label])).toEqual([
      ['all', 'All orders'], ['open', 'Open'], ['done', 'Delivered or picked up'], ['cancelled', 'Cancelled'],
    ]);
    expect(ORDER_FILTERS.flatMap((f) => f.statuses || []).sort()).toEqual([...STATUSES].sort());
  });

  it('steps down to the columns an older database has, and remembers the step that worked', async () => {
    const asked = [];
    fake.respond = (request) => {
      asked.push(request.columns);
      if (/\bkind\b/.test(request.columns)) return { data: null, error: { code: '42703', message: 'column orders.kind does not exist' } };
      return undefined;
    };
    const first = await loadOrders(fake.client, { userId: 'u1' });
    expect(first.error).toBeNull();
    expect(first.rows).toHaveLength(23);
    expect(asked).toEqual([ORDER_COLUMN_STEPS[0], ORDER_COLUMN_STEPS[1]]);
    await loadOrders(fake.client, { userId: 'u1', from: 10 });
    expect(asked.slice(2)).toEqual([ORDER_COLUMN_STEPS[1]]);
  });

  it('falls back to the original columns on PGRST204 too, and reports any other error', async () => {
    fake.respond = (request) => (request.columns === ORDER_COLUMN_STEPS[2] ? undefined : { data: null, error: { code: 'PGRST204', message: 'x' } });
    expect((await loadOrders(fake.client, { userId: 'u1' })).error).toBeNull();
    expect(ORDER_COLUMN_STEPS[2]).toBe('id, ref_num, status, total_units, subtotal, created_at, order_items(id, product_id, variant, product_name, sku, qty, unit_price)');
    resetOrderColumnsForTests();
    const denied = { code: '42501', message: 'permission denied for table orders' };
    fake.respond = () => ({ data: null, error: denied });
    expect(await loadOrders(fake.client, { userId: 'u1' })).toEqual({ rows: [], total: null, error: denied });
    expect(fake.find({ table: 'orders' })).toHaveLength(4);
  });
});

describe('the buyer’s words', () => {
  it('names every status the way a buyer would, and an unknown one as received', () => {
    expect(STATUSES.map((status) => buyerStatus({ status, delivery: 'delivery' }))).toEqual([
      'Received', 'Confirming with a rep', 'Quote ready', 'Confirmed', 'Being picked', 'Ready', 'Out for delivery', 'Delivered', 'Cancelled',
    ]);
    expect(buyerStatus({ status: 'fulfilled', delivery: 'willcall' })).toBe('Picked up');
    expect(buyerStatus({ status: 'archived' })).toBe('Received');
    expect(Object.keys(BUYER_STATUS)).toEqual(STATUSES);
    for (const label of ['Received', 'Confirming with a rep', 'Quote ready', 'Being picked', 'Out for delivery', 'Picked up']) {
      expect(STATUS_LEGEND).toContain(label);
    }
    expect(STATUSES.map(statusTone)).toEqual(['', 'contacted', 'contacted', '', '', '', '', 'fulfilled', 'cancelled']);
  });

  it('tells an order from a quote request, with or without orders.kind', () => {
    expect(orderKind({ kind: 'order', subtotal: null })).toBe('order');
    expect(orderKind({ kind: 'quote', subtotal: 12 })).toBe('quote');
    // No kind column: the account's own unpriced request is a quote.
    expect(orderKind({ subtotal: 125.5 })).toBe('order');
    expect(orderKind({ subtotal: null })).toBe('quote');
    expect(KIND_LABEL).toEqual({ order: 'Order', quote: 'Quote request' });
  });

  it('dates an order without the time, and a requested day without a time-zone shift', () => {
    expect(placedDate('2026-10-08T15:04:09Z')).toBe(new Date('2026-10-08T15:04:09Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    expect(placedDate('2026-10-08T15:04:09Z')).not.toMatch(/:/);
    expect(placedDate('nope')).toBe('');
    expect(dayDate('2026-10-01')).toBe('Oct 1, 2026');
    expect(dayDate('2026-1-1')).toBeNull();
    expect(requestedDate({ preferred_date: '2026-12-31' })).toBe('Requested Dec 31, 2026');
    expect(requestedDate({ preferred_date: null })).toBeNull();
  });

  it('says how the order was to arrive', () => {
    expect(shipLine({ delivery: 'willcall', ship_street: '1 Main St' })).toBe('Will-call pickup');
    expect(shipLine({ delivery: 'delivery', ship_street: '1200 Example Ave N', ship_city: 'Birmingham', ship_state: 'AL', ship_zip: '35203' }))
      .toBe('Delivery to 1200 Example Ave N, Birmingham, AL 35203');
    expect(shipLine({ delivery: 'delivery', ship_street: null, ship_city: ' ', ship_state: 'AL', ship_zip: null })).toBe('Delivery to AL');
    expect(shipLine({ delivery: 'delivery' })).toBe('Delivery');
    // The oldest column set has no delivery: say nothing.
    expect(shipLine({})).toBeNull();
  });

  it('counts what the list shows', () => {
    expect(countText(10, 23)).toBe('Showing 10 of 23 orders');
    expect(countText(23, 23)).toBe('Showing 23 orders');
    expect(countText(1, 1)).toBe('Showing 1 order');
    expect(countText(2, 2, { filtered: true })).toBe('Showing 2 matching orders');
    expect(countText(10, 11, { filtered: true })).toBe('Showing 10 of 11 matching orders');
    expect(countText(10, null)).toBe('Showing 10 orders');
  });
});
