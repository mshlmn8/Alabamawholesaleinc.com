// Naming, sizing and manifest rules of the image build (AW-180, AW-355,
// AW-322, AW-324). scripts/build-images.mjs does the file work with these.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FRAME, JPEG_MAX_WIDTH, PRODUCT_WIDTHS, SETTINGS, THUMB_BOX, VERSION, ZOOM_WIDTH,
  contentHash, entryFiles, entryOutputs, frameGeometry, frameWindow, isEntry, jpegSizes, mayZoom, renditionFile, renditionSizes,
  serializeManifest, stableJson, targetWidths, thumbFile, thumbSize, trimBox, zoomSize,
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

// The enlarged photo's own rendition (AW-236, LEFT-5).
describe('zoom rendition', () => {
  it('is 1600 wide at most, only for a framed photo wider than the largest size, never enlarged', () => {
    expect(ZOOM_WIDTH).toBe(1600);
    // Not one of the page's sizes: the page and card srcsets stay as they are.
    expect(PRODUCT_WIDTHS).not.toContain(ZOOM_WIDTH);
    expect(zoomSize(2400, 2182)).toEqual([1600, 1455]);
    expect(zoomSize(1236, 1124)).toEqual([1236, 1124]);
    expect(zoomSize(1025, 932)).toEqual([1025, 932]);
    expect(zoomSize(1024, 931)).toBeNull();
    expect(zoomSize(800, 727)).toBeNull();
    expect(zoomSize(3000, 1000, { zoom: 2000, above: 640 })).toEqual([2000, 667]);
  });

  it('may exist only for an entry whose largest size is the cap', () => {
    expect(mayZoom({ s: [[320, 291], [480, 436], [640, 582], [1024, 931]] })).toBe(true);
    expect(mayZoom({ s: [[320, 291], [480, 436], [640, 582], [927, 843]] })).toBe(false);
    expect(mayZoom({ s: [] })).toBe(false);
    expect(mayZoom(undefined)).toBe(false);
  });

  it('is hashed apart from the product sizes, so adding or changing it leaves their names alone', () => {
    const product = contentHash(bytes, SETTINGS.product);
    const zoom = contentHash(bytes, SETTINGS.zoom);
    expect(zoom).not.toBe(product);
    expect(SETTINGS.product).not.toHaveProperty('zoom');
    expect(JSON.stringify(SETTINGS.product)).not.toMatch(String(ZOOM_WIDTH));
    // Everything that shapes the zoom file is in its settings: the framed photo, its width, the WebP settings.
    expect(SETTINGS.zoom).toEqual({ version: VERSION, width: ZOOM_WIDTH, webp: SETTINGS.product.webp, background: SETTINGS.product.background, frame: FRAME });
    expect(contentHash(bytes, { ...SETTINGS.zoom, width: 2000 })).not.toBe(zoom);
    expect(contentHash(bytes, { ...SETTINGS.zoom, frame: { ...FRAME, share: 0.8 } })).not.toBe(zoom);
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
    expect(SETTINGS.product).toMatchObject({ version: VERSION, widths: PRODUCT_WIDTHS, jpegMax: JPEG_MAX_WIDTH, thumb: THUMB_BOX, frame: FRAME });
    expect(Object.keys(SETTINGS.product)).toEqual(expect.arrayContaining(['webp', 'jpeg', 'background']));
    expect(contentHash(bytes, { ...SETTINGS.product, frame: { ...FRAME, share: 0.8 } })).not.toBe(contentHash(bytes, SETTINGS.product));
    // Heroes are not framed.
    expect(SETTINGS.hero.frame).toBeUndefined();
  });
});

