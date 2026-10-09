// Admin -> Products' bulk changes, export and import (AW-114): the adjust
// box, the preview math (integer cents, rounded like the database), the CSV
// columns and file name, and the import plan.
import { describe, expect, it } from 'vitest';
import { tierUnitPrice } from '../../lib/pricing.js';
import { parseCsv, toCsv } from './csv.js';
import {
  adjustPreview, adjustRow, adjustedPrice, createRows, csvFileName, displayValue, exportColumns, importPlan, importRows, parseActive, parseAdjust,
  productCsvRecords,
} from './productBulk.js';

describe('the adjust box', () => {
  it('reads a percentage or an amount, two decimals at most, never 0', () => {
    expect(parseAdjust('pct', ' 5 ')).toEqual({ ok: true, pct: 5, amount: 0 });
    expect(parseAdjust('pct', '-2.5')).toEqual({ ok: true, pct: -2.5, amount: 0 });
    expect(parseAdjust('pct', '+12.25')).toEqual({ ok: true, pct: 12.25, amount: 0 });
    expect(parseAdjust('amount', '$1.50')).toEqual({ ok: true, pct: 0, amount: 1.5 });
    expect(parseAdjust('amount', '-$0.25')).toEqual({ ok: true, pct: 0, amount: -0.25 });
    for (const bad of ['', 'five', '5%', '1.234', '1e2', '0', '0.00']) expect(parseAdjust('pct', bad).ok, bad).toBe(false);
    expect(parseAdjust('pct', '-100').error).toBe('Enter a percentage above -100 and up to 1000.');
    expect(parseAdjust('pct', '1000').ok).toBe(true);
    expect(parseAdjust('pct', '1000.01').ok).toBe(false);
    expect(parseAdjust('amount', '99999.99').ok).toBe(true);
    expect(parseAdjust('amount', '100000').ok).toBe(false);
  });
});

describe('the adjust math (integer cents, rounded half away from zero like Postgres)', () => {
  it('rounds +5% the way tier_unit_price does', () => {
    expect(adjustedPrice(45.10, { pct: 5 })).toBe(47.36); // 47.355
    expect(adjustedPrice(10.10, { pct: 5 })).toBe(10.61); // 10.605, not 10.60 as toFixed gives
    expect(adjustedPrice(0.10, { pct: 5 })).toBe(0.11);
    for (const list of [1.01, 10.1, 13.37, 45.1, 99.99, 1234.55]) {
      expect(adjustedPrice(list, { pct: 5 }), String(list)).toBe(tierUnitPrice(list, -5));
      expect(adjustedPrice(list, { pct: -7.5 }), String(list)).toBe(tierUnitPrice(list, 7.5));
    }
  });

  it('adds an amount, and combines the two the way the database does', () => {
    expect(adjustedPrice(10.61, { amount: 1.25 })).toBe(11.86);
    expect(adjustedPrice(47.36, { pct: -10 })).toBe(42.62); // 42.624
    expect(adjustedPrice(10, { pct: 2.5, amount: -0.25 })).toBe(10);
    expect(adjustedPrice(0.1, { amount: -1 })).toBe(-0.9);
    expect(adjustedPrice(0.004, { amount: 0 })).toBe(0);
    expect(adjustedPrice(null, { pct: 5 })).toBeNull();
  });

  const rows = [
    { id: 1, name: 'One', sku: 'AW-1', price: 45.1, variantPrices: { Red: 20, Blue: 0.3, Green: null } },
    { id: 2, name: 'Two', sku: 'AW-2', price: 10.1, variantPrices: {} },
    { id: 3, name: 'Three', sku: 'AW-3', price: null, variantPrices: {} },
  ];

  it('previews old -> new, lists products on request as skipped and counts the variant prices', () => {
    const preview = adjustPreview(rows, { pct: 5 });
    expect(preview.changes).toEqual([
      { id: 1, name: 'One', sku: 'AW-1', old: 45.1, next: 47.36 },
      { id: 2, name: 'Two', sku: 'AW-2', old: 10.1, next: 10.61 },
    ]);
    expect(preview.skipped).toEqual([{ id: 3, name: 'Three', sku: 'AW-3' }]);
    expect(preview.refused).toEqual([]);
    expect(preview.variants).toBe(2);
    expect(adjustPreview(rows, { pct: 5 }, { variants: false }).variants).toBe(0);
  });

  it('refuses a change that takes any price below 0 or above 99,999.99, variants included', () => {
    const below = adjustPreview(rows, { amount: -10.5 });
    expect(below.refused.map((r) => [r.name, r.next])).toEqual([['One (Blue)', -10.2], ['Two', -0.4]]);
    expect(below.changes.map((r) => [r.name, r.next])).toEqual([['One', 34.6]]);
    expect(adjustPreview(rows, { amount: -0.31 }).refused.map((r) => r.name)).toEqual(['One (Blue)']);
    expect(adjustPreview(rows, { amount: -0.31 }, { variants: false }).refused).toEqual([]);
    expect(adjustPreview([{ id: 9, name: 'Big', price: 99999.99 }], { pct: 1 }).refused).toHaveLength(1);
  });

  it('applies the change to a row as the database leaves it', () => {
    expect(adjustRow(rows[0], { pct: 5 })).toMatchObject({ price: 47.36, variantPrices: { Red: 21, Blue: 0.32, Green: null } });
    expect(adjustRow(rows[0], { pct: 5 }, { variants: false }).variantPrices).toEqual(rows[0].variantPrices);
    expect(adjustRow(rows[2], { pct: 5 }).price).toBeNull();
  });
});

