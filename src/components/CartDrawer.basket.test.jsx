// The cart drawer names the basket an order for everyone (AW-132, AW-024:
// customers place orders, not quotes): 'Your order' in its heading, list,
// empty note and notices, and Checkout on its button, which leads to
// /checkout. Guests are told prices are for approved trade accounts, with a
// way to sign in for pricing and ordering.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CartDrawer } from './CartDrawer.jsx';
import { UnavailableNotice } from './CartNotices.jsx';

const ITEMS = [{ lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 2, price: null }];
const GONE = { lineKey: '999', productId: 999, variant: null, name: 'Retired item', sku: 'AW-OLD', cat: 'CANDIES', qty: 1, price: null, unavailable: 'product' };
const drawer = (props) => (
  <CartDrawer open onClose={vi.fn()} items={ITEMS} total={0} setLine={vi.fn()} chooseVariant={vi.fn()} removeLine={vi.fn()} removeLines={vi.fn()}
              onLoginClick={vi.fn()} profile={null} isApprovedBuyer={false} {...props} />
);
const STATES = {
  guest: { profile: null, isApprovedBuyer: false },
  pending: { profile: { id: 'p', status: 'pending' }, isApprovedBuyer: false },
  approved: { profile: { id: 'a', status: 'approved' }, isApprovedBuyer: true },
};

describe('CartDrawer basket names (AW-132, AW-024)', () => {
  for (const [state, props] of Object.entries(STATES)) {
    it(`calls it an order, with Checkout, for ${state === 'approved' ? 'an approved buyer' : `a ${state} visitor`}`, () => {
      render(drawer({ ...props, items: [...ITEMS, GONE] }));
      expect(screen.getByRole('dialog', { name: 'Your order' })).toBeTruthy();
      expect(screen.getByRole('list', { name: 'Items in your order' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Checkout' }).getAttribute('href')).toBe('/checkout');
      expect(screen.getByText('1 item in your order is no longer available.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
      expect(document.querySelector('.drawer').textContent).not.toMatch(/\bcart\b|quote/i);
    });
  }

  it('says an empty order is empty', () => {
    // The shared empty state (AW-299), in the basket's words.
    const view = render(drawer({ items: [] }));
    expect(screen.getByRole('heading', { level: 3, name: 'Your order is empty' })).toBeTruthy();
    expect(document.querySelector('.empty-state-text').textContent).toBe('Browse the catalog and add items to build an order.');
    view.rerender(drawer({ ...STATES.approved, items: [] }));
    expect(screen.getByRole('heading', { level: 3, name: 'Your order is empty' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Checkout' })).toBeNull();
  });

  it('tells a guest prices show for approved trade accounts, and offers sign-in for pricing and ordering', () => {
    render(drawer({}));
    expect(document.querySelector('.drawer-total-note').textContent).toBe('Prices show for approved trade accounts');
    expect(screen.getByRole('button', { name: 'Sign in for pricing and ordering' })).toBeTruthy();
    expect(screen.queryByText(/after sign-in|Sign in for pricing$/)).toBeNull();
  });
});

describe('UnavailableNotice noun (AW-132)', () => {
  it('says order', () => {
    render(<UnavailableNotice items={[GONE, { ...GONE, lineKey: '998' }]} onRemoveAll={vi.fn()} />);
    expect(screen.getByText('2 items in your order are no longer available.')).toBeTruthy();
  });
});
