// Brand colors, fonts, and image asset references. Vite's import.meta.url
// resolver turns each new URL(...) call into a hashed, cacheable asset URL at
// build time, so the original JPG is served (not inlined into JS).

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

export const C = {
  orange:      '#DB6433',
  orangeDark:  '#B84F23',
  orangeLite:  '#FCEFE6',
  navy:        '#1E1B5C',
  navyDark:    '#13104A',
  navyLite:    '#E8E7F2',
  bg:          '#FFF8F2',
  card:        '#FFFFFF',
  text:        '#1A1A1A',
  muted:       '#6B6B6B',
  // Bumped from #9A9A9A — failed WCAG AA on cream backgrounds.
  mutedSoft:   '#767676',
  border:      '#EFE2D5',
  borderSoft:  '#F5EBE0',
  greenTag:    '#1F7A47',
  whatsapp:    '#25D366',
  yellow:      '#F4B400'
};

export const body    = { fontFamily: "'Inter', system-ui, sans-serif", fontStyle: 'normal' };
export const display = body;
export const mono    = { fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontStyle: 'normal' };
