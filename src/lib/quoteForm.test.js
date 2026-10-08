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
    const filled = {
      ...initialQuoteForm(A), shipStreet: '1 Alpha Way', shipCity: 'Birmingham', notes: 'Dock B', delivery: 'willcall', preferredDate: '2026-10-01',
      licenseNo: 'TL-TEST-1', resaleCert: 'RS-TEST-1', purchasers21: true,
    };
    const next = quoteFormForAccount(filled, null, 'a');
    for (const field of ['business', 'contact', 'email', 'phone', 'shipStreet', 'shipCity', 'shipState', 'shipZip', 'notes', 'licenseNo', 'resaleCert']) expect(next[field]).toBe('');
    // The attestation is a checkbox: unchecked, not blank (AW-014).
    expect(next.purchasers21).toBe(false);
    // Not personal: kept.
    expect(next).toMatchObject({ delivery: 'willcall', preferredDate: '2026-10-01' });
  });

  it('never carries buyer A’s details into buyer B’s order', () => {
    const filled = { ...initialQuoteForm(A), shipStreet: '1 Alpha Way', licenseNo: 'TL-TEST-A', resaleCert: 'RS-TEST-A', purchasers21: true };
    expect(quoteFormForAccount(filled, B, 'a')).toMatchObject({
      business: 'Bravo Tobacco Outlet', contact: 'Bea Bravo', email: 'bravo@example.test', phone: '', shipStreet: '',
      licenseNo: '', resaleCert: '', purchasers21: false,
    });
  });

  it('starts the ship-to address from the store address, filling only empty fields (AW-092)', () => {
    const store = { ...A, store_street: '1 Alpha Way', store_city: 'Birmingham', state: 'AL', store_zip: '35203' };
    expect(initialQuoteForm(store)).toMatchObject({ shipStreet: '1 Alpha Way', shipCity: 'Birmingham', shipState: 'AL', shipZip: '35203' });
    const typed = { ...EMPTY_QUOTE_FORM, shipStreet: '9 Typed Rd', shipZip: '36000' };
    expect(quoteFormForAccount(typed, store, null)).toMatchObject({ shipStreet: '9 Typed Rd', shipCity: 'Birmingham', shipState: 'AL', shipZip: '36000' });
    // 'Other' is no state code; a live database without the store columns fills nothing.
    expect(initialQuoteForm({ ...A, state: 'Other' }).shipState).toBe('');
    expect(initialQuoteForm(A)).toMatchObject({ shipStreet: '', shipCity: '', shipState: '', shipZip: '' });
    // Buyer B never gets buyer A's store address.
    const filled = initialQuoteForm(store);
    expect(quoteFormForAccount(filled, { ...B, store_street: '2 Bravo Rd' }, 'a')).toMatchObject({ shipStreet: '2 Bravo Rd', shipCity: '', shipZip: '' });
  });

  it('starts the tobacco license answers empty and clears them for the next buyer (AW-014)', () => {
    expect(EMPTY_QUOTE_FORM).toMatchObject({ licenseNo: '', resaleCert: '', purchasers21: false });
    const filled = { ...initialQuoteForm(B), licenseNo: 'L-1', resaleCert: 'R-1', purchasers21: true };
    expect(quoteFormForAccount(filled, B, 'b')).toMatchObject({ licenseNo: 'L-1', resaleCert: 'R-1', purchasers21: true });
    expect(quoteFormForAccount(filled, null, 'b')).toMatchObject({ licenseNo: '', resaleCert: '', purchasers21: false });
  });

  it('keeps the license details a guest typed when they sign in (AW-014)', () => {
    const typed = { ...EMPTY_QUOTE_FORM, licenseNo: 'TL-TEST-G', purchasers21: true };
    expect(quoteFormForAccount(typed, A, null)).toMatchObject({ licenseNo: 'TL-TEST-G', purchasers21: true });
  });
});
