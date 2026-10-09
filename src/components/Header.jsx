// Site header: utility line, masthead (menu, logo, search, account, cart),
// the Categories mega menu and the discovery/service navigation. Below the
// mobile breakpoint the navigation rows move into MobileMenu.
//
// Every destination is a real link (AW-043); buttons are kept for actions
// (open a dialog, sign in or out, toggle a menu).

import { useState, useEffect, useMemo, useRef } from 'react';
import { IMG } from '../data/theme.js';
import { COMPANY } from '../data/content.js';
import { useMediaQuery, MOBILE_QUERY } from '../lib/useMediaQuery.js';
import { getSearchMatches } from '../lib/search.js';
import { catLabel } from '../lib/format.js';
import { Link, navigate, useLocation } from '../lib/router.js';
import { MobileMenu } from './MobileMenu.jsx';
import { AdminUnseenBadge } from './AdminUnseenBadge.jsx';
import { Icon } from './Icon.jsx';
import { Thumb } from './Thumb.jsx';
import { useImageStatus } from '../lib/useImageStatus.js';

// The logo photo, or the brand in text when it fails to load (AW-341). The
// photo is 320px square, so its width and height reserve the slot before it
// loads; the link around it carries the name.
function Logo() {
  const { status, attempt, ref, onLoad, onError } = useImageStatus();
  if (status === 'failed') return <span className="aw-logo-text"><span>Alabama</span><small>WHOLESALE INC.</small></span>;
  return <img key={attempt} ref={ref} src={IMG.logo} alt="" width="320" height="320" onLoad={onLoad} onError={onError} />;
}

