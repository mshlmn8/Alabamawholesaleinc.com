// Keeps the rendered photos between Netlify builds (AW-355).
//
// `npm run build` first runs scripts/build-images.mjs, which renders every
// product and hero photo (about 2,000 files) and the brand files. Those are
// gitignored, so every deploy would start without them and render them all
// again. This plugin puts back the previous build's files before the build
// (onPreBuild) and saves them after it (onPostBuild). The script then skips
// every photo whose content hash still matches the manifest, and renders only
// new or changed ones; a cache from older settings is harmless, because the
// file names change with the settings and stale files are removed.
//
// Registered in netlify.toml as a local plugin. It uses only the `utils.cache`
// Netlify passes in, so it needs no npm package. .github/workflows/ci.yml
// caches the same paths for CI.

// Only Netlify event handlers may be exported from this file (see paths.js).
import { CACHE_PATHS } from './paths.js';

export async function onPreBuild({ utils }) {
  const restored = await utils.cache.restore(CACHE_PATHS);
  console.log(restored
    ? 'image-cache: restored the rendered photos from the last build'
    : 'image-cache: nothing cached yet; every photo is rendered');
}

export async function onPostBuild({ utils }) {
  const saved = await utils.cache.save(CACHE_PATHS);
  console.log(saved
    ? 'image-cache: saved the rendered photos for the next build'
    : 'image-cache: nothing to save');
}
