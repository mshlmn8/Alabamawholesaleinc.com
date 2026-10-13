// verifyPassword and updatePassword (AW-349) against a fake Supabase client:
// nothing here talks to a network. A signed-in password change checks the
// current password by signing in again, and every change ends the account's
// sessions on other devices while this browser stays signed in.
import { useEffect } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, SIGN_OUT_TIMEOUT_MS, useAuth } from './auth.jsx';
import { isRateLimitError } from './errors.js';
import { AUTH_REQUEST_TIMEOUT_MS } from './network.js';

function makeSession(token = 'tok-1') {
  return { access_token: token, refresh_token: `r-${token}`, expires_at: 4102444800, user: { id: 'u1', email: 'buyer@example.test' } };
}

const authError = (message, extra) => Object.assign(new Error(message), { name: 'AuthApiError', ...extra });

// Like supabase-js: a sign-in saves a new session and sends SIGNED_IN, a
// failed one keeps the session there was, and scope 'others' leaves this
// browser's session alone and sends nothing.
function fakeClient({ signIn = null, update = null, others = null } = {}) {
  const listeners = new Set();
  let stored = makeSession();
  let signIns = 0;
  const client = {
    profileCalls: 0,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: stored }, error: null })),
      onAuthStateChange: vi.fn((cb) => {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      }),
      signInWithPassword: vi.fn(async (credentials) => {
        const error = typeof signIn === 'function' ? await signIn(credentials) : signIn;
        if (error) return { data: { user: null, session: null }, error };
        signIns += 1;
        stored = makeSession(`tok-${signIns + 1}`);
        listeners.forEach((cb) => cb('SIGNED_IN', stored));
        return { data: { user: stored.user, session: stored }, error: null };
      }),
      updateUser: vi.fn(async () => {
        const error = typeof update === 'function' ? await update() : update;
        if (error) return { data: { user: null }, error };
        listeners.forEach((cb) => cb('USER_UPDATED', stored));
        return { data: { user: stored.user }, error: null };
      }),
      signOut: vi.fn(async ({ scope } = {}) => {
        if (scope === 'others') {
          if (typeof others === 'function') return others();
          return { error: others };
        }
        stored = null;
        listeners.forEach((cb) => cb('SIGNED_OUT', null));
        return { error: null };
      }),
      setSession: vi.fn(),
    },
    from: vi.fn(() => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        abortSignal: () => builder,
        maybeSingle: async () => {
          client.profileCalls += 1;
          return { data: { id: 'u1', status: 'approved' }, error: null };
        },
      };
      return builder;
    }),
  };
  return client;
}

const seen = { auth: null };
function Probe() {
  const auth = useAuth();
  useEffect(() => { seen.auth = auth; });
  return null;
}
// One provider at a time: a test that tries a second client unmounts the first.
async function signedIn(client) {
  cleanup();
  seen.auth = null;
  render(<AuthProvider client={client}><Probe /></AuthProvider>);
  await waitFor(() => expect(seen.auth.account).toBe('ready'));
}

beforeEach(() => {
  window.localStorage.clear();
  seen.auth = null;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('verifyPassword (AW-349)', () => {
  it('signs in again as the signed-in account, which keeps the account and its profile', async () => {
    const client = fakeClient();
    await signedIn(client);
    await act(async () => { await seen.auth.verifyPassword('current-pass-1'); });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'buyer@example.test', password: 'current-pass-1' });
    // A fresh session for the same user; the profile isn't loaded again.
    expect(seen.auth.session.access_token).toBe('tok-2');
    expect(seen.auth.account).toBe('ready');
    expect(seen.auth.sessionEnded).toBe(false);
    expect(client.profileCalls).toBe(1);
  });

  it('says wrong_password for invalid credentials, also from an Auth server without codes', async () => {
    const coded = fakeClient({ signIn: authError('Invalid login credentials', { status: 400, code: 'invalid_credentials' }) });
    await signedIn(coded);
    let caught;
    await act(async () => { caught = await seen.auth.verifyPassword('wrong-pass').catch((e) => e); });
    expect(caught).toBeInstanceOf(Error);
    expect(caught.code).toBe('wrong_password');
    expect(caught.message).toBe('That isn’t the current password for this account.');
    // The session there was is kept.
    expect(seen.auth.session.access_token).toBe('tok-1');
    expect(seen.auth.account).toBe('ready');

    const old = fakeClient({ signIn: authError('Invalid login credentials', { status: 400 }) });
    await signedIn(old);
    await act(async () => { caught = await seen.auth.verifyPassword('wrong-pass').catch((e) => e); });
    expect(caught.code).toBe('wrong_password');
  });

  it('passes rate limits and other errors through as Supabase gave them', async () => {
    const limited = authError('Request rate limit reached', { status: 429, code: 'over_request_rate_limit' });
    const client = fakeClient({ signIn: limited });
    await signedIn(client);
    let caught;
    await act(async () => { caught = await seen.auth.verifyPassword('any-pass').catch((e) => e); });
    expect(caught).toBe(limited);
    expect(isRateLimitError(caught)).toBe(true);

    const other = authError('Something else', { status: 400, code: 'validation_failed' });
    const client2 = fakeClient({ signIn: other });
    await signedIn(client2);
    await act(async () => { caught = await seen.auth.verifyPassword('any-pass').catch((e) => e); });
    expect(caught).toBe(other);
  });
});

