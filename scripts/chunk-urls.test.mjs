// @vitest-environment node
// The list of files src/lib/chunks.js fetches ahead (NEW-006): per page or
// dialog, its own file, what it imports and their CSS, never what the page
// loaded at start, written once over the placeholder.
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CHUNK_URLS_PLACEHOLDER, LAZY_CHUNKS, chunkUrlMap, chunkUrlsPlugin } from './chunk-urls.mjs';

const ROOT = '/repo';
const chunk = (fileName, { imports = [], css = [], facade = null, entry = false, dynamic = false, code = '' } = {}) => ({
  type: 'chunk', fileName, imports, isEntry: entry, isDynamicEntry: dynamic, code,
  facadeModuleId: facade ? path.join(ROOT, facade) : null,
  viteMetadata: { importedCss: new Set(css) },
});
const bundle = () => Object.fromEntries([
  chunk('assets/index-1.js', { entry: true, imports: ['assets/vendor-2.js', 'assets/supabase-3.js'], code: `const m='${CHUNK_URLS_PLACEHOLDER}';` }),
  chunk('assets/vendor-2.js'),
  chunk('assets/supabase-3.js'),
  chunk('assets/QuotePage-4.js', { dynamic: true, facade: 'src/pages/QuotePage.jsx', imports: ['assets/index-1.js', 'assets/Field-5.js', 'assets/vendor-2.js'], css: ['assets/QuotePage-6.css'] }),
  chunk('assets/Field-5.js', { imports: ['assets/index-1.js', 'assets/usStates-7.js'] }),
  chunk('assets/usStates-7.js'),
  chunk('assets/ContactPage-8.js', { dynamic: true, facade: 'src/pages/support/ContactPage.jsx', imports: ['assets/index-1.js'] }),
  { type: 'asset', fileName: 'assets/index-9.css' },
].map((c) => [c.fileName, c]));
const entries = { quote: LAZY_CHUNKS.quote, contact: LAZY_CHUNKS.contact };

describe('chunkUrlMap', () => {
  it('lists each page’s file, its imports and their CSS, without the files loaded at start', () => {
    expect(chunkUrlMap(bundle(), { root: ROOT, base: '/', entries })).toEqual({
      quote: ['/assets/QuotePage-4.js', '/assets/QuotePage-6.css', '/assets/Field-5.js', '/assets/usStates-7.js'],
      contact: ['/assets/ContactPage-8.js'],
    });
  });

  it('prefixes the base, and refuses a page that is no longer a file of its own', () => {
    expect(chunkUrlMap(bundle(), { root: ROOT, base: '/shop/', entries: { contact: LAZY_CHUNKS.contact } })).toEqual({ contact: ['/shop/assets/ContactPage-8.js'] });
    expect(() => chunkUrlMap(bundle(), { root: ROOT, entries: { admin: LAZY_CHUNKS.admin } })).toThrow(/AdminPage\.jsx is not a file of its own/);
  });

  it('names every page and dialog App.jsx loads on demand', () => {
    expect(Object.keys(LAZY_CHUNKS)).toEqual(['quote', 'account', 'admin', 'auth', 'contact', 'delivery', 'policy', 'apply', 'reset']);
  });
});

describe('chunkUrlsPlugin', () => {
  it('writes the map over the placeholder string, and fails the build when it is missing', () => {
    const plugin = chunkUrlsPlugin();
    expect(plugin.apply).toBe('build');
    plugin.configResolved({ root: ROOT, base: '/' });
    const out = bundle();
    const all = Object.fromEntries(Object.keys(LAZY_CHUNKS).map((name) => [name, LAZY_CHUNKS[name]]));
    // Every name needs its file: give the others one each.
    for (const [name, source] of Object.entries(all)) {
      if (name === 'quote' || name === 'contact') continue;
      out[`assets/${name}-x.js`] = chunk(`assets/${name}-x.js`, { dynamic: true, facade: source });
    }
    const error = vi.fn((message) => { throw new Error(message); });
    plugin.generateBundle.call({ error }, {}, out);
    const code = out['assets/index-1.js'].code;
    expect(code).not.toContain(CHUNK_URLS_PLACEHOLDER);
    const map = JSON.parse(/const m=(.*);$/.exec(code)[1]);
    expect(map.contact).toEqual(['/assets/ContactPage-8.js']);
    expect(map.admin).toEqual(['/assets/admin-x.js']);

    out['assets/index-1.js'].code = 'const m=1;';
    expect(() => plugin.generateBundle.call({ error }, {}, out)).toThrow(/found it 0 times/);
  });
});
