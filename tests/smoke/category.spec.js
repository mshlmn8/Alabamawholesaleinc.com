// Department and line pages (AW-067, AW-225, AW-223, AW-226): the brand
// filter, line counts that follow the filters, the line choice in the phone
// drawer, Back to top, and line pages headed by the line. Products come from
// the seeded catalog (./catalog.js); every other request that leaves the
// preview server is aborted.
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

test('a brand filter narrows the department, and the line counts follow it (AW-067, AW-225)', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  const phone = testInfo.project.name === 'phone';
  await page.goto('/category/tobacco');
  if (phone) await page.getByRole('button', { name: /Filter & Sort/ }).click();
  const brands = page.getByRole('group', { name: 'Brand' });
  await expect(brands.getByRole('checkbox')).toHaveCount(8);
  await expect(brands.getByRole('checkbox', { name: /Assorted/ })).toHaveCount(0);
  await brands.getByRole('checkbox', { name: /^Swisher Sweets \(6\)$/ }).check();
  await expect(page).toHaveURL(/\/category\/tobacco\?brand=swisher-sweets$/);
  if (phone) {
    // The drawer's line choice counts within the brand, and moves to the line.
    const lines = page.getByRole('dialog').getByRole('group', { name: 'Product line' });
    await expect(lines.getByRole('radio', { name: 'Wraps & Leafs (2)' })).toBeVisible();
    await lines.getByRole('radio', { name: 'Wraps & Leafs (2)' }).check();
    await expect(page).toHaveURL(/\/category\/tobacco\/wraps-and-leafs\?brand=swisher-sweets$/);
    // Back closes the drawer and keeps the line.
    await page.goBack();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page).toHaveURL(/\/category\/tobacco\/wraps-and-leafs\?brand=swisher-sweets$/);
  } else {
    await expect(page.locator('.result-note')).toHaveText('Showing 6 of 68 products');
    await expect(page.getByRole('link', { name: 'Cigarettes (0)' })).toHaveClass(/is-empty/);
    await page.getByRole('link', { name: 'Wraps & Leafs (2)' }).click();
  }
  await expect(page.locator('.result-note')).toHaveText('Showing 2 of 22 products in Wraps & Leafs');
  await expect(page.getByRole('button', { name: 'Remove filter Brand: Swisher Sweets' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a line page is headed by the line, and its trail leads back to the department (AW-226, AW-325)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/category/tobacco/cigars-and-cigarillos');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cigars & Cigarillos');
  await expect(page.locator('.page-head .eyebrow')).toHaveText('Tobacco · 21 products');
  const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(trail.locator('li > *')).toHaveText(['Home', 'All products', 'Tobacco', 'Cigars & Cigarillos']);
  const cases = await trail.locator('li > *').evaluateAll((els) => els.map((el) => getComputedStyle(el).textTransform));
  expect(cases).toEqual(['uppercase', 'uppercase', 'uppercase', 'uppercase']);
  await trail.getByRole('link', { name: 'Tobacco' }).click();
  await expect(page).toHaveURL(/\/category\/tobacco$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tobacco');
  expect(errors).toEqual([]);
});

test('Back to top appears on a long department page and returns focus to the heading (AW-223)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/category/tobacco');
  const button = page.getByRole('button', { name: 'Back to top' });
  await expect(button).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 2000, behavior: 'instant' }));
  await expect(button).toBeVisible();
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.waitForFunction(() => window.scrollY === 0);
  await expect(button).toHaveCount(0);
  // At the foot of the page it never covers the footer and its FDA warning.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(200);
  const clear = await page.evaluate(() => {
    const b = document.querySelector('.back-to-top');
    return !b || b.getBoundingClientRect().bottom <= document.querySelector('footer').getBoundingClientRect().top;
  });
  expect(clear).toBe(true);
  expect(errors).toEqual([]);
});
