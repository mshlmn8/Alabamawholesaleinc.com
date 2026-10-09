// Upper-case eyebrows print 'SKUs', never 'SKUS' (AW-284): the word sits in
// a .keep-case span, which the stylesheet keeps out of the text-transform.
// /catalog's eyebrow no longer repeats the counts in the note under it.
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

describe('SKU counts in upper-case eyebrows (AW-284)', () => {
  it('keeps the word SKUs out of the transform on /catalog, and the page eyebrow drops the counts the note repeats', () => {
    render(<CatalogIndexPage products={products} departments={departments} profile={null} isApprovedBuyer={false} onLoginClick={() => {}} />);
    const head = document.querySelector('.page-head .eyebrow');
    expect(text(head)).toBe('FULL ASSORTMENT');
    // The counts are the page head's sentence (AW-068).
    expect(text(document.querySelector('.page-head > p:not([class])'))).toBe(`${departments.length} departments, 3 product lines and 3 products.`);
    const tobacco = screen.getByRole('heading', { level: 2, name: 'Tobacco' }).previousElementSibling;
    expect(text(tobacco)).toBe('DEPARTMENT 01 · 2 SKUs');
    expect(text(tobacco.querySelector('.keep-case'))).toBe('SKUs');
    // The count is a span of its own (translate-safe).
    expect(text(tobacco.firstElementChild)).toBe('DEPARTMENT 01 · 2 ');
    for (const eyebrow of document.querySelectorAll('.dept-head .eyebrow')) {
      expect(eyebrow.querySelector('.keep-case')?.textContent, text(eyebrow)).toBe('SKUs');
    }
  });

  it('does the same on a department page', () => {
    act(() => navigate('/category/tobacco', { replace: true }));
    render(<CategoryPage category="TOBACCO" sub={null} query={EMPTY_CATEGORY_QUERY}
                         products={products} departments={departments} profile={null} isApprovedBuyer={false}
                         cart={{}} addLine={() => {}} decLine={() => {}} onLoginClick={() => {}} />);
    const eyebrow = document.querySelector('.page-head .eyebrow');
    expect(text(eyebrow)).toBe('DEPARTMENT · 02 SKUs');
    expect(text(eyebrow.querySelector('.keep-case'))).toBe('SKUs');
  });

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
