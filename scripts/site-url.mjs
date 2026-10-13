// The site's public origin in the files crawlers read without running the
// app (AW-052). index.html is written with the production origin
// (DEFAULT_SITE_URL in src/lib/routes.js) in its share image tags
// (og:image, twitter:image) and its structured data; siteUrlPlugin() puts
// the configured origin, siteUrl(VITE_SITE_URL), in its place in dev and in
// the build, so a site on another domain never points its share previews
// at an unregistered one. robotsTxt() is what scripts/build-sitemap.mjs
// writes to dist/robots.txt.
//
// Only the origin followed by '/', a quote or the end of a value changes:
// the boot script, its CSP hash and the Gmail address are untouched.
import { DEFAULT_SITE_URL, siteUrl } from '../src/lib/routes.js';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ORIGIN = new RegExp(`${escapeRegExp(DEFAULT_SITE_URL)}(?=[/"'<\\s]|$)`, 'g');

/**
 * `html` with every DEFAULT_SITE_URL origin replaced by `base`.
 * @param {string} html
 * @param {string} base an origin from siteUrl(), with no trailing slash
 */
export function withSiteUrl(html, base) {
  const origin = siteUrl(base);
  if (origin === DEFAULT_SITE_URL) return String(html);
  return String(html).replace(ORIGIN, origin);
}

/**
 * Vite plugin: index.html's absolute URLs on siteUrl(VITE_SITE_URL), in dev
 * and in the build.
 */
export function siteUrlPlugin() {
  let origin = DEFAULT_SITE_URL;
  return {
    name: 'aw-site-url',
    configResolved(config) {
      origin = siteUrl(config.env?.VITE_SITE_URL);
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => withSiteUrl(html, origin),
    },
  };
}

/**
 * robots.txt for a site at `base`: everything may be crawled, and the
 * sitemap is on the same origin. public/robots.txt is this text for the
 * production origin, which the dev server serves.
 * @param {string} base
 */
export function robotsTxt(base) {
  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${siteUrl(base)}/sitemap.xml`, ''].join('\n');
}
