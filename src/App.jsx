// App root: age gate, auth, catalog, cart and route state, the page layout
// and the route switch. Pages live in src/pages/, shared pieces in
// src/components/ and src/lib/.

import { useState, useEffect, useMemo } from 'react';

import { STORAGE } from './data/content.js';
import { useAuth } from './lib/useAuth.js';
import { useCatalog } from './lib/useCatalog.js';
import { useCart } from './lib/cart.js';
import { useRoute, routeKey } from './lib/router.js';
import { pageMeta, applyPageMeta } from './lib/meta.js';
import { departmentsFor } from './lib/departments.js';
import { AgeGate } from './components/AgeGate.jsx';
import { TradeBar } from './components/TradeBar.jsx';
import { Header } from './components/Header.jsx';
import { Footer } from './components/Footer.jsx';
import { CartDrawer } from './components/CartDrawer.jsx';
import { HelpDialog } from './components/HelpDialog.jsx';
import { AuthModal } from './components/AuthModal.jsx';
import { ModalLayer } from './components/ModalLayer.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { CategoryPage } from './pages/CategoryPage.jsx';
import { ProductPage } from './pages/ProductPage.jsx';
import { QuotePage } from './pages/QuotePage.jsx';
import { AccountPage } from './pages/account/AccountPage.jsx';
import { AdminPage } from './pages/admin/AdminPage.jsx';
import { CatalogIndexPage } from './pages/support/CatalogIndexPage.jsx';
import { ContactPage } from './pages/support/ContactPage.jsx';
import { DeliveryPage } from './pages/support/DeliveryPage.jsx';
import { PolicyPage } from './pages/support/PolicyPage.jsx';
import { ApplyPage } from './pages/support/ApplyPage.jsx';
import { ResetPasswordPage } from './pages/support/ResetPasswordPage.jsx';

