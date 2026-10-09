// /reset-password as one state (AW-255): which view shows, in the order the
// page has always checked them, and the head and title each view gets.
import { describe, expect, it } from 'vitest';
import { RESET_HEADS, RESET_VIEWS, resetHead, resetTitle, resetView } from './resetView.js';

const SESSION = { user: { id: 'u1', email: 'buyer@example.test' } };
const BASE = { isBackendConfigured: true, done: false, session: null, loading: false, linkChecking: false, linkError: null };
const view = (over) => resetView({ ...BASE, ...over });

describe('resetView', () => {
  it('names each state', () => {
    expect(view({ isBackendConfigured: false })).toBe('unavailable');
    expect(view({ done: true, session: SESSION })).toBe('done');
    expect(view({ linkChecking: true })).toBe('checking');
    expect(view({ loading: true })).toBe('checking');
    expect(view({ session: SESSION })).toBe('form');
    expect(view({ linkError: { code: 'otp_expired', forReset: true } })).toBe('link-invalid');
    expect(view({})).toBe('request');
  });

  it('checks them in order', () => {
    // No backend wins over everything.
    expect(view({ isBackendConfigured: false, done: true, session: SESSION, linkChecking: true })).toBe('unavailable');
    // A saved password stays done, even while a refresh is loading.
    expect(view({ done: true, session: SESSION, loading: true, linkChecking: true })).toBe('done');
    // Done needs the session: signed out, it is the signed-out view.
    expect(view({ done: true })).toBe('request');
    // A link being checked is never the form, even with a saved session.
    expect(view({ linkChecking: true, session: SESSION })).toBe('checking');
    // A saved session that is still loading shows the form once it is there.
    expect(view({ loading: true, session: SESSION })).toBe('form');
    // A session beats an error from an earlier link.
    expect(view({ session: SESSION, linkError: { forReset: true } })).toBe('form');
    // An email link that wasn't for the reset page is a notice, not this page's state.
    expect(view({ linkError: { code: 'otp_expired', forReset: false } })).toBe('request');
  });
});

describe('resetHead and resetTitle', () => {
  it('has a head and a title for every view, and an intro only where it helps', () => {
    for (const name of RESET_VIEWS) {
      expect(RESET_HEADS[name], name).toMatchObject({ eyebrow: expect.any(String), h1: expect.any(String), title: expect.any(String) });
    }
    expect(Object.keys(RESET_HEADS).sort()).toEqual([...RESET_VIEWS].sort());
    expect(RESET_VIEWS.filter((name) => RESET_HEADS[name].intro)).toEqual(['form', 'request']);
  });

  it('asks for a new password only where the form is', () => {
    const asking = RESET_VIEWS.filter((name) => /new password/i.test(`${RESET_HEADS[name].h1} ${RESET_HEADS[name].intro || ''}`));
    expect(asking).toEqual(['form']);
    expect(RESET_HEADS.form.intro).toBe('Pick a password of at least 8 characters that you don’t use anywhere else.');
    expect(RESET_HEADS.form.intro).not.toMatch(/stays signed in/);
  });

  it('names what each view shows', () => {
    expect(resetHead('request')).toMatchObject({ h1: 'Reset your password', title: 'Reset Password' });
    expect(resetHead('unavailable')).toMatchObject({ h1: 'Reset your password', intro: null });
    expect(resetHead('checking', { linkChecking: true })).toMatchObject({ h1: 'Checking your reset link', intro: null });
    expect(resetHead('checking')).toMatchObject({ h1: 'Loading your account', intro: null });
    expect(resetHead('form')).toMatchObject({ h1: 'Choose a new password' });
    expect(resetHead('done')).toMatchObject({ h1: 'Password updated', intro: null, title: 'Password Updated' });
    expect(resetHead('link-invalid')).toMatchObject({ h1: 'Link not valid', intro: null, title: 'Reset Link Not Valid' });
    expect(resetHead('mystery')).toEqual(RESET_HEADS.request);
  });

  it('titles the page by the view, and as first seen without one', () => {
    expect(resetTitle('done')).toBe('Password Updated');
    expect(resetTitle('link-invalid')).toBe('Reset Link Not Valid');
    for (const name of ['unavailable', 'request', 'checking', 'form']) expect(resetTitle(name)).toBe('Reset Password');
    expect(resetTitle(undefined)).toBe('Reset Password');
    expect(resetTitle('mystery')).toBe('Reset Password');
  });
});
