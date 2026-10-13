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

// The logo JPG has a light edge (white side columns and a light band along
// the bottom). Every tile is cut 3% in, past it, so no touch icon, home-screen
// icon or share image has a light line along an edge (AW-035).
describe('brand tiles (AW-035)', () => {
  it('cuts the touch icons, the home-screen icons and the share image from one tile 3% inside the logo', () => {
    expect(buildImages).toMatch(/const inset = Math\.round\(meta\.width \* 0\.03\);/);
    expect(buildImages).not.toMatch(/meta\.width \* 0\.02/);
    for (const file of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'og.jpg']) {
      // The statement that writes the file resizes the one tile.
      const writes = buildImages.split(/;\n/).find((statement) => statement.includes(`'${file}')`) && !statement.includes('const outputs'));
      expect(writes, file).toMatch(/sharp\(tileBuf\)\.resize\(/);
    }
  });

  it('rebuilds the brand files with the new tile', () => {
    expect(Number(/const BRAND_VERSION = (\d+);/.exec(buildImages)[1])).toBeGreaterThanOrEqual(3);
  });
});
