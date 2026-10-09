// Forms that check themselves before sending (AW-173): on /quote an empty
// submit names each missing answer under its field, marks it invalid and
// focuses Business, and no request leaves the page; a complete form still
// reaches submit_quote. The application dialog explains a mistyped EIN
// under the field instead of the browser's bubble. Kept apart from
// quote.spec.js, which other changes edit. Products come from the seeded
// catalog (./catalog.js); every other request that leaves the preview
// server is aborted or answered here.
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';
import { GUEST_CART, cartValue } from './cartStore.js';

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

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
  // Product 14 is a tobacco line, so a guest also gives the license answers.
  await context.addInitScript(([ageKey, age, cartKey, cart]) => {
    try {
      localStorage.setItem(ageKey, age);
      localStorage.setItem(cartKey, cart);
    } catch { /* storage blocked */ }
  }, [AGE_KEY, ageRecord(Date.now()), GUEST_CART, cartValue({ 14: 2 })]);
});

test('an empty quote names each missing answer under its field, focuses Business, and sends nothing (AW-173)', async ({ page }) => {
  const errors = trackErrors(page);
  const sent = [];
  await page.route(/\/rest\/v1\/rpc\/submit_quote/, (route) => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ json: { id: 'smoke-order', ref_num: 'ALW-Q-FORMS00001', kind: 'quote', total_units: 2, subtotal: null, priced_lines: 0, unpriced_lines: 1 } });
  });
  await page.goto('/quote');
  await expect(page.getByRole('heading', { level: 1, name: 'Request a quote' })).toBeVisible();
  await expect(page.getByText('All fields are required unless marked optional.')).toBeVisible();
  await expect(page.getByLabel('Preferred date (optional)')).toHaveValue('');

  await page.getByRole('button', { name: /Submit quote request/ }).click();
  const business = page.getByLabel('Business name', { exact: true });
  await expect(business).toBeFocused();
  await expect(business).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#quote-business-error')).toHaveText('Enter business name.');
  await expect(page.locator('#quote-business-error')).toBeVisible();
  await expect(business).toHaveAccessibleDescription('Enter business name.');
  for (const [label, message] of [['Email', 'Enter email.'], ['ZIP', 'Enter ZIP.'], ['State tobacco/retail license #', 'Enter the state tobacco license number.']]) {
    const field = page.getByLabel(label, { exact: true });
    await expect(field, label).toHaveAttribute('aria-invalid', 'true');
    await expect(field, label).toHaveAccessibleDescription(new RegExp(message.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&')));
  }
  await expect(page.getByRole('checkbox', { name: /all purchasers are 21\+/ })).toHaveAttribute('aria-invalid', 'true');
  // No browser bubble: the form doesn't use native validation.
  expect(await page.locator('form[aria-labelledby="quote-form-title"]').evaluate((form) => form.noValidate)).toBe(true);
  // Typing clears that field's message.
  await business.fill('Test Market LLC');
  await expect(page.locator('#quote-business-error')).toHaveText('');
  await expect(business).not.toHaveAttribute('aria-invalid', 'true');

  // The rest, then the quote goes out as before.
  for (const [label, value] of [['Contact name', 'Test Buyer'], ['Email', 'buyer@example.test'], ['Phone', '205-555-0100'],
    ['Street', '1 Test Way'], ['City', 'Birmingham'], ['ZIP', '35203'],
    ['State tobacco/retail license #', 'TL-SMOKE-1'], ['Sales-tax / resale certificate #', 'RS-SMOKE-1']]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  // The State lists the route states (AW-078).
  await page.getByLabel('State', { exact: true }).selectOption('AL');
  await page.getByRole('checkbox', { name: /all purchasers are 21\+/ }).check();
  expect(sent).toHaveLength(0);
  await page.getByRole('button', { name: /Submit quote request/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Thank you/ })).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ p_business: 'Test Market LLC', p_ship_zip: '35203', p_preferred_date: null });
  expect(errors).toEqual([]);
});

test('the application dialog explains a mistyped EIN under the field (AW-173)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/quote');
  await page.getByRole('button', { name: 'New here? Apply for a trade account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Apply for a trade account' });
  // The checklist first, then the form.
  await dialog.getByRole('button', { name: 'Continue to the application' }).click();
  await expect(dialog.getByText('All fields are required unless marked optional.')).toBeVisible();
  const ein = dialog.getByLabel('Federal EIN');
  await ein.fill('abc');
  await dialog.getByRole('button', { name: 'Submit application' }).click();
  // The first problem is the empty name; the EIN says what it expects.
  await expect(dialog.getByLabel('Your name')).toBeFocused();
  await expect(ein).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.locator('#aw-su-ein-error')).toHaveText('Enter the 9-digit EIN, for example 12-3456789.');
  await expect(dialog.locator('#aw-su-ein-error')).toBeVisible();
  await expect(ein).toHaveAccessibleDescription('9 digits, for example 12-3456789. Enter the 9-digit EIN, for example 12-3456789.');
  await ein.fill('12-3456789');
  await expect(dialog.locator('#aw-su-ein-error')).toHaveText('');
  expect(errors).toEqual([]);
});
