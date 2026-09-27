import React, { useState, useEffect, useMemo, useRef } from 'react';

import { IMG } from './data/theme.js';
import { COMPANY, ANNOUNCEMENTS, STORAGE, HERO_SLIDES } from './data/content.js';
import { NAV_ORDER, NEW_ARRIVALS_IDS } from './data/products.js';
import { useAuth } from './lib/useAuth.js';
import { useCatalog } from './lib/useCatalog.js';
import { submitOrder } from './lib/orders.js';
import { lineKey, variantList, variantSku, requiresVariantChoice, resolveCartItems, normalizeCart } from './lib/lines.js';
import { heroImage, SIZES } from './lib/images.js';
import { Picture } from './components/Picture.jsx';
import { AuthModal } from './components/AuthModal.jsx';
import { AccountPage } from './pages/account/AccountPage.jsx';
import { AdminPage } from './pages/admin/AdminPage.jsx';

// Display-only tier discounts. Saved quotes ignore this and price on the server.
const TIER_DISCOUNT = { standard: 0, silver: 0.05, gold: 0.10 };
const priceForProfile = (listPrice, profile) => {
  if (profile?.status !== 'approved' || listPrice == null) return null;
  return Number(listPrice) * (1 - (TIER_DISCOUNT[profile.pricing_tier] || 0));
};

const CAT_LABEL = {
  'TOBACCO': 'Tobacco', 'NOVELTIES': 'Novelties & Vapes', 'MERCHANDISE': 'Merchandise',
  'CANDIES': 'Candies', 'DRINKS & BAGS': 'Drinks & Bags', 'FOOD STUFF': 'Food Stuff',
  'GROCERY': 'Grocery', 'MOTOR OIL': 'Motor Oil'
};
const catLabel = (c) => CAT_LABEL[c] || c;
const initials = (name) => {
  const p = String(name).split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '?') + (p[1]?.[0] || '')).toUpperCase();
};
const money = (n) => `$${Number(n).toFixed(2)}`;

const safeReadJson = (key, fallback) => {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
};
const safeWriteJson = (key, value) => { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {} };

