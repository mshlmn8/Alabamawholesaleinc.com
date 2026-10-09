// Admin -> Products after a confirmed bulk change or CSV import (NEW-004,
// AW-114): the confirmation hands focus to the list's count line as it
// closes, and the page doesn't move. Before, the bar or preview that opened
// it was gone by then, so focus fell back to the page's h1 or, on a phone, to
// the header's Menu button, scrolling to the top of a 50-row list. Against a
// mocked Supabase as a signed-in test admin: every Supabase request (and the
// Realtime socket) is answered here, nothing leaves the browser, and every
// value is a test value.
import { test, expect } from '@playwright/test';
import { fulfillProducts, seedRows, serveCatalog, syntheticListPrice } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const AUTH_KEY = 'aw-auth'; // AUTH_STORAGE_KEY in src/lib/supabase.js
const ADMIN = { id: '11111111-2222-4333-8444-666666666666', name: 'Desk Admin', business: 'Alabama Wholesale', email: 'admin@example.test', phone: '205-555-0103', status: 'approved', role: 'admin', pricing_tier: null };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const userOf = (profile) => ({ id: profile.id, aud: 'authenticated', role: 'authenticated', email: profile.email, app_metadata: { provider: 'email' }, user_metadata: {} });
function sessionOf(profile) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: profile.id, role: 'authenticated', aud: 'authenticated', exp, email: profile.email })}.c2ln`;
  return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'smoke-refresh', user: userOf(profile) };
}
const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');
const json = (route, body, status = 200, headers = {}) => route.fulfill({
  status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: JSON.stringify(body),
});

test.beforeEach(async ({ page, context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  // The admin's Realtime socket goes nowhere.
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, () => {});
  await context.addInitScript(([ageKey, age, authKey, session]) => {
    try {
      localStorage.setItem(ageKey, age);
      if (!sessionStorage.getItem('smoke-seeded')) {
        localStorage.setItem(authKey, session);
        sessionStorage.setItem('smoke-seeded', '1');
      }
    } catch { /* storage blocked */ }
  }, [AGE_KEY, JSON.stringify({ ok: true, at: Date.now() }), AUTH_KEY, JSON.stringify(sessionOf(ADMIN))]);
  const rows = seedRows();
  const prices = Object.fromEntries(rows.map((r) => [r.id, { list: syntheticListPrice(r.id), variants: {} }]));
  await page.route(/supabase\.co\//, (route) => {
    const req = route.request();
    const url = decodeURIComponent(req.url());
    if (/\/auth\/v1\/user/.test(url)) return json(route, userOf(ADMIN));
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return json(route, [ADMIN]);
    if (/\/rest\/v1\/products/.test(url)) {
      if (req.method() === 'GET') return fulfillProducts(route, rows);
      const ids = /id=in\.\(([^)]*)\)/.exec(url)?.[1]?.split(',').map(Number) || [];
      return json(route, ids.map((id) => ({ id, updated_at: '2026-10-09T12:00:00Z' })));
    }
    if (/\/rpc\/admin_product_prices/.test(url)) return json(route, prices);
    if (/\/rpc\/admin_import_products_v2/.test(url)) {
      const sent = JSON.parse(req.postData() || '{}').p_rows || [];
      return json(route, { updated: sent.length, created: 0 });
    }
    if (/\/rest\/v1\//.test(url)) return json(route, [], 200, { 'access-control-expose-headers': 'Content-Range', 'content-range': '*/0' });
    return route.abort();
  });
});

const focusState = (page) => page.evaluate(() => ({
  y: Math.round(window.scrollY),
  count: document.activeElement?.classList.contains('admin-count') ?? false,
  active: `${document.activeElement?.tagName}.${document.activeElement?.className}`,
}));

test('a confirmed bulk tag change focuses the count line and doesn’t throw the page to the top', async ({ page }) => {
  await page.goto('/admin/products');
  const boxes = page.locator('table.admin-products tbody input[type=checkbox]');
  await expect(boxes.first()).toBeVisible();
  for (let i = 0; i < 6; i += 1) await boxes.nth(i).check();
  const bar = page.getByRole('region', { name: 'Change the selected products' });
  await bar.getByRole('button', { name: 'Set tag' }).click();
  await bar.getByLabel('New tag').selectOption('NEW');
  const submit = bar.locator('form button[type=submit]');
  // Down the page, as an admin who scrolled to the bar is.
  await submit.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await submit.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('heading')).toHaveText('Set the tag of 6 products?');
  const before = await focusState(page);
  expect(before.y).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: 'Tag 6 products' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(bar).toHaveCount(0);
  await expect.poll(async () => (await focusState(page)).count).toBe(true);
  // Not thrown to the top: the page stays down where the bar was (the
  // browser only clamps or anchors it as the bar goes), with the focused
  // count line on screen.
  const after = await focusState(page);
  expect(after.y).toBeGreaterThan(0);
  await expect(page.locator('.admin-count')).toBeInViewport();
});

test('an import’s Update n products focuses the count line, never the top of the page', async ({ page }) => {
  await page.goto('/admin/products');
  await expect(page.locator('table.admin-products tbody tr').first()).toBeVisible();
  const [one, two] = seedRows();
  await page.locator('input[type=file]').setInputFiles({
    name: 'products-import2.csv', mimeType: 'text/csv', buffer: Buffer.from(`sku,name\n${one.sku},Renamed one\n${two.sku},Renamed two\n`),
  });
  const preview = page.getByRole('region', { name: /^Import / });
  const importButton = preview.getByRole('button', { name: 'Import 2 changes' });
  await importButton.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await importButton.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Update 2 products' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(preview).toHaveCount(0);
  await expect.poll(async () => (await focusState(page)).count).toBe(true);
  expect((await focusState(page)).y).toBeGreaterThan(0);
  await expect(page.locator('.admin-count')).toBeInViewport();
  await expect(page.locator('.admin-status-text')).toHaveText('Updated 2 products from products-import2.csv');
});
