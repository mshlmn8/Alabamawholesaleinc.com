// Storefront smoke test: the built site boots, passes the age gate and renders
// the main pages without console or page errors. Every request that leaves
// the preview server (Supabase included) is aborted, so the catalog falls back
// to the bundled static data and nothing is ever written anywhere.
//
// Routes are still hash routes; the path router (AW-043) updates these.
import { test, expect } from '@playwright/test';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');

// Collects page errors, console errors and failed local requests. The browser
// logs a console error for each remote request this spec aborts on purpose;
// those are expected and skipped.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const source = m.location()?.url || '';
    if (source && !isLocal(source) && /Failed to load resource/.test(m.text())) return;
    errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => { if (isLocal(r.url()) && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return errors;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
});

test('first visit shows the age gate, and confirming reveals the storefront', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  const gate = page.getByRole('dialog', { name: /21 or older/i });
  await expect(gate).toBeVisible();
  await page.getByRole('button', { name: /Yes, I am 21\+/ }).click();
  await expect(gate).toBeHidden();
  await expect(page.getByRole('search')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), AGE_KEY)).toBe('yes');
  expect(errors).toEqual([]);
});

test.describe('after age confirmation', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript((key) => {
      try { localStorage.setItem(key, 'yes'); } catch { /* storage blocked */ }
    }, AGE_KEY);
  });

  const pages = [
    { name: 'department', hash: '#/category/TOBACCO', heading: 'Tobacco' },
    { name: 'product', hash: '#/product/12', heading: /\S/ },
    { name: 'empty checkout', hash: '#/quote', heading: 'Your cart is empty' },
    { name: 'all products', hash: '#/catalog', heading: 'All products' },
    { name: 'contact', hash: '#/contact', heading: /Contact/ },
    { name: 'privacy policy', hash: '#/privacy', heading: 'Privacy' },
  ];

  for (const { name, hash, heading } of pages) {
    test(`${name} page renders`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/${hash}`);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page).toHaveTitle(/Alabama Wholesale/);
      expect(errors).toEqual([]);
    });
  }

  test('header search lists matching products', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search products' }).fill('wraps');
    await expect(page.getByRole('status').filter({ hasText: /result/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

// Static boot shell in index.html (AW-193): something useful shows before the
// bundle runs, when it fails, and without JavaScript.
test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the noscript message with the trade desk contacts', async ({ page }) => {
    await page.goto('/');
    // Playwright's text engine skips <noscript>, so these use CSS locators.
    const message = page.locator('noscript .boot');
    await expect(message).toBeVisible();
    await expect(message).toContainText('This catalog needs JavaScript');
    await expect(message.locator('a[href^="tel:"]')).toBeVisible();
    await expect(message.locator('a[href^="mailto:"]')).toBeVisible();
    await expect(page.locator('#root .boot')).toBeHidden();
  });
});

test('if the app bundle fails to load, the loading shell stays and then offers the phone line', async ({ page }) => {
  await page.clock.install();
  await page.route(/\/assets\/index-[^/]*\.js$/, (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Loading the wholesale catalog' })).toBeVisible();
  await expect(page.getByText('Trouble loading?')).toBeHidden();
  await page.clock.runFor(8000);
  await expect(page.getByText('Trouble loading?')).toBeVisible();
  await expect(page.locator('#root a[href^="tel:"]')).toBeVisible();
});

test('the app replaces the loading shell once it renders', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: /21 or older/i })).toBeVisible();
  await expect(page.locator('#root .boot')).toHaveCount(0);
  expect(errors).toEqual([]);
});
