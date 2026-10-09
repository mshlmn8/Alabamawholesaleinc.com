// Cart lines and summary smoke test (AW-239, AW-238, AW-082, AW-334, AW-081):
// a line's name opens its product (and closes the drawer); the drawer and
// checkout count lines and units; an approved buyer sees how far the order is
// from the minimum and from free delivery; "Clear all items" can be undone;
// both say the cart is kept on this device; checkout lines have their
// padding. Every request that leaves the preview server is aborted, except
// the catalog (./catalog.js) and, for the approved buyer, the mocked
// Supabase answers below (synthetic test prices from myPricesPayload).
import { test, expect } from '@playwright/test';
import { fulfillMyPrices, fulfillProducts, seedRows, serveCatalog, syntheticListPrice } from './catalog.js';
import { tierUnitPrice } from '../../src/lib/pricing.js';
import { GUEST_CART, cartFromStored, cartKey, cartValue } from './cartStore.js';

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
  return errors;
}

const cartButton = (page) => page.getByRole('button', { name: /^(Quote|Order), [\d,]+ items?$/ });
const said = (page) => page.evaluate(() => window.__said);
const money = (cents) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

test.beforeEach(async ({ context }) => {
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
    // What the shared live region says, from the first paint.
    window.__said = [];
    const watch = () => {
      const region = document.getElementById('aw-announcer');
      if (!region) return void setTimeout(watch, 20);
      new MutationObserver(() => { if (region.textContent) window.__said.push(region.textContent); })
        .observe(region, { childList: true, characterData: true, subtree: true });
    };
    watch();
  }, [AGE_KEY, ageRecord(Date.now())]);
});

