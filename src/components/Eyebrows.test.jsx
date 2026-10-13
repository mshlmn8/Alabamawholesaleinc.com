// One eyebrow over each heading (AW-220): the Help dialog, the account
// dialog in each of its modes, and the policy pages. Help also lists its two
// hour ranges on lines of their own and links to the help pages.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPANY } from '../data/content.js';
import { AuthContext } from '../lib/auth.jsx';
import { navigate } from '../lib/router.js';
import { PolicyPage } from '../pages/support/PolicyPage.jsx';
import { PolicyNav } from '../pages/support/SupportShell.jsx';
import { AuthModal } from './AuthModal.jsx';
import { HelpDialog } from './HelpDialog.jsx';

const eyebrows = (root = document) => [...root.querySelectorAll('.eyebrow, .kicker')].map((el) => el.textContent);

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  act(() => navigate('/category/tobacco', { replace: true }));
});

describe('Help dialog (AW-220)', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'Talk to the warehouse' });

  it('has one eyebrow, and each hour range on its own line', () => {
    render(<HelpDialog onClose={() => {}} onApply={() => {}} />);
    expect(eyebrows(dialog())).toEqual(['ACCOUNT SERVICE']);
    const hours = [...dialog().querySelectorAll('dd .hours-line')];
    expect(hours.map((el) => el.textContent)).toEqual([COMPANY.hoursLine1, COMPANY.hoursLine2]);
    expect(hours[0].parentElement.childNodes).toHaveLength(2);
  });

  it('links to Contact & visit, Delivery & service area and Trade terms, closing as it follows one', () => {
    const onClose = vi.fn();
    render(<HelpDialog onClose={onClose} onApply={() => {}} />);
    const nav = screen.getByRole('navigation', { name: 'Help pages' });
    expect([...nav.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href'), a.className])).toEqual([
      ['Contact & visit', '/contact', 'text-link'],
      ['Delivery & service area', '/delivery', 'text-link'],
      ['Trade terms', '/terms', 'text-link'],
    ]);
    fireEvent.click(screen.getByRole('link', { name: 'Delivery & service area' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/delivery');
  });
});

describe('Account dialog (AW-220)', () => {
  const renderModal = (initialMode) => render(
    <AuthContext.Provider value={{
      session: null, loading: false, profile: null, profileReady: false, profileRefreshing: false, isBackendConfigured: true,
      signIn: vi.fn(), signUp: vi.fn(), resetPassword: vi.fn(), resendConfirmation: vi.fn(), refreshProfile: vi.fn(),
    }}>
      <AuthModal open initialMode={initialMode} onClose={() => {}} onSignOut={() => {}} />
    </AuthContext.Provider>,
  );

  it('names the mode in its one eyebrow, beside the close button', () => {
    for (const [mode, eyebrow, title] of [
      ['signin', 'EXISTING ACCOUNTS', 'Sign in'],
      ['signup', 'NEW ACCOUNTS · LICENSED RETAILERS ONLY', 'Apply for a trade account'],
      ['reset', 'PASSWORD HELP', 'Reset your password'],
    ]) {
      const { unmount } = renderModal(mode);
      const dialog = screen.getByRole('dialog', { name: title });
      expect(eyebrows(dialog), mode).toEqual([eyebrow]);
      // The step's kicker shares the top row with the × (AW-245).
      expect(dialog.querySelector('.dialog-top .kicker').textContent, mode).toBe(eyebrow);
      unmount();
    }
  });
});

describe('Policy pages (AW-220)', () => {
  // The side nav of every support page (AW-122) is 'HELP & POLICIES'.
  it('PolicyNav names the help and policy pages in an eyebrow by default, and leaves it off for label null', () => {
    const { unmount } = render(<PolicyNav current="terms" />);
    expect(eyebrows()).toEqual(['HELP & POLICIES']);
    unmount();
    render(<PolicyNav current="terms" label={null} />);
    expect(eyebrows()).toEqual([]);
    const nav = screen.getByRole('navigation', { name: 'Help and policies' });
    expect(nav.querySelector('[aria-current="page"]').textContent).toBe('Trade terms');
  });

  it('says CUSTOMER POLICIES once on a policy page, in its head', () => {
    render(<PolicyPage kind="terms" />);
    const said = [...document.querySelectorAll('.eyebrow')].filter((el) => el.textContent === 'CUSTOMER POLICIES');
    expect(said).toHaveLength(1);
    expect(said[0].closest('.page-head')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Help and policies' })).toBeTruthy();
    expect(eyebrows(screen.getByRole('navigation', { name: 'Help and policies' }))).toEqual([]);
  });
});
