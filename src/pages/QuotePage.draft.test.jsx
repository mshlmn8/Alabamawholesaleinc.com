// The quote form survives leaving the page (AW-080): a draft for this tab
// and cart owner, restored on the next visit, filled from the profile only
// where it is empty, discarded when another account takes over, and cleared
// by a successful submit.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuotePage } from './QuotePage.jsx';
import { DRAFT_SAVE_MS, readQuoteDraft, writeQuoteDraft } from '../lib/quoteDraft.js';

vi.mock('../lib/orders.js', async (importOriginal) => ({
  ...(await importOriginal()),
  submitOrder: vi.fn(async () => ({ ok: true, order: { id: 'o1', ref_num: 'ALW-Q-DRAFT00001', kind: 'quote' } })),
}));

const KEY = 'aw-quote-draft';
const CANDY = [{ lineKey: '45', productId: 45, variant: null, name: 'Argo corn starch', sku: 'AW-ARGO', cat: 'FOOD STUFF', qty: 2, price: null }];
const KITE = [{ lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 2, price: null }];
const A = { id: 'user-a', business: 'Alpha Food Mart', name: 'Alice Alpha', email: 'alpha@example.test', phone: '205-000-0001', status: 'pending', state: 'AL', store_city: 'Hoover' };
const B = { id: 'user-b', business: 'Bravo Outlet', name: 'Bea Bravo', email: 'bravo@example.test', phone: '205-000-0002', status: 'pending' };
const GUEST = { owner: 'guest', profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false };
const AS = (profile) => ({ owner: profile.id, profile, account: 'ready', signedIn: true, isApprovedBuyer: false });

