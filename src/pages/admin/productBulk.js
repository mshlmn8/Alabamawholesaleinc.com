// Admin -> Products' bulk changes, export and import (AW-114). Pure
// functions only (productBulk.test.js); ProductBulk.jsx and ProductImport.jsx
// render and send them.
//
//   parseAdjust(mode, text)         the "Adjust price by % / $" box
//   adjustedPrice(price, change)    one new price, in integer cents
//   adjustPreview(rows, change)     old -> new, skipped and refused rows
//   adjustRow(row, change)          a row as the database leaves it
//   exportColumns(columns)          the CSV's columns
//   productCsvRecords(rows, cols)   the CSV's header and rows
//   csvFileName(date)               products-YYYY-MM-DD.csv
//   importPlan(records, rows, …)    what an imported file would change
//
// Prices are worked in whole cents, like src/lib/pricing.js. The database
// rounds price x (1 + pct / 100) + amount to the cent half away from zero
// (round(numeric, 2), 20261010121000); with a percentage and an amount of at
// most two decimals that is exact here too. (JS Math.round differs from it
// only for negative values, and a negative result is refused anyway.)

import { fromCents, toCents } from '../../lib/pricing.js';
import { normalizeSku } from '../../lib/lines.js';
import { departmentsFor } from '../../lib/departments.js';
import { formatMoney } from '../../lib/format.js';
import {
  MAX_PRICE, PRODUCT_TAGS, STOCK_LABELS, STOCK_STATUSES, draftFromRow, hasColumn, productValues, validateProduct,
} from './productForm.js';
import { unguardCell } from './csv.js';

// The most products one bulk change or import may touch (the database's
// limit too).
export const MAX_BULK = 1000;
export const MAX_IMPORT_ROWS = 1000;
// The adjust preview lists this many rows, then "and N more".
export const PREVIEW_ROWS = 20;
export const MAX_PCT = 1000;

const text = (value) => (value == null ? '' : String(value));
const AMOUNT = /^[+-]?\d{1,5}(\.\d{1,2})?$/;

// The adjust box's text, for mode 'pct' (percent) or 'amount' (dollars):
// { ok, pct, amount } or { ok: false, error }. Two decimals at most; not 0;
// a percentage above -100 and at most 1000; an amount of at most 99,999.99
// either way.
export function parseAdjust(mode, raw) {
  const value = text(raw).trim().replace(/^\$/, '').replace(/^([+-])\$/, '$1');
  const pct = mode === 'pct';
  if (!AMOUNT.test(value)) {
    return { ok: false, error: pct ? 'Enter a percentage such as 5 or -2.5 (two decimals at most).' : 'Enter an amount such as 0.25 or -1.50.' };
  }
  const n = Number(value);
  if (n === 0) return { ok: false, error: 'Enter a change other than 0.' };
  if (pct && (n <= -100 || n > MAX_PCT)) return { ok: false, error: `Enter a percentage above -100 and up to ${MAX_PCT}.` };
  if (!pct && Math.abs(n) > MAX_PRICE) return { ok: false, error: 'Enter an amount of at most 99999.99 either way.' };
  return { ok: true, pct: pct ? n : 0, amount: pct ? 0 : n };
}

// price x (1 + pct / 100) + amount, rounded to the cent half away from
// zero; null for "price on request". All in integers: hundredths of a
// percent and ten-thousandths of a cent.
export function adjustedPrice(price, { pct = 0, amount = 0 } = {}) {
  const cents = toCents(price);
  if (cents == null) return null;
  const exact = cents * (10000 + Math.round(pct * 100)) + Math.round(amount * 100) * 10000;
  const rounded = Math.sign(exact) * Math.floor((Math.abs(exact) + 5000) / 10000);
  return fromCents(rounded) || 0;
}

const inRange = (price) => price >= 0 && price <= MAX_PRICE;

// What an adjustment would do to `rows`: `changes` (id, name, sku, old,
// next) for priced products, `skipped` for those on request, `refused` for
// any new price (the product's or, with variants, a variant's) below 0 or
// above 99,999.99, which blocks the change, and the number of variant prices
// it moves.
export function adjustPreview(rows, change, { variants = true } = {}) {
  const changes = [];
  const skipped = [];
  const refused = [];
  let variantCount = 0;
  for (const row of rows) {
    if (row.price == null) skipped.push({ id: row.id, name: row.name, sku: row.sku });
    else {
      const entry = { id: row.id, name: row.name, sku: row.sku, old: Number(row.price), next: adjustedPrice(row.price, change) };
      (inRange(entry.next) ? changes : refused).push(entry);
    }
    if (!variants) continue;
    for (const [label, price] of Object.entries(row.variantPrices || {})) {
      if (price == null) continue;
      const next = adjustedPrice(price, change);
      if (inRange(next)) variantCount += 1;
      else refused.push({ id: row.id, name: `${row.name} (${label})`, sku: row.sku, old: Number(price), next, variant: label });
    }
  }
  return { changes, skipped, refused, variants: variantCount };
}

