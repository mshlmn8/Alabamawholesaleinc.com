// Modal focus management for the overlay dialogs: move focus into the dialog
// when it opens, keep Tab inside it, make everything behind it inert, and
// return focus to the element that opened it when it closes.

import { useEffect } from 'react';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

const isVisible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

export function useDialogFocus(dialogRef, { active = true } = {}) {
  useEffect(() => {
    if (!active) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const opener = document.activeElement;

    // The overlay is rendered inside the app tree, so its siblings are the
    // whole storefront. `inert` removes them from tabbing and the accessibility
    // tree; aria-hidden covers browsers that predate inert.
    const overlay = dialog.closest('.overlay') || dialog;
    const background = Array.from(overlay.parentElement?.children || []).filter(el => el !== overlay);
    const saved = background.map(el => ({ el, inert: el.hasAttribute('inert'), ariaHidden: el.getAttribute('aria-hidden') }));
    background.forEach(el => { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); });

    const focusables = () => Array.from(dialog.querySelectorAll(FOCUSABLE)).filter(isVisible);
    const focusInitial = () => {
      const target = dialog.querySelector('[data-autofocus]') || focusables()[0] || dialog;
      target.focus({ preventScroll: true });
    };
    const frame = window.requestAnimationFrame(focusInitial);

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) { e.preventDefault(); dialog.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const outside = !dialog.contains(current);
      if (e.shiftKey && (current === first || outside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (current === last || outside)) { e.preventDefault(); first.focus(); }
    };
    // Focus that lands behind the dialog (e.g. via a programmatic focus) is pulled back in.
    const onFocusIn = (e) => { if (!overlay.contains(e.target)) focusInitial(); };
    dialog.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      window.cancelAnimationFrame(frame);
      dialog.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      saved.forEach(({ el, inert, ariaHidden }) => {
        if (!inert) el.removeAttribute('inert');
        if (ariaHidden == null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', ariaHidden);
      });
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [dialogRef, active]);
}
