// @vitest-environment node
// The edge function that pauses the public domain while the site is being
// set up (netlify/edge-functions/pause.js). It lives outside netlify/edge-functions because Netlify bundles every file there as an edge function.
import { afterEach, describe, expect, it, vi } from 'vitest';
import pause, { PAUSED_PAGE, PUBLIC_HOSTS, config, isPaused, pauseDecision } from '../edge-functions/pause.js';

const setEnv = (value) => { globalThis.Netlify = { env: { get: (name) => (name === 'SITE_PAUSED' ? value : undefined) } }; };
const nextResponse = () => new Response('<!doctype html><title>site</title>', { status: 200, headers: { 'Content-Type': 'text/html' } });

afterEach(() => { delete globalThis.Netlify; });

describe('pauseDecision', () => {
  it('passes everything through when the site is not paused', () => {
    expect(pauseDecision('https://alabama-wholesale.com/', false)).toBe('pass');
    expect(pauseDecision('https://alabama-wholesale.netlify.app/admin', false)).toBe('pass');
  });

  it('shows the opening-soon page on the public domain, with and without www', () => {
    for (const host of PUBLIC_HOSTS) {
      expect(pauseDecision(`https://${host}/`, true)).toBe('page');
      expect(pauseDecision(`https://${host}/product/12?x=1`, true)).toBe('page');
      expect(pauseDecision(`https://${host}/robots.txt`, true)).toBe('robots');
    }
  });

  it('keeps the netlify.app address and deploy previews working, without indexing', () => {
    expect(pauseDecision('https://alabama-wholesale.netlify.app/admin', true)).toBe('noindex');
    expect(pauseDecision('https://deploy-preview-30--alabama-wholesale.netlify.app/', true)).toBe('noindex');
  });
});

describe('isPaused', () => {
  it('is true only for "true"', () => {
    expect(isPaused('true')).toBe(true);
    expect(isPaused(' TRUE ')).toBe(true);
    for (const value of [undefined, '', 'false', '0', 'yes', 'paused']) expect(isPaused(value)).toBe(false);
  });
});

describe('the edge function', () => {
  it('lets requests through when SITE_PAUSED is unset', async () => {
    setEnv(undefined);
    const next = vi.fn(nextResponse);
    expect(await pause(new Request('https://alabama-wholesale.com/'), { next })).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('answers the public domain with a 503 opening-soon page that search engines skip', async () => {
    setEnv('true');
    const next = vi.fn(nextResponse);
    const response = await pause(new Request('https://alabama-wholesale.com/category/tobacco'), { next });
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('86400');
    const html = await response.text();
    expect(html).toBe(PAUSED_PAGE);
    expect(html).toContain('opening soon');
    expect(html).toContain('(205) 458-4788');
    expect(html).not.toMatch(/<script/i);
  });

  it('serves a robots.txt that disallows everything while paused', async () => {
    setEnv('true');
    const response = await pause(new Request('https://www.alabama-wholesale.com/robots.txt'), { next: vi.fn() });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('User-agent: *\nDisallow: /\n');
  });

  it('serves the real site on netlify.app while paused, marked noindex', async () => {
    setEnv('true');
    const next = vi.fn(nextResponse);
    const response = await pause(new Request('https://alabama-wholesale.netlify.app/admin'), { next });
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('runs on every page but skips hashed assets, photos and fonts', () => {
    expect(config.path).toBe('/*');
    expect(config.excludedPath).toEqual(['/assets/*', '/img/*', '/fonts/*']);
  });
});
