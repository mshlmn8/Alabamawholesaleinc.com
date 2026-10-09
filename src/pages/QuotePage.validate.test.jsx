// The checkout form checks itself before it sends (AW-173): an empty or
// mistyped answer is named under its field, the field is marked invalid and
// the first takes focus, and nothing is checked or sent. Optional fields say
// so, and Safari's empty date reads as empty (AW-310). A separate file from
// QuotePage.test.jsx, which other changes edit, and from QuotePage.fields.test.jsx
// (AW-078's route-state select, phone digits and notes box).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuotePage } from './QuotePage.jsx';
import { submitOrder } from '../lib/orders.js';

vi.mock('../lib/orders.js', async (importOriginal) => ({
  ...(await importOriginal()),
  submitOrder: vi.fn(async () => ({ ok: true, order: { id: 'o1', ref_num: 'ALW-Q-TEST000001' } })),
}));

const ITEMS = [{ lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 2, price: 10 }];
const GUEST = { profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false };

function renderPage(props = {}) {
  const checkCart = vi.fn(async () => ({ ok: true, items: ITEMS }));
  render(
    <main id="main">
      <QuotePage items={ITEMS} total={20} setLine={vi.fn()} chooseVariant={vi.fn()} removeLine={vi.fn()} removeLines={vi.fn()} clearCart={vi.fn()}
                 isBackendConfigured onSignIn={vi.fn()} checkCart={checkCart} {...GUEST} {...props} />
    </main>,
  );
  return { checkCart };
}
const byId = (id) => document.getElementById(id);
const form = () => document.querySelector('form[aria-labelledby="quote-form-title"]');
const submitForm = () => act(async () => { fireEvent.submit(form()); });
const type = (id, value) => fireEvent.change(byId(id), { target: { value } });

describe('QuotePage checks its form before it sends (AW-173)', () => {
  it('says which fields are required, and marks the optional ones', () => {
    renderPage();
    expect(form().noValidate).toBe(true);
    const note = document.querySelector('.form-note');
    expect(note.textContent).toBe('All fields are required unless marked optional.');
    // Right above the fields, under the heading and a guest's sign-in links.
    expect(note.nextElementSibling.classList.contains('checkout-form-grid')).toBe(true);
    expect(screen.getByLabelText('Preferred date (optional)').id).toBe('quote-date');
    expect(screen.getByLabelText('Notes (optional)').id).toBe('quote-notes');
    expect(document.querySelectorAll('.field-optional')).toHaveLength(2);
    expect(screen.getByLabelText('Business name').required).toBe(true);
  });

  it('names every empty required field under it, focuses Business, and checks and sends nothing', async () => {
    vi.mocked(submitOrder).mockClear();
    const { checkCart } = renderPage();
    await submitForm();
    // Sentences with a period; the phone, license and resale fields say
    // what to enter in their own words (NEW-069).
    const expected = {
      'quote-business': 'Enter business name.',
      'quote-contact': 'Enter contact name.',
      'quote-email': 'Enter email.',
      'quote-phone': 'Enter a phone number.',
      'quote-license': 'Enter the state tobacco license number.',
      'quote-resale': 'Enter the resale certificate number.',
      'quote-age': 'Check this box to continue.',
      'ship-street': 'Enter street.',
      'ship-city': 'Enter city.',
      'ship-state': 'Choose state.',
      'ship-zip': 'Enter ZIP.',
    };
    for (const [id, message] of Object.entries(expected)) {
      expect(byId(id).getAttribute('aria-invalid'), id).toBe('true');
      expect(byId(`${id}-error`).textContent, id).toBe(message);
      expect(byId(id).getAttribute('aria-describedby').split(' '), id).toContain(`${id}-error`);
    }
    // The license fields keep their note first.
    expect(byId('quote-license').getAttribute('aria-describedby')).toBe('quote-license-note quote-license-error');
    for (const id of ['quote-date', 'quote-notes', 'quote-delivery']) expect(byId(id).hasAttribute('aria-invalid'), id).toBe(false);
    expect(document.activeElement).toBe(byId('quote-business'));
    // The page-level alert is for the server's answer; none here.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(checkCart).not.toHaveBeenCalled();
    expect(submitOrder).not.toHaveBeenCalled();
  });

  it('explains a mistyped email and ZIP, and a date in the past', async () => {
    renderPage();
    type('quote-email', 'buyer.example.test');
    type('ship-zip', '3520');
    type('quote-date', '2020-01-15');
    await submitForm();
    expect(byId('quote-email-error').textContent).toBe('Enter an email address, for example name@yourstore.com.');
    expect(byId('ship-zip-error').textContent).toBe('Enter a 5-digit ZIP code, or ZIP+4.');
    expect(byId('quote-date-error').textContent).toBe('Choose today or a later date.');
    // Fixing a field clears its message only.
    type('ship-zip', '35203');
    expect(byId('ship-zip-error').textContent).toBe('');
    expect(byId('ship-zip').hasAttribute('aria-invalid')).toBe(false);
    expect(byId('quote-email-error').textContent).not.toBe('');
  });

  it('sends a complete form as before', async () => {
    vi.mocked(submitOrder).mockClear();
    renderPage();
    for (const [id, value] of [['quote-business', 'Test Market'], ['quote-contact', 'Test Buyer'], ['quote-email', 'buyer@example.test'],
      ['quote-phone', '205-000-0000'], ['quote-license', 'TL-1'], ['quote-resale', 'RS-1'],
      ['ship-street', '1 Test Way'], ['ship-city', 'Birmingham'], ['ship-state', 'AL'], ['ship-zip', '35203']]) type(id, value);
    fireEvent.click(byId('quote-age'));
    await submitForm();
    expect(submitOrder).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/^Thank you/);
  });
});

describe('the preferred date in Safari (AW-310)', () => {
  it('stays empty by default, marked .is-empty until a date is chosen, with a hint that blank is fine', () => {
    renderPage();
    const date = byId('quote-date');
    expect(date.value).toBe('');
    expect(date.classList.contains('is-empty')).toBe(true);
    expect(date.getAttribute('aria-describedby')).toBe('quote-date-hint');
    expect(byId('quote-date-hint').textContent).toBe('Optional. Leave it blank if any day works.');
    type('quote-date', '2030-01-15');
    expect(date.classList.contains('is-empty')).toBe(false);
    type('quote-date', '');
    expect(date.classList.contains('is-empty')).toBe(true);
  });
});
