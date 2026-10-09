#!/usr/bin/env node
// Renders the responsive image library, favicon set, and share image.
//
// Runs automatically before `npm run dev` and `npm run build` (see package.json).
// Nothing it writes is committed: public/img/, src/assets/generated/ and the
// favicon files in public/ are gitignored, so the repo only carries the
// original photos.
//
//   src/assets/products/*   -> public/img/<base>--<w>x<h>-<hash>.{webp,jpg}
//                              public/img/<base>--thumb-<w>x<h>-<hash>.jpg
//   src/assets/hero_*.jpg   -> public/img/<base>--<w>x<h>-<hash>.{webp,jpg}
//   every photo above       -> src/assets/generated/manifest.json
//   src/assets/logo.jpg     -> public/favicon.ico, favicon-32.png, apple-touch-icon.png,
//                              icon-192.png, icon-512.png, og.jpg
//
// File names, sizes and the manifest format are in scripts/image-pipeline.mjs.
// Re-runs are incremental by content, never by file time: a photo whose hash
// (its bytes plus the render settings) matches the manifest and whose files
// all exist is skipped, so a fresh checkout or a restored build cache
// (netlify/plugins/image-cache, the CI cache step) renders nothing. Files no
// photo needs any more are removed. Change VERSION or a setting in
// image-pipeline.mjs to re-render the photos, and BRAND_VERSION below to
// rebuild the brand files.

import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  JPEG, JPEG_MAX_WIDTH, SETTINGS, TILE_BG, VERSION, WEBP,
  contentHash, entryOutputs, isEntry, renditionSizes, serializeManifest, thumbSize,
} from './image-pipeline.mjs';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'src/assets');
const PRODUCTS_DIR = path.join(ASSETS, 'products');
const OUT_DIR = path.join(ASSETS, 'generated');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const IMG_DIR = path.join(PUBLIC_DIR, 'img');
const LOGO = path.join(ASSETS, 'logo.jpg');
// Bump BRAND_VERSION when brand rendering changes (buildBrandAssets() below:
// sizes, crops, colours, a new output), so the next run rebuilds the brand
// files. A new logo.jpg rebuilds them on its own: its bytes are hashed too.
const BRAND_VERSION = 1;
const CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length));

const SOURCE_RE = /\.(webp|jpe?g|png|avif)$/i;
const baseName = (file) => path.basename(file).replace(SOURCE_RE, '');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readManifest() {
  try { return JSON.parse(await fs.readFile(MANIFEST, 'utf8')); } catch { return null; }
}

// The upright size of a source (EXIF orientation applied, as .rotate() renders it).
async function sourceSize(bytes) {
  const meta = await sharp(bytes, { animated: false }).metadata();
  const upright = meta.autoOrient || meta;
  return [upright.width, upright.height];
}

// A source's manifest entry: the previous run's when the hash still matches
// (no need to read the image), else measured again.
async function entryFor(kind, bytes, hash, previousEntry, stats) {
  const thumb = kind === 'product';
  if (previousEntry?.h === hash && isEntry(previousEntry, { thumb })) return previousEntry;
  stats.measured++;
  const [width, height] = await sourceSize(bytes);
  const entry = { h: hash, s: renditionSizes(width, height, SETTINGS[kind].widths) };
  if (thumb) entry.t = thumbSize(width, height, SETTINGS[kind].thumb);
  return entry;
}

// Writes each output at exactly the size its name gives. A file appears under
// its final name only once complete, so an interrupted run never leaves a
// truncated file that a later run would take as done.
async function render(bytes, outputs, stats) {
  const upright = sharp(bytes, { animated: false }).rotate();
  for (const { file, size: [width, height], ext } of outputs) {
    let pipeline = upright.clone().resize({ width, height, fit: 'fill' });
    if (ext === 'webp') pipeline = pipeline.webp(WEBP);
    else pipeline = pipeline.flatten({ background: TILE_BG }).jpeg(JPEG);
    const out = path.join(IMG_DIR, file);
    await pipeline.toFile(`${out}.tmp`);
    await fs.rename(`${out}.tmp`, out);
    stats.written++;
  }
}

async function runPool(jobs) {
  let next = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      await job();
    }
  });
  await Promise.all(workers);
}

