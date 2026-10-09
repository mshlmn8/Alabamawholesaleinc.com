// Where keyboard focus goes when the server refuses 'Save new password'
// (NEW-003). Chrome moves focus from a button that becomes disabled to
// <body>; jsdom leaves it there, so each test drops it the way Chrome does.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordPage } from './ResetPasswordPage.jsx';

const SESSION = { access_token: 'tok', user: { id: 'u1', email: 'buyer@example.test' } };
const authError = (message, extra) => Object.assign(new Error(message), extra);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function page(overrides = {}) {
  const auth = {
    session: SESSION, loading: false, recovery: false, linkError: null, linkChecking: false, isBackendConfigured: true,
    verifyPassword: vi.fn(async () => {}),
    updatePassword: vi.fn(async () => ({ othersSignedOut: true })),
    ...overrides,
  };
  render(<ResetPasswordPage auth={auth} onRequestReset={vi.fn()} onLoginClick={vi.fn()} />);
  return auth;
}
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fill = () => {
  type('Current password', 'old-pass-1');
  type('New password', 'new-pass-123');
  type('Confirm new password', 'new-pass-123');
};
// A focused element that leaves the page leaves focus on <body>, as Chrome
// does for the disabled Save (jsdom's blur() ignores a disabled button).
function dropFocus() {
  const stand = document.createElement('button');
  document.body.appendChild(stand);
  stand.focus();
  stand.remove();
}
const save = () => screen.getByRole('button', { name: /^(Save new password|Saving…)$/ });
function pressSave() {
  const button = save();
  button.focus();
  fireEvent.click(button);
  expect(button.disabled).toBe(true);
  dropFocus();
  expect(document.activeElement).toBe(document.body);
}

let warn;
beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => warn.mockRestore());

describe('ResetPasswordPage keeps keyboard focus after a refused save (NEW-003)', () => {
  it('a new password used before: focus goes to New password', async () => {
    const pending = deferred();
    page({ updatePassword: vi.fn(() => pending.promise) });
    fill();
    pressSave();
    await act(async () => { pending.reject(authError('New password should be different from the old password.', { status: 422, code: 'same_password' })); });
    expect(screen.getByRole('alert').textContent).toBe('Choose a password you haven’t used on this account.');
    expect(document.activeElement).toBe(screen.getByLabelText('New password'));
  });

  it('a weak new password: focus goes to New password', async () => {
    const pending = deferred();
    page({ updatePassword: vi.fn(() => pending.promise) });
    fill();
    pressSave();
    await act(async () => { pending.reject(authError('weak', { name: 'AuthWeakPasswordError', status: 422, code: 'weak_password', reasons: ['pwned'] })); });
    expect(document.activeElement).toBe(screen.getByLabelText('New password'));
  });

  it('a wrong current password: focus goes to Current password', async () => {
    const pending = deferred();
    page({ verifyPassword: vi.fn(() => pending.promise) });
    fill();
    pressSave();
    await act(async () => { pending.reject(authError('Wrong', { code: 'wrong_password' })); });
    expect(document.activeElement).toBe(screen.getByLabelText('Current password'));
  });

  it('too many tries, or a failure: focus goes back to Save new password', async () => {
    const pending = deferred();
    page({ verifyPassword: vi.fn(() => pending.promise) });
    fill();
    pressSave();
    await act(async () => { pending.reject(authError('Request rate limit reached', { status: 429, code: 'over_request_rate_limit' })); });
    expect(screen.getByRole('alert').textContent).toBe('Too many tries. Wait a few minutes, then try again.');
    expect(document.activeElement).toBe(save());
    expect(save().disabled).toBe(false);
  });

  it('leaves focus in Confirm new password when Enter was pressed there', async () => {
    page({ updatePassword: vi.fn(async () => { throw authError('same', { status: 422, code: 'same_password' }); }) });
    fill();
    const confirm = screen.getByLabelText('Confirm new password');
    confirm.focus();
    await act(async () => { fireEvent.submit(confirm.closest('form')); });
    expect(document.activeElement).toBe(confirm);
  });

  it('a saved password moves focus to the panel that says so', async () => {
    page();
    fill();
    pressSave();
    await act(async () => {});
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'New password saved' }));
  });
});
