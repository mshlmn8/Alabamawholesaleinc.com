// Running the website from Admin (AW-030, AW-031; owner answer 2026-10),
// against a mocked Supabase as a signed-in test staff account: staff get
// every section but Pricing and the "How to use Admin" panel; Site settings
// saves a phone and a message that the storefront then shows; a product
// photo uploads to the product-images bucket and shows under the site's CSP;
// and with no site_settings table (the live database before
// 20261014121000) the storefront keeps the phone built into the site. Every
// Supabase request is answered here, nothing leaves the browser, and every
// value is a test value.
import { test, expect } from '@playwright/test';
import { fulfillProducts, seedRows, serveCatalog, syntheticListPrice } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const AUTH_KEY = 'aw-auth'; // AUTH_STORAGE_KEY in src/lib/supabase.js
const STAFF = { id: '11111111-2222-4333-8444-999999999999', name: 'Sam Staff', business: 'Desk Staff', email: 'staff@example.test', phone: '205-555-0104', status: 'approved', role: 'staff', pricing_tier: 'standard' };
// A 1x1 PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const userOf = (profile) => ({ id: profile.id, aud: 'authenticated', role: 'authenticated', email: profile.email, app_metadata: { provider: 'email' }, user_metadata: {} });
function sessionOf(profile) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: profile.id, role: 'authenticated', aud: 'authenticated', exp, email: profile.email })}.c2ln`;
  return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'smoke-refresh', user: userOf(profile) };
}
const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');
const json = (route, body, status = 200, headers = {}) => route.fulfill({
  status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range', ...headers }, body: JSON.stringify(body),
});

// db.settings: the site_settings row, or null for a database without the table.
async function mock(page, context, { signedIn = true, settings = {} } = {}) {
  const db = {
    settings: settings && { id: true, announcements: null, phone: null, email: null, hours: null, street: null, city: null, state: null, zip: null, updated_at: '2026-10-14T12:00:00Z', updated_by: null, ...settings },
    rows: seedRows(), writes: [], uploads: [],
  };
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, () => {});
  await context.addInitScript(([ageKey, age, authKey, session]) => {
    try {
      localStorage.setItem(ageKey, age);
      if (session && !sessionStorage.getItem('smoke-seeded')) {
        localStorage.setItem(authKey, session);
        sessionStorage.setItem('smoke-seeded', '1');
      }
    } catch { /* storage blocked */ }
  }, [AGE_KEY, JSON.stringify({ ok: true, at: Date.now() }), AUTH_KEY, signedIn ? JSON.stringify(sessionOf(STAFF)) : '']);
  const prices = Object.fromEntries(db.rows.map((r) => [r.id, { list: syntheticListPrice(r.id), variants: {} }]));
  await page.route(/supabase\.co\//, (route) => {
    const req = route.request();
    const url = decodeURIComponent(req.url());
    if (/\/auth\/v1\/user/.test(url)) return signedIn ? json(route, userOf(STAFF)) : json(route, { message: 'no session' }, 401);
    if (/\/storage\/v1\/object\/public\/product-images\//.test(url)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (/\/storage\/v1\/object\/product-images\//.test(url) && req.method() === 'POST') {
      db.uploads.push(url.replace(/^.*\/object\/product-images\//, ''));
      return json(route, { Key: 'product-images/x', Id: 'smoke' });
    }
    if (/\/rest\/v1\/site_settings/.test(url)) {
      if (!db.settings) return json(route, { code: 'PGRST205', message: "Could not find the table 'public.site_settings' in the schema cache" }, 404);
      if (req.method() === 'GET') return json(route, (req.headers().accept || '').includes('vnd.pgrst.object') ? db.settings : [db.settings]);
      const patch = JSON.parse(req.postData() || '{}');
      db.writes.push({ table: 'site_settings', patch });
      Object.assign(db.settings, patch);
      return json(route, [db.settings]);
    }
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return json(route, [STAFF]);
    if (/\/rest\/v1\/products/.test(url)) {
      if (req.method() === 'GET') return fulfillProducts(route, db.rows);
      const id = Number(/id=eq\.(\d+)/.exec(url)?.[1]);
      db.writes.push({ table: 'products', id, patch: JSON.parse(req.postData() || '{}') });
      return json(route, [{ id, updated_at: '2026-10-14T12:00:00Z' }]);
    }
    if (/\/rpc\/admin_product_prices/.test(url)) return json(route, prices);
    if (/\/rest\/v1\//.test(url)) return json(route, [], 200, { 'content-range': '*/0' });
    return route.abort();
  });
  return db;
}

test('staff get every section but Pricing, and the How to panel on the admin home', async ({ page, context }) => {
  await mock(page, context);
  await page.goto('/admin');
  const nav = page.getByRole('navigation', { name: 'Admin sections' });
  await expect(nav.getByRole('link')).toHaveText(['Orders', 'Accounts', 'Products', 'Homepage', 'Site settings']);
  const help = page.locator('details.admin-help');
  await help.locator('summary').click();
  await expect(help.getByRole('heading', { level: 3 })).toHaveCount(6);
  await expect(help.getByText('Only an admin can make someone staff or change pricing tiers. Ask the owner.')).toBeVisible();
});

test('Site settings saves a phone and a message, and the storefront shows them', async ({ page, context }) => {
  const db = await mock(page, context);
  await page.goto('/admin/settings');
  await page.getByLabel('Public phone').fill('205 555 0129');
  await page.getByLabel('Message 1').fill('Closed Monday for the holiday');
  await page.getByRole('button', { name: 'Save site settings' }).click();
  await expect(page.locator('.admin-status-text')).toHaveText(/^Saved the site settings\./);
  expect(db.writes.at(-1)).toMatchObject({ table: 'site_settings', patch: { phone: '(205) 555-0129', email: null } });
  expect(db.writes.at(-1).patch.announcements[0]).toBe('Closed Monday for the holiday');
  await page.goto('/contact');
  await expect(page.locator('.trade-call')).toHaveAttribute('href', 'tel:+12055550129');
  await expect(page.locator('.announcement-list li').nth(1)).toHaveText('Closed Monday for the holiday');
  await expect(page.locator('.footer-contact')).toContainText('(205) 555-0129');
});

test('a product photo uploads to product-images and shows under the site’s security policy', async ({ page, context }) => {
  const db = await mock(page, context);
  const blocked = [];
  page.on('console', (m) => { if (/Content Security Policy|Refused to load/.test(m.text())) blocked.push(m.text()); });
  await page.goto('/admin/products/2');
  await page.locator('#product-photo-file').setInputFiles({ name: 'Kite Front.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#product-photo-file-hint')).toHaveText('Uploaded. Save the product to show it on the site.');
  expect(db.uploads.at(-1)).toMatch(/^products\/2\/\d+-kite-front\.png$/);
  const img = page.locator('.product-photo-preview img');
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(blocked).toEqual([]);
  const url = await page.locator('#product-img').inputValue();
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect.poll(() => db.writes.filter((w) => w.table === 'products').at(-1)?.patch?.img).toBe(url);
});

test('without the site_settings table the storefront keeps the phone built into the site', async ({ page, context }) => {
  await mock(page, context, { signedIn: false, settings: null });
  await page.goto('/contact');
  await expect(page.locator('.trade-call')).toHaveAttribute('href', 'tel:+12054584788');
  await expect(page.locator('.announcement-list li')).toHaveCount(4);
  await expect(page.getByText(/All times are Central Time/)).toBeVisible();
});