const productText = (p) => `${p.name} ${p.brand} ${p.cat} ${p.sub} ${p.sku} ${(p.variants || []).join(' ')}`.toLowerCase();
const getSearchMatches = (products, query, limit = 10) => {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return products
    .map(p => {
      const h = productText(p);
      const score =
        (p.name.toLowerCase().includes(q) ? 80 : 0) +
        (String(p.sku).toLowerCase().includes(q) ? 70 : 0) +
        (p.brand.toLowerCase().includes(q) ? 45 : 0) +
        (p.cat.toLowerCase().includes(q) ? 24 : 0) +
        (terms.every(t => h.includes(t)) ? 30 : 0) +
        terms.filter(t => h.includes(t)).length * 8;
      return { p, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map(x => x.p);
};

const TICKER_TEXT = ANNOUNCEMENTS.join('  ·  ') + '  ·  ';

function departmentsFor(products) {
  const known = new Set(NAV_ORDER);
  const extras = [];
  for (const p of products) {
    if (p.cat && !known.has(p.cat) && !extras.includes(p.cat)) extras.push(p.cat);
  }
  return [...NAV_ORDER, ...extras].map(name => {
    const rows = products.filter(p => p.cat === name);
    const subs = Array.from(new Set(rows.map(p => p.sub).filter(Boolean))).sort();
    return { key: name, label: catLabel(name), subs, count: rows.length };
  });
}

// =============================================================================
// ROOT
// =============================================================================
export default function App() {
  const [verified, setVerified] = useState(() => window.localStorage.getItem(STORAGE.age) === 'yes');
  const [tooYoung, setTooYoung] = useState(false);
  const [cart, setCart] = useState(() => safeReadJson(STORAGE.cart, {}));
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState('signin');
  const [helpOpen, setHelpOpen] = useState(false);

  const auth = useAuth();
  const { products } = useCatalog();
  const { profile, signOut, isBackendConfigured } = auth;
  const user = profile ? { id: profile.id, name: profile.name, email: profile.email, business: profile.business } : null;
  const isApprovedBuyer = profile?.status === 'approved';
  const isAdmin = profile?.role === 'admin';
  const departments = useMemo(() => departmentsFor(products), [products]);

  // hash router — same routes as before: #/ #/category/X #/product/ID #/quote #/account #/admin
  const parseHash = () => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash) return { page: 'home' };
    const [section, ...rest] = hash.split('/');
    if (section === 'product' && rest[0]) return { page: 'product', productId: Number(decodeURIComponent(rest[0])) };
    if (section === 'category' && rest[0]) return { page: 'category', category: decodeURIComponent(rest[0]), sub: rest[1] ? decodeURIComponent(rest[1]) : null };
    if (section === 'quote') return { page: 'quote' };
    if (section === 'account') return { page: 'account' };
    if (section === 'admin') return { page: 'admin' };
    return { page: 'home' };
  };
  const routeToHash = (r) => {
    if (r.page === 'product') return `#/product/${r.productId}`;
    if (r.page === 'category') return `#/category/${encodeURIComponent(r.category)}${r.sub ? '/' + encodeURIComponent(r.sub) : ''}`;
    if (r.page === 'quote') return '#/quote';
    if (r.page === 'account') return '#/account';
    if (r.page === 'admin') return '#/admin';
    return '#/';
  };
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    const onPop = () => setRoute(parseHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
  }, []);

  useEffect(() => {
    const titles = {
      home: `${COMPANY.name} · Wholesale Distributor — Birmingham, AL`,
      quote: `Checkout · ${COMPANY.name}`,
      account: `My Account · ${COMPANY.name}`,
      admin: `Admin · ${COMPANY.name}`,
    };
    let title = titles[route.page] || titles.home;
    if (route.page === 'category') title = `${catLabel(route.category)} · Wholesale Catalog · ${COMPANY.name}`;
    if (route.page === 'product') {
      const p = products.find(x => Number(x.id) === route.productId);
      if (p) title = `${p.name} · ${p.brand} · ${COMPANY.name}`;
    }
    document.title = title;
  }, [route, products]);

  const navigate = (next, { scroll = true } = {}) => {
    window.history.pushState(null, '', routeToHash(next));
    setRoute(next);
    if (scroll) window.scrollTo(0, 0);
  };
  const goHome = () => navigate({ page: 'home' });
  const goProduct = (id) => navigate({ page: 'product', productId: id });
  const goCategory = (cat, sub = null) => navigate({ page: 'category', category: cat, sub });
  const goQuote = () => { setCartOpen(false); navigate({ page: 'quote' }); };
  const goHomeSection = (sectionId) => {
    const scrollToSection = () => window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
    }));
    if (route.page === 'home') scrollToSection();
    else { navigate({ page: 'home' }, { scroll: false }); scrollToSection(); }
  };

  useEffect(() => { safeWriteJson(STORAGE.cart, cart); }, [cart]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setCartOpen(false); setLoginOpen(false); setHelpOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const locked = cartOpen || loginOpen || helpOpen;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [cartOpen, loginOpen, helpOpen]);

  useEffect(() => {
    setCart(current => normalizeCart(current, products));
  }, [products]);

  const cartCount = Object.values(cart).reduce((a, b) => a + Number(b || 0), 0);
  const cartItems = useMemo(
    () => resolveCartItems(cart, products).map(item => ({ ...item, price: priceForProfile(item.listPrice, profile) })),
    [cart, products, profile]
  );
  const cartTotal = cartItems.reduce((s, i) => s + (i.price == null ? 0 : i.qty * i.price), 0);
  const addLine = (productId, variant, n = 1) => {
    const product = products.find(p => Number(p.id) === Number(productId));
    if (!product || product.active === false) return;
    if (requiresVariantChoice(product) && !variant) return;
    const key = lineKey(product.id, variant || null);
    setCart(c => ({ ...c, [key]: (Number(c[key]) || 0) + n }));
  };
  // Batch add for reorders. Unlike addLine, a multi-variant product without a
  // variant is kept as a bare line so the buyer can choose it in the cart.
  const addLines = (lines) => {
    setCart(c => {
      const next = { ...c };
      for (const line of lines || []) {
        const product = products.find(p => Number(p.id) === Number(line.productId));
        const n = Math.floor(Number(line.qty));
        if (!product || product.active === false || !(n > 0)) continue;
        const key = lineKey(product.id, line.variant || null);
        next[key] = (Number(next[key]) || 0) + n;
      }
      return next;
    });
  };
  const decLine = (key) => setCart(c => { const next = { ...c }; const v = (Number(next[key]) || 0) - 1; if (v <= 0) delete next[key]; else next[key] = v; return next; });
  const removeLine = (key) => setCart(c => { const n = { ...c }; delete n[key]; return n; });
  const clearCart = () => setCart({});

  const handleAgeYes = () => { setVerified(true); window.localStorage.setItem(STORAGE.age, 'yes'); };
  const handleLogout = async () => { await signOut(); navigate({ page: 'home' }); };

  const openLogin = (mode) => {
    setLoginMode(mode);
    setLoginOpen(true);
  };
  const openSignin = () => openLogin('signin');
  const openSignup = () => openLogin('signup');
  const openCartSignin = () => {
    setCartOpen(false);
    openSignin();
  };

  if (!verified) return <AgeGate onYes={handleAgeYes} onNo={() => setTooYoung(true)} tooYoung={tooYoung} />;

  const shared = {
    user, profile, isApprovedBuyer, cart, addLine, decLine, products, departments,
    onLoginClick: openSignin, onApplyClick: openSignup, onAccountClick: () => navigate({ page: 'account' }),
    goProduct, goCategory, goHome,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <div className="trade-bar">
        <div className="container">
          <div className="ticker" aria-hidden="true"><span>{TICKER_TEXT + TICKER_TEXT + TICKER_TEXT + TICKER_TEXT}</span></div>
          <button type="button" onClick={openSignup}>Apply for a trade account ↗</button>
        </div>
      </div>
      <div className="trade-only">WHOLESALE TO LICENSED RETAIL BUSINESSES ONLY · NO CONSUMER SALES · 21+</div>

      <Header
        cartCount={cartCount} onCart={() => setCartOpen(true)}
        goHome={goHome} goCategory={goCategory} goProduct={goProduct}
        products={products} departments={departments}
        onNewArrivals={() => goHomeSection('new-arrivals')} onBestsellers={() => goHomeSection('bestsellers')}
        user={user} isAdmin={isAdmin}
        onAccountClick={() => navigate({ page: 'account' })}
        onAdminClick={() => navigate({ page: 'admin' })}
        onLoginClick={openSignin} onSignupClick={openSignup} onLogout={handleLogout}
        onHelp={() => setHelpOpen(true)} onReorder={() => navigate({ page: 'account' })}
      />

      <main className="container">
        {route.page === 'home' && <HomePage {...shared} />}
        {route.page === 'product' && <ProductPage productId={route.productId} {...shared} />}
        {route.page === 'category' && <CategoryPage category={route.category} sub={route.sub} {...shared} />}
        {route.page === 'quote' && (
          <QuotePage items={cartItems} total={cartTotal} addLine={addLine} decLine={decLine} removeLine={removeLine}
                     clearCart={clearCart} goHome={goHome} goProduct={goProduct} profile={profile}
                     isApprovedBuyer={isApprovedBuyer} isBackendConfigured={isBackendConfigured} />
        )}
        {route.page === 'account' && (
          <AccountPage profile={profile} goHome={goHome} onSignIn={openSignin} products={products}
                       addLines={addLines} onOpenCart={() => setCartOpen(true)} isApprovedBuyer={isApprovedBuyer} />
        )}
        {route.page === 'admin' && <AdminPage profile={profile} goHome={goHome} />}
      </main>

      <Footer goHome={goHome} goCategory={goCategory} departments={departments} onLoginClick={openSignin} onApplyClick={openSignup}
              onNewArrivals={() => goHomeSection('new-arrivals')} onBestsellers={() => goHomeSection('bestsellers')} />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cartItems} total={cartTotal}
                  addLine={addLine} decLine={decLine} removeLine={removeLine} goQuote={goQuote} goProduct={goProduct}
                  isApprovedBuyer={isApprovedBuyer} onLoginClick={openCartSignin} />
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} onApply={() => { setHelpOpen(false); openSignup(); }} />}
      {loginOpen && <AuthModal open initialMode={loginMode} onClose={() => setLoginOpen(false)} />}
    </div>
  );
}

