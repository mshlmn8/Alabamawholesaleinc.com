// Cart and order lines are keyed by product plus variant. A product with more
// than one variant cannot be added as a bare parent id.
//
// SKUs and variant labels that were corrected keep resolving through
// ../data/catalogAliases.js (AW-135, AW-138, AW-126): stored cart keys, typed
// Quick Reorder codes and saved orders match the current catalog in either
// direction, old key to new label and new key to old label.

import { SKU_ALIASES, VARIANT_ALIASES } from '../data/catalogAliases.js';
import { MAX_QTY } from './quantity.js';

// Object.hasOwn is newer than the browsers the build targets (Safari 14).
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

export function variantList(product) {
  const raw = product?.variants;
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v).trim()).filter(Boolean);
}

export function variantSlug(label) {
  const slug = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'variant';
}

export function lineKey(productId, variantLabel) {
  if (variantLabel == null || String(variantLabel).trim() === '') return String(productId);
  return `${productId}::${variantSlug(variantLabel)}`;
}

export function parseLineKey(key) {
  const raw = String(key);
  const sep = raw.indexOf('::');
  if (sep === -1) return { productId: Number(raw), variantSlug: null };
  return { productId: Number(raw.slice(0, sep)), variantSlug: raw.slice(sep + 2) || null };
}

// How many variants a product has (AW-332): the count on cards and in the
// catalog index, the "Has flavors or variants" filter and the "Most
// variants" sort. There is no separate stored count to drift.
export const variantCount = (product) => variantList(product).length;

export function requiresVariantChoice(product) {
  return variantList(product).length > 1;
}

// What a product's variants differ by (AW-128): products.variant_axis, one of
// these labels, with the words the storefront uses for it. A product without
// one (or with a value the storefront doesn't know) gets the neutral
// DEFAULT_AXIS: "Choose a variant", "3 variants". The database accepts the
// same labels (supabase/migrations/20261009110000_variant_model.sql).
export const VARIANT_AXES = Object.freeze({
  Flavor: { noun: 'flavor', plural: 'flavors' },
  Size: { noun: 'size', plural: 'sizes' },
  Color: { noun: 'color', plural: 'colors' },
  Style: { noun: 'style', plural: 'styles' },
  Format: { noun: 'format', plural: 'formats' },
  Strength: { noun: 'strength', plural: 'strengths' },
  Type: { noun: 'type', plural: 'types' },
  Variety: { noun: 'variety', plural: 'varieties' },
});
export const DEFAULT_AXIS = Object.freeze({ label: 'Variety', noun: 'variant', plural: 'variants' });

// { label: 'Flavor', noun: 'flavor', plural: 'flavors' } for a product.
export function variantAxis(product) {
  const wanted = String(product?.variantAxis ?? '').trim().toLowerCase();
  const label = Object.keys(VARIANT_AXES).find((key) => key.toLowerCase() === wanted);
  return label ? { label, ...VARIANT_AXES[label] } : DEFAULT_AXIS;
}

// Whether a variant can be ordered now (AW-030): products.unavailable_variants
// lists the labels that can't be, matched like line keys (by slug). A product
// the live catalog hasn't described has every variant available.
export function isVariantAvailable(product, label) {
  if (label == null || label === '') return true;
  const off = Array.isArray(product?.unavailableVariants) ? product.unavailableVariants : [];
  const slug = variantSlug(label);
  return !off.some((v) => variantSlug(v) === slug);
}

// A one-variant product's variant, when it tells the buyer something the name
// doesn't: 'Green' for Garcia y Vega cigars, but not a lone 'Tips' on a
// product called "RAW tips" (AW-138 removed that one from the catalog).
// Null otherwise, and for products with no variants or several (AW-233).
export function informativeVariant(product) {
  const variants = variantList(product);
  if (variants.length !== 1) return null;
  const words = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const label = words(variants[0]);
  return label && ` ${words(product.name || '')} `.includes(` ${label} `) ? null : variants[0];
}

