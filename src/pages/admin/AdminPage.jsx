// Admin dashboard: orders, account approvals, product catalog edits.
// All write paths use the row-level-security policies in 20260517000001_rls_policies.sql.
// The sections live in OrdersSection.jsx, AccountsSection.jsx and
// ProductsSection.jsx; this file is the access gate and the section links,
// and re-exports the sections' helpers.
//
// Each section has its own URL (AW-118, src/lib/adminRoutes.js): /admin
// (Orders), /admin/orders?status=…, /admin/orders/:id/print?doc=pick|slip
// (AW-110), /admin/accounts?status=… (AW-268), /admin/products?q=…,
// /admin/pricing (the tier discounts, AW-114).
// Every admin URL is the same page to the router (pageKey 'admin'), so moving
// between sections and filters keeps the scroll position and focus, and Back
// returns to the previous section. A detail view (the product editor,
// /admin/products/:id and /new; an order's print view; an account's page,
// /admin/accounts/:id, AW-113) moves focus itself, and hands back a
// returnFocusId that its list focuses when it shows again.
//
// The Orders and Accounts searches are kept here, not in the URL (they name
// people), so they survive a visit to a print view or an account's page. Opening Orders (a print view included)
// is a visit: orders placed since the previous one are marked New (AW-111,
// ordersSeen.js).

import { useEffect, useState } from 'react';
import { Link, navigate } from '../../lib/router.js';
import { supabase } from '../../lib/supabase.js';
import { adminHref, adminPath, adminSection } from '../../lib/adminRoutes.js';
import { Breadcrumbs, HOME_CRUMB } from '../../components/Breadcrumbs.jsx';
import { AccountLoading, AccountProblem } from '../../components/AccountStatus.jsx';
import { OrdersTab } from './OrdersSection.jsx';
import { AccountsTab } from './AccountsSection.jsx';
import { ProductsTab } from './ProductsSection.jsx';
import { PricingTab } from './PricingSection.jsx';
import { PrintSheet } from './PrintSheet.jsx';
import { AdminStatus, useAdminStatus } from './AdminStatus.jsx';
import { useOrdersSeen } from './ordersSeen.js';

export {
  ORDER_STATES, LEGACY_ORDER_STATES, hasQuoteWorkflow, isQuote, orderActionError, loadListPrices, suggestedUnitPrice,
  parseOrderLines, orderEmail, ADMIN_ORDER_SELECT,
} from './OrdersSection.jsx';
export { approvalEmail, approvalLine } from './AccountsSection.jsx';
export { loadAdminProducts } from './ProductsSection.jsx';

const SECTIONS = [
  { id: 'orders', label: 'Orders' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'products', label: 'Products' },
  { id: 'pricing', label: 'Pricing' },
];
const NO_QUERY = Object.freeze({});

