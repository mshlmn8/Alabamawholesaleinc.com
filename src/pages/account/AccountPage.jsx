// Trade-account dashboard: profile summary, quick reorder by SKU, and order
// history with a Reorder action per order.
//
// While the session and profile load it says so instead of showing the
// signed-out view (AW-186); a profile that fails to load gets Try again and
// Sign out (AW-089). App keys this page by account (AW-190). Under the email,
// Change password and Sign out (AW-252); Sign out, like the header's, only
// ends this browser's session, and "Sign out of all devices" ends the
// buyer's sessions everywhere (AW-337).
//
// A pending applicant uploads license documents right here (AW-085): the
// application dialog's 'View account status' and its failed-upload notes
// link to #documents. Approved and suspended accounts keep a link to /apply.
//
// Signed out, it says what a trade account gives and offers Sign in and
// Apply (AW-086). The header's Quick Reorder links to #quick-reorder; a guest
// gets the sign-in dialog over this page, and once the account has loaded
// the section is brought into view with its heading focused.
//
// Order history is OrderHistory (AW-104, AW-105): it gives up on a stalled
// request (AW-194), says when the buyer is offline and loads on reconnect
// (AW-344), and a load that failed says so in words, with Try again and the
// trade desk's phone and email (AW-326, AW-084).

import { useEffect, useRef } from 'react';
import { Link, revealAnchor, useLocation } from '../../lib/router.js';
import { tierDiscountText, tierName } from '../../lib/pricing.js';
import { Breadcrumbs, HOME_CRUMB } from '../../components/Breadcrumbs.jsx';
import { AccountLoading, AccountProblem } from '../../components/AccountStatus.jsx';
import { CallOrEmail } from '../../components/ContactLinks.jsx';
import { ApplicationDocuments } from '../../components/DocumentUploads.jsx';
import { accountStatusLabel, roleLabel } from '../../lib/accountLabels.js';
import { QuickReorder } from './QuickReorder.jsx';
import { OrderHistory } from './OrderHistory.jsx';

// Order history that didn't load (AW-084, AW-326) lives with the history now.
export { ORDERS_LOAD_ERROR, ORDER_HISTORY_ERRORS, OrdersLoadError } from './OrderHistory.jsx';

// The sections a link can open My account at (AW-086): Quick Reorder from
// the header, the license documents from the application dialog.
const REVEALED_SECTIONS = ['quick-reorder', 'documents'];
// What a trade account gives, for a visitor who is signed out (AW-086).
export const SIGNED_OUT_TEXT = 'A trade account shows your order history, lets you reorder by SKU with Quick Reorder, and shows your wholesale prices once it is approved.';

