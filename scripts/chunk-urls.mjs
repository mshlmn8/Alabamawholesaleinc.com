// The addresses of the files that load on demand (NEW-006, AW-344), written
// into the built site so src/lib/chunks.js can fetch them ahead of time with
// fetch() into the browser's HTTP cache. That warms the cache without
// import(): an import() that fails (offline, or a dropped connection) is
// remembered by the browser for that file, and the page or dialog then can't
// open until a full reload. A <link rel=modulepreload> fails the same way, so
// none is used.
//
//   LAZY_CHUNKS       name -> source file of each page or dialog App.jsx
//                     loads with React.lazy (the names chunks.js uses);
//   chunkUrlMap(bundle, { root, base })
//                     name -> [url, …]: the file Vite built for that source,
//                     the files it imports (recursively) and their CSS,
//                     leaving out what the page already loaded at start
//                     (the entry file and its imports);
//   chunkUrlsPlugin() the build-only Vite plugin that writes that map over
//                     the '__AW_CHUNK_URLS__' string in chunks.js. The build
//                     fails when it can't find it exactly once.
//
// The dev server leaves the placeholder alone, so nothing is fetched ahead
// there.
import path from 'node:path';

export const CHUNK_URLS_PLACEHOLDER = '__AW_CHUNK_URLS__';

export const LAZY_CHUNKS = Object.freeze({
  quote: 'src/pages/QuotePage.jsx',
  account: 'src/pages/account/AccountPage.jsx',
  admin: 'src/pages/admin/AdminPage.jsx',
  auth: 'src/components/AuthModal.jsx',
  contact: 'src/pages/support/ContactPage.jsx',
  delivery: 'src/pages/support/DeliveryPage.jsx',
  policy: 'src/pages/support/PolicyPage.jsx',
  apply: 'src/pages/support/ApplyPage.jsx',
  reset: 'src/pages/support/ResetPasswordPage.jsx',
});

const toPosix = (file) => file.split(path.sep).join('/');

export function chunkUrlMap(bundle, { root, base = '/', entries = LAZY_CHUNKS } = {}) {
  const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
  const byFile = new Map(chunks.map((c) => [c.fileName, c]));
  const walk = (fileName, into) => {
    if (into.has(fileName)) return;
    into.add(fileName);
    for (const dep of byFile.get(fileName)?.imports || []) walk(dep, into);
  };
  // Already on the page before anything loads on demand.
  const atStart = new Set();
  for (const c of chunks) if (c.isEntry) walk(c.fileName, atStart);

  const map = {};
  for (const [name, source] of Object.entries(entries)) {
    const id = toPosix(path.resolve(root, source));
    const chunk = chunks.find((c) => c.isDynamicEntry && c.facadeModuleId && toPosix(c.facadeModuleId) === id);
    if (!chunk) throw new Error(`chunk-urls: ${source} is not a file of its own in the build (is it still loaded with import()?)`);
    const files = new Set();
    walk(chunk.fileName, files);
    const urls = [];
    for (const file of files) {
      if (atStart.has(file)) continue;
      urls.push(base + file);
      for (const css of byFile.get(file)?.viteMetadata?.importedCss || []) urls.push(base + css);
    }
    map[name] = [...new Set(urls)];
  }
  return map;
}

export function chunkUrlsPlugin() {
  let root = process.cwd();
  let base = '/';
  return {
    name: 'aw-chunk-urls',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      base = config.base;
    },
    generateBundle(_options, bundle) {
      const map = chunkUrlMap(bundle, { root, base });
      const literal = new RegExp(`(["'\`])${CHUNK_URLS_PLACEHOLDER}\\1`, 'g');
      const holders = Object.values(bundle).filter((c) => c.type === 'chunk' && (c.code.match(literal) || []).length > 0);
      const count = holders.reduce((n, c) => n + c.code.match(literal).length, 0);
      if (count !== 1) this.error(`chunk-urls: expected the '${CHUNK_URLS_PLACEHOLDER}' string once in the built code (src/lib/chunks.js), found it ${count} times`);
      holders[0].code = holders[0].code.replace(literal, JSON.stringify(map));
    },
  };
}
