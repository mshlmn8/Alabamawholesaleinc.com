// The cart's summary (AW-238), above the drawer's total and under
// checkout's: '2 lines · 14 units' for everyone (showCounts), then
//   - an approved buyer whose lines all have a price (meterReady): how much
//     more reaches the order minimum, then free delivery, as a sentence (a
//     polite live region, so a quantity change is read out) and a <progress>
//     named by it;
//   - an approved buyer whose cart can't be measured yet: that it will be;
//   - guests and accounts waiting for approval: who confirms pricing, the
//     minimum and delivery;
//   - a suspended account: nothing more (ordering is paused).
// Checkout passes canSubmitBelowMinimum while its submit button can be used:
// below the minimum, the sentence then adds that the order can still be
// submitted (AW-076, NEW-059). The <progress> is named by the first sentence
// alone.
// The words and the arithmetic are in src/lib/cartSummary.js.

import { useId } from 'react';
import {
  BELOW_MINIMUM_ALLOWED, SUMMARY_NOT_READY, SUMMARY_TRADE_DESK, cartCounts, countsLabel, deliveryMessage, deliveryProgress, meterReady,
} from '../lib/cartSummary.js';

function Meter({ total, canSubmitBelowMinimum }) {
  const id = useId();
  const progress = deliveryProgress(total);
  const allowed = canSubmitBelowMinimum && progress.stage === 'minimum';
  return (
    <>
      <p className="cart-meter-text" role="status">
        <span id={id}>{deliveryMessage(progress)}</span>
        {allowed && <span>{` ${BELOW_MINIMUM_ALLOWED}`}</span>}
      </p>
      <progress className={progress.stage === 'reached' ? 'cart-meter is-reached' : 'cart-meter'} max={progress.max} value={progress.value} aria-labelledby={id} />
    </>
  );
}

export function CartSummary({
  items, total, isApprovedBuyer = false, isSuspended = false, pricesStatus = 'ready', showCounts = true, canSubmitBelowMinimum = false,
}) {
  const meter = !isSuspended && isApprovedBuyer && meterReady(items, pricesStatus);
  let note = '';
  if (!isSuspended && !meter) note = isApprovedBuyer ? SUMMARY_NOT_READY : SUMMARY_TRADE_DESK;
  if (!showCounts && !meter && !note) return null;
  return (
    <div className="cart-summary">
      {showCounts && <p className="cart-counts">{countsLabel(cartCounts(items))}</p>}
      {meter && <Meter total={total} canSubmitBelowMinimum={canSubmitBelowMinimum} />}
      {note && <p className="cart-summary-note">{note}</p>}
    </div>
  );
}
