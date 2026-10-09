// Cart feedback smoke test (AW-072, AW-042): an add shows a toast that is in
// view wherever the page is scrolled, says the quantity, and opens the cart;
// each add is read out once through the shared live region; and focus stays
// on the cart controls after adds and removals, never on <body>. Every
// request that leaves the preview server is aborted, except the products
// request, which gets the seeded catalog (./catalog.js). The phone project
// runs at 390 px.
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const GUEST_CART = 'aw-cart-v2:guest'; // cartKey('guest') in src/lib/cartStorage.js
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

const toast = (page) => page.locator('#aw-toasts .toast');
const addButton = (page) => page.locator('.pd-info').getByRole('button', { name: /^Add to (quote|order)/ });
// A card's add button is named for its product after the label (AW-170).
const cardAdds = (page) => page.locator('.content-card').getByRole('button', { name: /^Add to quote\b/ });
const activeIsBody = (page) => page.evaluate(() => document.activeElement === document.body);
// What the live region (#aw-announcer) said, recorded from the first paint.
const said = (page) => page.evaluate(() => window.__said);

test.beforeEach(async ({ context, page }, testInfo) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
    window.__said = [];
    let last = '';
    new MutationObserver(() => {
      const region = document.getElementById('aw-announcer');
      const text = region ? region.textContent : '';
      if (text && text !== last) window.__said.push(text);
      last = text;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  }, [AGE_KEY, JSON.stringify({ ok: true, at: Date.now() })]);
  if (testInfo.project.name === 'phone') await page.setViewportSize({ width: 390, height: 844 });
});

test('a card add deep in a category shows the toast in view, and "View quote" opens the cart (AW-072)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/category/candies');
  const add = cardAdds(page).last();
  await add.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  await add.click();
  await expect(toast(page)).toBeVisible();
  await expect(toast(page).locator('.toast-text')).toHaveText(/^Added .+ to your quote\.$/);
  const box = await toast(page).boundingBox();
  const viewport = page.viewportSize();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  // Focus moved to the stepper that replaced the button.
  await expect(page.locator('.card-stepper input:focus')).toHaveCount(1);

  await toast(page).getByRole('button', { name: 'View quote' }).click();
  await expect(page.getByRole('dialog', { name: 'Your quote' })).toBeVisible();
  await expect(toast(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a product page add says the quantity, without covering the add button (AW-072)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/product/14');
  await page.getByRole('group', { name: 'Quantity to add' }).getByRole('textbox').fill('3');
  await addButton(page).click();
  await expect(toast(page).locator('.toast-text')).toHaveText('Added 3 × Kite cigarette tobacco to your quote.');
  await expect(addButton(page)).toBeFocused();
  // When the button was low on the screen, the page scrolls it clear.
  await expect.poll(async () => {
    const t = await toast(page).boundingBox();
    const b = await addButton(page).boundingBox();
    return t.x < b.x + b.width && t.x + t.width > b.x && t.y < b.y + b.height && t.y + t.height > b.y;
  }).toBe(false);
  expect(errors).toEqual([]);
});

test('each add is read out exactly once (AW-042)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/product/14');
  await addButton(page).click();
  await expect(toast(page)).toBeVisible();
  // announce() keeps only the latest of two messages sent within 120 ms.
  await expect.poll(async () => (await said(page)).length).toBe(1);
  await addButton(page).click();
  await expect.poll(async () => (await said(page)).filter((t) => t.startsWith('Added'))).toEqual([
    'Added 1 × Kite cigarette tobacco to your quote.',
    'Added 1 × Kite cigarette tobacco to your quote.',
  ]);

  await page.goto('/category/candies');
  await cardAdds(page).first().click();
  await expect(toast(page)).toBeVisible();
  // Give a second message time to arrive, if there were one.
  await page.waitForTimeout(400);
  const added = (await said(page)).filter((t) => t.startsWith('Added'));
  expect(added).toHaveLength(1);
  expect(added[0]).toMatch(/^Added .+ to your quote\.$/);
  expect(errors).toEqual([]);
});

test('focus stays on the cart controls after adds and removals (AW-042)', async ({ page }) => {
  const errors = trackErrors(page);
  // A card: Enter on "Add to quote", then − at 1 removes it again.
  await page.goto('/category/candies');
  const add = cardAdds(page).first();
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.card-stepper input:focus')).toHaveCount(1);
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.card-stepper button:focus')).toHaveAccessibleName(/^Remove /);
  await page.keyboard.press('Enter');
  expect(await activeIsBody(page)).toBe(false);
  await expect(page.locator('.card-add:focus')).toHaveText(/^Add to quote\b/);
  await expect.poll(async () => (await said(page)).at(-1)).toMatch(/^Removed .+ from your quote\.$/);

  // The drawer: × on a line, then on the last one.
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ 14: 2, 45: 1 })), GUEST_CART);
  await page.goto('/');
  await page.getByRole('button', { name: /^Quote, [\d,]+ items?$/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Your quote' });
  await drawer.getByRole('button', { name: 'Remove Kite cigarette tobacco' }).click();
  await expect(drawer.getByRole('textbox', { name: 'Quantity of Argo corn starch' })).toBeFocused();
  await expect.poll(async () => (await said(page)).at(-1)).toBe('Removed Kite cigarette tobacco.');
  await drawer.getByRole('button', { name: 'Remove Argo corn starch' }).click();
  await expect(drawer.getByRole('heading', { name: 'Your quote', exact: true })).toBeFocused();
  await expect.poll(async () => (await said(page)).at(-1)).toBe('Removed Argo corn starch.');

  // Checkout: × on a line, then "Clear all items".
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ 14: 2, 45: 1 })), GUEST_CART);
  await page.goto('/quote');
  await page.getByRole('button', { name: 'Remove Kite cigarette tobacco' }).click();
  await expect(page.getByRole('textbox', { name: 'Quantity of Argo corn starch' })).toBeFocused();
  await expect.poll(async () => (await said(page)).at(-1)).toBe('Removed Kite cigarette tobacco.');
  await page.getByRole('button', { name: 'Clear all items' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your quote is empty' })).toBeFocused();
  expect(await activeIsBody(page)).toBe(false);
  await expect.poll(async () => (await said(page)).at(-1)).toBe('Removed all items from your quote.');
  expect(errors).toEqual([]);
});
