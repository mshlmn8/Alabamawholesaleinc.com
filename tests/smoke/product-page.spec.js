// The product page's purchase controls on common screens (AW-163, AW-150):
// the add button on the first screen of a 1366x650 laptop, the name beside a
// capped photo on a phone held sideways, the name and the add button (which
// comes before the price in the compact layout) on the first screen of a
// tablet, and no photo-sized frame around "Photo coming soon".
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const ageRecord = (at) => JSON.stringify({ ok: true, at });

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');

// Page errors, console errors and failed local requests; the console errors
// for the remote requests this spec aborts on purpose are skipped.
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

// Page-top positions of the parts that matter, at the top of the page.
const layout = (page) => page.evaluate(() => {
  const box = (selector) => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, left: r.left, right: r.right, height: r.height };
  };
  return { media: box('.pd-media'), h1: box('.pd-info h1'), add: box('.pd-info .qty-row .button'), vh: window.innerHeight };
});

test('a 1366x650 laptop shows the add button without scrolling (AW-163)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a laptop window');
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 1366, height: 650 });
  await page.goto('/product/14');
  await expect(page.locator('.pd-info').getByRole('button', { name: /^Add to quote/ })).toBeInViewport({ ratio: 1 });
  // With variants to choose, the button is at most a little below the fold.
  await page.goto('/product/162');
  await expect(page.locator('.pd-info h1')).toHaveText('Snickers bars');
  const at = await layout(page);
  expect(at.add.bottom).toBeLessThanOrEqual(at.vh + 70);
  // A vape with flavors, its FDA statement and the flavor note (now under the description) too.
  await page.goto('/product/61');
  await expect(page.locator('.pd-info h1')).toHaveText('Geek Bar Pulse X 25K');
  const vape = await layout(page);
  expect(vape.add.bottom).toBeLessThanOrEqual(vape.vh + 70);
  expect(errors).toEqual([]);
});

test('a phone held sideways shows the name and price beside a photo no taller than 45% of the screen (AW-150)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/product/162');
  await expect(page.locator('.pd-info h1')).toHaveText('Snickers bars');
  const at = await layout(page);
  expect(at.media.height).toBeLessThanOrEqual(0.45 * at.vh + 1);
  expect(at.media.right).toBeLessThan(at.h1.left);
  expect(at.h1.top).toBeLessThan(at.vh);
  expect(at.add.bottom).toBeLessThan(2 * at.vh);
  expect(errors).toEqual([]);
});

test('a tablet shows the product name and the add button on the first screen, and "Photo coming soon" in a short frame (AW-150)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/product/162');
  await expect(page.locator('.pd-info h1')).toHaveText('Snickers bars');
  const at = await layout(page);
  expect(at.media.height).toBeLessThanOrEqual(0.36 * at.vh + 1);
  expect(at.h1.bottom).toBeLessThan(at.vh);
  // The add button too, before the price, also under two rows of flavors, the FDA statement and a sell unit.
  await expect(page.locator('.pd-info').getByRole('button', { name: /^Add to quote/ })).toBeInViewport({ ratio: 1 });
  await page.goto('/product/12');
  await expect(page.locator('.pd-info h1')).toHaveText('LooseLeaf wraps 2-pack');
  await expect(page.locator('.pd-info').getByRole('button', { name: /^Add to quote/ })).toBeInViewport({ ratio: 1 });
  const order = await page.locator('.pd-info > *').evaluateAll((els) => els.map((el) => el.className.split(' ')[0]));
  expect(order.indexOf('qty-row')).toBeLessThan(order.indexOf('pd-price'));
  // A product without a photo: the placeholder's own height, not a photo frame.
  await page.goto('/product/9');
  await expect(page.locator('.pd-media .photo-soon-label')).toHaveText('Photo coming soon');
  const empty = await layout(page);
  expect(empty.media.height).toBeLessThan(250);
  expect(errors).toEqual([]);
});
