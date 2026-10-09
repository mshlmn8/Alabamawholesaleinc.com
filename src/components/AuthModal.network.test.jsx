// The sign-in dialog on a stalled or missing connection (AW-194, AW-344):
// a timed-out sign-in or reset says it is taking too long and the form can
// be sent again; offline says so; a timed-out application says it may have
// gone through. useAuth's calls reject the way src/lib/auth.jsx's do after
// AUTH_REQUEST_TIMEOUT_MS (withTimeout).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../lib/auth.jsx';
import { APPLICATION_TIMEOUT_MESSAGE, OFFLINE_MESSAGE, slowMessage } from '../lib/errors.js';
import { timeoutError } from '../lib/network.js';
import { AuthModal } from './AuthModal.jsx';

const SESSION = { access_token: 't', user: { id: 'u1', email: 'buyer@example.test' } };

function setup(overrides = {}, props = {}) {
  let value = {
    session: null, loading: false, profile: null, profileReady: false, profileRefreshing: false, isBackendConfigured: true,
    signIn: vi.fn(async () => {}), signUp: vi.fn(), resetPassword: vi.fn(async () => {}), resendConfirmation: vi.fn(async () => {}),
    refreshProfile: vi.fn(async () => null),
    ...overrides,
  };
  const ui = () => (
    <AuthContext.Provider value={value}>
      <AuthModal open onClose={vi.fn()} onSignOut={vi.fn()} {...props} />
    </AuthContext.Provider>
  );
  const view = render(ui());
  return { update: (changes) => { value = { ...value, ...changes }; view.rerender(ui()); } };
}

const signInWith = async () => {
  fireEvent.change(screen.getByLabelText('Business email'), { target: { value: 'buyer@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password-1' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Sign in/ })); });
};
const dialogAlert = () => screen.getAllByRole('alert').find((el) => el.closest('[role="dialog"]'));

describe('AuthModal on a slow or missing connection', () => {
  it('says a sign-in is taking too long, and the form can be sent again', async () => {
    setup({ signIn: vi.fn(async () => { throw timeoutError(); }) });
    await signInWith();
    expect(dialogAlert().textContent).toBe(slowMessage('Account sign-in'));
    expect(dialogAlert().textContent).toMatch(/is taking too long to answer\. Check your connection and try again, or call \(205\)/);
    expect(screen.getByRole('button', { name: 'Sign in' }).disabled).toBe(false);
  });

  it('says the buyer is offline, not that sign-in is unavailable', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    setup({ signIn: vi.fn(async () => { throw Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 }); }) });
    await signInWith();
    expect(dialogAlert().textContent).toBe(OFFLINE_MESSAGE);
  });

  it('says a timed-out reset is taking too long', async () => {
    setup({ resetPassword: vi.fn(async () => { throw timeoutError(); }) }, { initialMode: 'reset' });
    fireEvent.change(screen.getByLabelText('Business email'), { target: { value: 'buyer@example.test' } });
    await act(async () => { fireEvent.submit(screen.getByLabelText('Business email').closest('form')); });
    expect(dialogAlert().textContent).toBe(slowMessage('Password reset'));
  });

  it('says a timed-out application may have gone through: check the inbox', async () => {
    setup({ signUp: vi.fn(async () => { throw timeoutError(); }) }, { initialMode: 'application' });
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'New Buyer' } });
    // A US phone number, which the form checks before sending (AW-091).
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '205-555-0199' } });
    await act(async () => { fireEvent.submit(screen.getByLabelText('Your name').closest('form')); });
    expect(dialogAlert().textContent).toBe(APPLICATION_TIMEOUT_MESSAGE);
    // The answers stay, and the application can be sent again.
    expect(screen.getByLabelText('Your name').value).toBe('New Buyer');
    expect(screen.getByRole('button', { name: 'Submit application' }).disabled).toBe(false);
  });

  it('moves on when a sign-in that timed out goes through after all', async () => {
    const t = setup({ signIn: vi.fn(async () => { throw timeoutError(); }) });
    await signInWith();
    expect(dialogAlert().textContent).toBe(slowMessage('Account sign-in'));
    // Supabase answers late: the session arrives as from another tab.
    t.update({ session: SESSION });
    t.update({ profileReady: true, profile: { id: 'u1', status: 'pending', email: 'buyer@example.test' } });
    expect(screen.getByRole('heading', { name: 'Your account is pending approval' })).toBeTruthy();
    // The timed-out message doesn't follow it there.
    expect(document.querySelector('[role="dialog"]').textContent).not.toMatch(/taking too long/);
  });
});
