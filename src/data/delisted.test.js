// Kratom & Kava and every mushroom product are off the site (AW-001, the
// owner's answer of 2026-10): kept in products.js as inactive rows, out of
// the bundled and the live catalog, the departments, search, the home rails,
// the department descriptions and the sitemap, with the lines' old addresses
// redirected to Novelties.
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_PRODUCTS, CATALOG, PRODUCTS } from './products.js';
import { DELISTED_IDS, DELISTED_LINE_DEPARTMENT, DELISTED_LINE_SLUGS, DELISTED_LINES, isDelisted } from './delisted.js';
import { departmentsFor, topLines } from '../lib/departments.js';
import { hydrateProducts } from '../lib/catalogRows.js';
import { homeRails } from '../lib/merchandising.js';
import { searchProducts } from '../lib/search.js';
import { pageMeta } from '../lib/meta.js';
import { EMPTY_CATEGORY_QUERY, parseUrl, pathFor, resolveRoute, slugify } from '../lib/routes.js';
import { sitemapPaths } from '../../scripts/build-sitemap.mjs';
import { resolveCartItems } from '../lib/lines.js';
import { currentImageFile, RETIRED_IMAGE_FILES } from './catalogAliases.js';

const departments = departmentsFor(PRODUCTS);
const novelties = departments.find((d) => d.key === 'NOVELTIES');
const WORDS = /kratom|kava|mushroom|shroom/i;
const text = (p) => `${p.name} ${p.brand} ${p.sub} ${p.description}`;

