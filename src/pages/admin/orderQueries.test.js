// Admin -> Orders' query and CSV export (AW-110): PostgREST escaping, the
// builder calls for each filter, and one CSV record per order line.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import {
  ADMIN_ORDER_SELECT, ORDER_CSV_COLUMNS, ORDER_PAGE_SIZE, applyOrderFilters, cleanOrderSearch, containsPattern, dayStart, hasOrderFilters, isQuote,
  orderCsvRecords, orderFilters, orderPageCount, orderPageRange, orderSearchFilter, orderStatusCounts, ordersCsvFileName, ordersForExport, ordersQuery,
  postgrestQuote, probeQuoteWorkflow, rangeTotal,
} from './orderQueries.js';
import { parseCsv, toCsv } from './csv.js';

afterEach(() => { vi.unstubAllEnvs(); });

describe('escaping the search for PostgREST', () => {
  it('quotes a value, escaping " and \\', () => {
    expect(postgrestQuote('Smith, Jones & Co.')).toBe('"Smith, Jones & Co."');
    expect(postgrestQuote('Say "hi" (now)')).toBe('"Say \\"hi\\" (now)"');
    expect(postgrestQuote('back\\slash')).toBe('"back\\\\slash"');
  });

  it('matches anywhere, with LIKE’s own wildcards escaped', () => {
    expect(containsPattern('ALW-O')).toBe('%ALW-O%');
    expect(containsPattern('50%_off')).toBe('%50\\%\\_off%');
    expect(containsPattern('a\\b')).toBe('%a\\\\b%');
    // PostgREST turns * into %; a typed * stands for one character instead.
    expect(containsPattern('a*b')).toBe('%a_b%');
  });

  it('searches the reference, business, contact, email and phone in one or=()', () => {
    expect(orderSearchFilter('Mart, "Big"')).toBe([
      'ref_num.ilike."%Mart, \\"Big\\"%"', 'business.ilike."%Mart, \\"Big\\"%"', 'contact.ilike."%Mart, \\"Big\\"%"',
      'email.ilike."%Mart, \\"Big\\"%"', 'phone.ilike."%Mart, \\"Big\\"%"',
    ].join(','));
    // The value after escaping: % and _ escaped for LIKE, then \ escaped for the quotes.
    expect(orderSearchFilter('5%').split(',')[0]).toBe('ref_num.ilike."%5\\\\%%"');
  });

  it('trims and caps the search', () => {
    expect(cleanOrderSearch('  Test   Market  ')).toBe('Test Market');
    expect(cleanOrderSearch('x'.repeat(150))).toHaveLength(100);
    expect(cleanOrderSearch(null)).toBe('');
  });
});

