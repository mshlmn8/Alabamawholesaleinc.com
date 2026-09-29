// The sign-in dialog after a sign-in: status, close, or a clear message when
// the account does not load (AW-089), and a sign-in from another tab (AW-335).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../lib/auth.jsx';
import { AuthModal, CHECKING_TIMEOUT_MS } from './AuthModal.jsx';

const SESSION = { access_token: 't', user: { id: 'u1', email: 'buyer@example.test' } };

function authValue(overrides = {}) {
  return {
    session: null, loading: false, profile: null, profileReady: false, profileRefreshing: false,
    isBackendConfigured: true,
    signIn: vi.fn(async () => {}), signUp: vi.fn(), resetPassword: vi.fn(), resendConfirmation: vi.fn(async () => {}),
    refreshProfile: vi.fn(async () => null),
    ...overrides,
  };
}

function setup(initial, props = {}) {
  const onClose = vi.fn();
  const onSignOut = vi.fn();
  let value = authValue(initial);
  const ui = () => (
    <AuthContext.Provider value={value}>
      <AuthModal open onClose={onClose} onSignOut={onSignOut} {...props} />
    </AuthContext.Provider>
  );
  const view = render(ui());
  const update = (changes) => { value = { ...value, ...changes }; view.rerender(ui()); };
  return { onClose, onSignOut, update, get value() { return value; } };
}

const signInWith = async () => {
  fireEvent.change(screen.getByLabelText('Business email'), { target: { value: 'buyer@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password-1' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Sign in/ })); });
};

afterEach(() => vi.useRealTimers());

describe('AuthModal after sign-in', () => {
  it('shows a pending account its status', async () => {
    const t = setup();
    await signInWith();
    expect(screen.getByRole('heading', { name: 'Signing you in…' })).toBeTruthy();
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'pending', email: 'buyer@example.test' } });
    expect(screen.getByRole('heading', { name: 'Your account is pending approval' })).toBeTruthy();
    expect(t.onClose).not.toHaveBeenCalled();
  });

  it('closes for an approved account', async () => {
    const t = setup();
    await signInWith();
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'approved' } });
    expect(t.onClose).toHaveBeenCalledTimes(1);
  });

  it('says so when the account does not load, with Try again and Sign out (AW-089)', async () => {
    const t = setup();
    await signInWith();
    t.update({ session: SESSION, profileReady: true, profile: null, profileError: 'failed' });
    expect(screen.getByRole('heading', { name: 'We couldn’t load your account' })).toBeTruthy();
    expect(t.onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(t.onSignOut).toHaveBeenCalled();
    // The provider marks the profile as refreshing while it loads again.
    t.value.refreshProfile.mockImplementation(() => { t.value.profileRefreshing = true; });
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(t.value.refreshProfile).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Signing you in…' })).toBeTruthy();
    t.update({ profileRefreshing: false, profile: { id: 'u1', status: 'approved' }, profileError: null });
    expect(t.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on its own when the account is slow (AW-089)', async () => {
    vi.useFakeTimers();
    const t = setup();
    await signInWith();
    t.update({ session: SESSION, profileReady: false });
    act(() => { vi.advanceTimersByTime(CHECKING_TIMEOUT_MS + 10); });
    expect(t.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'We couldn’t load your account' })).toBeTruthy();
  });

  it('offers a new confirmation link to an unconfirmed account (AW-015)', async () => {
    const t = setup({ signIn: vi.fn(async () => { throw Object.assign(new Error('Email not confirmed'), { code: 'email_not_confirmed' }); }) });
    await signInWith();
    expect(screen.getByRole('heading', { name: 'Confirm your email first' })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Send a new confirmation link/ })); });
    expect(t.value.resendConfirmation).toHaveBeenCalledWith('buyer@example.test');
    expect(screen.getByText(/We sent a new confirmation link to buyer@example.test/)).toBeTruthy();
  });
});

describe('AuthModal and a sign-in in another tab (AW-335)', () => {
  it('closes the password form when an approved account signs in elsewhere', () => {
    const t = setup();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
    t.update({ session: SESSION, profileReady: false });
    expect(t.onClose).not.toHaveBeenCalled();
    t.update({ profileReady: true, profile: { id: 'u1', status: 'approved' } });
    expect(t.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a pending account its status instead', () => {
    const t = setup();
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'pending', email: 'buyer@example.test' } });
    expect(screen.getByRole('heading', { name: 'Your account is pending approval' })).toBeTruthy();
  });

  it('leaves the application checklist open for a signed-in visitor', () => {
    const t = setup({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'approved' } }, { initialMode: 'signup' });
    expect(screen.getByRole('heading', { name: 'Apply for an account' })).toBeTruthy();
    t.update({ profile: { id: 'u1', status: 'approved', name: 'x' } });
    expect(t.onClose).not.toHaveBeenCalled();
  });

  it('leaves a half-typed application alone when a session appears', () => {
    const t = setup({}, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Typed' } });
    t.update({ session: SESSION, profileReady: true, profile: { id: 'u1', status: 'approved' } });
    expect(t.onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Your name').value).toBe('Typed');
  });
});
