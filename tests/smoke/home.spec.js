// The home carousel shows new products, not the warehouse reel and not the
// photos staff keep in public.home_slides. The headline box is gone.
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified';
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

test('the carousel shows new products and no warehouse photo or headline box', async ({ page }) => {
  const errors = trackErrors(page);
  const slidesCalls = [];
  page.on('request', (r) => { if (/\/rest\/v1\/home_slides/.test(r.url())) slidesCalls.push(r.url()); });
  await page.goto('/');
  await expect(page.locator('.home-hero-copy')).toHaveCount(0);
  await expect(page.locator('.home-hero')).not.toContainText('WHOLESALE DISTRIBUTOR');
  await expect(page.locator('.home-carousel-slide')).toHaveCount(3);
  expect(await page.locator('.home-carousel-slide').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))).toEqual([
    '1 of 3: Foger Switch Pro full kit',
    '2 of 3: RAZ 25K',
    '3 of 3: Tueni chews',
  ]);
  const active = page.locator('.home-carousel-slide.is-active');
  await expect(active).toHaveAttribute('aria-label', '1 of 3: Foger Switch Pro full kit');
  await expect(active.getByRole('link', { name: 'Foger Switch Pro full kit' })).toHaveAttribute('href', '/product/62');
  await expect(active.locator('img')).toHaveAttribute('alt', 'Foger Switch Pro full kit');
  await expect(page.locator('.home-carousel')).not.toContainText(/loading doors|Graymont|pallet racks|Shop Food Stuff/);
  expect(slidesCalls).toEqual([]);
  expect(errors).toEqual([]);
});
