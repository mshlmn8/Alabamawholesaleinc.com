// An order's pick list and packing slip (AW-110): the lines sorted by
// department, sub-line and name; no prices and no glyph icons on either
// sheet; the customer's notes, never staff notes; the bundled catalog when
// the products embed can't be read.
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const { createFakeSupabase } = await import('./fakeSupabase.js');
  const fake = createFakeSupabase();
  return { supabase: fake.client, fake, isBackendConfigured: true, AUTH_STORAGE_KEY: 'aw-auth' };
});

const { fake } = await import('../../lib/supabase.js');
const { PRINT_ORDER_SELECT, comparePrintLines, loadPrintOrder, printDoc, printGroups, printHref, printLines, printTotals } = await import('./printSheet.js');
const { ADMIN_ORDER_SELECT } = await import('./orderQueries.js');
const { PrintSheet } = await import('./PrintSheet.jsx');

const ID = '11111111-2222-4333-8444-555555555555';
const line = (id, extra) => ({ id, product_id: null, product_name: `Item ${id}`, sku: `AW-${id}`, qty: 1, unit_price: 9.99, ...extra });
// Products from the bundled catalog: #14 Kite (TOBACCO, Cigarettes), #2 White
// Owl (TOBACCO, Cigars & Cigarillos), #200 Nerds (CANDIES), #45 Argo (FOOD
// STUFF), #356 Gas cans (MOTOR OIL), #300 a 2-pack (NOVELTIES).
const ORDER = {
  id: ID, ref_num: 'ALW-O-BBBB222233', business: 'Test Market LLC', contact: 'Tess', phone: '205-555-0100', email: 'tess@example.test',
  delivery: 'delivery', ship_street: '2 Test Way', ship_city: 'Hoover', ship_state: 'AL', ship_zip: '35244', preferred_date: '2026-10-10',
  created_at: '2026-10-08T15:00:00Z', subtotal: 120.5, notes: 'Leave at the back door', staff_note: 'never printed',
  order_items: [
    line(1, { product_id: 356, product_name: 'Gas cans', sku: 'AW-GAS-CANS', qty: 1 }),
    line(2, { product_id: 45, product_name: 'Argo corn starch', sku: 'AW-ARGO-CORN-STARCH', qty: 2 }),
    line(3, { product_id: 2, product_name: 'White Owl cigarillos', sku: 'AW-WO', qty: 1 }),
    line(4, { product_id: 14, product_name: 'Kite cigarette tobacco', sku: 'AW-KITE', qty: 3 }),
    line(5, { product_id: 200, product_name: 'Nerds bags', sku: 'AW-NERDS-BAGS', qty: 2 }),
    line(6, { product_id: null, product_name: 'Deleted product', sku: 'AW-GONE', qty: 1 }),
    line(7, { product_id: 300, product_name: 'Melted mushroom pre rolls 2pk', sku: 'AW-MELTED-MUSHROOM', qty: 4, sell_unit: null }),
  ],
};

beforeEach(() => {
  fake.reset();
  fake.tables.orders = [ORDER];
});

describe('the lines', () => {
  it('walk the warehouse: department in the navigation order, sub-line, name; unknown products last', () => {
    const lines = printLines(ORDER);
    expect(lines.map((l) => l.sku)).toEqual(['AW-KITE', 'AW-WO', 'AW-MELTED-MUSHROOM', 'AW-NERDS-BAGS', 'AW-ARGO-CORN-STARCH', 'AW-GAS-CANS', 'AW-GONE']);
    expect(printGroups(lines).map((g) => [g.label, g.lines.length])).toEqual([
      ['Tobacco', 2], ['Novelties & Vapes', 1], ['Candies', 1], ['Food Stuff', 1], ['Motor Oil', 1], ['Other', 1],
    ]);
    // The sell unit: the line's own, else the product's.
    expect(lines.find((l) => l.sku === 'AW-MELTED-MUSHROOM').unit).toBe('2-pack');
    expect(printTotals(lines)).toBe('7 lines · 14 units');
    expect(printTotals(lines.slice(0, 1))).toBe('1 line · 3 units');
  });

  it('prefers the products embed, and sorts a department the navigation doesn’t know after the known ones', () => {
    const order = {
      order_items: [
        line(1, { products: { cat: 'SEASONAL', sub: 'Halloween', sell_unit: 'case of 12' } }),
        line(2, { products: { cat: 'CANDIES', sub: 'Bags', sell_unit: '' }, sell_unit: 'box' }),
      ],
    };
    const lines = printLines(order);
    expect(lines.map((l) => [l.cat, l.unit])).toEqual([['CANDIES', 'box'], ['SEASONAL', 'case of 12']]);
    expect(comparePrintLines({ cat: 'TOBACCO', sub: 'b', name: 'a' }, { cat: 'TOBACCO', sub: 'B', name: 'b' })).toBeLessThan(0);
  });

  it('builds the print links and reads the sheet', () => {
    expect(printHref(ID, 'pick')).toBe(`/admin/orders/${ID}/print?doc=pick`);
    expect(printHref(ID, 'slip')).toBe(`/admin/orders/${ID}/print?doc=slip`);
    expect(printDoc('slip')).toBe('slip');
    expect(printDoc('invoice')).toBe('pick');
    expect(PRINT_ORDER_SELECT).toBe('*, order_items(*, products(cat, sub, sell_unit)), profiles!orders_user_id_fkey(business, name, pricing_tier)');
  });
});