describe('ordersQuery', () => {
  const run = (filters) => {
    const fake = createFakeSupabase();
    ordersQuery(fake.client, filters).then(() => {});
    return fake;
  };

  it('asks for the first page of 50, newest first, with the count of every match and the account embed named by its foreign key', async () => {
    const fake = createFakeSupabase();
    await ordersQuery(fake.client, {});
    const [request] = fake.calls;
    expect(request).toMatchObject({ table: 'orders', op: 'select', columns: ADMIN_ORDER_SELECT, options: { count: 'exact' }, filters: [] });
    expect(request.columns).toContain('profiles!orders_user_id_fkey(');
    // Orders of the same instant by id, so no page repeats or skips one.
    expect(request.modifiers).toEqual([['order', 'created_at', { ascending: false }], ['order', 'id', { ascending: false }], ['range', 0, 49]]);
    expect(ORDER_PAGE_SIZE).toBe(50);
  });

  it('filters by the status unless it is all, and asks for the page’s range', async () => {
    const fake = createFakeSupabase();
    await ordersQuery(fake.client, {}, { status: 'picking', page: 3 });
    await ordersQuery(fake.client, {}, { status: 'all', page: 2, pageSize: 10, select: 'id' });
    expect(fake.calls[0].filters).toEqual([['eq', 'status', 'picking']]);
    expect(fake.calls[0].modifiers.at(-1)).toEqual(['range', 100, 149]);
    expect(fake.calls[1]).toMatchObject({ columns: 'id', filters: [] });
    expect(fake.calls[1].modifiers.at(-1)).toEqual(['range', 10, 19]);
  });

  it('works out the range and the number of pages', () => {
    expect(orderPageRange(1)).toEqual([0, 49]);
    expect(orderPageRange(7)).toEqual([300, 349]);
    expect(orderPageRange(2, 20)).toEqual([20, 39]);
    // Nonsense is page 1.
    for (const page of [0, -3, 'x', undefined, null]) expect(orderPageRange(page), String(page)).toEqual([0, 49]);
    expect(orderPageCount(0)).toBe(1);
    expect(orderPageCount(50)).toBe(1);
    expect(orderPageCount(51)).toBe(2);
    expect(orderPageCount(312)).toBe(7);
  });

  it('reads the total from PostgREST’s range-past-the-end refusal', () => {
    expect(rangeTotal({ code: 'PGRST103', details: 'An offset of 300 was requested, but there are only 12 rows.' })).toBe(12);
    expect(rangeTotal({ code: 'PGRST103', details: 'An offset of 50 was requested, but there are only 1 row.' })).toBe(1);
    expect(rangeTotal({ code: 'PGRST103', details: null })).toBe(0);
    expect(rangeTotal({ code: '42501' })).toBeNull();
    expect(rangeTotal(null)).toBeNull();
  });

  it('adds one filter per toolbar field', async () => {
    const fake = run({
      search: ' Gus ', from: '2026-10-01', to: '2026-10-07', on: '2026-10-09', method: 'willcall', account: '11111111-2222-4333-8444-555555555555',
    });
    await Promise.resolve();
    expect(fake.calls[0].filters).toEqual([
      ['or', orderSearchFilter('Gus')],
      ['gte', 'created_at', dayStart('2026-10-01')],
      ['lt', 'created_at', dayStart('2026-10-08')],
      ['eq', 'preferred_date', '2026-10-09'],
      ['eq', 'delivery', 'willcall'],
      ['eq', 'user_id', '11111111-2222-4333-8444-555555555555'],
    ]);
  });

  it('starts a day at this computer’s midnight, and ends "Placed to" at the next one', () => {
    const start = new Date(dayStart('2026-10-01'));
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes()]).toEqual([2026, 9, 1, 0, 0]);
    const next = new Date(dayStart('2026-10-31', 1));
    expect([next.getMonth(), next.getDate(), next.getHours()]).toEqual([10, 1, 0]);
    // Across a daylight-saving change the next day still starts at midnight.
    const after = new Date(dayStart('2026-11-01', 1));
    expect([after.getDate(), after.getHours()]).toEqual([2, 0]);
  });

  it('reads the filters from the URL query and the search box', () => {
    expect(orderFilters({ status: 'all', from: '2026-10-01', method: 'delivery' }, '  ref ')).toEqual({
      search: 'ref', from: '2026-10-01', to: null, on: null, method: 'delivery', account: null,
    });
    expect(hasOrderFilters(orderFilters({ status: 'picking' }, ''))).toBe(false);
    expect(hasOrderFilters(orderFilters({}, 'x'))).toBe(true);
  });
});

describe('one set of filters for the page, the counts and the export (AW-199)', () => {
  const filters = {
    search: 'Gus', from: '2026-10-01', to: '2026-10-07', on: '2026-10-09', method: 'willcall', account: '11111111-2222-4333-8444-555555555555',
  };
  const toolbar = [
    ['or', orderSearchFilter('Gus')],
    ['gte', 'created_at', dayStart('2026-10-01')],
    ['lt', 'created_at', dayStart('2026-10-08')],
    ['eq', 'preferred_date', '2026-10-09'],
    ['eq', 'delivery', 'willcall'],
    ['eq', 'user_id', '11111111-2222-4333-8444-555555555555'],
  ];

  it('applyOrderFilters adds the toolbar’s filters to any query', async () => {
    const fake = createFakeSupabase();
    await applyOrderFilters(fake.client.from('orders').select('id'), filters);
    expect(fake.calls[0].filters).toEqual(toolbar);
    await applyOrderFilters(fake.client.from('orders').select('id'), {});
    expect(fake.calls[1].filters).toEqual([]);
  });

  it('counts each status and all with HEAD requests and the same filters', async () => {
    const fake = createFakeSupabase();
    fake.tables.orders = [
      { id: 1, status: 'new' }, { id: 2, status: 'new' }, { id: 3, status: 'picking' }, { id: 4, status: 'cancelled' },
    ];
    const { counts, error } = await orderStatusCounts(fake.client, {}, ['new', 'picking', 'fulfilled', 'all']);
    expect(error).toBeNull();
    expect(counts).toEqual({ new: 2, picking: 1, fulfilled: 0, all: 4 });
    expect(fake.calls.map((c) => [c.columns, c.options, c.filters])).toEqual([
      ['id', { count: 'exact', head: true }, [['eq', 'status', 'new']]],
      ['id', { count: 'exact', head: true }, [['eq', 'status', 'picking']]],
      ['id', { count: 'exact', head: true }, [['eq', 'status', 'fulfilled']]],
      ['id', { count: 'exact', head: true }, []],
    ]);
    fake.calls.length = 0;
    await orderStatusCounts(fake.client, filters, ['new']);
    expect(fake.calls.map((c) => c.filters)).toEqual([[...toolbar, ['eq', 'status', 'new']], toolbar]);
  });

  it('leaves out a count that failed, and returns its error', async () => {
    const fake = createFakeSupabase();
    fake.tables.orders = [{ id: 1, status: 'new' }];
    fake.respond = (request) => (request.filters.some(([, column, value]) => column === 'status' && value === 'quoted')
      ? { data: null, error: { code: '', message: 'TypeError: Failed to fetch' }, count: null } : undefined);
    const { counts, error } = await orderStatusCounts(fake.client, {}, ['new', 'quoted']);
    expect(counts).toEqual({ new: 1, all: 1 });
    expect(error.message).toBe('TypeError: Failed to fetch');
  });

  it('exports every match, a page of 1000 at a time, with the page’s filters and status', async () => {
    const fake = createFakeSupabase();
    fake.tables.orders = Array.from({ length: 2300 }, (_, i) => ({ id: i, status: i % 2 ? 'new' : 'picking' }));
    const all = await ordersForExport(fake.client, {}, 'all');
    expect(all.data).toHaveLength(2300);
    expect(all.truncated).toBe(false);
    expect(fake.calls.map((c) => c.modifiers.at(-1))).toEqual([['range', 0, 999], ['range', 1000, 1999], ['range', 2000, 2999]]);
    expect(fake.calls[0]).toMatchObject({ columns: ADMIN_ORDER_SELECT, filters: [] });
    expect(fake.calls[0].modifiers.slice(0, 2)).toEqual([['order', 'created_at', { ascending: false }], ['order', 'id', { ascending: false }]]);
    fake.calls.length = 0;
    const picking = await ordersForExport(fake.client, filters, 'picking');
    expect(fake.calls[0].filters).toEqual([...toolbar, ['eq', 'status', 'picking']]);
    // (The fake applies only eq: the status here.)
    expect(picking.data).toHaveLength(1150);
    expect(picking.data.every((o) => o.status === 'picking')).toBe(true);
  });

  it('asks once whether orders have kind when a page has no row to tell by', async () => {
    const fake = createFakeSupabase();
    expect(await probeQuoteWorkflow(fake.client)).toBe(true);
    expect(fake.calls[0]).toMatchObject({ table: 'orders', columns: 'kind', modifiers: [['limit', 1]] });
    fake.respond = () => ({ data: null, error: { code: '42703', message: 'column orders.kind does not exist' } });
    expect(await probeQuoteWorkflow(fake.client)).toBe(false);
    fake.respond = () => ({ data: null, error: { code: '', message: 'TypeError: Failed to fetch' } });
    expect(await probeQuoteWorkflow(fake.client)).toBeNull();
  });
});

