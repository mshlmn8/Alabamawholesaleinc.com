// Build-time check for the Supabase settings (AW-053).
//
// Without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY the app builds a
// static-only site: sign-in, applications and quotes are all disabled. That is
// fine for local dev, but a production build without them must fail loudly
// instead of shipping a broken storefront. ALLOW_NO_BACKEND=1 builds a
// static-only preview on purpose.

export const SUPABASE_URL_PATTERN = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/;

/**
 * Returns an error message when a production build is missing the backend
 * settings, or null when the build may go ahead.
 * @param {Record<string, string | undefined>} env variables from Vite's loadEnv
 */
export function backendEnvError(env) {
  if (env.ALLOW_NO_BACKEND === '1') return null;
  const problems = [];
  if (!SUPABASE_URL_PATTERN.test(env.VITE_SUPABASE_URL || '')) {
    problems.push('VITE_SUPABASE_URL must be the project URL, https://<project-ref>.supabase.co');
  }
  if (!env.VITE_SUPABASE_ANON_KEY) {
    problems.push('VITE_SUPABASE_ANON_KEY must be set to the anon public key');
  }
  if (!problems.length) return null;
  return [
    'Production build stopped: the Supabase settings are missing or invalid.',
    ...problems.map((p) => `  - ${p}`),
    'Set them in .env.local or the Netlify environment (see BACKEND.md), or set',
    'ALLOW_NO_BACKEND=1 to build a static-only preview on purpose.',
  ].join('\n');
}
