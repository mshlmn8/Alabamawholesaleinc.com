// Responsive image sets for product and hero photos.
//
// scripts/build-images.mjs (run by `npm run images`, and automatically before
// dev and build) renders every source photo into public/img, under names
// that carry a hash of the photo and its render settings, and records each
// photo in src/assets/generated/manifest.json (format: scripts/image-pipeline.mjs).
// This module builds the URLs from that one small manifest (AW-180), and
// exposes each photo as { img, picture }:
//
//   img      products: the 112px thumbnail JPEG (search, cart and checkout
//            lines, AW-324); heroes: the smallest JPEG (the video poster).
//            Also the "has a photo" check and the share-image fallback.
//   picture  { src, srcSet, webpSrcSet, width, height } for <Picture>
//
// In development, a photo the manifest doesn't list (the script has not run
// since it was added, e.g. a dev server started before pulling) falls back
// to the original file served by the dev server so nothing disappears.
// Production builds always run the script first and ship only the renditions.
// Before the script has ever run (unit tests in CI) the manifest is missing
// and every photo takes that fallback.

const MANIFEST = Object.values(import.meta.glob('../assets/generated/manifest.json', { eager: true, import: 'default' }))[0] || {};
const ENTRIES = MANIFEST.images || {};
const JPEG_MAX = MANIFEST.jpegMax || 640;

// The path is assembled at runtime on purpose: a literal template here would
// make Vite bundle every original photo into the production build as well.
function devOriginal(relativePath) {
  if (!import.meta.env.DEV) return null;
  const rel = relativePath;
  return new URL(rel, import.meta.url).href;
}

const stripExt = (file) => String(file).replace(/\.[^.]+$/, '');
const srcSetOf = (list) => list.map((v) => `${v.url} ${v.w}w`).join(', ');
const single = (url) => ({ img: url, picture: { src: url, srcSet: '', webpSrcSet: '', width: undefined, height: undefined } });
const NONE = { img: null, picture: null };

// { img, picture } for one manifest entry ({ h, s, t }, see
// scripts/image-pipeline.mjs). The URLs match the file names the build
// script writes into public/img, which Vite serves at <base URL>img/.
export function imageFromEntry(base, entry, jpegMax) {
  const root = `${import.meta.env.BASE_URL}img/${encodeURIComponent(base)}--`;
  const file = ([w, h], ext) => ({ url: `${root}${w}x${h}-${entry.h}.${ext}`, w, h });
  const webp = entry.s.map((size) => file(size, 'webp'));
  const small = entry.s.filter(([w]) => w <= jpegMax);
  const jpg = (small.length ? small : entry.s.slice(0, 1)).map((size) => file(size, 'jpg'));
  const largest = webp[webp.length - 1];
  return {
    img: entry.t ? `${root}thumb-${entry.t[0]}x${entry.t[1]}-${entry.h}.jpg` : jpg[0].url,
    picture: {
      src: jpg[jpg.length - 1].url,
      srcSet: srcSetOf(jpg),
      webpSrcSet: srcSetOf(webp),
      width: largest.w,
      height: largest.h,
    },
  };
}

function fromManifest(base, originalUrl) {
  const entry = ENTRIES[base];
  if (entry) return imageFromEntry(base, entry, JPEG_MAX);
  return originalUrl ? single(originalUrl) : NONE;
}

// `file` is a filename in src/assets/products (as stored in the catalog and
// the products table) or a full URL such as Supabase Storage.
export function productImage(file) {
  if (!file) return NONE;
  const name = String(file).trim();
  if (!name) return NONE;
  if (/^(https?:)?\/\//i.test(name) || name.startsWith('data:') || name.startsWith('/')) return single(name);
  return fromManifest(stripExt(name), devOriginal(`../assets/products/${name}`));
}

// The photo files that more than one catalog row uses (AW-136): a shared
// photo shows one size or pack, so a row with a sell unit badges it on the
// photo. `rows` are raw catalog rows ({ img: filename or URL or null }).
export function sharedImageFiles(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    const file = row?.img == null ? '' : String(row.img).trim();
    if (!file) continue;
    counts.set(file, (counts.get(file) || 0) + 1);
  }
  return new Set([...counts].filter(([, n]) => n > 1).map(([file]) => file));
}

