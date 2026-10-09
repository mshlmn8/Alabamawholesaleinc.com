// "Clear all items" can be undone (AW-082): the row under the list holds the
// lines and units and the clear button; clearing focuses the empty page's
// heading and offers an Undo, with no time limit, that puts the lines back
// (keeping lines another tab added), focuses the first one's quantity and
// says so once. The offer goes when lines come back another way or the
// cart's owner changes. The page says where the cart is kept (AW-334).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../lib/announce.js';
import { useCart } from '../lib/cart.js';
import { GUEST, cartKey, resetCartStoreForTests } from '../lib/cartStorage.js';
import { QuotePage } from './QuotePage.jsx';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

const P = [
  { id: 1, sku: 'AW-SS', name: 'Cigarillos', cat: 'CANDIES', variants: ['Diamond', 'Red'] },
  { id: 14, sku: 'AW-KITE', name: 'Kite', cat: 'CANDIES', variants: [] },
  { id: 45, sku: 'AW-ARGO', name: 'Argo', cat: 'FOOD STUFF', variants: [] },
];
const A = '11111111-2222-4333-8444-555555555555';
const PROFILE = { id: A, name: 'Al', business: 'Alpha Mart', email: 'a@example.test', phone: '1', status: 'pending' };

function Harness({ owner = GUEST, profile = null }) {
  const cart = useCart({ products: P, owner });
  return (
    <main>
      <QuotePage items={cart.items} total={cart.total} setLine={cart.setLine} chooseVariant={cart.chooseVariant} removeLine={cart.removeLine}
                 removeLines={cart.removeLines} clearCart={cart.clearCart} restoreLines={cart.restoreLines} owner={owner}
                 profile={profile} account={profile ? 'ready' : 'signed-out'} signedIn={!!profile} isApprovedBuyer={false}
                 isBackendConfigured onSignIn={vi.fn()} onApplyClick={vi.fn()} />
    </main>
  );
}
const seed = (owner, cart) => window.localStorage.setItem(cartKey(owner), JSON.stringify(cart));
const stored = (owner) => JSON.parse(window.localStorage.getItem(cartKey(owner)) || 'null');
const said = () => vi.mocked(announce).mock.calls.map(([m]) => m);
const clearButton = () => screen.getByRole('button', { name: 'Clear all items' });

beforeEach(() => {
  window.localStorage.clear();
  resetCartStoreForTests();
});
afterEach(() => {
  vi.mocked(announce).mockClear();
  window.localStorage.clear();
  resetCartStoreForTests();
});

