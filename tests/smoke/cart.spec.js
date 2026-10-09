// Cart storage smoke test (AW-045, AW-046, AW-354): the cart survives blocked
// or damaged storage, stays in step across tabs, and carts from earlier
// builds move over once. Every request that leaves the preview server is
// aborted, except the products request, which gets the seeded catalog
// (./catalog.js). Per-account carts (AW-189) are covered in auth.spec.js.
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const GUEST_CART = 'aw-cart-v2:guest'; // cartKey('guest') in src/lib/cartStorage.js
const GUEST_LEGACY = 'aw-cart-legacy:guest'; // legacyListKey('guest')
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
  return errors;
}

const stored = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);
const cartButton = (page) => page.getByRole('button', { name: /^(Quote|Order), [\d,]+ items?$/ });
// The product's own add button: the related cards below it say "Add to quote" too.
const addButton = (page) => page.locator('.pd-info').getByRole('button', { name: /^Add to (quote|order)/ });

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
});

test.describe('with the age confirmed', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(([key, value]) => {
      try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
    }, [AGE_KEY, ageRecord(Date.now())]);
  });

  test('two tabs share one cart: each add shows in both, and a clear reaches the other (AW-046)', async ({ context }) => {
    const first = await context.newPage();
    const second = await context.newPage();
    const errors = [...trackErrors(first), ...trackErrors(second)];
    await first.goto('/product/14');
    await second.goto('/product/115');
    await addButton(first).click();
    // Product 115 has one variant: no chips to choose from (AW-233), it is added with it.
    await expect(second.locator('.variant-chips')).toHaveCount(0);
    await addButton(second).click();
    await expect(cartButton(first)).toHaveAccessibleName('Quote, 2 items');
    await expect(cartButton(second)).toHaveAccessibleName('Quote, 2 items');
    expect(Object.keys(JSON.parse(await stored(first, GUEST_CART)))).toHaveLength(2);

    await second.goto('/quote');
    await second.getByRole('button', { name: 'Clear all items' }).click();
    await expect(cartButton(first)).toHaveAccessibleName('Quote, 0 items');
    // The first tab's next add does not bring the cleared lines back.
    await addButton(first).click();
    await expect(cartButton(second)).toHaveAccessibleName('Quote, 1 item');
    expect(JSON.parse(await stored(first, GUEST_CART))).toEqual({ 14: 1 });
    expect(errors).toEqual([]);
  });

  test('an old cart moves over once, and lines that need a variant keep their quantity (AW-354)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('aw-cart', JSON.stringify({ 1: 3, 162: 2, 14: 1 }));
      localStorage.setItem('aw-trade-user', JSON.stringify({ name: 'Old Buyer' }));
      localStorage.setItem('aw-welcome-seen', '1');
    });
    await page.reload();
    await expect(cartButton(page)).toHaveAccessibleName('Quote, 1 item');
    expect(await page.evaluate(() => ['aw-cart', 'aw-trade-user', 'aw-welcome-seen'].map((k) => localStorage.getItem(k)))).toEqual([null, null, null]);
    expect(JSON.parse(await stored(page, GUEST_LEGACY))).toEqual([{ productId: 1, qty: 3 }, { productId: 162, qty: 2 }]);

    await cartButton(page).click();
    const saved = page.getByRole('region', { name: /Choose a variant for 2 products from your last visit/ });
    await expect(saved).toContainText('Quantity 3');
    await saved.getByRole('link', { name: /Choose a variant for Swisher/ }).click();
    await expect(page).toHaveURL(/\/product\/1$/);
    await expect(page.getByRole('group', { name: 'Quantity to add' }).locator('input')).toHaveValue('3');
    await page.locator('.variant-chips button').first().click();
    await addButton(page).click();
    await expect(cartButton(page)).toHaveAccessibleName('Quote, 4 items');
    expect(JSON.parse(await stored(page, GUEST_LEGACY))).toEqual([{ productId: 162, qty: 2 }]);
    expect(errors).toEqual([]);
  });

  test('a bare line gets its variant in the drawer and keeps its quantity, so the quote can be sent (AW-011)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ 1: 12, 14: 2 })), GUEST_CART);
    await page.reload();
    await expect(cartButton(page)).toHaveAccessibleName('Quote, 14 items');
    await cartButton(page).click();
    const drawer = page.getByRole('dialog', { name: 'Your quote' });
    await expect(drawer.getByText('12 units · choose a variety')).toBeVisible();
    const set = drawer.getByRole('button', { name: 'Set variety' });
    await expect(set).toBeDisabled();
    await drawer.getByRole('combobox', { name: 'Choose a variety for Swisher Sweets cigarillos' }).selectOption('Red');
    // Choosing alone changes nothing (WCAG 3.2.2); Set does.
    expect(JSON.parse(await stored(page, GUEST_CART))).toEqual({ 1: 12, 14: 2 });
    await set.click();
    const moved = drawer.getByRole('textbox', { name: 'Quantity of Swisher Sweets cigarillos — Red' });
    await expect(moved).toHaveValue('12');
    await expect(moved).toBeFocused();
    expect(JSON.parse(await stored(page, GUEST_CART))).toEqual({ '1::red': 12, 14: 2 });
    await drawer.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(cartButton(page)).toHaveAccessibleName('Quote, 14 items');

    // Nothing left to choose: the quote can go (not sent here).
    await page.goto('/quote');
    await expect(page.getByText('Choose a variant for every product that has more than one.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit quote request' })).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('a typed quantity goes in whole, and stops at 100,000 (AW-013)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/product/14');
    const group = page.getByRole('group', { name: 'Quantity to add' });
    await expect(group.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    const input = group.getByRole('textbox');
    await input.fill('48');
    await addButton(page).click();
    expect(JSON.parse(await stored(page, GUEST_CART))).toEqual({ 14: 48 });
    await expect(cartButton(page)).toHaveAccessibleName('Quote, 48 items');

    // In the cart, a number over the limit comes down to it.
    await cartButton(page).click();
    const line = page.getByRole('dialog', { name: 'Your quote' }).getByRole('textbox', { name: 'Quantity of Kite cigarette tobacco' });
    await line.fill('150000');
    await line.press('Enter');
    await expect(line).toHaveValue('100000');
    expect(JSON.parse(await stored(page, GUEST_CART))).toEqual({ 14: 100000 });
    expect(errors).toEqual([]);
  });

  test('a stored fraction and a billion are read as 2 and 100,000 (AW-013)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ '1::red': 2.5, 366: 1e9 })), GUEST_CART);
    await page.goto('/quote');
    await expect(page.getByRole('textbox', { name: 'Quantity of Swisher Sweets cigarillos — Red' })).toHaveValue('2');
    await expect(page.getByRole('textbox', { name: /^Quantity of Garcia y Vega cigars/ })).toHaveValue('100000');
    await expect(cartButton(page)).toHaveAccessibleName('Quote, 100,002 items');
    expect(errors).toEqual([]);
  });

  test('damaged carts start empty instead of breaking the page (AW-045)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/quote');
    for (const [key, value] of [['aw-cart', 'null'], [GUEST_CART, '[1,2]'], [GUEST_CART, '{"abc":3,"14":-1}']]) {
      await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: 'Your quote is empty' })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});

test('with storage blocked, the site renders and the cart works for the visit (AW-045)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.addInitScript(() => {
    const deny = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
    Object.defineProperty(window, 'localStorage', { configurable: true, get: deny });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get: deny });
  });
  await page.goto('/product/14');
  await page.getByRole('button', { name: /Yes, I am 21\+/ }).click();
  await addButton(page).click();
  await addButton(page).click();
  await expect(cartButton(page)).toHaveAccessibleName('Quote, 2 items');
  expect(errors).toEqual([]);
});
