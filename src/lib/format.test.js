// Money and label formatting (AW-184, AW-330). Amounts are test numbers, not
// catalog prices.
import { describe, expect, it } from 'vitest';
import { SHARED_PHOTO_NOTE, formatMoney, formatMoneyShort, catLabel, brandLabel, photoAlt, photoSizeWord, sharedPhotoBadge, sharesDepartmentName } from './format.js';
import { PRODUCTS } from '../data/products.js';

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

  it('knows a line named like its department, in any case (NEW-029)', () => {
    expect(sharesDepartmentName('MOTOR OIL', 'Motor Oil')).toBe(true);
    expect(sharesDepartmentName('MOTOR OIL', ' MOTOR OIL ')).toBe(true);
    expect(sharesDepartmentName('MOTOR OIL', 'Additives')).toBe(false);
    expect(sharesDepartmentName('NOVELTIES', 'Novelties')).toBe(false);
    expect(sharesDepartmentName('MOTOR OIL', null)).toBe(false);
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

describe('photos other rows share (AW-136)', () => {
  it('finds the size or format word a name already has, as the name writes it', () => {
    const cases = {
      'Mamba big bars': 'big', 'Mamba (small)': 'small', 'American Club pipe tobacco, big bag': 'big',
      'Hershey bars king size': 'king size', 'Large trash bags': 'Large', 'Maruchan ramen cups': 'cups', 'Maruchan ramen packs': 'packs',
      'Backwoods cigars singles': 'singles', 'ZYN nicotine pouches 6mg': '6mg', 'Nicotine pouches 3 mg': '3 mg',
      'Kangvape 65K': '65K', 'Geek Bar Pulse 15k': '15k', 'Kangvape 8000': '8000', 'Vape (12000)': '12000',
    };
    for (const [name, word] of Object.entries(cases)) expect([name, photoSizeWord(name)]).toEqual([name, word]);
  });

  it('finds nothing in names without one, and never reads a brand, a weight or part of a word as one', () => {
    for (const name of [
      "Uncle Al's", 'Gain dish liquid', 'Faygo bottles 20 oz', "4K's cigarillos", 'Al Fakher shisha 250 g', 'Al Fakher shisha 1 kg',
      'Tyson 2.0 rolling papers', 'Smalls candy', 'Bigfoot', 'Cupsful', 'Clorox 121 oz', '', null, undefined,
    ]) expect([name, photoSizeWord(name)]).toEqual([name, '']);
  });

  it('badges with the sell unit first, then the size word', () => {
    expect(sharedPhotoBadge({ name: 'Backwoods cigars singles', sellUnit: 'single' })).toBe('single');
    expect(sharedPhotoBadge({ name: 'Mamba (small)', sellUnit: '' })).toBe('small');
    expect(sharedPhotoBadge({ name: 'Mamba (small)', sellUnit: '  ' })).toBe('small');
    expect(sharedPhotoBadge({ name: 'Gain dish liquid', sellUnit: '' })).toBe('');
    expect(sharedPhotoBadge(null)).toBe('');
  });

  it('calls a shared photo representative in its alt text', () => {
    expect(photoAlt({ name: 'Mamba (small)', sharedPhoto: true })).toBe('Mamba (small) (representative photo)');
    expect(photoAlt({ name: 'Kite cigarette tobacco', sharedPhoto: false })).toBe('Kite cigarette tobacco');
    expect(photoAlt({ name: 'Kite cigarette tobacco' })).toBe('Kite cigarette tobacco');
    expect(SHARED_PHOTO_NOTE).toBe('Photo shows a related pack or size.');
  });

  it('labels every shared photo in the catalog with a badge or the note', () => {
    const shared = PRODUCTS.filter((p) => p.sharedPhoto && p.picture);
    const label = (p) => sharedPhotoBadge(p) || 'note';
    expect(Object.fromEntries(shared.map((p) => [p.id, label(p)]))).toEqual({
      11: '5-pack', 16: 'single', 18: '6mg', 19: '3mg', 267: 'note', 58: 'note', 89: 'note', 67: '8000', 68: '65K',
      77: '5-pack', 340: 'single', 112: 'note', 333: 'note', 178: 'tub', 182: 'note', 188: 'note', 200: 'note',
      189: 'big', 190: 'small', 240: 'big', 241: 'small', 255: 'note', 329: 'note', 273: 'note', 367: '5-pack',
      290: 'big', 291: 'small', 305: 'note', 318: 'note', 316: '250 g tin', 317: '1 kg tin', 326: 'cups', 327: 'packs',
      335: 'small', 336: 'big', 350: 'note', 351: 'note',
    });
  });
});
