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
  it('needs a label of at most 60 characters and a discount from 0 to under 100', () => {
    expect(validateTier({ label: 'Silver', pct: '7' })).toEqual({});
    expect(validateTier({ label: '  ', pct: '120' })).toEqual({
      label: 'Enter the tier’s label.',
      pct: 'Enter a discount from 0 to 99.99, with at most two decimals.',
    });
    expect(validateTier({ label: 'x'.repeat(61), pct: '1.234' })).toEqual({
      label: 'Keep the label to 60 characters.',
      pct: 'Enter a discount from 0 to 99.99, with at most two decimals.',
    });
  });
});

describe('tierChanges', () => {
  it('lists only the tiers whose label or discount changed', () => {
    expect(tierChanges(TIERS, drafts())).toEqual([]);
    // 10 typed as 10.0 is the same discount; a label's surrounding spaces don't count.
    expect(tierChanges(TIERS, drafts({ gold: { pct: '10.0', label: ' Gold (10% off) ' } }))).toEqual([]);
    const changes = tierChanges(TIERS, drafts({ silver: { pct: '7', label: 'Silver (7% off)' }, gold: { label: 'Gold' } }));
    expect(changes).toEqual([
      { tier: 'silver', label: 'Silver (7% off)', discount_pct: 7, before: { label: 'Silver (5% off)', discount_pct: 5 } },
      { tier: 'gold', label: 'Gold', discount_pct: 10, before: { label: 'Gold (10% off)', discount_pct: 10 } },
    ]);
    expect(changes.map(changeText)).toEqual([
      'silver: discount 5% to 7%, label “Silver (5% off)” to “Silver (7% off)”',
      'gold: label “Gold (10% off)” to “Gold”',
    ]);
  });

  it('counts a discount box that isn’t a number yet as a change', () => {
    expect(tierChanges(TIERS, drafts({ standard: { pct: '' } }))).toMatchObject([{ tier: 'standard', discount_pct: null }]);
  });
});
