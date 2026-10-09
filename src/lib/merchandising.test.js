// The homepage rails (AW-119): tags choose, the homepage rank orders, a
// product is in one rail only, and the AW-001 status-quo guard.
import { describe, expect, it } from 'vitest';
import { LEGAL_REVIEW_IDS, LEGAL_REVIEW_SUBS, homeRails, underLegalReview } from './merchandising.js';
import { PRODUCTS } from '../data/products.js';
import { hasPhoto } from '../pages/HomePage.jsx';

const p = (id, tag, extra = {}) => ({ id, name: `P${id}`, sub: 'Candy', tag, img: `p${id}.jpg`, active: true, featuredRank: null, ...extra });
const ids = (list) => list.map((x) => x.id);
const rails = (products, options = {}) => {
  const { newArrivals, bestsellers } = homeRails(products, { legacyNewIds: [], ...options });
  return { newArrivals: ids(newArrivals), bestsellers: ids(bestsellers) };
};

describe('homeRails', () => {
  it('shows the products tagged NEW and BESTSELLER, with a photo and active, at most `limit` each', () => {
    const products = [p(1, 'NEW'), p(2, 'BESTSELLER'), p(3, null), p(4, 'NEW', { img: null }), p(5, 'NEW', { active: false }), p(6, 'DEAL'), p(7, 'BESTSELLER')];
    expect(rails(products)).toEqual({ newArrivals: [1], bestsellers: [2, 7] });
    expect(rails(products, { limit: 1 })).toEqual({ newArrivals: [1], bestsellers: [2] });
    // A tag set in Admin -> Products takes effect: no list of ids decides.
    expect(rails([...products, p(200, 'NEW')]).newArrivals).toEqual([200, 1]);
  });

  it('orders by homepage rank, unranked last; then the old picks; then newest first (New arrivals) or by id (Bestsellers)', () => {
    const products = [p(1, 'NEW'), p(2, 'NEW'), p(3, 'NEW', { featuredRank: 5 }), p(4, 'NEW', { featuredRank: 1 }), p(5, 'NEW'),
      p(10, 'BESTSELLER'), p(11, 'BESTSELLER', { featuredRank: 2 }), p(12, 'BESTSELLER')];
    expect(rails(products)).toEqual({ newArrivals: [4, 3, 5, 2, 1], bestsellers: [11, 10, 12] });
    // The old hand-picked order breaks ties between unranked products.
    expect(rails(products, { legacyNewIds: [1, 5] }).newArrivals).toEqual([4, 3, 1, 5, 2]);
  });

  it('never puts a product in both rails', () => {
    const both = { ...p(9, 'NEW'), tag: 'NEW' };
    const { newArrivals, bestsellers } = homeRails([both, { ...both, tag: 'BESTSELLER' }, p(10, 'BESTSELLER')], { legacyNewIds: [] });
    expect(ids(newArrivals)).toEqual([9]);
    expect(ids(bestsellers)).toEqual([10]);
  });

  it('knows the lines under legal review (AW-001)', () => {
    expect(LEGAL_REVIEW_SUBS).toEqual(['Kratom & Kava', 'Mushroom Products', 'Detox', 'Wellness Pills']);
    expect(LEGAL_REVIEW_IDS).toEqual([28, 265, 266, 321, 322, 332]);
    expect(underLegalReview(p(75, 'NEW', { sub: 'Kratom & Kava' }))).toBe(true);
    expect(underLegalReview(p(265, 'PREMIUM', { sub: 'Honey & Energy' }))).toBe(true);
    expect(underLegalReview(p(29, null, { sub: 'Honey & Energy' }))).toBe(false);
  });

  it('features an unranked product under legal review only where the old homepage did; a staff rank still features it (AW-119, AW-001)', () => {
    const kava = (id, extra) => p(id, 'NEW', { sub: 'Kratom & Kava', ...extra });
    const products = [p(1, 'NEW'), kava(75), kava(76), p(218, 'BESTSELLER', { sub: 'Detox' }), p(10, 'BESTSELLER'), p(11, 'BESTSELLER')];
    // The old New arrivals showed #75 (in the first `limit` picks), not #76;
    // the old Bestsellers showed the first `limit` BESTSELLER products by id.
    expect(rails(products, { legacyNewIds: [1, 75, 76], limit: 2 })).toEqual({ newArrivals: [1, 75], bestsellers: [10, 11] });
    expect(rails(products, { legacyNewIds: [], limit: 2 })).toEqual({ newArrivals: [1], bestsellers: [10, 11] });
    // Where the old homepage did show it, it stays.
    expect(rails(products, { legacyNewIds: [], limit: 3 }).bestsellers).toEqual([10, 11, 218]);
    const withRanks = [p(1, 'NEW'), kava(75), kava(76, { featuredRank: 3 }), p(218, 'BESTSELLER', { sub: 'Detox', featuredRank: 1 }), p(10, 'BESTSELLER')];
    expect(rails(withRanks, { legacyNewIds: [] })).toEqual({ newArrivals: [76, 1], bestsellers: [218, 10] });
  });

  it('on the bundled catalog: New arrivals follow the NEW tag, keep the restricted product the homepage showed, and Bestsellers are unchanged', () => {
    const { newArrivals, bestsellers } = homeRails(PRODUCTS, { limit: 8, hasPhoto });
    // #342 Dubai chocolate is tagged NEW but has no photo (AW-029); #75 Wava
    // kava was the 8th old pick; #76 Mazza Shots was cut off and stays off.
    expect(ids(newArrivals)).toEqual([62, 64, 184, 75]);
    expect(ids(bestsellers)).toEqual([11, 31, 55, 56, 60, 61, 143, 162]);
    expect(ids(newArrivals).every((id) => PRODUCTS.find((x) => x.id === id).tag === 'NEW')).toBe(true);
  });
});