// =============================================================================
// AGE GATE
// =============================================================================
function AgeGate({ onYes, onNo, tooYoung }) {
  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="inner fade-in">
        <div className="brand"><span>Alabama</span><small>WHOLESALE INC.</small></div>
        {!tooYoung ? (
          <>
            <h1 id="age-gate-title">Are you <em>21 or older?</em></h1>
            <p>This site lists tobacco and vapor products for licensed retail businesses. Access is restricted to trade accounts and adults 21 years or older.</p>
            <div className="btn-row">
              <button className="button" onClick={onYes}>Yes, I am 21+ <span aria-hidden="true">↗</span></button>
              <button className="button ghost" onClick={onNo}>No, exit</button>
            </div>
          </>
        ) : (
          <>
            <h1>We're sorry —</h1>
            <p>You must be 21 years or older to enter this site.</p>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// HEADER
// =============================================================================
function Header({ cartCount, onCart, goHome, goCategory, goProduct, products, departments, onNewArrivals, onBestsellers, user, isAdmin, onAccountClick, onAdminClick, onLoginClick, onSignupClick, onLogout, onHelp, onReorder }) {
  const [megaOpen, setMegaOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setMegaOpen(false); setResultsOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const onDoc = (e) => {
      if (!e.target.closest('.aw-navigation')) setMegaOpen(false);
      if (!e.target.closest('.aw-search')) setResultsOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const hits = useMemo(() => getSearchMatches(products, query), [products, query]);
  const runNav = (action) => {
    setMegaOpen(false);
    setResultsOpen(false);
    action();
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
                <p>{hits.length ? `${hits.length} result${hits.length > 1 ? 's' : ''}` : 'No matches'}</p>
                <button type="button" aria-label="Close search results" onClick={() => setResultsOpen(false)}>×</button>
              </div>
              <div className="aw-search-list">
                {hits.length === 0 && <p>Try a brand (Geekbar, Backwoods, BIC) or a line ("energy drinks", "wraps").</p>}
                {hits.map(p => (
                  <button key={p.id} type="button" onClick={() => pickResult(p.id)}>
                    <span className="sr-thumb">{p.img ? <img src={p.img} alt="" loading="lazy" /> : initials(p.name)}</span>
                    <span><strong>{p.name}</strong><small>{catLabel(p.cat)} · {p.sub} · {p.sku}</small></span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
        <div className="aw-account-actions">
          {user ? (
            <>
              <button className="aw-signin" type="button" onClick={() => runNav(onAccountClick)}>{user.business || user.name || 'My Account'}</button>
              {isAdmin && <button className="aw-signin" type="button" onClick={() => runNav(onAdminClick)}>Admin</button>}
              <span className="aw-account-or">·</span>
              <button className="aw-signin" type="button" onClick={() => runNav(onLogout)}>Sign Out</button>
            </>
          ) : (
            <>
              <button className="aw-signin" type="button" onClick={() => runNav(onLoginClick)}>Sign In</button>
              <span className="aw-account-or">or</span>
              <button className="aw-signup" type="button" onClick={() => runNav(onSignupClick)}>Sign Up <span aria-hidden="true">↗</span></button>
            </>
          )}
          <button className="aw-cart-btn" type="button" onClick={() => runNav(onCart)} aria-label={`Cart, ${cartCount} items`}>
            Cart
            {cartCount > 0 && <span className="aw-cart-count">{cartCount}</span>}
          </button>
        </div>
      </div>

      <div className="aw-navigation">
        <button className="aw-category-toggle" type="button" aria-expanded={megaOpen} aria-controls="aw-mega-menu"
                onClick={() => { setResultsOpen(false); setMegaOpen(o => !o); }}>
          <span className="grid-symbol" aria-hidden="true">⊞</span>Categories <span className="aw-chevron" aria-hidden="true">⌄</span>
        </button>
        {megaOpen && (
          <section className="aw-mega-menu" id="aw-mega-menu" aria-labelledby="aw-menu-heading">
            <div className="aw-menu-heading">
              <div><p className="eyebrow">WHOLESALE CATALOG</p><h2 id="aw-menu-heading">Browse by department.</h2></div>
              <button className="aw-menu-close" type="button" aria-label="Close categories" onClick={() => setMegaOpen(false)}>×</button>
            </div>
            <div className="aw-menu-grid">
              {departments.map((c, i) => (
                <nav className="aw-department" key={c.key} aria-label={c.label}>
                  <h3><span>{String(i + 1).padStart(2, '0')}</span>{c.label}</h3>
                  {c.subs.slice(0, 3).map(s => (
                    <button key={s} type="button" onClick={() => pickCategory(c.key, s)}>{s}</button>
                  ))}
                  <button type="button" style={{ fontWeight: 700, color: 'var(--purple)' }} onClick={() => pickCategory(c.key, null)}>All {c.label} →</button>
                </nav>
              ))}
              <button className="aw-menu-feature" type="button" onClick={() => pickCategory('NOVELTIES', null)}>
                <div><p className="eyebrow">FEATURED</p><h3>Exotics &amp;<br />novelties.</h3><span>Explore the department <b aria-hidden="true">↗</b></span></div>
              </button>
            </div>
            <div className="aw-menu-footer">
              <button type="button" onClick={() => pickCategory(NAV_ORDER[0], null)}>View full catalog <span aria-hidden="true">↗</span></button>
              <span>{departments.length} departments · {products.length} SKUs</span>
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

// =============================================================================
// HOME
// =============================================================================
function HeroCarousel({ slides }) {
  const media = slides.filter(slide => slide.img || slide.videoUrl);
  const count = media.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const videoRef = useRef(null);
  const safeIndex = count ? index % count : 0;
  const active = media[safeIndex];

  const go = (delta) => setIndex(i => (i + delta + count) % count);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !active?.videoUrl) return undefined;
    if (paused) {
      video.pause();
      return undefined;
    }
    const play = video.play();
    if (play?.catch) play.catch(() => {});
    const onEnded = () => setIndex(i => (i + 1) % count);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('ended', onEnded);
      video.pause();
    };
  }, [active, paused, count]);

  useEffect(() => {
    if (paused || count < 2 || active?.videoUrl) return undefined;
    const id = window.setInterval(() => setIndex(i => (i + 1) % count), 4500);
    return () => window.clearInterval(id);
  }, [paused, count, active]);

  if (!active) return null;

  return (
    <section className="home-carousel" aria-roledescription="carousel" aria-label="Featured photos and videos">
      <div className="home-carousel-stage">
        {/* Photos render at their own pixel size (never enlarged). The first slide is
            the page's largest image, so it loads eagerly at high priority. */}
        {media.map((slide, i) => {
          const isActive = i === safeIndex;
          return (
            <div key={`${slide.img || ''}-${slide.videoUrl || i}`} className={`home-carousel-slide${isActive ? ' is-active' : ''}`} aria-hidden={!isActive}>
              {slide.videoUrl ? (
                <video
                  ref={isActive ? videoRef : null}
                  src={isActive ? slide.videoUrl : undefined}
                  poster={slide.img || undefined}
                  muted
                  playsInline
                  preload="metadata"
                  aria-label={slide.title || 'Featured video'}
                />
              ) : slide.picture ? (
                <Picture picture={slide.picture} alt={isActive ? (slide.title || '') : ''}
                         sizes={`(max-width: 600px) 100vw, ${slide.picture.width || 720}px`}
                         priority={i === 0} loading={i === 0 ? 'eager' : 'lazy'} />
              ) : (
                <img src={slide.img} alt={isActive ? (slide.title || '') : ''} />
              )}
            </div>
          );
        })}
      </div>
      <div className="home-carousel-controls">
        <p aria-live="polite">Slide {safeIndex + 1} of {count}</p>
        <button type="button" onClick={() => go(-1)} aria-label="Previous slide">Previous</button>
        <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Play' : 'Pause'}</button>
        <button type="button" onClick={() => go(1)} aria-label="Next slide">Next</button>
      </div>
    </section>
  );
}

const EDITORIAL_BG = heroImage('hero_candy.jpg');

function HomePage(props) {
  const { goCategory, goProduct, products, departments } = props;
  const newArrivals = NEW_ARRIVALS_IDS.map(id => products.find(p => Number(p.id) === id)).filter(Boolean).slice(0, 8);
  const bestsellers = products.filter(p => p.tag === 'BESTSELLER').slice(0, 8);

  return (
    <>
      <HeroCarousel slides={HERO_SLIDES} />

      <section className="section" id="new-arrivals">
        <div className="section-head">
          <div><p className="eyebrow">FRESH INVENTORY / 01</p><h2>New arrivals</h2></div>
          <button type="button" onClick={() => goCategory('NOVELTIES')}>Shop novelties <span aria-hidden="true">↗</span></button>
        </div>
        <div className="card-grid">
          {newArrivals.map(p => <ProductCard key={p.id} p={p} {...props} />)}
        </div>
      </section>

      <section className="editorials" aria-label="Collections">
        <button className="editorial-card cream" type="button" onClick={() => goCategory('NOVELTIES')}>
          <Picture className="bg" picture={EDITORIAL_BG.picture} alt="" aria-hidden="true" sizes={SIZES.editorial} />
          <span className="block-label">COLLECTION / 01</span>
          <div><p className="eyebrow">EXOTICS &amp; NOVELTIES</p><h2>Disposables, detox,<br />kratom &amp; more.</h2><span className="text-link">Browse novelties</span><span className="arrow" aria-hidden="true">↗</span></div>
        </button>
        <button className="editorial-card purple" type="button" onClick={() => goCategory('TOBACCO')}>
          <span className="block-label">COLLECTION / 02</span>
          <div><p className="eyebrow">THE CORE BUSINESS</p><h2>Tobacco, wraps<br />&amp; accessories.</h2><span className="text-link">Browse tobacco</span><span className="arrow" aria-hidden="true">↗</span></div>
        </button>
      </section>

      <section className="section" id="bestsellers">
        <div className="section-head">
          <div><p className="eyebrow">PROVEN MOVERS / 02</p><h2>Bestsellers</h2></div>
          <button type="button" onClick={() => goCategory('TOBACCO')}>Shop tobacco <span aria-hidden="true">↗</span></button>
        </div>
        <div className="card-grid">
          {bestsellers.map(p => <ProductCard key={p.id} p={p} {...props} />)}
        </div>
      </section>

      <section className="services" aria-label="Services">
        <div className="service"><span>01</span><h3>Next-day delivery, our own trucks</h3><p>We run our own delivery service on routes in Alabama, Mississippi and Georgia. Free delivery on orders over $1,500 when the stop is on a delivery route. Same-day will-call pickup if you order by 11 AM.</p></div>
        <div className="service"><span>02</span><h3>Net-30 trade terms</h3><p>Approved retail accounts order now and pay on Net-30 terms. Volume discounts up to 18% on pallet quantities across all eight departments.</p></div>
        <div className="service"><span>03</span><h3>Licensed businesses only</h3><p>We verify your state retail tobacco license and resale certificate before your first order. No consumer sales, no exceptions — 21+ trade accounts only.</p></div>
      </section>

      <section className="section" id="catalog">
        <div className="section-head"><div><p className="eyebrow">FULL ASSORTMENT / 03</p><h2>Shop by department</h2></div></div>
        <div className="card-grid">
          {departments.map(c => {
            const preview = products.find(p => p.cat === c.key && p.img);
            return (
              <button className="content-card" key={c.key} type="button" onClick={() => goCategory(c.key)}>
                <div className="card-block">
                  <span className="block-label">DEPARTMENT</span>
                  {preview?.picture ? <Picture picture={preview.picture} alt="" sizes={SIZES.card} /> : <span className="card-initials">{String(c.count).padStart(2, '0')}</span>}
                </div>
                <p className="card-kicker">{c.subs.length} PRODUCT LINES · {c.count} SKUs</p>
                <h3>{c.label}</h3>
                <p className="card-detail">{c.subs.slice(0, 3).join(' · ')}</p>
                <span className="card-meta"><span>Browse department</span><span aria-hidden="true">↗</span></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section" id="apply">
        <div className="apply-panel">
          <div className="apply-intro">
            <p className="eyebrow">OPEN AN ACCOUNT / 04</p>
            <h2>Become a retail account</h2>
            <button className="button" type="button" onClick={props.onApplyClick}>Start application <span aria-hidden="true">↗</span></button>
          </div>
          <ol className="apply-steps">
            <li>
              <h3>Apply online</h3>
              <p>Tell us about your store — business name, EIN, state retail tobacco license number and resale certificate. Takes about five minutes.</p>
            </li>
            <li>
              <h3>We verify</h3>
              <p>Our team checks your license with the state and approves most accounts within one business day. You'll get price-list access by email.</p>
            </li>
            <li>
              <h3>Order &amp; receive</h3>
              <p>Order online or by phone before 2 PM for next-day delivery on our trucks when the stop is on a delivery route, or same-day will-call at the Birmingham warehouse.</p>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}

// =============================================================================
// PRODUCT CARD
// =============================================================================
function ProductCard({ p, profile, isApprovedBuyer, cart, addLine, decLine, goProduct, onLoginClick }) {
  const variants = variantList(p);
  const choiceRequired = requiresVariantChoice(p);
  const onlyVariant = variants.length === 1 ? variants[0] : null;
  const key = lineKey(p.id, onlyVariant);
  const qty = choiceRequired
    ? Object.entries(cart).reduce((sum, [k, q]) => (Number(String(k).split('::')[0]) === Number(p.id) ? sum + Number(q) : sum), 0)
    : (Number(cart[key]) || 0);
  const price = priceForProfile(p.price, profile);
  return (
    <article className="content-card">
      <button type="button" onClick={() => goProduct(p.id)} style={{ all: 'unset', cursor: 'pointer', display: 'block' }} aria-label={`${p.name} details`}>
        <div className="card-block">
          <span className="block-label">{p.cat}</span>
          {p.tag && <span className={`card-tag ${p.tag === 'NEW' ? 'new' : ''}`}>{p.tag}</span>}
          {p.picture ? <Picture picture={p.picture} alt={p.name} sizes={SIZES.card} /> : <span className="card-initials" aria-hidden="true">{initials(p.name)}</span>}
        </div>
        <p className="card-kicker">{p.sub}</p>
        <h3>{p.name}</h3>
        <p className="card-detail">{p.brand}{p.flavors ? ` · ${p.flavors} variants` : ''} · {p.sku}</p>
      </button>
      <span className="card-meta">
        {isApprovedBuyer && price != null ? (
          <span>{money(price)}</span>
        ) : profile ? (
          <span className="lock">Pricing after approval</span>
        ) : (
          <button className="lock price-login" type="button" onClick={onLoginClick}>LOCKED · Sign in for pricing</button>
        )}
        {choiceRequired ? (
          <button className="card-add" type="button" onClick={() => goProduct(p.id)}>{qty > 0 ? `Choose · ${qty}` : 'Choose'}</button>
        ) : qty > 0 ? (
          <span className="card-stepper" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => decLine(key)} aria-label="Decrease quantity">−</button>
            <b>{qty}</b>
            <button type="button" onClick={() => addLine(p.id, onlyVariant)} aria-label="Increase quantity">+</button>
          </span>
        ) : (
          <button className="card-add" type="button" onClick={() => addLine(p.id, onlyVariant)}>{isApprovedBuyer ? 'ADD +' : 'QUOTE +'}</button>
        )}
      </span>
    </article>
  );
}

// =============================================================================
// CATEGORY PAGE
// =============================================================================
function CategoryPage({ category, sub, ...props }) {
  const [tagFilter, setTagFilter] = useState([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [sort, setSort] = useState('featured');

  useEffect(() => {
    setTagFilter([]);
    setHasVariants(false);
    setSearchQ('');
    setSort('featured');
  }, [category]);

  const cat = props.departments.find(c => c.key === category);
  const inCategory = props.products.filter(p => p.cat === category);
  const activeSub = sub || null;
  const tagOptions = [
    ['Bestsellers', 'BESTSELLER'],
    ['New', 'NEW'],
    ['Deals', 'DEAL'],
    ['Premium', 'PREMIUM'],
  ];
  const query = searchQ.trim().toLowerCase();
  let items = inCategory.filter(p => {
    if (activeSub && p.sub !== activeSub) return false;
    if (tagFilter.length && !tagFilter.includes(p.tag)) return false;
    if (hasVariants && p.flavors === 0) return false;
    if (query && !productText(p).includes(query)) return false;
    return true;
  });
  if (sort === 'name-asc') items = [...items].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name-desc') items = [...items].sort((a, b) => b.name.localeCompare(a.name));
  if (sort === 'variants') items = [...items].sort((a, b) => b.flavors - a.flavors);
  if (sort === 'price-low' && props.isApprovedBuyer) items = [...items].sort((a, b) => a.price - b.price);
  if (sort === 'price-high' && props.isApprovedBuyer) items = [...items].sort((a, b) => b.price - a.price);

  const toggleTag = (tag) => setTagFilter(current => current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]);
  const clearFilters = () => {
    setTagFilter([]);
    setHasVariants(false);
    setSearchQ('');
    props.goCategory(category, null);
  };
  const activeFilterCount = (activeSub ? 1 : 0) + tagFilter.length + (hasVariants ? 1 : 0) + (query ? 1 : 0);

  if (!cat) {
    return (
      <section className="page-head">
        <h1>Department not found</h1>
        <p>That department doesn't exist. <button className="text-link" onClick={props.goHome}>Back to home</button></p>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head">
        <div className="crumbs">
          <button type="button" onClick={props.goHome}>Home</button><span aria-hidden="true">/</span><span>{catLabel(category)}</span>
          {activeSub && <><span aria-hidden="true">/</span><span>{activeSub}</span></>}
        </div>
        <p className="eyebrow">DEPARTMENT · {String(cat.count).padStart(2, '0')} SKUs</p>
        <h1>{catLabel(category)}</h1>
        <p>Wholesale {catLabel(category).toLowerCase()} for licensed retail accounts. {props.isApprovedBuyer ? 'Your tier pricing is shown on each card.' : props.profile ? 'Pricing unlocks after your account is approved.' : 'Sign in to see your wholesale pricing.'}</p>
        <div className="sub-pills" aria-label={`${catLabel(category)} subcategories`}>
          <button className={`sub-pill ${!activeSub ? 'active' : ''}`} type="button" onClick={() => props.goCategory(category, null)}>All ({cat.count})</button>
          {cat.subs.map(s => {
            const count = inCategory.filter(p => p.sub === s).length;
            return <button key={s} className={`sub-pill ${activeSub === s ? 'active' : ''}`} type="button" onClick={() => props.goCategory(category, s)}>{s} ({count})</button>;
          })}
        </div>
      </div>

      <div className="category-toolbar">
        <p className="result-note">Showing <strong>{items.length}</strong> of {inCategory.length} item{inCategory.length === 1 ? '' : 's'}{activeSub ? ` in ${activeSub}` : ''}</p>
        <label className="category-sort">Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="featured">Featured</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="name-desc">Name: Z to A</option>
            <option value="variants">Most variants</option>
            {props.isApprovedBuyer && <option value="price-low">Price: Low to High</option>}
            {props.isApprovedBuyer && <option value="price-high">Price: High to Low</option>}
          </select>
        </label>
      </div>

      <div className="catalog-layout">
        <aside className="category-filters" aria-label="Product filters">
          <div className="filter-heading">
            <h2>Filters</h2>
            {activeFilterCount > 0 && <button className="text-link" type="button" onClick={clearFilters}>Clear all ({activeFilterCount})</button>}
          </div>
          <label className="filter-search">Search in {catLabel(category)}
            <input type="search" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Item, brand, SKU, variant…" />
          </label>
          <fieldset>
            <legend>Featured</legend>
            {tagOptions.map(([label, tag]) => (
              <label key={tag}><input type="checkbox" checked={tagFilter.includes(tag)} onChange={() => toggleTag(tag)} /> <span>{label}</span></label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Variants</legend>
            <label><input type="checkbox" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} /> <span>Has flavors or variants</span></label>
          </fieldset>
          {!props.profile && <button className="filter-signin" type="button" onClick={props.onLoginClick}><b>Wholesale pricing is locked</b><span>Sign in to see your account pricing.</span></button>}
          {props.profile && !props.isApprovedBuyer && <p className="filter-signin"><b>Pricing after approval</b><span>Your account is not approved for trade pricing yet.</span></p>}
        </aside>

        <div>
          {items.length > 0 ? (
            <div className="card-grid category-card-grid">
              {items.map(p => <ProductCard key={p.id} p={p} {...props} />)}
            </div>
          ) : (
            <div className="empty-results">
              <h2>No products match</h2>
              <p>Try another search or clear the current filters.</p>
              <button className="button ghost" type="button" onClick={clearFilters}>Clear filters</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// PRODUCT PAGE
// =============================================================================
function ProductPage({ productId, profile, isApprovedBuyer, cart, addLine, decLine, products, goProduct, goHome, goCategory, onLoginClick, onApplyClick, onAccountClick }) {
  const [desiredQty, setDesiredQty] = useState(1);
  const [chosenVariant, setChosenVariant] = useState(null);
  const [variantError, setVariantError] = useState(false);
  useEffect(() => {
    setDesiredQty(1);
    setChosenVariant(null);
    setVariantError(false);
  }, [productId]);
  const p = products.find(x => Number(x.id) === Number(productId));
  if (!p) {
    return (
      <section className="page-head">
        <h1>Product not found</h1>
        <p><button className="text-link" onClick={goHome}>Back to home</button></p>
      </section>
    );
  }
  const variants = variantList(p);
  const choiceRequired = requiresVariantChoice(p);
  const selected = choiceRequired ? chosenVariant : (variants.length === 1 ? variants[0] : null);
  const key = lineKey(p.id, selected);
  const qty = cart[key] || 0;
  const related = products.filter(x => x.sub === p.sub && Number(x.id) !== Number(p.id)).slice(0, 4);
  const price = priceForProfile(p.price, profile);
  const handleAdd = () => {
    if (choiceRequired && !chosenVariant) {
      setVariantError(true);
      return;
    }
    addLine(p.id, selected, desiredQty);
    setDesiredQty(1);
  };

  return (
    <section>
      <div className="page-head" style={{ paddingBottom: 0 }}>
        <div className="crumbs">
          <button type="button" onClick={goHome}>Home</button><span aria-hidden="true">/</span>
          <button type="button" onClick={() => goCategory(p.cat)}>{catLabel(p.cat)}</button><span aria-hidden="true">/</span>
          <span>{p.name}</span>
        </div>
      </div>
      <div className="pd-grid">
        <div className="pd-media">
          {p.tag && <span className={`card-tag ${p.tag === 'NEW' ? 'new' : ''}`}>{p.tag}</span>}
          {p.picture ? <Picture picture={p.picture} alt={p.name} sizes={SIZES.detail} priority /> : <span className="card-initials" aria-hidden="true">{initials(p.name)}</span>}
        </div>
        <div className="pd-info">
          <p className="pd-brand">{p.brand} · {p.sub}</p>
          <h1>{p.name}</h1>
          <p className="pd-desc">{p.description || `Wholesale ${p.sub.toLowerCase()} from ${p.brand}.`}</p>
          {p.sellUnit && <p className="pd-unit">Sold by the {p.sellUnit} — quantity 1 is one {p.sellUnit}.</p>}
          <p className="pd-desc pd-fine">SKU {p.sku}. Supplied to licensed retail businesses for lawful resale — order by 2 PM Central for next-day delivery on our trucks when the stop is on a delivery route in AL, MS and GA.</p>
          {variants.length > 0 && (
            <div className="variant-chips" role="group" aria-label={choiceRequired ? 'Choose a variant' : 'Variant'}>
              {variants.map(v => (
                <button key={v} type="button" aria-pressed={selected === v} onClick={() => { setChosenVariant(v); setVariantError(false); }}>{v}</button>
              ))}
            </div>
          )}
          {choiceRequired && <p className="in-cart-note">Choose one variant. Each variant is quoted on its own line.</p>}
          {variantError && <p className="form-error">Select a variant before adding this product.</p>}
          <div className="pd-price">
            {isApprovedBuyer && price != null
              ? <><b>{money(price)}</b><span>Wholesale unit price · {variantSku(p.sku, selected)}</span></>
              : profile
              ? <><b>Pending</b><span>Pricing unlocks after your account is approved</span></>
              : <><b>Sign in</b><span>Wholesale pricing is visible to approved trade accounts</span></>}
          </div>
          <div className="qty-row">
            <div className="qty-stepper" aria-label="Quantity to add">
              <button type="button" onClick={() => setDesiredQty(q => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
              <b>{desiredQty}</b>
              <button type="button" onClick={() => setDesiredQty(q => q + 1)} aria-label="Increase quantity">+</button>
            </div>
            <button className="button" type="button" onClick={handleAdd} disabled={choiceRequired && !chosenVariant}>{isApprovedBuyer ? 'Add to order' : 'Add to quote'} <span aria-hidden="true">↗</span></button>
          </div>
          {qty > 0 && <p className="in-cart-note">Already in {isApprovedBuyer ? 'order' : 'quote'}: <strong>{qty}</strong>{selected ? ` · ${selected}` : ''}</p>}
          {!profile && (
            <div className="dialog-actions compact-actions">
              <button className="text-link" type="button" onClick={onLoginClick}>Sign in for pricing</button>
              <button className="text-link" type="button" onClick={onApplyClick}>Apply for account</button>
            </div>
          )}
          {profile && !isApprovedBuyer && (
            <div className="dialog-actions compact-actions">
              <button className="text-link" type="button" onClick={onAccountClick}>View approval status</button>
            </div>
          )}
        </div>
      </div>
      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div><p className="eyebrow">SAME LINE</p><h2>More {p.sub.toLowerCase()}</h2></div>
            <button type="button" onClick={() => goCategory(p.cat)}>View department <span aria-hidden="true">↗</span></button>
          </div>
          <div className="card-grid">
            {related.map(r => <ProductCard key={r.id} p={r} profile={profile} isApprovedBuyer={isApprovedBuyer} cart={cart} addLine={addLine} decLine={decLine} goProduct={goProduct} onLoginClick={onLoginClick} />)}
          </div>
        </section>
      )}
    </section>
  );
}

// =============================================================================
// QUOTE / CHECKOUT — saved only by submit_quote, which prices the lines
// =============================================================================
function TradeDeskContact({ before, after }) {
  return (
    <>
      {before} <a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a> or email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>{after}
    </>
  );
}

function QuotePage({ items, total, addLine, decLine, removeLine, clearCart, goHome, goProduct, profile, isApprovedBuyer, isBackendConfigured }) {
  const [step, setStep] = useState('review');
  const [data, setData] = useState({
    business: profile?.business || '', contact: profile?.name || '', email: profile?.email || '', phone: '',
    notes: '', delivery: 'delivery', preferredDate: '',
    shipStreet: '', shipCity: '', shipState: '', shipZip: '',
  });
  const set = k => e => setData({ ...data, [k]: e.target.value });
  const [refNum] = useState(`ALW-Q-${Math.floor(Math.random() * 90000) + 10000}`);
  const [receipt, setReceipt] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [sending, setSending] = useState(false);
  const totalUnits = items.reduce((s, i) => s + i.qty, 0);
  const needsVariant = items.some(it => it.needsVariant);

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    if (!isBackendConfigured) {
      setSubmitError({ before: 'Quote requests can’t be saved right now. Call', after: ' and the trade desk will write it up with you.' });
      return;
    }
    if (needsVariant) {
      setSubmitError('Choose a variant for every product that has more than one.');
      return;
    }
    setSending(true);
    setSubmitError(null);
    try {
      const r = await submitOrder({ refNum, formData: data, items });
      if (!r?.ok || !r.order?.id) throw new Error('The quote was not saved.');
      setReceipt(r.order);
      setStep('submitted');
      window.scrollTo(0, 0);
    } catch (err) {
      setSubmitError(err?.code === 'unavailable'
        ? { before: 'Quote requests can’t be saved right now. Call', after: ' and the trade desk will write it up with you.' }
        : { before: 'We couldn’t save this quote. Please call', after: ` and reference ${refNum}.` });
    } finally { setSending(false); }
  };

  if (items.length === 0 && step === 'review') {
    return (
      <section className="page-head" style={{ textAlign: 'center', padding: '60px 0' }}>
        <h1>Your cart is empty</h1>
        <p style={{ margin: '0 auto 20px' }}>Add products, then come back to checkout.</p>
        <button className="button" onClick={goHome}>Browse catalog <span aria-hidden="true">↗</span></button>
      </section>
    );
  }

  if (step === 'submitted') {
    return (
      <section className="page-head" style={{ textAlign: 'center', padding: '60px 0' }}>
        <p className="eyebrow">{isApprovedBuyer ? 'ORDER RECEIVED' : 'QUOTE RECEIVED'}</p>
        <h1>Thank you, {data.contact || 'partner'}.</h1>
        <p style={{ margin: '0 auto 14px' }}>
          {isApprovedBuyer ? 'Your order has been saved.' : 'Your quote request has been saved.'} A trade desk rep will reach out within one business day at <strong style={{ color: 'var(--purple)' }}>{data.phone || data.email}</strong> to confirm details.
        </p>
        <p className="result-note" style={{ fontSize: 13 }}>Reference number: <strong>{receipt?.ref_num || refNum}</strong></p>
        <div className="dialog-actions" style={{ justifyContent: 'center' }}>
          <a className="button ghost" href={`tel:${COMPANY.phoneRaw}`}>Call to discuss</a>
          <button className="button" onClick={() => { clearCart(); goHome(); }}>Back to home <span aria-hidden="true">↗</span></button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head">
        <div className="crumbs"><button type="button" onClick={goHome}>Home</button><span aria-hidden="true">/</span><span>{isApprovedBuyer ? 'Checkout' : 'Request Quote'}</span></div>
        <p className="eyebrow">{isApprovedBuyer ? 'CHECKOUT' : 'QUOTE REQUEST'}</p>
        <h1>{isApprovedBuyer ? 'Place your order' : 'Request your quote'}</h1>
        <p>Review your items and submit. A trade desk rep will confirm pricing, availability, freight, and delivery within one business day.</p>
      </div>
      <div className="checkout-grid">
        <div>
          <div className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
            {items.map(it => (
              <div key={it.lineKey} className="drawer-line" style={{ border: '1px solid var(--line)', padding: 12 }}>
                <span className="thumb">{it.img ? <img src={it.img} alt="" /> : initials(it.name)}</span>
                <span className="info">
                  <b>{it.name}</b>
                  <small>{it.sku}{isApprovedBuyer && it.price != null ? ` · ${money(it.price)} each` : ''}</small>
                  {it.needsVariant && <small>Choose a variant before submitting.</small>}
                </span>
                {it.needsVariant ? (
                  <button className="text-link" type="button" onClick={() => goProduct(it.productId)}>Choose variant</button>
                ) : (
                  <span className="qty">
                    <button type="button" onClick={() => decLine(it.lineKey)} aria-label="Decrease">−</button>
                    <b>{it.qty}</b>
                    <button type="button" onClick={() => addLine(it.productId, it.variant)} aria-label="Increase">+</button>
                  </span>
                )}
                {isApprovedBuyer && it.price != null && <b style={{ color: 'var(--purple)', minWidth: 64, textAlign: 'right' }}>{money(it.qty * it.price)}</b>}
                <button className="text-link" type="button" onClick={() => removeLine(it.lineKey)}>Remove</button>
              </div>
            ))}
          </div>
          <button className="text-link" style={{ marginTop: 14 }} type="button" onClick={clearCart}>Clear all items</button>
        </div>
        <form onSubmit={handleQuoteSubmit}>
          <div className="form-grid" style={{ marginTop: 0 }}>
            <div><label>Business</label><input value={data.business} onChange={set('business')} required /></div>
            <div><label>Contact</label><input value={data.contact} onChange={set('contact')} required /></div>
            <div><label>Email</label><input type="email" value={data.email} onChange={set('email')} required /></div>
            <div><label>Phone</label><input type="tel" value={data.phone} onChange={set('phone')} required /></div>
            <div className="full"><label htmlFor="ship-street">Ship-to street</label><input id="ship-street" value={data.shipStreet} onChange={set('shipStreet')} required autoComplete="street-address" /></div>
            <div><label htmlFor="ship-city">City</label><input id="ship-city" value={data.shipCity} onChange={set('shipCity')} required autoComplete="address-level2" /></div>
            <div><label htmlFor="ship-state">State</label><input id="ship-state" value={data.shipState} onChange={set('shipState')} required autoComplete="address-level1" /></div>
            <div><label htmlFor="ship-zip">ZIP</label><input id="ship-zip" value={data.shipZip} onChange={set('shipZip')} required autoComplete="postal-code" inputMode="numeric" /></div>
            <div><label>Delivery method</label>
              <select value={data.delivery} onChange={set('delivery')}>
                <option value="delivery">Next-day delivery (on route)</option>
                <option value="willcall">Same-day will-call</option>
              </select>
            </div>
            <div><label>Preferred date</label><input type="date" value={data.preferredDate} onChange={set('preferredDate')} /></div>
            <div className="full"><label>Notes</label><input value={data.notes} onChange={set('notes')} placeholder="Dock hours, pallet needs, substitutions…" /></div>
          </div>
          <div className="drawer-total" style={{ marginTop: 18 }}>
            <span>{totalUnits} units</span>
            <span>{isApprovedBuyer ? money(total) : (profile ? 'Pricing after approval' : 'Pricing after sign-in')}</span>
          </div>
          {!isBackendConfigured && <p className="form-error"><TradeDeskContact before="Quote requests can’t be saved right now. Call" after=" and the trade desk will write it up with you." /></p>}
          {needsVariant && <p className="form-error">Choose a variant for every product that has more than one.</p>}
          {submitError && <p className="form-error">{typeof submitError === 'string' ? submitError : <TradeDeskContact before={submitError.before} after={submitError.after} />}</p>}
          <button className="button wide" type="submit" disabled={sending || !isBackendConfigured || needsVariant}>
            {sending ? 'Sending…' : (isApprovedBuyer ? 'Submit order' : 'Submit quote request')} <span aria-hidden="true">↗</span></button>
          <p className="fine">Orders over $1,500 qualify for free delivery on a delivery route in AL, MS &amp; GA. Tobacco products supplied to licensed retailers only — 21+.</p>
        </form>
      </div>
    </section>
  );
}

// =============================================================================
// FOOTER / DIALOGS / DRAWER
// =============================================================================
function Footer({ goHome, goCategory, departments, onLoginClick, onApplyClick, onNewArrivals, onBestsellers }) {
  return (
    <footer className="footer-main">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <span>Alabama</span><small>WHOLESALE INC.</small>
            <p style={{ marginTop: 16 }}>Wholesale distributor of tobacco, vaping products, smoke-shop accessories, novelties, candy, beverages and general merchandise. Serving licensed retail stores — never consumers.</p>
          </div>
          <div>
            <h4>Departments</h4>
            {departments.map(c => <button key={c.key} type="button" onClick={() => goCategory(c.key)}>{c.label} ({c.count})</button>)}
          </div>
          <div>
            <h4>Account</h4>
            <button type="button" onClick={onApplyClick}>Apply for account</button>
            <button type="button" onClick={onLoginClick}>Sign in</button>
            <button type="button" onClick={onNewArrivals}>New arrivals</button>
            <button type="button" onClick={onBestsellers}>Bestsellers</button>
          </div>
          <div>
            <h4>Contact</h4>
            <p>{COMPANY.addressLine1}<br />{COMPANY.addressLine2}</p>
            <p><a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a><br /><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p>
            <p>{COMPANY.hoursLine1}<br />{COMPANY.hoursLine2}</p>
          </div>
        </div>
        <div className="footer-legal">
          <p>© 2026 Alabama Wholesale Inc. All rights reserved.</p>
          <p>Sales to licensed retail businesses only · 21+ · No consumer orders</p>
        </div>
      </div>
      <div className="fda-note">
        <div className="container">WARNING: Tobacco products sold by Alabama Wholesale Inc. contain nicotine. Nicotine is an addictive chemical. Products are distributed exclusively to licensed retail businesses for lawful resale. Not for sale to minors.</div>
      </div>
    </footer>
  );
}

function HelpDialog({ onClose, onApply }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog scale-in" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-top"><p className="eyebrow">ACCOUNT SERVICE</p><button className="dialog-close" onClick={onClose} aria-label="Close">×</button></div>
        <p className="kicker">WE ANSWER FAST</p>
        <h2 id="help-title">Talk to the warehouse</h2>
        <p className="desc">Real people, same building as the inventory. Call, email or stop by will-call.</p>
        <div className="form-grid">
          <div><label>Phone</label><p style={{ margin: 0 }}><a href={`tel:${COMPANY.phoneRaw}`}>{COMPANY.phone}</a></p></div>
          <div><label>Email</label><p style={{ margin: 0 }}><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></p></div>
          <div><label>Hours</label><p style={{ margin: 0 }}>{COMPANY.hoursLine1} · {COMPANY.hoursLine2}</p></div>
          <div><label>Will-call</label><p style={{ margin: 0 }}>{COMPANY.addressShort}</p></div>
        </div>
        <div className="dialog-actions">
          <a className="button" href={`tel:${COMPANY.phoneRaw}`}>Call now <span aria-hidden="true">↗</span></a>
          <button className="text-link" type="button" onClick={onApply}>Apply for an account</button>
        </div>
        <p className="fine">Ordering before 2 PM Central gets next-day delivery on our own trucks when the stop is on a delivery route in AL, MS and GA.</p>
      </div>
    </div>
  );
}

function CartDrawer({ open, onClose, items, total, addLine, decLine, removeLine, goQuote, goProduct, isApprovedBuyer, onLoginClick }) {
  if (!open) return null;
  return (
    <>
      <div className="overlay" style={{ background: '#170e2977' }} onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Cart">
        <div className="drawer-head">
          <h2>Your order</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close cart">×</button>
        </div>
        <div className="drawer-body">
          {items.length === 0 && <p className="empty-note">Your cart is empty.<br />Browse the catalog and add items to build an order.</p>}
          {items.map(it => (
            <div className="drawer-line" key={it.lineKey}>
              <span className="thumb">{it.img ? <img src={it.img} alt="" /> : initials(it.name)}</span>
              <span className="info">
                <b>{it.name}</b>
                <small>{it.sku}{isApprovedBuyer && it.price != null ? ` · ${money(it.price)}` : ''}{it.needsVariant ? ' · Choose a variant' : ''}</small>
              </span>
              {it.needsVariant ? (
                <button className="text-link" type="button" onClick={() => { onClose(); goProduct(it.productId); }}>Choose</button>
              ) : (
                <span className="qty">
                  <button type="button" onClick={() => decLine(it.lineKey)} aria-label="Decrease">−</button>
                  <b>{it.qty}</b>
                  <button type="button" onClick={() => addLine(it.productId, it.variant)} aria-label="Increase">+</button>
                </span>
              )}
              <button className="text-link" type="button" onClick={() => removeLine(it.lineKey)} aria-label={`Remove ${it.name}`}>×</button>
            </div>
          ))}
        </div>
        <div className="drawer-foot">
          <div className="drawer-total">
            <span>Estimated total</span>
            <span>{isApprovedBuyer ? money(total) : 'Sign in for pricing'}</span>
          </div>
          {items.length > 0 && (
            isApprovedBuyer
              ? <button className="button wide" type="button" onClick={goQuote}>Checkout <span aria-hidden="true">↗</span></button>
              : <>
                  <button className="button wide" type="button" onClick={goQuote}>Request quote <span aria-hidden="true">↗</span></button>
                  <button className="drawer-signin text-link" type="button" onClick={onLoginClick}>Sign in for account pricing</button>
                </>
          )}
          <p className="fine" style={{ borderTop: 0, marginTop: 12, paddingTop: 0 }}>Free delivery over $1,500 applies on a delivery route in AL, MS &amp; GA. Orders placed before 2 PM ship next-day on our trucks when the stop is on a route.</p>
        </div>
      </aside>
    </>
  );
}
