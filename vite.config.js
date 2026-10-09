import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { backendEnvError } from './scripts/build-env.mjs';
import { chunkUrlsPlugin } from './scripts/chunk-urls.mjs';
import { pathHeaders, previewHeaders, readNetlifyHeaders } from './scripts/netlify-headers.mjs';

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

export default defineConfig(({ command, mode }) => {
  // Production builds must carry the Supabase settings (AW-053). Dev servers,
  // tests and non-production modes still run without them.
  if (command === 'build' && mode === 'production') {
    const error = backendEnvError(loadEnv(mode, process.cwd(), ''));
    if (error) throw new Error(error);
  }

  return {
    // chunkUrlsPlugin (build only): the files src/lib/chunks.js fetches
    // ahead, written into the built code (NEW-006).
    plugins: [react(), chunkUrlsPlugin(), previewPathHeaders()],
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
          manualChunks: {
            vendor: ['react', 'react-dom'],
            supabase: ['@supabase/supabase-js']
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
      restoreMocks: true
    }
  };
});
