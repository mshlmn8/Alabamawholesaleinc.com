// Pure helpers for scripts/build-images.mjs (no file system, no sharp), so the
// naming, sizing and manifest rules are unit-tested in image-pipeline.test.mjs.
//
// Every rendition is named after its content (AW-180, AW-355):
//
//   public/img/<base>--<w>x<h>-<hash>.webp|jpg       responsive sizes
//   public/img/<base>--thumb-<w>x<h>-<hash>.jpg      product thumbnail (AW-324)
//   public/img/<base>--<w>x<h>-<zoom hash>.webp      product zoom (AW-236)
//
// <hash> is the first 8 hex digits of sha1(source bytes + the render
// settings), so a changed photo or a changed setting gives new file names,
// and the files can be cached as immutable (netlify.toml, "/img/*"). The same
// hash is how a rerun knows a source is unchanged: no file times are read.
// The zoom rendition has its own hash, of the bytes and the zoom settings
// (SETTINGS.zoom), so adding it, or changing it, leaves the responsive
// sizes' names alone.
//
// One manifest, src/assets/generated/manifest.json, records each source:
//
//   { "version": 5, "jpegMax": 640,
//     "images": { "<base>": { "h": "1a2b3c4d", "s": [[320,291], …], "t": [112,102],
//                             "z": { "h": "5e6f7a8b", "s": [1600,1455] } } },
//     "brand": "<hash of logo.jpg and BRAND_VERSION>" }
//
// h is the hash, s the rendered sizes (ascending), t the thumbnail size
// (products only), z the zoom rendition's hash and size (only products whose
// framed photo is wider than the largest size). src/lib/images.js builds the
// URLs from it (imageFromEntry); meta.js reads a share image's size from the
// `--<w>x<h>-` part of its name.

import { createHash } from 'node:crypto';

// Bump to re-render every photo (a new hash, so new file names).
// 5: product photos trimmed and framed at one scale (AW-287).
export const VERSION = 5;
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

// Product photos are framed at one scale (AW-287). Sources arrive with
// uneven built-in margins, so a product filled anywhere from about 60% to
// 100% of its card. For each product source the pipeline finds the product's
// box: the source less its near-white or transparent margins (pixels within
// trimThreshold of white; a photo with a dark or busy edge has none, so its
// box is the whole photo). Around that box it cuts a window of the card
// tile's aspect (1.1, .card-block in index.css) on which the box's limiting
// side is `share` of the window, taking the source's own pixels where it
// covers the window (faint shadows next to the product stay as they are) and
// adding white, or transparency where the source has alpha, past its edges.
// The tile's 14px inset comes on top, so on a desktop card the product spans
// about 80% of the tile. Only margins change: product pixels are copied 1:1,
// never scaled up (AW-073) or edited. Heroes are not framed.
export const FRAME = { aspect: 1.1, share: 0.89, trimThreshold: 18 };