async function buildLibrary(previous) {
  await fs.mkdir(IMG_DIR, { recursive: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const products = (await fs.readdir(PRODUCTS_DIR)).filter((f) => SOURCE_RE.test(f)).map((f) => path.join(PRODUCTS_DIR, f));
  const heroes = (await fs.readdir(ASSETS)).filter((f) => /^hero_.*\.(jpe?g|png|webp)$/i.test(f)).map((f) => path.join(ASSETS, f));

  const bases = new Map();
  for (const f of [...products, ...heroes]) {
    const b = baseName(f);
    if (bases.has(b)) throw new Error(`Two source images share the base name "${b}": ${bases.get(b)} and ${f}`);
    bases.set(b, f);
  }

  const present = new Set(await fs.readdir(IMG_DIR));
  const stats = { expected: new Set(), kept: 0, rendered: 0, measured: 0, written: 0, removed: 0 };
  const images = {};
  const jobs = [];
  const sources = [...products.map((file) => ['product', file]), ...heroes.map((file) => ['hero', file])];
  for (const [kind, file] of sources) {
    const base = baseName(file);
    const bytes = await fs.readFile(file);
    const hash = contentHash(bytes, SETTINGS[kind]);
    const entry = await entryFor(kind, bytes, hash, previous?.images?.[base], stats);
    images[base] = entry;
    const outputs = entryOutputs(base, entry, JPEG_MAX_WIDTH);
    for (const o of outputs) stats.expected.add(o.file);
    const missing = outputs.filter((o) => !present.has(o.file));
    if (!missing.length) { stats.kept++; continue; }
    stats.rendered++;
    jobs.push(() => render(bytes, missing, stats));
  }
  await runPool(jobs);

  // Files no photo needs any more, and the renditions earlier versions of
  // this script wrote next to the manifest.
  for (const f of await fs.readdir(IMG_DIR)) {
    if (stats.expected.has(f)) continue;
    await fs.rm(path.join(IMG_DIR, f), { force: true, recursive: true });
    stats.removed++;
  }
  for (const f of await fs.readdir(OUT_DIR)) {
    if (f === path.basename(MANIFEST)) continue;
    await fs.rm(path.join(OUT_DIR, f), { force: true, recursive: true });
    stats.removed++;
  }
  return { sources: sources.length, images, ...stats };
}

// ---------------------------------------------------------------------------
// Favicons and share image from the logo
// ---------------------------------------------------------------------------

// The hash manifest.brand stores: the logo's bytes and BRAND_VERSION.
async function brandHash() {
  return contentHash(await fs.readFile(LOGO), { brandVersion: BRAND_VERSION });
}

// Wrap PNG buffers in an ICO container (modern browsers accept PNG-encoded entries).
function packIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

async function averageColor(file, region) {
  const { data, info } = await sharp(file).extract(region).raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += info.channels) { sum[0] += data[i]; sum[1] += data[i + 1]; sum[2] += data[i + 2]; }
  const n = data.length / info.channels;
  return { r: Math.round(sum[0] / n), g: Math.round(sum[1] / n), b: Math.round(sum[2] / n) };
}

async function buildBrandAssets() {
  const logoHash = await brandHash();
  const outputs = ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og.jpg'].map((f) => path.join(PUBLIC_DIR, f));
  const fresh = await Promise.all(outputs.map(async (f) => logoHash === previous?.brand && (await exists(f))));
  if (fresh.every(Boolean)) return { written: 0 };

  const meta = await sharp(LOGO).metadata();
  // The JPG has a thin light edge; inset a little so tiles and the share image are clean.
  const inset = Math.round(meta.width * 0.02);
  const tile = sharp(LOGO).extract({ left: inset, top: inset, width: meta.width - inset * 2, height: meta.height - inset * 2 });
  const tileBuf = await tile.png().toBuffer();
  const orange = await averageColor(LOGO, { left: inset, top: inset, width: 12, height: 12 });

  // Small sizes use the swoosh mark alone; the wordmark is unreadable below 48px.
  const mark = { left: Math.round(meta.width * 0.1), top: Math.round(meta.height * 0.325), width: Math.round(meta.width * 0.194), height: Math.round(meta.height * 0.2875) };
  const markSide = Math.round(Math.max(mark.width, mark.height) * 1.22);
  const markBuf = await sharp(LOGO).extract(mark).png().toBuffer();
  const markTile = await sharp({ create: { width: markSide, height: markSide, channels: 3, background: orange } })
    .composite([{ input: markBuf, left: Math.floor((markSide - mark.width) / 2), top: Math.floor((markSide - mark.height) / 2) }])
    .png().toBuffer();

  const icoPngs = [];
  for (const size of [16, 32, 48]) {
    icoPngs.push({ size, data: await sharp(markTile).resize(size, size).png().toBuffer() });
  }
  await fs.writeFile(path.join(PUBLIC_DIR, 'favicon.ico'), packIco(icoPngs));
  await fs.writeFile(path.join(PUBLIC_DIR, 'favicon-32.png'), icoPngs[1].data);
  await sharp(tileBuf).resize(180, 180).png().toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  await sharp(tileBuf).resize(192, 192).png().toFile(path.join(PUBLIC_DIR, 'icon-192.png'));
  await sharp(tileBuf).resize(512, 512).png().toFile(path.join(PUBLIC_DIR, 'icon-512.png'));

  // 1200x630 share image: the logo tile centred on the site's purple.
  const logoSize = 400;
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#281459' } })
    .composite([{ input: await sharp(tileBuf).resize(logoSize, logoSize).toBuffer(), left: Math.round((1200 - logoSize) / 2), top: Math.round((630 - logoSize) / 2) }])
    .jpeg({ quality: 85, progressive: true, mozjpeg: true })
    .toFile(path.join(PUBLIC_DIR, 'og.jpg'));
  return { written: outputs.length };
}

const started = Date.now();
if (!(await exists(PRODUCTS_DIR))) {
  console.error(`build-images: missing ${PRODUCTS_DIR}`);
  process.exit(1);
}
const previous = await readManifest();
const library = await buildLibrary(previous);
const brand = await buildBrandAssets();
const manifest = serializeManifest({ version: VERSION, jpegMax: JPEG_MAX_WIDTH, images: library.images, brand: await brandHash() });
const manifestChanged = (await fs.readFile(MANIFEST, 'utf8').catch(() => '')) !== manifest;
// Rewritten only when it changes, so a running dev server does not reload.
if (manifestChanged) await fs.writeFile(MANIFEST, manifest);
console.log(
  `build-images: ${library.sources} sources → ${library.expected.size} files ` +
  `(${library.written} written for ${library.rendered} sources, ${library.kept} up to date, ${library.measured} measured, ${library.removed} stale removed); ` +
  `brand assets ${brand.written ? 'rebuilt' : 'up to date'}; manifest ${manifestChanged ? 'updated' : 'unchanged'}; ` +
  `${((Date.now() - started) / 1000).toFixed(1)}s`
);
