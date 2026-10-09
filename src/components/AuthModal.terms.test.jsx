// The application dialog's words and lists (AW-131, AW-282): the one apply
// label as its title, links that let anyone with an account sign in, every
// US state with a note for stores off the delivery routes, volume options
// with the site's dash, 'Submitting…', and the fine print only on the form.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../lib/auth.jsx';
import { US_STATES } from '../data/usStates.js';
import { AuthModal } from './AuthModal.jsx';

function setup(initialMode = 'signin', overrides = {}) {
  const value = {
    session: null, loading: false, profile: null, profileReady: false, profileRefreshing: false, isBackendConfigured: true,
    signIn: vi.fn(async () => {}), signUp: vi.fn(async () => ({ session: null })), resetPassword: vi.fn(async () => {}),
    resendConfirmation: vi.fn(async () => {}), refreshProfile: vi.fn(async () => null), ...overrides,
  };
  render(
    <AuthContext.Provider value={value}>
      <AuthModal initialMode={initialMode} onClose={vi.fn()} onSignOut={vi.fn()} />
    </AuthContext.Provider>,
  );
  return value;
}
const title = () => document.getElementById('auth-title').textContent;
// A US phone number, which the application checks before sending (AW-091).
const typePhone = () => fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '205-555-0199' } });
const fine = () => screen.queryByText(/^21\+ licensed businesses only\./);

describe('AuthModal labels (AW-131, AW-282)', () => {
  it('titles the checklist and the form with the apply label, and links both ways', () => {
    setup('signin');
    expect(title()).toBe('Sign in');
    fireEvent.click(screen.getByRole('button', { name: 'New here? Apply for a trade account' }));
    expect(title()).toBe('Apply for a trade account');
    expect(document.querySelector('.desc').textContent)
      .toBe('Alabama Wholesale sells exclusively to licensed retail businesses. Have these on hand before you start. The application takes a few minutes.');
    fireEvent.click(screen.getByRole('button', { name: 'Continue to the application' }));
    expect(title()).toBe('Apply for a trade account');
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    expect(title()).toBe('Sign in');
    expect(screen.queryByText(/Already approved|No account\?|Apply for an account/)).toBeNull();
  });

  it('shows the 21+ fine print on the application form only', () => {
    setup('application');
    expect(fine()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the checklist' }));
    expect(fine()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Already have an account? Sign in' }));
    expect(fine()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(title()).toBe('Reset your password');
    expect(fine()).toBeNull();
  });

  it('says Submitting… while the application is sent', async () => {
    let finish;
    setup('application', { signUp: vi.fn(() => new Promise((resolve) => { finish = resolve; })) });
    typePhone();
    act(() => { fireEvent.submit(screen.getByLabelText('Your name').closest('form')); });
    expect(screen.getByRole('button', { name: 'Submitting…' }).disabled).toBe(true);
    expect(screen.queryByText('Creating…')).toBeNull();
    await act(async () => { finish({ session: null }); });
    expect(title()).toBe('Check your inbox');
  });
});

describe('AuthModal store state and volume (AW-282)', () => {
  const state = () => screen.getByLabelText('Store state');
  const hint = () => document.getElementById('aw-su-state-hint');

  it('lists every state by name and stores its code, Alabama first', () => {
    setup('application');
    // After the Select… option nobody can pick back (AW-091).
    const [choose, ...options] = [...state().options];
    expect([choose.value, choose.textContent, choose.disabled]).toEqual(['', 'Select…', true]);
    expect(options.map((o) => o.value)).toEqual(US_STATES.map((s) => s.code));
    expect(options.map((o) => o.textContent)).toEqual(US_STATES.map((s) => s.name));
    expect(options.map((o) => o.value)).not.toContain('Other');
    expect(state().value).toBe('');
  });

  it('tells a store off the delivery routes to ask the trade desk, tied to the field', () => {
    setup('application');
    expect(hint()).toBeNull();
    expect(state().hasAttribute('aria-describedby')).toBe(false);
    fireEvent.change(state(), { target: { value: 'TN' } });
    expect(hint().textContent).toBe('Our delivery routes cover Alabama, Mississippi and Georgia. For a store in Tennessee, ask the trade desk how orders would reach you.');
    expect(state().getAttribute('aria-describedby')).toBe('aw-su-state-hint');
    for (const code of ['MS', 'GA', 'AL']) {
      fireEvent.change(state(), { target: { value: code } });
      expect(hint()).toBeNull();
    }
  });

  it('says nothing while no state is chosen (an empty default, AW-091)', () => {
    setup('application');
    fireEvent.change(state(), { target: { value: 'TX' } });
    expect(hint()).toBeTruthy();
    fireEvent.change(state(), { target: { value: '' } });
    expect(hint()).toBeNull();
    expect(state().hasAttribute('aria-describedby')).toBe(false);
  });

  it('sends the chosen code, and the volume as it was stored before', async () => {
    const value = setup('application');
    fireEvent.change(state(), { target: { value: 'TX' } });
    const volume = screen.getByLabelText('Expected monthly volume');
    const options = [...volume.options].slice(1);
    expect(options.map((o) => o.textContent)).toEqual(['Under $5K', '$5K–$15K', '$15K–$50K', '$50K–$100K', '$100K+']);
    expect(options.map((o) => o.value)).toEqual(['Under $5K', '$5K — $15K', '$15K — $50K', '$50K — $100K', '$100K+']);
    // Empty until chosen (AW-091).
    expect(volume.value).toBe('');
    fireEvent.change(volume, { target: { value: '$50K — $100K' } });
    typePhone();
    await act(async () => { fireEvent.submit(screen.getByLabelText('Your name').closest('form')); });
    expect(value.signUp).toHaveBeenCalledWith(expect.objectContaining({ state: 'TX', expected_volume: '$50K — $100K' }));
  });
});
