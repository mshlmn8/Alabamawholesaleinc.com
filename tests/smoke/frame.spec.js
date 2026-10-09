// The page frame: one banner landmark that starts with a skip link and holds
// the trade bar and the header (AW-166, AW-314), the trade bar's Apply and
// Call in their visual order (AW-315), and its announcements, one message at
// a time with a pause control, pausing on hover and focus and never moving
// by themselves with reduced motion (AW-167, WCAG 2.2.2). The rotation runs
// on Playwright's fake clock, so nothing waits for real seconds.
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';
import { GUEST_CART, cartValue } from './cartStore.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const ageRecord = (at) => JSON.stringify({ ok: true, at });
const NOTICE = 'WHOLESALE TO LICENSED RETAIL BUSINESSES ONLY · NO CONSUMER SALES · 21+';
const ROTATE_MS = 7000; // ROTATE_MS in src/components/TradeBar.jsx

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

test('one banner holds the skip link and the trade bar, whose Apply comes before Call (AW-314, AW-315)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  const banner = page.getByRole('banner');
  await expect(banner).toHaveCount(1);
  const pause = banner.getByRole('button', { name: 'Pause announcements' });
  // The trade bar's; the header's account actions say Apply too (AW-132).
  const apply = banner.locator('.trade-bar').getByRole('button', { name: 'Apply for a trade account' });
  const call = banner.getByRole('link', { name: /^Call \(205\) 354-4473$/ });
  await expect(apply).toBeVisible();
  await expect(call).toBeVisible();
  // The tab order: skip link, pause, Apply, Call.
  for (const control of [banner.getByRole('link', { name: 'Skip to main content' }), pause, apply, call]) {
    await page.keyboard.press('Tab');
    await expect(control).toBeFocused();
  }
  // Apply is shown first: to the left of Call on the same row, or on the row above.
  const a = await apply.boundingBox();
  const c = await call.boundingBox();
  expect(a.y + a.height <= c.y + 1 || (Math.abs(a.y - c.y) < 2 && a.x < c.x)).toBe(true);
  await apply.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('announcements (WCAG 2.2.2)', () => {
  const shown = (page) => page.locator('.announcement-list .is-current');
  // Somewhere on the page below the trade bar.
  const pointerAway = async (page) => {
    const { height } = page.viewportSize();
    await page.mouse.move(10, height - 10);
  };

  test('one message at a time, next after about 7s, held while hovered, focused or paused', async ({ page }) => {
    const errors = trackErrors(page);
    await page.clock.install();
    await page.goto('/');
    await pointerAway(page);
    await expect(page.locator('.announcement-list li')).toHaveCount(5);
    await expect(shown(page)).toHaveCount(1);
    await expect(shown(page)).toHaveText(NOTICE);

    await page.clock.runFor(ROTATE_MS + 500);
    await expect(shown(page)).not.toHaveText(NOTICE);
    let text = await shown(page).textContent();

    await page.locator('.announcement-list').hover();
    await page.clock.runFor(ROTATE_MS * 2);
    await expect(shown(page)).toHaveText(text);
    await pointerAway(page);
    await page.clock.runFor(ROTATE_MS + 500);
    await expect(shown(page)).not.toHaveText(text);
    text = await shown(page).textContent();

    await page.locator('.trade-call').focus();
    await page.clock.runFor(ROTATE_MS * 2);
    await expect(shown(page)).toHaveText(text);
    await page.locator('#main').focus();
    await page.clock.runFor(ROTATE_MS + 500);
    await expect(shown(page)).not.toHaveText(text);
    text = await shown(page).textContent();

    const pause = page.getByRole('button', { name: 'Pause announcements' });
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
    await pointerAway(page);
    await page.locator('#main').focus();
    await page.clock.runFor(ROTATE_MS * 3);
    await expect(shown(page)).toHaveText(text);
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'false');
    await pointerAway(page);
    await page.locator('#main').focus();
    await page.clock.runFor(ROTATE_MS + 500);
    await expect(shown(page)).not.toHaveText(text);
    expect(errors).toEqual([]);
  });

  test('with reduced motion the trade notice stays, and the toggle starts paused', async ({ page }) => {
    const errors = trackErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto('/');
    await pointerAway(page);
    await page.clock.runFor(ROTATE_MS * 6);
    await expect(shown(page)).toHaveText(NOTICE);
    await expect(page.getByRole('button', { name: 'Pause announcements' })).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });
});

// The header sticks on wide windows at least 600px tall, with the trade bar
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
    await expect(banner.locator('.trade-bar')).not.toBeInViewport();
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

  test('Shift+Tab into the trade bar shows it, and the page stays put (NEW-017)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'phone', 'the 1440 layout');
    const errors = trackErrors(page);
    await page.goto('/category/tobacco');
    await expect(page.locator('main h1')).toHaveText('Tobacco');
    await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
    await page.waitForFunction(() => window.scrollY === 1500);
    const banner = page.getByRole('banner');
    const barHeight = (await rect(banner.locator('.trade-bar'))).height;
    await banner.getByRole('combobox', { name: 'Search products' }).focus();
    const inBar = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+Tab');
      await settled(page);
      const now = await focused(page);
      if (now.inBar) {
        inBar.push(now.name);
        // The whole control is on screen.
        expect(now.top, now.name).toBeGreaterThanOrEqual(0);
        expect(now.bottom, now.name).toBeLessThanOrEqual(page.viewportSize().height);
      }
      expect(Math.abs(now.y - 1500), now.name).toBeLessThanOrEqual(barHeight);
    }
    expect(inBar).toContain('Pause announcements');
    expect(inBar).toContain('Call (205) 354-4473');
    // Back in the masthead, the trade bar scrolls away again.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(banner.getByRole('link', { name: 'Alabama Wholesale home' })).toBeFocused();
    await expect(banner.locator('.trade-bar')).not.toBeInViewport();
    expect(errors).toEqual([]);
  });

  test('Shift+Tab back through checkout never leaves a field under the stuck header (NEW-018)', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name === 'phone', 'the wide layouts');
    const errors = trackErrors(page);
    await context.addInitScript(([key, cart]) => {
      try { if (!localStorage.getItem(key)) localStorage.setItem(key, cart); } catch { /* storage blocked */ }
    }, [GUEST_CART, cartValue({ 14: 2, 2: 3 })]);
    for (const size of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      await page.goto('/quote');
      await expect(page.getByRole('heading', { level: 1, name: 'Request a quote' })).toBeVisible();
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
      // One row of announcements, Apply and Call; one row of menu, logo, search and account.
      const middle = (r) => (r.top + r.bottom) / 2;
      const announcements = await rect(banner.getByRole('list', { name: 'Announcements' }));
      const call = await rect(banner.getByRole('link', { name: /^Call / }));
      expect(Math.abs(middle(call) - middle(announcements))).toBeLessThan(12);
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

  test('on a phone only the Filter & Sort row sticks, and the current line is in view (AW-158, AW-157)', async ({ page }, testInfo) => {
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
    // Scrolled: the row is stuck at the top, and the chips have gone under it and away.
    await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
    await page.waitForFunction(() => window.scrollY === 900);
    expect((await rect(toolbar)).top).toBe(0);
    expect((await rect(toolbar)).height).toBeLessThanOrEqual(64);
    await expect(chips).not.toBeInViewport();

    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ['/category/tobacco/wraps-and-leafs', '/category/novelties/mushroom-products']) {
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
