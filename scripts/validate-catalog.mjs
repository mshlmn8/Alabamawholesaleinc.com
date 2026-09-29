// The rules src/data/products.js must follow before scripts/build-seed.mjs
// writes the seed. validateCatalog(rows, { aliases }) returns { problems,
// warnings }: problems stop the seed, warnings are printed.
//
// Problems: duplicate or invalid ids, duplicate or missing SKUs, a SKU that
// is not AW- plus capital letters and digits in hyphen-separated parts (no
// trailing or doubled hyphen, AW-135), missing names, brands, departments or
// lines, a price (prices live only in the database, AW-003), a row with two
// or more variants and no variant axis from VARIANT_AXES (AW-128), an unknown
// axis, a variant label that appears twice in one row (two labels with the
// same slug share a cart line key), and a label written the ways AW-138 fixed
// ("IPhone", "Type C To Type C", "Almond reg", "Cookies king", "2gal", "8lbs",
// "20oz"). With `aliases` (../src/data/catalogAliases.js), also an alias that
// points at a SKU or label the catalog does not have, or whose old key is
// still in use (validateAliases).
// Warnings: how many rows don't say what quantity 1 means (AW-031).

import { VARIANT_AXES, variantSlug } from '../src/lib/lines.js';

export const AXIS_LABELS = Object.keys(VARIANT_AXES);
export const SKU_FORMAT = /^AW-[A-Z0-9]+(-[A-Z0-9]+)*$/;
// Abbreviated or misspelled variant labels (AW-138): write "iPhone", "to",
// "Regular" / "King size" and "2 gal", "8 lb", "20 oz".
export const LABEL_PROBLEM = /^I[A-Z]|\bTo\b|\b(reg|king)$|\d(gal|lbs|oz)\b/;

export function validateCatalog(rows, { aliases = null } = {}) {
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
    if (p.sku && !SKU_FORMAT.test(p.sku)) problems.push(`row ${p.id}: sku ${p.sku} is not AW- plus capital letters and digits between single hyphens (AW-135)`);
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
      if (LABEL_PROBLEM.test(label)) problems.push(`row ${p.id}: variant "${label}" is abbreviated or misspelled (AW-138)`);
    }
    if (!String(p.sellUnit ?? '').trim()) noSellUnit += 1;
  }
  if (noSellUnit) {
    // TODO(owner): What is the sell unit (each, box of N, case of N, or a size) of each product that has none yet? Until then these rows say nothing about what quantity 1 means. (AW-031)
    warnings.push(`${noSellUnit} of ${rows.length} rows have no sellUnit, so their pages don't say what quantity 1 means (AW-031, docs/OWNER-TODO.md)`);
  }
  if (aliases) problems.push(...validateAliases(rows, aliases));
  return { problems, warnings };
}

// The alias maps against the rows (AW-135, AW-138): every new SKU and label
// they name exists, no old SKU or slug is still in use (it would resolve to
// two things), and a variant aliased to "no variant" belongs to a product
// with one variant or none.
export function validateAliases(rows, { skuAliases = {}, variantAliases = {} } = {}) {
  const problems = [];
  const skus = new Set(rows.map((p) => p.sku));
  for (const [from, to] of Object.entries(skuAliases)) {
    if (!skus.has(to)) problems.push(`SKU alias ${from} -> ${to}: no row has sku ${to}`);
    if (skus.has(from)) problems.push(`SKU alias ${from} -> ${to}: ${from} is still a row's sku`);
  }
  const byId = new Map(rows.map((p) => [Number(p.id), p]));
  for (const [id, map] of Object.entries(variantAliases)) {
    const p = byId.get(Number(id));
    if (!p) { problems.push(`variant aliases for row ${id}: no such row`); continue; }
    const labels = Array.isArray(p.variants) ? p.variants : [];
    const slugs = new Set(labels.map(variantSlug));
    for (const [from, to] of Object.entries(map)) {
      if (slugs.has(from)) problems.push(`row ${id}: variant alias "${from}" is still one of its labels`);
      if (to == null && labels.length > 1) problems.push(`row ${id}: variant alias "${from}" -> no variant, but the row has ${labels.length} variants`);
      if (to != null && !slugs.has(variantSlug(to))) problems.push(`row ${id}: variant alias "${from}" -> "${to}", which is not one of its labels`);
    }
  }
  return problems;
}
