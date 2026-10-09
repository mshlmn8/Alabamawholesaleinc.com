// The quote form's field checks (AW-078): the ship-to State lists the route
// states, the phone needs 10 digits (checked before anything is sent), and
// Notes is a box of several lines.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuotePage } from './QuotePage.jsx';
import { submitOrder } from '../lib/orders.js';

vi.mock('../lib/orders.js', async (importOriginal) => ({
  ...(await importOriginal()),
  submitOrder: vi.fn(async () => ({ ok: true, order: { id: 'o1', ref_num: 'ALW-Q-FIELDS0001', kind: 'quote' } })),
}));

const ITEMS = [{ lineKey: '45', productId: 45, variant: null, name: 'Argo corn starch', sku: 'AW-ARGO', cat: 'FOOD STUFF', qty: 2, price: null }];
const GUEST = { profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false };
const page = (props) => (
  <QuotePage items={ITEMS} total={0} setLine={vi.fn()} chooseVariant={vi.fn()} removeLine={vi.fn()} removeLines={vi.fn()} clearCart={vi.fn()}
             isBackendConfigured onSignIn={vi.fn()} {...GUEST} {...props} />
);
const el = (id) => document.getElementById(id);
const fill = (values) => {
  for (const [id, value] of Object.entries(values)) fireEvent.change(el(id), { target: { value } });
};
const CONTACT = { 'quote-business': 'Test Market', 'quote-contact': 'Test Buyer', 'quote-email': 'buyer@example.test' };
const ADDRESS = { 'ship-street': '1 Test Way', 'ship-city': 'Birmingham', 'ship-state': 'AL', 'ship-zip': '35203' };
const submitForm = () => fireEvent.submit(document.querySelector('form[aria-labelledby="quote-form-title"]'));

describe('QuotePage fields (AW-078)', () => {
  it('offers the route states by name, with a required empty choice first and the route note as its hint', () => {
    render(page());
    const state = screen.getByLabelText('State');
    expect(state.tagName).toBe('SELECT');
    expect(state.required).toBe(true);
    expect([...state.options].map((o) => [o.value, o.textContent, o.disabled])).toEqual([
      ['', 'Choose a state…', true],
      ['AL', 'Alabama', false],
      ['GA', 'Georgia', false],
      ['MS', 'Mississippi', false],
    ]);
    expect(state.value).toBe('');
    expect(state.getAttribute('aria-describedby')).toBe('ship-state-hint');
    expect(el('ship-state-hint').textContent).toBe('Delivery routes cover AL, MS and GA. For another state, choose will-call pickup.');
    fireEvent.change(state, { target: { value: 'MS' } });
    expect(state.value).toBe('MS');
  });

  it('starts the State from a store in a route state only', () => {
    const store = { id: 'p', name: 'Pat', business: 'Pending Mart', email: 'p@example.test', phone: '205-555-0101', status: 'pending', store_city: 'Nashville' };
    const view = render(page({ profile: { ...store, state: 'TN' }, account: 'ready', signedIn: true }));
    expect(el('ship-state').value).toBe('');
    expect(el('ship-city').value).toBe('Nashville');
    view.unmount();
    render(page({ profile: { ...store, id: 'q', state: 'ga' }, account: 'ready', signedIn: true }));
    expect(el('ship-state').value).toBe('GA');
  });

  it('asks for a phone number with 10 digits, and says the format in a hint', () => {
    render(page());
    const phone = screen.getByLabelText('Phone');
    expect(phone.getAttribute('type')).toBe('tel');
    expect(phone.getAttribute('inputmode')).toBe('tel');
    expect(phone.getAttribute('pattern')).toBe('[0-9\\(\\)+.\\-\\s]{10,20}');
    expect(phone.getAttribute('title')).toBe('Enter a 10-digit phone number, for example (205) 555-0123.');
    expect(phone.getAttribute('aria-describedby')).toBe('quote-phone-hint');
    const hint = el('quote-phone-hint');
    expect(hint.textContent).toBe('10 digits, for example (205) 555-0123.');
    // The example number is kept on one line (NEW-040), in its own element.
    const example = hint.querySelector('span.nowrap');
    expect(example.textContent).toBe('(205) 555-0123');
    expect(example.childNodes).toHaveLength(1);
    // Browsers compile the pattern with the v flag: it must be valid there.
    const re = new RegExp(`^(?:${phone.getAttribute('pattern')})$`, 'v');
    expect(['(205) 555-0123', '205.555.0123', '+1 205 555 0123'].every((v) => re.test(v))).toBe(true);
    expect(['hello', '555-0123', '205/555/0123'].some((v) => re.test(v))).toBe(false);
  });

  it('stops a phone number without 10 digits before checking the catalog, and says so under the field', async () => {
    const checkCart = vi.fn(async () => ({ ok: true, items: ITEMS }));
    vi.mocked(submitOrder).mockClear();
    render(page({ checkCart }));
    fill({ ...CONTACT, 'quote-phone': '205-555-01234', ...ADDRESS });
    await act(async () => { submitForm(); });
    // The form's own check (AW-173): the message is the field's, not the page's.
    expect(el('quote-phone-error').textContent).toBe('Enter a 10-digit phone number.');
    expect(screen.queryByRole('alert')).toBeNull();
    const phone = el('quote-phone');
    expect(phone.getAttribute('aria-invalid')).toBe('true');
    expect(phone.getAttribute('aria-describedby')).toBe('quote-phone-hint quote-phone-error');
    expect(document.activeElement).toBe(phone);
    expect(checkCart).not.toHaveBeenCalled();
    expect(submitOrder).not.toHaveBeenCalled();
    // Editing the phone clears the mark; a number with a leading 1 goes through.
    fireEvent.change(phone, { target: { value: '1 (205) 555-0123' } });
    expect(phone.hasAttribute('aria-invalid')).toBe(false);
    await act(async () => { submitForm(); });
    expect(checkCart).toHaveBeenCalledTimes(1);
    expect(submitOrder).toHaveBeenCalledTimes(1);
    expect(vi.mocked(submitOrder).mock.calls[0][0].formData).toMatchObject({ phone: '1 (205) 555-0123', shipState: 'AL' });
  });

  it('marks State and ZIP as the pair that shares a row on phones, and nothing else (AW-241)', () => {
    render(page());
    const halves = [...document.querySelectorAll('.checkout-form-grid > .half')];
    expect(halves.map((div) => div.querySelector('input, select').id)).toEqual(['ship-state', 'ship-zip']);
  });

  it('takes notes in a box of several lines, up to 2,000 characters', () => {
    render(page());
    const notes = screen.getByLabelText('Notes (optional)');
    expect(notes.tagName).toBe('TEXTAREA');
    expect(notes.getAttribute('rows')).toBe('4');
    expect(notes.getAttribute('maxlength')).toBe('2000');
    fireEvent.change(notes, { target: { value: 'Dock B\nBefore 10 AM' } });
    expect(notes.value).toBe('Dock B\nBefore 10 AM');
  });
});
