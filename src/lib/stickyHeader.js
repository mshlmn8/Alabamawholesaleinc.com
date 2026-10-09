// The sticky header's height, for everything else that sticks or scrolls to
// an anchor (AW-153, AW-312; the AW-037/062/153/158/312 entry in the plan's
// conflicts list).
//
// On a wide window at least 600px tall, .site-header sticks to the top with
// its purple trade bar scrolled away (src/index.css, the STICKY_HEADER_QUERY
// block). App measures it with useStickyHeader and writes two custom
// properties on <html>:
//   --trade-bar-h  the trade bar's height (the header's negative sticky top)
//   --header-h     what stays on screen when the header is stuck: the header
//                  minus the trade bar, or 0px where it doesn't stick (the
//                  compact layout and short windows)
//   --site-header-h  the whole header, trade bar included, sticky or not:
//                  how far down the page the Categories menu opens (AW-062)
// The first two are 0px in :root until they are measured; --site-header-h
// is read with a fallback (src/index.css, .aw-mega-menu). The page content's
// scroll-margin-top (anchors, the skip link, keyboard focus), the filter
// sidebar, the policy nav and the phone filter bar read --header-h.
//
// Keyboard focus is never hidden under the stuck header (WCAG 2.4.11):
// - Focus in the trade bar shows the whole header (NEW-017): the header gets
//   .is-revealed while focus is inside the bar, which sets its sticky top to
//   0 (as does :has(.trade-bar:focus-within) where :has() is supported). The
//   class is set in the focusin event, before the browser scrolls the
//   control into view, so the page no longer jumps up about 470px on each
//   Shift+Tab towards a control it can't show.
// - A field that takes focus under the stuck header is scrolled clear of it
//   (NEW-018). The content's scroll-margin-top already does this for links
//   and buttons, but for a text field Chrome only scrolls as far as its
//   caret and ignores the margin: Shift+Tab back to checkout's Notes left
//   the whole box behind the header at 1440x900. A frame after the focus,
//   once the browser has scrolled, anything still above the header's bottom
//   edge is scrolled into view with block 'nearest', which honours
//   scroll-margin-top.

import { useLayoutEffect } from 'react';

// The @media prelude of the sticky .site-header rule in src/index.css
// (src/styles.test.js checks they match). 53.13em, not MOBILE_QUERY's
// 53.125em: the compact layout ends at 850px and this starts just past it.
export const STICKY_HEADER_QUERY = '(min-width: 53.13em) and (min-height: 37.5em)';

// The class that shows the whole stuck header, trade bar included (NEW-017).
export const REVEALED_CLASS = 'is-revealed';

// What a focused element may sit in without being under the header: the
// header itself, and the layers fixed to the window (dialogs and drawers in
// #aw-layers, the toasts), which are above it.
const OWN_LAYERS = '.site-header, #aw-layers, #aw-toasts, dialog, [role="dialog"], [role="alertdialog"], .drawer';
// NEW-018's check waits for the page to hold still for this many frames
// (the browser's own scroll to the focused field), and at most this many.
export const SETTLED_FRAMES = 3;
export const MAX_FRAMES = 60;

const px = (n) => `${Math.max(0, Math.round((Number(n) || 0) * 100) / 100)}px`;

// The two properties from the measured heights. `sticky` is whether the
// header's computed position is sticky right now.
export function stickyHeaderVars({ headerHeight, barHeight, sticky }) {
  return {
    '--trade-bar-h': px(barHeight),
    '--header-h': sticky ? px(headerHeight - barHeight) : '0px',
    '--site-header-h': px(headerHeight),
  };
}

const VAR_NAMES = Object.keys(stickyHeaderVars({ headerHeight: 0, barHeight: 0, sticky: false }));

const isSticky = (el) => window.getComputedStyle(el).position === 'sticky';

