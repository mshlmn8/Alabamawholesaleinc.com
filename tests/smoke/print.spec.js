// Printing (AW-148): the letterhead instead of the header, no controls, the
// FDA statement in ink, outside links followed by their address, and
// /catalog's SKU lists open on paper and closed again afterwards. page.pdf
// prints like Ctrl/Cmd+P (beforeprint and afterprint fire); the sheet counts
// are checked in the lane's PDF review, not here.
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
  return errors;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
  }, [AGE_KEY, ageRecord(Date.now())]);
});

test('a printed page has the letterhead, no header or controls, and the FDA statement in ink (AW-148)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/contact');
  await expect(page.locator('main h1')).toHaveText('Contact & visit');
  await expect(page.locator('.print-letterhead')).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-letterhead')).toBeVisible();
  await expect(page.locator('.print-letterhead')).toContainText('Alabama Wholesale Inc');
  for (const hidden of ['.site-header', '.footer-grid', '.footer-policies']) await expect(page.locator(hidden), hidden).toBeHidden();
  // No button prints: a button does something on screen only.
  await expect(page.locator('main button:visible')).toHaveCount(0);
  const warning = page.locator('footer .nicotine-warning');
  await expect(warning).toBeVisible();
  const ink = await warning.evaluate((el) => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--ink)';
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return { color: getComputedStyle(el).color, ink: color, background: getComputedStyle(el).backgroundColor };
  });
  expect(ink.color).toBe(ink.ink);
  expect(ink.background).toBe('rgba(0, 0, 0, 0)');
  // An outside link prints where it goes.
  const after = await page.locator('a[href*="google.com/maps"]').evaluate((a) => getComputedStyle(a, '::after').content);
  expect(after).toContain('https://www.google.com/maps/dir/');
  expect(errors).toEqual([]);
});

test('printing /catalog opens every SKU list and closes them again afterwards (AW-148)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/catalog');
  await expect(page.locator('main h1')).toHaveText('All products');
  const lists = page.locator('details.sku-details');
  const count = await lists.count();
  expect(count).toBeGreaterThan(5);
  // Open during the print: beforeprint fires inside page.pdf, and the app's
  // listener (installed at start-up) runs before this one.
  await page.evaluate(() => {
    window.__openDuringPrint = null;
    window.addEventListener('beforeprint', () => { window.__openDuringPrint = document.querySelectorAll('details.sku-details[open]').length; });
  });
  await page.pdf({ format: 'Letter' });
  expect(await page.evaluate(() => window.__openDuringPrint)).toBe(count);
  await expect(page.locator('details.sku-details[open]')).toHaveCount(0);
  await expect(page.locator('[data-print-opened]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
