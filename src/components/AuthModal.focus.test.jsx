// Where keyboard focus goes when the server refuses a sign-in, an application
// or a reset-link request (NEW-003), and the reset email a signed-in account
// gets filled in (NEW-067).
//
// Chrome moves focus from a button that becomes disabled to <body>; jsdom
// leaves it there. Each test does what Chrome does: it presses the focused
// submit button, checks the dialog disabled it, drops focus to <body>, then
// lets the server answer.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../lib/auth.jsx';
import { AuthModal } from './AuthModal.jsx';

const SESSION = { access_token: 't', user: { id: 'u1', email: 'buyer@example.test' } };
const apiError = (message, code, status, extra = {}) => Object.assign(new Error(message), { name: 'AuthApiError', code, status, ...extra });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function setup(initialMode, overrides = {}) {
  const value = {
    session: null, loading: false, profile: null, profileReady: false, profileRefreshing: false, isBackendConfigured: true,
    signIn: vi.fn(async () => {}), signUp: vi.fn(async () => ({ session: null })), resetPassword: vi.fn(async () => {}),
    resendConfirmation: vi.fn(async () => {}), refreshProfile: vi.fn(async () => null),
    ...overrides,
  };
  render(
    <AuthContext.Provider value={value}>
      <AuthModal initialMode={initialMode} onClose={vi.fn()} onSignOut={vi.fn()} />
    </AuthContext.Provider>,
  );
  return value;
}
const byId = (id) => document.getElementById(id);
const dialog = () => document.querySelector('[role="dialog"]');
const change = (id, value) => fireEvent.change(byId(id), { target: { value } });

// Presses `button` with focus on it, as a keyboard user does; the request
// waits on `pending` until the test answers. Chrome then drops the focus of
// the disabled button.
function pressFocused(button) {
  button.focus();
  fireEvent.click(button);
  expect(button.disabled).toBe(true);
  dropFocus();
  expect(document.activeElement).toBe(document.body);
}
// jsdom's blur() ignores a disabled button; a focused element that leaves
// the page leaves focus on <body>, as Chrome does.
function dropFocus() {
  const stand = document.createElement('button');
  document.body.appendChild(stand);
  stand.focus();
  stand.remove();
}

const fillSignin = () => {
  change('aw-email', 'buyer@example.test');
  change('aw-pass', 'test-password-1');
};
const fillApplication = () => {
  for (const [id, value] of Object.entries({
    'aw-su-name': 'New Buyer', 'aw-su-email': 'new@example.test', 'aw-su-phone': '205-555-0199', 'aw-su-pass': 'test-password-1',
    'aw-su-business': 'New Store', 'aw-su-type': 'Smoke Shop', 'aw-su-state': 'AL', 'aw-su-street': '1 Test Way',
    'aw-su-city': 'Testville', 'aw-su-zip': '35203', 'aw-su-volume': '$15K — $50K', 'aw-su-ein': '12-3456789',
    'aw-su-license': 'TL-TEST', 'aw-su-resale': 'RS-TEST',
  })) change(id, value);
  fireEvent.click(byId('aw-su-terms'));
  fireEvent.click(byId('aw-su-age'));
};

let warn;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => warn.mockRestore());

