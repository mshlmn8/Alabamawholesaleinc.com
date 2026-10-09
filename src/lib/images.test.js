// Photo URLs from the image manifest (AW-180, AW-324) and the `sizes` the
// card and product-page photos are requested with (AW-322).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIZES, imageFromEntry, productImage, sharedImageFiles } from './images.js';
import { MOBILE_QUERY } from './useMediaQuery.js';
import { entryFiles } from '../../scripts/image-pipeline.mjs';

const product = { h: '1a2b3c4d', s: [[320, 291], [480, 436], [640, 582], [1024, 931]], t: [112, 102] };
const hero = { h: 'ffff0000', s: [[480, 270], [720, 405]] };

describe('imageFromEntry', () => {
  it('gives a product its thumbnail as img and a WebP set with JPEG fallbacks as picture', () => {
    expect(imageFromEntry('p1-kite', product, 640)).toEqual({
      img: '/img/p1-kite--thumb-112x102-1a2b3c4d.jpg',
      picture: {
        src: '/img/p1-kite--640x582-1a2b3c4d.jpg',
        srcSet: '/img/p1-kite--320x291-1a2b3c4d.jpg 320w, /img/p1-kite--480x436-1a2b3c4d.jpg 480w, /img/p1-kite--640x582-1a2b3c4d.jpg 640w',
        webpSrcSet: '/img/p1-kite--320x291-1a2b3c4d.webp 320w, /img/p1-kite--480x436-1a2b3c4d.webp 480w, /img/p1-kite--640x582-1a2b3c4d.webp 640w, /img/p1-kite--1024x931-1a2b3c4d.webp 1024w',
        // The largest rendition: Picture's width attribute caps the shown size.
        width: 1024,
        height: 931,
      },
    });
  });

  it('gives a hero its smallest JPEG as img (the video poster)', () => {
    const { img, picture } = imageFromEntry('hero_candy', hero, 640);
    expect(img).toBe('/img/hero_candy--480x270-ffff0000.jpg');
    expect(picture).toMatchObject({ src: '/img/hero_candy--480x270-ffff0000.jpg', width: 720, height: 405 });
  });

  it('names exactly the files the build script writes, with the base name URL-encoded', () => {
    const base = 'Bic lighters #2 (50%)';
    const { img, picture } = imageFromEntry(base, product, 640);
    const urls = [img, picture.src, ...`${picture.srcSet}, ${picture.webpSrcSet}`.split(', ').map((s) => s.split(' ')[0])];
    for (const url of urls) expect(url.startsWith(`/img/${encodeURIComponent(base)}--`)).toBe(true);
    const files = new Set(entryFiles(base, product, 640));
    expect(urls.map((url) => decodeURIComponent(url.slice('/img/'.length))).filter((f) => !files.has(f))).toEqual([]);
    expect(new Set(urls).size).toBe(files.size);
  });
});

describe('productImage', () => {
  it('passes full URLs, data: URLs and absolute paths through as a single image', () => {
    for (const url of ['https://x.supabase.co/storage/v1/object/public/p/kite.jpg', '//cdn.example.test/a.jpg', 'data:image/png;base64,AAAA', '/brand/kite.png']) {
      expect(productImage(url)).toEqual({ img: url, picture: { src: url, srcSet: '', webpSrcSet: '', width: undefined, height: undefined } });
    }
  });

  it('has nothing for an empty file name', () => {
    expect(productImage('')).toEqual({ img: null, picture: null });
    expect(productImage('  ')).toEqual({ img: null, picture: null });
    expect(productImage(null)).toEqual({ img: null, picture: null });
  });

  it('falls back to the original file in development for a photo the manifest does not list', () => {
    const { img, picture } = productImage('not-rendered-yet.jpg');
    expect(img).toMatch(/\/assets\/products\/not-rendered-yet\.jpg$/);
    expect(picture.srcSet).toBe('');
  });
});

describe('sharedImageFiles', () => {
  it('lists the files more than one row uses', () => {
    expect(sharedImageFiles([{ img: 'a.jpg' }, { img: ' a.jpg ' }, { img: 'b.jpg' }, { img: null }, {}])).toEqual(new Set(['a.jpg']));
  });
});

