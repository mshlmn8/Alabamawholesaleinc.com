// Accounts for the whole app (AW-187). One AuthProvider, mounted in main.jsx,
// holds the Supabase session and the signed-in account's profile; every
// component reads them with useAuth(). (Each useAuth() used to be its own
// copy, with its own onAuthStateChange subscription and profile request, and
// the profile never refreshed.)
//
// useAuth() returns:
//   session, user        the Supabase session and its user (null when signed out)
//   loading              true until the saved session, and any email link, are checked
//   profile              the account's profiles row, or null
//   profileReady         the profile request for this user has finished, ok or not
//   profileError         null, 'missing' (no row) or 'failed' (the request failed)
//   profileRefreshing    a refresh is running; the profile on screen stays meanwhile
//   account              'loading' | 'signed-out' | 'no-profile' | 'ready' (accountState)
//   refreshProfile()     loads the profile again. It also runs when the tab comes
//                        back into view (at most once a minute) and every few
//                        minutes while the account is pending, so an approval
//                        shows without a reload.
//   sessionEnded         the session ended without a sign-out in this tab: it
//                        expired or was revoked, or the buyer signed out in
//                        another tab (AW-048)
//   connectionProblem    a saved session could not be refreshed because
//                        Supabase could not be reached; supabase-js keeps trying
//   signOut({ scope })   'local' (the default) ends this browser's session only,
//                        'global' every device's (AW-337). The saved session is
//                        cleared even when Supabase cannot be reached (AW-047).
//                        Resolves to { ok, scope }; ok is false when Supabase
//                        could not confirm it.
//   signIn, signUp, resetPassword, resendConfirmation, updatePassword
//   recovery, linkError, linkChecking, linkConfirmed, dismissLink
//                        the email link the page was opened with (AW-015,
//                        src/lib/authLink.js)
//   dismissSessionEnded, dismissConnectionProblem, isBackendConfigured
//
// Other tabs stay in step: supabase-js broadcasts sign-in, refresh and
// sign-out, and a 'storage' listener covers a session cleared here without
// Supabase (the offline sign-out) and browsers without BroadcastChannel.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase as defaultClient, AUTH_STORAGE_KEY } from './supabase.js';
import { RESET_PASSWORD_PATH } from './authLink.js';

const UNAVAILABLE = 'Account access is temporarily unavailable. Please call or email the trade desk.';

// A profile older than this is loaded again when the tab comes back into view.
export const PROFILE_REFRESH_MIN_MS = 60 * 1000;
// How often a pending account's profile is checked while its tab is visible.
export const PENDING_PROFILE_POLL_MS = 5 * 60 * 1000;
// After this long without an answer about the saved session, pages stop
// waiting and show the connection notice.
export const AUTH_CHECK_TIMEOUT_MS = 8000;
// Sign Out waits this long for Supabase, then finishes on this computer
// anyway. (Offline, supabase-js retries a token refresh for up to 30 s first.)
export const SIGN_OUT_TIMEOUT_MS = 5000;

const EMPTY_PROFILE = Object.freeze({ for: null, data: null, error: null, refreshing: false });

// Network failures (offline, blocked, a captive portal) as opposed to answers.
export const isRetryableAuthError = (error) => error?.name === 'AuthRetryableFetchError'
  || /failed to fetch|network|load failed/i.test(error?.message || '');

// What account pages should show.
export function accountState({ loading, session, profileReady, profile }) {
  if (loading) return 'loading';
  if (!session) return 'signed-out';
  if (!profileReady) return 'loading';
  return profile ? 'ready' : 'no-profile';
}

function localStore() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// True when supabase-js has a session saved in this browser.
export function hasStoredSession(storage = localStore()) {
  try {
    return !!storage?.getItem(AUTH_STORAGE_KEY);
  } catch {
    return false;
  }
}

