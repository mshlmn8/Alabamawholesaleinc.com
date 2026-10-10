// A signed-in trade account for the smoke specs, mocked: only an approved
// account that isn't on hold places orders (AW-014, AW-024), so every spec
// that sends one signs in this way. The saved session goes in 'aw-auth'
// (AUTH_STORAGE_KEY in src/lib/supabase.js) before the site's code runs;
// Supabase is answered here: the user, the profile, an empty order history,
// the seeded catalog, the buyer's prices and, when the spec gives
// `onSubmit`, submit_quote. Every other Supabase request is aborted, as the
// specs' catch-all does for any request that leaves the preview server.
import { fulfillMyPrices, fulfillProducts, seedRows } from './catalog.js';
import { cartKey, cartValue } from './cartStore.js';

export const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
export const ageRecord = (at = Date.now()) => JSON.stringify({ ok: true, at });

export const UID = '11111111-2222-4333-8444-555555555555';
export const PROFILE = Object.freeze({
  id: UID, name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', phone: '205-555-0100',
  status: 'approved', role: 'customer', pricing_tier: 'silver',
});
export const PENDING_PROFILE = Object.freeze({ ...PROFILE, status: 'pending' });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function savedSession(profile = PROFILE) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: profile.id, aud: 'authenticated', role: 'authenticated', email: profile.email, app_metadata: { provider: 'email' }, user_metadata: {} };
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: profile.id, role: 'authenticated', aud: 'authenticated', exp, email: profile.email })}.c2ln`;
  return { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'smoke-refresh', user };
}

// Before the first page of the tab loads: the age confirmation, the saved
// session and `cart` ({ line key: quantity }) for the account. Only once
// per tab (`marker` in sessionStorage), so a later reload or sign-out keeps
// what the page did.
export const seedAccount = (context, { profile = PROFILE, cart = null, marker = 'smoke-account' } = {}) => context.addInitScript(
  ([ageKey, age, authKey, session, key, value, mark]) => {
    try {
      localStorage.setItem(ageKey, age);
      if (!sessionStorage.getItem(mark)) {
        localStorage.setItem(authKey, session);
        if (value) localStorage.setItem(key, value);
        sessionStorage.setItem(mark, '1');
      }
    } catch { /* storage blocked */ }
  },
  [AGE_KEY, ageRecord(), 'aw-auth', JSON.stringify(savedSession(profile)), cartKey(profile.id), cart ? cartValue(cart) : null, marker],
);

// Answers Supabase for `profile`. onSubmit(body) gives submit_quote's answer
// ({ status = 200, json }); the bodies it was sent are returned.
export async function mockAccount(target, { profile = PROFILE, onSubmit = null, rows = () => seedRows() } = {}) {
  const submitted = [];
  await target.route(/supabase\.co\//, async (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/auth\/v1\/user/.test(url)) return route.fulfill({ json: savedSession(profile).user });
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return route.fulfill({ json: [profile] });
    if (/\/rest\/v1\/orders/.test(url)) return route.fulfill({ json: [] });
    if (/\/rest\/v1\/products/.test(url)) return fulfillProducts(route, rows());
    if (/\/rest\/v1\/rpc\/my_prices/.test(url)) {
      return profile.status === 'approved' ? fulfillMyPrices(route, rows()) : route.fulfill({ json: null });
    }
    if (/\/rest\/v1\/rpc\/submit_quote/.test(url) && onSubmit) {
      const body = req.postDataJSON();
      submitted.push(body);
      const { status = 200, json } = await onSubmit(body, submitted.length);
      return route.fulfill({ status, json });
    }
    return route.abort();
  });
  return submitted;
}
