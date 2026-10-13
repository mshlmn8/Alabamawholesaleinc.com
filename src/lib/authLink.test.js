// Supabase email links (AW-015): read once, removed from the address, and
// only a recovery link opens the new-password page.
import { afterEach, describe, expect, it } from 'vitest';
import { parseAuthLink, takeAuthLink } from './authLink.js';

const TOKENS = 'access_token=aaa.bbb.ccc&expires_at=1900000000&expires_in=3600&refresh_token=rt1&token_type=bearer';

describe('parseAuthLink', () => {
  it('ignores addresses without an auth link', () => {
    for (const hash of ['', '#', '#new-arrivals', '#/category/TOBACCO', '#dept-tobacco']) {
      expect(parseAuthLink({ pathname: '/', search: '', hash })).toBeNull();
    }
    expect(parseAuthLink({ pathname: '/category/tobacco', search: '?q=kite&sort=name-asc', hash: '' })).toBeNull();
  });

  it('sends a recovery link to /reset-password with its tokens', () => {
    const link = parseAuthLink({ pathname: '/', hash: `#${TOKENS}&type=recovery` });
    expect(link).toMatchObject({ kind: 'recovery', type: 'recovery', forReset: true, cleanUrl: '/reset-password' });
    expect(link.tokens).toEqual({ access_token: 'aaa.bbb.ccc', refresh_token: 'rt1' });
    expect(parseAuthLink({ pathname: '/reset-password', hash: `#${TOKENS}&type=recovery` }).cleanUrl).toBe('/reset-password');
  });

  it('keeps other signed-in links on the page they opened', () => {
    const link = parseAuthLink({ pathname: '/', hash: `#${TOKENS}&type=signup` });
    expect(link).toMatchObject({ kind: 'session', type: 'signup', forReset: false, cleanUrl: '/' });
    expect(parseAuthLink({ pathname: '/catalog', search: '?x=1', hash: `#${TOKENS}&type=invite` }).cleanUrl).toBe('/catalog?x=1');
  });

  it('reports an expired link by its code only, on the page it opened', () => {
    const link = parseAuthLink({ pathname: '/', hash: '#error=access_denied&error_code=otp_expired&error_description=Call+555+now' });
    expect(link).toEqual({ kind: 'error', type: null, tokens: null, code: 'otp_expired', forReset: false, cleanUrl: '/' });
    expect(JSON.stringify(link)).not.toMatch(/555/);
  });

  it('treats an error that arrives at /reset-password as a reset link', () => {
    const link = parseAuthLink({ pathname: '/reset-password', hash: '#error=access_denied&error_code=otp_expired' });
    expect(link).toMatchObject({ kind: 'error', forReset: true, cleanUrl: '/reset-password' });
  });

  it('reads errors from the query string and keeps the other parameters', () => {
    const link = parseAuthLink({ pathname: '/', search: '?utm=mail&error=access_denied&error_code=otp_expired&error_description=x', hash: '' });
    expect(link).toMatchObject({ kind: 'error', code: 'otp_expired', cleanUrl: '/?utm=mail' });
  });

  it('treats a link cut short as an invalid link, never as a session', () => {
    expect(parseAuthLink({ pathname: '/', hash: '#access_token=aaa&type=recovery' })).toMatchObject({ kind: 'error', code: 'incomplete_link', forReset: true, tokens: null });
  });

  it('keeps an old #/ route in front of the auth fragment for the legacy redirect', () => {
    const link = parseAuthLink({ pathname: '/', hash: `#/account#${TOKENS}&type=signup` });
    expect(link).toMatchObject({ kind: 'session', cleanUrl: '/#/account' });
    expect(parseAuthLink({ pathname: '/', hash: `#/reset-password#${TOKENS}&type=recovery` }).cleanUrl).toBe('/reset-password');
    expect(parseAuthLink({ pathname: '/', hash: '#/reset-password#error=access_denied&error_code=otp_expired' })).toMatchObject({ forReset: true, cleanUrl: '/reset-password' });
  });
});

describe('takeAuthLink', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('removes the tokens from the address and the history entry', () => {
    window.history.replaceState({ keep: 1 }, '', `/#${TOKENS}&type=recovery`);
    const before = window.history.length;
    const link = takeAuthLink();
    expect(link.kind).toBe('recovery');
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/reset-password');
    expect(window.history.length).toBe(before);
    expect(window.history.state).toEqual({ keep: 1 });
  });

  it('leaves an ordinary address alone', () => {
    window.history.replaceState(null, '', '/category/tobacco?q=kite#dept-tobacco');
    expect(takeAuthLink()).toBeNull();
    expect(window.location.href).toMatch(/\/category\/tobacco\?q=kite#dept-tobacco$/);
  });
});
