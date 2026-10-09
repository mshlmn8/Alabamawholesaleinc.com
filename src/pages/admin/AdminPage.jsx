// Admin dashboard: orders, account approvals, product catalog edits.
// All write paths use the row-level-security policies in 20260517000001_rls_policies.sql.
// The sections live in OrdersSection.jsx, AccountsSection.jsx and
// ProductsSection.jsx; this file is the access gate and the section switch,
// and re-exports the sections' helpers.

import { useState } from 'react';
import { Link } from '../../lib/router.js';
import { Breadcrumbs, HOME_CRUMB } from '../../components/Breadcrumbs.jsx';
import { AccountLoading, AccountProblem } from '../../components/AccountStatus.jsx';
import { OrdersTab } from './OrdersSection.jsx';
import { AccountsTab } from './AccountsSection.jsx';
import { ProductsTab } from './ProductsSection.jsx';

export {
  ORDER_STATES, LEGACY_ORDER_STATES, hasQuoteWorkflow, isQuote, orderActionError, loadListPrices, suggestedUnitPrice,
  parseOrderLines, orderEmail, ADMIN_ORDER_SELECT,
} from './OrdersSection.jsx';
export { approvalEmail, approvalLine } from './AccountsSection.jsx';
export { loadAdminProducts } from './ProductsSection.jsx';

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'products', label: 'Products' },
];

// onCatalogChange: a product was edited; the storefront loads the catalog
// again so this tab shows the edit at once (AW-191).
export function AdminPage({
  profile, account = profile ? 'ready' : 'signed-out', onSignIn, onRetry, retrying = false, onSignOut, signingOut = false,
  onCatalogChange,
}) {
  const [tab, setTab] = useState('orders');

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
        <p>Orders, account approvals, and catalog edits.</p>
      </div>

      <div className="sub-pills" role="tablist" aria-label="Admin sections">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`sub-pill ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'orders' && <OrdersTab />}
      {tab === 'accounts' && <AccountsTab currentAdminId={profile.id} />}
      {tab === 'products' && <ProductsTab onCatalogChange={onCatalogChange} />}
    </section>
  );
}