describe('orderCsvRecords', () => {
  const order = {
    ref_num: 'ALW-O-1', created_at: '2026-10-08T15:00:00Z', kind: 'order', status: 'confirmed', business: 'Test, "Market"', contact: 'Tess',
    email: 'tess@example.test', phone: '+1 205 555 0100', delivery: 'delivery', preferred_date: '2026-10-10', subtotal: '21.70',
    order_items: [
      { sku: 'AW-ARGO', product_name: 'Argo corn starch', variant: null, qty: 2, unit_price: '10.85' },
      { sku: 'AW-GAS-5', product_name: 'Gas cans — 5 gal', variant: '5 gal', qty: 1, unit_price: null },
    ],
  };

  it('writes the header and one record per line, money as numbers', () => {
    const records = orderCsvRecords([order]);
    expect(records[0]).toEqual(ORDER_CSV_COLUMNS);
    expect(records).toHaveLength(3);
    expect(records[1]).toEqual(['ALW-O-1', '2026-10-08T15:00:00Z', 'order', 'confirmed', 'Test, "Market"', 'Tess', 'tess@example.test', '+1 205 555 0100',
      'delivery', '2026-10-10', 'AW-ARGO', 'Argo corn starch', null, 2, 10.85, 21.7, 21.7]);
    expect(records[2].slice(10)).toEqual(['AW-GAS-5', 'Gas cans — 5 gal', '5 gal', 1, null, null, 21.7]);
  });

  it('gives an order without lines one record, and a quote without kind its kind', () => {
    const records = orderCsvRecords([{ ref_num: 'ALW-Q-1', user_id: null, subtotal: null, order_items: [] }]);
    expect(records[1][2]).toBe('quote');
    expect(records[1].slice(10)).toEqual([null, null, null, null, null, null, null]);
    expect(isQuote({ user_id: 'a', subtotal: 1 })).toBe(false);
  });

  it('defuses formulas a buyer typed into the public form, through toCsv', () => {
    const text = toCsv(orderCsvRecords([{ ...order, business: '=HYPERLINK("http://x")', contact: '@SUM(A1)' }]));
    const [, row] = parseCsv(text);
    expect(row[4]).toBe('\'=HYPERLINK("http://x")');
    expect(row[5]).toBe("'@SUM(A1)");
    expect(row[7]).toBe("'+1 205 555 0100");
    // Numbers are written as they are.
    expect(row[13]).toBe('2');
    expect(row[14]).toBe('10.85');
  });

  it('names the file by the local date', () => {
    expect(ordersCsvFileName(new Date(2026, 9, 8, 23, 30))).toBe('orders-2026-10-08.csv');
  });
});