describe('the delisted products (AW-001)', () => {
  it('are the Kratom & Kava and Mushroom Products lines, by line and by id', () => {
    expect(DELISTED_LINES).toEqual(['Kratom & Kava', 'Mushroom Products']);
    expect(DELISTED_LINE_SLUGS).toEqual(DELISTED_LINES.map(slugify));
    expect(DELISTED_IDS).toHaveLength(22);
    expect(CATALOG.filter((p) => DELISTED_LINES.includes(p.sub)).map((p) => p.id)).toEqual([...DELISTED_IDS]);
    expect(new Set(CATALOG.filter((p) => DELISTED_LINES.includes(p.sub)).map((p) => p.cat))).toEqual(new Set([DELISTED_LINE_DEPARTMENT]));
  });

  it('isDelisted: a row of a delisted line, or a delisted id, whatever its active flag', () => {
    expect(isDelisted({ id: 75, sub: 'Kratom & Kava', active: true })).toBe(true);
    expect(isDelisted({ id: 99999, sub: ' Mushroom Products ' })).toBe(true);
    expect(isDelisted({ id: 307, sub: 'Moved by staff' })).toBe(true);
    expect(isDelisted({ id: 217, sub: 'Detox' })).toBe(false);
    expect(isDelisted({ id: 301, sub: 'Wellness Pills' })).toBe(false);
    expect(isDelisted({ id: 265, sub: 'Honey & Energy' })).toBe(false);
    expect(isDelisted({ id: 219, sub: 'Gifts' })).toBe(false);
    expect(isDelisted(null)).toBe(false);
  });

  it('stay in products.js, inactive, and out of the storefront\'s bundled catalog', () => {
    expect(CATALOG).toHaveLength(368);
    expect(ALL_PRODUCTS).toHaveLength(368);
    expect(PRODUCTS).toHaveLength(368 - 22);
    for (const id of DELISTED_IDS) {
      expect(CATALOG.find((p) => p.id === id).active, `#${id}`).toBe(false);
      expect(ALL_PRODUCTS.find((p) => p.id === id).name, `#${id}`).toBeTruthy();
      expect(PRODUCTS.some((p) => p.id === id), `#${id}`).toBe(false);
    }
    expect(PRODUCTS.filter((p) => WORDS.test(text(p))).map((p) => p.id)).toEqual([]);
  });

  it('leave the live catalog even while the database still marks them active', () => {
    const live = [
      { id: 1, name: 'Cigarillos', brand: 'B', cat: 'TOBACCO', sub: 'Cigars & Cigarillos', variants: [], active: true },
      { id: 75, name: 'Wava kava', brand: 'Wava', cat: 'NOVELTIES', sub: 'Kratom & Kava', variants: [], active: true },
      { id: 307, name: 'Stoned honey mushroom bags', brand: 'Stoned', cat: 'NOVELTIES', sub: 'Mushroom Products', variants: [], active: true },
      { id: 9001, name: 'Staff gummies', brand: 'S', cat: 'NOVELTIES', sub: 'Mushroom Products', variants: [], active: true },
      { id: 217, name: 'Champ Detox drink', brand: 'Champ', cat: 'NOVELTIES', sub: 'Detox', variants: [], active: true },
    ];
    expect(hydrateProducts(live).map((p) => p.id)).toEqual([1, 217]);
  });

  it('leave the Novelties department\'s lines, its biggest lines and its description', () => {
    expect(novelties.subs).not.toContain('Kratom & Kava');
    expect(novelties.subs).not.toContain('Mushroom Products');
    expect(novelties.subs).toEqual(expect.arrayContaining(['Detox', 'Wellness Pills', 'Gifts', 'Disposable Vapes', 'Hookah & Shisha']));
    expect(topLines(PRODUCTS, 'NOVELTIES', 3)).not.toEqual(expect.arrayContaining(['Mushroom Products']));
    const meta = pageMeta({ page: 'category', category: 'NOVELTIES', sub: null, query: EMPTY_CATEGORY_QUERY }, PRODUCTS, departments);
    expect(meta.description).not.toMatch(WORDS);
    expect(meta.title).not.toMatch(WORDS);
  });

  it('leave search and the home rails', () => {
    for (const q of ['kratom', 'kava', 'mushroom', 'shroom']) {
      expect(searchProducts(PRODUCTS, q).items.map((p) => p.id), q).toEqual([]);
    }
    // Brand names find no delisted product (a near spelling may find
    // another, e.g. "wava" finds Wave caps).
    for (const q of ['wava kava', 'mazza', 'psyched', 'blue lotus', 'hush hit', 'stoned']) {
      expect(searchProducts(PRODUCTS, q).items.filter((p) => isDelisted(p) || WORDS.test(text(p))), q).toEqual([]);
    }
    const { newArrivals, bestsellers } = homeRails(PRODUCTS, { limit: 8 });
    expect([...newArrivals, ...bestsellers].filter(isDelisted)).toEqual([]);
    expect(newArrivals.length).toBeGreaterThan(0);
  });

  it('leave the sitemap', () => {
    const paths = sitemapPaths({ departments, products: PRODUCTS });
    expect(paths.filter((p) => /kratom|mushroom/.test(p))).toEqual([]);
    for (const id of DELISTED_IDS) expect(paths, `#${id}`).not.toContain(`/product/${id}`);
    expect(paths).toContain('/category/novelties/gifts');
  });

  it('redirect their lines\' old addresses to the department; their products are not found', () => {
    const resolve = (pathname, search = '') => resolveRoute(parseUrl({ pathname, search }), { departments, products: PRODUCTS });
    for (const slug of DELISTED_LINE_SLUGS) {
      const route = resolve(`/category/novelties/${slug}`, '?sort=name-asc');
      expect(route).toEqual({ page: 'category', category: 'NOVELTIES', sub: null, query: { ...EMPTY_CATEGORY_QUERY, sort: 'name-asc' } });
      expect(pathFor(route)).toBe('/category/novelties');
    }
    // Other spellings, as old hash links had them.
    expect(pathFor(resolve('/category/NOVELTIES/Kratom%20%26%20Kava'))).toBe('/category/novelties');
    expect(pathFor(resolve('/category/novelties/Mushroom%20Products'))).toBe('/category/novelties');
    // Only in their own department; another unknown line is still not found.
    expect(resolve('/category/tobacco/kratom-and-kava')).toEqual({ page: 'not-found', kind: 'line', category: 'TOBACCO' });
    expect(resolve('/category/novelties/no-such-line')).toEqual({ page: 'not-found', kind: 'line', category: 'NOVELTIES' });
    expect(resolve('/product/75')).toEqual({ page: 'not-found', kind: 'product' });
    // The lines that stay, and the new Gifts line, are pages of their own.
    expect(resolve('/category/novelties/detox')).toMatchObject({ page: 'category', sub: 'Detox' });
    expect(resolve('/category/novelties/gifts')).toMatchObject({ page: 'category', sub: 'Gifts' });
  });

  it('stay in stored carts by name, as lines that can no longer be ordered', () => {
    const items = resolveCartItems({ '75::mango': 2, '307': 1, '1::red': 1 }, PRODUCTS, { known: ALL_PRODUCTS, order: ['75::mango', '307', '1::red'] });
    expect(items.map((i) => [i.lineKey, i.unavailable, i.name])).toEqual([
      ['75::mango', 'product', 'Wava kava — Mango'],
      ['307', 'product', 'Stoned honey mushroom bags'],
      ['1::red', null, 'Swisher Sweets cigarillos — Red'],
    ]);
  });
});

