// Admin -> Products' list (AW-115): every filter, the search (id, department,
// sub-line), the sort and its aria-sort, pages of 50 and the count line.
import { describe, expect, it } from 'vitest';
import {
  PAGE_SIZE, ariaSort, countText, departmentOptions, filterSignature, filterSortPage, hasFilters, matchesSearch, nextSort, sortProducts,
} from './productList.js';

const row = (id, extra = {}) => ({
  id, name: `Product ${id}`, brand: 'Brand', cat: 'CANDIES', sub: 'Gum', sku: `AW-P${id}`, tag: null, active: true,
  img: `p${id}.jpg`, sell_unit: 'box', stock_status: 'in_stock', price: 10, updated_at: '2026-10-01T12:00:00Z', ...extra,
});
const ROWS = [
  row(1, { name: 'Swisher Sweets', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', tag: 'BESTSELLER', price: 12.5, updated_at: '2026-10-05T12:00:00Z' }),
  row(2, { name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Pipe Tobacco', img: null, price: null, updated_at: '2026-09-01T12:00:00Z' }),
  row(14, { name: 'Snickers', brand: 'Mars', active: false, tag: 'NEW', sell_unit: '', updated_at: null }),
  row(162, { name: 'Honey & Energy shot', brand: 'Acme', cat: 'DRINKS & BAGS', sub: 'Energy Drinks', active: false, tag: 'BESTSELLER', stock_status: 'low', price: 3 }),
  row(250, { name: 'Argo corn starch', brand: 'Argo', cat: 'GROCERY', sub: 'Baking', price: 7.25 }),
  row(330, { name: 'Gum 250 pack', brand: 'Wrigley', sell_unit: '', stock_status: 'out', price: 1.1 }),
];
const ids = (result) => result.rows.map((r) => r.id);
const find = (query) => ids(filterSortPage(ROWS, query));

describe('filters (AW-115)', () => {
  it('filters by status', () => {
    expect(find({ status: 'active' })).toEqual([1, 2, 250, 330]);
    expect(find({ status: 'inactive' })).toEqual([14, 162]);
    expect(find({})).toEqual([1, 2, 14, 162, 250, 330]);
  });

  it('filters by department, and by sub-line only within its department', () => {
    expect(find({ dept: 'tobacco' })).toEqual([1, 2]);
    expect(find({ dept: 'drinks-and-bags' })).toEqual([162]);
    expect(find({ dept: 'tobacco', sub: 'pipe-tobacco' })).toEqual([2]);
    expect(find({ dept: 'tobacco', sub: 'cigars-and-cigarillos' })).toEqual([1]);
    // A sub-line without its department narrows nothing (its select needs one).
    expect(find({ sub: 'pipe-tobacco' })).toHaveLength(ROWS.length);
    expect(find({ dept: 'nowhere' })).toEqual([]);
  });

  it('filters by tag, including no tag', () => {
    expect(find({ tag: 'bestseller' })).toEqual([1, 162]);
    expect(find({ tag: 'new' })).toEqual([14]);
    expect(find({ tag: 'none' })).toEqual([2, 250, 330]);
    expect(find({ tag: 'deal' })).toEqual([]);
  });

  it('finds products without a photo or a sell unit, and by stock status', () => {
    expect(find({ photo: 'none' })).toEqual([2]);
    expect(find({ unit: 'none' })).toEqual([14, 330]);
    expect(find({ stock: 'low' })).toEqual([162]);
    expect(find({ stock: 'out', unit: 'none' })).toEqual([330]);
  });

  it('combines filters with the search', () => {
    expect(find({ status: 'inactive', tag: 'bestseller' })).toEqual([162]);
    expect(find({ q: 'tobacco', tag: 'none' })).toEqual([2]);
  });

  it('knows when anything is filtered, and what the selection belongs to', () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ sort: 'name', dir: 'desc', page: 3 })).toBe(false);
    expect(hasFilters({ photo: 'none' })).toBe(true);
    expect(hasFilters({ q: '  ' })).toBe(false);
    expect(filterSignature({ q: 'kite', page: 2, sort: 'name' })).toBe(filterSignature({ q: 'kite' }));
    expect(filterSignature({ q: 'kite' })).not.toBe(filterSignature({ q: 'kite', status: 'active' }));
  });

  it('lists the departments in the navigation order, each with its sub-lines as URL values', () => {
    const options = departmentOptions(ROWS);
    expect(options.map((d) => d.value)).toEqual(['tobacco', 'candies', 'grocery', 'drinks-and-bags']);
    const tobacco = options.find((d) => d.key === 'TOBACCO');
    expect(tobacco.subs).toEqual([{ value: 'cigars-and-cigarillos', label: 'Cigars & Cigarillos' }, { value: 'pipe-tobacco', label: 'Pipe Tobacco' }]);
    expect(options.every((d) => ROWS.some((r) => r.cat === d.key))).toBe(true);
  });
});

