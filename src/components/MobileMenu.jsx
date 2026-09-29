// Phone/tablet menu: departments plus everything the desktop navigation rows,
// utility bar and account actions show, in one drawer.

import { COMPANY } from '../data/content.js';
import { ModalLayer } from './ModalLayer.jsx';

export function MobileMenu({ onClose, departments, products, user, isAdmin, pickCategory, go }) {
  return (
    <ModalLayer onClose={onClose} className="aw-menu-layer">
      <div className="overlay" aria-hidden="true" onClick={onClose} />
      <aside className="drawer drawer-left" role="dialog" aria-modal="true" aria-labelledby="aw-mobile-menu-title" id="aw-mobile-menu">
        <div className="drawer-head">
          <h2 id="aw-mobile-menu-title">Menu</h2>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Close menu">×</button>
        </div>
        <div className="drawer-body menu-body">
          <nav className="menu-group" aria-label="Departments">
            <h3>Departments</h3>
            {departments.map((c, i) => (
              <button key={c.key} type="button" onClick={() => pickCategory(c.key, null)}>
                <span><span className="menu-index" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><span>{c.label}</span></span>
                <span className="menu-count">{c.count}</span>
              </button>
            ))}
            <button type="button" className="menu-highlight" onClick={go.catalog}>View full catalog <span aria-hidden="true">↗</span></button>
          </nav>
          <nav className="menu-group" aria-label="Discover">
            <h3>Discover</h3>
            <button type="button" onClick={go.newArrivals}><span><span className="aw-new-dot" aria-hidden="true"></span>New Arrivals</span></button>
            <button type="button" onClick={go.bestsellers}>Bestsellers</button>
            <button type="button" className="menu-highlight" onClick={go.exotics}>Exotics <span aria-hidden="true">↗</span></button>
          </nav>
          <nav className="menu-group" aria-label="Account and help">
            <h3>Account</h3>
            {user ? (
              <>
                <button type="button" onClick={go.account}>{user.business || user.name || 'My Account'}</button>
                {isAdmin && <button type="button" onClick={go.admin}>Admin</button>}
                <button type="button" onClick={go.reorder}>Quick Reorder</button>
                <button type="button" onClick={go.logout}>Sign Out</button>
              </>
            ) : (
              <>
                <button type="button" onClick={go.signin}>Sign In</button>
                <button type="button" onClick={go.signup}>Sign Up <span aria-hidden="true">↗</span></button>
                <button type="button" onClick={go.reorder}>Quick Reorder</button>
              </>
            )}
            <button type="button" onClick={go.help}>Help</button>
          </nav>
          <div className="menu-contact">
            <p>{COMPANY.addressShort}<br /><span>{`${departments.length} departments · ${products.length} SKUs`}</span></p>
            <a className="button ghost" href={`tel:${COMPANY.phoneRaw}`}>Call {COMPANY.phone}</a>
            {!user && <button className="button" type="button" onClick={go.signup}>Apply for a trade account <span aria-hidden="true">↗</span></button>}
          </div>
        </div>
      </aside>
    </ModalLayer>
  );
}
