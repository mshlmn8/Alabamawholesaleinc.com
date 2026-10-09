// Site header: masthead (menu, logo, search, account, cart), the Categories
// mega menu and the discovery/service navigation. Below the mobile
// breakpoint the navigation rows move into MobileMenu. There is no utility
// row (AW-153): the logo names the business, the trade bar has the Call link,
// and the address is in the footer, Help, Contact and the phone menu.
//
// Every destination is a real link (AW-043); buttons are kept for actions
// (open a dialog, sign in or out, toggle a menu).
//
// The search box is HeaderSearch, a combobox (AW-171). The Categories menu,
// like the search list, closes when focus moves to a control outside it
// (AW-165), on Escape, on a click outside and on a page change. It lists each
// department's three biggest product lines, and fits the window: its heading
// and footer stay in view while the departments scroll between them (AW-062).
// TODO(owner): Its featured Novelties tile was an empty block and is gone; a
// new one needs the department's one name and a photo (AW-056, AW-217).
//
// Links to the page on screen carry aria-current (AW-221, navCurrent.js).
//
// Its root is a <div>: App puts it in the page's one <header> landmark, with
// the skip link and the trade bar (AW-314).

import { useState, useEffect, useRef } from 'react';
import { IMG } from '../data/theme.js';
import { APPLY_LABEL, SIGN_IN_LABEL, basketBadge, basketButtonLabel, basketTerms } from '../data/terms.js';
import { useMediaQuery, MOBILE_QUERY } from '../lib/useMediaQuery.js';
import { Link, navigate, useRoute } from '../lib/router.js';
import { MobileMenu } from './MobileMenu.jsx';
import { AdminUnseenBadge } from './AdminUnseenBadge.jsx';
import { HeaderSearch } from './HeaderSearch.jsx';
import { Icon } from './Icon.jsx';
import { useImageStatus } from '../lib/useImageStatus.js';
import { topLines } from '../lib/departments.js';
import { currentFor } from '../lib/navCurrent.js';
import { productCount } from '../lib/format.js';

// The logo photo, or the brand in text when it fails to load (AW-341). The
// photo is 320px square, so its width and height reserve the slot before it
// loads; the link around it carries the name.
function Logo() {
  const { status, attempt, ref, onLoad, onError } = useImageStatus();
  if (status === 'failed') return <span className="aw-logo-text"><span>Alabama</span><small>WHOLESALE INC.</small></span>;
  return <img key={attempt} ref={ref} src={IMG.logo} alt="" width="320" height="320" onLoad={onLoad} onError={onError} />;
}

// Quick Reorder is a section of My account (AW-086).
const QUICK_REORDER = '/account#quick-reorder';
// A left click with no modifier key, which a Link follows in the app.
const plainClick = (e) => e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

