// Phone/tablet menu: departments plus everything the desktop navigation rows,
// utility bar and account actions show, in one drawer. Destinations are
// links (AW-043); following one closes the menu (onFollowLink). Links to the
// page on screen carry aria-current (AW-221).

import { COMPANY } from '../data/content.js';
import { APPLY_LABEL, SIGN_IN_LABEL } from '../data/terms.js';
import { Link, useRoute } from '../lib/router.js';
import { currentFor } from '../lib/navCurrent.js';
import { productCount } from '../lib/format.js';
import { ModalLayer } from './ModalLayer.jsx';
import { Icon } from './Icon.jsx';
import { AdminUnseenBadge } from './AdminUnseenBadge.jsx';

// Quick Reorder is a section of My account (AW-086).
const QUICK_REORDER = '/account#quick-reorder';

export function MobileMenu({ onClose, onFollowLink, departments, products, user, isAdmin, adminUnseen = 0, signingOut = false, go }) {
  const { raw } = useRoute();
  return (
    <ModalLayer onClose={onClose} className="aw-menu-layer">
      <div className="overlay" aria-hidden="true" onClick={onClose} />
      <div className="drawer drawer-left" role="dialog" aria-modal="true" aria-labelledby="aw-mobile-menu-title" id="aw-mobile-menu">
        <div className="drawer-head">
          <h2 id="aw-mobile-menu-title">Menu</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close menu"><Icon name="close" /></button>
        </div>
        <div className="drawer-body menu-body">
          <nav className="menu-group" aria-label="Departments">
            <h3>Departments</h3>
            {departments.map((c, i) => (
              <Link key={c.key} to={{ page: 'category', category: c.key }} onClick={onFollowLink} aria-current={currentFor(raw, { page: 'category', category: c.key })}>
                <span><span className="menu-index" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><span>{c.label}</span></span>
                <span className="menu-count"><span>{c.count}</span><span className="sr-only"> products</span></span>
              </Link>
            ))}
            <Link className="menu-highlight" to="/catalog" onClick={onFollowLink} aria-current={currentFor(raw, '/catalog')}>View full catalog</Link>
          </nav>
          <nav className="menu-group" aria-label="Discover">
            <h3>Discover</h3>
            <Link to="/#new-arrivals" onClick={onFollowLink}><span><span className="aw-new-dot" aria-hidden="true"></span>New arrivals</span></Link>
            <Link to="/#bestsellers" onClick={onFollowLink}>Bestsellers</Link>
            <Link className="menu-highlight" to={{ page: 'category', category: 'NOVELTIES' }} onClick={onFollowLink}
                  aria-current={currentFor(raw, { page: 'category', category: 'NOVELTIES' })}>Exotics</Link>
          </nav>
          <nav className="menu-group" aria-label="Account and help">
            <h3>Account</h3>
            {user ? (
              <>
                {/* What the link is for, then whose account it is (AW-267). */}
                <Link to="/account" onClick={onFollowLink}>
                  <span className="menu-account">My account{' '}<small className="menu-sub">{user.business || user.name || ''}</small></span>
                </Link>
                {isAdmin && <Link to="/admin" onClick={onFollowLink}><span>Admin</span><AdminUnseenBadge count={adminUnseen} /></Link>}
                <Link to={QUICK_REORDER} onClick={onFollowLink} aria-current={currentFor(raw, '/account')}>Quick reorder</Link>
                <button type="button" onClick={go.logout} disabled={signingOut}><span>{signingOut ? 'Signing out…' : 'Sign out'}</span></button>
              </>
            ) : (
              <>
                <button type="button" onClick={go.signin}>{SIGN_IN_LABEL}</button>
                {/* My account's section, with the sign-in dialog over it (AW-086). */}
                <Link to={QUICK_REORDER} onClick={go.reorder} aria-current={currentFor(raw, '/account')}>Quick reorder</Link>
              </>
            )}
            <button type="button" onClick={go.help}>Help</button>
          </nav>
          <div className="menu-contact">
            <p>{COMPANY.addressShort}<br /><span>{`${departments.length} departments · ${productCount(products.length)}`}</span></p>
            <a className="button ghost" href={`tel:${COMPANY.phoneRaw}`}>Call {COMPANY.phone}</a>
            {!user && <button className="button" type="button" onClick={go.signup}>{APPLY_LABEL}</button>}
          </div>
        </div>
      </div>
    </ModalLayer>
  );
}
