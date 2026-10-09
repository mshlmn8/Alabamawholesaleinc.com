// The quote form's checks and its draft (AW-078, AW-080): the State lists
// the route states, the phone needs 10 digits, and what a buyer typed comes
// back after following a line's product link and Back, after the breadcrumb
// and Back, and after a reload; signing out discards it. The license answers
// are never kept. Products come from the seeded catalog (./catalog.js); the
// approved buyer's Supabase is mocked here, and every other request that
// leaves the preview server is aborted. Nothing is submitted.
import { test, expect } from '@playwright/test';
import { fulfillMyPrices, fulfillProducts, seedRows, serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const DRAFT_KEY = 'aw-quote-draft'; // STORAGE.quoteDraft in src/data/content.js
const GUEST_CART = 'aw-cart-v2:guest'; // cartKey('guest') in src/lib/cartStorage.js
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

const form = (page) => page.locator('form[aria-labelledby="quote-form-title"]');
const field = (page, label) => form(page).getByLabel(label, { exact: true });
const draft = (page) => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), DRAFT_KEY);

// Seeds the age confirmation, and `cart` for `owner` in the first page load
// of the tab only.
const seed = (context, owner, cart) => context.addInitScript(([ageKey, age, cartKey, value]) => {
  try {
    localStorage.setItem(ageKey, age);
    if (!sessionStorage.getItem('smoke-cart')) {
      localStorage.setItem(cartKey, value);
      sessionStorage.setItem('smoke-cart', '1');
    }
  } catch { /* storage blocked */ }
}, [AGE_KEY, ageRecord(Date.now()), `aw-cart-v2:${owner}`, JSON.stringify(cart)]);

const TYPED = [['Business name', 'Draft Market LLC'], ['Contact name', 'Dee Draft'], ['Email', 'dee@example.test'], ['Phone', '(205) 555-0123'],
  ['Street', '7 Draft Rd'], ['City', 'Tupelo'], ['ZIP', '38801']];

async function expectTyped(page, notes = 'Dock B\nBefore 10 AM') {
  for (const [label, value] of TYPED) await expect(field(page, label), label).toHaveValue(value);
  await expect(field(page, 'State')).toHaveValue('MS');
  await expect(field(page, 'Notes')).toHaveValue(notes);
}

test.describe('a guest', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
    await serveCatalog(context);
    // Kite (14) is a tobacco line, so the license questions show; Argo (45) isn't.
    await seed(context, 'guest', { 14: 2, 45: 3 });
  });

  test('the State lists the route states and the phone needs 10 digits (AW-078)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/quote');
    const state = field(page, 'State');
    await expect(state.locator('option')).toHaveText(['Choose a state…', 'Alabama', 'Georgia', 'Mississippi']);
    await expect(state).toHaveAccessibleDescription('Delivery routes cover AL, MS and GA. For another state, choose will-call pickup.');
    await expect(field(page, 'Notes')).toHaveJSProperty('tagName', 'TEXTAREA');
    const phone = field(page, 'Phone');
    await expect(phone).toHaveAccessibleDescription('10 digits, for example (205) 555-0123');
    // The browser refuses letters (the pattern compiles with the v flag).
    await phone.fill('hello');
    expect(await phone.evaluate((el) => el.validity.patternMismatch)).toBe(true);
    await phone.fill('(205) 555-0123');
    expect(await phone.evaluate((el) => el.validity.valid)).toBe(true);
    // Eleven digits pass the pattern; the page stops them before anything is sent.
    for (const [label, value] of [['Business name', 'Test Market LLC'], ['Contact name', 'Test Buyer'], ['Email', 'buyer@example.test'], ['Phone', '205-555-01234'],
      ['Street', '1 Test Way'], ['City', 'Birmingham'], ['ZIP', '35203'],
      ['State tobacco/retail license #', 'TL-SMOKE'], ['Sales-tax / resale certificate #', 'RS-SMOKE']]) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await state.selectOption('AL');
    await page.getByRole('checkbox', { name: /all purchasers are 21\+/ }).check();
    const sent = [];
    await page.route(/\/rest\/v1\/rpc\/submit_quote/, (route) => { sent.push(1); return route.abort(); });
    await page.getByRole('button', { name: 'Submit quote request' }).click();
    await expect(page.getByRole('alert')).toHaveText('Enter a 10-digit phone number.');
    await expect(phone).toHaveAttribute('aria-invalid', 'true');
    await expect(phone).toBeFocused();
    expect(sent).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('what was typed comes back after a line’s link and Back, the breadcrumb and Back, and a reload, without the license answers (AW-080)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/quote');
    await expect(page.getByRole('heading', { level: 1, name: 'Request a quote' })).toBeVisible();
    for (const [label, value] of TYPED) await field(page, label).fill(value);
    await field(page, 'State').selectOption('MS');
    await field(page, 'Notes').fill('Dock B\nBefore 10 AM');
    await page.getByLabel('State tobacco/retail license #').fill('TL-SECRET');
    await page.getByLabel('Sales-tax / resale certificate #').fill('RS-SECRET');
    await page.getByRole('checkbox', { name: /all purchasers are 21\+/ }).check();

    // A line's name links to its product (AW-239), then Back.
    await page.locator('.checkout-lines a.line-name', { hasText: 'Argo corn starch' }).click();
    await expect(page).toHaveURL(/\/product\/45$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/quote$/);
    await expectTyped(page);
    // The license answers are asked again.
    await expect(page.getByLabel('State tobacco/retail license #')).toHaveValue('');
    await expect(page.getByLabel('Sales-tax / resale certificate #')).toHaveValue('');
    await expect(page.getByRole('checkbox', { name: /all purchasers are 21\+/ })).not.toBeChecked();

    // The breadcrumb, then Back.
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expectTyped(page);

    // A reload straight after an edit.
    await field(page, 'Notes').fill('Dock C\nAfter 2 PM');
    await page.reload();
    await expectTyped(page, 'Dock C\nAfter 2 PM');

    // Kept for this tab only, never in localStorage, never the license answers.
    const stored = await draft(page);
    expect(stored.owner).toBe('guest');
    expect(JSON.stringify(stored)).not.toMatch(/TL-SECRET|RS-SECRET|licenseNo|resaleCert|purchasers21/);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /draft/.test(key)))).toEqual([]);
    expect(errors).toEqual([]);
  });
});

