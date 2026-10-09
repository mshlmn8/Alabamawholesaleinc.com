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
//
// products.js resolves photos through Vite-only import.meta.glob, so the rows
// are loaded through Vite's SSR module loader instead of a plain import.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { validateCatalog } from './validate-catalog.mjs';
import { SKU_ALIASES, VARIANT_ALIASES } from '../src/data/catalogAliases.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'supabase/seed/products.sql');

// No price: prices live only in the database (see BACKEND.md, "How pricing
// tiers work"). No flavors count: 20261009110000_variant_model.sql drops the
// column (AW-332). unavailable_variants keeps its database default ([]).
const COLUMNS = ['id', 'name', 'brand', 'cat', 'sub', 'sku', 'variants', 'variant_axis', 'img', 'tag', 'active', 'description', 'sell_unit'];

const text = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const requiredText = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`;
const jsonb = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

function rowSql(p) {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const values = [
    Number(p.id),
    requiredText(p.name),
    requiredText(p.brand),
    requiredText(p.cat),
    requiredText(p.sub),
    requiredText(p.sku),
    jsonb(variants),
    text(p.variantAxis),
    text(p.img),
    text(p.tag),
    'true',
    requiredText(p.description),
    requiredText(p.sellUnit),
  ];
  return `  (${values.join(', ')})`;
}

// 20261010120000_admin_product_editor.sql gives products.id a sequence
// default, so Admin -> Products inserts new products without an id. The seed
// inserts explicit ids after the migrations, which the sequence doesn't see:
// move it past them, never back, so the next admin insert can't take a seeded
// id. Does nothing on a database without that migration.
const SEQUENCE_FOOTER = [
  '-- Moves products_id_seq (20261010120000_admin_product_editor.sql) past the ids above, so',
  '-- the next product added in Admin -> Products gets a new id. Never moves it back.',
  'do $$',
  'begin',
  "  if to_regclass('public.products_id_seq') is not null then",
  '    perform setval(',
  "      'public.products_id_seq',",
  '      greatest(',
  '        coalesce((select max(id) from public.products), 0) + 1,',
  '        (select case when is_called then last_value + 1 else last_value end from public.products_id_seq)',
  '      ),',
  '      false',
  '    );',
  '  end if;',
  'end $$;',
];

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

const sql = [
  `-- Seed catalog: ${rows.length} SKUs, generated from src/data/products.js by scripts/build-seed.mjs.`,
  '-- Regenerate with: npm run seed.',
  '--',
  '-- Insert-only (AW-032): a row whose id already exists is left alone (on conflict do',
  '-- nothing), so re-applying this file never overwrites an admin\'s edits to names,',
  '-- brands, tags, prices or the active flag. Corrections to existing rows ship as',
  '-- idempotent UPDATE data migrations in supabase/migrations/.',
  '--',
  '-- No prices (AW-003, AW-002): products.price is set only in the database, through',
  '-- Admin -> Products or a private SQL file under supabase/private/ (gitignored). A new',
  '-- row starts with a null price, which the storefront shows as "Price on request".',
  '--',
  '-- Needs supabase/migrations/20260927120000_product_copy.sql (description, sell_unit),',
  '-- 20261009100000_price_boundary.sql (price nullable) and 20261009110000_variant_model.sql',
  '-- (variant_axis; no flavors column). Postgres checks NOT NULL before ON CONFLICT, so on a',
  '-- database without the price-boundary migration every row fails, including ids that',
  '-- already exist.',
  '',
  `insert into public.products (${COLUMNS.join(', ')}) values`,
  rows.map(rowSql).join(',\n'),
  'on conflict (id) do nothing;',
  '',
  ...SEQUENCE_FOOTER,
  '',
].join('\n');

await fs.writeFile(OUT, sql);
console.log(`build-seed: wrote ${rows.length} rows to ${path.relative(ROOT, OUT)}`);
