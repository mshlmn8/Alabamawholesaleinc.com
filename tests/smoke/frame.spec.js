// The page frame: one banner landmark that starts with a skip link and holds
// the trade bar and the header (AW-166, AW-314), the trade bar's Apply and
// Call in their visual order (AW-315), and its announcements, one message at
// a time with a pause control, pausing on hover and focus and never moving
// by themselves with reduced motion (AW-167, WCAG 2.2.2). The rotation runs
// on Playwright's fake clock, so nothing waits for real seconds.
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';

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
  const apply = banner.getByRole('button', { name: 'Apply for a trade account' });
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
