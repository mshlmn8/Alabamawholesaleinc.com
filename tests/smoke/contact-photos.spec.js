// The contact page's warehouse photos (AW-006): the 29 photos the home
// page's reel doesn't show, in a grid that loads lazily, never widens the
// page and doesn't move as photos arrive, each opening a larger view. Every
// request that leaves the preview server is aborted; the catalog comes from
// ./catalog.js.
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const ageRecord = (at) => JSON.stringify({ ok: true, at });
const FDA = 'WARNING: This product contains nicotine. Nicotine is an addictive chemical. Not for sale to anyone under 21.';

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

test('the warehouse photos load lazily, fill their tiles without moving the page, and open larger', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  await page.goto('/contact');
  const section = page.getByRole('region', { name: 'A look around the warehouse' });
  await expect(section).toBeAttached();
  const general = section.getByRole('list', { name: 'Warehouse photos' }).getByRole('button');
  const nicotine = section.getByRole('list', { name: 'Tobacco, vapes and nicotine pouches' }).getByRole('button');
  await expect(general).toHaveCount(19);
  await expect(nicotine).toHaveCount(10);
  await expect(section.locator('img[loading="lazy"]')).toHaveCount(29);

  // Three across on a desktop, two on a phone, and no sideways scroll.
  const columns = await section.locator('.warehouse-grid').first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(testInfo.project.name === 'phone' ? 2 : 3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  // Scrolled into view, each photo loads and fills its 16:9 frame; nothing moves.
  await page.evaluate(() => {
    window.__shift = 0;
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shift += e.value; }).observe({ type: 'layout-shift' });
  });
  const tile = general.nth(4);
  await tile.scrollIntoViewIfNeeded();
  const img = tile.locator('img');
  await expect(img).toHaveJSProperty('complete', true);
  const fit = await img.evaluate((el) => {
    const frame = el.closest('.warehouse-frame').getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return { frame: [frame.width, frame.height], box: [box.width, box.height], natural: el.naturalWidth, file: Number(/--(\d+)x\d+-/.exec(el.currentSrc)[1]) };
  });
  expect(fit.natural).toBeGreaterThan(0);
  expect(Math.abs(fit.box[0] - fit.frame[0])).toBeLessThan(1.5);
  expect(Math.abs(fit.box[1] - fit.frame[1])).toBeLessThan(1.5);
  expect(Math.abs(fit.frame[0] / fit.frame[1] - 16 / 9)).toBeLessThan(0.02);
  // A tile's rendition, not the enlarged view's.
  expect(fit.file).toBeLessThanOrEqual(1000);
  expect(await page.evaluate(() => window.__shift)).toBe(0);

  // The nicotine group carries the statement above its photos.
  await expect(section.locator('.warehouse-group .nicotine-warning')).toHaveText(FDA);

  // Larger: the dialog keeps one size from photo to photo, and Escape
  // closes it back to the tile.
  // (The page behind the dialog is inert and hidden from the accessibility
  // tree, so the tile's name is read first.)
  const description = await tile.textContent();
  await tile.click();
  const dialog = page.getByRole('dialog', { name: 'Warehouse photos' });
  await expect(dialog).toBeVisible();
  const large = dialog.locator('.warehouse-viewer-frame img');
  await expect(large).toHaveAttribute('alt', description);
  await expect(large).toHaveJSProperty('complete', true);
  expect(await large.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
  // Measured once its opening animation is over.
  await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const before = await dialog.boundingBox();
  await dialog.getByRole('button', { name: 'Next photo' }).click();
  await expect(dialog.locator('.warehouse-viewer-count')).toHaveText('6 of 19');
  expect(await dialog.boundingBox()).toEqual(before);
  // The whole dialog is on the screen.
  const viewport = page.viewportSize();
  expect(before.y).toBeGreaterThanOrEqual(0);
  expect(before.y + before.height).toBeLessThanOrEqual(viewport.height);
  expect(before.x + before.width).toBeLessThanOrEqual(viewport.width);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(tile).toBeFocused();
  await expect(tile).toHaveText(description);
  expect(errors).toEqual([]);
});