const product = (id, extra = {}) => ({
  id, name: `Product ${id}`, brand: 'Brand', cat: 'CANDIES', sub: 'Gum', sku: `AW-P${id}`, sell_unit: 'Box of 12', tag: null, active: true,
  price: 10, variants: [], variant_axis: null, unavailable_variants: [], description: '', img: null, stock_status: 'in_stock', featured_rank: null,
  variantPrices: {}, ...extra,
});
const ALL = new Set(['id', 'name', 'brand', 'cat', 'sub', 'sku', 'tag', 'active', 'sell_unit', 'description', 'variants', 'variant_axis',
  'unavailable_variants', 'img', 'updated_at', 'stock_status', 'featured_rank']);

describe('export', () => {
  it('writes id, sku, name, brand, cat, sub, sell_unit, price, tag, active, then stock and rank when loaded', () => {
    expect(exportColumns(ALL)).toEqual(['id', 'sku', 'name', 'brand', 'cat', 'sub', 'sell_unit', 'price', 'tag', 'active', 'stock_status', 'featured_rank']);
    expect(exportColumns(new Set(['id', 'name']))).toHaveLength(10);
    const records = productCsvRecords([product(1, { price: 12.5, tag: 'NEW', featured_rank: 3 }), product(2, { price: null, active: false, name: '=cmd' })], ALL);
    expect(records[1]).toEqual(['1', 'AW-P1', 'Product 1', 'Brand', 'CANDIES', 'Gum', 'Box of 12', '12.50', 'NEW', 'true', 'in_stock', '3']);
    expect(records[2]).toEqual(['2', 'AW-P2', '=cmd', 'Brand', 'CANDIES', 'Gum', 'Box of 12', '', '', 'false', 'in_stock', '']);
    expect(toCsv(records)).toContain("\r\n2,AW-P2,'=cmd,");
  });

  it('names the file by the local date', () => {
    expect(csvFileName(new Date(2026, 9, 8, 23, 59))).toBe('products-2026-10-08.csv');
    expect(csvFileName(new Date(2027, 0, 2))).toBe('products-2027-01-02.csv');
  });
});