export default function App() {
  const [verified, setVerified] = useState(() => window.localStorage.getItem(STORAGE.age) === 'yes');
  const [tooYoung, setTooYoung] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState('signin');
  const [helpOpen, setHelpOpen] = useState(false);

  const auth = useAuth();
  const { products } = useCatalog();
  const { profile, signOut, isBackendConfigured } = auth;
  // A password-recovery (or expired) email link takes over the page until it is dismissed.
  const accountLinkPage = auth.recovery || !!auth.linkError;
  const user = profile ? { id: profile.id, name: profile.name, email: profile.email, business: profile.business } : null;
  const isApprovedBuyer = profile?.status === 'approved';
  const isAdmin = profile?.role === 'admin';
  const departments = useMemo(() => departmentsFor(products), [products]);
  const cart = useCart(products, profile);

  const { route, navigate } = useRoute();

  // Header search reports its live query so the tab title follows it.
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    // A recovery/expired account link shows the reset page whatever the hash says.
    const shown = accountLinkPage ? { page: 'reset-password' } : route;
    applyPageMeta(pageMeta(shown, products, departments, searchTerm));
  }, [route, products, departments, searchTerm, accountLinkPage]);

  const goHome = () => navigate({ page: 'home' });
  const goProduct = (id) => navigate({ page: 'product', productId: id });
  const goCategory = (cat, sub = null) => navigate({ page: 'category', category: cat, sub });
  const goQuote = () => { setCartOpen(false); navigate({ page: 'quote' }); };
  const goCatalog = () => navigate({ page: 'catalog' });
  const goAccount = () => navigate({ page: 'account' });
  const goHomeSection = (sectionId) => {
    const scrollToSection = () => window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ block: 'start' });
    }));
    if (route.page === 'home') scrollToSection();
    else { navigate({ page: 'home' }, { scroll: false }); scrollToSection(); }
  };
  // Escape handling, body scroll lock and the inert background live in
  // ModalLayer so every dialog (including the auth modal) behaves the same.

  const handleAgeYes = () => { setVerified(true); window.localStorage.setItem(STORAGE.age, 'yes'); };
  const handleLogout = async () => { await signOut(); navigate({ page: 'home' }); };

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

  if (!verified) return <AgeGate onYes={handleAgeYes} onNo={() => setTooYoung(true)} tooYoung={tooYoung} />;

  // Product cards need the account, the cart and the add/step actions.
  const cardProps = {
    profile, isApprovedBuyer, cart: cart.cart, addLine: cart.addLine, decLine: cart.decLine,
    goProduct, onLoginClick: openSignin,
  };

  const renderRoute = () => {
    if (accountLinkPage) {
      return <ResetPasswordPage key="account-link" navigate={navigate} auth={auth} onRequestReset={openReset} onLoginClick={openSignin} />;
    }
    switch (route.page) {
      case 'home':
        return <HomePage products={products} departments={departments} {...cardProps} goCategory={goCategory} goCatalog={goCatalog} onApplyClick={openSignup} />;
      case 'product':
        return (
          <ProductPage productId={route.productId} products={products} {...cardProps} goHome={goHome} goCategory={goCategory}
                       onApplyClick={openSignup} onAccountClick={goAccount} />
        );
      case 'category':
        return (
          <CategoryPage category={route.category} sub={route.sub} products={products} departments={departments} {...cardProps}
                        goHome={goHome} goCategory={goCategory} />
        );
      case 'quote':
        return (
          <QuotePage items={cart.items} total={cart.total} addLine={cart.addLine} decLine={cart.decLine} removeLine={cart.removeLine}
                     clearCart={cart.clearCart} goHome={goHome} goCatalog={goCatalog} goProduct={goProduct} profile={profile}
                     isApprovedBuyer={isApprovedBuyer} isBackendConfigured={isBackendConfigured} />
        );
      case 'account':
        return (
          <AccountPage profile={profile} goHome={goHome} onSignIn={openSignin} products={products}
                       addLines={cart.addLines} onOpenCart={() => setCartOpen(true)} isApprovedBuyer={isApprovedBuyer} />
        );
      case 'admin':
        return <AdminPage profile={profile} goHome={goHome} />;
      case 'catalog':
        return (
          <CatalogIndexPage products={products} departments={departments} profile={profile} isApprovedBuyer={isApprovedBuyer}
                            goHome={goHome} goCategory={goCategory} goProduct={goProduct} onLoginClick={openSignin} />
        );
      case 'contact':
        return <ContactPage goHome={goHome} navigate={navigate} onApplyClick={openSignup} />;
      case 'delivery':
        return <DeliveryPage goHome={goHome} navigate={navigate} />;
      case 'shipping':
      case 'privacy':
      case 'terms':
        return <PolicyPage kind={route.page} goHome={goHome} navigate={navigate} />;
      case 'apply':
        return (
          <ApplyPage goHome={goHome} navigate={navigate} profile={profile} isBackendConfigured={isBackendConfigured}
                     onApplyClick={openApplication} onLoginClick={openSignin} onResetClick={openReset} />
        );
      case 'reset-password':
        return <ResetPasswordPage navigate={navigate} auth={auth} onRequestReset={openReset} onLoginClick={openSignin} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <TradeBar onApplyClick={openSignup} />

      <Header
        cartCount={cart.count} onCart={() => setCartOpen(true)}
        goHome={goHome} goCategory={goCategory} goProduct={goProduct}
        products={products} departments={departments}
        onNewArrivals={() => goHomeSection('new-arrivals')} onBestsellers={() => goHomeSection('bestsellers')}
        user={user} isAdmin={isAdmin}
        onAccountClick={goAccount}
        onAdminClick={() => navigate({ page: 'admin' })}
        onLoginClick={openSignin} onSignupClick={openSignup} onLogout={handleLogout}
        onHelp={() => setHelpOpen(true)} onReorder={goAccount} onCatalog={goCatalog}
        onSearchChange={setSearchTerm}
      />

      <main className="container">
        <ErrorBoundary resetKey={accountLinkPage ? 'account-link' : routeKey(route)}>
          {renderRoute()}
        </ErrorBoundary>
      </main>

      <Footer goHome={goHome} goCategory={goCategory} departments={departments} onLoginClick={openSignin} onApplyClick={openSignup}
              onNewArrivals={() => goHomeSection('new-arrivals')} onBestsellers={() => goHomeSection('bestsellers')} navigate={navigate} />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={cart.items} total={cart.total}
                  addLine={cart.addLine} decLine={cart.decLine} removeLine={cart.removeLine} goQuote={goQuote} goProduct={goProduct}
                  profile={profile} isApprovedBuyer={isApprovedBuyer} onLoginClick={openCartSignin} />
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} onApply={() => { setHelpOpen(false); openSignup(); }} />}
      {loginOpen && (
        <ModalLayer onClose={() => setLoginOpen(false)}>
          <AuthModal open initialMode={loginMode} onClose={() => setLoginOpen(false)} onNavigate={navigate} />
        </ModalLayer>
      )}
    </div>
  );
}
