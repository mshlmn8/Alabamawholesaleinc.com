// The purple bar at the top of every page, inside the site's one <header>
// (AW-314): the announcements, then (signed in) My account and the call link,
// in the same order on screen and for the keyboard (AW-315).
//
// The announcements show one message at a time (AW-167). The trade notice,
// which was a cream strip under the bar (AW-153), is the first message: the
// one on load, and the one that stays when nothing rotates. Every message is
// in one list, so a screen reader reads them all in order, and nothing is
// announced when the shown one changes. The others are transparent and share
// the shown one's grid cell. On a wide window the bar is as tall as its
// longest message: a message wraps rather than being cut off, and a change
// never moves the page.
//
// In the compact layout the bar is one row, so the header is short enough to
// stick on a phone (AW-153): the pause toggle, the shown message on a single
// line, and 'Call', whose name still carries the number. A message longer
// than the row scrolls sideways once, slowly, after a moment at its start,
// and rests at its end (the marquee): measured here, drawn in CSS. With
// reduced motion it wraps instead (src/index.css).
//
// Rotation (WCAG 2.2.2): every ROTATE_MS, or once a scrolling message has
// finished and rested, with a fade. It waits, and a scrolling message stops
// where it is, while the pointer is over the bar, while focus is inside it
// and while the tab is hidden; the toggle stops both until it is pressed
// again. With reduced motion it starts paused, so the trade notice stays;
// Play starts it.
//
// No Apply here (LEFT-2): the header's orange Apply button is the banner's one
// apply entry on a wide window, and the phone menu, the home hero and the
// pricing notices have it on a phone. A signed-in visitor gets 'My account'
// (AW-066), which the compact layout leaves to the masthead and the menu.
// The trade notice is LICENSED_ONLY, the footer's wording, in capitals
// (AW-285).

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { COMPANY, ANNOUNCEMENTS, LICENSED_ONLY } from '../data/content.js';
import { Link } from '../lib/router.js';
import { useMediaQuery } from '../lib/useMediaQuery.js';
import { Icon } from './Icon.jsx';

export const TRADE_NOTICE = LICENSED_ONLY.toUpperCase();
// The notice, then the announcements without their leading star.
export const MESSAGES = [TRADE_NOTICE, ...ANNOUNCEMENTS.map((text) => text.replace(/^★\s*/, ''))];
export const ROTATE_MS = 7000;
// The marquee: how long a long message shows its start before it moves, how
// fast it moves (px per second) and how long it rests at its end.
export const MARQUEE_HOLD_MS = 1500;
export const MARQUEE_SPEED = 45;
export const MARQUEE_REST_MS = 2000;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// How long a message `overflow` px wider than the row takes to scroll, and
// how long it stays up: never less than ROTATE_MS.
export function marqueeTiming(overflow) {
  const travel = overflow > 0 ? Math.round((overflow / MARQUEE_SPEED) * 1000) : 0;
  return { travel, shown: travel ? Math.max(ROTATE_MS, MARQUEE_HOLD_MS + travel + MARQUEE_REST_MS) : ROTATE_MS };
}

// Whether the tab is showing: rotation waits while it is in the background.
const subscribeVisibility = (onChange) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};
const isPageVisible = () => !document.hidden;
const usePageVisible = () => useSyncExternalStore(subscribeVisibility, isPageVisible, () => true);

export function TradeBar({ signedIn = false }) {
  const [index, setIndex] = useState(0);
  // The visitor's own choice, 'paused' or 'playing'. Until there is one,
  // reduced motion means paused.
  const [choice, setChoice] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // How far the shown message runs past the row, measured for that message.
  const [measured, setMeasured] = useState({ index: 0, overflow: 0 });
  const listRef = useRef(null);
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const visible = usePageVisible();
  const paused = choice ? choice === 'paused' : reducedMotion;
  const moving = !paused && !hovered && !focused && visible;
  const rotating = MESSAGES.length > 1 && moving;
  const overflow = measured.index === index ? measured.overflow : 0;
  const timing = marqueeTiming(overflow);

  useEffect(() => {
    if (!rotating) return undefined;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), timing.shown);
    return () => window.clearInterval(id);
  }, [rotating, timing.shown]);

  // Measures the shown message whenever it changes and whenever the row
  // changes size (the window, the text size, the layout). The observer
  // reports the first size on its own; jsdom has none and never scrolls.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof window.ResizeObserver !== 'function') return undefined;
    const observer = new window.ResizeObserver(() => {
      const item = list.children[index];
      const over = item ? Math.ceil(item.scrollWidth - item.clientWidth) : 0;
      const next = over > 1 ? over : 0;
      setMeasured((prev) => (prev.index === index && prev.overflow === next ? prev : { index, overflow: next }));
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, [index]);

  // The marquee's distance and timing, for the CSS animation (no style
  // attribute in JSX).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.style.setProperty('--marquee-shift', `${-overflow}px`);
    list.style.setProperty('--marquee-ms', `${timing.travel}ms`);
    list.style.setProperty('--marquee-hold', `${MARQUEE_HOLD_MS}ms`);
  }, [overflow, timing.travel]);

  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
  };

  return (
    <div className={`trade-bar${moving ? '' : ' is-still'}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
         onFocus={() => setFocused(true)} onBlur={onBlur}>
      <div className="container">
        <div className="announcements">
          <button className="icon-btn" type="button" aria-label="Pause announcements" aria-pressed={paused}
                  onClick={() => setChoice(paused ? 'playing' : 'paused')}>
            <Icon name={paused ? 'play' : 'pause'} />
          </button>
          <ul className="announcement-list" aria-label="Announcements" ref={listRef}>
            {MESSAGES.map((text, i) => (
              <li key={text} className={i === index ? `is-current${overflow ? ' is-marquee' : ''}` : undefined}>{text}</li>
            ))}
          </ul>
        </div>
        {signedIn && <Link className="trade-account" to="/account">My account</Link>}
        {/* 'Call' alone in the compact layout; the name always has the number. */}
        <a className="trade-call" href={`tel:${COMPANY.phoneRaw}`} aria-label={`Call ${COMPANY.phone}`}>
          Call<span className="trade-call-number">{` ${COMPANY.phone}`}</span>
        </a>
      </div>
    </div>
  );
}
