// Site footer: departments, account and help links, contact details, the
// policy links and the nicotine warning. Destinations are links (AW-043);
// "Apply for a trade account", "Sign in" and "Help" open dialogs and stay
// buttons.
//
// AW-285: the shop links (all products, the departments, new arrivals,
// bestsellers) are one column and the account and help links another, with
// My account, Quick reorder and Help. There is no FAQ page yet (AW-279 waits
// on the owner), so Help stands in for one. The blurb names every
// department, from the catalog. The licensed-only statement is LICENSED_ONLY,
// the same words as the trade-only strip, and the year is the current one.

import { COMPANY, LICENSED_ONLY } from '../data/content.js';
import { APPLY_LABEL, SIGN_IN_LABEL } from '../data/terms.js';
import { Link } from '../lib/router.js';
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

export function Footer({ departments, onLoginClick, onApplyClick, onHelp }) {
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
            <Link className="footer-link" to="/catalog">All products</Link>
            {departments.map(c => <Link key={c.key} className="footer-link" to={{ page: 'category', category: c.key }}>{`${c.label} (${c.count})`}</Link>)}
            <Link className="footer-link" to="/#new-arrivals">New arrivals</Link>
            <Link className="footer-link" to="/#bestsellers">Bestsellers</Link>
          </div>
          <div>
            <h4>Account &amp; help</h4>
            <button type="button" onClick={onApplyClick}>{APPLY_LABEL}</button>
            <Link className="footer-link" to="/apply">Application checklist</Link>
            <button type="button" onClick={onLoginClick}>{SIGN_IN_LABEL}</button>
            <Link className="footer-link" to="/account">My account</Link>
            <Link className="footer-link" to="/account#quick-reorder">Quick reorder</Link>
            <button type="button" onClick={onHelp}>Help</button>
            <Link className="footer-link" to="/contact">Contact &amp; visit</Link>
            <Link className="footer-link" to="/delivery">Delivery &amp; service area</Link>
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
            <Link to="/shipping">Delivery policy</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Trade terms</Link>
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
