import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LICENCE_URLS, PHOTO_CREDITS, photoCredit, photoCreditText } from './photoCredits.js';
import { CATALOG } from './products.js';

describe('photoCredit (AW-033)', () => {
  it('credits the four Wikimedia photos with the author, the licence and the change', () => {
    expect(photoCreditText(photoCredit({ id: 149 }))).toBe('Photo: Dietmar Rabich, CC BY-SA 4.0, resized.');
    expect(photoCreditText(photoCredit({ id: '150' }))).toBe('Photo: J.Dncsn, CC BY-SA 3.0, resized.');
    expect(photoCreditText(photoCredit({ id: 151 }))).toBe('Photo: Rafasshop, CC BY-SA 4.0, resized.');
    expect(photoCreditText(photoCredit({ id: 334 }))).toBe('Photo: Beendy234, CC BY 4.0, resized.');
  });

  it('links each licence to its deed, and each credit to its Wikimedia Commons file page', () => {
    expect(LICENCE_URLS).toEqual({
      'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
      'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
      'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
    });
    for (const [id, credit] of Object.entries(PHOTO_CREDITS)) {
      expect(Object.keys(credit).sort(), id).toEqual(['author', 'licence', 'licenceUrl', 'source']);
      expect(credit.licenceUrl, id).toBe(LICENCE_URLS[credit.licence]);
      expect(credit.source, id).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });

  it('is empty for every other product, and for none', () => {
    expect(photoCredit({ id: 1 })).toBeNull();
    expect(photoCredit(null)).toBeNull();
    expect(photoCreditText(null)).toBe('');
  });

  it('names products that exist and have a photo', () => {
    for (const id of Object.keys(PHOTO_CREDITS)) {
      const row = CATALOG.find(p => p.id === Number(id));
      expect(row, `product ${id}`).toBeTruthy();
      expect(row.img, `product ${id} photo`).toBeTruthy();
    }
  });

  it('agrees with the photo source log, which records each file\'s author and licence', () => {
    const log = readFileSync(resolve(import.meta.dirname, '../assets/products/sources/merchandise.md'), 'utf8');
    for (const [id, credit] of Object.entries(PHOTO_CREDITS)) {
      const line = log.split('\n').find((l) => l.startsWith(`| ${id} |`));
      expect(line, id).toContain(credit.source);
      expect(line, id).toContain(`${credit.author}, ${credit.licence} (${credit.licenceUrl})`);
    }
  });
});