// A variant's SKU: the product's SKU plus the variant slug in capitals. A
// trailing hyphen on the product's code is dropped first, so a code saved as
// 'AW-BRILLO-BASICS-' never gives 'AW-BRILLO-BASICS--YELLOW' (AW-135).
export function variantSku(sku, variantLabel) {
  if (!variantLabel) return sku;
  const suffix = String(variantLabel).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return suffix ? `${String(sku ?? '').replace(/-+$/, '')}-${suffix}` : sku;
}

// What a stored or typed variant (a slug or a label) is on this product now:
//   { found: true, variant: label }  one of its labels, matched by slug or
//                                    through VARIANT_ALIASES in either
//                                    direction (an old slug on a renamed
//                                    label, or a new slug while the product
//                                    still has the old label)
//   { found: true, variant: null }   a variant that was taken off a product
//                                    that has none now (aliased to null);
//                                    one that has a single variant gets it
//   { found: false, variant: null }  anything else
export function matchVariant(product, slugOrLabel) {
  const none = { found: false, variant: null };
  if (slugOrLabel == null || String(slugOrLabel).trim() === '') return none;
  const labels = variantList(product);
  const needle = variantSlug(slugOrLabel);
  const bySlug = (slug) => labels.find((label) => variantSlug(label) === slug) || null;
  const direct = bySlug(needle);
  if (direct) return { found: true, variant: direct };
  const aliases = VARIANT_ALIASES[Number(product?.id)];
  if (!aliases) return none;
  if (has(aliases, needle)) {
    const target = aliases[needle];
    if (target == null) return labels.length <= 1 ? { found: true, variant: labels[0] ?? null } : none;
    const renamed = bySlug(variantSlug(target));
    if (renamed) return { found: true, variant: renamed };
  }
  for (const [oldSlug, target] of Object.entries(aliases)) {
    if (target == null || variantSlug(target) !== needle) continue;
    const before = bySlug(oldSlug);
    if (before) return { found: true, variant: before };
  }
  return none;
}

// The product's current label for a slug or label, or null.
export function canonicalVariant(product, slugOrLabel) {
  return matchVariant(product, slugOrLabel).variant;
}

// A SKU as typed or saved, in one form for comparing: capitals, spaces as
// hyphens, no doubled or trailing hyphens ('aw-brillo-basics--yellow' and
// 'AW-BRILLO-BASICS-' are 'AW-BRILLO-BASICS-YELLOW' and 'AW-BRILLO-BASICS').
export function normalizeSku(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '-').replace(/-{2,}/g, '-').replace(/-+$/, '');
}

// SKU_ALIASES as equivalence classes, keyed by the code as it was written
// (trailing hyphen kept, so #276's old 'AW-NOW-AND-LATER-' is not #36's
// 'AW-NOW-AND-LATER'): code -> the other codes of the same product.
const skuKey = (value) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '-');
const SKU_EQUIVALENTS = (() => {
  const classes = new Map();
  for (const [from, to] of Object.entries(SKU_ALIASES)) {
    const a = skuKey(from);
    const b = skuKey(to);
    const merged = new Set([...(classes.get(a) || [a]), ...(classes.get(b) || [b])]);
    for (const code of merged) classes.set(code, merged);
  }
  const others = new Map();
  for (const [code, members] of classes) others.set(code, [...members].filter((m) => m !== code));
  return others;
})();

// The product's other codes (normalized): the codes it had before, or, while
// the live catalog still has an old code, the code it has in this bundle.
function aliasSkus(product) {
  const own = normalizeSku(product?.sku);
  const others = SKU_EQUIVALENTS.get(skuKey(product?.sku)) || [];
  return [...new Set(others.map(normalizeSku))].filter((code) => code && code !== own);
}

// A code typed exactly as an old catalog code (hyphens and all) is read as the
// code it became: 'AW-NOW-AND-LATER-' was #276's, while 'AW-NOW-AND-LATER'
// is #36's.
function renamedSku(value) {
  const key = skuKey(value);
  if (!has(SKU_ALIASES, key)) return null;
  const [renamed] = (SKU_EQUIVALENTS.get(key) || []).filter((code) => !has(SKU_ALIASES, code));
  return renamed || null;
}

