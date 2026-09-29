import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { backendEnvError } from './scripts/build-env.mjs';

export default defineConfig(({ command, mode }) => {
  // Production builds must carry the Supabase settings (AW-053). Dev servers,
  // tests and non-production modes still run without them.
  if (command === 'build' && mode === 'production') {
    const error = backendEnvError(loadEnv(mode, process.cwd(), ''));
    if (error) throw new Error(error);
  }

  return {
    plugins: [react()],
    server: {
      port: 3000,
      // CI and Playwright runs must not try to open a browser (preview.open
      // inherits this).
      open: !process.env.CI
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
          manualChunks: {
            vendor: ['react', 'react-dom']
          }
        }
      }
    },
    // Vitest (npm test). Playwright specs live in tests/smoke and are not
    // unit tests.
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}', 'scripts/**/*.test.{js,mjs}'],
      setupFiles: ['src/test/setup.js'],
      restoreMocks: true
    }
  };
});
