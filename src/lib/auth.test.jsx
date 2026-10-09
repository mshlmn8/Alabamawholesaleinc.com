// The AuthProvider (AW-187, AW-186, AW-047, AW-048, AW-337, AW-015) against
// a fake Supabase client: nothing here talks to a network.
import { useEffect } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY } from './supabase.js';
import { accountState, AuthProvider, clearStoredSession, PENDING_PROFILE_POLL_MS, PROFILE_REFRESH_MIN_MS, useAuth } from './auth.jsx';
import { TERMS_VERSION } from '../data/content.js';
import { AUTH_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS } from './network.js';

const retryable = () => Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 });

function makeSession(id = 'u1', email = 'buyer@example.test', token = 'tok-1') {
  return { access_token: token, refresh_token: `r-${id}`, expires_at: 4102444800, user: { id, email } };
}

// A fake supabase client. Events are sent with client.emit(event, session).
function fakeClient({ session = null, getSessionError = null, profiles = {}, signOutResult = { error: null }, setSessionResult } = {}) {
  const listeners = new Set();
  let stored = session;
  const client = {
    stored: () => stored,
    emit: (event, next) => { listeners.forEach((cb) => cb(event, next)); },
    profileCalls: 0,
    auth: {
      getSession: vi.fn(async () => (getSessionError ? { data: { session: null }, error: getSessionError } : { data: { session: stored }, error: null })),
      onAuthStateChange: vi.fn((cb) => {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      }),
      signOut: vi.fn(async () => {
        const result = typeof signOutResult === 'function' ? await signOutResult() : signOutResult;
        if (!result.keep) { stored = null; listeners.forEach((cb) => cb('SIGNED_OUT', null)); }
        return { error: result.error || null };
      }),
      setSession: vi.fn(async (tokens) => {
        if (setSessionResult) return setSessionResult;
        stored = makeSession('u1', 'buyer@example.test', tokens.access_token);
        listeners.forEach((cb) => cb('SIGNED_IN', stored));
        return { data: { session: stored }, error: null };
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
      resend: vi.fn(async () => ({ error: null })),
      updateUser: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(() => {
      const query = { id: null, signal: null };
      const builder = {
        select: () => builder,
        eq: (_col, value) => { query.id = value; return builder; },
        abortSignal: (signal) => { query.signal = signal; return builder; },
        maybeSingle: async () => {
          client.profileCalls += 1;
          const row = typeof profiles[query.id] === 'function' ? profiles[query.id](query) : profiles[query.id];
          if (row === 'error') return { data: null, error: { message: 'boom' } };
          // A request that never answers, but gives up when its signal
          // aborts, as postgrest-js does: an error, not a throw.
          if (row === 'hang') {
            return new Promise((resolve) => {
              query.signal?.addEventListener('abort', () => resolve({ data: null, error: { message: 'TimeoutError: The request took too long.', code: '' } }));
            });
          }
          return { data: row ?? null, error: null };
        },
      };
      return builder;
    }),
  };
  return client;
}

// Several consumers, like App, AuthModal and ApplicationDocuments.
// The provider's value as the main consumer last saw it.
const seen = { auth: null };
function Probe({ id }) {
  const auth = useAuth();
  useEffect(() => { if (id === 'main') seen.auth = auth; });
  return <p data-testid={id}>{`${auth.account}|${auth.profile?.status || '-'}|${auth.session?.user?.id || '-'}`}</p>;
}
const renderWith = (client, link = null, { hadSavedSession = false } = {}) => render(
  <AuthProvider client={client} link={link} hadSavedSession={hadSavedSession}>
    <Probe id="main" /><Probe id="modal" /><Probe id="documents" />
  </AuthProvider>,
);

beforeEach(() => {
  window.localStorage.clear();
  seen.auth = null;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('accountState', () => {
  it('waits for the session and the profile', () => {
    expect(accountState({ loading: true })).toBe('loading');
    expect(accountState({ loading: false, session: null })).toBe('signed-out');
    expect(accountState({ loading: false, session: {}, profileReady: false })).toBe('loading');
    expect(accountState({ loading: false, session: {}, profileReady: true, profile: null })).toBe('no-profile');
    expect(accountState({ loading: false, session: {}, profileReady: true, profile: { id: 1 } })).toBe('ready');
  });
});

describe('AuthProvider', () => {
  it('shares one subscription and one profile request between all consumers (AW-187)', async () => {
    const client = fakeClient({ session: makeSession(), profiles: { u1: { id: 'u1', status: 'pending' } } });
    renderWith(client);
    await waitFor(() => expect(screen.getByTestId('documents').textContent).toBe('ready|pending|u1'));
    expect(screen.getByTestId('modal').textContent).toBe('ready|pending|u1');
    expect(client.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(client.profileCalls).toBe(1);
  });

  it('reports loading until the profile arrives, then the profile (AW-186)', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const client = fakeClient({ session: makeSession(), profiles: {} });
    client.from = vi.fn(() => ({ select() { return this; }, eq() { return this; }, abortSignal() { return this; }, maybeSingle: async () => { await gate; return { data: { id: 'u1', status: 'approved' }, error: null }; } }));
    renderWith(client);
    await waitFor(() => expect(seen.auth.session?.user.id).toBe('u1'));
    expect(seen.auth.account).toBe('loading');
    await act(async () => { release(); });
    await waitFor(() => expect(seen.auth.account).toBe('ready'));
  });

  it('refreshProfile shows an approval without a reload, and a failed refresh keeps the profile (AW-187)', async () => {
    let status = 'pending';
    const client = fakeClient({ session: makeSession(), profiles: { u1: () => (status === 'error' ? 'error' : { id: 'u1', status }) } });
    renderWith(client);
    await waitFor(() => expect(seen.auth.profile?.status).toBe('pending'));
    status = 'approved';
    await act(async () => { await seen.auth.refreshProfile(); });
    expect(seen.auth.profile.status).toBe('approved');
    status = 'error';
    await act(async () => { await seen.auth.refreshProfile(); });
    expect(seen.auth.profile.status).toBe('approved');
    expect(seen.auth.profileError).toBeNull();
  });

  it('loads the profile again when the buyer comes back after a minute, and polls while pending (AW-187)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let status = 'pending';
    const client = fakeClient({ session: makeSession(), profiles: { u1: () => ({ id: 'u1', status }) } });
    renderWith(client);
    await waitFor(() => expect(seen.auth.profile?.status).toBe('pending'));
    expect(document.visibilityState).toBe('visible');
    status = 'approved';
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(client.profileCalls).toBe(1); // too soon after the last load
    vi.setSystemTime(Date.now() + PROFILE_REFRESH_MIN_MS + 1000);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(seen.auth.profile.status).toBe('approved'));
    expect(client.profileCalls).toBe(2);

    // A pending account is checked on a timer while its tab is visible.
    status = 'pending';
    await act(async () => { await seen.auth.refreshProfile(); });
    status = 'approved';
    await act(async () => { await vi.advanceTimersByTimeAsync(PENDING_PROFILE_POLL_MS + 10); });
    await waitFor(() => expect(seen.auth.profile.status).toBe('approved'));
  });

  it('reports a missing profile instead of looking signed out (AW-089)', async () => {
    const client = fakeClient({ session: makeSession(), profiles: {} });
    renderWith(client);
    await waitFor(() => expect(seen.auth.account).toBe('no-profile'));
    expect(seen.auth.profileError).toBe('missing');
    expect(seen.auth.session).not.toBeNull();
  });

  it('gives up on a profile request that never answers, so the page can offer Try again (NEW-013)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let row = 'hang';
    const signals = [];
    const client = fakeClient({ session: makeSession(), profiles: { u1: (query) => { signals.push(query.signal); return row; } } });
    renderWith(client);
    await waitFor(() => expect(seen.auth.session?.user.id).toBe('u1'));
    expect(seen.auth.account).toBe('loading');
    expect(signals[0]?.aborted).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS); });
    expect(signals[0].aborted).toBe(true);
    expect(seen.auth.profileReady).toBe(true);
    expect(seen.auth.profileError).toBe('failed');
    expect(seen.auth.account).toBe('no-profile');
    // A refresh that hangs as well still settles, which frees the next one.
    let result;
    await act(async () => {
      const pending = seen.auth.refreshProfile();
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      result = await pending;
    });
    expect(result).toEqual({ data: null, error: 'failed' });
    expect(client.profileCalls).toBe(2);
    expect(seen.auth.profileRefreshing).toBe(false);
    row = { id: 'u1', status: 'approved' };
    await act(async () => { await seen.auth.refreshProfile(); });
    expect(client.profileCalls).toBe(3);
    expect(seen.auth.account).toBe('ready');
    expect(seen.auth.profileError).toBeNull();
  });

  it('signs out of this browser only by default and says so (AW-337)', async () => {
    const client = fakeClient({ session: makeSession(), profiles: { u1: { id: 'u1', status: 'approved' } } });
    renderWith(client);
    await waitFor(() => expect(seen.auth.account).toBe('ready'));
    let result;
    await act(async () => { result = await seen.auth.signOut(); });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(result).toEqual({ ok: true, scope: 'local' });
    expect(seen.auth.account).toBe('signed-out');
    // Our own sign-out is not a "session ended" (AW-048).
    expect(seen.auth.sessionEnded).toBe(false);
    await act(async () => { result = await seen.auth.signOut({ scope: 'global' }); });
    expect(client.auth.signOut).toHaveBeenLastCalledWith({ scope: 'global' });
  });

  it('clears the saved session even when Supabase cannot be reached (AW-047)', async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, '{"access_token":"x"}');
    window.localStorage.setItem(`${AUTH_STORAGE_KEY}-code-verifier`, 'v');
    window.localStorage.setItem('aw-cart', '{"14":2}');
    const client = fakeClient({ session: makeSession(), profiles: { u1: { id: 'u1', status: 'approved' } }, signOutResult: { error: retryable(), keep: true } });
    renderWith(client);
    await waitFor(() => expect(seen.auth.account).toBe('ready'));
    let result;
    await act(async () => { result = await seen.auth.signOut(); });
    expect(result).toEqual({ ok: false, scope: 'local' });
    expect(seen.auth.session).toBeNull();
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(`${AUTH_STORAGE_KEY}-code-verifier`)).toBeNull();
    expect(window.localStorage.getItem('aw-cart')).toBe('{"14":2}');
  });

  it('finishes a sign-out that Supabase leaves hanging (AW-047)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = fakeClient({ session: makeSession(), profiles: { u1: { id: 'u1', status: 'approved' } }, signOutResult: () => new Promise(() => {}) });
    renderWith(client);
    await waitFor(() => expect(seen.auth.account).toBe('ready'));
    let result;
    await act(async () => {
      const pending = seen.auth.signOut();
      await vi.advanceTimersByTimeAsync(6000);
      result = await pending;
    });
    expect(result).toEqual({ ok: false, scope: 'local' });
    expect(seen.auth.session).toBeNull();
  });

  it('marks a session that ended on its own, and clears the mark on sign-in (AW-048)', async () => {
    const client = fakeClient({ session: makeSession(), profiles: { u1: { id: 'u1', status: 'approved' } } });
    renderWith(client);
    await waitFor(() => expect(seen.auth.account).toBe('ready'));
    act(() => client.emit('SIGNED_OUT', null));
    expect(seen.auth.sessionEnded).toBe(true);
    expect(seen.auth.account).toBe('signed-out');
    act(() => seen.auth.dismissSessionEnded());
    expect(seen.auth.sessionEnded).toBe(false);
    act(() => client.emit('SIGNED_OUT', null));
    act(() => client.emit('SIGNED_IN', makeSession()));
    expect(seen.auth.sessionEnded).toBe(false);
  });

  it('follows a sign-out in another tab through the storage event (AW-047)', async () => {
    const client = fakeClient({ session: makeSession(), profiles: { u1: { id: 'u1', status: 'approved' } } });
    renderWith(client);
    await waitFor(() => expect(seen.auth.account).toBe('ready'));
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: AUTH_STORAGE_KEY, oldValue: '{}', newValue: null })); });
    expect(seen.auth.session).toBeNull();
    expect(seen.auth.sessionEnded).toBe(true);
  });

  it('reports a saved session it cannot refresh as a connection problem, not a sign-out', async () => {
    const client = fakeClient({ getSessionError: retryable() });
    renderWith(client);
    await waitFor(() => expect(seen.auth.loading).toBe(false));
    expect(seen.auth.connectionProblem).toBe(true);
    expect(seen.auth.sessionEnded).toBe(false);
    // Signing out there does not wait for Supabase.
    let result;
    await act(async () => { result = await seen.auth.signOut(); });
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(seen.auth.connectionProblem).toBe(false);
  });

  // A saved session revoked elsewhere ("Sign out of all devices", a password
  // change): supabase-js can't refresh it when the page loads (NEW-046).
  const revoked = () => Object.assign(new Error('Invalid Refresh Token: Refresh Token Not Found'), { name: 'AuthApiError', status: 400, code: 'refresh_token_not_found' });

  it('says a saved session that can no longer be refreshed has ended, when the page loads (NEW-046)', async () => {
    const client = fakeClient({ getSessionError: revoked() });
    renderWith(client, null, { hadSavedSession: true });
    await waitFor(() => expect(seen.auth.loading).toBe(false));
    expect(seen.auth.sessionEnded).toBe(true);
    expect(seen.auth.account).toBe('signed-out');
    expect(seen.auth.connectionProblem).toBe(false);
  });

  it('also when supabase-js sends SIGNED_OUT while it checks the saved session (NEW-046)', async () => {
    const client = fakeClient();
    client.auth.getSession = vi.fn(async () => {
      client.emit('SIGNED_OUT', null);
      return { data: { session: null }, error: null };
    });
    renderWith(client, null, { hadSavedSession: true });
    await waitFor(() => expect(seen.auth.loading).toBe(false));
    expect(seen.auth.sessionEnded).toBe(true);
  });

  it('says nothing to a visitor without a saved session, and a saved one out of reach is a connection problem (NEW-046)', async () => {
    const guest = fakeClient({ getSessionError: revoked() });
    renderWith(guest);
    await waitFor(() => expect(seen.auth.loading).toBe(false));
    expect(seen.auth.sessionEnded).toBe(false);
    expect(seen.auth.account).toBe('signed-out');
    cleanup();

    const offline = fakeClient({ getSessionError: retryable() });
    renderWith(offline, null, { hadSavedSession: true });
    await waitFor(() => expect(seen.auth.loading).toBe(false));
    expect(seen.auth.connectionProblem).toBe(true);
    expect(seen.auth.sessionEnded).toBe(false);
  });

  it('signs a recovery link in once and reports it (AW-015)', async () => {
    const client = fakeClient({ profiles: { u1: { id: 'u1', status: 'approved' } } });
    const link = { kind: 'recovery', type: 'recovery', tokens: { access_token: 'link-token', refresh_token: 'r' }, forReset: true };
    renderWith(client, link);
    expect(seen.auth.linkChecking).toBe(true);
    await waitFor(() => expect(seen.auth.recovery).toBe(true));
    expect(client.auth.setSession).toHaveBeenCalledTimes(1);
    expect(seen.auth.session.access_token).toBe('link-token');
    await act(async () => { await seen.auth.updatePassword('new-password-1'); });
    expect(seen.auth.recovery).toBe(false);
  });

  it('reports a link that no longer works, and a network failure separately', async () => {
    const expired = fakeClient();
    renderWith(expired, { kind: 'error', type: null, tokens: null, code: 'otp_expired', forReset: false });
    await waitFor(() => expect(seen.auth.loading).toBe(false));
    expect(seen.auth.linkError).toEqual({ kind: 'error', code: 'otp_expired', network: false, forReset: false });
    act(() => seen.auth.dismissLink());
    expect(seen.auth.linkError).toBeNull();
  });

  it('reports a link it could not check because of the network', async () => {
    const client = fakeClient({ setSessionResult: { data: { session: null }, error: retryable() } });
    renderWith(client, { kind: 'recovery', type: 'recovery', tokens: { access_token: 'a', refresh_token: 'r' }, forReset: true });
    await waitFor(() => expect(seen.auth.linkError).not.toBeNull());
    expect(seen.auth.linkError).toMatchObject({ network: true, forReset: true });
    expect(seen.auth.recovery).toBe(false);
  });

  it('sends reset emails to /reset-password', async () => {
    const client = fakeClient();
    renderWith(client);
    await waitFor(() => expect(seen.auth.loading).toBe(false));
    await act(async () => { await seen.auth.resetPassword('buyer@example.test'); });
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('buyer@example.test', { redirectTo: `${window.location.origin}/reset-password` });
  });

  it('sends the store address and the consent with the application (AW-092, AW-019)', async () => {
    const client = fakeClient();
    client.auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u9' } }, error: null });
    renderWith(client);
    await waitFor(() => expect(seen.auth.loading).toBe(false));
    const form = {
      email: 'new@example.test', password: 'test-password-1', name: 'New Buyer', business: 'New Store', phone: '205-555-0199',
      license_no: 'TL-TEST', ein: '12-3456789', resale_cert_no: 'RS-TEST', business_type: 'Smoke Shop', state: 'AL',
      expected_volume: '$5K — $15K', store_street: '1 Test Way', store_city: 'Testville', store_zip: '35203',
      terms_accepted: true, age_confirmed: true,
    };
    await act(async () => { await seen.auth.signUp(form); });
    const { email, password, terms_accepted, age_confirmed, ...rest } = form;
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email, password,
      // The confirmation link returns to this site (AW-051).
      options: { emailRedirectTo: `${window.location.origin}/`, data: { ...rest, terms_version: TERMS_VERSION, terms_accepted, age_confirmed } },
    });
    // Boxes that weren't ticked record no consent (the server then stores none).
    await act(async () => { await seen.auth.signUp({ ...form, terms_accepted: undefined, age_confirmed: 'yes' }); });
    expect(client.auth.signUp.mock.calls[1][0].options.data).toMatchObject({ terms_accepted: false, age_confirmed: false });
  });
});

