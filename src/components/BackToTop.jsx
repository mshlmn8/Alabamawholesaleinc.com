// Back to top (AW-223): a round button in the bottom right corner of long
// pages (a department is up to 15,000px tall on a phone), shown once the page
// is scrolled more than 1200px. It jumps to the top at once and puts focus on
// the page's h1, as a page change does, so keyboard and screen reader users
// start again from the heading.
//
// It never covers the footer, which carries the FDA nicotine warning and the
// trade-only note: once the footer scrolls into view the button rides on the
// footer's top edge (--back-to-top-lift), and it goes when the footer fills
// the screen. Scrolling, resizing and the page changing height are checked at
// most once a frame, with passive listeners.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { focusPageHeading, scrollToTop } from '../lib/router.js';
import { Icon } from './Icon.jsx';

export const BACK_TO_TOP_AFTER = 1200;
// The button's distance from the footer, as from the screen edge (px).
const GAP = 16;

// Whether the button shows, and how far it rises to clear the footer.
function measure(after, size) {
  if (typeof window === 'undefined') return { shown: false, lift: 0 };
  const footer = document.querySelector('footer');
  const top = footer ? footer.getBoundingClientRect().top : Infinity;
  const lift = Math.max(0, Math.round(window.innerHeight - top));
  return { shown: window.scrollY > after && top >= GAP + size, lift };
}

export function BackToTop({ after = BACK_TO_TOP_AFTER }) {
  const button = useRef(null);
  const [view, setView] = useState(() => measure(after, 44));
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const next = measure(after, button.current?.offsetHeight || 44);
      setView((prev) => (prev.shown === next.shown && prev.lift === next.lift ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    // Filters change the page's height without a scroll.
    const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    resized?.observe(document.body);
    // The page may have moved (a restored position) since the first render.
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      resized?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [after]);
  useLayoutEffect(() => {
    button.current?.style.setProperty('--back-to-top-lift', `${view.lift}px`);
  }, [view]);

  if (!view.shown) return null;
  const toTop = () => {
    scrollToTop();
    focusPageHeading();
    // A smooth scroll still under way (Tab scrolls the next card into view
    // smoothly) can move the page one more frame after the jump.
    window.requestAnimationFrame(() => {
      if (window.scrollY > 0) scrollToTop();
    });
  };
  return (
    <button ref={button} className="icon-btn back-to-top" type="button" aria-label="Back to top" onClick={toTop}>
      <Icon name="arrow-up" />
    </button>
  );
}
