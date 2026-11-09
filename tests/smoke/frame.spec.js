// The page frame: one banner landmark that starts with a skip link and holds
// the trade bar and the header (AW-166, AW-314), one apply entry in it
// (LEFT-2), the trade bar's controls in their visual order (AW-315), and its
// announcements, one message at a time with a pause control, pausing on
// hover and focus and never moving by themselves with reduced motion
// (AW-167, WCAG 2.2.2); on a phone one row whose long message scrolls
// sideways (AW-153). The rotation runs on Playwright's fake clock, so nothing
// waits for real seconds.
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';
import { mockAccount, seedAccount } from './account.js';

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

test('the first Tab shows the skip link, and Enter moves focus to the page without changing the address (AW-166)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/category/tobacco');
  await expect(page.locator('main h1')).toHaveText('Tobacco');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).not.toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  expect(new URL(page.url()).pathname + new URL(page.url()).hash).toBe('/category/tobacco');
  // The next Tab lands in the page, past the header.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('main'))).toBe(true);
  expect(errors).toEqual([]);
});

test('one banner holds the skip link and one Apply, the header’s (AW-314, AW-315, LEFT-2)', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  await page.goto('/');
  const banner = page.getByRole('banner');
  await expect(banner).toHaveCount(1);
  await expect(banner.locator('.trade-bar')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(banner.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  // One visible Apply in the banner on a wide window, the header's orange
  // button; on a phone it is in the menu (and the home hero).
  const apply = banner.getByRole('button', { name: 'Apply for a trade account' });
  if (testInfo.project.name === 'phone') {
    await expect(apply).toBeHidden();
    await banner.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Apply for a trade account' }).click();
  } else {
    await expect(apply).toHaveCount(1);
    await expect(apply).toBeVisible();
    await apply.click();
  }
  await expect(page.getByRole('dialog', { name: 'Apply for a trade account' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a toast at the foot of the page stays visible, and the footer has no nicotine warning', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/product/14');
  await page.locator('.pd-info').getByRole('button', { name: /^Add to order/ }).click();
  const toast = page.locator('.toast-root > *').first();
  await expect(toast).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect(page.locator('footer .fda-note, footer .nicotine-warning')).toHaveCount(0);
  await expect(toast).toBeInViewport();
  expect(errors).toEqual([]);
});

// The header sticks on wide windows at least 600px tall, and everything that sticks or scrolls to an anchor stays
// scrolled away, and everything that sticks or scrolls to an anchor stays
// below it (AW-153, AW-312). On phones the Filter & Sort row is the one
// sticky control, the chips scroll away (AW-158), and the current product
// line is centred in the pill row (AW-157).
test.describe('the sticky header and the department page', () => {
  const rect = (locator) => locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
  });

  test('on a long page search, the cart and Categories stay in reach (AW-153)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'phone', 'the header sticks on wide windows only');
    const errors = trackErrors(page);
    await page.goto('/category/tobacco');
    await expect(page.locator('main h1')).toHaveText('Tobacco');
    await page.evaluate(() => window.scrollTo({ top: 2500, behavior: 'instant' }));
    await page.waitForFunction(() => window.scrollY === 2500);
    const banner = page.getByRole('banner');
    const search = banner.getByRole('combobox', { name: 'Search products' });
    const cart = banner.getByRole('button', { name: /^(Quote|Order), / });
    const categories = banner.getByRole('button', { name: 'Categories' });
    for (const control of [search, cart, categories]) await expect(control).toBeInViewport({ ratio: 1 });
    // The header's bottom edge is what --header-h says.
    const headerH = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')));
    expect(Math.abs((await rect(banner)).bottom - headerH)).toBeLessThan(1);

    await search.click();
    await search.fill('swisher');
    await expect(page.getByRole('listbox', { name: 'Products' })).toBeInViewport();
    await page.keyboard.press('Escape');
    await categories.click();
    await expect(page.locator('#aw-mega-menu')).toBeInViewport();
    await page.keyboard.press('Escape');
    await cart.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Using them never scrolled the page: the header's own controls never
    // count as hidden under it.
    expect(await page.evaluate(() => window.scrollY)).toBe(2500);
    expect(errors).toEqual([]);
  });

  // Resolves once the page has held still for 250ms: the browser's smooth
  // scroll to a focused control, and any correction after it, are over.
  const settled = (page) => page.evaluate(() => new Promise((done) => {
    let y = window.scrollY;
    let since = performance.now();
    const check = () => {
      if (window.scrollY !== y) { y = window.scrollY; since = performance.now(); }
      if (performance.now() - since > 250) done();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }));
  const focused = (page) => page.evaluate(() => {
    const el = document.activeElement;
    const r = el.getBoundingClientRect();
    const header = document.querySelector('.site-header');
    return {
      name: el.getAttribute('aria-label') || el.labels?.[0]?.textContent.trim() || el.textContent.trim(),
      top: r.top, bottom: r.bottom, y: window.scrollY,
      inBar: !!el.closest('.trade-bar'), inHeader: header.contains(el), inMain: !!el.closest('main'), inForm: !!el.closest('main form'),
      headerBottom: header.getBoundingClientRect().bottom,
    };
  });

  test('Shift+Tab back through checkout never leaves a field under the stuck header (NEW-018)', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name === 'phone', 'the wide layouts');
    const errors = trackErrors(page);
    // Only an approved account gets the order form (AW-014).
    await seedAccount(context, { cart: { 14: 2, 2: 3 } });
    await mockAccount(page);
    for (const size of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      await page.goto('/checkout');
      await expect(page.getByRole('heading', { level: 2, name: 'Your details' })).toBeVisible();
      await page.locator('footer').getByRole('link').first().focus();
      await settled(page);
      const fields = [];
      // From the footer back through the form, to the cart lines before it.
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Shift+Tab');
        await settled(page);
        const now = await focused(page);
        if (now.inHeader || (fields.length && !now.inForm)) break;
        if (!now.inForm) continue;
        fields.push(now.name);
        expect(now.top, `${now.name} at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(now.headerBottom - 1);
      }
      expect(fields).toContain('Notes (optional)');
    }
    expect(errors).toEqual([]);
  });

  test('a phone on its side or a tablet gets a short header, the search beside the logo (AW-153)', async ({ page }) => {
    const errors = trackErrors(page);
    for (const size of [{ width: 844, height: 390 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(size);
      await page.goto('/category/candies');
      await expect(page.locator('main h1')).toHaveText('Candies');
      const banner = page.getByRole('banner');
      const header = await rect(banner);
      expect(header.height).toBeLessThanOrEqual(120);
      const middle = (r) => (r.top + r.bottom) / 2;
      const search = await rect(banner.getByRole('combobox', { name: 'Search products' }));
      const logo = await rect(banner.getByRole('link', { name: 'Alabama Wholesale home' }));
      const cart = await rect(banner.getByRole('button', { name: /^(Quote|Order), / }));
      expect(Math.abs(middle(search) - middle(cart))).toBeLessThan(12);
      expect(logo.right).toBeLessThanOrEqual(search.left);
      expect(search.right).toBeLessThanOrEqual(cart.left);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    }
    expect(errors).toEqual([]);
  });

  test('an anchor lands below the header (AW-153)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#bestsellers');
    const section = page.locator('#bestsellers');
    await expect(section).toBeInViewport();
    await page.waitForFunction(() => window.scrollY > 0);
    const headerH = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')));
    const { top } = await rect(section);
    // scroll-padding-top: the stuck header (none on a phone), then 24px.
    expect(Math.abs(top - (headerH + 24))).toBeLessThan(2);
    expect(errors).toEqual([]);
  });

  test('on a zoomed laptop the filter panel ends on screen and scrolls (AW-312)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'phone', 'the filter sidebar is desktop only');
    const errors = trackErrors(page);
    for (const size of [{ width: 960, height: 526 }, { width: 1280, height: 600 }]) {
      await page.setViewportSize(size);
      await page.goto('/category/tobacco');
      await expect(page.locator('main h1')).toHaveText('Tobacco');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      const panel = page.getByRole('complementary', { name: 'Product filters' });
      expect((await rect(panel)).bottom).toBeLessThanOrEqual(size.height);
      // Its last control is reached by keyboard, scrolled into the panel.
      await panel.getByRole('searchbox').focus();
      // (The sidebar's own sign-in box is gone: the PricingNotice above the
      // grid has it, AW-224. Its last control is the Variants box.)
      const last = panel.locator('input, button, select, a[href]').last();
      for (let i = 0; i < 40 && !(await last.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
      await expect(last).toBeFocused();
      // A checkbox's sub-pixel edge can round outside the panel's scrollport.
      await expect(last).toBeInViewport({ ratio: 0.95 });
      const box = await rect(last);
      expect(box.bottom).toBeLessThanOrEqual((await rect(panel)).bottom);
    }
    expect(errors).toEqual([]);
  });

  test('on a phone the masthead sticks, so search, the menu and the cart stay in reach, with the Filter & Sort row under it (AW-153, AW-158)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'the compact layout');
    const errors = trackErrors(page);
    for (const size of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) {
      await page.setViewportSize(size);
      await page.goto('/category/candies');
      await expect(page.locator('main h1')).toHaveText('Candies');
      const banner = page.getByRole('banner');
      expect((await rect(banner)).height).toBeLessThanOrEqual(160);
      await page.evaluate(() => window.scrollTo({ top: 2500, behavior: 'instant' }));
      await page.waitForFunction(() => window.scrollY === 2500);
      for (const control of [banner.getByRole('combobox', { name: 'Search products' }), banner.getByRole('button', { name: 'Menu' }), banner.getByRole('button', { name: /^(Quote|Order), / })]) {
        await expect(control).toBeInViewport({ ratio: 1 });
      }
      const headerH = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')));
      expect(headerH).toBeGreaterThan(0);
      expect(Math.abs((await rect(banner)).bottom - headerH)).toBeLessThan(1);
      expect(Math.abs((await rect(page.locator('.category-toolbar'))).top - headerH)).toBeLessThan(1);
      // The search list opens under the stuck masthead and ends on screen,
      // and focusing the box didn't move the page.
      await banner.getByRole('combobox', { name: 'Search products' }).fill('gum');
      const list = page.getByRole('listbox', { name: 'Products' });
      await expect(list).toBeVisible();
      expect((await rect(page.locator('.aw-search-results'))).bottom).toBeLessThanOrEqual(size.height);
      expect(await page.evaluate(() => window.scrollY)).toBe(2500);
      await page.keyboard.press('Escape');
    }
    expect(errors).toEqual([]);
  });

  test('Shift+Tab up a department never leaves a card’s link or control under the stuck Filter & Sort row (NEW-081)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'the compact layout');
    const errors = trackErrors(page);
    // A short phone, where the masthead sticks over the row, and a phone on its side, where only the row does.
    for (const size of [{ width: 360, height: 640 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      await page.goto('/category/tobacco');
      await expect(page.locator('main h1')).toHaveText('Tobacco');
      await page.locator('footer').getByRole('link').first().focus();
      await settled(page);
      let stops = 0;
      for (let i = 0; i < 24; i++) {
        await page.keyboard.press('Shift+Tab');
        await settled(page);
        const now = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            name: el.getAttribute('aria-label') || el.textContent.trim(),
            top: el.getBoundingClientRect().top,
            inGrid: !!el.closest('.catalog-layout'),
            toolbarBottom: document.querySelector('.category-toolbar').getBoundingClientRect().bottom,
          };
        });
        if (!now.inGrid) continue;
        stops += 1;
        expect(now.top, `${now.name} at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(now.toolbarBottom - 1);
      }
      expect(stops).toBeGreaterThan(15);
    }
    expect(errors).toEqual([]);
  });

  test('on a phone the Filter & Sort row sticks under the masthead, and the current line is in view (AW-158, AW-157)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'the compact layout');
    const errors = trackErrors(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/category/candies/chocolate-bars?tags=bestseller&q=bar');
    const toolbar = page.locator('.category-toolbar');
    const chips = page.getByRole('list', { name: 'Active filters' });
    await expect(chips.getByRole('button')).toHaveCount(4);
    expect(await toolbar.evaluate((el, list) => el.contains(list), await chips.elementHandle())).toBe(false);
    expect((await rect(toolbar)).height).toBeLessThanOrEqual(64);
    // The pill row did not move the page, and shows the current line.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('.sub-pills [aria-current="page"]')).toBeInViewport({ ratio: 1 });
    // Scrolled: the row is stuck under the masthead, and the chips have gone under it and away.
    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
    await page.waitForFunction(() => window.scrollY === 900);
    const headerH = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')));
    expect(Math.abs((await rect(toolbar)).top - headerH)).toBeLessThan(1);
    expect(Math.abs((await rect(page.getByRole('banner'))).bottom - headerH)).toBeLessThan(1);
    expect((await rect(toolbar)).height).toBeLessThanOrEqual(64);
    await expect(chips).not.toBeInViewport();

    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/category/tobacco/wraps-and-leafs', '/category/novelties/hookah-and-shisha']) {
      await page.goto(path);
      const current = page.locator('.sub-pills [aria-current="page"]');
      await expect(current).toBeInViewport({ ratio: 1 });
      // Picking another line keeps the page where it is and centres the pick.
      const name = await page.locator('.sub-pills .sub-pill:not([aria-current])').last().textContent();
      const next = page.locator('.sub-pills').getByRole('link', { name, exact: true });
      await next.evaluate((el) => el.closest('.sub-pills').scrollTo({ left: el.offsetLeft }));
      const y = await page.evaluate(() => window.scrollY);
      await next.click();
      await expect(next).toHaveAttribute('aria-current', 'page');
      await expect(next).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => window.scrollY)).toBe(y);
    }
    expect(errors).toEqual([]);
  });
});
