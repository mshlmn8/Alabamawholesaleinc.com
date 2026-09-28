// Single source of truth for the current session + profile. Exported as a
// React hook so any component can `const { user, profile, signIn, ... } = useAuth()`.

import { useEffect, useState, useCallback } from 'react';
import { supabase, isBackendConfigured } from './supabase.js';

// Read the auth redirect fragment at module load, before supabase-js consumes
// it and strips it from the URL. Recovery links arrive as
// `/#access_token=…&type=recovery`; expired links as `/#error=…&error_description=…`.
const linkParams = (() => {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    return new URLSearchParams(hash.includes('#') ? hash.slice(hash.lastIndexOf('#') + 1) : hash);
  } catch {
    return new URLSearchParams();
  }
})();
const OPENED_RECOVERY_LINK = isBackendConfigured && linkParams.get('type') === 'recovery';
const OPENED_LINK_ERROR = (isBackendConfigured && (linkParams.get('error') || linkParams.get('error_code')))
  ? (linkParams.get('error_description') || 'This link is invalid or has expired.')
  : null;

const UNAVAILABLE = 'Account access is temporarily unavailable. Please call or email the trade desk.';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileFor, setProfileFor] = useState(null); // user id the loaded profile belongs to
  const [loading, setLoading] = useState(isBackendConfigured);
  const [recovery, setRecovery] = useState(OPENED_RECOVERY_LINK);
  const [linkError, setLinkError] = useState(OPENED_LINK_ERROR);

  useEffect(() => {
    // Without a backend, loading already starts false (isBackendConfigured).
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    // Signing out clears the profile. The AuthProvider rework (AW-187) replaces this.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!supabase || !userId) { setProfile(null); setProfileFor(null); return; }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn('profile load failed', error);
        setProfile(data || null);
        setProfileFor(userId);
      });
    return () => { cancelled = true; };
  }, [userId]);
  // True once the profile fetch for the current session has finished (even if it failed).
  const profileReady = !!session?.user && profileFor === session.user.id;

  const signUp = useCallback(async ({ email, password, name, business, phone, license_no, ein, resale_cert_no, business_type, state, expected_volume }) => {
    if (!supabase) throw new Error(UNAVAILABLE);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, business, phone, license_no, ein, resale_cert_no, business_type, state, expected_volume },
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) throw new Error(UNAVAILABLE);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  // The reset link lands on the site root; the storefront recognises the
  // recovery fragment and shows the new-password page. The root URL must be
  // listed under Supabase → Authentication → URL Configuration.
  const resetPassword = useCallback(async (email) => {
    if (!supabase) throw new Error(UNAVAILABLE);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password) => {
    if (!supabase) throw new Error(UNAVAILABLE);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const clearRecovery = useCallback(() => { setRecovery(false); setLinkError(null); }, []);

  return {
    session, user: session?.user || null, profile, profileReady, loading,
    signUp, signIn, signOut, resetPassword, updatePassword,
    recovery, linkError, clearRecovery, isBackendConfigured,
  };
}
