#!/usr/bin/env node
// Writes dist/sitemap.xml after `vite build` (AW-317): every indexable path
// URL from the catalog — home, all products, each department and product
// line, each product, and the support pages. Checkout, account, admin, the
// password reset page and search results are left out (they are noindex).
//
// URLs come from src/lib/routes.js, the same code the app's links use, on the
// one SITE_URL (VITE_SITE_URL, else the production domain). <lastmod> is the
// date of the last commit, or today outside a git checkout.
//
// products.js resolves photos through Vite-only import.meta.glob, so the
// catalog is loaded through Vite's SSR module loader (as in build-seed.mjs).

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hrefFor, siteUrl } from '../src/lib/routes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Pages without parameters that belong in search results.
export const SITEMAP_PAGES = ['home', 'catalog', 'contact', 'delivery', 'shipping', 'privacy', 'terms', 'apply'];

// Every indexable path, in a stable order. `departments` is departmentsFor()
// output: [{ key, subs }].
export function sitemapPaths({ departments, products }) {
  const paths = SITEMAP_PAGES.map((page) => hrefFor({ page }));
  for (const d of departments) {
    paths.push(hrefFor({ page: 'category', category: d.key, sub: null }));
    for (const sub of d.subs) paths.push(hrefFor({ page: 'category', category: d.key, sub }));
  }
  // Deactivated products render "not found", so they stay out.
  const ids = products.filter((p) => p.active !== false)
    .map((p) => Number(p.id)).filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);
  for (const id of new Set(ids)) paths.push(hrefFor({ page: 'product', productId: id }));
  return paths;
}

const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function sitemapXml({ base, paths, lastmod }) {
  const urls = paths.map((p) => `  <url><loc>${xmlEscape(base + p)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`);
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, '</urlset>', ''].join('\n');
}

function lastCommitDate() {
  try {
    const date = execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  } catch { /* not a git checkout */ }
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const { createServer, loadEnv } = await import('vite');
  const env = loadEnv('production', ROOT, '');
  const base = siteUrl(env.VITE_SITE_URL);
  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.js'),
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    // Only two plain modules are loaded: no dependency scan, which otherwise
    // races the close below and prints a page of 'Request is outdated' errors.
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  let departments;
  let products;
  try {
    ({ PRODUCTS: products } = await server.ssrLoadModule('/src/data/products.js'));
    const { departmentsFor } = await server.ssrLoadModule('/src/lib/departments.js');
    departments = departmentsFor(products);
  } finally {
    await server.close();
  }
  const paths = sitemapPaths({ departments, products });
  const out = path.join(ROOT, 'dist', 'sitemap.xml');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, sitemapXml({ base, paths, lastmod: lastCommitDate() }));
  console.log(`build-sitemap: wrote ${paths.length} URLs on ${base} to ${path.relative(ROOT, out)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