test.describe('a guest', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
    await serveCatalog(context);
  });

  test('a drawer line’s name opens its product and closes the drawer; the drawer counts and says where the cart is kept (AW-239, AW-238, AW-334)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [GUEST_CART, cartValue({ 14: 2, 45: 1 })]);
    await page.reload();
    await cartButton(page).click();
    const drawer = page.getByRole('dialog', { name: 'Your quote' });
    await expect(drawer.locator('.cart-counts')).toHaveText('2 lines · 3 units');
    await expect(drawer.locator('.cart-summary-note')).toHaveText('Pricing, the order minimum and delivery are confirmed by the trade desk.');
    await expect(drawer.locator('progress')).toHaveCount(0);
    await expect(drawer.locator('.cart-device-note')).toHaveText('Saved in this browser only. Items added on another device won’t appear here.');
    // One link per line: the thumbnail is out of the tab order and hidden.
    await expect(drawer.locator('.drawer-line').first().locator('a.thumb')).toHaveAttribute('tabindex', '-1');
    await drawer.getByRole('link', { name: 'Kite cigarette tobacco' }).click();
    await expect(page).toHaveURL(/\/product\/14$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Kite cigarette tobacco' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('checkout lines sit 16px inside their border; Clear all items is undone back to the first quantity (AW-081, AW-082)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [GUEST_CART, cartValue({ 14: 2, 45: 1 })]);
    await page.goto('/quote');
    const line = page.locator('.checkout-line').first();
    const inset = await line.evaluate((li) => {
      const box = li.getBoundingClientRect();
      return { thumb: li.querySelector('.thumb').getBoundingClientRect().left - box.left, remove: box.right - li.querySelector('.drawer-remove').getBoundingClientRect().right };
    });
    expect(Math.round(inset.thumb)).toBe(17);
    expect(Math.round(inset.remove)).toBeGreaterThanOrEqual(17);
    const foot = page.locator('.checkout-list-foot');
    await expect(foot.locator('.cart-counts')).toHaveText('2 lines · 3 units');
    await expect(page.locator('.cart-device-note')).toHaveText('Saved in this browser only. Items added on another device won’t appear here.');

    await foot.getByRole('button', { name: 'Clear all items' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your quote is empty' })).toBeFocused();
    await expect(cartButton(page)).toHaveAccessibleName('Quote, 0 items');
    await expect(page.locator('.cart-cleared')).toHaveText('Removed 3 items. Undo');
    await expect.poll(async () => (await said(page)).at(-1)).toBe('Removed all items from your quote.');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Undo' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Quantity of Kite cigarette tobacco' })).toBeFocused();
    await expect(cartButton(page)).toHaveAccessibleName('Quote, 3 items');
    expect(cartFromStored(await page.evaluate((k) => localStorage.getItem(k), GUEST_CART))).toEqual({ 14: 2, 45: 1 });
    await expect.poll(async () => (await said(page)).at(-1)).toBe('Restored 3 items.');
    await expect(page.locator('.cart-cleared')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

// An approved buyer, mocked as in quote.spec.js, with synthetic prices.
const UID = '11111111-2222-4333-8444-555555555555';
const PROFILE = { id: UID, name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', phone: '205-555-0100', status: 'approved', role: 'customer', pricing_tier: 'silver' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function savedSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: PROFILE.email, app_metadata: { provider: 'email' }, user_metadata: {} };
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp, email: PROFILE.email })}.c2ln`;
  return { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'smoke-refresh', user };
}
// The unit price my_prices() gives product `id` (silver, 5% off), in cents.
const unitCents = (id) => Math.round(tierUnitPrice(syntheticListPrice(id), 5) * 100);

test('an approved buyer sees the way to the minimum, then to free delivery, in the drawer and at checkout (AW-238)', async ({ page, context }) => {
  const errors = trackErrors(page);
  await context.addInitScript(([authKey, session, cartKey, cart]) => {
    try {
      if (!sessionStorage.getItem('smoke-summary')) {
        localStorage.setItem(authKey, session);
        localStorage.setItem(cartKey, cart);
        sessionStorage.setItem('smoke-summary', '1');
      }
    } catch { /* storage blocked */ }
  }, ['aw-auth', JSON.stringify(savedSession()), cartKey(UID), cartValue({ 14: 30, 45: 3 })]);
  await page.route('**/*', (route) => {
    const req = route.request();
    const url = req.url();
    if (isLocal(url)) return route.continue();
    if (/\/auth\/v1\/user/.test(url)) return route.fulfill({ json: savedSession().user });
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return route.fulfill({ json: [PROFILE] });
    if (/\/rest\/v1\/orders/.test(url)) return route.fulfill({ json: [] });
    if (/\/rest\/v1\/products/.test(url)) return fulfillProducts(route, seedRows());
    if (/\/rest\/v1\/rpc\/my_prices/.test(url)) return fulfillMyPrices(route, seedRows());
    return route.abort();
  });
  const total = 30 * unitCents(14) + 3 * unitCents(45);
  const minimum = 500 * 100; // ORDER_MINIMUM in src/data/content.js
  const free = 1500 * 100; // FREE_DELIVERY_THRESHOLD
  expect(total).toBeLessThan(minimum);

  await page.goto('/');
  await cartButton(page).click();
  const drawer = page.getByRole('dialog', { name: 'Your order' });
  await expect(drawer.locator('.cart-counts')).toHaveText('2 lines · 33 units');
  const status = drawer.getByRole('status');
  await expect(status).toHaveText(`Add ${money(minimum - total)} to reach the $500 order minimum.`);
  await expect(drawer.getByRole('progressbar')).toHaveAccessibleName(`Add ${money(minimum - total)} to reach the $500 order minimum.`);
  await expect(drawer.locator('.cart-device-note')).toHaveText('Saved on this device for your account. It won’t show up when you sign in on another phone or computer.');
  // Past the minimum: the way to free delivery.
  const kite = drawer.getByRole('textbox', { name: 'Quantity of Kite cigarette tobacco' });
  await kite.fill('60');
  await kite.press('Enter');
  const more = 60 * unitCents(14) + 3 * unitCents(45);
  await expect(status).toHaveText(`Add ${money(free - more)} for free delivery on a delivery route.`);
  // Over the threshold.
  await kite.fill('120');
  await kite.press('Enter');
  await expect(status).toHaveText('This order qualifies for free delivery on a delivery route.');
  await drawer.getByRole('link', { name: 'Review order' }).click();

  // Checkout: the counts under the list, the meter under the total.
  await expect(page.getByRole('heading', { level: 1, name: 'Place your order' })).toBeVisible();
  await expect(page.locator('.checkout-list-foot .cart-counts')).toHaveText('2 lines · 123 units');
  await expect(page.locator('form[aria-labelledby="quote-form-title"] .cart-counts')).toHaveCount(0);
  await expect(page.locator('form[aria-labelledby="quote-form-title"]').getByRole('status')).toHaveText('This order qualifies for free delivery on a delivery route.');
  await expect(page.locator('form[aria-labelledby="quote-form-title"] progress.cart-meter.is-reached')).toHaveCount(1);
  expect(errors).toEqual([]);
});
