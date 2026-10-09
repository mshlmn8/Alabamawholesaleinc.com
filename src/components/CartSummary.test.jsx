// The cart's summary (AW-238): lines and units for everyone, the approved
// buyer's meter (a status sentence naming a <progress>), and a note for the
// other states. Prices are test values.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FREE_DELIVERY_THRESHOLD, ORDER_MINIMUM } from '../data/content.js';
import { formatMoney, formatMoneyShort } from '../lib/format.js';
import { CartSummary } from './CartSummary.jsx';

const line = (over) => ({ lineKey: '14', productId: 14, qty: 30, price: 10, needsVariant: false, unavailable: null, ...over });
const ITEMS = [line(), line({ lineKey: '45', productId: 45, qty: 3, price: 2 })];
const summary = (props) => render(<CartSummary items={ITEMS} total={306} pricesStatus="ready" {...props} />);
const counts = () => document.querySelector('.cart-counts')?.textContent ?? null;
const note = () => document.querySelector('.cart-summary-note')?.textContent ?? null;

describe('CartSummary', () => {
  it('counts lines and units in one text node', () => {
    summary({});
    const p = document.querySelector('.cart-counts');
    expect(p.textContent).toBe('2 lines · 33 units');
    expect(p.childNodes).toHaveLength(1);
  });

  it('tells guests and pending accounts who confirms pricing, the minimum and delivery, with no meter', () => {
    summary({ isApprovedBuyer: false });
    expect(note()).toBe('Pricing, the order minimum and delivery are confirmed by the trade desk.');
    expect(document.querySelector('progress')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows a suspended account the counts only', () => {
    summary({ isApprovedBuyer: false, isSuspended: true });
    expect(counts()).toBe('2 lines · 33 units');
    expect(note()).toBeNull();
    expect(document.querySelector('progress')).toBeNull();
    // Nothing at all without the counts.
    const view = render(<CartSummary items={ITEMS} total={306} isSuspended showCounts={false} />);
    expect(view.container.innerHTML).toBe('');
  });

  it('measures an approved buyer’s order against the minimum, as a status that names the meter', () => {
    summary({ isApprovedBuyer: true });
    const status = screen.getByRole('status');
    expect(status.textContent).toBe(`Add ${formatMoney(ORDER_MINIMUM - 306)} to reach the ${formatMoneyShort(ORDER_MINIMUM)} order minimum.`);
    const meter = screen.getByRole('progressbar');
    expect(meter.getAttribute('aria-labelledby')).toBe(status.id);
    expect(Number(meter.getAttribute('max'))).toBe(ORDER_MINIMUM);
    expect(Number(meter.getAttribute('value'))).toBe(306);
    expect(meter.getAttribute('style')).toBeNull();
    expect(meter.className).toBe('cart-meter');
  });

  it('moves on to free delivery, and marks it reached only over the threshold', () => {
    const view = summary({ isApprovedBuyer: true, total: ORDER_MINIMUM });
    expect(screen.getByRole('status').textContent).toBe(`Add ${formatMoney(FREE_DELIVERY_THRESHOLD - ORDER_MINIMUM)} for free delivery on a delivery route.`);
    expect(Number(screen.getByRole('progressbar').getAttribute('max'))).toBe(FREE_DELIVERY_THRESHOLD);
    view.rerender(<CartSummary items={ITEMS} total={FREE_DELIVERY_THRESHOLD} isApprovedBuyer pricesStatus="ready" />);
    expect(screen.getByRole('status').textContent).toBe(`Free delivery applies to orders over ${formatMoneyShort(FREE_DELIVERY_THRESHOLD)} on a delivery route.`);
    expect(screen.getByRole('progressbar').className).toBe('cart-meter');
    view.rerender(<CartSummary items={ITEMS} total={FREE_DELIVERY_THRESHOLD + 0.01} isApprovedBuyer pricesStatus="ready" />);
    expect(screen.getByRole('status').textContent).toBe('This order qualifies for free delivery on a delivery route.');
    expect(screen.getByRole('progressbar').className).toBe('cart-meter is-reached');
  });

  it('waits for every line’s price before measuring', () => {
    const view = summary({ isApprovedBuyer: true, pricesStatus: 'loading' });
    const waiting = 'The minimum and free delivery are worked out once every line has a price.';
    expect(note()).toBe(waiting);
    expect(screen.queryByRole('progressbar')).toBeNull();
    view.rerender(<CartSummary items={[...ITEMS, line({ lineKey: '7', price: null })]} total={306} isApprovedBuyer pricesStatus="ready" />);
    expect(note()).toBe(waiting);
    view.rerender(<CartSummary items={[...ITEMS, line({ lineKey: '1', needsVariant: true })]} total={606} isApprovedBuyer pricesStatus="ready" />);
    expect(note()).toBe(waiting);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('leaves the counts out when told to (checkout prints them under the list)', () => {
    summary({ isApprovedBuyer: true, showCounts: false });
    expect(counts()).toBeNull();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });
});
