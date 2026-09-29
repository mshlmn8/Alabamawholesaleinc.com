// Shared pieces for the customer support pages (contact, delivery, policies,
// application, password reset). Same editorial system as the storefront.

import { COMPANY } from '../../data/content.js';

export const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${COMPANY.addressLine1}, ${COMPANY.addressLine2}`)}`;

export const POLICY_LINKS = [
  { page: 'shipping', label: 'Delivery' },
  { page: 'privacy', label: 'Privacy' },
  { page: 'terms', label: 'Trade terms' },
];

export function PageHead({ goHome, crumb, eyebrow, title, children }) {
  return (
    <div className="page-head">
      <div className="crumbs">
        <button type="button" onClick={goHome}>Home</button><span aria-hidden="true">/</span><span>{crumb}</span>
      </div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children}
    </div>
  );
}

// Compact contact strip reused at the bottom of the support pages.
export function ContactStrip({ navigate, eyebrow = 'QUESTIONS?', title = 'Talk to the warehouse' }) {
  return (
    <aside className="contact-strip" aria-label="Contact the trade desk">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>Real people, same building as the inventory. {COMPANY.hoursLine1} · {COMPANY.hoursLine2}.</p>
      </div>
      <div className="contact-strip-actions">
        <a className="button" href={`tel:${COMPANY.phoneRaw}`}>Call {COMPANY.phone} <span aria-hidden="true">↗</span></a>
        <a className="button ghost" href={`mailto:${COMPANY.email}`}>Email us</a>
        {navigate && <button className="text-link" type="button" onClick={() => navigate({ page: 'contact' })}>Contact &amp; visit</button>}
      </div>
    </aside>
  );
}

export function PolicyNav({ current, navigate }) {
  return (
    <nav className="policy-nav" aria-label="Customer policies">
      <p className="eyebrow">CUSTOMER POLICIES</p>
      {POLICY_LINKS.map(link => (
        <button key={link.page} type="button" aria-current={current === link.page ? 'page' : undefined} onClick={() => navigate({ page: link.page })}>{link.label}</button>
      ))}
      <button type="button" aria-current={current === 'delivery' ? 'page' : undefined} onClick={() => navigate({ page: 'delivery' })}>Delivery &amp; service area</button>
      <button type="button" aria-current={current === 'contact' ? 'page' : undefined} onClick={() => navigate({ page: 'contact' })}>Contact &amp; visit</button>
    </nav>
  );
}
