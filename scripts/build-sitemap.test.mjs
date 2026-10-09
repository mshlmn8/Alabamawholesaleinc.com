// Path sitemap generated at build time (AW-317).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_URL } from '../src/lib/routes.js';
import { catalogRows, sitemapEntries, sitemapPaths, sitemapXml } from './build-sitemap.mjs';

const departments = [
  { key: 'TOBACCO', subs: ['Cigarettes', 'Cigars & Cigarillos'] },
  { key: 'DRINKS & BAGS', subs: ['Energy Drinks'] },
];
const products = [{ id: 12 }, { id: 3 }, { id: 3 }, { id: 'x' }, { id: 40, active: false }];

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

describe('sitemapEntries (NEW-087)', () => {
  it('dates each product by when it was last saved, and everything else by the build', () => {
    const live = [{ id: 5, cat: 'TOBACCO', sub: 'Cigarettes', updated_at: '2026-10-07T09:30:00+00:00' }, { id: 6, cat: 'TOBACCO', sub: 'Cigarettes', updated_at: null }];
    const entries = sitemapEntries({ departments, products: live, lastmod: '2026-10-09' });
    expect(entries.find((e) => e.path === '/product/5')).toEqual({ path: '/product/5', lastmod: '2026-10-07' });
    expect(entries.find((e) => e.path === '/product/6')).toEqual({ path: '/product/6', lastmod: '2026-10-09' });
    expect(entries.find((e) => e.path === '/category/tobacco')).toEqual({ path: '/category/tobacco', lastmod: '2026-10-09' });
    expect(entries.find((e) => e.path === '/')).toEqual({ path: '/', lastmod: '2026-10-09' });
    expect(sitemapPaths({ departments, products: live })).toEqual(entries.map((e) => e.path));
  });

  it('lists the live catalog’s products when the build read it, else the bundled ones', () => {
    const bundled = [{ id: 1 }];
    expect(catalogRows({ source: 'live', rows: [{ id: 9001 }] }, bundled)).toEqual([{ id: 9001 }]);
    expect(catalogRows({ source: 'bundled', reason: 'x' }, bundled)).toBe(bundled);
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

  it('writes each entry’s own lastmod', () => {
    const xml = sitemapXml({ base: 'https://example.com', entries: [{ path: '/', lastmod: '2026-10-09' }, { path: '/product/5', lastmod: '2026-10-07' }, { path: '/x', lastmod: null }] });
    expect(xml).toContain('<url><loc>https://example.com/product/5</loc><lastmod>2026-10-07</lastmod></url>');
    expect(xml).toContain('<url><loc>https://example.com/x</loc></url>');
  });
});

describe('robots.txt', () => {
  it('points at the generated sitemap on the production domain (the build writes it for VITE_SITE_URL, AW-052)', () => {
    const robots = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${DEFAULT_SITE_URL}/sitemap.xml`);
    expect(readFileSync(resolve(process.cwd(), 'scripts/build-sitemap.mjs'), 'utf8')).toContain("path.join(ROOT, 'dist', 'robots.txt'), robotsTxt(base)");
  });
});
