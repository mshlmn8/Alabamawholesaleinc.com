// Image asset references. Vite's import.meta.url resolver turns each
// new URL(...) call into a hashed, cacheable asset URL at build time, so the
// original JPG is served (not inlined into JS). Colors and type live in
// ../index.css as custom properties.

// Hero + logo only — product photos now live in ../assets/products/ and are
// resolved by getImg() in ./products.js via import.meta.glob.
export const IMG = {
  logo: new URL('../assets/logo.jpg', import.meta.url).href,
  hero_vape: new URL('../assets/hero_vape.jpg', import.meta.url).href,
  hero_lighters: new URL('../assets/hero_lighters.jpg', import.meta.url).href,
  hero_candy: new URL('../assets/hero_candy.jpg', import.meta.url).href,
  hero_gatorade: new URL('../assets/hero_gatorade.jpg', import.meta.url).href,
  // Two SKUs still on legacy assets until matching photos are found.
  p_gatorade: new URL('../assets/p_gatorade.jpg', import.meta.url).href,
  p_qcarbo: new URL('../assets/p_qcarbo.jpg', import.meta.url).href
};
