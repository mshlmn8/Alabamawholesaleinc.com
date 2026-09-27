// Shared shell for every modal surface (cart drawer, help dialog, mobile menu,
// filter drawer, auth modal). Children render in a portal outside the React
// root so the root can be made inert while a layer is open. The topmost layer
// owns Escape, keeps Tab inside itself, receives focus on open and hands focus
// back to the element that opened it on close.

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

export function ModalLayer({ onClose, initialFocus, className = '', children }) {
  const ref = useRef(null);
  // Captured during the first render, before any autoFocus inside the layer
  // moves focus. If the layer opens from inside another layer (cart -> sign
  // in), remember that layer's opener too in case it closes at the same time.
  const [entry] = useState(() => {
    const active = document.activeElement;
    const fromLayer = portalRoot && portalRoot.contains(active);
    const below = stack[stack.length - 1];
    return {
      activeAtOpen: active,
      fallbackOpener: fromLayer ? (below?.activeAtOpen || below?.fallbackOpener || null) : null,
      onClose,
      container: null,
      lastInside: null,
    };
  });
  entry.onClose = onClose;

  useEffect(() => {
    const container = ref.current;
    entry.container = container;
    stack.push(entry);
    ensureListener();
    syncBackground();

    const preferred = initialFocus?.current;
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
      // If another layer opened in the same commit (cart -> sign in) it already
      // holds focus; leave it there instead of pulling focus back to the page.
      const heldByAnotherLayer = portalRoot && portalRoot.contains(active) && !container.contains(active);
      if (!heldByAnotherLayer) restoreFocus(entry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className={`aw-layer ${className}`.trim()} ref={ref} tabIndex={-1}>
      {children}
    </div>,
    getPortalRoot()
  );
}
