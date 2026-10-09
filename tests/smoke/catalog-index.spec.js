// All products, /catalog (AW-068, AW-069, AW-229): a row of product cards
// per department above its SKU list, line pills that wrap instead of
// scrolling sideways, jump links that land on the department's heading, and
// a search box over the whole catalog. Products come from the seeded catalog
// (./catalog.js); every other request that leaves the preview server is
// aborted.
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const ageRecord = (at) => JSON.stringify({ ok: true, at });

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
  page.on('response', (r) => { if (isLocal(r.url()) && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return errors;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
  }, [AGE_KEY, ageRecord(Date.now())]);
});

test('every department shows four product cards, its lines in full and its SKU list (AW-068, AW-069)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { level: 1, name: 'All products' })).toBeVisible();
  const sections = page.locator('.dept-section');
  await expect(sections).toHaveCount(8);
  for (const section of await sections.all()) {
    await expect(section.locator('.card-grid .content-card')).toHaveCount(4);
    await expect(section.locator('details.sku-details summary')).toHaveText(/^All \d+ .+ SKUs$/);
  }
  // The first photo loads first; the restricted lines are never a card.
  await expect(page.locator('#dept-tobacco .card-grid img').first()).toHaveAttribute('fetchpriority', 'high');
  const kickers = await page.locator('#dept-novelties .card-kicker').allTextContents();
  expect(kickers.filter((k) => /Kratom & Kava|Mushroom Products|Detox|Wellness Pills/.test(k))).toEqual([]);
  // Every line pill is on screen, starting under the heading: nothing scrolls sideways.
  const layout = await page.evaluate(() => [...document.querySelectorAll('.dept-section')].map((s) => {
    const pills = s.querySelector('.sub-pills');
    return {
      offset: Math.round(pills.querySelector('.sub-pill').getBoundingClientRect().left - s.querySelector('h2').getBoundingClientRect().left),
      hidden: pills.scrollWidth - pills.clientWidth,
    };
  }));
  expect(layout.every((l) => l.offset === 0 && l.hidden === 0), JSON.stringify(layout)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  await expect(page.getByRole('group', { name: 'Tobacco product lines' }).getByRole('link')).toHaveCount(7);
  expect(errors).toEqual([]);
});

test('a jump link lands on the department heading, and Back returns to the top (AW-229)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/catalog');
  await page.getByRole('navigation', { name: 'Jump to department' }).getByRole('link', { name: /Grocery/ }).click();
  await expect(page).toHaveURL(/\/catalog#dept-grocery$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Grocery' })).toBeFocused();
  await expect(page.getByRole('heading', { level: 2, name: 'Grocery' })).toBeInViewport();
  await page.goBack();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByRole('heading', { level: 1, name: 'All products' })).toBeInViewport();
  expect(errors).toEqual([]);
});

test('the search box searches the whole catalog', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/catalog');
  const search = page.getByRole('search', { name: 'All products' });
  await search.getByLabel('Search all products').fill('backwoods');
  await search.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/search\?q=backwoods$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Results for “backwoods”' })).toBeVisible();
  expect(errors).toEqual([]);
});