describe('AuthModal keeps keyboard focus in the dialog after a refusal (NEW-003)', () => {
  it('sign-in refused as invalid_credentials: focus goes to the email, inside the dialog, not <body>', async () => {
    const pending = deferred();
    setup('signin', { signIn: vi.fn(() => pending.promise) });
    fillSignin();
    pressFocused(screen.getByRole('button', { name: 'Sign in' }));
    await act(async () => { pending.reject(apiError('Invalid login credentials', 'invalid_credentials', 400)); });
    expect(screen.getByRole('alert').textContent).toBe('That email and password don’t match. Try again or reset your password.');
    expect(document.activeElement).not.toBe(document.body);
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(byId('aw-email'));
  });

  it('sign-in that fails for another reason: focus goes back to Sign in, usable again', async () => {
    const pending = deferred();
    setup('signin', { signIn: vi.fn(() => pending.promise) });
    fillSignin();
    const button = screen.getByRole('button', { name: 'Sign in' });
    pressFocused(button);
    await act(async () => { pending.reject(Object.assign(new TypeError('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 })); });
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it('leaves focus in the password field when Enter was pressed there', async () => {
    setup('signin', { signIn: vi.fn(async () => { throw apiError('Invalid login credentials', 'invalid_credentials', 400); }) });
    fillSignin();
    byId('aw-pass').focus();
    await act(async () => { fireEvent.submit(byId('aw-pass').closest('form')); });
    expect(document.activeElement).toBe(byId('aw-pass'));
  });

  it('an unconfirmed email opens its own step, whose heading takes focus', async () => {
    const pending = deferred();
    setup('signin', { signIn: vi.fn(() => pending.promise) });
    fillSignin();
    pressFocused(screen.getByRole('button', { name: 'Sign in' }));
    await act(async () => { pending.reject(apiError('Email not confirmed', 'email_not_confirmed', 400)); });
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Confirm your email first' }));
  });

  const WEAK = apiError('Password should be at least 8 characters.', 'weak_password', 422, { name: 'AuthWeakPasswordError', reasons: ['length'] });
  const TAKEN = apiError('User already registered', 'user_already_exists', 422);
  const formAlert = () => document.querySelector('[role="dialog"] form > p.form-error[role="alert"]');

  // The message goes under the field, where focus lands: the form's alert
  // sits at the foot of the long form, out of view from the email.
  for (const [what, error, target, message] of [
    ['weak_password: the password, with the message under it', WEAK, 'aw-su-pass', 'Choose a stronger password: at least 8 characters.'],
    ['user_already_exists: the email, with the message under it', TAKEN, 'aw-su-email', 'An account already uses this email. Sign in or reset your password.'],
  ]) {
    it(`application refused as ${what}`, async () => {
      const pending = deferred();
      setup('application', { signUp: vi.fn(() => pending.promise) });
      fillApplication();
      pressFocused(screen.getByRole('button', { name: 'Submit application' }));
      await act(async () => { pending.reject(error); });
      const field = byId(target);
      expect(document.activeElement).toBe(field);
      expect(byId(`${target}-error`).textContent).toBe(message);
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(field.getAttribute('aria-describedby').split(' ')).toContain(`${target}-error`);
      expect(formAlert().textContent).toBe('');
    });
  }

  it('application refused as a rate limit: back to Submit application, the message in the form’s alert', async () => {
    const pending = deferred();
    setup('application', { signUp: vi.fn(() => pending.promise) });
    fillApplication();
    const button = screen.getByRole('button', { name: 'Submit application' });
    pressFocused(button);
    await act(async () => { pending.reject(apiError('email rate limit exceeded', 'over_email_send_rate_limit', 429)); });
    expect(formAlert().textContent).toBe('Please wait a minute before trying again.');
    expect(document.activeElement).toBe(button);
  });

  it('a taken email moves focus to the email from wherever Enter was pressed, as the form’s own check does', async () => {
    setup('application', { signUp: vi.fn(async () => { throw TAKEN; }) });
    fillApplication();
    byId('aw-su-resale').focus();
    await act(async () => { fireEvent.submit(byId('aw-su-resale').closest('form')); });
    expect(document.activeElement).toBe(byId('aw-su-email'));
  });

  it('reads the message out when the refused field already had focus, and drops it once the field changes', async () => {
    setup('application', { signUp: vi.fn(async () => { throw TAKEN; }) });
    fillApplication();
    byId('aw-su-email').focus();
    await act(async () => { fireEvent.submit(byId('aw-su-email').closest('form')); });
    expect(document.activeElement).toBe(byId('aw-su-email'));
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
    expect(byId('aw-announcer').textContent).toBe('An account already uses this email. Sign in or reset your password.');
    change('aw-su-email', 'other@example.test');
    expect(byId('aw-su-email-error').textContent).toBe('');
    expect(byId('aw-su-email').hasAttribute('aria-invalid')).toBe(false);
  });

  it('reset link refused: focus goes back to Send reset link', async () => {
    const pending = deferred();
    setup('reset', { resetPassword: vi.fn(() => pending.promise) });
    change('aw-reset-email', 'buyer@example.test');
    const button = screen.getByRole('button', { name: 'Send reset link' });
    pressFocused(button);
    await act(async () => { pending.reject(Object.assign(new TypeError('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 })); });
    expect(document.activeElement).toBe(button);
  });

  it('a sign-in that goes through moves focus to the next step’s heading', async () => {
    const pending = deferred();
    setup('signin', { signIn: vi.fn(() => pending.promise) });
    fillSignin();
    pressFocused(screen.getByRole('button', { name: 'Sign in' }));
    await act(async () => { pending.resolve(); });
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Signing you in…' }));
  });
});

describe('AuthModal reset email for a signed-in account (NEW-067)', () => {
  it('fills in the signed-in account’s email when opened for a reset', () => {
    const auth = setup('reset', { session: SESSION });
    expect(byId('aw-reset-email').value).toBe('buyer@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(auth.resetPassword).toHaveBeenCalledWith('buyer@example.test');
  });

  it('starts empty for a signed-out visitor', () => {
    setup('reset');
    expect(byId('aw-reset-email').value).toBe('');
  });
});
