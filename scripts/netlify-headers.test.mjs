// @vitest-environment node
// Response headers in netlify.toml (AW-205, AW-182) and the reader that
// `vite preview` and scripts/check-headers.mjs share.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cspProblems, inlineScriptHashes, parseCsp, previewHeaders, readNetlifyHeaders } from './netlify-headers.mjs';

// Vitest runs from the repository root.
const ROOT = process.cwd();
const toml = readFileSync(resolve(ROOT, 'netlify.toml'), 'utf8');
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const rules = readNetlifyHeaders(toml);
const rule = (path) => rules.find((r) => r.for === path);
const all = rule('/*')?.values || {};
const csp = parseCsp(all['Content-Security-Policy']);
const sha = (text) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;

describe('readNetlifyHeaders', () => {
  it('reads each [[headers]] rule and ignores the other tables', () => {
    const text = [
      '[build]',
      '  command = "npm run build"',
      '',
      '# A comment',
      '[[headers]]',
      '  for = "/*"  # every path',
      '  [headers.values]',
      '    X-Frame-Options = "DENY"',
      '    Content-Security-Policy = "default-src \'self\'; img-src \'self\' https://x.example"',
      '    X-Quote = "say \\"hi\\" \\\\ # not a comment"',
      '',
      '[[redirects]]',
      '  from = "/*"',
      '  to = "/index.html"',
      '',
      '[[headers]]',
      '  for = "/assets/*"',
      '  [headers.values]',
      '    Cache-Control = "public, max-age=31536000, immutable"',
    ].join('\n');
    expect(readNetlifyHeaders(text)).toEqual([
      {
        for: '/*',
        values: {
          'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'self'; img-src 'self' https://x.example",
          'X-Quote': 'say "hi" \\ # not a comment',
        },
      },
      { for: '/assets/*', values: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
    ]);
  });

  it('accepts Windows line endings', () => {
    expect(readNetlifyHeaders('[[headers]]\r\n  for = "/x"\r\n  [headers.values]\r\n    A = "b"\r\n'))
      .toEqual([{ for: '/x', values: { A: 'b' } }]);
  });

  it('throws on anything it cannot read inside a headers rule, instead of skipping it', () => {
    const block = (...lines) => ['[[headers]]', '  for = "/*"', '  [headers.values]', ...lines].join('\n');
    expect(() => readNetlifyHeaders(block("A = 'single quoted'"))).toThrow(/double-quoted/);
    expect(() => readNetlifyHeaders(block('A = """', 'multi', '"""'))).toThrow();
    expect(() => readNetlifyHeaders(block('A = "b" trailing'))).toThrow(/double-quoted/);
    expect(() => readNetlifyHeaders(block('"Quoted-Key" = "b"'))).toThrow(/Key = "value"/);
    expect(() => readNetlifyHeaders(block('A = "b"', 'a = "c"'))).toThrow(/twice/);
    expect(() => readNetlifyHeaders(block('[headers.values]'))).toThrow(/\[headers.values\]/);
    expect(() => readNetlifyHeaders('[[headers]]\n  for = "/*"\n  values = { A = "b" }')).toThrow(/only for/);
    expect(() => readNetlifyHeaders('[[headers]]\n  [headers.values]\n  A = "b"')).toThrow(/no for/);
    expect(() => readNetlifyHeaders('[[headers]]\n  for = "/a"\n  for = "/b"')).toThrow(/already/);
    expect(() => readNetlifyHeaders('[headers]\n  for = "/a"')).toThrow(/unsupported/);
    expect(() => readNetlifyHeaders('[headers.values]\n  A = "b"')).toThrow(/\[headers.values\]/);
  });

  it('reads the repository netlify.toml, and `vite preview` (not the dev server) sends its "/*" values', async () => {
    expect(rules.length).toBeGreaterThan(0);
    expect(previewHeaders(ROOT)).toEqual(all);
    const { default: viteConfig } = await import('../vite.config.js');
    const config = viteConfig({ command: 'serve', mode: 'development', isPreview: true });
    expect(config.preview.headers).toEqual(all);
    expect(config.server.headers).toBeUndefined();
  });
});

describe('inlineScriptHashes', () => {
  it('hashes inline classic and module scripts, not external scripts or data blocks', () => {
    const page = [
      '<!-- <script>commented()</script> -->',
      '<script>\n  a();\n</script>',
      '<script type="text/javascript">b()</script>',
      "<script type='module'>import './c.js';</script>",
      '<script type="application/ld+json">{"@type":"LocalBusiness"}</script>',
      '<script type="module" crossorigin src="/assets/index.js"></script>',
      '<script src=/x.js></script>',
      '<SCRIPT TYPE="TEXT/JAVASCRIPT">d()</SCRIPT >',
    ].join('\n');
    expect(inlineScriptHashes(page)).toEqual([sha('\n  a();\n'), sha('b()'), sha("import './c.js';"), sha('d()')]);
  });

  it('hashes the text the browser sees: UTF-8, with line endings normalised', () => {
    expect(inlineScriptHashes('<script>x("é")\r\ny()\r</script>')).toEqual([sha('x("é")\ny()\n')]);
  });

  it('finds the boot script in index.html and skips its JSON-LD block', () => {
    expect(html).toContain('<script type="application/ld+json">');
    expect(inlineScriptHashes(html)).toHaveLength(1);
  });
});

describe('Content-Security-Policy for every path', () => {
  const hashes = inlineScriptHashes(html);

  it('allows each inline script in index.html by hash, and nothing else inline', () => {
    // When this fails after an edit to the index.html boot script, put the
    // printed hash in netlify.toml's script-src in place of the old one.
    expect(cspProblems(all['Content-Security-Policy'], hashes)).toEqual([]);
    for (const hash of hashes) expect(csp.get('script-src')).toContain(`'${hash}'`);
    expect(csp.get('script-src')).not.toContain("'unsafe-inline'");
    for (const [, sources] of csp) expect(sources).not.toContain("'unsafe-eval'");
  });

  it("keeps frame-ancestors 'none' and object-src 'none'", () => {
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
  });

  it('reaches Supabase over https and wss, and nothing else off-site', () => {
    expect(csp.get('connect-src')).toEqual(expect.arrayContaining(['https://*.supabase.co', 'wss://*.supabase.co']));
    // Adding a host is a deliberate edit here, together with the privacy
    // policy's processor list (AW-210).
    const offSite = [...csp.values()].flat().filter((s) => /^(https?|wss?):/i.test(s));
    expect(new Set(offSite)).toEqual(new Set(['https://*.supabase.co', 'wss://*.supabase.co']));
    expect(csp.get('img-src')).not.toContain('data:');
    expect(csp.get('img-src')).not.toContain('blob:');
    expect(csp.has('upgrade-insecure-requests')).toBe(false);
  });

  it('refuses a policy that would block a script or weaken the protections', () => {
    const good = all['Content-Security-Policy'];
    expect(cspProblems(good, [...hashes, sha('edited()')]).join('\n')).toContain(`add '${sha('edited()')}'`);
    expect(cspProblems(good, []).join('\n')).toMatch(/no inline script .* matches/);
    expect(cspProblems(`${good}; script-src 'self' 'unsafe-inline'`, hashes)).toEqual([]); // the first directive wins
    expect(cspProblems(good.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"), hashes).join('\n')).toMatch(/unsafe-inline/);
    expect(cspProblems(good.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'"), hashes).join('\n')).toMatch(/unsafe-eval/);
    expect(cspProblems(good.replace("frame-ancestors 'none'", "frame-ancestors 'self'"), hashes).join('\n')).toMatch(/frame-ancestors/);
    expect(cspProblems(good.replace("object-src 'none'; ", ''), hashes).join('\n')).toMatch(/object-src/);
    expect(cspProblems(undefined, hashes)).toHaveLength(1);
  });
});

describe('other security headers for every path', () => {
  it('sets the clickjacking, sniffing, referrer, permissions and HSTS headers', () => {
    expect(all).toMatchObject({
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      // includeSubDomains and preload wait for the owner (AW-205).
      'Strict-Transport-Security': 'max-age=31536000',
    });
  });

  it('leaves index.html uncached: no Cache-Control on "/*"', () => {
    expect(Object.keys(all).map((k) => k.toLowerCase())).not.toContain('cache-control');
  });
});

describe('caching (AW-182)', () => {
  it('keeps the hashed /assets files for a year', () => {
    expect(rule('/assets/*')?.values).toEqual({ 'Cache-Control': 'public, max-age=31536000, immutable' });
  });

  it('keeps the content-hashed photo renditions in /img for a year (AW-355)', () => {
    expect(rule('/img/*')?.values).toEqual({ 'Cache-Control': 'public, max-age=31536000, immutable' });
  });

  it('keeps each brand file at a fixed name for a week', () => {
    for (const path of ['/favicon.ico', '/favicon-32.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/og.jpg']) {
      expect([path, rule(path)?.values]).toEqual([path, { 'Cache-Control': 'public, max-age=604800' }]);
    }
  });

  it('names its paths: no suffix wildcards, and nothing else is cached', () => {
    // Only the folders whose file names carry a content hash are immutable.
    expect(rules.filter((r) => /immutable/.test(r.values['Cache-Control'] || '')).map((r) => r.for)).toEqual(['/assets/*', '/img/*']);
    for (const r of rules) {
      expect(r.for).not.toMatch(/\*\./);
      if (r.for === '/*') continue;
      expect(Object.keys(r.values)).toEqual(['Cache-Control']);
    }
  });
});

describe('missing code and photo files (AW-179)', () => {
  // The [[redirects]] rules of netlify.toml, in file order.
  const redirects = toml.split(/^\[\[redirects\]\]\s*$/m).slice(1).map((block) => {
    const body = block.split(/^\[/m)[0];
    const value = (key) => new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\n]*)"?\\s*$`, 'm').exec(body)?.[1] ?? null;
    return { from: value('from'), to: value('to'), status: Number(value('status')), force: value('force') };
  });
  const at = (from) => redirects.findIndex((r) => r.from === from);

  it('answers a missing /assets or /img file with a real 404, above the "/*" page rewrite', () => {
    const spa = at('/*');
    expect(redirects[spa]).toMatchObject({ to: '/index.html', status: 200, force: null });
    for (const from of ['/assets/*', '/img/*']) {
      // Not forced: Netlify serves a file that exists before any rule, so
      // only a missing (old) file reaches this one.
      expect(redirects[at(from)]).toEqual({ from, to: '/404.html', status: 404, force: null });
      expect([from, at(from) < spa]).toEqual([from, true]);
    }
  });

  it('has a static 404 page: no script, only an inline style the CSP allows', () => {
    const page = readFileSync(resolve(ROOT, 'public/404.html'), 'utf8');
    expect(page).toMatch(/^<!doctype html>/i);
    expect(page).toContain('<meta name="robots" content="noindex" />');
    expect(page).not.toMatch(/<script\b/i);
    expect(page).not.toMatch(/<link\b[^>]*stylesheet|@import|url\(/i);
    expect(inlineScriptHashes(page)).toEqual([]);
    expect(csp.get('style-src')).toContain("'unsafe-inline'");
    expect(page).toContain('<a href="/">');
  });
});
