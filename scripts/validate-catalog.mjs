// The rules src/data/products.js must follow before scripts/build-seed.mjs
// writes the seed. validateCatalog(rows) returns { problems, warnings }:
// problems stop the seed, warnings are printed.
//
// Problems: duplicate or invalid ids, duplicate or missing SKUs, missing
// names, brands, departments or lines, a price (prices live only in the
// database, AW-003), a row with two or more variants and no variant axis from
// VARIANT_AXES (AW-128), an unknown axis, and a variant label that appears
// twice in one row (two labels with the same slug share a cart line key).
// Warnings: how many rows don't say what quantity 1 means (AW-031).

import { VARIANT_AXES, variantSlug } from '../src/lib/lines.js';

export const AXIS_LABELS = Object.keys(VARIANT_AXES);

export function validateCatalog(rows) {
  const problems = [];
  const warnings = [];
  const ids = new Set();
  const skus = new Set();
  let noSellUnit = 0;
  for (const p of rows) {
    if (!Number.isInteger(p.id) || ids.has(p.id)) problems.push(`duplicate or invalid id ${p.id}`);
    ids.add(p.id);
    if (!p.sku || skus.has(p.sku)) problems.push(`duplicate or missing sku ${p.sku} (id ${p.id})`);
    skus.add(p.sku);
    for (const key of ['name', 'brand', 'cat', 'sub']) if (!p[key]) problems.push(`row ${p.id} is missing ${key}`);
    if ('price' in p) problems.push(`row ${p.id} has a price; prices live only in the database (AW-003)`);
    if ('flavors' in p) problems.push(`row ${p.id} has flavors; cards count the variants (AW-332)`);
    const variants = Array.isArray(p.variants) ? p.variants : [];
    if (p.variantAxis != null && !AXIS_LABELS.includes(p.variantAxis)) {
      problems.push(`row ${p.id}: variantAxis "${p.variantAxis}" is not one of ${AXIS_LABELS.join(', ')}`);
    } else if (variants.length >= 2 && !p.variantAxis) {
      problems.push(`row ${p.id} has ${variants.length} variants and no variantAxis (one of ${AXIS_LABELS.join(', ')}) (AW-128)`);
    }
    const seen = new Set();
    for (const label of variants) {
      const slug = variantSlug(label);
      if (seen.has(slug)) problems.push(`row ${p.id}: variant "${label}" is listed twice`);
      seen.add(slug);
    }
    if (!String(p.sellUnit ?? '').trim()) noSellUnit += 1;
  }
  if (noSellUnit) {
    // TODO(owner): What is the sell unit (each, box of N, case of N, or a size) of each product that has none yet? Until then these rows say nothing about what quantity 1 means. (AW-031)
    warnings.push(`${noSellUnit} of ${rows.length} rows have no sellUnit, so their pages don't say what quantity 1 means (AW-031, docs/OWNER-TODO.md)`);
  }
  return { problems, warnings };
}
