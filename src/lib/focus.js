// Focus that follows a cart line after React redraws the list. A line that
// is re-keyed (a bare line moved to its variant, AW-011) is a new element,
// so focus would otherwise drop to <body>. Each line is an element with
// data-line-key="<line key>" inside listEl (CartLine's <li>).

const nextFrame = (fn) => (typeof window.requestAnimationFrame === 'function'
  ? window.requestAnimationFrame(fn)
  : window.setTimeout(fn, 16));

// The line's element in listEl, or null.
export function lineElement(listEl, key) {
  if (!listEl) return null;
  return [...listEl.querySelectorAll('[data-line-key]')].find((el) => el.dataset.lineKey === String(key)) || null;
}

// Moves focus to `selector` in the line keyed `key` (its quantity input by
// default; else its first control) once it is on the page, trying for a few
// frames. If the line never appears, focus goes to `fallback` when given.
export function focusLineSoon(listEl, key, { selector = 'input', fallback = null, tries = 6 } = {}) {
  if (!listEl) return;
  let left = tries;
  const attempt = () => {
    const line = lineElement(listEl, key);
    const target = line && (line.querySelector(selector) || line.querySelector('input, select, button, a[href]'));
    if (target) {
      target.focus();
      return;
    }
    left -= 1;
    if (left > 0) nextFrame(attempt);
    else if (fallback?.isConnected) fallback.focus();
  };
  nextFrame(attempt);
}
