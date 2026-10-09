// Phone/tablet menu: departments plus everything the desktop navigation rows,
// utility bar and account actions show, in one drawer. Destinations are
// links (AW-043); following one closes the menu (onFollowLink).

import { COMPANY } from '../data/content.js';
import { APPLY_LABEL, SIGN_IN_LABEL } from '../data/terms.js';
import { Link } from '../lib/router.js';
import { ModalLayer } from './ModalLayer.jsx';
import { Icon } from './Icon.jsx';
import { AdminUnseenBadge } from './AdminUnseenBadge.jsx';

export function MobileMenu({ onClose, onFollowLink, departments, products, user, isAdmin, adminUnseen = 0, signingOut = false, go }) {
  return (
    <ModalLayer onClose={onClose} className="aw-menu-layer">
      <div className="overlay" aria-hidden="true" onClick={onClose} />
      <aside className="drawer drawer-left" role="dialog" aria-modal="true" aria-labelledby="aw-mobile-menu-title" id="aw-mobile-menu">
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
                <span className="menu-count">{c.count}</span>
              </Link>
            ))}
            <Link className="menu-highlight" to="/catalog" onClick={onFollowLink}>View full catalog</Link>
          </nav>
          <nav className="menu-group" aria-label="Discover">
            <h3>Discover</h3>
            <Link to="/#new-arrivals" onClick={onFollowLink}><span><span className="aw-new-dot" aria-hidden="true"></span>New arrivals</span></Link>
            <Link to="/#bestsellers" onClick={onFollowLink}>Bestsellers</Link>
            <Link className="menu-highlight" to={{ page: 'category', category: 'NOVELTIES' }} onClick={onFollowLink}>Exotics</Link>
          </nav>
          <nav className="menu-group" aria-label="Account and help">
            <h3>Account</h3>
            {user ? (
              <>
                <Link to="/account" onClick={onFollowLink}>{user.business || user.name || 'My account'}</Link>
                {isAdmin && <Link to="/admin" onClick={onFollowLink}><span>Admin</span><AdminUnseenBadge count={adminUnseen} /></Link>}
                <Link to="/account" onClick={onFollowLink}>Quick reorder</Link>
                <button type="button" onClick={go.logout} disabled={signingOut}><span>{signingOut ? 'Signing out…' : 'Sign out'}</span></button>
              </>
            ) : (
              <>
                <button type="button" onClick={go.signin}>{SIGN_IN_LABEL}</button>
                <Link to="/account" onClick={onFollowLink}>Quick reorder</Link>
              </>
            )}
            <button type="button" onClick={go.help}>Help</button>
          </nav>
          <div className="menu-contact">
            <p>{COMPANY.addressShort}<br /><span>{`${departments.length} departments · ${products.length} SKUs`}</span></p>
            <a className="button ghost" href={`tel:${COMPANY.phoneRaw}`}>Call {COMPANY.phone}</a>
            {!user && <button className="button" type="button" onClick={go.signup}>{APPLY_LABEL}</button>}
          </div>
        </div>
      </aside>
    </ModalLayer>
  );
}
