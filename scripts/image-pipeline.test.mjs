// Naming, sizing and manifest rules of the image build (AW-180, AW-355,
// AW-322, AW-324). scripts/build-images.mjs does the file work with these.
import { describe, expect, it } from 'vitest';
import {
  JPEG_MAX_WIDTH, PRODUCT_WIDTHS, SETTINGS, THUMB_BOX, VERSION,
  contentHash, entryFiles, entryOutputs, isEntry, jpegSizes, renditionFile, renditionSizes,
  serializeManifest, stableJson, targetWidths, thumbFile, thumbSize,
} from './image-pipeline.mjs';

const bytes = Buffer.from('a photo');

describe('sizes', () => {
  it('renders 320, 480, 640 and 1024 for products, with a JPEG at 640 and below (AW-322)', () => {
    expect(PRODUCT_WIDTHS).toEqual([320, 480, 640, 1024]);
    expect(JPEG_MAX_WIDTH).toBe(640);
    expect(THUMB_BOX).toBe(112);
  });

  it('never renders wider than the source, and includes the source width up to the largest target', () => {
    expect(targetWidths(2000, PRODUCT_WIDTHS)).toEqual([320, 480, 640, 1024]);
    expect(targetWidths(750, PRODUCT_WIDTHS)).toEqual([320, 480, 640, 750]);
    // A width within 10% of the source is replaced by the source width.
    expect(targetWidths(700, PRODUCT_WIDTHS)).toEqual([320, 480, 700]);
    expect(targetWidths(370, PRODUCT_WIDTHS)).toEqual([320, 370]);
    expect(targetWidths(200, PRODUCT_WIDTHS)).toEqual([200]);
  });

  it('keeps the aspect ratio in each size', () => {
    expect(renditionSizes(1100, 1000, PRODUCT_WIDTHS)).toEqual([[320, 291], [480, 436], [640, 582], [1024, 931]]);
    expect(renditionSizes(500, 1000, [320, 480])).toEqual([[320, 640], [480, 960]]);
  });

  it('fits the thumbnail inside the box without enlarging it (AW-324)', () => {
    expect(thumbSize(1100, 1000, 112)).toEqual([112, 102]);
    expect(thumbSize(500, 1000, 112)).toEqual([56, 112]);
    expect(thumbSize(80, 60, 112)).toEqual([80, 60]);
  });

  it('gives JPEGs only to the sizes up to the cap, and always to the smallest', () => {
    expect(jpegSizes([[320, 291], [480, 436], [640, 582], [1024, 931]], 640)).toEqual([[320, 291], [480, 436], [640, 582]]);
    expect(jpegSizes([[700, 700]], 640)).toEqual([[700, 700]]);
  });
});

