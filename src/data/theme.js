// Image asset references. Vite's import.meta.url resolver turns each
// new URL(...) call into a hashed, cacheable asset URL at build time, so the
// original JPG is served (not inlined into JS). Colors and type live in
// ../index.css as custom properties.

// Logo only — product photos live in ../assets/products/ and hero photos in
// ../assets/; both are resolved as responsive sets by ../lib/images.js.
export const IMG = {
  logo: new URL('../assets/logo.jpg', import.meta.url).href
};
