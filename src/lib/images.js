// Responsive image sets for product and hero photos.
//
// scripts/build-images.mjs (run by `npm run images`, and automatically before
// dev and build) renders every source photo into src/assets/generated as
// `<base>--<width>x<height>.webp` and `.jpg`. This module groups those files
// by base name and exposes each photo as { img, picture }:
//
//   img      URL of the smallest JPEG — for thumbnails and any plain <img src>
//   picture  { src, srcSet, webpSrcSet, width, height } for <Picture>
//
// In development, a photo whose generated set is missing (the script has not
// run yet, e.g. a dev server started before pulling) falls back to the
// original file served by the dev server so nothing disappears. Production
// builds always run the script first and ship only the generated sizes.

const GENERATED = import.meta.glob('../assets/generated/*.{webp,jpg}', { eager: true, query: '?url', import: 'default' });

// The path is assembled at runtime on purpose: a literal template here would
// make Vite bundle every original photo into the production build as well.
function devOriginal(relativePath) {
  if (!import.meta.env.DEV) return null;
  const rel = relativePath;
  return new URL(rel, import.meta.url).href;
}

const SETS = new Map();
for (const [file, url] of Object.entries(GENERATED)) {
  const m = file.match(/\/([^/]+)--(\d+)x(\d+)\.(webp|jpg)$/);
  if (!m) continue;
  const [, base, w, h, ext] = m;
  const set = SETS.get(base) || { webp: [], jpg: [] };
  set[ext].push({ url, w: Number(w), h: Number(h) });
  SETS.set(base, set);
}
for (const set of SETS.values()) {
  set.webp.sort((a, b) => a.w - b.w);
  set.jpg.sort((a, b) => a.w - b.w);
}

const stripExt = (file) => String(file).replace(/\.[^.]+$/, '');
const srcSetOf = (list) => list.map((v) => `${v.url} ${v.w}w`).join(', ');
const single = (url) => ({ img: url, picture: { src: url, srcSet: '', webpSrcSet: '', width: undefined, height: undefined } });
const NONE = { img: null, picture: null };

function fromSet(base, originalUrl) {
  const set = SETS.get(base);
  if (!set) return originalUrl ? single(originalUrl) : NONE;
  const fallback = set.jpg.length ? set.jpg : set.webp;
  const largest = set.webp.length ? set.webp[set.webp.length - 1] : fallback[fallback.length - 1];
  return {
    img: fallback[0].url,
    picture: {
      src: fallback[fallback.length - 1].url,
      srcSet: srcSetOf(fallback),
      webpSrcSet: srcSetOf(set.webp),
      width: largest.w,
      height: largest.h,
    },
  };
}

// `file` is a filename in src/assets/products (as stored in the catalog and
// the products table) or a full URL such as Supabase Storage.
export function productImage(file) {
  if (!file) return NONE;
  const name = String(file).trim();
  if (!name) return NONE;
  if (/^(https?:)?\/\//i.test(name) || name.startsWith('data:') || name.startsWith('/')) return single(name);
  return fromSet(stripExt(name), devOriginal(`../assets/products/${name}`));
}

// `file` is a filename in src/assets, e.g. 'hero_candy.jpg'.
export function heroImage(file) {
  const name = String(file).trim();
  return fromSet(stripExt(name), devOriginal(`../assets/${name}`));
}

// `sizes` values matching the CSS in index.css: a 4-up grid inside the
// 1280px container, 3-up beside the category filters, 2-up on phones.
export const SIZES = {
  card: '(max-width: 600px) 46vw, (max-width: 850px) 24vw, (max-width: 1344px) 23vw, 302px',
  detail: '(max-width: 850px) 100vw, (max-width: 1344px) 47vw, 620px',
  editorial: '(max-width: 600px) 100vw, (max-width: 1344px) 50vw, 628px',
};
