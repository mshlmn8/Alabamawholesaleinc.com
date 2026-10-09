// The cart drawer's layout (AW-152, AW-306, AW-299): on a phone on its side
// the lines keep at least half the drawer, each line's Remove is a worded
// button well below the drawer's round close ×, and an empty cart offers the
// catalog and nothing else. Kept apart from cart.spec.js, which other work
// edits. Every request that leaves the preview server is aborted, except the
// products request, which gets the seeded catalog (./catalog.js).
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const GUEST_CART = 'aw-cart-v2:guest'; // cartKey('guest') in src/lib/cartStorage.js
const ageRecord = (at) => JSON.stringify({ ok: true, at });
// Five products without variants, so each is one plain line.
const FIVE_LINES = { 14: 2, 25: 1, 26: 3, 30: 1, 45: 2 };

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

// The header's cart button, by its class: its spoken label is other work's (AW-240).
const cartButton = (page) => page.locator('.aw-cart-btn');

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
  }, [AGE_KEY, ageRecord(Date.now())]);
});

// The drawer's parts, measured in the page.
const measure = (page) => page.evaluate(() => {
  const box = (selector) => document.querySelector(selector)?.getBoundingClientRect();
  const close = box('.drawer-head .icon-btn');
  const remove = box('.drawer-line .drawer-remove');
  return {
    drawer: box('.drawer').height,
    head: box('.drawer-head').height,
    body: document.querySelector('.drawer-body').clientHeight,
    foot: box('.drawer-foot').height,
    closeBottom: close.bottom,
    removeTop: remove.top,
    fineInBody: !!document.querySelector('.drawer-body > .drawer-fine'),
  };
});

test.describe('a phone on its side', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('keeps at least half the drawer for five lines, and Remove reads as a word well below the close × (AW-152, AW-306)', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'a touch-screen phone layout');
    const errors = trackErrors(page);
    await context.addInitScript(([key, value]) => {
      try { if (!sessionStorage.getItem('smoke-cart')) { localStorage.setItem(key, value); sessionStorage.setItem('smoke-cart', '1'); } } catch { /* storage blocked */ }
    }, [GUEST_CART, JSON.stringify(FIVE_LINES)]);
    await page.goto('/category/grocery');
    await expect(cartButton(page)).toContainText('9');
    await cartButton(page).click();
    const drawer = page.getByRole('dialog', { name: 'Your order' });
    await expect(drawer.locator('.drawer-line')).toHaveCount(5);

    const landscape = await measure(page);
    // At least half the drawer is the scrolling list (the review measured 90 of 390px).
    expect(landscape.body).toBeGreaterThanOrEqual(landscape.drawer / 2);
    expect(landscape.fineInBody).toBe(true);
    // The guest's foot keeps its 44px controls.
    for (const name of ['Request quote', 'Sign in for account pricing']) {
      const height = await drawer.getByRole(name === 'Request quote' ? 'link' : 'button', { name }).evaluate((el) => el.getBoundingClientRect().height);
      expect(height, name).toBeGreaterThanOrEqual(44);
    }

    // Remove is a worded text button, not a second round ×, and is at least
    // 44px below the close button.
    const remove = drawer.getByRole('button', { name: 'Remove Kite cigarette tobacco' });
    await expect(remove).toHaveText('Remove');
    await expect(remove).toHaveClass('text-link drawer-remove');
    expect(await remove.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(landscape.removeTop - landscape.closeBottom).toBeGreaterThanOrEqual(44);

    // Upright on a small phone the list grows too: the fine print left the foot.
    await page.setViewportSize({ width: 360, height: 740 });
    await expect.poll(async () => (await measure(page)).head).toBeGreaterThan(landscape.head);
    const upright = await measure(page);
    expect(upright.body).toBeGreaterThanOrEqual(upright.drawer * 0.62);
    expect(upright.removeTop - upright.closeBottom).toBeGreaterThanOrEqual(44);
    expect(errors).toEqual([]);
  });
});

test('an empty cart offers the catalog, with no total or fine print, and the link closes the drawer (AW-299)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await cartButton(page).click();
  const drawer = page.getByRole('dialog', { name: 'Your order' });
  await expect(drawer.getByRole('heading', { level: 3, name: 'Your cart is empty' })).toBeVisible();
  await expect(drawer.getByText('Estimated total')).toHaveCount(0);
  await expect(drawer.locator('.drawer-fine')).toHaveCount(0);
  await expect(drawer.locator('.drawer-foot')).toBeHidden();
  await drawer.getByRole('link', { name: 'Browse the catalog' }).click();
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByRole('dialog', { name: 'Your order' })).toHaveCount(0);
  await expect(page.locator('main h1')).toBeVisible();
  expect(errors).toEqual([]);
});
