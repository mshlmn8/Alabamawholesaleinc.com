// Which account notices show, and their wording (AW-015, AW-048, AW-336, AW-337, AW-047).
import { describe, expect, it, vi } from 'vitest';
import { accountNotices, signOutMessage } from './accountNotices.js';

const act = () => ({
  signIn: vi.fn(), requestReset: vi.fn(), signOutHere: vi.fn(), retryProfile: vi.fn(), dismissLink: vi.fn(),
  dismissSessionEnded: vi.fn(), dismissConnectionProblem: vi.fn(), dismissSignOut: vi.fn(),
});
const ids = (list) => list.map((n) => n.id);

describe('signOutMessage', () => {
  it('says how the sign-out went', () => {
    expect(signOutMessage({ ok: true, scope: 'local' })).toBe('You’re signed out.');
    expect(signOutMessage({ ok: false, scope: 'local' })).toBe('You’re signed out on this computer.');
    expect(signOutMessage({ ok: true, scope: 'global' })).toMatch(/all your devices/);
    expect(signOutMessage({ ok: false, scope: 'global' })).toMatch(/other devices may still be signed in/);
  });
});

describe('accountNotices', () => {
  it('shows nothing for an ordinary visit', () => {
    expect(accountNotices({ account: 'signed-out' }, act())).toEqual([]);
  });

  it('explains an expired link with a way forward, never Supabase’s text (AW-015)', () => {
    const a = act();
    const [notice] = accountNotices({ linkError: { code: 'otp_expired', network: false, forReset: false } }, a);
    expect(notice).toMatchObject({ id: 'link-error', title: 'That email link has expired or was already used' });
    expect(notice.text).not.toMatch(/password reset link/i);
    expect(notice.actions.map((x) => x.label)).toEqual(['Sign in', 'Reset password']);
    notice.onDismiss();
    expect(a.dismissLink).toHaveBeenCalled();
  });

  it('leaves a reset link’s problem to the reset page', () => {
    expect(accountNotices({ linkError: { code: 'otp_expired', forReset: true } }, act())).toEqual([]);
  });

  it('confirms a sign-up link', () => {
    expect(ids(accountNotices({ linkConfirmed: 'signup' }, act()))).toEqual(['link-confirmed']);
    expect(accountNotices({ linkConfirmed: 'invite' }, act())).toEqual([]);
  });

  it('says when the session ended, with a sign-in (AW-048)', () => {
    const a = act();
    const [notice] = accountNotices({ sessionEnded: true }, a);
    expect(notice.title).toBe('Your session has ended');
    notice.actions[0].onClick();
    expect(a.signIn).toHaveBeenCalled();
  });

  it('offers to sign out when the account service is out of reach (AW-047)', () => {
    const a = act();
    const [notice] = accountNotices({ connectionProblem: true }, a);
    expect(notice.actions[0].label).toBe('Sign out on this computer');
    notice.actions[0].onClick();
    expect(a.signOutHere).toHaveBeenCalled();
    expect(accountNotices({ connectionProblem: true, signingOut: true }, a)[0].actions[0]).toMatchObject({ label: 'Signing out…', disabled: true });
  });

  it('flags a missing profile except on the pages that explain it (AW-089)', () => {
    expect(ids(accountNotices({ account: 'no-profile', routePage: 'quote' }, act()))).toEqual(['no-profile']);
    expect(accountNotices({ account: 'no-profile', routePage: 'account' }, act())).toEqual([]);
    expect(accountNotices({ account: 'no-profile', routePage: 'admin' }, act())).toEqual([]);
  });

  it('shows the sign-out result (AW-336)', () => {
    expect(accountNotices({ signOutText: 'You’re signed out.' }, act())).toMatchObject([{ id: 'signed-out', text: 'You’re signed out.' }]);
  });
});
