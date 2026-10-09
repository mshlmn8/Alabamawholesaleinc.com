// Catalog search (AW-063, AW-064, AW-007): one matcher for the header
// dropdown, the /search results page, the not-found page's search and the
// department page's "Search in …" box.
//
// Text is normalized the same way on both sides: accents dropped, lower
// case, curly and straight apostrophes removed ("Reese’s", "reese's" and
// "reeses" are one word), every other symbol a word break, simple plurals
// stemmed ("disposables" finds "Disposable Vapes", "candy" the Candies
// department). A run of text whose symbols split off a single letter or
// digit is also one word without them, on both sides ("m&m" finds M&M's
// and nothing else, "5-pack", "24/7"), and "and" is left out of a query
// that has other words (names write "&": "black and mild").
// Results come from the first of three tiers that has any:
//   strict   every query word starts a word of the product (so "ss" no
//            longer hits "tissue"), or the query without spaces starts the
//            name or brand or sits inside a SKU ("redbull", "awkite");
//   typo     as strict, but a word of 4+ letters may be one edit away
//            from a word with the same first letter ("snikers" finds
//            Snickers);
//   related  any one query word matches; flagged `related`.
// Inside a tier, an exact SKU comes first, then name, brand, SKU,
// department/line and variant matches (a whole word in the name before the
// start of one: "cigar" lists cigars before cigarettes), then the name.
//
// Pure and Node-safe: no React, no DOM. The prepared search records are
// cached per products array and per product (WeakMaps), so typing re-reads
// nothing but the query.

import { catLabel } from './format.js';
import { variantList, variantSku } from './lines.js';

// Shorter queries list nothing (the header and /search say so).
export const MIN_QUERY_LENGTH = 2;
// A query without its spaces must be this long to match a name, brand or
// SKU by its letters alone ('redbull', 'geekbar', 'awkite').
const COMPACT_MIN = 4;
// Query words this long may be one typo away from a product word.
const TYPO_MIN = 4;

// The old searchable text, kept for callers outside the storefront pages.
export const productText = (p) => `${p.name} ${p.brand} ${p.cat} ${p.sub} ${p.sku} ${(p.variants || []).join(' ')}`.toLowerCase();

