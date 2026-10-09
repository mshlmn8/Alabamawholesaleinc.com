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
    // Followed from where the card is in full view, below the sticky header (AW-153).
    const card = page.locator('main a.card-link').first();
    await card.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThan(0);
    await card.click();
    await expect(page).toHaveURL(/\/product\/\d+$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/category\/candies\?sort=name-desc&tags=bestseller$/);
    await expect(page.locator('.result-note')).toHaveText(note);
    await expect(page.getByRole('button', { name: 'Remove filter Bestsellers' })).toBeVisible();
    await page.waitForFunction((at) => window.scrollY === at, y);
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
      await nav.getByRole('link', { name: 'Delivery policy', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Delivery' })).toBeVisible();
      await nav.getByRole('link', { name: 'Privacy', exact: true }).click();
      await expect(page.locator('.support-note').last()).toHaveText(/Last updated .+\. Questions about this policy\?/);
      expect(errors).toEqual([]);
    });
  });

  test('header search lists matching products as options that are links (AW-171)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    const title = await page.title();
    const box = page.getByRole('combobox', { name: 'Search products' });
    await box.fill('wraps');
    await expect(box).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.aw-search-heading p')).toHaveText(/result/);
    // The count is announced by the one status element, once typing pauses.
    await expect(page.locator('.aw-search [role="status"]')).toHaveText(/result/);
    const option = page.getByRole('listbox', { name: 'Products' }).getByRole('option').first();
    await expect(option).toBeVisible();
    await expect(option).toHaveAttribute('href', /^\/product\/\d+$/);
    // The dropdown is not a page: the tab title stays (AW-338).
    await expect(page).toHaveTitle(title);
    expect(errors).toEqual([]);
  });

  test('ArrowDown and Enter in the header search open the highlighted product (AW-171)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    const box = page.getByRole('combobox', { name: 'Search products' });
    await box.fill('geek bar');
    await expect(page.getByRole('listbox', { name: 'Products' })).toBeVisible();
    await box.press('ArrowDown');
    const first = page.getByRole('option').first();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(box).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id')) ?? 'missing');
    await expect(box).toBeFocused();
    await box.press('Enter');
    await expect(page).toHaveURL(/\/product\/\d+$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Geek Bar/);
    await expect(box).toHaveValue('');
    await expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(errors).toEqual([]);
  });

  test('Tab past the header search closes its list, so it hides no focused control (AW-165)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'phone', 'the navigation row is desktop only');
    const errors = trackErrors(page);
    await page.goto('/');
    const box = page.getByRole('combobox', { name: 'Search products' });
    await box.fill('bic');
    const list = page.getByRole('listbox', { name: 'Products' });
    await expect(list).toBeVisible();
    // The options are not Tab stops: Tab goes to the Search button, then on.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeFocused();
    await expect(list).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(list).toHaveCount(0);
    const newArrivals = page.getByRole('link', { name: 'New Arrivals', exact: true });
    for (let i = 0; i < 8 && !(await newArrivals.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(newArrivals).toBeFocused();
    const uncovered = await newArrivals.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [[0.5, 0.5], [0.1, 0.2], [0.9, 0.8]].every(([x, y]) => el.contains(document.elementFromPoint(r.left + r.width * x, r.top + r.height * y)));
    });
    expect(uncovered).toBe(true);
    expect(errors).toEqual([]);
  });

  test('Tab out of the Categories menu closes it (AW-165)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'phone', 'the Categories menu is desktop only');
    const errors = trackErrors(page);
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Categories', exact: true });
    await expect(toggle).not.toHaveAttribute('aria-controls');
    await toggle.click();
    const menu = page.locator('#aw-mega-menu');
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-controls', 'aw-mega-menu');
    // Departments are groups, not eight more navigation landmarks.
    await expect(menu.getByRole('group', { name: 'Tobacco' })).toBeVisible();
    await expect(menu.getByRole('navigation')).toHaveCount(0);
    await page.keyboard.press('Tab');
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: 'View full catalog' }).focus();
    await page.keyboard.press('Tab');
    await expect(menu).toHaveCount(0);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('link', { name: 'New Arrivals', exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  });

  test.describe('on a phone in landscape', () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

    test('the header search list ends on screen once focus has moved the bar to the top (AW-307)', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name === 'phone', 'the same landscape screen in both projects');
      const errors = trackErrors(page);
      await page.goto('/');
      const box = page.getByRole('combobox', { name: 'Search products' });
      await box.tap();
      await expect.poll(() => box.evaluate((el) => Math.round(el.closest('form').getBoundingClientRect().top))).toBeLessThanOrEqual(40);
      await box.fill('gum');
      const panel = page.locator('.aw-search-results');
      await expect(panel).toBeVisible();
      const { bottom, height } = await panel.evaluate((el) => ({ bottom: el.getBoundingClientRect().bottom, height: window.innerHeight }));
      expect(bottom).toBeLessThanOrEqual(height);
      expect(errors).toEqual([]);
    });
  });

  test('/search?q= lists every match as product cards, noindex, also after a reload (AW-007)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/search?q=cigar');
    for (let pass = 0; pass < 2; pass++) {
      await expect(page.getByRole('heading', { level: 1, name: 'Results for “cigar”' })).toBeVisible();
      expect(await page.locator('main .card-grid .content-card').count()).toBeGreaterThanOrEqual(30);
      await expect(page).toHaveTitle(/Results for/);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      if (!pass) await page.reload();
    }
    expect(errors).toEqual([]);
  });

  test('Enter in the header search opens the results page and keeps the text (AW-007)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    // exact: the results page has its own 'Search products, brands or SKUs' box.
    const box = page.getByRole('combobox', { name: 'Search products', exact: true });
    await box.fill('cigar');
    await box.press('Enter');
    await expect(page).toHaveURL((url) => url.pathname === '/search' && url.searchParams.get('q') === 'cigar');
    await expect(page.getByRole('heading', { level: 1, name: 'Results for “cigar”' })).toBeFocused();
    await expect(box).toHaveValue('cigar');
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

  test('the vape hero slide shows the statement under the photo, uncovered, and keeps its space on the others', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    const carousel = page.locator('.home-carousel');
    const warning = carousel.locator('.nicotine-warning');
    await expect(warning).toBeHidden();
    const spaceBefore = await page.locator('.home-carousel-warning').boundingBox();
    await carousel.getByRole('button', { name: 'Next slide' }).click();
    await expect(warning).toBeVisible();
    await expect(warning).toHaveText(FDA);
    // Every photo stays inside the stage; one that grew past it covered the
    // controls and this statement on phones and tablets (AW-036).
    const overflow = await carousel.locator('.home-carousel-stage').evaluate((stage) => {
      const s = stage.getBoundingClientRect();
      return [...stage.querySelectorAll('.home-carousel-slide img')].map((img) => {
        const r = img.getBoundingClientRect();
        return Math.max(s.top - r.top, r.bottom - s.bottom, s.left - r.left, r.right - s.right);
      });
    });
    expect(overflow.length).toBeGreaterThan(0);
    expect(Math.max(...overflow)).toBeLessThanOrEqual(0.5);
    await warning.scrollIntoViewIfNeeded();
    const covered = await warning.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !el.contains(hit);
    });
    expect(covered).toBe(false);
    // The statement takes the same space whichever slide shows, so nothing moves.
    const spaceAfter = await page.locator('.home-carousel-warning').boundingBox();
    expect(Math.round(spaceAfter.height)).toBe(Math.round(spaceBefore.height));
    await carousel.getByRole('button', { name: 'Next slide' }).click();
    await expect(warning).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('a guest quote with a cigarette line asks for the licence, resale certificate and 21+', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/product/14');
    await page.locator('.pd-info').getByRole('button', { name: /^Add to (quote|order)/ }).click();
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

// The home page opens with its h1, the pitch and both calls to action on the
// first screen (AW-004), on desktop and on a phone.
test.describe('home hero', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(([key, value]) => {
      try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
    }, [AGE_KEY, ageRecord(Date.now())]);
  });

  test('shows the page\'s only h1 and both calls to action without scrolling', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    const hero = page.locator('.home-hero');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(hero.getByRole('heading', { level: 1, name: 'Wholesale for licensed retailers.' })).toBeInViewport({ ratio: 1 });
    await expect(hero.getByRole('button', { name: 'Apply for a trade account' })).toBeInViewport({ ratio: 1 });
    await expect(hero.getByRole('link', { name: 'Browse the catalog' })).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.home-carousel-slide.is-active')).toHaveAttribute('aria-label', '1 of 4: Candies');
    await hero.getByRole('button', { name: 'Apply for a trade account' }).click();
    await expect(page.getByRole('dialog', { name: /Apply for an account/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

// Under the hero: the services with their links (AW-059), the department
// tiles with a photo in the frame and the text on the band below it (AW-060,
// AW-061), and one row each of new arrivals and bestsellers without SKUs.
test.describe('home sections', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(([key, value]) => {
      try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
    }, [AGE_KEY, ageRecord(Date.now())]);
  });

  test('services follow the hero, and the department tiles lead to their departments', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await expect(page.locator('.home-hero + .services .service')).toHaveCount(3);
    const services = page.locator('.services');
    await expect(services.getByRole('link', { name: 'Delivery and service area' })).toHaveAttribute('href', '/delivery');
    await expect(services.getByRole('link', { name: 'Trade terms' })).toHaveAttribute('href', '/terms');
    await expect(services.getByRole('link', { name: 'How to apply' })).toHaveAttribute('href', '/apply');
    for (const id of ['new-arrivals', 'bestsellers']) {
      await expect(page.locator(`#${id} .content-card`)).toHaveCount(4);
      for (const detail of await page.locator(`#${id} .card-detail`).allTextContents()) expect(detail).not.toMatch(/\bAW-/);
    }
    const tiles = page.locator('#catalog .dept-tile');
    await expect(tiles).toHaveCount(8);
    await tiles.last().scrollIntoViewIfNeeded();
    // The photos load lazily: wait for all eight.
    const frames = () => tiles.evaluateAll((all) => all.map((tile) => {
      const media = tile.querySelector('.dept-tile-media').getBoundingClientRect();
      const body = tile.querySelector('.dept-tile-body').getBoundingClientRect();
      const img = tile.querySelector('.dept-tile-media img');
      const r = img.getBoundingClientRect();
      return {
        loaded: img.complete && img.naturalWidth > 0,
        inside: r.left >= media.left - 0.5 && r.right <= media.right + 0.5 && r.top >= media.top - 0.5 && r.bottom <= media.bottom + 0.5,
        bandBelow: body.top >= media.bottom - 0.5,
      };
    }));
    await expect.poll(frames).toEqual(Array(8).fill({ loaded: true, inside: true, bandBelow: true }));
    await tiles.filter({ hasText: 'Candies' }).click();
    await expect(page).toHaveURL(/\/category\/candies$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Candies' })).toBeVisible();
    // Department pages keep the SKU on the card.
    await expect(page.locator('.card-detail').first()).toContainText('AW-');
    expect(errors).toEqual([]);
  });
});

// Cursor's PR #13 in the current structure: card buttons and "Added"
// (AW-057), "Photo coming soon" (AW-029), featured filters (AW-139), the
// Wikimedia credit (AW-033), and photos drawn no larger than their pixels
// (AW-073).
test.describe('part 2 catalog', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(([key, value]) => {
      try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
    }, [AGE_KEY, ageRecord(Date.now())]);
  });

  test('cards say "Select options" or "Add to quote", and "Added" after an add', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/category/tobacco/cigarettes');
    const kite = page.locator('.content-card', { hasText: 'Kite cigarette tobacco' });
    await kite.getByRole('button', { name: /^Add to quote\b/ }).click();
    await expect(kite.locator('.added-note')).toHaveText('Added');
    await expect(kite.getByRole('group', { name: 'Kite cigarette tobacco quantity' })).toBeVisible();
    await expect(page.locator('#aw-announcer')).toHaveText('Added Kite cigarette tobacco to your quote.');
    await expect(kite.locator('.added-note')).toHaveText('', { timeout: 4000 });
    await page.goto('/category/tobacco/cigars-and-cigarillos');
    await expect(page.locator('.content-card', { hasText: 'Royal Blunts EZ Roll' }).getByRole('link', { name: /^Select options\b/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a product without a photo says so, and only tags with products are offered', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/product/9');
    await expect(page.locator('.pd-media .photo-soon-label')).toHaveText('Photo coming soon');
    // On phones the filters are in the Filter & Sort drawer.
    const openFilters = async () => {
      const toggle = page.getByRole('button', { name: /Filter/ });
      if (await toggle.count()) await toggle.click();
    };
    await page.goto('/category/grocery');
    await openFilters();
    await expect(page.getByRole('group', { name: 'Variants' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Featured' })).toHaveCount(0);
    await page.goto('/category/tobacco');
    await openFilters();
    await expect(page.getByRole('checkbox', { name: /^Bestsellers \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /^New/ })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('the Wikimedia photo is credited, and a small photo isn’t enlarged', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/product/149');
    await expect(page.locator('.photo-credit')).toContainText('Photo: Dietmar Rabich, CC BY-SA 4.0.');
    await expect(page.locator('.photo-credit a')).toHaveAttribute('href', /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    await page.goto('/product/263');
    const img = page.locator('.pd-media img');
    await expect(img).toBeVisible();
    const { attr, shown } = await img.evaluate((el) => ({ attr: Number(el.getAttribute('width')), shown: el.getBoundingClientRect().width }));
    expect(shown).toBeLessThanOrEqual(attr + 0.5);
    expect(errors).toEqual([]);
  });
});

// The product photo is drawn whole and centred in its frame (AW-009; the CSS
// is from f225188): a tall photo reaches the frame's top and bottom padding, a
// wide one its left and right padding, with equal space on the other sides,
// and object-fit: contain keeps its proportions inside the img box.
test.describe('product photo frame', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(([key, value]) => {
      try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
    }, [AGE_KEY, ageRecord(Date.now())]);
  });

  test('tall and wide photos are whole, centred and not cropped (AW-009)', async ({ page }) => {
    const errors = trackErrors(page);
    // 88 Tropical Fantasy, 57 Pure Guard and 70 Shroom Puff are much taller
    // than wide; 31 BIC and 290 Powerade much wider.
    for (const [id, shape] of [[88, 'tall'], [57, 'tall'], [70, 'tall'], [31, 'wide'], [290, 'wide']]) {
      await page.goto(`/product/${id}`);
      const img = page.locator('.pd-media img');
      await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
      const m = await img.evaluate((el) => {
        const frame = el.closest('.pd-media').getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const ratio = el.naturalWidth / el.naturalHeight;
        // The drawn photo inside the img box (object-fit: contain, centred).
        const w = Math.min(box.width, box.height * ratio);
        const h = w / ratio;
        const x = box.left + (box.width - w) / 2;
        const y = box.top + (box.height - h) / 2;
        return {
          fit: getComputedStyle(el).objectFit,
          boxInside: box.left >= frame.left - 1 && box.top >= frame.top - 1 && box.right <= frame.right + 1 && box.bottom <= frame.bottom + 1,
          top: y - frame.top, bottom: frame.bottom - (y + h), left: x - frame.left, right: frame.right - (x + w),
        };
      });
      expect(m.fit, `#${id}`).toBe('contain');
      expect(m.boxInside, `#${id}`).toBe(true);
      // Inside the frame with its padding on every side (20px on phones).
      expect(Math.min(m.top, m.bottom, m.left, m.right), `#${id}`).toBeGreaterThanOrEqual(20);
      expect(Math.abs(m.top - m.bottom), `#${id}`).toBeLessThanOrEqual(2);
      expect(Math.abs(m.left - m.right), `#${id}`).toBeLessThanOrEqual(2);
      // Scaled to fit the frame, not shrunk further. The pipeline frames every
      // product photo in a window of the card's 1.1 aspect around the product
      // (AW-287), so the rendition itself is never tall: whichever side of
      // the frame limits it, that side sits at the inset.
      expect(Math.min(m.top, m.left), `#${id} (${shape})`).toBeLessThanOrEqual(36);
    }
    expect(errors).toEqual([]);
  });
});
