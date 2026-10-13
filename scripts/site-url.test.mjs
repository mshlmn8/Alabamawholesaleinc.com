// @vitest-environment node
// The configured origin in index.html and robots.txt (AW-052).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_URL } from '../src/lib/routes.js';
import { inlineScriptHashes } from './netlify-headers.mjs';
import { robotsTxt, siteUrlPlugin, withSiteUrl } from './site-url.mjs';

// Vitest runs from the repository root.
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const OTHER = 'https://alabama-wholesale.netlify.app';
const tag = (page, re) => re.exec(page)?.[1] ?? null;
const graphOf = (page) => JSON.parse(tag(page, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/))['@graph'];

describe('withSiteUrl', () => {
  it('leaves index.html as written on the production origin', () => {
    expect(withSiteUrl(html, DEFAULT_SITE_URL)).toBe(html);
    expect(withSiteUrl(html, '')).toBe(html);
  });

  it('puts another origin in the share image tags and the structured data, leaving no hard-coded domain', () => {
    const page = withSiteUrl(html, `${OTHER}/`);
    expect(page).not.toContain(DEFAULT_SITE_URL);
    expect(tag(page, /<meta property="og:image" content="([^"]*)"/)).toBe(`${OTHER}/og.jpg`);
    expect(tag(page, /<meta name="twitter:image" content="([^"]*)"/)).toBe(`${OTHER}/og.jpg`);
    const [business, website] = graphOf(page);
    expect(business).toMatchObject({ '@id': `${OTHER}/#business`, url: `${OTHER}/`, logo: `${OTHER}/icon-512.png`, image: `${OTHER}/og.jpg` });
    expect(website).toMatchObject({ '@id': `${OTHER}/#website`, url: `${OTHER}/`, publisher: { '@id': `${OTHER}/#business` } });
    // The Google Maps link and the Gmail address are not the site's origin.
    expect(business.hasMap).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
    expect(page).toContain('Alabamawholesaleinc@gmail.com');
  });

  it('keeps the boot script byte for byte, so its CSP hash still matches', () => {
    expect(inlineScriptHashes(withSiteUrl(html, OTHER))).toEqual(inlineScriptHashes(html));
    expect(inlineScriptHashes(html)).toHaveLength(1);
  });

  it('replaces the origin only, not a longer host that starts like it', () => {
    expect(withSiteUrl(`"${DEFAULT_SITE_URL}.example.org/x" "${DEFAULT_SITE_URL}" '${DEFAULT_SITE_URL}/'`, OTHER))
      .toBe(`"${DEFAULT_SITE_URL}.example.org/x" "${OTHER}" '${OTHER}/'`);
  });
});

describe('siteUrlPlugin', () => {
  it('transforms index.html with VITE_SITE_URL, in dev and in the build', async () => {
    const plugin = siteUrlPlugin();
    plugin.configResolved({ env: { VITE_SITE_URL: `${OTHER}/` } });
    expect(plugin.transformIndexHtml.order).toBe('pre');
    expect(plugin.transformIndexHtml.handler(html)).toBe(withSiteUrl(html, OTHER));
    const unset = siteUrlPlugin();
    unset.configResolved({ env: {} });
    expect(unset.transformIndexHtml.handler(html)).toBe(html);
    const { default: viteConfig } = await import('../vite.config.js');
    const config = viteConfig({ command: 'build', mode: 'test' });
    expect(config.plugins.map((p) => p?.name)).toContain('aw-site-url');
  });
});

describe('robotsTxt', () => {
  it('points at the sitemap on the configured origin', () => {
    expect(robotsTxt(OTHER)).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${OTHER}/sitemap.xml\n`);
    expect(robotsTxt('not a url')).toContain(`Sitemap: ${DEFAULT_SITE_URL}/sitemap.xml`);
  });

  it('is public/robots.txt for the production origin, which the dev server serves', () => {
    expect(readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf8')).toBe(robotsTxt(DEFAULT_SITE_URL));
  });
});
