// Checkout while the account changes underneath it (AW-186, AW-190, AW-048).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuotePage } from './QuotePage.jsx';

const ITEMS = [{ lineKey: '14', productId: 14, variant: null, name: 'Kite cigarette tobacco', sku: 'AW-KITE', qty: 2, unitPrice: 10, lineTotal: 20 }];
const A = { id: 'a', business: 'Alpha Food Mart', name: 'Alice Alpha', email: 'alpha@example.test', phone: '205-000-0001', status: 'approved' };
const B = { id: 'b', business: 'Bravo Tobacco Outlet', name: 'Bea Bravo', email: 'bravo@example.test', phone: '', status: 'pending' };

function page(props) {
  const base = {
    items: ITEMS, total: 20, addLine: vi.fn(), decLine: vi.fn(), removeLine: vi.fn(), clearCart: vi.fn(),
    isBackendConfigured: true, onSignIn: vi.fn(),
  };
  return <QuotePage {...base} {...props} />;
}
const field = (id) => document.getElementById(id).value;
const submit = () => screen.getByRole('button', { name: /Submit/ });

describe('QuotePage and the account', () => {
  it('waits for the account instead of showing the guest form (AW-186)', () => {
    const view = render(page({ profile: null, account: 'loading', signedIn: true, isApprovedBuyer: false }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Checkout');
    expect(screen.queryByText('Request your quote')).toBeNull();
    expect(screen.queryByRole('button', { name: /Submit/ })).toBeNull();
    view.rerender(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Place your order');
    expect([field('quote-business'), field('quote-contact'), field('quote-email'), field('quote-phone')])
      .toEqual(['Alpha Food Mart', 'Alice Alpha', 'alpha@example.test', '205-000-0001']);
  });

  it('warns and blocks the order when the buyer is signed out mid-checkout (AW-048, AW-190)', () => {
    const view = render(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    fireEvent.change(document.getElementById('ship-street'), { target: { value: '1 Alpha Way' } });
    expect(submit().disabled).toBe(false);
    view.rerender(page({ profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false }));
    expect(screen.getByRole('alert').textContent).toMatch(/You were signed out/);
    expect(submit().disabled).toBe(true);
    // The signed-out buyer's details are gone.
    expect([field('quote-business'), field('quote-contact'), field('quote-email'), field('quote-phone'), field('ship-street')]).toEqual(['', '', '', '', '']);
    fireEvent.click(screen.getByRole('button', { name: 'Send it as a quote request instead' }));
    expect(submit().disabled).toBe(false);
    expect(submit().textContent).toMatch(/Submit quote request/);
  });

  it('refills for the next buyer, and says when their account can’t order (AW-190, AW-048)', () => {
    const view = render(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    fireEvent.change(document.getElementById('ship-street'), { target: { value: '1 Alpha Way' } });
    view.rerender(page({ profile: null, account: 'loading', signedIn: true, isApprovedBuyer: false }));
    view.rerender(page({ profile: B, account: 'ready', signedIn: true, isApprovedBuyer: false }));
    expect([field('quote-business'), field('quote-contact'), field('quote-email'), field('quote-phone'), field('ship-street')])
      .toEqual(['Bravo Tobacco Outlet', 'Bea Bravo', 'bravo@example.test', '', '']);
    expect(screen.getByRole('alert').textContent).toMatch(/can’t place orders yet/);
    expect(submit().disabled).toBe(true);
  });

  it('keeps what a guest typed when they sign in', () => {
    const view = render(page({ profile: null, account: 'signed-out', signedIn: false, isApprovedBuyer: false }));
    fireEvent.change(document.getElementById('quote-contact'), { target: { value: 'Typed Name' } });
    view.rerender(page({ profile: A, account: 'ready', signedIn: true, isApprovedBuyer: true }));
    expect(field('quote-contact')).toBe('Typed Name');
    expect(field('quote-business')).toBe('Alpha Food Mart');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
