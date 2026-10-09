// Checkout against submit_quote v3 (AW-049, AW-079, AW-198, AW-014): a guest
// will-call quote for a tobacco line sends the license answers, no address
// and no reference, and shows the one the server made; on the live database
// (neither v3 nor PR #12's function) the quote goes out the 13-argument way
// with the answers in the notes; a refusal names the problem. After a save
// the receipt replaces checkout, survives a reload and Back, and the sent
// lines leave the cart (AW-012, AW-022, AW-108). Products come
// from the seeded catalog (./catalog.js), submit_quote is answered here, and
// every other request that leaves the preview server is aborted.
import { test, expect } from '@playwright/test';
import { fulfillMyPrices, fulfillProducts, seedRows, serveCatalog } from './catalog.js';
import { GUEST_CART, cartKey, cartValue } from './cartStore.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
const ageRecord = (at) => JSON.stringify({ ok: true, at });
// COMPANY.addressStreet etc. in src/data/content.js (the spec can't import it: it imports images).
const WAREHOUSE = ['613 Graymont Ave N', 'Birmingham', 'AL', '35203'];

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const source = m.location()?.url || '';
    // Aborted remote requests, and the 4xx answers this spec gives on purpose.
    if (source && !isLocal(source) && /Failed to load resource/.test(m.text())) return;
    errors.push(`console: ${m.text()}`);
  });
  return errors;
}

// Answers submit_quote with each of `answers` in turn ({ status, json }) and
// records the bodies.
async function quoteApi(page, ...answers) {
  const sent = [];
  await page.route(/\/rest\/v1\/rpc\/submit_quote/, (route) => {
    sent.push(route.request().postDataJSON());
    const { status = 200, json } = answers.shift() || { status: 500, json: { message: 'unexpected call' } };
    return route.fulfill({ status, json });
  });
  return sent;
}

async function fillGuest(page) {
  for (const [label, value] of [['Business name', 'Test Market LLC'], ['Contact name', 'Test Buyer'], ['Email', 'buyer@example.test'], ['Phone', '205-555-0100']]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
}

// Product 14 is a tobacco line, so a guest gives the license answers (PR #12).
async function fillLicense(page) {
  await page.getByLabel('State tobacco/retail license #').fill('TL-SMOKE-1');
  await page.getByLabel('Sales-tax / resale certificate #').fill('RS-SMOKE-1');
  await page.getByRole('checkbox', { name: /all purchasers are 21\+/ }).check();
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  await context.addInitScript(([ageKey, age, cartKey, cart]) => {
    try {
      localStorage.setItem(ageKey, age);
      if (!sessionStorage.getItem('smoke-cart')) {
        localStorage.setItem(cartKey, cart);
        sessionStorage.setItem('smoke-cart', '1');
      }
    } catch { /* storage blocked */ }
  }, [AGE_KEY, ageRecord(Date.now()), GUEST_CART, cartValue({ 14: 2 })]);
});

test('a guest will-call quote sends no address or reference, and shows the server’s reference (AW-049, AW-079)', async ({ page }) => {
  const errors = trackErrors(page);
  const sent = await quoteApi(page, { json: { id: 'smoke-order', ref_num: 'ALW-Q-5E4F3A2B1C', kind: 'quote', total_units: 2, subtotal: null, priced_lines: 0, unpriced_lines: 1 } });
  await page.goto('/quote');
  await expect(page.getByRole('heading', { level: 1, name: 'Request a quote' })).toBeVisible();
  // Guests can sign in or apply first (AW-014), and the tobacco line asks for the license answers, all required.
  await expect(page.getByRole('button', { name: 'New here? Apply for a trade account' })).toBeVisible();
  await expect(page.getByLabel('State tobacco/retail license #')).toHaveAttribute('required', '');
  await fillGuest(page);
  await page.getByLabel('Street', { exact: true }).fill('1 Test Way');
  await page.getByLabel('Delivery method').selectOption('willcall');
  await expect(page.getByLabel('Street', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Pickup at 613 Graymont Ave N, Birmingham AL 35203 during business hours.')).toBeVisible();
  await fillLicense(page);
  await page.getByRole('button', { name: /Submit quote request/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Thank you/ })).toBeVisible();
  await expect(page.getByText('ALW-Q-5E4F3A2B1C')).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0]).not.toHaveProperty('p_ref_num');
  expect(sent[0]).toMatchObject({
    p_delivery: 'willcall', p_ship_street: null, p_ship_city: null, p_ship_state: null, p_ship_zip: null,
    p_license_no: 'TL-SMOKE-1', p_resale_cert: 'RS-SMOKE-1', p_purchasers_21: true,
    p_items: [{ product_id: 14, variant: null, qty: 2 }],
  });
  expect(errors).toEqual([]);
});

