// The checkout form's checks and its draft (AW-078, AW-080): the State
// lists the route states, the phone needs 10 digits, and what a buyer typed
// comes back after following a line's product link and Back, after the
// breadcrumb and Back, and after a reload; signing out discards it, and the
// next person, a guest, gets no form at all (only approved accounts order,
// AW-014). Products come from the seeded catalog (./catalog.js); the
// approved buyer's Supabase is mocked (./account.js), and every other
// request that leaves the preview server is aborted. Nothing is submitted.
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';
import { GUEST_CART, cartValue } from './cartStore.js';
import { PROFILE, UID, mockAccount, seedAccount } from './account.js';

const DRAFT_KEY = 'aw-quote-draft'; // STORAGE.quoteDraft in src/data/content.js
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

// The buyer's profile has a store in a route state, so the State starts
// from it; an empty-handed one (BLANK) starts every field empty.
const STORE = { ...PROFILE, state: 'AL' };
const BLANK = { ...PROFILE, business: '', name: '', email: '', phone: '' };

const TYPED = [['Business name', 'Draft Market LLC'], ['Contact name', 'Dee Draft'], ['Email', 'dee@example.test'], ['Phone', '(205) 555-0123'],
  ['Street', '7 Draft Rd'], ['City', 'Tupelo'], ['ZIP', '38801']];

async function expectTyped(page, notes = 'Dock B\nBefore 10 AM') {
  for (const [label, value] of TYPED) await expect(field(page, label), label).toHaveValue(value);
  await expect(field(page, 'State')).toHaveValue('MS');
  await expect(field(page, 'Notes (optional)')).toHaveValue(notes);
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
});

test.describe('an approved buyer', () => {
  test.beforeEach(async ({ context, page }) => {
    await seedAccount(context, { profile: BLANK, cart: { 14: 2, 45: 3 } });
    await mockAccount(page, { profile: BLANK });
  });

  test('the State lists the route states and the phone needs 10 digits (AW-078)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/checkout');
    const state = field(page, 'State');
    await expect(state.locator('option')).toHaveText(['Choose a state…', 'Alabama', 'Georgia', 'Mississippi']);
    await expect(state).toHaveAccessibleDescription('Delivery routes cover AL, MS and GA. For another state, choose will-call pickup.');
    await expect(field(page, 'Notes (optional)')).toHaveJSProperty('tagName', 'TEXTAREA');
    const phone = field(page, 'Phone');
    await expect(phone).toHaveAccessibleDescription('10 digits, for example (205) 555-0123.');
    // The browser refuses letters (the pattern compiles with the v flag).
    await phone.fill('hello');
    expect(await phone.evaluate((el) => el.validity.patternMismatch)).toBe(true);
    await phone.fill('(205) 555-0123');
    expect(await phone.evaluate((el) => el.validity.valid)).toBe(true);
    // Eleven digits pass the pattern; the page stops them before anything is sent.
    for (const [label, value] of [['Business name', 'Test Market LLC'], ['Contact name', 'Test Buyer'], ['Email', 'buyer@example.test'], ['Phone', '205-555-01234'],
      ['Street', '1 Test Way'], ['City', 'Birmingham'], ['ZIP', '35203']]) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await state.selectOption('AL');
    const sent = [];
    await page.route(/\/rest\/v1\/rpc\/submit_quote/, (route) => { sent.push(1); return route.abort(); });
    await page.getByRole('button', { name: 'Place order' }).click();
    // Under the field (AW-173), before anything is sent.
    await expect(page.locator('#quote-phone-error')).toHaveText('Enter a 10-digit phone number.');
    await expect(phone).toHaveAttribute('aria-invalid', 'true');
    await expect(phone).toBeFocused();
    expect(sent).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('what was typed comes back after a line’s link and Back, the breadcrumb and Back, and a reload (AW-080)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
    for (const [label, value] of TYPED) await field(page, label).fill(value);
    await field(page, 'State').selectOption('MS');
    await field(page, 'Notes (optional)').fill('Dock B\nBefore 10 AM');

    // A line's name links to its product (AW-239), then Back.
    await page.locator('.checkout-lines a.line-name', { hasText: 'Argo corn starch' }).click();
    await expect(page).toHaveURL(/\/product\/45$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/checkout$/);
    await expectTyped(page);

    // The breadcrumb, then Back.
    await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expectTyped(page);

    // A reload straight after an edit.
    await field(page, 'Notes (optional)').fill('Dock C\nAfter 2 PM');
    await page.reload();
    await expectTyped(page, 'Dock C\nAfter 2 PM');

    // Kept for this tab and account only, never in localStorage.
    const stored = await draft(page);
    expect(stored.owner).toBe(UID);
    expect(JSON.stringify(stored)).not.toMatch(/licenseNo|resaleCert|purchasers21/);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => /draft/.test(key)))).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test('an approved buyer’s draft wins over the profile, survives a reload, and is gone after Sign out (AW-080)', async ({ page, context }) => {
  const errors = trackErrors(page);
  await seedAccount(context, { profile: STORE, cart: { 45: 3 } });
  await mockAccount(page, { profile: STORE });
  // Registered last, so it answers before the account's routes.
  await page.route(/\/auth\/v1\/logout/, (route) => route.fulfill({ status: 204, body: '' }));

  await page.goto('/checkout');
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
  // The profile fills the form; the State from the store's route state.
  await expect(field(page, 'Business name')).toHaveValue('Test Market LLC');
  await expect(field(page, 'State')).toHaveValue('AL');
  await field(page, 'Contact name').fill('Dock Manager');
  await field(page, 'Street').fill('9 Loading Dock Rd');
  await field(page, 'Notes (optional)').fill('Ring the bell');
  await page.reload();
  await expect(field(page, 'Contact name')).toHaveValue('Dock Manager');
  await expect(field(page, 'Street')).toHaveValue('9 Loading Dock Rd');
  await expect(field(page, 'Notes (optional)')).toHaveValue('Ring the bell');
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
  // The next person on this computer, a guest with a line in the cart, gets
  // no form: Sign in and Apply instead (AW-014), and nothing of the buyer's.
  await page.getByRole('button', { name: /Yes, I am 21\+/ }).click();
  await page.evaluate(([key, cart]) => localStorage.setItem(key, cart), [GUEST_CART, cartValue({ 45: 1 })]);
  await page.goto('/checkout');
  await expect(page.getByRole('region', { name: 'Sign in to place your order' })).toBeVisible();
  await expect(form(page)).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/Dock Manager|Loading Dock|Ring the bell/);
  expect(errors).toEqual([]);
});
