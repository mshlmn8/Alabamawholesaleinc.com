// The scroller around a long admin table (AW-266): a capped box that scrolls
// both ways, so the table's sticky header row stays in view, and a named
// region that takes the keyboard focus, so the arrow keys scroll it
// (axe scrollable-region-focusable; WCAG 2.1.1). On phones a line above it
// says the table scrolls sideways. resetKey: a new value (another page,
// filter, search or sort) brings the box back to the top of the table.
//
//   <TableScroll label="Accounts table" resetKey={filter}><table className="aw-table">…</table></TableScroll>

import { useEffect, useRef } from 'react';

// Keyboard focus that lands under the sticky header row or a pinned column
// is brought out from under it (WCAG 2.4.11): the browser scrolls only a
// control that is outside the box, and the box's scroll padding (index.css)
// says how far to bring it in.
function reveal(event) {
  const target = event.target;
  if (target === event.currentTarget || !target.matches?.(':focus-visible')) return;
  target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

export function TableScroll({ label, resetKey = null, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [resetKey]);
  return (
    <>
      <p className="result-note table-hint">Scroll sideways for more columns.</p>
      {/* A scrolling region is a keyboard stop of its own: without it, a
          keyboard user can't scroll the columns that don't fit. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div ref={ref} className="table-scroll" role="region" aria-label={label} tabIndex={0} onFocus={reveal}>
        {children}
      </div>
    </>
  );
}