describe('search (AW-115)', () => {
  it('matches the name, brand and SKU, ignoring case', () => {
    expect(find({ q: 'SWISHER' })).toEqual([1]);
    expect(find({ q: 'mars' })).toEqual([14]);
    expect(find({ q: 'aw-p25' })).toEqual([250]);
  });

  it('matches the department and the sub-line', () => {
    expect(find({ q: 'TOBACCO' })).toEqual([1, 2]);
    expect(find({ q: 'energy drinks' })).toEqual([162]);
    expect(find({ q: 'Honey & Energy' })).toEqual([162]);
  });

  it('matches an id exactly, alongside names that contain the number', () => {
    expect(find({ q: '14' })).toEqual([14]);
    expect(find({ q: '250' })).toEqual([250, 330]);
    expect(matchesSearch(ROWS[0], '1')).toBe(true);
    expect(matchesSearch(ROWS[4], '25')).toBe(true); // SKU AW-P250
    expect(matchesSearch(ROWS[1], '22')).toBe(false);
  });
});

describe('sort (AW-115)', () => {
  it('sorts by id by default, and by name, brand, category, price and updated in both directions', () => {
    expect(find({})).toEqual([1, 2, 14, 162, 250, 330]);
    expect(find({ sort: 'id', dir: 'desc' })).toEqual([330, 250, 162, 14, 2, 1]);
    expect(find({ sort: 'name' })).toEqual([250, 330, 162, 2, 14, 1]);
    expect(find({ sort: 'brand' })).toEqual([162, 250, 2, 14, 1, 330]);
    expect(find({ sort: 'category', dir: 'asc' })).toEqual([330, 14, 162, 250, 1, 2]);
  });

  it('puts products without a price or a date last, whichever the direction', () => {
    expect(find({ sort: 'price' })).toEqual([330, 162, 250, 14, 1, 2]);
    expect(find({ sort: 'price', dir: 'desc' })).toEqual([1, 14, 250, 162, 330, 2]);
    expect(find({ sort: 'updated', dir: 'desc' })).toEqual([1, 162, 250, 330, 2, 14]);
    expect(find({ sort: 'updated' })).toEqual([2, 162, 250, 330, 1, 14]);
  });

  it('breaks ties by id and leaves the rows it was given alone', () => {
    const copy = [...ROWS];
    expect(sortProducts(ROWS, 'brand', 'desc').slice(-1)[0].id).toBe(162);
    expect(sortProducts([row(9, { brand: 'X' }), row(3, { brand: 'x' })], 'brand').map((r) => r.id)).toEqual([3, 9]);
    expect(ROWS).toEqual(copy);
  });

  it('marks the sorted column with aria-sort, and flips or starts a column on a click', () => {
    expect(ariaSort({}, 'id')).toBe('ascending');
    expect(ariaSort({}, 'name')).toBeUndefined();
    expect(ariaSort({ sort: 'price', dir: 'desc' }, 'price')).toBe('descending');
    expect(nextSort({ page: 3 }, 'name')).toEqual({ sort: 'name', dir: 'asc', page: undefined });
    expect(nextSort({ sort: 'name', dir: 'asc' }, 'name')).toMatchObject({ sort: 'name', dir: 'desc' });
    expect(nextSort({ sort: 'name', dir: 'desc' }, 'name')).toMatchObject({ sort: 'name', dir: 'asc' });
    // Updated starts with the newest; ID A to Z is the default, written as nothing.
    expect(nextSort({}, 'updated')).toMatchObject({ sort: 'updated', dir: 'desc' });
    expect(nextSort({}, 'id')).toMatchObject({ sort: 'id', dir: 'desc' });
    expect(nextSort({ sort: 'id', dir: 'desc', q: 'kite' }, 'id')).toEqual({ q: 'kite', sort: undefined, dir: undefined, page: undefined });
  });
});

describe('pages and counts (AW-115)', () => {
  const many = Array.from({ length: 368 }, (_, i) => row(i + 1, { active: ![14, 162, 250, 330].includes(i + 1) }));

  it('shows 50 rows a page', () => {
    const first = filterSortPage(many, {});
    expect(PAGE_SIZE).toBe(50);
    expect([first.page, first.pages, first.pageRows.length, first.pageRows[0].id]).toEqual([1, 8, 50, 1]);
    const second = filterSortPage(many, { page: 2 });
    expect([second.page, second.pageRows[0].id, second.pageRows.at(-1).id]).toEqual([2, 51, 100]);
    const last = filterSortPage(many, { page: 8 });
    expect([last.pageRows.length, last.pageRows.at(-1).id]).toEqual([18, 368]);
  });

  it('clamps a page past the end, and shows one empty page when nothing matches', () => {
    expect(filterSortPage(many, { page: 99 }).page).toBe(8);
    expect(filterSortPage(many, { page: 99 }).pageRows[0].id).toBe(351);
    expect(filterSortPage(many, { status: 'inactive', page: 3 })).toMatchObject({ page: 1, pages: 1, total: 4 });
    expect(filterSortPage(many, { q: 'nothing like it' })).toMatchObject({ page: 1, pages: 1, total: 0, pageRows: [] });
  });

  it('counts the matches and the inactive ones among them', () => {
    const all = filterSortPage(many, {});
    expect([all.total, all.inactive]).toEqual([368, 4]);
    expect(countText(all, 368, false)).toBe('368 products · 4 inactive');
    const some = filterSortPage(many, { q: 'Product 25' });
    expect(countText(some, 368, true)).toBe('11 of 368 products · 1 inactive');
    expect(countText(filterSortPage(many, { status: 'active', q: 'Product 1' }), 368, true)).toBe('109 of 368 products');
    expect(countText({ total: 1, inactive: 0 }, 1, false)).toBe('1 product');
  });
});
