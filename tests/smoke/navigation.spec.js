// The navigation around every page (AW-062, AW-221, AW-220): the Categories
// menu fits the window with its close button and footer link in view, the
// links to the page on screen are marked, and Help's links leave the dialog
// behind without an extra history entry. Products come from the seeded
// catalog (./catalog.js); every other request that leaves the preview server
// is aborted.
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

test.describe('the Categories menu (AW-062)', () => {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 932, height: 430 }]) {
    test(`fits a ${viewport.width}x${viewport.height} window, and keeps its close button and footer link in view as it scrolls`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'phone', 'the Categories menu is desktop only');
      const errors = trackErrors(page);
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.getByRole('button', { name: 'Categories', exact: true }).click();
      const menu = page.locator('#aw-mega-menu');
      await expect(menu).toBeVisible();
      const box = await menu.boundingBox();
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      // The biggest lines first: Wraps & Leafs (22) leads Tobacco.
      await expect(menu.getByRole('group', { name: 'Tobacco' }).getByRole('link').first()).toHaveText('Wraps & Leafs');
      const catalog = menu.getByRole('link', { name: 'View full catalog' });
      const close = menu.getByRole('button', { name: 'Close categories' });
      await expect(catalog).toBeInViewport({ ratio: 1 });
      // With the shorter header (AW-153) the whole menu can fit: it scrolls
      // only when it is taller than the room it has.
      if (await menu.evaluate((el) => el.scrollHeight > el.clientHeight + 1)) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 400);
        await expect.poll(() => menu.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      }
      for (const control of [close, catalog]) {
        // On screen and not covered by the departments scrolling under it.
        await expect(control).toBeInViewport({ ratio: 1 });
        expect(await control.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
        })).toBe(true);
      }
      await close.click();
      await expect(menu).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
});

test('the header and footer mark the page on screen (AW-221)', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  const phone = testInfo.project.name === 'phone';
  const footerDept = page.locator('footer').getByRole('link', { name: /^Novelties & Vapes \(\d+\)$/ });
  await page.goto('/category/novelties');
  await expect(footerDept).toHaveAttribute('aria-current', 'page');
  if (!phone) await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Exotics' })).toHaveAttribute('aria-current', 'page');
  await page.goto('/category/novelties/disposable-vapes');
  await expect(footerDept).toHaveAttribute('aria-current', 'true');
  if (phone) {
    await page.getByRole('button', { name: 'Menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu.getByRole('link', { name: 'Exotics' })).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Escape');
  } else {
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Exotics' })).toHaveAttribute('aria-current', 'true');
  }
  await page.goto('/terms');
  await expect(page.locator('footer').getByRole('link', { name: 'Trade terms' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('footer [aria-current]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('a Help link opens its page, and Back returns to the page Help was opened on (AW-220)', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  await page.goto('/category/tobacco');
  if (testInfo.project.name === 'phone') {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Help' }).click();
  } else {
    // The header's; the footer has a Help button too (AW-285).
    await page.getByRole('banner').getByRole('button', { name: /^Help/ }).click();
  }
  const help = page.getByRole('dialog', { name: 'Talk to the warehouse' });
  await expect(help.locator('.eyebrow, .kicker')).toHaveText(['ACCOUNT SERVICE']);
  await help.getByRole('navigation', { name: 'Help pages' }).getByRole('link', { name: 'Delivery & service area' }).click();
  await expect(page).toHaveURL(/\/delivery$/);
  await expect(help).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/category\/tobacco$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Back and Forward (NEW-007, NEW-028): Back puts focus on the product card
// the visitor left from, where the scroll position comes back to, so the
// next Tab carries on there instead of jumping to the page head; and Forward
// onto the entry of a dialog Back already closed adds no dead stop: the next
// Back leaves the page.
test('Back puts focus on the card the visitor left from, and the next Tab stays there (NEW-007)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/category/candies');
  await expect(page.getByRole('heading', { level: 1, name: 'Candies' })).toBeVisible();
  const card = page.locator('main a.card-link').nth(9);
  const href = await card.getAttribute('href');
  await card.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 300);
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/category\/candies$/);
  await expect(card).toBeFocused();
  await expect(card).toBeInViewport();
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(0);
  await page.keyboard.press('Tab');
  // The card's own control, not the page's first pill near the top.
  const next = page.locator(':focus');
  await expect(next).toBeInViewport();
  expect(await next.evaluate((el, link) => !!el.closest('article, li, .content-card')?.contains(link), await card.elementHandle())).toBe(true);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - y)).toBeLessThan(300);
  expect(errors).toEqual([]);
});

test('Forward onto a dialog Back closed leaves no dead stop: the next Back leaves the page (NEW-028)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/category/tobacco');
  await expect(page.getByRole('heading', { level: 1, name: 'Tobacco' })).toBeVisible();
  await page.locator('footer').getByRole('link', { name: /^Candies \(\d+\)$/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Candies' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/category\/candies$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/category\/candies$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.history.state?.awOverlay ?? null)).toBeNull();
  await page.goBack();
  await expect(page).toHaveURL(/\/category\/tobacco$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Tobacco' })).toBeVisible();
  expect(errors).toEqual([]);
});
