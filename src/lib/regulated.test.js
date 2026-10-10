// Which products carry the FDA nicotine statement (AW-026). Includes the
// nicotine checks from Cursor's scripts/test-part1.mjs (PR #12), which this
// file replaces; its guest licence rule (AW-014) went with guest orders.
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { FDA_NICOTINE_WARNING, showsNicotineWarning } from './regulated.js';

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
