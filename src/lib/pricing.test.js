// The pricing adapter over my_prices() (AW-003, AW-077, AW-351). Replaces the
// Phase 1 tests that froze the old in-browser tier discounts. Every amount
// here is a test value (the 45.10 case is the worked example from AW-077),
// not a catalog price.
import { describe, expect, it, vi } from 'vitest';
import {
  MISSING_FUNCTION_CODES, PRICE_FAILED, PRICE_LOADING, PRICE_ON_REQUEST, fromCents, lineTotal, loadPrices, normalizePrices,
  priceFor, priceLabel, pctText, sumLines, tierDiscountText, tierName, tierPriceNote, tierUnitPrice, toCents, totalLabel, variantPriceRange,
} from './pricing.js';
import * as pricing from './pricing.js';

describe('the old in-browser discounts are gone (AW-351)', () => {
  it('exports no tier table and no profile-based price', () => {
    expect(pricing.TIER_DISCOUNT).toBeUndefined();
    expect(pricing.priceForProfile).toBeUndefined();
  });
});

describe('toCents and fromCents', () => {
  it('turns amounts into whole cents and back', () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents('0.10')).toBe(10);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(0)).toBe(0);
    expect(toCents(null)).toBeNull();
    expect(toCents('')).toBeNull();
    expect(toCents('abc')).toBeNull();
    expect(fromCents(1234)).toBe(12.34);
    expect(fromCents(null)).toBeNull();
  });
});

describe('tierUnitPrice', () => {
  it('rounds half a cent up, as Postgres round() does in the order trigger (AW-077)', () => {
    // 45.10 less 5% is 42.845: toFixed(2) says 42.84, the server saves 42.85.
    expect((45.10 * 0.95).toFixed(2)).toBe('42.84');
    expect(tierUnitPrice(45.10, 5)).toBe(42.85);
    expect(tierUnitPrice(10.10, 5)).toBe(9.60);
    expect(tierUnitPrice(11.10, 5)).toBe(10.55);
    expect(tierUnitPrice(11.10, 12.5)).toBe(9.71);
  });

  it('matches the integer formula for every cent up to 50.00 at 5% and 10%', () => {
    for (let cents = 0; cents <= 5000; cents += 1) {
      for (const pct of [5, 10]) {
        const exact = Math.floor((2 * cents * (100 - pct) + 100) / 200); // half up, all in integers
        expect(toCents(tierUnitPrice(cents / 100, pct))).toBe(exact);
      }
    }
  });

  it('is the list price with no discount, and null without a list price', () => {
    expect(tierUnitPrice(12.34, 0)).toBe(12.34);
    expect(tierUnitPrice(12.34, null)).toBe(12.34);
    expect(tierUnitPrice('12.34', '5.00')).toBe(11.72);
    expect(tierUnitPrice(null, 5)).toBeNull();
    expect(tierUnitPrice(undefined, 5)).toBeNull();
  });
});

describe('lineTotal and sumLines', () => {
  it('multiplies in cents, so each x quantity is the line total (AW-077)', () => {
    const unit = tierUnitPrice(45.10, 5);
    expect(lineTotal(unit, 7)).toBe(299.95);
    expect(lineTotal(0.1, 3)).toBe(0.3);
    expect(lineTotal(null, 3)).toBeNull();
  });

  it('adds up the priced lines only', () => {
    const items = [
      { price: 42.85, qty: 7 },
      { price: 0.1, qty: 3 },
      { price: null, qty: 5 },
      { price: 12.34, qty: 0 },
    ];
    expect(sumLines(items)).toBe(300.25);
    expect(sumLines([])).toBe(0);
    expect(sumLines(null)).toBe(0);
  });
});

const PAYLOAD = {
  tier: 'silver',
  tier_label: 'Test silver',
  discount_pct: 5,
  products: {
    1: { list: 10.10, unit: 9.60, variants: {} },
    2: { list: null, unit: null, variants: {} },
    3: { list: 20.00, unit: 19.00, variants: { 'White grape': { list: 30.00, unit: 28.50 } } },
  },
};

