import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, ShoppingCart, Menu, X, Plus, Minus, ChevronDown, ChevronRight, ChevronLeft,
  Phone, MapPin, Clock, Mail, ArrowRight, Truck, Award, Users, Tag,
  Package, ShieldCheck, Star, Eye, Heart, Facebook, Instagram, Twitter
} from 'lucide-react';

import { IMG, C, body, display, mono } from './data/theme.js';
import {
  COMPANY, ANNOUNCEMENTS, SHOP_CATS, HERO_SLIDES, BRANDS, TRUST, FAQS,
  WELCOME_OFFERS, STORAGE, FREE_DELIVERY_THRESHOLD
} from './data/content.js';
import { PRODUCTS, NAV_ORDER, NAV_CATEGORIES, NEW_ARRIVALS_IDS } from './data/products.js';
import { useAuth } from './lib/useAuth.js';
import { submitOrder } from './lib/orders.js';
import { AuthModal } from './components/AuthModal.jsx';
import { AccountPage } from './pages/account/AccountPage.jsx';
import { AdminPage } from './pages/admin/AdminPage.jsx';

// Pricing tier → display discount. Mirrors the seed values in
// supabase/migrations/20260517000000_initial_schema.sql.
const TIER_DISCOUNT = { standard: 0, silver: 0.05, gold: 0.10 };
const priceForProfile = (listPrice, profile) => {
  const d = TIER_DISCOUNT[profile?.pricing_tier] || 0;
  return listPrice * (1 - d);
};

const safeReadJson = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const safeWriteJson = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures; the storefront should still work.
  }
};

const safeRemove = (key) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(key); } catch {}
};

// Posts to Netlify Forms. The matching <form name="..."> definitions live in
// index.html so Netlify's build-time HTML parser registers each form. Returns
// the fetch promise so callers can await/handle failure.
const submitNetlifyForm = (formName, data) => {
  const body = new URLSearchParams({ 'form-name': formName });
  Object.entries(data).forEach(([k, v]) => body.append(k, v == null ? '' : String(v)));
  return fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
};

const productText = (p) => `${p.name} ${p.brand} ${p.cat} ${p.sub} ${p.sku} ${(p.variants || []).join(' ')}`.toLowerCase();

const getSearchMatches = (query, limit = 8) => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return PRODUCTS
    .map(p => {
      const haystack = productText(p);
      const exactName = p.name.toLowerCase().includes(q) ? 80 : 0;
      const exactSku = p.sku.toLowerCase().includes(q) ? 70 : 0;
      const exactBrand = p.brand.toLowerCase().includes(q) ? 45 : 0;
      const exactCategory = p.cat.toLowerCase().includes(q) ? 24 : 0;
      const allTerms = terms.every(t => haystack.includes(t)) ? 30 : 0;
      const someTerms = terms.filter(t => haystack.includes(t)).length * 8;
      const score = exactName + exactSku + exactBrand + exactCategory + allTerms + someTerms;
      return { p, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map(x => x.p);
};


// =============================================================================
// ROOT — with router state
// =============================================================================
export default function App() {
  const [verified, setVerified] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(STORAGE.age) === 'yes');
  const [tooYoung, setTooYoung] = useState(false);
  const [cart, setCart] = useState(() => safeReadJson(STORAGE.cart, {}));
  const [cartOpen, setCartOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [annIdx, setAnnIdx] = useState(0);

  // Real auth via Supabase. `user` is kept in the legacy { name, email, business }
  // shape so downstream components don't have to change.
  const auth = useAuth();
  const { profile, signOut } = auth;
  const user = profile ? { id: profile.id, name: profile.name, email: profile.email, business: profile.business } : null;
  const isAdmin = profile?.role === 'admin';
  const [loginOpen, setLoginOpen] = useState(false);

  // WELCOME POPUP — shows on first visit
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Router — hash-based so users can bookmark, share, and use back/forward.
  // Routes: #/ , #/category/TOBACCO , #/product/61 , #/quote
  const parseHash = () => {
    if (typeof window === 'undefined') return { page: 'home' };
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (!hash) return { page: 'home' };
    const [section, ...rest] = hash.split('/');
    if (section === 'product' && rest[0]) return { page: 'product', productId: Number(decodeURIComponent(rest[0])) };
    if (section === 'category' && rest[0]) return { page: 'category', category: decodeURIComponent(rest[0]) };
    if (section === 'quote') return { page: 'quote' };
    if (section === 'account') return { page: 'account' };
    if (section === 'admin') return { page: 'admin' };
    return { page: 'home' };
  };
  const routeToHash = (r) => {
    if (r.page === 'product') return `#/product/${r.productId}`;
    if (r.page === 'category') return `#/category/${encodeURIComponent(r.category)}`;
    if (r.page === 'quote') return '#/quote';
    if (r.page === 'account') return '#/account';
    if (r.page === 'admin') return '#/admin';
    return '#/';
  };

  const [route, setRoute] = useState(parseHash);

  // Sync hash → state on back/forward.
  useEffect(() => {
    const onPop = () => setRoute(parseHash());
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  // Sync state → hash on programmatic navigation. pushState is set by the goX
  // helpers below; this effect just makes sure the URL matches on first paint
  // and on any setRoute calls that bypass the helpers (defensive).
  useEffect(() => {
    const desired = routeToHash(route);
    if (window.location.hash !== desired && `#${window.location.hash.slice(1)}` !== desired) {
      window.history.replaceState(null, '', desired);
    }
  }, [route]);

  // Per-route <title> and meta description so search and shares show context.
  useEffect(() => {
    const titles = {
      home: `${COMPANY.name} · Direct-From-Manufacturer Wholesale`,
      quote: `Request a Quote · ${COMPANY.name}`,
    };
    let title = titles[route.page] || titles.home;
    let desc;
    if (route.page === 'category') {
      title = `${route.category} · Wholesale Catalog · ${COMPANY.name}`;
      desc = `Browse ${route.category.toLowerCase()} wholesale SKUs from ${COMPANY.name}, Birmingham AL.`;
    } else if (route.page === 'product') {
      const p = PRODUCTS.find(x => x.id === route.productId);
      if (p) {
        title = `${p.name} · ${p.brand} · ${COMPANY.name}`;
        desc = `${p.name} — wholesale ${p.cat.toLowerCase()} SKU ${p.sku} from ${COMPANY.name}.`;
      }
    }
    document.title = title;
    if (desc) {
      let m = document.querySelector('meta[name="description"]');
      if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
      m.setAttribute('content', desc);
    }
  }, [route]);

  const navigate = (next) => {
    window.history.pushState(null, '', routeToHash(next));
    setRoute(next);
    setMegaOpen(false);
    setNavOpen(false);
    window.scrollTo(0, 0);
  };
  const goHome = () => navigate({ page: 'home' });
  const goProduct = (id) => navigate({ page: 'product', productId: id });
  const goCategory = (cat) => navigate({ page: 'category', category: cat });
  const goQuote = () => { setCartOpen(false); navigate({ page: 'quote' }); };
  const handleAgeYes = () => {
    setVerified(true);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE.age, 'yes');
  };

  // Fonts and global styles now live in index.html and src/index.css — no
  // runtime injection. Keeping this effect block minimal so React StrictMode's
  // double-invoke can't yank a stylesheet mid-render.

  useEffect(() => {
    const t = setInterval(() => setAnnIdx(i => (i + 1) % ANNOUNCEMENTS.length), 4500);
    return () => clearInterval(t);
  }, []);

  // Show welcome popup only once per browser, after age verification.
  useEffect(() => {
    if (!verified || typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE.welcome) === 'yes') return;
    window.localStorage.setItem(STORAGE.welcome, 'yes');
    const t = setTimeout(() => setWelcomeOpen(true), 800);
    return () => clearTimeout(t);
  }, [verified]);

  useEffect(() => {
    safeWriteJson(STORAGE.cart, cart);
  }, [cart]);

  useEffect(() => {
    if (user) safeWriteJson(STORAGE.user, user);
    else safeRemove(STORAGE.user);
  }, [user]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setCartOpen(false);
        setNavOpen(false);
        setMegaOpen(false);
        setLoginOpen(false);
        setWelcomeOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const locked = cartOpen || navOpen || loginOpen || welcomeOpen;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [cartOpen, navOpen, loginOpen, welcomeOpen]);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartItems = PRODUCTS.filter(p => cart[p.id]).map(p => ({
    ...p,
    qty: cart[p.id],
    // Apply per-tier discount for display + order persistence.
    price: priceForProfile(p.price, profile),
  }));
  const cartTotal = cartItems.reduce((s, i) => s + i.qty * (user ? i.price : 0), 0);
  const addToCart = (id, n = 1) => setCart(c => ({ ...c, [id]: (c[id] || 0) + n }));
  const decCart = (id) => setCart(c => {
    const next = { ...c }; const v = (next[id] || 0) - 1;
    if (v <= 0) delete next[id]; else next[id] = v; return next;
  });
  const removeCart = (id) => setCart(c => { const n = { ...c }; delete n[id]; return n; });
  const clearCart = () => setCart({});

  const handleLogout = async () => {
    await signOut();
    navigate({ page: 'home' });
  };

  if (!verified) return <AgeGate onYes={handleAgeYes} onNo={() => setTooYoung(true)} tooYoung={tooYoung} />;

  return (
    <div style={{ ...body, background: C.bg, color: C.text, minHeight: '100vh' }}>
      <div className="text-center py-2 px-4 text-[11px] md:text-xs"
           style={{ background: C.navy, color: 'white', ...mono, fontWeight: 500, letterSpacing: '0.06em' }}>
        <span key={annIdx} className="fade-in inline-block">{ANNOUNCEMENTS[annIdx]}</span>
      </div>

      <Header cartCount={cartCount} onCart={() => setCartOpen(true)}
              navOpen={navOpen} setNavOpen={setNavOpen}
              megaOpen={megaOpen} setMegaOpen={setMegaOpen}
              goHome={goHome} goCategory={goCategory} goProduct={goProduct}
              user={user} isAdmin={isAdmin}
              onAccountClick={() => navigate({ page: 'account' })}
              onAdminClick={() => navigate({ page: 'admin' })}
              onLoginClick={() => setLoginOpen(true)} onLogout={handleLogout} />

      {route.page === 'home' && <HomePage goProduct={goProduct} goCategory={goCategory} cart={cart} addToCart={addToCart} decCart={decCart} user={user} onLoginClick={() => setLoginOpen(true)} />}
      {route.page === 'product' && <ProductPage productId={route.productId} cart={cart} addToCart={addToCart} decCart={decCart} goProduct={goProduct} goHome={goHome} goCategory={goCategory} user={user} onLoginClick={() => setLoginOpen(true)} />}
      {route.page === 'category' && <CategoryPage category={route.category} cart={cart} addToCart={addToCart} decCart={decCart} goProduct={goProduct} goHome={goHome} user={user} onLoginClick={() => setLoginOpen(true)} />}
      {route.page === 'quote' && <QuotePage items={cartItems} total={cartTotal} addToCart={addToCart} decCart={decCart} removeCart={removeCart} clearCart={clearCart} goHome={goHome} user={user} profile={profile} />}
      {route.page === 'account' && <AccountPage profile={profile} goHome={goHome} />}
      {route.page === 'admin' && <AdminPage profile={profile} goHome={goHome} />}

      <Footer goHome={goHome} goCategory={goCategory} />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)}
                  items={cartItems} total={cartTotal} addToCart={addToCart} decCart={decCart}
                  goQuote={goQuote} user={user} onLoginClick={() => setLoginOpen(true)} />
      {navOpen && <MobileNav onClose={() => setNavOpen(false)} goHome={goHome} goCategory={goCategory}
                              user={user} isAdmin={isAdmin}
                              onAccountClick={() => { setNavOpen(false); navigate({ page: 'account' }); }}
                              onAdminClick={() => { setNavOpen(false); navigate({ page: 'admin' }); }}
                              onLoginClick={() => { setNavOpen(false); setLoginOpen(true); }} onLogout={handleLogout} />}

      <WelcomePopup open={welcomeOpen} onClose={() => setWelcomeOpen(false)} goCategory={(c) => { setWelcomeOpen(false); goCategory(c); }} goQuote={() => { setWelcomeOpen(false); goQuote(); }} />
      <AuthModal open={loginOpen} onClose={() => setLoginOpen(false)} />

      <WhatsAppButton />
    </div>
  );
}

function HomePage({ goProduct, goCategory, cart, addToCart, decCart, user, onLoginClick }) {
  return (
    <>
      <HeroCarousel goCategory={goCategory} />
      <PromoTiles />
      <QuickOrderPanel cart={cart} addToCart={addToCart} decCart={decCart} goProduct={goProduct} user={user} onLoginClick={onLoginClick} />
      <NewArrivals goProduct={goProduct} user={user} onLoginClick={onLoginClick} />
      <ShopByCategory goCategory={goCategory} />
      <FeaturedProducts cart={cart} addToCart={addToCart} decCart={decCart} goProduct={goProduct} user={user} onLoginClick={onLoginClick} />
      <DealBanner />
      <BrandsStrip />
      <TrustPillars />
      <FAQ />
      <ApplyAccount />
      <VisitShowroom />
      <Newsletter />
    </>
  );
}

