// Slide-in cart: the lines in the cart, the estimated total (approved
// accounts) and the checkout/quote actions. Above the lines: products from an
// older cart that still need a variant (AW-354) and lines that can no longer
// be ordered (AW-083). A suspended account sees that ordering is paused, with
// the trade desk's phone and email, instead of the quote button (AW-201).

import { FREE_DELIVERY_THRESHOLD, ORDER_MINIMUM } from '../data/content.js';
import { formatMoney, formatMoneyShort } from '../lib/format.js';
import { totalLabel } from '../lib/pricing.js';
import { Link } from '../lib/router.js';
import { CallOrEmail } from './ContactLinks.jsx';
import { ModalLayer } from './ModalLayer.jsx';
import { CartLine } from './CartLine.jsx';
import { Icon } from './Icon.jsx';
import { SavedLinesNotice, UnavailableNotice } from './CartNotices.jsx';

export function CartDrawer({
  open, onClose, items, total, addLine, decLine, removeLine, removeLines, legacy = [], onDismissLegacy,
  profile, isApprovedBuyer, pricesStatus = 'ready', onLoginClick, isSuspended = false,
}) {
  if (!open) return null;
  const unavailable = items.filter(it => it.unavailable);
  // Guests are asked to sign in; signed-in buyers who are not approved yet are
  // told pricing is waiting on approval instead, and suspended ones that the
  // account is on hold.
  const pendingBuyer = Boolean(profile) && !isApprovedBuyer;
  let note = 'Sign in for pricing';
  if (isSuspended) note = 'Account on hold';
  else if (pendingBuyer) note = 'Pricing unlocks when your account is approved';
  return (
    <ModalLayer onClose={onClose}>
      <div className="overlay overlay-soft" aria-hidden="true" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="drawer-head">
          <h2 id="cart-title">Your order</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close cart"><Icon name="close" /></button>
        </div>
        <div className="drawer-body">
          <SavedLinesNotice items={legacy} onDismiss={onDismissLegacy} onChoose={onClose} />
          <UnavailableNotice items={unavailable} onRemoveAll={removeLines} />
          {items.length === 0 && <p className="empty-note">Your cart is empty.<br />Browse the catalog and add items to build an order.</p>}
          {items.length > 0 && (
            <ul className="drawer-lines" aria-label="Items in your order">
              {items.map(it => (
                <CartLine key={it.lineKey} item={it} layout="drawer" showPrice={isApprovedBuyer} pricesStatus={pricesStatus}
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
              ? <span>{totalLabel(items, total, pricesStatus)}</span>
              : <span className="drawer-total-note">{note}</span>}
          </div>
          {items.length > 0 && isSuspended && (
            <p className="notice drawer-paused">Ordering is paused on this account. <CallOrEmail after=" and a trade rep will help you sort it out." /></p>
          )}
          {items.length > 0 && !isSuspended && (
            isApprovedBuyer
              ? <Link className="button wide" to="/quote" onClick={onClose}>Checkout</Link>
              : <>
                  <Link className="button wide" to="/quote" onClick={onClose}>Request quote</Link>
                  {!pendingBuyer && <button className="drawer-signin text-link" type="button" onClick={onLoginClick}>Sign in for account pricing</button>}
                </>
          )}
          <p className="fine drawer-fine">{`The minimum order is ${formatMoney(ORDER_MINIMUM)}. Free delivery over ${formatMoneyShort(FREE_DELIVERY_THRESHOLD)} applies on a delivery route in AL, MS & GA. Will-call is pickup at the Birmingham warehouse during business hours.`}</p>
        </div>
      </aside>
    </ModalLayer>
  );
}
