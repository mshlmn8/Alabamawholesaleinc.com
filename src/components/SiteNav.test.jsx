// The site's navigation around every page: the trade bar, the header, the
// phone menu, the footer and the Help dialog. Signed-in visitors are never
// asked to apply and the header separates its account links (AW-066); links
// to the page on screen carry aria-current (AW-221).
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from '../lib/departments.js';
import { navigate } from '../lib/router.js';
import { Footer } from './Footer.jsx';
import { Header } from './Header.jsx';
import { HelpDialog } from './HelpDialog.jsx';
import { MobileMenu } from './MobileMenu.jsx';
import { TradeBar } from './TradeBar.jsx';

const departments = departmentsFor(PRODUCTS);
const noop = () => {};
const go = (url) => act(() => navigate(url, { replace: true }));
const current = (container = document) => [...container.querySelectorAll('[aria-current]')].map((el) => [el.textContent, el.getAttribute('aria-current')]);

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  go('/');
});

describe('TradeBar (AW-066)', () => {
  it('asks a guest to apply', () => {
    const onApplyClick = vi.fn();
    render(<TradeBar onApplyClick={onApplyClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply for a trade account' }));
    expect(onApplyClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'My account' })).toBeNull();
  });

  it('links a signed-in visitor to their account instead, in the same place', () => {
    const { container } = render(<TradeBar signedIn onApplyClick={noop} />);
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
    const account = screen.getByRole('link', { name: 'My account' });
    expect(account.getAttribute('href')).toBe('/account');
    expect([...container.querySelector('.trade-bar .container').children].map((el) => el.className || el.tagName))
      .toEqual(['ticker', 'trade-call', 'A']);
  });
});

describe('Header account links (AW-066)', () => {
  const renderHeader = (props) => render(
    <Header cartCount={0} onCart={noop} products={PRODUCTS} departments={departments} onLoginClick={noop} onSignupClick={noop}
            onLogout={noop} onHelp={noop} {...props} />,
  );
  const actions = () => [...document.querySelector('.aw-account-actions').children]
    .filter((el) => !el.classList.contains('aw-cart-btn'))
    .map((el) => el.textContent);

  it('separates the name, Admin and Sign Out with dots that screen readers skip', () => {
    renderHeader({ user: { business: 'Acme Market' }, isAdmin: true });
    expect(actions()).toEqual(['Acme Market', '·', 'Admin', '·', 'Sign Out']);
    const dots = [...document.querySelectorAll('.aw-account-or')];
    expect(dots.map((d) => [d.getAttribute('aria-hidden'), d.className])).toEqual([
      ['true', 'aw-account-or aw-desktop-only'],
      ['true', 'aw-account-or'],
    ]);
  });

  it('has one dot for a buyer and none for a guest', () => {
    renderHeader({ user: { business: 'Acme Market' }, isAdmin: false });
    expect(actions()).toEqual(['Acme Market', '·', 'Sign Out']);
  });

  it('keeps "Sign In or Sign Up" for a guest', () => {
    renderHeader({ user: null, isAdmin: false });
    expect(actions()).toEqual(['Sign In', 'or', 'Sign Up']);
  });
});

describe('Header current page (AW-221)', () => {
  const renderHeader = () => render(
    <Header cartCount={0} onCart={noop} products={PRODUCTS} departments={departments} user={null} isAdmin={false}
            onLoginClick={noop} onSignupClick={noop} onLogout={noop} onHelp={noop} />,
  );
  const nav = () => document.querySelector('.aw-navigation');

  it('marks Exotics on the Novelties department, and as its section on one of its lines', () => {
    go('/category/novelties');
    renderHeader();
    expect(current(nav())).toEqual([['Exotics', 'page']]);
    go('/category/novelties/disposable-vapes');
    expect(current(nav())).toEqual([['Exotics', 'true']]);
    go('/category/tobacco');
    expect(current(nav())).toEqual([]);
  });

  it('marks Quick Reorder on the account page, and nothing on the home page', () => {
    renderHeader();
    expect(current(nav())).toEqual([]);
    go('/account');
    expect(current(nav())).toEqual([['Quick Reorder', 'page']]);
  });

  it('marks the line and its department in the Categories menu', () => {
    go('/category/novelties/disposable-vapes');
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Categories', exact: true }));
    expect(current(document.getElementById('aw-mega-menu'))).toEqual([['Disposable Vapes', 'page'], ['All Novelties & Vapes', 'true']]);
  });
});

