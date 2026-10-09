// Offline in-app navigation (NEW-006, AW-344). Once the page is idle, the
// files of the support pages, Quote, My account and the sign-in dialog are
// fetched into the browser's cache; with the connection gone, links to
// /contact, /apply, /delivery, /shipping, /privacy, /terms and
// /reset-password still open their pages, and after reconnecting a page not
// opened before opens too. A page whose files weren't fetched yet says
// 'Loading…' offline and opens once the connection is back, instead of
// failing for good.
//
// No page.route or context.route here: Playwright's request routing turns
// the browser's HTTP cache off, and these pages must come from it. Supabase
// is answered inside the page instead (serveCatalogInPage), so nothing
// reaches a real project. The preview server sends netlify.toml's year-long
// Cache-Control for /assets (vite.config.js), as Netlify does.
import { test, expect } from '@playwright/test';
import { serveCatalogInPage } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    if (/Content-Security-Policy|Refused to/i.test(text)) errors.push(`csp: ${text}`);
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(text)) return; // offline requests
    errors.push(`console: ${text}`);
  });
  return errors;
}

// The file a request names: '/assets/ContactPage-abc123.js' -> 'ContactPage'.
const chunkOf = (url) => /\/assets\/([A-Za-z]+)-[\w-]+\.js$/.exec(new URL(url).pathname)?.[1] || null;
const FETCHED_AHEAD = ['QuotePage', 'AccountPage', 'AuthModal', 'ContactPage', 'DeliveryPage', 'PolicyPage', 'ApplyPage', 'ResetPasswordPage'];

const holdIdle = (page) => page.addInitScript(() => {
  window.__awIdle = [];
  window.requestIdleCallback = (cb) => window.__awIdle.push(cb);
  window.cancelIdleCallback = () => {};
});
const runIdle = (page) => page.evaluate(() => window.__awIdle.splice(0).forEach((cb) => cb({ didTimeout: false, timeRemaining: () => 50 })));
// An in-app page change with no link on screen for it: what Back and
// Forward do (the router's popstate).
const goInApp = (page, path) => page.evaluate((to) => {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, path);
const footerLink = (page, name) => page.locator('footer').getByRole('link', { name, exact: true });

test.beforeEach(async ({ context }) => {
  await serveCatalogInPage(context);
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, JSON.stringify({ ok: true, at: value })); } catch { /* storage blocked */ }
  }, [AGE_KEY, Date.now()]);
});

test('offline, the support pages still open from the cache, and after reconnecting a page not opened before opens too (NEW-006, AW-344)', async ({ page, context }) => {
  const errors = trackErrors(page);
  await holdIdle(page);
  const fetched = new Set();
  page.on('requestfinished', (r) => {
    const name = chunkOf(r.url());
    if (name && r.resourceType() === 'fetch') fetched.add(name);
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Wholesale for licensed retailers.' })).toBeVisible();
  await runIdle(page);
  await expect.poll(() => FETCHED_AHEAD.filter((name) => !fetched.has(name))).toEqual([]);

  await context.setOffline(true);
  await expect(page.locator('.site-notice[data-notice="offline"]')).toBeVisible();
  const pages = [
    ['/contact', () => footerLink(page, 'Contact & visit').click(), 'Contact & visit'],
    ['/apply', () => footerLink(page, 'Application checklist').click(), 'Apply for a trade account'],
    ['/delivery', () => footerLink(page, 'Delivery & service area').click(), 'Delivery & service area'],
    ['/shipping', () => footerLink(page, 'Delivery policy').click(), 'Delivery'],
    ['/privacy', () => footerLink(page, 'Privacy').click(), 'Privacy'],
    ['/terms', () => footerLink(page, 'Trade terms').click(), 'Trade terms'],
    ['/reset-password', () => goInApp(page, '/reset-password'), 'Reset your password'],
  ];
  for (const [path, open, title] of pages) {
    await open();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.locator('.error-fallback')).toHaveCount(0);
  }
  // Still offline: the notice is up the whole time.
  await expect(page.locator('.site-notice[data-notice="offline"]')).toBeVisible();

  await context.setOffline(false);
  await expect(page.locator('.site-notice[data-notice="offline"]')).toHaveCount(0);
  await goInApp(page, '/quote');
  await expect(page.getByRole('heading', { level: 1, name: 'Your quote is empty' })).toBeVisible();
  await goInApp(page, '/account');
  await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible();
  await expect(page.locator('.error-fallback')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('offline before its code was fetched, a page says Loading… and opens once the connection is back (NEW-006)', async ({ page, context }) => {
  const errors = trackErrors(page);
  // The idle moment never comes: nothing is fetched ahead.
  await holdIdle(page);
  await page.goto('/category/candies');
  await expect(page.getByRole('heading', { level: 1, name: 'Candies' })).toBeVisible();
  await context.setOffline(true);
  await footerLink(page, 'Contact & visit').click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.locator('main .page-loading [role="status"]')).toHaveText('Loading…');
  await expect(page.locator('.error-fallback')).toHaveCount(0);

  await context.setOffline(false);
  const heading = page.getByRole('heading', { level: 1, name: 'Contact & visit' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  // No reload was needed.
  expect(await page.evaluate(() => sessionStorage.getItem('aw-chunk-reload'))).toBeNull();
  expect(errors).toEqual([]);
});
