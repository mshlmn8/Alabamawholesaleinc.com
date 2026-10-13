// A new password that Supabase refuses says why in the site's words, never
// Supabase's own text (AW-084).
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordPage } from './ResetPasswordPage.jsx';
import { timeoutError } from '../../lib/network.js';
import { OFFLINE_MESSAGE, slowMessage } from '../../lib/errors.js';

const SESSION = { access_token: 't', user: { id: 'u1', email: 'buyer@example.test' } };
const auth = (updatePassword) => ({
  session: SESSION, loading: false, recovery: true, linkError: null, linkChecking: false, isBackendConfigured: true, updatePassword,
});

async function save(updatePassword, password = 'a-new-password-1') {
  render(<ResetPasswordPage auth={auth(updatePassword)} onRequestReset={vi.fn()} onLoginClick={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: password } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save new password' })); });
  return screen.getByRole('alert').textContent;
}

let warn;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => warn.mockRestore());

describe('ResetPasswordPage errors (AW-084)', () => {
  it('asks for a password not used before on this account', async () => {
    const same = Object.assign(new Error('New password should be different from the old password.'), { name: 'AuthApiError', code: 'same_password', status: 422 });
    expect(await save(vi.fn(async () => { throw same; }))).toBe('Choose a password you haven’t used on this account.');
    expect(screen.queryByText(/should be different/)).toBeNull();
  });

  it('says what a weak password needs', async () => {
    const weak = Object.assign(new Error('Password is known to be weak and easy to guess, please choose a different one.'), {
      name: 'AuthWeakPasswordError', code: 'weak_password', status: 422, reasons: ['pwned'],
    });
    expect(await save(vi.fn(async () => { throw weak; }))).toBe('Choose a stronger password: one that hasn’t appeared in a data breach.');
  });

  it('asks to sign in again when the session ended', async () => {
    const missing = Object.assign(new Error('Auth session missing!'), { name: 'AuthSessionMissingError', status: 400 });
    expect(await save(vi.fn(async () => { throw missing; }))).toBe('Your session ended. Sign in again.');
  });

  // updatePassword gives up after AUTH_REQUEST_TIMEOUT_MS (LEFT-3): the
  // shared "taking too long" sentence, or the offline one, and Save works again.
  it('says a save that took too long is taking too long, and lets it be tried again', async () => {
    expect(await save(vi.fn(async () => { throw timeoutError(); }))).toBe(slowMessage('Password reset'));
    const button = screen.getByRole('button', { name: 'Save new password' });
    expect(button.disabled).toBe(false);
  });

  it('says the browser is offline when it is', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      expect(await save(vi.fn(async () => { throw timeoutError(); }))).toBe(OFFLINE_MESSAGE);
    } finally {
      online.mockRestore();
    }
    expect(screen.getByRole('button', { name: 'Save new password' }).disabled).toBe(false);
  });

  it('falls back to its own sentence for anything else', async () => {
    const odd = Object.assign(new Error('Something only Supabase would say'), { name: 'AuthApiError', code: 'unexpected_failure', status: 400 });
    expect(await save(vi.fn(async () => { throw odd; }))).toBe('We couldn’t update the password. Try again in a moment.');
    expect(screen.queryByText(/only Supabase/)).toBeNull();
  });
});
