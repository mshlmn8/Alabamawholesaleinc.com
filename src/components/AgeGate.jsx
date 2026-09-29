// The 21+ confirmation (AW-044, AW-176). App shows it in a ModalLayer over
// the page, which stays in the document underneath: crawlers and link
// previews read the real page, while visitors cannot see or reach it until
// they answer. The gate has no close button and ignores Escape and Back.
//
// "No, exit" swaps in an exit screen (remembered for the tab's session by
// src/lib/ageGate.js) with a way back to the question after a mis-click.
// Both views label the dialog through the same heading id, and switching
// views moves focus to the new view, so screen readers hear the change.

import { useEffect, useRef } from 'react';

export function AgeGate({ declined, onYes, onNo, onBack }) {
  const ref = useRef(null);
  // ModalLayer focuses the first view's [data-autofocus]; after a switch
  // between the question and the exit screen, this does.
  const shownView = useRef(declined);
  useEffect(() => {
    if (shownView.current === declined) return;
    shownView.current = declined;
    ref.current?.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
  }, [declined]);

  return (
    <div className="age-gate" ref={ref} role="dialog" aria-modal="true" aria-labelledby="age-gate-title" aria-describedby="age-gate-text">
      <div className="inner fade-in">
        <div className="brand"><span>Alabama</span><small>WHOLESALE INC.</small></div>
        {declined ? (
          <div key="exit">
            <h2 id="age-gate-title" tabIndex={-1} data-autofocus>Sorry, you must be <em>21 or older</em> to enter</h2>
            <p id="age-gate-text">This wholesale site lists tobacco and vapor products, so it is only open to visitors 21 or older.</p>
            <div className="btn-row">
              <button type="button" className="button ghost" onClick={onBack}>Answered by mistake? Go back</button>
            </div>
          </div>
        ) : (
          <div key="ask">
            <h2 id="age-gate-title">Are you <em>21 or older?</em></h2>
            <p id="age-gate-text">This is a wholesale site for licensed retail businesses only. It lists tobacco and vapor products, so you must be 21 or older to enter.</p>
            <div className="btn-row">
              <button type="button" className="button" data-autofocus onClick={onYes}>Yes, I am 21+ <span aria-hidden="true">↗</span></button>
              <button type="button" className="button ghost" onClick={onNo}>No, exit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
