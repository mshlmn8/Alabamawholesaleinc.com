// Freezes the current display-pricing behaviour (AW-209). Phase 2 turns
// pricing.js into an adapter over the server pricing RPC and updates these.
// The list prices below are arbitrary test numbers, not catalog prices.
import { describe, expect, it } from 'vitest';
import { TIER_DISCOUNT, priceForProfile } from './pricing.js';

const approved = (pricing_tier) => ({ status: 'approved', pricing_tier });

describe('TIER_DISCOUNT', () => {
  it('matches the pricing_tiers rows in the initial schema', () => {
    expect(TIER_DISCOUNT).toEqual({ standard: 0, silver: 0.05, gold: 0.10 });
  });
});

describe('priceForProfile', () => {
  it('hides prices from guests, pending and suspended accounts', () => {
    expect(priceForProfile(100, null)).toBeNull();
    expect(priceForProfile(100, undefined)).toBeNull();
    expect(priceForProfile(100, { status: 'pending', pricing_tier: 'gold' })).toBeNull();
    expect(priceForProfile(100, { status: 'suspended', pricing_tier: 'gold' })).toBeNull();
  });

  it('returns null when the product has no list price', () => {
    expect(priceForProfile(null, approved('gold'))).toBeNull();
    expect(priceForProfile(undefined, approved('gold'))).toBeNull();
  });

  it('applies the tier discount for approved accounts', () => {
    expect(priceForProfile(100, approved('standard'))).toBe(100);
    expect(priceForProfile(100, approved('silver'))).toBeCloseTo(95, 10);
    expect(priceForProfile(100, approved('gold'))).toBeCloseTo(90, 10);
  });

  it('falls back to list price for a missing or unknown tier', () => {
    expect(priceForProfile(100, { status: 'approved' })).toBe(100);
    expect(priceForProfile(100, approved('platinum'))).toBe(100);
  });

  it('accepts numeric strings and zero', () => {
    expect(priceForProfile('40', approved('standard'))).toBe(40);
    expect(priceForProfile(0, approved('gold'))).toBe(0);
  });

  it('does not round the unit price (current behaviour; see AW-077)', () => {
    expect(priceForProfile(19.99, approved('silver'))).toBeCloseTo(18.9905, 10);
  });
});
