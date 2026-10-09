// Photo URLs from the image manifest (AW-180, AW-324) and the `sizes` the
// card and product-page photos are requested with (AW-322).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIZES, heroImage, imageFromEntry, productImage, sharedImageFiles, zoomPicture, zoomSizes } from './images.js';
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
      // No zoom rendition (a photo no wider than 1024): the largest one.
      zoom: { src: '/img/p1-kite--1024x931-1a2b3c4d.webp', width: 1024, height: 931 },
    });
  });

  it('gives a wider product photo its zoom WebP, named by its own hash, and leaves it out of every srcset (AW-236)', () => {
    const zoomed = { ...product, z: { h: '5e6f7a8b', s: [1600, 1455] } };
    const { picture, zoom } = imageFromEntry('p1-kite', zoomed, 640);
    expect(zoom).toEqual({ src: '/img/p1-kite--1600x1455-5e6f7a8b.webp', width: 1600, height: 1455 });
    // The page's photo and the cards are unchanged: the 1024 rendition is still the largest they ask for.
    expect(picture).toEqual(imageFromEntry('p1-kite', product, 640).picture);
    expect(`${picture.srcSet}, ${picture.webpSrcSet}`).not.toMatch(/1600/);
    expect(new Set(entryFiles('p1-kite', zoomed, 640)).has(decodeURIComponent(zoom.src.slice('/img/'.length)))).toBe(true);
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
      expect(productImage(url)).toEqual({
        img: url,
        picture: { src: url, srcSet: '', webpSrcSet: '', width: undefined, height: undefined },
        zoom: { src: url, width: undefined, height: undefined },
      });
    }
  });

  it('has nothing for an empty file name', () => {
    expect(productImage('')).toEqual({ img: null, picture: null, zoom: null });
    expect(productImage('  ')).toEqual({ img: null, picture: null, zoom: null });
    expect(productImage(null)).toEqual({ img: null, picture: null, zoom: null });
  });

  it('gives a hero no zoom', () => {
    expect(Object.keys(heroImage('hero_candy.jpg'))).toEqual(['img', 'picture']);
  });

  it('falls back to the original file in development for a photo the manifest does not list', () => {
    const { img, picture } = productImage('not-rendered-yet.jpg');
    expect(img).toMatch(/\/assets\/products\/not-rendered-yet\.jpg$/);
    expect(picture.srcSet).toBe('');
  });
});

