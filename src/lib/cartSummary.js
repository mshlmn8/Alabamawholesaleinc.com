// The cart's summary (AW-238): how many lines and units it holds, and, for an
// approved buyer whose lines all have a price, how far the order is from the
// order minimum and from free delivery. Pure; src/components/CartSummary.jsx
// renders it in the cart drawer and on checkout.
//
// Money is compared in whole cents, like the totals (src/lib/pricing.js), so
// $499.99 is one cent short of the minimum and never rounds up to it.
//
// The minimum is reached at ORDER_MINIMUM. Free delivery is published as
// "over" FREE_DELIVERY_THRESHOLD, so it is reached only above it; at exactly
// the threshold the message repeats the rule instead of asking for $0.00
// more. "Over" or "or more" is the owner question next to
// FREE_DELIVERY_THRESHOLD in src/data/content.js (TODO(owner), AW-283). The
// delivery fee under the threshold is not stated anywhere (AW-130).

import { FREE_DELIVERY_THRESHOLD, ORDER_MINIMUM } from '../data/content.js';
import { formatMoney, formatMoneyShort } from './format.js';
import { fromCents, toCents } from './pricing.js';

// { lines, units }: every line on the list, and the units of the lines that
// can be ordered (a line that can no longer be ordered is not sent).
export function cartCounts(items) {
  const list = items || [];
  let units = 0;
  for (const item of list) {
    if (!item?.unavailable) units += Math.max(0, Math.round(Number(item?.qty) || 0));
  }
  return { lines: list.length, units };
}

// '2 lines · 1,500 units'. One string, for a single text node.
export const countsLabel = ({ lines, units }) =>
  `${lines} ${lines === 1 ? 'line' : 'lines'} · ${units.toLocaleString('en-US')} ${units === 1 ? 'unit' : 'units'}`;

// Where an order total (in dollars) stands:
//   stage      'minimum'  below the order minimum
//              'free'     at or over the minimum, not yet over the
//                         free-delivery threshold
//              'reached'  over the threshold
//   remaining  dollars still to add for the stage's goal (0 once reached, and
//              0 at exactly the threshold)
//   value, max for a <progress>: the total against the stage's goal
export function deliveryProgress(total) {
  const cents = Math.max(0, toCents(total) ?? 0);
  const minimum = toCents(ORDER_MINIMUM);
  const free = toCents(FREE_DELIVERY_THRESHOLD);
  if (cents < minimum) return { stage: 'minimum', remaining: fromCents(minimum - cents), value: fromCents(cents), max: ORDER_MINIMUM };
  if (cents <= free) return { stage: 'free', remaining: fromCents(free - cents), value: fromCents(cents), max: FREE_DELIVERY_THRESHOLD };
  return { stage: 'reached', remaining: 0, value: FREE_DELIVERY_THRESHOLD, max: FREE_DELIVERY_THRESHOLD };
}

// The sentence for deliveryProgress(). Thresholds print through
// formatMoneyShort, amounts to add through formatMoney.
export function deliveryMessage({ stage, remaining }) {
  if (stage === 'minimum') return `Add ${formatMoney(remaining)} to reach the ${formatMoneyShort(ORDER_MINIMUM)} order minimum.`;
  if (stage === 'free') {
    return remaining > 0
      ? `Add ${formatMoney(remaining)} for free delivery on a delivery route.`
      : `Free delivery applies to orders over ${formatMoneyShort(FREE_DELIVERY_THRESHOLD)} on a delivery route.`;
  }
  return 'This order qualifies for free delivery on a delivery route.';
}

// The meter can be shown: the buyer's prices are in, every line that can be
// ordered has one, and no line still needs its variant (its price, and so
// the total, is not known yet).
export function meterReady(items, pricesStatus) {
  if (pricesStatus !== 'ready') return false;
  const orderable = (items || []).filter((item) => !item?.unavailable);
  return orderable.length > 0 && orderable.every((item) => !item.needsVariant && item.price != null);
}

// Below the minimum, checkout adds this to the meter's sentence while its
// submit button can be used (AW-076, NEW-059): the minimum is not enforced,
// the owner question at ORDER_MINIMUM in src/data/content.js. It is the
// page's one mention of the minimum then (AW-283).
export const BELOW_MINIMUM_ALLOWED = 'You can still submit this order.';

// An approved buyer's cart that can't be measured yet (prices loading or
// failed, price on request, a variant to choose).
export const SUMMARY_NOT_READY = 'The minimum and free delivery are worked out once every line has a price.';
// Guests and accounts waiting for approval see no prices.
export const SUMMARY_TRADE_DESK = 'Pricing, the order minimum and delivery are confirmed by the trade desk.';