// The sizes are worked out from the CSS (see the comment above SIZES). These
// tests read the same numbers from index.css and check the sizes against
// them, so a layout change that would need new sizes fails here.
describe('SIZES follow the card and product-page geometry (AW-322)', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const px = (re) => {
    const m = re.exec(css);
    if (!m) throw new Error(`index.css no longer has ${re}`);
    return Number(m[1]);
  };
  const g = {
    margin: px(/\.container \{ width: calc\(100% - (\d+)px\)/),
    compactMargin: px(/@media \(max-width: 53\.125em\), \(hover: none\) and \(pointer: coarse\) and \(max-height: 31\.25em\) \{[\s\S]*?\.container \{ width: calc\(100% - (\d+)px\)/),
    max: px(/\.container \{[^}]*max-width: (\d+)px/),
    gap: px(/--grid-gap: (\d+)px/),
    phoneColumnGap: px(/\.card-grid \{ grid-template-columns: repeat\(2,minmax\(0,1fr\)\); gap: \d+px (\d+)px/),
    sidebar: px(/\.catalog-layout \{[^}]*grid-template-columns: (\d+)px/),
    sidebarGap: px(/\.catalog-layout \{[^}]*gap: (\d+)px/),
    // Rows of four become two at this width (AW-154).
    rowsOfTwo: 16 * px(/@media \(max-width: ([\d.]+)em\) \{\s*\.card-grid \{ grid-template-columns: repeat\(2, minmax\(0,1fr\)\); \}/),
    // The category grid: columns no narrower than this, at most three.
    minCard: 16 * px(/\.category-card-grid \{ grid-template-columns: repeat\(auto-fill, minmax\(max\(([\d.]+)rem, \(100% - 2 \* var\(--grid-gap\)\) \/ 3\), 1fr\)\); \}/),
    cardBorder: px(/\.card-block \{[^}]*border: (\d+)px solid/),
    cardInset: px(/\.card-block img \{[^}]*inset: (\d+)px/),
    pdBorder: px(/\.pd-media \{[^}]*border: (\d+)px solid/),
    pdInset: px(/\.pd-media img \{[^}]*inset: (\d+)px/),
    pdPhoneInset: px(/\.pd-media img \{ inset: (\d+)px; max-width: calc\(100% - \d+px\)/),
    pdGap: px(/\.pd-grid \{[^}]*gap: (\d+)px/),
    pdNarrowGap: px(/@media \(max-width: 68\.75em\) \{[\s\S]*?\.pd-grid \{ gap: (\d+)px/),
  };

  // The photo's widest shown size at a viewport width, from those numbers:
  // the wider of a card in a row of four (or two) and one in the category
  // grid (three, or two where three would be narrower than minCard).
  const card = (vw, compact) => {
    const chrome = 2 * (g.cardBorder + g.cardInset);
    if (vw <= 600) return (vw - g.compactMargin - g.phoneColumnGap) / 2 - chrome;
    const width = (space, columns) => (space - (columns - 1) * g.gap) / columns - chrome;
    const container = compact || vw <= 850 ? vw - g.compactMargin : Math.min(vw - g.margin, g.max);
    const category = compact || vw <= 850 ? container : container - g.sidebar - g.sidebarGap;
    const row = width(container, vw <= g.rowsOfTwo ? 2 : 4);
    return Math.max(row, width(category, category >= 3 * g.minCard + 2 * g.gap ? 3 : 2));
  };
  const detail = (vw, compact) => {
    if (vw <= 600) return vw - g.compactMargin - 2 * (g.pdBorder + g.pdPhoneInset);
    const chrome = 2 * (g.pdBorder + g.pdInset);
    if (compact || vw <= 850) return vw - g.compactMargin - chrome;
    const gap = vw <= 1100 ? g.pdNarrowGap : g.pdGap;
    return (Math.min(vw - g.margin, g.max) - gap) / 2 - chrome;
  };

  // What a browser picks from a sizes list: the first entry whose condition
  // matches (max-width in em at 16px; the short-landscape condition when
  // `compact`), evaluated at the viewport width.
  const shortLandscape = MOBILE_QUERY.split(', ')[1];
  const evaluate = (sizes, vw, compact) => {
    for (const entry of sizes.split(/,\s*(?![^()]*\))/)) {
      const m = /^(\(max-width: ([\d.]+)em\)|\(hover: none\) and \(pointer: coarse\) and \(max-height: 31\.25em\))?\s*(.+)$/.exec(entry.trim());
      const [, condition, em, value] = m;
      const matches = !condition || (em ? vw <= Number(em) * 16 : compact);
      if (!matches) continue;
      const expr = value.replace(/100vw/g, String(vw)).replace(/px/g, '').replace(/^calc/, '');
      if (!/^[\d\s.+\-*/()]+$/.test(expr)) throw new Error(`cannot evaluate ${value}`);
      return Function(`return (${expr});`)();
    }
    throw new Error('no entry matched');
  };

  it('uses the short-landscape half of MOBILE_QUERY', () => {
    expect(shortLandscape).toBe('(hover: none) and (pointer: coarse) and (max-height: 31.25em)');
    expect(SIZES.card).toContain(shortLandscape);
    expect(SIZES.detail).toContain(shortLandscape);
  });

  it.each([320, 360, 390, 412, 430, 600, 601, 679, 680, 768, 820, 850, 851, 900, 936, 937, 965, 966, 1000, 1024, 1056, 1057, 1100, 1101, 1280, 1344, 1345, 1440, 1920])('matches the CSS at %ipx', (vw) => {
    expect(evaluate(SIZES.card, vw, false)).toBeCloseTo(card(vw, false), 5);
    expect(evaluate(SIZES.detail, vw, false)).toBeCloseTo(detail(vw, false), 5);
  });

  it.each([667, 740, 844, 932])('matches the compact layout on a %ipx-wide phone held sideways', (vw) => {
    expect(evaluate(SIZES.card, vw, true)).toBeCloseTo(card(vw, true), 5);
    expect(evaluate(SIZES.detail, vw, true)).toBeCloseTo(detail(vw, true), 5);
  });

  it('asks a 390px phone for about 141px cards, so 2x screens take the 320 rendition and 3x the 480', () => {
    expect(evaluate(SIZES.card, 390, false)).toBe(141);
    expect(evaluate(SIZES.card, 390, false) * 2).toBeLessThanOrEqual(320);
    expect(evaluate(SIZES.card, 390, false) * 3).toBeLessThanOrEqual(480);
  });
});