test('on the live database (no v3, no PR #12 function), the quote goes out the 13-argument way', async ({ page }) => {
  const errors = trackErrors(page);
  const missing = { status: 404, json: { code: 'PGRST202', message: 'Could not find the function public.submit_quote(...) in the schema cache' } };
  const sent = await quoteApi(page, missing, missing,
    { json: { id: 'smoke-order', ref_num: 'ALW-Q-FROMCLIENT', total_units: 2, subtotal: null } });
  await page.goto('/quote');
  await fillGuest(page);
  await page.getByLabel('Delivery method').selectOption('willcall');
  await fillLicense(page);
  await page.getByRole('button', { name: /Submit quote request/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Thank you/ })).toBeVisible();
  expect(sent).toHaveLength(3);
  // PR #12's 16-argument call, then the 13-argument one, with one client reference.
  expect(sent[1]).toMatchObject({ p_license_no: 'TL-SMOKE-1', p_purchasers_21: true });
  expect(sent[2].p_ref_num).toMatch(/^ALW-Q-[0-9A-F]{10}$/);
  expect(sent[2].p_ref_num).toBe(sent[1].p_ref_num);
  expect(sent[2]).not.toHaveProperty('p_license_no');
  expect(sent[2].p_notes).toContain('State tobacco/retail license #: TL-SMOKE-1');
  expect([sent[2].p_ship_street, sent[2].p_ship_city, sent[2].p_ship_state, sent[2].p_ship_zip]).toEqual(WAREHOUSE);
  // The receipt shows what the database saved.
  await expect(page.getByText('ALW-Q-FROMCLIENT')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a refusal says what to fix and cites no reference (AW-198)', async ({ page }) => {
  const errors = trackErrors(page);
  await quoteApi(page, { status: 400, json: { code: 'P0001', message: 'Delivery routes cover AL, MS, GA — choose will-call', hint: 'delivery_state', details: null } });
  await page.goto('/quote');
  await fillGuest(page);
  // The State lists route states only (AW-078); the server's answer is mocked.
  for (const [label, value] of [['Street', '1 Test Way'], ['City', 'Nashville'], ['ZIP', '37201']]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByLabel('State', { exact: true }).selectOption('AL');
  await fillLicense(page);
  await page.getByRole('button', { name: /Submit quote request/ }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toHaveText('Delivery routes cover AL, MS and GA. For another state, choose will-call pickup.');
  await expect(page.getByLabel('State', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('main')).not.toContainText(/ALW-/);
  expect(errors).toEqual([]);
});

// After the save (AW-012, AW-022, AW-108): the lines that were sent leave the
// cart, and /quote shows a receipt that a reload or Back keeps, until a new
// visit to /quote. submit_quote is always answered here.
const RECEIPT_ANSWER = { json: { id: 'smoke-order', ref_num: 'ALW-Q-RECEIPT001', kind: 'quote', total_units: 2, subtotal: null, priced_lines: 0, unpriced_lines: 1 } };

async function fillAddress(page) {
  for (const [label, value] of [['Street', '1 Test Way'], ['City', 'Birmingham'], ['ZIP', '35203']]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByLabel('State', { exact: true }).selectOption('AL');
}

test('the receipt replaces checkout: the cart empties, and a reload or Back keeps it (AW-012, AW-022)', async ({ page }) => {
  const errors = trackErrors(page);
  const sent = await quoteApi(page, RECEIPT_ANSWER);
  await page.goto('/quote');
  await expect(page.locator('.aw-cart-count')).toHaveText('2');
  await fillGuest(page);
  await fillAddress(page);
  await page.getByLabel('Notes (optional)', { exact: true }).fill('Back door, before 10');
  await fillLicense(page);
  await page.getByRole('button', { name: /Submit quote request/ }).click();

  const thanks = page.getByRole('heading', { level: 1, name: 'Thank you, Test Buyer.' });
  await expect(thanks).toBeVisible();
  await expect(thanks).toBeFocused();
  await expect(page.getByText('QUOTE RECEIVED')).toBeVisible();
  await expect(page.locator('.receipt-ref-number')).toHaveText('ALW-Q-RECEIPT001');
  await expect(page.locator('.receipt-items li')).toHaveText(['2 × Kite cigarette tobacco (AW-KITE)']);
  await expect(page.locator('.receipt-details')).toContainText('Next-day delivery (on route)');
  await expect(page.locator('.receipt-details')).toContainText('1 Test Way');
  await expect(page.locator('.receipt-details')).toContainText('Back door, before 10');
  // The sent lines left the cart: no badge, and nothing stored for the guest.
  await expect(page.locator('.aw-cart-count')).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), GUEST_CART)).toBeNull();
  await expect(page).toHaveTitle('Quote received · Alabama Wholesale Inc');
  // The receipt is kept for this tab only, never in localStorage.
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /receipt/.test(key)))).toEqual([]);

  await page.reload();
  await expect(thanks).toBeVisible();
  await expect(page.locator('.receipt-ref-number')).toHaveText('ALW-Q-RECEIPT001');
  await expect(page).toHaveTitle('Quote received · Alabama Wholesale Inc');
  await expect(page.getByRole('button', { name: /Submit/ })).toHaveCount(0);

  await page.getByRole('link', { name: 'Continue shopping' }).click();
  await expect(page).toHaveURL(/\/catalog$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/quote$/);
  await expect(thanks).toBeVisible();
  await expect(page).toHaveTitle('Quote received · Alabama Wholesale Inc');

  // A new visit to /quote starts again: the cart is empty. (Opening the same
  // address again is a reload in Chromium, which keeps the receipt.)
  await page.goto('/catalog');
  await page.goto('/quote');
  await expect(page.getByRole('heading', { level: 1, name: 'Your quote is empty' })).toBeVisible();
  await expect(page).toHaveTitle('Request a quote · Alabama Wholesale Inc');
  expect(sent).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('a double click, or two submits in one moment, sends one quote (AW-012)', async ({ page }) => {
  const errors = trackErrors(page);
  const sent = await quoteApi(page, RECEIPT_ANSWER, { json: { ...RECEIPT_ANSWER.json, ref_num: 'ALW-Q-RECEIPT002' } }, { json: { ...RECEIPT_ANSWER.json, ref_num: 'ALW-Q-RECEIPT003' } });
  await page.goto('/quote');
  await fillGuest(page);
  await page.getByLabel('Delivery method').selectOption('willcall');
  await fillLicense(page);
  await page.getByRole('button', { name: /Submit quote request/ }).dblclick();
  await expect(page.getByRole('heading', { level: 1, name: /Thank you/ })).toBeVisible();
  await expect(page.locator('.receipt-details')).toContainText('Will-call pickup');
  await page.waitForTimeout(300);
  expect(sent).toHaveLength(1);

  // Two submits in the same task, before React re-renders the button.
  await page.evaluate(([key, cart]) => localStorage.setItem(key, cart), [GUEST_CART, cartValue({ 14: 2 })]);
  await page.goto('/catalog');
  await page.goto('/quote');
  await fillGuest(page);
  await page.getByLabel('Delivery method').selectOption('willcall');
  await fillLicense(page);
  await page.evaluate(() => {
    const form = document.querySelector('form[aria-labelledby="quote-form-title"]');
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.locator('.receipt-ref-number')).toHaveText('ALW-Q-RECEIPT002');
  await page.waitForTimeout(300);
  expect(sent).toHaveLength(2);
  expect(errors).toEqual([]);
});

// An approved buyer, mocked as in auth.spec.js: the receipt says ORDER
// RECEIVED, and its heading block is centred (AW-108).
const UID = '11111111-2222-4333-8444-555555555555';
const PROFILE = { id: UID, name: 'Test Buyer', business: 'Test Market LLC', email: 'buyer@example.test', phone: '205-555-0100', status: 'approved', role: 'customer', pricing_tier: 'silver' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function savedSession() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: PROFILE.email, app_metadata: { provider: 'email' }, user_metadata: {} };
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', aud: 'authenticated', exp, email: PROFILE.email })}.c2ln`;
  return { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'smoke-refresh', user };
}

