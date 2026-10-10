// The owner's warehouse photos (AW-006): every one of the 37 is shown once,
// in the home page's reel or on the contact page; the files are what the
// image build and the home_slides table expect; and the migration that puts
// the reel in home_slides, and its database test, name the same eight
// photos with the same words.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLED_PHOTOS, EARLIER_HERO_PHOTOS, HERO_REEL, WAREHOUSE_GALLERY, bundledPhoto } from './warehousePhotos.js';
import { HERO_SLIDES } from './content.js';
import { NAV_ORDER } from './products.js';
import { BUNDLED_HERO_FILE, BUNDLED_HERO_FILES } from '../lib/homeSlides.js';
import { heroImage } from '../lib/images.js';

// Vitest runs from the repository root.
const ROOT = process.cwd();
const ASSETS = resolve(ROOT, 'src/assets');
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');
const MIGRATION = read('supabase/migrations/20261014110000_home_slides_warehouse_reel.sql');
const DB_TEST = read('supabase/tests/26_home_slides_warehouse_reel.sql');
const assetFiles = readdirSync(ASSETS);

// A JPEG's size, and whether it carries EXIF data (which can hold the place
// and time a photo was taken), from its segment headers.
function jpegInfo(file) {
  const bytes = readFileSync(resolve(ASSETS, file));
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`${file} is not a JPEG`);
  let offset = 2;
  let exif = false;
  while (offset < bytes.length) {
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker === 0xe1 && bytes.toString('latin1', offset + 4, offset + 8) === 'Exif') exif = true;
    // SOF0–SOF15, except DHT (c4), JPG (c8) and DAC (cc).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7), exif };
    }
    offset += 2 + length;
  }
  throw new Error(`${file} has no frame header`);
}

// The SQL without its comments, whitespace collapsed.
const flat = (sql) => sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();
// The (img, alt, go_cat, …, sort) rows of a values list after `marker`.
const reelRows = (sql, marker) => {
  const start = sql.indexOf(marker);
  if (start === -1) throw new Error(`no ${marker}`);
  return [...sql.slice(start).matchAll(/\('(hero_wh_[a-z0-9_]+\.jpg)', '((?:[^']|'')*)', (null|'[^']*'), (?:false, )?(\d+)\)/g)]
    .slice(0, 8)
    .map(([, file, alt, goCat, sort]) => ({ file, alt: alt.replace(/''/g, "'"), goCat: goCat === 'null' ? null : goCat.slice(1, -1), sort: Number(sort) }));
};
const expectedRows = HERO_REEL.map(({ file, alt, goCat }, i) => ({ file, alt, goCat, sort: (i + 1) * 10 }));

describe('the warehouse photos (AW-006)', () => {
  const warehouse = [...HERO_REEL, ...WAREHOUSE_GALLERY];

  it('shows all 37 photos once: eight in the home page’s reel, the other 29 on the contact page', () => {
    expect(HERO_REEL).toHaveLength(8);
    expect(WAREHOUSE_GALLERY).toHaveLength(29);
    const files = warehouse.map((photo) => photo.file);
    expect(new Set(files).size).toBe(37);
    expect(files.slice().sort()).toEqual(assetFiles.filter((f) => f.startsWith('hero_wh_')).sort());
  });

  it('opens the reel with the building, a truck and Graymont Ave, as the owner asked', () => {
    expect(HERO_REEL.slice(0, 3).map((photo) => photo.file)).toEqual(['hero_wh_sign.jpg', 'hero_wh_truck.jpg', 'hero_wh_graymont.jpg']);
    expect(HERO_REEL.every((photo) => !photo.nicotine)).toBe(true);
  });

  it('marks the photos of tobacco, vapes and nicotine pouches, which the contact page groups under the FDA statement', () => {
    expect(WAREHOUSE_GALLERY.filter((photo) => photo.nicotine).map((photo) => photo.file)).toEqual([
      'hero_wh_cigarillos.jpg', 'hero_wh_cigarillo_racks.jpg', 'hero_wh_cigars.jpg', 'hero_wh_cigarettes.jpg', 'hero_wh_pipe_tobacco.jpg',
      'hero_wh_shisha.jpg', 'hero_wh_shisha_shelves.jpg', 'hero_wh_vapes.jpg', 'hero_wh_vape_shelves.jpg', 'hero_wh_pouches.jpg',
    ]);
  });

  it('describes each photo once, in at most 200 characters (the home_slides limit)', () => {
    const alts = BUNDLED_PHOTOS.map((photo) => photo.alt);
    expect(new Set(alts).size).toBe(alts.length);
    for (const alt of alts) {
      expect(alt.trim()).toBe(alt);
      expect(alt.length).toBeGreaterThan(10);
      expect(alt.length).toBeLessThanOrEqual(200);
      // A description, not a price: shelf stickers are never prices (owner, 2026-09-28).
      expect(alt).not.toMatch(/\$|¢|\d+\s?ct\b/);
    }
  });

  it('links reel slides only to departments the site has', () => {
    for (const { goCat } of HERO_REEL) expect(goCat === null || NAV_ORDER.includes(goCat)).toBe(true);
  });

  it('ships every photo as a 1600 × 900 JPEG without EXIF data, named as the home_slides table allows', () => {
    for (const { file } of warehouse) {
      expect(file).toMatch(BUNDLED_HERO_FILE);
      expect(jpegInfo(file)).toEqual({ width: 1600, height: 900, exif: false });
    }
  });

  it('builds the home page’s bundled slides from the reel, none with the FDA warning', () => {
    expect(HERO_SLIDES.map(({ img, picture, alt, goCat, nicotineWarning }) => ({ img, picture, alt, goCat, nicotineWarning })))
      .toEqual(HERO_REEL.map(({ file, alt, goCat }) => ({ ...heroImage(file), alt, goCat, nicotineWarning: false })));
  });
});

