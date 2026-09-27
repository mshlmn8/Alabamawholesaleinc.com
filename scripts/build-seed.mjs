#!/usr/bin/env node
// Regenerates supabase/seed/products.sql from src/data/products.js so the
// live catalog carries the same ids, names, brands, SKUs, variant counts,
// variants, photos, descriptions and sell units as the storefront's static
// rows. Run with `npm run seed`; commit the result.
//
// products.js resolves photos through Vite-only import.meta.glob, so the rows
// are loaded through Vite's SSR module loader instead of a plain import.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'supabase/seed/products.sql');

const COLUMNS = ['id', 'name', 'brand', 'cat', 'sub', 'sku', 'flavors', 'variants', 'img', 'tag', 'price', 'active', 'description', 'sell_unit'];
// `active` is deliberately left out: an admin's deactivation survives a reseed.
const UPDATED = COLUMNS.filter((c) => c !== 'id' && c !== 'active');

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
    variants.length,
    jsonb(variants),
    text(p.img),
    text(p.tag),
    Number(p.price),
    'true',
    requiredText(p.description),
    requiredText(p.sellUnit),
  ];
  return `  (${values.join(', ')})`;
}

function validate(rows) {
  const problems = [];
  const ids = new Set();
  const skus = new Set();
  for (const p of rows) {
    if (!Number.isInteger(p.id) || ids.has(p.id)) problems.push(`duplicate or invalid id ${p.id}`);
    ids.add(p.id);
    if (!p.sku || skus.has(p.sku)) problems.push(`duplicate or missing sku ${p.sku} (id ${p.id})`);
    skus.add(p.sku);
    for (const key of ['name', 'brand', 'cat', 'sub']) if (!p[key]) problems.push(`row ${p.id} is missing ${key}`);
    if (!(Number(p.price) >= 0)) problems.push(`row ${p.id} has an invalid price ${p.price}`);
    if (p.flavors !== (p.variants || []).length) problems.push(`row ${p.id}: flavors ${p.flavors} != variants.length ${(p.variants || []).length}`);
  }
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
  '-- Regenerate with: npm run seed. Idempotent via on conflict do update; `active` is',
  '-- only set on insert so an admin\'s deactivation survives a reseed.',
  '-- Needs supabase/migrations/20260927120000_product_copy.sql (description, sell_unit).',
  '',
  `insert into public.products (${COLUMNS.join(', ')}) values`,
  rows.map(rowSql).join(',\n'),
  'on conflict (id) do update set',
  UPDATED.map((c) => `  ${c} = excluded.${c}`).join(',\n') + ';',
  '',
].join('\n');

await fs.writeFile(OUT, sql);
console.log(`build-seed: wrote ${rows.length} rows to ${path.relative(ROOT, OUT)}`);
