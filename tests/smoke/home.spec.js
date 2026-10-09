// The home page's hero photos from Admin -> Homepage (AW-119): the photos
// staff keep in public.home_slides replace the bundled ones once loaded, a
// photo with the nicotine flag carries the FDA statement, and a database
// without the table (the live project until 20261011131000 is applied) keeps
// the bundled photos without a page error. While the first load is pending
// the photos' box is held empty, so a quick answer never shows the bundled
// photos first, and no photos leave an empty panel beside the headline, so
// nothing moves however late the answer comes (NEW-008).
// The catalog and home_slides come from ./catalog.js; every other request
// that leaves the preview server is aborted.
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { fulfillHomeSlides, serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const ageRecord = (at) => JSON.stringify({ ok: true, at });
// The statement NicotineWarning prints (NICOTINE_WARNING_TEXT), as storefront.spec.js has it.
const FDA = 'WARNING: This product contains nicotine. Nicotine is an addictive chemical. Not for sale to anyone under 21.';

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');

// Page errors, console errors and failed local requests. The browser logs a
// console error for each remote request aborted or answered 404 on purpose
// (the missing home_slides table); those are expected and skipped.
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

const STORAGE = 'https://abcdefgh.supabase.co/storage/v1/object/public/product-images/home/1760000000000-display.jpg';
const slide = (id, img, alt, goCat, extra = {}) => ({ id, img, alt, go_cat: goCat, nicotine_warning: false, sort: id * 10, active: true, ...extra });

// `delay` holds the home_slides answer that many milliseconds.
async function open(context, page, homeSlides, { photos = {}, delay = 0 } = {}) {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  // Uploaded photos, served from a bundled file (registered after the abort, so they win).
  for (const [url, file] of Object.entries(photos)) {
    await context.route(url, (route) => route.fulfill({ path: fileURLToPath(new URL(`../../src/assets/${file}`, import.meta.url)), contentType: 'image/jpeg' }));
  }
  const slidesCalls = [];
  await serveCatalog(context, { homeSlides: () => homeSlides });
  if (delay) {
    await context.route(/\/rest\/v1\/home_slides/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fulfillHomeSlides(route, homeSlides);
    });
  }
  context.on('request', (r) => { if (/\/rest\/v1\/home_slides/.test(r.url())) slidesCalls.push(r.url()); });
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
    // Layout shifts not caused by the visitor (CLS).
    window.__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* no layout-shift entries in this browser */ }
    // Every photo the hero has drawn, frame by frame (the collection card
    // further down uses a hero file too, so requests can't tell).
    window.__heroPhotos = [];
    const look = () => {
      for (const img of document.querySelectorAll('.home-hero img')) {
        const name = (/\/(hero_[a-z]+)--/.exec(img.currentSrc || img.src) || [])[1];
        if (name && !window.__heroPhotos.includes(name)) window.__heroPhotos.push(name);
      }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }, [AGE_KEY, ageRecord(Date.now())]);
  const errors = trackErrors(page);
  await page.goto('/');
  const heroPhotos = () => page.evaluate(() => window.__heroPhotos);
  return { errors, slidesCalls, heroPhotos };
}

const labels = (page) => page.locator('.home-carousel-slide').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));

