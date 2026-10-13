// The cart's lines-and-units summary and the approved buyer's way to the
// order minimum and free delivery (AW-238). Amounts are worked in cents; the
// thresholds come from content.js, so the expectations print them the same
// way instead of typing them.
import { describe, expect, it } from 'vitest';
import { FREE_DELIVERY_THRESHOLD, ORDER_MINIMUM } from '../data/content.js';
import { formatMoney, formatMoneyShort } from './format.js';
import {
  SUMMARY_NOT_READY, SUMMARY_TRADE_DESK, cartCounts, countsLabel, deliveryMessage, deliveryProgress, meterReady,
} from './cartSummary.js';

const MIN = formatMoneyShort(ORDER_MINIMUM);
const FREE = formatMoneyShort(FREE_DELIVERY_THRESHOLD);
const line = (over) => ({ lineKey: '14', productId: 14, qty: 2, price: 10, needsVariant: false, unavailable: null, ...over });

describe('cartCounts and countsLabel', () => {
  it('counts every line, and the units of the lines that can be ordered', () => {
    const items = [line({ qty: 40 }), line({ lineKey: '45', qty: 3 }), line({ lineKey: '9', qty: 5, unavailable: 'product' })];
    expect(cartCounts(items)).toEqual({ lines: 3, units: 43 });
    expect(cartCounts([])).toEqual({ lines: 0, units: 0 });
    expect(cartCounts(undefined)).toEqual({ lines: 0, units: 0 });
  });

  it('says line and unit in the singular for one, with thousands separators', () => {
    expect(countsLabel({ lines: 1, units: 1 })).toBe('1 line · 1 unit');
    expect(countsLabel({ lines: 2, units: 1500 })).toBe('2 lines · 1,500 units');
    expect(countsLabel({ lines: 0, units: 0 })).toBe('0 lines · 0 units');
  });
});

describe('deliveryProgress and deliveryMessage', () => {
  const at = (total) => {
    const progress = deliveryProgress(total);
    return { ...progress, message: deliveryMessage(progress) };
  };

  it('asks for the rest of the minimum below it', () => {
    expect(at(0)).toEqual({ stage: 'minimum', remaining: ORDER_MINIMUM, value: 0, max: ORDER_MINIMUM, message: `Add ${formatMoney(ORDER_MINIMUM)} to reach the ${MIN} order minimum.` });
    // One cent short is one cent, never rounded away.
    expect(at(ORDER_MINIMUM - 0.01)).toMatchObject({ stage: 'minimum', remaining: 0.01, value: ORDER_MINIMUM - 0.01, message: `Add $0.01 to reach the ${MIN} order minimum.` });
    expect(at(120.5).message).toBe(`Add ${formatMoney(ORDER_MINIMUM - 120.5)} to reach the ${MIN} order minimum.`);
  });

  it('reaches the minimum at the minimum, then asks for the rest of free delivery', () => {
    expect(at(ORDER_MINIMUM)).toEqual({
      stage: 'free', remaining: FREE_DELIVERY_THRESHOLD - ORDER_MINIMUM, value: ORDER_MINIMUM, max: FREE_DELIVERY_THRESHOLD,
      message: `Add ${formatMoney(FREE_DELIVERY_THRESHOLD - ORDER_MINIMUM)} for free delivery on a delivery route.`,
    });
    expect(at(FREE_DELIVERY_THRESHOLD - 0.01)).toMatchObject({ stage: 'free', remaining: 0.01, message: 'Add $0.01 for free delivery on a delivery route.' });
  });

  it('gives free delivery only over the threshold, as published (AW-283), and says the rule at exactly it', () => {
    expect(at(FREE_DELIVERY_THRESHOLD)).toEqual({
      stage: 'free', remaining: 0, value: FREE_DELIVERY_THRESHOLD, max: FREE_DELIVERY_THRESHOLD,
      message: `Free delivery applies to orders over ${FREE} on a delivery route.`,
    });
    expect(at(FREE_DELIVERY_THRESHOLD + 0.01)).toEqual({
      stage: 'reached', remaining: 0, value: FREE_DELIVERY_THRESHOLD, max: FREE_DELIVERY_THRESHOLD,
      message: 'This order qualifies for free delivery on a delivery route.',
    });
    expect(at(25000).stage).toBe('reached');
  });

  it('works in cents, so float sums land on the right side of a threshold', () => {
    // 0.1 + 0.2 style noise: 499.99 + 0.01 in floats is 500 exactly in cents.
    expect(deliveryProgress(499.99 + 0.01).stage).toBe('free');
    expect(deliveryProgress(1499.99 + 0.01).stage).toBe('free');
    expect(deliveryProgress(1500.004).stage).toBe('free');
    expect(deliveryProgress(1500.006).stage).toBe('reached');
  });

  it('treats a missing or negative total as nothing yet', () => {
    expect(deliveryProgress(null)).toMatchObject({ stage: 'minimum', value: 0, remaining: ORDER_MINIMUM });
    expect(deliveryProgress(-5)).toMatchObject({ stage: 'minimum', value: 0 });
    expect(deliveryProgress('abc')).toMatchObject({ stage: 'minimum', value: 0 });
  });

  it('never states a delivery fee (AW-130)', () => {
    for (const total of [0, 499.99, 500, 1499.99, 1500, 1500.01]) expect(at(total).message).not.toMatch(/fee|charge|cost/i);
  });
});

describe('meterReady', () => {
  it('is ready once the prices are in and every line that can be ordered has one', () => {
    expect(meterReady([line()], 'ready')).toBe(true);
    // A line that can't be ordered has no price and doesn't count.
    expect(meterReady([line(), line({ lineKey: '9', price: null, unavailable: 'product' })], 'ready')).toBe(true);
  });

  it('waits for an unpriced line (price on request)', () => {
    expect(meterReady([line(), line({ lineKey: '45', price: null })], 'ready')).toBe(false);
  });

  it('waits for a line that still needs its variant', () => {
    expect(meterReady([line(), line({ lineKey: '1', needsVariant: true, price: 10 })], 'ready')).toBe(false);
  });

  it('waits while the prices load, and after they fail', () => {
    expect(meterReady([line()], 'loading')).toBe(false);
    expect(meterReady([line()], 'error')).toBe(false);
    expect(meterReady([line()], 'off')).toBe(false);
  });

  it('has nothing to measure without a line that can be ordered', () => {
    expect(meterReady([], 'ready')).toBe(false);
    expect(meterReady([line({ unavailable: 'product', price: null })], 'ready')).toBe(false);
  });
});

describe('summary notes', () => {
  it('say who confirms pricing, and when the meter will show', () => {
    expect(SUMMARY_TRADE_DESK).toBe('Pricing, the order minimum and delivery are confirmed by the trade desk.');
    expect(SUMMARY_NOT_READY).toBe('The minimum and free delivery are worked out once every line has a price.');
  });
});
