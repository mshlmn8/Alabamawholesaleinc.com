// The cart drawer names the basket by account (AW-132): 'Your quote' for
// guests and accounts that are not approved, 'Your order' for approved
// buyers, in its heading, list, empty note, button and notices. Guests are
// told prices are for approved trade accounts, not to sign in for them.
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

describe('CartDrawer basket names (AW-132)', () => {
  for (const [state, props] of Object.entries(STATES)) {
    const word = props.isApprovedBuyer ? 'order' : 'quote';
    it(`calls it a ${word} for ${state === 'approved' ? 'an approved buyer' : `a ${state} visitor`}`, () => {
      render(drawer({ ...props, items: [...ITEMS, GONE] }));
      expect(screen.getByRole('dialog', { name: `Your ${word}` })).toBeTruthy();
      expect(screen.getByRole('list', { name: `Items in your ${word}` })).toBeTruthy();
      expect(screen.getByRole('link', { name: `Review ${word}` }).getAttribute('href')).toBe('/quote');
      expect(screen.getByText(`1 item in your ${word} is no longer available.`)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
      expect(document.querySelector('.drawer').textContent).not.toMatch(/\bcart\b|Checkout|Request quote/i);
    });
  }

  it('says an empty quote or order is empty', () => {
    // The shared empty state (AW-299), in the basket's words.
    const view = render(drawer({ items: [] }));
    expect(screen.getByRole('heading', { level: 3, name: 'Your quote is empty' })).toBeTruthy();
    expect(document.querySelector('.empty-state-text').textContent).toBe('Browse the catalog and add items to build a quote.');
    view.rerender(drawer({ ...STATES.approved, items: [] }));
    expect(screen.getByRole('heading', { level: 3, name: 'Your order is empty' })).toBeTruthy();
    expect(document.querySelector('.empty-state-text').textContent).toBe('Browse the catalog and add items to build an order.');
    expect(screen.queryByRole('link', { name: /^Review/ })).toBeNull();
  });

  it('tells a guest prices show for approved trade accounts, and still offers sign-in', () => {
    render(drawer({}));
    expect(document.querySelector('.drawer-total-note').textContent).toBe('Prices show for approved trade accounts');
    expect(screen.getByRole('button', { name: 'Sign in for account pricing' })).toBeTruthy();
    expect(screen.queryByText(/after sign-in|Sign in for pricing/)).toBeNull();
  });
});

describe('UnavailableNotice noun (AW-132)', () => {
  it('says quote unless told order', () => {
    const view = render(<UnavailableNotice items={[GONE, { ...GONE, lineKey: '998' }]} onRemoveAll={vi.fn()} />);
    expect(screen.getByText('2 items in your quote are no longer available.')).toBeTruthy();
    view.rerender(<UnavailableNotice items={[GONE]} onRemoveAll={vi.fn()} noun="order" />);
    expect(screen.getByText('1 item in your order is no longer available.')).toBeTruthy();
  });
});
