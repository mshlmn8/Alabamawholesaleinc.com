// Product cards, department tiles and collection cards (AW-170, AW-154,
// AW-304, AW-303): each has one real link, stretched over the card, so a
// click on the photo opens the page and the link can open in a new tab; the
// controls sit above it and follow it in the tab order; the action rows line
// up across a grid row; a SKU moves to the next line whole; and a section
// link stays on one line on phones. Kept apart from storefront.spec.js.
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

// Clicks a point of an element, given as fractions of its box, after
// scrolling it to the middle of the window (clear of the sticky header).
async function clickAt(page, locator, fx, fy) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

test('a product card is an article whose title links to the product, and its photo opens it too (AW-170)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/category/tobacco/cigarettes');
  const card = page.getByRole('article', { name: 'Kite cigarette tobacco' });
  const link = card.getByRole('heading', { level: 3 }).getByRole('link', { name: 'Kite cigarette tobacco', exact: true });
  await expect(link).toHaveAttribute('href', '/product/14');
  // Its name is the product name, not an aria-label that hides the rest of the card.
  await expect(link).not.toHaveAttribute('aria-label', /./);
  // The action names the product after its label.
  await expect(card.getByRole('button', { name: /^Add to quote\b.*Kite cigarette tobacco$/ })).toBeVisible();
  // A click on the photo, or on the line under the title, opens the product.
  await clickAt(page, card.locator('.card-block'), 0.5, 0.5);
  await expect(page).toHaveURL(/\/product\/14$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kite cigarette tobacco');
  await page.goBack();
  await clickAt(page, page.getByRole('article', { name: 'Kite cigarette tobacco' }).locator('.card-detail'), 0.2, 0.5);
  await expect(page).toHaveURL(/\/product\/14$/);
  expect(errors).toEqual([]);
});

test('the controls sit above the card link, after it in the tab order (AW-170)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/category/tobacco/cigarettes');
  const card = page.getByRole('article', { name: 'Kite cigarette tobacco' });
  const add = card.getByRole('button', { name: /^Add to quote\b/ });
  // A click on the add button adds; it doesn't open the product.
  await add.click();
  await expect(card.getByRole('group', { name: 'Kite cigarette tobacco quantity' })).toBeVisible();
  await expect(page).toHaveURL(/\/category\/tobacco\/cigarettes$/);
  // Tab: the link, the guest pricing prompt (while cards have one), then the
  // card's control.
  const next = page.getByRole('article', { name: 'Seneca cigarettes' });
  await next.getByRole('link', { name: 'Seneca cigarettes', exact: true }).focus();
  await page.keyboard.press('Tab');
  const prompt = next.getByRole('button', { name: 'Sign in for pricing' });
  if (await prompt.count()) {
    await expect(prompt).toBeFocused();
    await page.keyboard.press('Tab');
  }
  await expect(next.getByRole('link', { name: /^Select options\b/ })).toBeFocused();
  expect(errors).toEqual([]);
});

test('department tiles and collection cards open their department from anywhere on them (AW-170)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  const tile = page.locator('#catalog .dept-tile').filter({ hasText: 'Candies' });
  await expect(tile.getByRole('heading', { level: 3 }).getByRole('link', { name: 'Candies', exact: true })).toHaveAttribute('href', '/category/candies');
  // The photo, above the link's own text.
  await clickAt(page, tile.locator('.dept-tile-media'), 0.5, 0.5);
  await expect(page).toHaveURL(/\/category\/candies$/);
  await page.goBack();
  const collection = page.locator('.editorial-card.purple');
  await expect(collection.getByRole('link', { name: 'Browse tobacco' })).toHaveAttribute('href', '/category/tobacco');
  // Its heading is a heading, not part of a link.
  await expect(collection.getByRole('heading', { level: 2 })).toBeVisible();
  await clickAt(page, collection, 0.8, 0.2);
  await expect(page).toHaveURL(/\/category\/tobacco$/);
  expect(errors).toEqual([]);
});

test('card action rows line up across each grid row, and no card is narrower than 12.5rem (AW-154)', async ({ page }) => {
  const errors = trackErrors(page);
  for (const path of ['/category/tobacco', '/category/novelties', '/']) {
    await page.goto(path);
    await expect(page.locator('main .card-grid .content-card').first()).toBeVisible();
    const spread = await page.evaluate(() => {
      let worst = 0, narrowest = Infinity;
      for (const grid of document.querySelectorAll('main .card-grid')) {
        const rows = new Map();
        for (const card of grid.querySelectorAll(':scope > .content-card')) {
          const top = Math.round(card.getBoundingClientRect().top);
          const action = card.querySelector('.card-add, .card-stepper').getBoundingClientRect();
          rows.set(top, [...(rows.get(top) || []), action.top]);
          narrowest = Math.min(narrowest, card.getBoundingClientRect().width);
        }
        for (const tops of rows.values()) worst = Math.max(worst, Math.max(...tops) - Math.min(...tops));
      }
      return { worst, narrowest, phone: window.innerWidth <= 600 };
    });
    expect(spread.worst, path).toBeLessThanOrEqual(1);
    if (!spread.phone) expect(spread.narrowest, path).toBeGreaterThanOrEqual(199.5);
  }
  expect(errors).toEqual([]);
});

test('a SKU moves to the next line whole, unless it alone is wider than the card (AW-304)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/category/tobacco');
  await expect(page.locator('main .card-detail').first()).toContainText('AW-');
  const split = await page.evaluate(() => [...document.querySelectorAll('main .card-detail')].flatMap((detail) => {
    const part = [...detail.querySelectorAll('.text-parts > span')].find((span) => /^AW-/.test(span.textContent));
    if (!part) return [];
    const range = document.createRange();
    range.selectNodeContents(part);
    const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
    const probe = document.createElement('span');
    probe.textContent = part.textContent;
    probe.style.cssText = 'position:absolute;white-space:nowrap';
    part.append(probe);
    const wider = probe.getBoundingClientRect().width > detail.getBoundingClientRect().width;
    probe.remove();
    return lines > 1 && !wider ? [part.textContent] : [];
  }));
  expect(split).toEqual([]);
  expect(errors).toEqual([]);
});

test('section links stay on one line beside their heading, with no sideways scrolling (AW-303)', async ({ page }) => {
  const errors = trackErrors(page);
  for (const path of ['/', '/product/162']) {
    await page.goto(path);
    await expect(page.locator('.section-head > a').first()).toBeVisible();
    const result = await page.evaluate(() => ({
      // The visible text's lines: a link's sr-only words (storefront's
      // 'View all <line>') sit in a 1px box of their own.
      lines: [...document.querySelectorAll('.section-head > a')].map((a) => {
        const tops = new Set();
        const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.parentElement.closest('.sr-only')) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r of range.getClientRects()) if (r.width > 0) tops.add(Math.round(r.top));
        }
        return [a.textContent, tops.size];
      }),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    for (const [text, lines] of result.lines) expect(lines, text).toBe(1);
    expect(result.overflow, path).toBe(0);
  }
  expect(errors).toEqual([]);
});