// A row after the adjustment, as the database leaves it.
export function adjustRow(row, change, { variants = true } = {}) {
  const next = { ...row, price: row.price == null ? null : adjustedPrice(row.price, change) };
  if (variants && row.variantPrices) {
    next.variantPrices = Object.fromEntries(Object.entries(row.variantPrices).map(([label, price]) => [label, price == null ? null : adjustedPrice(price, change)]));
  }
  return next;
}

// ---------------------------------------------------------------------------
// Export.
// ---------------------------------------------------------------------------

export const CSV_COLUMNS = ['id', 'sku', 'name', 'brand', 'cat', 'sub', 'sell_unit', 'price', 'tag', 'active'];
// Written only when the load saw them (20261010120000).
export const CSV_OPTIONAL_COLUMNS = ['stock_status', 'featured_rank'];

export const exportColumns = (columns) => [...CSV_COLUMNS, ...CSV_OPTIONAL_COLUMNS.filter((c) => !!columns?.has(c))];

function exportValue(row, column) {
  if (column === 'price') return row.price == null ? '' : Number(row.price).toFixed(2);
  if (column === 'active') return row.active === false ? 'false' : 'true';
  if (column === 'id' || column === 'featured_rank') return row[column] == null ? '' : String(row[column]);
  return text(row[column]);
}

// The CSV's records: the header, then one row per product, as text (so the
// formula guard covers every text cell).
export function productCsvRecords(rows, columns) {
  const header = exportColumns(columns);
  return [header, ...rows.map((row) => header.map((column) => exportValue(row, column)))];
}

