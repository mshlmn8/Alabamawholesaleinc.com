// App root: age gate, auth, catalog, cart and route state, the page layout
// and the route switch. Pages live in src/pages/, shared pieces in
// src/components/ and src/lib/. URLs, links and page-change behaviour live in
// src/lib/router.js and src/lib/routes.js. The age gate is a layer over the
// page, not a replacement for it (AW-044); its state is in src/lib/ageGate.js.
// The session and profile come from the AuthProvider (src/lib/auth.jsx,
// AW-187), mounted in main.jsx. The cart belongs to whoever is signed in
// (src/lib/cart.js and src/lib/cartStorage.js, AW-189). The catalog comes
// from the CatalogProvider (src/lib/catalog.jsx, AW-204, AW-191), and an
// approved buyer's prices from the PricesProvider (src/lib/prices.jsx,
// AW-003), both also mounted in main.jsx.

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { savedSessionUserId, useAuth } from './lib/auth.jsx';
import { useCatalog } from './lib/catalog.jsx';
import { useCart } from './lib/cart.js';
import { usePrices } from './lib/prices.jsx';
import { priceFor } from './lib/pricing.js';
import { cartOwner, clearGuestCart } from './lib/cartStorage.js';
import { clearReceipt, saveReceipt, useLastReceipt } from './lib/receipt.js';
import { confirmLeave, focusPageHeading, navigate, pathFor, resolveRoute, routeKey, useNavigationEffects, useRoute } from './lib/router.js';
import { pageKeyFor } from './lib/routes.js';
import { confirmAge, declineAge, endAgeConfirmationOnSignOut, reconsiderAge, useAgeGate } from './lib/ageGate.js';
import { pageMeta, applyPageMeta } from './lib/meta.js';
import { departmentsFor } from './lib/departments.js';
import { accountNotices, signOutMessage } from './lib/accountNotices.js';
import { catalogNotices } from './lib/catalogNotices.js';
import { announce } from './lib/announce.js';
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
import { Toast } from './components/Toast.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { CategoryPage } from './pages/CategoryPage.jsx';
import { ProductPage } from './pages/ProductPage.jsx';
import { QuotePage } from './pages/QuotePage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';
import { AccountPage } from './pages/account/AccountPage.jsx';
import { AdminPage } from './pages/admin/AdminPage.jsx';
import { useAdminUnseen } from './pages/admin/useAdminUnseen.js';
import { CatalogIndexPage } from './pages/support/CatalogIndexPage.jsx';
import { ContactPage } from './pages/support/ContactPage.jsx';
import { DeliveryPage } from './pages/support/DeliveryPage.jsx';
import { PolicyPage } from './pages/support/PolicyPage.jsx';
import { ApplyPage } from './pages/support/ApplyPage.jsx';
import { ResetPasswordPage } from './pages/support/ResetPasswordPage.jsx';

