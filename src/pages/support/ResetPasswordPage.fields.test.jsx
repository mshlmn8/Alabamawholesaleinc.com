// The new-password form names a short or mismatched password under the field
// it is about, marks it invalid and focuses it (AW-173), instead of one alert
// tied to neither field.
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResetPasswordPage } from './ResetPasswordPage.jsx';

function setup() {
  const auth = {
    session: { user: { id: 'u1', email: 'buyer@example.test' } }, loading: false, recovery: true, linkError: null, linkChecking: false,
    updatePassword: vi.fn(async () => {}), isBackendConfigured: true,
  };
  render(<ResetPasswordPage auth={auth} onRequestReset={vi.fn()} onLoginClick={vi.fn()} />);
  return auth;
}
const byId = (id) => document.getElementById(id);
const type = (id, value) => fireEvent.change(byId(id), { target: { value } });
const save = () => act(async () => { fireEvent.submit(byId('reset-password').closest('form')); });

describe('ResetPasswordPage checks the new password (AW-173)', () => {
  it('names an empty form under both fields and focuses the first', async () => {
    const auth = setup();
    await save();
    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(byId('reset-password-error').textContent).toBe('Choose a password with at least 8 characters.');
    expect(byId('reset-confirm-error').textContent).toBe('Enter the new password again.');
    expect(byId('reset-password').getAttribute('aria-describedby')).toBe('reset-password-hint reset-password-error');
    expect(document.activeElement).toBe(byId('reset-password'));
  });

  it('puts the mismatch under Confirm new password, marked invalid, and saves once they match', async () => {
    const auth = setup();
    type('reset-password', 'new-password-1');
    type('reset-confirm', 'new-password-2');
    await save();
    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(byId('reset-password').hasAttribute('aria-invalid')).toBe(false);
    expect(byId('reset-confirm').getAttribute('aria-invalid')).toBe('true');
    expect(byId('reset-confirm').getAttribute('aria-describedby')).toBe('reset-confirm-error');
    expect(byId('reset-confirm-error').textContent).toBe('The two passwords don’t match.');
    expect(document.activeElement).toBe(byId('reset-confirm'));
    // The page's alert is left for the server's answer.
    expect(document.querySelector('.reset-form p.form-error[role="alert"]').textContent).toBe('');
    type('reset-confirm', 'new-password-1');
    expect(byId('reset-confirm-error').textContent).toBe('');
    await save();
    expect(auth.updatePassword).toHaveBeenCalledWith('new-password-1');
  });
});
