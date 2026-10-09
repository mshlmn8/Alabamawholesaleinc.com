// /reset-password asks a signed-in account for its current password before a
// new one is saved, unless a reset link opened it, and says whether the
// account's other devices were signed out (AW-349).
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResetPasswordPage } from './ResetPasswordPage.jsx';

const SESSION = { access_token: 'tok', user: { id: 'u1', email: 'buyer@example.test' } };
const authError = (message, extra) => Object.assign(new Error(message), extra);

function page(overrides = {}) {
  const auth = {
    session: SESSION,
    loading: false,
    recovery: false,
    linkError: null,
    linkChecking: false,
    isBackendConfigured: true,
    verifyPassword: vi.fn(async () => {}),
    updatePassword: vi.fn(async () => ({ othersSignedOut: true })),
    ...overrides,
  };
  const onRequestReset = vi.fn();
  render(<ResetPasswordPage auth={auth} onRequestReset={onRequestReset} onLoginClick={vi.fn()} />);
  return { auth, onRequestReset };
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
function fill({ current = 'old-pass-1', password = 'new-pass-123', confirm = password } = {}) {
  if (current !== null) type('Current password', current);
  type('New password', password);
  type('Confirm new password', confirm);
  fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
}

describe('ResetPasswordPage, signed in without a reset link (AW-349)', () => {
  it('asks for the current password first, and offers a reset email instead', () => {
    const { onRequestReset } = page();
    const fields = [...document.querySelectorAll('.reset-form input')].map((input) => input.id);
    expect(fields).toEqual(['reset-current', 'reset-password', 'reset-confirm']);
    const current = screen.getByLabelText('Current password');
    expect(current.type).toBe('password');
    expect(current.getAttribute('autocomplete')).toBe('current-password');
    expect(current.required).toBe(true);
    expect(current.hasAttribute('aria-invalid')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot it? Email me a reset link' }));
    expect(onRequestReset).toHaveBeenCalledTimes(1);
  });

  it('checks the new password locally before it checks the current one', async () => {
    const { auth } = page();
    fill({ password: 'short' });
    expect(screen.getByRole('alert').textContent).toBe('Choose a password with at least 8 characters.');
    fill({ password: 'new-pass-123', confirm: 'new-pass-124' });
    expect(screen.getByRole('alert').textContent).toBe('The two passwords don’t match.');
    expect(auth.verifyPassword).not.toHaveBeenCalled();
    expect(auth.updatePassword).not.toHaveBeenCalled();
  });

  it('saves nothing when the current password is wrong, and points at that field', async () => {
    const wrong = authError('That isn’t the current password for this account.', { code: 'wrong_password' });
    const { auth } = page({ verifyPassword: vi.fn(async () => { throw wrong; }) });
    fill({ current: 'not-it' });
    const current = screen.getByLabelText('Current password');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('That isn’t the current password for this account.'));
    expect(auth.verifyPassword).toHaveBeenCalledWith('not-it');
    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(current.getAttribute('aria-invalid')).toBe('true');
    expect(current.getAttribute('aria-describedby')).toBe('reset-error');
    expect(screen.getByRole('alert').id).toBe('reset-error');
    expect(document.activeElement).toBe(current);
    // Typing again clears the mark.
    type('Current password', 'old-pass-1');
    expect(current.hasAttribute('aria-invalid')).toBe(false);
  });

  it('asks to wait after too many tries', async () => {
    const limited = authError('Request rate limit reached', { status: 429, code: 'over_request_rate_limit' });
    const { auth } = page({ verifyPassword: vi.fn(async () => { throw limited; }) });
    fill();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Too many tries. Wait a few minutes, then try again.'));
    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current password').hasAttribute('aria-invalid')).toBe(false);
  });

  it('checks the current password, then saves, and says the other devices were signed out', async () => {
    const { auth } = page();
    fill();
    await screen.findByRole('heading', { name: 'Password updated' });
    expect(auth.verifyPassword).toHaveBeenCalledWith('old-pass-1');
    expect(auth.updatePassword).toHaveBeenCalledWith('new-pass-123');
    expect(auth.verifyPassword.mock.invocationCallOrder[0]).toBeLessThan(auth.updatePassword.mock.invocationCallOrder[0]);
    expect(screen.getByText('Other devices signed in to this account have been signed out.')).toBeTruthy();
  });

  it('says when the other devices could not be signed out, and where to do it', async () => {
    page({ updatePassword: vi.fn(async () => ({ othersSignedOut: false })) });
    fill();
    await screen.findByRole('heading', { name: 'Password updated' });
    expect(screen.getByText('We couldn’t sign out your other devices. To be sure, use Sign out of all devices on your account page.')).toBeTruthy();
    expect(screen.queryByText('Other devices signed in to this account have been signed out.')).toBeNull();
  });

  it('asks for a different password when the new one is the current one', async () => {
    const same = authError('New password should be different from the old password.', { status: 422, code: 'same_password' });
    page({ updatePassword: vi.fn(async () => { throw same; }) });
    fill({ current: 'new-pass-123' });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Choose a password that’s different from your current one.'));
    expect(screen.queryByRole('heading', { name: 'Password updated' })).toBeNull();
  });
});

describe('ResetPasswordPage, opened by a reset link (AW-349)', () => {
  it('has no current-password field, saves straight away and still signs out the other devices', async () => {
    const { auth } = page({ recovery: true });
    expect(screen.queryByLabelText('Current password')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Forgot it? Email me a reset link' })).toBeNull();
    expect(screen.getByText('RESET LINK CONFIRMED')).toBeTruthy();
    fill({ current: null });
    await screen.findByRole('heading', { name: 'Password updated' });
    expect(auth.verifyPassword).not.toHaveBeenCalled();
    expect(auth.updatePassword).toHaveBeenCalledWith('new-pass-123');
    expect(screen.getByText('Other devices signed in to this account have been signed out.')).toBeTruthy();
  });
});
