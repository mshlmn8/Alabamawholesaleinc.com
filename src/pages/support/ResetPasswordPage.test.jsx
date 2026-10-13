// /reset-password follows one state (AW-255): the head, the body and the
// view App titles the page by. The checking view waits before it shows
// (AW-263); the form names the account on its own line (AW-262), says when a
// link signed the account in and offers to sign out again (AW-253); focus
// moves to the new password after a check and to the result after a save
// (AW-256). The page takes `auth` as a prop, so no provider is needed.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD_MIN_LENGTH } from '../../components/PasswordField.jsx';
import { CHECKING_DELAY_MS, ResetPasswordPage } from './ResetPasswordPage.jsx';

// The router's location: 'load' for a page that was loaded, 'push' for one
// navigated to (the router has then focused its h1).
const where = vi.hoisted(() => ({ action: 'load' }));
vi.mock('../../lib/router.js', async (importOriginal) => ({
  ...(await importOriginal()),
  useLocation: () => ({ action: where.action }),
}));

const SESSION = { access_token: 't', user: { id: 'u1', email: 'buyer@example.test' } };
const AUTH = { session: null, loading: false, recovery: false, linkError: null, linkChecking: false, isBackendConfigured: true, updatePassword: vi.fn(), verifyPassword: vi.fn(async () => {}) };
const STATES = {
  unavailable: { isBackendConfigured: false },
  request: {},
  checkingLink: { linkChecking: true, loading: true },
  loadingAccount: { loading: true },
  recovery: { session: SESSION, recovery: true },
  signedIn: { session: SESSION },
  linkInvalid: { linkError: { kind: 'error', code: 'otp_expired', network: false, forReset: true } },
};

function page(state, { auth: extra, ...props } = {}) {
  const handlers = { onRequestReset: vi.fn(), onLoginClick: vi.fn(), onSignOut: vi.fn(), onViewChange: vi.fn() };
  const authFor = (name) => ({ ...AUTH, ...STATES[name], ...extra });
  const view = render(<ResetPasswordPage auth={authFor(state)} {...handlers} {...props} />);
  const rerender = (next) => view.rerender(<ResetPasswordPage auth={authFor(next)} {...handlers} {...props} />);
  return { ...view, ...handlers, rerender };
}

const head = () => {
  const el = document.querySelector('.page-head');
  return { eyebrow: el.querySelector('.eyebrow')?.textContent, h1: el.querySelector('h1').textContent, intro: el.querySelector('h1 + p')?.textContent ?? null };
};

async function save(password = 'a-new-password-1') {
  // Signed in without a reset link, the current password comes first (AW-349).
  const current = screen.queryByLabelText('Current password');
  if (current) fireEvent.change(current, { target: { value: 'the-old-password-1' } });
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: password } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save new password' })); });
}

let warn;
beforeEach(() => {
  where.action = 'load';
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  vi.useRealTimers();
});

describe('ResetPasswordPage head (AW-255)', () => {
  it('heads each view with what it shows, and reports the view', () => {
    const cases = [
      ['request', 'request', { h1: 'Reset your password', intro: 'Forgot your password? We’ll email you a link to choose a new one.' }],
      ['unavailable', 'unavailable', { h1: 'Reset your password', intro: null }],
      ['checkingLink', 'checking', { h1: 'Checking your reset link', intro: null }],
      ['loadingAccount', 'checking', { h1: 'Loading your account', intro: null }],
      ['recovery', 'form', { h1: 'Choose a new password', intro: 'Pick a password of at least 8 characters that you don’t use anywhere else.' }],
      ['signedIn', 'form', { h1: 'Choose a new password' }],
      ['linkInvalid', 'link-invalid', { h1: 'Link not valid', intro: null }],
    ];
    for (const [state, view, expected] of cases) {
      const { unmount, onViewChange } = page(state);
      expect(head(), state).toMatchObject({ eyebrow: 'PASSWORD HELP', ...expected });
      expect(onViewChange, state).toHaveBeenLastCalledWith(view);
      unmount();
    }
  });

  it('gives the length the form checks', () => {
    page('recovery');
    expect(head().intro).toContain(`at least ${PASSWORD_MIN_LENGTH} characters`);
  });

  it('says “Password updated” once the password is saved', async () => {
    const updatePassword = vi.fn(async () => {});
    const { onViewChange } = page('recovery', { auth: { updatePassword } });
    await save();
    expect(updatePassword).toHaveBeenCalledWith('a-new-password-1');
    expect(head()).toMatchObject({ h1: 'Password updated', intro: null });
    expect(onViewChange).toHaveBeenLastCalledWith('done');
    expect(screen.queryByText(/Choose a new password/)).toBeNull();
  });
});

