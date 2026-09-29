// Shared shell for every modal surface (cart drawer, help dialog, mobile menu,
// filter drawer, auth modal). Children render in a portal outside the React
// root so the root can be made inert while a layer is open. The topmost layer
// owns Escape, keeps Tab inside itself, receives focus on open and hands focus
// back to the element that opened it on close.
//
// While open, a layer also holds a browser history entry (AW-065): the Back
// button then closes it through its onClose, like the × button, instead of
// changing the page underneath. Pass historyEntry={false} for a layer that
// Back must not dismiss.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { holdOverlayEntry, lastPageMove } from '../lib/router.js';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(', ');

const stack = [];
let portalRoot = null;
let listening = false;

function getPortalRoot() {
  if (!portalRoot) {
    portalRoot = document.createElement('div');
    portalRoot.id = 'aw-layers';
    document.body.appendChild(portalRoot);
  }
  return portalRoot;
}

const isVisible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
const focusables = (container) => Array.from(container.querySelectorAll(FOCUSABLE)).filter(isVisible);

function syncBackground() {
  const root = document.getElementById('root');
  const open = stack.length > 0;
  if (root) {
    if (open) {
      root.setAttribute('inert', '');
      root.setAttribute('aria-hidden', 'true');
    } else {
      root.removeAttribute('inert');
      root.removeAttribute('aria-hidden');
    }
  }
  document.body.style.overflow = open ? 'hidden' : '';
}

function onDocumentKeyDown(e) {
  const top = stack[stack.length - 1];
  if (!top || !top.container) return;
  if (e.key === 'Escape') {
    if (e.defaultPrevented) return;
    e.preventDefault();
    top.onClose?.();
    return;
  }
  if (e.key !== 'Tab') return;
  const items = focusables(top.container);
  if (items.length === 0) {
    e.preventDefault();
    top.container.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (!top.container.contains(active)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

function ensureListener() {
  if (listening) return;
  document.addEventListener('keydown', onDocumentKeyDown, true);
  listening = true;
}

function restoreFocus(entry) {
  const candidates = [entry.activeAtOpen, entry.fallbackOpener];
  for (const el of candidates) {
    if (el && el !== document.body && document.contains(el) && typeof el.focus === 'function') {
      el.focus();
      if (document.activeElement === el) return;
    }
  }
}

// Captured during the first render, before any autoFocus inside the layer
// moves focus. If the layer opens from inside another layer (cart -> sign in),
// remember that layer's opener too in case it closes at the same time.
function createEntry(onClose) {
  const active = document.activeElement;
  const fromLayer = portalRoot && portalRoot.contains(active);
  const below = stack[stack.length - 1];
  return {
    activeAtOpen: active,
    fallbackOpener: fromLayer ? (below?.activeAtOpen || below?.fallbackOpener || null) : null,
    onClose,
    container: null,
    lastInside: null,
    pageMoveAtOpen: lastPageMove(),
  };
}

export function ModalLayer({ onClose, initialFocus, className = '', historyEntry = true, children }) {
  const ref = useRef(null);
  // This layer's record on the module-level stack; mutable on purpose, so it
  // lives in a ref that is created once, on the first render.
  const entryRef = useRef(null);
  if (entryRef.current === null) entryRef.current = createEntry(onClose);
  // Escape always calls the latest onClose.
  useLayoutEffect(() => { entryRef.current.onClose = onClose; });

  useEffect(() => {
    const entry = entryRef.current;
    const container = ref.current;
    entry.container = container;
    stack.push(entry);
    ensureListener();
    syncBackground();
    const releaseHistory = historyEntry ? holdOverlayEntry(() => entry.onClose?.()) : null;

    // A layer can name its first field with a ref or a data-autofocus attribute;
    // otherwise the first focusable control (usually the close button) gets focus.
    const preferred = initialFocus?.current || container.querySelector('[data-autofocus]');
    if (entry.lastInside && container.contains(entry.lastInside)) {
      // Re-run of the effect (StrictMode, HMR): keep what the user had focused.
      entry.lastInside.focus({ preventScroll: true });
    } else if (preferred && container.contains(preferred)) {
      preferred.focus({ preventScroll: true });
    } else if (!container.contains(document.activeElement)) {
      const first = focusables(container)[0];
      (first || container).focus({ preventScroll: true });
    }

    return () => {
      const active = document.activeElement;
      entry.lastInside = container.contains(active) ? active : null;
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
      syncBackground();
      releaseHistory?.();
      // If another layer opened in the same commit (cart -> sign in) it already
      // holds focus; leave it there instead of pulling focus back to the page.
      // After a link inside the layer opened a new page, the router focuses
      // that page's heading instead (AW-041).
      const heldByAnotherLayer = portalRoot && portalRoot.contains(active) && !container.contains(active);
      if (!heldByAnotherLayer && lastPageMove() === entry.pageMoveAtOpen) restoreFocus(entry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per layer: it joins the stack and takes its history entry when it mounts; onClose is read through entryRef, and initialFocus/historyEntry only matter at open
  }, []);

  return createPortal(
    <div className={`aw-layer ${className}`.trim()} ref={ref} tabIndex={-1}>
      {children}
    </div>,
    getPortalRoot()
  );
}
