// Slide-in cart: the lines in the cart, the estimated total (approved
// accounts) and the checkout/quote actions. Above the lines: products from an
// older cart that still need a variant (AW-354) and lines that can no longer
// be ordered (AW-083).

import { formatMoney } from '../lib/format.js';
import { Link } from '../lib/router.js';
import { ModalLayer } from './ModalLayer.jsx';
import { CartLine } from './CartLine.jsx';
import { SavedLinesNotice, UnavailableNotice } from './CartNotices.jsx';

export function CartDrawer({
  open, onClose, items, total, addLine, decLine, removeLine, removeLines, legacy = [], onDismissLegacy,
  profile, isApprovedBuyer, onLoginClick,
}) {
  if (!open) return null;
  const unavailable = items.filter(it => it.unavailable);
  // Guests are asked to sign in; signed-in buyers who are not approved yet are
  // told pricing is waiting on approval instead.
  const pendingBuyer = Boolean(profile) && !isApprovedBuyer;
  return (
    <ModalLayer onClose={onClose}>
      <div className="overlay overlay-soft" aria-hidden="true" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="drawer-head">
          <h2 id="cart-title">Your order</h2>
          <button className="dialog-close" onClick={onClose} aria-label="Close cart">×</button>
        </div>
        <div className="drawer-body">
          <SavedLinesNotice items={legacy} onDismiss={onDismissLegacy} onChoose={onClose} />
          <UnavailableNotice items={unavailable} onRemoveAll={removeLines} />
          {items.length === 0 && <p className="empty-note">Your cart is empty.<br />Browse the catalog and add items to build an order.</p>}
          {items.length > 0 && (
            <ul className="drawer-lines" aria-label="Items in your order">
              {items.map(it => (
                <CartLine key={it.lineKey} item={it} layout="drawer" showPrice={isApprovedBuyer}
                          onInc={() => addLine(it.productId, it.variant)} onDec={() => decLine(it.lineKey)}
                          onRemove={() => removeLine(it.lineKey)} onChoose={onClose} />
              ))}
            </ul>
          )}
        </div>
        <div className="drawer-foot">
          <div className="drawer-total">
            <span>Estimated total</span>
            {isApprovedBuyer
              ? <span>{formatMoney(total)}</span>
              : <span className="drawer-total-note">{pendingBuyer ? 'Pricing unlocks when your account is approved' : 'Sign in for pricing'}</span>}
          </div>
          {items.length > 0 && (
            isApprovedBuyer
              ? <Link className="button wide" to="/quote" onClick={onClose}>Checkout <span aria-hidden="true">↗</span></Link>
              : <>
                  <Link className="button wide" to="/quote" onClick={onClose}>Request quote <span aria-hidden="true">↗</span></Link>
                  {!pendingBuyer && <button className="drawer-signin text-link" type="button" onClick={onLoginClick}>Sign in for account pricing</button>}
                </>
          )}
          <p className="fine drawer-fine">The minimum order is $500.00. Free delivery over $1,500 applies on a delivery route in AL, MS &amp; GA. Will-call is pickup at the Birmingham warehouse during business hours.</p>
        </div>
      </aside>
    </ModalLayer>
  );
}
