#!/usr/bin/env node
// Writes a page file for every path in the sitemap but the home page
// (AW-181), after scripts/build-sitemap.mjs: dist/product/61.html,
// dist/category/tobacco.html, dist/category/tobacco/cigarettes.html,
// dist/contact.html and so on. Each is dist/index.html with that page's own
// head tags in place of the home page's: <title>, the description, the
// canonical link, og:url, og:title, og:description, og:image (with its type,
// size and alt), the twitter:* tags and, on catalog pages, the BreadcrumbList
// (AW-320). Crawlers and link previews (Facebook, iMessage, WhatsApp, Slack,
// LinkedIn) run no script, so this is the only head they ever see; in the
// browser the app starts as from index.html and keeps the tags up to date.
// Nothing else in the file changes, so the boot script and its CSP hash are
// the same in every one (scripts/check-headers.mjs checks).
//
// The tags come from pageMeta() and headTags() in src/lib/meta.js, the code
// the app runs, loaded through Vite's SSR loader, for the catalog the
// sitemap step used (scripts/catalog-source.mjs: the live products table, or
// the bundled one with a warning). A product saved in Admin after the build
// has no file until the next deploy (NETLIFY-DEPLOY.md, "Pages and the
// catalog").
//
// File names: Netlify serves /product/61 from product/61.html without a
// redirect, but would redirect it to /product/61/ from
// product/61/index.html, and the site's paths have no trailing slash;
// `vite preview` also serves <path>.html for <path>.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { catalogRows, sitemapPaths } from './build-sitemap.mjs';
import { loadAppModules, loadCatalogSource, readSnapshot } from './catalog-source.mjs';
import { inlineScriptHashes } from './netlify-headers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A path the build writes a file for: lower-case slug segments.
const PAGE_PATH = /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

/**
 * The file in dist that answers a page path: '/product/61' ->
 * 'product/61.html'. The home page is index.html itself (null).
 * @param {string} pathname
 */
export function routeFile(pathname) {
  if (pathname === '/') return null;
  if (!PAGE_PATH.test(pathname)) throw new Error(`build-route-heads: ${pathname} is not a page path a file can stand for`);
  return `${pathname.slice(1)}.html`;
}

const textEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attrEscape = (s) => textEscape(s).replace(/"/g, '&quot;');
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * index.html with a page's head tags (headTags() in src/lib/meta.js) in
 * place of the home page's. A tag index.html has is rewritten where it is,
 * or removed when the page has none; a tag it lacks (the canonical link,
 * og:url, robots) goes after the description; the BreadcrumbList goes last
 * in the head. Throws if the inline scripts would change.
 * @param {string} html dist/index.html
 * @param {{ title: string, canonical: string | null, meta: [string, string, string | null][], breadcrumbs: string | null }} tags
 */
export function renderHead(html, tags) {
  const end = html.indexOf('</head>');
  if (end < 0) throw new Error('build-route-heads: index.html has no </head>');
  let head = html.slice(0, end);
  const rest = html.slice(end);
  const titles = head.match(/<title>[^<]*<\/title>/g) || [];
  if (titles.length !== 1) throw new Error('build-route-heads: index.html must have one <title>');
  // A function replacement, so a '$' in a name is written as it is.
  head = head.replace(/<title>[^<]*<\/title>/, () => `<title>${textEscape(tags.title)}</title>`);

  const added = [];
  if (tags.canonical) added.push(`<link rel="canonical" href="${attrEscape(tags.canonical)}" />`);
  if (/<link rel="canonical"/.test(head)) throw new Error('build-route-heads: index.html must not have a canonical link');
  for (const [attr, key, content] of tags.meta) {
    const line = new RegExp(`[ \\t]*<meta ${attr}="${reEscape(key)}" content="[^"]*" />\\n`, 'g');
    const found = head.match(line) || [];
    if ((head.match(new RegExp(`<meta\\b[^>]*\\s${attr}="${reEscape(key)}"`, 'g')) || []).length !== found.length) {
      throw new Error(`build-route-heads: index.html writes ${key} in a form this script doesn't read`);
    }
    if (found.length > 1) throw new Error(`build-route-heads: index.html has ${key} twice`);
    const tag = `<meta ${attr}="${key}" content="${attrEscape(content)}" />`;
    if (found.length) head = head.replace(line, (match) => (content == null ? '' : `${/^[ \t]*/.exec(match)[0]}${tag}\n`));
    else if (content != null) added.push(tag);
  }
  if (added.length) {
    const description = /([ \t]*)<meta name="description" content="[^"]*" \/>\n/.exec(head);
    if (!description) throw new Error('build-route-heads: index.html has no description meta tag');
    const at = description.index + description[0].length;
    head = head.slice(0, at) + added.map((tag) => `${description[1]}${tag}\n`).join('') + head.slice(at);
  }
  if (tags.breadcrumbs) {
    head = head.replace(/([ \t]*)$/, (indent) => `    <script type="application/ld+json" id="aw-breadcrumbs">${tags.breadcrumbs}</script>\n${indent}`);
  }
  const out = head + rest;
  if (inlineScriptHashes(out).join() !== inlineScriptHashes(html).join()) throw new Error('build-route-heads: a page file would change an inline script');
  return out;
}

/**
 * The page files for a catalog: [{ path, file, html }] for every sitemap
 * path but the home page.
 * @param {{ shell: string, products: object[], departments: object[], parseUrl: Function, resolveRoute: Function, pageMeta: Function, headTags: Function, siteUrl: string }} options
 */
export function routePages({ shell, products, departments, parseUrl, resolveRoute, pageMeta, headTags, siteUrl }) {
  const pages = [];
  for (const pathname of sitemapPaths({ departments, products })) {
    const file = routeFile(pathname);
    if (!file) continue;
    const route = resolveRoute(parseUrl({ pathname }), { departments, products });
    if (route.page === 'not-found') throw new Error(`build-route-heads: the sitemap lists ${pathname}, which the app answers as not found`);
    const meta = pageMeta(route, products, departments);
    pages.push({ path: pathname, file, html: renderHead(shell, headTags(meta, { imageBase: siteUrl })) });
  }
  return pages;
}

async function main() {
  const { loadEnv } = await import('vite');
  const dist = path.join(ROOT, 'dist');
  const shell = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  let source = await readSnapshot(ROOT);
  if (!source) {
    console.warn('build-route-heads: no catalog from this build\'s sitemap step (run scripts/build-sitemap.mjs first); loading it again.');
    source = await loadCatalogSource({ env: loadEnv('production', ROOT, '') });
  }
  const [{ PRODUCTS }, { departmentsFor }, { parseUrl, resolveRoute }, { pageMeta, headTags, SITE_URL }, { hydrateProducts }] = await loadAppModules(ROOT, [
    '/src/data/products.js', '/src/lib/departments.js', '/src/lib/routes.js', '/src/lib/meta.js', '/src/lib/catalogRows.js',
  ]);
  // The products as the app shows them: live rows in the storefront's shape.
  const products = source.source === 'live' ? hydrateProducts(catalogRows(source, PRODUCTS)) : PRODUCTS;
  const pages = routePages({ shell, products, departments: departmentsFor(products), parseUrl, resolveRoute, pageMeta, headTags, siteUrl: SITE_URL });
  for (const page of pages) {
    const out = path.join(dist, page.file);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, page.html);
  }
  console.log(`build-route-heads: wrote ${pages.length} page files with their own head tags, from the ${source.source} catalog, on ${SITE_URL}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
