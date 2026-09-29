// The live catalog (AW-204, AW-191): a load that fails is labelled and can be
// retried, a product that only the live catalog has shows a loading view
// instead of "not found", an open tab loads the catalog again, and checkout
// checks it again before sending. Products come from the seeded catalog
// (./catalog.js); every other request that leaves the preview server is
// aborted, and submit_quote is answered here.
import { test, expect } from '@playwright/test';
import { fulfillProducts, seedRows } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const GUEST_CART = 'aw-cart-v2:guest'; // cartKey('guest') in src/lib/cartStorage.js
const ageRecord = (at) => JSON.stringify({ ok: true, at });

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const source = m.location()?.url || '';
    // Aborted remote requests, and the failed catalog loads this spec causes.
    if (/Failed to load resource/.test(m.text()) && (!source || !isLocal(source))) return;
    errors.push(`console: ${m.text()}`);
  });
  return errors;
}

// A product the bundled catalog doesn't have (test values).
const EXTRA = {
  id: 9001, name: 'Catalog test product', brand: 'Test Brand', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', sku: 'AW-TEST-9001',
  variants: [], variant_axis: null, unavailable_variants: [], img: null, tag: null, active: true, description: 'Only in the live catalog.', sell_unit: '',
};

// Answers the products request with `answer()`: 'fail' (a server error),
// { rows, delay } or nothing (the seeded rows).
async function catalog(page, answer = () => ({})) {
  const calls = [];
  await page.route(/\/rest\/v1\/products/, async (route) => {
    calls.push(route.request().url());
    const { fail, rows, delay } = answer() || {};
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (fail) return route.fulfill({ status: 500, json: { code: 'XX000', message: 'test failure' } });
    return fulfillProducts(route, rows || seedRows());
  });
  return calls;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
  }, [AGE_KEY, ageRecord(Date.now())]);
});

test('a catalog that fails to load is labelled, and "Try again" loads it (AW-204)', async ({ page }) => {
  const errors = trackErrors(page);
  let fail = true;
  const calls = await catalog(page, () => ({ fail }));
  await page.goto('/category/tobacco');
  const notice = page.locator('.site-notice[data-notice="catalog-error"]');
  await expect(notice).toContainText('We couldn’t load the latest catalog');
  await expect(notice).toContainText('may be out of date');
  // The bundled copy is still browsable.
  await expect(page.getByRole('heading', { level: 1, name: 'Tobacco' })).toBeVisible();
  await expect(page.locator('main a[href^="/product/"]').first()).toBeVisible();
  fail = false;
  await notice.getByRole('button', { name: 'Try again' }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.locator('#main')).toBeFocused();
  expect(calls.length).toBe(2);
  expect(errors).toEqual([]);
});

test('a product only the live catalog has shows "Loading product…", not "not found" (AW-204)', async ({ page }) => {
  const errors = trackErrors(page);
  let fail = false;
  await catalog(page, () => (fail ? { fail } : { rows: [...seedRows(), EXTRA], delay: 1500 }));
  await page.goto('/product/9001');
  await expect(page.getByRole('heading', { level: 1, name: 'Loading product…' })).toBeVisible();
  await expect(page).toHaveTitle(/^Loading product…/);
  const loaded = page.getByRole('heading', { level: 1, name: 'Catalog test product' });
  await expect(loaded).toBeVisible();
  await expect(page).toHaveTitle(/^Catalog test product/);

  // When the catalog can't be loaded, the page says so instead of "not found".
  fail = true;
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'We couldn’t load this product' })).toBeVisible();
  await expect(page.locator('.site-notice')).toHaveCount(0);
  fail = false;
  await page.locator('main').getByRole('button', { name: 'Try again' }).click();
  await expect(loaded).toBeVisible();
  expect(errors).toEqual([]);
});

test('an address that cannot name a product is "not found" at once, also while the catalog loads (AW-188)', async ({ page }) => {
  const errors = trackErrors(page);
  let fail = false;
  await catalog(page, () => (fail ? { fail } : { delay: 3000 }));
  for (const url of ['/product/abc', '/product/0', '/product', '/category']) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1, name: /not found$/ })).toBeVisible({ timeout: 1000 });
  }
  // Nor does a failed catalog load turn it into "couldn't load".
  fail = true;
  await page.goto('/product/abc');
  await expect(page.getByRole('heading', { level: 1, name: 'Product not found' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('reached from another page, the product takes focus from the loading view (AW-204, AW-041)', async ({ page }) => {
  const errors = trackErrors(page);
  await catalog(page, () => ({ rows: [...seedRows(), EXTRA], delay: 1500 }));
  await page.goto('/catalog');
  // Followed inside the app while the live catalog is still loading.
  await page.evaluate(() => {
    window.history.pushState(null, '', '/product/9001');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Loading product…' })).toBeFocused();
  await expect(page.getByRole('heading', { level: 1, name: 'Catalog test product' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('an open tab loads the catalog again when it comes back after five minutes, and when back online (AW-191)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.clock.install();
  const calls = await catalog(page);
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { level: 1, name: 'All products' })).toBeVisible();
  await expect.poll(() => calls.length).toBe(1);
  const comeBack = () => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await comeBack();
  await page.waitForTimeout(300);
  expect(calls.length).toBe(1);
  await page.clock.fastForward('05:01');
  await comeBack();
  await expect.poll(() => calls.length).toBe(2);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => calls.length).toBe(3);
  expect(errors).toEqual([]);
});

test('checkout checks the catalog again and names a line that was taken out (AW-191)', async ({ page, context }) => {
  const errors = trackErrors(page);
  let drop = false;
  const calls = await catalog(page, () => ({ rows: seedRows().filter((r) => !(drop && r.id === 14)) }));
  const sent = [];
  await page.route(/\/rest\/v1\/rpc\/submit_quote/, (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ json: { id: 'smoke-order', ref_num: 'ALW-Q-00001' } });
  });
  await context.addInitScript(([key, value]) => {
    try {
      if (!sessionStorage.getItem('smoke-cart')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('smoke-cart', '1');
      }
    } catch { /* storage blocked */ }
  }, [GUEST_CART, JSON.stringify({ 14: 2, '1::red': 1 })]);
  await page.goto('/quote');
  await expect(page.getByRole('heading', { level: 1, name: 'Request your quote' })).toBeVisible();
  for (const [label, value] of [['Business', 'Test Market LLC'], ['Contact', 'Test Buyer'], ['Email', 'buyer@example.test'], ['Phone', '205-555-0100'],
    ['Street', '1 Test Way'], ['City', 'Birmingham'], ['State', 'AL'], ['ZIP', '35203']]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await expect.poll(() => calls.length).toBe(1);

  drop = true;
  await page.getByRole('button', { name: /Submit quote request/ }).click();
  const note = page.getByRole('alert').filter({ hasText: 'The catalog changed since this page opened' });
  await expect(note).toContainText('Kite cigarette tobacco is no longer available — remove it to continue.');
  expect(sent).toEqual([]);
  expect(calls.length).toBe(2);

  await page.getByRole('button', { name: 'Remove unavailable items' }).click();
  await expect(note).toHaveCount(0);
  await page.getByRole('button', { name: /Submit quote request/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Thank you/ })).toBeVisible();
  expect(sent.map((body) => body.p_items)).toEqual([[{ product_id: 1, variant: 'Red', qty: 1 }]]);
  expect(errors).toEqual([]);
});