// Variant hits for BASE-SUFFIX against each product's bases; the longest
// base wins: AW-SS-MINI-RED belongs to AW-SS-MINI, not to AW-SS with a
// "mini-red" variant.
function variantHits(products, code, basesOf) {
  const hits = [];
  for (const product of products) {
    for (const base of basesOf(product)) {
      if (!base || !code.startsWith(`${base}-`)) continue;
      // Also a variant that was taken off (AW-4PK-TISSUES-CASE is #122 now).
      const { found, variant } = matchVariant(product, code.slice(base.length + 1));
      if (found) hits.push({ product, variant, length: base.length });
    }
  }
  const longest = Math.max(0, ...hits.map((h) => h.length));
  const picked = new Map();
  for (const h of hits) if (h.length === longest && !picked.has(h.product)) picked.set(h.product, { product: h.product, variant: h.variant });
  return [...picked.values()];
}

// Resolves a typed SKU against the catalog. Exact product codes win; otherwise
// BASE-SUFFIX is read as a variant SKU when the suffix names one of the base
// product's variants. A product's earlier or later codes (SKU_ALIASES) count
// after its own: a code from an old order finds the product under its new
// code, and a new code finds it while the live catalog still has the old one.
// `choice` carries the buyer's answers when a code is ambiguous: two products
// can share a code, and a bare SKU of a multi-variant product still needs a
// variant.
export function resolveSkuLine(products, sku, choice = {}) {
  if (!normalizeSku(sku)) return { status: 'empty', code: '' };
  const active = products.filter((p) => p.active !== false);
  const typed = skuKey(sku);
  const code = normalizeSku(renamedSku(sku) ?? sku);

  const exact = (codesOf, value) => active
    .filter((p) => codesOf(p).includes(value))
    .map((product) => ({ product, variant: null }));
  // The code exactly as a product has it, stray hyphens included, first.
  let candidates = exact((p) => [skuKey(p.sku)], typed);
  if (candidates.length === 0) candidates = exact((p) => [normalizeSku(p.sku)], code);
  if (candidates.length === 0) candidates = exact(aliasSkus, code);
  if (candidates.length === 0) candidates = variantHits(active, code, (p) => [normalizeSku(p.sku)]);
  if (candidates.length === 0) candidates = variantHits(active, code, aliasSkus);
  if (candidates.length === 0) return { status: 'not-found', code };

  let pick = candidates[0];
  if (candidates.length > 1) {
    pick = candidates.find((c) => Number(c.product.id) === Number(choice.productId));
    if (!pick) return { status: 'choose-product', code, candidates };
  }

  const variants = variantList(pick.product);
  let variant = pick.variant || (variants.length === 1 ? variants[0] : null);
  if (!variant && variants.length > 1) {
    variant = canonicalVariant(pick.product, choice.variant);
    if (!variant) return { status: 'choose-variant', code, product: pick.product, variants };
  }
  return { status: 'ok', code, product: pick.product, variant };
}

