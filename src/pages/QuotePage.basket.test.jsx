// Checkout names the basket an order for everyone (AW-132, AW-024:
// customers place orders, not quotes): 'Checkout' in the breadcrumb, heading
// and title, 'Place order' on the submit button, 'Your order' on the empty
// page and in messages. Who sees the form is AW-014's (QuotePage.test.jsx);
// the fields say what they want.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../lib/announce.js';
import { describeCartChanges } from '../lib/cart.js';
import { QuotePage } from './QuotePage.jsx';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

const ITEMS = [{ lineKey: '45', productId: 45, variant: null, name: 'Argo corn starch', sku: 'AW-ARGO', cat: 'FOOD STUFF', qty: 2, price: 10 }];
const GUEST = { profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false };
const PENDING = { profile: { id: 'p', name: 'Pat', business: 'Pending Mart', email: 'p@example.test', phone: '', status: 'pending' }, account: 'ready', signedIn: true, isApprovedBuyer: false };
const SUSPENDED = { ...PENDING, profile: { ...PENDING.profile, status: 'suspended' } };
const APPROVED = { profile: { id: 'a', name: 'Al', business: 'Alpha Mart', email: 'a@example.test', phone: '205-555-0101', status: 'approved' }, account: 'ready', signedIn: true, isApprovedBuyer: true };
const page = (props) => (
  <QuotePage items={ITEMS} total={20} setLine={vi.fn()} chooseVariant={vi.fn()} removeLine={vi.fn()} removeLines={vi.fn()} clearCart={vi.fn()}
             isBackendConfigured onSignIn={vi.fn()} onApplyClick={vi.fn()} {...props} />
);
const h1 = () => screen.getByRole('heading', { level: 1 }).textContent;
const crumb = () => document.querySelector('[aria-current="page"]')?.textContent;

afterEach(() => vi.mocked(announce).mockClear());

describe('QuotePage basket names (AW-132, AW-024)', () => {
  for (const [who, props] of [['a guest', GUEST], ['an account under review', PENDING], ['a suspended account', SUSPENDED], ['an approved buyer', APPROVED]]) {
    it(`calls the page Checkout for ${who}, and never a quote`, () => {
      render(page(props));
      expect(h1()).toBe('Checkout');
      expect(crumb()).toBe('Checkout');
      expect(screen.getByText('YOUR ORDER')).toBeTruthy();
      expect(screen.getByRole('list', { name: 'Items in your order' })).toBeTruthy();
      expect(document.querySelector('section').textContent).not.toMatch(/quote/i);
    });
  }

  it('asks an approved buyer to place the order', () => {
    render(page(APPROVED));
    expect(screen.getByRole('button', { name: 'Place order' })).toBeTruthy();
    expect(document.querySelector('.page-head > p:not([class])').textContent).toMatch(/^Review your items, then place your order\./);
  });

  it('keeps Checkout while the account loads', () => {
    render(page({ ...GUEST, account: 'loading', signedIn: true }));
    expect(h1()).toBe('Checkout');
    expect(crumb()).toBe('Checkout');
  });

  it('says nothing about an empty cart until the account loads (NEW-002)', () => {
    const view = render(page({ ...GUEST, items: [], account: 'loading', signedIn: true }));
    expect(h1()).toBe('Checkout');
    expect(screen.queryByText(/is empty$/)).toBeNull();
    view.rerender(page({ ...APPROVED, items: [] }));
    expect(h1()).toBe('Your order is empty');
  });

  it('names an empty order, for a guest too', () => {
    const view = render(page({ ...GUEST, items: [] }));
    expect(h1()).toBe('Your order is empty');
    expect(screen.getByText('Add products, then come back to review your order.')).toBeTruthy();
    view.rerender(page({ ...APPROVED, items: [] }));
    expect(h1()).toBe('Your order is empty');
  });

  it('labels the name fields for what they want', () => {
    render(page(APPROVED));
    expect(screen.getByLabelText('Business name').id).toBe('quote-business');
    expect(screen.getByLabelText('Contact name').id).toBe('quote-contact');
  });

  it('says "order" when "Clear all items" empties it, whoever is signed in', () => {
    const view = render(page(GUEST));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all items' }));
    view.rerender(page(APPROVED));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all items' }));
    expect(vi.mocked(announce).mock.calls).toEqual([['Removed all items from your order.'], ['Removed all items from your order.']]);
  });

  it('names the basket when the cart changed in another tab before a submit', async () => {
    const changed = [{ ...ITEMS[0], qty: 5 }];
    const props = { ...APPROVED, checkCart: vi.fn(async () => ({ ok: true, items: changed })) };
    const view = render(page(props));
    fireEvent.change(document.getElementById('ship-street'), { target: { value: '1 Alpha Way' } });
    fireEvent.change(document.getElementById('ship-city'), { target: { value: 'Hoover' } });
    fireEvent.change(document.getElementById('ship-state'), { target: { value: 'AL' } });
    fireEvent.change(document.getElementById('ship-zip'), { target: { value: '35244' } });
    await act(async () => { fireEvent.submit(document.querySelector('form[aria-labelledby="quote-form-title"]')); });
    // The page shows the message with the cart as it now is.
    view.rerender(page({ ...props, items: changed }));
    expect(screen.getByRole('alert').textContent).toBe('Your order changed since this page opened, so nothing was sent. Check your items, then place your order again.');
  });
});

describe('describeCartChanges noun (AW-132)', () => {
  it('says order', () => {
    const removed = [{ kind: 'removed', name: 'Kite', lineKey: '14' }];
    expect(describeCartChanges(removed)).toMatch(/^Your order changed/);
    const both = [...removed, { kind: 'unavailable', reason: 'product', name: 'Kite', lineKey: '15' }];
    expect(describeCartChanges(both)).toMatch(/^The catalog and your order changed/);
  });
});
