// An order's pick list and packing slip (AW-110), pure parts
// (printSheet.test.js); the view is PrintSheet.jsx.
//
// Lines are sorted the way the warehouse is walked: by department in the
// navigation order, then sub-line, then name. Neither sheet shows prices.

import { NAV_ORDER, PRODUCTS } from '../../data/products.js';
import { catLabel } from '../../lib/format.js';
import { adminHref } from '../../lib/adminRoutes.js';
import { isNetworkError } from '../../lib/errors.js';
import { ADMIN_ORDER_SELECT } from './orderQueries.js';
import { isSessionEnded, withStatus } from './adminData.js';

export const PRINT_DOCS = {
  pick: { title: 'Pick list', tick: 'Picked', other: 'slip', otherLabel: 'Packing slip' },
  slip: { title: 'Packing slip', tick: 'Packed', other: 'pick', otherLabel: 'Pick list' },
};
export const printDoc = (doc) => (PRINT_DOCS[doc] ? doc : 'pick');

// /admin/orders/<id>/print?doc=pick|slip
export const printHref = (id, doc) => adminHref({ section: 'orders', id, view: 'print', query: { doc } });

// The order with each line's department, sub-line and sell unit from the
// products table (one foreign key from order_items). If that read fails, the
// order is read as the list reads it, and the bundled catalog fills in.
export const PRINT_ORDER_SELECT = ADMIN_ORDER_SELECT.replace('order_items(*)', 'order_items(*, products(cat, sub, sell_unit))');

// { order (null: no such order), error }.
export async function loadPrintOrder(client, id) {
  const read = (select) => client.from('orders').select(select).eq('id', id).maybeSingle();
  let result = await read(PRINT_ORDER_SELECT);
  let error = withStatus(result);
  if (error && !isNetworkError(error) && !isSessionEnded(error)) {
    result = await read(ADMIN_ORDER_SELECT);
    error = withStatus(result);
  }
  return error ? { order: undefined, error } : { order: result.data ?? null, error: null };
}

const BUNDLED = new Map(PRODUCTS.map((p) => [Number(p.id), p]));

// A department's place in the walk: the navigation order, then any other
// department, then lines whose product is unknown.
const departmentRank = (cat) => {
  const i = NAV_ORDER.indexOf(cat);
  if (i !== -1) return i;
  return cat ? NAV_ORDER.length : NAV_ORDER.length + 1;
};
const text = (value) => String(value ?? '');
const byText = (a, b) => text(a).localeCompare(text(b), 'en', { sensitivity: 'base', numeric: true });

export function comparePrintLines(a, b) {
  return departmentRank(a.cat) - departmentRank(b.cat)
    || byText(a.cat, b.cat)
    || byText(a.sub, b.sub)
    || byText(a.name, b.name)
    || (Number(a.id) || 0) - (Number(b.id) || 0);
}

// The order's lines as the sheets print them, sorted:
// [{ id, sku, qty, unit, name, cat, sub }].
export function printLines(order, bundled = BUNDLED) {
  return (order?.order_items || []).map((it) => {
    const product = it.products || null;
    const known = bundled.get(Number(it.product_id)) || null;
    return {
      id: it.id,
      sku: it.sku || '',
      qty: Number(it.qty) || 0,
      // What quantity 1 meant when the line was saved; else the product's.
      unit: text(it.sell_unit || product?.sell_unit || known?.sellUnit).trim(),
      name: it.product_name || known?.name || '',
      cat: product?.cat || known?.cat || null,
      sub: product?.sub || known?.sub || null,
    };
  }).sort(comparePrintLines);
}

// The sorted lines in department groups: [{ key, label, lines }].
export function printGroups(lines) {
  const groups = [];
  for (const line of lines) {
    const key = line.cat || '';
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: line.cat ? catLabel(line.cat) : 'Other', lines: [] };
      groups.push(group);
    }
    group.lines.push(line);
  }
  return groups;
}

// '3 lines · 7 units'.
export function printTotals(lines) {
  const units = lines.reduce((sum, line) => sum + line.qty, 0);
  return `${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · ${units} ${units === 1 ? 'unit' : 'units'}`;
}
