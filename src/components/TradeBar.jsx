// The purple announcement bar (scrolling ticker, call link, apply button) and
// the trade-only strip above the header.

import { COMPANY, ANNOUNCEMENTS, LICENSED_ONLY } from '../data/content.js';
import { APPLY_LABEL } from '../data/terms.js';

const TICKER_TEXT = ANNOUNCEMENTS.join('  ·  ') + '  ·  ';

export function TradeBar({ onApplyClick }) {
  return (
    <>
      <div className="trade-bar">
        <div className="container">
          <div className="ticker" aria-hidden="true"><span>{TICKER_TEXT + TICKER_TEXT + TICKER_TEXT + TICKER_TEXT}</span></div>
          <a className="trade-call" href={`tel:${COMPANY.phoneRaw}`}>Call {COMPANY.phone}</a>
          <button type="button" onClick={onApplyClick}>{APPLY_LABEL}</button>
        </div>
      </div>
      <div className="trade-only">{LICENSED_ONLY}</div>
    </>
  );
}
