// The cart drawer's summary and device note (AW-238, AW-334): the summary
// sits just above the total while there are lines, or after the lines on a
// short screen so the fixed foot keeps its height; the note on where the
// cart is kept follows the lines. Prices are test values.
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CartDrawer, SHORT_DRAWER_QUERY } from './CartDrawer.jsx';

const ITEMS = [
  { lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 30, price: 10 },
  { lineKey: '45', productId: 45, variant: null, name: 'Argo corn starch', sku: 'AW-ARGO', cat: 'FOOD STUFF', qty: 3, price: 2 },
];
const drawer = (props) => (
  <CartDrawer open onClose={vi.fn()} items={ITEMS} total={306} setLine={vi.fn()} chooseVariant={vi.fn()} removeLine={vi.fn()} removeLines={vi.fn()}
              onLoginClick={vi.fn()} profile={null} isApprovedBuyer={false} pricesStatus="ready" {...props} />
);
const GUEST_NOTE = 'Saved in this browser only. Items added on another device won’t appear here.';
const ACCOUNT_NOTE = 'Saved on this device for your account. It won’t show up when you sign in on another phone or computer.';

function matchShort(matches) {
  vi.stubGlobal('matchMedia', (query) => ({
    matches: matches && query === SHORT_DRAWER_QUERY, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('CartDrawer summary (AW-238)', () => {
  it('sits just above the total in the foot, with the lines and units', () => {
    render(drawer({}));
    const summary = document.querySelector('.drawer-foot .cart-summary');
    expect(summary.nextElementSibling.className).toBe('drawer-total');
    expect(summary.querySelector('.cart-counts').textContent).toBe('2 lines · 33 units');
    expect(summary.querySelector('.cart-summary-note').textContent).toBe('Pricing, the order minimum and delivery are confirmed by the trade desk.');
  });

  it('shows an approved buyer the meter, and a suspended account only the counts', () => {
    const view = render(drawer({ profile: { id: 'a', status: 'approved' }, isApprovedBuyer: true }));
    expect(screen.getByRole('status').textContent).toMatch(/^Add \$[\d,.]+ to reach the \$[\d,]+ order minimum\.$/);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    view.rerender(drawer({ profile: { id: 's', status: 'suspended' }, isSuspended: true }));
    expect(document.querySelector('.cart-summary').textContent).toBe('2 lines · 33 units');
  });

  it('is left out of an empty drawer', () => {
    render(drawer({ items: [] }));
    expect(document.querySelector('.cart-summary')).toBeNull();
  });

  it('follows the lines on a short screen, so the foot keeps its height', () => {
    matchShort(true);
    render(drawer({}));
    expect(document.querySelector('.drawer-foot .cart-summary')).toBeNull();
    const summary = document.querySelector('.drawer-body .cart-summary');
    expect(summary.previousElementSibling.matches('ul.drawer-lines')).toBe(true);
    expect(summary.nextElementSibling.matches('p.cart-device-note')).toBe(true);
  });
});

describe('CartDrawer device note (AW-334)', () => {
  it('follows the lines in the scrolling body, not the fixed foot', () => {
    render(drawer({}));
    const note = document.querySelector('.cart-device-note');
    expect(note.closest('.drawer-body')).toBeTruthy();
    expect(note.previousElementSibling.matches('ul.drawer-lines')).toBe(true);
    expect(note.className).toBe('fine cart-device-note');
    expect(note.textContent).toBe(GUEST_NOTE);
  });

  it('tells a signed-in buyer the cart stays on this device, also when it is empty', () => {
    render(drawer({ profile: { id: 'p', status: 'pending' }, items: [] }));
    expect(document.querySelector('.cart-device-note').textContent).toBe(ACCOUNT_NOTE);
  });

  it('says the cart is saved with the account only while it is (cartSynced); a guest’s never is', () => {
    const view = render(drawer({ profile: { id: 'p', status: 'approved' }, isApprovedBuyer: true, cartSynced: true }));
    expect(document.querySelector('.cart-device-note').textContent)
      .toBe('Saved with your account. It shows up when you sign in on another phone or computer.');
    view.rerender(drawer({ profile: null, cartSynced: true }));
    expect(document.querySelector('.cart-device-note').textContent).toBe(GUEST_NOTE);
  });
});