export function Header({ cartCount, onCart, products, departments, user, isAdmin, isApprovedBuyer = false, adminUnseen = 0, onLoginClick, onSignupClick, onLogout, signingOut = false, onHelp }) {
  const [megaOpen, setMegaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const basket = basketTerms(isApprovedBuyer);
  const categoryToggleRef = useRef(null);
  const megaMenuRef = useRef(null);
  const megaOpenRef = useRef(false);
  useEffect(() => { megaOpenRef.current = megaOpen; }, [megaOpen]);

  // Back/Forward (or any page change) closes the mega menu, like following
  // one of its links does. HeaderSearch does the same for its list.
  const { location, raw } = useRoute();
  const [seenLocation, setSeenLocation] = useState(location);
  if (seenLocation !== location) {
    setSeenLocation(location);
    setMegaOpen(false);
  }
  // The phone menu stays open while Sign Out runs, so its button can say
  // "Signing out…" (AW-336), and closes when it has finished.
  const [wasSigningOut, setWasSigningOut] = useState(signingOut);
  if (wasSigningOut !== signingOut) {
    setWasSigningOut(signingOut);
    if (!signingOut) setMenuOpen(false);
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (megaOpenRef.current) {
        setMegaOpen(false);
        categoryToggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the phone menu when the layout switches to desktop
  useEffect(() => { if (!isMobile) setMenuOpen(false); }, [isMobile]);
  useEffect(() => {
    const onDoc = (e) => {
      if (!e.target.closest('.aw-navigation')) setMegaOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  // Closes the menus before an action or a followed link.
  const closeMenus = () => {
    setMegaOpen(false);
    setMenuOpen(false);
  };
  const runNav = (action) => {
    closeMenus();
    action();
  };
  // A guest's Quick Reorder opens My account with the sign-in dialog over
  // it (AW-086): the page first, so the dialog's history entry sits on top
  // of /account and Back closes it there. Signing in then lands on the
  // section (AccountPage reveals it once the account has loaded).
  const followReorder = (e) => {
    closeMenus();
    if (user || !plainClick(e)) return;
    e.preventDefault();
    navigate(QUICK_REORDER);
    onLoginClick();
  };
  const closeMega = () => {
    setMegaOpen(false);
    categoryToggleRef.current?.focus();
  };
  // Tabbing (or clicking) from the toggle or the menu to a control outside
  // both closes the menu, so it never hides the focused control (AW-165).
  // A blur with no relatedTarget (Safari clicking a link, the window losing
  // focus) leaves it to the click and Escape handlers.
  const onMegaBlur = (e) => {
    const next = e.relatedTarget;
    if (!next || categoryToggleRef.current?.contains(next) || megaMenuRef.current?.contains(next)) return;
    setMegaOpen(false);
  };

  const accountName = user ? (user.business || user.name || '') : '';

  return (
    <div className="aw-header container">
      <div className="aw-masthead">
        <button className="aw-menu-toggle" type="button" aria-label="Menu" aria-expanded={menuOpen} aria-controls={menuOpen ? 'aw-mobile-menu' : undefined}
                onClick={() => setMenuOpen(true)}>
          <Icon name="menu" />
          <span>Menu</span>
        </button>
        <Link className="aw-logo" to="/" onClick={closeMenus} aria-label="Alabama Wholesale home">
          <Logo />
        </Link>
        <HeaderSearch products={products} isMobile={isMobile} onOpen={() => setMegaOpen(false)} />
        <div className="aw-account-actions">
          {user ? (
            <>
              {/* What the link is for, above whose account it is (AW-267). The
                  name is cut short to fit; the title has it in full. */}
              {accountName ? (
                <Link key="named" className="aw-signin aw-account-name" to="/account" onClick={closeMenus} title={accountName}>
                  <small className="aw-account-kicker">My account</small>{' '}<span className="aw-account-label">{accountName}</span>
                </Link>
              ) : (
                <Link key="plain" className="aw-signin aw-account-name" to="/account" onClick={closeMenus}>My account</Link>
              )}
              {isAdmin && (
                <>
                  <span className="aw-account-or aw-desktop-only" aria-hidden="true">·</span>
                  <Link className="aw-signin aw-desktop-only" to="/admin" onClick={closeMenus}>Admin<AdminUnseenBadge count={adminUnseen} /></Link>
                </>
              )}
              <span className="aw-account-or" aria-hidden="true">·</span>
              <button className="aw-signin aw-desktop-only" type="button" onClick={() => runNav(onLogout)} disabled={signingOut}>
                <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </>
          ) : (
            <>
              <button className="aw-signin" type="button" onClick={() => runNav(onLoginClick)}>{SIGN_IN_LABEL}</button>
              <span className="aw-account-or">or</span>
              <button className="button aw-desktop-only" type="button" onClick={() => runNav(onSignupClick)}>{APPLY_LABEL}</button>
            </>
          )}
          <button className="button ghost sm aw-cart-btn" type="button" onClick={() => runNav(onCart)} aria-label={basketButtonLabel(basket, cartCount)}>
            <span>{basket.label}</span>
            {cartCount > 0 && <span key={cartCount} className="aw-cart-count">{basketBadge(cartCount)}</span>}
          </button>
        </div>
      </div>

      {menuOpen && isMobile && (
        <MobileMenu
          onClose={() => setMenuOpen(false)} onFollowLink={closeMenus} departments={departments} products={products} user={user} isAdmin={isAdmin} adminUnseen={adminUnseen}
          signingOut={signingOut}
          go={{
            logout: () => onLogout(), signin: () => runNav(onLoginClick), signup: () => runNav(onSignupClick), help: () => runNav(onHelp), reorder: followReorder,
          }}
        />
      )}

      <div className="aw-navigation">
        <button className="aw-category-toggle" type="button" aria-expanded={megaOpen} aria-controls={megaOpen ? 'aw-mega-menu' : undefined} ref={categoryToggleRef}
                onClick={() => setMegaOpen(o => !o)} onBlur={onMegaBlur}>
          <Icon name="grid" />Categories<Icon name="chevron-down" className="aw-chevron" />
        </button>
        {megaOpen && (
          <div className="aw-mega-menu" id="aw-mega-menu" ref={megaMenuRef} onBlur={onMegaBlur}>
            <div className="aw-menu-heading">
              <div><p className="eyebrow">WHOLESALE CATALOG</p><h2 id="aw-menu-heading">Browse by department.</h2></div>
              <button className="icon-btn" type="button" aria-label="Close categories" onClick={closeMega}><Icon name="close" /></button>
            </div>
            <div className="aw-menu-grid">
              {departments.map((c, i) => (
                <div className="aw-department" key={c.key} role="group" aria-labelledby={`aw-department-${i}`}>
                  <h3><span>{String(i + 1).padStart(2, '0')}</span><span id={`aw-department-${i}`}>{c.label}</span></h3>
                  {topLines(products, c.key, 3).map(s => (
                    <Link key={s} to={{ page: 'category', category: c.key, sub: s }} onClick={closeMenus}
                          aria-current={currentFor(raw, { page: 'category', category: c.key, sub: s })}>{s}</Link>
                  ))}
                  <Link className="aw-department-all" to={{ page: 'category', category: c.key }} onClick={closeMenus}
                        aria-current={currentFor(raw, { page: 'category', category: c.key })}>{`All ${c.label}`}</Link>
                </div>
              ))}
            </div>
            <div className="aw-menu-footer">
              <Link to="/catalog" onClick={closeMenus} aria-current={currentFor(raw, '/catalog')}>View full catalog</Link>
              <span>{`${departments.length} departments · ${productCount(products.length)}`}</span>
            </div>
          </div>
        )}
        <nav className="aw-discovery-nav" aria-label="Main navigation">
          <Link to="/#new-arrivals" onClick={closeMenus}><span className="aw-new-dot" aria-hidden="true"></span>New arrivals</Link>
          <Link to="/#bestsellers" onClick={closeMenus}>Bestsellers</Link>
          <Link className="aw-exotics-link" to={{ page: 'category', category: 'NOVELTIES' }} onClick={closeMenus}
                aria-current={currentFor(raw, { page: 'category', category: 'NOVELTIES' })}>Exotics</Link>
        </nav>
        <div className="aw-service-nav">
          <Link to={QUICK_REORDER} onClick={followReorder} aria-current={currentFor(raw, '/account')}>Quick reorder</Link>
          <button type="button" onClick={() => runNav(onHelp)}>Help <Icon name="help" /></button>
        </div>
      </div>
    </div>
  );
}
