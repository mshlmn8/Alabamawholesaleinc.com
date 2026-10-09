// Slide-in cart: the lines in the cart, the estimated total (approved
// accounts) and the checkout/quote actions. Above the lines: products from an
// older cart that still need a variant (AW-354) and lines that can no longer
// be ordered (AW-083). A suspended account sees that ordering is paused, with
// the trade desk's phone and email, instead of the quote button (AW-201).
//
// Removing a line (AW-042) is read out, and focus moves to the next line's
// quantity (else the line before), or to the drawer's heading when it was
// the last one, never to <body>. Closing hands focus back to the control
// that opened the drawer (ModalLayer); when that control has gone (the card
// stepper of a product just removed here), the page's heading takes it.

import { useEffect, useRef } from 'react';
import { FREE_DELIVERY_THRESHOLD, ORDER_MINIMUM } from '../data/content.js';
import { basketTerms } from '../data/terms.js';
import { announce } from '../lib/announce.js';
import { LINE_CONTROL, focusLineSoon, keepFocusNear, neighbourKey } from '../lib/focus.js';
import { formatMoney, formatMoneyShort } from '../lib/format.js';
import { totalLabel } from '../lib/pricing.js';
import { Link, focusPageHeading } from '../lib/router.js';
import { CallOrEmail } from './ContactLinks.jsx';
import { ModalLayer } from './ModalLayer.jsx';
import { CartLine } from './CartLine.jsx';
import { Icon } from './Icon.jsx';
import { SavedLinesNotice, UnavailableNotice } from './CartNotices.jsx';

export function CartDrawer({
  open, onClose, items, total, setLine, chooseVariant, removeLine, removeLines, legacy = [], onDismissLegacy,
  profile, isApprovedBuyer, pricesStatus = 'ready', onLoginClick, isSuspended = false,
}) {
  const listRef = useRef(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (closed && (!document.activeElement || document.activeElement === document.body)) focusPageHeading();
  }, [open]);
  if (!open) return null;
  // × on a line. The button goes with its line, so focus moves first (to the
  // heading) when no line is left, or after the redraw to a neighbour.
  const remove = (it, event) => {
    const next = neighbourKey(items.map(x => x.lineKey), it.lineKey);
    const dialog = event.currentTarget.closest('[role="dialog"]');
    if (!next) keepFocusNear(dialog);
    removeLine(it.lineKey);
    announce(`Removed ${it.name}.`);
    if (next) focusLineSoon(listRef.current, next, { selector: LINE_CONTROL, fallback: () => keepFocusNear(dialog) });
  };
  const unavailable = items.filter(it => it.unavailable);
  // A quote, or an order for an approved buyer (AW-132, src/data/terms.js).
  const basket = basketTerms(isApprovedBuyer);
  // Guests are told prices are for approved trade accounts, with a way to
  // sign in; signed-in buyers who are not approved yet are told pricing is
  // waiting on approval instead, and suspended ones that the account is on
  // hold.
  const pendingBuyer = Boolean(profile) && !isApprovedBuyer;
  let note = 'Prices show for approved trade accounts';
  if (isSuspended) note = 'Account on hold';
  else if (pendingBuyer) note = 'Pricing unlocks when your account is approved';
  return (
    <ModalLayer onClose={onClose}>
      <div className="overlay overlay-soft" aria-hidden="true" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="drawer-head">
          <h2 id="cart-title">{basket.title}</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="drawer-body">
          <SavedLinesNotice items={legacy} onDismiss={onDismissLegacy} onChoose={onClose} />
          <UnavailableNotice items={unavailable} onRemoveAll={removeLines} noun={basket.noun} />
          {items.length === 0 && <p className="empty-note"><span>{`${basket.empty}.`}</span><br /><span>{`Browse the catalog and add items to build ${basket.noun === 'order' ? 'an order' : 'a quote'}.`}</span></p>}
          {items.length > 0 && (
            <ul className="drawer-lines" aria-label={basket.items} ref={listRef}>
              {items.map(it => (
                <CartLine key={it.lineKey} item={it} layout="drawer" showPrice={isApprovedBuyer} pricesStatus={pricesStatus}
                          onSetQty={(n) => setLine(it.lineKey, n)} onChooseVariant={chooseVariant}
                          onRemove={(event) => remove(it, event)} onChoose={onClose} />
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
              ? <Link className="button wide" to="/quote" onClick={onClose}>{basket.cta}</Link>
              : <>
                  <Link className="button wide" to="/quote" onClick={onClose}>{basket.cta}</Link>
                  {!pendingBuyer && <button className="drawer-signin text-link" type="button" onClick={onLoginClick}>Sign in for account pricing</button>}
                </>
          )}
          <p className="fine drawer-fine">{`The minimum order is ${formatMoney(ORDER_MINIMUM)}. Free delivery over ${formatMoneyShort(FREE_DELIVERY_THRESHOLD)} applies on a delivery route in AL, MS & GA. Will-call is pickup at the Birmingham warehouse during business hours.`}</p>
        </div>
      </aside>
    </ModalLayer>
  );
}