describe('updatePassword (AW-349)', () => {
  it('saves the password, then signs out the other devices and keeps this one', async () => {
    const client = fakeClient();
    await signedIn(client);
    let result;
    await act(async () => { result = await seen.auth.updatePassword('new-pass-123'); });
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'new-pass-123' });
    expect(client.auth.signOut).toHaveBeenCalledTimes(1);
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(client.auth.updateUser.mock.invocationCallOrder[0]).toBeLessThan(client.auth.signOut.mock.invocationCallOrder[0]);
    expect(result).toEqual({ othersSignedOut: true });
    expect(seen.auth.session?.user.id).toBe('u1');
    expect(seen.auth.account).toBe('ready');
    expect(seen.auth.sessionEnded).toBe(false);
  });

  it('still succeeds when signing out the other devices fails, and says so', async () => {
    const failed = fakeClient({ others: authError('Internal error', { status: 500 }) });
    await signedIn(failed);
    let result;
    await act(async () => { result = await seen.auth.updatePassword('new-pass-123'); });
    expect(result).toEqual({ othersSignedOut: false });
    expect(seen.auth.account).toBe('ready');

    const threw = fakeClient({ others: () => Promise.reject(new TypeError('Failed to fetch')) });
    await signedIn(threw);
    await act(async () => { result = await seen.auth.updatePassword('new-pass-123'); });
    expect(result).toEqual({ othersSignedOut: false });
    expect(seen.auth.account).toBe('ready');
  });

  it('stops waiting for a sign-out of the other devices that hangs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = fakeClient({ others: () => new Promise(() => {}) });
    await signedIn(client);
    let result;
    await act(async () => {
      const pending = seen.auth.updatePassword('new-pass-123');
      await vi.advanceTimersByTimeAsync(SIGN_OUT_TIMEOUT_MS + 100);
      result = await pending;
    });
    expect(result).toEqual({ othersSignedOut: false });
    expect(seen.auth.account).toBe('ready');
  });

  it('gives up on a save that never answers with code "timeout", and signs nobody out (LEFT-3)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = fakeClient({ update: () => new Promise(() => {}) });
    await signedIn(client);
    let caught;
    await act(async () => {
      const pending = seen.auth.updatePassword('new-pass-123').catch((e) => e);
      await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
      caught = await pending;
    });
    expect(caught).toMatchObject({ name: 'TimeoutError', code: 'timeout' });
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(seen.auth.account).toBe('ready');
  });

  it('signs nobody out when the password could not be saved, or when asked not to', async () => {
    const same = authError('New password should be different from the old password.', { status: 422, code: 'same_password' });
    const client = fakeClient({ update: same });
    await signedIn(client);
    let caught;
    await act(async () => { caught = await seen.auth.updatePassword('new-pass-123').catch((e) => e); });
    expect(caught).toBe(same);
    expect(client.auth.signOut).not.toHaveBeenCalled();

    const quiet = fakeClient();
    await signedIn(quiet);
    let result;
    await act(async () => { result = await seen.auth.updatePassword('new-pass-123', { signOutOthers: false }); });
    expect(quiet.auth.updateUser).toHaveBeenCalledTimes(1);
    expect(quiet.auth.signOut).not.toHaveBeenCalled();
    expect(result).toEqual({ othersSignedOut: false });
  });
});
