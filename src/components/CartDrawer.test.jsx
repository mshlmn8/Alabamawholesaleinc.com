// The cart drawer's total note and actions per account state, including a
// suspended account (AW-201), what a removal says and where focus goes
// (AW-042), the empty cart (AW-299) and the fine print that scrolls with the
// lines (AW-152).
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../lib/announce.js';
import { CartDrawer } from './CartDrawer.jsx';
import { COMPANY } from '../data/content.js';

vi.mock('../lib/announce.js', async (importOriginal) => ({ ...(await importOriginal()), announce: vi.fn() }));

const ITEMS = [{ lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 2, price: null }];

function drawer(props) {
  const base = {
    open: true, onClose: vi.fn(), items: ITEMS, total: 0, setLine: vi.fn(), chooseVariant: vi.fn(), removeLine: vi.fn(), removeLines: vi.fn(),
    onLoginClick: vi.fn(),
  };
  return <CartDrawer {...base} {...props} />;
}
const note = () => document.querySelector('.drawer-total-note')?.textContent;

describe('CartDrawer', () => {
  it('asks guests to sign in, and offers a quote', () => {
    render(drawer({ profile: null, isApprovedBuyer: false }));
    expect(note()).toBe('Sign in for pricing');
    expect(screen.getByRole('link', { name: /Request quote/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in for account pricing' })).toBeTruthy();
  });

  it('tells a pending account pricing waits on approval', () => {
    render(drawer({ profile: { id: 'p', status: 'pending' }, isApprovedBuyer: false }));
    expect(note()).toBe('Pricing unlocks when your account is approved');
    expect(screen.getByRole('link', { name: /Request quote/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sign in for account pricing' })).toBeNull();
  });

  it('tells a suspended account ordering is paused, instead of a quote button (AW-201)', () => {
    render(drawer({ profile: { id: 's', status: 'suspended' }, isApprovedBuyer: false, isSuspended: true }));
    expect(note()).toBe('Account on hold');
    expect(screen.queryByRole('link', { name: /Request quote|Checkout/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign in for account pricing' })).toBeNull();
    const paused = document.querySelector('.drawer-paused');
    expect(paused.textContent).toMatch(/^Ordering is paused on this account\. Call \(205\) 354-4473 or email .* and a trade rep will help you sort it out\.$/);
    expect(paused.querySelector(`a[href="tel:${COMPANY.phoneRaw}"]`)).toBeTruthy();
  });

  it('puts the minimum-order fine print after the lines, where it scrolls with them, not in the foot (AW-152)', () => {
    render(drawer({ profile: null, isApprovedBuyer: false }));
    const fine = document.querySelector('.drawer-fine');
    expect(fine.parentElement.className).toBe('drawer-body');
    expect(fine.previousElementSibling.matches('ul.drawer-lines')).toBe(true);
    expect(fine.textContent).toMatch(/^The minimum order is \$500\.00\. Free delivery over \$1,500 applies/);
    expect(document.querySelector('.drawer-foot .drawer-fine')).toBeNull();
  });

  it('shows an empty cart as the shared empty state, with a way to the catalog and no total or fine print (AW-299)', () => {
    const onClose = vi.fn();
    render(drawer({ items: [], onClose, profile: null, isApprovedBuyer: false }));
    const empty = document.querySelector('.drawer-body > .empty-state');
    expect(screen.getByRole('heading', { level: 3, name: 'Your cart is empty' }).closest('.empty-state')).toBe(empty);
    expect(empty.textContent).toContain('Browse the catalog and add items to build an order.');
    const browse = screen.getByRole('link', { name: 'Browse the catalog' });
    expect(browse.getAttribute('href')).toBe('/catalog');
    expect(browse.className).toBe('button');
    // No total, quote button, sign-in or fine print for an empty cart: the foot is empty (and hidden by CSS).
    expect(screen.queryByText('Estimated total')).toBeNull();
    expect(document.querySelector('.drawer-total, .drawer-fine')).toBeNull();
    expect(screen.queryByRole('link', { name: /Request quote|Checkout/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign in for account pricing' })).toBeNull();
    expect(document.querySelector('.drawer-foot').childNodes).toHaveLength(0);
    // Following the link closes the drawer.
    fireEvent.click(browse);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the empty state for an approved buyer: no "Estimated total $0.00"', () => {
    render(drawer({ items: [], profile: { id: 'a', status: 'approved' }, isApprovedBuyer: true }));
    expect(screen.getByRole('heading', { level: 3, name: 'Your cart is empty' })).toBeTruthy();
    expect(screen.queryByText('Estimated total')).toBeNull();
  });

  it('sets a line’s quantity by its key (AW-013)', () => {
    const setLine = vi.fn();
    render(drawer({ profile: null, isApprovedBuyer: false, setLine }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(setLine).toHaveBeenCalledWith('14', 3);
  });
});

// Removing lines (AW-042): announced, and focus moves to a neighbour or the
// heading, never to <body>.
describe('CartDrawer removals', () => {
  const LINES = [
    { lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 2, price: null },
    { lineKey: '1::red', productId: 1, variant: 'Red', name: 'Swisher Sweets cigarillos — Red', sku: 'AW-SS-RED', cat: 'TOBACCO', qty: 1, price: null },
    // Can no longer be ordered: no quantity box, only Remove.
    { lineKey: '999', productId: 999, variant: null, name: 'Retired item', sku: 'AW-OLD', cat: 'CANDIES', qty: 1, price: null, unavailable: 'product' },
  ];
  function Drawer() {
    const [items, setItems] = useState(LINES);
    return drawer({ items, removeLine: (key) => setItems((list) => list.filter((it) => it.lineKey !== key)), profile: null, isApprovedBuyer: false });
  }
  const announced = () => vi.mocked(announce).mock.calls.map(([text]) => text);
  const removeButton = (name) => screen.getByRole('button', { name: `Remove ${name}` });

  afterEach(() => vi.mocked(announce).mockClear());

  it('moves focus to the next line’s quantity, else the line before, then to the heading', async () => {
    render(<Drawer />);
    removeButton('Kite cigarette tobacco').focus();
    fireEvent.click(removeButton('Kite cigarette tobacco'));
    expect(announced()).toEqual(['Removed Kite cigarette tobacco.']);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Quantity of Swisher Sweets cigarillos — Red' })));

    // The last line has no quantity box: its Remove takes focus, from the line before.
    fireEvent.click(removeButton('Swisher Sweets cigarillos — Red'));
    await waitFor(() => expect(document.activeElement).toBe(removeButton('Retired item')));

    fireEvent.click(removeButton('Retired item'));
    expect(announced().at(-1)).toBe('Removed Retired item.');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Your order' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Your cart is empty' })).toBeTruthy();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('gives focus back to its opener on close, or to the page heading when the opener has gone', () => {
    const Page = ({ open, opener }) => (
      <main id="main">
        <h1>Candies</h1>
        <span>{opener && <button type="button">Quantity of Starburst bars</button>}</span>
        <span>{drawer({ open, profile: null, isApprovedBuyer: false })}</span>
      </main>
    );
    const view = render(<Page open={false} opener />);
    screen.getByRole('button', { name: 'Quantity of Starburst bars' }).focus();
    view.rerender(<Page open opener />);
    view.rerender(<Page open={false} opener />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Quantity of Starburst bars' }));
    // The product was removed in the drawer: its stepper is gone.
    view.rerender(<Page open opener />);
    view.rerender(<Page open opener={false} />);
    view.rerender(<Page open={false} opener={false} />);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Candies' }));
  });

  it('goes to the line before when the last line is removed', async () => {
    render(<Drawer />);
    fireEvent.click(removeButton('Retired item'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Quantity of Swisher Sweets cigarillos — Red' })));
  });
});
