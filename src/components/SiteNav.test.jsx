// The site's navigation around every page: the trade bar, the header, the
// phone menu, the footer and the Help dialog. Signed-in visitors are never
// asked to apply and the header separates its account links (AW-066); links
// to the page on screen carry aria-current (AW-221).
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

describe('TradeBar (AW-066, LEFT-2)', () => {
  it('leaves Apply to the header for a guest: one apply entry in the banner', () => {
    const { container } = render(<TradeBar />);
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
    expect(screen.queryByRole('link', { name: 'My account' })).toBeNull();
    expect([...container.querySelector('.trade-bar .container').children].map((el) => el.className))
      .toEqual(['announcements', 'trade-call']);
  });

  it('links a signed-in visitor to their account, before Call (the compact layout leaves it to the masthead and the menu)', () => {
    const { container } = render(<TradeBar signedIn />);
    expect(screen.queryByRole('button', { name: /apply/i })).toBeNull();
    const account = screen.getByRole('link', { name: 'My account' });
    expect(account.getAttribute('href')).toBe('/account');
    expect([...container.querySelector('.trade-bar .container').children].map((el) => el.className))
      .toEqual(['announcements', 'trade-account', 'trade-call']);
  });
});

describe('one apply entry in the banner (LEFT-2)', () => {
  it('has exactly one Apply control across the trade bar and the header for a guest, the header’s orange button', () => {
    render(
      <header>
        <TradeBar />
        <Header cartCount={0} onCart={noop} products={PRODUCTS} departments={departments} user={null} isAdmin={false}
                onLoginClick={noop} onSignupClick={noop} onLogout={noop} onHelp={noop} />
      </header>,
    );
    const apply = screen.getAllByRole('button', { name: 'Apply for a trade account' });
    expect(apply).toHaveLength(1);
    expect(apply[0].className).toBe('button aw-desktop-only');
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
    // 'My account' over the business name (AW-267), sentence case (AW-131).
    expect(actions()).toEqual(['My account Acme Market', '·', 'Admin', '·', 'Sign out']);
    const dots = [...document.querySelectorAll('.aw-account-or')];
    expect(dots.map((d) => [d.getAttribute('aria-hidden'), d.className])).toEqual([
      ['true', 'aw-account-or aw-desktop-only'],
      ['true', 'aw-account-or'],
    ]);
  });

  it('has one dot for a buyer and none for a guest', () => {
    renderHeader({ user: { business: 'Acme Market' }, isAdmin: false });
    expect(actions()).toEqual(['My account Acme Market', '·', 'Sign out']);
  });

  it('keeps "Sign in or Apply" for a guest', () => {
    renderHeader({ user: null, isAdmin: false });
    expect(actions()).toEqual(['Sign in', 'or', 'Apply for a trade account']);
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
    expect(current(nav())).toEqual([['Quick reorder', 'page']]);
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
    expect(current()).toEqual([[`02Novelties & Vapes${departments[1].count} products`, 'page'], ['Exotics', 'page']]);
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
    expect(current()).toEqual([['Quick reorder', 'page']]);
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
    fireEvent.click(help.getByRole('button', { name: 'Apply for a trade account' }));
    fireEvent.click(help.getByRole('button', { name: 'Sign in' }));
    expect([onApplyClick.mock.calls.length, onLoginClick.mock.calls.length]).toEqual([1, 1]);
    // A guest's My account says what an account gives (AW-285); it is the one link to it.
    expect(help.getAllByRole('link', { name: 'My account' })).toHaveLength(1);
  });

  // /apply shows a signed-in account its status, not the checklist: the link
  // is 'Trade account', the page's crumb (NEW-047).
  it('gives a signed-in visitor My account in their place, and Trade account for the application checklist', () => {
    renderFooter({ signedIn: true });
    const help = within(column('Account & help'));
    // Help stays a button (AW-285); Apply and Sign in are gone.
    expect(help.queryAllByRole('button').map((b) => b.textContent)).toEqual(['Help']);
    expect(help.queryByRole('link', { name: 'Application checklist' })).toBeNull();
    expect(help.getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['My account', '/account'],
      ['Trade account', '/apply'],
      ['Quick reorder', '/account#quick-reorder'],
      ['Contact & visit', '/contact'],
      ['Delivery & service area', '/delivery'],
    ]);
  });

  it('marks the department, the support page and the policy on screen', () => {
    go('/category/novelties');
    renderFooter();
    expect(current()).toEqual([[`Novelties & Vapes (${departments[1].count})`, 'page']]);
    go('/category/novelties/disposable-vapes');
    expect(current()).toEqual([[`Novelties & Vapes (${departments[1].count})`, 'true']]);
    for (const [url, text] of [['/catalog', 'All products'], ['/contact', 'Contact & visit'], ['/delivery', 'Delivery & service area'],
      ['/apply', 'Application checklist'], ['/shipping', 'Delivery policy'], ['/privacy', 'Privacy'], ['/terms', 'Trade terms']]) {
      go(url);
      expect(current(), url).toEqual([[text, 'page']]);
    }
    go('/');
    expect(current()).toEqual([]);
    // Signed in, the same link, by its other name.
    go('/apply');
    cleanup();
    renderFooter({ signedIn: true });
    expect(current()).toEqual([['Trade account', 'page']]);
  });
});

describe('HelpDialog (AW-066)', () => {
  it('offers Apply to a guest only', () => {
    const onApply = vi.fn();
    const { unmount } = render(<HelpDialog onClose={noop} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply for a trade account' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    unmount();
    render(<HelpDialog signedIn onClose={noop} onApply={onApply} />);
    expect(screen.queryByRole('button', { name: 'Apply for a trade account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Call now' })).toBeTruthy();
  });
});
