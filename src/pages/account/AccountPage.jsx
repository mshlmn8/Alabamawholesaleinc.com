// Trade-account dashboard: profile summary, quick reorder by SKU, and order
// history with a Reorder action per order.
//
// While the session and profile load it says so instead of showing the
// signed-out view (AW-186); a profile that fails to load gets Try again and
// Sign out (AW-089). App keys this page by account (AW-190). "Sign out of all
// devices" ends the buyer's sessions everywhere (AW-337); the header's Sign
// Out only ends this browser's.
//
// Order history comes from useOrderHistory (AW-326, AW-194): it gives up on
// a stalled request, and a load that failed says so in words, with Try
// again and the trade desk's phone and email.

import { useState } from 'react';
import { linesFromOrder } from '../../lib/lines.js';
import { formatMoney } from '../../lib/format.js';
import { Link } from '../../lib/router.js';
import { lineTotal } from '../../lib/pricing.js';
import { Breadcrumbs, HOME_CRUMB } from '../../components/Breadcrumbs.jsx';
import { AccountLoading, AccountProblem } from '../../components/AccountStatus.jsx';
import { CallOrEmail } from '../../components/ContactLinks.jsx';
import { accountStatusLabel, roleLabel, tierLabel } from '../../lib/accountLabels.js';
import { QuickReorder } from './QuickReorder.jsx';
import { useOrderHistory } from './useOrderHistory.js';

const STATUS_CLASS = {
  new: '',
  contacted: 'contacted',
  quoted: 'contacted',
  fulfilled: 'fulfilled',
  cancelled: 'cancelled',
};

const STATUS_LABEL = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quote ready',
  confirmed: 'Confirmed',
  picking: 'Picking',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Why the order history isn't on screen (useOrderHistory's error).
export const ORDER_HISTORY_ERRORS = {
  offline: 'You’re offline. Your orders will load when you reconnect.',
  timeout: 'Your orders are taking too long to load.',
  failed: 'We couldn’t load your orders.',
};

// The note under an order after Reorder, as one string (AW-039).
const reorderMessage = (note, target) => (note.lines > 0
  ? `Added ${plural(note.lines, 'line')} (${plural(note.units, 'unit')}) to your ${target}.`
  : 'None of these items are available right now.')
  + (note.needsVariant > 0 ? ` ${plural(note.needsVariant, 'line')} need${note.needsVariant === 1 ? 's' : ''} a variant choice in the cart.` : '')
  + (note.unavailable.length > 0 ? ` No longer available: ${note.unavailable.join(', ')}.` : '');

