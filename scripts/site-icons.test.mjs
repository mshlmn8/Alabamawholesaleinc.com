// The home-screen icons in site.webmanifest (AW-289): every icon is a file
// scripts/build-images.mjs renders before dev and build, kept out of git, and
// Android gets a maskable icon besides the plain ones.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root.
const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const manifest = JSON.parse(read('public/site.webmanifest'));
const ignored = read('.gitignore').split('\n').map((line) => line.trim());
const buildImages = read('scripts/build-images.mjs');

describe('site.webmanifest icons', () => {
  it('lists a 512px maskable icon next to the plain 192 and 512px ones', () => {
    expect(manifest.icons).toContainEqual({ src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' });
    const plain = manifest.icons.filter((icon) => !icon.purpose || icon.purpose === 'any');
    expect(plain.map((icon) => icon.sizes).sort()).toEqual(['192x192', '512x512']);
  });

  it('names only files build-images.mjs renders and git ignores', () => {
    for (const { src } of manifest.icons) {
      const file = src.replace(/^\//, '');
      expect(buildImages, src).toContain(`'${file}'`);
      expect(ignored, src).toContain(`public/${file}`);
    }
  });
});
