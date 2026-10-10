import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { backendEnvError } from './scripts/build-env.mjs';
import { chunkUrlsPlugin } from './scripts/chunk-urls.mjs';
import { netlifyResponse, pathHeaders, previewHeaders, readNetlifyHeaders, readNetlifyRedirects } from './scripts/netlify-headers.mjs';
import { siteUrlPlugin } from './scripts/site-url.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

// `vite preview` also sends netlify.toml's per-path headers for files that
// exist in dist (the year-long Cache-Control on /assets/* and /img/*), so a
// local production check caches the built files as browsers do from Netlify
// and an offline check sees what a visitor would (NEW-006). Set before the
// static file server, which keeps a Cache-Control already on the response.
// A missing file gets none: the page served in its place must not be kept.
function previewPathHeaders() {
  return {
    name: 'aw-preview-path-headers',
    configurePreviewServer(server) {
      const rules = readNetlifyHeaders(readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8'));
      const dist = path.resolve(ROOT, server.config.build.outDir);
      server.middlewares.use((req, res, next) => {
        let pathname = '/';
        try { pathname = decodeURIComponent(new URL(req.url, 'http://preview.local').pathname); } catch { return next(); }
        const values = pathHeaders(rules, pathname);
        if (!Object.keys(values).length) return next();
        const file = path.join(dist, pathname);
        if (!file.startsWith(dist + path.sep) || !existsSync(file) || !statSync(file).isFile()) return next();
        for (const [name, value] of Object.entries(values)) res.setHeader(name, value);
        return next();
      });
    }
  };
}

// `vite preview` answers with the statuses of netlify.toml's [[redirects]]
// (NEW-088): a path that is neither a file in dist nor one of the app's page
// paths gets index.html (or a missing /assets or /img file, 404.html) with
// status 404, as on Netlify, instead of Vite's index.html with 200. Files and
// the page paths are left to Vite, which serves them as Netlify does
// (/product/61 -> product/61.html, any page path -> index.html).
function previewRedirects() {
  return {
    name: 'aw-preview-redirects',
    configurePreviewServer(server) {
      const redirects = readNetlifyRedirects(readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8'));
      const dist = path.resolve(ROOT, server.config.build.outDir);
      const inDist = (p) => {
        const file = path.join(dist, p);
        return file.startsWith(dist + path.sep) && existsSync(file) && statSync(file).isFile() ? file : null;
      };
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        let pathname = '/';
        try { pathname = decodeURIComponent(new URL(req.url, 'http://preview.local').pathname); } catch { return next(); }
        const answer = netlifyResponse(pathname, { redirects, hasFile: (p) => !!inDist(p) });
        if (answer.status !== 404) return next();
        const file = answer.to && inDist(answer.to);
        if (!file) return next();
        res.statusCode = 404;
        for (const [name, value] of Object.entries(server.config.preview.headers || {})) res.setHeader(name, value);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(req.method === 'HEAD' ? undefined : readFileSync(file));
      });
    }
  };
}

export default defineConfig(({ command, mode }) => {
  // Production builds must carry the Supabase settings (AW-053). Dev servers,
  // tests and non-production modes still run without them.
  if (command === 'build' && mode === 'production') {
    const error = backendEnvError(loadEnv(mode, process.cwd(), ''));
    if (error) throw new Error(error);
  }

  return {
    // chunkUrlsPlugin (build only): the files src/lib/chunks.js fetches
    // ahead, written into the built code (NEW-006). siteUrlPlugin: index.html's
    // share image and structured data on VITE_SITE_URL's origin (AW-052).
    plugins: [react(), siteUrlPlugin(), chunkUrlsPlugin(), previewPathHeaders(), previewRedirects()],
    server: {
      port: 3000,
      // CI and Playwright runs must not try to open a browser (preview.open
      // inherits this).
      open: !process.env.CI
    },
    // `vite preview` (and the Playwright smoke run) sends the security headers
    // netlify.toml sets for every path, so a local production check runs
    // under the real Content-Security-Policy (AW-205). Never on the dev
    // server: React Refresh injects inline scripts the policy would block.
    preview: {
      headers: previewHeaders(ROOT),
      // No CORS middleware: the site is same-origin, and its 'Vary: Origin'
      // would keep the files src/lib/chunks.js fetches ahead (no Origin
      // header) from serving the import() of them (Chromium sends Origin),
      // which Netlify's responses don't (NEW-006).
      cors: false
    },
    build: {
      outDir: 'dist',
      // Vite 5's default 'modules' target. Vite 7 raised its default to
      // Baseline widely-available browsers; keeping the old list means the
      // toolchain upgrade does not drop any browser the site supported.
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
      // Every asset stays a cacheable, same-origin file: no data: URIs in the
      // CSS or JS (the select chevron included), so the Content-Security-Policy
      // needs no `img-src data:` or `font-src data:` (AW-180 step 1, AW-205).
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          // Vite 8 bundles with Rolldown: re-check this split when upgrading
          // (README, "Planned toolchain upgrades", AW-211).
          // React and the Supabase client change less often than the site,
          // so each is a file of its own that browsers keep between deploys
          // (AW-179). The pages that load on demand are split in App.jsx;
          // the bundled catalog (src/data/products.js) stays in the main
          // file, as the first paint's fallback catalog.
          // The Supabase client every page loads is auth-js and postgrest-js
          // (src/lib/supabase.js). Storage loads on demand (documents and
          // admin photos) and Realtime only with the admin code; each is a
          // file of its own. Their shared helper (tslib) goes with the
          // client every page has, so neither of the others is ever pulled
          // in by it. check-compat.mjs knows these names.
          manualChunks(id) {
            if (!id.includes('/node_modules/')) return undefined;
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor';
            if (/\/node_modules\/(@supabase\/storage-js|iceberg-js)\//.test(id)) return 'storage';
            if (/\/node_modules\/@supabase\/(realtime-js|phoenix)\//.test(id)) return 'realtime';
            if (/\/node_modules\/(@supabase\/(auth-js|postgrest-js)|tslib)\//.test(id)) return 'supabase';
            return undefined;
          }
        }
      }
    },
    // Vitest (npm test). Playwright specs live in tests/smoke and are not
    // unit tests.
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.{js,mjs}', 'netlify/**/*.test.{js,mjs}'],
      setupFiles: ['src/test/setup.js'],
      restoreMocks: true,
      // Budgets for a busy machine, not an idle one. The heaviest tests are
      // CPU-bound: the admin product and order lists render 50-120 rows in
      // jsdom several times (about 0.6s alone, 5-10s with other test runs or
      // a build on the same machine), and booting PGlite for the seed and
      // catalog-fixup tests takes seconds (once a file). Vitest's defaults
      // (5s a test, 10s a hook) turned that load into failures; these still
      // end a hung test or hook within half a minute. src/test/setup.js does
      // the same for Testing Library's waitFor and findBy.
      testTimeout: 30_000,
      hookTimeout: 30_000
    }
  };
});