// `file` is a filename in src/assets, e.g. 'hero_candy.jpg'.
export function heroImage(file) {
  const name = String(file).trim();
  return fromManifest(stripExt(name), devOriginal(`../assets/${name}`));
}

// `sizes` values: the width the photo is shown at, worked out from the CSS in
// index.css (AW-322), so phones pick the 320 or 480 rendition instead of 640.
// The conditions are in em like the CSS breakpoints (37.5em = 600px,
// 53.125em = 850px, 68.75em = 1100px, 84em = 1344px at the default text
// size). SHORT_LANDSCAPE is the second half of MOBILE_QUERY, which applies
// the compact layout at any width. Change these with the CSS.
//
// card: the photo area is the tile minus its 1px borders and the img's 14px
// inset on each side (30px). The page container is 100% − 32px (compact) or
// − 64px, at most 1280px, with 24px gaps (16px on phones). No card is
// narrower than 12.5rem (AW-154): the rows of four (home rails, the product
// page's "More" row, search) show two up to 58.5em; the category grid shows
// at most 3, beside the 220px filter column and its 34px gap on desktop, and
// 2 where 3 would be narrower than 200px. The value is the widest card at
// each width, whichever grid it is in:
//   phone        (100vw − 32 − 16) / 2 − 30        = (100vw − 108px) / 2
//   compact      rows of two: (100vw − 32 − 24) / 2 − 30 = (100vw − 116px) / 2
//                (a phone held sideways wider than 58.5em gets this too: more than it needs)
//   to 58.5em    rows of two: (100vw − 64 − 24) / 2 − 30 = (100vw − 148px) / 2
//   to 965px     category in two: (100vw − 64 − 254 − 24) / 2 − 30 = (100vw − 402px) / 2
//   to 66em      rows of four: (100vw − 64 − 72) / 4 − 30 = (100vw − 256px) / 4
//   desktop      category in three: (100vw − 64 − 254 − 48) / 3 − 30 = (100vw − 456px) / 3
//   max          (1280 − 254 − 48) / 3 − 30        = 296px
// detail: .pd-media minus its 1px borders and the img's 34px inset (20px in
// the compact layout). One column in the compact layout, except a phone held
// sideways, whose photo takes 2 of 5 parts beside the name and price (AW-150);
// two columns with a 26px gap up to 68.75em and a 40px gap above. The compact
// frame is also no taller than 36% of the screen (45% held sideways), which
// can draw the photo narrower than this: a little more than it needs.
//   sideways (100vw − 32 − 26) × 2/5 − 42      = (100vw − 163px) × 2 / 5
//   compact  100vw − 32 − 2 − 40               = 100vw − 74px
//   narrow   (100vw − 64 − 26) / 2 − 70        = (100vw − 230px) / 2
//   desktop  (100vw − 64 − 40) / 2 − 70        = (100vw − 244px) / 2
//   max      (1280 − 40) / 2 − 70              = 550px
const SHORT_LANDSCAPE = '(hover: none) and (pointer: coarse) and (max-height: 31.25em)';
export const SIZES = {
  card: `(max-width: 37.5em) calc((100vw - 108px) / 2), (max-width: 53.125em) calc((100vw - 116px) / 2), ${SHORT_LANDSCAPE} calc((100vw - 116px) / 2), (max-width: 58.5em) calc((100vw - 148px) / 2), (max-width: 60.3125em) calc((100vw - 402px) / 2), (max-width: 66em) calc((100vw - 256px) / 4), (max-width: 84em) calc((100vw - 456px) / 3), 296px`,
  detail: `${SHORT_LANDSCAPE} calc((100vw - 163px) * 2 / 5), (max-width: 53.125em) calc(100vw - 74px), (max-width: 68.75em) calc((100vw - 230px) / 2), (max-width: 84em) calc((100vw - 244px) / 2), 550px`,
  editorial: '(max-width: 37.5em) 100vw, (max-width: 84em) 50vw, 628px',
};
