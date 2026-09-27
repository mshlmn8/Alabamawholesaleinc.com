#!/usr/bin/env node
// Renders the responsive image library, favicon set, and share image.
//
// Runs automatically before `npm run dev` and `npm run build` (see package.json).
// Nothing it writes is committed: src/assets/generated/ and the favicon files in
// public/ are gitignored, so the repo only carries the original photos.
//
//   src/assets/products/*            -> src/assets/generated/<base>--<w>x<h>.{webp,jpg}
//   src/assets/hero_*.jpg            -> src/assets/generated/<base>--<w>x<h>.{webp,jpg}
//   src/assets/logo.jpg              -> public/favicon.ico, favicon-32.png, apple-touch-icon.png,
//                                       icon-192.png, icon-512.png, og.jpg
//
// Widths are capped at the source width (never upscaled). Re-runs are incremental:
// outputs newer than their source are kept, and outputs whose source is gone are
// removed. Bump VERSION when changing sizes or quality to force a full rebuild.

import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'src/assets');
const PRODUCTS_DIR = path.join(ASSETS, 'products');
const OUT_DIR = path.join(ASSETS, 'generated');
const PUBLIC_DIR = path.join(ROOT, 'public');
const LOGO = path.join(ASSETS, 'logo.jpg');

const VERSION = 2;
const PRODUCT_WIDTHS = [320, 640, 1024];
const HERO_WIDTHS = [480, 720];
// WebP is rendered at every width. The JPEG fallback (browsers without WebP,
// plus the small thumbnails that use a plain <img>) stops at this width so the
// build output stays roughly half the size.
const JPEG_MAX_WIDTH = 640;
const WEBP = { quality: 78, effort: 4 };
const JPEG = { quality: 78, progressive: true, mozjpeg: true };
// JPEG has no alpha; transparent PNG sources are flattened onto the card background.
const CARD_BG = '#f6f3ee';
const CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length));

const SOURCE_RE = /\.(webp|jpe?g|png|avif)$/i;
const baseName = (file) => path.basename(file).replace(SOURCE_RE, '');

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function mtime(p) {
  try { return (await fs.stat(p)).mtimeMs; } catch { return 0; }
}

// Widths to render for a source: every target below ~90% of the source width,
// plus the source width itself (capped at the largest target).
function targetWidths(sourceWidth, targets) {
  const max = targets[targets.length - 1];
  const widths = targets.filter((w) => w < sourceWidth * 0.9);
  widths.push(Math.min(sourceWidth, max));
  return [...new Set(widths)].sort((a, b) => a - b);
}

async function renderSource(file, targets, stats) {
  const base = baseName(file);
  const image = sharp(file, { animated: false });
  const meta = await image.metadata();
  const srcTime = await mtime(file);
  const jobs = [];
  for (const width of targetWidths(meta.width, targets)) {
    const height = Math.max(1, Math.round((meta.height * width) / meta.width));
    const stem = path.join(OUT_DIR, `${base}--${width}x${height}`);
    for (const ext of ['webp', 'jpg']) {
      if (ext === 'jpg' && width > JPEG_MAX_WIDTH) continue;
      const out = `${stem}.${ext}`;
      stats.expected.add(path.basename(out));
      if ((await mtime(out)) >= srcTime) { stats.kept++; continue; }
      jobs.push(async () => {
        let pipeline = sharp(file, { animated: false }).rotate().resize({ width, withoutEnlargement: true });
        if (ext === 'webp') pipeline = pipeline.webp(WEBP);
        else pipeline = pipeline.flatten({ background: CARD_BG }).jpeg(JPEG);
        await pipeline.toFile(out);
        stats.written++;
      });
    }
  }
  return jobs;
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

async function buildLibrary() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stampFile = path.join(OUT_DIR, '.version');
  const stamp = await fs.readFile(stampFile, 'utf8').catch(() => '');
  if (stamp.trim() !== String(VERSION)) {
    for (const f of await fs.readdir(OUT_DIR)) await fs.rm(path.join(OUT_DIR, f), { force: true });
    await fs.writeFile(stampFile, `${VERSION}\n`);
  }

  const products = (await fs.readdir(PRODUCTS_DIR)).filter((f) => SOURCE_RE.test(f)).map((f) => path.join(PRODUCTS_DIR, f));
  const heroes = (await fs.readdir(ASSETS)).filter((f) => /^hero_.*\.(jpe?g|png|webp)$/i.test(f)).map((f) => path.join(ASSETS, f));

  const bases = new Map();
  for (const f of [...products, ...heroes]) {
    const b = baseName(f);
    if (bases.has(b)) throw new Error(`Two source images share the base name "${b}": ${bases.get(b)} and ${f}`);
    bases.set(b, f);
  }

  const stats = { expected: new Set(), kept: 0, written: 0, removed: 0 };
  const jobs = [];
  for (const f of products) jobs.push(...(await renderSource(f, PRODUCT_WIDTHS, stats)));
  for (const f of heroes) jobs.push(...(await renderSource(f, HERO_WIDTHS, stats)));
  await runPool(jobs);

  for (const f of await fs.readdir(OUT_DIR)) {
    if (f === '.version' || stats.expected.has(f)) continue;
    await fs.rm(path.join(OUT_DIR, f), { force: true });
    stats.removed++;
  }
  return { sources: products.length + heroes.length, ...stats };
}

// ---------------------------------------------------------------------------
// Favicons and share image from the logo
// ---------------------------------------------------------------------------

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
  const logoTime = await mtime(LOGO);
  const outputs = ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og.jpg'].map((f) => path.join(PUBLIC_DIR, f));
  const fresh = await Promise.all(outputs.map(async (f) => (await mtime(f)) >= logoTime));
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
const library = await buildLibrary();
const brand = await buildBrandAssets();
console.log(
  `build-images: ${library.sources} sources → ${library.expected.size} files ` +
  `(${library.written} written, ${library.kept} up to date, ${library.removed} stale removed); ` +
  `brand assets ${brand.written ? 'rebuilt' : 'up to date'}; ${((Date.now() - started) / 1000).toFixed(1)}s`
);