describe('import', () => {
  const rows = [
    product(1, { name: 'Kite', sku: 'AW-KITE', price: 12.5, tag: 'NEW' }),
    product(2, { name: 'Swisher', sku: 'aw-swisher', price: null }),
    product(3, { name: 'Argo', sku: 'AW-ARGO', active: false }),
  ];
  const plan = (csv, options = { columns: ALL }) => importPlan(parseCsv(csv), rows, options);

  it('matches SKUs in any case and lists only what changes, old -> new', () => {
    const result = plan('sku,name,price,tag,active\nAW-KITE,Kite,13.00,NEW,true\nAW-SWISHER,Swisher Sweets,9.5,,yes\naw-argo,Argo,10.00,,false\n');
    expect(result).toMatchObject({ error: null, used: ['name', 'price', 'tag', 'active'], unchanged: 1, unknown: [], invalid: [], ok: true });
    expect(result.changes).toEqual([
      { id: 1, sku: 'AW-KITE', name: 'Kite', fields: [{ column: 'price', old: 12.5, next: 13 }], patch: { price: 13 } },
      { id: 2, sku: 'aw-swisher', name: 'Swisher', fields: [{ column: 'name', old: 'Swisher', next: 'Swisher Sweets' }, { column: 'price', old: null, next: 9.5 }], patch: { name: 'Swisher Sweets', price: 9.5 } },
    ]);
    // The database is sent each product's own SKU, and only what changed.
    expect(importRows(result)).toEqual([{ sku: 'AW-KITE', price: 13 }, { sku: 'aw-swisher', name: 'Swisher Sweets', price: 9.5 }]);
  });

  it('leaves a column the file doesn’t have alone, and reads an empty price as price on request', () => {
    const result = plan('SKU,Price\nAW-KITE,\nAW-ARGO,"$1,234.50"\n');
    expect(result.used).toEqual(['price']);
    expect(result.changes.map((c) => c.patch)).toEqual([{ price: null }, { price: 1234.5 }]);
  });

  it('lists an unknown SKU as not imported when its row lacks the name, brand, cat or sub a new product needs', () => {
    const result = plan('sku,name\nAW-NOPE,New thing\nAW-KITE,Kite two\n');
    expect(result.unknown).toEqual([{ line: 2, sku: 'AW-NOPE' }]);
    expect(result.creates).toEqual([]);
    expect(result.changes.map((c) => c.id)).toEqual([1]);
    expect(result.ok).toBe(true);
    // The columns are there, but this row leaves the sub-line blank.
    expect(plan('sku,name,brand,cat,sub\nAW-NOPE,New thing,Brand,CANDIES,\n')).toMatchObject({ unknown: [{ line: 2, sku: 'AW-NOPE' }], creates: [], ok: false });
  });

  it('adds a new SKU whose row has a name, brand, cat and sub, inactive unless the file says, checked like the editor (AW-114)', () => {
    const result = plan('sku,name,brand,cat,sub,price,tag\naw new gum,  New gum ,Wrigley,candies,gum,1.50,new\nAW-KITE,Kite,Brand,CANDIES,Gum,12.50,NEW\n');
    expect(result).toMatchObject({ error: null, unknown: [], invalid: [], changes: [], unchanged: 1, ok: true });
    // The SKU as the editor writes it; the department and sub-line in the catalog's spelling.
    expect(result.creates).toEqual([{
      line: 2, sku: 'AW-NEW-GUM', name: 'New gum', cat: 'CANDIES', sub: 'Gum', price: 1.5, active: false,
      row: { sku: 'AW-NEW-GUM', name: 'New gum', brand: 'Wrigley', cat: 'CANDIES', sub: 'Gum', price: 1.5, tag: 'NEW' },
    }]);
    // Only the file's columns are sent: no active, so the database adds it inactive.
    expect(createRows(result)).toEqual([{ sku: 'AW-NEW-GUM', name: 'New gum', brand: 'Wrigley', cat: 'CANDIES', sub: 'Gum', price: 1.5, tag: 'NEW' }]);
    expect(importRows(result)).toEqual([]);
    // cat and sub stay "not imported" for the products already there.
    expect(result.ignored).toEqual(['cat', 'sub']);
    const live = plan('sku,name,brand,cat,sub,active\nAW-NEW,New,Brand,CANDIES,Gum,true\n');
    expect(live.creates[0]).toMatchObject({ active: true, price: null, row: { active: true } });
  });

  it('lists a new product’s problems as rows to fix, which block the import', () => {
    const result = plan([
      'sku,name,brand,cat,sub,price,active',
      'AW-NEW-1,New,Brand,NOPE,Gum,1,true',
      'AW-NEW-2,New,Brand,CANDIES,Mints,1,true',
      'AW-NEW-3!,New,Brand,CANDIES,Gum,-1,maybe',
      'AW-NEW-4,New,Brand,TOBACCO,Gum,1,true',
      'AW-KITE,Kite,Brand,CANDIES,Gum,13.00,true',
    ].join('\n'));
    expect(result.ok).toBe(false);
    expect(result.creates).toEqual([]);
    expect(result.invalid.map((r) => [r.line, r.sku, r.name, r.messages])).toEqual([
      [2, 'AW-NEW-1', 'New', ['cat: use one of the catalog’s departments, as the export writes it.']],
      [3, 'AW-NEW-2', 'New', ['sub: use one of the department’s sub-lines, as the export writes it (a new sub-line is added in the product editor).']],
      [4, 'AW-NEW-3!', 'New', [
        'active: use true or false.',
        'sku: Use 2 to 41 capital letters, digits and hyphens, starting with a letter or digit (e.g. AW-KITE-1OZ).',
        'price: Enter the price as an amount from 0 to 99999.99, such as 12.50, or leave it blank for price on request.',
      ]],
      [5, 'AW-NEW-4', 'New', ['sub: use one of the department’s sub-lines, as the export writes it (a new sub-line is added in the product editor).']],
    ]);
    expect(result.changes.map((c) => c.id)).toEqual([1]);
    // A new SKU listed twice is a row to fix, like any SKU.
    expect(plan('sku,name,brand,cat,sub\nAW-NEW,New,Brand,CANDIES,Gum\naw-new,New,Brand,CANDIES,Gum\n').invalid[0].messages).toEqual(['sku: listed twice (also on line 2).']);
  });

  it('lists invalid rows with the editor’s messages, which block the import', () => {
    const result = plan('sku,name,price,tag,active\nAW-KITE,,12.505,HOT,maybe\nAW-ARGO,Argo,-1,,true\nAW-KITE,Kite,,,true\n,x,1,,true\n');
    expect(result.ok).toBe(false);
    expect(result.invalid.map((r) => [r.line, r.sku, r.messages])).toEqual([
      [2, 'AW-KITE', ['active: use true or false.', 'name: Enter the product name.', 'price: Enter the price as an amount from 0 to 99999.99, such as 12.50, or leave it blank for price on request.', 'tag: Choose a tag from the list.']],
      [3, 'AW-ARGO', ['price: Enter the price as an amount from 0 to 99999.99, such as 12.50, or leave it blank for price on request.']],
      [4, 'AW-KITE', ['sku: listed twice (also on line 2).']],
      [5, '', ['sku: this row has no SKU.']],
    ]);
  });

  it('reads stock status by key or label and the homepage rank, only when the database has them', () => {
    const csv = 'sku,stock_status,featured_rank\nAW-KITE,Low stock,4\nAW-ARGO,out,\n';
    expect(plan(csv).changes.map((c) => c.patch)).toEqual([{ stock_status: 'low', featured_rank: 4 }, { stock_status: 'out' }]);
    const older = plan(csv, { columns: new Set([...ALL].filter((c) => !['stock_status', 'featured_rank'].includes(c))) });
    expect(older).toMatchObject({ used: [], unavailable: ['stock_status', 'featured_rank'], ok: false, unchanged: 2 });
    expect(plan('sku,featured_rank\nAW-KITE,1000\n').invalid[0].messages).toEqual(['featured_rank: Enter a whole number from 1 to 999, or leave it blank.']);
  });

  it('round-trips an export: nothing changes', () => {
    const result = importPlan(parseCsv(toCsv(productCsvRecords(rows, ALL))), rows, { columns: ALL });
    expect(result).toMatchObject({ ignored: ['id', 'cat', 'sub'], changes: [], unchanged: 3, invalid: [], ok: false });
  });

  it('refuses a file it can’t use', () => {
    expect(importPlan([], rows).error).toBe('The file is empty.');
    expect(plan('name,price\nKite,1\n').error).toMatch(/needs a sku column/);
    expect(plan('sku,price,Price\nAW-KITE,1,2\n').error).toBe('The column “price” appears twice.');
    expect(plan('sku,price\n\n').error).toBe('The file has no product rows.');
    const many = `sku\n${Array.from({ length: 1001 }, (_, i) => `AW-${i}`).join('\n')}\n`;
    expect(plan(many).error).toMatch(/at most 1000/);
  });

  it('reads true and false the ways a spreadsheet writes them, and shows values for the preview', () => {
    expect(['TRUE', 'yes', '1', 'Active'].map(parseActive)).toEqual([true, true, true, true]);
    expect(['FALSE', 'no', '0', 'inactive'].map(parseActive)).toEqual([false, false, false, false]);
    expect(parseActive('maybe')).toBeNull();
    expect(displayValue('price', null)).toBe('On request');
    expect(displayValue('price', 12.5)).toBe('$12.50');
    expect(displayValue('active', false)).toBe('Inactive');
    expect(displayValue('stock_status', 'low')).toBe('Low stock');
    expect(displayValue('tag', null)).toBe('—');
    expect(displayValue('description', 'x'.repeat(80))).toHaveLength(58);
  });
});