export function AccountPage({
  profile, account = profile ? 'ready' : 'signed-out', onSignIn, onRetry, retrying = false, onSignOut, onSignOutEverywhere,
  signingOut = false, products = [], addLines, onOpenCart, isApprovedBuyer,
}) {
  const { orders, error, reload } = useOrderHistory(profile?.id ?? null);
  const [reorderNote, setReorderNote] = useState(null);

  // The same heading element in every state, so focus on it survives the
  // profile arriving.
  if (account !== 'ready' || !profile) {
    return (
      <section>
        <div className="page-head">
          <Breadcrumbs items={[HOME_CRUMB, { label: 'My Account' }]} />
          <p className="eyebrow">TRADE ACCOUNT</p>
          <h1>My account</h1>
          {account === 'loading' && <AccountLoading />}
          {account === 'no-profile' && (
            <AccountProblem onRetry={onRetry} retrying={retrying} onSignOut={onSignOut} signingOut={signingOut} />
          )}
          {account === 'signed-out' && <p>Sign in to view your account, order history, and quick reorder.</p>}
          {account === 'signed-out' && onSignIn && (
            <div className="dialog-actions compact-actions">
              <button className="button" type="button" onClick={onSignIn}>Sign in</button>
            </div>
          )}
        </div>
      </section>
    );
  }

  const statusTone = profile.status === 'approved' ? 'ok' : 'warn';
  const target = isApprovedBuyer ? 'order' : 'quote';

  const reorder = (order) => {
    const { lines, unavailable, needsVariant } = linesFromOrder(order, products);
    if (lines.length && addLines) addLines(lines);
    setReorderNote({
      orderId: order.id,
      lines: lines.length,
      units: lines.reduce((sum, line) => sum + line.qty, 0),
      unavailable,
      needsVariant,
    });
  };

  return (
    <section>
      <div className="page-head">
        <Breadcrumbs items={[HOME_CRUMB, { label: 'My Account' }]} />
        <p className="eyebrow">TRADE ACCOUNT</p>
        <h1>{profile.business || profile.name}</h1>
        <p>{profile.email}</p>
      </div>

      {/* Labels, not database values (AW-149); the role only for staff. */}
      <div className="account-stats">
        <Stat label="Account status" value={accountStatusLabel(profile.status)} tone={statusTone} />
        <Stat label="Pricing tier" value={tierLabel(profile.pricing_tier)} />
        {profile.role === 'admin' && <Stat label="Role" value={roleLabel(profile.role)} />}
      </div>

      {/* Licence proof stays reachable after approval (AW-254). */}
      <p className="notice">License and resale documents: <Link className="text-link" to="/apply">view or replace</Link></p>

      {profile.status === 'pending' && (
        <p className="notice">Your account is awaiting approval. A trade rep will verify your retail license and activate pricing within one business day.</p>
      )}

      {onSignOutEverywhere && (
        <div className="account-signout">
          <button className="button ghost" type="button" onClick={onSignOutEverywhere} disabled={signingOut}>
            <span>{signingOut ? 'Signing out…' : 'Sign out of all devices'}</span>
          </button>
          <p className="result-note">Ends your sessions on every computer and phone, including this one. Sign Out in the header only signs out this browser.</p>
        </div>
      )}

      <section className="section" id="quick-reorder">
        <div className="section-head">
          <div>
            <p className="eyebrow">QUICK REORDER</p>
            <h2>Reorder by SKU</h2>
          </div>
        </div>
        <QuickReorder products={products} addLines={addLines} onOpenCart={onOpenCart} isApprovedBuyer={isApprovedBuyer} />
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">HISTORY</p>
            <h2>Order history</h2>
          </div>
        </div>

        {error && (
          <div className="orders-problem" role="alert">
            <p className="form-error"><span>{ORDER_HISTORY_ERRORS[error] || ORDER_HISTORY_ERRORS.failed}</span> <CallOrEmail before="Need an order now? Call" after="." /></p>
            <button className="text-link" type="button" onClick={reload}>Try again</button>
          </div>
        )}
        {orders === null && !error && <p className="result-note">Loading…</p>}
        {orders && orders.length === 0 && (
          <div className="empty-results">
            <h2>No orders yet</h2>
            <p>Orders you place will show up here, each with a one-click Reorder.</p>
          </div>
        )}
        {orders && orders.length > 0 && (
          <div className="order-list">
            {orders.map(o => {
              const label = STATUS_LABEL[o.status] || STATUS_LABEL.new;
              const tone = STATUS_CLASS[o.status] || '';
              const note = reorderNote?.orderId === o.id ? reorderNote : null;
              return (
                <article className="order-card" key={o.id}>
                  <div className="order-head">
                    <div>
                      <b className="order-ref">{o.ref_num}</b>
                      <small>
                        {`${new Date(o.created_at).toLocaleString()} · ${plural(o.total_units, 'unit')}${o.subtotal != null ? ` · ${formatMoney(o.subtotal)}` : ''}`}
                      </small>
                    </div>
                    <div className="order-actions">
                      <span className={`status-pill ${tone}`}>{label}</span>
                      <button className="button xs ghost" type="button" onClick={() => reorder(o)} disabled={!(o.order_items || []).length}>
                        Reorder
                      </button>
                    </div>
                  </div>
                  <ul className="order-items">
                    {(o.order_items || []).map(it => (
                      <li key={it.id}>
                        <span><span>{`${it.qty} × ${it.product_name}`}</span> <span className="sku">{`(${it.sku})`}</span></span>
                        {it.unit_price != null && (
                          <span className="line-total">{formatMoney(lineTotal(it.unit_price, it.qty))}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {note && (
                    <div className="order-foot" role="status">
                      <p>{reorderMessage(note, target)}</p>
                      {note.lines > 0 && <button className="button xs" type="button" onClick={onOpenCart}>Review cart</button>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`stat-card${tone ? ` ${tone}` : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
