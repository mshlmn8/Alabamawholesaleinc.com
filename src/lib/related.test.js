// The "More …" row under a product (AW-231): brand, then line, then
// department; never the product's own photo; a small line filled from its
// department; neighbours that differ from page to page; and the AW-001
// status-quo guard.
import { describe, expect, it } from 'vitest';
import { RELATED_LIMIT, relatedProducts } from './related.js';
import { underLegalReview } from './merchandising.js';
import { PRODUCTS } from '../data/products.js';

const p = (id, extra = {}) => ({ id, name: `P${id}`, brand: `Brand ${id}`, cat: 'CANDIES', sub: 'Chocolate Bars', img: `/img/p${id}.jpg`, active: true, ...extra });
const ids = (list) => list.map((x) => x.id);

describe('relatedProducts', () => {
  it('shows four by default, never the product itself, another department or an inactive product', () => {
    const page = p(1);
    const products = [page, p(2), p(3), p(4, { active: false }), p(5, { cat: 'TOBACCO', sub: 'Cigars' }), p(6), p(7), p(8)];
    const related = relatedProducts(products, page);
    expect(RELATED_LIMIT).toBe(4);
    expect(related).toHaveLength(4);
    expect(ids(related)).not.toContain(1);
    expect(ids(related)).not.toContain(4);
    expect(ids(related)).not.toContain(5);
    expect(ids(relatedProducts(products, page, { limit: 2 }))).toHaveLength(2);
    expect(relatedProducts(products, null)).toEqual([]);
    expect(relatedProducts(null, page)).toEqual([]);
  });

  it('ranks the same brand first (any case, never "Assorted"), then the same line, then the department', () => {
    const page = p(1, { brand: 'Hershey' });
    const products = [
      page,
      p(2, { sub: 'Bags' }),
      p(3),
      p(4, { brand: 'HERSHEY ', sub: 'Jars' }),
      p(5, { sub: 'Jars' }),
    ];
    const row = ids(relatedProducts(products, page));
    expect(row.slice(0, 2)).toEqual([4, 3]);
    expect(row.slice(2).sort()).toEqual([2, 5]);
    // The placeholder brand names no brand, so two "Assorted" rows are not a pair.
    const assorted = p(10, { brand: 'Assorted', sub: 'Jars' });
    const other = [assorted, p(11, { brand: 'Assorted', sub: 'Bags' }), p(12, { sub: 'Jars' })];
    expect(ids(relatedProducts(other, assorted))[0]).toBe(12);
  });

  it('leaves out a product that shows the same photo (#290 Powerade big and small, #335 Gatorade)', () => {
    const drinks = { cat: 'DRINKS & BAGS', sub: 'Sports Drinks' };
    const powerade = { src: '/img/powerade_20oz--640x582.jpg' };
    const products = [
      p(290, { ...drinks, name: 'Powerade big', brand: 'Powerade', img: '/img/powerade_20oz--thumb.jpg', picture: powerade }),
      p(291, { ...drinks, name: 'Powerade small', brand: 'Powerade', img: '/img/powerade_20oz--thumb.jpg', picture: powerade }),
      p(335, { ...drinks, name: 'Gatorade small', brand: 'Gatorade', img: '/img/p_gatorade--thumb.jpg', picture: { src: '/img/p_gatorade--403.jpg' } }),
      p(336, { ...drinks, name: 'Gatorade big', brand: 'Gatorade', img: '/img/p_gatorade--thumb.jpg', picture: { src: '/img/p_gatorade--403.jpg' } }),
      p(144, { cat: 'DRINKS & BAGS', sub: 'Energy Drinks', brand: 'Red Bull' }),
    ];
    // The two of the other brand (in either order), then the department.
    const sorted = (row) => [...ids(row.slice(0, 2)).sort(), ...ids(row.slice(2))];
    expect(sorted(relatedProducts(products, products[0]))).toEqual([335, 336, 144]);
    expect(sorted(relatedProducts(products, products[2]))).toEqual([290, 291, 144]);
    // Two picks don't repeat a photo either, while there are others to show.
    const more = [...products, p(206, { cat: 'DRINKS & BAGS', sub: 'Sodas', brand: 'Dr Pepper' }), p(249, { cat: 'DRINKS & BAGS', sub: 'Sodas', brand: 'Sprite' })];
    const row = ids(relatedProducts(more, more[0]));
    expect(row).toHaveLength(4);
    expect(row.filter((id) => id === 335 || id === 336)).toHaveLength(1);
    // Rows without a photo are not "the same photo".
    const bare = [p(1, { img: null }), p(2, { img: null })];
    expect(ids(relatedProducts(bare, bare[0]))).toEqual([2]);
  });

  it('fills a small line from its department, a photo before "Photo coming soon" (#129, #353)', () => {
    const grocery = { cat: 'GROCERY' };
    const page = p(129, { ...grocery, sub: 'Other Grocery', brand: 'Assorted', img: null });
    const products = [
      page,
      p(20, { ...grocery, sub: 'Personal Care' }),
      p(113, { ...grocery, sub: 'Cleaning', img: null }),
      p(106, { ...grocery, sub: 'Bags & Storage' }),
      p(225, { ...grocery, sub: 'Personal Care' }),
      p(95, { ...grocery, sub: 'Paper & Plastic' }),
    ];
    const related = relatedProducts(products, page);
    expect(related).toHaveLength(4);
    expect(ids(related)).not.toContain(113);
    // A line of two: the other product first, then the department.
    const coffee = p(353, { cat: 'FOOD STUFF', sub: 'Coffee', brand: 'Assorted' });
    const food = [coffee, p(354, { cat: 'FOOD STUFF', sub: 'Coffee', brand: 'Folgers' }), ...[1, 2, 3, 4].map((n) => p(400 + n, { cat: 'FOOD STUFF', sub: 'Quick Meals' }))];
    const row = relatedProducts(food, coffee);
    expect(row).toHaveLength(4);
    expect(row[0].id).toBe(354);
  });

  it('shows different neighbours on different pages of one line, the same ones on each visit', () => {
    const line = Array.from({ length: 12 }, (_, i) => p(i + 1));
    const rows = line.map((x) => ids(relatedProducts(line, x)).sort((a, b) => a - b).join());
    // Not the first four of the line on every page, as before.
    expect(new Set(rows).size).toBeGreaterThan(6);
    for (let i = 1; i < rows.length; i++) expect(rows[i], `pages ${i} and ${i + 1}`).not.toBe(rows[i - 1]);
    expect(line.map((x) => ids(relatedProducts(line, x)).sort((a, b) => a - b).join())).toEqual(rows);
    // The input is not reordered.
    expect(ids(line)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('offers a product under legal review only on a page of its own line (AW-001 status quo)', () => {
    const novelties = { cat: 'NOVELTIES' };
    const kava = p(75, { ...novelties, sub: 'Kratom & Kava', brand: 'Wava' });
    const mazza = p(76, { ...novelties, sub: 'Kratom & Kava', brand: 'Mazza' });
    const vape = p(61, { ...novelties, sub: 'Disposable Vapes', brand: 'Geek Bar' });
    const vape2 = p(62, { ...novelties, sub: 'Disposable Vapes', brand: 'RAZ' });
    const products = [kava, mazza, vape, vape2];
    expect(ids(relatedProducts(products, vape))).toEqual([62]);
    const row = ids(relatedProducts(products, kava));
    expect(row[0]).toBe(76);
    expect(row.slice(1).sort()).toEqual([61, 62]);
    // The Honey & Energy enhancement items go by id.
    const merch = { cat: 'MERCHANDISE' };
    const rhino = p(28, { ...merch, sub: 'Honey & Energy', brand: 'Rhino' });
    const advil = p(196, { ...merch, sub: 'OTC & Health', brand: 'Advil' });
    const tylenol = p(197, { ...merch, sub: 'OTC & Health', brand: 'Tylenol' });
    expect(ids(relatedProducts([rhino, advil, tylenol], advil))).toEqual([197]);
  });

  it('gives every product of the bundled catalog a full row, never its own photo, and keeps the guard', () => {
    for (const page of PRODUCTS) {
      const related = relatedProducts(PRODUCTS, page);
      expect(related, `#${page.id}`).toHaveLength(4);
      for (const x of related) {
        expect(x.cat, `#${page.id} -> #${x.id}`).toBe(page.cat);
        if (page.picture?.src) expect(x.picture?.src, `#${page.id} -> #${x.id}`).not.toBe(page.picture.src);
        if (underLegalReview(x)) expect(x.sub, `#${page.id} -> #${x.id}`).toBe(page.sub);
      }
    }
    const byId = (id) => PRODUCTS.find((x) => x.id === id);
    expect(ids(relatedProducts(PRODUCTS, byId(290)))).not.toContain(291);
    expect(ids(relatedProducts(PRODUCTS, byId(335)))).not.toContain(336);
  });
});
