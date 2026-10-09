// Admin -> Pricing's form (AW-114): the discount box, the checks, and which
// tiers changed.
import { describe, expect, it } from 'vitest';
import { changeText, draftOf, parsePct, pctText, tierChanges, validateTier } from './pricingTiers.js';

const TIERS = [
  { tier: 'standard', label: 'Standard', discount_pct: 0 },
  { tier: 'silver', label: 'Silver (5% off)', discount_pct: 5 },
  { tier: 'gold', label: 'Gold (10% off)', discount_pct: '10.00' },
];
const drafts = (changes = {}) => Object.fromEntries(TIERS.map((t) => [t.tier, { ...draftOf(t), ...changes[t.tier] }]));

describe('the discount box', () => {
  it('shows a discount without trailing zeros, and reads 0 to 99.99 with two decimals at most', () => {
    expect([0, 5, 7.5, '10.00', 12.25].map(pctText)).toEqual(['0', '5', '7.5', '10', '12.25']);
    expect(parsePct(' 7.5 ')).toEqual({ ok: true, pct: 7.5 });
    expect(parsePct('7%')).toEqual({ ok: true, pct: 7 });
    expect(parsePct('0')).toEqual({ ok: true, pct: 0 });
    expect(parsePct('99.99')).toEqual({ ok: true, pct: 99.99 });
    for (const bad of ['', '100', '120', '-1', '7.555', 'ten', '1e1', '5.']) expect(parsePct(bad).ok, bad).toBe(false);
  });
});

describe('validateTier', () => {
  it('needs a discount from 0 to under 100, and nothing else (the label isn’t edited, NEW-078)', () => {
    expect(draftOf(TIERS[1])).toEqual({ pct: '5' });
    expect(validateTier({ pct: '7' })).toEqual({});
    expect(validateTier({ label: '  ', pct: '7' })).toEqual({});
    expect(validateTier({ pct: '120' })).toEqual({ pct: 'Enter a discount from 0 to 99.99, with at most two decimals.' });
    expect(validateTier({ pct: '1.234' })).toEqual({ pct: 'Enter a discount from 0 to 99.99, with at most two decimals.' });
  });
});

describe('tierChanges', () => {
  it('lists only the tiers whose discount changed', () => {
    expect(tierChanges(TIERS, drafts())).toEqual([]);
    // 10 typed as 10.0 is the same discount; a label in a draft is ignored.
    expect(tierChanges(TIERS, drafts({ gold: { pct: '10.0', label: 'Gold' } }))).toEqual([]);
    const changes = tierChanges(TIERS, drafts({ silver: { pct: '7.5' }, standard: { pct: '1' } }));
    expect(changes).toEqual([
      { tier: 'standard', discount_pct: 1, before: { discount_pct: 0 } },
      { tier: 'silver', discount_pct: 7.5, before: { discount_pct: 5 } },
    ]);
    expect(changes.map(changeText)).toEqual(['standard: discount 0% to 1%', 'silver: discount 5% to 7.5%']);
  });

  it('counts a discount box that isn’t a number yet as a change', () => {
    expect(tierChanges(TIERS, drafts({ standard: { pct: '' } }))).toMatchObject([{ tier: 'standard', discount_pct: null }]);
  });
});
