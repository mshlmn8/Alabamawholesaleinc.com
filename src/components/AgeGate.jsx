// The 21+ confirmation (AW-044, AW-176). App shows it in a ModalLayer over
// the page, which stays in the document underneath: crawlers and link
// previews read the real page, while visitors cannot see or reach it until
// they answer. The gate has no close button and ignores Escape and Back.
// Focus starts on "Yes, I am 21+".
//
// "No, exit" swaps in an exit screen (remembered for the browser session by
// src/lib/ageGate.js) with a way back to the question after a mis-click.
// The copy and the focus on the way-back button follow Cursor's PR #12,
// which the owner merged. Both views label the dialog through the same
// heading id, and the way-back button is described by the exit message, so
// screen readers hear why the view changed.

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
            <h2 id="age-gate-title">We&apos;re sorry</h2>
            <p id="age-gate-text">You must be 21 or older to enter this site. The catalog is for licensed retailers.</p>
            <div className="btn-row">
              <button type="button" className="button on-dark" data-autofocus aria-describedby="age-gate-title age-gate-text" onClick={onBack}>Back to the age question</button>
            </div>
          </div>
        ) : (
          <div key="ask">
            <h2 id="age-gate-title">Are you <em>21 or older?</em></h2>
            <p id="age-gate-text">This site is for licensed retail businesses. You must be 21 or older to enter.</p>
            <div className="btn-row">
              <button type="button" className="button" data-autofocus onClick={onYes}>Yes, I am 21+</button>
              <button type="button" className="button on-dark" onClick={onNo}>No, exit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
