// One word for a catalog count (AW-217, NEW-056): 'products' in the
// department eyebrows, the line pages, the result note and the phone filter
// drawer, as on the home tiles and in the menus. An eyebrow's text-transform
// prints 'PRODUCTS', so nothing needs the old .keep-case span, and no eyebrow
// prints 'SKUs' (AW-284). /catalog's eyebrow no longer repeats the counts in
// the note under it.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { departmentsFor } from '../../lib/departments.js';
import { navigate } from '../../lib/router.js';
import { EMPTY_CATEGORY_QUERY } from '../../lib/routes.js';
import { CategoryPage } from '../CategoryPage.jsx';
import { CatalogIndexPage } from './CatalogIndexPage.jsx';

const products = [
  { id: 1, name: 'Swisher Sweets cigarillos', brand: 'Swisher', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-SS', variants: ['Red', 'Grape'], variantAxis: 'Flavor' },
  { id: 2, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', variants: [] },
  { id: 3, name: 'Gatorade', brand: 'Gatorade', cat: 'DRINKS & BAGS', sub: 'Sports', sku: 'AW-GATORADE', variants: ['Blue'] },
];
const departments = departmentsFor(products);
const text = (el) => el.textContent;

beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe('product counts (AW-217, NEW-056)', () => {
  it('counts products in each department eyebrow on /catalog, and the page eyebrow drops the counts the note repeats', () => {
    render(<CatalogIndexPage products={products} departments={departments} profile={null} isApprovedBuyer={false} onLoginClick={() => {}} />);
    const head = document.querySelector('.page-head .eyebrow');
    expect(text(head)).toBe('FULL ASSORTMENT');
    // The counts are the page head's sentence (AW-068).
    expect(text(document.querySelector('.page-head > p:not([class])'))).toBe(`${departments.length} departments, 3 product lines and 3 products.`);
    const tobacco = screen.getByRole('heading', { level: 2, name: 'Tobacco' }).previousElementSibling;
    expect(text(tobacco)).toBe('DEPARTMENT 01 · 2 products');
    // One text node, the eyebrow's only child (translate-safe).
    expect(tobacco.childNodes).toHaveLength(1);
    const drinks = screen.getByRole('heading', { level: 2, name: 'Drinks & Bags' }).previousElementSibling;
    expect(text(drinks)).toMatch(/ · 1 product$/);
    for (const eyebrow of document.querySelectorAll('.dept-head .eyebrow')) {
      expect(text(eyebrow)).toMatch(/^DEPARTMENT \d\d · \d+ products?$/);
      expect(eyebrow.querySelector('.keep-case')).toBeNull();
    }
    // 'SKU' stays where the codes are listed.
    const summaries = [...document.querySelectorAll('details.sku-details > summary')].map(text);
    expect(summaries).toContain('SKU list: all 2 Tobacco products');
    expect(summaries).toContain('SKU list: the Drinks & Bags product');
  });

  it('does the same on a department page, its line pages and its result note', () => {
    act(() => navigate('/category/tobacco', { replace: true }));
    const view = render(<CategoryPage category="TOBACCO" sub={null} query={EMPTY_CATEGORY_QUERY}
                         products={products} departments={departments} profile={null} isApprovedBuyer={false}
                         cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    const eyebrow = document.querySelector('.page-head .eyebrow');
    expect(text(eyebrow)).toBe('DEPARTMENT · 02 products');
    expect(eyebrow.querySelector('.keep-case')).toBeNull();
    expect(text(document.querySelector('.page-head h1 + p'))).toBe('Wholesale tobacco for licensed retail accounts: 2 products in 2 product lines.');
    expect(text(document.querySelector('.result-note'))).toBe('Showing 2 of 2 products');
    view.unmount();
    act(() => navigate('/category/tobacco/cigars', { replace: true }));
    render(<CategoryPage category="TOBACCO" sub="Cigars" query={EMPTY_CATEGORY_QUERY}
                         products={products} departments={departments} profile={null} isApprovedBuyer={false}
                         cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    expect(text(document.querySelector('.page-head .eyebrow'))).toBe('Tobacco · 1 product');
    expect(text(document.querySelector('.result-note'))).toBe('Showing 1 of 1 product in Cigars');
  });

  // The search page's label still prints 'SKUs' in an upper-case label.
  it('has a keep-case rule that undoes the transform', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/(^|\n)\.keep-case \{ text-transform: none; \}/);
  });

  it('prints no SKUs as plain text in an eyebrow anywhere in the components', () => {
    const files = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.jsx$/.test(name) && !/\.test\.jsx$/.test(name)) files.push(path);
      }
    };
    walk(resolve(process.cwd(), 'src'));
    const strays = files.flatMap((file) => readFileSync(file, 'utf8').split('\n')
      .filter((line) => /className="(eyebrow|card-kicker|kicker)"/.test(line) && /SKUs/.test(line) && !/keep-case|SkuCount/.test(line))
      .map((line) => `${file}: ${line.trim()}`));
    expect(strays).toEqual([]);
  });
});
