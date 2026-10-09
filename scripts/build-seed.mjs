#!/usr/bin/env node
// Regenerates supabase/seed/products.sql from src/data/products.js so a new
// database starts with the same ids, names, brands, SKUs, variants and their
// axis, photos, descriptions and sell units as the storefront's static rows.
// Run with `npm run seed`; commit the result. The rows are checked first
// (scripts/validate-catalog.mjs), with the aliases of corrected SKUs and
// labels (src/data/catalogAliases.js); a problem stops the seed, and warnings
// (how many rows have no sell unit) are printed.
//
// The seed is insert-only (AW-032): a row whose id is already in the table is
// left exactly as it is, so re-applying the file never overwrites what an
// admin changed. Corrections to rows that already exist ship as idempotent
// UPDATE data migrations in supabase/migrations/, next to the products.js
// edit. The seed carries no prices (AW-003, AW-002): products.price is set only
// in the database, so a new row starts with a null price (price on request).
// Before the insert, a guard block names seed ids the table already has under
// another SKU (skipped, NOTICE) and stops on a new seed id whose SKU another
// product uses (EXCEPTION): Admin -> Products gives out ids from the same
// space (NEW-022). The SQL is written by ./seed-sql.mjs.
//
// products.js resolves photos through Vite-only import.meta.glob, so the rows
// are loaded through Vite's SSR module loader instead of a plain import.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { validateCatalog } from './validate-catalog.mjs';
import { seedSql } from './seed-sql.mjs';
import { SKU_ALIASES, VARIANT_ALIASES } from '../src/data/catalogAliases.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'supabase/seed/products.sql');

// No price: prices live only in the database (see BACKEND.md, "How pricing
// tiers work"). No flavors count: 20261009110000_variant_model.sql drops the
// column (AW-332). unavailable_variants keeps its database default ([]). The
// columns are COLUMNS in ./seed-sql.mjs.

function validate(rows) {
  const { problems, warnings } = validateCatalog(rows, { aliases: { skuAliases: SKU_ALIASES, variantAliases: VARIANT_ALIASES } });
  // TODO(owner): What is the sell unit (each, box of N, case of N, or a size) of each product that has none yet? (AW-031)
  for (const warning of warnings) console.warn(`build-seed: WARNING: ${warning}`);
  if (problems.length) throw new Error(`catalog is not seedable:\n  ${problems.join('\n  ')}`);
}

const server = await createServer({
  root: ROOT,
  configFile: path.join(ROOT, 'vite.config.js'),
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
});
let rows;
try {
  ({ CATALOG: rows } = await server.ssrLoadModule('/src/data/products.js'));
} finally {
  await server.close();
}
validate(rows);

await fs.writeFile(OUT, seedSql(rows));
console.log(`build-seed: wrote ${rows.length} rows to ${path.relative(ROOT, OUT)}`);