test('the photos staff keep replace the bundled ones, in their order, with the FDA statement on the flagged one', async ({ context, page }) => {
  const { errors, slidesCalls } = await open(context, page, [
    slide(1, 'hero_lighters.jpg', 'BIC lighters in a counter display tray', 'MERCHANDISE'),
    slide(2, 'hero_vape.jpg', 'Geek Bar Pulse X disposable vape advertisement', 'NOVELTIES', { nicotine_warning: true }),
    slide(3, 'hero_candy.jpg', 'Display box of Turtles Bites chocolates', 'CANDIES', { active: false }),
  ]);
  await expect.poll(() => labels(page)).toEqual(['1 of 2: Merchandise', '2 of 2: Novelties & Vapes']);
  const carousel = page.locator('.home-carousel');
  await expect(carousel.locator('.home-carousel-slide.is-active img')).toHaveAttribute('alt', 'BIC lighters in a counter display tray');
  await expect(carousel.getByRole('link', { name: 'Shop Merchandise' })).toHaveAttribute('href', '/category/merchandise');
  const warning = carousel.locator('.nicotine-warning');
  await expect(warning).toBeHidden();
  await carousel.getByRole('button', { name: 'Next slide' }).click();
  await expect(warning).toBeVisible();
  await expect(warning).toHaveText(FDA);
  expect(slidesCalls).toHaveLength(1);
  // Another visit to the home page in the same session doesn't load them again.
  await page.getByRole('link', { name: 'Browse the catalog' }).first().click();
  await expect(page).toHaveURL(/\/catalog$/);
  await page.goBack();
  await expect.poll(() => labels(page)).toEqual(['1 of 2: Merchandise', '2 of 2: Novelties & Vapes']);
  expect(slidesCalls).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('a photo without a department is named by its alt text, and an uploaded photo shows by its address', async ({ context, page }) => {
  const { errors } = await open(context, page, [
    slide(1, STORAGE, 'Gatorade bottles on a shelf', null),
    slide(2, 'hero_candy.jpg', 'Display box of Turtles Bites chocolates', 'CANDIES'),
  ], { photos: { [STORAGE]: 'hero_gatorade.jpg' } });
  await expect.poll(() => labels(page)).toEqual(['1 of 2: Gatorade bottles on a shelf', '2 of 2: Candies']);
  const active = page.locator('.home-carousel-slide.is-active');
  await expect(active.locator('img')).toHaveAttribute('src', STORAGE);
  await expect(active.locator('img')).toHaveJSProperty('complete', true);
  expect(await active.locator('img').evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(active.getByRole('link')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show slide 1: Gatorade bottles on a shelf' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('with every photo turned off an empty panel keeps the photos\' place, so nothing moves even when the answer is late', async ({ context, page }) => {
  const { errors, heroPhotos } = await open(context, page, [slide(1, 'hero_candy.jpg', 'Display box of Turtles Bites chocolates', 'CANDIES', { active: false })], { delay: 1200 });
  // Past the first-paint budget the bundled photos show, then the answer comes.
  await expect(page.locator('.home-carousel-slide.is-active img')).toHaveAttribute('alt', 'Display box of Turtles Bites chocolates');
  const before = await page.locator('.home-hero-copy').boundingBox();
  const panel = page.locator('.home-hero-media > .home-carousel.is-empty');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('section.home-carousel')).toHaveCount(0);
  await expect(page.locator('.home-hero').getByRole('heading', { level: 1, name: 'Wholesale for licensed retailers.' })).toBeVisible();
  // The copy kept its place and size, and the page didn't move.
  expect(await page.locator('.home-hero-copy').boundingBox()).toEqual(before);
  expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1);
  expect(await heroPhotos()).toContain('hero_candy');
  expect(errors).toEqual([]);
});

test('a quick answer replaces the bundled photos before any of them shows', async ({ context, page }) => {
  const { errors, heroPhotos } = await open(context, page, [slide(1, 'hero_lighters.jpg', 'BIC lighters in a counter display tray', 'MERCHANDISE')], { delay: 50 });
  await expect(page.locator('.home-carousel-slide.is-active img')).toHaveAttribute('alt', 'BIC lighters in a counter display tray');
  await expect(page.locator('.home-carousel-slide')).toHaveCount(1);
  // Only staff's photo was ever in the hero: the bundled first slide never showed.
  expect(await heroPhotos()).toEqual(['hero_lighters']);
  expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1);
  expect(errors).toEqual([]);
});

test('without the table the bundled photos stay, with no page error', async ({ context, page }) => {
  const { errors, slidesCalls } = await open(context, page, null);
  await expect.poll(() => slidesCalls.length).toBe(1);
  await expect.poll(() => labels(page)).toEqual(['1 of 4: Candies', '2 of 4: Novelties & Vapes', '3 of 4: Merchandise', '4 of 4: Drinks & Bags']);
  await expect(page.locator('.home-carousel-slide.is-active img')).toHaveAttribute('alt', 'Display box of Turtles Bites chocolates');
  expect(errors).toEqual([]);
});
