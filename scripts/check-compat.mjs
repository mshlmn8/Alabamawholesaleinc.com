#!/usr/bin/env node
// Runs after `vite build` (NEW-019): the built JavaScript must run in the
// browsers vite.config.js build.target names (Safari 14, Chrome 87,
// Firefox 78, Edge 88). esbuild rewrites newer syntax for them, but not
// newer built-in functions, so a call to one of those would break the site
// there (Array.prototype.at stopped the sign-in dialog from opening,
// Object.hasOwn broke My account). ESLint refuses them in src/; this checks
// what was actually built, dependencies included.
//
// A hit in the site's own files fails the build. A hit in the React or
// Supabase file (vendor-*.js, supabase-*.js) is only reported: that code is
// not patched here, and a library may guard its own use.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// What a call looks like in minified code. Each is missing from at least one
// of the target browsers.
export const NEWER_CALLS = [
  'Object.hasOwn(', // Safari 15.4, Chrome 93, Firefox 92
  'structuredClone(', // Safari 15.4, Chrome 98, Firefox 94
  '.findLast(', // Safari 15.4, Chrome 97, Firefox 104
  '.findLastIndex(',
  'AbortSignal.timeout(', // Safari 16, Chrome 103, Firefox 100
  'AbortSignal.any(',
  '.toSorted(', // Safari 16, Chrome 110, Firefox 115
  '.toReversed(',
  '.toSpliced(',
  '.at(-', // Array.prototype.at: Safari 15.4, Chrome 92, Firefox 90
  'Object.groupBy(',
  'Promise.withResolvers(',
];

// Third-party files, by the names vite.config.js manualChunks gives them.
export const isLibraryFile = (file) => /^(vendor|supabase)-/.test(path.basename(file));

// [{ file, call, library }] for every newer call in `files` ({ name: code }).
export function compatProblems(files) {
  const problems = [];
  for (const [file, code] of Object.entries(files)) {
    for (const call of NEWER_CALLS) {
      if (code.includes(call)) problems.push({ file, call, library: isLibraryFile(file) });
    }
  }
  return problems;
}

function main() {
  const dir = path.join(ROOT, 'dist', 'assets');
  const files = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.js'))
    .map((f) => [f, readFileSync(path.join(dir, f), 'utf8')]));
  const problems = compatProblems(files);
  const own = problems.filter((p) => !p.library);
  for (const p of problems.filter((x) => x.library)) {
    console.warn(`check-compat: warning: ${p.file} calls ${p.call}…, which the build's target browsers lack (library code, not patched)`);
  }
  if (own.length) {
    console.error('check-compat: the built site calls functions the build\'s target browsers (vite.config.js build.target) lack:');
    for (const p of own) console.error(`  - ${p.file}: ${p.call}…`);
    console.error('Use an older equivalent (see the no-restricted-* rules in eslint.config.js), or raise build.target on purpose.');
    process.exit(1);
  }
  console.log(`check-compat: ${Object.keys(files).length} JavaScript files use nothing newer than the build's target browsers`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(`check-compat: ${err.message}`);
    process.exit(1);
  }
}