describe('normalizePrices and priceFor', () => {
  it('reads my_prices() into a map by product id', () => {
    const prices = normalizePrices(PAYLOAD);
    expect(prices).toMatchObject({ tier: 'silver', tierLabel: 'Test silver', discountPct: 5 });
    expect(prices.byId.size).toBe(3);
    expect(priceFor(prices, 1)).toEqual({ list: 10.10, unit: 9.60 });
    expect(priceFor(prices, '1', null)).toEqual({ list: 10.10, unit: 9.60 });
    expect(priceFor(prices, 2)).toEqual({ list: null, unit: null });
    expect(priceFor(prices, 99)).toBeNull();
  });

  it('lets a variant’s own price win, by label or slug, and falls back to the product’s', () => {
    const prices = normalizePrices(PAYLOAD);
    expect(priceFor(prices, 3, 'White grape')).toEqual({ list: 30.00, unit: 28.50 });
    expect(priceFor(prices, 3, 'white-grape')).toEqual({ list: 30.00, unit: 28.50 });
    expect(priceFor(prices, 3, 'Diamond')).toEqual({ list: 20.00, unit: 19.00 });
  });

  it('gives no prices for no payload (an account that isn’t approved)', () => {
    expect(normalizePrices(null)).toBeNull();
    expect(priceFor(null, 1)).toBeNull();
  });

  it('reads string amounts and rounds them to cents', () => {
    const prices = normalizePrices({ tier: 'standard', discount_pct: '0.00', products: { 7: { list: '12.340', unit: '12.34' } } });
    expect(prices.discountPct).toBe(0);
    expect(priceFor(prices, 7)).toEqual({ list: 12.34, unit: 12.34 });
  });
});

// A stand-in for supabase-js: rpc() answers with `rpc()`, from() serves
// `products` (at most pageLimit rows a request) and `tiers`.
function fakeClient({ rpc, products = [], tiers = [], tiersError = null, pageLimit = Infinity } = {}) {
  const calls = [];
  const builder = (table) => {
    const q = { table, columns: null, options: null, filters: [], range: null };
    const b = {
      select(columns, options) { q.columns = columns; q.options = options; return b; },
      eq(column, value) { q.filters.push([column, value]); return b; },
      order() { return b; },
      range(from, to) { q.range = [from, to]; return b; },
      abortSignal() { return b; },
      then(resolve, reject) {
        calls.push(q);
        let answer;
        if (table === 'pricing_tiers') answer = { data: tiersError ? null : tiers, error: tiersError };
        else {
          const [from, to] = q.range || [0, products.length - 1];
          const end = Math.min(to, from + pageLimit - 1);
          answer = { data: products.slice(from, end + 1), error: null, count: q.options?.count ? products.length : null };
        }
        return Promise.resolve(answer).then(resolve, reject);
      },
    };
    return b;
  };
  return {
    calls,
    rpc: vi.fn((fn, args, options) => {
      calls.push({ rpc: fn, args, options });
      const b = { abortSignal() { return b; }, then: (resolve, reject) => Promise.resolve().then(rpc).then(resolve, reject) };
      return b;
    }),
    from: vi.fn(builder),
  };
}

const APPROVED = { id: 'u1', status: 'approved', pricing_tier: 'silver' };