// How far down the window the stuck header covers the page for `target`:
// the header's bottom edge while it sticks, else 0.
export function coveredTop(header, target) {
  if (!header || !target || !isSticky(header)) return 0;
  if (target.closest?.(OWN_LAYERS)) return 0;
  return Math.max(0, header.getBoundingClientRect().bottom);
}

// Scrolls a focused element clear of the stuck header when the browser left
// it underneath (NEW-018). Elements focused only by script (tabindex -1: the
// page heading after a page change, an error summary) are left alone: the
// code that focuses them decides whether the page moves. Returns whether it
// scrolled.
export function revealFocused(header, target) {
  if (!target?.isConnected || document.activeElement !== target) return false;
  if (target.getAttribute('tabindex') === '-1') return false;
  if (window.getComputedStyle(target).position === 'fixed') return false;
  const edge = coveredTop(header, target);
  if (edge <= 0 || target.getBoundingClientRect().top >= edge - 0.5) return false;
  target.scrollIntoView({ block: 'nearest' });
  return true;
}

// Keeps the properties current, before paint: on mount, whenever the header
// or its trade bar changes size (text size, a wrapped message, the compact
// layout) and when the window crosses the sticky query. jsdom has neither
// ResizeObserver nor matchMedia; it gets one measurement.
export function useStickyHeader(ref) {
  useLayoutEffect(() => {
    const header = ref.current;
    if (!header) return undefined;
    const root = document.documentElement;
    const bar = header.querySelector('.trade-bar');
    const update = () => {
      const vars = stickyHeaderVars({
        headerHeight: header.getBoundingClientRect().height,
        barHeight: bar ? bar.getBoundingClientRect().height : 0,
        sticky: isSticky(header),
      });
      for (const [name, value] of Object.entries(vars)) {
        if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
      }
    };
    update();
    const observer = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(update) : null;
    observer?.observe(header);
    if (bar) observer?.observe(bar);
    const query = typeof window.matchMedia === 'function' ? window.matchMedia(STICKY_HEADER_QUERY) : null;
    query?.addEventListener?.('change', update);

    // NEW-017: the whole header while focus is in the trade bar.
    const inBar = (el) => !!(el && el.closest?.('.trade-bar') && header.contains(el));
    const onHeaderFocusIn = (e) => {
      if (inBar(e.target)) header.classList.add(REVEALED_CLASS);
    };
    const onHeaderFocusOut = (e) => {
      if (!inBar(e.relatedTarget)) header.classList.remove(REVEALED_CLASS);
    };
    header.addEventListener('focusin', onHeaderFocusIn);
    header.addEventListener('focusout', onHeaderFocusOut);

    // NEW-018: a field left under the stuck header, checked once the page
    // has stopped moving. With smooth scrolling the browser's own scroll to
    // the caret takes several frames.
    let frame = 0;
    const onFocusIn = (e) => {
      const target = e.target;
      if (!(target instanceof Element) || header.contains(target) || !isSticky(header)) return;
      if (frame) window.cancelAnimationFrame(frame);
      let lastY = window.scrollY;
      let still = 0;
      let frames = 0;
      const check = () => {
        frame = 0;
        if (document.activeElement !== target) return;
        const y = window.scrollY;
        still = y === lastY ? still + 1 : 0;
        lastY = y;
        frames += 1;
        if (still >= SETTLED_FRAMES || frames >= MAX_FRAMES) revealFocused(header, target);
        else frame = window.requestAnimationFrame(check);
      };
      frame = window.requestAnimationFrame(check);
    };
    document.addEventListener('focusin', onFocusIn);

    return () => {
      observer?.disconnect();
      query?.removeEventListener?.('change', update);
      header.removeEventListener('focusin', onHeaderFocusIn);
      header.removeEventListener('focusout', onHeaderFocusOut);
      header.classList.remove(REVEALED_CLASS);
      document.removeEventListener('focusin', onFocusIn);
      if (frame) window.cancelAnimationFrame(frame);
      for (const name of VAR_NAMES) root.style.removeProperty(name);
    };
  }, [ref]);
}
