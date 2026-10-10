// Checkout at /checkout (AW-024: customers place orders, never quotes).
// Only a signed-in, approved account places an order (AW-014): a guest sees
// the cart with Sign in and Apply, and an account under review that it can
// order once approved, instead of the form. /quote and '#/quote' move to
// /checkout. An approved buyer's will-call order against submit_quote v3
// (AW-049, AW-079) sends no address, licence answers or reference, and
// shows the one the server made; on the live database (neither v3 nor PR
// #12's function) it goes out the 13-argument way; a refusal names the
// problem. After a save the receipt replaces checkout, survives a reload
// and Back, the sent lines leave the cart (AW-012, AW-022, AW-108), and a
// copy of the order is posted to the Netlify form 'order-notification' for
// the orders inbox, under the site's Content-Security-Policy, without
// holding up the receipt (AW-024). Products come from the seeded catalog
// (./catalog.js), the account and submit_quote are answered here
// (./account.js), and every other request that leaves the preview server is
// aborted. The preview server stands in for Netlify's form endpoint
// (scripts/netlify-forms.mjs).
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';
import { GUEST_CART, cartKey, cartValue } from './cartStore.js';
import { AGE_KEY, PENDING_PROFILE, UID, ageRecord, mockAccount, seedAccount } from './account.js';

// COMPANY.addressStreet etc. in src/data/content.js (the spec can't import it: it imports images).
const WAREHOUSE = ['613 Graymont Ave N', 'Birmingham', 'AL', '35203'];
const TITLE = 'Checkout · Alabama Wholesale Inc';

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');

function trackErrors(page, { allow = null } = {}) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const source = m.location()?.url || '';
    // Aborted remote requests, and the 4xx answers this spec gives on purpose.
    if (source && !isLocal(source) && /Failed to load resource/.test(m.text())) return;
    if (allow && allow.test(m.text())) return;
    errors.push(`console: ${m.text()}`);
  });
  return errors;
}

// The order email posts (form-name=order-notification), as the browser sent
// them to the preview server.
function orderEmails(page) {
  const posts = [];
  page.on('request', (req) => {
    if (req.method() !== 'POST' || new URL(req.url()).pathname !== '/') return;
    posts.push(Object.fromEntries(new URLSearchParams(req.postData() || '')));
  });
  return posts;
}

async function fillAddress(page) {
  for (const [label, value] of [['Street', '1 Test Way'], ['City', 'Birmingham'], ['ZIP', '35203']]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByLabel('State', { exact: true }).selectOption('AL');
}

const SAVED = { id: '3f2c9a1e-5b7d-4c11-8e2f-0a1b2c3d4e5f', ref_num: 'ALW-O-5E4F3A2B1C', kind: 'order', total_units: 2, subtotal: 20.2, priced_lines: 1, unpriced_lines: 0 };

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
});

