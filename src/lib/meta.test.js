// Page titles, descriptions and the per-route head tags (AW-181, AW-338),
// within the lengths search results show (AW-318, AW-319).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOME_PITCH } from '../data/content.js';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from './departments.js';
import { brandLabel } from './format.js';
import {
  applyPageMeta, clip, DEFAULT_IMAGE, fitSentences, fitTitle, HOME_DESCRIPTION, inSentence, nameHasBrand, pageMeta,
  sentencesOf, SITE_URL,
} from './meta.js';
import { normalizeSearchText } from './search.js';

const products = [
  { id: 7, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', description: '', img: '/assets/kite--320x320-a1.jpg', picture: { src: '/assets/kite--640x640-b2.jpg', width: 1000, height: 1000 } },
  { id: 8, name: 'Bic', brand: 'Bic', cat: 'MERCHANDISE', sub: 'Lighters', sku: 'AW-BIC', description: '', img: 'https://cdn.example.test/bic.jpg', picture: { src: 'https://cdn.example.test/bic.jpg' } },
];
const departments = [{ key: 'TOBACCO', subs: ['Cigarettes', 'Cigars', 'Hookah', 'Wraps', 'Zyn'], count: 68 }];
const EMPTY = { q: '', sort: 'featured', tags: [], variants: false };

const head = (selector, attr = 'content') => document.head.querySelector(selector)?.getAttribute(attr) ?? null;

describe('clip', () => {
  it('keeps short text and cuts long text at a word', () => {
    expect(clip('  short   text ')).toBe('short text');
    expect(clip('one two three four', 10)).toBe('one two…');
  });
});

describe('clip, fitSentences and fitTitle (AW-319)', () => {
  it('splits a description into sentences, not at "Mr." or inside a number', () => {
    expect(sentencesOf("Hershey's chocolate bars. Eight varieties: Milk; Mr. Goodbar, regular; and Mr. Goodbar, king size."))
      .toEqual(["Hershey's chocolate bars.", 'Eight varieties: Milk; Mr. Goodbar, regular; and Mr. Goodbar, king size.']);
    expect(sentencesOf('Herbal Clean detox drink, 16 oz. Four flavors: Grape and Red.  PEAK fluid, 2.5 gal.'))
      .toEqual(['Herbal Clean detox drink, 16 oz.', 'Four flavors: Grape and Red.', 'PEAK fluid, 2.5 gal.']);
    expect(sentencesOf('')).toEqual([]);
  });

  it('keeps whole sentences that fit, skips one that does not, and clips only a first sentence too long alone', () => {
    expect(fitSentences(['One two.', 'Three four five six.', 'Seven.'], 16)).toBe('One two. Seven.');
    expect(fitSentences(['One two.', '', 'Three.'], 155)).toBe('One two. Three.');
    expect(fitSentences(['one two three four five.', 'Six.'], 12)).toBe('one two…');
    expect(fitSentences([])).toBe('');
  });

  it('leaves out optional title parts from the last one back, then the site name, never cutting the page name', () => {
    expect(fitTitle(['Cigars', 'Tobacco', 'Site'], 60)).toBe('Cigars · Tobacco · Site');
    expect(fitTitle(['Cigars', 'Tobacco', 'Site'], 16)).toBe('Cigars · Site');
    expect(fitTitle(['Cigars', 'Tobacco', 'Wholesale Catalog', 'Site'], 25)).toBe('Cigars · Tobacco · Site');
    expect(fitTitle(['A long product name', 'Brand', 'Site'], 20)).toBe('A long product name');
    expect(fitTitle(['A much too long product name', 'Brand', 'Site'], 10)).toBe('A much too long product name');
    expect(fitTitle(['Kite', '', 'Site'])).toBe('Kite · Site');
  });

  it('puts department and line names in a sentence, keeping initialisms and names', () => {
    expect(inSentence('Cigars & Cigarillos')).toBe('cigars & cigarillos');
    expect(inSentence('Pouches & ZYN')).toBe('pouches & ZYN');
    expect(inSentence('OTC & Health')).toBe('OTC & health');
  });

  it('tells whether a product name already says its brand, as whole words', () => {
    expect(nameHasBrand('Swisher Sweets cigarillos', 'Swisher Sweets')).toBe(true);
    expect(nameHasBrand("Hershey's bars", "Hershey's")).toBe(true);
    expect(nameHasBrand('Loose Leaf wraps', 'LooseLeaf')).toBe(true);
    expect(nameHasBrand('Zig Zag papers', 'Zig-Zag')).toBe(true);
    expect(nameHasBrand('Bicycle cards', 'Bic')).toBe(false);
    expect(nameHasBrand('Mint candy lumps', "Candyman's")).toBe(false);
    expect(nameHasBrand('Anything', '')).toBe(true);
  });
});

describe('pageMeta', () => {
  it('titles the home, department, product and support pages', () => {
    expect(pageMeta({ page: 'home' }, products, departments)).toMatchObject({ title: 'Wholesale Tobacco, Vapes & Candy · Alabama Wholesale Inc', description: HOME_DESCRIPTION, path: '/', noindex: false });
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: 'Cigars', query: EMPTY }, products, departments).title).toBe('Cigars · Tobacco · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: null, query: EMPTY }, products, departments)).toMatchObject({
      title: 'Tobacco · Wholesale Catalog · Alabama Wholesale Inc',
      description: 'Wholesale tobacco for licensed retailers: 68 products across Cigarettes and more. Sign in for account pricing.',
    });
    expect(pageMeta({ page: 'product', productId: 7 }, products, departments).title).toBe('Kite · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'privacy' }, products, departments).title).toBe('Privacy · Alabama Wholesale Inc');
  });

  it('describes the home page in one search result: 155 characters, the hero line word for word (AW-318)', () => {
    const home = pageMeta({ page: 'home' }, products, departments);
    expect(home.description).toBe(HOME_PITCH);
    expect(home.description.length).toBeLessThanOrEqual(155);
    expect(home.title.length).toBeLessThanOrEqual(60);
  });

  it('gives index.html the home page title and description, for crawlers and previews that run no script (AW-318)', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const text = (raw) => raw.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const tag = (re) => text(re.exec(html)?.[1] ?? '');
    const home = pageMeta({ page: 'home' }, products, departments);
    expect(tag(/<title>([^<]*)<\/title>/)).toBe(home.title);
    expect(tag(/<meta name="description" content="([^"]*)"/)).toBe(home.description);
    expect(tag(/<meta property="og:title" content="([^"]*)"/)).toBe(home.title);
    expect(tag(/<meta property="og:description" content="([^"]*)"/)).toBe(home.description);
    expect(tag(/<meta property="og:site_name" content="([^"]*)"/)).toBe('Alabama Wholesale Inc');
  });

  it('leaves the placeholder brand "Assorted" out of a product title and description (AW-286)', () => {
    const shirts = [{ id: 9, name: 'White V-neck shirts', brand: 'Assorted', cat: 'MERCHANDISE', sub: 'Apparel', sku: 'AW-V', description: '', img: null, picture: null }];
    const meta = pageMeta({ page: 'product', productId: 9 }, shirts, departments);
    expect(meta.title).toBe('White V-neck shirts · Alabama Wholesale Inc');
    expect(meta.description).toBe('White V-neck shirts from our Merchandise department. Wholesale apparel for licensed retailers. SKU AW-V.');
  });

  it('names a product’s brand only when its name doesn’t, and fits the description by whole sentences (AW-319)', () => {
    const rows = [
      { id: 1, name: 'Mint candy lumps', brand: "Candyman's", cat: 'CANDIES', sub: 'Sweets & Gummies', sku: 'AW-MINT', description: 'Mint candy lumps in the counter jar.' },
      { id: 2, name: 'Coke', brand: 'Coca-Cola', cat: 'DRINKS & BAGS', sub: 'Sodas', sku: 'AW-COKE', description: '' },
      { id: 3, name: "Hershey's bars", brand: "Hershey's", cat: 'CANDIES', sub: 'Chocolate Bars', sku: 'AW-HERSHEY',
        description: "Hershey's chocolate bars. Eight varieties: Milk, regular; Milk, king size; Cookies, regular; Cookies, king size; Almond, regular; Almond, king size; Mr. Goodbar, regular; and Mr. Goodbar, king size." },
    ];
    const meta = (id) => pageMeta({ page: 'product', productId: id }, rows, departments);
    expect(meta(1)).toMatchObject({
      title: "Mint candy lumps · Candyman's · Alabama Wholesale Inc",
      description: 'Mint candy lumps in the counter jar. Wholesale sweets & gummies for licensed retailers. SKU AW-MINT.',
    });
    expect(meta(2)).toMatchObject({
      title: 'Coke · Coca-Cola · Alabama Wholesale Inc',
      description: 'Coke by Coca-Cola from our Drinks & Bags department. Wholesale sodas for licensed retailers. SKU AW-COKE.',
    });
    expect(meta(3)).toMatchObject({
      title: "Hershey's bars · Alabama Wholesale Inc",
      description: "Hershey's chocolate bars. Wholesale chocolate bars for licensed retailers. SKU AW-HERSHEY.",
    });
  });

  it('describes a product line by its own count and brands, and a department by its biggest lines (AW-319, AW-226)', () => {
    const rows = [
      { id: 1, name: 'Swisher Sweets cigarillos', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', img: '/assets/ss--640x640-a.jpg' },
      { id: 2, name: 'Swisher Sweets BLK', brand: 'Swisher Sweets', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', img: '/assets/blk--640x640-b.jpg' },
      { id: 3, name: 'Backwoods', brand: 'Backwoods', cat: 'TOBACCO', sub: 'Cigars & Cigarillos' },
      { id: 4, name: 'Cigar tubes', brand: 'Assorted', cat: 'TOBACCO', sub: 'Cigars & Cigarillos' },
      { id: 5, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes' },
      { id: 6, name: 'ZYN', brand: 'ZYN', cat: 'TOBACCO', sub: 'Pouches & ZYN' },
    ];
    const depts = departmentsFor(rows);
    const line = pageMeta({ page: 'category', category: 'TOBACCO', sub: 'Cigars & Cigarillos', query: EMPTY }, rows, depts);
    expect(line.title).toBe('Cigars & Cigarillos · Tobacco · Alabama Wholesale Inc');
    // The unbranded tubes make it '… and more'.
    expect(line.description).toBe('Wholesale cigars & cigarillos from our Tobacco department: 4 products from Swisher Sweets, Backwoods and more. Sign in for account pricing.');
    expect(line.image.url).toBe('/assets/ss--640x640-a.jpg');
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: 'Pouches & ZYN', query: EMPTY }, rows, depts).description)
      .toBe('Wholesale pouches & ZYN from our Tobacco department: 1 product from ZYN. Sign in for account pricing.');
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: null, query: EMPTY }, rows, depts).description)
      .toBe('Wholesale tobacco for licensed retailers: 6 products across Cigars & Cigarillos, Cigarettes and Pouches & ZYN. Sign in for account pricing.');
    // A line named like its department names it once.
    const oil = [{ id: 7, name: 'Castrol', brand: 'Castrol', cat: 'MOTOR OIL', sub: 'Motor Oil' }];
    expect(pageMeta({ page: 'category', category: 'MOTOR OIL', sub: 'Motor Oil', query: EMPTY }, oil, departmentsFor(oil)).title).toBe('Motor Oil · Alabama Wholesale Inc');
  });

  it('counts only products outside the legal review toward the lines a department description names (AW-001)', () => {
    const rows = [
      ...[1, 2, 3].map((id) => ({ id, name: `Shroom ${id}`, brand: 'Psyched', cat: 'NOVELTIES', sub: 'Mushroom Products' })),
      { id: 4, name: 'Geek Bar', brand: 'Geek Bar', cat: 'NOVELTIES', sub: 'Disposable Vapes' },
    ];
    const depts = departmentsFor(rows);
    expect(pageMeta({ page: 'category', category: 'NOVELTIES', sub: null, query: EMPTY }, rows, depts).description)
      .toBe('Wholesale novelties & vapes for licensed retailers: 4 products across Disposable Vapes and more. Sign in for account pricing.');
    // The line keeps its own page, title and description.
    expect(pageMeta({ page: 'category', category: 'NOVELTIES', sub: 'Mushroom Products', query: EMPTY }, rows, depts).title)
      .toBe('Mushroom Products · Alabama Wholesale Inc');
  });

  it('gives each page its own canonical path, without filters', () => {
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: 'Cigars', query: { ...EMPTY, q: 'kite' } }, products, departments).path).toBe('/category/tobacco/cigars');
    expect(pageMeta({ page: 'product', productId: 7 }, products, departments).path).toBe('/product/7');
    expect(pageMeta({ page: 'contact' }, products, departments).path).toBe('/contact');
  });

  it('uses the product photo as the share image', () => {
    expect(pageMeta({ page: 'product', productId: 7 }, products, departments).image).toEqual({ url: '/assets/kite--640x640-b2.jpg', width: 640, height: 640, alt: 'Kite' });
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: null, query: EMPTY }, products, departments).image.url).toBe('/assets/kite--640x640-b2.jpg');
    expect(pageMeta({ page: 'home' }, products, departments).image).toBeNull();
  });

  it('gives the share image the size of the JPEG it names, not of the largest WebP', () => {
    // picture.width/height describe the largest WebP; the JPEG can be smaller.
    expect(pageMeta({ page: 'product', productId: 7 }, products, departments).image).toMatchObject({ width: 640, height: 640 });
    // A photo URL without a generated size leaves the size out.
    expect(pageMeta({ page: 'product', productId: 8 }, products, departments).image).toEqual({ url: 'https://cdn.example.test/bic.jpg', width: undefined, height: undefined, alt: 'Bic' });
  });

  it('keeps private and not-found pages out of search results', () => {
    for (const page of ['quote', 'account', 'admin', 'reset-password']) {
      expect(pageMeta({ page }, products, departments)).toMatchObject({ noindex: true, path: null });
    }
    expect(pageMeta({ page: 'not-found', kind: 'product' }, products, departments)).toMatchObject({ title: 'Product not found · Alabama Wholesale Inc', noindex: true, path: null });
    expect(pageMeta({ page: 'not-found', kind: 'department' }, products, departments).title).toBe('Department not found · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'not-found', kind: 'line' }, products, departments).title).toBe('Product line not found · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'not-found' }, products, departments).description).not.toBe(HOME_DESCRIPTION);
  });

  it('titles each admin section and view, without names (AW-118)', () => {
    const title = (route) => pageMeta({ page: 'admin', ...route }, products, departments).title;
    expect(title({})).toBe('Orders · Admin · Alabama Wholesale Inc');
    expect(title({ section: 'orders', query: { status: 'all' } })).toBe('Orders · Admin · Alabama Wholesale Inc');
    expect(title({ section: 'orders', id: '11111111-2222-4333-8444-555555555555', view: 'print' })).toBe('Pick list · Admin · Alabama Wholesale Inc');
    expect(title({ section: 'orders', id: '11111111-2222-4333-8444-555555555555', view: 'print', query: { doc: 'slip' } })).toBe('Packing slip · Admin · Alabama Wholesale Inc');
    expect(title({ section: 'accounts' })).toBe('Accounts · Admin · Alabama Wholesale Inc');
    expect(title({ section: 'accounts', id: '11111111-2222-4333-8444-555555555555' })).toBe('Account details · Admin · Alabama Wholesale Inc');
    expect(title({ section: 'products', query: { q: 'swisher' } })).toBe('Products · Admin · Alabama Wholesale Inc');
    expect(title({ section: 'products', id: 'new' })).toBe('New product · Admin · Alabama Wholesale Inc');
    expect(title({ section: 'products', id: 12 })).toBe('Edit product · Admin · Alabama Wholesale Inc');
    expect(title({ section: 'pricing' })).toBe('Pricing · Admin · Alabama Wholesale Inc');
    expect(title({ section: 'homepage' })).toBe('Homepage · Admin · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'admin', section: 'products', id: 12 }, products, departments)).toMatchObject({ noindex: true, path: null });
    // Orders placed since the last visit to Orders (AW-111): a count, never a name.
    expect(title({ unseen: 2 })).toBe('(2) Orders · Admin · Alabama Wholesale Inc');
    expect(title({ section: 'accounts', unseen: 1 })).toBe('(1) Accounts · Admin · Alabama Wholesale Inc');
    expect(title({ unseen: 0 })).toBe('Orders · Admin · Alabama Wholesale Inc');
  });

  it('titles a catalog page that is still loading, or did not load (AW-204)', () => {
    expect(pageMeta({ page: 'not-found', kind: 'product', catalog: 'loading' }, products, departments)).toMatchObject({ title: 'Loading product… · Alabama Wholesale Inc', noindex: true });
    expect(pageMeta({ page: 'not-found', kind: 'line', catalog: 'error' }, products, departments).title).toBe('Couldn’t load this product line · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'not-found', kind: 'page', catalog: 'loading' }, products, departments).title).toBe('Page not found · Alabama Wholesale Inc');
  });

  it('writes "an Alabama Wholesale Inc trade account" on /apply (AW-319)', () => {
    expect(pageMeta({ page: 'apply' }, products, departments).description).toMatch(/^What licensed retailers need to open an Alabama Wholesale Inc trade account/);
  });

  it('prints the minimum and the hours from content.js, in plain text (AW-283, AW-275)', () => {
    expect(pageMeta({ page: 'quote' }, products, departments).description).toMatch(/Minimum order \$500\.00\.$/);
    const contact = pageMeta({ page: 'contact' }, products, departments).description;
    // Both hours lines whole: the description is never clipped mid-hours.
    expect(contact).toBe('Call (205) 354-4473 or visit 613 Graymont Ave N, Birmingham AL 35203. Mon–Fri 7:00 AM – 6:00 PM CT, Sat–Sun 8:00 AM – 5:30 PM CT.');
    // No no-break spaces or word joiners in head tags.
    expect(contact).not.toMatch(/[\u00A0\u2060]/);
  });

  it('titles the search page by its query, clipped, and keeps it out of search results (AW-007)', () => {
    expect(pageMeta({ page: 'search', q: 'cigar' }, products, departments)).toMatchObject({
      title: 'Results for “cigar” · Alabama Wholesale Inc',
      description: 'Search results for “cigar” in the Alabama Wholesale Inc wholesale catalog.',
      path: null,
      noindex: true,
    });
    const long = pageMeta({ page: 'search', q: 'swisher sweets cigarillos white grape diamond silver red' }, products, departments);
    expect(long.title).toBe('Results for “swisher sweets cigarillos white grape…” · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'search', q: 'x'.repeat(200) }, products, departments).description.length).toBeLessThanOrEqual(155);
    for (const q of ['', ' ', 'a']) {
      expect(pageMeta({ page: 'search', q }, products, departments)).toMatchObject({ title: 'Search · Alabama Wholesale Inc', noindex: true, path: null });
    }
  });

  it('depends on the route only, never on the header search (AW-338)', () => {
    expect(pageMeta({ page: 'quote' }, products, departments, 'kite').title).toBe('Checkout · Alabama Wholesale Inc');
  });

  it('names the receipt /quote shows after a save, and keeps it out of search results (AW-022)', () => {
    const checkout = pageMeta({ page: 'quote' }, products, departments);
    const quote = pageMeta({ page: 'quote', received: 'quote' }, products, departments);
    const order = pageMeta({ page: 'quote', received: 'order' }, products, departments);
    expect(quote).toMatchObject({ title: 'Quote received · Alabama Wholesale Inc', description: checkout.description, noindex: true, path: null });
    expect(order).toMatchObject({ title: 'Order received · Alabama Wholesale Inc', description: checkout.description, noindex: true, path: null });
  });
});

describe('every bundled product, department and line (AW-319)', () => {
  const depts = departmentsFor(PRODUCTS);
  const occurrences = (text, word) => {
    const w = normalizeSearchText(word);
    return ` ${normalizeSearchText(text)} `.split(` ${w} `).length - 1;
  };

  it('has a product title within 60 characters that names the brand once and never "Assorted"', () => {
    for (const p of PRODUCTS) {
      const { title, description } = pageMeta({ page: 'product', productId: Number(p.id) }, PRODUCTS, depts);
      const brand = brandLabel(p.brand);
      if (p.name.length <= 60) expect([p.id, title.length <= 60]).toEqual([p.id, true]);
      expect([p.id, title.startsWith(p.name)]).toEqual([p.id, true]);
      if (brand) expect([p.id, occurrences(title, brand)]).toEqual([p.id, 1]);
      if (!/Assorted/.test(p.name)) expect([p.id, title]).not.toEqual([p.id, expect.stringContaining('Assorted')]);
      expect([p.id, description.length <= 155]).toEqual([p.id, true]);
      // Only a first sentence too long on its own is clipped.
      if ((sentencesOf(p.description)[0] || '').length <= 155) expect([p.id, description]).not.toEqual([p.id, expect.stringContaining('…')]);
      if (!/Assorted/.test(p.description || '')) expect([p.id, description]).not.toEqual([p.id, expect.stringContaining('Assorted')]);
    }
  });

  it('has department and line titles within 60 characters, and whole descriptions within 155', () => {
    const pages = depts.flatMap((d) => [
      { route: { page: 'category', category: d.key, sub: null, query: EMPTY }, d },
      ...d.subs.map((sub) => ({ route: { page: 'category', category: d.key, sub, query: EMPTY }, d })),
    ]);
    expect(pages.length).toBeGreaterThan(50);
    for (const { route, d } of pages) {
      const { title, description } = pageMeta(route, PRODUCTS, depts);
      const where = route.sub || d.key;
      expect([where, title.length <= 60, description.length <= 155]).toEqual([where, true, true]);
      expect([where, description]).not.toEqual([where, expect.stringMatching(/…|Sign in for…|Assorted/)]);
      expect([where, description.endsWith('.')]).toEqual([where, true]);
      if (route.sub) {
        const n = PRODUCTS.filter((p) => p.cat === d.key && p.sub === route.sub).length;
        expect([where, title.startsWith(`${route.sub} · `), title.includes('Wholesale Catalog')]).toEqual([where, true, false]);
        expect([where, description]).toEqual([where, expect.stringContaining(`department: ${n} product`)]);
      } else {
        expect([where, description]).toEqual([where, expect.stringContaining(`licensed retailers: ${d.count} product`)]);
      }
    }
  });
});

describe('applyPageMeta', () => {
  it('writes the title, description, canonical, Open Graph and Twitter tags', () => {
    applyPageMeta({ title: 'T', description: 'D', path: '/product/7', image: { url: '/assets/kite-640.jpg', width: 640, height: 640, alt: 'Kite' } });
    expect(document.title).toBe('T');
    expect(head('meta[name="description"]')).toBe('D');
    expect(head('link[rel="canonical"]', 'href')).toBe(`${SITE_URL}/product/7`);
    expect(head('meta[property="og:url"]')).toBe(`${SITE_URL}/product/7`);
    expect(head('meta[property="og:title"]')).toBe('T');
    expect(head('meta[property="og:description"]')).toBe('D');
    expect(head('meta[name="twitter:title"]')).toBe('T');
    expect(head('meta[name="twitter:description"]')).toBe('D');
    expect(head('meta[property="og:image"]')).toBe(`${window.location.origin}/assets/kite-640.jpg`);
    expect(head('meta[name="twitter:image"]')).toBe(`${window.location.origin}/assets/kite-640.jpg`);
    expect(head('meta[property="og:image:alt"]')).toBe('Kite');
    expect(head('meta[name="robots"]')).toBeNull();
  });

  it('marks noindex pages and drops their canonical, and falls back to the logo image', () => {
    applyPageMeta({ title: 'Not found', description: 'D', path: null, noindex: true });
    expect(head('meta[name="robots"]')).toBe('noindex');
    expect(head('link[rel="canonical"]', 'href')).toBeNull();
    expect(head('meta[property="og:url"]')).toBeNull();
    expect(head('meta[property="og:image"]')).toBe(DEFAULT_IMAGE.url);
    expect(head('meta[property="og:image:width"]')).toBe('1200');
    applyPageMeta({ title: 'Home', description: 'D', path: '/' });
    expect(head('meta[name="robots"]')).toBeNull();
    expect(head('link[rel="canonical"]', 'href')).toBe(`${SITE_URL}/`);
  });

  it('reads one SITE_URL, the production domain unless VITE_SITE_URL is set', () => {
    expect(SITE_URL).toBe(import.meta.env.VITE_SITE_URL ? SITE_URL : 'https://alabamawholesaleinc.com');
    expect(DEFAULT_IMAGE.url).toBe(`${SITE_URL}/og.jpg`);
  });
});
