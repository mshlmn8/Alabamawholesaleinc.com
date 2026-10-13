// The header's way into My account (AW-267, AW-086): the account link says
// what it is for above the business name, which a title gives in full, and
// Quick Reorder opens the section; a guest gets My account with the sign-in
// dialog over it. The phone menu says the same.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { navigate } from '../lib/router.js';
import { Header } from './Header.jsx';
import { MobileMenu } from './MobileMenu.jsx';

const departments = departmentsFor(PRODUCTS);
const LONG = 'Birmingham Northside Convenience & Tobacco Outlet LLC';
const noop = () => {};
const renderHeader = (user, onLoginClick = vi.fn()) => {
  render(
    <Header cartCount={0} onCart={noop} products={PRODUCTS} departments={departments} user={user} isAdmin={false}
            onLoginClick={onLoginClick} onSignupClick={noop} onLogout={noop} onHelp={noop} />,
  );
  return onLoginClick;
};
const here = () => window.location.pathname + window.location.hash;

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/', { replace: true }));
});

describe('Header account link (AW-267)', () => {
  it('says My account above the business name, with the full name in its title', () => {
    renderHeader({ business: LONG, name: 'Test Buyer' });
    const link = screen.getByRole('link', { name: `My account ${LONG}` });
    expect(link.getAttribute('href')).toBe('/account');
    expect(link.getAttribute('title')).toBe(LONG);
    expect(link.hasAttribute('aria-label')).toBe(false);
    expect(link.querySelector('small.aw-account-kicker').textContent).toBe('My account');
    expect(link.querySelector('.aw-account-label').textContent).toBe(LONG);
  });

  it('falls back to the contact name, and to a plain My account while there is no name', () => {
    const view = render(
      <Header cartCount={0} onCart={noop} products={PRODUCTS} departments={departments} user={{ business: '', name: 'Test Buyer' }} isAdmin={false}
              onLoginClick={noop} onSignupClick={noop} onLogout={noop} onHelp={noop} />,
    );
    expect(screen.getByRole('link', { name: 'My account Test Buyer' }).getAttribute('title')).toBe('Test Buyer');
    view.rerender(
      <Header cartCount={0} onCart={noop} products={PRODUCTS} departments={departments} user={{ business: '', name: '' }} isAdmin={false}
              onLoginClick={noop} onSignupClick={noop} onLogout={noop} onHelp={noop} />,
    );
    const plain = screen.getByRole('link', { name: 'My account' });
    expect(plain.hasAttribute('title')).toBe(false);
    expect(plain.querySelector('.aw-account-kicker')).toBeNull();
  });
});

describe('Header Quick Reorder (AW-086)', () => {
  const reorder = () => screen.getByRole('link', { name: 'Quick reorder' });

  it('links to the Quick Reorder section of My account', () => {
    const onLoginClick = renderHeader({ business: 'Test Market LLC', name: 'Test Buyer' });
    expect(reorder().getAttribute('href')).toBe('/account#quick-reorder');
    fireEvent.click(reorder());
    expect(here()).toBe('/account#quick-reorder');
    expect(onLoginClick).not.toHaveBeenCalled();
  });

  it('opens My account for a guest, then the sign-in dialog over it', () => {
    const onLoginClick = vi.fn(() => expect(here()).toBe('/account#quick-reorder'));
    renderHeader(null, onLoginClick);
    expect(reorder().getAttribute('href')).toBe('/account#quick-reorder');
    fireEvent.click(reorder());
    expect(onLoginClick).toHaveBeenCalledTimes(1);
    expect(here()).toBe('/account#quick-reorder');
  });

  it('leaves a modified click (new tab) to the browser, with no dialog', () => {
    const onLoginClick = renderHeader(null);
    const event = fireEvent.click(reorder(), { ctrlKey: true });
    expect(event).toBe(true);
    expect(onLoginClick).not.toHaveBeenCalled();
    expect(here()).toBe('/');
  });
});

describe('Phone menu account links (AW-267, AW-086)', () => {
  const renderMenu = (user, go = {}) => render(
    <MobileMenu onClose={noop} onFollowLink={noop} departments={departments} products={PRODUCTS} user={user} isAdmin={false}
                go={{ logout: noop, signin: noop, signup: noop, help: noop, reorder: vi.fn(), ...go }} />,
  );
  const group = () => screen.getByRole('navigation', { name: 'Account and help' });

  it('names My account, with the business under it, and links Quick Reorder to its section', () => {
    renderMenu({ business: LONG, name: 'Test Buyer' });
    const account = within(group()).getByRole('link', { name: `My account ${LONG}` });
    expect(account.getAttribute('href')).toBe('/account');
    expect(account.querySelector('small.menu-sub').textContent).toBe(LONG);
    expect(within(group()).getByRole('link', { name: 'Quick reorder' }).getAttribute('href')).toBe('/account#quick-reorder');
  });

  it('sends a guest’s Quick Reorder through the header’s sign-in path', () => {
    const reorder = vi.fn();
    renderMenu(null, { reorder });
    const link = within(group()).getByRole('link', { name: 'Quick reorder' });
    expect(link.getAttribute('href')).toBe('/account#quick-reorder');
    fireEvent.click(link);
    expect(reorder).toHaveBeenCalledTimes(1);
  });
});
