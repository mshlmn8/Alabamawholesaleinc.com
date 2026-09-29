// Site header: utility line, masthead (menu, logo, search, account, cart),
// the Categories mega menu and the discovery/service navigation. Below the
// mobile breakpoint the navigation rows move into MobileMenu.

import { useState, useEffect, useMemo, useRef } from 'react';
import { IMG } from '../data/theme.js';
import { COMPANY } from '../data/content.js';
import { useMediaQuery, MOBILE_QUERY } from '../lib/useMediaQuery.js';
import { getSearchMatches } from '../lib/search.js';
import { catLabel, initials } from '../lib/format.js';
import { MobileMenu } from './MobileMenu.jsx';

export function Header({ cartCount, onCart, goHome, goCategory, goProduct, products, departments, onNewArrivals, onBestsellers, user, isAdmin, onAccountClick, onAdminClick, onLoginClick, onSignupClick, onLogout, onHelp, onReorder, onCatalog, onSearchChange }) {
  const [megaOpen, setMegaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const categoryToggleRef = useRef(null);
  const megaOpenRef = useRef(false);
  useEffect(() => { megaOpenRef.current = megaOpen; }, [megaOpen]);

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
  useEffect(() => {
    onSearchChange?.(resultsOpen && query.trim().length >= 2 ? query.trim() : '');
  }, [query, resultsOpen, onSearchChange]);
  const runNav = (action) => {
    setMegaOpen(false);
    setMenuOpen(false);
    setResultsOpen(false);
    action();
  };
  const closeMega = () => {
    setMegaOpen(false);
    categoryToggleRef.current?.focus();
  };

  const submitSearch = (e) => {
    e.preventDefault();
    if (hits.length) { setQuery(''); runNav(() => goProduct(hits[0].id)); }
  };
  const pickResult = (id) => { setQuery(''); runNav(() => goProduct(id)); };
  const pickCategory = (cat, sub) => runNav(() => goCategory(cat, sub));

  return (
    <header className="aw-header container">
      <div className="aw-utility">
        <span>ALABAMA WHOLESALE INC.</span>
        <span>{COMPANY.addressShort} · <a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a></span>
      </div>
      <div className="aw-masthead">
        <button className="aw-menu-toggle" type="button" aria-label="Menu" aria-expanded={menuOpen} aria-controls={menuOpen ? 'aw-mobile-menu' : undefined}
                onClick={() => { setResultsOpen(false); setMenuOpen(true); }}>
          <span className="aw-menu-bars" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>Menu</span>
        </button>
        <button className="aw-logo" onClick={() => runNav(goHome)} aria-label="Alabama Wholesale home">
          <img src={IMG.logo} alt="" />
        </button>
        <form className="aw-search" role="search" onSubmit={submitSearch}>
          <input type="search" value={query} placeholder={`Search ${products.length} SKUs — cigars, disposables, candy, drinks…`}
                 autoComplete="off" aria-label="Search products"
                 onChange={(e) => { setQuery(e.target.value); setResultsOpen(true); }}
                 onFocus={() => { setMegaOpen(false); if (query.trim().length >= 2) setResultsOpen(true); }} />
          <button type="submit" aria-label="Search"><span className="search-icon" aria-hidden="true"></span></button>
          {resultsOpen && query.trim().length >= 2 && (
            <div className="aw-search-results">
              <div className="aw-search-heading">
                <p role="status">{hits.length ? `${hits.length} result${hits.length > 1 ? 's' : ''}` : 'No matches'}</p>
                <button type="button" aria-label="Close search results" onClick={() => setResultsOpen(false)}>×</button>
              </div>
              <div className="aw-search-list">
                {hits.length === 0 && <p>Try a brand (Geekbar, Backwoods, BIC) or a line (&quot;energy drinks&quot;, &quot;wraps&quot;).</p>}
                {hits.map(p => (
                  <button key={p.id} type="button" onClick={() => pickResult(p.id)}>
                    <span className="sr-thumb">{p.img ? <img src={p.img} alt="" loading="lazy" /> : initials(p.name)}</span>
                    <span><strong>{p.name}</strong><small>{`${catLabel(p.cat)} · ${p.sub} · ${p.sku}`}</small></span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
        <div className="aw-account-actions">
          {user ? (
            <>
              <button className="aw-signin aw-account-name" type="button" onClick={() => runNav(onAccountClick)}>{user.business || user.name || 'My Account'}</button>
              {isAdmin && <button className="aw-signin aw-desktop-only" type="button" onClick={() => runNav(onAdminClick)}>Admin</button>}
              <span className="aw-account-or">·</span>
              <button className="aw-signin aw-desktop-only" type="button" onClick={() => runNav(onLogout)}>Sign Out</button>
            </>
          ) : (
            <>
              <button className="aw-signin" type="button" onClick={() => runNav(onLoginClick)}>Sign In</button>
              <span className="aw-account-or">or</span>
              <button className="aw-signup aw-desktop-only" type="button" onClick={() => runNav(onSignupClick)}>Sign Up <span aria-hidden="true">↗</span></button>
            </>
          )}
          <button className="aw-cart-btn" type="button" onClick={() => runNav(onCart)} aria-label={`Cart, ${cartCount} items`}>
            Cart
            {cartCount > 0 && <span className="aw-cart-count">{cartCount}</span>}
          </button>
        </div>
      </div>

      {menuOpen && isMobile && (
        <MobileMenu
          onClose={() => setMenuOpen(false)} departments={departments} products={products} user={user} isAdmin={isAdmin}
          pickCategory={pickCategory}
          go={{
            newArrivals: () => runNav(onNewArrivals), bestsellers: () => runNav(onBestsellers), exotics: () => runNav(() => goCategory('NOVELTIES')),
            account: () => runNav(onAccountClick), admin: () => runNav(onAdminClick), logout: () => runNav(onLogout),
            signin: () => runNav(onLoginClick), signup: () => runNav(onSignupClick), reorder: () => runNav(onReorder), help: () => runNav(onHelp),
            catalog: () => runNav(onCatalog),
          }}
        />
      )}

      <div className="aw-navigation">
        <button className="aw-category-toggle" type="button" aria-expanded={megaOpen} aria-controls="aw-mega-menu" ref={categoryToggleRef}
                onClick={() => { setResultsOpen(false); setMegaOpen(o => !o); }}>
          <span className="grid-symbol" aria-hidden="true">⊞</span>Categories <span className="aw-chevron" aria-hidden="true">⌄</span>
        </button>
        {megaOpen && (
          <section className="aw-mega-menu" id="aw-mega-menu" aria-labelledby="aw-menu-heading">
            <div className="aw-menu-heading">
              <div><p className="eyebrow">WHOLESALE CATALOG</p><h2 id="aw-menu-heading">Browse by department.</h2></div>
              <button className="aw-menu-close" type="button" aria-label="Close categories" onClick={closeMega}>×</button>
            </div>
            <div className="aw-menu-grid">
              {departments.map((c, i) => (
                <nav className="aw-department" key={c.key} aria-label={c.label}>
                  <h3><span>{String(i + 1).padStart(2, '0')}</span><span>{c.label}</span></h3>
                  {c.subs.slice(0, 3).map(s => (
                    <button key={s} type="button" onClick={() => pickCategory(c.key, s)}>{s}</button>
                  ))}
                  <button type="button" style={{ fontWeight: 700, color: 'var(--purple)' }} onClick={() => pickCategory(c.key, null)}>{`All ${c.label} →`}</button>
                </nav>
              ))}
              <button className="aw-menu-feature" type="button" onClick={() => pickCategory('NOVELTIES', null)}>
                <div><p className="eyebrow">FEATURED</p><h3>Exotics &amp;<br />novelties.</h3><span>Explore the department <b aria-hidden="true">↗</b></span></div>
              </button>
            </div>
            <div className="aw-menu-footer">
              <button type="button" onClick={() => runNav(onCatalog)}>View full catalog <span aria-hidden="true">↗</span></button>
              <span>{`${departments.length} departments · ${products.length} SKUs`}</span>
            </div>
          </section>
        )}
        <nav className="aw-discovery-nav" aria-label="Main navigation">
          <button type="button" onClick={() => runNav(onNewArrivals)}><span className="aw-new-dot" aria-hidden="true"></span>New Arrivals</button>
          <button type="button" onClick={() => runNav(onBestsellers)}>Bestsellers</button>
          <button type="button" className="aw-exotics-link" onClick={() => runNav(() => goCategory('NOVELTIES'))}>Exotics <span aria-hidden="true">↗</span></button>
        </nav>
        <div className="aw-service-nav">
          <button type="button" onClick={() => runNav(onReorder)}>Quick Reorder</button>
          <button type="button" onClick={() => runNav(onHelp)}>Help <span className="aw-help-icon" aria-hidden="true">?</span></button>
        </div>
      </div>
    </header>
  );
}
