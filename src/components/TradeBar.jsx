// The purple bar at the top of every page, inside the site's one <header>
// (AW-314): the announcements, then the Apply button and the call link, in
// the same order on screen and for the keyboard (AW-315).
//
// The announcements show one message at a time (AW-167). The trade notice,
// which was a cream strip under the bar (AW-153), is the first message: the
// one on load, and the one that stays when nothing rotates. Every message is
// in one list, so a screen reader reads them all in order, and nothing is
// announced when the shown one changes. The others are transparent and share
// the shown one's grid cell, so the bar is as tall as its longest message:
// a message wraps rather than being cut off, and a change never moves the
// page.
//
// Rotation (WCAG 2.2.2): every ROTATE_MS, with a fade. It waits while the
// pointer is over the bar, while focus is inside it and while the tab is
// hidden, and the toggle stops it until it is pressed again. With reduced
// motion it starts paused, so the trade notice stays; Play starts it.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { COMPANY, ANNOUNCEMENTS } from '../data/content.js';
import { useMediaQuery } from '../lib/useMediaQuery.js';
import { Icon } from './Icon.jsx';

export const TRADE_NOTICE = 'WHOLESALE TO LICENSED RETAIL BUSINESSES ONLY · NO CONSUMER SALES · 21+';
// The notice, then the announcements without their leading star.
export const MESSAGES = [TRADE_NOTICE, ...ANNOUNCEMENTS.map((text) => text.replace(/^★\s*/, ''))];
export const ROTATE_MS = 7000;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// Whether the tab is showing: rotation waits while it is in the background.
const subscribeVisibility = (onChange) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};
const isPageVisible = () => !document.hidden;
const usePageVisible = () => useSyncExternalStore(subscribeVisibility, isPageVisible, () => true);

export function TradeBar({ onApplyClick }) {
  const [index, setIndex] = useState(0);
  // The visitor's own choice, 'paused' or 'playing'. Until there is one,
  // reduced motion means paused.
  const [choice, setChoice] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const visible = usePageVisible();
  const paused = choice ? choice === 'paused' : reducedMotion;
  const rotating = MESSAGES.length > 1 && !paused && !hovered && !focused && visible;

  useEffect(() => {
    if (!rotating) return undefined;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [rotating]);

  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
  };

  return (
    <div className="trade-bar" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
         onFocus={() => setFocused(true)} onBlur={onBlur}>
      <div className="container">
        <div className="announcements">
          <button className="icon-btn" type="button" aria-label="Pause announcements" aria-pressed={paused}
                  onClick={() => setChoice(paused ? 'playing' : 'paused')}>
            <Icon name={paused ? 'play' : 'pause'} />
          </button>
          <ul className="announcement-list" aria-label="Announcements">
            {MESSAGES.map((text, i) => (
              <li key={text} className={i === index ? 'is-current' : undefined}>{text}</li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={onApplyClick}>Apply for a trade account</button>
        <a className="trade-call" href={`tel:${COMPANY.phoneRaw}`}>Call {COMPANY.phone}</a>
      </div>
    </div>
  );
}