describe('MobileMenu current page (AW-221)', () => {
  const renderMenu = (user = null) => render(
    <MobileMenu onClose={noop} onFollowLink={noop} departments={departments} products={PRODUCTS} user={user} isAdmin={false}
                go={{ logout: noop, signin: noop, signup: noop, help: noop }} />,
  );

  it('marks the department and Exotics on the Novelties pages', () => {
    go('/category/novelties');
    renderMenu();
    expect(current()).toEqual([[`02Novelties & Vapes${departments[1].count}`, 'page'], ['Exotics', 'page']]);
    go('/category/novelties/disposable-vapes');
    expect(current().map(([, value]) => value)).toEqual(['true', 'true']);
  });

  it('marks the full catalog and Quick Reorder on their pages, signed in or not', () => {
    go('/catalog');
    const { unmount } = renderMenu();
    expect(current()).toEqual([['View full catalog', 'page']]);
    unmount();
    go('/account');
    renderMenu({ business: 'Acme Market' });
    expect(current()).toEqual([['Quick Reorder', 'page']]);
  });
});

describe('Footer (AW-066, AW-221)', () => {
  const renderFooter = (props) => render(<Footer departments={departments} onLoginClick={noop} onApplyClick={noop} {...props} />);
  const column = (name) => screen.getByRole('heading', { name }).parentElement;

  it('offers a guest Apply and Sign in', () => {
    const onApplyClick = vi.fn();
    const onLoginClick = vi.fn();
    renderFooter({ onApplyClick, onLoginClick });
    const help = within(column('Account & help'));
    fireEvent.click(help.getByRole('button', { name: 'Apply for account' }));
    fireEvent.click(help.getByRole('button', { name: 'Sign in' }));
    expect([onApplyClick.mock.calls.length, onLoginClick.mock.calls.length]).toEqual([1, 1]);
    expect(help.queryByRole('link', { name: 'My account' })).toBeNull();
  });

  it('gives a signed-in visitor My account in their place, and keeps the application checklist', () => {
    renderFooter({ signedIn: true });
    const help = within(column('Account & help'));
    expect(help.queryAllByRole('button')).toEqual([]);
    expect(help.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['My account', '/account'],
      ['Application checklist', '/apply'],
      ['Contact & visit', '/contact'],
      ['Delivery & service area', '/delivery'],
      ['New arrivals', '/#new-arrivals'],
      ['Bestsellers', '/#bestsellers'],
    ]);
  });

  it('marks the department, the support page and the policy on screen', () => {
    go('/category/novelties');
    renderFooter();
    expect(current()).toEqual([[`Novelties & Vapes (${departments[1].count})`, 'page']]);
    go('/category/novelties/disposable-vapes');
    expect(current()).toEqual([[`Novelties & Vapes (${departments[1].count})`, 'true']]);
    for (const [url, text] of [['/catalog', 'All products'], ['/contact', 'Contact & visit'], ['/delivery', 'Delivery & service area'],
      ['/apply', 'Application checklist'], ['/shipping', 'Delivery'], ['/privacy', 'Privacy'], ['/terms', 'Trade terms']]) {
      go(url);
      expect(current(), url).toEqual([[text, 'page']]);
    }
    go('/');
    expect(current()).toEqual([]);
  });
});

describe('HelpDialog (AW-066)', () => {
  it('offers Apply to a guest only', () => {
    const onApply = vi.fn();
    const { unmount } = render(<HelpDialog onClose={noop} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply for an account' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    unmount();
    render(<HelpDialog signedIn onClose={noop} onApply={onApply} />);
    expect(screen.queryByRole('button', { name: 'Apply for an account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Call now' })).toBeTruthy();
  });
});
