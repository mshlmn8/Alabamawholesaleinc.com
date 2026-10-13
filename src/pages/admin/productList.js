// Admin -> Products' list (AW-115): the filters, search, sort and pages over
// the loaded rows. Pure functions only (productList.test.js);
// ProductsSection.jsx renders them, and the filters live in the URL
// (src/lib/adminRoutes.js checks the values):
//
//   q       search: name, brand, SKU, department or sub-line, or the exact id
//   status  active | inactive
//   dept    a department's slug (slugify('DRINKS & BAGS') = drinks-and-bags)
//   sub     a sub-line's slug, within dept
//   tag     bestseller | new | deal | premium | none
//   photo   none: no photo        unit  none: no sell unit
//   stock   a stock status (only when the database has the column)
//   sort    id | name | brand | category | price | updated, with dir asc | desc
//   page    1, 2, … (50 rows a page)
//
//   filterSortPage(rows, query)  { rows, pageRows, total, inactive, pages, page }

import { departmentsFor } from '../../lib/departments.js';
import { slugify } from '../../lib/routes.js';

export const PAGE_SIZE = 50;
// The query keys that narrow the list (not sort or page). A change to any of
// them clears the selection.
export const FILTER_KEYS = ['q', 'status', 'dept', 'sub', 'tag', 'photo', 'unit', 'stock'];
export const DEFAULT_SORT = 'id';
// The direction a column sorts in when its header is first clicked: the
// newest first for Updated, A to Z or low to high for the others.
const FIRST_DIRECTION = { updated: 'desc' };

const text = (value) => (value == null ? '' : String(value));
const blank = (value) => text(value).trim() === '';
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const byText = (a, b) => collator.compare(text(a), text(b));

export const isInactive = (row) => row?.active === false;

// The department and sub-line options: departmentsFor's order (the
// navigation order, then any department only the live catalog has), each
// with its sub-lines; the value is the slug the URL carries.
export function departmentOptions(rows = []) {
  return departmentsFor(rows).filter((d) => d.count > 0).map((d) => ({
    value: slugify(d.key),
    key: d.key,
    label: d.label,
    subs: d.subs.map((sub) => ({ value: slugify(sub), label: sub })),
  }));
}

// Whether the query narrows the list at all.
export const hasFilters = (query = {}) => FILTER_KEYS.some((key) => !blank(query[key]));

// The part of the query that a selection belongs to: the filters, not the
// sort or the page.
export const filterSignature = (query = {}) => FILTER_KEYS.map((key) => text(query[key]).trim()).join('\u0001');

// The search box: a word in the name, brand, SKU, department or sub-line, or
// the product's id exactly ('250' finds #250, not every name with 250 in it
// — those match too, by name).
export function matchesSearch(row, q) {
  const needle = text(q).trim().toLowerCase();
  if (!needle) return true;
  if (String(row.id) === needle) return true;
  return [row.name, row.brand, row.sku, row.cat, row.sub].some((value) => text(value).toLowerCase().includes(needle));
}

// Every filter but the search. The sub-line applies only within its
// department (its select depends on the department's).
export function matchesFilters(row, query = {}) {
  if (query.status === 'active' && isInactive(row)) return false;
  if (query.status === 'inactive' && !isInactive(row)) return false;
  if (query.dept && slugify(row.cat) !== query.dept) return false;
  if (query.dept && query.sub && slugify(row.sub) !== query.sub) return false;
  if (query.tag === 'none' && !blank(row.tag)) return false;
  if (query.tag && query.tag !== 'none' && text(row.tag).toUpperCase() !== query.tag.toUpperCase()) return false;
  if (query.photo === 'none' && !blank(row.img)) return false;
  if (query.unit === 'none' && !blank(row.sell_unit)) return false;
  if (query.stock && text(row.stock_status) !== query.stock) return false;
  return true;
}

// Numbers and dates sort with the empty ones last, whichever the direction.
const nullable = (value) => (value == null || value === '' || Number.isNaN(value) ? null : value);
const time = (value) => (value ? Date.parse(value) : null);
const SORT_VALUES = {
  id: (row) => Number(row.id),
  price: (row) => (row.price == null ? null : Number(row.price)),
  updated: (row) => time(row.updated_at),
};
const SORT_TEXT = {
  name: (a, b) => byText(a.name, b.name),
  brand: (a, b) => byText(a.brand, b.brand) || byText(a.name, b.name),
  category: (a, b) => byText(a.cat, b.cat) || byText(a.sub, b.sub) || byText(a.name, b.name),
};

// The rows in `sort` order (`dir` asc or desc), ties by id.
export function sortProducts(rows, sort = DEFAULT_SORT, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  const compare = (a, b) => {
    if (SORT_TEXT[sort]) return sign * SORT_TEXT[sort](a, b);
    const value = SORT_VALUES[sort] || SORT_VALUES.id;
    const x = nullable(value(a));
    const y = nullable(value(b));
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
    return sign * (x - y);
  };
  return [...rows].sort((a, b) => compare(a, b) || Number(a.id) - Number(b.id));
}

// The sort a query asks for, with its defaults.
export const sortOf = (query = {}) => ({ sort: query.sort || DEFAULT_SORT, dir: query.dir === 'desc' ? 'desc' : 'asc' });

// A header's aria-sort: 'ascending' or 'descending' on the sorted column,
// none on the others.
export function ariaSort(query, column) {
  const { sort, dir } = sortOf(query);
  if (sort !== column) return undefined;
  return dir === 'desc' ? 'descending' : 'ascending';
}

// The query after a click on a column's header: the same column flips its
// direction, another starts in its first direction. The default (id, A to
// Z) is written as no sort at all. Back to page 1 either way.
export function nextSort(query, column) {
  const current = sortOf(query);
  const dir = current.sort === column ? (current.dir === 'asc' ? 'desc' : 'asc') : (FIRST_DIRECTION[column] || 'asc');
  const plain = column === DEFAULT_SORT && dir === 'asc';
  return { ...query, sort: plain ? undefined : column, dir: plain ? undefined : dir, page: undefined };
}

// The filtered, sorted rows and the page of them to show. `page` is clamped
// to the pages there are (1 when nothing matches).
export function filterSortPage(rows = [], query = {}, { pageSize = PAGE_SIZE } = {}) {
  const matched = rows.filter((row) => matchesSearch(row, query.q) && matchesFilters(row, query));
  const { sort, dir } = sortOf(query);
  const sorted = sortProducts(matched, sort, dir);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const asked = Number(query.page) || 1;
  const page = Math.min(Math.max(1, Math.floor(asked)), pages);
  return {
    rows: sorted,
    pageRows: sorted.slice((page - 1) * pageSize, page * pageSize),
    total: sorted.length,
    inactive: sorted.filter(isInactive).length,
    pages,
    page,
  };
}

// The count line: '368 products · 4 inactive', or '6 of 368 products ·
// 1 inactive' when filtered. No inactive part when there are none.
export function countText({ total, inactive }, all, filtered) {
  const products = all === 1 ? 'product' : 'products';
  const count = filtered ? `${total} of ${all} ${products}` : `${all} ${products}`;
  return inactive ? `${count} · ${inactive} inactive` : count;
}
