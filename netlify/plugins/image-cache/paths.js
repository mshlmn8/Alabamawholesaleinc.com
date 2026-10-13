// The paths the image-cache plugin keeps between Netlify builds (AW-355): the
// outputs of scripts/build-images.mjs, relative to the repository root.
//
// They live here, not in index.js, because Netlify treats every export of a
// build plugin's main file as an event handler and stops the build on any
// other name ("Invalid event 'CACHE_PATHS'").
export const CACHE_PATHS = [
  'public/img',
  'src/assets/generated',
  'public/favicon.ico',
  'public/favicon-32.png',
  'public/apple-touch-icon.png',
  'public/icon-192.png',
  'public/icon-512.png',
  'public/icon-maskable-512.png',
  'public/og.jpg',
];
