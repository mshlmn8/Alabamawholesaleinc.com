// Path URLs, validation and canonical addresses (AW-043, AW-185, AW-188).
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import { departmentsFor } from './departments.js';
import {
  categoryQueryString, hrefFor, legacyHashTarget, pageKeyFor, parseCategoryQuery, parseUrl, pathFor,
  resolveRoute, routeKey, siteUrl, slugify, DEFAULT_SITE_URL, EMPTY_CATEGORY_QUERY, PATH_SECTIONS, SORTS,
} from './routes.js';

const departments = departmentsFor(PRODUCTS);
const catalog = { departments, products: PRODUCTS };
const resolve = (url) => {
  const [pathname, search = ''] = url.split('?');
  return resolveRoute(parseUrl({ pathname, search: search ? `?${search}` : '' }), catalog);
};

describe('slugify', () => {
  it('turns catalog names into URL segments', () => {
    expect(slugify('TOBACCO')).toBe('tobacco');
    expect(slugify('DRINKS & BAGS')).toBe('drinks-and-bags');
    expect(slugify('FOOD STUFF')).toBe('food-stuff');
    expect(slugify('Cigars & Cigarillos')).toBe('cigars-and-cigarillos');
    expect(slugify('Men’s  Care!')).toBe('mens-care');
    expect(slugify('Café')).toBe('cafe');
  });

  it('gives every department and every line in a department its own slug', () => {
    const deptSlugs = departments.map(d => slugify(d.key));
    expect(new Set(deptSlugs).size).toBe(deptSlugs.length);
    for (const d of departments) {
      const subs = d.subs.map(slugify);
      expect(subs.every(Boolean)).toBe(true);
      expect(new Set(subs).size).toBe(subs.length);
    }
  });
});

describe('parseUrl', () => {
  it('reads every page', () => {
    expect(parseUrl({ pathname: '/' })).toEqual({ page: 'home' });
    expect(parseUrl({ pathname: '/index.html' })).toEqual({ page: 'home' });
    expect(parseUrl({ pathname: '/product/12' })).toEqual({ page: 'product', id: '12' });
    expect(parseUrl({ pathname: '/category/tobacco' })).toMatchObject({ page: 'category', dept: 'tobacco', sub: null });
    expect(parseUrl({ pathname: '/category/drinks-and-bags/energy-drinks' })).toMatchObject({ page: 'category', dept: 'drinks-and-bags', sub: 'energy-drinks' });
    expect(parseUrl({ pathname: '/search', search: '?q=kite' })).toEqual({ page: 'search', q: 'kite' });
    for (const page of ['quote', 'account', 'admin', 'catalog', 'contact', 'delivery', 'shipping', 'privacy', 'terms', 'apply', 'reset-password']) {
      expect(parseUrl({ pathname: `/${page}` })).toEqual({ page });
    }
  });

  it('is not case or trailing-slash sensitive for page names', () => {
    expect(parseUrl({ pathname: '/Account' })).toEqual({ page: 'account' });
    expect(parseUrl({ pathname: '/catalog/' })).toEqual({ page: 'catalog' });
  });

  it('never throws on malformed percent-escapes (AW-185)', () => {
    expect(parseUrl({ pathname: '/category/%E0%A4%A' })).toEqual({ page: 'not-found' });
    expect(parseUrl({ pathname: '/product/%E0%A4%A' })).toEqual({ page: 'not-found' });
    expect(parseUrl({ pathname: '/category/DRINKS%20%26%20BAGS/Bags%20%2' })).toEqual({ page: 'not-found' });
    expect(() => parseUrl({ pathname: '/category/x', search: '?q=%E0%A4%A' })).not.toThrow();
  });

  it('answers only the first segments in PATH_SECTIONS, the paths netlify.toml rewrites (NEW-088)', () => {
    expect(PATH_SECTIONS).toEqual(['product', 'category', 'search', 'quote', 'account', 'admin', 'catalog', 'contact', 'delivery', 'shipping', 'privacy', 'terms', 'apply', 'reset-password']);
    for (const section of ['products', 'categories', 'home', 'index', 'cart', '404', 'sitemap.xml']) {
      expect([section, parseUrl({ pathname: `/${section}` })]).toEqual([section, { page: 'not-found' }]);
    }
  });

  it('sends unknown or incomplete addresses to not-found', () => {
    expect(parseUrl({ pathname: '/nowhere' })).toEqual({ page: 'not-found' });
    expect(parseUrl({ pathname: '/product' })).toEqual({ page: 'not-found', kind: 'product' });
    expect(parseUrl({ pathname: '/category' })).toEqual({ page: 'not-found', kind: 'department' });
    expect(parseUrl({ pathname: '/product/1/2' })).toEqual({ page: 'not-found', kind: 'page' });
    expect(parseUrl({ pathname: '/category/a/b/c' })).toEqual({ page: 'not-found', kind: 'page' });
    expect(parseUrl({ pathname: '/quote/extra' })).toEqual({ page: 'not-found' });
  });
});