// The user id of the session supabase-js has saved in this browser, or null.
// Read before that session is checked, so the cart can show the right
// account's lines from the first render (AW-189); it grants nothing.
export function savedSessionUserId(storage = localStore()) {
  try {
    const id = JSON.parse(storage?.getItem(AUTH_STORAGE_KEY) || 'null')?.user?.id;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}

// Removes the saved session and supabase-js's helper keys ('aw-auth-…').
export function clearStoredSession(storage = localStore()) {
  if (!storage) return;
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key === AUTH_STORAGE_KEY || key?.startsWith(`${AUTH_STORAGE_KEY}-`)) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // Storage blocked: nothing was saved.
  }
}

async function fetchProfile(client, id) {
  try {
    const { data, error } = await client.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error) return { data: null, error: 'failed' };
    return data ? { data, error: null } : { data: null, error: 'missing' };
  } catch {
    return { data: null, error: 'failed' };
  }
}

// The same session again (a refresh of an unchanged user keeps the object, so
// nothing re-renders).
const sameSession = (a, b) => !!a && !!b
  && a.access_token === b.access_token
  && a.user?.id === b.user?.id
  && a.user?.email === b.user?.email
  && a.user?.updated_at === b.user?.updated_at;

// A link's session is signed in once, also when React runs effects twice in
// development.
const linkSessions = new WeakMap();
function signInWithLink(client, link) {
  if (!linkSessions.has(link)) {
    linkSessions.set(link, (async () => {
      try {
        const { error } = await client.auth.setSession(link.tokens);
        return { error: error || null };
      } catch (error) {
        return { error };
      }
    })());
  }
  return linkSessions.get(link);
}

function initialLinkState(link, backend) {
  if (!link) return null;
  const base = { kind: link.kind, type: link.type || null, forReset: !!link.forReset, network: false, code: link.code || null };
  if (link.kind === 'error') return { ...base, status: 'failed' };
  return backend ? { ...base, status: 'pending' } : { ...base, status: 'failed', code: 'unavailable' };
}

export const AuthContext = createContext(null);