describe('loadPrices', () => {
  it('reads my_prices() with a GET', async () => {
    const client = fakeClient({ rpc: () => ({ data: PAYLOAD, error: null }) });
    const result = await loadPrices(client, { profile: APPROVED });
    expect(result).toMatchObject({ ok: true, source: 'rpc', error: null });
    expect(priceFor(result.prices, 1).unit).toBe(9.60);
    expect(client.calls).toEqual([{ rpc: 'my_prices', args: {}, options: { get: true } }]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('gives null prices when my_prices() says the account isn’t approved', async () => {
    const client = fakeClient({ rpc: () => ({ data: null, error: null }) });
    expect(await loadPrices(client, { profile: APPROVED })).toEqual({ ok: true, prices: null, source: 'rpc', error: null });
  });

  it('reports other errors without trying the legacy path, and never throws', async () => {
    const error = { code: '42501', message: 'permission denied for function my_prices' };
    const client = fakeClient({ rpc: () => ({ data: null, error }) });
    expect(await loadPrices(client, { profile: APPROVED })).toEqual({ ok: false, prices: null, source: 'rpc', error });
    expect(client.from).not.toHaveBeenCalled();
    const throwing = fakeClient({ rpc: () => { throw new TypeError('Failed to fetch'); } });
    expect((await loadPrices(throwing, { profile: APPROVED })).ok).toBe(false);
    expect((await loadPrices(null)).ok).toBe(false);
  });

  it.each(MISSING_FUNCTION_CODES)('on a database without my_prices() (%s), works the prices out from the table and the tier', async (code) => {
    const client = fakeClient({
      rpc: () => ({ data: null, error: { code, message: 'Could not find the function public.my_prices' } }),
      products: [{ id: 1, price: 45.10 }, { id: 2, price: null }, { id: 3, price: '10.10' }],
      tiers: [{ tier: 'standard', discount_pct: 0, label: 'Standard' }, { tier: 'silver', discount_pct: 5, label: 'Test silver' }],
      pageLimit: 2,
    });
    const result = await loadPrices(client, { profile: APPROVED, pageSize: 2 });
    expect(result).toMatchObject({ ok: true, source: 'legacy', error: null });
    expect(result.prices).toMatchObject({ tier: 'silver', tierLabel: 'Test silver', discountPct: 5 });
    expect(priceFor(result.prices, 1)).toEqual({ list: 45.10, unit: 42.85 });
    expect(priceFor(result.prices, 2)).toEqual({ list: null, unit: null });
    expect(priceFor(result.prices, 3)).toEqual({ list: 10.10, unit: 9.60 });
    const reads = client.calls.filter((c) => c.table === 'products');
    expect(reads.map((q) => q.range)).toEqual([[0, 1], [2, 3]]);
    expect(reads.every((q) => q.columns === 'id,price' && q.filters.some(([c, v]) => c === 'active' && v === true))).toBe(true);
  });

  it('legacy: no prices for an account that isn’t approved, list price for a tier without a row, and a failed tier read fails', async () => {
    const missing = () => ({ data: null, error: { code: 'PGRST202', message: 'missing' } });
    const pending = fakeClient({ rpc: missing, products: [{ id: 1, price: 10 }] });
    expect(await loadPrices(pending, { profile: { ...APPROVED, status: 'pending' } })).toEqual({ ok: true, prices: null, source: 'legacy', error: null });
    expect(pending.from).not.toHaveBeenCalled();
    const noRow = fakeClient({ rpc: missing, products: [{ id: 1, price: 12.34 }], tiers: [] });
    expect(priceFor((await loadPrices(noRow, { profile: APPROVED })).prices, 1)).toEqual({ list: 12.34, unit: 12.34 });
    const tiersError = { code: '42501', message: 'denied' };
    const failed = fakeClient({ rpc: missing, products: [{ id: 1, price: 12.34 }], tiersError });
    expect(await loadPrices(failed, { profile: APPROVED })).toEqual({ ok: false, prices: null, source: 'legacy', error: tiersError });
  });
});

describe('variantPriceRange (AW-030)', () => {
  it('gives the shared price, or the lowest with "from" when variants differ', () => {
    expect(variantPriceRange([12.25, 12.25])).toEqual({ unit: 12.25, from: false });
    expect(variantPriceRange([13.5, 12.25, 20.1])).toEqual({ unit: 12.25, from: true });
    // Some on request: the lowest priced one, as a "from" price.
    expect(variantPriceRange([null, 12.25])).toEqual({ unit: 12.25, from: true });
    expect(variantPriceRange([null, null])).toEqual({ unit: null, from: false });
    expect(variantPriceRange([])).toEqual({ unit: null, from: false });
    // Compared in cents, so float noise is not a difference.
    expect(variantPriceRange([0.1 + 0.2, 0.3])).toEqual({ unit: 0.3, from: false });
  });
});

describe('the tier, in words (AW-107, AW-265)', () => {
  it('names the tier from its key, and writes the discount as a percentage', () => {
    expect(tierName('silver')).toBe('Silver');
    expect(tierName('gold')).toBe('Gold');
    expect(tierName('key_account-b')).toBe('Key account b');
    expect(tierName(null)).toBe('');
    expect(tierName('')).toBe('');
    expect(pctText(5)).toBe('5%');
    expect(pctText('5.00')).toBe('5%');
    expect(pctText(2.5)).toBe('2.5%');
    expect(pctText(12.25)).toBe('12.25%');
    expect(pctText(null)).toBe('0%');
    expect(pctText('abc')).toBe('');
  });

  it('says the tier and its discount off list, or the tier alone without one', () => {
    expect(tierDiscountText({ tier: 'silver', label: 'Silver (5% off)', discountPct: 5 })).toBe('Silver · 5% off list');
    expect(tierDiscountText({ tier: 'p4-test', discountPct: 12.5 })).toBe('P4 test · 12.5% off list');
    expect(tierDiscountText({ tier: 'standard', label: 'Standard', discountPct: 0 })).toBe('Standard');
    expect(tierDiscountText({ tier: null, discountPct: 5 })).toBe('5% off list');
    expect(tierDiscountText(null)).toBe('');
  });

  it('captions the cards with the same server values, or says only that the prices are the account’s', () => {
    expect(tierPriceNote({ tier: 'silver', discountPct: 5 })).toBe('Prices shown are your Silver tier prices, 5% off list.');
    expect(tierPriceNote({ tier: 'standard', discountPct: 0 })).toBe('Prices shown are your Standard tier prices.');
    expect(tierPriceNote(null)).toBe('Prices shown are your account prices.');
  });

  it('reads the tier from my_prices(), with no tier table of its own', () => {
    const prices = normalizePrices({ tier: 'gold', tier_label: 'Gold (10% off)', discount_pct: '10.00', products: {} });
    expect(tierDiscountText({ tier: prices.tier, label: prices.tierLabel, discountPct: prices.discountPct })).toBe('Gold · 10% off list');
  });
});

describe('priceLabel and totalLabel', () => {
  it('shows the price, or why there is none', () => {
    expect(priceLabel(12.34, 'ready')).toBe('$12.34');
    expect(priceLabel(0, 'ready')).toBe('$0.00');
    expect(priceLabel(null, 'loading')).toBe(PRICE_LOADING);
    expect(priceLabel(null, 'error')).toBe(PRICE_FAILED);
    expect(priceLabel(null, 'ready')).toBe(PRICE_ON_REQUEST);
    expect(PRICE_ON_REQUEST).toBe('Price on request');
    expect(PRICE_LOADING).toBe('Loading price…');
    expect(priceLabel(12.34, 'ready', { from: true })).toBe('From $12.34');
    expect(priceLabel(null, 'loading', { from: true })).toBe(PRICE_LOADING);
  });

  it('shows the total once a line has a price, and says why otherwise', () => {
    const priced = [{ price: 12.34, qty: 2 }, { price: null, qty: 1 }];
    expect(totalLabel(priced, 24.68, 'ready')).toBe('$24.68');
    const unpriced = [{ price: null, qty: 1 }, { price: 5, qty: 1, unavailable: 'product' }];
    expect(totalLabel(unpriced, 0, 'loading')).toBe('Loading prices…');
    expect(totalLabel(unpriced, 0, 'error')).toBe('Prices didn’t load');
    expect(totalLabel(unpriced, 0, 'ready')).toBe('Price on request');
    expect(totalLabel([], 0, 'loading')).toBe('$0.00');
  });

  it('looks only at the lines in the total: a line waiting for its variant doesn’t count (AW-103)', () => {
    const waiting = [{ price: 5, qty: 1, needsVariant: true }, { price: null, qty: 2 }];
    expect(totalLabel(waiting, 0, 'loading')).toBe('Loading prices…');
    expect(totalLabel([{ price: 5, qty: 1, needsVariant: true }], 0, 'ready')).toBe('$0.00');
  });
});