// The settings each kind of source is rendered with. All of them go into the
// hash, so changing any value re-renders that kind.
// The enlarged photo on the product page (AW-236, LEFT-5): one WebP up to
// this wide, for a product whose framed photo is wider than the largest of
// PRODUCT_WIDTHS, never enlarged. Only the zoom dialog asks for it: it is in
// no srcset of the page or the cards, so they still load at most the 1024
// rendition. No JPEG: a browser without WebP enlarges the 640 JPEG.
export const ZOOM_WIDTH = 1600;
export const SETTINGS = {
  product: { version: VERSION, widths: PRODUCT_WIDTHS, jpegMax: JPEG_MAX_WIDTH, thumb: THUMB_BOX, webp: WEBP, jpeg: JPEG, background: TILE_BG, frame: FRAME },
  hero: { version: VERSION, widths: HERO_WIDTHS, jpegMax: JPEG_MAX_WIDTH, webp: WEBP, jpeg: JPEG, background: TILE_BG },
  // Hashed apart from the product settings, so the zoom file's name follows
  // what shapes it (the framed photo, its width and the WebP settings).
  zoom: { version: VERSION, width: ZOOM_WIDTH, webp: WEBP, background: TILE_BG, frame: FRAME },
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

// The zoom rendition's size for a framed photo of width × height: up to
// `zoom` wide, keeping the aspect ratio, and only when the photo is wider
// than `above` (the largest responsive size), so it is never enlarged and
// never a copy of that size. Null otherwise.
export function zoomSize(width, height, { zoom = ZOOM_WIDTH, above = PRODUCT_WIDTHS[PRODUCT_WIDTHS.length - 1] } = {}) {
  if (!(width > above)) return null;
  const w = Math.min(width, zoom);
  return [w, Math.max(1, Math.round((height * w) / width))];
}

// Whether a product entry's photo may be wider than the largest size, so
// only measuring it can tell whether it gets a zoom rendition: its largest
// size is the cap (a narrower photo's largest size is its own width).
export function mayZoom(entry, above = PRODUCT_WIDTHS[PRODUCT_WIDTHS.length - 1]) {
  return Boolean(entry?.s?.length) && entry.s[entry.s.length - 1][0] >= above;
}

// The thumbnail size: the source fitted inside a box × box square, never
// enlarged.
export function thumbSize(width, height, box) {
  const scale = Math.min(1, box / width, box / height);
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

// The product's box in the source from sharp's trim info (its offsets are
// negative). With nothing trimmed it is the whole source.
export function trimBox(info, sourceWidth, sourceHeight) {
  const left = Math.abs(info.trimOffsetLeft || 0);
  const top = Math.abs(info.trimOffsetTop || 0);
  return { left, top, width: Math.min(info.width, sourceWidth - left), height: Math.min(info.height, sourceHeight - top) };
}

// The framed canvas for a product of width × height: the card tile's aspect,
// with the product's limiting side `share` of it, centred. Returns the
// canvas size and the margin to add on each side (never negative).
export function frameGeometry(width, height, { aspect, share }) {
  let w, h;
  if (width / height >= aspect) {
    w = Math.round(width / share);
    h = Math.round(w / aspect);
  } else {
    h = Math.round(height / share);
    w = Math.round(h * aspect);
  }
  w = Math.max(w, width);
  h = Math.max(h, height);
  const left = Math.floor((w - width) / 2);
  const top = Math.floor((h - height) / 2);
  return { width: w, height: h, left, top, right: w - width - left, bottom: h - height - top };
}

// The framed canvas as a window on a sourceWidth × sourceHeight source,
// centred on the product box: the part of the source to copy (extract) and
// the padding to add where the window runs past the source (extend).
export function frameWindow(box, sourceWidth, sourceHeight, frame) {
  const g = frameGeometry(box.width, box.height, frame);
  const x = box.left - g.left;
  const y = box.top - g.top;
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(sourceWidth, x + g.width);
  const y1 = Math.min(sourceHeight, y + g.height);
  return {
    width: g.width,
    height: g.height,
    extract: { left: x0, top: y0, width: x1 - x0, height: y1 - y0 },
    extend: { top: y0 - y, bottom: y + g.height - y1, left: x0 - x, right: x + g.width - x1 },
  };
}

// The sizes that also get a JPEG: those up to jpegMax (always at least the
// smallest one).
export function jpegSizes(sizes, jpegMax) {
  const small = sizes.filter(([w]) => w <= jpegMax);
  return small.length ? small : sizes.slice(0, 1);
}

export const renditionFile = (base, [w, h], hash, ext) => `${base}--${w}x${h}-${hash}.${ext}`;
export const thumbFile = (base, [w, h], hash) => `${base}--thumb-${w}x${h}-${hash}.jpg`;

// Every file a manifest entry stands for, as { file, size, ext, thumb }; the
// zoom rendition also has zoom: true.
export function entryOutputs(base, entry, jpegMax) {
  const out = entry.s.map((size) => ({ file: renditionFile(base, size, entry.h, 'webp'), size, ext: 'webp', thumb: false }));
  for (const size of jpegSizes(entry.s, jpegMax)) out.push({ file: renditionFile(base, size, entry.h, 'jpg'), size, ext: 'jpg', thumb: false });
  if (entry.t) out.push({ file: thumbFile(base, entry.t, entry.h), size: entry.t, ext: 'jpg', thumb: true });
  if (entry.z) out.push({ file: renditionFile(base, entry.z.s, entry.z.h, 'webp'), size: entry.z.s, ext: 'webp', thumb: false, zoom: true });
  return out;
}

export const entryFiles = (base, entry, jpegMax) => entryOutputs(base, entry, jpegMax).map((o) => o.file);

const isSize = (s) => Array.isArray(s) && s.length === 2 && s.every((n) => Number.isInteger(n) && n > 0);
const isHash = (h) => typeof h === 'string' && /^[0-9a-f]{8}$/.test(h);

// A manifest entry read back from disk is reused only when it has this shape;
// anything else is measured again. Only products (thumb) may have a zoom.
export function isEntry(entry, { thumb }) {
  return Boolean(entry) && isHash(entry.h)
    && Array.isArray(entry.s) && entry.s.length > 0 && entry.s.every(isSize)
    && (thumb ? isSize(entry.t) : entry.t === undefined)
    && (entry.z === undefined || (thumb && Boolean(entry.z) && isHash(entry.z.h) && isSize(entry.z.s)));
}

// The manifest as text: sorted keys, one line per image, so a diff of two
// builds shows which photos changed.
export function serializeManifest({ version, jpegMax, images, brand }) {
  const lines = Object.keys(images).sort().map((base) => {
    const { h, s, t, z } = images[base];
    const entry = { h, s, ...(t ? { t } : {}), ...(z ? { z: { h: z.h, s: z.s } } : {}) };
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
