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

  // PR #12: the store address from the application fills the ship-to address.
  it('fills the ship-to address from the store address on the profile', () => {
    const withStore = { ...A, store_street: '1 Alpha Way', store_city: 'Birmingham', state: 'AL', store_zip: '35203' };
    expect(initialQuoteForm(withStore)).toMatchObject({ shipStreet: '1 Alpha Way', shipCity: 'Birmingham', shipState: 'AL', shipZip: '35203' });
    // Typed values stay; 'Other' is not a state.
    const typed = { ...EMPTY_QUOTE_FORM, shipStreet: '9 Typed Rd' };
    expect(quoteFormForAccount(typed, { ...withStore, state: 'Other' }, null)).toMatchObject({ shipStreet: '9 Typed Rd', shipCity: 'Birmingham', shipState: '' });
    // A live database without the store columns fills nothing.
    expect(initialQuoteForm(A)).toMatchObject({ shipStreet: '', shipCity: '', shipZip: '' });
  });

  it('starts the tobacco licence answers empty and clears them for the next buyer (AW-014)', () => {
    expect(EMPTY_QUOTE_FORM).toMatchObject({ licenseNo: '', resaleCert: '', purchasers21: false });
    const filled = { ...initialQuoteForm(B), licenseNo: 'L-1', resaleCert: 'R-1', purchasers21: true };
    expect(quoteFormForAccount(filled, B, 'b')).toMatchObject({ licenseNo: 'L-1', resaleCert: 'R-1', purchasers21: true });
    expect(quoteFormForAccount(filled, null, 'b')).toMatchObject({ licenseNo: '', resaleCert: '', purchasers21: false });
  });
});
