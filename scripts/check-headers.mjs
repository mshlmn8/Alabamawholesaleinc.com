#!/usr/bin/env node
// Runs after `vite build`, the sitemap and the page files (AW-205, AW-181):
// fails the build when the Content-Security-Policy in netlify.toml would
// block an inline script in dist/index.html or in any page file
// scripts/build-route-heads.mjs wrote, or has lost its protections
// (cspProblems in netlify-headers.mjs), or when a path in dist/sitemap.xml
// has no page file (Netlify would answer it with a 404: netlify.toml has no
// rewrite for /product/* and /category/*, NEW-088). Vite copies classic
// inline scripts verbatim, so this catches an edit to the index.html boot
// script whose hash was not updated, and prints the hash to use.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeFile } from './build-route-heads.mjs';
import { cspProblems, inlineScriptHashes, readNetlifyHeaders } from './netlify-headers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

// Every .html file under dist but the static 404 page (no script) and the
// asset folders.
function pageFiles(dir = DIST) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dir === DIST && ['assets', 'img'].includes(entry.name)) continue;
      files.push(...pageFiles(full));
    } else if (entry.name.endsWith('.html') && full !== path.join(DIST, '404.html')) {
      files.push(full);
    }
  }
  return files;
}

try {
  const rules = readNetlifyHeaders(readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8'));
  const csp = rules.find((r) => r.for === '/*')?.values['Content-Security-Policy'];
  const index = path.join(DIST, 'index.html');
  const hashes = inlineScriptHashes(readFileSync(index, 'utf8'));
  const problems = cspProblems(csp, hashes).map((p) => `dist/index.html: ${p}`);
  const files = pageFiles();
  for (const file of files) {
    if (file === index) continue;
    const own = inlineScriptHashes(readFileSync(file, 'utf8'));
    for (const p of cspProblems(csp, own)) problems.push(`${path.relative(ROOT, file)}: ${p}`);
  }
  // Every sitemap URL is a page with its own file (the home page is index.html).
  const sitemap = readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => new URL(m[1].replace(/&amp;/g, '&')).pathname);
  // The first URL is the home page: any path in front of it is VITE_SITE_URL's.
  const basePath = (locs[0] || '/').replace(/\/$/, '');
  for (const loc of locs) {
    const pathname = loc.slice(basePath.length) || '/';
    const file = routeFile(pathname);
    if (file && !existsSync(path.join(DIST, file))) problems.push(`dist/sitemap.xml lists ${pathname}, but dist/${file} is missing: Netlify would answer it with a 404`);
  }
  if (problems.length) {
    console.error('check-headers: the build does not fit netlify.toml:');
    for (const p of problems) console.error(`  - ${p}`);
    console.error(`Inline scripts in dist/index.html: ${hashes.map((h) => `'${h}'`).join(' ') || 'none'}`);
    process.exit(1);
  }
  console.log(`check-headers: the CSP allows the ${hashes.length} inline script(s) of dist/index.html and of ${files.length - 1} page files by hash, and each of the ${locs.length} sitemap URLs has its page`);
} catch (err) {
  console.error(`check-headers: ${err.message}`);
  process.exit(1);
}
