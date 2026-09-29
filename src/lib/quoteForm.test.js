// The quote form follows the signed-in account (AW-186, AW-190).
import { describe, expect, it } from 'vitest';
import { EMPTY_QUOTE_FORM, initialQuoteForm, quoteFormForAccount } from './quoteForm.js';

const A = { id: 'a', business: 'Alpha Food Mart', name: 'Alice Alpha', email: 'alpha@example.test', phone: '205-000-0001' };
const B = { id: 'b', business: 'Bravo Tobacco Outlet', name: 'Bea Bravo', email: 'bravo@example.test', phone: null };

describe('quoteForm', () => {
  it('starts from the profile, phone included', () => {
    expect(initialQuoteForm(A)).toMatchObject({ business: 'Alpha Food Mart', contact: 'Alice Alpha', email: 'alpha@example.test', phone: '205-000-0001' });
    expect(initialQuoteForm(null)).toEqual(EMPTY_QUOTE_FORM);
  });

  it('fills only empty fields when the profile arrives late or a guest signs in', () => {
    const typed = { ...EMPTY_QUOTE_FORM, contact: 'Typed Name', shipStreet: '1 Main St' };
    expect(quoteFormForAccount(typed, A, null)).toMatchObject({
      business: 'Alpha Food Mart', contact: 'Typed Name', email: 'alpha@example.test', phone: '205-000-0001', shipStreet: '1 Main St',
    });
  });

  it('clears the last buyer’s details when they sign out', () => {
    const filled = { ...initialQuoteForm(A), shipStreet: '1 Alpha Way', shipCity: 'Birmingham', notes: 'Dock B', delivery: 'willcall', preferredDate: '2026-10-01' };
    const next = quoteFormForAccount(filled, null, 'a');
    for (const field of ['business', 'contact', 'email', 'phone', 'shipStreet', 'shipCity', 'shipState', 'shipZip', 'notes']) expect(next[field]).toBe('');
    // Not personal: kept.
    expect(next).toMatchObject({ delivery: 'willcall', preferredDate: '2026-10-01' });
  });

  it('never carries buyer A’s details into buyer B’s order', () => {
    const filled = { ...initialQuoteForm(A), shipStreet: '1 Alpha Way' };
    expect(quoteFormForAccount(filled, B, 'a')).toMatchObject({
      business: 'Bravo Tobacco Outlet', contact: 'Bea Bravo', email: 'bravo@example.test', phone: '', shipStreet: '',
    });
  });
});