// The enlarged photo (AW-236, LEFT-5): the 1024 and zoom WebP renditions,
// with sizes no larger than what the dialog shows.
describe('zoomPicture and zoomSizes', () => {
  const zoomed = { ...product, z: { h: '5e6f7a8b', s: [1600, 1455] } };

  it('offers the dialog the largest rendition and the zoom one, with the page’s JPEG fallback', () => {
    const { picture, zoom } = imageFromEntry('p1-kite', zoomed, 640);
    expect(zoomPicture(picture, zoom)).toEqual({
      ...picture,
      webpSrcSet: '/img/p1-kite--1024x931-1a2b3c4d.webp 1024w, /img/p1-kite--1600x1455-5e6f7a8b.webp 1600w',
      width: 1600,
      height: 1455,
    });
  });

  it('keeps the page’s picture without a zoom rendition, for a single URL, and without a zoom at all', () => {
    const { picture, zoom } = imageFromEntry('p1-kite', product, 640);
    expect(zoomPicture(picture, zoom)).toBe(picture);
    const storage = productImage('https://x.supabase.co/storage/v1/object/public/p/kite.jpg');
    expect(zoomPicture(storage.picture, storage.zoom)).toBe(storage.picture);
    expect(zoomPicture(picture, undefined)).toBe(picture);
    expect(zoomPicture(null, zoom)).toBeNull();
  });

  // The dialog's photo from index.css: on a phone the dialog is the screen
  // wide less 2 × 8px padding; wider, at most 92vw less 2 × 16px; the photo
  // at most min(80vh, 100vh − 11rem) tall, and 1.1 times as wide as tall.
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const shown = (vw, vh) => {
    const width = vw <= 600 ? vw - 16 : 0.92 * vw - 32;
    return Math.min(width, 1.1 * Math.min(0.8 * vh, vh - 176));
  };
  // The first entry of a sizes list whose media condition matches.
  const pick = (sizes, vw, vh) => {
    for (const entry of sizes.split(', ')) {
      const parts = /^((?:\([^)]*\)(?: and )?)*)\s*(\S+)$/.exec(entry);
      const conditions = [...parts[1].matchAll(/\(([a-z-]+): ([^)]+)\)/g)];
      const matches = conditions.every(([, feature, value]) => {
        if (feature === 'max-width') return vw <= (value.endsWith('em') ? 16 * parseFloat(value) : parseFloat(value));
        if (feature === 'max-height') return vh <= parseFloat(value);
        if (feature === 'min-aspect-ratio') { const [a, b] = value.split('/').map(Number); return vw / vh >= a / b; }
        throw new Error(`unknown feature ${feature}`);
      });
      if (!matches) continue;
      const value = parts[2];
      if (value.endsWith('vw')) return (parseFloat(value) / 100) * vw;
      if (value.endsWith('vh')) return (parseFloat(value) / 100) * vh;
      return parseFloat(value);
    }
    throw new Error('no entry matched');
  };

  it('reads the dialog geometry it assumes from index.css', () => {
    expect(css).toMatch(/\.dialog\.pd-zoom-dialog \{[^}]*max-width: 92vw; padding: 12px 16px 16px; \}/);
    expect(css).toMatch(/\.pd-zoom-dialog img \{[^}]*max-height: min\(80vh, calc\(100vh - 11rem\)\);/);
    expect(css).toMatch(/@media \(max-width: 37\.5em\) \{\s*\.overlay\.pd-zoom-overlay \{ padding: 0; \}\s*\.dialog\.pd-zoom-dialog \{ max-width: 100%; padding: 8px 8px 12px; \}/);
  });

  it.each([[1440, 900], [1366, 650], [1920, 1080], [2560, 1440], [1280, 1600], [1024, 768], [768, 1024], [844, 390], [390, 844], [360, 740], [600, 960], [3840, 2160]])(
    'never asks for less than the dialog shows, nor more than the file, at %ix%i', (vw, vh) => {
      for (const width of [1600, 1236, 1024, 458]) {
        const asked = pick(zoomSizes(width), vw, vh);
        expect(asked).toBeLessThanOrEqual(width);
        expect(asked).toBeGreaterThanOrEqual(Math.min(width, shown(vw, vh)) - 0.5);
      }
    },
  );

  it('takes the 1024 rendition at 1440x900 and the zoom one on a 2x screen', () => {
    const asked = pick(zoomSizes(1600), 1440, 900);
    expect(asked).toBeCloseTo(792, 0);
    expect(asked).toBeLessThanOrEqual(1024);
    expect(asked * 2).toBeGreaterThan(1024);
  });

  it('has no sizes without a width', () => {
    expect(zoomSizes(undefined)).toBeUndefined();
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
  // A phone on its side: the photo's share of the two columns (AW-150).
  const sideways = /@media \(orientation: landscape\) \{\s*\.pd-grid \{ grid-template-columns: minmax\(0, (\d+)fr\) minmax\(0, (\d+)fr\)/.exec(css);
  if (!sideways) throw new Error('index.css no longer has the sideways product page columns');
  const g = {
    pdSideways: Number(sideways[1]) / (Number(sideways[1]) + Number(sideways[2])),
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
    pdCompactInset: px(/@media \(max-width: 53\.125em\), \(hover: none\) and \(pointer: coarse\) and \(max-height: 31\.25em\) \{[\s\S]*?\.pd-media img \{ inset: (\d+)px; max-width: calc\(100% - \d+px\)/),
    pdGap: px(/\.pd-grid \{[^}]*gap: (\d+)px/),
    pdNarrowGap: px(/@media \(max-width: 68\.75em\) \{[\s\S]*?\.pd-grid \{ gap: (\d+)px/),
  };

  // The photo's shown size at a viewport width, from those numbers. A card
  // in the category grid: three columns, or two where three would be
  // narrower than minCard; the page wide in the compact layout, beside the
  // filter column above it. `card` is the wider of that and a card in a row
  // of four (or two): the widest card in any grid.
  const chrome = 2 * (g.cardBorder + g.cardInset);
  const columnsOf = (space, columns) => (space - (columns - 1) * g.gap) / columns - chrome;
  const containerAt = (vw, compact) => (compact || vw <= 850 ? vw - g.compactMargin : Math.min(vw - g.margin, g.max));
  const categoryCard = (vw, compact) => {
    if (vw <= 600) return (vw - g.compactMargin - g.phoneColumnGap) / 2 - chrome;
    const space = compact || vw <= 850 ? containerAt(vw, compact) : containerAt(vw, compact) - g.sidebar - g.sidebarGap;
    return columnsOf(space, space >= 3 * g.minCard + 2 * g.gap ? 3 : 2);
  };
  const card = (vw, compact) => {
    if (vw <= 600) return categoryCard(vw, compact);
    const row = columnsOf(containerAt(vw, compact), vw <= g.rowsOfTwo ? 2 : 4);
    return Math.max(row, categoryCard(vw, compact));
  };
  const detail = (vw, compact) => {
    const compactChrome = 2 * (g.pdBorder + g.pdCompactInset);
    if (compact) return (vw - g.compactMargin - g.pdNarrowGap) * g.pdSideways - compactChrome;
    if (vw <= 850) return vw - g.compactMargin - compactChrome;
    const chrome = 2 * (g.pdBorder + g.pdInset);
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
    expect(SIZES.categoryCard).toContain(shortLandscape);
    expect(SIZES.detail).toContain(shortLandscape);
  });

  it.each([320, 360, 390, 412, 430, 600, 601, 640, 679, 680, 700, 768, 800, 820, 850, 851, 900, 936, 937, 965, 966, 1000, 1024, 1056, 1057, 1100, 1101, 1280, 1344, 1345, 1440, 1920])('matches the CSS at %ipx', (vw) => {
    expect(evaluate(SIZES.card, vw, false)).toBeCloseTo(card(vw, false), 5);
    expect(evaluate(SIZES.categoryCard, vw, false)).toBeCloseTo(categoryCard(vw, false), 5);
    expect(evaluate(SIZES.detail, vw, false)).toBeCloseTo(detail(vw, false), 5);
  });

  it.each([667, 740, 844, 896, 932])('matches the compact layout on a %ipx-wide phone held sideways', (vw) => {
    expect(evaluate(SIZES.card, vw, true)).toBeCloseTo(card(vw, true), 5);
    expect(evaluate(SIZES.categoryCard, vw, true)).toBeCloseTo(categoryCard(vw, true), 5);
    expect(evaluate(SIZES.detail, vw, true)).toBeCloseTo(detail(vw, true), 5);
  });

  // AW-322: from 680 to 850px the department grid is three across, the
  // rows of cards two; the grid used to ask for the row's card, 1.5 to 2
  // times its own.
  it('asks the department grid for its own cards: three across from 680 to 850px', () => {
    expect(categoryCard(679, false)).toBeGreaterThan(categoryCard(680, false) * 1.5);
    for (const vw of [680, 768, 850]) {
      expect(evaluate(SIZES.categoryCard, vw, false)).toBeCloseTo((vw - 170) / 3, 5);
      expect(evaluate(SIZES.card, vw, false) / evaluate(SIZES.categoryCard, vw, false)).toBeGreaterThan(1.4);
    }
    // At 768 on a 2x screen: about 400 device px, so the 480 rendition, not the 1024 one.
    expect(evaluate(SIZES.categoryCard, 768, false) * 2).toBeLessThanOrEqual(480);
    // The same everywhere the grid matches a row of cards.
    for (const vw of [390, 600, 851, 1000, 1440]) expect(evaluate(SIZES.categoryCard, vw, false)).toBeCloseTo(categoryCard(vw, false), 5);
  });

  it('asks a 390px phone for about 141px cards, so 2x screens take the 320 rendition and 3x the 480', () => {
    expect(evaluate(SIZES.card, 390, false)).toBe(141);
    expect(evaluate(SIZES.card, 390, false) * 2).toBeLessThanOrEqual(320);
    expect(evaluate(SIZES.card, 390, false) * 3).toBeLessThanOrEqual(480);
  });
});
