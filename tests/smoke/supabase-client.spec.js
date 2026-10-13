// The site's own Supabase client (AW-179, src/lib/supabase.js): auth-js and
// postgrest-js on every page, Storage loaded on demand, Realtime only in the
// admin code. Against a mocked Supabase: storefront pages never download
// Storage or Realtime; an application goes through auth-js's sign-up; a
// pending account's document goes through the Storage that loads on demand;
// Admin -> Orders hears a change on the Realtime socket, as the signed-in
// admin, and still reloads every minute. Every Supabase request (and the
// socket) is answered here; nothing leaves the browser, and every value is a
// test value.
import { test, expect } from '@playwright/test';
import { fulfillProducts, seedRows, serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const AUTH_KEY = 'aw-auth'; // AUTH_STORAGE_KEY in src/lib/supabase.js
const CLIENT_INFO = 'supabase-js/2.117.2; runtime=web'; // CLIENT_INFO in src/lib/supabase.js
const UID = '11111111-2222-4333-8444-555555555555';
const ADMIN_UID = '11111111-2222-4333-8444-666666666666';
const PENDING = { id: UID, name: 'Test Pending', business: 'Pending Mart LLC', email: 'pending@example.test', phone: '205-555-0101', status: 'pending', role: 'customer', pricing_tier: null };
const ADMIN = { id: ADMIN_UID, name: 'Desk Admin', business: 'Alabama Wholesale', email: 'admin@example.test', phone: '205-555-0103', status: 'approved', role: 'admin', pricing_tier: null };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (profile, exp) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: profile.id, role: 'authenticated', aud: 'authenticated', exp, email: profile.email })}.c2ln`;
const userOf = (profile) => ({ id: profile.id, aud: 'authenticated', role: 'authenticated', email: profile.email, app_metadata: { provider: 'email' }, user_metadata: {} });
function sessionOf(profile) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return { access_token: jwt(profile, exp), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'smoke-refresh', user: userOf(profile) };
}

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');
const json = (route, body, status = 200, headers = {}) => route.fulfill({
  status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: JSON.stringify(body),
});

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text())) return; // requests this spec answers 4xx or aborts on purpose
    errors.push(`console: ${m.text()}`);
  });
  return errors;
}

// The site's own files the page asked for, by name.
function scripts(page) {
  const names = [];
  page.on('request', (req) => {
    const match = /\/assets\/([^/?]+\.js)/.exec(req.url());
    if (match && isLocal(req.url())) names.push(match[1]);
  });
  return names;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await context.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
  }, [AGE_KEY, JSON.stringify({ ok: true, at: Date.now() })]);
});

const seedSession = (context, session) => context.addInitScript(([key, value]) => {
  try {
    if (!sessionStorage.getItem('smoke-seeded')) {
      localStorage.setItem(key, value);
      sessionStorage.setItem('smoke-seeded', '1');
    }
  } catch { /* storage blocked */ }
}, [AUTH_KEY, JSON.stringify(session)]);

test('storefront pages load the Supabase client without Storage or Realtime', async ({ page }) => {
  const errors = trackErrors(page);
  const loaded = scripts(page);
  for (const path of ['/', '/category/tobacco', '/product/1', '/apply']) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
  }
  // The pages fetched ahead once idle (NEW-006) are in too by now.
  await page.waitForTimeout(1500);
  expect(loaded.some((name) => /^supabase-/.test(name))).toBe(true);
  expect(loaded.filter((name) => /^(storage|realtime)-/.test(name))).toEqual([]);
  expect(errors).toEqual([]);
});

test('an application goes through auth-js: POST /auth/v1/signup with the anon key', async ({ page }) => {
  const errors = trackErrors(page);
  const signups = [];
  await page.route(/supabase\.co\//, (route) => {
    const req = route.request();
    if (/\/auth\/v1\/signup/.test(req.url())) {
      signups.push({ url: req.url(), headers: req.headers(), body: req.postDataJSON() });
      return json(route, { ...userOf(PENDING), email: 'new@example.test', identities: [{ id: UID, provider: 'email' }], created_at: new Date().toISOString() });
    }
    return route.abort();
  });
  await page.goto('/apply');
  await page.locator('.page-head').getByRole('button', { name: 'Apply for a trade account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Apply for a trade account' });
  await expect(dialog).toBeVisible();
  const fields = {
    'Your name': 'New Buyer', 'Business name': 'New Store', 'Business email': 'new@example.test', Phone: '205-555-0199',
    Password: 'smoke-password-1', 'Federal EIN': '12-3456789', 'State retail tobacco license #': 'TL-TEST', 'Resale certificate #': 'RS-TEST',
    'Store street address': '1 Test Way', City: 'Testville', ZIP: '35203',
  };
  for (const [label, value] of Object.entries(fields)) await dialog.getByLabel(label, { exact: true }).fill(value);
  await dialog.getByLabel('Business type').selectOption('Smoke Shop');
  await dialog.getByLabel('Store state').selectOption('AL');
  await dialog.getByLabel('Expected monthly volume').selectOption('$15K — $50K');
  await dialog.getByRole('checkbox', { name: /I agree to the Trade terms/ }).check();
  await dialog.getByRole('checkbox', { name: 'I am 21 or older' }).check();
  await dialog.getByRole('button', { name: 'Submit application' }).click();
  // The dialog is named by its title, which is now this.
  await expect(page.getByRole('dialog', { name: 'Check your inbox' })).toBeVisible();

  expect(signups).toHaveLength(1);
  const [sent] = signups;
  expect(new URL(sent.url).pathname).toBe('/auth/v1/signup');
  expect(sent.headers.apikey).toBeTruthy();
  expect(sent.headers.authorization).toBe(`Bearer ${sent.headers.apikey}`);
  expect(sent.headers['x-client-info']).toBe(CLIENT_INFO);
  expect(sent.body).toMatchObject({ email: 'new@example.test', password: 'smoke-password-1', data: { business: 'New Store', store_zip: '35203', terms_accepted: true, age_confirmed: true } });
  expect(errors).toEqual([]);
});

test('a pending account’s document goes through Storage, which loads on demand, as the signed-in account', async ({ page, context }) => {
  const errors = trackErrors(page);
  const loaded = scripts(page);
  const session = sessionOf(PENDING);
  await seedSession(context, session);
  const documents = [];
  const uploads = [];
  await page.route(/supabase\.co\//, (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/auth\/v1\/user/.test(url)) return json(route, userOf(PENDING));
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return json(route, [PENDING]);
    if (/\/rest\/v1\/profile_documents/.test(url)) {
      if (req.method() === 'GET') return json(route, documents.length ? documents : (/maybeSingle|vnd\.pgrst\.object/.test(req.headers().accept || '') ? null : []));
      if (req.method() === 'POST') {
        documents.push({ ...req.postDataJSON() });
        return json(route, null, 201);
      }
    }
    if (/\/storage\/v1\/object\/application-documents\//.test(url) && req.method() === 'POST') {
      uploads.push({ url, headers: req.headers() });
      return json(route, { Key: url.replace(/^.*\/object\//, ''), Id: 'test-object' });
    }
    if (/\/rest\/v1\/orders/.test(url)) return json(route, []);
    if (/\/rest\/v1\/products/.test(url)) return fulfillProducts(route, seedRows());
    return route.abort();
  });
  await page.goto('/apply');
  const panel = page.locator('.doc-panel');
  await expect(panel.getByRole('heading', { name: 'License documents' })).toBeVisible();
  // The panel starts downloading Storage's code when it opens.
  await expect.poll(() => loaded.some((name) => /^storage-/.test(name))).toBe(true);
  expect(loaded.some((name) => /^realtime-/.test(name))).toBe(false);
  await panel.getByLabel('State retail tobacco license').setInputFiles({
    name: 'license.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% test document\n%%EOF\n'),
  });
  await expect(panel.locator('[data-document-status="uploaded"]')).toHaveCount(1);
  expect(uploads).toHaveLength(1);
  expect(new URL(uploads[0].url).pathname).toMatch(new RegExp(`^/storage/v1/object/application-documents/${UID}/tobacco_license/\\d+-license\\.pdf$`));
  expect(uploads[0].headers.authorization).toBe(`Bearer ${session.access_token}`);
  expect(uploads[0].headers.apikey).toBeTruthy();
  expect(uploads[0].headers['x-upsert']).toBe('false');
  expect(documents[0]).toMatchObject({ profile_id: UID, document_type: 'tobacco_license', original_filename: 'license.pdf' });
  expect(errors).toEqual([]);
});

test('Admin -> Orders hears a change on the Realtime socket as the signed-in admin, and reloads every minute too', async ({ page, context }) => {
  const errors = trackErrors(page);
  const loaded = scripts(page);
  const session = sessionOf(ADMIN);
  await seedSession(context, session);
  const token = session.access_token;
  let orderLoads = 0;
  await page.route(/supabase\.co\//, (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/auth\/v1\/user/.test(url)) return json(route, userOf(ADMIN));
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return json(route, [ADMIN]);
    if (/\/rest\/v1\/orders/.test(url)) {
      if (req.method() === 'GET' && /order_items/.test(decodeURIComponent(url))) orderLoads += 1;
      return json(route, [], 200, { 'access-control-expose-headers': 'Content-Range', 'content-range': '*/0' });
    }
    if (/\/rest\/v1\/products/.test(url)) return fulfillProducts(route, seedRows());
    if (/\/rest\/v1\/rpc\//.test(url)) return json(route, null);
    if (/\/rest\/v1\//.test(url)) return json(route, [], 200, { 'access-control-expose-headers': 'Content-Range', 'content-range': '*/0' });
    return route.abort();
  });
  // A stand-in Realtime server (Phoenix's 2.0.0 JSON frames).
  const socket = { url: null, joins: [], frames: [], send: null };
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    socket.url = ws.url();
    socket.send = (frame) => ws.send(JSON.stringify(frame));
    ws.onMessage((message) => {
      const [joinRef, ref, topic, event, payload] = JSON.parse(String(message));
      socket.frames.push([event, topic, payload]);
      if (event === 'phx_join') {
        socket.joins.push({ topic, payload });
        ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', {
          status: 'ok', response: { postgres_changes: [{ id: 4242, event: '*', schema: 'public', table: 'orders' }] },
        }]));
      } else if (event === 'heartbeat' || event === 'access_token') {
        ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
      }
    });
  });
  await page.clock.install();
  await page.goto('/admin/orders');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => socket.joins.length).toBeGreaterThan(0);
  expect(new URL(socket.url).searchParams.get('apikey')).toBeTruthy();
  expect(socket.joins[0].topic).toBe('realtime:admin-orders');
  expect(socket.joins[0].payload.access_token).toBe(token);
  expect(socket.joins[0].payload.config.postgres_changes).toEqual([{ event: '*', schema: 'public', table: 'orders' }]);
  expect(loaded.some((name) => /^realtime-/.test(name))).toBe(true);

  // A change: one reload after the debounce.
  await expect.poll(() => orderLoads).toBeGreaterThan(0);
  const before = orderLoads;
  socket.send([null, null, 'realtime:admin-orders', 'postgres_changes', {
    ids: [4242], data: { type: 'INSERT', schema: 'public', table: 'orders', commit_timestamp: new Date().toISOString(), record: { id: 'o1' }, columns: [], errors: null },
  }]);
  await page.clock.runFor(600);
  await expect.poll(() => orderLoads).toBe(before + 1);
  // And the minute's reload.
  await page.clock.runFor(60_000);
  await expect.poll(() => orderLoads).toBeGreaterThan(before + 1);
  expect(errors).toEqual([]);
});
