// Site footer: departments, account and help links, contact details, the
// policy links and the nicotine warning.

import { COMPANY } from '../data/content.js';

export function Footer({ goCategory, departments, onLoginClick, onApplyClick, onNewArrivals, onBestsellers, navigate }) {
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
            <button type="button" onClick={() => navigate({ page: 'catalog' })}>All products</button>
            {departments.map(c => <button key={c.key} type="button" onClick={() => goCategory(c.key)}>{`${c.label} (${c.count})`}</button>)}
          </div>
          <div>
            <h4>Account &amp; help</h4>
            <button type="button" onClick={onApplyClick}>Apply for account</button>
            <button type="button" onClick={() => navigate({ page: 'apply' })}>Application checklist</button>
            <button type="button" onClick={onLoginClick}>Sign in</button>
            <button type="button" onClick={() => navigate({ page: 'contact' })}>Contact &amp; visit</button>
            <button type="button" onClick={() => navigate({ page: 'delivery' })}>Delivery &amp; service area</button>
            <button type="button" onClick={onNewArrivals}>New arrivals</button>
            <button type="button" onClick={onBestsellers}>Bestsellers</button>
          </div>
          <div>
            <h4>Contact</h4>
            <p>{COMPANY.addressLine1}<br />{COMPANY.addressLine2}</p>
            <p><a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a><br /><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
            <p>{COMPANY.hoursLine1}<br />{COMPANY.hoursLine2}</p>
          </div>
        </div>
        <div className="footer-legal">
          <p>© 2026 Alabama Wholesale Inc. All rights reserved.</p>
          <nav className="footer-policies" aria-label="Customer policies">
            <button type="button" onClick={() => navigate({ page: 'shipping' })}>Delivery</button>
            <button type="button" onClick={() => navigate({ page: 'privacy' })}>Privacy</button>
            <button type="button" onClick={() => navigate({ page: 'terms' })}>Trade terms</button>
          </nav>
          <p>Sales to licensed retail businesses only · 21+ · No consumer orders</p>
        </div>
      </div>
      <div className="fda-note">
        <div className="container">WARNING: Tobacco products sold by Alabama Wholesale Inc. contain nicotine. Nicotine is an addictive chemical. Products are distributed exclusively to licensed retail businesses for lawful resale. Not for sale to minors.</div>
      </div>
    </footer>
  );
}
