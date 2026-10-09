// @vitest-environment node
// netlify.toml's [[redirects]] (NEW-088): every page path of the app is
// answered with index.html and status 200, and every other path with a real
// 404, so a mistyped or retired link shows as broken to crawlers and link
// checkers. A page path without its rewrite would be a 404 on Netlify, so
// these tests walk every page shape routes.js knows. The catalog's pages
// (/product/<id>, /category/<department>[/<line>]) are the files the build
// writes for them (scripts/build-route-heads.mjs, AW-181) and have no rule.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_SECTIONS } from '../src/lib/adminRoutes.js';
import { NOINDEX_PAGES, PATH_SECTIONS, SUPPORT_PAGES, hrefFor, parseUrl } from '../src/lib/routes.js';
import { SITEMAP_PAGES } from './build-sitemap.mjs';
import { routeFile } from './build-route-heads.mjs';
import { netlifyResponse, readNetlifyRedirects } from './netlify-headers.mjs';

// Vitest runs from the repository root.
const toml = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8');
const redirects = readNetlifyRedirects(toml);

// The deploy's files the rules see (public/ plus the built index.html).
const DEPLOY_FILES = new Set(['/index.html', '/404.html', '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/og.jpg']);
const answer = (pathname, files = DEPLOY_FILES) => netlifyResponse(pathname, { redirects, hasFile: (p) => files.has(p) });

const UUID = '0b6c7c1e-8f0a-4c51-9d3e-2a4f5b6c7d8e';
// Paths of each page shape that takes parameters. Every other section of
// PATH_SECTIONS is one page at /<section>.
const SHAPES = {
  product: ['/product/12', '/product/9001'],
  category: ['/category/tobacco', '/category/drinks-and-bags/energy-drinks'],
  search: ['/search'],
  admin: [
    '/admin', ...ADMIN_SECTIONS.map((s) => `/admin/${s}`),
    `/admin/accounts/${UUID}`, '/admin/products/12', '/admin/products/new', `/admin/orders/${UUID}/print`,
  ],
};
const shapesOf = (section) => SHAPES[section] || [`/${section}`];
// Sections whose pages are the build's page files, one per catalog entry.
const CATALOG_SECTIONS = ['product', 'category'];
const isCatalogPath = (path) => CATALOG_SECTIONS.some((section) => path.startsWith(`/${section}/`));
// The deploy's files plus a page file for each catalog path above.
const BUILT_FILES = new Set([...DEPLOY_FILES, ...CATALOG_SECTIONS.flatMap(shapesOf).map((p) => `/${routeFile(p)}`)]);
const PAGE_PATHS = [
  '/', '/index.html',
  ...PATH_SECTIONS.flatMap(shapesOf),
  ...SUPPORT_PAGES.map((page) => `/${page}`),
  ...SITEMAP_PAGES.map((page) => hrefFor({ page })),
  ...NOINDEX_PAGES.filter((page) => page !== 'not-found').map((page) => hrefFor({ page })),
];

describe('readNetlifyRedirects', () => {
  it('reads each [[redirects]] rule in order and ignores the other tables', () => {
    const text = [
      '[build]', '  command = "npm run build"', '',
      '[[redirects]]', '  from = "/assets/*"  # old code files', '  to = "/404.html"', '  status = 404', '',
      '[[headers]]', '  for = "/*"', '  [headers.values]', '    X-Frame-Options = "DENY"', '',
      '[[redirects]]', '  from = "/old"', '  to = "/new"', '  force = true',
    ].join('\n');
    expect(readNetlifyRedirects(text)).toEqual([
      { from: '/assets/*', to: '/404.html', status: 404, force: false },
      { from: '/old', to: '/new', status: 301, force: true },
    ]);
  });

  it('throws on a key or value it cannot read, instead of skipping the rule', () => {
    const rule = (...lines) => ['[[redirects]]', '  from = "/a"', '  to = "/b"', ...lines].join('\n');
    expect(() => readNetlifyRedirects(rule('  conditions = {Language = ["en"]}'))).toThrow(/only from, to, status and force/);
    expect(() => readNetlifyRedirects(rule('  status = "200"'))).toThrow(/status must be a number/);
    expect(() => readNetlifyRedirects(rule('  force = yes'))).toThrow(/true or false/);
    expect(() => readNetlifyRedirects('[[redirects]]\n  from = "/a"')).toThrow(/needs from/);
    expect(() => readNetlifyRedirects('[redirects]\n  from = "/a"')).toThrow(/unsupported/);
  });
});

