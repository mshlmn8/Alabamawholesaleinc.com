// Phone/tablet menu: departments plus everything the desktop navigation rows,
// utility bar and account actions show, in one drawer. Destinations are
// links (AW-043); following one closes the menu (onFollowLink).

import { COMPANY } from '../data/content.js';
import { Link } from '../lib/router.js';
import { ModalLayer } from './ModalLayer.jsx';
import { Icon } from './Icon.jsx';
import { AdminUnseenBadge } from './AdminUnseenBadge.jsx';

export function MobileMenu({ onClose, onFollowLink, departments, products, user, isAdmin, adminUnseen = 0, signingOut = false, go }) {
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
              <Link key={c.key} to={{ page: 'category', category: c.key }} onClick={onFollowLink}>
                <span><span className="menu-index" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><span>{c.label}</span></span>
                <span className="menu-count"><span>{c.count}</span><span className="sr-only"> products</span></span>
              </Link>
            ))}
            <Link className="menu-highlight" to="/catalog" onClick={onFollowLink}>View full catalog</Link>
          </nav>
          <nav className="menu-group" aria-label="Discover">
            <h3>Discover</h3>
            <Link to="/#new-arrivals" onClick={onFollowLink}><span><span className="aw-new-dot" aria-hidden="true"></span>New Arrivals</span></Link>
            <Link to="/#bestsellers" onClick={onFollowLink}>Bestsellers</Link>
            <Link className="menu-highlight" to={{ page: 'category', category: 'NOVELTIES' }} onClick={onFollowLink}>Exotics</Link>
          </nav>
          <nav className="menu-group" aria-label="Account and help">
            <h3>Account</h3>
            {user ? (
              <>
                <Link to="/account" onClick={onFollowLink}>{user.business || user.name || 'My Account'}</Link>
                {isAdmin && <Link to="/admin" onClick={onFollowLink}><span>Admin</span><AdminUnseenBadge count={adminUnseen} /></Link>}
                <Link to="/account" onClick={onFollowLink}>Quick Reorder</Link>
                <button type="button" onClick={go.logout} disabled={signingOut}><span>{signingOut ? 'Signing out…' : 'Sign Out'}</span></button>
              </>
            ) : (
              <>
                <button type="button" onClick={go.signin}>Sign In</button>
                <button type="button" onClick={go.signup}>Sign Up</button>
                <Link to="/account" onClick={onFollowLink}>Quick Reorder</Link>
              </>
            )}
            <button type="button" onClick={go.help}>Help</button>
          </nav>
          <div className="menu-contact">
            <p>{COMPANY.addressShort}<br /><span>{`${departments.length} departments · ${products.length} SKUs`}</span></p>
            <a className="button ghost" href={`tel:${COMPANY.phoneRaw}`}>Call {COMPANY.phone}</a>
            {!user && <button className="button" type="button" onClick={go.signup}>Apply for a trade account</button>}
          </div>
        </div>
      </div>
    </ModalLayer>
  );
}
