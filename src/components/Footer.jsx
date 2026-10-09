// Site footer: departments, account and help links, contact details, the
// policy links and the nicotine warning. Destinations are links (AW-043);
// "Apply for a trade account", "Sign in" and "Help" open dialogs and stay
// buttons. Signed in, a "My account" link takes the place of Apply and Sign
// in (AW-066); the application checklist stays, for documents an
// application still needs. Links to the page on screen carry aria-current
// (AW-221).
//
// AW-285: the shop links (all products, the departments, new arrivals,
// bestsellers) are one column and the account and help links another, with
// My account, Quick reorder and Help. There is no FAQ page yet (AW-279 waits
// on the owner), so Help stands in for one. The blurb names every
// department, from the catalog. The licensed-only statement is LICENSED_ONLY,
// the same words as the trade-only strip, and the year is the current one.

import { COMPANY, LICENSED_ONLY } from '../data/content.js';
import { APPLY_LABEL, SIGN_IN_LABEL } from '../data/terms.js';
import { Link, useRoute } from '../lib/router.js';
import { currentFor } from '../lib/navCurrent.js';
import { NicotineWarning } from './NicotineWarning.jsx';

// The copyright year, read once when the module loads: render may not read
// the clock (react-hooks/purity).
const YEAR = new Date().getFullYear();
const LIST = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });

// 'Wholesale distributor of tobacco, novelties & vapes, …, and drinks & bags.'
export function footerBlurb(departments) {
  const names = LIST.format(departments.map(d => d.label.toLowerCase()));
  return `Wholesale distributor${names ? ` of ${names}` : ''}. Serving licensed retail stores.`;
}

export function Footer({ departments, signedIn = false, onLoginClick, onApplyClick, onHelp }) {
  const { raw } = useRoute();
  const current = (to) => currentFor(raw, to);
  return (
    <footer className="footer-main">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span>Alabama</span><small>WHOLESALE INC.</small>
            <p>{footerBlurb(departments)}</p>
          </div>
          <div>
            <h4>Departments</h4>
            <Link className="footer-link" to="/catalog" aria-current={current('/catalog')}>All products</Link>
            {departments.map(c => <Link key={c.key} className="footer-link" to={{ page: 'category', category: c.key }} aria-current={current({ page: 'category', category: c.key })}>{`${c.label} (${c.count})`}</Link>)}
            <Link className="footer-link" to="/#new-arrivals">New arrivals</Link>
            <Link className="footer-link" to="/#bestsellers">Bestsellers</Link>
          </div>
          <div>
            <h4>Account &amp; help</h4>
            {signedIn
              ? <Link className="footer-link" to="/account" aria-current={current('/account')}>My account</Link>
              : <button type="button" onClick={onApplyClick}>{APPLY_LABEL}</button>}
            <Link className="footer-link" to="/apply" aria-current={current('/apply')}>Application checklist</Link>
            {!signedIn && <button type="button" onClick={onLoginClick}>{SIGN_IN_LABEL}</button>}
            {/* A guest's My account says what an account gives (AW-285, AW-086). */}
            {!signedIn && <Link className="footer-link" to="/account" aria-current={current('/account')}>My account</Link>}
            <Link className="footer-link" to="/account#quick-reorder">Quick reorder</Link>
            <button type="button" onClick={onHelp}>Help</button>
            <Link className="footer-link" to="/contact" aria-current={current('/contact')}>Contact &amp; visit</Link>
            <Link className="footer-link" to="/delivery" aria-current={current('/delivery')}>Delivery &amp; service area</Link>
          </div>
          <div>
            <h4>Contact</h4>
            <p>{COMPANY.addressLine1}<br />{COMPANY.addressLine2}</p>
            <p><a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a><br /><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
            <p>{COMPANY.hoursLine1}<br />{COMPANY.hoursLine2}</p>
          </div>
        </div>
        <div className="footer-legal">
          <p>{`© ${YEAR} ${COMPANY.name}. All rights reserved.`}</p>
          <nav className="footer-policies" aria-label="Customer policies">
            <Link to="/shipping" aria-current={current('/shipping')}>Delivery policy</Link>
            <Link to="/privacy" aria-current={current('/privacy')}>Privacy</Link>
            <Link to="/terms" aria-current={current('/terms')}>Trade terms</Link>
          </nav>
          <p>{LICENSED_ONLY}</p>
        </div>
      </div>
      {/* The FDA statement, verbatim (AW-026). The last band of the page,
          flush with its bottom edge (AW-144). */}
      <div className="fda-note">
        <div className="container"><NicotineWarning /></div>
      </div>
    </footer>
  );
}