export function AccountPage({
  profile, account = profile ? 'ready' : 'signed-out', onSignIn, onApplyClick, onRetry, retrying = false, onSignOut, onSignOutEverywhere,
  signingOut = false, products = [], addLines, onOpenCart, isApprovedBuyer, isBackendConfigured = true, priceOf, pricesStatus, priceTier = null,
}) {
  // A link to #quick-reorder or #documents that arrived before the account
  // did (a guest's Quick Reorder, then sign-in; a reload): when the account
  // turns ready, the section comes into view with its heading focused, once.
  // A page that was ready from the start had that from the router, and a
  // saved scroll position (Back, a reload) is left alone.
  const location = useLocation();
  const ready = account === 'ready' && !!profile;
  const wasReady = useRef(ready);
  const { hash } = location;
  const restored = !!location.restore;
  useEffect(() => {
    const was = wasReady.current;
    wasReady.current = ready;
    const id = hash.slice(1);
    if (!ready || was || restored || !REVEALED_SECTIONS.includes(id)) return undefined;
    return revealAnchor(id);
  }, [ready, hash, restored]);

  // The same heading element in every state, so focus on it survives the
  // profile arriving.
  if (account !== 'ready' || !profile) {
    return (
      <section>
        <div className="page-head">
          <Breadcrumbs items={[HOME_CRUMB, { label: 'My account' }]} />
          <p className="eyebrow">TRADE ACCOUNT</p>
          <h1>My account</h1>
          {account === 'loading' && <AccountLoading />}
          {account === 'no-profile' && (
            <AccountProblem onRetry={onRetry} retrying={retrying} onSignOut={onSignOut} signingOut={signingOut} />
          )}
          {account === 'signed-out' && <p>{SIGNED_OUT_TEXT}</p>}
          {account === 'signed-out' && (onSignIn || onApplyClick) && (
            <div className="dialog-actions compact-actions">
              {onSignIn && <button className="button" type="button" onClick={onSignIn}>Sign in</button>}
              {onApplyClick && <button className="button ghost" type="button" onClick={onApplyClick}>Apply for a trade account</button>}
            </div>
          )}
        </div>
      </section>
    );
  }

  const statusTone = profile.status === 'approved' ? 'ok' : 'warn';
  // The tier and what it means, from my_prices() once the prices are in
  // ('Silver · 5% off list', AW-265); until then the tier's name.
  const tierText = pricesStatus === 'ready' && priceTier ? tierDiscountText(priceTier) : tierName(profile.pricing_tier);

  return (
    <section>
      <div className="page-head">
        <Breadcrumbs items={[HOME_CRUMB, { label: 'My account' }]} />
        <p className="eyebrow">TRADE ACCOUNT</p>
        <h1>{profile.business || profile.name}</h1>
        <p>{profile.email}</p>
        {/* The password and this browser's sign-out, also on phones, where
            the header's Sign Out is in the menu (AW-252). */}
        <div className="dialog-actions compact-actions account-links">
          <Link className="text-link" to="/reset-password">Change password</Link>
          {onSignOut && <button className="text-link" type="button" onClick={onSignOut} disabled={signingOut}>Sign out</button>}
        </div>
      </div>

      {/* Labels, not database values (AW-149); the role only for staff. */}
      <div className="account-stats">
        <Stat label="Account status" value={accountStatusLabel(profile.status)} tone={statusTone} />
        <Stat label="Pricing tier" value={tierText} asWritten />
        {profile.role === 'admin' && <Stat label="Role" value={roleLabel(profile.role)} />}
      </div>

      {/* A suspended account is told why nothing can be ordered, and who to
          call (AW-101): the sentence the cart and checkout use. */}
      {profile.status === 'suspended' && (
        <p className="notice">Ordering is paused on this account. <CallOrEmail after=" and a trade rep will help you sort it out." /></p>
      )}

      {/* Licence proof stays reachable after approval (AW-254). */}
      {profile.status !== 'pending' && (
        <p className="notice">License and resale documents: <Link className="text-link" to="/apply">view or replace</Link></p>
      )}

      {profile.status === 'pending' && (
        <p className="notice">Your account is awaiting approval. A trade rep will verify your retail license and activate pricing within one business day.</p>
      )}

      {profile.status === 'pending' && <ApplicationDocuments status="pending" disabled={!isBackendConfigured} id="documents" />}

      {onSignOutEverywhere && (
        <div className="account-signout">
          <button className="button ghost" type="button" onClick={onSignOutEverywhere} disabled={signingOut}>
            <span>{signingOut ? 'Signing out…' : 'Sign out of all devices'}</span>
          </button>
          <p className="result-note">Ends your sessions on every computer and phone, including this one. Sign out, at the top of this page, only signs out this browser.</p>
        </div>
      )}

      <section className="section" id="quick-reorder">
        <div className="section-head">
          <div>
            <p className="eyebrow">QUICK REORDER</p>
            <h2>Reorder by SKU</h2>
          </div>
        </div>
        <QuickReorder products={products} addLines={addLines} onOpenCart={onOpenCart} isApprovedBuyer={isApprovedBuyer}
                      priceOf={priceOf} pricesStatus={pricesStatus} />
      </section>

      {/* Keyed: another account starts from nothing (AW-326). */}
      <OrderHistory key={profile.id} userId={profile.id} products={products} addLines={addLines} onOpenCart={onOpenCart} isApprovedBuyer={isApprovedBuyer} />
    </section>
  );
}

// asWritten: the value is already in sentence case ('Silver · 5% off list').
function Stat({ label, value, tone, asWritten = false }) {
  return (
    <div className={`stat-card${tone ? ` ${tone}` : ''}`}>
      <span>{label}</span>
      <b className={asWritten ? 'as-written' : undefined}>{value}</b>
    </div>
  );
}
