// The header's basket button and account labels (AW-131, AW-132, AW-240):
// 'Quote' or 'Order' by account, a name that counts items correctly, and a
// badge that stops at '99+'; one apply label and sentence case.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header.jsx';

const props = {
  cartCount: 0, onCart: vi.fn(), products: [], departments: [], user: null, isAdmin: false,
  onLoginClick: vi.fn(), onSignupClick: vi.fn(), onLogout: vi.fn(), onHelp: vi.fn(),
};
const cartButton = () => document.querySelector('.aw-cart-btn');
const badge = () => document.querySelector('.aw-cart-count');

describe('Header basket button (AW-132, AW-240)', () => {
  it('says Quote to guests and accounts that are not approved, Order to approved buyers', () => {
    const view = render(<Header {...props} cartCount={3} />);
    expect(screen.getByRole('button', { name: 'Quote, 3 items' })).toBe(cartButton());
    expect(cartButton().firstElementChild.textContent).toBe('Quote');
    view.rerender(<Header {...props} cartCount={3} isApprovedBuyer />);
    expect(screen.getByRole('button', { name: 'Order, 3 items' })).toBe(cartButton());
    expect(cartButton().firstElementChild.textContent).toBe('Order');
  });

  it('counts one item, none and thousands in words a screen reader reads right', () => {
    const view = render(<Header {...props} cartCount={1} />);
    expect(cartButton().getAttribute('aria-label')).toBe('Quote, 1 item');
    view.rerender(<Header {...props} cartCount={0} />);
    expect(cartButton().getAttribute('aria-label')).toBe('Quote, 0 items');
    expect(badge()).toBeNull();
    view.rerender(<Header {...props} cartCount={1500} />);
    expect(cartButton().getAttribute('aria-label')).toBe('Quote, 1,500 items');
  });

  it('caps the badge at 99+, as its only text', () => {
    const view = render(<Header {...props} cartCount={9} />);
    for (const [n, shown] of [[9, '9'], [48, '48'], [99, '99'], [100, '99+'], [129, '99+'], [1500, '99+']]) {
      view.rerender(<Header {...props} cartCount={n} />);
      expect(badge().textContent).toBe(shown);
      expect(badge().childNodes).toHaveLength(1);
      expect(badge().firstChild.nodeType).toBe(Node.TEXT_NODE);
    }
  });

  it('starts the badge again on every change, so it bumps (AW-072)', () => {
    const view = render(<Header {...props} cartCount={2} />);
    const first = badge();
    view.rerender(<Header {...props} cartCount={2} />);
    expect(badge()).toBe(first);
    view.rerender(<Header {...props} cartCount={3} />);
    expect(badge()).not.toBe(first);
  });
});

describe('Header account labels (AW-131)', () => {
  it('offers Sign in and the one apply label to guests', () => {
    render(<Header {...props} />);
    const actions = document.querySelector('.aw-account-actions');
    expect([...actions.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Sign in', 'Apply for a trade account', 'Quote']);
    screen.getByRole('button', { name: 'Apply for a trade account' }).click();
    expect(props.onSignupClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Sign up/i })).toBeNull();
  });

  it('says Sign out and My account in sentence case, and sentence-cases the navigation', () => {
    render(<Header {...props} user={{ name: '', business: '' }} />);
    expect(screen.getByRole('link', { name: 'My account' }).getAttribute('href')).toBe('/account');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New arrivals' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Quick reorder' })).toBeTruthy();
    expect(document.querySelector('.aw-header').textContent).not.toMatch(/Sign (In|Out|Up)|My Account|New Arrivals|Quick Reorder/);
  });
});