export function Header({ cartCount, onCart, products, departments, user, isAdmin, adminUnseen = 0, onLoginClick, onSignupClick, onLogout, signingOut = false, onHelp }) {
  const [megaOpen, setMegaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const categoryToggleRef = useRef(null);
  const megaOpenRef = useRef(false);
  useEffect(() => { megaOpenRef.current = megaOpen; }, [megaOpen]);

  // Back/Forward (or any page change) closes the mega menu and the search
  // results, like following one of their links does.
  const location = useLocation();
  const [seenLocation, setSeenLocation] = useState(location);
  if (seenLocation !== location) {
    setSeenLocation(location);
    setMegaOpen(false);
    setResultsOpen(false);
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
      setResultsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the phone menu when the layout switches to desktop
  useEffect(() => { if (!isMobile) setMenuOpen(false); }, [isMobile]);
  useEffect(() => {
    const onDoc = (e) => {
      if (!e.target.closest('.aw-navigation')) setMegaOpen(false);
      if (!e.target.closest('.aw-search')) setResultsOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const hits = useMemo(() => getSearchMatches(products, query), [products, query]);
  // Closes the menus before an action or a followed link.
  const closeMenus = () => {
    setMegaOpen(false);
    setMenuOpen(false);
    setResultsOpen(false);
  };
  const runNav = (action) => {
    closeMenus();
    action();
  };
  const closeMega = () => {
    setMegaOpen(false);
    categoryToggleRef.current?.focus();
  };

  const submitSearch = (e) => {
    e.preventDefault();
    if (hits.length) {
      setQuery('');
      closeMenus();
      navigate({ page: 'product', productId: hits[0].id });
    }
  };
  const pickResult = () => { setQuery(''); closeMenus(); };

  return (
    <header className="aw-header container">
      <div className="aw-utility">
        <span>ALABAMA WHOLESALE INC.</span>
        <span>{COMPANY.addressShort} · <a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a></span>
      </div>
      <div className="aw-masthead">
        <button className="aw-menu-toggle" type="button" aria-label="Menu" aria-expanded={menuOpen} aria-controls={menuOpen ? 'aw-mobile-menu' : undefined}
                onClick={() => { setResultsOpen(false); setMenuOpen(true); }}>
          <Icon name="menu" />
          <span>Menu</span>
        </button>
        <Link className="aw-logo" to="/" onClick={closeMenus} aria-label="Alabama Wholesale home">
          <Logo />
        </Link>
        <form className="aw-search" role="search" onSubmit={submitSearch}>
          <input type="search" value={query} placeholder={`Search ${products.length} SKUs — cigars, disposables, candy, drinks…`}
                 autoComplete="off" aria-label="Search products"
                 onChange={(e) => { setQuery(e.target.value); setResultsOpen(true); }}
                 onFocus={() => { setMegaOpen(false); if (query.trim().length >= 2) setResultsOpen(true); }} />
          <button type="submit" aria-label="Search"><Icon name="search" /></button>
          {resultsOpen && query.trim().length >= 2 && (
            <div className="aw-search-results">
              <div className="aw-search-heading">
                <p role="status">{hits.length ? `${hits.length} result${hits.length > 1 ? 's' : ''}` : 'No matches'}</p>
                <button className="icon-btn" type="button" aria-label="Close search results" onClick={() => setResultsOpen(false)}><Icon name="close" /></button>
              </div>
              <div className="aw-search-list">
                {hits.length === 0 && <p>Try a brand (Geekbar, Backwoods, BIC) or a line (&quot;energy drinks&quot;, &quot;wraps&quot;).</p>}
                {hits.map(p => (
                  <Link key={p.id} to={{ page: 'product', productId: p.id }} onClick={pickResult}>
                    <span className="sr-thumb"><Thumb src={p.img} /></span>
                    <span><strong>{p.name}</strong><small>{`${catLabel(p.cat)} · ${p.sub} · ${p.sku}`}</small></span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </form>
        <div className="aw-account-actions">
          {user ? (
            <>
              <Link className="aw-signin aw-account-name" to="/account" onClick={closeMenus}>{user.business || user.name || 'My Account'}</Link>
              {isAdmin && <Link className="aw-signin aw-desktop-only" to="/admin" onClick={closeMenus}>Admin<AdminUnseenBadge count={adminUnseen} /></Link>}
              <span className="aw-account-or">·</span>
              <button className="aw-signin aw-desktop-only" type="button" onClick={() => runNav(onLogout)} disabled={signingOut}>
                <span>{signingOut ? 'Signing out…' : 'Sign Out'}</span>
              </button>
            </>
          ) : (
            <>
              <button className="aw-signin" type="button" onClick={() => runNav(onLoginClick)}>Sign In</button>
              <span className="aw-account-or">or</span>
              <button className="button aw-desktop-only" type="button" onClick={() => runNav(onSignupClick)}>Sign Up</button>
            </>
          )}
          <button className="button ghost sm aw-cart-btn" type="button" onClick={() => runNav(onCart)} aria-label={`Cart, ${cartCount} items`}>
            Cart
            {cartCount > 0 && <span key={cartCount} className="aw-cart-count">{cartCount}</span>}
          </button>
        </div>
      </div>

      {menuOpen && isMobile && (
        <MobileMenu
          onClose={() => setMenuOpen(false)} onFollowLink={closeMenus} departments={departments} products={products} user={user} isAdmin={isAdmin} adminUnseen={adminUnseen}
          signingOut={signingOut}
          go={{
            logout: () => onLogout(), signin: () => runNav(onLoginClick), signup: () => runNav(onSignupClick), help: () => runNav(onHelp),
          }}
        />
      )}

      <div className="aw-navigation">
        <button className="aw-category-toggle" type="button" aria-expanded={megaOpen} aria-controls="aw-mega-menu" ref={categoryToggleRef}
                onClick={() => { setResultsOpen(false); setMegaOpen(o => !o); }}>
          <Icon name="grid" />Categories<Icon name="chevron-down" className="aw-chevron" />
        </button>
        {megaOpen && (
          <section className="aw-mega-menu" id="aw-mega-menu" aria-labelledby="aw-menu-heading">
            <div className="aw-menu-heading">
              <div><p className="eyebrow">WHOLESALE CATALOG</p><h2 id="aw-menu-heading">Browse by department.</h2></div>
              <button className="icon-btn" type="button" aria-label="Close categories" onClick={closeMega}><Icon name="close" /></button>
            </div>
            <div className="aw-menu-grid">
              {departments.map((c, i) => (
                <nav className="aw-department" key={c.key} aria-label={c.label}>
                  <h3><span>{String(i + 1).padStart(2, '0')}</span><span>{c.label}</span></h3>
                  {c.subs.slice(0, 3).map(s => (
                    <Link key={s} to={{ page: 'category', category: c.key, sub: s }} onClick={closeMenus}>{s}</Link>
                  ))}
                  <Link className="aw-department-all" to={{ page: 'category', category: c.key }} onClick={closeMenus}>{`All ${c.label}`}</Link>
                </nav>
              ))}
              <Link className="aw-menu-feature" to={{ page: 'category', category: 'NOVELTIES' }} onClick={closeMenus}>
                <div><p className="eyebrow">FEATURED</p><h3>Exotics &amp;<br />novelties.</h3><span>Explore the department</span></div>
              </Link>
            </div>
            <div className="aw-menu-footer">
              <Link to="/catalog" onClick={closeMenus}>View full catalog</Link>
              <span>{`${departments.length} departments · ${products.length} SKUs`}</span>
            </div>
          </section>
        )}
        <nav className="aw-discovery-nav" aria-label="Main navigation">
          <Link to="/#new-arrivals" onClick={closeMenus}><span className="aw-new-dot" aria-hidden="true"></span>New Arrivals</Link>
          <Link to="/#bestsellers" onClick={closeMenus}>Bestsellers</Link>
          <Link className="aw-exotics-link" to={{ page: 'category', category: 'NOVELTIES' }} onClick={closeMenus}>Exotics</Link>
        </nav>
        <div className="aw-service-nav">
          <Link to="/account" onClick={closeMenus}>Quick Reorder</Link>
          <button type="button" onClick={() => runNav(onHelp)}>Help <Icon name="help" /></button>
        </div>
      </div>
    </header>
  );
}
