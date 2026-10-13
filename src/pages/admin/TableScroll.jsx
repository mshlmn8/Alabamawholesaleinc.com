// The scroller around a long admin table (AW-266): a capped box that scrolls
// both ways, so the table's sticky header row stays in view, and a named
// region that takes the keyboard focus, so the arrow keys scroll it
// (axe scrollable-region-focusable; WCAG 2.1.1). Whenever the table is wider
// than the box, at any screen width, it carries .is-overflowing and a line
// above it says the table scrolls sideways (NEW-075): measured, with a
// ResizeObserver, rather than guessed from the screen width, and only when
// more than a few pixels of padding are out of view (isOverflowing). resetKey: a new
// value (another page, filter, search or sort) brings the box back to the
// top of the table. pinEnd: the table's last column (its row actions) is
// pinned to the right edge while the box overflows (index.css), and focus
// is kept clear of it.
//
//   <TableScroll label="Accounts table" resetKey={filter}><table className="aw-table">…</table></TableScroll>

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Keyboard focus that lands under the sticky header row or a pinned column
// is brought out from under it (WCAG 2.4.11): the browser scrolls only a
// control that is outside the box, and the box's scroll padding (index.css)
// says how far to bring it in. With the last column pinned (pinEnd), a
// control in that column is in view wherever the box is scrolled, and one
// that ends under it is scrolled until it ends beside it. (A scroll padding
// as wide as that column made the browser swing the box to its far end and
// back on every row as Tab went from Edit to the next row's checkbox.)
export const PIN_GAP = 8;
function reveal(event) {
  const target = event.target;
  const box = event.currentTarget;
  if (target === box || !target.matches?.(':focus-visible')) return;
  const pinned = box.classList.contains('pin-end');
  if (pinned && target.closest?.('tr > :last-child')) return;
  target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  const pin = pinned && box.classList.contains('is-overflowing') ? box.querySelector('thead th:last-child') : null;
  if (!pin) return;
  const under = target.getBoundingClientRect().right - pin.getBoundingClientRect().left;
  if (under > 0) box.scrollLeft += under + PIN_GAP;
}

// Whether the box's content is wider than the box by more than a few
// pixels. A table that is over by no more than OVERFLOW_SLACK_PX has no
// column out of view: what doesn't fit is part of its last cell's 12px
// padding (and sub-pixel rounding), so the hint would send the reader
// sideways for nothing. The Accounts table at 1024px was 3px over (NEW-075).
export const OVERFLOW_SLACK_PX = 4;
export const isOverflowing = (box) => !!box && box.scrollWidth - box.clientWidth > OVERFLOW_SLACK_PX;

export function TableScroll({ label, resetKey = null, pinEnd = false, children }) {
  const ref = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [resetKey]);
  // Measured before the first paint, and again whenever the box or its
  // table changes size (a rotated phone, a new page of rows, a wider name).
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return undefined;
    const measure = () => setOverflowing(isOverflowing(box));
    measure();
    if (typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    return () => observer.disconnect();
  }, []);
  const className = ['table-scroll', pinEnd ? 'pin-end' : null, overflowing ? 'is-overflowing' : null].filter(Boolean).join(' ');
  return (
    <>
      {overflowing && <p className="result-note table-hint">Scroll sideways for more columns.</p>}
      {/* A scrolling region is a keyboard stop of its own: without it, a
          keyboard user can't scroll the columns that don't fit. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div ref={ref} className={className} role="region" aria-label={label} tabIndex={0} onFocus={reveal}>
        {children}
      </div>
    </>
  );
}