// Not-found routes that depend on what is in the catalog.
const CATALOG_KINDS = ['product', 'department', 'line'];
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
  const [catalogNoticeHidden, setCatalogNoticeHidden] = useState(false);

  const auth = useAuth();
  const catalog = useCatalog();
  const { products, refreshIfStale } = catalog;
  // A dismissed catalog notice stays away until the catalog loads again.
  if (catalogNoticeHidden && catalog.status !== 'error') setCatalogNoticeHidden(false);
  // "Try again" on a catalog that didn't load (AW-204). The notice or page
  // stays as it was when it fails again, so say so.
  const retryCatalog = async () => {
    const result = await catalog.refresh();
    if (!result.ok) announce('The latest catalog still didn’t load. Try again in a moment.');
  };
  const { session, profile, account, signOut, refreshProfile, dismissLink, isBackendConfigured } = auth;
  // Signed in whenever there is a session, also before (or without) its
  // profile, so Sign Out is always within reach (AW-089).
  const user = session ? { name: profile?.name || '', business: profile?.business || '' } : null;
  const isApprovedBuyer = profile?.status === 'approved';
  // Ordering is paused on a suspended account (AW-201).
  const isSuspended = profile?.status === 'suspended';
  // Only an approved admin is one; the database's is_admin() says the same
  // (AW-352).
  const isAdmin = profile?.role === 'admin' && profile?.status === 'approved';
  // Orders placed since this admin last opened Admin -> Orders (AW-111): the
  // header's Admin link and the admin pages' titles show the count.
  const adminUnseen = useAdminUnseen(isAdmin ? profile.id : null);
  const departments = useMemo(() => departmentsFor(products), [products]);
  // The signed-in buyer's unit price for a product (and variant), or null:
  // no approved account, prices still loading, or price on request (AW-003).
  const prices = usePrices();
  const priceOf = useMemo(() => (id, variant) => priceFor(prices.prices, id, variant)?.unit ?? null, [prices.prices]);
  // Each account on this device has its own cart, and guests share one
  // (AW-189). While the saved session is being checked, or can't be
  // refreshed because Supabase is out of reach, it is that session's
  // account, so a reload shows the right cart at once. Read now, not once at
  // mount: after a sign-out here, a session another tab saved later must not
  // bring back the cart of the account that signed out.
  const savedUserId = auth.loading || auth.connectionProblem ? savedSessionUserId() : null;
  const owner = cartOwner(auth, savedUserId);
  // Lines are only re-keyed or flagged against the live catalog (AW-083).
  const cart = useCart({ products, priceOf, owner, catalogSettled: catalog.settled });

  // The URL is checked against the catalog (AW-188): unknown pages,
  // departments, lines and products render NotFound, and other spellings of
  // a real page are redirected to its canonical address.
  const { location, raw } = useRoute();
  const resolved = useMemo(() => resolveRoute(raw, { departments, products }), [raw, departments, products]);
  const canonicalPath = pathFor(resolved);
  const found = resolved;
  // A product, department or line that isn't in the bundled catalog may be in
  // the live one (AW-204): until that is on screen the page says it is
  // loading, or that the catalog didn't load, instead of "not found".
  // An address that can't name anything (/product/abc) is not found at once.
  const catalogPending = found.page === 'not-found' && CATALOG_KINDS.includes(found.kind) && !found.malformed && !catalog.settled;
  const pendingAs = catalogPending ? (catalog.status === 'loading' ? 'loading' : 'error') : null;
  const route = useMemo(() => (pendingAs ? { ...found, catalog: pendingAs } : found), [found, pendingAs]);
  // The receipt of the quote or order saved on this history entry, by this
  // cart's owner (AW-022): a reload or Back shows it again; a new visit to
  // /quote shows checkout. The title then names it ("Quote received").
  const lastReceipt = useLastReceipt();
  const receiptHere = route.page === 'quote' && location.key && lastReceipt?.owner === owner && lastReceipt?.entryKey === location.key
    ? lastReceipt.receipt : null;
  const receivedKind = receiptHere?.kind || null;
  useLayoutEffect(() => {
    if (canonicalPath && canonicalPath !== location.pathname) {
      navigate(canonicalPath + location.search + location.hash, { replace: true, scroll: false });
    }
  }, [canonicalPath, location]);

  // The title names a saved receipt ('Quote received', AW-022) on /quote, and
  // the count of orders new since the last visit on /admin (AW-111).
  const metaRoute = useMemo(() => {
    if (receivedKind) return { ...route, received: receivedKind };
    if (route.page === 'admin' && adminUnseen > 0) return { ...route, unseen: adminUnseen };
    return route;
  }, [route, receivedKind, adminUnseen]);
  useEffect(() => {
    applyPageMeta(pageMeta(metaRoute, products, departments));
  }, [metaRoute, products, departments]);
  // Scroll, focus and announcement on page changes (after the title is set).
  useNavigationEffects();

  // An open tab keeps its catalog current (AW-191): moving to another page
  // loads it again once it is more than a few minutes old.
  useEffect(() => {
    refreshIfStale();
  }, [location.pageKey, refreshIfStale]);

  // The live catalog arrived after a link led to the loading view, whose
  // heading had focus: the page that replaced it takes focus instead of
  // <body> (AW-041). A page opened directly keeps the browser's own focus.
  const wasPending = useRef(catalogPending);
  const navigated = location.action !== 'load';
  useEffect(() => {
    if (wasPending.current && !catalogPending && navigated) {
      const active = document.activeElement;
      if (!active || active === document.body) focusPageHeading();
    }
    wasPending.current = catalogPending;
  }, [catalogPending, navigated]);

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
    // Unsaved admin edits ask first (AW-118): No keeps the session and the
    // edits; Yes signs out without asking again on the way home.
    if (!confirmLeave(SIGNED_OUT_PAGE)) return;
    setSigningOut(true);
    // The account's cart stays stored for its next sign-in; the next person
    // here gets an empty guest cart (AW-189).
    const cartSaved = cart.count > 0;
    let result = { ok: false, scope };
    try {
      result = await signOut({ scope });
    } catch {
      // signOut clears the saved session itself; report it as unconfirmed.
    } finally {
      setSigningOut(false);
    }
    clearGuestCart();
    // The last receipt holds the buyer's contact details (AW-022).
    clearReceipt();
    navigate(SIGNED_OUT_PAGE, { force: true });
    setLoginOpen(false);
    setSignOutNotice({ text: signOutMessage(result, { cartSaved }), pageKey: SIGNED_OUT_PAGE_KEY });
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

  const notices = [...accountNotices({
    linkError: auth.linkError,
    linkConfirmed: auth.linkConfirmed,
    sessionEnded: auth.sessionEnded,
    connectionProblem: auth.connectionProblem,
    account,
    // A confirmation link for an account under review leads to its status (AW-016).
    profileStatus: profile?.status,
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
    viewApplication: () => navigate('/apply'),
    dismissSessionEnded: auth.dismissSessionEnded,
    dismissConnectionProblem: auth.dismissConnectionProblem,
    dismissSignOut: () => setSignOutNotice(null),
  }), ...catalogNotices(catalog, { dismissed: catalogNoticeHidden, pageExplains: catalogPending }, {
    retry: retryCatalog,
    dismiss: () => setCatalogNoticeHidden(true),
  })];

  // Checkout loads the catalog and the buyer's prices again right before a
  // submit and stops when a line changed (AW-191): the cart as stored now,
  // priced against them.
  const checkCart = async () => {
    const [latest, latestPrices] = await Promise.all([catalog.refresh(), prices.refresh()]);
    if (!latest.ok) return { ok: false, error: latest.error };
    if (!latestPrices.ok) return { ok: false, error: latestPrices.error };
    const latestPriceOf = (id, variant) => priceFor(latestPrices.prices, id, variant)?.unit ?? null;
    return { ok: true, items: cart.itemsFor(latest.products, latestPriceOf) };
  };

  // Product cards need the account, its prices, the cart and the add/step actions.
  const cardProps = {
    profile, isApprovedBuyer, priceOf, pricesStatus: prices.status,
    cart: cart.cart, addLine: cart.addLine, decLine: cart.decLine, onLoginClick: openSignin, onApplyClick: openSignup,
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
        return <HomePage products={products} departments={departments} {...cardProps} onApplyClick={openSignup} signedIn={!!session} />;
      case 'product':
        return (
          <ProductPage key={route.productId} productId={route.productId} products={products} {...cardProps} onApplyClick={openSignup}
                       savedQty={cart.legacy.find(entry => entry.productId === route.productId)?.qty || 0} />
        );
      case 'category':
        // Keyed by department (AW-228): another department starts with a fresh page.
        return (
          <CategoryPage key={route.category} category={route.category} sub={route.sub} query={route.query}
                        products={products} departments={departments} {...cardProps} />
        );
      case 'search':
        // Keyed by URL (AW-007): each query starts with a fresh page.
        return <SearchPage key={routeKey(route)} q={route.q} products={products} departments={departments} {...cardProps} />;
      case 'quote':
        return (
          <QuotePage items={cart.items} total={cart.total} setLine={cart.setLine} chooseVariant={cart.chooseVariant} removeLine={cart.removeLine}
                     removeLines={cart.removeLines} clearCart={cart.clearCart} legacy={cart.legacy} onDismissLegacy={cart.dismissLegacy}
                     profile={profile} account={account} signedIn={!!session} onSignIn={openSignin} onApplyClick={openSignup}
                     isApprovedBuyer={isApprovedBuyer} isSuspended={isSuspended} pricesStatus={prices.status} isBackendConfigured={isBackendConfigured} checkCart={checkCart}
                     savedReceipt={receiptHere} entryKey={location.key} onSubmitted={(receipt) => saveReceipt({ owner, entryKey: location.key, receipt })} />
        );
      case 'account':
        // Keyed by account: another buyer never sees the last one's orders (AW-190).
        return (
          <AccountPage key={session?.user?.id || 'guest'} {...accountProps} products={products}
                       addLines={cart.addLines} onOpenCart={() => setCartOpen(true)} isApprovedBuyer={isApprovedBuyer}
                       onSignOutEverywhere={() => handleLogout({ scope: 'global' })} />
        );
      case 'admin':
        return <AdminPage {...accountProps} route={route} onCatalogChange={() => { catalog.refresh(); }} />;
      case 'catalog':
        return (
          <CatalogIndexPage products={products} departments={departments} profile={profile} isApprovedBuyer={isApprovedBuyer}
                            onLoginClick={openSignin} {...cardProps} />
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
        return (
          <NotFoundPage key={routeKey(route)} kind={route.kind} category={route.category} products={products} departments={departments}
                        catalog={route.catalog || null} onRetry={retryCatalog} retrying={catalog.refreshing} />
        );
    }
  };

  return (
    <div className="app-shell">
      <TradeBar signedIn={!!session} onApplyClick={openSignup} />

      <Header
        cartCount={cart.count} onCart={() => setCartOpen(true)}
        products={products} departments={departments}
        user={user} isAdmin={isAdmin} adminUnseen={adminUnseen}
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

      <Footer departments={departments} signedIn={!!session} onLoginClick={openSignin} onApplyClick={openSignup} />

      {/* Confirms an add (AW-072); its action opens the cart. */}
      <Toast onAction={(id) => { if (id === 'open-cart') setCartOpen(true); }} />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cart.items} total={cart.total}
                  setLine={cart.setLine} chooseVariant={cart.chooseVariant} removeLine={cart.removeLine} removeLines={cart.removeLines}
                  legacy={cart.legacy} onDismissLegacy={cart.dismissLegacy}
                  profile={profile} isApprovedBuyer={isApprovedBuyer} isSuspended={isSuspended} pricesStatus={prices.status} onLoginClick={openCartSignin} />
      {helpOpen && <HelpDialog signedIn={!!session} onClose={() => setHelpOpen(false)} onApply={() => { setHelpOpen(false); openSignup(); }} />}
      {/* It has its own ModalLayer, so Escape and Back ask before a typed
          application is lost (AW-018). Sign Out closes it outright. */}
      {loginOpen && <AuthModal open initialMode={loginMode} onClose={() => setLoginOpen(false)} onSignOut={signOutHere} signingOut={signingOut} />}
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
