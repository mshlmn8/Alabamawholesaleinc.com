// Supabase client + small helpers. If env vars are missing (e.g., local dev
// before secrets are wired) the client is null and consumers fall back to
// static data — the site keeps working but admin/account features are hidden.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Where supabase-js keeps the session in localStorage ('aw-auth', plus
// 'aw-auth-…' helper keys). src/lib/auth.jsx clears these itself when a
// sign-out cannot reach Supabase (AW-047), and follows changes to them made
// by other tabs.
export const AUTH_STORAGE_KEY = 'aw-auth';

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: AUTH_STORAGE_KEY,
        // Email links are read by src/lib/authLink.js at boot, before the
        // router touches the URL, and signed in by the AuthProvider (AW-015).
        // Left to itself, supabase-js reads the fragment on its own schedule
        // and clears it with a location.hash write that adds a history entry.
        detectSessionInUrl: false,
      },
    })
  : null;

export const isBackendConfigured = !!supabase;