// Maps a saved order's lines back onto the current catalog. Products that are
// gone are reported by name. A multi-variant product whose saved variant no
// longer matches comes back as a bare line so the buyer chooses again in the
// cart, the same way an unfinished product-page add is handled.
export function linesFromOrder(order, products) {
  const lines = [];
  const unavailable = [];
  let needsVariant = 0;
  for (const item of order?.order_items || []) {
    const qty = Math.floor(Number(item.qty));
    if (!(qty > 0)) continue;
    let product = products.find((p) => Number(p.id) === Number(item.product_id)) || null;
    if (product?.active === false) product = null;
    let variant = null;
    if (product) {
      variant = canonicalVariant(product, item.variant);
      if (!variant) {
        // The saved code, read against the product's code now or the one it
        // had (AW-135): AW-BRILLO-BASICS--YELLOW, AW-HERSHEY-COOKIES-KING.
        const code = normalizeSku(item.sku);
        const bases = [normalizeSku(product.sku), ...aliasSkus(product)].sort((a, b) => b.length - a.length);
        const base = bases.find((b) => b && code.startsWith(`${b}-`));
        if (base) variant = canonicalVariant(product, code.slice(base.length + 1));
      }
    } else if (item.product_id == null) {
      const res = resolveSkuLine(products, item.sku);
      if (res.status === 'ok') ({ product, variant } = res);
    }
    if (!product) {
      unavailable.push(item.product_name || item.sku || 'Unknown item');
      continue;
    }
    const variants = variantList(product);
    if (!variant && variants.length === 1) variant = variants[0];
    if (!variant && variants.length > 1) needsVariant += 1;
    lines.push({ productId: product.id, variant, qty });
  }
  return { lines, unavailable, needsVariant };
}

// Re-keys stored lines to their canonical key: a bare id of a one-variant
// product gets its variant, variant slugs follow the catalog's labels, and an
// old slug follows its alias (AW-138, AW-126): '60::fuckin-fab' becomes
// '60::f-fab', and '329::tips' becomes '329' now that RAW tips has no
// variants. Lines the catalog does not know (a product that was deactivated
// or has not loaded yet, a variant that was taken out) are kept as they are,
// so the cart can flag them instead of dropping them without a word
// (AW-083). Returns the same object when nothing changes.
export function normalizeCart(cart, products) {
  const source = cart && typeof cart === 'object' && !Array.isArray(cart) ? cart : {};
  const next = {};
  // Two keys that become one never add up past the limit (AW-013).
  const add = (key, n) => { next[key] = Math.min(MAX_QTY, (next[key] || 0) + n); };
  for (const [key, qty] of Object.entries(source)) {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) continue;
    const { productId, variantSlug: slug } = parseLineKey(key);
    const product = products.find((p) => Number(p.id) === productId);
    const variants = variantList(product);
    const listed = !!product && product.active !== false;
    const match = !listed ? { found: false, variant: null }
      : slug ? matchVariant(product, slug) : { found: variants.length <= 1, variant: variants.length === 1 ? variants[0] : null };
    add(match.found ? lineKey(product.id, match.variant) : key, n);
  }
  const same = Object.keys(source).length === Object.keys(next).length
    && Object.entries(next).every(([key, qty]) => source[key] === qty);
  return same ? source : next;
}

// 'white-grape' -> 'White grape', for a variant the catalog no longer lists.
const labelFromSlug = (slug) => {
  const text = String(slug).replace(/-+/g, ' ').trim();
  return text ? text[0].toUpperCase() + text.slice(1) : '';
};

// The variants a buyer can move a line to in the cart (AW-011): every label
// with whether it can be ordered now, the axis words ("Choose a flavor") and
// the product's own name (a 'variant' line's name carries its old variant).
// Only for a product the catalog lists with variants.
function variantChoice(product) {
  const labels = variantList(product);
  if (!labels.length) return {};
  return {
    variants: labels.map((label) => ({ label, available: isVariantAvailable(product, label) })),
    axis: variantAxis(product),
    productName: product.name,
  };
}

// A line the cart keeps but cannot order (AW-083): its product is no longer
// in the catalog ('product') or its variant is not offered any more
// ('variant'). `known` supplies the name of a product that has left the
// live catalog (the bundled catalog still lists it). A 'variant' line of a
// listed product carries the variants to choose from instead (AW-011).
function unavailableLine(key, productId, qty, product, variantLabel, reason) {
  const name = product ? product.name : `Product #${productId}`;
  return {
    lineKey: key,
    productId,
    variant: null,
    needsVariant: false,
    unavailable: reason,
    name: variantLabel ? `${name} — ${variantLabel}` : name,
    sku: product?.sku || '',
    sellUnit: product?.sellUnit || '',
    cat: product?.cat || null,
    sub: product?.sub || null,
    qty,
    img: product?.img || null,
    ...(reason === 'variant' && product ? variantChoice(product) : {}),
  };
}