describe('content hash', () => {
  it('is 8 hex digits of the bytes and the settings', () => {
    const hash = contentHash(bytes, SETTINGS.product);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(contentHash(Buffer.from('a photo'), SETTINGS.product)).toBe(hash);
    expect(contentHash(Buffer.from('another photo'), SETTINGS.product)).not.toBe(hash);
  });

  it('changes with any render setting, whatever order the settings are written in', () => {
    const hash = contentHash(bytes, SETTINGS.product);
    expect(contentHash(bytes, { ...SETTINGS.product, version: VERSION + 1 })).not.toBe(hash);
    expect(contentHash(bytes, { ...SETTINGS.product, widths: [320, 640, 1024] })).not.toBe(hash);
    expect(contentHash(bytes, { ...SETTINGS.product, webp: { ...SETTINGS.product.webp, quality: 80 } })).not.toBe(hash);
    expect(contentHash(bytes, SETTINGS.hero)).not.toBe(hash);
    const reversed = Object.fromEntries(Object.entries(SETTINGS.product).reverse());
    expect(contentHash(bytes, reversed)).toBe(hash);
    expect(stableJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });

  it('puts every value that shapes a product rendition into the product settings', () => {
    expect(SETTINGS.product).toMatchObject({ version: VERSION, widths: PRODUCT_WIDTHS, jpegMax: JPEG_MAX_WIDTH, thumb: THUMB_BOX });
    expect(Object.keys(SETTINGS.product)).toEqual(expect.arrayContaining(['webp', 'jpeg', 'background']));
  });
});

describe('file names', () => {
  const entry = { h: '1a2b3c4d', s: [[320, 291], [480, 436], [640, 582], [1024, 931]], t: [112, 102] };

  it('names renditions <base>--<w>x<h>-<hash>.<ext> and thumbnails <base>--thumb-<w>x<h>-<hash>.jpg', () => {
    expect(renditionFile('p1-kite', [320, 291], '1a2b3c4d', 'webp')).toBe('p1-kite--320x291-1a2b3c4d.webp');
    expect(thumbFile('p1-kite', [112, 102], '1a2b3c4d')).toBe('p1-kite--thumb-112x102-1a2b3c4d.jpg');
  });

  it('keeps the --<w>x<h>- part meta.js reads a share image size from', () => {
    const sizeInName = /--(\d+)x(\d+)[-.]/;
    expect(sizeInName.exec(renditionFile('p1-kite', [640, 582], '1a2b3c4d', 'jpg')).slice(1)).toEqual(['640', '582']);
  });

  it('lists every file an entry stands for: WebP at each size, JPEG up to the cap, the thumbnail', () => {
    expect(entryFiles('kite', entry, 640)).toEqual([
      'kite--320x291-1a2b3c4d.webp', 'kite--480x436-1a2b3c4d.webp', 'kite--640x582-1a2b3c4d.webp', 'kite--1024x931-1a2b3c4d.webp',
      'kite--320x291-1a2b3c4d.jpg', 'kite--480x436-1a2b3c4d.jpg', 'kite--640x582-1a2b3c4d.jpg',
      'kite--thumb-112x102-1a2b3c4d.jpg',
    ]);
    const hero = { h: 'ffff0000', s: [[480, 270], [720, 405]] };
    expect(entryOutputs('hero_candy', hero, 640).map((o) => [o.file, o.ext, o.thumb])).toEqual([
      ['hero_candy--480x270-ffff0000.webp', 'webp', false],
      ['hero_candy--720x405-ffff0000.webp', 'webp', false],
      ['hero_candy--480x270-ffff0000.jpg', 'jpg', false],
    ]);
  });

  it('reuses only well-formed entries from an earlier manifest', () => {
    expect(isEntry(entry, { thumb: true })).toBe(true);
    expect(isEntry({ h: 'ffff0000', s: [[480, 270]] }, { thumb: false })).toBe(true);
    expect(isEntry({ ...entry, t: undefined }, { thumb: true })).toBe(false);
    expect(isEntry(entry, { thumb: false })).toBe(false);
    expect(isEntry({ ...entry, h: 'xyz' }, { thumb: true })).toBe(false);
    expect(isEntry({ ...entry, s: [] }, { thumb: true })).toBe(false);
    expect(isEntry({ ...entry, s: [[320, 0]] }, { thumb: true })).toBe(false);
    expect(isEntry(null, { thumb: true })).toBe(false);
  });
});

describe('manifest', () => {
  const images = {
    zyn: { h: '22222222', s: [[320, 320]], t: [112, 112] },
    'hero_candy': { h: '33333333', s: [[480, 270], [720, 405]] },
    argo: { h: '11111111', s: [[320, 291], [480, 436]], t: [112, 102] },
  };

  it('writes sorted, one-line entries that read back as the same data', () => {
    const text = serializeManifest({ version: 4, jpegMax: 640, images, brand: 'abcdef12' });
    expect(JSON.parse(text)).toEqual({ version: 4, jpegMax: 640, images, brand: 'abcdef12' });
    const lines = text.split('\n');
    expect(lines.filter((l) => l.startsWith('    "')).map((l) => JSON.parse(`{${l.replace(/,$/, '')}}`))).toEqual([
      { argo: images.argo }, { 'hero_candy': images['hero_candy'] }, { zyn: images.zyn },
    ]);
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('writes an empty library as valid JSON', () => {
    expect(JSON.parse(serializeManifest({ version: 4, jpegMax: 640, images: {} }))).toEqual({ version: 4, jpegMax: 640, images: {}, brand: null });
  });
});