// "M&M’s Café-style" -> 'm ms cafe style'.
export function normalizeSearchText(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/'/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Simple English plurals: candies -> candy, boxes -> box, bars -> bar. Both
// the query and the product words are stemmed, so they meet in the middle.
export function stem(word) {
  if (word.length > 3 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(?:s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

const wordsOf = (text) => normalizeSearchText(text).split(' ').filter(Boolean);
const compactOf = (normalized) => normalized.replace(/ /g, '');
// The words of one run of text between spaces; when its symbols split off
// a single letter or digit ("M&M's", "5-pack", "24/7", "AW-B-M-5PK") the
// run is one word too, written without them: 'mms', '5pack', '247'.
const chunksOf = (text) => String(text ?? '').split(/\s+/).map(wordsOf).filter((parts) => parts.length > 0);
const joinsSingles = (parts) => parts.length > 1 && parts.some((part) => part.length === 1);
// SKUs carry the house prefix: 'AW-SS' is also found as 'ss'.
const withoutPrefix = (compact) => (compact.startsWith('aw') ? compact.slice(2) : compact);
// A product word as written and as stemmed: 'case' still starts 'cases'
// when the stem is 'cas'. With `sku`, a joined run also without the house
// prefix ('bm5pk' from AW-B-M-5PK).
const tokensOf = (texts, { sku = false } = {}) => {
  const out = new Set();
  const add = (word) => {
    if (!word) return;
    out.add(word);
    out.add(stem(word));
  };
  for (const text of texts) {
    for (const parts of chunksOf(text)) {
      parts.forEach(add);
      if (!joinsSingles(parts)) continue;
      const joined = parts.join('');
      add(joined);
      if (sku) add(withoutPrefix(joined));
    }
  }
  return [...out];
};

// Where a query word matched, as bits.
const NAME = 1;
const BRAND = 2;
const SKU = 4;
const DEPT = 8;
const VARIANT = 16;

const byProduct = new WeakMap();
const byList = new WeakMap();

function prepare(product) {
  const cached = byProduct.get(product);
  if (cached) return cached;
  const variants = variantList(product);
  const name = normalizeSearchText(product.name);
  const brand = normalizeSearchText(product.brand);
  const skuCompact = compactOf(normalizeSearchText(product.sku));
  const nameTokens = tokensOf([product.name]);
  const record = {
    product,
    name,
    nameCompact: compactOf(name),
    nameWords: new Set(nameTokens),
    brandCompact: compactOf(brand),
    skuCompact,
    skuBare: withoutPrefix(skuCompact),
    variantSkus: variants.map((v) => compactOf(normalizeSearchText(variantSku(product.sku, v)))),
    fields: [
      [NAME, nameTokens],
      // The stored brand, so the placeholder "Assorted" still matches.
      [BRAND, tokensOf([product.brand])],
      [SKU, tokensOf([product.sku], { sku: true })],
      [DEPT, tokensOf([product.cat, catLabel(product.cat), product.sub])],
      [VARIANT, tokensOf(variants)],
    ],
  };
  byProduct.set(product, record);
  return record;
}

function recordsFor(products) {
  if (!Array.isArray(products)) return [];
  let records = byList.get(products);
  if (!records) {
    records = products.map(prepare);
    byList.set(products, records);
  }
  return records;
}

// The words a query is matched by. A run that splits off single letters or
// digits is one word ("m&m" -> 'mm', which starts the 'mms' of M&M's, not
// every word starting with m); single letters typed apart are one word too
// ("m & m"); "and" is dropped when there are other words.
function queryWords(text) {
  const words = [];
  for (const parts of chunksOf(text)) {
    if (joinsSingles(parts)) words.push(parts.join(''));
    else words.push(...parts);
  }
  if (words.length > 1 && words.every((word) => word.length === 1)) return [words.join('')];
  const kept = words.filter((word) => word !== 'and');
  return kept.length ? kept : words;
}

let lastQuery = null;
function parseQuery(query) {
  const raw = String(query ?? '');
  if (lastQuery?.raw === raw) return lastQuery;
  const text = raw.trim();
  const norm = normalizeSearchText(text);
  const words = queryWords(text);
  lastQuery = {
    raw,
    tooShort: text.length < MIN_QUERY_LENGTH,
    norm,
    compact: compactOf(norm),
    terms: words.map((word) => ({ word, stem: stem(word) })),
  };
  return lastQuery;
}

// Damerau (optimal string alignment) distance of at most 1.
function withinOneEdit(a, b) {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    // One substitution, or two neighbours swapped.
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  // One letter more on the longer side.
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

// A query word matches a product word its stem starts, or, in the typo tier,
// a product word one edit away from the word as typed, with the same first
// letter ('snikers' -> 'snickers', but not 'king' -> 'pink'). Typos are
// measured on the typed word: a stem can be short ('reeses' -> 'rees'),
// and one edit from it reaches unrelated words ('reds').
function termMatchesToken(term, token, typo) {
  if (token.startsWith(term.stem)) return true;
  return typo && term.word.length >= TYPO_MIN && token[0] === term.word[0] && withinOneEdit(term.word, token);
}

// The fields (bits) a query word matches in.
function fieldsFor(record, term, typo) {
  let bits = 0;
  for (const [bit, tokens] of record.fields) {
    if (tokens.some((token) => termMatchesToken(term, token, typo))) bits |= bit;
  }
  return bits;
}

// How a record matches a parsed query in one tier, or null.
function evaluate(record, q, tier) {
  const typo = tier === 'typo';
  const hits = q.terms.map((term) => fieldsFor(record, term, typo));
  const compact = q.compact.length >= COMPACT_MIN ? q.compact : '';
  const compactName = !!compact && record.nameCompact.startsWith(compact);
  const compactBrand = !!compact && record.brandCompact.startsWith(compact);
  const compactSku = !!compact && (record.skuCompact.includes(compact) || record.variantSkus.some((s) => s.includes(compact)));
  const every = hits.length > 0 && hits.every(Boolean);
  const matched = tier === 'related' ? hits.some(Boolean) : every || compactName || compactBrand || compactSku;
  if (!matched) return null;

  const all = (bit) => hits.length > 0 && hits.every((h) => h & bit);
  const any = (bit) => hits.some((h) => h & bit);
  let score = 0;
  if (q.compact === record.skuCompact || q.compact === record.skuBare
      || record.variantSkus.some((s) => s === q.compact || withoutPrefix(s) === q.compact)) score += 200;
  if (record.name.startsWith(q.norm) || compactName) score += 100;
  if (all(NAME) || compactName) score += 60;
  if (hits.length > 0 && q.terms.every((t) => record.nameWords.has(t.word) || record.nameWords.has(t.stem))) score += 10;
  if (all(BRAND) || compactBrand) score += 40;
  if (any(SKU) || compactSku) score += 30;
  if (any(DEPT)) score += 15;
  if (any(VARIANT)) score += 5;
  return { product: record.product, score };
}

const TIERS = ['strict', 'typo', 'related'];

// { items, total, related, tooShort }: the products matching `query`, best
// first; `total` counts them all, `items` holds up to `limit`. `related` is
// true when no product matched every word and these match some of them.
export function searchProducts(products, query, { limit = Infinity } = {}) {
  const q = parseQuery(query);
  const none = { items: [], total: 0, related: false, tooShort: q.tooShort };
  if (q.tooShort || q.terms.length === 0) return none;
  const records = recordsFor(products);
  for (const tier of TIERS) {
    const found = [];
    for (const record of records) {
      const hit = evaluate(record, q, tier);
      if (hit) found.push(hit);
    }
    if (!found.length) continue;
    found.sort((a, b) => b.score - a.score || String(a.product.name).localeCompare(String(b.product.name)));
    return {
      items: found.slice(0, limit).map((hit) => hit.product),
      total: found.length,
      related: tier === 'related',
      tooShort: false,
    };
  }
  return none;
}

// Whether one product matches `query` (strict or typo tier), for filtering a
// list that is already narrowed (the department page). Any length counts; a
// query with no words matches everything.
export function matchesQuery(product, query) {
  const q = parseQuery(query);
  if (q.terms.length === 0) return true;
  const record = prepare(product);
  return !!(evaluate(record, q, 'strict') || evaluate(record, q, 'typo'));
}

// The best matches, at most `limit` (the not-found page lists 8).
export const getSearchMatches = (products, query, limit = 10) => searchProducts(products, query, { limit }).items;