// The cart's lines against the catalog, in stored order. Each item is
// { lineKey, productId, variant, needsVariant, unavailable, name, sku,
// sellUnit, cat, qty, img }. Prices are not part of the catalog (AW-003);
// cart.js adds them.
//   needsVariant  a bare line of a product with several variants (a reorder
//                 that lost its variant); the buyer chooses one
//   variants      on a needsVariant line, and on a 'variant' line of a
//                 listed product: [{ label, available }] to choose from in
//                 the cart, with `axis` (variantAxis) for the words and
//                 `productName` (AW-011)
//   unavailable   null, or 'product' / 'variant' for a line that can no
//                 longer be ordered (AW-083): the product left the catalog,
//                 or its variant did or is marked not available (AW-030)
//   sellUnit      what quantity 1 means ('5-pack'), or '' (AW-031)
//   cat           the product's department, e.g. for the quote form's
//                 license fields (AW-014); null when the product is unknown
// Options:
//   settled  false while the live catalog is still loading: lines it may yet
//            know are left out for now instead of being flagged
//   known    other product lists to take an unavailable product's name from
// Stored keys that name the same line (an old and a new key of a renamed
// variant, AW-138, or a bare id and the id with its only variant) come back
// as one item with their quantities added, so every lineKey is listed once
// even before normalizeCart has merged them in storage.
export function resolveCartItems(cart, products, { settled = true, known = [] } = {}) {
  const find = (list, id) => list.find((p) => Number(p.id) === id) || null;
  const resolved = Object.entries(cart || {}).flatMap(([key, qty]) => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return [];
    const { productId, variantSlug: slug } = parseLineKey(key);
    const listed = find(products, productId);
    const product = listed?.active === false ? null : listed;
    if (!product) {
      if (!settled) return [];
      const old = listed || find(known, productId);
      const label = slug ? ((old && canonicalVariant(old, slug)) || labelFromSlug(slug)) : null;
      return [unavailableLine(key, productId, n, old, label, 'product')];
    }
    const variants = variantList(product);
    if (variants.length > 1 && !slug) {
      return [{
        lineKey: key,
        productId: product.id,
        variant: null,
        needsVariant: true,
        unavailable: null,
        name: product.name,
        sku: product.sku,
        sellUnit: product.sellUnit || '',
        cat: product.cat,
        sub: product.sub,
        qty: n,
        img: product.img,
        ...variantChoice(product),
      }];
    }
    // A slug the product no longer lists, unless an alias says what it
    // became (possibly no variant at all, AW-138).
    const match = slug ? matchVariant(product, slug) : { found: true, variant: variants.length === 1 ? variants[0] : null };
    const variant = match.variant;
    if (!match.found) {
      if (!settled) return [];
      const old = find(known, productId);
      return [unavailableLine(key, product.id, n, product, (old && canonicalVariant(old, slug)) || labelFromSlug(slug), 'variant')];
    }
    // A variant the catalog still lists but marks not available keeps its
    // line, flagged like one that went away, and can move to another.
    const offered = isVariantAvailable(product, variant);
    return [{
      lineKey: lineKey(product.id, variant),
      productId: product.id,
      variant,
      needsVariant: false,
      unavailable: offered ? null : 'variant',
      name: variant ? `${product.name} — ${variant}` : product.name,
      sku: variantSku(product.sku, variant),
      sellUnit: product.sellUnit || '',
      cat: product.cat,
      sub: product.sub,
      qty: n,
      img: product.img,
      ...(offered ? {} : variantChoice(product)),
    }];
  });
  const byKey = new Map();
  for (const item of resolved) {
    const same = byKey.get(item.lineKey);
    if (same) same.qty = Math.min(MAX_QTY, same.qty + item.qty);
    else byKey.set(item.lineKey, item);
  }
  return [...byKey.values()];
}
