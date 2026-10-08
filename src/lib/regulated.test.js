// Which products carry the FDA nicotine statement (AW-026) and which quote
// lines need a tobacco licence (AW-014). Includes every check from Cursor's
// scripts/test-part1.mjs (PR #12), which this file replaces.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { normalizeCart, resolveCartItems } from './lines.js';
import { FDA_NICOTINE_WARNING, cartNeedsTobaccoLicense, lineNeedsTobaccoLicense, showsNicotineWarning } from './regulated.js';

describe('FDA_NICOTINE_WARNING', () => {
  it('is the FDA statement, word for word', () => {
    expect(FDA_NICOTINE_WARNING).toBe('WARNING: This product contains nicotine. Nicotine is an addictive chemical.');
  });
});

describe('showsNicotineWarning', () => {
  it('marks vapes, pouches, cigars, cigarettes and shisha (PR #12 checks)', () => {
    expect(showsNicotineWarning({ name: 'Geek Bar Pulse X 25K', brand: 'Geek Bar', sub: 'Disposable Vapes' })).toBe(true);
    expect(showsNicotineWarning({ name: 'ZYN nicotine pouches 6mg', brand: 'ZYN', sub: 'Pouches & ZYN' })).toBe(true);
    expect(showsNicotineWarning({ name: 'Black & Mild cigars 5-pack', brand: 'Black & Mild', sub: 'Cigars & Cigarillos' })).toBe(true);
    expect(showsNicotineWarning({ name: 'Al Fakher shisha 50 g', brand: 'Al Fakher', sub: 'Hookah & Shisha' })).toBe(true);
  });

  it('leaves out hemp wraps, papers, kava and candy (PR #12 checks)', () => {
    expect(showsNicotineWarning({ name: 'High Hemp organic wraps', brand: 'High Hemp', sub: 'Wraps & Leafs' })).toBe(false);
    expect(showsNicotineWarning({ name: 'RAW rolling papers', brand: 'RAW', sub: 'Papers & Cones' })).toBe(false);
    expect(showsNicotineWarning({ name: 'Wava kava', brand: 'Wava', sub: 'Kratom & Kava' })).toBe(false);
    expect(showsNicotineWarning({ name: 'Snickers', brand: 'Snickers', sub: 'Chocolate Bars' })).toBe(false);
    expect(showsNicotineWarning(null)).toBe(false);
    expect(showsNicotineWarning(undefined)).toBe(false);
  });

  it('covers every vape, cigarette, cigar, pouch and loose tobacco in the catalog, and no hemp product', () => {
    const always = ['Disposable Vapes', 'Vape Pods', 'Cigarettes', 'Cigars & Cigarillos', 'Pouches & ZYN', 'Loose Tobacco Bags'];
    for (const p of PRODUCTS.filter(row => always.includes(row.sub))) expect([p.id, showsNicotineWarning(p)]).toEqual([p.id, true]);
    const hemp = PRODUCTS.filter(row => /hemp/i.test(`${row.name} ${row.brand}`));
    expect(hemp.length).toBeGreaterThan(0);
    for (const p of hemp) expect([p.id, showsNicotineWarning(p)]).toEqual([p.id, false]);
    // Outside tobacco and novelties, nothing gets the statement.
    for (const p of PRODUCTS.filter(row => !['TOBACCO', 'NOVELTIES'].includes(row.cat))) {
      expect([p.id, showsNicotineWarning(p)]).toEqual([p.id, false]);
    }
  });
});

describe('cartNeedsTobaccoLicense', () => {
  it('asks for a licence for tobacco and vape lines only (PR #12 checks)', () => {
    expect(cartNeedsTobaccoLicense([{ cat: 'TOBACCO', sub: 'Papers & Cones' }])).toBe(true);
    expect(cartNeedsTobaccoLicense([{ cat: 'NOVELTIES', sub: 'Disposable Vapes' }])).toBe(true);
    expect(cartNeedsTobaccoLicense([{ cat: 'NOVELTIES', sub: 'Vape Pods' }])).toBe(true);
    expect(cartNeedsTobaccoLicense([{ cat: 'NOVELTIES', sub: 'Kratom & Kava' }])).toBe(false);
    expect(cartNeedsTobaccoLicense([{ cat: 'CANDIES', sub: 'Chocolate Bars' }])).toBe(false);
    expect(cartNeedsTobaccoLicense([])).toBe(false);
    expect(cartNeedsTobaccoLicense(null)).toBe(false);
    expect(lineNeedsTobaccoLicense(null)).toBe(false);
  });

  it('matches the rule the current submit_quote applies (20261009130000_submit_quote_v3.sql)', () => {
    // The rule as the migration writes it: pr.cat = '<dept>' or pr.sub in ('<line>', …).
    const sqlText = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261009130000_submit_quote_v3.sql'), 'utf8');
    const rule = sqlText.match(/where pr\.cat = '([^']+)'\s+or pr\.sub in \(([^)]+)\)/);
    expect(rule).not.toBeNull();
    const cat = rule[1];
    const subs = [...rule[2].matchAll(/'([^']+)'/g)].map(m => m[1]);
    expect([cat, subs]).toEqual(['TOBACCO', ['Disposable Vapes', 'Vape Pods']]);
    for (const p of PRODUCTS) {
      const sql = p.cat === cat || subs.includes(p.sub);
      expect([p.id, lineNeedsTobaccoLicense(p)]).toEqual([p.id, sql]);
    }
  });

  it('reads the department and line that cart items carry', () => {
    const cigarette = PRODUCTS.find(p => p.sub === 'Cigarettes');
    const candy = PRODUCTS.find(p => p.cat === 'CANDIES');
    const items = resolveCartItems(normalizeCart({ [cigarette.id]: 1, [candy.id]: 2 }, PRODUCTS), PRODUCTS);
    expect(items.find(it => it.productId === cigarette.id)).toMatchObject({ cat: 'TOBACCO', sub: 'Cigarettes' });
    expect(cartNeedsTobaccoLicense(items)).toBe(true);
    expect(cartNeedsTobaccoLicense(items.filter(it => it.productId === candy.id))).toBe(false);
  });
});
