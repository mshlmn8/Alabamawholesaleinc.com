// Links to a section of My account land on it the first time (NEW-032,
// AW-086): My account loads on demand, so on a first visit its code arrives
// after the navigation, when the section is there to scroll to. The
// header's Quick reorder (the phone menu's on a phone) lands on
// #quick-reorder, and a pending account's 'View account status' on
// #documents, each with its heading focused and in view. Production build,
// so the page really loads on demand. Every Supabase request is answered
// here or aborted; the sign-in uses test values the mock accepts, and
// nothing leaves the browser.
import { test, expect } from '@playwright/test';
import { fulfillMyPrices, fulfillProducts, seedRows, serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const AUTH_KEY = 'aw-auth'; // AUTH_STORAGE_KEY in src/lib/supabase.js
const UID = '11111111-2222-4333-8444-555555555555';
const APPROVED = { id: UID, name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', phone: '205-555-0100', status: 'approved', role: 'customer', pricing_tier: 'silver' };
const PENDING = { ...APPROVED, name: 'Test Pending', business: 'Pending Mart LLC', email: 'pending@example.test', status: 'pending', pricing_tier: null };
const TEST_PASSWORD = 'smoke-pass-1'; // what the mock below accepts; no real account
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const userOf = (profile) => ({ id: UID, aud: 'authenticated', role: 'authenticated', email: profile.email, app_metadata: { provider: 'email' }, user_metadata: {} });
function sessionOf(profile) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp, email: profile.email })}.c2ln`;
  return { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'smoke-refresh', user: userOf(profile) };
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

async function mockSupabase(page, profile) {
  await page.route(/supabase\.co\//, (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/auth\/v1\/token\?grant_type=password/.test(url)) {
      const body = req.postDataJSON() || {};
      if (body.email !== profile.email || body.password !== TEST_PASSWORD) return route.fulfill({ status: 400, json: { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' } });
      return route.fulfill({ json: sessionOf(profile) });
    }
    if (/\/auth\/v1\/user/.test(url)) return route.fulfill({ json: userOf(profile) });
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return route.fulfill({ json: [profile] });
    if (/\/rest\/v1\/orders/.test(url)) return route.fulfill({ json: [], headers: { 'content-range': '*/0' } });
    if (/\/rest\/v1\/profile_documents/.test(url) && req.method() === 'GET') return route.fulfill({ json: [] });
    if (/\/rest\/v1\/products/.test(url)) return fulfillProducts(route, seedRows());
    if (/\/rest\/v1\/rpc\/my_prices/.test(url)) return fulfillMyPrices(route, seedRows());
    return route.abort();
  });
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, JSON.stringify({ ok: true, at: value })); } catch { /* storage blocked */ }
  }, [AGE_KEY, Date.now()]);
});

// The section's heading has focus, and the section starts in the window.
async function expectLandedOn(page, sectionId, heading) {
  await expect(page).toHaveURL(new RegExp(`/account#${sectionId}$`));
  const title = page.getByRole('heading', { level: 2, name: heading });
  await expect(title).toBeFocused();
  await expect(title).toBeInViewport();
  const top = await page.locator(`#${sectionId}`).evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(await page.evaluate(() => window.innerHeight / 2));
}

test('Quick reorder from another page lands on the section the first time, signed in (NEW-032, AW-086)', async ({ page, context }, testInfo) => {
  const errors = trackErrors(page);
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
  }, [AUTH_KEY, JSON.stringify(sessionOf(APPROVED))]);
  await mockSupabase(page, APPROVED);
  const accountCode = [];
  page.on('request', (r) => { if (/\/assets\/AccountPage-[\w-]+\.js$/.test(r.url()) && r.resourceType() === 'script') accountCode.push(r.url()); });
  await page.goto('/category/candies');
  await expect(page.getByRole('heading', { level: 1, name: 'Candies' })).toBeVisible();
  await page.mouse.wheel(0, 900);
  if (testInfo.project.name === 'phone') {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Quick reorder' }).click();
  } else {
    await page.getByRole('banner').getByRole('link', { name: 'Quick reorder' }).click();
  }
  await expectLandedOn(page, 'quick-reorder', 'Reorder by SKU');
  // My account's code was loaded by this click, not before it.
  expect(accountCode).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('a pending account’s View account status lands on its license documents the first time (NEW-032)', async ({ page }) => {
  const errors = trackErrors(page);
  await mockSupabase(page, PENDING);
  await page.goto('/category/candies');
  await expect(page.getByRole('heading', { level: 1, name: 'Candies' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await dialog.getByLabel('Business email').fill(PENDING.email);
  await dialog.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  const status = page.getByRole('link', { name: 'View account status' });
  await expect(status).toBeVisible();
  await status.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectLandedOn(page, 'documents', 'License documents');
  await expect(page.getByRole('heading', { level: 1, name: 'Pending Mart LLC' })).toBeVisible();
  expect(errors).toEqual([]);
});
