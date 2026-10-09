// Site footer: departments, account and help links, contact details, the
// policy links and the nicotine warning. Destinations are links (AW-043);
// "Apply for a trade account", "Sign in" and "Help" open dialogs and stay
// buttons. Signed in, a "My account" link takes the place of Apply and Sign
// in (AW-066), and the link to /apply is "Trade account", the page's crumb,
// where /apply shows the application's or the account's status and its
// documents; a guest's is "Application checklist" (NEW-047). Links to the
// page on screen carry aria-current (AW-221).
//
// AW-285: the shop links (all products, the departments, new arrivals,
// bestsellers) are one column and the account and help links another, with
// My account, Quick reorder and Help. There is no FAQ page yet (AW-279 waits
// on the owner), so Help stands in for one. The blurb names every
// department, from the catalog. The licensed-only statement is LICENSED_ONLY,
// the same words as the trade-only strip, and the year is the current one.
//
// AW-305, LEFT-4: on phones (FOOTER_FOLD_QUERY, the CSS's phone block) the
// Departments list folds behind its heading, a <details> whose summary is the
// h2, so the footer is about two-thirds of a screen rather than one and a
// half. Every link is still there, one tap or Enter away. Wider screens get
// the plain heading and the open list. The columns carry classes so the CSS
// can put the contact details beside the longer list (index.css).

import { COMPANY, HOURS, LICENSED_ONLY, TIME_ZONE_LABEL, hoursRange } from '../data/content.js';
import { APPLY_LABEL, SIGN_IN_LABEL, TRADE_ACCOUNT_LABEL } from '../data/terms.js';
import { Link, useRoute } from '../lib/router.js';
import { currentFor } from '../lib/navCurrent.js';
import { useMediaQuery } from '../lib/useMediaQuery.js';
import { EmailText } from './ContactLinks.jsx';
import { Icon } from './Icon.jsx';
import { NicotineWarning } from './NicotineWarning.jsx';

// The phone layout, where Departments folds: the same condition as the
// footer's phone block in src/index.css (styles.test.js checks they match).
export const FOOTER_FOLD_QUERY = '(max-width: 37.5em)';

const NBSP = '\u00A0';

// The copyright year, read once when the module loads: render may not read
// the clock (react-hooks/purity).
const YEAR = new Date().getFullYear();

// 'a', 'a and b', 'a, b, and c': what Intl.ListFormat('en-US') writes for a
// long conjunction. Safari 14.0 and iOS 14.0–14.4, which the build still
// targets, have no Intl.ListFormat, so it is used only where it exists and
// made on first use, never while the module loads: a missing constructor
// there stopped the whole site from starting (NEW-019). The fallback writes
// the same words.
let listFormat = null;
export function listText(items) {
  const list = items.map(String);
  if (typeof Intl === 'object' && typeof Intl.ListFormat === 'function') {
    // eslint-disable-next-line no-restricted-syntax -- guarded above: only where the browser has Intl.ListFormat (NEW-019)
    if (!listFormat) listFormat = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });
    return listFormat.format(list);
  }
  if (list.length < 3) return list.join(' and ');
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
}

// 'Wholesale distributor of tobacco, novelties & vapes, …, and drinks & bags.'
export function footerBlurb(departments) {
  const names = listText(departments.map(d => d.label.toLowerCase()));
  return `Wholesale distributor${names ? ` of ${names}` : ''}. Serving licensed retail stores.`;
}

export function Footer({ departments, signedIn = false, onLoginClick, onApplyClick, onHelp }) {
  const { raw } = useRoute();
  const current = (to) => currentFor(raw, to);
  const fold = useMediaQuery(FOOTER_FOLD_QUERY);
  const shopLinks = (
    <>
      <Link className="footer-link" to="/catalog" aria-current={current('/catalog')}>All products</Link>
      {departments.map(c => <Link key={c.key} className="footer-link" to={{ page: 'category', category: c.key }} aria-current={current({ page: 'category', category: c.key })}>{`${c.label} (${c.count})`}</Link>)}
      <Link className="footer-link" to="/#new-arrivals">New arrivals</Link>
      <Link className="footer-link" to="/#bestsellers">Bestsellers</Link>
    </>
  );
  return (
    <footer className="footer-main">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span>Alabama</span><small>WHOLESALE INC.</small>
            <p>{footerBlurb(departments)}</p>
          </div>
          {fold
            ? (
              <details className="footer-departments footer-fold">
                <summary><h2>Departments</h2><Icon name="plus" className="fold-plus" /><Icon name="minus" className="fold-minus" /></summary>
                {shopLinks}
              </details>
            )
            : <div className="footer-departments"><h2>Departments</h2>{shopLinks}</div>}
          <div className="footer-account">
            <h2>Account &amp; help</h2>
            {signedIn
              ? <Link className="footer-link" to="/account" aria-current={current('/account')}>My account</Link>
              : <button type="button" onClick={onApplyClick}>{APPLY_LABEL}</button>}
            <Link className="footer-link" to="/apply" aria-current={current('/apply')}>{signedIn ? TRADE_ACCOUNT_LABEL : 'Application checklist'}</Link>
            {!signedIn && <button type="button" onClick={onLoginClick}>{SIGN_IN_LABEL}</button>}
            {/* A guest's My account says what an account gives (AW-285, AW-086). */}
            {!signedIn && <Link className="footer-link" to="/account" aria-current={current('/account')}>My account</Link>}
            <Link className="footer-link" to="/account#quick-reorder">Quick reorder</Link>
            <button type="button" onClick={onHelp}>Help</button>
            <Link className="footer-link" to="/contact" aria-current={current('/contact')}>Contact &amp; visit</Link>
            <Link className="footer-link" to="/delivery" aria-current={current('/delivery')}>Delivery &amp; service area</Link>
          </div>
          <div className="footer-contact">
            <h2>Contact</h2>
            <p>{COMPANY.addressLine1}<br />{COMPANY.addressLine2}</p>
            <p><a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a><br /><a href={`mailto:${COMPANY.email}`}><EmailText /></a></p>
            {/* In the narrow phone column the email breaks after the '@' and
                each line of hours after its days, never inside the times. */}
            <p>{HOURS.map((row) => <span className="footer-hours" key={row.days}><span>{row.days}</span> <span>{`${hoursRange(row)}${NBSP}${TIME_ZONE_LABEL}`}</span></span>)}</p>
          </div>
        </div>
        <div className="footer-legal">
          <p>{`© ${YEAR} ${COMPANY.name}. All rights reserved.`}</p>
          <nav className="footer-policies" aria-label="Policies">
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
