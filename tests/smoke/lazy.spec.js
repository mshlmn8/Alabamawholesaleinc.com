// Code that loads on demand (AW-179): the account, admin, quote and support
// pages and the sign-in dialog are files of their own. The home page
// downloads none of them until the page is idle, and then only with fetch()
// into the browser's cache, never import() (NEW-006); a page opened from a
// link shows a loading view, then takes focus on its heading; a dropped
// fetch-ahead doesn't stop its page from opening; a page whose file fails
// once reloads by itself and opens; and a file that still can't be
// downloaded after that (an old deploy, a dropped connection) says so with
// Reload, keeping the header and footer. Every Supabase request is answered
// here or aborted; the preview server sends the real Content-Security-Policy,
// and any violation fails the test. (Offline navigation, which needs the
// HTTP cache Playwright's routing turns off, is in offline.spec.js.)
import { test, expect } from '@playwright/test';
import { fulfillProducts, seedRows, serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const AUTH_KEY = 'aw-auth'; // AUTH_STORAGE_KEY in src/lib/supabase.js
const ageRecord = (at) => JSON.stringify({ ok: true, at });
const UID = '11111111-2222-4333-8444-555555555555';
const ADMIN = { id: UID, name: 'Test Admin', business: 'Alabama Wholesale', email: 'admin@example.test', phone: '205-555-0100', status: 'approved', role: 'admin', pricing_tier: null };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = { id: UID, aud: 'authenticated', role: 'authenticated', email: ADMIN.email, app_metadata: { provider: 'email' }, user_metadata: {} };
function savedSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp, email: ADMIN.email })}.c2ln`;
  return { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'smoke-refresh', user: USER };
}

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');
// The file a code request names: '/assets/AdminPage-abc123.js' -> 'AdminPage'.
const chunkOf = (url) => /\/assets\/([A-Za-z]+)-[\w-]+\.js$/.exec(new URL(url).pathname)?.[1] || null;

// Errors, and every Content-Security-Policy report, fail a test; `expected`
// lists console errors a test causes on purpose.
function trackErrors(page, expected = []) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    if (/Content-Security-Policy|Refused to/i.test(text)) errors.push(`csp: ${text}`);
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(text)) return; // requests this spec aborts on purpose
    if (expected.some((re) => re.test(text))) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

// What a failed download logs: the error boundary's line and the error.
const NOT_LOADED = [/A page failed to render/, /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/];

// Idle callbacks wait until the test runs them, so "before idle" is a state
// the test controls rather than a race.
const holdIdle = (page) => page.addInitScript(() => {
  window.__awIdle = [];
  window.requestIdleCallback = (cb) => window.__awIdle.push(cb);
  window.cancelIdleCallback = () => {};
});
const runIdle = (page) => page.evaluate(() => window.__awIdle.splice(0).forEach((cb) => cb({ didTimeout: false, timeRemaining: () => 50 })));

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
  }, [AGE_KEY, ageRecord(Date.now())]);
});

// What the idle fetch-ahead brings into the cache for a guest (NEW-006).
const FETCHED_AHEAD = ['QuotePage', 'AccountPage', 'AuthModal', 'ContactPage', 'DeliveryPage', 'PolicyPage', 'ApplyPage', 'ResetPasswordPage'];

test('the home page fetches the account, quote, sign-in and support code into the cache only once it is idle, never Admin for a guest, and imports none of it', async ({ page }) => {
  const errors = trackErrors(page);
  await holdIdle(page);
  const chunks = [];
  page.on('request', (r) => { const name = chunkOf(r.url()); if (name) chunks.push({ name, type: r.resourceType() }); });
  const named = () => chunks.map((c) => c.name);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Wholesale for licensed retailers.' })).toBeVisible();
  await expect(page).toHaveTitle('Wholesale Tobacco, Vapes & Candy · Alabama Wholesale Inc');
  // After the load event the app asks for an idle moment; nothing loaded yet.
  await expect.poll(() => page.evaluate(() => window.__awIdle.length)).toBeGreaterThan(0);
  expect(named()).toEqual(expect.arrayContaining(['index']));
  for (const name of ['AdminPage', ...FETCHED_AHEAD]) expect([name, named().includes(name)]).toEqual([name, false]);

  await runIdle(page);
  await expect.poll(() => FETCHED_AHEAD.every((name) => named().includes(name))).toBe(true);
  expect(named()).not.toContain('AdminPage');
  // fetch(), never a module script or <link rel=modulepreload>: a failed
  // one of those would keep its page from opening until a reload.
  for (const { name, type } of chunks.filter((c) => FETCHED_AHEAD.includes(c.name))) expect([name, type]).toEqual([name, 'fetch']);
  expect(await page.locator('link[rel="modulepreload"], link[rel="prefetch"]').evaluateAll((links) => links.map((l) => l.href).filter((h) => !/\/(vendor|supabase)-/.test(h)))).toEqual([]);
  expect(errors).toEqual([]);
});

test('a dropped fetch-ahead of the quote page’s code doesn’t stop the quote page from opening (NEW-006)', async ({ page }) => {
  const errors = trackErrors(page);
  await holdIdle(page);
  const quoteRequests = [];
  // Only the idle fetch fails; the page's own import() later goes through.
  await page.route(/\/assets\/QuotePage-[\w-]+\.js$/, (route) => {
    const type = route.request().resourceType();
    quoteRequests.push(type);
    return type === 'fetch' ? route.abort() : route.continue();
  });
  await page.goto('/product/14');
  await runIdle(page);
  await expect.poll(() => quoteRequests).toEqual(['fetch']);
  await page.locator('.pd-info').getByRole('button', { name: /^Add to (quote|order)/ }).click();
  await page.getByRole('button', { name: /^Quote, 1 item$/ }).click();
  await page.getByRole('link', { name: 'Review quote' }).click();
  await expect(page).toHaveURL(/\/quote$/);
  const heading = page.getByRole('heading', { level: 1, name: 'Request a quote' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.locator('.error-fallback')).toHaveCount(0);
  expect(quoteRequests).toEqual(['fetch', 'script']);
  expect(errors).toEqual([]);
});

test('a page whose code fails to download once reloads by itself and opens (NEW-006)', async ({ page }) => {
  const errors = trackErrors(page);
  let failed = 0;
  await page.route(/\/assets\/ContactPage-[\w-]+\.js$/, (route) => {
    if (route.request().resourceType() === 'script' && failed === 0) {
      failed += 1;
      return route.abort();
    }
    return route.continue();
  });
  let loads = 0;
  page.on('load', () => { loads += 1; });
  await page.goto('/category/candies');
  await expect(page.getByRole('heading', { level: 1, name: 'Candies' })).toBeVisible();
  await page.locator('footer').getByRole('link', { name: 'Contact & visit', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Contact & visit' })).toBeVisible();
  await expect(page).toHaveURL(/\/contact$/);
  expect(failed).toBe(1);
  expect(loads).toBe(2);
  // The page that rendered cleared the one-reload flag.
  expect(await page.evaluate(() => sessionStorage.getItem('aw-chunk-reload'))).toBeNull();
  expect(errors).toEqual([]);
});

test('a page opened from a link shows the loading view, then its heading takes focus', async ({ page }) => {
  const errors = trackErrors(page);
  await holdIdle(page);
  // A slow download, so the loading view is on screen for a moment.
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route(/\/assets\/DeliveryPage-[\w-]+\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Wholesale for licensed retailers.' })).toBeVisible();
  await page.locator('footer').getByRole('link', { name: 'Delivery & service area' }).click();
  await expect(page).toHaveURL(/\/delivery$/);
  await expect(page.locator('main .page-loading [role="status"]')).toHaveText('Loading…');
  await expect(page.locator('main h1')).toHaveCount(0);
  // The title is already the new page's, and <main> holds focus meanwhile.
  await expect(page).toHaveTitle(/^Delivery & service area · /);
  await expect(page.locator('main#main')).toBeFocused();
  release();
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.locator('.page-loading')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the sign-in dialog opens after its code arrives, and says so when it can’t (AW-179)', async ({ page }) => {
  const errors = trackErrors(page, NOT_LOADED);
  await holdIdle(page);
  let fail = false;
  await page.route(/\/assets\/AuthModal-[\w-]+\.js$/, (route) => (fail ? route.abort() : route.continue()));
  await page.goto('/contact');
  await expect(page.getByRole('heading', { level: 1, name: /Contact/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sign In' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Sign in' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Business email')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A fresh page whose dialog code can't be downloaded.
  fail = true;
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Contact/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sign In' }).first().click();
  const failed = page.getByRole('alertdialog', { name: 'This didn’t open' });
  await expect(failed).toBeVisible();
  await expect(failed).toContainText('The site may have been updated, or the connection dropped.');
  await expect(failed.getByRole('button', { name: 'Reload' })).toBeFocused();
  await failed.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: /Contact/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Admin whose code can’t be downloaded says so, with Reload, inside the header and footer (AW-179)', async ({ page, context }) => {
  const errors = trackErrors(page, NOT_LOADED);
  await context.addInitScript(([key, value]) => {
    try {
      if (!sessionStorage.getItem('smoke-admin')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('smoke-admin', '1');
      }
    } catch { /* storage blocked */ }
  }, [AUTH_KEY, JSON.stringify(savedSession())]);
  await page.route(/supabase\.co\//, (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/auth\/v1\/user/.test(url)) return route.fulfill({ json: USER });
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return route.fulfill({ json: [ADMIN] });
    if (/\/rest\/v1\/products/.test(url)) return fulfillProducts(route, seedRows());
    return route.abort();
  });
  const adminChunks = [];
  await page.route(/\/assets\/AdminPage-[\w-]+\.js$/, (route) => {
    adminChunks.push(route.request().url());
    return route.abort();
  });
  let loads = 0;
  page.on('load', () => { loads += 1; });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1, name: 'This page didn’t load' })).toBeVisible();
  // It reloaded once by itself first (NEW-006), and says so only after that.
  expect(loads).toBe(2);
  expect(await page.evaluate(() => sessionStorage.getItem('aw-chunk-reload'))).toBe('/admin');
  const alert = page.getByRole('alert').filter({ hasText: 'This page didn’t load' });
  await expect(alert).toContainText('The site may have been updated, or the connection dropped.');
  await expect(alert.getByRole('button', { name: 'Reload' })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(page).toHaveTitle(/Admin · Alabama Wholesale Inc$/);
  expect(adminChunks.length).toBeGreaterThan(0);

  // Leaving the page clears the message; the storefront still works.
  await page.goto('/category/tobacco');
  await expect(page.getByRole('heading', { level: 1, name: 'Tobacco' })).toBeVisible();
  expect(errors).toEqual([]);
});
