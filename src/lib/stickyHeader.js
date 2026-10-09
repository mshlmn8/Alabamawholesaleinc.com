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
// Both are 0px in :root until they are measured. The page content's
// scroll-margin-top (anchors, the skip link, keyboard focus), the filter
// sidebar, the policy nav and the phone filter bar read --header-h.

import { useLayoutEffect } from 'react';

// The @media prelude of the sticky .site-header rule in src/index.css
// (src/styles.test.js checks they match). 53.13em, not MOBILE_QUERY's
// 53.125em: the compact layout ends at 850px and this starts just past it.
export const STICKY_HEADER_QUERY = '(min-width: 53.13em) and (min-height: 37.5em)';

const px = (n) => `${Math.max(0, Math.round((Number(n) || 0) * 100) / 100)}px`;

// The two properties from the measured heights. `sticky` is whether the
// header's computed position is sticky right now.
export function stickyHeaderVars({ headerHeight, barHeight, sticky }) {
  return {
    '--trade-bar-h': px(barHeight),
    '--header-h': sticky ? px(headerHeight - barHeight) : '0px',
  };
}

const VAR_NAMES = Object.keys(stickyHeaderVars({ headerHeight: 0, barHeight: 0, sticky: false }));

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
        sticky: window.getComputedStyle(header).position === 'sticky',
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
    return () => {
      observer?.disconnect();
      query?.removeEventListener?.('change', update);
      for (const name of VAR_NAMES) root.style.removeProperty(name);
    };
  }, [ref]);
}