// route: the admin route (parseAdminPath); bare /admin shows Orders.
// onCatalogChange: a product was edited; the storefront loads the catalog
// again so this tab shows the edit at once (AW-191).
export function AdminPage({
  profile, account = profile ? 'ready' : 'signed-out', onSignIn, onRetry, retrying = false, onSignOut, signingOut = false,
  onCatalogChange, route = { page: 'admin' },
}) {
  const status = useAdminStatus();
  const section = adminSection(route);
  const query = route.query || NO_QUERY;
  const detail = route.id != null;
  // Each section's last list filters, so its link brings them back after a
  // visit to another section or a detail view.
  const [lastQuery, setLastQuery] = useState({});
  if (!detail && lastQuery[section] !== query) setLastQuery({ ...lastQuery, [section]: query });
  // The control a section's list focuses when a detail view closes (e.g. the
  // Edit link of the product just saved).
  const [returnFocusId, setReturnFocusId] = useState(null);
  // Orders: the search box, and the print view the list opened
  // ({ path, linkId }), so Back from it goes back in history to the list.
  const [orderSearch, setOrderSearch] = useState('');
  const [printFrom, setPrintFrom] = useState(null);
  const [accountSearch, setAccountSearch] = useState('');
  const approvedAdmin = profile?.role === 'admin' && profile?.status === 'approved';
  const ordersSince = useOrdersSeen(approvedAdmin && account === 'ready' && section === 'orders', supabase);
  // A filter change replaces the history entry and keeps the scroll position.
  // options.force: the change keeps any unsaved edit, so it skips the leave guard.
  const setQuery = (next, options = {}) => navigate(adminHref({ section, query: next }), { replace: true, scroll: false, ...options });
  // Back from a print view: back in history when the list opened it (the
  // list's filters and scroll position come back), else the link's own
  // navigation; either way the print link that opened it takes focus.
  const leavePrint = (event) => {
    if (printFrom) setReturnFocusId(printFrom.linkId);
    const back = printFrom && printFrom.path === window.location.pathname;
    setPrintFrom(null);
    if (back) {
      event.preventDefault();
      window.history.back();
    }
  };
  // The address bar shows only the checked query: keys the section doesn't
  // know (a pasted ?email=…) and default values are dropped from it too.
  useEffect(() => {
    if (!route.section || window.location.pathname !== adminPath(route)) return;
    const canonical = adminHref(route);
    if (window.location.pathname + window.location.search !== canonical) {
      navigate(canonical + window.location.hash, { replace: true, scroll: false, force: true });
    }
  }, [route]);

  // While auth loads, a real admin sees "Loading", not "access denied"
  // (AW-087). Not a dead end otherwise (AW-232): signed-out visitors can sign
  // in, and signed-in accounts without the admin role get a way back. The
  // server boundary is RLS (is_admin()); this is only what the page shows.
  // (Laid out like the dashboard, so its heading stays put when it loads.)
  if (account === 'loading' || account === 'no-profile') {
    return (
      <section>
        <div className="page-head">
          <Breadcrumbs items={[HOME_CRUMB, { label: 'Admin' }]} />
          <p className="eyebrow">TRADE DESK</p>
          <h1>Admin</h1>
          {account === 'loading'
            ? <AccountLoading />
            : <AccountProblem onRetry={onRetry} retrying={retrying} onSignOut={onSignOut} signingOut={signingOut} />}
        </div>
      </section>
    );
  }
  // Only an approved admin gets the dashboard, as only an approved admin
  // passes is_admin() in the database (AW-352). A suspended or pending admin
  // is told their access is on hold.
  if (!profile || profile.role !== 'admin' || profile.status !== 'approved') {
    const held = profile?.role === 'admin';
    return (
      <section className="page-head">
        <Breadcrumbs items={[HOME_CRUMB, { label: 'Admin' }]} />
        <p className="eyebrow">TRADE DESK</p>
        <h1>{profile ? 'This page is for the trade desk' : 'Sign in to continue'}</h1>
        <p>{held
          ? 'Your admin access is on hold. Contact the owner.'
          : profile
            ? 'The admin area is only open to Alabama Wholesale staff accounts. Your account doesn’t have access.'
            : 'The admin area is only open to Alabama Wholesale staff accounts. Sign in with a staff account to continue.'}</p>
        <div className="dialog-actions compact-actions">
          {profile
            ? <Link className="button" to="/account">My account</Link>
            : <button className="button" type="button" onClick={onSignIn}>Sign in</button>}
          <Link className="text-link" to="/">Back to home</Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-head">
        <Breadcrumbs items={[HOME_CRUMB, { label: 'Admin' }]} />
        <p className="eyebrow">TRADE DESK</p>
        <h1>Admin</h1>
        <p>Orders, account approvals, catalog edits, and pricing tiers.</p>
      </div>

      <nav className="sub-pills admin-sections" aria-label="Admin sections">
        {SECTIONS.map(s => {
          const current = s.id === section;
          return (
            <Link
              key={s.id}
              to={adminHref({ section: s.id, query: current && !detail ? query : lastQuery[s.id] })}
              className={`sub-pill${current ? ' active' : ''}`}
              aria-current={current ? 'page' : undefined}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>

      {section === 'orders' && route.view === 'print' && route.id != null && (
        <PrintSheet orderId={route.id} doc={query.doc} listHref={adminHref({ section: 'orders', query: lastQuery.orders })} onBack={leavePrint} />
      )}
      {section === 'orders' && !detail && (
        <OrdersTab query={query} onQuery={setQuery} notify={status.show} search={orderSearch} onSearch={setOrderSearch} since={ordersSince}
          onOpenPrint={(href, linkId) => setPrintFrom({ path: href.split('?')[0], linkId })}
          returnFocusId={returnFocusId} onReturnFocus={setReturnFocusId} />
      )}
      {section === 'accounts' && (
        <AccountsTab route={route} query={query} onQuery={setQuery} currentAdminId={profile.id} notify={status.show} search={accountSearch} onSearch={setAccountSearch}
          returnFocusId={returnFocusId} onReturnFocus={setReturnFocusId} />
      )}
      {section === 'products' && (
        <ProductsTab route={route} query={query} onQuery={setQuery} onCatalogChange={onCatalogChange} notify={status.show}
          returnFocusId={returnFocusId} onReturnFocus={setReturnFocusId} />
      )}
      {section === 'pricing' && <PricingTab notify={status.show} />}
      <AdminStatus status={status} />
    </section>
  );
}
