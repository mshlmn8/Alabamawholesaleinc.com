// AW-328: the leftovers no open finding needs are gone (SHOP_CATS,
// WELCOME_OFFERS, COMPANY.whatsapp, products.js NAV_CATEGORIES), and the ones
// kept for owner answers (BRANDS for AW-005, TRUST for AW-005, FAQS for
// AW-279) stay unpublished: no component or page imports them. Once the
// owner approves one for the site, take it out of the second test.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as content from './content.js';
import * as products from './products.js';

const SRC = resolve(process.cwd(), 'src');
const sources = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name)) sources.push(path);
  }
})(SRC);

describe('content leftovers (AW-328)', () => {
  it('no longer exports the old layout’s data', () => {
    expect(content).not.toHaveProperty('SHOP_CATS');
    expect(content).not.toHaveProperty('WELCOME_OFFERS');
    expect(content.COMPANY).not.toHaveProperty('whatsapp');
    expect(products).not.toHaveProperty('NAV_CATEGORIES');
  });

  it('keeps BRANDS, TRUST and FAQS for the owner, imported by nothing that renders', () => {
    for (const name of ['BRANDS', 'TRUST', 'FAQS']) {
      expect(content, name).toHaveProperty(name);
      const users = sources
        .filter((file) => !file.endsWith(join('data', 'content.js')))
        .filter((file) => new RegExp(`\\b${name}\\b`).test(readFileSync(file, 'utf8')))
        .map((file) => relative(SRC, file));
      expect(users, name).toEqual([]);
    }
  });
});
