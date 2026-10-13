// Keeps the FDA nicotine warning readable under the toasts (NEW-080).
//
// The footer's last band, .fda-note, carries the verbatim FDA warning
// (AW-026). The commerce toast (.toast-root) and the admin's status bar
// (.admin-status) are fixed 16px above the bottom of the window, so at the
// bottom of a page they covered the middle of it: 'WARNING: This product
// co[toast]r sale to anyone under 21.' for the 8 seconds a status shows.
//
// App calls useFdaInset() once. It writes --fda-visible-h on <html>: how far
// up from the bottom of the window the warning reaches while any of it is on
// screen (the visible height of the band when it ends at the window's
// bottom, as it does at the end of a long page), 0px when it is off screen.
// Both toasts add it to their bottom offset, so they ride just above the
// warning, the way Back to top rides above the footer. It is checked at
// most once a frame on scroll and resize, and when the page changes height.

import { useEffect } from 'react';

export const FDA_INSET_VAR = '--fda-visible-h';

// The lift for a warning whose box is `rect` in a window `height` tall.
export function fdaInset(rect, height) {
  if (!rect || !(rect.height > 0) || rect.top >= height || rect.bottom <= 0) return 0;
  return Math.round(Math.min(height, height - rect.top));
}

export function useFdaInset() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const check = () => {
      frame = 0;
      const note = document.querySelector('.fda-note');
      const value = `${fdaInset(note?.getBoundingClientRect(), window.innerHeight)}px`;
      if (root.style.getPropertyValue(FDA_INSET_VAR) !== value) root.style.setProperty(FDA_INSET_VAR, value);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    // A page change, filters or a toast-making action change the page's height.
    const resized = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(schedule) : null;
    resized?.observe(document.body);
    check();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      resized?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      root.style.removeProperty(FDA_INSET_VAR);
    };
  }, []);
}
