// Storefront smoke test: the built site boots, passes the age gate and renders
// the main pages without console or page errors. Every request that leaves
// the preview server is aborted, so nothing is ever written anywhere; the
// products request is answered with the seeded catalog (./catalog.js).
// Loading and failure states of the catalog are in catalog.spec.js.
//
// Pages live at path URLs (AW-043); old '#/' links redirect to them.
import { test, expect } from '@playwright/test';
import { serveCatalog } from './catalog.js';

const AGE_KEY = 'aw-age-verified'; // STORAGE.age in src/data/content.js
// The dated record src/lib/ageGate.js stores for "Yes, I am 21+" (AW-340).
const ageRecord = (at) => JSON.stringify({ ok: true, at });

const isLocal = (url) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url) || url.startsWith('data:') || url.startsWith('blob:');

// Collects page errors, console errors and failed local requests. The browser
// logs a console error for each remote request this spec aborts on purpose;
// those are expected and skipped.
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const source = m.location()?.url || '';
    if (source && !isLocal(source) && /Failed to load resource/.test(m.text())) return;
    errors.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => { if (isLocal(r.url()) && r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  return errors;
}

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) => (isLocal(route.request().url()) ? route.continue() : route.abort()));
  await serveCatalog(context);
});

// The age gate is a layer over the page, not a replacement for it (AW-044,
// AW-176, AW-156, AW-339, AW-340, AW-040), with the behaviour of Cursor's
// PR #12 where it differed from Phase 1.
test.describe('age gate', () => {
  test('a fresh browser gets the page beneath the gate, and "Yes" reveals it', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/category/tobacco');
    const gate = page.getByRole('dialog', { name: 'Are you 21 or older?' });
    await expect(gate).toBeVisible();
    // The real page is in the document for crawlers, inert until the answer.
    await expect(page.locator('main h1')).toHaveText('Tobacco');
    await expect(page.locator('main a[href^="/product/"]').first()).toBeAttached();
    await expect(page).toHaveTitle(/Tobacco/);
    await expect(page.locator('#root')).toHaveAttribute('inert', '');
    // Focus starts on "Yes", Tab stays inside, Escape and Back do not dismiss it.
    const yes = page.getByRole('button', { name: /Yes, I am 21\+/ });
    await expect(yes).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'No, exit' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(yes).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(gate).toBeVisible();
    // A white ring on the purple gate (AW-040).
    expect(await yes.evaluate((el) => getComputedStyle(el).outlineColor)).toBe('rgb(255, 255, 255)');

    await yes.click();
    await expect(gate).toBeHidden();
    await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
    await expect(page.getByRole('heading', { level: 1, name: 'Tobacco' })).toBeFocused();
    const stored = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), AGE_KEY));
    expect(stored).toEqual({ ok: true, at: expect.any(Number) });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Tobacco' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('"No, exit" shows an exit screen that lasts the session and can be taken back', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'No, exit' }).click();
    const exit = page.getByRole('dialog', { name: "We're sorry" });
    await expect(exit).toBeVisible();
    const back = page.getByRole('button', { name: 'Back to the age question' });
    await expect(back).toBeFocused();
    await page.reload();
    await expect(exit).toBeVisible();
    await expect(back).toBeFocused();
    await back.click();
    await expect(page.getByRole('dialog', { name: 'Are you 21 or older?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Yes, I am 21\+/ })).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('confirming in one tab opens the site in the other open tabs', async ({ context }) => {
    const first = await context.newPage();
    const second = await context.newPage();
    const errors = [...trackErrors(first), ...trackErrors(second)];
    await first.goto('/category/tobacco');
    await second.goto('/product/12');
    await expect(second.getByRole('dialog', { name: 'Are you 21 or older?' })).toBeVisible();
    await first.getByRole('button', { name: /Yes, I am 21\+/ }).click();
    await expect(second.getByRole('dialog')).toHaveCount(0);
    await expect(second.locator('#root')).not.toHaveAttribute('inert', '');
    expect(errors).toEqual([]);
  });

  test('an old undated confirmation counts as expired and is removed (PR #12)', async ({ page }) => {
    await page.goto('/contact');
    await page.evaluate((key) => localStorage.setItem(key, 'yes'), AGE_KEY);
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Are you 21 or older?' })).toBeVisible();
    // The loading shell was purple too: the boot script agrees.
    expect(await page.evaluate(() => document.documentElement.classList.contains('aw-gate'))).toBe(true);
    expect(await page.evaluate((key) => localStorage.getItem(key), AGE_KEY)).toBeNull();
  });

  test('an expired confirmation asks again', async ({ page }) => {
    await page.goto('/contact');
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [AGE_KEY, ageRecord(Date.now() - 31 * 24 * 60 * 60 * 1000)]);
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Are you 21 or older?' })).toBeVisible();
  });

  test('on a short landscape screen the whole gate can be scrolled into view', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 260 });
    await page.goto('/');
    await expect(page.locator('.age-gate .brand')).toBeInViewport({ ratio: 1 });
    for (const name of [/Yes, I am 21\+/, 'No, exit']) {
      const button = page.getByRole('button', { name });
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport({ ratio: 1 });
    }
    // The gate scrolled, not the page underneath.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe('after age confirmation', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(([key, value]) => {
      try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
    }, [AGE_KEY, ageRecord(Date.now())]);
  });

  const pages = [
    { name: 'department', path: '/category/tobacco', heading: 'Tobacco' },
    { name: 'product', path: '/product/12', heading: /\S/ },
    { name: 'empty checkout', path: '/quote', heading: 'Your cart is empty' },
    { name: 'all products', path: '/catalog', heading: 'All products' },
    { name: 'contact', path: '/contact', heading: /Contact/ },
    { name: 'privacy policy', path: '/privacy', heading: 'Privacy' },
  ];

  for (const { name, path, heading } of pages) {
    test(`${name} page renders at its path, also after a reload`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page).toHaveTitle(/Alabama Wholesale/);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(path);
      expect(errors).toEqual([]);
    });
  }

  test('old #/ links and other spellings land on the canonical path', async ({ page }) => {
    const errors = trackErrors(page);
    for (const [from, to] of [
      ['/#/category/TOBACCO', '/category/tobacco'],
      ['/#/product/12', '/product/12'],
      ['/#/category/DRINKS%20%26%20BAGS/Energy%20Drinks', '/category/drinks-and-bags/energy-drinks'],
      ['/category/TOBACCO', '/category/tobacco'],
      ['/product/012', '/product/12'],
    ]) {
      await page.goto(from);
      await expect(page).toHaveURL((url) => url.pathname === to && url.hash === '');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('unknown and malformed addresses show a helpful not-found page', async ({ page }) => {
    const errors = trackErrors(page);
    for (const [path, heading] of [
      ['/no-such-page', 'Page not found'],
      ['/product/99999', 'Product not found'],
      ['/category/nope', 'Department not found'],
      ['/category/tobacco/no-such-line', 'Product line not found'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      await expect(page.getByRole('searchbox', { name: 'Product, brand or SKU' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Browse by department' }).getByRole('link', { name: /^Tobacco \(/ })).toBeVisible();
    }
    // A link cut off mid-escape (AW-185), followed inside the app.
    await page.evaluate(() => {
      window.history.pushState(null, '', '/category/DRINKS%20%26%20BAGS/Bags%20%2');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('links open pages in the app: focus on the h1, announced, top of the page', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/category/tobacco');
    await page.evaluate(() => { window.__sameDocument = true; });
    const card = page.locator('main a.card-link').nth(6);
    await card.scrollIntoViewIfNeeded();
    const href = await card.getAttribute('href');
    expect(href).toMatch(/^\/product\/\d+$/);
    await card.click();
    await expect(page).toHaveURL((url) => url.pathname === href);
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeFocused();
    expect(await page.evaluate(() => window.__sameDocument)).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('#aw-announcer')).toHaveText(await page.title());
    expect(errors).toEqual([]);
  });

  test('Back and Forward restore the department filters and scroll position', async ({ page }, testInfo) => {
    const errors = trackErrors(page);
    const phone = testInfo.project.name === 'phone';
    await page.goto('/category/candies');
    // Phones set filters in the Filter & Sort drawer.
    if (phone) await page.getByRole('button', { name: /Filter & Sort/ }).click();
    await page.getByRole('checkbox', { name: 'Bestsellers' }).check();
    await page.getByLabel('Sort by').selectOption('name-desc');
    if (phone) await page.getByRole('dialog').getByRole('button', { name: /^Show \d+ items?/ }).click();
    await expect(page).toHaveURL(/\/category\/candies\?sort=name-desc&tags=bestseller$/);
    const note = await page.locator('.result-note').textContent();
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForFunction(() => window.scrollY === 500);
    await page.locator('main a.card-link').first().click();
    await expect(page).toHaveURL(/\/product\/\d+$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/category\/candies\?sort=name-desc&tags=bestseller$/);
    await expect(page.locator('.result-note')).toHaveText(note);
    await expect(page.getByRole('button', { name: 'Remove filter Bestsellers' })).toBeVisible();
    await page.waitForFunction(() => window.scrollY === 500);
    await page.goForward();
    await expect(page).toHaveURL(/\/product\/\d+$/);
    expect(errors).toEqual([]);
  });

  test('Back closes an open dialog instead of leaving the page', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/category/novelties');
    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page).toHaveURL(/\/category\/novelties$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Novelties & Vapes' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  // Google Translate (AW-039, AW-164): replaces every text node with <font>
  // and translates new text as it appears. The DOM guard in src/lib/domGuard.js
  // is switched off here so the markup itself is what gets tested.
  test.describe('with the page translated', () => {
    test.beforeEach(async ({ context }) => {
      await context.addInitScript(() => {
        const { removeChild, insertBefore } = Node.prototype;
        Object.defineProperty(Node.prototype, 'removeChild', { configurable: true, get: () => removeChild, set() {} });
        Object.defineProperty(Node.prototype, 'insertBefore', { configurable: true, get: () => insertBefore, set() {} });
      });
    });

    const translate = (page) => page.evaluate(() => {
      const wrap = (root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) {
          const t = walker.currentNode;
          const parent = t.parentElement;
          if (t.nodeValue.trim() && parent && !['SCRIPT', 'STYLE', 'OPTION'].includes(parent.tagName) && !parent.closest('font')) nodes.push(t);
        }
        for (const t of nodes) {
          const font = document.createElement('font');
          font.appendChild(document.createElement('font')).textContent = t.nodeValue;
          t.replaceWith(font);
        }
      };
      wrap(document.body);
      new MutationObserver((records) => {
        for (const r of records) for (const n of r.addedNodes) {
          if (n.nodeType === Node.TEXT_NODE && n.parentElement) wrap(n.parentElement);
          else if (n.nodeType === Node.ELEMENT_NODE && n.tagName !== 'FONT') wrap(n);
        }
      }).observe(document.body, { childList: true, subtree: true });
    });

    test('department filters keep working and counts stay current', async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto('/category/tobacco');
      await expect(page.getByRole('heading', { level: 1, name: 'Tobacco' })).toBeVisible();
      await translate(page);
      await page.getByRole('link', { name: /^Cigarettes \(/ }).click();
      await page.getByRole('link', { name: /^Cigars & Cigarillos \(/ }).click();
      await expect(page.locator('.result-note')).toHaveText(/Showing (\d+) of \1 items in Cigars & Cigarillos/);
      await page.getByRole('link', { name: /^All \(/ }).click();
      await expect(page.locator('.result-note')).toHaveText(/Showing 68 of 68 items$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Tobacco' })).toBeVisible();
      expect(errors).toEqual([]);
    });

    test('policy pages switch without crashing', async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto('/privacy');
      await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
      await translate(page);
      const nav = page.getByRole('navigation', { name: 'Customer policies' }).first();
      await nav.getByRole('link', { name: 'Delivery', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Delivery' })).toBeVisible();
      await nav.getByRole('link', { name: 'Privacy', exact: true }).click();
      await expect(page.locator('.support-note').last()).toHaveText(/Last updated .+\. Questions about this policy\?/);
      expect(errors).toEqual([]);
    });
  });

  test('header search lists matching products as links', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    const title = await page.title();
    await page.getByRole('searchbox', { name: 'Search products' }).fill('wraps');
    await expect(page.getByRole('status').filter({ hasText: /result/ })).toBeVisible();
    await expect(page.locator('.aw-search-list a[href^="/product/"]').first()).toBeVisible();
    // The dropdown is not a page: the tab title stays (AW-338).
    await expect(page).toHaveTitle(title);
    expect(errors).toEqual([]);
  });

  test('variants are named by what they differ in, and a single one is no choice (AW-128, AW-233, AW-031)', async ({ page }) => {
    const errors = trackErrors(page);
    // Swisher Sweets Leaf: flavors, with the flavor note.
    await page.goto('/product/8');
    await expect(page.getByRole('group', { name: 'Choose a flavor' })).toBeVisible();
    await expect(page.getByText('Flavors and availability change often.', { exact: false })).toBeVisible();
    // Gas cans: sizes, no flavor note.
    await page.goto('/product/356');
    await expect(page.getByRole('group', { name: 'Choose a size' })).toBeVisible();
    await expect(page.getByText('Pick a size to add it. Add each size you want separately.')).toBeVisible();
    await expect(page.getByText('Flavors and availability change often.', { exact: false })).toHaveCount(0);
    // RAW tips: no variants (its lone "Tips" was no choice, AW-138), no chips.
    await page.goto('/product/329');
    await expect(page.locator('main h1')).toHaveText('RAW tips');
    await expect(page.locator('.variant-chips')).toHaveCount(0);
    // Gambler tubes: the sell unit, on the page and its card.
    await page.goto('/product/242');
    await expect(page.locator('.pd-unit')).toHaveText('Sold by the box of 200 — quantity 1 is one box of 200.');
    await page.goto('/category/tobacco/tubes-and-filters');
    await expect(page.locator('.card-detail').filter({ hasText: 'AW-GAMBLER-TUBES' }))
      .toHaveText('Gambler · 6 varieties · Sold by the box of 200 · AW-GAMBLER-TUBES');
    expect(errors).toEqual([]);
  });
});

// Generated at build time from the catalog (AW-317).
test('sitemap.xml lists path URLs only', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  expect(xml).toContain('<loc>https://alabamawholesaleinc.com/product/12</loc>');
  expect(xml).toContain('<loc>https://alabamawholesaleinc.com/category/tobacco</loc>');
  expect(xml).not.toContain('#');
  expect(xml).not.toContain('/quote');
});

// Static boot shell in index.html (AW-193): something useful shows before the
// bundle runs, when it fails, and without JavaScript.
test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the noscript message with the trade desk contacts', async ({ page }) => {
    await page.goto('/');
    // Playwright's text engine skips <noscript>, so these use CSS locators.
    const message = page.locator('noscript .boot');
    await expect(message).toBeVisible();
    await expect(message).toContainText('This catalog needs JavaScript');
    // What the business is, for visitors and crawlers without JavaScript (AW-044).
    await expect(message).toContainText('for licensed retailers');
    await expect(message.locator('a[href^="tel:"]')).toBeVisible();
    await expect(message.locator('a[href^="mailto:"]')).toBeVisible();
    await expect(page.locator('#root .boot')).toBeHidden();
  });
});

test('if the app bundle fails to load, the loading shell stays and then offers the phone line', async ({ page }) => {
  await page.clock.install();
  await page.route(/\/assets\/index-[^/]*\.js$/, (route) => route.abort());
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Loading the wholesale catalog' })).toBeVisible();
  await expect(page.getByText('Trouble loading?')).toBeHidden();
  await page.clock.runFor(8000);
  await expect(page.getByText('Trouble loading?')).toBeVisible();
  await expect(page.locator('#root a[href^="tel:"]')).toBeVisible();
});

test('the app replaces the loading shell once it renders', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: /21 or older/i })).toBeVisible();
  await expect(page.locator('#root .boot')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// Cursor's PR #12 in the Phase 1 structure: the FDA nicotine statement
// (AW-026, AW-144) and the licence questions on a guest tobacco quote (AW-014).
test.describe('tobacco and vapor', () => {
  const FDA = 'WARNING: This product contains nicotine. Nicotine is an addictive chemical. Not for sale to anyone under 21.';

  test.beforeEach(async ({ context }) => {
    await context.addInitScript(([key, value]) => {
      try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
    }, [AGE_KEY, ageRecord(Date.now())]);
  });

  test('the nicotine statement is on vape pages, tobacco cards and the footer, not on hemp wraps', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/product/61');
    await expect(page.locator('.pd-info .nicotine-warning')).toHaveText(FDA);
    // The footer band is the last thing on the page, flush with its bottom.
    const band = page.locator('footer .fda-note');
    await expect(band).toHaveText(FDA);
    const gap = await band.evaluate((el) => document.documentElement.scrollHeight - (el.getBoundingClientRect().bottom + window.scrollY));
    expect(Math.abs(gap)).toBeLessThan(1);
    await page.goto('/product/330');
    await expect(page.locator('.pd-info .nicotine-warning')).toHaveCount(0);
    await page.goto('/category/tobacco/cigars-and-cigarillos');
    const cards = page.locator('.content-card');
    await expect(cards.first().locator('.nicotine-warning')).toHaveText(FDA);
    expect(await cards.count()).toBe(await page.locator('.content-card .nicotine-warning').count());
    expect(errors).toEqual([]);
  });

  test('a guest quote with a cigarette line asks for the licence, resale certificate and 21+', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/product/14');
    await page.getByRole('button', { name: /^Add to (quote|order)/ }).click();
    await page.goto('/quote');
    await expect(page.getByLabel('State tobacco/retail license #')).toHaveAttribute('required', '');
    await expect(page.getByLabel('Sales-tax / resale certificate #')).toHaveAttribute('required', '');
    await expect(page.getByRole('checkbox', { name: /all purchasers are 21\+/ })).toHaveAttribute('required', '');
    await expect(page.getByRole('button', { name: 'Have an account? Sign in' })).toBeVisible();
    await page.getByRole('button', { name: 'New? Apply for a trade account' }).click();
    await expect(page.getByRole('dialog', { name: /Apply for an account/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
