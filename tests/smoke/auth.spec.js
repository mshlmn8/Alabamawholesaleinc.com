// Accounts against a mocked Supabase (AW-015, AW-047, AW-186, AW-187): email
// links, sign-out without a connection, and account pages while the profile
// loads. Every Supabase request is answered here or aborted; nothing leaves
// the browser, and no real account is used.
import { test, expect } from '@playwright/test';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const AUTH_KEY = 'aw-auth'; // AUTH_STORAGE_KEY in src/lib/supabase.js
const ageRecord = (at) => JSON.stringify({ ok: true, at });
const UID = '11111111-2222-4333-8444-555555555555';
const PROFILE = { id: UID, name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', phone: '205-555-0100', status: 'approved', role: 'customer', pricing_tier: 'silver' };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (exp) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp, email: PROFILE.email })}.c2ln`;
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: PROFILE.email, app_metadata: { provider: 'email' }, user_metadata: {} };
function savedSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return { access_token: jwt(exp), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'smoke-refresh', user: USER };
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

// Answers Supabase: the user, the profile (after `profileDelay` ms), and a
// logout that fails like an unreachable server when `logout` is 'abort'.
async function mockSupabase(page, { profileDelay = 0, logout = 'ok' } = {}) {
  const calls = { profiles: 0, logout: [] };
  await page.route(/supabase\.co\//, async (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/auth\/v1\/user/.test(url)) return route.fulfill({ json: USER });
    if (/\/auth\/v1\/logout/.test(url)) {
      calls.logout.push(new URL(url).search);
      return logout === 'abort' ? route.abort() : route.fulfill({ status: 204, body: '' });
    }
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') {
      calls.profiles += 1;
      if (profileDelay) await new Promise((resolve) => setTimeout(resolve, profileDelay));
      return route.fulfill({ json: [PROFILE] });
    }
    if (/\/rest\/v1\/orders/.test(url)) return route.fulfill({ json: [] });
    return route.abort();
  });
  return calls;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
  }, [AGE_KEY, ageRecord(Date.now())]);
});

// Saves a session in the first page load of each tab only (not on reloads).
const seedSession = (context) => context.addInitScript(([key, value]) => {
  try {
    if (!sessionStorage.getItem('smoke-seeded')) {
      localStorage.setItem(key, value);
      sessionStorage.setItem('smoke-seeded', '1');
    }
  } catch { /* storage blocked */ }
}, [AUTH_KEY, JSON.stringify(savedSession())]);

test('an expired email link shows a notice instead of taking over the site (AW-015)', async ({ page }) => {
  const errors = trackErrors(page);
  await mockSupabase(page);
  await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Call+555-0000+now');
  const notice = page.locator('.site-notice[data-notice="link-error"]');
  await expect(notice).toContainText('That email link has expired or was already used');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('body')).not.toContainText('555-0000');
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toHaveCount(0);
  await page.goto('/contact');
  await expect(page.getByRole('heading', { level: 1, name: /Contact/ })).toBeVisible();
  await expect(page.locator('.site-notice')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a recovery link opens /reset-password once, and the site stays usable (AW-015)', async ({ page }) => {
  const errors = trackErrors(page);
  await mockSupabase(page);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  await page.goto(`/#access_token=${jwt(exp)}&expires_at=${exp}&expires_in=3600&refresh_token=smoke-rt&token_type=bearer&type=recovery`);
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole('heading', { name: `New password for ${PROFILE.email}` })).toBeVisible();
  await expect(page.getByText('RESET LINK CONFIRMED')).toBeVisible();
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('an account page waits for the account instead of showing the signed-out view (AW-186, AW-187)', async ({ page, context }) => {
  const errors = trackErrors(page);
  await seedSession(context);
  const calls = await mockSupabase(page, { profileDelay: 800 });
  await page.goto('/account');
  await expect(page.getByText('Loading your account…')).toBeVisible();
  await expect(page.getByText(/Sign in to view your account/)).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Test Market LLC' })).toBeVisible();
  expect(calls.profiles).toBe(1);
  expect(errors).toEqual([]);
});

test('signing out without a connection stays signed out after a reload, in every tab (AW-047)', async ({ page, context }) => {
  const errors = trackErrors(page);
  await seedSession(context);
  const calls = await mockSupabase(page, { logout: 'abort' });
  const other = await context.newPage();
  await mockSupabase(other);
  await other.goto('/account');
  await expect(other.getByRole('heading', { level: 1, name: 'Test Market LLC' })).toBeVisible();

  await page.goto('/account');
  await expect(page.getByRole('heading', { level: 1, name: 'Test Market LLC' })).toBeVisible();
  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign Out', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  }
  await expect(page.locator('.site-notice[data-notice="signed-out"]')).toContainText('You’re signed out on this computer.');
  expect(calls.logout).toEqual(['?scope=local']);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('aw-auth')))).toEqual([]);

  await page.reload();
  await expect(page.locator('.aw-account-actions')).toContainText('Sign In');
  await expect(page.locator('.aw-account-actions')).not.toContainText('Test Market LLC');
  // The other tab followed, and says why.
  await expect(other.locator('.site-notice[data-notice="session-ended"]')).toContainText('Your session has ended');
  await expect(other.locator('main h1')).toHaveText('My account');
  expect(errors).toEqual([]);
});
