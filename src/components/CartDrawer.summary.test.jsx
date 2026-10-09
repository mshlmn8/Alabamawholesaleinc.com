// The cart drawer's summary (AW-238): it sits just above the total while
// there are lines, or after the lines on a short screen so the fixed foot
// keeps its height. Prices are test values.
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
  });
});
