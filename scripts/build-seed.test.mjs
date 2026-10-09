// The generated product seed (supabase/seed/products.sql, `npm run seed`) is
// insert-only and carries no prices (AW-032, AW-003, AW-002). Re-applying it
// must never overwrite an admin's edits; npm run test:db applies it for real.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AXIS_LABELS, validateAliases, validateCatalog } from './validate-catalog.mjs';
import { CATALOG } from '../src/data/products.js';
import { SKU_ALIASES, VARIANT_ALIASES } from '../src/data/catalogAliases.js';

const SEED = readFileSync(resolve(import.meta.dirname, '../supabase/seed/products.sql'), 'utf8');
const SCRIPT = readFileSync(resolve(import.meta.dirname, 'build-seed.mjs'), 'utf8');

describe('supabase/seed/products.sql', () => {
  it('inserts new rows only', () => {
    const insert = SEED.slice(0, SEED.indexOf('\n-- Moves products_id_seq'));
    expect(insert.trimEnd().endsWith('on conflict (id) do nothing;')).toBe(true);
    expect(SEED).not.toMatch(/do update/i);
    expect(SEED.match(/^insert into public\.products/gm)).toHaveLength(1);
    expect(SEED).not.toMatch(/^\s*(update|delete)\b/im);
  });

  it('ends by moving the product id sequence past the seeded ids, never back, when it exists (AW-023)', () => {
    const footer = SEED.slice(SEED.indexOf('on conflict (id) do nothing;'));
    expect(footer).toMatch(/if to_regclass\('public\.products_id_seq'\) is not null then/);
    expect(footer).toMatch(/perform setval\(\s*'public\.products_id_seq',\s*greatest\(\s*coalesce\(\(select max\(id\) from public\.products\), 0\) \+ 1,/);
    expect(footer).toMatch(/case when is_called then last_value \+ 1 else last_value end from public\.products_id_seq/);
    expect(footer.trimEnd().endsWith('end $$;')).toBe(true);
    expect(SEED).toMatch(/20261010120000_admin_product_editor\.sql/);
  });

  it('has no price column and no price values', () => {
    const columns = /insert into public\.products \(([^)]+)\) values/.exec(SEED)[1].split(',').map((c) => c.trim());
    expect(columns).not.toContain('price');
    expect(columns).toContain('id');
    const rows = SEED.split('\n').filter((line) => /^\s+\(\d+,/.test(line));
    expect(rows.length).toBeGreaterThan(0);
  });

  it('says it needs the price-boundary migration, and build-seed refuses rows with a price', () => {
    expect(SEED).toMatch(/20261009100000_price_boundary\.sql/);
    expect(SCRIPT).toMatch(/validateCatalog\(rows, \{ aliases: \{ skuAliases: SKU_ALIASES, variantAliases: VARIANT_ALIASES \} \}\)/);
    expect(validateCatalog([{ ...ROW, price: 1.1 }]).problems).toEqual([expect.stringMatching(/has a price/)]);
  });

  it('seeds the variant axis and no flavors count (AW-128, AW-332)', () => {
    const columns = /insert into public\.products \(([^)]+)\) values/.exec(SEED)[1].split(',').map((c) => c.trim());
    expect(columns).toContain('variant_axis');
    expect(columns).not.toContain('flavors');
    // unavailable_variants keeps its database default.
    expect(columns).not.toContain('unavailable_variants');
    expect(SEED).toMatch(/20261009110000_variant_model\.sql/);
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

describe('catalog corrections (AW-135, AW-138, AW-126)', () => {
  it('refuses SKUs with a trailing or doubled hyphen, or in lower case', () => {
    const { problems } = validateCatalog([
      { ...ROW, sku: 'AW-BRILLO-BASICS-' },
      { ...ROW, id: 2, sku: 'AW-BRILLO--X' },
      { ...ROW, id: 3, sku: 'aw-t3' },
      { ...ROW, id: 4, sku: 'AW-RAZ-VUE-FULL-KIT' },
    ]);
    expect(problems).toEqual([
      expect.stringMatching(/^row 1: sku AW-BRILLO-BASICS- is not AW-/),
      expect.stringMatching(/^row 2: sku AW-BRILLO--X is not AW-/),
      expect.stringMatching(/^row 3: sku aw-t3 is not AW-/),
    ]);
  });

  it('refuses the abbreviated and misspelled labels AW-138 fixed', () => {
    const bad = ['IPhone', 'Type C To Type C', 'Almond reg', 'Cookies king', 'Gold king', '2gal', '8lbs', '20oz'];
    const good = ['iPhone (Lightning)', 'USB-C to USB-C', 'Almond, regular', 'Cookies, king size', 'Gold king size', '2 gal', '8 lb', '20 oz', 'Tootsie king size', 'Regular'];
    const problems = (labels) => validateCatalog([{ ...ROW, variants: labels, variantAxis: 'Variety' }]).problems;
    expect(problems(bad)).toHaveLength(bad.length);
    expect(problems(good)).toEqual([]);
  });

  it('checks the aliases against the rows', () => {
    const rows = [
      { ...ROW, id: 1, sku: 'AW-NEW', variants: ['Red, regular', 'Blue'], variantAxis: 'Variety' },
      { ...ROW, id: 2, sku: 'AW-OLD', variants: [] },
      { ...ROW, id: 3, sku: 'AW-T3', variants: ['A', 'B'], variantAxis: 'Variety' },
    ];
    expect(validateAliases(rows, { skuAliases: { 'AW-OLDER': 'AW-NEW' }, variantAliases: { 1: { 'red-reg': 'Red, regular' }, 2: { case: null } } })).toEqual([]);
    expect(validateAliases(rows, {
      skuAliases: { 'AW-OLD': 'AW-NEW', 'AW-X': 'AW-GONE' },
      variantAliases: { 1: { blue: 'Blue', 'red-reg': 'Red' }, 3: { tips: null }, 9: { a: 'A' } },
    })).toEqual([
      'SKU alias AW-OLD -> AW-NEW: AW-OLD is still a row\'s sku',
      'SKU alias AW-X -> AW-GONE: no row has sku AW-GONE',
      'row 1: variant alias "blue" is still one of its labels',
      'row 1: variant alias "red-reg" -> "Red", which is not one of its labels',
      'row 3: variant alias "tips" -> no variant, but the row has 2 variants',
      'variant aliases for row 9: no such row',
    ]);
  });

  it('src/data/products.js and its aliases pass', () => {
    const { problems } = validateCatalog(CATALOG, { aliases: { skuAliases: SKU_ALIASES, variantAliases: VARIANT_ALIASES } });
    expect(problems).toEqual([]);
  });
});
