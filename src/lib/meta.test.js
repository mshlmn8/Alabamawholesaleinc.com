// Page titles, descriptions and the per-route head tags (AW-181, AW-338).
import { describe, expect, it } from 'vitest';
import { APPLY_TITLES, applyPageMeta, clip, DEFAULT_IMAGE, HOME_DESCRIPTION, pageMeta, SITE_URL } from './meta.js';

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

describe('pageMeta', () => {
  it('titles the home, department, product and support pages', () => {
    expect(pageMeta({ page: 'home' }, products, departments)).toMatchObject({ title: 'Alabama Wholesale Inc · Wholesale Distributor — Birmingham, AL', description: HOME_DESCRIPTION, path: '/', noindex: false });
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: 'Cigars', query: EMPTY }, products, departments).title).toBe('Cigars · Tobacco · Wholesale Catalog · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: null, query: EMPTY }, products, departments).description).toContain('68 SKUs across Cigarettes, Cigars, Hookah, Wraps and more');
    expect(pageMeta({ page: 'product', productId: 7 }, products, departments).title).toBe('Kite · Kite · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'privacy' }, products, departments).title).toBe('Privacy · Alabama Wholesale Inc');
  });

  it('leaves the placeholder brand "Assorted" out of a product title and description (AW-286)', () => {
    const shirts = [{ id: 9, name: 'White V-neck shirts', brand: 'Assorted', cat: 'MERCHANDISE', sub: 'Apparel', sku: 'AW-V', description: '', img: null, picture: null }];
    const meta = pageMeta({ page: 'product', productId: 9 }, shirts, departments);
    expect(meta.title).toBe('White V-neck shirts · Alabama Wholesale Inc');
    expect(meta.description).toBe('White V-neck shirts — wholesale apparel. SKU AW-V.');
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

describe('pageMeta for /apply (AW-098)', () => {
  it('titles the application page by the account’s state, with one description and canonical path', () => {
    const guest = pageMeta({ page: 'apply' }, products, departments);
    expect(guest).toMatchObject({ title: 'Apply for a trade account · Alabama Wholesale Inc', path: '/apply', noindex: false });
    const titles = Object.fromEntries(['guest', 'loading', 'pending', 'approved', 'suspended'].map((applyAs) => {
      const meta = pageMeta({ page: 'apply', applyAs }, products, departments);
      expect(meta).toMatchObject({ description: guest.description, path: '/apply', noindex: false });
      return [applyAs, meta.title];
    }));
    expect(titles).toEqual({
      guest: 'Apply for a trade account · Alabama Wholesale Inc',
      loading: 'Trade Account · Alabama Wholesale Inc',
      pending: 'Application Under Review · Alabama Wholesale Inc',
      approved: 'Your Trade Account · Alabama Wholesale Inc',
      suspended: 'Account On Hold · Alabama Wholesale Inc',
    });
    expect(pageMeta({ page: 'apply', applyAs: 'mystery' }, products, departments).title).toBe(guest.title);
    expect(APPLY_TITLES.pending).toBe('Application Under Review');
  });
});

describe('pageMeta for /reset-password (AW-255)', () => {
  it('titles the reset page by what it shows, with one description and no canonical path', () => {
    const first = pageMeta({ page: 'reset-password' }, products, departments);
    expect(first).toMatchObject({ title: 'Reset Password · Alabama Wholesale Inc', path: null, noindex: true });
    const titles = Object.fromEntries(['unavailable', 'request', 'checking', 'form', 'done', 'link-invalid'].map((view) => {
      const meta = pageMeta({ page: 'reset-password', view }, products, departments);
      expect(meta).toMatchObject({ description: first.description, path: null, noindex: true });
      return [view, meta.title];
    }));
    expect(titles).toEqual({
      unavailable: 'Reset Password · Alabama Wholesale Inc',
      request: 'Reset Password · Alabama Wholesale Inc',
      checking: 'Reset Password · Alabama Wholesale Inc',
      form: 'Reset Password · Alabama Wholesale Inc',
      done: 'Password Updated · Alabama Wholesale Inc',
      'link-invalid': 'Reset Link Not Valid · Alabama Wholesale Inc',
    });
    expect(pageMeta({ page: 'reset-password', view: 'mystery' }, products, departments).title).toBe(first.title);
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
