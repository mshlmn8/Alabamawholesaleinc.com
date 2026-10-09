// /reset-password follows one state (AW-255): the head, the body and the
// view App titles the page by. The checking view waits before it shows
// (AW-263). The page takes `auth` as a prop, so no provider is needed.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD_MIN_LENGTH } from '../../components/PasswordField.jsx';
import { CHECKING_DELAY_MS, ResetPasswordPage } from './ResetPasswordPage.jsx';

const SESSION = { access_token: 't', user: { id: 'u1', email: 'buyer@example.test' } };
const AUTH = { session: null, loading: false, recovery: false, linkError: null, linkChecking: false, isBackendConfigured: true, updatePassword: vi.fn() };
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
  const handlers = { onRequestReset: vi.fn(), onLoginClick: vi.fn(), onViewChange: vi.fn() };
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
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: password } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save new password' })); });
}

let warn;
beforeEach(() => {
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
    expect(screen.getByRole('form')).toBeTruthy();
  });
});
