// @vitest-environment node
// The Netlify build plugin that keeps rendered photos between deploys
// (AW-355), with a fake `utils.cache`, and the CI cache step that keeps the
// same paths.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CACHE_PATHS, onPostBuild, onPreBuild } from './index.js';

// Vitest runs from the repository root.
const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

const fakeUtils = (result) => ({ cache: { restore: vi.fn(async () => result), save: vi.fn(async () => result) } });

describe('image-cache plugin', () => {
  it('restores the rendered photos before the build', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const utils = fakeUtils(true);
    await onPreBuild({ utils });
    expect(utils.cache.restore).toHaveBeenCalledWith(CACHE_PATHS);
    expect(utils.cache.save).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/restored/));
  });

  it('carries on when nothing is cached yet', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const utils = fakeUtils(false);
    await expect(onPreBuild({ utils })).resolves.toBeUndefined();
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/nothing cached/));
  });

  it('saves them after the build', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const utils = fakeUtils(true);
    await onPostBuild({ utils });
    expect(utils.cache.save).toHaveBeenCalledWith(CACHE_PATHS);
    expect(utils.cache.restore).not.toHaveBeenCalled();
  });

  it('keeps everything scripts/build-images.mjs writes, and nothing else', () => {
    // The gitignored outputs listed under the build-images comment.
    const ignored = read('.gitignore').split(/\r?\n/);
    const from = ignored.findIndex((l) => /build-images\.mjs/.test(l));
    const outputs = [];
    for (let i = from + 1; i < ignored.length && ignored[i].trim(); i++) outputs.push(ignored[i].trim().replace(/\/$/, ''));
    expect([...outputs].sort()).toEqual([...CACHE_PATHS].sort());
    // The brand files buildBrandAssets() writes into public/.
    const script = read('scripts/build-images.mjs');
    const list = /const outputs = \[([^\]]*)\]\.map\(\(f\) => path\.join\(PUBLIC_DIR, f\)\)/.exec(script);
    const brand = [...list[1].matchAll(/'([^']+)'/g)].map((m) => `public/${m[1]}`);
    expect(brand.filter((f) => !CACHE_PATHS.includes(f))).toEqual([]);
    expect(script).toMatch(/const IMG_DIR = path\.join\(PUBLIC_DIR, 'img'\)/);
    expect(script).toMatch(/const OUT_DIR = path\.join\(ASSETS, 'generated'\)/);
  });

  it('is registered in netlify.toml as a local plugin', () => {
    expect(read('netlify.toml')).toMatch(/\[\[plugins\]\]\s*\n\s*package = "\.\/netlify\/plugins\/image-cache"/);
    expect(read('netlify/plugins/image-cache/manifest.yml')).toMatch(/^name: image-cache$/m);
  });
});

describe('CI cache step', () => {
  const ci = read('.github/workflows/ci.yml');
  const step = /- name: Cache rendered images\n([\s\S]*?)\n\n/.exec(ci)?.[1] || '';

  it('caches the same paths as the Netlify plugin', () => {
    const paths = /path: \|\n((?:\s+\S+\n)+)/.exec(`${step}\n`)[1].split('\n').map((l) => l.trim()).filter(Boolean);
    expect(paths).toEqual(CACHE_PATHS);
  });

  it('is keyed on the photos, the logo and the image scripts, and restored before the unit tests', () => {
    expect(step).toMatch(/uses: actions\/cache@v\d+\n/);
    const key = /key: images-\$\{\{ hashFiles\((.*)\) \}\}/.exec(step)[1].split(',').map((s) => s.trim().replace(/'/g, ''));
    expect(key).toEqual(['src/assets/products/**', 'src/assets/hero_*', 'src/assets/logo.jpg', 'scripts/build-images.mjs', 'scripts/image-pipeline.mjs']);
    expect(step).toMatch(/restore-keys: images-$/m);
    expect(ci.indexOf('- name: Cache rendered images')).toBeLessThan(ci.indexOf('- name: Unit tests'));
  });
});
