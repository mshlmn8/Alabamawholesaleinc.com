// @vitest-environment node
// The page files the build writes for crawlers and link previews (AW-181):
// index.html with each page's own head tags, for every sitemap path.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../src/data/products.js';
import { departmentsFor } from '../src/lib/departments.js';
import { absoluteUrl, headTags, pageMeta, SITE_URL } from '../src/lib/meta.js';
import { parseUrl, resolveRoute } from '../src/lib/routes.js';
import { renderHead, routeFile, routePages } from './build-route-heads.mjs';
import { sitemapPaths } from './build-sitemap.mjs';
import { inlineScriptHashes } from './netlify-headers.mjs';

// Vitest runs from the repository root.
const shell = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const departments = departmentsFor(PRODUCTS);
const catalog = { products: PRODUCTS, departments };

const headOf = (html) => html.slice(0, html.indexOf('</head>'));
const bodyOf = (html) => html.slice(html.indexOf('</head>'));
const attr = (html, selector) => {
  const [kind, key] = selector.split('=');
  const m = new RegExp(`<meta ${kind}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" content="([^"]*)" />`, 'g');
  return [...headOf(html).matchAll(m)].map((x) => x[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
};
const pageFor = (pathname) => {
  const route = resolveRoute(parseUrl({ pathname }), catalog);
  const meta = pageMeta(route, PRODUCTS, departments);
  return { meta, html: renderHead(shell, headTags(meta, { imageBase: SITE_URL })) };
};

describe('routeFile', () => {
  it('names the file Netlify and `vite preview` serve for a page path, with no redirect', () => {
    expect(routeFile('/product/61')).toBe('product/61.html');
    expect(routeFile('/category/tobacco')).toBe('category/tobacco.html');
    expect(routeFile('/category/drinks-and-bags/energy-drinks')).toBe('category/drinks-and-bags/energy-drinks.html');
    expect(routeFile('/contact')).toBe('contact.html');
    expect(routeFile('/')).toBeNull();
  });

  it('refuses anything but lower-case slug paths', () => {
    for (const bad of ['/product/61/', '/Product/61', '/../etc/passwd', '/category/a b', '/x.html', '/category//x', '']) {
      expect(() => routeFile(bad)).toThrow(/not a page path/);
    }
  });
});

describe('renderHead', () => {
  it('writes a product page’s own title, description, canonical, share tags, image and trail', () => {
    const { meta, html } = pageFor('/product/61');
    const p = PRODUCTS.find((x) => Number(x.id) === 61);
    expect(html).toContain(`<title>${meta.title.replace(/&/g, '&amp;')}</title>`);
    expect(meta.title).toContain(p.name);
    for (const key of ['property=og:title', 'name=twitter:title']) expect(attr(html, key)).toEqual([meta.title]);
    for (const key of ['name=description', 'property=og:description', 'name=twitter:description']) expect(attr(html, key)).toEqual([meta.description]);
    expect(attr(html, 'property=og:url')).toEqual([`${SITE_URL}/product/61`]);
    expect(headOf(html).match(/<link rel="canonical" href="([^"]*)" \/>/g)).toEqual([`<link rel="canonical" href="${SITE_URL}/product/61" />`]);
    expect(attr(html, 'property=og:image')).toEqual([absoluteUrl(meta.image.url, SITE_URL)]);
    expect(attr(html, 'name=twitter:image')).toEqual([absoluteUrl(meta.image.url, SITE_URL)]);
    expect(attr(html, 'property=og:image:type')).toEqual([]);
    expect(attr(html, 'property=og:image:alt')).toEqual([p.name]);
    expect(attr(html, 'name=robots')).toEqual([]);
    const crumbs = /<script type="application\/ld\+json" id="aw-breadcrumbs">([^<]*)<\/script>/.exec(headOf(html));
    expect(JSON.parse(crumbs[1]).itemListElement.map((i) => i.item)).toEqual(meta.breadcrumbs.map((c) => `${SITE_URL}${c.path}`));
  });

  it('changes nothing but those tags: the boot script, structured data and body stay as they are', () => {
    const { html } = pageFor('/category/tobacco/cigarettes');
    expect(inlineScriptHashes(html)).toEqual(inlineScriptHashes(shell));
    expect(bodyOf(html)).toBe(bodyOf(shell));
    expect(html).toContain(headOf(shell).slice(headOf(shell).indexOf('<!-- Boot shell'), headOf(shell).indexOf('</style>')));
    expect(html).toContain('"@type": "WholesaleStore"');
    // Every tag once.
    for (const key of ['name=description', 'property=og:url', 'property=og:title', 'property=og:image', 'name=twitter:title', 'name=twitter:description', 'name=twitter:image', 'property=og:site_name', 'name=twitter:card']) {
      expect([key, attr(html, key).length]).toEqual([key, 1]);
    }
  });

  it('keeps the logo share card on a page without a photo, and adds robots only to noindex pages', () => {
    const { html } = pageFor('/contact');
    expect(attr(html, 'property=og:image')).toEqual([`${SITE_URL}/og.jpg`]);
    expect(attr(html, 'property=og:image:type')).toEqual(['image/jpeg']);
    expect(html).not.toContain('id="aw-breadcrumbs"');
    const noindex = renderHead(shell, headTags({ title: 'Checkout', description: 'D', noindex: true }));
    expect(attr(noindex, 'name=robots')).toEqual(['noindex']);
    expect(noindex).not.toContain('rel="canonical"');
  });

  it('escapes what it writes, and takes a $ in a name as it is', () => {
    const html = renderHead(shell, headTags({ title: 'A "$&" <b> & co', description: 'Say "hi" <i>', path: '/product/1', breadcrumbs: [{ name: '</script><x>', path: '/product/1' }] }));
    expect(html).toContain('<title>A "$&amp;" &lt;b&gt; &amp; co</title>');
    expect(attr(html, 'property=og:title')).toEqual(['A "$&" <b> & co']);
    expect(headOf(html)).toContain('content="Say &quot;hi&quot; &lt;i&gt;"');
    expect(headOf(html)).not.toContain('</script><x>');
    expect(inlineScriptHashes(html)).toEqual(inlineScriptHashes(shell));
  });

  it('refuses an index.html it can’t rewrite safely', () => {
    const tags = headTags({ title: 'T', description: 'D', path: '/contact' });
    expect(() => renderHead(shell.replace('<meta property="og:title" content=', '<meta content="x" property="og:title" data-x='), tags)).toThrow(/form this script/);
    expect(() => renderHead(shell.replace('</title>', '</title><title>x</title>'), tags)).toThrow(/one <title>/);
    expect(() => renderHead(shell.replace('</head>', ''), tags)).toThrow(/no <\/head>/);
  });
});

describe('routePages', () => {
  const pages = routePages({ shell, products: PRODUCTS, departments, parseUrl, resolveRoute, pageMeta, headTags, siteUrl: SITE_URL });

  it('writes one file for every sitemap path but the home page', () => {
    const paths = sitemapPaths({ departments, products: PRODUCTS });
    expect(pages.map((p) => p.path)).toEqual(paths.filter((p) => p !== '/'));
    expect(new Set(pages.map((p) => p.file)).size).toBe(pages.length);
    expect(pages.find((p) => p.path === '/category/tobacco').file).toBe('category/tobacco.html');
  });

  it('gives every page its own title and canonical link', () => {
    const titles = new Set();
    for (const page of pages) {
      const title = /<title>([^<]*)<\/title>/.exec(page.html)[1];
      titles.add(title);
      expect([page.path, attr(page.html, 'property=og:url')]).toEqual([page.path, [`${SITE_URL}${page.path}`]]);
    }
    // Two products may share a name; nearly every page has a title of its own.
    expect(titles.size).toBeGreaterThan(pages.length * 0.95);
  });

  it('refuses a sitemap path the app would answer as not found', () => {
    const lying = (...args) => ({ ...resolveRoute(...args), page: 'not-found' });
    expect(() => routePages({ shell, products: PRODUCTS, departments, parseUrl, resolveRoute: lying, pageMeta, headTags, siteUrl: SITE_URL })).toThrow(/answers as not found/);
  });
});