describe('department filters in the query string (AW-008)', () => {
  it('reads known values and drops the rest', () => {
    expect(parseCategoryQuery('?q=bar&sort=name-desc&tags=new,bestseller,bogus&variants=1'))
      .toEqual({ q: 'bar', sort: 'name-desc', tags: ['BESTSELLER', 'NEW'], brands: [], variants: true });
    expect(parseCategoryQuery('?sort=cheapest&variants=yes')).toEqual({ q: '', sort: 'featured', tags: [], brands: [], variants: false });
    expect(parseCategoryQuery('')).toEqual({ q: '', sort: 'featured', tags: [], brands: [], variants: false });
  });

  it('writes them in a fixed order and leaves out defaults', () => {
    expect(categoryQueryString({ q: ' bar ', sort: 'name-desc', tags: ['NEW', 'BESTSELLER'], brands: ['zyn', 'raw'], variants: true }))
      .toBe('?q=bar&sort=name-desc&tags=bestseller,new&brand=raw,zyn&variants=1');
    expect(categoryQueryString({ q: '', sort: 'featured', tags: [], brands: [], variants: false })).toBe('');
    expect(categoryQueryString({ q: 'a&b c', sort: 'featured', tags: [], variants: false })).toBe('?q=a%26b+c');
    // The keys keep their order whatever order the object has.
    expect(categoryQueryString({ variants: true, brands: ['kite'], tags: ['DEAL'], sort: 'brand', q: 'x' }))
      .toBe('?q=x&sort=brand&tags=deal&brand=kite&variants=1');
  });

  it('round-trips', () => {
    const query = { q: 'mint gum', sort: 'variants', tags: ['DEAL'], brands: [], variants: false };
    expect(parseCategoryQuery(categoryQueryString(query))).toEqual(query);
    const branded = { q: '', sort: 'brand', tags: [], brands: ['4ks', 'swisher-sweets'], variants: true };
    expect(categoryQueryString(branded)).toBe('?sort=brand&brand=4ks,swisher-sweets&variants=1');
    expect(parseCategoryQuery(categoryQueryString(branded))).toEqual(branded);
  });

  it('reads brand slugs (AW-067): valid, deduplicated, in name order, at most 30', () => {
    const brands = (search) => parseCategoryQuery(search).brands;
    expect(brands('?brand=swisher-sweets,raw,RAW,raw')).toEqual(['raw', 'swisher-sweets']);
    // Anything that is not a plain slug is dropped: spaces, punctuation, outer
    // or doubled hyphens, script, and slugs over 60 characters.
    expect(brands(`?brand=${encodeURIComponent('Swisher Sweets,4K\'s,-raw,raw-,a--b,<script>,,zyn,' + 'x'.repeat(61) + ',' + 'y'.repeat(60))}`))
      .toEqual(['y'.repeat(60), 'zyn']);
    const many = Array.from({ length: 40 }, (_, i) => `b${String(i).padStart(2, '0')}`);
    expect(brands(`?brand=${many.join(',')}`)).toEqual(many.slice(0, 30));
    expect(brands('?brand=')).toEqual([]);
    expect(brands('?brands=raw')).toEqual([]);
    // Writing applies the same rules, so a URL never carries what reading drops.
    expect(categoryQueryString({ brands: ['raw', 'raw', 'Bad Slug', 'zyn'] })).toBe('?brand=raw,zyn');
    expect(categoryQueryString({ brands: many }).split(',')).toHaveLength(30);
  });

  it('offers Brand: A to Z as a sort, never the default', () => {
    expect(SORTS).toContain('brand');
    expect(SORTS[0]).toBe('featured');
    expect(parseCategoryQuery('?sort=brand').sort).toBe('brand');
    expect(EMPTY_CATEGORY_QUERY).toEqual({ q: '', sort: 'featured', tags: [], brands: [], variants: false });
    expect(Object.isFrozen(EMPTY_CATEGORY_QUERY)).toBe(true);
  });
});