describe('clearStoredSession', () => {
  it('removes only supabase-js keys', () => {
    window.localStorage.setItem('aw-auth', 'x');
    window.localStorage.setItem('aw-auth-user', 'y');
    window.localStorage.setItem('aw-age-verified', 'z');
    clearStoredSession();
    expect(window.localStorage.getItem('aw-auth')).toBeNull();
    expect(window.localStorage.getItem('aw-auth-user')).toBeNull();
    expect(window.localStorage.getItem('aw-age-verified')).toBe('z');
  });
});

// The application's extra answers ride in the sign-up metadata, where the
// signup trigger copies them into profiles (AW-092, AW-019; PR #12).
describe('signUp', () => {
  it('sends the store address, consent and 21+ answers with the application', async () => {
    const client = fakeClient();
    client.auth.signUp = vi.fn(async () => ({ data: { session: null, user: { id: 'u9' } }, error: null }));
    renderWith(client);
    await waitFor(() => expect(seen.auth?.account).toBe('signed-out'));
    await act(async () => {
      await seen.auth.signUp({
        email: 'new@example.test', password: 'test-password-1', name: 'New Buyer', business: 'New Market', phone: '205-000-0009',
        ein: '12-3456789', license_no: 'L-1', resale_cert_no: 'R-1', business_type: 'Convenience Store', state: 'AL',
        expected_volume: 'Under $5K', store_street: '1 Test St', store_city: 'Birmingham', store_zip: '35203',
        terms_accepted: true, terms_version: '2026-09', age_confirmed: true, agreeTerms: true,
      });
    });
    const [{ email, options }] = client.auth.signUp.mock.calls[0];
    expect(email).toBe('new@example.test');
    expect(options.data).toMatchObject({
      store_street: '1 Test St', store_city: 'Birmingham', store_zip: '35203',
      terms_accepted: true, terms_version: '2026-09', age_confirmed: true, license_no: 'L-1',
    });
    // Form-only state does not leave the browser.
    expect(options.data).not.toHaveProperty('agreeTerms');
  });
});

