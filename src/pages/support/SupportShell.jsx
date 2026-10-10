// Shared pieces for the customer support pages (contact, delivery, policies,
// application, password reset). Same editorial system as the storefront.
// The address, hours, phone and email are the ones staff set in Admin ->
// Site settings (AW-030, useSite), or content.js's.

import { DEFAULT_SITE } from '../../data/siteFacts.js';
import { APPLY_LABEL, TRADE_ACCOUNT_LABEL } from '../../data/terms.js';
import { Link } from '../../lib/router.js';
import { useSite } from '../../lib/siteSettings.js';
import { Breadcrumbs, HOME_CRUMB } from '../../components/Breadcrumbs.jsx';

// Directions to the warehouse in Google Maps; DIRECTIONS_URL is the site's
// own address.
export const directionsUrl = (site) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${site.addressLine1}, ${site.addressLine2}`)}`;
export const DIRECTIONS_URL = directionsUrl(DEFAULT_SITE);

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
  const site = useSite();
  return (
    <aside className="contact-strip" aria-label="Contact the trade desk">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{`Real people, same building as the inventory. ${site.hoursLines.join(' · ')}.`}</p>
      </div>
      <div className="contact-strip-actions">
        <a className="button" href={`tel:${site.phoneRaw}`}>{`Call ${site.phone}`}</a>
        <a className="button on-dark" href={`mailto:${site.email}`}>Email us</a>
        {contactLink && <Link className="text-link" to="/contact">Contact &amp; visit</Link>}
      </div>
    </aside>
  );
}

// The help and policy pages, in the side nav every support page carries
// (AW-122). /delivery and /shipping are both kept, so no address is retired
// or redirected (AW-130, NEW-043): /delivery, 'Delivery & service area', has
// the route states and the service area check; /shipping, 'Delivery policy'
// in its h1, title, crumb and every link, has the terms of delivery and
// pickup. Each page links to the other. POLICY_LINKS above keeps the shorter
// crumb labels.
export const SUPPORT_NAV = [
  { page: 'contact', label: 'Contact & visit' },
  { page: 'delivery', label: 'Delivery & service area' },
  { page: 'shipping', label: 'Delivery policy' },
  // The one apply label (AW-132), for a guest; see supportApplyLabel.
  { page: 'apply', label: APPLY_LABEL },
  { page: 'terms', label: 'Trade terms' },
  { page: 'privacy', label: 'Privacy' },
];

// What the nav calls /apply: the apply label for a guest, and 'Trade
// account', /apply's crumb, once there is an account, for which /apply shows
// the application's or the account's status instead (AW-066, NEW-047).
export const supportApplyLabel = (hasAccount) => (hasAccount ? TRADE_ACCOUNT_LABEL : APPLY_LABEL);

// `label` is the eyebrow over the links; null leaves it off where the page
// head already says it (AW-220). The nav keeps its accessible name.
// `applyLabel` names the /apply entry (supportApplyLabel).
export function PolicyNav({ current, label = 'HELP & POLICIES', applyLabel = APPLY_LABEL }) {
  return (
    <nav className="policy-nav" aria-label="Help and policies">
      {label && <p className="eyebrow">{label}</p>}
      {SUPPORT_NAV.map(link => (
        <Link key={link.page} to={`/${link.page}`} aria-current={current === link.page ? 'page' : undefined}>
          {link.page === 'apply' ? applyLabel : link.label}
        </Link>
      ))}
    </nav>
  );
}

// The side nav beside a support page's content, below its PageHead (AW-122).
// Full-width bands such as the ContactStrip go after it. navLabel is the
// nav's eyebrow (null leaves it off, as on the policy pages, AW-220);
// applyLabel names its /apply entry (signed in: 'Trade account', NEW-047).
export function SupportLayout({ current, navLabel, applyLabel, children }) {
  return (
    <div className="policy-layout support-layout">
      <PolicyNav current={current} label={navLabel} applyLabel={applyLabel} />
      <div className="support-layout-main">{children}</div>
    </div>
  );
}