describe('resolveRoute (AW-188)', () => {
  it('matches departments and lines in any spelling', () => {
    for (const url of ['/category/tobacco', '/category/TOBACCO', '/category/Tobacco']) {
      expect(resolve(url)).toMatchObject({ page: 'category', category: 'TOBACCO', sub: null });
    }
    expect(resolve('/category/DRINKS%20%26%20BAGS/Energy%20Drinks')).toMatchObject({ category: 'DRINKS & BAGS', sub: 'Energy Drinks' });
    expect(resolve('/category/drinks-and-bags/energy-drinks')).toMatchObject({ category: 'DRINKS & BAGS', sub: 'Energy Drinks' });
    expect(resolve('/category/tobacco/cigarettes')).toMatchObject({ category: 'TOBACCO', sub: 'Cigarettes' });
  });

  it('keeps the filters of a department page', () => {
    expect(resolve('/category/candies?q=bar&tags=new').query).toEqual({ q: 'bar', sort: 'featured', tags: ['NEW'], brands: [], variants: false });
    expect(resolve('/category/tobacco/wraps-and-leafs?brand=swisher-sweets').query).toEqual({ q: '', sort: 'featured', tags: [], brands: ['swisher-sweets'], variants: false });
  });

  it('never invents departments, lines or products', () => {
    expect(resolve('/category/nope')).toEqual({ page: 'not-found', kind: 'department' });
    expect(resolve('/category/tobacco/nonexistent-line')).toEqual({ page: 'not-found', kind: 'line', category: 'TOBACCO' });
    expect(resolve('/product/99999')).toEqual({ page: 'not-found', kind: 'product' });
    for (const id of ['0', 'abc', '-1', '1.5', '1abc', ' ', '1e2', '0x10']) {
      expect(resolve(`/product/${encodeURIComponent(id)}`)).toEqual({ page: 'not-found', kind: 'product', malformed: true });
    }
  });

  it('marks addresses that no catalog could match as malformed (AW-188, AW-204)', () => {
    // These never wait for the live catalog: they are not found at once.
    expect(resolve('/product')).toEqual({ page: 'not-found', kind: 'product', malformed: true });
    expect(resolve('/category')).toEqual({ page: 'not-found', kind: 'department', malformed: true });
    expect(resolve('/category/%20')).toEqual({ page: 'not-found', kind: 'department', malformed: true });
    expect(resolve('/category/tobacco/---')).toEqual({ page: 'not-found', kind: 'line', category: 'TOBACCO', malformed: true });
    expect(resolve('/nowhere')).toEqual({ page: 'not-found', kind: 'page' });
    expect(resolve('/product/1/2')).toEqual({ page: 'not-found', kind: 'page' });
  });

  it('reads product ids as numbers, so /product/01 is product 1', () => {
    expect(resolve('/product/12')).toEqual({ page: 'product', productId: 12 });
    expect(resolve('/product/01')).toEqual({ page: 'product', productId: 1 });
  });
});

