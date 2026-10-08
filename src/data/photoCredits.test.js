import { describe, expect, it } from 'vitest';
import { PHOTO_CREDITS, photoCredit, photoCreditSource } from './photoCredits.js';
import { CATALOG } from './products.js';

describe('photoCredit (AW-033)', () => {
  it('credits the four Wikimedia photos', () => {
    expect(photoCredit({ id: 149 })).toContain('Dietmar Rabich');
    expect(photoCredit({ id: '150' })).toContain('J.Dncsn');
    expect(photoCredit({ id: 151 })).toContain('Rafasshop');
    expect(photoCredit({ id: 334 })).toContain('Beendy234');
  });

  it('links each credit to its Wikimedia Commons file page', () => {
    for (const id of Object.keys(PHOTO_CREDITS)) {
      expect(photoCreditSource({ id })).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
    expect(photoCreditSource({ id: 1 })).toBe('');
  });

  it('is empty for every other product, and for none', () => {
    expect(photoCredit({ id: 1 })).toBe('');
    expect(photoCredit(null)).toBe('');
  });

  it('names products that exist and have a photo', () => {
    for (const id of Object.keys(PHOTO_CREDITS)) {
      const row = CATALOG.find(p => p.id === Number(id));
      expect(row, `product ${id}`).toBeTruthy();
      expect(row.img, `product ${id} photo`).toBeTruthy();
    }
  });
});