export function AuthProvider({ client = defaultClient, link = null, children }) {
  const backend = !!client;
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(backend);
  const [connectionProblem, setConnectionProblem] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [linkState, setLinkState] = useState(() => initialLinkState(link, backend));
  const [profileState, setProfileState] = useState(EMPTY_PROFILE);

  // Read by event handlers only.
  const hadSessionRef = useRef(false); // a session exists, or a saved one could not be refreshed
  const ownSignOutRef = useRef(false); // signOut() in this tab is running
  const unreachableRef = useRef(false);
  const userIdRef = useRef(null);
  const profileAtRef = useRef(0);
  const refreshRef = useRef(null);

  const userId = session?.user?.id ?? null;
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // The session: the saved one, an email link's, and every change after that.
  useEffect(() => {
    if (!client) return undefined;
    let active = true;
    let answered = false;

    const markSignedIn = (next) => {
      hadSessionRef.current = true;
      unreachableRef.current = false;
      setConnectionProblem(false);
      setSessionEnded(false);
      setSession((prev) => (sameSession(prev, next) ? prev : next));
    };
    const markSignedOut = () => {
      if (hadSessionRef.current && !ownSignOutRef.current) setSessionEnded(true);
      hadSessionRef.current = false;
      unreachableRef.current = false;
      setConnectionProblem(false);
      setSession(null);
      setProfileState(EMPTY_PROFILE);
    };
    const markUnreachable = () => {
      hadSessionRef.current = true;
      unreachableRef.current = true;
      setConnectionProblem(true);
    };

    const { data: sub } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') markSignedOut();
      else if (next) markSignedIn(next);
    });

    // Asks supabase-js for the session (refreshing it when it has expired).
    const check = async () => {
      let result;
      try {
        result = await client.auth.getSession();
      } catch (error) {
        result = { data: { session: null }, error };
      }
      if (!active) return;
      answered = true;
      const next = result?.data?.session || null;
      if (next) markSignedIn(next);
      else if (result?.error && isRetryableAuthError(result.error)) markUnreachable();
      else if (hadSessionRef.current) markSignedOut();
    };

    (async () => {
      if (link?.tokens) {
        const { error } = await signInWithLink(client, link);
        if (!active) return;
        setLinkState((prev) => prev && {
          ...prev,
          status: error ? 'failed' : 'ok',
          network: !!error && isRetryableAuthError(error),
          code: error ? (error.code || 'invalid_link') : null,
        });
      }
      await check();
      if (active) setLoading(false);
    })();

    // A saved session that takes too long to refresh (a hanging network):
    // stop holding the account pages and say so.
    const timer = window.setTimeout(() => {
      if (!active || answered) return;
      if (hasStoredSession()) markUnreachable();
      setLoading(false);
    }, AUTH_CHECK_TIMEOUT_MS);

    const onStorage = (event) => {
      if (event.key !== null && event.key !== AUTH_STORAGE_KEY) return;
      // Cleared in another tab (sign-out there, including one that could not
      // reach Supabase), or all of the site's storage was cleared.
      if (event.key === null || event.newValue === null) {
        if (hadSessionRef.current) markSignedOut();
        return;
      }
      check();
    };
    const onOnline = () => {
      if (unreachableRef.current) check();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', onOnline);
    return () => {
      active = false;
      window.clearTimeout(timer);
      sub?.subscription?.unsubscribe();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', onOnline);
    };
  }, [client, link]);

  // The profile: one request per signed-in user (AW-187).
  useEffect(() => {
    if (!client || !userId) return undefined;
    let cancelled = false;
    fetchProfile(client, userId).then((result) => {
      if (cancelled) return;
      profileAtRef.current = Date.now();
      setProfileState({ for: userId, ...result, refreshing: false });
    });
    return () => { cancelled = true; };
  }, [client, userId]);

  const refreshProfile = useCallback(() => {
    const id = userIdRef.current;
    if (!client || !id) return Promise.resolve(null);
    if (refreshRef.current?.id === id) return refreshRef.current.promise;
    setProfileState((prev) => (prev.for === id ? { ...prev, refreshing: true } : prev));
    const promise = fetchProfile(client, id).then((result) => {
      if (refreshRef.current?.promise === promise) refreshRef.current = null;
      if (userIdRef.current !== id) return null;
      profileAtRef.current = Date.now();
      setProfileState((prev) => {
        // A failed refresh keeps the profile already on screen.
        if (result.error === 'failed' && prev.for === id && prev.data) return { ...prev, refreshing: false };
        return { for: id, ...result, refreshing: false };
      });
      return result;
    });
    refreshRef.current = { id, promise };
    return promise;
  }, [client]);

  // Staff approval (or a suspension) shows without a reload: the profile is
  // checked again when the buyer comes back to the tab, and on a timer while
  // the account is pending.
  const profileReady = !!userId && profileState.for === userId;
  const profile = profileReady ? profileState.data : null;
  const profileStatus = profile?.status || null;
  useEffect(() => {
    if (!client || !userId) return undefined;
    const onBack = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - profileAtRef.current < PROFILE_REFRESH_MIN_MS) return;
      refreshProfile();
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    window.addEventListener('online', onBack);
    const poll = profileStatus === 'pending'
      ? window.setInterval(() => { if (document.visibilityState === 'visible') refreshProfile(); }, PENDING_PROFILE_POLL_MS)
      : 0;
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
      window.removeEventListener('online', onBack);
      if (poll) window.clearInterval(poll);
    };
  }, [client, userId, profileStatus, refreshProfile]);

  const signUp = useCallback(async ({
    email, password, name, business, phone, license_no, ein, resale_cert_no,
    business_type, state, expected_volume, store_street, store_city, store_zip,
    terms_accepted, terms_version, age_confirmed,
  }) => {
    if (!client) throw new Error(UNAVAILABLE);
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        // The signup trigger copies these into profiles. Once the 2026-10-08
        // migrations are applied it also removes the sensitive keys from the
        // auth metadata (AW-092, AW-019, AW-348); until then they stay there.
        data: {
          name, business, phone, license_no, ein, resale_cert_no, business_type, state, expected_volume,
          store_street, store_city, store_zip, terms_accepted, terms_version, age_confirmed,
        },
      },
    });
    if (error) throw error;
    return data;
  }, [client]);

  const signIn = useCallback(async ({ email, password }) => {
    if (!client) throw new Error(UNAVAILABLE);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, [client]);

  const signOutRef = useRef(null); // the sign-out in progress
  const signOut = useCallback(({ scope = 'local' } = {}) => {
    if (!client) return Promise.resolve({ ok: true, scope });
    if (signOutRef.current) return signOutRef.current;
    ownSignOutRef.current = true;
    const run = (async () => {
      let ok = false;
      let timer = 0;
      try {
        // A saved session that cannot be refreshed cannot be revoked either:
        // don't wait for Supabase at all.
        if (!unreachableRef.current) {
          const timeout = new Promise((resolve) => {
            timer = window.setTimeout(() => resolve({ error: new Error('Sign-out timed out') }), SIGN_OUT_TIMEOUT_MS);
          });
          const { error } = await Promise.race([client.auth.signOut({ scope }), timeout]);
          ok = !error;
        }
      } catch {
        ok = false;
      } finally {
        window.clearTimeout(timer);
        // Whatever Supabase answered, this browser keeps no session: the next
        // person at a shared computer must not be signed back in (AW-047).
        clearStoredSession();
        ownSignOutRef.current = false;
        signOutRef.current = null;
      }
      hadSessionRef.current = false;
      unreachableRef.current = false;
      setSession(null);
      setProfileState(EMPTY_PROFILE);
      setConnectionProblem(false);
      setSessionEnded(false);
      setLinkState(null);
      return { ok, scope };
    })();
    signOutRef.current = run;
    return run;
  }, [client]);

  // The reset email links to /reset-password. That address must be in
  // Supabase's redirect allow list (BACKEND.md); if it is not, Supabase sends
  // the link to the site root and authLink.js still opens the reset page.
  const resetPassword = useCallback(async (email) => {
    if (!client) throw new Error(UNAVAILABLE);
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}` });
    if (error) throw error;
  }, [client]);

  // A new sign-up confirmation email, for an account whose link expired.
  const resendConfirmation = useCallback(async (email) => {
    if (!client) throw new Error(UNAVAILABLE);
    const { error } = await client.auth.resend({ type: 'signup', email });
    if (error) throw error;
  }, [client]);

  const updatePassword = useCallback(async (password) => {
    if (!client) throw new Error(UNAVAILABLE);
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    // The reset link has done its job.
    setLinkState(null);
  }, [client]);

  const dismissLink = useCallback(() => setLinkState(null), []);
  const dismissSessionEnded = useCallback(() => setSessionEnded(false), []);
  const dismissConnectionProblem = useCallback(() => setConnectionProblem(false), []);

  const profileError = profileReady ? profileState.error : null;
  const account = accountState({ loading, session, profileReady, profile });
  const linkFailed = linkState?.status === 'failed';
  const linkError = useMemo(() => (linkFailed
    ? { kind: linkState.kind, code: linkState.code, network: linkState.network, forReset: linkState.forReset }
    : null), [linkFailed, linkState]);
  const recovery = linkState?.kind === 'recovery' && linkState.status === 'ok';
  const linkChecking = linkState?.status === 'pending';
  const linkConfirmed = linkState?.kind === 'session' && linkState.status === 'ok' ? (linkState.type || 'link') : null;

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    loading,
    profile,
    profileReady,
    profileError,
    profileRefreshing: profileReady && profileState.refreshing,
    account,
    refreshProfile,
    sessionEnded,
    connectionProblem,
    dismissSessionEnded,
    dismissConnectionProblem,
    signIn,
    signUp,
    signOut,
    resetPassword,
    resendConfirmation,
    updatePassword,
    recovery,
    linkError,
    linkChecking,
    linkConfirmed,
    dismissLink,
    isBackendConfigured: backend,
  }), [
    session, loading, profile, profileReady, profileError, profileState.refreshing, account, refreshProfile,
    sessionEnded, connectionProblem, dismissSessionEnded, dismissConnectionProblem,
    signIn, signUp, signOut, resetPassword, resendConfirmation, updatePassword,
    recovery, linkError, linkChecking, linkConfirmed, dismissLink, backend,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth() needs an <AuthProvider> above it (see src/main.jsx).');
  return value;
}
