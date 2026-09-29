// App root: age gate, auth, catalog, cart and route state, the page layout
// and the route switch. Pages live in src/pages/, shared pieces in
// src/components/ and src/lib/. URLs, links and page-change behaviour live in
// src/lib/router.js and src/lib/routes.js. The age gate is a layer over the
// page, not a replacement for it (AW-044); its state is in src/lib/ageGate.js.
// The session and profile come from the AuthProvider (src/lib/auth.jsx,
// AW-187), mounted in main.jsx.

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { useAuth } from './lib/auth.jsx';
import { useCatalog } from './lib/useCatalog.js';
import { useCart } from './lib/cart.js';
import { focusPageHeading, navigate, pathFor, resolveRoute, routeKey, useNavigationEffects, useRoute } from './lib/router.js';
import { pageKeyFor } from './lib/routes.js';
import { confirmAge, declineAge, endAgeConfirmationOnSignOut, reconsiderAge, useAgeGate } from './lib/ageGate.js';
import { pageMeta, applyPageMeta } from './lib/meta.js';
import { departmentsFor } from './lib/departments.js';
import { accountNotices, signOutMessage } from './lib/accountNotices.js';
import { AgeGate } from './components/AgeGate.jsx';
import { TradeBar } from './components/TradeBar.jsx';
import { Header } from './components/Header.jsx';
import { Footer } from './components/Footer.jsx';
import { CartDrawer } from './components/CartDrawer.jsx';
import { HelpDialog } from './components/HelpDialog.jsx';
import { AuthModal } from './components/AuthModal.jsx';
import { ModalLayer } from './components/ModalLayer.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { SiteNotices } from './components/SiteNotices.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { CategoryPage } from './pages/CategoryPage.jsx';
import { ProductPage } from './pages/ProductPage.jsx';
import { QuotePage } from './pages/QuotePage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { AccountPage } from './pages/account/AccountPage.jsx';
import { AdminPage } from './pages/admin/AdminPage.jsx';
import { CatalogIndexPage } from './pages/support/CatalogIndexPage.jsx';
import { ContactPage } from './pages/support/ContactPage.jsx';
import { DeliveryPage } from './pages/support/DeliveryPage.jsx';
import { PolicyPage } from './pages/support/PolicyPage.jsx';
import { ApplyPage } from './pages/support/ApplyPage.jsx';
import { ResetPasswordPage } from './pages/support/ResetPasswordPage.jsx';

const SEARCH_NOT_READY = { page: 'not-found', kind: 'page' };
// Sign Out leads home, and its notice shows there.
const SIGNED_OUT_PAGE = '/';
const SIGNED_OUT_PAGE_KEY = pageKeyFor({ pathname: SIGNED_OUT_PAGE });