// An approved buyer, mocked as in quote.spec.js; Sign out is answered here.
const UID = '11111111-2222-4333-8444-555555555555';
const PROFILE = { id: UID, name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', phone: '205-555-0100', status: 'approved', role: 'customer', pricing_tier: 'silver', state: 'AL' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function savedSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: PROFILE.email, app_metadata: { provider: 'email' }, user_metadata: {} };
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp, email: PROFILE.email })}.c2ln`;
  return { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'smoke-refresh', user };
}

test('an approved buyer’s draft wins over the profile, survives a reload, and is gone after Sign out (AW-080)', async ({ page, context }) => {
  const errors = trackErrors(page);
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await seed(context, UID, { 45: 3 });
  await context.addInitScript(([authKey, session]) => {
    try {
      if (!sessionStorage.getItem('smoke-session')) {
        localStorage.setItem(authKey, session);
        sessionStorage.setItem('smoke-session', '1');
      }
    } catch { /* storage blocked */ }
  }, ['aw-auth', JSON.stringify(savedSession())]);
  await page.route(/supabase\.co\//, async (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/auth\/v1\/user/.test(url)) return route.fulfill({ json: savedSession().user });
    if (/\/auth\/v1\/logout/.test(url)) return route.fulfill({ status: 204, body: '' });
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return route.fulfill({ json: [PROFILE] });
    if (/\/rest\/v1\/orders/.test(url)) return route.fulfill({ json: [] });
    if (/\/rest\/v1\/products/.test(url)) return fulfillProducts(route, seedRows());
    if (/\/rest\/v1\/rpc\/my_prices/.test(url)) return fulfillMyPrices(route, seedRows());
    return route.abort();
  });

  await page.goto('/quote');
  await expect(page.getByRole('heading', { level: 1, name: 'Place your order' })).toBeVisible();
  // The profile fills the form; the State from the store's route state.
  await expect(field(page, 'Business name')).toHaveValue('Test Market LLC');
  await expect(field(page, 'State')).toHaveValue('AL');
  await field(page, 'Contact name').fill('Dock Manager');
  await field(page, 'Street').fill('9 Loading Dock Rd');
  await field(page, 'Notes').fill('Ring the bell');
  await page.reload();
  await expect(field(page, 'Contact name')).toHaveValue('Dock Manager');
  await expect(field(page, 'Street')).toHaveValue('9 Loading Dock Rd');
  await expect(field(page, 'Notes')).toHaveValue('Ring the bell');
  // Fields the buyer left alone still come from the profile.
  await expect(field(page, 'Business name')).toHaveValue('Test Market LLC');
  expect((await draft(page)).owner).toBe(UID);

  const menu = page.getByRole('button', { name: 'Menu' });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  }
  await expect(page.locator('.site-notice[data-notice="signed-out"]')).toBeVisible();
  expect(await draft(page)).toBeNull();
  // The next person on this computer: a guest with a line in the cart sees an empty form.
  await page.getByRole('button', { name: /Yes, I am 21\+/ }).click();
  await page.evaluate(([key, cart]) => localStorage.setItem(key, cart), [GUEST_CART, JSON.stringify({ 45: 1 })]);
  await page.goto('/quote');
  await expect(page.getByRole('heading', { level: 1, name: 'Request a quote' })).toBeVisible();
  for (const label of ['Business name', 'Contact name', 'Street', 'Notes']) await expect(field(page, label), label).toHaveValue('');
  await expect(field(page, 'State')).toHaveValue('');
  expect(errors).toEqual([]);
});
