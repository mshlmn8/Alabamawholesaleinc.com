// The shared polite live region (AW-041). announce() tells screen-reader
// users about a change they would otherwise miss: the router uses it for
// page changes, and later features (cart adds, saved forms) can use it too.
//
// The region sits directly in <body>, outside #root, so it keeps speaking
// while a dialog makes #root inert. Its text is set with textContent, the
// only child of an element that is always there (safe under Google
// Translate, AW-039).

let region = null;
let timer = 0;

export function ensureLiveRegion() {
  if (typeof document === 'undefined') return null;
  if (region && document.body.contains(region)) return region;
  region = document.getElementById('aw-announcer');
  if (!region) {
    region = document.createElement('div');
    region.id = 'aw-announcer';
    region.className = 'sr-only';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);
  }
  return region;
}

// Clears the region, then writes the message a moment later, so the same
// message twice in a row is still read out.
export function announce(message) {
  const el = ensureLiveRegion();
  if (!el) return;
  el.textContent = '';
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { el.textContent = String(message || ''); }, 120);
}