describe('QuotePage: clear all and undo (AW-082)', () => {
  it('puts the counts and "Clear all items" in one row under the list, then the device note', () => {
    seed(GUEST, { 14: 40, 45: 3 });
    render(<Harness />);
    const row = document.querySelector('.checkout-list-foot');
    expect(row.previousElementSibling.matches('ul.checkout-lines')).toBe(true);
    expect([...row.children].map((el) => el.textContent)).toEqual(['2 lines · 43 units', 'Clear all items']);
    expect(row.nextElementSibling.matches('p.fine.cart-device-note')).toBe(true);
    expect(row.nextElementSibling.textContent).toBe('Saved in this browser only. Items added on another device won’t appear here.');
  });

  it('clears, focuses the empty heading and offers an undo that brings the lines back to the first quantity', async () => {
    seed(GUEST, { 14: 40, 45: 3 });
    render(<Harness />);
    fireEvent.click(clearButton());
    expect(stored(GUEST)).toBeNull();
    const heading = screen.getByRole('heading', { level: 1, name: 'Your quote is empty' });
    expect(document.activeElement).toBe(heading);
    const banner = document.querySelector('p.notice.cart-cleared');
    expect(banner.textContent).toBe('Removed 43 items. Undo');
    expect(banner.querySelector('span').textContent).toBe('Removed 43 items.');
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo.getAttribute('aria-describedby')).toBe(banner.querySelector('span').id);
    expect(said()).toEqual(['Removed all items from your quote.']);

    fireEvent.click(undo);
    expect(stored(GUEST)).toEqual({ 14: 40, 45: 3 });
    expect(document.querySelectorAll('.checkout-lines > li')).toHaveLength(2);
    expect(document.querySelector('.cart-cleared')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Quantity of Kite' })));
    expect(said()).toEqual(['Removed all items from your quote.', 'Restored 43 items.']);
  });

  it('focuses the variant choice of a restored line that has no quantity box, never its thumbnail link', async () => {
    seed(GUEST, { 1: 4 });
    render(<Harness />);
    fireEvent.click(clearButton());
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Choose a variant for Cigarillos' })));
    expect(said().at(-1)).toBe('Restored 4 items.');
  });

  it('has no time limit: the offer is still there later (WCAG 2.2.1)', () => {
    vi.useFakeTimers();
    try {
      seed(GUEST, { 14: 1 });
      render(<Harness />);
      fireEvent.click(clearButton());
      act(() => vi.advanceTimersByTime(10 * 60 * 1000));
      expect(document.querySelector('.cart-cleared').textContent).toBe('Removed 1 item. Undo');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a line another tab stored just before the undo, whose storage event has not arrived yet', () => {
    seed(GUEST, { 14: 40, 45: 3 });
    render(<Harness />);
    fireEvent.click(clearButton());
    seed(GUEST, { 14: 2, 1: 6 });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(stored(GUEST)).toEqual({ 1: 6, 14: 40, 45: 3 });
  });

  it('drops the offer when lines come back another way', () => {
    seed(GUEST, { 14: 2 });
    render(<Harness />);
    fireEvent.click(clearButton());
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    // Another tab adds a line: the list is back, and an empty cart later has no stale offer.
    act(() => {
      seed(GUEST, { 45: 1 });
      window.dispatchEvent(new StorageEvent('storage', { key: cartKey(GUEST) }));
    });
    expect(document.querySelectorAll('.checkout-lines > li')).toHaveLength(1);
    act(() => {
      window.localStorage.removeItem(cartKey(GUEST));
      window.dispatchEvent(new StorageEvent('storage', { key: cartKey(GUEST) }));
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Your quote is empty' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('drops the offer when the cart’s owner changes, so one account’s lines never go into another’s', () => {
    seed(GUEST, { 14: 2 });
    const view = render(<Harness />);
    fireEvent.click(clearButton());
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    view.rerender(<Harness owner={A} profile={PROFILE} />);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    view.rerender(<Harness />);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(stored(A)).toBeNull();
  });

  it('tells a signed-in buyer the cart stays on this device (AW-334)', () => {
    seed(A, { 14: 2 });
    render(<Harness owner={A} profile={PROFILE} />);
    expect(document.querySelector('.cart-device-note').textContent)
      .toBe('Saved on this device for your account. It won’t show up when you sign in on another phone or computer.');
  });

  it('says where the cart is kept on the empty page too, after the button (AW-334)', () => {
    const view = render(<Harness />);
    const button = screen.getByRole('link', { name: 'Browse catalog' });
    expect(button.nextElementSibling.matches('p.fine.cart-device-note')).toBe(true);
    expect(button.nextElementSibling.textContent).toBe('Saved in this browser only. Items added on another device won’t appear here.');
    view.rerender(<Harness owner={A} profile={PROFILE} />);
    expect(document.querySelectorAll('.cart-device-note')).toHaveLength(1);
    expect(document.querySelector('.cart-device-note').textContent)
      .toBe('Saved on this device for your account. It won’t show up when you sign in on another phone or computer.');
  });

  it('offers no undo when clearCart gives nothing back (an older caller)', () => {
    render(
      <main>
        <QuotePage items={[{ lineKey: '14', productId: 14, name: 'Kite', sku: 'AW-KITE', qty: 1, price: null }]} total={0}
                   setLine={vi.fn()} chooseVariant={vi.fn()} removeLine={vi.fn()} removeLines={vi.fn()} clearCart={vi.fn()}
                   isBackendConfigured isApprovedBuyer={false} />
      </main>,
    );
    fireEvent.click(clearButton());
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
