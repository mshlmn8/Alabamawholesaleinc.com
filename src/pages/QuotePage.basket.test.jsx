// Checkout names the basket by account (AW-132): 'Request a quote' for guests
// and accounts that are not approved, 'Place your order' for approved
// buyers, in the breadcrumb, heading, submit button, empty page and
// messages; guests see who confirms pricing; the fields say what they want.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../lib/announce.js';
import { describeCartChanges } from '../lib/cart.js';
import { QuotePage } from './QuotePage.jsx';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

const ITEMS = [{ lineKey: '45', productId: 45, variant: null, name: 'Argo corn starch', sku: 'AW-ARGO', cat: 'FOOD STUFF', qty: 2, price: 10 }];
const GUEST = { profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false };
const PENDING = { profile: { id: 'p', name: 'Pat', business: 'Pending Mart', email: 'p@example.test', phone: '', status: 'pending' }, account: 'ready', signedIn: true, isApprovedBuyer: false };
const SUSPENDED = { ...PENDING, profile: { ...PENDING.profile, status: 'suspended' }, isSuspended: true };
const APPROVED = { profile: { id: 'a', name: 'Al', business: 'Alpha Mart', email: 'a@example.test', phone: '205-555-0101', status: 'approved' }, account: 'ready', signedIn: true, isApprovedBuyer: true };
const page = (props) => (
  <QuotePage items={ITEMS} total={20} setLine={vi.fn()} chooseVariant={vi.fn()} removeLine={vi.fn()} removeLines={vi.fn()} clearCart={vi.fn()}
             isBackendConfigured onSignIn={vi.fn()} onApplyClick={vi.fn()} {...props} />
);
const h1 = () => screen.getByRole('heading', { level: 1 }).textContent;
const crumb = () => document.querySelector('[aria-current="page"]')?.textContent;
const totalNote = () => document.querySelector('.checkout-total').lastElementChild.textContent;

afterEach(() => vi.mocked(announce).mockClear());

describe('QuotePage basket names (AW-132)', () => {
  it('asks a guest to request a quote: crumb, heading and submit agree', () => {
    render(page(GUEST));
    expect(h1()).toBe('Request a quote');
    expect(crumb()).toBe('Request a quote');
    expect(screen.getByText('QUOTE REQUEST')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit quote request' })).toBeTruthy();
    expect(totalNote()).toBe('Pricing confirmed by the trade desk');
  });

  it('tells an account waiting for approval that pricing follows approval', () => {
    render(page(PENDING));
    expect(h1()).toBe('Request a quote');
    expect(totalNote()).toBe('Pricing after approval');
  });

  it('leaves a suspended account’s total saying ordering is paused', () => {
    render(page(SUSPENDED));
    expect(h1()).toBe('Request a quote');
    expect(totalNote()).toBe('Ordering paused');
  });

  it('asks an approved buyer to place the order', () => {
    render(page(APPROVED));
    expect(h1()).toBe('Place your order');
    expect(crumb()).toBe('Place your order');
    expect(screen.getByText('CHECKOUT')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Submit order' })).toBeTruthy();
  });

  it('keeps Checkout while the account loads', () => {
    render(page({ ...GUEST, account: 'loading', signedIn: true }));
    expect(h1()).toBe('Checkout');
    expect(crumb()).toBe('Checkout');
  });

  it('names no quote or order for an empty cart until the account loads (NEW-002)', () => {
    const view = render(page({ ...GUEST, items: [], account: 'loading', signedIn: true }));
    expect(h1()).toBe('Checkout');
    expect(screen.queryByText(/is empty$/)).toBeNull();
    view.rerender(page({ ...APPROVED, items: [] }));
    expect(h1()).toBe('Your order is empty');
  });

  it('names an empty quote or order', () => {
    const view = render(page({ ...GUEST, items: [] }));
    expect(h1()).toBe('Your quote is empty');
    expect(screen.getByText('Add products, then come back to review your quote.')).toBeTruthy();
    view.rerender(page({ ...APPROVED, items: [] }));
    expect(h1()).toBe('Your order is empty');
    expect(screen.getByText('Add products, then come back to review your order.')).toBeTruthy();
  });

  it('labels the name fields for what they want', () => {
    render(page(GUEST));
    expect(screen.getByLabelText('Business name').id).toBe('quote-business');
    expect(screen.getByLabelText('Contact name').id).toBe('quote-contact');
  });

  it('never says cart or checkout to a guest building a quote', () => {
    render(page({ ...GUEST, items: [{ ...ITEMS[0], cat: 'TOBACCO', lineKey: '14', productId: 14, name: 'Kite' }] }));
    expect(document.querySelector('main, section').textContent).not.toMatch(/\bcart\b|checkout|after sign-in/i);
    expect(screen.getByText(/^Your quote has tobacco or vape items\./)).toBeTruthy();
  });

  it('says which basket "Clear all items" emptied', () => {
    const view = render(page(GUEST));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all items' }));
    view.rerender(page(APPROVED));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all items' }));
    expect(vi.mocked(announce).mock.calls).toEqual([['Removed all items from your quote.'], ['Removed all items from your order.']]);
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
    expect(screen.getByRole('alert').textContent).toBe('Your order changed since this page opened, so nothing was sent. Check your items, then submit again.');
  });
});

describe('describeCartChanges noun (AW-132)', () => {
  it('says quote unless told order', () => {
    const removed = [{ kind: 'removed', name: 'Kite', lineKey: '14' }];
    expect(describeCartChanges(removed)).toMatch(/^Your quote changed/);
    expect(describeCartChanges(removed, 'order')).toMatch(/^Your order changed/);
    const both = [...removed, { kind: 'unavailable', reason: 'product', name: 'Kite', lineKey: '15' }];
    expect(describeCartChanges(both, 'order')).toMatch(/^The catalog and your order changed/);
  });
});