describe('netlifyResponse', () => {
  const rules = [
    { from: '/assets/*', to: '/404.html', status: 404, force: false },
    { from: '/shop/*', to: '/index.html', status: 200, force: false },
    { from: '/moved', to: '/index.html', status: 200, force: true },
    { from: '/*', to: '/index.html', status: 404, force: false },
  ];
  const files = new Set(['/index.html', '/404.html', '/assets/app.js', '/shop/61.html', '/moved.html', '/blog/index.html']);
  const at = (p) => netlifyResponse(p, { redirects: rules, hasFile: (f) => files.has(f) });

  it('serves a file before a rule that isn’t forced, also as <path>.html or <path>/index.html', () => {
    expect(at('/assets/app.js')).toEqual({ status: 200, file: '/assets/app.js' });
    expect(at('/shop/61')).toEqual({ status: 200, file: '/shop/61.html' });
    expect(at('/blog')).toEqual({ status: 200, file: '/blog/index.html' });
    expect(at('/')).toEqual({ status: 200, file: '/index.html' });
  });

  it('applies the first matching rule, a forced one even over a file', () => {
    expect(at('/assets/old.js')).toEqual({ status: 404, to: '/404.html' });
    expect(at('/shop/99')).toEqual({ status: 200, to: '/index.html' });
    expect(at('/moved')).toEqual({ status: 200, to: '/index.html' });
    expect(at('/nowhere')).toEqual({ status: 404, to: '/index.html' });
  });

  it('matches /x/* on /x and below it only, with or without a trailing slash', () => {
    expect(at('/shop')).toEqual({ status: 200, to: '/index.html' });
    expect(at('/shop/')).toEqual({ status: 200, to: '/index.html' });
    expect(at('/shop/a/b/')).toEqual({ status: 200, to: '/index.html' });
    expect(at('/shopping')).toEqual({ status: 404, to: '/index.html' });
  });

  it('gives 404.html with status 404 when no file or rule answers', () => {
    expect(netlifyResponse('/x', { redirects: [] })).toEqual({ status: 404, to: '/404.html' });
  });
});

describe('netlify.toml page rewrites (NEW-088)', () => {
  it('lists every page shape the app answers (PATH_SECTIONS)', () => {
    for (const path of PAGE_PATHS) {
      const [pathname, search = ''] = path.split('?');
      expect([path, parseUrl({ pathname, search }).page]).not.toEqual([path, 'not-found']);
    }
  });

  it('answers every page path with index.html and status 200, with or without a trailing slash', () => {
    for (const path of PAGE_PATHS.filter((p) => !isCatalogPath(p))) {
      const pathname = path.split('?')[0];
      for (const p of new Set([pathname, pathname.endsWith('/') ? pathname : `${pathname}/`])) {
        const got = answer(p);
        expect([p, got.status, got.to || got.file]).toEqual([p, 200, '/index.html']);
      }
    }
  });

  it('answers a catalog page with its page file, and any other /product or /category path with a 404 (AW-181)', () => {
    for (const path of PAGE_PATHS.filter(isCatalogPath)) {
      expect([path, answer(path, BUILT_FILES)]).toEqual([path, { status: 200, file: `/${routeFile(path)}` }]);
      // A product or line the build didn't write (deactivated, mistyped, or
      // added in Admin since the last deploy).
      expect([path, answer(path)]).toEqual([path, { status: 404, to: '/index.html' }]);
    }
    for (const path of ['/product/99999', '/category/nope', '/category/tobacco/no-such-line', '/product/abc', '/product', '/category']) {
      expect([path, answer(path, BUILT_FILES)]).toEqual([path, { status: 404, to: '/index.html' }]);
    }
    expect(redirects.filter((r) => CATALOG_SECTIONS.some((section) => r.from.startsWith(`/${section}`)))).toEqual([]);
  });

  it('answers any other path with index.html and status 404, which the app shows as not found', () => {
    for (const path of ['/no-such-page', '/products/12', '/contact-us', '/catalogs', '/quote/extra', '/catalog/extra', '/apply/now', '/reset-password/x', '/searches']) {
      expect([path, answer(path)]).toEqual([path, { status: 404, to: '/index.html' }]);
      expect([path, parseUrl({ pathname: path }).page]).toEqual([path, 'not-found']);
    }
  });

  it('still serves the deploy’s own files, and 404s a missing code or photo file', () => {
    expect(answer('/robots.txt')).toEqual({ status: 200, file: '/robots.txt' });
    expect(answer('/sitemap.xml')).toEqual({ status: 200, file: '/sitemap.xml' });
    expect(answer('/assets/QuotePage-old.js')).toEqual({ status: 404, to: '/404.html' });
    expect(answer('/img/kite--640x582-old.webp')).toEqual({ status: 404, to: '/404.html' });
  });

  it('rewrites only page paths: each 200 rule is one of the app’s paths, to index.html, never forced', () => {
    const pageRules = redirects.filter((r) => r.status === 200);
    expect(pageRules.length).toBeGreaterThan(0);
    for (const r of pageRules) {
      expect([r.from, r.to, r.force]).toEqual([r.from, '/index.html', false]);
      const pathname = r.from.startsWith('/admin/') ? '/admin/orders' : r.from;
      expect([r.from, parseUrl({ pathname }).page]).not.toEqual([r.from, 'not-found']);
    }
    expect(new Set(redirects.map((r) => r.from)).size).toBe(redirects.length);
  });

  it('ends with the "/*" rule: index.html with status 404, not forced', () => {
    expect(redirects.at(-1)).toEqual({ from: '/*', to: '/index.html', status: 404, force: false });
    expect(redirects.filter((r) => r.from === '/*')).toHaveLength(1);
    expect(redirects.some((r) => r.force)).toBe(false);
  });
});
