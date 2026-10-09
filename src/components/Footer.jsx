// Site footer: departments, account and help links, contact details, the
// policy links and the nicotine warning. Destinations are links (AW-043);
// "Apply for account" and "Sign in" open dialogs and stay buttons.

import { COMPANY } from '../data/content.js';
import { Link } from '../lib/router.js';
import { NicotineWarning } from './NicotineWarning.jsx';

export function Footer({ departments, onLoginClick, onApplyClick }) {
  return (
    <footer className="footer-main">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span>Alabama</span><small>WHOLESALE INC.</small>
            <p style={{ marginTop: 16 }}>Wholesale distributor of tobacco, vaping products, smoke-shop accessories, novelties, candy, beverages and general merchandise. Serving licensed retail stores — never consumers.</p>
          </div>
          <div>
            <h4>Departments</h4>
            <Link className="footer-link" to="/catalog">All products</Link>
            {departments.map(c => <Link key={c.key} className="footer-link" to={{ page: 'category', category: c.key }}>{`${c.label} (${c.count})`}</Link>)}
          </div>
          <div>
            <h4>Account &amp; help</h4>
            <button type="button" onClick={onApplyClick}>Apply for account</button>
            <Link className="footer-link" to="/apply">Application checklist</Link>
            <button type="button" onClick={onLoginClick}>Sign in</button>
            <Link className="footer-link" to="/contact">Contact &amp; visit</Link>
            <Link className="footer-link" to="/delivery">Delivery &amp; service area</Link>
            <Link className="footer-link" to="/#new-arrivals">New arrivals</Link>
            <Link className="footer-link" to="/#bestsellers">Bestsellers</Link>
          </div>
          <div>
            <h4>Contact</h4>
            <p>{COMPANY.addressLine1}<br />{COMPANY.addressLine2}</p>
            <p><a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a><br /><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
            <p>{COMPANY.hoursLine1}<br />{COMPANY.hoursLine2}</p>
          </div>
        </div>
        <div className="footer-legal">
          <p>{`© 2026 ${COMPANY.name}. All rights reserved.`}</p>
          <nav className="footer-policies" aria-label="Customer policies">
            <Link to="/shipping">Delivery</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Trade terms</Link>
          </nav>
          <p>Sales to licensed retail businesses only · 21+ · No consumer orders</p>
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
