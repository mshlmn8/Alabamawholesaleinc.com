// Pure helpers for scripts/build-images.mjs (no file system, no sharp), so the
// naming, sizing and manifest rules are unit-tested in image-pipeline.test.mjs.
//
// Every rendition is named after its content (AW-180, AW-355):
//
//   public/img/<base>--<w>x<h>-<hash>.webp|jpg       responsive sizes
//   public/img/<base>--thumb-<w>x<h>-<hash>.jpg      product thumbnail (AW-324)
//
// <hash> is the first 8 hex digits of sha1(source bytes + the render
// settings), so a changed photo or a changed setting gives new file names,
// and the files can be cached as immutable (netlify.toml, "/img/*"). The same
// hash is how a rerun knows a source is unchanged: no file times are read.
//
// One manifest, src/assets/generated/manifest.json, records each source:
//
//   { "version": 4, "jpegMax": 640,
//     "images": { "<base>": { "h": "1a2b3c4d", "s": [[320,291], …], "t": [112,102] } },
//     "brand": "<hash of logo.jpg and BRAND_VERSION>" }
//
// h is the hash, s the rendered sizes (ascending), t the thumbnail size
// (products only). src/lib/images.js builds the URLs from it
// (imageFromEntry); meta.js reads a share image's size from the
// `--<w>x<h>-` part of its name.

import { createHash } from 'node:crypto';

// Bump to re-render every photo (a new hash, so new file names).
export const VERSION = 4;
// Card and detail widths: 320 for 1x/2x phone cards, 480 for 3x phone cards
// and 2x tablets (AW-322), 640 and 1024 for the product page.
export const PRODUCT_WIDTHS = [320, 480, 640, 1024];
export const HERO_WIDTHS = [480, 720];
// WebP is rendered at every width. The JPEG fallback (browsers without WebP)
// stops at this width, which keeps the build output about half the size.
export const JPEG_MAX_WIDTH = 640;
// Product thumbnails fit inside this box: the 52px cart and checkout
// thumbnails and the 40px search results, at up to 2x (AW-324). JPEG only:
// thumbnails are a plain <img>.
export const THUMB_BOX = 112;
export const WEBP = { quality: 78, effort: 4 };
export const JPEG = { quality: 78, progressive: true, mozjpeg: true };
// JPEG has no alpha; transparent sources are flattened onto the photo tile
// colour, white since the tiles are white (AW-141; --tile in src/index.css).
export const TILE_BG = '#ffffff';

// The settings each kind of source is rendered with. All of them go into the
// hash, so changing any value re-renders that kind.
export const SETTINGS = {
  product: { version: VERSION, widths: PRODUCT_WIDTHS, jpegMax: JPEG_MAX_WIDTH, thumb: THUMB_BOX, webp: WEBP, jpeg: JPEG, background: TILE_BG },
  hero: { version: VERSION, widths: HERO_WIDTHS, jpegMax: JPEG_MAX_WIDTH, webp: WEBP, jpeg: JPEG, background: TILE_BG },
};

// JSON with object keys sorted at every level, so the hash does not depend on
// the order the settings were written in.
export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// First 8 hex digits of sha1(bytes + settings JSON).
export function contentHash(bytes, settings) {
  return createHash('sha1').update(bytes).update(stableJson(settings)).digest('hex').slice(0, 8);
}

// Widths to render for a source: every target below ~90% of the source width,
// plus the source width itself (capped at the largest target). Never wider
// than the source: nothing is enlarged (AW-073).
export function targetWidths(sourceWidth, targets) {
  const max = targets[targets.length - 1];
  const widths = targets.filter((w) => w < sourceWidth * 0.9);
  widths.push(Math.min(sourceWidth, max));
  return [...new Set(widths)].sort((a, b) => a - b);
}

// [[w, h], …] for a source of width × height, heights rounded to keep the
// source's aspect ratio.
export function renditionSizes(width, height, targets) {
  return targetWidths(width, targets).map((w) => [w, Math.max(1, Math.round((height * w) / width))]);
}

// The thumbnail size: the source fitted inside a box × box square, never
// enlarged.
export function thumbSize(width, height, box) {
  const scale = Math.min(1, box / width, box / height);
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

// The sizes that also get a JPEG: those up to jpegMax (always at least the
// smallest one).
export function jpegSizes(sizes, jpegMax) {
  const small = sizes.filter(([w]) => w <= jpegMax);
  return small.length ? small : sizes.slice(0, 1);
}

export const renditionFile = (base, [w, h], hash, ext) => `${base}--${w}x${h}-${hash}.${ext}`;
export const thumbFile = (base, [w, h], hash) => `${base}--thumb-${w}x${h}-${hash}.jpg`;

// Every file a manifest entry stands for, as { file, size, ext, thumb }.
export function entryOutputs(base, entry, jpegMax) {
  const out = entry.s.map((size) => ({ file: renditionFile(base, size, entry.h, 'webp'), size, ext: 'webp', thumb: false }));
  for (const size of jpegSizes(entry.s, jpegMax)) out.push({ file: renditionFile(base, size, entry.h, 'jpg'), size, ext: 'jpg', thumb: false });
  if (entry.t) out.push({ file: thumbFile(base, entry.t, entry.h), size: entry.t, ext: 'jpg', thumb: true });
  return out;
}

export const entryFiles = (base, entry, jpegMax) => entryOutputs(base, entry, jpegMax).map((o) => o.file);

const isSize = (s) => Array.isArray(s) && s.length === 2 && s.every((n) => Number.isInteger(n) && n > 0);

// A manifest entry read back from disk is reused only when it has this shape;
// anything else is measured again.
export function isEntry(entry, { thumb }) {
  return Boolean(entry) && typeof entry.h === 'string' && /^[0-9a-f]{8}$/.test(entry.h)
    && Array.isArray(entry.s) && entry.s.length > 0 && entry.s.every(isSize)
    && (thumb ? isSize(entry.t) : entry.t === undefined);
}

// The manifest as text: sorted keys, one line per image, so a diff of two
// builds shows which photos changed.
export function serializeManifest({ version, jpegMax, images, brand }) {
  const lines = Object.keys(images).sort().map((base) => {
    const { h, s, t } = images[base];
    const entry = t ? { h, s, t } : { h, s };
    return `    ${JSON.stringify(base)}: ${JSON.stringify(entry)}`;
  });
  return [
    '{',
    `  "version": ${JSON.stringify(version)},`,
    `  "jpegMax": ${JSON.stringify(jpegMax)},`,
    lines.length ? `  "images": {\n${lines.join(',\n')}\n  },` : '  "images": {},',
    `  "brand": ${JSON.stringify(brand ?? null)}`,
    '}',
    '',
  ].join('\n');
}
