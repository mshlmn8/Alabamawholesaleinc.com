// The generated product seed (supabase/seed/products.sql, `npm run seed`) is
// insert-only and carries no prices (AW-032, AW-003, AW-002). Re-applying it
// must never overwrite an admin's edits; npm run test:db applies it for real.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AXIS_LABELS, validateCatalog } from './validate-catalog.mjs';

const SEED = readFileSync(resolve(import.meta.dirname, '../supabase/seed/products.sql'), 'utf8');
const SCRIPT = readFileSync(resolve(import.meta.dirname, 'build-seed.mjs'), 'utf8');

describe('supabase/seed/products.sql', () => {
  it('inserts new rows only', () => {
    expect(SEED.trimEnd().endsWith('on conflict (id) do nothing;')).toBe(true);
    expect(SEED).not.toMatch(/do update/i);
    expect(SEED.match(/^insert into public\.products/gm)).toHaveLength(1);
  });

  it('has no price column and no price values', () => {
    const columns = /insert into public\.products \(([^)]+)\) values/.exec(SEED)[1].split(',').map((c) => c.trim());
    expect(columns).not.toContain('price');
    expect(columns).toContain('id');
    const rows = SEED.split('\n').filter((line) => /^\s+\(\d+,/.test(line));
    expect(rows.length).toBeGreaterThan(0);
  });

  it('says it needs the price-boundary migration, and build-seed refuses rows with a price', () => {
    expect(SEED).toMatch(/20260928120000_price_boundary\.sql/);
    expect(SCRIPT).toMatch(/validateCatalog\(rows\)/);
    expect(validateCatalog([{ ...ROW, price: 1.1 }]).problems).toEqual([expect.stringMatching(/has a price/)]);
  });

  it('seeds the variant axis and no flavors count (AW-128, AW-332)', () => {
    const columns = /insert into public\.products \(([^)]+)\) values/.exec(SEED)[1].split(',').map((c) => c.trim());
    expect(columns).toContain('variant_axis');
    expect(columns).not.toContain('flavors');
    // unavailable_variants keeps its database default.
    expect(columns).not.toContain('unavailable_variants');
    expect(SEED).toMatch(/20260928121000_variant_model\.sql/);
  });
});

const ROW = { id: 1, name: 'Test', brand: 'Brand', cat: 'TOBACCO', sub: 'Line', sku: 'AW-T1', variants: [], sellUnit: '5-pack' };

describe('validateCatalog', () => {
  it('passes a clean catalog', () => {
    expect(validateCatalog([ROW, { ...ROW, id: 2, sku: 'AW-T2', variants: ['Red', 'Blue'], variantAxis: 'Color' }]))
      .toEqual({ problems: [], warnings: [] });
  });

  it('needs an axis from the list on every row with two or more variants (AW-128)', () => {
    expect(AXIS_LABELS).toEqual(['Flavor', 'Size', 'Color', 'Style', 'Format', 'Strength', 'Type', 'Variety']);
    const { problems } = validateCatalog([
      { ...ROW, variants: ['Red', 'Blue'] },
      { ...ROW, id: 2, sku: 'AW-T2', variants: ['Red', 'Blue'], variantAxis: 'Scent' },
      { ...ROW, id: 3, sku: 'AW-T3', variants: ['Red'] },
    ]);
    expect(problems).toEqual([
      expect.stringMatching(/^row 1 has 2 variants and no variantAxis/),
      expect.stringMatching(/^row 2: variantAxis "Scent" is not one of/),
    ]);
  });

  it('refuses a variant label listed twice in a row, and a flavors count (AW-332)', () => {
    const { problems } = validateCatalog([
      { ...ROW, variants: ['King size', 'Regular', 'king-size'], variantAxis: 'Size' },
      { ...ROW, id: 2, sku: 'AW-T2', flavors: 0 },
    ]);
    expect(problems).toEqual([
      'row 1: variant "king-size" is listed twice',
      expect.stringMatching(/^row 2 has flavors/),
    ]);
  });

  it('warns, without failing, about rows with no sell unit (AW-031)', () => {
    const { problems, warnings } = validateCatalog([ROW, { ...ROW, id: 2, sku: 'AW-T2', sellUnit: '' }, { ...ROW, id: 3, sku: 'AW-T3', sellUnit: ' ' }]);
    expect(problems).toEqual([]);
    expect(warnings).toEqual([expect.stringMatching(/^2 of 3 rows have no sellUnit/)]);
  });
});
