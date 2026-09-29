// The cart drawer's total note and actions per account state, including a
// suspended account (AW-201).
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CartDrawer } from './CartDrawer.jsx';
import { COMPANY } from '../data/content.js';

const ITEMS = [{ lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', cat: 'TOBACCO', qty: 2, price: null }];

function drawer(props) {
  const base = {
    open: true, onClose: vi.fn(), items: ITEMS, total: 0, addLine: vi.fn(), decLine: vi.fn(), removeLine: vi.fn(), removeLines: vi.fn(),
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
});
