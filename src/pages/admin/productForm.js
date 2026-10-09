// The Admin -> Products editor's form (AW-023, AW-116): the draft a product
// is edited as, its checks, and what a save writes. Pure functions only
// (productForm.test.js); ProductEditor.jsx renders and saves it.
//
//   draftFromRow(row, listPrice, variantPrices)  the draft of a loaded product
//   emptyDraft() / duplicateDraft(row, …)        a new product, or a copy
//   validateProduct(draft, { rows, … })          { ok, errors: { field: message } }
//   productValues(draft)                         the row a valid draft saves
//   patchFromDraft(draft, original, { columns }) only the columns that changed
//   variantPriceChanges(draft, original)         product_variant_prices writes
//
// Every text field is trimmed. The price is the raw text while typing: ''
// is "price on request" (null) and anything else must be an amount, parsed
// only when the draft is saved, so a cleared box is never NaN.

import { VARIANT_AXES, normalizeSku, variantSlug } from '../../lib/lines.js';
import { departmentsFor } from '../../lib/departments.js';
import { TAGS } from '../../lib/routes.js';

// products.stock_status (20261010120000), staff only for now (AW-023).
export const STOCK_STATUSES = ['in_stock', 'low', 'out', 'discontinued'];
export const STOCK_LABELS = { in_stock: 'In stock', low: 'Low stock', out: 'Out of stock', discontinued: 'Discontinued' };
export const AXIS_LABELS = Object.keys(VARIANT_AXES);
export const PRODUCT_TAGS = TAGS;
// The sub-line select's "New sub-line…" choice.
export const NEW_SUB = '__new__';

export const MAX_PRICE = 99999.99;
export const LIMITS = Object.freeze({ name: 200, brand: 200, sub: 60, sellUnit: 60, description: 4000, variant: 60, img: 500 });
// Up to 99,999.99 with at most two decimals; no sign, no exponent.
export const PRICE_PATTERN = /^\d{1,5}(\.\d{1,2})?$/;
// After normalizeSku: capitals, digits and single hyphens, 2 to 41 long.
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,40}$/;
export const MAX_RANK = 999;
// A photo file bundled with the site, or a public Supabase Storage address
// (a product-images upload is one). Only those: the site's CSP (netlify.toml)
// allows images from the site and https://*.supabase.co alone, so a photo on
// any other host would be blocked and show the placeholder. A new image host
// needs img-src in the CSP and the privacy policy's processor list first.
const BUNDLED_FILE = /^[A-Za-z0-9][A-Za-z0-9_.-]*\.(avif|gif|jpe?g|png|webp)$/i;
export const PHOTO_URL = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/(object|render\/image)\/public\/[^\s]+$/i;

// The product-images bucket (20261010120000): these types, at most 5 MB.
export const PHOTO_BUCKET = 'product-images';
export const PHOTO_TYPES = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' });
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

// Columns a database may not have yet: the editor leaves them out of a save
// when the load didn't see them, and drops them when a save says one is
// missing (42703 / PGRST204).
export const OPTIONAL_COLUMNS = ['stock_status', 'featured_rank', 'variant_axis', 'unavailable_variants'];

const text = (value) => (value == null ? '' : String(value));
const trim = (value) => text(value).trim();
const lower = (value) => trim(value).toLowerCase();

// An amount as the price box shows it: 12.5 -> '12.50'; null -> ''.
export function priceText(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}

// The price box's text: { ok, price } with price null for "price on request".
export function parsePrice(raw) {
  const value = trim(raw);
  if (value === '') return { ok: true, price: null };
  if (!PRICE_PATTERN.test(value)) return { ok: false, price: null };
  return { ok: true, price: Math.round(Number(value) * 100) / 100 };
}

// The homepage rank box's text: { ok, rank } with rank null for none.
export function parseRank(raw) {
  const value = trim(raw);
  if (value === '') return { ok: true, rank: null };
  if (!/^\d{1,3}$/.test(value)) return { ok: false, rank: null };
  const rank = Number(value);
  return rank >= 1 && rank <= MAX_RANK ? { ok: true, rank } : { ok: false, rank: null };
}

