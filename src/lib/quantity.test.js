// One quantity rule (AW-013, AW-100): whole numbers from 1 to the database's
// 100,000.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_QTY, MIN_QTY, QTY_RANGE_TEXT, addableQty, clampQty, isOrderableQty, maxPerLineText, qtyRangeText, readQty } from './quantity.js';

describe('the quantity limits', () => {
  it('are 1 and the order_items trigger’s 100,000', () => {
    expect([MIN_QTY, MAX_QTY]).toEqual([1, 100000]);
    const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261009110000_variant_model.sql'), 'utf8');
    expect(sql).toContain(`new.qty > ${MAX_QTY} then`);
  });

  it('read as a sentence', () => {
    expect(QTY_RANGE_TEXT).toBe('a whole number from 1 to 100,000');
    expect(qtyRangeText(1, 2500)).toBe('a whole number from 1 to 2,500');
    expect(maxPerLineText()).toBe('The most per line is 100,000.');
  });
});

describe('readQty', () => {
  it('accepts digits only, trimmed', () => {
    expect(readQty('48')).toEqual({ qty: 48, problem: null });
    expect(readQty(' 7 ')).toEqual({ qty: 7, problem: null });
    expect(readQty('007')).toEqual({ qty: 7, problem: null });
    expect(readQty(12)).toEqual({ qty: 12, problem: null });
    expect(readQty('100000')).toEqual({ qty: 100000, problem: null });
  });

  it('names the problem, with no quantity', () => {
    const problem = (text) => {
      const { qty, problem: p } = readQty(text);
      expect(qty, String(text)).toBeNull();
      return p;
    };
    expect(['', '  ', null, undefined].map(problem)).toEqual(Array(4).fill('empty'));
    expect(['2.5', '1e3', '-1', '+3', 'abc', '4 5', '1,000', 2.5, 1e21, NaN].map(problem)).toEqual(Array(10).fill('not-whole'));
    expect(['0', '000', 0].map(problem)).toEqual(Array(3).fill('too-small'));
    expect(['100001', '150000', '99999999999999999999', 1e9].map(problem)).toEqual(Array(4).fill('too-large'));
  });
});

describe('clampQty, isOrderableQty and addableQty', () => {
  it('clamps into range, rounding down', () => {
    expect([1, 48, 2.9, 0, -5, 1e9, Infinity, NaN, '12'].map(clampQty)).toEqual([1, 48, 2, 1, 1, 100000, 100000, 1, 12]);
  });

  it('says whether a line can be sent as it is', () => {
    expect([1, 48, 100000].every(isOrderableQty)).toBe(true);
    expect([0, -1, 2.5, 100001, NaN, '3', null].some(isOrderableQty)).toBe(false);
  });

  it('caps an add at the limit and refuses anything that is not a whole number of 1 or more', () => {
    expect([3, '3', 150000, '1000000'].map(addableQty)).toEqual([3, 3, 100000, 100000]);
    expect([0, 1.7, '2.5', -1, '', null, 'x'].map(addableQty)).toEqual(Array(7).fill(null));
  });
});