// "Kratom" is in no copy the site prints (AW-001): the code under src
// (comments left out), index.html and the web manifest. Only the catalog data
// may name it (the inactive rows' own copy, and the delisted and
// legal-review line names), and the staff-only note in Admin -> Products.
describe('the word kratom', () => {
  const ROOT = process.cwd();
  const read = (file) => readFileSync(resolve(ROOT, file), 'utf8');
  const code = (text) => text.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const sourceFiles = (dir) => readdirSync(resolve(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : sourceFiles(path);
    if (!/\.(js|jsx)$/.test(entry.name) || /\.test\.(js|jsx)$/.test(entry.name)) return [];
    return [path];
  });
  const ALLOWED = ['src/data/products.js', 'src/data/delisted.js', 'src/lib/legalReview.js', 'src/pages/admin/ProductEditor.jsx'];

  it('appears nowhere the site prints to buyers', () => {
    const files = [
      ...sourceFiles('src').map((file) => ({ name: file.split(sep).join('/'), text: code(read(file)) })),
      { name: 'index.html', text: read('index.html').replace(/<!--[\s\S]*?-->/g, '') },
      { name: 'public/site.webmanifest', text: read('public/site.webmanifest') },
    ];
    expect(files.length).toBeGreaterThan(50);
    const hits = files.filter((f) => !ALLOWED.includes(f.name) && /kratom/i.test(f.text)).map((f) => f.name);
    expect(hits).toEqual([]);
    // The catalog's own copy names it only on delisted rows.
    expect(CATALOG.filter((p) => /kratom/i.test(text(p)) && !isDelisted(p)).map((p) => p.id)).toEqual([]);
  });
});

describe('the owner\'s other catalog answers (2026-09-28, PR #11)', () => {
  const byId = (id) => CATALOG.find((p) => p.id === id);

  it('move #219 Happy valentines jar to a Gifts line, name and variants unchanged', () => {
    expect(byId(219)).toMatchObject({ name: 'Happy valentines jar', cat: 'NOVELTIES', sub: 'Gifts', variants: ['4 inch', '6 inch', 'Colored'] });
    expect(byId(219).description).not.toMatch(/wellness|pill/i);
    expect(departments.find((d) => d.key === 'NOVELTIES').subs).toContain('Gifts');
  });

  it('describe #295 Snack wraps as a chips brand, with no photo', () => {
    expect(byId(295).description).toBe('Snack wraps, a chips brand. Two sizes: 40ct and 12ct. Flavors vary by availability.');
    expect(byId(295).img).toBeNull();
  });

  it('make Uncle Al\'s #350 cookies and #351 creme, with no Lemon ice name or photo', () => {
    expect([byId(350).name, byId(351).name]).toEqual(['Uncle Al\'s cookies', 'Uncle Al\'s creme']);
    expect(byId(351).variants).toEqual([]);
    expect([byId(350).img, byId(351).img]).toEqual([null, null]);
    expect(CATALOG.filter((p) => /lemon ice/i.test(`${p.name} ${p.description} ${(p.variants || []).join(' ')}`))).toEqual([]);
    // The live table names the old photo until 20261014101000 is applied: it
    // shows the placeholder, never the Lemon Ice box.
    expect(RETIRED_IMAGE_FILES).toEqual(['uncle_al_s_cookies.jpg']);
    expect(currentImageFile(' uncle_al_s_cookies.jpg ')).toBeNull();
    const [cookies, creme] = hydrateProducts([
      { id: 350, name: 'Uncle Al\'s', brand: 'Uncle Al\'s', cat: 'FOOD STUFF', sub: 'Cookies', variants: [], img: 'uncle_al_s_cookies.jpg', active: true },
      { id: 351, name: 'Uncle Al\'s cookies', brand: 'Uncle Al\'s', cat: 'FOOD STUFF', sub: 'Cookies', variants: ['Lemon ice'], img: 'uncle_al_s_cookies.jpg', active: true },
    ]);
    expect([cookies.img, cookies.picture, creme.img, creme.sharedPhoto]).toEqual([null, null, null, false]);
  });

  it('keep a cart line saved with the old Lemon ice variant: it is the product', () => {
    const [item] = resolveCartItems({ '351::lemon-ice': 3 }, PRODUCTS);
    expect([item.lineKey, item.unavailable, item.name, item.qty, item.sku]).toEqual(['351', null, 'Uncle Al\'s creme', 3, 'AW-UNCLE-AL-S-COOKIES']);
  });
});
