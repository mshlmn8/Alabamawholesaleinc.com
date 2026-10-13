// The oldest browsers the build targets (vite.config.js build.target: Safari
// 14, Chrome 87, Firefox 78) have no Array.prototype.at or Object.hasOwn,
// and Safari 14.0 has no Intl.ListFormat (NEW-019). With them removed before
// the site's code runs, the site still starts, the sign-in and application
// dialogs open, and My account and the application page render for an
// approved and a pending account. Every Supabase request is answered here or
// aborted; no real account is used.
import { test, expect } from '@playwright/test';
import { fulfillMyPrices, fulfillProducts, seedRows, serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const AUTH_KEY = 'aw-auth'; // AUTH_STORAGE_KEY in src/lib/supabase.js
const UID = '11111111-2222-4333-8444-555555555555';
const APPROVED = { id: UID, name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', phone: '205-555-0100', status: 'approved', role: 'customer', pricing_tier: 'silver' };
const PENDING = { ...APPROVED, business: 'Pending Mart LLC', status: 'pending', pricing_tier: null };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: APPROVED.email, app_metadata: { provider: 'email' }, user_metadata: {} };
function savedSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp, email: APPROVED.email })}.c2ln`;
  return { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'smoke-refresh', user: USER };
}

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text())) return; // requests this spec aborts on purpose
    errors.push(`console: ${m.text()}`);
  });
  return errors;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, JSON.stringify({ ok: true, at: value })); } catch { /* storage blocked */ }
    // What Safari 14.0 lacks, gone before any of the site's code runs.
    delete Array.prototype.at;
    delete Object.hasOwn;
    delete Intl.ListFormat;
  }, [AGE_KEY, Date.now()]);
});

async function signedInAs(page, context, profile) {
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
  }, [AUTH_KEY, JSON.stringify(savedSession())]);
  await page.route(/supabase\.co\//, (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/auth\/v1\/user/.test(url)) return route.fulfill({ json: USER });
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return route.fulfill({ json: [profile] });
    if (/\/rest\/v1\/orders/.test(url)) return route.fulfill({ json: [], headers: { 'content-range': '*/0' } });
    if (/\/rest\/v1\/profile_documents/.test(url) && req.method() === 'GET') return route.fulfill({ json: [] });
    if (/\/rest\/v1\/products/.test(url)) return fulfillProducts(route, seedRows());
    if (/\/rest\/v1\/rpc\/my_prices/.test(url)) return fulfillMyPrices(route, seedRows());
    return route.abort();
  });
}

test('the site starts, and the sign-in and application dialogs open, without .at, Object.hasOwn or Intl.ListFormat (NEW-019)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Wholesale for licensed retailers.' })).toBeVisible();
  expect(await page.evaluate(() => [typeof [].at, typeof Object.hasOwn, typeof Intl.ListFormat])).toEqual(['undefined', 'undefined', 'undefined']);
  // The footer's department list, written without Intl.ListFormat.
  await expect(page.locator('.footer-brand p')).toHaveText(/^Wholesale distributor of tobacco, .+, and drinks & bags\. Serving licensed retail stores\.$/);

  await page.goto('/contact');
  await expect(page.getByRole('heading', { level: 1, name: /Contact/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sign In' }).first().click();
  const signIn = page.getByRole('dialog', { name: 'Sign in' });
  await expect(signIn).toBeVisible();
  await expect(signIn.getByLabel('Business email')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/apply');
  await page.getByRole('button', { name: 'Apply for a trade account' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Apply for a trade account' })).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('My account and the application page render for an approved and a pending account without Object.hasOwn (NEW-019)', async ({ page, context }) => {
  const errors = trackErrors(page);
  await signedInAs(page, context, APPROVED);
  await page.goto('/account');
  await expect(page.getByRole('heading', { level: 1, name: 'Test Market LLC' })).toBeVisible();
  await expect(page.locator('.error-fallback')).toHaveCount(0);

  await page.unroute(/supabase\.co\//);
  await signedInAs(page, context, PENDING);
  await page.goto('/apply');
  await expect(page.getByRole('heading', { level: 1, name: 'Your trade account' })).toBeVisible();
  await expect(page.getByText('Pending approval').first()).toBeVisible();
  await expect(page.locator('.error-fallback')).toHaveCount(0);
  expect(errors).toEqual([]);
});
