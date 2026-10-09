// The purple announcement bar (scrolling ticker, call link, apply button) and
// the trade-only strip above the header. A signed-in visitor has an account
// already: 'My account' takes the apply button's place (AW-066).

import { COMPANY, ANNOUNCEMENTS } from '../data/content.js';
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
            : <button type="button" onClick={onApplyClick}>Apply for a trade account</button>}
        </div>
      </div>
      <div className="trade-only">WHOLESALE TO LICENSED RETAIL BUSINESSES ONLY · NO CONSUMER SALES · 21+</div>
    </>
  );
}
