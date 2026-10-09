// Admin -> Orders' query and CSV export (AW-110): PostgREST escaping, the
// builder calls for each filter, and one CSV record per order line.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase.js';
import {
  ADMIN_ORDER_SELECT, ORDER_CSV_COLUMNS, ORDER_LIMIT, cleanOrderSearch, containsPattern, dayStart, hasOrderFilters, isQuote, orderCsvRecords,
  orderFilters, orderSearchFilter, ordersCsvFileName, ordersQuery, postgrestQuote,
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

  it('asks for the newest 200 orders, with the account embed named by its foreign key', async () => {
    const fake = createFakeSupabase();
    await ordersQuery(fake.client, {});
    const [request] = fake.calls;
    expect(request).toMatchObject({ table: 'orders', op: 'select', columns: ADMIN_ORDER_SELECT, filters: [] });
    expect(request.columns).toContain('profiles!orders_user_id_fkey(');
    expect(request.modifiers).toEqual([['order', 'created_at', { ascending: false }], ['limit', ORDER_LIMIT]]);
    expect(ORDER_LIMIT).toBe(200);
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
