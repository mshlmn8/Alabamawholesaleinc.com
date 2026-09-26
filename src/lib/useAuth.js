// Single source of truth for the current session + profile. Exported as a
// React hook so any component can `const { user, profile, signIn, ... } = useAuth()`.

import { useEffect, useState, useCallback } from 'react';
import { supabase, isBackendConfigured } from './supabase.js';

export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isBackendConfigured);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) { setProfile(null); return; }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn('profile load failed', error);
        setProfile(data || null);
      });
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const signUp = useCallback(async ({ email, password, name, business, phone, license_no, business_type, state, expected_volume }) => {
    if (!supabase) throw new Error('Account access is temporarily unavailable. Please call or email the trade desk.');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, business, phone, license_no, business_type, state, expected_volume },
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) throw new Error('Account access is temporarily unavailable. Please call or email the trade desk.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return { session, user: session?.user || null, profile, loading, signUp, signIn, signOut, isBackendConfigured };
}