test('an approved buyer’s receipt says ORDER RECEIVED, centred, with a link to the order history (AW-022, AW-108)', async ({ page, context }) => {
  const errors = trackErrors(page);
  await context.addInitScript(([authKey, session, cartKey, cart]) => {
    try {
      if (!sessionStorage.getItem('smoke-approved')) {
        localStorage.setItem(authKey, session);
        localStorage.setItem(cartKey, cart);
        sessionStorage.setItem('smoke-approved', '1');
      }
    } catch { /* storage blocked */ }
  }, ['aw-auth', JSON.stringify(savedSession()), cartKey(UID), cartValue({ 45: 3 })]);
  const sent = [];
  await page.route(/supabase\.co\//, async (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/auth\/v1\/user/.test(url)) return route.fulfill({ json: savedSession().user });
    if (/\/rest\/v1\/profiles/.test(url) && req.method() === 'GET') return route.fulfill({ json: [PROFILE] });
    if (/\/rest\/v1\/orders/.test(url)) return route.fulfill({ json: [] });
    if (/\/rest\/v1\/products/.test(url)) return fulfillProducts(route, seedRows());
    if (/\/rest\/v1\/rpc\/my_prices/.test(url)) return fulfillMyPrices(route, seedRows());
    if (/\/rest\/v1\/rpc\/submit_quote/.test(url)) {
      sent.push(req.postDataJSON());
      return route.fulfill({ json: { id: 'smoke-approved-order', ref_num: 'ALW-O-RECEIPT004', kind: 'order', total_units: 3, subtotal: 30.6, priced_lines: 1, unpriced_lines: 0 } });
    }
    return route.abort();
  });
  await page.goto('/quote');
  await expect(page.getByRole('heading', { level: 1, name: 'Place your order' })).toBeVisible();
  await fillAddress(page);
  await page.getByRole('button', { name: /Submit order/ }).click();
  await expect(page.getByText('ORDER RECEIVED')).toBeVisible();
  await expect(page.locator('.receipt-ref-number')).toHaveText('ALW-O-RECEIPT004');
  await expect(page.getByText('Saved total: $30.60 · 3 units')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View order history' })).toHaveAttribute('href', '/account');
  await expect(page).toHaveTitle('Order received · Alabama Wholesale Inc');
  expect(sent).toHaveLength(1);

  // The eyebrow, the heading and the reference line are centred on the page
  // (their text, not their boxes: AW-108 was a full-width box with its text
  // pinned left).
  const centres = await page.evaluate(() => {
    const textCentre = (nodes) => {
      const rects = nodes.flatMap((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) return [node.getBoundingClientRect()];
        const range = document.createRange();
        range.selectNodeContents(node);
        return [...range.getClientRects()];
      });
      return (Math.min(...rects.map((r) => r.left)) + Math.max(...rects.map((r) => r.right))) / 2;
    };
    const textNodes = (el) => {
      const out = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) if (walker.currentNode.textContent.trim()) out.push(walker.currentNode);
      return out;
    };
    const head = document.querySelector('.receipt-head');
    const ref = head.querySelector('.receipt-ref');
    return {
      page: document.documentElement.clientWidth / 2,
      eyebrow: textCentre(textNodes(head.querySelector('.eyebrow'))),
      heading: textCentre(textNodes(head.querySelector('h1'))),
      refLabel: textCentre(textNodes(ref.querySelector('.receipt-ref-label'))),
      // The number and its Copy button are centred together.
      refLine: textCentre([ref.querySelector('.receipt-ref-number'), ref.querySelector('.receipt-copy')].filter(Boolean)),
    };
  });
  for (const key of ['eyebrow', 'heading', 'refLabel', 'refLine']) expect(Math.abs(centres[key] - centres.page), key).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});
