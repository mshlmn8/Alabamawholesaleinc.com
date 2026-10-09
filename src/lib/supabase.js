// Supabase client + small helpers. If env vars are missing (e.g., local dev
// before secrets are wired) the client is null and consumers fall back to
// static data — the site keeps working but admin/account features are hidden.
//
// The client is built from Supabase's own packages rather than supabase-js's
// createClient (AW-179), so every visitor downloads only what the storefront
// uses: sign-in (@supabase/auth-js) and the database API
// (@supabase/postgrest-js). createClient also bundles Realtime (with its
// Phoenix socket), Storage and Edge Functions, about half the Supabase code.
// It is put together the way createClient does it (supabase-js 2.117.2,
// SupabaseClient), with the same settings and headers:
//
//   supabase.auth          the AuthClient: storageKey 'aw-auth', the session
//                          kept in localStorage and refreshed, email links
//                          read by src/lib/authLink.js (detectSessionInUrl off)
//   supabase.from(table)   PostgREST at <url>/rest/v1, through a fetch that
//   supabase.rpc(fn, …)    sends the apikey and, as Authorization, the
//   supabase.schema(name)  signed-in session's token (else the anon key), as
//                          supabase-js's fetchWithAuth does
//   supabase.loadStorage() Storage (@supabase/storage-js), downloaded the
//                          first time it is needed: application documents
//                          (src/lib/documents.js) and admin photo uploads.
//                          Then also supabase.storage. Call sites use
//                          storageOf(client) (src/lib/storageClient.js).
//   supabase.realtimeSettings()  what Admin -> Orders' Realtime client needs
//                          (src/pages/admin/realtime.js, in the admin files)
//
// The four packages are pinned to the versions supabase-js 2.117.2 used
// (package.json; supabase.test.js checks), so their behaviour is unchanged.

import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Where auth-js keeps the session in localStorage ('aw-auth', plus
// 'aw-auth-…' helper keys). src/lib/auth.jsx clears these itself when a
// sign-out cannot reach Supabase (AW-047), and follows changes to them made
// by other tabs.
export const AUTH_STORAGE_KEY = 'aw-auth';

// The supabase-js release the packages come from, and the X-Client-Info it
// sends with every request.
export const SUPABASE_JS_VERSION = '2.117.2';
export const CLIENT_INFO = `supabase-js/${SUPABASE_JS_VERSION}; runtime=web`;

const withSlash = (value) => (value.endsWith('/') ? value : `${value}/`);

// The site's Supabase client for project `supabaseUrl` and its public (anon)
// key. `fetchImpl` is for tests; the default calls the page's fetch at the
// time of each request.
export function createSiteClient(supabaseUrl, supabaseKey, { fetchImpl } = {}) {
  if (!supabaseUrl || !supabaseKey) throw new Error('A Supabase URL and key are required.');
  const base = new URL(withSlash(String(supabaseUrl).trim()));
  const headers = { 'X-Client-Info': CLIENT_INFO };
  const send = fetchImpl || ((...args) => fetch(...args));

  const auth = new AuthClient({
    url: new URL('auth/v1', base).href,
    headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey, ...headers },
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    // Email links are read by src/lib/authLink.js at boot, before the
    // router touches the URL, and signed in by the AuthProvider (AW-015).
    // Left to itself, auth-js reads the fragment on its own schedule and
    // clears it with a location.hash write that adds a history entry.
    detectSessionInUrl: false,
    flowType: 'implicit',
    hasCustomAuthorizationHeader: false,
  });

  // The signed-in session's access token, or null.
  const sessionToken = async () => {
    const { data } = await auth.getSession();
    return data?.session?.access_token ?? null;
  };
  // supabase-js's fetchWithAuth: the apikey, and the session's token (else
  // the anon key) as the bearer, unless the request set its own.
  const fetchWithAuth = async (input, init) => {
    const token = await sessionToken();
    const sent = new Headers(init?.headers);
    if (!sent.has('apikey')) sent.set('apikey', supabaseKey);
    if (!sent.has('Authorization')) sent.set('Authorization', `Bearer ${token ?? supabaseKey}`);
    return send(input, { ...init, headers: sent });
  };

  const rest = new PostgrestClient(new URL('rest/v1', base).href, { headers, schema: 'public', fetch: fetchWithAuth });

  let storageLoad = null;
  const client = {
    supabaseUrl: base.href,
    auth,
    from: (relation) => rest.from(relation),
    schema: (name) => rest.schema(name),
    rpc: (fn, args = {}, options = { head: false, get: false, count: undefined }) => rest.rpc(fn, args, options),
    loadStorage() {
      if (!storageLoad) {
        storageLoad = import('@supabase/storage-js').then(({ StorageClient }) => {
          const storage = new StorageClient(new URL('storage/v1', base).href, headers, fetchWithAuth);
          client.storage = storage;
          return storage;
        }, (error) => {
          // A file that didn't download can be tried again.
          storageLoad = null;
          throw error;
        });
      }
      return storageLoad;
    },
    realtimeSettings() {
      const realtimeUrl = new URL('realtime/v1', base);
      realtimeUrl.protocol = realtimeUrl.protocol.replace('http', 'ws');
      return {
        url: realtimeUrl.href,
        key: supabaseKey,
        headers,
        fetch: fetchWithAuth,
        // As supabase-js: the session's token, else the anon key.
        accessToken: async () => (await sessionToken()) ?? supabaseKey,
      };
    },
  };
  return client;
}

export const supabase = url && anonKey ? createSiteClient(url, anonKey) : null;

export const isBackendConfigured = !!supabase;
