#!/usr/bin/env node
// Writes dist/sitemap.xml after `vite build` (AW-317): every indexable path
// URL from the catalog — home, all products, each department and product
// line, each product, and the support pages. Checkout, account, admin, the
// password reset page and search results are left out (they are noindex).
//
// The catalog is the live products table when the build can read it, else
// the bundled src/data/products.js with a warning (scripts/catalog-source.mjs,
// NEW-087), so a product staff add in Admin is listed and one they
// deactivate is not, as of the build. What it loaded is kept for
// scripts/build-route-heads.mjs, which writes a page file for each of these
// paths (AW-181).
//
// URLs come from src/lib/routes.js, the same code the app's links use, on the
// one SITE_URL (VITE_SITE_URL, else the production domain). A product's
// <lastmod> is the date it was last saved (updated_at); every other page's,
// and a product's without one, is the date of the last commit, or today
// outside a git checkout.
//
// It also writes dist/robots.txt, whose Sitemap line names the same origin
// (AW-052); public/robots.txt is the production origin's copy for the dev
// server.

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hrefFor, siteUrl } from '../src/lib/routes.js';
import { loadAppModules, loadCatalogSource, productDate, writeSnapshot } from './catalog-source.mjs';
import { robotsTxt } from './site-url.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Pages without parameters that belong in search results.
export const SITEMAP_PAGES = ['home', 'catalog', 'contact', 'delivery', 'shipping', 'privacy', 'terms', 'apply'];

// Active products with a positive whole-number id, each once, by id.
const listedProducts = (products) => {
  const byId = new Map();
  for (const p of products) {
    const id = Number(p.id);
    // Deactivated products render "not found", so they stay out.
    if (p.active === false || !Number.isInteger(id) || id < 1 || byId.has(id)) continue;
    byId.set(id, p);
  }
  return [...byId].sort(([a], [b]) => a - b);
};

// Every indexable page as { path, lastmod }, in a stable order.
// `departments` is departmentsFor() output: [{ key, subs }]. A product's
// lastmod is its updated_at date, else `lastmod`.
export function sitemapEntries({ departments, products, lastmod = null }) {
  const entries = SITEMAP_PAGES.map((page) => ({ path: hrefFor({ page }), lastmod }));
  for (const d of departments) {
    entries.push({ path: hrefFor({ page: 'category', category: d.key, sub: null }), lastmod });
    for (const sub of d.subs) entries.push({ path: hrefFor({ page: 'category', category: d.key, sub }), lastmod });
  }
  for (const [id, p] of listedProducts(products)) {
    entries.push({ path: hrefFor({ page: 'product', productId: id }), lastmod: productDate(p.updated_at) || lastmod });
  }
  return entries;
}

// Every indexable path, in a stable order.
export const sitemapPaths = (catalog) => sitemapEntries(catalog).map((e) => e.path);

const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// `entries` as [{ path, lastmod }], or `paths` that all share `lastmod`.
export function sitemapXml({ base, entries, paths = [], lastmod = null }) {
  const list = entries || paths.map((p) => ({ path: p, lastmod }));
  const urls = list.map((e) => `  <url><loc>${xmlEscape(base + e.path)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`);
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, '</urlset>', ''].join('\n');
}

function lastCommitDate() {
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch { /* not a git checkout */ }
  return new Date().toISOString().slice(0, 10);
}

/**
 * The build's catalog rows: the live ones, or the bundled PRODUCTS.
 * @param {{ source: string, rows?: object[] }} source from loadCatalogSource()
 * @param {object[]} bundled src/data/products.js PRODUCTS
 */
export const catalogRows = (source, bundled) => (source.source === 'live' ? source.rows : bundled);

async function main() {
  const { loadEnv } = await import('vite');
  const env = loadEnv('production', ROOT, '');
  const base = siteUrl(env.VITE_SITE_URL);
  const source = await loadCatalogSource({ env });
  const [{ PRODUCTS }, { departmentsFor }] = await loadAppModules(ROOT, ['/src/data/products.js', '/src/lib/departments.js']);
  const products = catalogRows(source, PRODUCTS);
  const entries = sitemapEntries({ departments: departmentsFor(products), products, lastmod: lastCommitDate() });
  const out = path.join(ROOT, 'dist', 'sitemap.xml');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, sitemapXml({ base, entries }));
  await fs.writeFile(path.join(ROOT, 'dist', 'robots.txt'), robotsTxt(base));
  await writeSnapshot(ROOT, source);
  const what = source.source === 'live' ? `the live catalog (${source.rows.length} active products)` : 'the bundled catalog';
  console.log(`build-sitemap: wrote ${entries.length} URLs from ${what} on ${base} to ${path.relative(ROOT, out)}, and robots.txt`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
