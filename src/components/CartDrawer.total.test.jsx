// The cart drawer's prices for an approved buyer (AW-103): "each" and a line
// total on every priced line, an estimated total without the lines still
// waiting for a variant, and a note under it that says so. Prices are test
// values.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CartDrawer } from './CartDrawer.jsx';
import { cartTotal } from '../lib/cart.js';

const KITE = { lineKey: '14', productId: 14, variant: null, needsVariant: false, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 3, price: 13.4 };
const BARE = {
  lineKey: '11', productId: 11, variant: null, needsVariant: true, name: 'Backwoods cigars 5-pack', sku: 'AW-BACKWOODS-5PK', cat: 'TOBACCO',
  qty: 8, price: 10.55, axis: { noun: 'variety' }, variants: [{ label: 'Banana', available: true }],
};

function drawer(items, props = {}) {
  return (
    <CartDrawer open onClose={vi.fn()} items={items} total={cartTotal(items)} setLine={vi.fn()} chooseVariant={vi.fn()} removeLine={vi.fn()}
                removeLines={vi.fn()} onLoginClick={vi.fn()} profile={{ id: 'a', status: 'approved' }} isApprovedBuyer pricesStatus="ready" {...props} />
  );
}
const totalRow = () => document.querySelector('.drawer-total').textContent;
const note = () => document.querySelector('.total-note');

describe('CartDrawer totals (AW-103)', () => {
  it('shows "each" and a line total, and a total of the lines that can be ordered', () => {
    render(drawer([KITE]));
    expect(screen.getByText('AW-KITE · $13.40 each')).toBeTruthy();
    expect(document.querySelector('.drawer-line .line-total').textContent).toBe('$40.20');
    expect(totalRow()).toBe('Estimated total$40.20');
    expect(note()).toBeNull();
  });

  it('leaves a line waiting for its variant out of the total, with no line total, and says so under the total', () => {
    render(drawer([BARE, KITE]));
    expect(totalRow()).toBe('Estimated total$40.20');
    expect(document.querySelectorAll('.drawer-line .line-total')).toHaveLength(1);
    expect(note().textContent).toBe('1 line needs a variant and isn’t in this total.');
    expect(note().tagName).toBe('P');
  });

  it('says nothing about variants to guests and accounts awaiting approval', () => {
    const view = render(drawer([BARE, KITE], { profile: null, isApprovedBuyer: false }));
    expect(note()).toBeNull();
    expect(document.querySelector('.line-total')).toBeNull();
    view.rerender(drawer([BARE, KITE], { profile: { id: 'p', status: 'pending' }, isApprovedBuyer: false }));
    expect(note()).toBeNull();
  });
});