const variantEntry = (key, label, { original = null, unavailable = false, price = '', hadPrice = false } = {}) => ({
  key: `v${key}`, label, original, unavailable, priceText: price, hadPrice,
});

// The draft of a product as loaded. `listPrice` is its list price (null:
// price on request); `variantPrices` its product_variant_prices rows,
// { "<label>": price or null }, matched to its variants case-insensitively.
export function draftFromRow(row, listPrice = null, variantPrices = {}) {
  const labels = Array.isArray(row?.variants) ? row.variants.map((v) => trim(v)).filter(Boolean) : [];
  const off = new Set((Array.isArray(row?.unavailable_variants) ? row.unavailable_variants : []).map((v) => variantSlug(v)));
  const prices = new Map(Object.entries(variantPrices || {}).map(([label, price]) => [lower(label), price]));
  return {
    id: row?.id ?? null,
    name: text(row?.name),
    brand: text(row?.brand),
    cat: text(row?.cat),
    sub: text(row?.sub),
    newSub: '',
    sku: text(row?.sku),
    sellUnit: text(row?.sell_unit),
    description: text(row?.description),
    variants: labels.map((label, i) => {
      const has = prices.has(lower(label));
      return variantEntry(i + 1, label, {
        original: label, unavailable: off.has(variantSlug(label)), price: has ? priceText(prices.get(lower(label))) : '', hadPrice: has,
      });
    }),
    nextKey: labels.length + 1,
    variantAxis: text(row?.variant_axis),
    tag: text(row?.tag),
    priceText: priceText(listPrice),
    rankText: row?.featured_rank == null ? '' : String(row.featured_rank),
    stockStatus: STOCK_STATUSES.includes(row?.stock_status) ? row.stock_status : 'in_stock',
    active: row ? row.active !== false : true,
    img: text(row?.img),
  };
}

// A new, empty product: active, in stock, price on request.
export const emptyDraft = () => draftFromRow(null);

// A copy of a product (/admin/products/new?from=<id>): its name plus
// ' (copy)', no SKU (SKUs are unique), no homepage rank, and its variant
// prices as new rows.
export function duplicateDraft(row, listPrice = null, variantPrices = {}) {
  const draft = draftFromRow(row, listPrice, variantPrices);
  return {
    ...draft,
    id: null,
    name: `${trim(row?.name)} (copy)`,
    sku: '',
    rankText: '',
    variants: draft.variants.map((v) => ({ ...v, original: null, hadPrice: false })),
  };
}

// The sub-line a draft saves: the one chosen, or the one typed under "New
// sub-line…" (spelled like an existing one of the department if it is one).
export function subOf(draft, departments = []) {
  if (draft.sub !== NEW_SUB) return trim(draft.sub);
  const typed = trim(draft.newSub);
  const dept = departments.find((d) => d.key === draft.cat);
  return dept?.subs.find((s) => lower(s) === lower(typed)) || typed;
}

