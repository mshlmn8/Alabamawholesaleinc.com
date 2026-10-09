// The shared US state list (AW-282).
import { describe, expect, it } from 'vitest';
import { US_STATES, stateName } from './usStates.js';
import { DELIVERY_ROUTE_STATES } from './quoteRules.js';

describe('US_STATES', () => {
  it('lists the 50 states and DC once each, by name', () => {
    expect(US_STATES).toHaveLength(51);
    expect(new Set(US_STATES.map((s) => s.code)).size).toBe(51);
    expect(new Set(US_STATES.map((s) => s.name)).size).toBe(51);
    const names = US_STATES.map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en-US')));
    for (const s of US_STATES) {
      expect(s.code).toMatch(/^[A-Z]{2}$/);
      expect(Object.keys(s)).toEqual(['code', 'name']);
    }
    expect(US_STATES[0]).toEqual({ code: 'AL', name: 'Alabama' });
    expect(US_STATES.find((s) => s.code === 'DC').name).toBe('District of Columbia');
    expect(Object.isFrozen(US_STATES) && Object.isFrozen(US_STATES[0])).toBe(true);
  });

  it('holds every delivery route state', () => {
    for (const code of DELIVERY_ROUTE_STATES) expect(stateName(code)).toBeTruthy();
  });
});

describe('stateName', () => {
  it('names a postal code in any case, and nothing else', () => {
    expect(stateName('AL')).toBe('Alabama');
    expect(stateName(' ms ')).toBe('Mississippi');
    expect(stateName('TN')).toBe('Tennessee');
    for (const value of ['Other', 'XX', '', null, undefined, 'Alabama']) expect(stateName(value)).toBeNull();
  });
});