const page = (props) => (
  <QuotePage items={CANDY} total={0} setLine={vi.fn()} chooseVariant={vi.fn()} removeLine={vi.fn()} removeLines={vi.fn()} clearCart={vi.fn()}
             isBackendConfigured onSignIn={vi.fn()} {...props} />
);
const value = (id) => document.getElementById(id).value;
const type = (id, text) => fireEvent.change(document.getElementById(id), { target: { value: text } });
const stored = () => JSON.parse(window.sessionStorage.getItem(KEY));
const submitForm = () => fireEvent.submit(document.querySelector('form[aria-labelledby="quote-form-title"]'));

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe('QuotePage draft (AW-080)', () => {
  it('brings back what was typed when the page is opened again', () => {
    const first = render(page(GUEST));
    type('quote-business', 'Test Market');
    type('quote-contact', 'Test Buyer');
    type('quote-phone', '205-555-0100');
    type('ship-street', '1 Test Way');
    fireEvent.change(document.getElementById('ship-state'), { target: { value: 'MS' } });
    type('quote-notes', 'Dock B\nBefore 10');
    // Leaving the page (a line's product link, the breadcrumb) saves at once.
    first.unmount();
    render(page(GUEST));
    expect([value('quote-business'), value('quote-contact'), value('quote-phone'), value('ship-street'), value('ship-state'), value('quote-notes')])
      .toEqual(['Test Market', 'Test Buyer', '205-555-0100', '1 Test Way', 'MS', 'Dock B\nBefore 10']);
  });

  it('keeps the delivery method and the preferred date too', () => {
    const first = render(page(GUEST));
    fireEvent.change(screen.getByLabelText('Delivery method'), { target: { value: 'willcall' } });
    type('quote-date', '2030-01-15');
    first.unmount();
    render(page(GUEST));
    expect(value('quote-delivery')).toBe('willcall');
    expect(value('quote-date')).toBe('2030-01-15');
    expect(document.getElementById('ship-street')).toBeNull();
  });

  it('saves 300 ms after the last edit, and at once when the tab is hidden or closed', () => {
    vi.useFakeTimers();
    render(page(GUEST));
    type('quote-contact', 'T');
    act(() => { vi.advanceTimersByTime(DRAFT_SAVE_MS - 50); });
    type('quote-contact', 'Te');
    act(() => { vi.advanceTimersByTime(DRAFT_SAVE_MS - 50); });
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    act(() => { vi.advanceTimersByTime(50); });
    expect(stored()).toMatchObject({ owner: 'guest', data: { contact: 'Te' } });
    type('quote-contact', 'Ted');
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(stored().data.contact).toBe('Ted');
  });

  it('saves nothing until the buyer edits a field: a profile alone is no draft', () => {
    const view = render(page(AS(A)));
    expect(value('quote-business')).toBe('Alpha Food Mart');
    view.unmount();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('lets the draft win, and fills only the fields it left empty from the profile', () => {
    writeQuoteDraft('user-a', { contact: 'Typed Name', business: '', shipStreet: '9 Typed Rd', shipState: '' });
    render(page(AS(A)));
    expect([value('quote-contact'), value('quote-business'), value('quote-email'), value('ship-street'), value('ship-city'), value('ship-state')])
      .toEqual(['Typed Name', 'Alpha Food Mart', 'alpha@example.test', '9 Typed Rd', 'Hoover', 'AL']);
  });

  it('keeps the draft while the account loads, and fills the rest when the profile arrives', () => {
    writeQuoteDraft('user-a', { contact: 'Typed Name', notes: 'Dock B' });
    // A reload: App's owner is the saved session's account while it loads.
    const view = render(page({ owner: 'user-a', profile: null, account: 'loading', signedIn: true, isApprovedBuyer: false }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Checkout');
    view.rerender(page(AS(A)));
    expect([value('quote-contact'), value('quote-business'), value('quote-notes')]).toEqual(['Typed Name', 'Alpha Food Mart', 'Dock B']);
    expect(readQuoteDraft('user-a')).toMatchObject({ contact: 'Typed Name', notes: 'Dock B' });
  });

  it('reads no other owner’s draft', () => {
    writeQuoteDraft('user-b', { contact: 'Bea’s Draft', shipStreet: '2 Bravo Rd' });
    render(page(AS(A)));
    expect(value('quote-contact')).toBe('Alice Alpha');
    expect(value('ship-street')).toBe('');
  });

  it('discards an account’s draft when another account signs in, or the buyer signs out', async () => {
    const view = render(page(AS(A)));
    type('ship-street', '1 Alpha Way');
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(readQuoteDraft('user-a')).toMatchObject({ shipStreet: '1 Alpha Way' });
    // Another tab signs in as B.
    view.rerender(page(AS(B)));
    await waitFor(() => expect(window.sessionStorage.getItem(KEY)).toBeNull());
    expect([value('quote-business'), value('ship-street')]).toEqual(['Bravo Outlet', '']);
    // B's edits are B's draft; signing out discards it too.
    type('quote-notes', 'Bea’s notes');
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(readQuoteDraft('user-b')).toMatchObject({ notes: 'Bea’s notes' });
    view.rerender(page(GUEST));
    await waitFor(() => expect(window.sessionStorage.getItem(KEY)).toBeNull());
    expect(value('quote-notes')).toBe('');
    // Leaving the page now saves nothing of B's.
    view.unmount();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
  });

  it('keeps what a guest typed when they sign in, and saves it for the account on the next edit', () => {
    vi.useFakeTimers();
    const view = render(page(GUEST));
    type('quote-contact', 'Typed Name');
    act(() => { vi.advanceTimersByTime(DRAFT_SAVE_MS); });
    expect(stored().owner).toBe('guest');
    view.rerender(page(AS(A)));
    act(() => { vi.advanceTimersByTime(DRAFT_SAVE_MS); });
    expect([value('quote-contact'), value('quote-business')]).toEqual(['Typed Name', 'Alpha Food Mart']);
    expect(stored().owner).toBe('guest');
    type('quote-notes', 'Dock B');
    act(() => { vi.advanceTimersByTime(DRAFT_SAVE_MS); });
    expect(stored()).toMatchObject({ owner: 'user-a', data: { contact: 'Typed Name', business: 'Alpha Food Mart', notes: 'Dock B' } });
  });

  it('never keeps the tobacco license answers', () => {
    const first = render(page({ ...GUEST, items: KITE }));
    type('quote-contact', 'Test Buyer');
    type('quote-license', 'TL-SECRET');
    type('quote-resale', 'RS-SECRET');
    fireEvent.click(document.getElementById('quote-age'));
    first.unmount();
    expect(window.sessionStorage.getItem(KEY)).not.toMatch(/TL-SECRET|RS-SECRET|purchasers21/);
    render(page({ ...GUEST, items: KITE }));
    expect(value('quote-contact')).toBe('Test Buyer');
    expect([value('quote-license'), value('quote-resale'), document.getElementById('quote-age').checked]).toEqual(['', '', false]);
  });

  it('clears the draft after a successful submit, and leaving the receipt doesn’t bring it back', async () => {
    const view = render(page({ ...GUEST, checkCart: vi.fn(async () => ({ ok: true, items: CANDY })) }));
    for (const [id, text] of [['quote-business', 'Test Market'], ['quote-contact', 'Test Buyer'], ['quote-email', 'buyer@example.test'],
      ['quote-phone', '205-555-0100'], ['ship-street', '1 Test Way'], ['ship-city', 'Birmingham'], ['ship-state', 'AL'], ['ship-zip', '35203']]) type(id, text);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(readQuoteDraft('guest')).toMatchObject({ business: 'Test Market' });
    await act(async () => { submitForm(); });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Thank you/));
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    view.unmount();
    expect(window.sessionStorage.getItem(KEY)).toBeNull();
    render(page(GUEST));
    expect(value('quote-business')).toBe('');
  });

  it('keeps the draft when the submit fails', async () => {
    const { submitOrder } = await import('../lib/orders.js');
    vi.mocked(submitOrder).mockImplementationOnce(async () => { throw new Error('boom'); });
    render(page({ ...GUEST, checkCart: vi.fn(async () => ({ ok: true, items: CANDY })) }));
    for (const [id, text] of [['quote-business', 'Test Market'], ['quote-contact', 'Test Buyer'], ['quote-email', 'buyer@example.test'],
      ['quote-phone', '205-555-0100'], ['ship-street', '1 Test Way'], ['ship-city', 'Birmingham'], ['ship-state', 'AL'], ['ship-zip', '35203']]) type(id, text);
    await act(async () => { submitForm(); });
    expect(screen.getByRole('alert').textContent).toMatch(/^We couldn’t save this quote/);
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(readQuoteDraft('guest')).toMatchObject({ business: 'Test Market', shipState: 'AL' });
  });
});
