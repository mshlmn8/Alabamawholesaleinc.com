// Supabase client + small helpers. If env vars are missing (e.g., local dev
// before secrets are wired) the client is null and consumers fall back to
// static data — the site keeps working but admin/account features are hidden.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'aw-auth',
      },
    })
  : null;

export const isBackendConfigured = !!supabase;