describe('ResetPasswordPage checking (AW-263)', () => {
  it('shows the checking frame only after a short wait', () => {
    vi.useFakeTimers();
    page('checkingLink');
    expect(screen.queryByRole('status')).toBeNull();
    act(() => { vi.advanceTimersByTime(CHECKING_DELAY_MS - 1); });
    expect(screen.queryByRole('status')).toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    const status = screen.getByRole('status');
    expect(status.className).toBe('reset-form');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.querySelector('.eyebrow').textContent).toBe('CHECKING YOUR LINK');
    expect(status.querySelector('.support-note').textContent).toBe('Checking your reset link…');
  });

  it('says it is loading the account when no link is being checked', () => {
    vi.useFakeTimers();
    page('loadingAccount');
    act(() => { vi.advanceTimersByTime(CHECKING_DELAY_MS); });
    const status = screen.getByRole('status');
    expect(status.querySelector('.eyebrow').textContent).toBe('LOADING');
    expect(status.querySelector('.support-note').textContent).toBe('Loading your account…');
  });

  it('never flashes it when the check is quick', () => {
    vi.useFakeTimers();
    const { rerender } = page('checkingLink');
    act(() => { vi.advanceTimersByTime(CHECKING_DELAY_MS - 50); });
    rerender('recovery');
    act(() => { vi.advanceTimersByTime(CHECKING_DELAY_MS); });
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('form', { name: 'Set a new password' })).toBeTruthy();
  });
});

describe('ResetPasswordPage form (AW-262, AW-253)', () => {
  it('names the account under the heading, not in it', () => {
    page('signedIn');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Set a new password');
    const account = document.querySelector('.reset-account');
    expect(account.textContent).toBe('For buyer@example.test');
    expect(account.querySelector('strong').textContent).toBe('buyer@example.test');
  });

  it('says a reset link signed the account in, and offers to sign out again', () => {
    const { onSignOut } = page('recovery');
    expect(document.querySelector('.reset-form .eyebrow').textContent).toBe('RESET LINK CONFIRMED');
    const hint = document.getElementById('reset-link-hint');
    expect(hint.textContent).toMatch(/^Opening this link signed you in on this device\./);
    expect(screen.getByRole('form').getAttribute('aria-describedby')).toBe('reset-link-hint');
    // Cancel leads to My account, where the session shows.
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/account');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel and sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('says it is signing out while it does', () => {
    page('recovery', { signingOut: true });
    const button = screen.getByRole('button', { name: 'Signing out…' });
    expect(button.disabled).toBe(true);
  });

  it('offers only Cancel, to My account, when signed in without a link', () => {
    page('signedIn');
    expect(document.querySelector('.reset-form .eyebrow').textContent).toBe('YOUR ACCOUNT');
    expect(document.getElementById('reset-link-hint')).toBeNull();
    expect(screen.getByRole('form').hasAttribute('aria-describedby')).toBe(false);
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/account');
    expect(screen.queryByRole('button', { name: 'Cancel and sign out' })).toBeNull();
  });

  it('puts Supabase’s refusals in its own words (AW-084)', async () => {
    const same = Object.assign(new Error('New password should be different from the old password.'), { name: 'AuthApiError', code: 'same_password', status: 422 });
    page('signedIn', { auth: { updatePassword: vi.fn(async () => { throw same; }) } });
    await save();
    expect(screen.getByRole('alert').textContent).toBe('Choose a password you haven’t used on this account.');
  });
});

describe('ResetPasswordPage focus and announcements (AW-256)', () => {
  it('moves focus to the new password once the link has been checked', () => {
    where.action = 'push';
    const { rerender } = page('checkingLink');
    // The router focused the h1 after the navigation.
    const h1 = document.querySelector('h1');
    h1.setAttribute('tabindex', '-1');
    h1.focus();
    rerender('recovery');
    expect(document.activeElement).toBe(screen.getByLabelText('New password'));
    expect(screen.getByLabelText('New password').hasAttribute('data-autofocus')).toBe(false);
  });

  it('focuses the new password on a page that was loaded onto the form', () => {
    page('recovery');
    expect(document.activeElement).toBe(screen.getByLabelText('New password'));
  });

  it('leaves the router’s focus on the h1 after a navigation onto the form', () => {
    where.action = 'push';
    page('signedIn');
    expect(document.activeElement).toBe(document.body);
  });

  it('does not take focus that moved elsewhere during the check', () => {
    where.action = 'push';
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const { rerender } = page('checkingLink');
    outside.focus();
    rerender('recovery');
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('announces a saved password and moves focus to it', async () => {
    page('recovery', { auth: { updatePassword: vi.fn(async () => {}) } });
    await save();
    const heading = screen.getByRole('heading', { level: 2, name: 'New password saved' });
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(heading.closest('.status-panel').getAttribute('role')).toBe('status');
  });
});
