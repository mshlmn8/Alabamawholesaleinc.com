// Page titles, descriptions and the per-route head tags (AW-181, AW-338).
import { describe, expect, it } from 'vitest';
import { applyPageMeta, clip, DEFAULT_IMAGE, HOME_DESCRIPTION, pageMeta, SITE_URL } from './meta.js';

const products = [{ id: 7, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', description: '', img: '/assets/kite-320.jpg', picture: { src: '/assets/kite-640.jpg', width: 640, height: 640 } }];
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

  it('gives each page its own canonical path, without filters', () => {
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: 'Cigars', query: { ...EMPTY, q: 'kite' } }, products, departments).path).toBe('/category/tobacco/cigars');
    expect(pageMeta({ page: 'product', productId: 7 }, products, departments).path).toBe('/product/7');
    expect(pageMeta({ page: 'contact' }, products, departments).path).toBe('/contact');
  });

  it('uses the product photo as the share image', () => {
    expect(pageMeta({ page: 'product', productId: 7 }, products, departments).image).toEqual({ url: '/assets/kite-640.jpg', width: 640, height: 640, alt: 'Kite' });
    expect(pageMeta({ page: 'category', category: 'TOBACCO', sub: null, query: EMPTY }, products, departments).image.url).toBe('/assets/kite-640.jpg');
    expect(pageMeta({ page: 'home' }, products, departments).image).toBeNull();
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

  it('titles a catalog page that is still loading, or did not load (AW-204)', () => {
    expect(pageMeta({ page: 'not-found', kind: 'product', catalog: 'loading' }, products, departments)).toMatchObject({ title: 'Loading product… · Alabama Wholesale Inc', noindex: true });
    expect(pageMeta({ page: 'not-found', kind: 'line', catalog: 'error' }, products, departments).title).toBe('Couldn’t load this product line · Alabama Wholesale Inc');
    expect(pageMeta({ page: 'not-found', kind: 'page', catalog: 'loading' }, products, departments).title).toBe('Page not found · Alabama Wholesale Inc');
  });

  it('depends on the route only, never on the header search (AW-338)', () => {
    expect(pageMeta({ page: 'quote' }, products, departments, 'kite').title).toBe('Checkout · Alabama Wholesale Inc');
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
