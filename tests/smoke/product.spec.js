// The product page (AW-235, AW-074, AW-234, AW-230, AW-231, AW-236): the
// variant chips as one required choice, adding before a choice, the SKU that
// follows the variant, the trail through the product line, the related row,
// and the photo's larger view. Products come from the seeded catalog
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

test('the variants are one required choice, adding before a choice says so, and the SKU follows the choice (AW-235, AW-074, AW-234)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/product/162');
  const group = page.getByRole('radiogroup', { name: 'Choose a variety' });
  await expect(group).toHaveAttribute('aria-required', 'true');
  await expect(page.locator('.pd-sku')).toHaveText('SKU AW-SNICKERS');
  const add = page.locator('.pd-info').getByRole('button', { name: /^Add to quote/ });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Select a variety before adding this product.' })).toBeVisible();
  await expect(group).toHaveAttribute('aria-invalid', 'true');
  await expect(group.getByRole('radio', { name: 'Regular', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  const king = group.getByRole('radio', { name: 'King size', exact: true });
  await expect(king).toBeFocused();
  await expect(king).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Select a variety before adding this product.')).toHaveCount(0);
  await expect(page.locator('.pd-sku')).toHaveText('SKU AW-SNICKERS-KING-SIZE');
  await page.keyboard.press('End');
  await expect(group.getByRole('radio', { name: 'Almond, king size' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(group.getByRole('radio', { name: 'Regular', exact: true })).toHaveAttribute('aria-checked', 'true');
  // One chip in the tab order: Tab leaves the group.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('[role="radiogroup"]')))).toBe(false);
  await add.click();
  await expect(page.locator('#aw-toasts .toast-text')).toHaveText('Added 1 × Snickers bars — Regular to your quote.');
  expect(errors).toEqual([]);
});

test('the trail names the line, and a line of one gets a row from its department (AW-230, AW-231)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/product/129');
  const trail = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(trail.getByRole('link')).toHaveText(['Home', 'All products', 'Grocery', 'Other Grocery']);
  await expect(trail.getByRole('link', { name: 'Other Grocery' })).toHaveAttribute('href', '/category/grocery/other-grocery');
  const row = page.locator('section.section').filter({ has: page.getByRole('heading', { level: 2, name: 'More from Grocery' }) });
  await expect(row.locator('.eyebrow')).toHaveText('RELATED');
  await expect(row.locator('.content-card')).toHaveCount(4);
  await expect(row.getByRole('link', { name: 'View all Grocery' })).toHaveAttribute('href', '/category/grocery');
  // Powerade big's row never shows Powerade small, which has the same photo.
  await page.goto('/product/290');
  await expect(page.locator('.content-card')).toHaveCount(4);
  await expect(page.locator('.content-card').filter({ hasText: 'Powerade small' })).toHaveCount(0);
  // A line with enough products heads its own row.
  await page.goto('/product/166');
  await expect(page.getByRole('heading', { level: 2, name: 'More Chocolate Bars' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View all Chocolate Bars' })).toHaveAttribute('href', '/category/candies/chocolate-bars');
  expect(errors).toEqual([]);
});

test('the photo opens larger, and Escape and Back close it, focus back on the photo (AW-236)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/product/162');
  const zoom = page.getByRole('button', { name: 'Enlarge photo of Snickers bars' });
  await zoom.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Photo of Snickers bars' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  const img = dialog.locator('img');
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBe(1024);
  // Never wider than its largest rendition or the screen.
  const box = await img.boundingBox();
  const viewport = page.viewportSize();
  expect(box.width).toBeLessThanOrEqual(Math.min(1024, viewport.width));
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(zoom).toBeFocused();
  await zoom.click();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/product\/162$/);
  await expect(zoom).toBeFocused();
  expect(errors).toEqual([]);
});
