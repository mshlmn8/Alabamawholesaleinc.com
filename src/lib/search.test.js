// Catalog search (AW-330, AW-063, AW-064, AW-007). Fixtures and the bundled
// catalog carry no prices.
import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../data/products.js';
import {
  getSearchMatches, matchesQuery, MIN_QUERY_LENGTH, normalizeSearchText, productText, searchProducts, stem,
} from './search.js';

const P = [
  { id: 1, name: 'Backwoods cigars', brand: 'Backwoods', cat: 'TOBACCO', sub: 'Cigars', sku: 'AW-BACKWOODS', variants: ['Honey berry'] },
  { id: 2, name: 'Honey sticks', brand: 'Farm', cat: 'CANDIES', sub: 'Candy', sku: 'AW-HONEY', variants: [] },
  { id: 3, name: 'Kite', brand: 'Kite', cat: 'TOBACCO', sub: 'Cigarettes', sku: 'AW-KITE', variants: [] },
];

const ids = (query, products = PRODUCTS) => searchProducts(products, query).items.map((p) => p.id);
const names = (query) => searchProducts(PRODUCTS, query).items.map((p) => p.name);
const byId = (id) => PRODUCTS.find((p) => p.id === id);

describe('productText', () => {
  it('joins the searchable fields in lower case', () => {
    expect(productText(P[0])).toBe('backwoods cigars backwoods tobacco cigars aw-backwoods honey berry');
  });
});

describe('normalizeSearchText and stem', () => {
  it('treats curly and straight apostrophes alike and drops them', () => {
    expect(normalizeSearchText('Reese’s')).toBe('reeses');
    expect(normalizeSearchText("reese's")).toBe('reeses');
    expect(normalizeSearchText('Hershey‘s `n´ more')).toBe('hersheys n more');
  });

  it('breaks words at every other symbol, drops accents and collapses spaces', () => {
    expect(normalizeSearchText("M&M's")).toBe('m ms');
    expect(normalizeSearchText('  AW-RED-BULL-12OZ ')).toBe('aw red bull 12oz');
    expect(normalizeSearchText('Café "Dark"/roast, 1.5 oz')).toBe('cafe dark roast 1 5 oz');
  });

  it('stems simple plurals', () => {
    expect(stem('candies')).toBe('candy');
    expect(stem('boxes')).toBe('box');
    expect(stem('peaches')).toBe('peach');
    expect(stem('disposables')).toBe('disposable');
    expect(stem('glass')).toBe('glass');
    expect(stem('gas')).toBe('gas');
    expect(stem('ss')).toBe('ss');
  });
});

describe('getSearchMatches', () => {
  it('needs at least two characters', () => {
    expect(MIN_QUERY_LENGTH).toBe(2);
    expect(getSearchMatches(P, 'k')).toEqual([]);
    expect(getSearchMatches(P, '  ')).toEqual([]);
  });

  it('ranks name matches above variant matches', () => {
    expect(getSearchMatches(P, 'honey').map(p => p.id)).toEqual([2, 1]);
  });

  it('keeps only the products that match every word (AW-063)', () => {
    expect(getSearchMatches(P, 'tobacco kite').map(p => p.id)).toEqual([3]);
  });

  it('respects the limit', () => {
    expect(getSearchMatches(P, 'aw-', 2)).toHaveLength(2);
  });
});