// Sign-in and the auth emails give up after AUTH_REQUEST_TIMEOUT_MS (AW-194).
describe('auth time limits', () => {
  it('rejects a stalled sign-in with code "timeout", and a late answer still signs the buyer in', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = fakeClient({ profiles: { u1: { id: 'u1', status: 'pending' } } });
    let answer;
    client.auth.signInWithPassword.mockImplementation(() => new Promise((resolve) => { answer = resolve; }));
    renderWith(client);
    await waitFor(() => expect(seen.auth?.account).toBe('signed-out'));
    let caught;
    await act(async () => {
      const pending = seen.auth.signIn({ email: 'buyer@example.test', password: 'test-password-1' }).catch((e) => e);
      await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
      caught = await pending;
    });
    expect(caught).toMatchObject({ name: 'TimeoutError', code: 'timeout' });
    // Supabase answers after all: the session arrives like one from another tab.
    await act(async () => {
      answer({ data: { session: makeSession() }, error: null });
      client.emit('SIGNED_IN', makeSession());
    });
    await waitFor(() => expect(seen.auth.account).toBe('ready'));
    expect(seen.auth.session.user.id).toBe('u1');
  });

  it('gives the application, the reset email and the confirmation email the same limit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = fakeClient();
    const stall = () => new Promise(() => {});
    client.auth.signUp.mockImplementation(stall);
    client.auth.resetPasswordForEmail.mockImplementation(stall);
    client.auth.resend.mockImplementation(stall);
    renderWith(client);
    await waitFor(() => expect(seen.auth?.account).toBe('signed-out'));
    for (const run of [
      () => seen.auth.signUp({ email: 'new@example.test', password: 'test-password-1' }),
      () => seen.auth.resetPassword('buyer@example.test'),
      () => seen.auth.resendConfirmation('buyer@example.test'),
    ]) {
      let caught;
      await act(async () => {
        const pending = run().catch((e) => e);
        await vi.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
        caught = await pending;
      });
      expect(caught?.code).toBe('timeout');
    }
  });
});

