// The homepage rails (AW-119): tags choose, the homepage rank orders, a
// product is in one rail only, and the AW-001 status-quo guard. The
// department pages' Featured sort (AW-227) follows the same rank and guard.
import { describe, expect, it } from 'vitest';
import { LEGAL_REVIEW_IDS, LEGAL_REVIEW_SUBS, TAG_RANK, featuredOrder, homeRails, underLegalReview } from './merchandising.js';
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
    // The old New arrivals showed #75 (in the first `legacyLimit` picks), not
    // #76; the old Bestsellers showed the first `legacyLimit` BESTSELLER
    // products by id.
    expect(rails(products, { legacyNewIds: [1, 75, 76], limit: 2, legacyLimit: 2 })).toEqual({ newArrivals: [1, 75], bestsellers: [10, 11] });
    expect(rails(products, { legacyNewIds: [1, 75, 76], limit: 3, legacyLimit: 2 }).newArrivals).toEqual([1, 75]);
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

  it('on the bundled catalog, one row of four (AW-060): the guard still compares with the old 8-card homepage', () => {
    const { newArrivals, bestsellers } = homeRails(PRODUCTS, { limit: 4, hasPhoto });
    expect(ids(newArrivals)).toEqual([62, 64, 184, 75]);
    expect(ids(bestsellers)).toEqual([11, 31, 55, 56]);
  });
});

describe('featuredOrder (AW-227)', () => {
  it('ranks the tags BESTSELLER, NEW, DEAL, PREMIUM, then untagged', () => {
    expect(TAG_RANK).toEqual({ BESTSELLER: 0, NEW: 1, DEAL: 2, PREMIUM: 3 });
    const products = [p(1, null), p(2, 'PREMIUM'), p(3, 'DEAL'), p(4, 'NEW'), p(5, 'BESTSELLER'), p(6, 'SOMETHING'), p(7, 'BESTSELLER')];
    expect(ids(featuredOrder(products))).toEqual([5, 7, 4, 3, 2, 1, 6]);
  });

  it('puts the homepage rank first, unranked after; then the tag, a photo before the placeholder, then id', () => {
    const products = [p(9, null), p(8, 'NEW', { img: null }), p(7, 'NEW'), p(6, null, { featuredRank: 2 }), p(5, 'BESTSELLER', { featuredRank: 1 }),
      p(4, null, { img: null }), p(3, null), p(2, 'BESTSELLER')];
    expect(ids(featuredOrder(products))).toEqual([5, 6, 2, 7, 8, 3, 9, 4]);
    // The caller's own photo rule decides what counts as a photo.
    expect(ids(featuredOrder([p(1, null), p(2, null)], { hasPhoto: (x) => x.id === 2 }))).toEqual([2, 1]);
  });

  it('returns a new array and leaves the list it was given alone', () => {
    const products = [p(3, null), p(2, 'NEW'), p(1, 'BESTSELLER')];
    const sorted = featuredOrder(products);
    expect(sorted).not.toBe(products);
    expect(ids(products)).toEqual([3, 2, 1]);
    expect(ids(sorted)).toEqual([1, 2, 3]);
    expect(featuredOrder(undefined)).toEqual([]);
  });

  it('gives an unranked product under legal review no lift from its tag; a staff rank still does (AW-001)', () => {
    const products = [p(75, 'NEW', { sub: 'Kratom & Kava' }), p(218, 'BESTSELLER', { sub: 'Detox' }), p(265, 'PREMIUM', { sub: 'Honey & Energy' }), p(10, null), p(11, 'DEAL')];
    expect(ids(featuredOrder(products))).toEqual([11, 10, 75, 218, 265]);
    const ranked = products.map((x) => (x.id === 218 ? { ...x, featuredRank: 1 } : x));
    expect(ids(featuredOrder(ranked))).toEqual([218, 11, 10, 75, 265]);
  });

  it('on the bundled catalog: tagged products lead each department, restricted lines excepted', () => {
    const dept = (cat) => ids(featuredOrder(PRODUCTS.filter((x) => x.cat === cat), { hasPhoto }));
    expect(dept('TOBACCO').slice(0, 3)).toEqual([11, 282, 82]);
    // #342 Dubai chocolate is NEW without a photo: the tag still comes first.
    expect(dept('CANDIES').slice(0, 6)).toEqual([162, 166, 169, 171, 184, 342]);
    // #75, #76 (Kratom & Kava) and #218 (Detox) don't jump to the top.
    const novelties = dept('NOVELTIES');
    expect(novelties.slice(0, 4)).toEqual([60, 61, 62, 64]);
    for (const id of [75, 76, 218]) expect(novelties.indexOf(id), `#${id}`).toBeGreaterThan(4);
    // The PREMIUM enhancement items (#265, #321, #332) don't either.
    const merch = dept('MERCHANDISE');
    expect(merch[0]).toBe(31);
    for (const id of [265, 321, 332]) expect(merch.indexOf(id), `#${id}`).toBeGreaterThan(1);
    // Within the untagged products, photos come before the placeholder.
    const untagged = novelties.slice(4).map((id) => PRODUCTS.find((x) => x.id === id));
    const firstPlaceholder = untagged.findIndex((x) => !hasPhoto(x));
    if (firstPlaceholder >= 0) expect(untagged.slice(firstPlaceholder).every((x) => !hasPhoto(x))).toBe(true);
  });
});
