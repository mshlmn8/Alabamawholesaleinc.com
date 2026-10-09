// The account dialog's forms check themselves before they send (AW-173):
// sign-in, the application and the reset email name what is missing or
// mistyped under each field, mark it invalid and focus the first. A separate
// file from AuthModal.test.jsx, which other changes edit.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../lib/auth.jsx';
import { AuthModal } from './AuthModal.jsx';

function setup(initialMode, overrides = {}) {
  const value = {
    session: null, loading: false, profile: null, profileReady: false, profileRefreshing: false, isBackendConfigured: true,
    signIn: vi.fn(async () => {}), signUp: vi.fn(async () => ({ session: null })), resetPassword: vi.fn(async () => {}),
    resendConfirmation: vi.fn(async () => {}), refreshProfile: vi.fn(async () => null),
    ...overrides,
  };
  render(
    <AuthContext.Provider value={value}>
      <AuthModal open initialMode={initialMode} onClose={vi.fn()} onSignOut={vi.fn()} />
    </AuthContext.Provider>,
  );
  return value;
}
const byId = (id) => document.getElementById(id);
const submitFormOf = (id) => act(async () => { fireEvent.submit(byId(id).closest('form')); });

describe('AuthModal forms check themselves (AW-173)', () => {
  it('sign-in: names the empty fields, focuses the email and does not call signIn', async () => {
    const auth = setup('signin');
    await submitFormOf('aw-email');
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(byId('aw-email-error').textContent).toBe('Enter business email.');
    expect(byId('aw-pass-error').textContent).toBe('Enter password.');
    expect(byId('aw-email').getAttribute('aria-invalid')).toBe('true');
    expect(byId('aw-email').getAttribute('aria-describedby')).toBe('aw-email-error');
    expect(document.activeElement).toBe(byId('aw-email'));
    // The dialog's own alert stays for the server's answer.
    expect(document.querySelector('.dialog p.form-error[role="alert"]').textContent).toBe('');

    fireEvent.change(byId('aw-email'), { target: { value: 'buyer.example.test' } });
    fireEvent.change(byId('aw-pass'), { target: { value: 'test-password-1' } });
    await submitFormOf('aw-email');
    expect(byId('aw-email-error').textContent).toBe('Enter an email address, for example name@yourstore.com.');
    expect(byId('aw-pass-error').textContent).toBe('');
    expect(auth.signIn).not.toHaveBeenCalled();
    fireEvent.change(byId('aw-email'), { target: { value: 'buyer@example.test' } });
    await submitFormOf('aw-email');
    expect(auth.signIn).toHaveBeenCalledWith({ email: 'buyer@example.test', password: 'test-password-1' });
  });

  it('application: says all fields are required unless marked optional, and names each missing one', async () => {
    const auth = setup('application');
    const note = document.querySelector('.dialog .form-note');
    expect(note.textContent).toBe('All fields are required unless marked optional.');
    await submitFormOf('aw-su-name');
    expect(auth.signUp).not.toHaveBeenCalled();
    // Sentences with a period; the phone, license and resale fields say
    // what to enter in their own words, not from a label like 'Phone' or
    // 'Resale certificate #' (NEW-069).
    const expected = {
      'aw-su-name': 'Enter your name.',
      'aw-su-business': 'Enter business name.',
      'aw-su-email': 'Enter business email.',
      'aw-su-phone': 'Enter a phone number.',
      'aw-su-pass': 'Enter password.',
      'aw-su-ein': 'Enter federal EIN.',
      'aw-su-street': 'Enter store street address.',
      'aw-su-city': 'Enter city.',
      'aw-su-zip': 'Enter ZIP.',
      'aw-su-license': 'Enter the state tobacco license number.',
      'aw-su-resale': 'Enter the resale certificate number.',
      'aw-su-terms': 'Check this box to continue.',
      'aw-su-age': 'Check this box to continue.',
    };
    for (const [id, message] of Object.entries(expected)) {
      expect(byId(id).getAttribute('aria-invalid'), id).toBe('true');
      expect(byId(`${id}-error`).textContent, id).toBe(message);
    }
    // Hints stay first in the description.
    expect(byId('aw-su-ein').getAttribute('aria-describedby')).toBe('aw-su-ein-hint aw-su-ein-error');
    expect(document.activeElement).toBe(byId('aw-su-name'));
    // The consent boxes keep their running-text labels, with the message under them.
    expect(screen.getByRole('checkbox', { name: 'I am 21 or older' })).toBe(byId('aw-su-age'));
    expect(byId('aw-su-age').parentElement.nextElementSibling).toBe(byId('aw-su-age-error'));
  });

  it('application: a mistyped EIN shows its format, not the browser’s bubble', async () => {
    setup('application');
    fireEvent.change(byId('aw-su-ein'), { target: { value: 'abc' } });
    await submitFormOf('aw-su-ein');
    expect(byId('aw-su-ein-error').textContent).toBe('Enter the 9-digit EIN, for example 12-3456789.');
    expect(byId('aw-su-ein').getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(byId('aw-su-ein'), { target: { value: '12-3456789' } });
    expect(byId('aw-su-ein-error').textContent).toBe('');
    expect(byId('aw-su-ein').hasAttribute('aria-invalid')).toBe(false);
  });

  it('reset: asks for the email before sending a link', async () => {
    const auth = setup('reset');
    await submitFormOf('aw-reset-email');
    expect(auth.resetPassword).not.toHaveBeenCalled();
    expect(byId('aw-reset-email-error').textContent).toBe('Enter business email.');
    expect(document.activeElement).toBe(byId('aw-reset-email'));
    fireEvent.change(byId('aw-reset-email'), { target: { value: 'buyer@example.test' } });
    await submitFormOf('aw-reset-email');
    expect(auth.resetPassword).toHaveBeenCalledWith('buyer@example.test');
  });
});
