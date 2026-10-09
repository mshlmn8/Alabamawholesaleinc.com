// Focus that follows a cart line after React redraws the list. A line that
// is re-keyed (a bare line moved to its variant, AW-011) is a new element,
// and a removed line takes its focused Remove with it (AW-042), so focus would
// otherwise drop to <body>. Each line is an element with
// data-line-key="<line key>" inside listEl (CartLine's <li>).

const nextFrame = (fn) => (typeof window.requestAnimationFrame === 'function'
  ? window.requestAnimationFrame(fn)
  : window.setTimeout(fn, 16));

// The line's element in listEl, or null.
export function lineElement(listEl, key) {
  if (!listEl) return null;
  return [...listEl.querySelectorAll('[data-line-key]')].find((el) => el.dataset.lineKey === String(key)) || null;
}

// A line's quantity box, or its remove button when it has none (a line that
// needs a variant, or can no longer be ordered).
export const LINE_CONTROL = 'input, .drawer-remove';

// The line that takes focus when the line `key` is removed from `keys` (the
// list's line keys, in order): the next one, else the one before, else null.
export function neighbourKey(keys, key) {
  const i = keys.indexOf(key);
  if (i === -1) return null;
  return keys[i + 1] ?? keys[i - 1] ?? null;
}

// Moves focus to `selector` in the line keyed `key` (its quantity input by
// default; else its first control) once it is on the page, trying for a few
// frames. If the line never appears, focus goes to `fallback` when given (an
// element, or a function that moves focus).
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
    else if (typeof fallback === 'function') fallback();
    else if (fallback?.isConnected) fallback.focus();
  };
  nextFrame(attempt);
}

// The control `el` is about to disappear: focus moves to its dialog's
// heading (the cart drawer's "Your order"), or to <main> outside a dialog,
// so it doesn't drop to <body>.
export function keepFocusNear(el) {
  const dialog = el?.closest('[role="dialog"]');
  const target = dialog ? (dialog.querySelector('h2') || dialog) : document.getElementById('main');
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}