const pad = (n) => String(n).padStart(2, '0');
export const csvFileName = (date = new Date()) => `products-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;

// ---------------------------------------------------------------------------
// Import.
// ---------------------------------------------------------------------------

// The columns an import may change (admin_import_products), and the editor
// field each one's check belongs to (validateProduct).
export const IMPORT_COLUMNS = ['name', 'brand', 'sell_unit', 'description', 'price', 'tag', 'active', 'stock_status', 'featured_rank'];
const FIELD_OF = {
  name: 'name', brand: 'brand', sell_unit: 'sellUnit', description: 'description', price: 'price', tag: 'tag',
  stock_status: 'stockStatus', featured_rank: 'rank',
};
// Columns the export writes that an import reads past: the id, department
// and sub-line are changed in the editor.
export const NOT_IMPORTED = ['id', 'cat', 'sub'];

const TRUE = ['true', 'yes', 'y', '1', 'active'];
const FALSE = ['false', 'no', 'n', '0', 'inactive'];
export function parseActive(raw) {
  const value = text(raw).trim().toLowerCase();
  if (TRUE.includes(value)) return true;
  if (FALSE.includes(value)) return false;
  return null;
}

// '$1,234.50' -> '1234.50' (what the price box would hold).
const priceBox = (raw) => text(raw).trim().replace(/^\$/, '').replace(/,(?=\d{3}(\D|$))/g, '');
const tagBox = (raw) => {
  const value = text(raw).trim();
  return value === '' || value.toLowerCase() === 'none' ? '' : value.toUpperCase();
};
// A stock status by its key or its label ('Low stock'), any case.
const stockBox = (raw) => {
  const value = text(raw).trim().toLowerCase();
  return STOCK_STATUSES.find((s) => s === value.replace(/\s+/g, '_') || STOCK_LABELS[s].toLowerCase() === value) || value;
};

// A column's value as the preview shows it.
export function displayValue(column, value) {
  if (column === 'price') return value == null ? 'On request' : formatMoney(value);
  if (column === 'active') return value ? 'Active' : 'Inactive';
  if (column === 'stock_status') return STOCK_LABELS[value] || text(value);
  if (value == null || value === '') return '—';
  const shown = text(value);
  return shown.length > 60 ? `${shown.slice(0, 57)}…` : shown;
}

// One file row against its product: the draft with the file's values, the
// editor's checks for the columns the file has, and what would change.
function rowChanges(row, values, { rows, columns, departments }) {
  const draft = draftFromRow(row, row.price, row.variantPrices || {});
  const original = draftFromRow(row, row.price, row.variantPrices || {});
  const messages = [];
  for (const [column, raw] of Object.entries(values)) {
    if (column === 'name') draft.name = raw.trim();
    else if (column === 'brand') draft.brand = raw.trim();
    else if (column === 'sell_unit') draft.sellUnit = raw.trim();
    else if (column === 'description') draft.description = raw.trim();
    else if (column === 'price') draft.priceText = priceBox(raw);
    else if (column === 'tag') draft.tag = tagBox(raw);
    else if (column === 'stock_status') draft.stockStatus = stockBox(raw);
    else if (column === 'featured_rank') draft.rankText = raw.trim();
    else if (column === 'active') {
      const active = parseActive(raw);
      if (active == null) messages.push('active: use true or false.');
      else draft.active = active;
    }
  }
  const { errors } = validateProduct(draft, { rows, departments, columns, variantPrices: false });
  for (const column of Object.keys(values)) {
    const field = FIELD_OF[column];
    if (field && errors[field]) messages.push(`${column}: ${errors[field]}`);
  }
  if (messages.length) return { messages, fields: [], patch: {} };
  const before = productValues(original, departments);
  const after = productValues(draft, departments);
  const fields = [];
  const patch = {};
  for (const column of Object.keys(values)) {
    if (JSON.stringify(before[column]) === JSON.stringify(after[column])) continue;
    fields.push({ column, old: before[column], next: after[column] });
    patch[column] = after[column];
  }
  return { messages, fields, patch };
}

// What an imported file would change. `records` is parseCsv's output, its
// first record the header; `rows` the loaded products; `columns` the
// products columns the load saw. Rows are matched to products by SKU
// (normalizeSku, so any case); the import never creates a product.
//
// Returns { error } for a file that can't be used at all, or
//   { error: null, used, unavailable, ignored, changes, unchanged, unknown,
//     invalid, ok }
// used: the columns it changes; unavailable: ones the database doesn't have
// yet; ignored: other headers; changes: [{ id, sku, name, fields: [{ column,
// old, next }], patch }]; unknown: [{ line, sku }]; invalid: [{ line, sku,
// name, messages }]. ok: something to apply and nothing invalid.
export function importPlan(records, rows = [], { columns = null, departments = departmentsFor(rows) } = {}) {
  if (!records.length) return { error: 'The file is empty.' };
  const header = records[0].map((h) => unguardCell(text(h)).trim().toLowerCase().replace(/\s+/g, '_'));
  const twice = header.find((h, i) => h && header.indexOf(h) !== i);
  if (twice) return { error: `The column “${twice}” appears twice.` };
  const skuAt = header.indexOf('sku');
  if (skuAt === -1) return { error: 'The file needs a sku column. Export the products to see the layout.' };
  const body = records.slice(1).map((record, i) => ({ record, line: i + 2 })).filter(({ record }) => record.some((cell) => text(cell).trim() !== ''));
  if (!body.length) return { error: 'The file has no product rows.' };
  if (body.length > MAX_IMPORT_ROWS) return { error: `The file has ${body.length} product rows; import at most ${MAX_IMPORT_ROWS} at a time.` };

  const present = IMPORT_COLUMNS.filter((c) => header.includes(c));
  const used = present.filter((c) => hasColumn(columns, c));
  const unavailable = present.filter((c) => !hasColumn(columns, c));
  const ignored = header.filter((h) => h && h !== 'sku' && !IMPORT_COLUMNS.includes(h));

  const bySku = new Map();
  for (const row of rows) {
    const key = normalizeSku(row.sku);
    if (key && !bySku.has(key)) bySku.set(key, row);
  }
  const seen = new Map();
  const changes = [];
  const unknown = [];
  const invalid = [];
  let unchanged = 0;
  for (const { record, line } of body) {
    const cell = (column) => unguardCell(text(record[header.indexOf(column)]));
    const sku = cell('sku').trim();
    const key = normalizeSku(sku);
    if (!key) { invalid.push({ line, sku: '', name: '', messages: ['sku: this row has no SKU.'] }); continue; }
    if (seen.has(key)) { invalid.push({ line, sku, name: '', messages: [`sku: listed twice (also on line ${seen.get(key)}).`] }); continue; }
    seen.set(key, line);
    const row = bySku.get(key);
    if (!row) { unknown.push({ line, sku }); continue; }
    const values = Object.fromEntries(used.map((column) => [column, cell(column)]));
    const result = rowChanges(row, values, { rows, columns, departments });
    if (result.messages.length) invalid.push({ line, sku: row.sku, name: row.name, messages: result.messages });
    else if (result.fields.length) changes.push({ id: row.id, sku: row.sku, name: row.name, fields: result.fields, patch: result.patch });
    else unchanged += 1;
  }
  return { error: null, used, unavailable, ignored, changes, unchanged, unknown, invalid, ok: invalid.length === 0 && changes.length > 0 };
}

// admin_import_products' rows: each changed product's SKU as the database
// has it (so upper(btrim(sku)) finds it), with only the changed columns.
export const importRows = (plan) => plan.changes.map((change) => ({ sku: change.sku, ...change.patch }));

// The loaded row after an import, as the database leaves it.
export function importedRow(row, patch) {
  return { ...row, ...patch };
}

// The tags the Set tag action offers.
export const BULK_TAGS = PRODUCT_TAGS;
