// Kratom & Kava and every mushroom product are off the site (AW-001, the
// owner's answer of 2026-10). The catalog served here is the live database
// before 20261014100000_delist_kratom_mushroom.sql: the 22 rows still active.
// The storefront leaves them out anyway, the lines' old addresses land on
// Novelties (a 301 from the server, then the app for any other spelling),
// and nothing on the home page, in the menus, in All products or in search
// names them. Every request that leaves the preview server is aborted.
import { test, expect } from '@playwright/test';
import { seedRows, serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const ageRecord = (at) => JSON.stringify({ ok: true, at });
const DELISTED = /kratom|\bkava\b|mushroom|shroom/i;

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const source = m.location()?.url || '';
    if (source && !isLocal(source) && /Failed to load resource/.test(m.text())) return;
    errors.push(`console: ${m.text()}`);
  });
  return errors;
}

// The live table until the migration is applied: every seeded row active.
const liveRows = () => seedRows().map((row) => ({ ...row, active: true }));

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context, { rows: liveRows });
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
  }, [AGE_KEY, ageRecord(Date.now())]);
});

test('the delisted lines\' old addresses move to Novelties, with a 301 from the server (AW-001)', async ({ page, request }) => {
  const errors = trackErrors(page);
  for (const slug of ['kratom-and-kava', 'mushroom-products']) {
    const res = await request.get(`/category/novelties/${slug}?sort=name-asc`, { maxRedirects: 0 });
    expect(res.status(), slug).toBe(301);
    expect(res.headers().location, slug).toBe('/category/novelties?sort=name-asc');
    await page.goto(`/category/novelties/${slug}`);
    await expect(page).toHaveURL(/\/category\/novelties$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Novelties/i);
  }
  // Another spelling, as the old hash links had it: the app redirects it.
  await page.goto('/#/category/NOVELTIES/Kratom%20%26%20Kava');
  await expect(page).toHaveURL(/\/category\/novelties$/);
  // The line pills name neither line, and a delisted product is not found.
  const pills = await page.locator('.sub-pills').first().textContent();
  expect(pills).not.toMatch(DELISTED);
  await expect(page.locator('main')).not.toContainText(DELISTED);
  expect(errors).toEqual([]);
  // The build wrote no page for it: the server answers 404 (NEW-088), and
  // the app says so.
  const res = await page.goto('/product/75');
  expect(res.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/not found/i);
});

test('nothing on the home page, the Categories menu, All products or search names them (AW-001)', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('#new-arrivals .content-card').first()).toBeVisible();
  await expect(page.locator('main')).not.toContainText(DELISTED);
  await expect(page.getByRole('heading', { name: /Disposables, detox,\s*hookah & more\./ })).toBeVisible();
  if (testInfo.project.name !== 'phone') {
    await page.getByRole('banner').getByRole('button', { name: 'Categories' }).click();
    const menu = page.locator('#aw-mega-menu');
    await expect(menu).toBeVisible();
    await expect(menu).not.toContainText(DELISTED);
    await page.keyboard.press('Escape');
  }
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { level: 1, name: 'All products' })).toBeVisible();
  // The SKU lists inside the closed disclosures count too.
  expect(await page.locator('main').evaluate((el) => el.textContent)).not.toMatch(DELISTED);
  for (const q of ['kratom', 'mushroom']) {
    await page.goto(`/search?q=${q}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(q);
    await expect(page.locator('main .content-card')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
