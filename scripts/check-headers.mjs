#!/usr/bin/env node
// Runs after `vite build` (AW-205): fails the build when the
// Content-Security-Policy in netlify.toml would block an inline script in
// dist/index.html, or has lost its protections (cspProblems in
// netlify-headers.mjs). Vite copies classic inline scripts verbatim, so this
// catches an edit to the index.html boot script whose hash was not updated,
// and prints the hash to use.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cspProblems, inlineScriptHashes, readNetlifyHeaders } from './netlify-headers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const html = readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8');
  const rules = readNetlifyHeaders(readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8'));
  const csp = rules.find((r) => r.for === '/*')?.values['Content-Security-Policy'];
  const hashes = inlineScriptHashes(html);
  const problems = cspProblems(csp, hashes);
  if (problems.length) {
    console.error('check-headers: the Content-Security-Policy in netlify.toml does not fit dist/index.html:');
    for (const p of problems) console.error(`  - ${p}`);
    console.error(`Inline scripts in dist/index.html: ${hashes.map((h) => `'${h}'`).join(' ') || 'none'}`);
    process.exit(1);
  }
  console.log(`check-headers: the CSP allows the ${hashes.length} inline script(s) in dist/index.html by hash`);
} catch (err) {
  console.error(`check-headers: ${err.message}`);
  process.exit(1);
}