// A new confirmation email also returns to this site (AW-051, Cursor PR #13).
describe('resendConfirmation', () => {
  it('asks for a link back to this site', async () => {
    const client = fakeClient();
    renderWith(client);
    await waitFor(() => expect(seen.auth?.account).toBe('signed-out'));
    await act(async () => { await seen.auth.resendConfirmation('new@example.test'); });
    expect(client.auth.resend).toHaveBeenCalledWith({
      type: 'signup', email: 'new@example.test', options: { emailRedirectTo: `${window.location.origin}/` },
    });
  });
});

// The saved session is noted as the module loads, before supabase-js can
// refresh it and clear a revoked one (NEW-046).
describe('BOOT_HAD_SESSION (NEW-046)', () => {
  afterEach(() => {
    vi.doUnmock('./supabase.js');
    vi.resetModules();
  });

  it('is read when auth.jsx loads', async () => {
    // No real client here: it would try to refresh the saved session.
    vi.doMock('./supabase.js', () => ({ supabase: null, AUTH_STORAGE_KEY, isBackendConfigured: false }));
    window.localStorage.setItem(AUTH_STORAGE_KEY, '{"access_token":"x"}');
    vi.resetModules();
    const saved = await import('./auth.jsx');
    // Cleared later (supabase-js removing a revoked session): still noted.
    window.localStorage.clear();
    expect(saved.BOOT_HAD_SESSION).toBe(true);
    vi.resetModules();
    const none = await import('./auth.jsx');
    expect(none.BOOT_HAD_SESSION).toBe(false);
  });
});