test.describe('who may place an order (AW-014)', () => {
  test('a guest sees the cart, and Sign in and Apply instead of the order form', async ({ page, context }) => {
    const errors = trackErrors(page);
    await context.addInitScript(([ageKey, age, key, cart]) => {
      try {
        localStorage.setItem(ageKey, age);
        if (!sessionStorage.getItem('smoke-cart')) {
          localStorage.setItem(key, cart);
          sessionStorage.setItem('smoke-cart', '1');
        }
      } catch { /* storage blocked */ }
    }, [AGE_KEY, ageRecord(), GUEST_CART, cartValue({ 14: 2 })]);
    const submitted = await mockAccount(page, { onSubmit: () => ({ status: 500, json: {} }) });
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
    await expect(page).toHaveTitle(TITLE);
    await expect(page.getByRole('list', { name: 'Items in your order' }).locator('li')).toHaveCount(1);
    const panel = page.getByRole('region', { name: 'Sign in to place your order' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Apply for a trade account' })).toBeVisible();
    await expect(page.locator('form[aria-labelledby="quote-form-title"]')).toHaveCount(0);
    await expect(page.getByLabel('State tobacco/retail license #')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Place order|Submit/ })).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/quote/i);
    // Sign in opens the dialog.
    await panel.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(submitted).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('an account under review is told it can order once approved, with no approval time', async ({ page, context }) => {
    const errors = trackErrors(page);
    await seedAccount(context, { profile: PENDING_PROFILE, cart: { 14: 2 } });
    await mockAccount(page, { profile: PENDING_PROFILE });
    await page.goto('/checkout');
    const panel = page.getByRole('region', { name: 'Your account is being reviewed' });
    await expect(panel).toContainText('You can place orders once it’s approved.');
    await expect(panel).not.toContainText(/business day|within/i);
    await expect(panel.getByRole('link', { name: 'Application status' })).toHaveAttribute('href', '/apply');
    await expect(page.getByRole('button', { name: 'Place order' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('/quote and the old #/quote link move to /checkout (AW-024)', async ({ page, context }) => {
    const errors = trackErrors(page);
    await context.addInitScript(([ageKey, age]) => {
      try { localStorage.setItem(ageKey, age); } catch { /* storage blocked */ }
    }, [AGE_KEY, ageRecord()]);
    // The preview server answers /quote as Netlify does: a permanent redirect.
    const response = await page.request.get('/quote', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe('/checkout');
    await page.goto('/quote');
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Your order is empty' })).toBeVisible();
    // The hash router's old link, redirected by the app.
    await page.goto('/#/quote');
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Your order is empty' })).toBeVisible();
    await expect(page).toHaveTitle(TITLE);
    expect(errors).toEqual([]);
  });
});

test.describe('an approved buyer', () => {
  test.beforeEach(async ({ context }) => {
    await seedAccount(context, { cart: { 14: 2 } });
  });

  test('places a will-call order: no address, licence answers or reference sent, the server’s reference shown, the orders inbox told (AW-049, AW-079, AW-024)', async ({ page }) => {
    const errors = trackErrors(page);
    const emails = orderEmails(page);
    const sent = await mockAccount(page, { onSubmit: () => ({ json: SAVED }) });
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
    // No licence questions for an approved account (AW-014).
    await expect(page.getByLabel('State tobacco/retail license #')).toHaveCount(0);
    await expect(page.getByLabel('Business name', { exact: true })).toHaveValue('Test Market LLC');
    await page.getByLabel('Delivery method').selectOption('willcall');
    await expect(page.getByLabel('Street', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Pickup at 613 Graymont Ave N, Birmingham, AL 35203 during business hours.')).toBeVisible();
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Thank you/ })).toBeVisible();
    await expect(page.getByText('ORDER RECEIVED')).toBeVisible();
    await expect(page.getByText('ALW-O-5E4F3A2B1C')).toBeVisible();
    await expect(page).toHaveTitle('Order received · Alabama Wholesale Inc');
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toHaveProperty('p_ref_num');
    expect(sent[0]).toMatchObject({
      p_delivery: 'willcall', p_ship_street: null, p_ship_city: null, p_ship_state: null, p_ship_zip: null,
      p_license_no: null, p_resale_cert: null, p_purchasers_21: false,
      p_items: [{ product_id: 14, variant: null, qty: 2 }],
    });
    // The order email: one post to the site's own origin, which the
    // Content-Security-Policy allows (a violation would be a console error).
    await expect.poll(() => emails.length).toBe(1);
    expect(emails[0]).toMatchObject({
      'form-name': 'order-notification', 'bot-field': '',
      subject: 'New order ALW-O-5E4F3A2B1C from Test Market LLC',
      reference: 'ALW-O-5E4F3A2B1C', business: 'Test Market LLC', contact: 'Test Buyer', email: 'buyer@example.test', phone: '205-555-0100',
      delivery: 'Will-call pickup', 'ship-to': 'Will-call pickup at 613 Graymont Ave N, Birmingham, AL 35203', 'preferred-date': 'Any day',
      items: '2 × Kite cigarette tobacco | SKU: AW-KITE', 'line-count': '1', 'total-units': '2',
      'admin-link': `${new URL(page.url()).origin}/admin/orders/${SAVED.id}/print`,
    });
    expect(errors).toEqual([]);
  });

  test('on the live database (no v3, no PR #12 function), the order goes out the 13-argument way', async ({ page }) => {
    const errors = trackErrors(page);
    const missing = { status: 404, json: { code: 'PGRST202', message: 'Could not find the function public.submit_quote(...) in the schema cache' } };
    const sent = await mockAccount(page, {
      onSubmit: (_body, n) => (n < 3 ? missing : { json: { id: 'smoke-order', ref_num: 'ALW-O-FROMCLIENT', total_units: 2, subtotal: 20.2 } }),
    });
    await page.goto('/checkout');
    await page.getByLabel('Delivery method').selectOption('willcall');
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Thank you/ })).toBeVisible();
    expect(sent).toHaveLength(3);
    // PR #12's 16-argument call, then the 13-argument one, with one client reference.
    expect(sent[1]).toMatchObject({ p_license_no: null, p_purchasers_21: false });
    expect(sent[2].p_ref_num).toMatch(/^ALW-O-[0-9A-F]{10}$/);
    expect(sent[2].p_ref_num).toBe(sent[1].p_ref_num);
    expect(sent[2]).not.toHaveProperty('p_license_no');
    expect(sent[2].p_notes).toBeNull();
    expect([sent[2].p_ship_street, sent[2].p_ship_city, sent[2].p_ship_state, sent[2].p_ship_zip]).toEqual(WAREHOUSE);
    // The receipt shows what the database saved.
    await expect(page.getByText('ALW-O-FROMCLIENT')).toBeVisible();
    await expect(page.getByText('ORDER RECEIVED')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a refusal says what to fix and cites no reference (AW-198)', async ({ page }) => {
    const errors = trackErrors(page);
    const emails = orderEmails(page);
    await mockAccount(page, { onSubmit: () => ({ status: 400, json: { code: 'P0001', message: 'Delivery routes cover AL, MS, GA — choose will-call', hint: 'delivery_state', details: null } }) });
    await page.goto('/checkout');
    // The State lists route states only (AW-078); the server's answer is mocked.
    for (const [label, value] of [['Street', '1 Test Way'], ['City', 'Nashville'], ['ZIP', '37201']]) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await page.getByLabel('State', { exact: true }).selectOption('AL');
    await page.getByRole('button', { name: 'Place order' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toHaveText('Delivery routes cover AL, MS and GA. For another state, choose will-call pickup.');
    await expect(page.getByLabel('State', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('main')).not.toContainText(/ALW-/);
    // Nothing was saved, so no email.
    expect(emails).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('the receipt replaces checkout: the cart empties, and a reload or Back keeps it (AW-012, AW-022)', async ({ page }) => {
    const errors = trackErrors(page);
    const sent = await mockAccount(page, { onSubmit: () => ({ json: { ...SAVED, ref_num: 'ALW-O-RECEIPT001' } }) });
    await page.goto('/checkout');
    await expect(page.locator('.aw-cart-count')).toHaveText('2');
    await fillAddress(page);
    await page.getByLabel('Notes (optional)', { exact: true }).fill('Back door, before 10');
    await page.getByRole('button', { name: 'Place order' }).click();

    const thanks = page.getByRole('heading', { level: 1, name: 'Thank you, Test Buyer.' });
    await expect(thanks).toBeVisible();
    await expect(thanks).toBeFocused();
    await expect(page.getByText('ORDER RECEIVED')).toBeVisible();
    await expect(page.locator('.receipt-ref-number')).toHaveText('ALW-O-RECEIPT001');
    await expect(page.locator('.receipt-items li')).toHaveText(['2 × Kite cigarette tobacco (AW-KITE)']);
    await expect(page.locator('.receipt-details')).toContainText('Next-day delivery (on route)');
    await expect(page.locator('.receipt-details')).toContainText('1 Test Way');
    await expect(page.locator('.receipt-details')).toContainText('Back door, before 10');
    // The sent lines left the cart.
    await expect(page.locator('.aw-cart-count')).toHaveCount(0);
    await expect(page).toHaveTitle('Order received · Alabama Wholesale Inc');
    // The receipt is kept for this tab only, never in localStorage.
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /receipt/.test(key)))).toEqual([]);

    await page.reload();
    await expect(thanks).toBeVisible();
    await expect(page.locator('.receipt-ref-number')).toHaveText('ALW-O-RECEIPT001');
    await expect(page).toHaveTitle('Order received · Alabama Wholesale Inc');
    await expect(page.getByRole('button', { name: 'Place order' })).toHaveCount(0);

    await page.getByRole('link', { name: 'Continue shopping' }).click();
    await expect(page).toHaveURL(/\/catalog$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(thanks).toBeVisible();
    await expect(page).toHaveTitle('Order received · Alabama Wholesale Inc');

    // A new visit to /checkout starts again: the cart is empty. (Opening the
    // same address again is a reload in Chromium, which keeps the receipt.)
    await page.goto('/catalog');
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { level: 1, name: 'Your order is empty' })).toBeVisible();
    await expect(page).toHaveTitle(TITLE);
    expect(sent).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('a double click, or two submits in one moment, sends one order (AW-012)', async ({ page }) => {
    const errors = trackErrors(page);
    const sent = await mockAccount(page, { onSubmit: (_body, n) => ({ json: { ...SAVED, ref_num: `ALW-O-RECEIPT00${n}` } }) });
    await page.goto('/checkout');
    await page.getByLabel('Delivery method').selectOption('willcall');
    await page.getByRole('button', { name: 'Place order' }).dblclick();
    await expect(page.getByRole('heading', { level: 1, name: /Thank you/ })).toBeVisible();
    await expect(page.locator('.receipt-details')).toContainText('Will-call pickup');
    await page.waitForTimeout(300);
    expect(sent).toHaveLength(1);

    // Two submits in the same task, before React re-renders the button.
    await page.evaluate(([key, cart]) => localStorage.setItem(key, cart), [cartKey(UID), cartValue({ 14: 2 })]);
    await page.goto('/catalog');
    await page.goto('/checkout');
    await page.getByLabel('Delivery method').selectOption('willcall');
    await page.evaluate(() => {
      const form = document.querySelector('form[aria-labelledby="quote-form-title"]');
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect(page.locator('.receipt-ref-number')).toHaveText('ALW-O-RECEIPT002');
    await page.waitForTimeout(300);
    expect(sent).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  test('a failed order email never holds up or fails the order (AW-024)', async ({ page }) => {
    // The post's own failure is logged by the browser; nothing else may be.
    const errors = trackErrors(page, { allow: /Failed to load resource: the server responded with a status of 500/ });
    const warnings = [];
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.route((url) => url.pathname === '/', (route) => (route.request().method() === 'POST'
      ? route.fulfill({ status: 500, body: 'Netlify is down' })
      : route.fallback()));
    await mockAccount(page, { onSubmit: () => ({ json: SAVED }) });
    await page.goto('/checkout');
    await page.getByLabel('Delivery method').selectOption('willcall');
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Thank you/ })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect.poll(() => warnings.join('\n')).toMatch(/The order email wasn’t sent \(status 500\)\. The order is saved/);
    // No personal data in the log.
    expect(warnings.join('\n')).not.toMatch(/Test Market|buyer@example|205-555/);
    expect(errors).toEqual([]);
  });

  test('the receipt says ORDER RECEIVED, centred, with a link to the order history (AW-022, AW-108)', async ({ page }) => {
    const errors = trackErrors(page);
    await mockAccount(page, { onSubmit: () => ({ json: { id: 'smoke-approved-order', ref_num: 'ALW-O-RECEIPT004', kind: 'order', total_units: 2, subtotal: 30.6, priced_lines: 1, unpriced_lines: 0 } }) });
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
    await fillAddress(page);
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByText('ORDER RECEIVED')).toBeVisible();
    await expect(page.locator('.receipt-ref-number')).toHaveText('ALW-O-RECEIPT004');
    await expect(page.getByText('Saved total: $30.60 · 2 units')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View order history' })).toHaveAttribute('href', '/account');
    await expect(page).toHaveTitle('Order received · Alabama Wholesale Inc');

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
});
