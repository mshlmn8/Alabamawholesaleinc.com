// Money and label formatting (AW-184, AW-330). Amounts are test numbers, not
// catalog prices.
import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyShort, catLabel, brandLabel } from './format.js';

describe('formatMoney', () => {
  it('adds thousands separators and always shows cents', () => {
    expect(formatMoney(1807.66)).toBe('$1,807.66');
    expect(formatMoney(2166.97)).toBe('$2,166.97');
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney(500)).toBe('$500.00');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('accepts numeric strings', () => {
    expect(formatMoney('40')).toBe('$40.00');
  });

  it('rounds a half cent up, the way the decimal amount reads', () => {
    // toFixed(2) gave $42.84 here because 42.845 is stored just below the half.
    expect(formatMoney(42.845)).toBe('$42.85');
    expect(formatMoney(18.9905)).toBe('$18.99');
  });
});

describe('formatMoneyShort', () => {
  it('drops cents for round amounts in copy', () => {
    expect(formatMoneyShort(1500)).toBe('$1,500');
    expect(formatMoneyShort(500)).toBe('$500');
  });
});

describe('catLabel', () => {
  it('maps department keys to their display names', () => {
    expect(catLabel('NOVELTIES')).toBe('Novelties & Vapes');
    expect(catLabel('DRINKS & BAGS')).toBe('Drinks & Bags');
  });

  it('shows an unknown key as it is', () => {
    expect(catLabel('SEASONAL')).toBe('SEASONAL');
  });
});

describe('brandLabel (AW-286)', () => {
  it('prints a real brand and drops the placeholder "Assorted"', () => {
    expect(brandLabel('Coca-Cola')).toBe('Coca-Cola');
    expect(brandLabel(' Candyman\'s ')).toBe('Candyman\'s');
    expect(brandLabel('Assorted')).toBe('');
    expect(brandLabel(null)).toBe('');
  });
});