describe('loading the order', () => {
  it('reads the order with the products embed, then without it if that fails', async () => {
    fake.respond = (request) => (request.columns === PRINT_ORDER_SELECT ? { data: null, error: { code: 'PGRST200', message: 'no relationship' }, status: 400 } : undefined);
    const result = await loadPrintOrder(fake.client, ID);
    expect(fake.calls.map((c) => [c.columns, c.filters, c.single])).toEqual([
      [PRINT_ORDER_SELECT, [['eq', 'id', ID]], 'maybe'],
      [ADMIN_ORDER_SELECT, [['eq', 'id', ID]], 'maybe'],
    ]);
    expect(result.order.ref_num).toBe('ALW-O-BBBB222233');
  });

  it('doesn’t retry a lost connection, and tells a missing order from an error', async () => {
    fake.respond = () => ({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    expect((await loadPrintOrder(fake.client, ID)).error).toBeTruthy();
    expect(fake.calls).toHaveLength(1);
    fake.respond = null;
    fake.tables.orders = [];
    expect(await loadPrintOrder(fake.client, ID)).toEqual({ order: null, error: null });
  });
});

describe('the sheets', () => {
  const show = async (doc) => {
    let view;
    await act(async () => { view = render(<PrintSheet orderId={ID} doc={doc} listHref="/admin/orders?status=all" />); });
    return view;
  };

  it('prints a pick list: facts, a drawn box per line, no prices, no glyphs, the customer’s notes only', async () => {
    const { container } = await show('pick');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Pick list ALW-O-BBBB222233');
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
    const facts = Object.fromEntries([...container.querySelectorAll('.print-facts > div')].map((d) => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]));
    expect(facts).toEqual({
      Business: 'Test Market LLC', Contact: 'Tess', Phone: '205-555-0100', Method: 'Delivery to 2 Test Way, Hoover, AL 35244',
      Requested: 'Oct 10, 2026', Placed: expect.stringMatching(/^Oct 8, 2026, \d{1,2}:00 [AP]M$/),
    });
    expect([...container.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Picked', 'SKU', 'Qty', 'Unit', 'Product']);
    expect(container.querySelectorAll('tbody tr:not(.print-group) .print-tick')).toHaveLength(7);
    for (const tick of container.querySelectorAll('.print-tick')) {
      expect(tick.textContent).toBe('');
      expect(tick.getAttribute('aria-hidden')).toBe('true');
    }
    const text = container.textContent;
    expect(text).not.toMatch(/\$|9\.99|120\.5/);
    expect(text).not.toMatch(/[☐☑✓✔□■↗→⊞⌄]/);
    expect(text).toContain('Leave at the back door');
    expect(text).not.toContain('never printed');
    expect(text).toContain('7 lines · 14 units');
    expect(text).not.toContain('Graymont');
    expect(screen.getByRole('link', { name: 'Show the packing slip' }).getAttribute('href')).toBe(`/admin/orders/${ID}/print?doc=slip`);
    expect(screen.getByRole('link', { name: 'Back to orders' }).getAttribute('href')).toBe('/admin/orders?status=all');
  });

  it('prints a packing slip with the store’s address and a Packed column, still without prices', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { container } = await show('slip');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Packing slip ALW-O-BBBB222233');
    expect(container.querySelector('.print-company').textContent).toBe('Alabama Wholesale Inc · 613 Graymont Ave N, Birmingham, AL 35203 · (205) 354-4473');
    expect(container.querySelector('thead th').textContent).toBe('Packed');
    expect(container.textContent).not.toMatch(/\$/);
    act(() => { screen.getByRole('button', { name: 'Print' }).click(); });
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it('says when the order is gone', async () => {
    fake.tables.orders = [];
    await show('pick');
    expect(screen.getByText('That order wasn’t found. It may have been deleted.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Print' }).disabled).toBe(true);
  });
});