export default function App() {
  const age = useAgeGate();
  const gated = !age.confirmed;
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState('signin');
  const [helpOpen, setHelpOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutNotice, setSignOutNotice] = useState(null); // { text, pageKey }

  const auth = useAuth();
  const { products } = useCatalog();
  const { session, profile, account, signOut, refreshProfile, dismissLink, isBackendConfigured } = auth;
  // Signed in whenever there is a session, also before (or without) its
  // profile, so Sign Out is always within reach (AW-089).
  const user = session ? { name: profile?.name || '', business: profile?.business || '' } : null;
  const isApprovedBuyer = profile?.status === 'approved';
  const isAdmin = profile?.role === 'admin';
  const departments = useMemo(() => departmentsFor(products), [products]);
  const cart = useCart(products, profile);

  // The URL is checked against the catalog (AW-188): unknown pages,
  // departments, lines and products render NotFound, and other spellings of
  // a real page are redirected to its canonical address.
  const { location, raw } = useRoute();
  const resolved = useMemo(() => resolveRoute(raw, { departments, products }), [raw, departments, products]);
  const canonicalPath = pathFor(resolved);
  // /search is reserved for the search results page (AW-007); until it
  // exists it shows NotFound.
  const route = resolved.page === 'search' ? SEARCH_NOT_READY : resolved;
  useLayoutEffect(() => {
    if (canonicalPath && canonicalPath !== location.pathname) {
      navigate(canonicalPath + location.search + location.hash, { replace: true, scroll: false });
    }
  }, [canonicalPath, location]);

  useEffect(() => {
    applyPageMeta(pageMeta(route, products, departments));
  }, [route, products, departments]);
  // Scroll, focus and announcement on page changes (after the title is set).
  useNavigationEffects();

  // When the age gate closes, the page it covered takes focus like a newly
  // opened page (AW-041), instead of focus falling back to <body>.
  const wasGated = useRef(gated);
  useEffect(() => {
    if (wasGated.current && !gated) focusPageHeading();
    wasGated.current = gated;
  }, [gated]);

  // The sign-out notice belongs to the page Sign Out led to (AW-336).
  if (signOutNotice && signOutNotice.pageKey !== location.pageKey) setSignOutNotice(null);
  // Moving to another page ends the notice about the email link the site was
  // opened with (AW-015).
  const lastPageKey = useRef(location.pageKey);
  useEffect(() => {
    if (lastPageKey.current === location.pageKey) return;
    lastPageKey.current = location.pageKey;
    dismissLink();
  }, [location.pageKey, dismissLink]);

  // Escape handling, body scroll lock, the inert background and Back-to-close
  // live in ModalLayer so every dialog (including the auth modal) behaves the same.

  // Sign Out (AW-336, AW-047, AW-337): the buttons say "Signing out…" until
  // it finishes, the session is cleared on this computer even when Supabase
  // cannot be reached, and a notice on the home page says how it went.
  // scope 'global' is "Sign out of all devices" on /account.
  const handleLogout = async ({ scope = 'local' } = {}) => {
    if (signingOut) return;
    setSigningOut(true);
    let result = { ok: false, scope };
    try {
      result = await signOut({ scope });
    } catch {
      // signOut clears the saved session itself; report it as unconfirmed.
    } finally {
      setSigningOut(false);
    }
    navigate(SIGNED_OUT_PAGE);
    setLoginOpen(false);
    setSignOutNotice({ text: signOutMessage(result), pageKey: SIGNED_OUT_PAGE_KEY });
    // The next person on a shared computer is asked their age again (AW-340).
    endAgeConfirmationOnSignOut();
  };
  const signOutHere = () => handleLogout();

  // signin | signup (checklist first) | application (straight to the form) | reset
  const openLogin = (mode) => {
    setLoginMode(mode);
    setLoginOpen(true);
  };
  const openSignin = () => openLogin('signin');
  const openSignup = () => openLogin('signup');
  const openApplication = () => openLogin('application');
  const openReset = () => openLogin('reset');
  const openCartSignin = () => {
    setCartOpen(false);
    openSignin();
  };

  const notices = accountNotices({
    linkError: auth.linkError,
    linkConfirmed: auth.linkConfirmed,
    sessionEnded: auth.sessionEnded,
    connectionProblem: auth.connectionProblem,
    account,
    routePage: route.page,
    signOutText: signOutNotice?.text || null,
    signingOut,
    retrying: auth.profileRefreshing,
  }, {
    signIn: openSignin,
    requestReset: openReset,
    signOutHere,
    retryProfile: refreshProfile,
    dismissLink,
    dismissSessionEnded: auth.dismissSessionEnded,
    dismissConnectionProblem: auth.dismissConnectionProblem,
    dismissSignOut: () => setSignOutNotice(null),
  });

  // Product cards need the account, the cart and the add/step actions.
  const cardProps = {
    profile, isApprovedBuyer, cart: cart.cart, addLine: cart.addLine, decLine: cart.decLine, onLoginClick: openSignin,
  };
  // Account pages wait for the session and profile instead of flashing a
  // signed-out view (AW-186), and offer a retry when the profile fails (AW-089).
  const accountProps = {
    profile, account, onSignIn: openSignin, onRetry: refreshProfile, retrying: auth.profileRefreshing,
    onSignOut: signOutHere, signingOut,
  };

  const renderRoute = () => {
    switch (route.page) {
      case 'home':
        return <HomePage products={products} departments={departments} {...cardProps} onApplyClick={openSignup} />;
      case 'product':
        return <ProductPage key={route.productId} productId={route.productId} products={products} {...cardProps} onApplyClick={openSignup} />;
      case 'category':
        // Keyed by department (AW-228): another department starts with a fresh page.
        return (
          <CategoryPage key={route.category} category={route.category} sub={route.sub} query={route.query}
                        products={products} departments={departments} {...cardProps} />
        );
      case 'quote':
        return (
          <QuotePage items={cart.items} total={cart.total} addLine={cart.addLine} decLine={cart.decLine} removeLine={cart.removeLine}
                     clearCart={cart.clearCart} profile={profile} account={account} signedIn={!!session} onSignIn={openSignin}
                     isApprovedBuyer={isApprovedBuyer} isBackendConfigured={isBackendConfigured} />
        );
      case 'account':
        // Keyed by account: another buyer never sees the last one's orders (AW-190).
        return (
          <AccountPage key={session?.user?.id || 'guest'} {...accountProps} products={products}
                       addLines={cart.addLines} onOpenCart={() => setCartOpen(true)} isApprovedBuyer={isApprovedBuyer}
                       onSignOutEverywhere={() => handleLogout({ scope: 'global' })} />
        );
      case 'admin':
        return <AdminPage {...accountProps} />;
      case 'catalog':
        return (
          <CatalogIndexPage products={products} departments={departments} profile={profile} isApprovedBuyer={isApprovedBuyer}
                            onLoginClick={openSignin} />
        );
      case 'contact':
        return <ContactPage onApplyClick={openSignup} />;
      case 'delivery':
        return <DeliveryPage />;
      case 'shipping':
      case 'privacy':
      case 'terms':
        return <PolicyPage kind={route.page} />;
      case 'apply':
        return (
          <ApplyPage profile={profile} account={account} isBackendConfigured={isBackendConfigured}
                     onApplyClick={openApplication} onLoginClick={openSignin} onResetClick={openReset} />
        );
      case 'reset-password':
        // Keyed by account: signing out ends a finished or half-done reset (AW-015).
        return <ResetPasswordPage key={session?.user?.id || 'guest'} auth={auth} onRequestReset={openReset} onLoginClick={openSignin} />;
      default:
        return <NotFoundPage key={routeKey(route)} kind={route.kind} category={route.category} products={products} departments={departments} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <TradeBar onApplyClick={openSignup} />

      <Header
        cartCount={cart.count} onCart={() => setCartOpen(true)}
        products={products} departments={departments}
        user={user} isAdmin={isAdmin}
        onLoginClick={openSignin} onSignupClick={openSignup} onLogout={signOutHere} signingOut={signingOut}
        onHelp={() => setHelpOpen(true)}
      />

      {/* tabIndex -1: the fallback focus target after a page change (AW-041). */}
      <main className="container" id="main" tabIndex={-1}>
        <SiteNotices notices={notices} />
        <ErrorBoundary resetKey={routeKey(route)}>
          {renderRoute()}
        </ErrorBoundary>
      </main>

      <Footer departments={departments} onLoginClick={openSignin} onApplyClick={openSignup} />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cart.items} total={cart.total}
                  addLine={cart.addLine} decLine={cart.decLine} removeLine={cart.removeLine}
                  profile={profile} isApprovedBuyer={isApprovedBuyer} onLoginClick={openCartSignin} />
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} onApply={() => { setHelpOpen(false); openSignup(); }} />}
      {loginOpen && (
        <ModalLayer onClose={() => setLoginOpen(false)}>
          <AuthModal open initialMode={loginMode} onClose={() => setLoginOpen(false)} onSignOut={signOutHere} signingOut={signingOut} />
        </ModalLayer>
      )}
      {/* Last, so it sits above any other layer. No onClose and no history
          entry: Escape and Back leave it open (AW-044, AW-065). */}
      {gated && (
        <ModalLayer className="age-gate-layer" historyEntry={false}>
          <AgeGate declined={age.declined} onYes={confirmAge} onNo={declineAge} onBack={reconsiderAge} />
        </ModalLayer>
      )}
    </div>
  );
}