describe('canonical addresses', () => {
  it('redirect targets: every other spelling has one canonical path', () => {
    expect(pathFor(resolve('/category/TOBACCO'))).toBe('/category/tobacco');
    expect(pathFor(resolve('/category/DRINKS%20%26%20BAGS/Bags%20%26%20Carriers'))).toBe('/category/drinks-and-bags/bags-and-carriers');
    expect(pathFor(resolve('/product/01'))).toBe('/product/1');
    expect(pathFor(resolve('/Account'))).toBe('/account');
    expect(pathFor(resolve('/index.html'))).toBe('/');
    expect(pathFor(resolve('/nowhere'))).toBeNull();
  });

  it('hrefFor builds links that resolve back to the same route', () => {
    const routes = [
      { page: 'home' },
      { page: 'product', productId: 162 },
      { page: 'category', category: 'DRINKS & BAGS', sub: null, query: { q: '', sort: 'featured', tags: [], brands: [], variants: false } },
      { page: 'category', category: 'TOBACCO', sub: 'Cigars & Cigarillos', query: { q: 'swisher', sort: 'name-asc', tags: ['NEW'], brands: [], variants: true } },
      { page: 'category', category: 'TOBACCO', sub: 'Wraps & Leafs', query: { q: '', sort: 'brand', tags: [], brands: ['game', 'swisher-sweets'], variants: false } },
      { page: 'quote' }, { page: 'account' }, { page: 'admin' }, { page: 'catalog' }, { page: 'terms' }, { page: 'reset-password' },
    ];
    for (const route of routes) expect(resolve(hrefFor(route))).toEqual(route);
    expect(hrefFor({ page: 'category', category: 'TOBACCO' })).toBe('/category/tobacco');
    expect(hrefFor({ page: 'search', q: 'kite 3mg' })).toBe('/search?q=kite+3mg');
  });

  it('routeKey tells pages apart, including not-found kinds', () => {
    expect(routeKey({ page: 'product', productId: 3 })).toBe('/product/3');
    expect(routeKey({ page: 'not-found', kind: 'line', category: 'TOBACCO' })).toBe('not-found:line:TOBACCO');
  });

  it('pageKeyFor ignores the product line, filters and id spelling', () => {
    expect(pageKeyFor({ pathname: '/category/TOBACCO/cigarettes', search: '?q=x' })).toBe(pageKeyFor({ pathname: '/category/tobacco' }));
    expect(pageKeyFor({ pathname: '/category/tobacco', search: '?brand=raw&sort=brand' })).toBe(pageKeyFor({ pathname: '/category/tobacco' }));
    expect(pageKeyFor({ pathname: '/product/01' })).toBe(pageKeyFor({ pathname: '/product/1' }));
    expect(pageKeyFor({ pathname: '/product/1' })).not.toBe(pageKeyFor({ pathname: '/product/2' }));
    expect(pageKeyFor({ pathname: '/' })).toBe('home');
  });

  it('pageKeyFor makes each search query a page of its own (AW-007)', () => {
    expect(pageKeyFor({ pathname: '/search', search: '?q=cigar' })).toBe('search:cigar');
    expect(pageKeyFor({ pathname: '/search', search: '?q=+Cigar+' })).toBe(pageKeyFor({ pathname: '/search', search: '?q=cigar' }));
    expect(pageKeyFor({ pathname: '/search', search: '?q=cigar' })).not.toBe(pageKeyFor({ pathname: '/search', search: '?q=candy' }));
    expect(pageKeyFor({ pathname: '/search' })).toBe('search:');
  });
});

describe('legacy hash links', () => {
  it('maps old #/ routes to their path', () => {
    expect(legacyHashTarget('#/')).toBe('/');
    expect(legacyHashTarget('#/product/12')).toBe('/product/12');
    expect(legacyHashTarget('#/category/DRINKS%20%26%20BAGS/Energy%20Drinks')).toBe('/category/DRINKS%20%26%20BAGS/Energy%20Drinks');
    expect(legacyHashTarget('#!/quote')).toBe('/quote');
    expect(legacyHashTarget('#//evil.example/x')).toBe('/evil.example/x');
  });

  it('keeps a Supabase fragment that follows the route', () => {
    expect(legacyHashTarget('#/reset-password#access_token=abc&type=recovery')).toBe('/reset-password#access_token=abc&type=recovery');
  });

  it('leaves auth fragments and anchors alone', () => {
    for (const hash of ['', '#', '#access_token=abc&refresh_token=def&type=recovery', '#error=access_denied&error_code=otp_expired', '#type=recovery', '#new-arrivals']) {
      expect(legacyHashTarget(hash)).toBeNull();
    }
  });
});

describe('siteUrl', () => {
  it('normalises the configured origin and falls back to the default', () => {
    expect(siteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(siteUrl('')).toBe(DEFAULT_SITE_URL);
    expect(siteUrl('https://www.example.com/')).toBe('https://www.example.com');
    expect(siteUrl('not a url')).toBe(DEFAULT_SITE_URL);
    expect(siteUrl('ftp://example.com')).toBe(DEFAULT_SITE_URL);
  });
});
