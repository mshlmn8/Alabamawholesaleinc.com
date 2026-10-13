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
//
// returnFocus: a ref to the element that takes focus when the layer closes,
// before its openers, read at close time. A dialog whose action removes its
// opener (a confirmed bulk change resets the bar that opened it) points it
// at what stays (NEW-004). Focus handed back this way, or to the fallbacks,
// never scrolls the page.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { focusPageHeading, holdOverlayEntry, lastPageMove } from '../lib/router.js';

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

// The body's own inline padding-right while layers hold the page still, to
// put back when the last one closes; null while none is open.
let bodyLock = null;

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
  const body = document.body;
  if (open && !bodyLock) {
    // Hiding the page's overflow removes a classic scrollbar (Windows, Linux,
    // macOS set to always show them), and the page slid sideways by its
    // width. The body is padded by that width instead (AW-333): measured
    // once, before the overflow changes, since a layer stacked on another
    // would read 0. scrollbar-gutter doesn't do it: the page still moved, or
    // the wheel scrolled the page behind the layer. jsdom's clientWidth is 0.
    const html = document.documentElement;
    const scrollbar = window.innerWidth - html.clientWidth;
    bodyLock = { paddingRight: body.style.paddingRight };
    if (html.clientWidth > 0 && scrollbar > 0 && scrollbar < 50) body.style.paddingRight = `${scrollbar}px`;
  } else if (!open && bodyLock) {
    body.style.paddingRight = bodyLock.paddingRight;
    bodyLock = null;
  }
  body.style.overflow = open ? 'hidden' : '';
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

// Focuses el if it can still take focus: still on the page, and neither
// hidden (display:none, such as the menu toggle on desktop) nor inert, which
// the browser refuses. preventScroll: focus it where it is, without
// scrolling the page to it.
function takesFocus(el, { preventScroll = false } = {}) {
  if (!el || el === document.body || !el.isConnected || typeof el.focus !== 'function') return false;
  el.focus(preventScroll ? { preventScroll: true } : undefined);
  return document.activeElement === el;
}

// Hands focus back: to the layer's returnFocus element when it names one
// still on the page (NEW-004), else along the chain of openers (AW-249).
// Menu -> Help -> 'Apply for a trade account' unmounts the first two
// openers, so the walk goes on to the first one still on the page. With none
// left, focus goes to the phone menu button when it shows, else to the
// page's heading, never to <body>; neither moves the page (a confirmed
// change far down a long list once threw the reader back to the top).
// While a lower layer stays open, focus stays inside that layer.
function restoreFocus(entry) {
  if (takesFocus(entry.returnFocus?.current, { preventScroll: true })) return;
  if (entry.openers.some((el) => takesFocus(el))) return;
  const top = stack[stack.length - 1];
  if (top?.container) {
    (focusables(top.container)[0] || top.container).focus({ preventScroll: true });
    return;
  }
  const menuToggle = document.querySelector('.aw-menu-toggle');
  if (menuToggle && isVisible(menuToggle) && takesFocus(menuToggle, { preventScroll: true })) return;
  focusPageHeading();
}

// Captured during the first render, before any autoFocus inside the layer
// moves focus. A layer opened from inside another layer (Help -> Apply, cart
// -> sign in) also keeps that layer's openers, in case it closes at the same
// time: the chain runs from the nearest opener out to the one on the page.
function createEntry(onClose, returnFocus) {
  const active = document.activeElement;
  const fromLayer = portalRoot && portalRoot.contains(active);
  const below = stack[stack.length - 1];
  const openers = [active, ...(fromLayer && below ? below.openers : [])]
    .filter((el) => el && el !== document.body);
  return {
    openers,
    onClose,
    returnFocus,
    container: null,
    lastInside: null,
    pageMoveAtOpen: lastPageMove(),
  };
}

export function ModalLayer({ onClose, initialFocus, returnFocus = null, className = '', historyEntry = true, children }) {
  const ref = useRef(null);
  // This layer's record on the module-level stack; mutable on purpose, so it
  // lives in a ref that is created once, on the first render.
  const entryRef = useRef(null);
  if (entryRef.current === null) entryRef.current = createEntry(onClose, returnFocus);
  // Escape always calls the latest onClose; closing reads the latest returnFocus.
  useLayoutEffect(() => {
    entryRef.current.onClose = onClose;
    entryRef.current.returnFocus = returnFocus;
  });

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
