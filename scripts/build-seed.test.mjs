// The generated product seed (supabase/seed/products.sql, `npm run seed`) is
// insert-only and carries no prices (AW-032, AW-003, AW-002). Re-applying it
// must never overwrite an admin's edits; npm run test:db applies it for real.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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
    expect(SCRIPT).toMatch(/'price' in p/);
  });
});
