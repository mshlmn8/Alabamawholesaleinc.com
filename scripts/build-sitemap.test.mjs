// Path sitemap generated at build time (AW-317).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_URL } from '../src/lib/routes.js';
import { sitemapPaths, sitemapXml } from './build-sitemap.mjs';

const departments = [
  { key: 'TOBACCO', subs: ['Cigarettes', 'Cigars & Cigarillos'] },
  { key: 'DRINKS & BAGS', subs: ['Energy Drinks'] },
];
const products = [{ id: 12 }, { id: 3 }, { id: 3 }, { id: 'x' }];

describe('sitemapPaths', () => {
  it('lists the indexable pages, departments, product lines and products as paths', () => {
    expect(sitemapPaths({ departments, products })).toEqual([
      '/', '/catalog', '/contact', '/delivery', '/shipping', '/privacy', '/terms', '/apply',
      '/category/tobacco', '/category/tobacco/cigarettes', '/category/tobacco/cigars-and-cigarillos',
      '/category/drinks-and-bags', '/category/drinks-and-bags/energy-drinks',
      '/product/3', '/product/12',
    ]);
  });

  it('leaves out checkout, account, admin, reset and fragment URLs', () => {
    const paths = sitemapPaths({ departments, products });
    for (const p of paths) expect(p).not.toMatch(/#|\/quote|\/account|\/admin|\/reset-password|\/search/);
  });
});

describe('sitemapXml', () => {
  it('writes absolute URLs with lastmod and no changefreq or priority', () => {
    const xml = sitemapXml({ base: 'https://example.com', paths: ['/', '/product/3'], lastmod: '2026-09-28' });
    expect(xml).toContain('<url><loc>https://example.com/</loc><lastmod>2026-09-28</lastmod></url>');
    expect(xml).toContain('<loc>https://example.com/product/3</loc>');
    expect(xml).not.toMatch(/changefreq|priority/);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
});

describe('robots.txt', () => {
  it('points at the generated sitemap on the production domain', () => {
    const robots = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${DEFAULT_SITE_URL}/sitemap.xml`);
  });
});
