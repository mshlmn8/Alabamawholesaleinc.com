// Shared pieces for the customer support pages (contact, delivery, policies,
// application, password reset). Same editorial system as the storefront.

import { COMPANY } from '../../data/content.js';
import { Link } from '../../lib/router.js';
import { Breadcrumbs, HOME_CRUMB } from '../../components/Breadcrumbs.jsx';

export const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${COMPANY.addressLine1}, ${COMPANY.addressLine2}`)}`;

export const POLICY_LINKS = [
  { page: 'shipping', label: 'Delivery policy' },
  { page: 'privacy', label: 'Privacy' },
  { page: 'terms', label: 'Trade terms' },
];

export function PageHead({ crumb, eyebrow, title, children }) {
  return (
    <div className="page-head">
      <Breadcrumbs items={[HOME_CRUMB, { label: crumb }]} />
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children}
    </div>
  );
}

// Compact contact strip reused at the bottom of the support pages.
export function ContactStrip({ eyebrow = 'QUESTIONS?', title = 'Talk to the warehouse', contactLink = true }) {
  return (
    <aside className="contact-strip" aria-label="Contact the trade desk">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>Real people, same building as the inventory. {COMPANY.hoursLine1} · {COMPANY.hoursLine2}.</p>
      </div>
      <div className="contact-strip-actions">
        <a className="button" href={`tel:${COMPANY.phoneRaw}`}>Call {COMPANY.phone}</a>
        <a className="button on-dark" href={`mailto:${COMPANY.email}`}>Email us</a>
        {contactLink && <Link className="text-link" to="/contact">Contact &amp; visit</Link>}
      </div>
    </aside>
  );
}

const POLICY_NAV = [
  ...POLICY_LINKS,
  { page: 'delivery', label: 'Delivery & service area' },
  { page: 'contact', label: 'Contact & visit' },
];

export function PolicyNav({ current }) {
  return (
    <nav className="policy-nav" aria-label="Customer policies">
      <p className="eyebrow">CUSTOMER POLICIES</p>
      {POLICY_NAV.map(link => (
        <Link key={link.page} to={`/${link.page}`} aria-current={current === link.page ? 'page' : undefined}>{link.label}</Link>
      ))}
    </nav>
  );
}