describe('the bundled photos Admin -> Homepage offers', () => {
  it('are every hero photo in src/assets, the reel first in its order', () => {
    expect(BUNDLED_HERO_FILES).toEqual(BUNDLED_PHOTOS.map((photo) => photo.file));
    expect(BUNDLED_HERO_FILES.slice(0, 8)).toEqual(HERO_REEL.map((photo) => photo.file));
    expect(BUNDLED_HERO_FILES.slice().sort()).toEqual(assetFiles.filter((f) => /^hero_.*\.(jpe?g|png|webp)$/.test(f)).sort());
  });

  it('keep the four earlier hero photos, described as before', () => {
    expect(EARLIER_HERO_PHOTOS.map(({ file, nicotine }) => [file, nicotine])).toEqual([
      ['hero_candy.jpg', false], ['hero_vape.jpg', true], ['hero_lighters.jpg', false], ['hero_gatorade.jpg', false],
    ]);
  });

  it('are found by file name', () => {
    expect(bundledPhoto(' hero_wh_soda.jpg ')).toEqual({ file: 'hero_wh_soda.jpg', alt: 'Pallets of Faygo soda by the case', nicotine: false });
    expect(bundledPhoto('hero_wh_vapes.jpg').nicotine).toBe(true);
    expect(bundledPhoto('kite.jpg')).toBeNull();
    expect(bundledPhoto(null)).toBeNull();
  });
});

describe('20261014110000_home_slides_warehouse_reel.sql', () => {
  it('puts the reel in home_slides with its alt text, links and order, word for word', () => {
    expect(reelRows(MIGRATION, 'insert into public.home_slides')).toEqual(expectedRows);
    expect(MIGRATION).not.toMatch(/'hero_wh_[a-z0-9_]+\.jpg', '[^']*', (?:null|'[^']*'), true,/);
  });

  it('replaces only the four rows 20261011131000 added, as that file added them', () => {
    const seed = read('supabase/migrations/20261011131000_home_slides.sql');
    const seeded = (sql) => [...flat(sql).matchAll(/\('(hero_(?:candy|vape|lighters|gatorade)\.jpg)', '([^']*)', '([^']*)', (true|false), (\d+)\)/g)].slice(0, 4).map((m) => m.slice(1));
    expect(seeded(MIGRATION)).toEqual(seeded(seed));
    expect(seeded(MIGRATION)).toHaveLength(4);
  });

  it('is run word for word by the database test, which expects the same eight rows', () => {
    const block = /\ndo \$\$\n([\s\S]*?)\nend \$\$;/.exec(MIGRATION)[1];
    const fn = /pg_temp\.p26_apply\(\) returns void language plpgsql as \$fn\$\n([\s\S]*?)\nend \$fn\$;/.exec(DB_TEST)[1];
    expect(flat(fn)).toBe(flat(block));
    expect(reelRows(DB_TEST, 'pg_temp.p26_reel()')).toEqual(expectedRows);
  });
});
