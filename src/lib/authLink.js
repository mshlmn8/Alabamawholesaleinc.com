// Supabase email links (AW-015): sign-up confirmation, password recovery,
// invites and email changes come back to the site as
//
//   /reset-password#access_token=…&refresh_token=…&type=recovery
//   /#access_token=…&refresh_token=…&type=signup
//   /#error=access_denied&error_code=otp_expired&error_description=…
//
// (older emails, and a redirect Supabase does not allow, land on '/' instead;
// very old ones on a '#/route#access_token=…' address). main.jsx calls
// takeAuthLink() once, before the router's legacy '#/' redirect and before
// anything else reads the URL. It removes the tokens or the error from the
// address bar and from the history entry, and hands what it found to the
// AuthProvider, which signs the link's session in (src/lib/auth.jsx).
//
// Only a recovery link opens the new-password page, and only once: its
// address becomes /reset-password. Every other link keeps the page it landed
// on. A failed link is reported by its error code only; Supabase's
// error_description is never shown, because anyone can put text in a URL.

// Supabase's error parameters, removed from a query string that also holds
// other parameters.
const ERROR_KEYS = ['error', 'error_code', 'error_description', 'sb'];

export const RESET_PASSWORD_PATH = '/reset-password';

const params = (text) => {
  try {
    return new URLSearchParams(text || '');
  } catch {
    return new URLSearchParams();
  }
};

const isErrorParams = (p) => p.has('error_code') || p.has('error_description') || (p.has('error') && !p.has('access_token'));

// Splits a fragment into the part before the auth parameters (an old '#/…'
// route, kept for the legacy redirect) and the auth parameters themselves.
function splitHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const at = raw.lastIndexOf('#');
  if (at !== -1) return { route: `#${raw.slice(0, at)}`, fragment: raw.slice(at + 1) };
  if (raw.startsWith('/') || raw.startsWith('!')) return { route: raw ? `#${raw}` : '', fragment: '' };
  return { route: '', fragment: raw };
}

const isResetPath = (pathname, route) => pathname.replace(/\/+$/, '') === RESET_PASSWORD_PATH
  || /^#!?\/reset-password\/?$/.test(route);

// Reads a location ({ pathname, search, hash }). Returns null when the URL
// carries no auth link, otherwise:
//   kind      'recovery' (a password reset session), 'session' (any other
//             signed-in link: sign-up confirmation, invite, email change) or
//             'error' (an expired, used or invalid link)
//   type      Supabase's link type, when it said
//   tokens    { access_token, refresh_token } for 'recovery' and 'session'
//   code      the error code for 'error' ('otp_expired', 'access_denied', …)
//   forReset  true when the link was meant for the new-password page
//   cleanUrl  the address to show instead: tokens and error removed, and
//             /reset-password for a recovery link
export function parseAuthLink({ pathname = '/', search = '', hash = '' } = {}) {
  const { route, fragment } = splitHash(hash);
  const fromHash = params(fragment);
  const fromSearch = params(search);
  const hashIsAuth = fromHash.has('access_token') || isErrorParams(fromHash);
  const searchIsAuth = isErrorParams(fromSearch);
  if (!hashIsAuth && !searchIsAuth) return null;

  // The query string keeps everything that is not part of the auth link.
  const keptSearch = params(search);
  if (searchIsAuth) ERROR_KEYS.forEach((key) => keptSearch.delete(key));
  const searchText = keptSearch.toString();
  const keptHash = hashIsAuth ? route : String(hash || '');
  const stayUrl = `${pathname}${searchText ? `?${searchText}` : ''}${keptHash}`;

  const source = hashIsAuth ? fromHash : fromSearch;
  const type = source.get('type') || null;
  const aimedAtReset = isResetPath(pathname, route) || type === 'recovery';

  if (isErrorParams(source)) {
    const code = (source.get('error_code') || source.get('error') || 'unknown').slice(0, 64);
    return {
      kind: 'error', type, tokens: null, code, forReset: aimedAtReset,
      cleanUrl: aimedAtReset ? RESET_PASSWORD_PATH : stayUrl,
    };
  }

  const accessToken = source.get('access_token');
  const refreshToken = source.get('refresh_token');
  if (!accessToken || !refreshToken) {
    // Half a link (cut off when it was copied): nothing to sign in with.
    return {
      kind: 'error', type, tokens: null, code: 'incomplete_link', forReset: aimedAtReset,
      cleanUrl: aimedAtReset ? RESET_PASSWORD_PATH : stayUrl,
    };
  }
  const tokens = { access_token: accessToken, refresh_token: refreshToken };
  if (type === 'recovery') {
    return { kind: 'recovery', type, tokens, code: null, forReset: true, cleanUrl: RESET_PASSWORD_PATH };
  }
  return { kind: 'session', type, tokens, code: null, forReset: false, cleanUrl: stayUrl };
}

// Reads the auth link from the current address, removes it from the address
// bar and the current history entry, and returns it (or null). Call once, at
// boot, before the router's legacy-hash redirect.
export function takeAuthLink(win = typeof window === 'undefined' ? null : window) {
  if (!win) return null;
  let link = null;
  try {
    link = parseAuthLink(win.location);
  } catch {
    return null;
  }
  if (!link) return null;
  try {
    win.history.replaceState(win.history.state, '', link.cleanUrl);
  } catch {
    // Too many history calls (Safari) or a sandboxed frame: the tokens stay
    // in the address bar, but the link still works.
  }
  return link;
}
