// Changing the password on /reset-password (AW-349) against a mocked
// Supabase: a signed-in account must give its current password first, and
// every change, with or without a reset link, signs out the account's other
// devices while this browser stays signed in. Every Supabase request is
// answered here or aborted; nothing leaves the browser, and no real account
// or password is used.
import { test, expect } from '@playwright/test';
import { fulfillMyPrices, fulfillProducts, seedRows, serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const AUTH_KEY = 'aw-auth'; // AUTH_STORAGE_KEY in src/lib/supabase.js
const UID = '11111111-2222-4333-8444-555555555555';
const PROFILE = { id: UID, name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', phone: '205-555-0100', status: 'approved', role: 'customer', pricing_tier: 'silver' };
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: PROFILE.email, app_metadata: { provider: 'email' }, user_metadata: {} };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (exp, n = 0) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp, email: PROFILE.email, n })}.c2ln`;
function session(n = 0) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return { access_token: jwt(exp, n), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: `smoke-refresh-${n}`, user: USER };
}

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text())) return; // the 400s this spec answers on purpose
    errors.push(`console: ${m.text()}`);
  });
  return errors;
}

// Supabase Auth and the account's rows. `password` is the current password
// the fake server accepts; every auth call is recorded in `calls`.
async function mockSupabase(page, { password = 'current-pass-1' } = {}) {
  const calls = [];
  let signIns = 0;
  await page.route(/supabase\.co\//, async (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/auth\/v1\//.test(url)) calls.push(`${req.method()} ${url.replace(/^.*\/auth\/v1/, '')}`);
    if (/\/auth\/v1\/token\?grant_type=password/.test(url)) {
      if (req.postDataJSON()?.password !== password) {
        return route.fulfill({ status: 400, json: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } });
      }
      signIns += 1;
      return route.fulfill({ json: session(signIns) });
    }
    if (/\/auth\/v1\/user/.test(url)) return route.fulfill({ json: req.method() === 'PUT' ? { ...USER, updated_at: new Date().toISOString() } : USER });
    if (/\/auth\/v1\/logout/.test(url)) return route.fulfill({ status: 204, body: '' });
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return route.fulfill({ json: [PROFILE] });
    if (/\/rest\/v1\/orders/.test(url)) return route.fulfill({ json: [] });
    if (/\/rest\/v1\/profile_documents/.test(url) && req.method() === 'GET') return route.fulfill({ json: [] });
    if (/\/rest\/v1\/products/.test(url)) return fulfillProducts(route, seedRows());
    if (/\/rest\/v1\/rpc\/my_prices/.test(url)) return fulfillMyPrices(route, seedRows());
    return route.abort();
  });
  return calls;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
  }, [AGE_KEY, JSON.stringify({ ok: true, at: Date.now() })]);
});

const seedSession = (context) => context.addInitScript(([key, value]) => {
  try {
    if (!sessionStorage.getItem('smoke-seeded')) {
      localStorage.setItem(key, value);
      sessionStorage.setItem('smoke-seeded', '1');
    }
  } catch { /* storage blocked */ }
}, [AUTH_KEY, JSON.stringify(session())]);

const form = (page) => page.locator('form[aria-labelledby="reset-form-title"]');

test('a signed-in password change needs the current password and signs out the other devices (AW-349)', async ({ page, context }) => {
  const errors = trackErrors(page);
  await seedSession(context);
  const calls = await mockSupabase(page);
  await page.goto('/reset-password');
  await expect(form(page).getByText('YOUR ACCOUNT', { exact: true })).toBeVisible();
  const current = form(page).getByLabel('Current password');
  await expect(current).toHaveAttribute('autocomplete', 'current-password');
  await expect(form(page).getByRole('button', { name: 'Forgot it? Email me a reset link' })).toBeVisible();

  await current.fill('not-the-password');
  await form(page).getByLabel('New password', { exact: true }).fill('new-pass-123');
  await form(page).getByLabel('Confirm new password').fill('new-pass-123');
  await form(page).getByRole('button', { name: 'Save new password' }).click();
  await expect(form(page).getByRole('alert')).toHaveText('That isn’t the current password for this account.');
  await expect(current).toBeFocused();
  await expect(current).toHaveAttribute('aria-invalid', 'true');
  expect(calls.filter((c) => c.startsWith('PUT'))).toEqual([]);

  await current.fill('current-pass-1');
  await form(page).getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  await expect(page.getByText('Other devices signed in to this account have been signed out.')).toBeVisible();
  const auth = calls.filter((c) => !c.startsWith('GET'));
  expect(auth).toEqual(['POST /token?grant_type=password', 'POST /token?grant_type=password', 'PUT /user', 'POST /logout?scope=others']);
  // This browser stays signed in, with the session from the fresh sign-in.
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), AUTH_KEY);
  expect(saved?.refresh_token).toBe('smoke-refresh-1');
  await page.getByRole('link', { name: 'Go to my account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Test Market LLC' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a reset link skips the current password and still signs out the other devices (AW-349)', async ({ page }) => {
  const errors = trackErrors(page);
  const calls = await mockSupabase(page);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  await page.goto(`/#access_token=${jwt(exp)}&expires_at=${exp}&expires_in=3600&refresh_token=smoke-rt&token_type=bearer&type=recovery`);
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(form(page).getByText('RESET LINK CONFIRMED', { exact: true })).toBeVisible();
  await expect(form(page).getByLabel('Current password')).toHaveCount(0);
  await form(page).getByLabel('New password', { exact: true }).fill('new-pass-123');
  await form(page).getByLabel('Confirm new password').fill('new-pass-123');
  await form(page).getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  await expect(page.getByText('Other devices signed in to this account have been signed out.')).toBeVisible();
  expect(calls.filter((c) => !c.startsWith('GET'))).toEqual(['PUT /user', 'POST /logout?scope=others']);
  expect(errors).toEqual([]);
});