// The row a valid draft saves (every column the editor writes). Never
// flavors: 20261009110000 dropped it (AW-332). The price is parsed here, so
// call it only on a draft that passed validateProduct.
export function productValues(draft, departments = []) {
  const variants = draft.variants.map((v) => trim(v.label));
  return {
    name: trim(draft.name),
    brand: trim(draft.brand),
    cat: draft.cat,
    sub: subOf(draft, departments),
    sku: normalizeSku(draft.sku),
    sell_unit: trim(draft.sellUnit),
    description: trim(draft.description),
    variants,
    variant_axis: variants.length > 1 ? (draft.variantAxis || null) : null,
    unavailable_variants: draft.variants.filter((v) => v.unavailable).map((v) => trim(v.label)),
    tag: draft.tag || null,
    price: parsePrice(draft.priceText).price,
    featured_rank: parseRank(draft.rankText).rank,
    stock_status: draft.stockStatus,
    active: !!draft.active,
    img: trim(draft.img) || null,
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Whether the database has a column the editor writes. `columns` is the set
// of products columns the load saw (null: assume all); only the
// OPTIONAL_COLUMNS can be missing.
export const hasColumn = (columns, column) => !columns || !OPTIONAL_COLUMNS.includes(column) || columns.has(column);

// Only what changed between the loaded draft (`original`) and this one, for
// an update; every column for a new product (original null). A column the
// database doesn't have (see hasColumn) is left out.
export function patchFromDraft(draft, original, { columns = null, departments = [] } = {}) {
  const next = productValues(draft, departments);
  const before = original ? productValues(original, departments) : null;
  const patch = {};
  for (const [key, value] of Object.entries(next)) {
    if (!hasColumn(columns, key)) continue;
    if (before && same(before[key], value)) continue;
    patch[key] = value;
  }
  return patch;
}

// The product_variant_prices writes a save needs for product `productId`:
// deletes (labels whose row goes: a variant removed, renamed or cleared) and
// upserts ({ product_id, variant, price } for variants whose own price is
// new or changed, or whose label changed). Blank means "the product's
// price": no row. Deletes run first, so a rename that only changes the case
// doesn't collide with the case-insensitive unique index.
export function variantPriceChanges(draft, original, productId) {
  const deletes = [];
  const upserts = [];
  const before = new Map((original?.variants || []).map((v) => [v.key, v]));
  for (const v of original?.variants || []) {
    const now = draft.variants.find((d) => d.key === v.key);
    const renamed = now && trim(now.label) !== trim(v.label);
    const cleared = now && trim(now.priceText) === '';
    if (v.hadPrice && v.original != null && (!now || renamed || cleared)) deletes.push(v.original);
  }
  for (const v of draft.variants) {
    const price = trim(v.priceText);
    if (price === '') continue;
    const old = before.get(v.key);
    const unchanged = old && old.hadPrice && trim(old.label) === trim(v.label) && parsePrice(old.priceText).price === parsePrice(price).price;
    if (!unchanged) upserts.push({ product_id: productId, variant: trim(v.label), price: parsePrice(price).price });
  }
  return { deletes, upserts };
}

// A draft's fields as compared for "unsaved changes": trimmed text, and a
// price or rank typed another way (12.5, 12.50) counts as the same.
function comparable(draft) {
  const amount = (raw) => (parsePrice(raw).ok ? parsePrice(raw).price : trim(raw));
  return {
    ...draft,
    name: trim(draft.name), brand: trim(draft.brand), sku: trim(draft.sku), sellUnit: trim(draft.sellUnit),
    description: trim(draft.description), img: trim(draft.img), newSub: trim(draft.newSub),
    priceText: amount(draft.priceText), rankText: trim(draft.rankText),
    variants: draft.variants.map((v) => ({ key: v.key, label: trim(v.label), unavailable: !!v.unavailable, price: amount(v.priceText) })),
    nextKey: 0,
  };
}

export const draftChanged = (draft, original) => !!draft && !!original && !same(comparable(draft), comparable(original));

// The checks a save must pass (AW-116). `rows` are the loaded products (for
// unique SKUs and the departments), `columns` the products columns the load
// saw (hasColumn), `variantPrices` whether product_variant_prices
// exists. Returns { ok, errors } with errors keyed by field: name, brand,
// cat, sub, newSub, sku, sellUnit, description, variants, variant:<key>,
// variantPrice:<key>, variantAxis, tag, price, rank, stockStatus, img.
export function validateProduct(draft, { rows = [], departments = departmentsFor(rows), columns = null, variantPrices = true } = {}) {
  const errors = {};
  const has = (column) => hasColumn(columns, column);
  const required = (field, value, label, max) => {
    const v = trim(value);
    if (!v) errors[field] = `Enter the ${label}.`;
    else if (v.length > max) errors[field] = `Keep the ${label} to ${max} characters.`;
  };
  required('name', draft.name, 'product name', LIMITS.name);
  required('brand', draft.brand, 'brand', LIMITS.brand);

  const dept = departments.find((d) => d.key === draft.cat);
  if (!dept) errors.cat = 'Choose a department.';
  if (draft.sub === NEW_SUB) required('newSub', draft.newSub, 'new sub-line’s name', LIMITS.sub);
  else if (!trim(draft.sub)) errors.sub = 'Choose a sub-line, or New sub-line… to add one.';
  else if (dept && !dept.subs.includes(draft.sub)) errors.sub = 'Choose one of this department’s sub-lines, or New sub-line….';

  const sku = normalizeSku(draft.sku);
  if (!sku) errors.sku = 'Enter the SKU.';
  else if (!SKU_PATTERN.test(sku)) errors.sku = 'Use 2 to 41 capital letters, digits and hyphens, starting with a letter or digit (e.g. AW-KITE-1OZ).';
  else if (rows.some((r) => r.id !== draft.id && normalizeSku(r.sku) === sku)) errors.sku = 'That SKU is already used by another product.';

  if (trim(draft.sellUnit).length > LIMITS.sellUnit) errors.sellUnit = `Keep the sell unit to ${LIMITS.sellUnit} characters.`;
  if (trim(draft.description).length > LIMITS.description) errors.description = `Keep the description to ${LIMITS.description} characters.`;

  const seen = new Map();
  for (const v of draft.variants) {
    const label = trim(v.label);
    const field = `variant:${v.key}`;
    if (!label) errors[field] = 'Enter the variant’s name, or remove it.';
    else if (label.length > LIMITS.variant) errors[field] = `Keep it to ${LIMITS.variant} characters.`;
    else if (seen.has(variantSlug(label))) errors[field] = `Listed twice: “${seen.get(variantSlug(label))}” is the same variant.`;
    else seen.set(variantSlug(label), label);
    if (variantPrices && !parsePrice(v.priceText).ok) errors[`variantPrice:${v.key}`] = 'Enter an amount such as 12.50, or leave it blank.';
  }
  if (has('variant_axis') && draft.variants.length > 1 && !AXIS_LABELS.includes(draft.variantAxis)) {
    errors.variantAxis = 'Choose what the variants differ by.';
  }

  if (draft.tag && !PRODUCT_TAGS.includes(draft.tag)) errors.tag = 'Choose a tag from the list.';
  if (!parsePrice(draft.priceText).ok) {
    errors.price = 'Enter the price as an amount from 0 to 99999.99, such as 12.50, or leave it blank for price on request.';
  }
  if (has('featured_rank') && !parseRank(draft.rankText).ok) errors.rank = `Enter a whole number from 1 to ${MAX_RANK}, or leave it blank.`;
  if (has('stock_status') && !STOCK_STATUSES.includes(draft.stockStatus)) errors.stockStatus = 'Choose a stock status.';

  const img = trim(draft.img);
  if (img && (img.length > LIMITS.img || !(BUNDLED_FILE.test(img) || PHOTO_URL.test(img)))) {
    errors.img = 'Enter a photo file name such as kite.jpg, or upload the photo (other sites’ addresses are blocked).';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

// The order fields appear in on the form, for the error summary and the
// first field to focus.
export function errorFields(errors, draft) {
  const order = ['name', 'brand', 'cat', 'sub', 'newSub', 'sku', 'sellUnit', 'description',
    ...draft.variants.flatMap((v) => [`variant:${v.key}`, `variantPrice:${v.key}`]), 'variantAxis', 'tag', 'price', 'rank', 'stockStatus', 'img'];
  return order.filter((field) => errors[field]);
}

// What a photo file can't be, or null when it's fine to upload.
export function photoProblem(file) {
  if (!file) return 'Choose a photo file.';
  if (!PHOTO_TYPES[file.type]) return 'Choose a JPEG, PNG or WebP photo.';
  if (file.size > PHOTO_MAX_BYTES) return 'Choose a photo of at most 5 MB.';
  return null;
}

// An uploaded photo's file name in the product-images bucket:
// <time>-<name>.<ext>, the name slugged from the file's.
export function photoFileName(file, now = Date.now()) {
  const base = String(file?.name || '').replace(/\.[^.]*$/, '');
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'photo';
  return `${now}-${slug}.${PHOTO_TYPES[file?.type] || 'jpg'}`;
}

// Where a product's uploaded photo goes: products/<id or new>/<file name>.
// (Admin -> Homepage's hero photos go to home/<file name>.)
export function productImagePath(productId, file, now = Date.now()) {
  return `products/${productId ?? 'new'}/${photoFileName(file, now)}`;
}