describe('framing product photos at one scale (AW-287)', () => {
  it('frames to the card tile’s aspect in index.css', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    expect(/\.card-block \{[^}]*aspect-ratio: ([\d.]+);/.exec(css)[1]).toBe(String(FRAME.aspect));
    expect(FRAME).toEqual({ aspect: 1.1, share: 0.89, trimThreshold: 18 });
  });

  it('reads the product box from sharp’s trim info', () => {
    expect(trimBox({ trimOffsetLeft: -176, trimOffsetTop: -80, width: 365, height: 686 }, 840, 840)).toEqual({ left: 176, top: 80, width: 365, height: 686 });
    // Nothing trimmed.
    expect(trimBox({ trimOffsetLeft: 0, trimOffsetTop: 0, width: 600, height: 400 }, 600, 400)).toEqual({ left: 0, top: 0, width: 600, height: 400 });
    expect(trimBox({ width: 600, height: 400 }, 600, 400)).toEqual({ left: 0, top: 0, width: 600, height: 400 });
  });

  it('makes the product’s limiting side the same share of a canvas of the tile’s aspect', () => {
    const share = (box, g) => Math.max(box[0] / g.width, box[1] / g.height);
    for (const box of [[500, 1000], [1000, 300], [1100, 1000], [800, 800], [37, 211]]) {
      const g = frameGeometry(box[0], box[1], FRAME);
      expect(g.width / g.height).toBeCloseTo(FRAME.aspect, 1);
      expect(share(box, g)).toBeCloseTo(FRAME.share, 2);
      // Centred, and the product is never scaled: the margins add up exactly.
      expect(g.left + box[0] + g.right).toBe(g.width);
      expect(g.top + box[1] + g.bottom).toBe(g.height);
      expect(Math.abs(g.left - g.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.top - g.bottom)).toBeLessThanOrEqual(1);
      expect(Math.min(g.left, g.right, g.top, g.bottom)).toBeGreaterThanOrEqual(0);
    }
    expect(frameGeometry(500, 1000, FRAME)).toMatchObject({ width: 1236, height: 1124 });
    expect(frameGeometry(1000, 300, FRAME)).toMatchObject({ width: 1124, height: 1022 });
  });

  it('cuts the window from the source where it can and pads only past the source’s edges', () => {
    // A product in the middle of a large source: all of the window is source.
    const inside = frameWindow({ left: 1000, top: 1000, width: 500, height: 1000 }, 4000, 3000, FRAME);
    expect(inside).toEqual({
      width: 1236, height: 1124,
      extract: { left: 632, top: 938, width: 1236, height: 1124 },
      extend: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    // The product box is the whole photo (nothing to trim): all margin is padding.
    const whole = frameWindow({ left: 0, top: 0, width: 800, height: 800 }, 800, 800, FRAME);
    expect(whole.extract).toEqual({ left: 0, top: 0, width: 800, height: 800 });
    expect(whole.extend.left + 800 + whole.extend.right).toBe(whole.width);
    expect(whole.extend.top + 800 + whole.extend.bottom).toBe(whole.height);
    // Near one edge: the source fills what it can, padding the rest.
    const edge = frameWindow({ left: 10, top: 100, width: 300, height: 600 }, 1000, 800, FRAME);
    expect(edge.extract.left).toBe(0);
    expect(edge.extend.left).toBeGreaterThan(0);
    expect(edge.extend.right).toBe(0);
    expect(edge.extract.width + edge.extend.left + edge.extend.right).toBe(edge.width);
    expect(edge.extract.height + edge.extend.top + edge.extend.bottom).toBe(edge.height);
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

  it('adds the zoom WebP, named by its own hash, to a product that has one (AW-236)', () => {
    const zoomed = { ...entry, z: { h: '5e6f7a8b', s: [1600, 1455] } };
    expect(entryFiles('kite', zoomed, 640)).toEqual([...entryFiles('kite', entry, 640), 'kite--1600x1455-5e6f7a8b.webp']);
    expect(entryOutputs('kite', zoomed, 640).at(-1)).toEqual({ file: 'kite--1600x1455-5e6f7a8b.webp', size: [1600, 1455], ext: 'webp', thumb: false, zoom: true });
    // Only one zoom file, and no JPEG of it.
    expect(entryFiles('kite', zoomed, 640).filter((f) => f.includes('1600x1455'))).toHaveLength(1);
  });

  it('reuses only well-formed entries from an earlier manifest', () => {
    expect(isEntry({ ...entry, z: { h: '5e6f7a8b', s: [1600, 1455] } }, { thumb: true })).toBe(true);
    expect(isEntry({ ...entry, z: { h: 'nope', s: [1600, 1455] } }, { thumb: true })).toBe(false);
    expect(isEntry({ ...entry, z: { h: '5e6f7a8b', s: [1600] } }, { thumb: true })).toBe(false);
    expect(isEntry({ ...entry, z: null }, { thumb: true })).toBe(false);
    // A hero has no zoom.
    expect(isEntry({ h: 'ffff0000', s: [[480, 270]], z: { h: '5e6f7a8b', s: [1600, 900] } }, { thumb: false })).toBe(false);
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
    argo: { h: '11111111', s: [[320, 291], [480, 436], [640, 582], [1024, 931]], t: [112, 102], z: { h: '44444444', s: [1236, 1124] } },
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
