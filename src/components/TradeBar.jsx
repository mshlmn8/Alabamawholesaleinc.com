// The purple announcement bar (scrolling ticker, call link, apply button) and
// the trade-only strip above the header. A signed-in visitor has an account
// already: 'My account' takes the apply button's place (AW-066).

import { COMPANY, ANNOUNCEMENTS, LICENSED_ONLY } from '../data/content.js';
import { APPLY_LABEL } from '../data/terms.js';
import { Link } from '../lib/router.js';

const TICKER_TEXT = ANNOUNCEMENTS.join('  ·  ') + '  ·  ';

export function TradeBar({ signedIn = false, onApplyClick }) {
  return (
    <>
      <div className="trade-bar">
        <div className="container">
          <div className="ticker" aria-hidden="true"><span>{TICKER_TEXT + TICKER_TEXT + TICKER_TEXT + TICKER_TEXT}</span></div>
          <a className="trade-call" href={`tel:${COMPANY.phoneRaw}`}>Call {COMPANY.phone}</a>
          {signedIn
            ? <Link to="/account">My account</Link>
            : <button type="button" onClick={onApplyClick}>{APPLY_LABEL}</button>}
        </div>
      </div>
      <div className="trade-only">{LICENSED_ONLY}</div>
    </>
  );
}
