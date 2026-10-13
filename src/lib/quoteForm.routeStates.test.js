// The ship-to State lists the delivery route states only (AW-078), so a
// profile fills it only with one of them; the phone needs 10 digits.
import { describe, expect, it } from 'vitest';
import { DELIVERY_ROUTE_STATES, DELIVERY_STATE_NOTE, routeStateCode } from '../data/quoteRules.js';
import { EMPTY_QUOTE_FORM, initialQuoteForm, phoneDigitsOk, quoteFormForAccount } from './quoteForm.js';

const STORE = { id: 'a', business: 'Alpha Food Mart', name: 'Alice Alpha', email: 'alpha@example.test', phone: '205-000-0001', store_city: 'Birmingham' };

describe('route states (AW-078)', () => {
  it('names a route state by its code, in any case, and nothing else', () => {
    expect(DELIVERY_ROUTE_STATES.map(routeStateCode)).toEqual(DELIVERY_ROUTE_STATES);
    expect([routeStateCode('al'), routeStateCode(' Ms '), routeStateCode('ga')]).toEqual(['AL', 'MS', 'GA']);
    for (const other of ['TN', 'tn', 'Other', 'Alabama', '', null, undefined, 12]) expect(routeStateCode(other), String(other)).toBeNull();
  });

  it('says the route states and the way out in one sentence, used by the hint and the refusal', () => {
    expect(DELIVERY_STATE_NOTE).toBe('Delivery routes cover AL, MS and GA. For another state, choose will-call pickup.');
  });

  it('fills the State from a store in a route state, upper-case, and leaves it empty for any other', () => {
    expect(initialQuoteForm({ ...STORE, state: 'AL' }).shipState).toBe('AL');
    expect(initialQuoteForm({ ...STORE, state: 'ms' }).shipState).toBe('MS');
    expect(initialQuoteForm({ ...STORE, state: 'TN' }).shipState).toBe('');
    expect(initialQuoteForm({ ...STORE, state: 'Other' }).shipState).toBe('');
    // The rest of the profile still fills.
    expect(initialQuoteForm({ ...STORE, state: 'TN' })).toMatchObject({ business: 'Alpha Food Mart', shipCity: 'Birmingham' });
    // A State the buyer chose stays.
    expect(quoteFormForAccount({ ...EMPTY_QUOTE_FORM, shipState: 'GA' }, { ...STORE, state: 'AL' }, null).shipState).toBe('GA');
  });
});

describe('phoneDigitsOk (AW-078)', () => {
  it('takes 10 digits however they are written, with or without a leading 1', () => {
    for (const ok of ['2055550123', '(205) 555-0123', '205.555.0123', '205-555-0123', '+1 205 555 0123', '1-205-555-0123', ' 205 555 0123 ']) {
      expect(phoneDigitsOk(ok), ok).toBe(true);
    }
  });

  it('refuses too few or too many digits, and no digits at all', () => {
    for (const bad of ['', null, undefined, 'hello', '555-0123', '205-555-012', '205-555-01234', '2-205-555-0123', '+44 20 7946 0958 12']) {
      expect(phoneDigitsOk(bad), String(bad)).toBe(false);
    }
  });
});
