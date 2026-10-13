// The terms version an application records (AW-019) is the date the
// Trade terms and Privacy policy print (AW-027, AW-277).
import { describe, expect, it } from 'vitest';
import { DELIVERY_POLICY_UPDATED_ON, POLICIES_UPDATED, POLICIES_UPDATED_ON, TERMS_VERSION, policyDateLabel } from './content.js';

describe('policyDateLabel', () => {
  it('prints a day as "Month D, YYYY" and a month alone as "Month YYYY"', () => {
    expect(policyDateLabel('2026-10-10')).toBe('October 10, 2026');
    expect(policyDateLabel('2026-01-02')).toBe('January 2, 2026');
    expect(policyDateLabel('2026-09')).toBe('September 2026');
    expect(policyDateLabel('2026-12-31')).toBe('December 31, 2026');
  });

  it('leaves anything else as it is', () => {
    expect(policyDateLabel('2026-13-01')).toBe('2026-13-01');
    expect(policyDateLabel('soon')).toBe('soon');
  });
});

describe('TERMS_VERSION', () => {
  it('is the day the policies were last updated, as YYYY-MM-DD, and the pages print that day', () => {
    expect(POLICIES_UPDATED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TERMS_VERSION).toBe(POLICIES_UPDATED_ON);
    expect(POLICIES_UPDATED).toBe(policyDateLabel(POLICIES_UPDATED_ON));
    expect(POLICIES_UPDATED).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
  });

  it('is a real day, not earlier than the Delivery policy\'s own date', () => {
    const day = new Date(`${POLICIES_UPDATED_ON}T00:00:00Z`);
    expect(day.toISOString().slice(0, 10)).toBe(POLICIES_UPDATED_ON);
    expect(DELIVERY_POLICY_UPDATED_ON).toMatch(/^\d{4}-\d{2}(-\d{2})?$/);
    expect(POLICIES_UPDATED_ON >= DELIVERY_POLICY_UPDATED_ON).toBe(true);
  });
});