function AgeGate({ onYes, onNo, tooYoung }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="age-gate-title"
         className="min-h-screen flex items-center justify-center px-6"
         style={{ background: C.navy, color: 'white', ...body }}>
      <div className="max-w-lg w-full text-center fade-in">
        <img src={IMG.logo} alt={COMPANY.name} className="mx-auto mb-8"
             style={{ width: 130, height: 130, objectFit: 'contain', borderRadius: 12 }} />
        {!tooYoung ? (
          <>
            <h1 id="age-gate-title" style={{ ...display, fontWeight: 800 }} className="text-3xl md:text-5xl leading-tight mb-5">
              Are you <span style={{ color: C.orange }}>21 or older?</span>
            </h1>
            <p className="text-sm md:text-base mb-10 leading-relaxed opacity-80" style={{ maxWidth: '40ch', margin: '0 auto 2.5rem' }}>
              This site contains tobacco and vapor products. Access is restricted to licensed retailers and adults 21 years or older.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={onYes}
                      className="px-10 py-4 text-xs uppercase font-bold transition-transform hover:scale-[1.02]"
                      style={{ ...mono, letterSpacing: '0.18em', background: C.orange, color: 'white' }}>
                Yes, I am 21+
              </button>
              <button onClick={onNo}
                      className="px-10 py-4 text-xs uppercase border transition-colors hover:bg-white/5"
                      style={{ ...mono, letterSpacing: '0.18em', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>
                No, exit
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 style={{ ...display, fontWeight: 700 }} className="text-3xl leading-tight mb-4">We're sorry —</h1>
            <p className="opacity-80">You must be 21 years or older to enter this site.</p>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// HEADER
// =============================================================================
function Header({ cartCount, onCart, navOpen, setNavOpen, megaOpen, setMegaOpen, goHome, goCategory, goProduct, user, isAdmin, onAccountClick, onAdminClick, onLoginClick, onLogout }) {
  return (
    <>
      {/* Utility bar */}
      <div className="hidden md:block border-b" style={{ background: 'white', borderColor: C.border }}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 flex items-center justify-between text-xs h-9" style={{ color: C.muted }}>
          <div className="flex items-center gap-6">
            <a href={`tel:${COMPANY.phoneRaw}`} className="flex items-center gap-1.5 hover:text-[#DB6433] transition-colors">
              <Phone size={12} /> <span style={{ ...mono, fontWeight: 500 }}>{COMPANY.phone}</span>
            </a>
            <span className="flex items-center gap-1.5">
              <Clock size={12} /> {COMPANY.hoursLine1} · {COMPANY.hoursLine2}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={12} /> {COMPANY.addressShort}
            </span>
          </div>
          <div className="flex items-center gap-5" style={{ ...mono, fontWeight: 500 }}>
            {!user && <button onClick={onLoginClick} className="hover:text-[#DB6433] transition-colors">APPLY FOR ACCOUNT</button>}
            {user && (
              <button onClick={onAccountClick} className="hover:text-[#DB6433] transition-colors">MY ACCOUNT</button>
            )}
            {isAdmin && (
              <>
                <span style={{ color: C.border }}>·</span>
                <button onClick={onAdminClick} className="hover:text-[#DB6433] transition-colors" style={{ color: C.orange }}>ADMIN</button>
              </>
            )}
            <span style={{ color: C.border }}>·</span>
            {user ? (
              <button onClick={onLogout} className="hover:text-[#DB6433] transition-colors flex items-center gap-1.5">
                <span style={{ color: C.greenTag }}>● {user.business || user.name}</span> · SIGN OUT
              </button>
            ) : (
              <button onClick={onLoginClick} className="hover:text-[#DB6433] transition-colors">SIGN IN</button>
            )}
          </div>
        </div>
      </div>

      {/* Main header — LARGE CENTERED LOGO */}
      <header className="border-b" style={{ background: 'white', borderColor: C.border }}>
        {/* Centered logo strip */}
        <div className="relative max-w-[1400px] mx-auto px-3 md:px-6 lg:px-10 py-4 md:py-6 flex items-center justify-between gap-3 md:gap-4">
          {/* Mobile menu (left) */}
          <button className="lg:hidden shrink-0" onClick={() => setNavOpen(!navOpen)} aria-label="Open menu">
            <Menu size={24} />
          </button>

          {/* Search (left desktop) */}
          <div className="hidden lg:block flex-1 max-w-md">
            <ProductSearch goProduct={goProduct} goCategory={goCategory} />
          </div>

          {/* CENTERED LOGO */}
          <button onClick={goHome}
                  className="absolute left-1/2 -translate-x-1/2 lg:relative lg:left-auto lg:transform-none flex flex-col items-center justify-center group">
            <img src={IMG.logo} alt={COMPANY.name}
                 className="transition-transform group-hover:scale-105"
                 style={{ width: 76, height: 76, objectFit: 'contain', borderRadius: 10 }} />
            <div className="text-center mt-2">
              <div style={{ ...display, fontWeight: 800, color: C.navy, fontSize: 18, lineHeight: 1 }} className="md:text-xl">
                ALABAMA
              </div>
              <div style={{ ...mono, color: C.orange, fontSize: 9, letterSpacing: '0.25em', fontWeight: 700, marginTop: 3 }}>
                WHOLESALE INC
              </div>
            </div>
          </button>

          {/* Right side */}
          <div className="flex items-center gap-3 md:gap-5 ml-auto shrink-0">
            {!user && (
              <button onClick={onLoginClick} className="hidden lg:flex items-center gap-2 text-xs uppercase font-bold transition-colors hover:text-[#DB6433]"
                      style={{ ...mono, letterSpacing: '0.15em', color: C.text }}>
                <Users size={16} /> APPLY
              </button>
            )}
            {user ? (
              <button onClick={onAccountClick} className="hidden md:flex items-center gap-2 text-xs uppercase font-bold transition-colors hover:text-[#DB6433]"
                      style={{ ...mono, letterSpacing: '0.15em', color: C.greenTag }}>
                <span className="w-2 h-2 rounded-full" style={{ background: C.greenTag }} /> {user.name?.split(' ')[0] || 'Trade'}
              </button>
            ) : (
              <button onClick={onLoginClick} className="hidden md:flex items-center gap-2 text-xs uppercase font-bold transition-colors hover:text-[#DB6433]"
                      style={{ ...mono, letterSpacing: '0.15em', color: C.text }}>
                <Users size={16} /> SIGN IN
              </button>
            )}
            <button onClick={onCart} className="relative flex items-center gap-2 transition-colors hover:text-[#DB6433]" aria-label="Open cart">
              <ShoppingCart size={22} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold"
                      style={{ background: C.orange, color: 'white' }}>{cartCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile search */}
        <div className="md:hidden px-3 pb-3">
          <ProductSearch goProduct={goProduct} goCategory={goCategory} compact />
        </div>

        {/* Category nav strip — sticky and centered */}
        <div className="border-t hidden lg:block sticky top-0 z-30" style={{ borderColor: C.border, background: 'white' }}>
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 flex items-center justify-center h-12">
            <button onMouseEnter={() => setMegaOpen(true)}
                    onClick={() => setMegaOpen(!megaOpen)}
                    className="flex items-center gap-2 px-4 h-12 text-xs uppercase font-bold transition-colors"
                    style={{ ...mono, letterSpacing: '0.15em', background: megaOpen ? C.orange : 'transparent', color: megaOpen ? 'white' : C.text }}>
              <Menu size={14} /> All Categories <ChevronDown size={14} />
            </button>
            <div className="flex items-center gap-5 ml-6" style={{ ...mono, fontWeight: 600 }}>
              {NAV_CATEGORIES.map(c => (
                <button key={c.name} onClick={() => goCategory(c.name)}
                   className="text-xs uppercase transition-colors hover:text-[#DB6433]"
                   style={{ letterSpacing: '0.1em', color: C.text }}>
                  {c.name}
                </button>
              ))}
              <a href="#" className="text-xs uppercase font-bold" style={{ letterSpacing: '0.1em', color: C.orange }}>
                CLEARANCE
              </a>
            </div>
          </div>
        </div>

        {megaOpen && (
          <div onMouseLeave={() => setMegaOpen(false)}
               className="hidden lg:block absolute left-0 right-0 border-t border-b shadow-xl z-30"
               style={{ background: 'white', borderColor: C.border }}>
            <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 grid grid-cols-4 gap-8">
              {NAV_CATEGORIES.map(c => (
                <div key={c.name}>
                  <button onClick={() => { goCategory(c.name); setMegaOpen(false); }} style={{ ...display, fontWeight: 700, color: C.navy }} className="text-base mb-3 pb-2 border-b w-full text-left hover:text-[#DB6433] transition-colors">
                    {c.name}
                  </button>
                  <ul className="space-y-2">
                    {c.sub.map(s => (
                      <li key={s}>
                        <button onClick={() => { goCategory(c.name); setMegaOpen(false); }} className="text-xs transition-colors hover:text-[#DB6433] text-left" style={{ color: C.muted }}>{s}</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>
    </>
  );
}


function ProductSearch({ goProduct, goCategory, compact = false }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const limit = compact ? 5 : 7;
  const matches = useMemo(() => getSearchMatches(query, limit), [query, limit]);
  const categoryHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return NAV_CATEGORIES.filter(c => c.name.toLowerCase().includes(q)).slice(0, 3);
  }, [query]);
  const hasQuery = query.trim().length > 1;

  const selectProduct = (product) => {
    goProduct(product.id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const selectCategory = (cat) => {
    goCategory(cat);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search size={compact ? 15 : 18} className={compact ? 'absolute left-3' : 'absolute left-4'} style={{ color: C.muted }} />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={`Search ${PRODUCTS.length} SKUs, brands, or flavors...`}
          aria-label="Search products"
          className={`${compact ? 'h-9 pl-9 pr-3 text-sm' : 'h-11 pl-11 pr-10 text-sm'} w-full border outline-none transition-colors focus:border-[#DB6433] focus-ring`}
          style={{ background: C.bg, borderColor: C.border, color: C.text }}
        />
        {query && (
          <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Clear search"
                  className="absolute right-3 w-6 h-6 flex items-center justify-center rounded-full transition-colors hover:bg-black/5">
            <X size={13} style={{ color: C.muted }} />
          </button>
        )}
      </div>

      {open && hasQuery && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 shadow-2xl overflow-hidden"
             style={{ background: 'white', border: `1px solid ${C.border}`, maxHeight: compact ? 360 : 430 }}>
          {matches.length === 0 && categoryHits.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: C.muted }}>
              No products found. Try a brand, SKU, flavor, or category.
            </div>
          ) : (
            <>
              {matches.length > 0 && (
                <div>
                  <div className="px-3 pt-3 pb-2 text-[10px] uppercase" style={{ ...mono, letterSpacing: '0.2em', color: C.muted, fontWeight: 700 }}>
                    Products
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {matches.map(product => (
                      <button key={product.id} onClick={() => selectProduct(product)}
                              className="w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors hover:bg-[#FFF8F2]">
                        <div className="w-10 h-10 shrink-0 relative overflow-hidden" style={{ background: '#FAFAFA', border: `1px solid ${C.borderSoft}` }}>
                          {product.img ? (
                            <img src={product.img} alt="" className="w-full h-full object-contain" style={{ padding: 3 }} />
                          ) : (
                            <TextCard name={product.name} cat={product.cat} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate" style={{ ...display, color: C.navy }}>{product.name}</div>
                          <div className="text-[10px] uppercase truncate" style={{ ...mono, letterSpacing: '0.12em', color: C.muted }}>
                            {product.cat} · {product.sku}
                          </div>
                        </div>
                        {product.tag && (
                          <span className="hidden sm:inline px-2 py-1 text-[9px] uppercase font-bold" style={{ ...mono, background: C.orangeLite, color: C.orange, letterSpacing: '0.12em' }}>
                            {product.tag}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {categoryHits.length > 0 && (
                <div className="border-t" style={{ borderColor: C.borderSoft }}>
                  <div className="px-3 pt-3 pb-2 text-[10px] uppercase" style={{ ...mono, letterSpacing: '0.2em', color: C.muted, fontWeight: 700 }}>
                    Categories
                  </div>
                  <div className="px-3 pb-3 flex flex-wrap gap-2">
                    {categoryHits.map(c => (
                      <button key={c.name} onClick={() => selectCategory(c.name)}
                              className="px-3 py-1.5 text-[10px] uppercase font-bold transition-colors hover:bg-[#DB6433] hover:text-white"
                              style={{ ...mono, letterSpacing: '0.14em', background: C.bg, color: C.navy, border: `1px solid ${C.border}` }}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MobileNav({ onClose, goHome, goCategory, user, isAdmin, onAccountClick, onAdminClick, onLoginClick, onLogout }) {
  return (
    <div className="lg:hidden fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <aside onClick={(e) => e.stopPropagation()}
             className="w-80 max-w-[85vw] h-full overflow-y-auto" style={{ background: 'white' }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: C.border }}>
          <button onClick={() => { goHome(); onClose(); }} className="flex items-center gap-2">
            <img src={IMG.logo} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4 }} />
            <span style={{ ...display, fontWeight: 800, color: C.navy }} className="text-base">ALABAMA</span>
          </button>
          <button onClick={onClose}><X size={22} /></button>
        </div>
        {user && (
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: C.border, background: C.orangeLite }}>
            <span className="w-2 h-2 rounded-full" style={{ background: C.greenTag }} />
            <div className="flex-1 min-w-0">
              <div style={{ ...display, fontWeight: 700, color: C.navy }} className="text-sm truncate">{user.business || user.name}</div>
              <div className="text-[11px]" style={{ color: C.muted }}>Pricing visible</div>
            </div>
            <button onClick={() => { onLogout(); onClose(); }} className="text-[10px] uppercase font-bold" style={{ ...mono, letterSpacing: '0.15em', color: C.muted }}>
              SIGN OUT
            </button>
          </div>
        )}
        <ul>
          {NAV_CATEGORIES.map(c => (
            <li key={c.name} className="border-b" style={{ borderColor: C.borderSoft }}>
              <details className="group">
                <summary className="px-5 py-3.5 flex items-center justify-between cursor-pointer">
                  <button onClick={(e) => { e.stopPropagation(); goCategory(c.name); onClose(); }}
                          style={{ ...mono, fontWeight: 600, letterSpacing: '0.08em' }} className="text-sm uppercase text-left flex-1">{c.name}</button>
                  <ChevronRight size={16} className="transition-transform group-open:rotate-90" />
                </summary>
                <ul className="pb-3 px-5">
                  {c.sub.map(s => (
                    <li key={s}>
                      <button onClick={() => { goCategory(c.name); onClose(); }} className="block py-1.5 text-sm text-left" style={{ color: C.muted }}>{s}</button>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
        <div className="p-5 space-y-3">
          {!user && (
            <button onClick={onLoginClick} className="w-full text-center py-3 text-xs uppercase font-bold inline-flex items-center justify-center gap-2"
                    style={{ ...mono, letterSpacing: '0.18em', background: C.navy, color: 'white' }}>
              <Users size={14} /> SIGN IN FOR PRICING
            </button>
          )}
          {user && (
            <button onClick={onAccountClick} className="w-full text-center py-3 text-xs uppercase font-bold"
                    style={{ ...mono, letterSpacing: '0.18em', background: C.navy, color: 'white' }}>
              My Account
            </button>
          )}
          {isAdmin && (
            <button onClick={onAdminClick} className="w-full text-center py-3 text-xs uppercase font-bold"
                    style={{ ...mono, letterSpacing: '0.18em', background: C.orange, color: 'white' }}>
              Admin Dashboard
            </button>
          )}
          {!user && (
            <button onClick={onLoginClick} className="block w-full text-center py-3 text-xs uppercase font-bold"
                    style={{ ...mono, letterSpacing: '0.18em', background: C.orange, color: 'white' }}>
              APPLY FOR WHOLESALE
            </button>
          )}
          <a href={`tel:${COMPANY.phoneRaw}`} className="flex items-center justify-center gap-2 py-3 text-xs uppercase"
             style={{ ...mono, letterSpacing: '0.15em', border: `1px solid ${C.border}`, color: C.text }}>
            <Phone size={14} /> {COMPANY.phone}
          </a>
        </div>
      </aside>
    </div>
  );
}

function HeroCarousel({ goCategory }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx(i => (i + 1) % HERO_SLIDES.length), 6000);
    return () => clearInterval(t);
  }, [paused]);

  const next = () => setIdx(i => (i + 1) % HERO_SLIDES.length);
  const prev = () => setIdx(i => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);

  return (
    <section id="top" className="px-3 md:px-6 lg:px-10 py-4 md:py-8"
             onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="max-w-[1400px] mx-auto relative overflow-hidden hero-min"
           style={{ background: C.navy, minHeight: 480 }}>
        {HERO_SLIDES.map((s, i) => {
          const isActive = i === idx;
          return (
            <div key={i}
                 className="absolute inset-0 transition-opacity"
                 style={{
                   opacity: isActive ? 1 : 0,
                   pointerEvents: isActive ? 'auto' : 'none',
                   transitionDuration: '700ms'
                 }}>
              <div className="grid lg:grid-cols-12 h-full hero-min" style={{ minHeight: 480 }}>
                <div className="lg:col-span-7 p-6 md:p-12 lg:p-16 flex flex-col justify-center relative z-10"
                     style={{
                       background: s.accent === 'orange'
                         ? `linear-gradient(120deg, ${C.navy} 0%, ${C.navy} 60%, ${C.orangeDark} 100%)`
                         : `linear-gradient(120deg, ${C.orange} 0%, ${C.orangeDark} 60%, ${C.navy} 100%)`
                     }}>
                  {isActive && (
                    <div className="slide-fade">
                      <div style={{ ...mono, color: 'white', fontWeight: 600, letterSpacing: '0.3em' }}
                           className="text-[10px] md:text-[11px] mb-3 md:mb-5 opacity-90 flex items-center gap-2">
                        ● {s.eyebrow}
                        {s.videoUrl && (
                          <span className="px-1.5 py-0.5" style={{ background: C.orange, color: 'white', fontSize: 9, letterSpacing: '0.2em' }}>
                            ▶ VIDEO
                          </span>
                        )}
                      </div>
                      <h1 style={{ ...display, fontWeight: 800, color: 'white' }}
                          className="hero-text text-3xl md:text-5xl lg:text-6xl leading-[1.05] mb-3 md:mb-5">
                        {s.title}
                      </h1>
                      <p className="text-white/85 max-w-lg text-sm md:text-lg leading-relaxed mb-5 md:mb-8">
                        {s.sub}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <button onClick={() => goCategory && goCategory(s.goCat || 'NOVELTIES')}
                           className="inline-flex items-center gap-2 px-5 md:px-7 py-3 md:py-3.5 text-[11px] md:text-xs uppercase font-bold transition-transform hover:scale-[1.03]"
                           style={{ ...mono, letterSpacing: '0.15em', background: 'white', color: C.navy }}>
                          {s.cta1} <ArrowRight size={14} />
                        </button>
                        <a href="#apply"
                           className="inline-flex items-center gap-2 px-5 md:px-7 py-3 md:py-3.5 text-[11px] md:text-xs uppercase font-bold border-2 transition-colors hover:bg-white/10"
                           style={{ ...mono, letterSpacing: '0.15em', borderColor: 'rgba(255,255,255,0.5)', color: 'white' }}>
                          {s.cta2}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                {/* Right side — VIDEO if videoUrl set, else IMAGE */}
                <div className="lg:col-span-5 relative overflow-hidden hidden lg:block"
                     style={{ minHeight: 280, background: '#000' }}>
                  {s.videoUrl ? (
                    <video key={s.videoUrl}
                           src={s.videoUrl}
                           autoPlay loop muted playsInline
                           className="absolute inset-0 w-full h-full object-cover"
                           style={{ opacity: 0.92 }} />
                  ) : (
                    <img src={s.img} alt="" className="absolute inset-0 w-full h-full object-cover"
                         style={{ opacity: 0.92 }} />
                  )}
                  <div className="absolute inset-0"
                       style={{ background: `linear-gradient(90deg, ${C.navy}99 0%, transparent 30%)` }} />
                  <div className="absolute top-5 right-5 px-3 py-1.5 flex items-center gap-1.5"
                       style={{ ...mono, background: s.videoUrl ? C.orange : C.orange, color: 'white', fontSize: 10, letterSpacing: '0.25em', fontWeight: 700 }}>
                    {s.videoUrl && <span style={{ fontSize: 8 }}>▶</span>}
                    SLIDE {String(i + 1).padStart(2, '0')} / {String(HERO_SLIDES.length).padStart(2, '0')}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <button onClick={prev} aria-label="Previous slide"
                className="absolute left-2 md:left-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-12 md:h-12 flex items-center justify-center transition-all hover:scale-110"
                style={{ background: 'rgba(255,255,255,0.95)', color: C.navy }}>
          <ChevronLeft size={20} />
        </button>
        <button onClick={next} aria-label="Next slide"
                className="absolute right-2 md:right-5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 md:w-12 md:h-12 flex items-center justify-center transition-all hover:scale-110"
                style={{ background: 'rgba(255,255,255,0.95)', color: C.navy }}>
          <ChevronRight size={20} />
        </button>

        <div className="absolute bottom-4 md:bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {HERO_SLIDES.map((_, i) => (
            <button key={i} aria-label={`Go to slide ${i + 1}`} onClick={() => setIdx(i)} className="transition-all"
                    style={{ width: i === idx ? 28 : 8, height: 4, background: i === idx ? C.orange : 'rgba(255,255,255,0.5)' }} />
          ))}
        </div>
        <div className="absolute bottom-0 left-0 h-0.5 z-20" style={{ background: C.orange, width: `${((idx + 1) / HERO_SLIDES.length) * 100}%`, transition: 'width 0.5s ease' }} />
      </div>
    </section>
  );
}

function PromoTiles() {
  const tiles = [
    { icon: Truck,       title: 'Free Delivery',      blurb: 'On orders over $1,500 in AL, GA, TN & MS.' },
    { icon: Tag,         title: 'Volume Pricing',     blurb: 'Tiered discounts up to 18% off on pallet quantities.' },
    { icon: Clock,       title: 'Same-Day Will-Call', blurb: 'Order by 11AM, pick up the same afternoon.' },
    { icon: ShieldCheck, title: 'Net-30 Terms',       blurb: 'Approved accounts qualify with credit verification.' }
  ];
  return (
    <section className="px-3 md:px-6 lg:px-10 py-3 md:py-6">
      <div className="max-w-[1400px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-px"
           style={{ background: C.border, border: `1px solid ${C.border}` }}>
        {tiles.map((t, i) => (
          <div key={i} className="flex items-start gap-3 md:gap-4 p-4 md:p-6" style={{ background: 'white' }}>
            <div className="w-9 h-9 md:w-10 md:h-10 shrink-0 flex items-center justify-center" style={{ background: C.orangeLite }}>
              <t.icon size={16} style={{ color: C.orange }} />
            </div>
            <div className="min-w-0">
              <div style={{ ...display, fontWeight: 700, color: C.navy }} className="text-sm md:text-base mb-0.5 md:mb-1">{t.title}</div>
              <div className="text-[11px] md:text-xs leading-relaxed" style={{ color: C.muted }}>{t.blurb}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


function QuickOrderPanel({ cart, addToCart, decCart, goProduct, user, onLoginClick }) {
  const [query, setQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');
  const featuredItems = useMemo(() => {
    const featuredIds = [61, 62, 64, 143, 75, 76, 31, 184];
    return featuredIds.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  }, []);
  const queryMatches = useMemo(() => getSearchMatches(query, 8), [query]);
  const categoryMatches = useMemo(() => (
    selectedCat === 'All' ? featuredItems : PRODUCTS.filter(p => p.cat === selectedCat).slice(0, 8)
  ), [selectedCat, featuredItems]);
  const visibleItems = query.trim().length > 1 ? queryMatches : categoryMatches;

  return (
    <section className="px-3 md:px-6 lg:px-10 py-6 md:py-10">
      <div className="max-w-[1400px] mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-4 md:gap-6 items-stretch">
        <div className="p-6 md:p-8 relative overflow-hidden" style={{ background: C.navy, color: 'white' }}>
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full" style={{ background: 'rgba(219,100,51,0.25)' }} />
          <div className="absolute -left-10 -bottom-10 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="relative z-10">
            <div style={{ ...mono, color: C.orange, fontWeight: 800, letterSpacing: '0.3em' }} className="text-[10px] md:text-[11px] uppercase mb-3">
              FAST B2B ORDERING
            </div>
            <h2 style={{ ...display, fontWeight: 850 }} className="text-2xl md:text-4xl leading-tight mb-3">
              Build a quote in minutes, not phone calls.
            </h2>
            <p className="text-sm md:text-base leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.78)' }}>
              Search by SKU, brand, flavor, or department. Add items now and submit one clean wholesale quote request.
            </p>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {[
                { n: PRODUCTS.length, l: 'SKUs' },
                { n: NAV_CATEGORIES.length, l: 'Departments' },
                { n: '11AM', l: 'Will-call cutoff' }
              ].map((m, i) => (
                <div key={i} className="p-3" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ ...display, fontWeight: 850, color: 'white' }} className="text-lg md:text-2xl leading-none">{m.n}</div>
                  <div style={{ ...mono, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.13em' }} className="text-[9px] md:text-[10px] uppercase mt-1">{m.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5" style={{ background: 'white', border: `1px solid ${C.border}` }}>
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
              <input value={query} onChange={e => setQuery(e.target.value)}
                     placeholder="Quick add: Red Bull, Backwoods, charger, candy..."
                     className="w-full h-11 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[#DB6433]"
                     style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }} />
            </div>
            <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
                    className="h-11 px-3 text-xs uppercase outline-none"
                    style={{ ...mono, letterSpacing: '0.1em', background: C.bg, border: `1px solid ${C.border}`, color: C.navy }}>
              <option value="All">Featured</option>
              {NAV_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5 md:gap-3">
            {visibleItems.length === 0 ? (
              <div className="sm:col-span-2 p-6 text-center text-sm" style={{ color: C.muted, background: C.bg }}>
                No matches yet. Try a broader product name, SKU, or category.
              </div>
            ) : visibleItems.slice(0, 8).map(item => {
              const qty = cart[item.id] || 0;
              return (
                <div key={item.id} className="p-3 flex items-center gap-3 transition-all hover:shadow-md" style={{ border: `1px solid ${C.borderSoft}`, background: C.card }}>
                  <button onClick={() => goProduct(item.id)} className="w-12 h-12 shrink-0 relative overflow-hidden" style={{ background: '#FAFAFA', border: `1px solid ${C.borderSoft}` }}>
                    {item.img ? <img src={item.img} alt="" className="w-full h-full object-contain" style={{ padding: 4 }} /> : <TextCard name={item.name} cat={item.cat} />}
                  </button>
                  <button onClick={() => goProduct(item.id)} className="min-w-0 flex-1 text-left">
                    <div style={{ ...display, fontWeight: 750, color: C.navy }} className="text-sm leading-tight truncate">{item.name}</div>
                    <div style={{ ...mono, color: C.muted, letterSpacing: '0.1em' }} className="text-[9px] uppercase truncate">{item.cat} · {item.sku}</div>
                    {user && <div style={{ ...display, fontWeight: 800, color: C.orange }} className="text-sm mt-1">${item.price.toFixed(2)}</div>}
                  </button>
                  {qty === 0 ? (
                    <button onClick={() => addToCart(item.id)} className="w-9 h-9 flex items-center justify-center shrink-0 transition-transform hover:scale-105" style={{ background: C.orange, color: 'white' }} aria-label={`Add ${item.name}`}>
                      <Plus size={16} />
                    </button>
                  ) : (
                    <div className="flex items-center shrink-0" style={{ border: `1px solid ${C.orange}` }}>
                      <button onClick={() => decCart(item.id)} className="w-7 h-8 flex items-center justify-center" aria-label="Decrease"><Minus size={11} style={{ color: C.orange }} /></button>
                      <span style={{ ...mono, fontWeight: 800, color: C.orange }} className="text-xs min-w-[24px] text-center">{qty}</span>
                      <button onClick={() => addToCart(item.id)} className="w-7 h-8 flex items-center justify-center" aria-label="Increase"><Plus size={11} style={{ color: C.orange }} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!user && (
            <button onClick={onLoginClick} className="mt-4 w-full py-3 text-[10px] md:text-xs uppercase font-bold inline-flex items-center justify-center gap-2"
                    style={{ ...mono, letterSpacing: '0.18em', background: C.orangeLite, color: C.orange, border: `1px dashed ${C.orange}` }}>
              <Users size={14} /> Sign in to reveal wholesale prices
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// NEW ARRIVALS — auto-rotating row
// =============================================================================
function NewArrivals({ goProduct, user, onLoginClick }) {
  const items = NEW_ARRIVALS_IDS.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  const scrollerRef = useRef(null);

  const scrollBy = (dir) => {
    if (!scrollerRef.current) return;
    const el = scrollerRef.current;
    const cardWidth = 240; // ~ card + gap
    el.scrollBy({ left: dir * cardWidth * 2, behavior: 'smooth' });
  };

  return (
    <section className="px-0 py-10 md:py-14 overflow-hidden border-y"
             style={{ background: 'white', borderColor: C.border }}>
      <div className="max-w-[1400px] mx-auto px-3 md:px-6 lg:px-10 mb-6 md:mb-8 flex items-end justify-between gap-4">
        <div>
          <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em' }} className="text-[10px] md:text-[11px] uppercase mb-2">
            <span style={{ color: C.orange }}>★ JUST ARRIVED</span>
          </div>
          <h2 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-2xl md:text-4xl leading-tight">
            New this week
          </h2>
        </div>
        {/* Scroll controls */}
        <div className="flex items-center gap-2">
          <button onClick={() => scrollBy(-1)} aria-label="Scroll left"
                  className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center transition-all hover:scale-105"
                  style={{ background: 'white', border: `2px solid ${C.navy}`, color: C.navy }}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => scrollBy(1)} aria-label="Scroll right"
                  className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center transition-all hover:scale-105"
                  style={{ background: C.navy, color: 'white' }}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {/* Scroller */}
      <div ref={scrollerRef}
           className="overflow-x-auto scrollx arr-scroll px-3 md:px-6 lg:px-10"
           style={{ scrollbarWidth: 'none' }}>
        <div className="flex gap-3 md:gap-4 pb-2" style={{ width: 'max-content' }}>
          {items.map((p, i) => (
            <button key={p.id} onClick={() => goProduct(p.id)}
                    className="shrink-0 w-44 md:w-56 transition-transform hover:-translate-y-1 text-left"
                    style={{ background: 'white', border: `1px solid ${C.border}` }}>
              <div className="aspect-square overflow-hidden flex items-center justify-center relative" style={{ background: '#FAFAFA' }}>
                {p.img ? (
                  <img src={p.img} alt={p.name} className="w-full h-full object-contain" style={{ padding: 10 }} />
                ) : (
                  <TextCard name={p.name} cat={p.cat} />
                )}
                {p.tag && (
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 text-[9px] uppercase font-bold"
                       style={{ ...mono, letterSpacing: '0.18em',
                                background: p.tag === 'BESTSELLER' ? C.navy : p.tag === 'NEW' ? C.orange : p.tag === 'DEAL' ? C.yellow : C.greenTag,
                                color: p.tag === 'DEAL' ? C.navy : 'white' }}>
                    {p.tag}
                  </div>
                )}
              </div>
              <div className="p-3">
                <div style={{ ...mono, fontWeight: 600, letterSpacing: '0.15em', color: C.muted }} className="text-[9px] uppercase mb-1 truncate">{p.cat}</div>
                <div style={{ ...display, color: C.navy, fontWeight: 700 }} className="text-xs leading-tight mb-1.5 line-clamp-2 min-h-[2.4em]" title={p.name}>{p.name}</div>
                {user ? (
                  <div style={{ ...display, color: C.orange, fontWeight: 800 }} className="text-base">
                    ${p.price.toFixed(2)}
                  </div>
                ) : (
                  <div style={{ ...mono, color: C.orange, fontWeight: 700, letterSpacing: '0.1em' }} className="text-[10px] uppercase">
                    Sign in for price →
                  </div>
                )}
              </div>
            </button>
          ))}
          {/* Login prompt at end */}
          {!user && (
            <button onClick={onLoginClick}
                    className="shrink-0 w-44 md:w-56 flex flex-col items-center justify-center text-center p-6 transition-transform hover:-translate-y-1"
                    style={{ background: C.orangeLite, border: `2px dashed ${C.orange}` }}>
              <Users size={32} style={{ color: C.orange }} className="mb-3" />
              <div style={{ ...display, fontWeight: 800, color: C.navy }} className="text-base mb-1">See live prices</div>
              <div className="text-[11px] mb-3" style={{ color: C.muted }}>Sign in for wholesale pricing on all 368 SKUs</div>
              <div className="text-[10px] uppercase font-bold" style={{ ...mono, letterSpacing: '0.15em', color: C.orange }}>
                Sign In →
              </div>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function ShopByCategory({ goCategory }) {
  return (
    <section id="categories" className="px-3 md:px-6 lg:px-10 py-12 md:py-20" style={{ background: C.bg }}>
      <div className="max-w-[1400px] mx-auto">
        <SectionHead eyebrow="01 / DEPARTMENTS" title="Shop by department"
                     blurb="Eight departments. 368 active SKUs. Restocked daily at our Birmingham warehouse." />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-8 md:mt-10">
          {SHOP_CATS.map((c, i) => (
            <button key={c.name} onClick={() => goCategory(c.name)}
                    className="group relative overflow-hidden aspect-[4/5] flex flex-col text-left p-5 md:p-6 transition-all hover:-translate-y-1"
                    style={{ background: `linear-gradient(155deg, ${c.color[0]} 0%, ${c.color[1]} 100%)` }}>
              {/* Soft inner highlight */}
              <div className="absolute inset-0 opacity-30 transition-opacity group-hover:opacity-50"
                   style={{ background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.5), transparent 55%)' }} />
              {/* Big SVG icon centered */}
              <div className="absolute inset-0 flex items-center justify-center pb-16 md:pb-20">
                <CategoryIcon name={c.icon} size={120} color="rgba(255,255,255,0.95)" />
              </div>
              {/* Top labels */}
              <div className="relative z-10 flex items-start justify-between">
                <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.7)' }} className="text-[10px] md:text-[11px] uppercase">
                  0{i + 1}
                </div>
                <div className="px-2 py-1 text-[9px] md:text-[10px] uppercase font-bold"
                     style={{ ...mono, letterSpacing: '0.18em', background: 'rgba(255,255,255,0.95)', color: C.navy }}>
                  {c.count} SKUs
                </div>
              </div>
              {/* Bottom title */}
              <div className="relative z-10 mt-auto">
                <h3 style={{ ...display, fontWeight: 800, color: 'white' }} className="text-xl md:text-2xl leading-tight mb-1.5 md:mb-2">
                  {c.name}
                </h3>
                <div className="flex items-center gap-2 text-white/90 text-[10px] md:text-xs uppercase font-bold transition-transform group-hover:translate-x-1"
                     style={{ ...mono, letterSpacing: '0.18em' }}>
                  Shop now <ArrowRight size={12} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// Custom SVG icons for category tiles — clean line art on solid backgrounds
function CategoryIcon({ name, size = 100, color = 'currentColor' }) {
  const sw = 1.6; // stroke width
  const props = { width: size, height: size, viewBox: '0 0 100 100', fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'cigar': // tobacco - cigar shape with smoke wisps
      return (
        <svg {...props}>
          <ellipse cx="50" cy="55" rx="34" ry="6" />
          <line x1="74" y1="51" x2="74" y2="59" />
          <line x1="80" y1="53" x2="80" y2="57" />
          <path d="M 22 50 Q 18 45, 22 40" opacity="0.55" />
          <path d="M 30 45 Q 26 38, 32 32" opacity="0.55" />
          <path d="M 40 42 Q 36 32, 44 24" opacity="0.55" />
          <path d="M 50 41 Q 48 30, 56 22" opacity="0.4" />
        </svg>
      );
    case 'vape': // novelties - vape pen
      return (
        <svg {...props}>
          <rect x="36" y="22" width="28" height="56" rx="4" />
          <line x1="42" y1="22" x2="42" y2="14" />
          <line x1="58" y1="22" x2="58" y2="14" />
          <rect x="42" y="35" width="16" height="20" rx="1.5" />
          <line x1="46" y1="65" x2="54" y2="65" />
          <line x1="46" y1="71" x2="54" y2="71" />
          <circle cx="50" cy="11" r="2" fill={color} stroke="none" />
          <path d="M 42 6 Q 38 0, 42 -4" opacity="0.4" />
          <path d="M 58 6 Q 62 0, 58 -4" opacity="0.4" />
        </svg>
      );
    case 'shopping': // merchandise - shopping bag
      return (
        <svg {...props}>
          <path d="M 22 32 L 78 32 L 74 82 L 26 82 Z" />
          <path d="M 36 32 L 36 22 Q 36 12, 50 12 Q 64 12, 64 22 L 64 32" />
          <line x1="38" y1="48" x2="62" y2="48" opacity="0.4" />
        </svg>
      );
    case 'candy': // candies - wrapped candy
      return (
        <svg {...props}>
          <ellipse cx="50" cy="50" rx="20" ry="14" />
          <path d="M 30 50 L 14 36 L 18 50 L 14 64 Z" />
          <path d="M 70 50 L 86 36 L 82 50 L 86 64 Z" />
          <line x1="42" y1="46" x2="46" y2="54" opacity="0.6" />
          <line x1="50" y1="44" x2="54" y2="56" opacity="0.6" />
          <line x1="58" y1="46" x2="62" y2="54" opacity="0.6" />
        </svg>
      );
    case 'snack': // food stuff - bag of chips
      return (
        <svg {...props}>
          <path d="M 30 22 L 70 22 L 72 28 L 70 82 L 30 82 L 28 28 Z" />
          <line x1="30" y1="28" x2="70" y2="28" />
          <path d="M 32 18 L 38 22 M 42 16 L 46 22 M 50 14 L 50 22 M 54 16 L 58 22 M 62 18 L 68 22" opacity="0.5" />
          <text x="50" y="55" textAnchor="middle" fontSize="11" fontWeight="700" fill={color} stroke="none" letterSpacing="0.5">CHIPS</text>
        </svg>
      );
    case 'cleaning': // grocery - spray bottle
      return (
        <svg {...props}>
          <rect x="34" y="40" width="28" height="42" rx="3" />
          <path d="M 40 40 L 40 28 L 50 28 L 50 22 L 64 22 L 64 32 L 50 32" />
          <path d="M 64 28 L 76 22 M 70 26 L 78 22 M 70 32 L 78 28" opacity="0.6" />
          <line x1="38" y1="55" x2="58" y2="55" opacity="0.4" />
          <line x1="38" y1="62" x2="58" y2="62" opacity="0.4" />
        </svg>
      );
    case 'oil': // motor oil - oil can
      return (
        <svg {...props}>
          <rect x="28" y="34" width="44" height="46" rx="2" />
          <rect x="40" y="22" width="20" height="12" rx="1" />
          <line x1="50" y1="22" x2="50" y2="18" />
          <text x="50" y="62" textAnchor="middle" fontSize="14" fontWeight="800" fill={color} stroke="none">OIL</text>
        </svg>
      );
    case 'drink': // drinks - soda can
      return (
        <svg {...props}>
          <rect x="32" y="20" width="36" height="62" rx="3" />
          <line x1="32" y1="28" x2="68" y2="28" />
          <line x1="32" y1="74" x2="68" y2="74" />
          <circle cx="42" cy="24" r="1.5" fill={color} stroke="none" />
          <path d="M 38 42 L 42 50 L 38 58 M 46 42 L 50 50 L 46 58 M 54 42 L 58 50 L 54 58" opacity="0.5" />
        </svg>
      );
    default:
      return <svg {...props}><circle cx="50" cy="50" r="30" /></svg>;
  }
}

function FeaturedProducts({ cart, addToCart, decCart, goProduct, user, onLoginClick }) {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Bestsellers', 'New', 'Deals', 'TOBACCO', 'NOVELTIES', 'CANDIES', 'DRINKS & BAGS'];
  
  const featuredIds = [61, 62, 64, 22, 36, 184, 165, 75, 76, 31, 240, 287, 142, 167, 312, 355];
  const featuredPool = featuredIds.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  const taggedItems = PRODUCTS.filter(p => p.tag);
  const featuredAll = [...new Set([...featuredPool, ...taggedItems])].slice(0, 12);

  const filtered = featuredAll.filter(p => {
    if (filter === 'All') return true;
    if (filter === 'Bestsellers') return p.tag === 'BESTSELLER';
    if (filter === 'New') return p.tag === 'NEW';
    if (filter === 'Deals') return p.tag === 'DEAL';
    return p.cat === filter;
  });
  return (
    <section id="products" className="px-3 md:px-6 lg:px-10 py-10 md:py-20" style={{ background: 'white' }}>
      <div className="max-w-[1400px] mx-auto">
        <SectionHead eyebrow="02 / TOP PRODUCTS" title="What's flying off the shelves"
                     blurb="Featured items every retailer is restocking this week. Sign in to see live wholesale pricing." />

        <div className="flex gap-2 overflow-x-auto scrollx mt-6 md:mt-8 pb-2 -mx-3 md:mx-0 px-3 md:px-0">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
                    className="shrink-0 px-3 md:px-4 py-2 text-[10px] md:text-xs uppercase font-bold transition-all"
                    style={{
                      ...mono, letterSpacing: '0.12em',
                      background: filter === f ? C.navy : C.bg,
                      color: filter === f ? 'white' : C.text,
                      border: `1px solid ${filter === f ? C.navy : C.border}`
                    }}>
              {f}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-5 mt-6 md:mt-8">
          {filtered.map((p, i) => (
            <ProductCard key={p.id} p={p} qty={cart[p.id] || 0} addToCart={addToCart} decCart={decCart} idx={i} goProduct={goProduct} user={user} onLoginClick={onLoginClick} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20" style={{ color: C.muted }}>No products match this filter.</div>
        )}
      </div>
    </section>
  );
}

function ProductCard({ p, qty, addToCart, decCart, idx, goProduct, user, onLoginClick }) {
  const [hover, setHover] = useState(false);
  const tagStyle = {
    BESTSELLER: { bg: C.navy,    fg: 'white' },
    NEW:        { bg: C.orange,  fg: 'white' },
    DEAL:       { bg: C.yellow,  fg: C.navy  },
    PREMIUM:    { bg: C.greenTag,fg: 'white' }
  };
  return (
    <div className="group fade-in relative flex flex-col transition-all hover:shadow-xl hover:-translate-y-1"
         style={{ background: 'white', border: `1px solid ${C.border}`, animationDelay: `${idx * 0.03}s` }}
         onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button onClick={() => goProduct(p.id)} className="relative aspect-square overflow-hidden flex items-center justify-center w-full" style={{ background: '#FAFAFA' }}>
        {p.img ? (
          <img src={p.img} alt={p.name}
               className="w-full h-full object-contain transition-transform group-hover:scale-105"
               style={{ padding: 12, transitionDuration: '400ms' }} />
        ) : (
          <TextCard name={p.name} cat={p.cat} />
        )}
        {p.tag && (
          <div className="absolute top-2 left-2 md:top-3 md:left-3 px-1.5 md:px-2 py-0.5 md:py-1 text-[8px] md:text-[9px] uppercase font-bold"
               style={{ ...mono, letterSpacing: '0.2em', background: tagStyle[p.tag].bg, color: tagStyle[p.tag].fg }}>
            {p.tag}
          </div>
        )}
        {p.flavors > 1 && (
          <div className="absolute bottom-2 left-2 md:bottom-3 md:left-3 px-1.5 md:px-2 py-0.5 md:py-1 text-[8px] md:text-[9px] uppercase font-bold"
               style={{ ...mono, letterSpacing: '0.18em', background: 'white', color: C.navy, border: `1px solid ${C.border}` }}>
            {p.flavors} flavors
          </div>
        )}
        <div className={`hidden md:flex absolute inset-x-0 bottom-0 items-center justify-center gap-1.5 py-2.5 text-[10px] uppercase font-bold transition-transform ${hover ? 'translate-y-0' : 'translate-y-full'}`}
             style={{ ...mono, letterSpacing: '0.2em', background: 'rgba(0,0,0,0.85)', color: 'white' }}>
          <Eye size={12} /> Quick View
        </div>
      </button>

      <div className="p-2.5 md:p-4 flex flex-col flex-1">
        <div style={{ ...mono, fontWeight: 600 }} className="text-[9px] md:text-[10px] uppercase mb-1 truncate">
          <span style={{ color: C.muted, letterSpacing: '0.12em' }}>{p.cat}</span>
        </div>
        <button onClick={() => goProduct(p.id)} className="text-left flex-1">
          <h4 className="text-xs md:text-[15px] font-semibold leading-snug mb-1 line-clamp-2 hover:text-[#DB6433] transition-colors" style={{ ...display, color: C.navy }}>
            {p.name}
          </h4>
        </button>
        {p.flavors > 0 && (
          <div className="text-[10px] md:text-xs mb-2 md:mb-3" style={{ color: C.muted }}>
            {p.flavors} flavor{p.flavors === 1 ? '' : 's'} available
          </div>
        )}
        {p.flavors === 0 && (
          <div className="text-[10px] md:text-xs mb-2 md:mb-3" style={{ color: C.muted }}>
            Single variant
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          {user ? (
            <div style={{ ...display, fontWeight: 800, color: C.orange }} className="text-base md:text-xl leading-none">
              ${p.price.toFixed(2)}
            </div>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onLoginClick && onLoginClick(); }}
                    style={{ ...mono, letterSpacing: '0.1em', fontWeight: 700, color: C.orange }}
                    className="text-[10px] md:text-xs uppercase hover:underline text-left">
              Sign in for price
            </button>
          )}
          {qty === 0 ? (
            <button onClick={() => addToCart(p.id)} aria-label="Add to quote"
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 md:px-3 h-8 md:h-9 text-[10px] md:text-[11px] uppercase font-bold transition-colors"
                    style={{ ...mono, letterSpacing: '0.12em', background: C.navy, color: 'white' }}>
              <Plus size={13} /> Add
            </button>
          ) : (
            <div className="flex items-center" style={{ border: `1px solid ${C.orange}` }}>
              <button onClick={() => decCart(p.id)} className="w-7 h-8 md:h-9 flex items-center justify-center" aria-label="Decrease"><Minus size={11} style={{ color: C.orange }} /></button>
              <span className="px-1.5 text-xs md:text-sm font-bold" style={{ ...mono, color: C.orange, minWidth: 18, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => addToCart(p.id)} className="w-7 h-8 md:h-9 flex items-center justify-center" aria-label="Increase"><Plus size={11} style={{ color: C.orange }} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TextCard({ name, cat }) {
  const palettes = {
    'TOBACCO':       ['#3A1F1A', '#8C6F3D'],
    'NOVELTIES':     ['#2D1A4A', '#9333EA'],
    'MERCHANDISE':   ['#1A1A1A', '#DB6433'],
    'CANDIES':       ['#A0282E', '#F59E0B'],
    'FOOD STUFF':    ['#1F4A3D', '#10B981'],
    'GROCERY':       ['#1F4A2A', '#22C55E'],
    'MOTOR OIL':     ['#1F2A1A', '#EF4444'],
    'DRINKS & BAGS': ['#1F2A4A', '#0EA5E9']
  };
  const [c1, c2] = palettes[cat] || ['#333', '#777'];
  const short = name.length > 16 ? name.split(' ').slice(0, 2).join(' ') : name;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center"
         style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}>
      <div className="absolute inset-0 opacity-25"
           style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5), transparent 60%)' }} />
      <div style={{ ...mono, color: 'rgba(255,255,255,0.65)', fontWeight: 600, letterSpacing: '0.25em' }}
           className="relative text-[9px] md:text-[10px] uppercase mb-2">
        {cat}
      </div>
      <div style={{ ...display, color: 'white', fontWeight: 800 }}
           className="relative text-lg md:text-2xl leading-tight">
        {short}
      </div>
    </div>
  );
}

function ProductPage({ productId, cart, addToCart, decCart, goProduct, goHome, goCategory, user, onLoginClick }) {
  const p = PRODUCTS.find(x => x.id === productId);
  const [qty, setQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [added, setAdded] = useState(false);

  if (!p) {
    return (
      <section className="px-3 md:px-6 lg:px-10 py-20 text-center">
        <p style={{ color: C.muted }}>Product not found.</p>
        <button onClick={goHome} className="mt-4 text-sm underline" style={{ color: C.orange }}>← Back to home</button>
      </section>
    );
  }

  const inCart = cart[p.id] || 0;
  const related = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4);
  const handleAdd = () => {
    addToCart(p.id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <section className="px-3 md:px-6 lg:px-10 py-5 md:py-10">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2 text-[11px] md:text-xs uppercase mb-5 md:mb-8 flex-wrap"
             style={{ ...mono, letterSpacing: '0.12em', fontWeight: 600 }}>
          <button onClick={goHome} className="hover:text-[#DB6433] transition-colors" style={{ color: C.muted }}>Home</button>
          <ChevronRight size={11} style={{ color: C.muted }} />
          <button onClick={() => goCategory(p.cat)} className="hover:text-[#DB6433] transition-colors" style={{ color: C.muted }}>{p.cat}</button>
          <ChevronRight size={11} style={{ color: C.muted }} />
          <span className="truncate" style={{ color: C.navy }}>{p.name}</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 md:gap-12">
          <div className="aspect-square overflow-hidden flex items-center justify-center relative"
               style={{ background: 'white', border: `1px solid ${C.border}` }}>
            {p.img ? (
              <img src={p.img} alt={p.name} className="w-full h-full object-contain" style={{ padding: 24 }} />
            ) : (
              <TextCard name={p.name} cat={p.cat} />
            )}
            {p.tag && (
              <div className="absolute top-4 left-4 px-3 py-1.5 text-[10px] uppercase font-bold"
                   style={{ ...mono, letterSpacing: '0.2em',
                            background: p.tag === 'BESTSELLER' ? C.navy : p.tag === 'NEW' ? C.orange : p.tag === 'DEAL' ? C.yellow : C.greenTag,
                            color: p.tag === 'DEAL' ? C.navy : 'white' }}>
                {p.tag}
              </div>
            )}
          </div>

          <div className="flex flex-col">
            <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.25em', color: C.orange }} className="text-[10px] md:text-[11px] uppercase mb-2 md:mb-3">
              {p.cat} · {p.sub}
            </div>
            <h1 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-2xl md:text-4xl lg:text-5xl leading-tight mb-3 md:mb-4">
              {p.name}
            </h1>
            <div className="flex items-center gap-3 mb-5 md:mb-6 flex-wrap">
              <div style={{ ...mono, fontWeight: 600, letterSpacing: '0.1em', color: C.muted }} className="text-[11px] uppercase">
                SKU · {p.sku}
              </div>
              <span style={{ color: C.border }}>·</span>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.greenTag }}>
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: C.greenTag }} />
                In Stock
              </div>
            </div>

            {/* Pricing — gated */}
            <div className="mb-5 md:mb-6 pb-5 md:pb-6 border-b" style={{ borderColor: C.border }}>
              {user ? (
                <>
                  <div style={{ ...mono, letterSpacing: '0.25em', fontWeight: 700, color: C.muted }} className="text-[10px] uppercase mb-2">
                    Wholesale Price
                  </div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <div style={{ ...display, fontWeight: 800, color: C.orange }} className="text-4xl md:text-5xl leading-none">
                      ${p.price.toFixed(2)}
                    </div>
                    <div className="text-xs md:text-sm" style={{ color: C.muted }}>per unit · volume discounts at quote</div>
                  </div>
                </>
              ) : (
                <div className="p-4 md:p-5" style={{ background: C.orangeLite, border: `2px dashed ${C.orange}` }}>
                  <div className="flex items-start gap-3">
                    <Users size={22} style={{ color: C.orange, flexShrink: 0, marginTop: 2 }} />
                    <div className="flex-1">
                      <div style={{ ...display, fontWeight: 800, color: C.navy }} className="text-lg md:text-xl mb-1">
                        Sign in to see pricing
                      </div>
                      <div className="text-xs md:text-sm mb-3" style={{ color: C.muted }}>
                        Wholesale prices are visible only to approved retail partners.
                      </div>
                      <button onClick={onLoginClick}
                              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase font-bold transition-transform hover:scale-[1.02]"
                              style={{ ...mono, letterSpacing: '0.18em', background: C.orange, color: 'white' }}>
                        Sign In <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Variants */}
            {p.variants && p.variants.length > 0 && (
              <div className="mb-5 md:mb-6">
                <div style={{ ...mono, fontWeight: 600, letterSpacing: '0.2em', color: C.muted }} className="text-[10px] uppercase mb-2 md:mb-3">
                  {p.variants.length === 1 ? 'Variant' : `${p.flavors} Flavors Available`}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.variants.map(v => (
                    <button key={v} onClick={() => setSelectedVariant(selectedVariant === v ? null : v)}
                            className="px-3 py-1.5 text-xs md:text-sm transition-all"
                            style={{
                              background: selectedVariant === v ? C.navy : 'white',
                              color: selectedVariant === v ? 'white' : C.text,
                              border: `1px solid ${selectedVariant === v ? C.navy : C.border}`,
                              fontWeight: 500
                            }}>
                      {v}
                    </button>
                  ))}
                  {p.flavors > p.variants.length && (
                    <span className="px-3 py-1.5 text-xs md:text-sm" style={{ color: C.muted, ...mono }}>
                      +{p.flavors - p.variants.length} more
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="flex items-center" style={{ border: `2px solid ${C.navy}`, height: 52 }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-12 h-full flex items-center justify-center hover:bg-gray-50" aria-label="Decrease quantity">
                  <Minus size={16} style={{ color: C.navy }} />
                </button>
                <span style={{ ...mono, fontWeight: 700, color: C.navy }} className="px-4 text-base min-w-[3ch] text-center">{qty}</span>
                <button onClick={() => setQty(q => q + 1)} className="w-12 h-full flex items-center justify-center hover:bg-gray-50" aria-label="Increase quantity">
                  <Plus size={16} style={{ color: C.navy }} />
                </button>
              </div>
              <button onClick={handleAdd}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 text-xs md:text-sm uppercase font-bold transition-all hover:scale-[1.01]"
                      style={{ ...mono, letterSpacing: '0.2em', background: added ? C.greenTag : C.orange, color: 'white', height: 52 }}>
                {added ? <>✓ Added</> : <>Add to Cart <ArrowRight size={14} /></>}
              </button>
            </div>
            {inCart > 0 && (
              <div className="text-xs mb-5" style={{ ...mono, color: C.muted, letterSpacing: '0.05em' }}>
                Already in cart: <strong style={{ color: C.orange }}>{inCart}</strong>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 md:gap-3 pt-5 md:pt-6 border-t" style={{ borderColor: C.border }}>
              {[
                { icon: Truck, t: 'Free $1.5K+' },
                { icon: ShieldCheck, t: 'Authentic' },
                { icon: Clock, t: 'Will-Call' }
              ].map((it, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] md:text-xs" style={{ color: C.muted }}>
                  <it.icon size={14} style={{ color: C.orange }} />
                  <span style={{ ...mono, fontWeight: 600 }}>{it.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-12 md:mt-20">
            <div className="flex items-end justify-between mb-6 md:mb-8 gap-4">
              <div>
                <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em' }} className="text-[10px] md:text-[11px] uppercase mb-2">
                  <span style={{ color: C.orange }}>RELATED</span>
                </div>
                <h2 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-2xl md:text-3xl">
                  More from {p.cat}
                </h2>
              </div>
              <button onClick={() => goCategory(p.cat)}
                 className="hidden md:inline-flex items-center gap-2 text-xs uppercase font-bold transition-colors hover:text-[#DB6433]"
                 style={{ ...mono, letterSpacing: '0.18em', color: C.navy }}>
                View all {p.cat} <ArrowRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-5">
              {related.map((r, i) => (
                <ProductCard key={r.id} p={r} qty={cart[r.id] || 0} addToCart={addToCart} decCart={decCart} idx={i} goProduct={goProduct} user={user} onLoginClick={onLoginClick} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CategoryPage({ category, cart, addToCart, decCart, goProduct, goHome, user, onLoginClick }) {
  const inCat = PRODUCTS.filter(p => p.cat === category);
  const subCats = Array.from(new Set(inCat.map(p => p.sub))).sort();
  const tagOptions = ['Bestsellers', 'New', 'Deals', 'Premium'];

  const [activeSub, setActiveSub] = useState('All');
  const [tagFilter, setTagFilter] = useState([]);
  const [hasFlavors, setHasFlavors] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [sort, setSort] = useState('featured');
  const [showFilters, setShowFilters] = useState(false);

  const toggle = (arr, setArr, val) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  let filtered = inCat.filter(p => {
    if (activeSub !== 'All' && p.sub !== activeSub) return false;
    if (tagFilter.length) {
      const tagMap = { Bestsellers: 'BESTSELLER', New: 'NEW', Deals: 'DEAL', Premium: 'PREMIUM' };
      if (!tagFilter.some(t => p.tag === tagMap[t])) return false;
    }
    if (hasFlavors && p.flavors === 0) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.variants || []).some(v => v.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  if (sort === 'name-asc') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name-desc') filtered = [...filtered].sort((a, b) => b.name.localeCompare(a.name));
  if (sort === 'flavors') filtered = [...filtered].sort((a, b) => b.flavors - a.flavors);
  if (sort === 'price-low' && user) filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (sort === 'price-high' && user) filtered = [...filtered].sort((a, b) => b.price - a.price);

  const clearFilters = () => { setActiveSub('All'); setTagFilter([]); setHasFlavors(false); setSearchQ(''); };
  const activeFilterCount = (activeSub !== 'All' ? 1 : 0) + tagFilter.length + (hasFlavors ? 1 : 0) + (searchQ ? 1 : 0);

  const cat = SHOP_CATS.find(c => c.name === category);

  return (
    <section className="px-3 md:px-6 lg:px-10 py-5 md:py-10">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2 text-[11px] md:text-xs uppercase mb-5 md:mb-6"
             style={{ ...mono, letterSpacing: '0.12em', fontWeight: 600 }}>
          <button onClick={goHome} className="hover:text-[#DB6433] transition-colors" style={{ color: C.muted }}>Home</button>
          <ChevronRight size={11} style={{ color: C.muted }} />
          <span style={{ color: C.navy }}>{category}</span>
        </div>

        <div className="relative overflow-hidden p-6 md:p-12 mb-6 md:mb-8"
             style={{ background: cat ? `linear-gradient(110deg, ${cat.color[0]} 0%, ${cat.color[1]} 100%)` : C.navy }}>
          <div className="absolute inset-0 opacity-25"
               style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 60%)' }} />
          {cat && (
            <div className="absolute right-6 md:right-12 top-1/2 -translate-y-1/2 opacity-30 hidden md:block">
              <CategoryIcon name={cat.icon} size={180} color="white" />
            </div>
          )}
          <div className="relative z-10">
            <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em', color: 'white', opacity: 0.85 }} className="text-[10px] md:text-[11px] uppercase mb-2 md:mb-3">
              CATEGORY · {inCat.length} PRODUCTS · {subCats.length} SUB-CATEGORIES
            </div>
            <h1 style={{ ...display, fontWeight: 800, color: 'white' }} className="text-3xl md:text-5xl lg:text-6xl leading-tight">
              {category}
            </h1>
            <p className="text-white/85 mt-2 md:mt-3 max-w-xl text-sm md:text-base">
              Browse {inCat.length} {category.toLowerCase()} products. Use filters to narrow your selection.
            </p>
          </div>
        </div>

        {/* Sub-category chips */}
        <div className="flex gap-2 overflow-x-auto scrollx mb-5 md:mb-6 pb-2 -mx-3 md:mx-0 px-3 md:px-0">
          {['All', ...subCats].map(s => {
            const count = s === 'All' ? inCat.length : inCat.filter(p => p.sub === s).length;
            return (
              <button key={s} onClick={() => setActiveSub(s)}
                      className="shrink-0 px-3 md:px-4 py-2 text-[10px] md:text-xs uppercase font-bold transition-all flex items-center gap-1.5"
                      style={{
                        ...mono, letterSpacing: '0.1em',
                        background: activeSub === s ? C.orange : 'white',
                        color: activeSub === s ? 'white' : C.navy,
                        border: `1px solid ${activeSub === s ? C.orange : C.border}`
                      }}>
                {s} <span style={{ opacity: 0.65, fontSize: '0.85em' }}>({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 mb-4 md:mb-6 flex-wrap">
          <button onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden inline-flex items-center gap-2 px-4 py-2 text-xs uppercase font-bold relative"
                  style={{ ...mono, letterSpacing: '0.15em', background: C.navy, color: 'white' }}>
            <Menu size={14} /> Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold"
                    style={{ background: C.orange, color: 'white' }}>{activeFilterCount}</span>
            )}
          </button>
          <div className="text-xs uppercase" style={{ ...mono, letterSpacing: '0.1em', color: C.muted, fontWeight: 600 }}>
            Showing <span style={{ color: C.navy }}>{filtered.length}</span> of <span style={{ color: C.navy }}>{inCat.length}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden md:inline text-[11px] uppercase" style={{ ...mono, letterSpacing: '0.15em', color: C.muted, fontWeight: 600 }}>Sort by</span>
            <select value={sort} onChange={e => setSort(e.target.value)}
                    className="text-xs px-3 py-2 outline-none cursor-pointer"
                    style={{ ...mono, fontWeight: 600, background: 'white', border: `1px solid ${C.border}`, color: C.text }}>
              <option value="featured">Featured</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
              <option value="flavors">Most Variants</option>
              {user && <option value="price-low">Price: Low to High</option>}
              {user && <option value="price-high">Price: High to Low</option>}
            </select>
          </div>
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-6 md:gap-8">
          <aside className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
            <div className="space-y-6 md:sticky md:top-24">
              <div className="flex items-center justify-between">
                <h3 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-base md:text-lg">Filters</h3>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} className="text-[11px] uppercase font-bold transition-colors hover:text-[#DB6433]" style={{ ...mono, letterSpacing: '0.15em', color: C.muted }}>
                    Clear all
                  </button>
                )}
              </div>

              <div>
                <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.2em', color: C.navy }} className="text-[11px] uppercase mb-3 pb-2 border-b">
                  Search in {category}
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
                  <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                         placeholder="Item name, flavor..."
                         className="w-full h-9 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#DB6433]"
                         style={{ background: 'white', border: `1px solid ${C.border}` }} />
                </div>
              </div>

              <div>
                <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.2em', color: C.navy }} className="text-[11px] uppercase mb-3 pb-2 border-b">
                  Featured
                </div>
                <div className="space-y-2">
                  {tagOptions.map(t => (
                    <label key={t} className="flex items-center gap-2.5 cursor-pointer text-sm hover:text-[#DB6433] transition-colors">
                      <input type="checkbox" checked={tagFilter.includes(t)} onChange={() => toggle(tagFilter, setTagFilter, t)}
                             className="w-4 h-4 cursor-pointer" style={{ accentColor: C.orange }} />
                      <span style={{ color: C.text }}>{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.2em', color: C.navy }} className="text-[11px] uppercase mb-3 pb-2 border-b">
                  Variants
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer text-sm hover:text-[#DB6433] transition-colors">
                  <input type="checkbox" checked={hasFlavors} onChange={() => setHasFlavors(!hasFlavors)}
                         className="w-4 h-4 cursor-pointer" style={{ accentColor: C.orange }} />
                  <span style={{ color: C.text }}>Multiple flavors only</span>
                </label>
              </div>

              {!user && (
                <div className="p-4" style={{ background: C.orangeLite, border: `1px dashed ${C.orange}` }}>
                  <div style={{ ...display, fontWeight: 800, color: C.navy }} className="text-sm mb-1">
                    See pricing
                  </div>
                  <div className="text-[11px] mb-3" style={{ color: C.muted }}>
                    Sign in to view live wholesale prices on all SKUs.
                  </div>
                  <button onClick={onLoginClick}
                          className="w-full py-2 text-[10px] uppercase font-bold"
                          style={{ ...mono, letterSpacing: '0.18em', background: C.orange, color: 'white' }}>
                    Sign In
                  </button>
                </div>
              )}
            </div>
          </aside>

          <div>
            {filtered.length === 0 ? (
              <div className="text-center py-16 md:py-20" style={{ background: 'white', border: `1px solid ${C.border}` }}>
                <p style={{ color: C.muted }} className="mb-4">No products match these filters.</p>
                <button onClick={clearFilters} className="text-sm font-bold underline" style={{ color: C.orange }}>Clear all filters</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-2.5 md:gap-5">
                {filtered.map((p, i) => (
                  <ProductCard key={p.id} p={p} qty={cart[p.id] || 0} addToCart={addToCart} decCart={decCart} idx={i} goProduct={goProduct} user={user} onLoginClick={onLoginClick} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function QuotePage({ items, total, addToCart, decCart, removeCart, clearCart, goHome, user, profile }) {
  const [step, setStep] = useState('review');
  const [data, setData] = useState({
    business: user?.business || '', contact: user?.name || '', email: user?.email || '', phone: '', notes: '',
    delivery: 'delivery', preferredDate: ''
  });
  const set = k => e => setData({ ...data, [k]: e.target.value });
  const [refNum] = useState(`ALW-Q-${Math.floor(Math.random() * 90000) + 10000}`);
  const [submitError, setSubmitError] = useState(null);
  const [sending, setSending] = useState(false);
  const totalUnits = items.reduce((s, i) => s + i.qty, 0);

  const handleQuoteSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setSubmitError(null);
    const itemsText = items.map(it =>
      `${it.qty} × ${it.name} (${it.sku})${user ? ` @ $${it.price.toFixed(2)}` : ''}`
    ).join('\n');

    // Try Supabase first (creates an orders row + line items the trade rep can
    // see in the admin dashboard). Always also POST to Netlify Forms so any
    // inbox/Slack notification rule still fires. We treat the submission as
    // successful if EITHER path lands the lead.
    let supaOk = false;
    try {
      const r = await submitOrder({
        profile, refNum, formData: data, items,
        totalUnits, subtotal: user ? total : null,
      });
      supaOk = r.source === 'supabase' && r.ok;
    } catch (err) {
      console.warn('Supabase order submit failed, falling back to Netlify Forms', err);
    }

    try {
      const res = await submitNetlifyForm('quote', {
        ...data,
        refNum,
        accountType: user ? 'signed-in' : 'guest',
        items: itemsText,
        totalUnits,
        subtotal: user ? total.toFixed(2) : 'pending'
      });
      if (!supaOk && !res.ok) throw new Error(`Submission failed (${res.status})`);
      setStep('submitted');
      window.scrollTo(0, 0);
    } catch (err) {
      if (supaOk) {
        // DB has the order; Netlify failure is non-fatal.
        setStep('submitted');
        window.scrollTo(0, 0);
      } else {
        setSubmitError(`We couldn't reach our server. Please call ${COMPANY.phone} or email ${COMPANY.email} and reference ${refNum}.`);
      }
    } finally {
      setSending(false);
    }
  };

  if (items.length === 0 && step === 'review') {
    return (
      <section className="px-3 md:px-6 lg:px-10 py-16 md:py-24">
        <div className="max-w-xl mx-auto text-center" style={{ background: 'white', border: `1px solid ${C.border}`, padding: '3rem 2rem' }}>
          <ShoppingCart size={40} style={{ color: C.mutedSoft, margin: '0 auto' }} />
          <h2 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-2xl md:text-3xl mt-5 mb-2">Your cart is empty</h2>
          <p className="text-sm md:text-base mb-6" style={{ color: C.muted }}>Add products, then come back to checkout.</p>
          <button onClick={goHome}
                  className="inline-flex items-center gap-2 px-7 py-3 text-xs uppercase font-bold transition-transform hover:scale-[1.02]"
                  style={{ ...mono, letterSpacing: '0.18em', background: C.orange, color: 'white' }}>
            Browse Catalog <ArrowRight size={14} />
          </button>
        </div>
      </section>
    );
  }

  if (step === 'submitted') {
    return (
      <section className="px-3 md:px-6 lg:px-10 py-12 md:py-20">
        <div className="max-w-2xl mx-auto text-center p-8 md:p-14" style={{ background: 'white', border: `2px solid ${C.orange}` }}>
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-6" style={{ background: C.orange }}>
            <ArrowRight size={26} style={{ color: 'white' }} />
          </div>
          <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em', color: C.orange }} className="text-[11px] uppercase mb-2">
            {user ? 'Order received' : 'Quote received'}
          </div>
          <h2 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-3xl md:text-4xl mb-4 leading-tight">
            Thank you, {data.contact || 'partner'}.
          </h2>
          <p className="text-sm md:text-base leading-relaxed mb-6" style={{ color: C.muted, maxWidth: '50ch', margin: '0 auto 1.5rem' }}>
            {user ? `Your order has been placed.` : `Your quote request has been submitted.`} A trade desk rep will reach out within one business day at <strong style={{ color: C.navy }}>{data.phone || data.email}</strong> to confirm details.
          </p>
          <div className="inline-block p-4 mb-6" style={{ background: C.bg, border: `1px dashed ${C.border}` }}>
            <div style={{ ...mono, fontWeight: 600, letterSpacing: '0.25em', color: C.muted }} className="text-[10px] uppercase mb-1">
              Reference Number
            </div>
            <div style={{ ...mono, fontWeight: 700, color: C.navy, letterSpacing: '0.1em' }} className="text-lg">
              {refNum}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={`tel:${COMPANY.phoneRaw}`}
               className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs uppercase font-bold"
               style={{ ...mono, letterSpacing: '0.18em', background: C.navy, color: 'white' }}>
              <Phone size={14} /> Call to Discuss
            </a>
            <button onClick={() => { clearCart(); goHome(); }}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs uppercase font-bold border-2"
                    style={{ ...mono, letterSpacing: '0.18em', borderColor: C.navy, color: C.navy }}>
              Back to Home
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-3 md:px-6 lg:px-10 py-5 md:py-10">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2 text-[11px] md:text-xs uppercase mb-5"
             style={{ ...mono, letterSpacing: '0.12em', fontWeight: 600 }}>
          <button onClick={goHome} className="hover:text-[#DB6433] transition-colors" style={{ color: C.muted }}>Home</button>
          <ChevronRight size={11} style={{ color: C.muted }} />
          <span style={{ color: C.navy }}>{user ? 'Checkout' : 'Request Quote'}</span>
        </div>

        <div className="mb-6 md:mb-10">
          <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em' }} className="text-[10px] md:text-[11px] uppercase mb-2">
            <span style={{ color: C.orange }}>★ {user ? 'CHECKOUT' : 'QUOTE REQUEST'}</span>
          </div>
          <h1 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-3xl md:text-5xl leading-tight mb-3">
            {user ? 'Place your order' : 'Request your quote'}
          </h1>
          <p className="text-sm md:text-base leading-relaxed max-w-2xl" style={{ color: C.muted }}>
            {user
              ? 'Review your items and submit. A trade desk rep will confirm freight and delivery details within one business day.'
              : 'Review your items and submit. A trade desk rep will confirm pricing, availability, freight, and delivery within one business day.'}
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-6 md:gap-10">
          <div>
            <div className="mb-8" style={{ background: 'white', border: `1px solid ${C.border}` }}>
              <div className="p-4 md:p-5 border-b flex items-center justify-between" style={{ borderColor: C.border, background: C.bg }}>
                <h3 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-base md:text-lg">
                  {items.length} item{items.length === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'}
                </h3>
                <button onClick={clearCart} className="text-[11px] uppercase font-bold transition-colors hover:text-[#DB6433]"
                        style={{ ...mono, letterSpacing: '0.15em', color: C.muted }}>
                  Clear all
                </button>
              </div>
              <ul>
                {items.map(it => (
                  <li key={it.id} className="p-4 md:p-5 flex gap-3 md:gap-4 border-b last:border-b-0" style={{ borderColor: C.borderSoft }}>
                    <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 flex items-center justify-center relative overflow-hidden" style={{ background: '#FAFAFA', border: `1px solid ${C.borderSoft}` }}>
                      {it.img ? <img src={it.img} alt="" className="w-full h-full object-contain" style={{ padding: 6 }} /> : <TextCard name={it.name} cat={it.cat} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ ...mono, fontWeight: 600, letterSpacing: '0.1em', color: C.muted }} className="text-[10px] uppercase mb-0.5">{it.cat}</div>
                      <div style={{ ...display, fontWeight: 700, color: C.navy }} className="text-sm md:text-[15px] leading-tight mb-1">{it.name}</div>
                      <div className="text-[11px] md:text-xs" style={{ color: C.muted }}>
                        SKU · {it.sku}{user && ` · $${it.price.toFixed(2)} each`}
                      </div>
                      <div className="flex items-center justify-between mt-2 md:mt-3 gap-2">
                        <div className="flex items-center" style={{ border: `1px solid ${C.border}` }}>
                          <button onClick={() => decCart(it.id)} className="w-7 h-7 flex items-center justify-center" aria-label="Decrease"><Minus size={11} /></button>
                          <span style={{ ...mono, fontWeight: 700 }} className="text-xs px-2">{it.qty}</span>
                          <button onClick={() => addToCart(it.id)} className="w-7 h-7 flex items-center justify-center" aria-label="Increase"><Plus size={11} /></button>
                        </div>
                        <div className="flex items-center gap-3">
                          {user && (
                            <div style={{ ...display, fontWeight: 800, color: C.orange }} className="text-sm md:text-base">
                              ${(it.qty * it.price).toFixed(2)}
                            </div>
                          )}
                          <button onClick={() => removeCart(it.id)} aria-label="Remove" className="hover:text-[#DB6433] transition-colors flex items-center gap-1 text-[11px] uppercase" style={{ ...mono, letterSpacing: '0.15em', color: C.mutedSoft, fontWeight: 600 }}>
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleQuoteSubmit}
                  name="quote" data-netlify="true" netlify-honeypot="bot-field">
              <input type="hidden" name="form-name" value="quote" />
              <p className="hidden"><label>Don&apos;t fill this out: <input name="bot-field" tabIndex={-1} /></label></p>
              <h3 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-xl md:text-2xl mb-4 md:mb-5">
                Your contact info
              </h3>
              <div className="grid sm:grid-cols-2 gap-3 md:gap-4 mb-5" style={{ background: 'white', padding: '1.5rem', border: `1px solid ${C.border}` }}>
                <Field name="business" label="Business Name" value={data.business} onChange={set('business')} required />
                <Field name="contact"  label="Contact Name"  value={data.contact}  onChange={set('contact')}  required />
                <Field name="email"    label="Email"         value={data.email}    onChange={set('email')}    type="email" required />
                <Field name="phone"    label="Phone"         value={data.phone}    onChange={set('phone')}    type="tel" required />
                <FieldSelect name="delivery" label="Fulfillment" value={data.delivery} onChange={set('delivery')}
                             options={[['delivery','Delivery'], ['willcall','Will-Call Pickup']]} />
                <Field name="preferredDate" label="Preferred Date" value={data.preferredDate} onChange={set('preferredDate')} type="date" />
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase mb-2 block" style={{ ...mono, letterSpacing: '0.22em', fontWeight: 600, color: C.muted }}>
                    Additional Notes
                  </label>
                  <textarea name="notes" value={data.notes} onChange={set('notes')} rows={3}
                            placeholder="Tell us about volume needs, recurring orders, or special requests..."
                            className="w-full p-3 outline-none text-sm transition-colors focus:border-[#DB6433]"
                            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, ...body }} />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button type="submit" disabled={sending}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 text-xs md:text-sm uppercase font-bold transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
                        style={{ ...mono, letterSpacing: '0.2em', background: C.orange, color: 'white' }}>
                  {sending ? 'Sending…' : <>{user ? 'Place Order' : 'Submit Quote Request'} <ArrowRight size={15} /></>}
                </button>
                <button type="button" onClick={goHome}
                        className="inline-flex items-center justify-center gap-2 px-6 py-4 text-xs md:text-sm uppercase font-bold border-2"
                        style={{ ...mono, letterSpacing: '0.2em', borderColor: C.navy, color: C.navy }}>
                  Continue Shopping
                </button>
              </div>
              {submitError && (
                <div className="mt-4 px-4 py-3 text-xs leading-relaxed"
                     style={{ background: '#FFF5EC', border: `1px solid ${C.orange}`, color: C.navy }}>
                  {submitError}
                </div>
              )}
            </form>
          </div>

          <aside>
            <div className="lg:sticky lg:top-24" style={{ background: C.navy, color: 'white', padding: '1.5rem 1.5rem 2rem' }}>
              <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em', color: C.orange }} className="text-[11px] uppercase mb-4">
                {user ? 'ORDER SUMMARY' : 'QUOTE SUMMARY'}
              </div>
              <div className="space-y-3 mb-5">
                <div className="flex justify-between text-sm" style={{ opacity: 0.9 }}>
                  <span>Total items</span>
                  <span style={{ ...mono, fontWeight: 700 }}>{items.length}</span>
                </div>
                <div className="flex justify-between text-sm" style={{ opacity: 0.9 }}>
                  <span>Total units</span>
                  <span style={{ ...mono, fontWeight: 700 }}>{totalUnits}</span>
                </div>
                {user && (
                  <div className="flex justify-between text-sm" style={{ opacity: 0.9 }}>
                    <span>Subtotal</span>
                    <span style={{ ...mono, fontWeight: 700 }}>${total.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                <div style={{ ...mono, letterSpacing: '0.2em', fontWeight: 600, color: C.orange }} className="text-[10px] uppercase mb-2">Estimated total</div>
                <div style={{ ...display, fontWeight: 800 }} className="text-3xl mb-2">
                  {user ? `$${total.toFixed(2)}` : 'Pending Quote'}
                </div>
                <p className="text-[11px] leading-relaxed" style={{ ...mono, opacity: 0.8 }}>
                  Freight & tax confirmed in your final order.
                </p>
              </div>
              <div className="mt-6 pt-6 border-t space-y-2 text-xs" style={{ borderColor: 'rgba(255,255,255,0.15)', opacity: 0.85 }}>
                <div className="flex items-center gap-2"><ShieldCheck size={13} style={{ color: C.orange }} /> No payment until invoice</div>
                <div className="flex items-center gap-2"><Clock size={13} style={{ color: C.orange }} /> Reply within 1 business day</div>
                <div className="flex items-center gap-2"><Phone size={13} style={{ color: C.orange }} /> Or call {COMPANY.phone}</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', required, name }) {
  return (
    <div>
      <label className="text-[10px] uppercase mb-2 block" style={{ ...mono, letterSpacing: '0.22em', fontWeight: 600, color: C.muted }}>
        {label} {required && <span style={{ color: C.orange }}>*</span>}
      </label>
      <input type={type} name={name} value={value} onChange={onChange} required={required}
             className="w-full bg-transparent outline-none text-sm md:text-base pb-2 transition-colors focus:border-[#DB6433]"
             style={{ color: C.text, borderBottom: `1px solid ${C.border}` }} />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, name }) {
  return (
    <div>
      <label className="text-[10px] uppercase mb-2 block" style={{ ...mono, letterSpacing: '0.22em', fontWeight: 600, color: C.muted }}>{label}</label>
      <div className="relative">
        <select name={name} value={value} onChange={onChange}
                className="w-full bg-transparent outline-none text-sm md:text-base pb-2 appearance-none cursor-pointer"
                style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-0 top-1.5 pointer-events-none" style={{ color: C.orange }} />
      </div>
    </div>
  );
}

// =============================================================================
// DEAL BANNER
// =============================================================================
function DealBanner() {
  return (
    <section className="px-3 md:px-6 lg:px-10 py-10 md:py-12">
      <div className="max-w-[1400px] mx-auto relative overflow-hidden p-6 md:p-14 lg:p-16"
           style={{ background: `linear-gradient(110deg, ${C.orangeLite} 0%, white 100%)`, border: `1px solid ${C.border}` }}>
        <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
          <div>
            <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em' }} className="text-[10px] md:text-[11px] uppercase mb-3 md:mb-4">
              <span style={{ color: C.orange }}>★ THE ALABAMA WAY</span>
            </div>
            <h3 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-2xl md:text-5xl leading-tight mb-3 md:mb-4">
              Real prices.<br/><span style={{ color: C.orange }}>Real relationships.</span>
            </h3>
            <p className="text-sm md:text-base mb-5 md:mb-7 leading-relaxed" style={{ color: C.muted, maxWidth: '46ch' }}>
              We don&apos;t list prices online — we quote them. Every account gets pricing tailored to volume, frequency, and product mix. No surprises, no hidden fees, no inflated MSRP.
            </p>
            <div className="flex gap-3 flex-wrap">
              <a href="#apply" className="inline-flex items-center gap-2 px-5 md:px-6 py-3 text-[11px] md:text-xs uppercase font-bold"
                 style={{ ...mono, letterSpacing: '0.15em', background: C.navy, color: 'white' }}>
                Apply for Account <ArrowRight size={14} />
              </a>
              <a href={`tel:${COMPANY.phoneRaw}`} className="inline-flex items-center gap-2 px-5 md:px-6 py-3 text-[11px] md:text-xs uppercase font-bold border-2"
                 style={{ ...mono, letterSpacing: '0.15em', borderColor: C.navy, color: C.navy }}>
                <Phone size={14} /> Call Us
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {[
              { icon: 'ShieldCheck', t: 'Authentic SKUs', s: 'Direct from manufacturer' },
              { icon: 'Truck',       t: 'Free Delivery',  s: 'Orders $1,500+' },
              { icon: 'Clock',       t: 'Same-Day Pickup', s: 'Will-call by 11AM' },
              { icon: 'Tag',         t: 'Volume Discounts', s: 'Up to 18% off' }
            ].map((it, i) => {
              const Icon = { ShieldCheck, Truck, Clock, Tag }[it.icon];
              return (
                <div key={i} className="p-4 md:p-5 flex flex-col" style={{ background: 'white', border: `1px solid ${C.border}` }}>
                  <div className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center mb-3" style={{ background: C.orangeLite }}>
                    <Icon size={18} style={{ color: C.orange }} />
                  </div>
                  <div style={{ ...display, fontWeight: 700, color: C.navy }} className="text-sm md:text-base mb-0.5">{it.t}</div>
                  <div className="text-[11px] md:text-xs" style={{ color: C.muted }}>{it.s}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function BrandsStrip() {
  const doubled = [...BRANDS, ...BRANDS];
  return (
    <section className="py-10 md:py-12 border-y overflow-hidden" style={{ borderColor: C.border, background: 'white' }}>
      <div className="max-w-[1400px] mx-auto px-3 md:px-6 lg:px-10 mb-6 md:mb-8">
        <div style={{ ...mono, fontWeight: 600, letterSpacing: '0.3em' }} className="text-[10px] md:text-[11px] uppercase text-center">
          <span style={{ color: C.muted }}>★ STOCKED BRANDS · 200+ AND COUNTING ★</span>
        </div>
      </div>
      <div className="marquee flex gap-8 md:gap-12 whitespace-nowrap">
        {doubled.map((b, i) => (
          <div key={i} className="shrink-0 px-4 md:px-6 py-2 md:py-3 flex items-center" style={{ ...display, fontWeight: 800, color: C.navy }}>
            <span className="text-2xl md:text-4xl tracking-tight">{b}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// =============================================================================
// TRUST PILLARS
// =============================================================================
function TrustPillars() {
  const ICONS = { ShieldCheck, Truck, Tag, Users };
  return (
    <section className="px-3 md:px-6 lg:px-10 py-10 md:py-20" style={{ background: C.bg }}>
      <div className="max-w-[1400px] mx-auto">
        <SectionHead eyebrow="03 / WHY ALABAMA WHOLESALE"
                     title="What you get when you buy from us"
                     blurb="Three generations building direct manufacturer relationships so retailers across the Southeast spend less and stock smarter." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mt-8 md:mt-10">
          {TRUST.map((t, i) => {
            const Icon = ICONS[t.icon];
            return (
              <div key={i} className="p-5 md:p-8 transition-transform hover:-translate-y-1"
                   style={{ background: 'white', border: `1px solid ${C.border}` }}>
                <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center mb-4 md:mb-5" style={{ background: C.orangeLite }}>
                  <Icon size={20} style={{ color: C.orange }} />
                </div>
                <h4 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-base md:text-2xl mb-1.5 md:mb-2">{t.title}</h4>
                <p className="text-xs md:text-sm leading-relaxed" style={{ color: C.muted }}>{t.blurb}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// FAQ SECTION
// =============================================================================
function FAQ() {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <section id="faq" className="px-3 md:px-6 lg:px-10 py-10 md:py-20" style={{ background: 'white' }}>
      <div className="max-w-[1100px] mx-auto">
        <SectionHead eyebrow="06 / FAQ"
                     title="Common questions, clear answers"
                     blurb="Everything retailers ask before opening an account. Don't see your question? Call us at (205) 555-0199." />
        <div className="mt-8 md:mt-10 divide-y" style={{ background: C.bg, border: `1px solid ${C.border}`, borderColor: C.border }}>
          {FAQS.map((f, i) => (
            <div key={i} style={{ borderColor: C.border }}>
              <button onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
                      className="w-full flex items-center justify-between gap-4 px-5 md:px-7 py-4 md:py-5 text-left transition-colors hover:bg-white">
                <span style={{ ...display, fontWeight: 700, color: C.navy }} className="text-sm md:text-lg flex-1">
                  {f.q}
                </span>
                <span className="shrink-0 w-7 h-7 md:w-8 md:h-8 flex items-center justify-center transition-transform"
                      style={{
                        background: openIdx === i ? C.orange : 'white',
                        color: openIdx === i ? 'white' : C.navy,
                        border: `1px solid ${openIdx === i ? C.orange : C.border}`,
                        transform: openIdx === i ? 'rotate(45deg)' : 'none'
                      }}>
                  <Plus size={14} />
                </span>
              </button>
              {openIdx === i && (
                <div className="px-5 md:px-7 pb-5 md:pb-6 fade-in">
                  <p className="text-sm md:text-base leading-relaxed" style={{ color: C.text, maxWidth: '70ch' }}>
                    {f.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// APPLY ACCOUNT
// =============================================================================
function ApplyAccount() {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [sending, setSending] = useState(false);
  const [data, setData] = useState({
    business: '', contact: '', email: '', phone: '',
    type: 'Convenience Store', license: '', state: 'AL', volume: '$5K — $15K'
  });
  const set = k => e => setData({ ...data, [k]: e.target.value });

  const handleApply = async (e) => {
    e.preventDefault();
    setSending(true);
    setSubmitError(null);
    try {
      const res = await submitNetlifyForm('apply', data);
      if (!res.ok) throw new Error(`Submission failed (${res.status})`);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(`We couldn't reach our server. Please call ${COMPANY.phone} or email ${COMPANY.email}.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="apply" className="px-3 md:px-6 lg:px-10 py-12 md:py-24" style={{ background: C.navy, color: 'white' }}>
      <div className="max-w-[1400px] mx-auto grid lg:grid-cols-12 gap-8 md:gap-10 lg:gap-16">
        <div className="lg:col-span-5">
          <div style={{ ...mono, fontWeight: 600, letterSpacing: '0.3em' }} className="text-[10px] md:text-[11px] uppercase mb-4 md:mb-5">
            <span style={{ color: C.orange }}>04 / TRADE ACCOUNT</span>
          </div>
          <h2 style={{ ...display, fontWeight: 800 }} className="text-3xl md:text-5xl lg:text-6xl leading-tight mb-5 md:mb-6">
            Open a wholesale<br /><span style={{ color: C.orange }}>account today.</span>
          </h2>
          <p className="text-sm md:text-lg leading-relaxed mb-6 md:mb-8" style={{ maxWidth: '46ch', opacity: 0.85 }}>
            Approved within 24 hours. No application fee. No minimum first order. Net-30 terms available with credit verification.
          </p>
          <ul className="space-y-2.5 md:space-y-3 mb-6 md:mb-8">
            {[`Live wholesale pricing on ${PRODUCTS.length} SKUs`, 'Net-30 payment terms (qualified accounts)', 'Same-day will-call at our Birmingham warehouse', 'Dedicated trade desk representative'].map(item => (
              <li key={item} className="flex items-start gap-3 text-xs md:text-sm">
                <Star size={14} className="shrink-0 mt-0.5" style={{ color: C.orange }} fill={C.orange} />
                <span style={{ color: 'rgba(255,255,255,0.9)' }}>{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4 pt-5 md:pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
            <Phone size={18} style={{ color: C.orange }} />
            <div>
              <div style={{ ...mono, letterSpacing: '0.25em', fontWeight: 600 }} className="text-[10px] uppercase opacity-70">Or call us directly</div>
              <a href={`tel:${COMPANY.phoneRaw}`} style={{ ...display, fontWeight: 700 }} className="text-xl md:text-2xl">{COMPANY.phone}</a>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          {submitted ? (
            <div className="p-8 md:p-14 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.orange}` }}>
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-5 md:mb-6" style={{ background: C.orange }}>
                <ArrowRight size={22} style={{ color: 'white' }} />
              </div>
              <h3 style={{ ...display, fontWeight: 800 }} className="text-2xl md:text-4xl mb-3">
                Application <span style={{ color: C.orange }}>received.</span>
              </h3>
              <p className="text-sm md:text-base opacity-85 leading-relaxed" style={{ maxWidth: '44ch', margin: '0 auto' }}>
                A trade desk rep will reach out within one business day to verify your license and activate your account.
              </p>
              <div className="mt-6 md:mt-8 text-[11px] uppercase opacity-70" style={{ ...mono, letterSpacing: '0.3em', fontWeight: 600 }}>
                Reference · ALW-{Math.floor(Math.random() * 90000) + 10000}
              </div>
            </div>
          ) : (
            <form onSubmit={handleApply}
                  name="apply" data-netlify="true" netlify-honeypot="bot-field"
                  className="grid sm:grid-cols-2 gap-4 md:gap-5"
                  style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', border: `1px solid rgba(255,255,255,0.1)` }}>
              <input type="hidden" name="form-name" value="apply" />
              <p className="hidden"><label>Don&apos;t fill this out: <input name="bot-field" tabIndex={-1} /></label></p>
              <DarkField name="business" label="Business Name" value={data.business} onChange={set('business')} required />
              <DarkField name="contact"  label="Contact Name"  value={data.contact}  onChange={set('contact')}  required />
              <DarkField name="email"    label="Email"         value={data.email}    onChange={set('email')}    type="email" required />
              <DarkField name="phone"    label="Phone"         value={data.phone}    onChange={set('phone')}    type="tel" required />
              <DarkSelect name="type" label="Business Type" value={data.type} onChange={set('type')}
                          options={['Convenience Store','Smoke Shop','Vape Shop','Liquor Store','Grocery / Bodega','Auto Parts','Hookah Lounge','Other']} />
              <DarkField name="license" label="Retail License #" value={data.license} onChange={set('license')} required />
              <DarkSelect name="state" label="State" value={data.state} onChange={set('state')}
                          options={['AL','GA','MS','TN','FL','LA','SC','NC','KY','Other']} />
              <DarkSelect name="volume" label="Expected Monthly Volume" value={data.volume} onChange={set('volume')}
                          options={['Under $5K','$5K — $15K','$15K — $50K','$50K — $100K','$100K+']} />
              <div className="sm:col-span-2 flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 md:pt-4">
                <p className="text-xs leading-relaxed" style={{ maxWidth: '50ch', opacity: 0.7 }}>
                  By submitting, you confirm you are authorized to open a trade account on behalf of a licensed retail business.
                </p>
                <button type="submit" disabled={sending}
                        className="inline-flex items-center justify-center gap-2 px-7 py-3.5 md:px-8 md:py-4 text-xs uppercase font-bold transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                        style={{ ...mono, letterSpacing: '0.18em', background: C.orange, color: 'white' }}>
                  {sending ? 'Sending…' : <>Submit Application <ArrowRight size={14} /></>}
                </button>
              </div>
              {submitError && (
                <div className="sm:col-span-2 px-4 py-3 text-xs leading-relaxed"
                     style={{ background: 'rgba(244,180,0,0.12)', border: `1px solid ${C.yellow}`, color: 'white' }}>
                  {submitError}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function DarkField({ label, value, onChange, type = 'text', required, name }) {
  return (
    <div>
      <label className="text-[10px] uppercase mb-2 block" style={{ ...mono, letterSpacing: '0.22em', fontWeight: 600, opacity: 0.7 }}>
        {label} {required && <span style={{ color: C.orange }}>*</span>}
      </label>
      <input type={type} name={name} value={value} onChange={onChange} required={required}
             className="w-full bg-transparent outline-none text-sm md:text-base pb-2 transition-colors focus:border-[#DB6433]"
             style={{ color: 'white', borderBottom: `1px solid rgba(255,255,255,0.25)` }} />
    </div>
  );
}

function DarkSelect({ label, value, onChange, options, name }) {
  return (
    <div>
      <label className="text-[10px] uppercase mb-2 block" style={{ ...mono, letterSpacing: '0.22em', fontWeight: 600, opacity: 0.7 }}>{label}</label>
      <div className="relative">
        <select name={name} value={value} onChange={onChange}
                className="w-full bg-transparent outline-none text-sm md:text-base pb-2 appearance-none cursor-pointer"
                style={{ color: 'white', borderBottom: `1px solid rgba(255,255,255,0.25)` }}>
          {options.map(o => <option key={o} value={o} style={{ background: C.navy, color: 'white' }}>{o}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-0 top-1.5 pointer-events-none" style={{ color: C.orange }} />
      </div>
    </div>
  );
}

// =============================================================================
// VISIT SHOWROOM — single real location
// =============================================================================
function VisitShowroom() {
  return (
    <section className="px-3 md:px-6 lg:px-10 py-10 md:py-20">
      <div className="max-w-[1400px] mx-auto">
        <SectionHead eyebrow="05 / VISIT US" title="Walk-ins welcome at our Birmingham warehouse"
                     blurb="Need to grab inventory today? Our showroom is open to licensed retailers seven days a week." />

        <div className="grid lg:grid-cols-2 gap-5 md:gap-8 mt-8 md:mt-10">
          {/* Address card */}
          <div className="p-6 md:p-10" style={{ background: C.navy, color: 'white' }}>
            <div className="flex items-start gap-3 md:gap-4 mb-5 md:mb-6">
              <div className="w-11 h-11 md:w-12 md:h-12 shrink-0 flex items-center justify-center" style={{ background: C.orange }}>
                <MapPin size={22} style={{ color: 'white' }} />
              </div>
              <div>
                <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em', color: C.orange }} className="text-[10px] md:text-[11px] uppercase mb-1">
                  HQ · WAREHOUSE & SHOWROOM
                </div>
                <h3 style={{ ...display, fontWeight: 800 }} className="text-2xl md:text-3xl">Birmingham, AL</h3>
              </div>
            </div>
            <div className="space-y-4 md:space-y-5">
              <div>
                <div style={{ ...mono, letterSpacing: '0.2em', fontWeight: 600, opacity: 0.6 }} className="text-[10px] uppercase mb-1.5">Address</div>
                <div className="text-base md:text-lg leading-snug">
                  {COMPANY.addressLine1}<br />
                  {COMPANY.addressLine2}
                </div>
              </div>
              <div>
                <div style={{ ...mono, letterSpacing: '0.2em', fontWeight: 600, opacity: 0.6 }} className="text-[10px] uppercase mb-1.5">Hours</div>
                <div className="text-sm md:text-base leading-relaxed">
                  {COMPANY.hoursLine1}<br />
                  {COMPANY.hoursLine2}
                </div>
              </div>
              <div>
                <div style={{ ...mono, letterSpacing: '0.2em', fontWeight: 600, opacity: 0.6 }} className="text-[10px] uppercase mb-1.5">Contact</div>
                <a href={`tel:${COMPANY.phoneRaw}`} className="text-base md:text-lg flex items-center gap-2 hover:text-[#DB6433] transition-colors">
                  <Phone size={15} style={{ color: C.orange }} /> {COMPANY.phone}
                </a>
                <a href={`mailto:${COMPANY.email}`} className="text-sm md:text-base flex items-center gap-2 mt-1 opacity-85 hover:opacity-100 hover:text-[#DB6433] transition-colors">
                  <Mail size={14} style={{ color: C.orange }} /> {COMPANY.email}
                </a>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6 md:mt-8 pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(COMPANY.addressLine1 + ', ' + COMPANY.addressLine2)}`} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center justify-center gap-2 px-5 py-3 text-xs uppercase font-bold flex-1"
                 style={{ ...mono, letterSpacing: '0.18em', background: C.orange, color: 'white' }}>
                Get Directions <ArrowRight size={14} />
              </a>
              <a href={`tel:${COMPANY.phoneRaw}`}
                 className="inline-flex items-center justify-center gap-2 px-5 py-3 text-xs uppercase font-bold border-2 flex-1"
                 style={{ ...mono, letterSpacing: '0.18em', borderColor: 'white', color: 'white' }}>
                Call to Order
              </a>
            </div>
          </div>

          {/* Map placeholder */}
          <div className="overflow-hidden relative aspect-[4/3] lg:aspect-auto" style={{ background: '#E8E8E8' }}>
            <iframe
              title="Alabama Wholesale location"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(COMPANY.addressLine1 + ', ' + COMPANY.addressLine2)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
              className="absolute inset-0 w-full h-full"
              style={{ border: 0, filter: 'grayscale(0.2) contrast(1.05)' }}
              loading="lazy" />
            <div className="absolute bottom-4 left-4 px-3 py-2"
                 style={{ ...mono, background: 'white', color: C.navy, fontSize: 11, letterSpacing: '0.15em', fontWeight: 700 }}>
              📍 BIRMINGHAM AL · 35203
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// NEWSLETTER
// =============================================================================
function Newsletter() {
  const [email, setEmail] = useState('');
  const [subbed, setSubbed] = useState(false);
  const [sending, setSending] = useState(false);
  const [subError, setSubError] = useState(null);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setSubError(null);
    try {
      const res = await submitNetlifyForm('newsletter', { email });
      if (!res.ok) throw new Error(`Submission failed (${res.status})`);
      setSubbed(true);
    } catch (err) {
      setSubError(`Subscription failed. Email ${COMPANY.email} to be added manually.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="px-3 md:px-6 lg:px-10 py-10 md:py-16">
      <div className="max-w-[1400px] mx-auto p-6 md:p-14 text-center"
           style={{ background: `linear-gradient(135deg, ${C.orangeLite} 0%, white 100%)`, border: `1px solid ${C.border}` }}>
        <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em' }} className="text-[10px] md:text-[11px] uppercase mb-3 md:mb-4">
          <span style={{ color: C.orange }}>NEW SKUs · WEEKLY</span>
        </div>
        <h3 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-2xl md:text-5xl mb-3 md:mb-4 leading-tight">
          New arrivals, in your inbox.
        </h3>
        <p className="text-sm md:text-base mb-6 md:mb-8 max-w-xl mx-auto" style={{ color: C.muted }}>
          Every Tuesday: new vape SKUs, restocked candy and snacks, deal-of-the-week pallet pricing. No fluff.
        </p>
        {subbed ? (
          <div className="text-sm font-bold" style={{ ...mono, color: C.greenTag, letterSpacing: '0.15em' }}>
            ✓ SUBSCRIBED — CHECK YOUR INBOX
          </div>
        ) : (
          <form onSubmit={handleSubscribe}
                name="newsletter" data-netlify="true" netlify-honeypot="bot-field"
                className="flex flex-col sm:flex-row max-w-lg mx-auto gap-2">
            <input type="hidden" name="form-name" value="newsletter" />
            <p className="hidden"><label>Don&apos;t fill this out: <input name="bot-field" tabIndex={-1} /></label></p>
            <input type="email" required name="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="your@business.com"
                   className="flex-1 h-11 md:h-12 px-4 outline-none text-sm md:text-base"
                   style={{ background: 'white', border: `1px solid ${C.border}` }} />
            <button type="submit" disabled={sending} className="h-11 md:h-12 px-6 md:px-7 text-xs uppercase font-bold whitespace-nowrap transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                    style={{ ...mono, letterSpacing: '0.18em', background: C.orange, color: 'white' }}>
              {sending ? 'Sending…' : 'Subscribe'}
            </button>
          </form>
        )}
        {subError && !subbed && (
          <div className="mt-3 text-xs" style={{ color: C.orange }}>{subError}</div>
        )}
      </div>
    </section>
  );
}

// =============================================================================
// FOOTER
// =============================================================================
function Footer({ goHome, goCategory }) {
  return (
    <footer style={{ background: C.navyDark, color: 'white' }}>
      <div className="max-w-[1400px] mx-auto px-3 md:px-6 lg:px-10 py-10 md:py-20">
        <div className="grid md:grid-cols-12 gap-8 md:gap-10">
          <div className="md:col-span-4">
            <button onClick={goHome} className="flex items-center gap-3 mb-4 md:mb-5">
              <img src={IMG.logo} alt={COMPANY.name} style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8 }} />
              <div className="text-left">
                <div style={{ ...display, fontWeight: 800 }} className="text-2xl leading-none">ALABAMA</div>
                <div style={{ ...mono, color: C.orange, fontSize: 10, letterSpacing: '0.2em', fontWeight: 700, marginTop: 4 }}>
                  WHOLESALE INC
                </div>
              </div>
            </button>
            <p className="text-sm leading-relaxed max-w-md mb-5 md:mb-6" style={{ opacity: 0.75 }}>
              Direct-from-manufacturer wholesale across Alabama, Georgia, Mississippi and Tennessee. Tobacco, vape, candy, beverages, household, automotive, and specialty — delivered weekly to Southeast retail partners.
            </p>
            <div className="space-y-2 text-xs md:text-sm" style={{ ...mono, opacity: 0.85 }}>
              <div className="flex items-center gap-2"><Phone size={13} style={{ color: C.orange }} /> {COMPANY.phone}</div>
              <div className="flex items-center gap-2"><Mail size={13} style={{ color: C.orange }} /> {COMPANY.email}</div>
              <div className="flex items-start gap-2"><MapPin size={13} style={{ color: C.orange, marginTop: 2 }} />
                <span>{COMPANY.addressLine1}<br/>{COMPANY.addressLine2}</span>
              </div>
              <div className="flex items-start gap-2"><Clock size={13} style={{ color: C.orange, marginTop: 2 }} />
                <span>{COMPANY.hoursLine1}<br/>{COMPANY.hoursLine2}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-5 md:mt-6">
              {[Facebook, Instagram, Twitter].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 flex items-center justify-center transition-transform hover:scale-110"
                   style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          <FootCol heading="Shop" links={NAV_CATEGORIES.map(c => c.name)} onClick={goCategory} />
          <FootCol heading="Trade" links={['Apply for Account', 'Sign In', 'Pricing & Net Terms', 'Volume Discounts', 'Pallet Rates', 'Will-Call', 'Track Order']} />
          <FootCol heading="Company" links={['About Us', 'Compliance', 'Careers', 'Press', 'Privacy', 'Terms', 'Contact']} />
        </div>

        <div className="mt-10 md:mt-16 pt-6 md:pt-8 border-t flex flex-col md:flex-row gap-4 justify-between items-start md:items-center text-[10px] md:text-[11px] uppercase"
             style={{ borderColor: 'rgba(255,255,255,0.1)', ...mono, letterSpacing: '0.15em', fontWeight: 600, opacity: 0.65 }}>
          <div>© 2026 Alabama Wholesale Inc. All rights reserved.</div>
          <div className="flex flex-wrap gap-x-4 md:gap-x-5 gap-y-2">
            <span>21+ ONLY</span>
            <span>LICENSED DISTRIBUTOR</span>
            <span>PACT-ACT REGISTERED</span>
            <span>MSA COMPLIANT</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FootCol({ heading, links, onClick }) {
  return (
    <div className="md:col-span-2">
      <div style={{ ...mono, letterSpacing: '0.3em', fontWeight: 700 }} className="text-[10px] uppercase mb-4 md:mb-5">
        <span style={{ color: C.orange }}>{heading}</span>
      </div>
      <ul className="space-y-2 md:space-y-2.5">
        {links.map(l => (
          <li key={l}>
            {onClick ? (
              <button onClick={() => onClick(l)} className="text-xs md:text-sm transition-opacity hover:opacity-100 text-left" style={{ opacity: 0.75 }}>{l}</button>
            ) : (
              <a href="#" className="text-xs md:text-sm transition-opacity hover:opacity-100" style={{ opacity: 0.75 }}>{l}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// SECTION HEADER (shared)
// =============================================================================
function SectionHead({ eyebrow, title, blurb, link }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 md:gap-4">
      <div className="max-w-2xl">
        <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em' }} className="text-[10px] md:text-[11px] uppercase mb-2 md:mb-3">
          <span style={{ color: C.orange }}>{eyebrow}</span>
        </div>
        <h2 style={{ ...display, fontWeight: 800, color: C.navy }} className="text-2xl md:text-5xl leading-[1.05] mb-2 md:mb-3">
          {title}
        </h2>
        {blurb && <p className="text-sm md:text-base leading-relaxed" style={{ color: C.muted, maxWidth: '52ch' }}>{blurb}</p>}
      </div>
      {link && (
        <a href={link.href} className="inline-flex items-center gap-2 text-xs uppercase font-bold transition-colors hover:text-[#DB6433] shrink-0"
           style={{ ...mono, letterSpacing: '0.18em', color: C.navy }}>
          {link.label} <ArrowRight size={14} />
        </a>
      )}
    </div>
  );
}

// =============================================================================
// CART DRAWER — primary CTA is "Request Quote"
// =============================================================================
function CartDrawer({ open, onClose, items, total, addToCart, decCart, goQuote, user, onLoginClick }) {
  const freeDeliveryDelta = Math.max(0, FREE_DELIVERY_THRESHOLD - total);
  const deliveryProgress = Math.min(100, (total / FREE_DELIVERY_THRESHOLD) * 100);

  return (
    <>
      <div onClick={onClose}
           className="fixed inset-0 z-40 transition-opacity"
           style={{
             background: 'rgba(0,0,0,0.5)',
             opacity: open ? 1 : 0,
             pointerEvents: open ? 'auto' : 'none',
             backdropFilter: 'blur(4px)'
           }} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col transition-transform"
             style={{
               background: 'white',
               transform: open ? 'translateX(0)' : 'translateX(100%)',
               transitionDuration: '350ms',
               transitionTimingFunction: 'cubic-bezier(.2,.7,.2,1)'
             }}>
        <div className="px-4 md:px-5 py-4 md:py-5 flex items-center justify-between border-b" style={{ borderColor: C.border }}>
          <div>
            <div style={{ ...mono, letterSpacing: '0.25em', fontWeight: 700 }} className="text-[10px] uppercase">
              <span style={{ color: C.orange }}>{user ? 'YOUR CART' : 'YOUR QUOTE'}</span>
            </div>
            <div style={{ ...display, fontWeight: 800, color: C.navy }} className="text-lg md:text-xl mt-0.5">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close cart"><X size={22} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-8 text-center">
              <ShoppingCart size={36} style={{ color: C.mutedSoft }} />
              <p style={{ ...display, fontWeight: 700, color: C.navy }} className="text-xl md:text-2xl mt-5 mb-2">No items yet</p>
              <p className="text-sm" style={{ color: C.muted }}>Browse the catalog and add items.</p>
            </div>
          ) : (
            <ul>
              {items.map(it => (
                <li key={it.id} className="px-4 md:px-5 py-3 md:py-4 flex gap-3 md:gap-4 border-b" style={{ borderColor: C.borderSoft }}>
                  <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 flex items-center justify-center relative overflow-hidden" style={{ background: '#FAFAFA', border: `1px solid ${C.borderSoft}` }}>
                    {it.img ? (
                      <img src={it.img} alt="" className="w-full h-full object-contain" style={{ padding: 4 }} />
                    ) : (
                      <TextCard name={it.name} cat={it.cat} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ ...mono, fontWeight: 600, letterSpacing: '0.1em', color: C.muted }} className="text-[9px] uppercase mb-0.5">
                      {it.cat}
                    </div>
                    <div className="text-xs md:text-sm font-semibold leading-tight" style={{ ...display, color: C.navy }}>{it.name}</div>
                    {user && (
                      <div className="text-[11px] mt-0.5" style={{ ...mono, color: C.muted }}>
                        ${it.price.toFixed(2)} each
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center" style={{ border: `1px solid ${C.border}` }}>
                        <button onClick={() => decCart(it.id)} className="w-7 h-7 flex items-center justify-center" aria-label="Decrease"><Minus size={11} /></button>
                        <span style={{ ...mono, fontWeight: 700 }} className="text-xs px-1.5">{it.qty}</span>
                        <button onClick={() => addToCart(it.id)} className="w-7 h-7 flex items-center justify-center" aria-label="Increase"><Plus size={11} /></button>
                      </div>
                      {user ? (
                        <div style={{ ...display, fontWeight: 800, color: C.orange }} className="text-sm md:text-base">
                          ${(it.qty * it.price).toFixed(2)}
                        </div>
                      ) : (
                        <div style={{ ...mono, fontWeight: 700, color: C.orange, letterSpacing: '0.1em' }} className="text-[10px] md:text-[11px] uppercase">
                          Quote
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t p-4 md:p-5" style={{ borderColor: C.border }}>
            {user ? (
              <>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-[10px] md:text-[11px] uppercase" style={{ ...mono, letterSpacing: '0.25em', fontWeight: 600, color: C.muted }}>Subtotal</span>
                  <span style={{ ...display, fontWeight: 800, color: C.navy }} className="text-2xl md:text-3xl">${total.toFixed(2)}</span>
                </div>
                <div className="mb-3 md:mb-4">
                  <div className="h-2 overflow-hidden mb-2" style={{ background: C.borderSoft }}>
                    <div className="h-full transition-all" style={{ width: `${deliveryProgress}%`, background: freeDeliveryDelta === 0 ? C.greenTag : C.orange }} />
                  </div>
                  <p className="text-[10px] md:text-[11px]" style={{ ...mono, color: C.muted }}>
                    {freeDeliveryDelta === 0 ? 'Free delivery unlocked' : `$${freeDeliveryDelta.toFixed(2)} away from free delivery`} · Freight & tax finalized at quote
                  </p>
                </div>
              </>
            ) : (
              <div className="mb-3 md:mb-4 p-3" style={{ background: C.orangeLite }}>
                <button onClick={onLoginClick} className="w-full text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <Users size={14} style={{ color: C.orange }} />
                    <span style={{ ...mono, letterSpacing: '0.15em', fontWeight: 700, color: C.orange }} className="text-[10px] uppercase">
                      Sign in to see prices →
                    </span>
                  </div>
                  <p className="text-[11px] md:text-xs leading-relaxed" style={{ color: C.text }}>
                    Wholesale pricing visible only to approved retail partners.
                  </p>
                </button>
              </div>
            )}
            <button onClick={goQuote}
                    className="w-full py-3.5 md:py-4 text-xs md:text-sm uppercase font-bold transition-transform hover:scale-[1.01] inline-flex items-center justify-center gap-2"
                    style={{ ...mono, letterSpacing: '0.22em', background: C.orange, color: 'white' }}>
              {user ? 'Proceed to Checkout' : 'Submit Quote Request'} <ArrowRight size={15} />
            </button>
            <button onClick={onClose} className="w-full mt-2 py-2.5 md:py-3 text-[10px] md:text-[11px] uppercase font-bold border-2"
                    style={{ ...mono, letterSpacing: '0.22em', color: C.navy, borderColor: C.navy }}>
              Continue Shopping
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function WhatsAppButton() {
  const [tipShown, setTipShown] = useState(false);
  const message = encodeURIComponent("Hi! I'm interested in opening a wholesale account.");
  const url = `https://wa.me/${COMPANY.whatsapp}?text=${message}`;

  useEffect(() => {
    const t = setTimeout(() => setTipShown(true), 4000);
    const t2 = setTimeout(() => setTipShown(false), 11000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  return (
    <>
      {/* Tooltip */}
      {tipShown && (
        <div className="fixed bottom-24 right-4 md:right-6 z-40 fade-in pointer-events-none"
             style={{ maxWidth: 240 }}>
          <div className="relative px-4 py-3 shadow-lg"
               style={{ background: 'white', border: `1px solid ${C.border}` }}>
            <div style={{ ...display, fontWeight: 700, color: C.navy }} className="text-sm mb-0.5">
              Need help?
            </div>
            <div className="text-xs" style={{ color: C.muted }}>
              Chat with us on WhatsApp
            </div>
            <div className="absolute bottom-[-6px] right-6 w-3 h-3 rotate-45"
                 style={{ background: 'white', borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }} />
          </div>
        </div>
      )}

      {/* Button */}
      <a href={url} target="_blank" rel="noopener noreferrer"
         aria-label="Chat on WhatsApp"
         className="fixed bottom-5 right-4 md:right-6 z-40 group">
        <span className="absolute inset-0 rounded-full pulse-ring" style={{ background: C.whatsapp }} />
        <span className="relative flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full shadow-xl transition-transform group-hover:scale-105"
              style={{ background: C.whatsapp }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="white" aria-hidden="true">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
          </svg>
        </span>
      </a>
    </>
  );
}

// =============================================================================
// WELCOME POPUP — shows on first visit with new items, restocking, sales
// =============================================================================
function WelcomePopup({ open, onClose, goCategory, goQuote }) {
  if (!open) return null;
  const typeStyles = {
    NEW:     { label: 'NEW ARRIVAL',  bg: C.orange,    fg: 'white' },
    RESTOCK: { label: 'RESTOCKED',    bg: C.navy,      fg: 'white' },
    SALE:    { label: 'SALE',         bg: C.greenTag,  fg: 'white' }
  };
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6"
           style={{ background: 'rgba(15, 12, 50, 0.75)', backdropFilter: 'blur(6px)' }}>
        <div onClick={(e) => e.stopPropagation()}
             className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto scale-in"
             style={{ background: 'white', boxShadow: '0 20px 80px rgba(0,0,0,0.4)' }}>
          {/* Header */}
          <div className="relative px-6 md:px-8 py-6 md:py-8 text-center"
               style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.orangeDark} 100%)`, color: 'white' }}>
            <button onClick={onClose} aria-label="Close popup"
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center transition-colors hover:bg-white/10"
                    style={{ background: 'rgba(255,255,255,0.1)' }}>
              <X size={18} />
            </button>
            <div style={{ ...mono, fontWeight: 700, letterSpacing: '0.3em', color: C.orange }} className="text-[10px] md:text-[11px] uppercase mb-2">
              ★ WHAT'S NEW THIS WEEK
            </div>
            <h2 style={{ ...display, fontWeight: 800 }} className="text-2xl md:text-4xl leading-tight mb-2">
              Welcome to Alabama Wholesale
            </h2>
            <p className="text-sm md:text-base opacity-85" style={{ maxWidth: '40ch', margin: '0 auto' }}>
              Fresh arrivals, restocked bestsellers, and weekly deals — straight from the warehouse.
            </p>
          </div>
          {/* Offers list */}
          <div className="p-4 md:p-6 space-y-3 md:space-y-4">
            {WELCOME_OFFERS.map((o, i) => {
              const ts = typeStyles[o.type];
              return (
                <div key={i} className="p-4 md:p-5 transition-transform hover:-translate-y-0.5"
                     style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="shrink-0 px-2 py-1 text-[9px] md:text-[10px] uppercase font-bold"
                         style={{ ...mono, letterSpacing: '0.18em', background: ts.bg, color: ts.fg }}>
                      {ts.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ ...display, fontWeight: 800, color: C.navy }} className="text-base md:text-lg leading-tight mb-1.5">
                        {o.title}
                      </div>
                      <p className="text-xs md:text-sm leading-relaxed mb-3" style={{ color: C.muted }}>
                        {o.body}
                      </p>
                      <button onClick={() => o.target ? goCategory(o.target) : goQuote()}
                              className="inline-flex items-center gap-2 px-4 py-2 text-[10px] md:text-[11px] uppercase font-bold transition-transform hover:scale-[1.02]"
                              style={{ ...mono, letterSpacing: '0.15em', background: o.color, color: 'white' }}>
                        {o.cta} <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Footer */}
          <div className="px-4 md:px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3"
               style={{ borderColor: C.border, background: C.bg }}>
            <div className="text-[11px] md:text-xs" style={{ color: C.muted }}>
              New SKUs added every Tuesday
            </div>
            <button onClick={onClose}
                    className="px-5 py-2.5 text-[10px] md:text-xs uppercase font-bold transition-colors hover:bg-gray-100"
                    style={{ ...mono, letterSpacing: '0.18em', color: C.navy, border: `1px solid ${C.border}` }}>
              Continue Browsing
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