describe('searchProducts on the catalog', () => {
  it('spells the bundled names and brands with straight apostrophes (AW-064)', () => {
    expect(PRODUCTS.filter((p) => /[’‘]/.test(`${p.name} ${p.brand}`)).map((p) => p.id)).toEqual([]);
    expect([byId(163).name, byId(166).name]).toEqual(["M&M's", "Reese's"]);
  });

  it('finds apostrophe names however the apostrophe is typed (AW-064)', () => {
    expect(ids("reese's")[0]).toBe(166);
    expect(ids('reese’s')[0]).toBe(166);
    expect(ids('reeses')[0]).toBe(166);
    expect(ids("m&m's")[0]).toBe(163);
    expect(ids('m&m’s')[0]).toBe(163);
    expect(names('hersheys')[0]).toBe("Hershey's bars");
    expect(names('hershey’s')[0]).toBe("Hershey's bars");
  });

  it('pads a multi-word search with nothing unrelated (AW-063)', () => {
    const geek = searchProducts(PRODUCTS, 'geek bar').items;
    expect(geek.length).toBeGreaterThan(0);
    expect(geek.every((p) => p.brand === 'Geek Bar')).toBe(true);

    expect(ids('red bull').sort((a, b) => a - b)).toEqual([143, 144, 145, 146]);
    expect(names('red bull').some((n) => /24\/7|4K|Airheads/.test(n))).toBe(false);

    const swisher = searchProducts(PRODUCTS, 'swisher sweets').items;
    expect(swisher.length).toBeGreaterThan(0);
    expect(swisher.every((p) => p.brand === 'Swisher Sweets')).toBe(true);
    const owl = searchProducts(PRODUCTS, 'white owl').items;
    expect(owl.length).toBeGreaterThan(0);
    expect(owl.every((p) => p.brand === 'White Owl')).toBe(true);
  });

  it('reads a run split by symbols into single letters as one word, so it pads nothing (AW-063, AW-064)', () => {
    // Before, 'm&m' was the words m and m: every product with a word
    // starting with m (179 of them).
    for (const query of ['m&m', 'm & m', 'mms', "m&m's"]) expect(ids(query), query).toEqual([163]);
    expect(ids('b&m').sort((a, b) => a - b)).toEqual([17, 78]);
    expect(ids('24/7')).toEqual([209]);
    expect(ids('chick-o-stick')).toEqual([175]);
    expect(ids('5-pack')).toEqual(ids('5 pack'));
    expect(ids('5-pack').length).toBeGreaterThan(1);
    expect(ids('v-neck').sort((a, b) => a - b)).toEqual([151, 152]);
    expect(ids('AW-B-M-5PK')[0]).toBe(78);
    expect(ids('geek bar pulse x')).toEqual([61]);
  });

  it('leaves out "and" when the query has other words (names write "&")', () => {
    expect(ids('black and mild').sort((a, b) => a - b)).toEqual([17, 78]);
    expect(searchProducts(PRODUCTS, 'black and mild').related).toBe(false);
    expect(ids('now and later').length).toBeGreaterThan(0);
    expect(ids('now and later').every((id) => /Now and Later/.test(byId(id).name))).toBe(true);
  });

  it('matches spacing variants of names and SKUs (AW-064)', () => {
    expect(ids('redbull')).toEqual(expect.arrayContaining([143, 144, 145, 146]));
    expect(byId(143).sku).toBe('AW-RED-BULL-12OZ');
    expect(ids('geekbar').length).toBeGreaterThan(0);
  });

  it('puts an exact SKU first and matches SKU words at their start (AW-063)', () => {
    const ss = names('ss');
    expect(ids('ss')[0]).toBe(1);
    expect(ss.some((n) => /tissue|glass cleaner/i.test(n))).toBe(false);
    expect(ids('AW-KITE')[0]).toBe(14);
    expect(ids('aw-kite')[0]).toBe(14);
  });

  it('treats plurals and singulars alike (AW-064)', () => {
    expect(ids('disposables').length).toBeGreaterThan(0);
    expect(ids('disposables')).toEqual(ids('disposable'));
    const candy = ids('candy');
    expect(candy.length).toBeGreaterThanOrEqual(50);
    for (const p of PRODUCTS.filter((x) => x.cat === 'CANDIES')) expect(candy).toContain(p.id);
  });

  it('tolerates one typo when nothing matches exactly (AW-064)', () => {
    const result = searchProducts(PRODUCTS, 'snikers');
    expect(result.items.map((p) => p.brand)).toContain('Snickers');
    expect(result.related).toBe(false);
  });

  it('finds nothing for brands the catalog does not carry', () => {
    for (const query of ['marlboro', 'juul']) {
      expect(searchProducts(PRODUCTS, query)).toEqual({ items: [], total: 0, related: false, tooShort: false });
    }
  });

  it('falls back to related products, flagged, when no product matches every word', () => {
    const result = searchProducts(PRODUCTS, 'red bull marlboro');
    expect(result.related).toBe(true);
    expect(result.items.slice(0, 4).map((p) => p.id).sort((a, b) => a - b)).toEqual([143, 144, 145, 146]);
  });

  it('says a one-character query is too short', () => {
    expect(searchProducts(PRODUCTS, 'a')).toEqual({ items: [], total: 0, related: false, tooShort: true });
    expect(searchProducts(PRODUCTS, ' a ').tooShort).toBe(true);
  });

  it('finds every word the site suggests in its tips and placeholders (AW-064)', () => {
    for (const query of ['Geekbar', 'Backwoods', 'BIC', 'energy drinks', 'wraps', 'cigars', 'candy', 'drinks', 'disposables', 'AW-KITE']) {
      expect(searchProducts(PRODUCTS, query).total, query).toBeGreaterThan(0);
    }
  });

  it('reports the total apart from a limited list (AW-007)', () => {
    const all = searchProducts(PRODUCTS, 'cigar');
    expect(all.total).toBeGreaterThanOrEqual(30);
    expect(all.items).toHaveLength(all.total);
    const some = searchProducts(PRODUCTS, 'cigar', { limit: 8 });
    expect(some.items).toHaveLength(8);
    expect(some.total).toBe(all.total);
    expect(some.items).toEqual(all.items.slice(0, 8));
    expect(getSearchMatches(PRODUCTS, 'cigar', 8)).toEqual(some.items);
  });
});

describe('matchesQuery', () => {
  it('filters one product at a time with the strict or typo rule', () => {
    const reeses = byId(166);
    expect(matchesQuery(reeses, "reese's")).toBe(true);
    expect(matchesQuery(reeses, 'reese’s')).toBe(true);
    expect(matchesQuery(reeses, 'chocolate')).toBe(true);
    expect(matchesQuery(reeses, 'kite')).toBe(false);
    expect(matchesQuery(byId(162), 'snikers')).toBe(true);
    expect(matchesQuery(byId(14), 'aw-kite')).toBe(true);
    // The department page's box reads "m&m" the same way (Mentos is #43).
    expect(matchesQuery(byId(163), 'm&m')).toBe(true);
    expect(matchesQuery(byId(43), 'm&m')).toBe(false);
  });

  it('accepts any length, and a query with no words matches everything', () => {
    expect(matchesQuery(byId(14), 'k')).toBe(true);
    expect(matchesQuery(byId(14), '-')).toBe(true);
  });
});
