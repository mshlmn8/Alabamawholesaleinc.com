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
//
// Code splitting (AW-179): the storefront pages (home, departments, products,
// search, All products, not found) are in the first download. The account,
// admin, quote and support pages and the sign-in dialog load when first
// opened. Once the page is idle their files (Admin's only for an admin) are
// fetched into the browser's cache, so they open at once and offline
// (NEW-006, AW-344); offline, a page whose files aren't cached shows
// 'Loading…' until the connection is back. src/lib/chunks.js has the rules,
// src/components/LazyPage.jsx the loading views; ErrorBoundary says when
// that code didn't load even after a reload.

import { Suspense, lazy, useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';

import { savedSessionUserId, useAuth } from './lib/auth.jsx';
import { useCatalog } from './lib/catalog.jsx';
import { useCart } from './lib/cart.js';
import { useCartSync } from './lib/cartSync.js';
import { usePrices } from './lib/prices.jsx';
import { priceFor } from './lib/pricing.js';
import { cartOwner, clearGuestCart } from './lib/cartStorage.js';
import { clearReceipt, saveReceipt, useLastReceipt } from './lib/receipt.js';
import { loadAccountShipTo } from './lib/shipTo.js';
import { clearQuoteDraft } from './lib/quoteDraft.js';
import { confirmLeave, focusPageHeading, navigate, pathFor, resolveRoute, routeKey, useNavigationEffects, useRoute } from './lib/router.js';
import { pageKeyFor } from './lib/routes.js';
import { confirmAge, declineAge, endAgeConfirmationOnSignOut, reconsiderAge, useAgeGate } from './lib/ageGate.js';
import { pageMeta, applyPageMeta } from './lib/meta.js';
import { accountView, adminGate, isApprovedAdmin } from './lib/accountStatus.js';
import { basketTerms } from './data/terms.js';
import { departmentsFor } from './lib/departments.js';
import { accountNotices, signOutMessage } from './lib/accountNotices.js';
import { catalogNotices } from './lib/catalogNotices.js';
import { pricesNotices } from './lib/pricesNotices.js';
import { offlineNotices } from './lib/offlineNotice.js';
import { useOnlineStatus } from './lib/useOnlineStatus.js';
import { announce } from './lib/announce.js';
import { useStickyHeader } from './lib/stickyHeader.js';
import { useFdaInset } from './lib/fdaInset.js';
import { AgeGate } from './components/AgeGate.jsx';
import { TradeBar } from './components/TradeBar.jsx';
import { Header } from './components/Header.jsx';
import { Footer } from './components/Footer.jsx';
import { PrintLetterhead } from './components/PrintLetterhead.jsx';
import { CartDrawer } from './components/CartDrawer.jsx';
import { HelpDialog } from './components/HelpDialog.jsx';
import { ModalLayer } from './components/ModalLayer.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { LazyDialog, PageLoading, lazyPage } from './components/LazyPage.jsx';
import { SiteNotices } from './components/SiteNotices.jsx';
import { Toast } from './components/Toast.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { CategoryPage } from './pages/CategoryPage.jsx';
import { ProductPage } from './pages/ProductPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';
import { useAdminUnseen } from './pages/admin/useAdminUnseen.js';
// Eager: its '#dept-…' links scroll to their department before paint.
import { CatalogIndexPage } from './pages/support/CatalogIndexPage.jsx';
import { loadDialog, loadPage, prefetchChunks, whenIdle } from './lib/chunks.js';

// Loaded when first opened (AW-179), each under its name in
// scripts/chunk-urls.mjs LAZY_CHUNKS: loadPage and loadDialog wait for the
// connection when the file isn't cached, and a page whose file didn't
// download reloads once (NEW-006).
const QuotePage = lazyPage(() => loadPage('quote', () => import('./pages/QuotePage.jsx')).then((m) => ({ default: m.QuotePage })));
const AccountPage = lazyPage(() => loadPage('account', () => import('./pages/account/AccountPage.jsx')).then((m) => ({ default: m.AccountPage })));
const AdminPage = lazyPage(() => loadPage('admin', () => import('./pages/admin/AdminPage.jsx')).then((m) => ({ default: m.AdminPage })));
const ContactPage = lazyPage(() => loadPage('contact', () => import('./pages/support/ContactPage.jsx')).then((m) => ({ default: m.ContactPage })));
const DeliveryPage = lazyPage(() => loadPage('delivery', () => import('./pages/support/DeliveryPage.jsx')).then((m) => ({ default: m.DeliveryPage })));
const PolicyPage = lazyPage(() => loadPage('policy', () => import('./pages/support/PolicyPage.jsx')).then((m) => ({ default: m.PolicyPage })));
const ApplyPage = lazyPage(() => loadPage('apply', () => import('./pages/support/ApplyPage.jsx')).then((m) => ({ default: m.ApplyPage })));
const ResetPasswordPage = lazyPage(() => loadPage('reset', () => import('./pages/support/ResetPasswordPage.jsx')).then((m) => ({ default: m.ResetPasswordPage })));
const AuthModal = lazy(() => loadDialog('auth', () => import('./components/AuthModal.jsx')).then((m) => ({ default: m.AuthModal })));
// Fetched ahead once the page is idle (NEW-006): the pages and dialog a
// visit opens most, and every support page, so they open offline too.
const IDLE_CHUNKS = ['quote', 'account', 'auth', 'contact', 'delivery', 'policy', 'apply', 'reset'];

// Not-found routes that depend on what is in the catalog.
const CATALOG_KINDS = ['product', 'department', 'line'];
// Sign Out leads home, and its notice shows there.
const SIGNED_OUT_PAGE = '/';
const SIGNED_OUT_PAGE_KEY = pageKeyFor({ pathname: SIGNED_OUT_PAGE });

// The skip link (AW-166) focuses <main> and brings it into view, as following
// '#main' would, but leaves the address alone: the router reads a hash as an
// anchor on the page.
const skipToMain = (event) => {
  event.preventDefault();
  const main = document.getElementById('main');
  if (!main) return;
  main.focus({ preventScroll: true });
  main.scrollIntoView?.({ block: 'start' });
};

export default function App() {
  const age = useAgeGate();
  const gated = !age.confirmed;
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState('signin');
  const [helpOpen, setHelpOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutNotice, setSignOutNotice] = useState(null); // { text, pageKey }
  // What /reset-password shows, for its title (AW-255): { view, pageKey }.
  const [resetShown, setResetShown] = useState(null);
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
  // Offline (AW-344): a notice while it lasts; back online, say so and load a catalog that failed meanwhile.
  const online = useOnlineStatus();
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) {
      announce('You’re back online.');
      if (catalog.status === 'error') catalog.refresh();
    }
    wasOnline.current = online;
  }, [online, catalog]);
  // Signed in whenever there is a session, also before (or without) its
  // profile, so Sign Out is always within reach (AW-089).
  const user = session ? { name: profile?.name || '', business: profile?.business || '' } : null;
  const isApprovedBuyer = profile?.status === 'approved';
  // A quote, or an order for an approved buyer (AW-132, src/data/terms.js).
  const basket = basketTerms(isApprovedBuyer);
  // Ordering is paused on a suspended account (AW-201).
  const isSuspended = profile?.status === 'suspended';
  // Only an approved admin is one; the database's is_admin() says the same
  // (AW-352).
  const isAdmin = isApprovedAdmin(profile);
  // Orders placed since this admin last opened Admin -> Orders (AW-111): the
  // header's Admin link and the admin pages' titles show the count.
  const adminUnseen = useAdminUnseen(isAdmin ? profile.id : null);
  // Once the page is idle, the files of the pages and dialog that load on
  // demand go into the browser's cache (AW-179, NEW-006); Admin's only for
  // an admin.
  useEffect(() => whenIdle(() => prefetchChunks(IDLE_CHUNKS)), []);
  useEffect(() => (isAdmin ? whenIdle(() => prefetchChunks(['admin'])) : undefined), [isAdmin]);
  const departments = useMemo(() => departmentsFor(products), [products]);
  // The signed-in buyer's unit price for a product (and variant), or null:
  // no approved account, prices still loading, or price on request (AW-003).
  const prices = usePrices();
  const priceOf = useMemo(() => (id, variant) => priceFor(prices.prices, id, variant)?.unit ?? null, [prices.prices]);
  // The buyer's tier as my_prices() gives it, for saying what the prices on
  // screen are (AW-107, AW-265); null until the prices are in.
  const priceTier = useMemo(() => (prices.prices
    ? { tier: prices.prices.tier, label: prices.prices.tierLabel, discountPct: prices.prices.discountPct }
    : null), [prices.prices]);
  // A product's (or variant's) list price for the same buyer, to show beside
  // the tier price on the product page (AW-265); null without one.
  const listOf = useMemo(() => (id, variant) => priceFor(prices.prices, id, variant)?.list ?? null, [prices.prices]);
  // "Try again" on prices that didn't load (NEW-054), and checkout's "Load
  // prices again" (NEW-010); the notice stays when it fails again, so say so.
  const retryPrices = async () => {
    const result = await prices.refresh();
    if (!result.ok) announce('Your prices still didn’t load. Try again in a moment.');
  };
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
  // A signed-in account's cart is also saved with the account, so it follows
  // the buyer to another device (AW-334), once the database has the table.
  const cartSynced = useCartSync({ userId: session?.user?.id ?? null, owner }) === 'active';

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

  // The title names a saved receipt ('Quote received', AW-022) on /quote, or
  // else its heading once the account is known (AW-132), the count of orders
  // new since the last visit on /admin (AW-111), the account's state on
  // /apply ('Application under review', AW-098) and what /reset-password
  // shows ('Password updated', AW-255).
  // A signed-in account whose profile didn't load isn't a guest (NEW-002).
  const applyAs = accountView(profile, account);
  // /admin behind its sign-in or staff-only gate is titled by the gate, not
  // by a section that isn't on screen (NEW-020); while the account loads,
  // the section's title stays.
  const adminGated = adminGate(profile, account);
  // The reset page's view belongs to the page that reported it.
  if (resetShown && resetShown.pageKey !== location.pageKey) setResetShown(null);
  const resetAs = resetShown?.view || null;
  const metaRoute = useMemo(() => {
    if (receivedKind) return { ...route, received: receivedKind };
    if (route.page === 'quote' && account !== 'loading') return { ...route, basket: basket.kind };
    if (route.page === 'admin' && adminGated) return { ...route, gated: adminGated };
    if (route.page === 'admin' && adminUnseen > 0) return { ...route, unseen: adminUnseen };
    if (route.page === 'apply') return { ...route, applyAs };
    if (route.page === 'reset-password' && resetAs) return { ...route, view: resetAs };
    return route;
  }, [route, receivedKind, adminGated, adminUnseen, account, basket.kind, applyAs, resetAs]);
  const currentPageKey = location.pageKey;
  const onResetView = useCallback((view) => setResetShown({ view, pageKey: currentPageKey }), [currentPageKey]);
  useEffect(() => {
    applyPageMeta(pageMeta(metaRoute, products, departments));
  }, [metaRoute, products, departments]);
  // The sticky header's height (AW-153), measured before paint and before the
  // page-change scroll, which lands anchors below it (scroll-margin-top).
  const siteHeaderRef = useRef(null);
  useStickyHeader(siteHeaderRef);
  // The toasts keep clear of the footer's FDA warning (NEW-080).
  useFdaInset();
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
    // The last receipt and the quote form's draft hold the buyer's contact
    // details (AW-022, AW-080).
    clearReceipt();
    clearQuoteDraft();
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

  const notices = [...offlineNotices({ online }), ...accountNotices({
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
  }), ...pricesNotices(prices, { routePage: route.page }, { retry: retryPrices })];

  // Checkout loads the catalog and the buyer's prices again right before a
  // submit and stops when a line changed (AW-191): the cart as stored now,
  // priced against them. A failure names the part that failed, 'catalog' or
  // 'prices', so checkout can say which (NEW-010).
  const checkCart = async () => {
    const [latest, latestPrices] = await Promise.all([catalog.refresh(), prices.refresh()]);
    if (!latest.ok) return { ok: false, part: 'catalog', error: latest.error };
    if (!latestPrices.ok) return { ok: false, part: 'prices', error: latestPrices.error };
    const latestPriceOf = (id, variant) => priceFor(latestPrices.prices, id, variant)?.unit ?? null;
    return { ok: true, items: cart.itemsFor(latest.products, latestPriceOf) };
  };

  // Product cards need the account, its prices, the cart and the add/step
  // actions. account and signedIn let the pricing notice and the product
  // page tell a signed-in buyer whose profile is still loading (or didn't
  // load) from a guest, so they never offer Sign in to one (NEW-002).
  const cardProps = {
    profile, account, signedIn: !!session, isApprovedBuyer, priceOf, pricesStatus: prices.status, priceTier, listOf,
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
        return <HomePage products={products} departments={departments} {...cardProps} onApplyClick={openSignup} />;
      case 'product':
        return (
          <ProductPage key={route.productId} productId={route.productId} products={products} {...cardProps} onApplyClick={openSignup}
                       savedQty={cart.legacy.find(entry => entry.productId === route.productId)?.qty || 0}
                       catalogStatus={catalog.status} catalogSettled={catalog.settled} />
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
                     removeLines={cart.removeLines} clearCart={cart.clearCart} restoreLines={cart.restoreLines} owner={owner} legacy={cart.legacy} onDismissLegacy={cart.dismissLegacy}
                     profile={profile} account={account} signedIn={!!session} onSignIn={openSignin} onApplyClick={openSignup}
                     isApprovedBuyer={isApprovedBuyer} isSuspended={isSuspended} pricesStatus={prices.status} isBackendConfigured={isBackendConfigured} checkCart={checkCart}
                     onRetryPrices={retryPrices} pricesRefreshing={prices.refreshing}
                     savedReceipt={receiptHere} entryKey={location.key} onSubmitted={(receipt) => saveReceipt({ owner, entryKey: location.key, receipt })} cartSynced={cartSynced}
                     loadShipTo={isBackendConfigured ? loadAccountShipTo : null} />
        );
      case 'account':
        // Keyed by account: another buyer never sees the last one's orders (AW-190).
        return (
          <AccountPage key={session?.user?.id || 'guest'} {...accountProps} products={products} onApplyClick={openSignup}
                       addLines={cart.addLines} onOpenCart={() => setCartOpen(true)} isApprovedBuyer={isApprovedBuyer} isBackendConfigured={isBackendConfigured}
                       priceOf={priceOf} pricesStatus={prices.status} priceTier={priceTier}
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
        // Signed in, the page offers the account's own panel, never a
        // second application (AW-066, NEW-014); the support pages' side nav
        // calls /apply 'Trade account' (NEW-047).
        return <ContactPage onApplyClick={openApplication} signedIn={!!session} profile={profile} account={account} />;
      case 'delivery':
        return <DeliveryPage signedIn={!!session} />;
      case 'shipping':
      case 'privacy':
      case 'terms':
        return <PolicyPage kind={route.page} signedIn={!!session} />;
      case 'apply':
        return (
          <ApplyPage {...accountProps} isBackendConfigured={isBackendConfigured}
                     onApplyClick={openApplication} onLoginClick={openSignin} onResetClick={openReset} />
        );
      case 'reset-password':
        // Keyed by account: signing out ends a finished or half-done reset (AW-015).
        // 'Cancel and sign out' is the ordinary Sign Out (AW-253).
        return (
          <ResetPasswordPage key={session?.user?.id || 'guest'} auth={auth} onRequestReset={openReset} onLoginClick={openSignin}
                             onSignOut={signOutHere} signingOut={signingOut} onViewChange={onResetView} />
        );
      default:
        return (
          <NotFoundPage key={routeKey(route)} kind={route.kind} category={route.category} products={products} departments={departments}
                        catalog={route.catalog || null} onRetry={retryCatalog} retrying={catalog.refreshing} />
        );
    }
  };

  return (
    <div className="app-shell">
      {/* On paper only, above the page, in place of the header (AW-148). */}
      <PrintLetterhead />
      {/* The page's one banner landmark (AW-314): the skip link, first in the
          tab order (AW-166), the trade bar and the header. On windows at
          least 600px tall it sticks, its trade bar scrolled away: the
          compact layout's masthead too (AW-153). */}
      <header className="site-header" ref={siteHeaderRef}>
        <a className="skip-link" href="#main" onClick={skipToMain}>Skip to main content</a>
        <TradeBar signedIn={!!session} />

        <Header
          cartCount={cart.count} onCart={() => setCartOpen(true)}
          products={products} departments={departments}
          user={user} isAdmin={isAdmin} isApprovedBuyer={isApprovedBuyer} adminUnseen={adminUnseen}
          onLoginClick={openSignin} onSignupClick={openSignup} onLogout={signOutHere} signingOut={signingOut}
          onHelp={() => setHelpOpen(true)}
        />
      </header>

      {/* tabIndex -1: the fallback focus target after a page change (AW-041). */}
      <main className="container" id="main" tabIndex={-1}>
        <SiteNotices notices={notices} />
        <ErrorBoundary resetKey={routeKey(route)}>
          {/* Keyed by page: a page whose code is still loading shows the
              loading view, not the last page hidden underneath it (AW-179). */}
          <Suspense key={route.page} fallback={<PageLoading />}>
            {renderRoute()}
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer departments={departments} signedIn={!!session} onLoginClick={openSignin} onApplyClick={openSignup} onHelp={() => setHelpOpen(true)} />

      {/* Confirms an add (AW-072); its action opens the cart. */}
      <Toast onAction={(id) => { if (id === 'open-cart') setCartOpen(true); }} />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cart.items} total={cart.total}
                  setLine={cart.setLine} chooseVariant={cart.chooseVariant} removeLine={cart.removeLine} removeLines={cart.removeLines}
                  legacy={cart.legacy} onDismissLegacy={cart.dismissLegacy}
                  profile={profile} isApprovedBuyer={isApprovedBuyer} isSuspended={isSuspended} pricesStatus={prices.status} onLoginClick={openCartSignin}
                  cartSynced={cartSynced} />
      {helpOpen && <HelpDialog signedIn={!!session} onClose={() => setHelpOpen(false)} onApply={() => { setHelpOpen(false); openSignup(); }} />}
      {/* It has its own ModalLayer, so Escape and Back ask before a typed
          application is lost (AW-018). Sign Out closes it outright. Its code
          loads on first use, with a small dialog meanwhile (AW-179). */}
      {loginOpen && (
        <LazyDialog eyebrow="TRADE ACCOUNTS" onClose={() => setLoginOpen(false)}>
          <AuthModal initialMode={loginMode} onClose={() => setLoginOpen(false)} onSignOut={signOutHere} signingOut={signingOut} />
        </LazyDialog>
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
